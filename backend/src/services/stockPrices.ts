/**
 * Stock Price Service
 * Fetches live stock prices from Finnhub.io
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';

interface FinnhubQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
}

/**
 * Fetch stock price from Finnhub for a single ticker
 */
export async function fetchStockPrice(ticker: string): Promise<FinnhubQuote | null> {
  if (!FINNHUB_API_KEY) {
    console.error('FINNHUB_API_KEY not set');
    return null;
  }

  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Finnhub API error for ${ticker}: ${response.status}`);
      return null;
    }

    const data = await response.json() as {
      c?: number;  // Current price
      d?: number;  // Change
      dp?: number; // Percent change
      h?: number;  // High
      l?: number;  // Low
      o?: number;  // Open
      pc?: number; // Previous close
    };

    // Check if we got valid data (Finnhub returns all zeros for invalid tickers)
    if (!data.c || data.c === 0) {
      console.error(`No valid data for ${ticker}`);
      return null;
    }

    return {
      symbol: ticker,
      price: data.c,
      change: data.d || 0,
      changePercent: data.dp || 0,
      high: data.h || 0,
      low: data.l || 0,
      open: data.o || 0,
      prevClose: data.pc || 0,
    };
  } catch (error) {
    console.error(`Error fetching price for ${ticker}:`, error);
    return null;
  }
}

/**
 * Fetch prices for multiple tickers
 */
export async function fetchMultipleStockPrices(tickers: string[]): Promise<Map<string, FinnhubQuote>> {
  const results = new Map<string, FinnhubQuote>();

  if (!FINNHUB_API_KEY) {
    console.error('FINNHUB_API_KEY not set');
    return results;
  }

  // Finnhub free tier: 60 calls/min, so we can be a bit faster
  for (const ticker of tickers) {
    const quote = await fetchStockPrice(ticker);
    if (quote) {
      results.set(ticker, quote);
    }
    // Small delay between requests (60/min = 1 per second is safe)
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

/**
 * Fetch crypto prices from CoinGecko
 */
async function fetchCryptoPrices(): Promise<{ btc: number | null; eth: number | null }> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd'
    );
    if (!res.ok) return { btc: null, eth: null };
    const data = await res.json() as { bitcoin?: { usd?: number }; ethereum?: { usd?: number } };
    return {
      btc: data.bitcoin?.usd ? Math.round(data.bitcoin.usd) : null,
      eth: data.ethereum?.usd ? Math.round(data.ethereum.usd) : null,
    };
  } catch (error) {
    console.error('Error fetching crypto prices:', error);
    return { btc: null, eth: null };
  }
}

/**
 * Fetch SOFR rate from NY Fed API
 */
async function fetchSofrRate(): Promise<number | null> {
  try {
    // NY Fed publishes SOFR data - fetch most recent
    const res = await fetch(
      'https://markets.newyorkfed.org/api/rates/secured/sofr/last/1.json'
    );
    if (!res.ok) return null;
    const data = await res.json() as { refRates?: Array<{ percentRate?: number }> };
    const rate = data.refRates?.[0]?.percentRate;
    return rate ? Math.round(rate * 100) / 100 : null;
  } catch (error) {
    console.error('Error fetching SOFR rate:', error);
    return null;
  }
}

/**
 * Update a setting in the database
 */
async function updateSetting(key: string, value: number): Promise<void> {
  await prisma.settings.upsert({
    where: { key },
    update: { value: value.toString(), updatedAt: new Date() },
    create: { key, value: value.toString() },
  });
}

/**
 * Update stock prices for all companies in the database
 */
export async function updateAllStockPrices(): Promise<{
  updated: number;
  failed: string[];
  prices: Record<string, number>;
  marketPrices?: { btcPrice?: number; ethPrice?: number; sofrRate?: number };
}> {
  const companies = await prisma.company.findMany({
    where: { archived: false },
    select: { ticker: true },
  });

  const tickers = companies.map((c: { ticker: string }) => c.ticker);
  const quotes = await fetchMultipleStockPrices(tickers);

  let updated = 0;
  const failed: string[] = [];
  const prices: Record<string, number> = {};

  for (const ticker of tickers) {
    const quote = quotes.get(ticker);

    if (quote) {
      await prisma.company.update({
        where: { ticker },
        data: {
          stockPrice: quote.price,
          updatedAt: new Date(),
        },
      });
      prices[ticker] = quote.price;
      updated++;
    } else {
      failed.push(ticker);
    }
  }

  // Also fetch and update market prices (BTC, ETH, SOFR)
  const marketPrices: { btcPrice?: number; ethPrice?: number; sofrRate?: number } = {};

  // Fetch crypto prices
  const cryptoPrices = await fetchCryptoPrices();
  if (cryptoPrices.btc) {
    await updateSetting('btcPrice', cryptoPrices.btc);
    marketPrices.btcPrice = cryptoPrices.btc;
  }
  if (cryptoPrices.eth) {
    await updateSetting('ethPrice', cryptoPrices.eth);
    marketPrices.ethPrice = cryptoPrices.eth;
  }

  // Fetch SOFR rate
  const sofrRate = await fetchSofrRate();
  if (sofrRate !== null) {
    await updateSetting('sofrRate', sofrRate);
    marketPrices.sofrRate = sofrRate;
  }

  return { updated, failed, prices, marketPrices };
}

/**
 * Get cached prices from database
 */
export async function getCachedPrices(): Promise<Record<string, number | null>> {
  const companies = await prisma.company.findMany({
    where: { archived: false },
    select: { ticker: true, stockPrice: true },
  });

  const prices: Record<string, number | null> = {};
  for (const company of companies) {
    prices[company.ticker] = company.stockPrice ? parseFloat(company.stockPrice.toString()) : null;
  }

  return prices;
}
