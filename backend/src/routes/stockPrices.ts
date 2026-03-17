/**
 * Stock Prices Route
 * API endpoints for fetching and updating stock prices
 */

import { Router, Request, Response } from 'express';
import {
  updateAllStockPrices,
  getCachedPrices,
  fetchStockPrice,
  fetchCompanyInfo,
} from '../services/stockPrices.js';

const router = Router();

// GET /api/v1/stock-prices
// Get cached stock prices from database
router.get('/', async (req: Request, res: Response) => {
  try {
    const prices = await getCachedPrices();
    res.json({ prices });
  } catch (error) {
    console.error('Error getting cached prices:', error);
    res.status(500).json({ error: 'Failed to get stock prices' });
  }
});

// POST /api/v1/stock-prices/refresh
// Fetch fresh prices from Yahoo Finance and update database
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const result = await updateAllStockPrices();
    res.json({
      success: true,
      message: `Updated ${result.updated} stock prices`,
      ...result,
    });
  } catch (error) {
    console.error('Error refreshing prices:', error);
    res.status(500).json({ error: 'Failed to refresh stock prices' });
  }
});

// GET /api/v1/stock-prices/lookup/:ticker
// Look up company name + info from Finnhub for a ticker
router.get('/lookup/:ticker', async (req: Request, res: Response) => {
  try {
    const { ticker } = req.params;
    const info = await fetchCompanyInfo(ticker.toUpperCase());
    if (!info) {
      return res.status(404).json({ error: `No company found for ${ticker}` });
    }
    res.json(info);
  } catch (error) {
    console.error('Error looking up company:', error);
    res.status(500).json({ error: 'Failed to look up company' });
  }
});

// GET /api/v1/stock-prices/:ticker
// Get price for a specific ticker
router.get('/:ticker', async (req: Request, res: Response) => {
  try {
    const { ticker } = req.params;
    const quote = await fetchStockPrice(ticker.toUpperCase());

    if (!quote) {
      return res.status(404).json({ error: `No price found for ${ticker}` });
    }

    res.json(quote);
  } catch (error) {
    console.error('Error fetching price:', error);
    res.status(500).json({ error: 'Failed to fetch stock price' });
  }
});

export default router;
