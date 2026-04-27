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
 * Fetch company profile from Finnhub (market cap + shares outstanding)
 */
export async function fetchCompanyProfile(ticker: string): Promise<{ marketCapM: number; sharesOutM: number } | null> {
  if (!FINNHUB_API_KEY) return null;

  try {
    const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FINNHUB_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json() as {
      marketCapitalization?: number; // in millions
      shareOutstanding?: number;     // in millions
    };

    if (!data.marketCapitalization && !data.shareOutstanding) return null;

    return {
      marketCapM: data.marketCapitalization || 0,
      sharesOutM: data.shareOutstanding || 0,
    };
  } catch (error) {
    console.error(`Error fetching profile for ${ticker}:`, error);
    return null;
  }
}

/**
 * Fetch company info from Finnhub (name, market cap, shares outstanding)
 */
export async function fetchCompanyInfo(ticker: string): Promise<{ name: string; marketCapM: number; sharesOutM: number } | null> {
  if (!FINNHUB_API_KEY) return null;

  try {
    const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FINNHUB_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json() as {
      name?: string;
      marketCapitalization?: number;
      shareOutstanding?: number;
    };

    if (!data.name) return null;

    return {
      name: data.name,
      marketCapM: data.marketCapitalization || 0,
      sharesOutM: data.shareOutstanding || 0,
    };
  } catch (error) {
    console.error(`Error fetching company info for ${ticker}:`, error);
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
 * Extract Google Sheet ID from a URL
 */
function extractGoogleSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Fetch a named range value from a published Google Sheet.
 * The sheet must be published to web (File → Share → Publish to web).
 * Returns the numeric value from the first cell of the named range.
 */
async function fetchGoogleSheetRange(sheetUrl: string, rangeName: string): Promise<number | null> {
  const sheetId = extractGoogleSheetId(sheetUrl);
  if (!sheetId) {
    console.error(`[sheets] Could not extract sheet ID from: ${sheetUrl}`);
    return null;
  }

  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&range=${encodeURIComponent(rangeName)}`;
    const res = await fetch(csvUrl);
    if (!res.ok) {
      console.error(`[sheets] Failed to fetch range "${rangeName}" from sheet ${sheetId}: ${res.status}`);
      return null;
    }

    const text = await res.text();
    // CSV response: first line is header (the range name), second line is the value
    // Or it might just be a single value — handle both cases
    const lines = text.trim().split('\n');
    const valueLine = lines.length > 1 ? lines[lines.length - 1] : lines[0];
    // Strip quotes and whitespace, parse as number
    const cleaned = valueLine.replace(/"/g, '').replace(/[$,]/g, '').trim();
    const num = parseFloat(cleaned);

    if (isNaN(num)) {
      console.error(`[sheets] Could not parse numeric value from range "${rangeName}": "${valueLine}"`);
      return null;
    }

    console.log(`[sheets] Fetched "${rangeName}" from sheet ${sheetId}: ${num}`);
    return num;
  } catch (error) {
    console.error(`[sheets] Error fetching range "${rangeName}" from sheet ${sheetId}:`, error);
    return null;
  }
}

/**
 * Update fair value overrides from linked Google Sheets for all companies
 * that have both fairValueOverrideUrl (Google Sheet) and fairValueSourceRange set.
 */
export async function updateFairValuesFromSheets(): Promise<{ updated: string[]; failed: string[] }> {
  const companies = await prisma.company.findMany({
    where: {
      archived: false,
      fairValueSourceRange: { not: null },
      fairValueOverrideUrl: { not: null },
    },
    select: {
      ticker: true,
      fairValueOverrideUrl: true,
      fairValueSourceRange: true,
    },
  });

  const updated: string[] = [];
  const failed: string[] = [];

  for (const company of companies) {
    if (!company.fairValueOverrideUrl || !company.fairValueSourceRange) continue;

    // Only process Google Sheet URLs
    if (!company.fairValueOverrideUrl.includes('docs.google.com/spreadsheets')) continue;

    const value = await fetchGoogleSheetRange(company.fairValueOverrideUrl, company.fairValueSourceRange);
    if (value !== null) {
      await prisma.company.update({
        where: { ticker: company.ticker },
        data: { fairValueOverride: value },
      });
      updated.push(company.ticker);
      console.log(`[sheets] Updated ${company.ticker} fair value override to $${value}`);
    } else {
      failed.push(company.ticker);
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return { updated, failed };
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
  sheetUpdates?: { updated: string[]; failed: string[] };
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
      // Also fetch company profile for market cap & shares outstanding
      const profile = await fetchCompanyProfile(ticker);
      await new Promise(resolve => setTimeout(resolve, 100)); // rate limit

      const updateData: Record<string, any> = {
        stockPrice: quote.price,
        updatedAt: new Date(),
      };
      if (profile && profile.sharesOutM > 0) {
        updateData.sharesOutM = profile.sharesOutM;
        // FD shares must always be >= shares outstanding; auto-correct if stale
        const existing = await prisma.company.findUnique({ where: { ticker }, select: { fdSharesM: true } });
        const currentFd = Number(existing?.fdSharesM) || 0;
        if (currentFd > 0 && profile.sharesOutM > currentFd) {
          updateData.fdSharesM = profile.sharesOutM;
          console.log(`[stock-prices] ${ticker}: FD shares ${currentFd}M < shares out ${profile.sharesOutM}M — bumping FD to match`);
        }
      }

      await prisma.company.update({
        where: { ticker },
        data: updateData,
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

  // Fetch fair values from linked Google Sheets
  let sheetUpdates: { updated: string[]; failed: string[] } = { updated: [], failed: [] };
  try {
    sheetUpdates = await updateFairValuesFromSheets();
    if (sheetUpdates.updated.length > 0) {
      console.log(`[sheets] Updated fair values for: ${sheetUpdates.updated.join(', ')}`);
    }
  } catch (error) {
    console.error('[sheets] Error updating fair values from sheets:', error);
  }

  return { updated, failed, prices, marketPrices, sheetUpdates };
}

/**
 * Fetch historical daily closing prices via Yahoo Finance chart API.
 * Free, no API key required, works server-side.
 * Returns an array of closing prices (oldest→newest) for the given ticker.
 */
export async function fetchStockCandles(
  ticker: string,
  days: number = 30
): Promise<number[] | null> {
  try {
    // Map days to Yahoo range param: 1mo, 3mo, 6mo, 1y
    let range = '1mo';
    if (days > 180) range = '1y';
    else if (days > 90) range = '6mo';
    else if (days > 30) range = '3mo';

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=1d`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MinerTerminal/1.0)',
      },
    });

    if (!response.ok) {
      console.error(`Yahoo Finance chart API error for ${ticker}: ${response.status}`);
      return null;
    }

    const data = await response.json() as {
      chart?: {
        result?: Array<{
          indicators?: {
            quote?: Array<{
              close?: (number | null)[];
            }>;
          };
        }>;
        error?: { code?: string; description?: string };
      };
    };

    if (data.chart?.error) {
      console.error(`Yahoo Finance error for ${ticker}:`, data.chart.error.description);
      return null;
    }

    const closes = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    if (!closes || closes.length === 0) {
      console.error(`No chart data for ${ticker} from Yahoo Finance`);
      return null;
    }

    // Filter out nulls (weekends/holidays can have null entries) and ensure we have numbers
    const validCloses = closes.filter((c): c is number => c !== null && c !== undefined);

    if (validCloses.length < 2) {
      console.error(`Insufficient chart data for ${ticker}: only ${validCloses.length} points`);
      return null;
    }

    return validCloses; // array of closing prices, oldest first
  } catch (error) {
    console.error(`Error fetching chart data for ${ticker}:`, error);
    return null;
  }
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
