import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import importRouter from './routes/import.js';
import stockPricesRouter from './routes/stockPrices.js';

// Load environment variables
dotenv.config();

// Initialize Prisma
export const prisma = new PrismaClient();

// Create Express app
const app = express();
const httpServer = createServer(app);

// Socket.IO for real-time updates
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || origin.endsWith('.onrender.com') || origin.includes('localhost')) {
        return callback(null, true);
      }
      callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  },
});

// Middleware
app.use(helmet());

// CORS - allow multiple origins for Render deployment
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    // Allow if origin is in allowed list or is a Render URL
    if (allowedOrigins.includes(origin) || origin.endsWith('.onrender.com')) {
      return callback(null, true);
    }
    callback(null, true); // Allow all for now during development
  },
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ===========================================
// COMPANIES API
// ===========================================

// GET all companies with full hierarchy
app.get('/api/v1/companies', async (req, res) => {
  try {
    const companies = await prisma.company.findMany({
      where: { archived: false },
      include: {
        sites: {
          include: {
            campuses: {
              include: {
                buildings: {
                  include: {
                    usePeriods: {
                      where: { isCurrent: true },
                    },
                  },
                },
              },
            },
          },
        },
        debts: true,
      },
    });
    res.json(companies);
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// GET single company
app.get('/api/v1/companies/:ticker', async (req, res) => {
  try {
    const company = await prisma.company.findUnique({
      where: { ticker: req.params.ticker },
      include: {
        sites: {
          include: {
            campuses: {
              include: {
                buildings: {
                  include: {
                    usePeriods: true,
                  },
                },
              },
            },
            factors: true,
          },
        },
        factors: true,
        debts: true,
      },
    });
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(company);
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// PUT update company (for updating FD shares, stock price, etc.)
app.put('/api/v1/companies/:ticker', async (req, res) => {
  try {
    const company = await prisma.company.update({
      where: { ticker: req.params.ticker },
      data: req.body,
    });
    res.json(company);
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

// ===========================================
// SITES API
// ===========================================

app.get('/api/v1/sites', async (req, res) => {
  try {
    const sites = await prisma.site.findMany({
      include: {
        campuses: {
          include: {
            buildings: {
              include: {
                usePeriods: { where: { isCurrent: true } },
              },
            },
          },
        },
      },
    });
    res.json(sites);
  } catch (error) {
    console.error('Error fetching sites:', error);
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

app.patch('/api/v1/sites/:id', async (req, res) => {
  try {
    const site = await prisma.site.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(site);
  } catch (error) {
    console.error('Error updating site:', error);
    res.status(500).json({ error: 'Failed to update site' });
  }
});

app.delete('/api/v1/sites/:id', async (req, res) => {
  try {
    await prisma.site.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting site:', error);
    res.status(500).json({ error: 'Failed to delete site' });
  }
});

// ===========================================
// CAMPUSES API
// ===========================================

app.get('/api/v1/campuses', async (req, res) => {
  try {
    const campuses = await prisma.campus.findMany({
      include: {
        site: true,
        buildings: {
          include: {
            usePeriods: { where: { isCurrent: true } },
          },
        },
      },
    });
    res.json(campuses);
  } catch (error) {
    console.error('Error fetching campuses:', error);
    res.status(500).json({ error: 'Failed to fetch campuses' });
  }
});

app.patch('/api/v1/campuses/:id', async (req, res) => {
  try {
    const campus = await prisma.campus.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(campus);
  } catch (error) {
    console.error('Error updating campus:', error);
    res.status(500).json({ error: 'Failed to update campus' });
  }
});

app.delete('/api/v1/campuses/:id', async (req, res) => {
  try {
    await prisma.campus.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting campus:', error);
    res.status(500).json({ error: 'Failed to delete campus' });
  }
});

// ===========================================
// BUILDINGS API
// ===========================================

app.get('/api/v1/buildings', async (req, res) => {
  try {
    const buildings = await prisma.building.findMany({
      include: {
        campus: {
          include: { site: true },
        },
        usePeriods: true,
      },
    });
    res.json(buildings);
  } catch (error) {
    console.error('Error fetching buildings:', error);
    res.status(500).json({ error: 'Failed to fetch buildings' });
  }
});

app.patch('/api/v1/buildings/:id', async (req, res) => {
  try {
    const building = await prisma.building.update({
      where: { id: req.params.id },
      data: req.body,
      include: {
        usePeriods: { where: { isCurrent: true } },
      },
    });
    res.json(building);
  } catch (error) {
    console.error('Error updating building:', error);
    res.status(500).json({ error: 'Failed to update building' });
  }
});

app.delete('/api/v1/buildings/:id', async (req, res) => {
  try {
    await prisma.building.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting building:', error);
    res.status(500).json({ error: 'Failed to delete building' });
  }
});

// ===========================================
// USE PERIODS API
// ===========================================

app.get('/api/v1/use-periods', async (req, res) => {
  try {
    const usePeriods = await prisma.usePeriod.findMany({
      include: { building: true },
    });
    res.json(usePeriods);
  } catch (error) {
    console.error('Error fetching use periods:', error);
    res.status(500).json({ error: 'Failed to fetch use periods' });
  }
});

// Get all use periods for a specific building (for splits/transitions view)
app.get('/api/v1/buildings/:id/use-periods', async (req, res) => {
  try {
    const usePeriods = await prisma.usePeriod.findMany({
      where: { buildingId: req.params.id },
      orderBy: [{ isCurrent: 'desc' }, { startDate: 'asc' }],
    });
    res.json(usePeriods);
  } catch (error) {
    console.error('Error fetching building use periods:', error);
    res.status(500).json({ error: 'Failed to fetch use periods' });
  }
});

app.post('/api/v1/use-periods', async (req, res) => {
  try {
    const { isSplit, ...data } = req.body;

    // Compute noiAnnualM from lease data if not provided
    if (!data.noiAnnualM && data.leaseValueM && data.noiPct) {
      const leaseVal = Number(data.leaseValueM) || 0;
      const leaseYrs = Number(data.leaseYears) || 10;
      const noiPctVal = Number(data.noiPct) || 0; // stored as 0-1 fraction
      const annualRev = leaseVal / Math.max(leaseYrs, 0.1);
      data.noiAnnualM = annualRev * noiPctVal;
    }

    // If it's a SPLIT, we want multiple concurrent periods (don't mark others as not current)
    // If it's a TRANSITION (not a split), mark old periods as ended
    if (data.isCurrent && data.buildingId && !isSplit) {
      await prisma.usePeriod.updateMany({
        where: { buildingId: data.buildingId, isCurrent: true },
        data: { isCurrent: false, endDate: new Date() },
      });
    }

    const usePeriod = await prisma.usePeriod.create({
      data,
    });
    res.json(usePeriod);
  } catch (error) {
    console.error('Error creating use period:', error);
    res.status(500).json({ error: 'Failed to create use period' });
  }
});

app.patch('/api/v1/use-periods/:id', async (req, res) => {
  try {
    const usePeriod = await prisma.usePeriod.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(usePeriod);
  } catch (error) {
    console.error('Error updating use period:', error);
    res.status(500).json({ error: 'Failed to update use period' });
  }
});

app.delete('/api/v1/use-periods/:id', async (req, res) => {
  try {
    await prisma.usePeriod.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting use period:', error);
    res.status(500).json({ error: 'Failed to delete use period' });
  }
});

// ===========================================
// MINING VALUATION API
// ===========================================

app.get('/api/v1/mining-valuations', async (req, res) => {
  try {
    const valuations = await prisma.miningValuation.findMany({
      orderBy: { ticker: 'asc' },
    });
    res.json(valuations);
  } catch (error) {
    console.error('Error fetching mining valuations:', error);
    res.status(500).json({ error: 'Failed to fetch mining valuations' });
  }
});

app.post('/api/v1/mining-valuations', async (req, res) => {
  try {
    const valuation = await prisma.miningValuation.upsert({
      where: { ticker: req.body.ticker },
      update: req.body,
      create: req.body,
    });
    res.json(valuation);
  } catch (error) {
    console.error('Error saving mining valuation:', error);
    res.status(500).json({ error: 'Failed to save mining valuation' });
  }
});

app.patch('/api/v1/mining-valuations/:ticker', async (req, res) => {
  try {
    const valuation = await prisma.miningValuation.update({
      where: { ticker: req.params.ticker },
      data: req.body,
    });
    res.json(valuation);
  } catch (error) {
    console.error('Error updating mining valuation:', error);
    res.status(500).json({ error: 'Failed to update mining valuation' });
  }
});

app.delete('/api/v1/mining-valuations/:ticker', async (req, res) => {
  try {
    await prisma.miningValuation.delete({ where: { ticker: req.params.ticker } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting mining valuation:', error);
    res.status(500).json({ error: 'Failed to delete mining valuation' });
  }
});

// ===========================================
// NET LIQUID ASSETS API
// ===========================================

app.get('/api/v1/net-liquid-assets', async (req, res) => {
  try {
    const assets = await prisma.netLiquidAssets.findMany({
      orderBy: { ticker: 'asc' },
    });
    res.json(assets);
  } catch (error) {
    console.error('Error fetching net liquid assets:', error);
    res.status(500).json({ error: 'Failed to fetch net liquid assets' });
  }
});

app.post('/api/v1/net-liquid-assets', async (req, res) => {
  try {
    const asset = await prisma.netLiquidAssets.upsert({
      where: { ticker: req.body.ticker },
      update: req.body,
      create: req.body,
    });
    res.json(asset);
  } catch (error) {
    console.error('Error saving net liquid assets:', error);
    res.status(500).json({ error: 'Failed to save net liquid assets' });
  }
});

app.patch('/api/v1/net-liquid-assets/:ticker', async (req, res) => {
  try {
    const asset = await prisma.netLiquidAssets.update({
      where: { ticker: req.params.ticker },
      data: req.body,
    });
    res.json(asset);
  } catch (error) {
    console.error('Error updating net liquid assets:', error);
    res.status(500).json({ error: 'Failed to update net liquid assets' });
  }
});

app.delete('/api/v1/net-liquid-assets/:ticker', async (req, res) => {
  try {
    await prisma.netLiquidAssets.delete({ where: { ticker: req.params.ticker } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting net liquid assets:', error);
    res.status(500).json({ error: 'Failed to delete net liquid assets' });
  }
});

// ===========================================
// DEBTS API
// ===========================================

app.get('/api/v1/debts', async (req, res) => {
  try {
    const debts = await prisma.debt.findMany({
      orderBy: [{ ticker: 'asc' }, { principalM: 'desc' }],
      include: { company: { select: { name: true } } },
    });
    res.json(debts);
  } catch (error) {
    console.error('Error fetching debts:', error);
    res.status(500).json({ error: 'Failed to fetch debts' });
  }
});

app.post('/api/v1/debts', async (req, res) => {
  try {
    const debt = await prisma.debt.create({ data: req.body });
    res.json(debt);
  } catch (error) {
    console.error('Error creating debt:', error);
    res.status(500).json({ error: 'Failed to create debt' });
  }
});

app.put('/api/v1/debts/:id', async (req, res) => {
  try {
    const debt = await prisma.debt.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(debt);
  } catch (error) {
    console.error('Error updating debt:', error);
    res.status(500).json({ error: 'Failed to update debt' });
  }
});

app.delete('/api/v1/debts/:id', async (req, res) => {
  try {
    await prisma.debt.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting debt:', error);
    res.status(500).json({ error: 'Failed to delete debt' });
  }
});

// ===========================================
// GLOBAL FACTORS API
// ===========================================

app.get('/api/v1/global-factors', async (req, res) => {
  try {
    const factors = await prisma.globalFactor.findMany();
    res.json(factors);
  } catch (error) {
    console.error('Error fetching global factors:', error);
    res.status(500).json({ error: 'Failed to fetch global factors' });
  }
});

app.post('/api/v1/global-factors', async (req, res) => {
  try {
    const factor = await prisma.globalFactor.upsert({
      where: {
        category_key: {
          category: req.body.category,
          key: req.body.key,
        },
      },
      update: { value: req.body.value, description: req.body.description },
      create: req.body,
    });
    res.json(factor);
  } catch (error) {
    console.error('Error creating global factor:', error);
    res.status(500).json({ error: 'Failed to create global factor' });
  }
});

// ===========================================
// SETTINGS API
// ===========================================

app.get('/api/v1/settings', async (req, res) => {
  try {
    const settings = await prisma.settings.findMany();
    const settingsMap: Record<string, any> = {};
    for (const s of settings) {
      // Parse numeric strings to numbers for frontend consumption
      const num = Number(s.value);
      settingsMap[s.key] = isNaN(num) ? s.value : num;
    }
    res.json(settingsMap);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.post('/api/v1/settings', async (req, res) => {
  try {
    const { key, value } = req.body;
    const setting = await prisma.settings.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    res.json(setting);
  } catch (error) {
    console.error('Error saving setting:', error);
    res.status(500).json({ error: 'Failed to save setting' });
  }
});

// Delete a setting (used for removing custom tenants)
app.delete('/api/v1/settings/:key', async (req, res) => {
  try {
    await prisma.settings.delete({ where: { key: req.params.key } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting setting:', error);
    res.status(500).json({ error: 'Failed to delete setting' });
  }
});

// Tenant list derived from tc* settings keys + defaults
const DEFAULT_TENANTS: { key: string; name: string; defaultSpread: number }[] = [
  { key: 'tcGoogle', name: 'Google', defaultSpread: -1.00 },
  { key: 'tcMicrosoft', name: 'Microsoft', defaultSpread: -1.00 },
  { key: 'tcAmazon', name: 'Amazon/AWS', defaultSpread: -1.00 },
  { key: 'tcMeta', name: 'Meta', defaultSpread: -0.75 },
  { key: 'tcOracle', name: 'Oracle', defaultSpread: -0.50 },
  { key: 'tcCoreweave', name: 'CoreWeave', defaultSpread: 0.00 },
  { key: 'tcAnthropic', name: 'Anthropic', defaultSpread: 0.00 },
  { key: 'tcOpenai', name: 'OpenAI', defaultSpread: 0.00 },
  { key: 'tcXai', name: 'xAI', defaultSpread: 0.25 },
  { key: 'tcOther', name: 'Other', defaultSpread: 1.00 },
  { key: 'tcSelf', name: 'Self (No Tenant)', defaultSpread: 3.00 },
];

app.get('/api/v1/tenants', async (req, res) => {
  try {
    const settings = await prisma.settings.findMany();
    const settingsMap: Record<string, any> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    const tenants = DEFAULT_TENANTS.map(t => ({
      key: t.key,
      name: t.name,
      spread: settingsMap[t.key] !== undefined ? Number(settingsMap[t.key]) : t.defaultSpread,
      isDefault: true,
    }));

    // Add any custom tc* keys from settings that aren't in defaults
    const defaultKeys = new Set(DEFAULT_TENANTS.map(t => t.key));
    for (const s of settings) {
      if (s.key.startsWith('tc') && !defaultKeys.has(s.key)) {
        const name = s.key.replace(/^tc/, '');
        tenants.push({
          key: s.key,
          name,
          spread: Number(s.value) || 0,
          isDefault: false,
        });
      }
    }

    res.json(tenants);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

// ===========================================
// VALUATION API
// ===========================================

// Default valuation factors
const DEFAULT_FACTORS: Record<string, any> = {
  // Market prices
  btcPrice: 97000,
  ethPrice: 2500,

  // HPC/AI valuation - Cap Rate Method
  hpcCapRate: 0.075, // 7.5% cap rate for HPC/AI
  hpcExitCapRate: 0.080, // 8.0% exit cap rate for terminal value
  terminalGrowthRate: 0.025, // 2.5% terminal growth rate
  discountRate: 0.10, // 10% discount rate for DCF

  // Legacy HPC valuation (backup)
  mwValueHpcContracted: 25, // $M per MW for contracted HPC
  mwValueHpcUncontracted: 8, // $M per MW for pipeline/uncontracted
  noiMultiple: 10, // NOI multiple for valuation

  // Mining valuation
  mwValueBtcMining: 0.3, // $M per MW for BTC mining
  ebitdaMultiple: 6, // EBITDA multiple for mining
  dailyRevPerEh: 29400, // Daily revenue per EH/s
  poolFeePct: 0.02,

  // Phase probabilities
  probOperational: 1.0,
  probConstruction: 0.9,
  probDevelopment: 0.7,
  probExclusivity: 0.5,
  probDiligence: 0.3,

  // Datacenter tier multipliers
  tierIvMult: 1.15,
  tierIiiMult: 1.00,
  tierIiMult: 0.90,
  tierIMult: 0.80,

  // Site ownership multipliers
  ownedMult: 1.00,
  longtermLeaseMult: 0.95,
  shorttermLeaseMult: 0.85,

  // Lease structure multipliers
  nnnMult: 1.00,
  modifiedGrossMult: 0.95,
  grossMult: 0.90,

  // Lease renewal assumptions
  leaseRenewalProbability: 0.85, // 85% probability of renewal
  renewalTermYears: 10, // Assumed renewal term

  // Energization year discount
  energizationDecayRate: 0.15, // 15% annual decay
  energizationBaseYear: 2025, // Base year (multiplier = 1.0)

  // Power authority multipliers
  paErcot: 1.05,
  paPjm: 1.00,
  paMiso: 0.95,
  paNyiso: 0.95,
  paCaiso: 0.90,
  paCanada: 0.95,
  paNorway: 0.90,
  paUae: 0.85,
  paBhutan: 0.70,
  paParaguay: 0.70,
  paEthiopia: 0.60,
  paOther: 0.80,

  // Base rate
  sofrRate: 4.3,

  // Tenant credit spreads (vs SOFR)
  tcGoogle: -1.00,
  tcMicrosoft: -1.00,
  tcAmazon: -1.00,
  tcMeta: -0.75,
  tcOracle: -0.50,
  tcCoreweave: 0.00,
  tcAnthropic: 0.00,
  tcOpenai: 0.00,
  tcXai: 0.25,
  tcOther: 1.00,
  tcSelf: 3.00,

  // Site size multipliers
  sizeGte500: 1.10,
  size250to499: 1.00,
  size100to249: 0.95,
  sizeLt100: 0.85,

  // Legacy phase probabilities object (for backward compatibility)
  phaseProbabilities: {
    OPERATIONAL: 1.0,
    CONSTRUCTION: 0.9,
    DEVELOPMENT: 0.7,
    EXCLUSIVITY: 0.5,
    DILIGENCE: 0.3,
  },
};

app.get('/api/v1/valuation', async (req, res) => {
  try {
    // Get settings or use defaults
    const settingsRows = await prisma.settings.findMany();
    const settings: Record<string, any> = {};
    for (const s of settingsRows) {
      const num = Number(s.value);
      settings[s.key] = isNaN(num) ? s.value : num;
    }
    const factors = { ...DEFAULT_FACTORS, ...settings };

    // Get all companies with full data
    const companies = await prisma.company.findMany({
      where: { archived: false },
      include: {
        sites: {
          include: {
            campuses: {
              include: {
                buildings: {
                  include: {
                    usePeriods: { where: { isCurrent: true } },
                  },
                },
              },
            },
          },
        },
        debts: true,
      },
    });

    // Fetch Mining Valuations and Net Liquid Assets from their dedicated tables
    const miningValuations = await prisma.miningValuation.findMany();
    const netLiquidAssets = await prisma.netLiquidAssets.findMany();

    // Create lookup maps by ticker
    const miningByTicker = new Map(miningValuations.map((mv: any) => [mv.ticker, mv]));
    const netLiquidByTicker = new Map(netLiquidAssets.map((nla: any) => [nla.ticker, nla]));

    // Helper function to get phase probability from factors
    const getPhaseProbability = (phase: string): number => {
      const phaseMap: Record<string, string> = {
        OPERATIONAL: 'probOperational',
        CONSTRUCTION: 'probConstruction',
        DEVELOPMENT: 'probDevelopment',
        EXCLUSIVITY: 'probExclusivity',
        DILIGENCE: 'probDiligence',
      };
      const key = phaseMap[phase];
      return key ? (factors[key] ?? DEFAULT_FACTORS[key] ?? 0.5) : 0.5;
    };

    // Helper function to calculate energization discount
    // Time-value discount: uses lease start date if available, otherwise falls back to energization date.
    // Discounts future cash flows to present value using the discount rate.
    // If the date is in the past or today, no discount is applied (multiplier = 1.0).
    const getTimeValueMultiplier = (leaseStart: Date | null, energizationDate: Date | null): number => {
      const discountRate = factors.discountRate ?? DEFAULT_FACTORS.discountRate;
      const refDate = leaseStart ? new Date(leaseStart) : energizationDate ? new Date(energizationDate) : null;
      if (!refDate) return 1.0;
      const now = new Date();
      const yearsFromNow = (refDate.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (yearsFromNow <= 0) return 1.0; // Already started or in the past
      return 1 / Math.pow(1 + discountRate, yearsFromNow);
    };

    // Helper function to get power authority multiplier
    const getPowerAuthorityMultiplier = (grid: string | null): number => {
      if (!grid) return factors.paOther ?? DEFAULT_FACTORS.paOther;
      const gridLower = grid.toLowerCase();
      if (gridLower.includes('ercot')) return factors.paErcot ?? DEFAULT_FACTORS.paErcot;
      if (gridLower.includes('pjm')) return factors.paPjm ?? DEFAULT_FACTORS.paPjm;
      if (gridLower.includes('miso')) return factors.paMiso ?? DEFAULT_FACTORS.paMiso;
      if (gridLower.includes('nyiso')) return factors.paNyiso ?? DEFAULT_FACTORS.paNyiso;
      if (gridLower.includes('caiso')) return factors.paCaiso ?? DEFAULT_FACTORS.paCaiso;
      if (gridLower.includes('canada') || gridLower.includes('hydro')) return factors.paCanada ?? DEFAULT_FACTORS.paCanada;
      if (gridLower.includes('norway')) return factors.paNorway ?? DEFAULT_FACTORS.paNorway;
      if (gridLower.includes('uae')) return factors.paUae ?? DEFAULT_FACTORS.paUae;
      if (gridLower.includes('bhutan')) return factors.paBhutan ?? DEFAULT_FACTORS.paBhutan;
      if (gridLower.includes('paraguay')) return factors.paParaguay ?? DEFAULT_FACTORS.paParaguay;
      if (gridLower.includes('ethiopia')) return factors.paEthiopia ?? DEFAULT_FACTORS.paEthiopia;
      return factors.paOther ?? DEFAULT_FACTORS.paOther;
    };

    // Helper function to get site size multiplier
    const getSizeMultiplier = (totalMw: number): number => {
      if (totalMw >= 500) return factors.sizeGte500 ?? DEFAULT_FACTORS.sizeGte500;
      if (totalMw >= 250) return factors.size250to499 ?? DEFAULT_FACTORS.size250to499;
      if (totalMw >= 100) return factors.size100to249 ?? DEFAULT_FACTORS.size100to249;
      return factors.sizeLt100 ?? DEFAULT_FACTORS.sizeLt100;
    };

    // Helper function to get ownership multiplier
    const getOwnershipMultiplier = (ownershipStatus: string | null): number => {
      if (!ownershipStatus) return factors.ownedMult ?? DEFAULT_FACTORS.ownedMult;
      const status = ownershipStatus.toLowerCase();
      if (status.includes('own') || status.includes('fee')) return factors.ownedMult ?? DEFAULT_FACTORS.ownedMult;
      if (status.includes('long') || status.includes('ground')) return factors.longtermLeaseMult ?? DEFAULT_FACTORS.longtermLeaseMult;
      if (status.includes('short') || status.includes('lease')) return factors.shorttermLeaseMult ?? DEFAULT_FACTORS.shorttermLeaseMult;
      return factors.ownedMult ?? DEFAULT_FACTORS.ownedMult;
    };

    // Helper function to get tenant credit multiplier (converts spread to NOI adjustment)
    const getTenantCreditMultiplier = (tenant: string | null): number => {
      if (!tenant) return 1.0;
      const t = tenant.toLowerCase();
      const sofrRate = factors.sofrRate ?? DEFAULT_FACTORS.sofrRate;
      let spread = factors.tcOther ?? DEFAULT_FACTORS.tcOther;

      if (t.includes('google')) spread = factors.tcGoogle ?? DEFAULT_FACTORS.tcGoogle;
      else if (t.includes('microsoft') || t.includes('azure')) spread = factors.tcMicrosoft ?? DEFAULT_FACTORS.tcMicrosoft;
      else if (t.includes('amazon') || t.includes('aws')) spread = factors.tcAmazon ?? DEFAULT_FACTORS.tcAmazon;
      else if (t.includes('meta') || t.includes('facebook')) spread = factors.tcMeta ?? DEFAULT_FACTORS.tcMeta;
      else if (t.includes('oracle')) spread = factors.tcOracle ?? DEFAULT_FACTORS.tcOracle;
      else if (t.includes('coreweave')) spread = factors.tcCoreweave ?? DEFAULT_FACTORS.tcCoreweave;
      else if (t.includes('anthropic')) spread = factors.tcAnthropic ?? DEFAULT_FACTORS.tcAnthropic;
      else if (t.includes('openai')) spread = factors.tcOpenai ?? DEFAULT_FACTORS.tcOpenai;
      else if (t.includes('xai') || t.includes('x.ai')) spread = factors.tcXai ?? DEFAULT_FACTORS.tcXai;

      // Lower credit spread = higher multiplier (better credit = higher value)
      // Base case: 0% spread = 1.0x, -1% = 1.05x, +3% = 0.85x
      const baseRate = sofrRate;
      const tenantRate = sofrRate + spread;
      return baseRate / tenantRate;
    };

    const valuations = companies.map((company: any) => {
      // Get Net Liquid from the Net Liquid Assets table
      const nlaRecord = netLiquidByTicker.get(company.ticker);
      let netLiquid = 0;
      if (nlaRecord) {
        const cash = Number(nlaRecord.cashM) || 0;
        const btcCount = Number(nlaRecord.btcCount) || 0;
        const ethCount = Number(nlaRecord.ethCount) || 0;
        const totalDebt = Number(nlaRecord.totalDebtM) || 0;
        const btcValueM = (btcCount * factors.btcPrice) / 1_000_000;
        const ethValueM = (ethCount * factors.ethPrice) / 1_000_000;
        netLiquid = cash + btcValueM + ethValueM - totalDebt;
      }

      // Get Mining Valuation from the Mining Valuations table
      const mvRecord = miningByTicker.get(company.ticker);
      let evMining = 0;
      if (mvRecord) {
        const eh = Number(mvRecord.hashrateEh) || 0;
        const eff = Number(mvRecord.efficiencyJth) || 0;
        const power = Number(mvRecord.powerCostKwh) || 0;
        const hostedMw = Number(mvRecord.hostedMw) || 0;

        // Self-mining valuation
        if (eh > 0) {
          const annRevM = (eh * factors.dailyRevPerEh * 365) / 1_000_000;
          const annPowerM = eh * eff * power * 8.76;
          const poolFeesM = factors.poolFeePct * annRevM;
          const ebitdaM = annRevM - annPowerM - poolFeesM;
          const selfMiningValM = Math.max(0, ebitdaM * factors.ebitdaMultiple);
          evMining += selfMiningValM;
        }

        // Hosted mining valuation
        if (hostedMw > 0) {
          const hostedValM = hostedMw * factors.mwValueBtcMining;
          evMining += hostedValM;
        }
      }

      // Calculate total IT MW capacity from all buildings (for display)
      let totalItMw = 0;

      // Calculate MW by category and enterprise value
      let mwHpcContracted = 0;
      let mwHpcPipeline = 0;
      let evHpcContracted = 0;
      let evHpcPipeline = 0;

      // Collect contracted HPC site details for drill-down
      const hpcSites: { siteName: string; buildingName: string; tenant: string; mw: number; leaseValueM: number; noiAnnualM: number; valuation: number; phase: string }[] = [];
      let totalLeaseValueM = 0;

      // Per-period valuations for Projects table
      const periodValuations: { buildingId: string; usePeriodId: string | null; valuationM: number }[] = [];

      for (const site of company.sites) {
        // Calculate total site MW for size multiplier
        let siteTotalMw = 0;
        for (const campus of site.campuses) {
          for (const building of campus.buildings) {
            siteTotalMw += Number(building.grossMw) || 0;
            // Accumulate IT MW for all buildings
            totalItMw += Number(building.itMw) || 0;
          }
        }
        const sizeMultiplier = getSizeMultiplier(siteTotalMw);

        for (const campus of site.campuses) {
          for (const building of campus.buildings) {
            // Skip buildings excluded from valuation
            if (!building.includeInValuation) continue;

            const buildingMw = Number(building.grossMw) || 0;
            const phase = building.developmentPhase;

            // Get base probability from phase or override
            const prob = building.probabilityOverride
              ? Number(building.probabilityOverride)
              : getPhaseProbability(phase);

            // Regulatory risk multiplier (1.0 = no risk, 0.0 = blocked)
            const regRisk = Number(building.regulatoryRisk) ?? 1.0;

            // Power authority multiplier
            const paMult = getPowerAuthorityMultiplier(building.grid);

            // Ownership multiplier
            const ownershipMult = getOwnershipMultiplier(building.ownershipStatus);

            // Loop over ALL current use periods (supports splits)
            const currentUses = building.usePeriods.filter((up: any) => up.isCurrent);

            if (currentUses.length === 0) {
              // No use periods — treat as unallocated pipeline
              const timeValueMult = getTimeValueMultiplier(null, building.energizationDate);
              const adjFactor = prob * regRisk * timeValueMult * paMult * ownershipMult * sizeMultiplier;
              const pipelineVal = buildingMw * factors.mwValueHpcUncontracted * adjFactor;
              mwHpcPipeline += buildingMw * adjFactor;
              evHpcPipeline += pipelineVal;
              periodValuations.push({ buildingId: building.id, usePeriodId: null, valuationM: pipelineVal });
            } else {
              // Calculate explicitly allocated MW to determine remainder
              const explicitlyAllocated = currentUses.reduce((sum: number, up: any) => sum + (Number(up.mwAllocation) || 0), 0);
              for (const currentUse of currentUses) {
                // Use allocated MW for this period; if unset, give it the remaining unallocated MW
                let mw = Number(currentUse.mwAllocation) || 0;
                if (!mw) {
                  mw = currentUses.length === 1 ? buildingMw : Math.max(buildingMw - explicitlyAllocated, 0);
                }
                const useType = currentUse.useType || 'UNCONTRACTED';
                const hasLease = currentUse.tenant && currentUse.leaseValueM;
                const leaseValM = Number(currentUse.leaseValueM) || 0;
                const leaseYears = Number(currentUse.leaseYears) || 10;

                // Compute NOI: use stored noiAnnualM, or derive from lease data
                let noiAnnual = Number(currentUse.noiAnnualM) || 0;
                if (!noiAnnual && leaseValM > 0 && currentUse.noiPct) {
                  const noiPctVal = Number(currentUse.noiPct) || 0;
                  const annualRev = leaseValM / Math.max(leaseYears, 0.1);
                  noiAnnual = annualRev * noiPctVal; // noiPct is stored as 0-1 fraction
                }

                // Time-value discount per use period
                const timeValueMult = getTimeValueMultiplier(currentUse.leaseStart ?? null, building.energizationDate);

                // Tenant credit multiplier per use period
                const tenantMult = getTenantCreditMultiplier(currentUse.tenant ?? null);

                // Combined adjustment factor
                const adjFactor = prob * regRisk * timeValueMult * paMult * ownershipMult * sizeMultiplier;

                let periodVal = 0;

                // Categorize and value based on use type
                if (useType === 'BTC_MINING' || useType === 'BTC_MINING_HOSTING') {
                  periodVal = mw * factors.mwValueBtcMining * adjFactor;
                } else if (useType === 'HPC_AI_HOSTING' || useType === 'GPU_CLOUD') {
                  if (hasLease) {
                    mwHpcContracted += mw;
                    totalLeaseValueM += leaseValM;
                    // DCF valuation: cap rate + terminal value (matches side panel)
                    if (noiAnnual > 0) {
                      const capRate = factors.hpcCapRate ?? 0.075;
                      const exitCapRate = factors.hpcExitCapRate ?? 0.08;
                      const termGrowth = factors.terminalGrowthRate ?? 0.025;
                      const dRate = factors.discountRate ?? 0.10;
                      const renewProb = factors.leaseRenewalProbability ?? 0.75;

                      const baseValue = capRate > 0 ? noiAnnual / capRate : 0;
                      const terminalNoi = noiAnnual * Math.pow(1 + termGrowth, leaseYears);
                      const capRateDiff = Math.max(exitCapRate - termGrowth, 0.001);
                      const terminalValueAtEnd = terminalNoi / capRateDiff;
                      const terminalValuePV = terminalValueAtEnd / Math.pow(1 + dRate, leaseYears) * renewProb;

                      periodVal = (baseValue + terminalValuePV) * adjFactor * tenantMult;
                      evHpcContracted += periodVal;
                    } else {
                      periodVal = leaseValM * adjFactor * tenantMult;
                      evHpcContracted += periodVal;
                    }
                    hpcSites.push({
                      siteName: site.name,
                      buildingName: building.name,
                      tenant: currentUse.tenant || '',
                      mw: Number(currentUse.mwAllocation) || Number(building.itMw) || mw,
                      leaseValueM: leaseValM,
                      noiAnnualM: noiAnnual,
                      valuation: Math.round(periodVal),
                      phase,
                    });
                  } else {
                    periodVal = mw * factors.mwValueHpcUncontracted * adjFactor;
                    mwHpcPipeline += mw * adjFactor;
                    evHpcPipeline += periodVal;
                  }
                } else if (useType === 'HPC_AI_PLANNED' || useType === 'UNCONTRACTED' || useType === 'UNCONTRACTED_ROFR') {
                  // Pipeline - uncontracted capacity
                  periodVal = mw * factors.mwValueHpcUncontracted * adjFactor;
                  mwHpcPipeline += mw * adjFactor;
                  evHpcPipeline += periodVal;
                }

                periodValuations.push({ buildingId: building.id, usePeriodId: currentUse.id, valuationM: periodVal });
              }
            }
          }
        }
      }

      // Mining EV is now calculated from the Mining Valuations table (done above)
      const totalEv = (evMining || 0) + (evHpcContracted || 0) + (evHpcPipeline || 0);
      const totalValueM = (netLiquid || 0) + totalEv;

      // Get FD shares from Company table and calculate per-share fair value
      const fdSharesM = Number(company.fdSharesM) || 0;
      const fairValuePerShare = fdSharesM > 0 ? totalValueM / fdSharesM : null;

      return {
        ticker: company.ticker,
        name: company.name,
        stockPrice: Number(company.stockPrice) || null,
        fdSharesM: fdSharesM > 0 ? Math.round(fdSharesM * 10) / 10 : null,
        netLiquid: Math.round(netLiquid * 10) / 10,
        totalMw: Math.round(totalItMw),  // Total IT MW capacity from Projects
        evMining: Math.round(evMining),
        evHpcContracted: Math.round(evHpcContracted),
        evHpcPipeline: Math.round(evHpcPipeline),
        evGpu: 0, // Placeholder for GPU cloud revenue-based valuation
        totalEv: Math.round(totalEv),
        totalValueM: Math.round(totalValueM),
        fairValuePerShare: fairValuePerShare !== null ? Math.round(fairValuePerShare * 100) / 100 : null,
        // Drill-down details
        totalLeaseValueM: Math.round(totalLeaseValueM),
        hpcSites: hpcSites.sort((a, b) => b.valuation - a.valuation),
        periodValuations,
      };
    });

    res.json({ factors, valuations });
  } catch (error) {
    console.error('Error calculating valuations:', error);
    res.status(500).json({ error: 'Failed to calculate valuations' });
  }
});

// ===========================================
// BUILDING VALUATION DETAIL API
// ===========================================

// GET detailed valuation for a single building
app.get('/api/v1/buildings/:id/valuation', async (req, res) => {
  try {
    // Get the building with all related data
    const building = await prisma.building.findUnique({
      where: { id: req.params.id },
      include: {
        campus: {
          include: {
            site: {
              include: {
                campuses: {
                  include: {
                    buildings: true,
                  },
                },
              },
            },
          },
        },
        usePeriods: {
          orderBy: [{ isCurrent: 'desc' }, { startDate: 'asc' }],
        },
      },
    });

    if (!building) {
      return res.status(404).json({ error: 'Building not found' });
    }

    // Get settings or use defaults
    const settingsRows = await prisma.settings.findMany();
    const settings: Record<string, any> = {};
    for (const s of settingsRows) {
      const num = Number(s.value);
      settings[s.key] = isNaN(num) ? s.value : num;
    }
    const factors = { ...DEFAULT_FACTORS, ...settings };

    // Calculate total site MW for size multiplier
    let siteTotalMw = 0;
    for (const campus of building.campus.site.campuses) {
      for (const b of campus.buildings) {
        siteTotalMw += Number(b.grossMw) || 0;
      }
    }

    const mw = Number(building.grossMw) || 0;
    const itMw = Number(building.itMw) || 0;

    // Get all current use periods (supports splits)
    const currentUsePeriods = building.usePeriods.filter((up: any) => up.isCurrent);
    const allUsePeriods = building.usePeriods;
    const currentUse = currentUsePeriods[0]; // Primary current use for backward compatibility
    const useType = currentUse?.useType || 'UNCONTRACTED';

    // Calculate total allocated MW across current splits
    const allocatedMw = currentUsePeriods.reduce((sum: number, up: any) => sum + (Number(up.mwAllocation) || 0), 0);
    const unallocatedMw = Math.max(0, itMw - allocatedMw);

    // Get lease details
    const leaseDetails = {
      tenant: currentUse?.tenant || null,
      leaseStructure: (currentUse as any)?.leaseStructure || 'NNN',
      leaseValueM: Number(currentUse?.leaseValueM) || null,
      leaseYears: Number(currentUse?.leaseYears) || null,
      annualRevM: Number(currentUse?.annualRevM) || null,
      noiPct: Number(currentUse?.noiPct) || null,
      noiAnnualM: Number(currentUse?.noiAnnualM) || null,
      leaseStart: currentUse?.leaseStart || null,
      leaseEnd: (currentUse as any)?.leaseEnd || null,
    };

    // Calculate remaining lease years
    let remainingLeaseYears = leaseDetails.leaseYears || 0;
    if (leaseDetails.leaseStart && leaseDetails.leaseYears) {
      const startDate = new Date(leaseDetails.leaseStart);
      const endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + leaseDetails.leaseYears);
      const now = new Date();
      remainingLeaseYears = Math.max(0, (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365));
    }

    // Auto-derived factor calculations
    const getPhaseProbability = (phase: string): number => {
      const phaseMap: Record<string, string> = {
        OPERATIONAL: 'probOperational',
        CONSTRUCTION: 'probConstruction',
        DEVELOPMENT: 'probDevelopment',
        EXCLUSIVITY: 'probExclusivity',
        DILIGENCE: 'probDiligence',
      };
      const key = phaseMap[phase];
      return key ? (factors[key] ?? 0.5) : 0.5;
    };

    const getSizeMultiplier = (totalMw: number): number => {
      if (totalMw >= 500) return factors.sizeGte500;
      if (totalMw >= 250) return factors.size250to499;
      if (totalMw >= 100) return factors.size100to249;
      return factors.sizeLt100;
    };

    const getPowerAuthorityMultiplier = (grid: string | null): number => {
      if (!grid) return factors.paOther;
      const gridLower = grid.toLowerCase();
      if (gridLower.includes('ercot')) return factors.paErcot;
      if (gridLower.includes('pjm')) return factors.paPjm;
      if (gridLower.includes('miso')) return factors.paMiso;
      if (gridLower.includes('nyiso')) return factors.paNyiso;
      if (gridLower.includes('caiso')) return factors.paCaiso;
      if (gridLower.includes('canada') || gridLower.includes('hydro')) return factors.paCanada;
      if (gridLower.includes('norway') || gridLower.includes('nordic')) return factors.paNorway;
      if (gridLower.includes('uae')) return factors.paUae;
      return factors.paOther;
    };

    const getOwnershipMultiplier = (status: string | null): number => {
      if (!status) return factors.ownedMult;
      const s = status.toLowerCase();
      if (s.includes('own') || s.includes('fee')) return factors.ownedMult;
      if (s.includes('long') || s.includes('ground')) return factors.longtermLeaseMult;
      return factors.shorttermLeaseMult;
    };

    const getTierMultiplier = (tier: string | null): number => {
      if (!tier) return factors.tierIiiMult;
      if (tier.includes('IV') || tier.includes('4')) return factors.tierIvMult;
      if (tier.includes('III') || tier.includes('3')) return factors.tierIiiMult;
      if (tier.includes('II') || tier.includes('2')) return factors.tierIiMult;
      return factors.tierIMult;
    };

    const getLeaseStructureMultiplier = (structure: string | null): number => {
      if (!structure) return factors.nnnMult;
      const s = structure.toUpperCase();
      if (s.includes('NNN') || s.includes('TRIPLE')) return factors.nnnMult;
      if (s.includes('MODIFIED')) return factors.modifiedGrossMult;
      if (s.includes('GROSS')) return factors.grossMult;
      return factors.nnnMult;
    };

    const getTenantCreditMultiplier = (tenant: string | null): number => {
      if (!tenant) return 1.0;
      const t = tenant.toLowerCase();
      const sofrRate = factors.sofrRate;
      let spread = factors.tcOther;

      if (t.includes('google')) spread = factors.tcGoogle;
      else if (t.includes('microsoft') || t.includes('azure')) spread = factors.tcMicrosoft;
      else if (t.includes('amazon') || t.includes('aws')) spread = factors.tcAmazon;
      else if (t.includes('meta') || t.includes('facebook')) spread = factors.tcMeta;
      else if (t.includes('oracle')) spread = factors.tcOracle;
      else if (t.includes('coreweave')) spread = factors.tcCoreweave;
      else if (t.includes('anthropic')) spread = factors.tcAnthropic;
      else if (t.includes('openai')) spread = factors.tcOpenai;
      else if (t.includes('xai')) spread = factors.tcXai;

      return sofrRate / (sofrRate + spread);
    };

    // Time-value discount: lease start if available, otherwise energization date
    const getTimeValueMultiplierDetail = (leaseStart: Date | null, energizationDate: Date | null): number => {
      const dRate = factors.discountRate ?? 0.10;
      const refDate = leaseStart ? new Date(leaseStart) : energizationDate ? new Date(energizationDate) : null;
      if (!refDate) return 1.0;
      const now = new Date();
      const yearsFromNow = (refDate.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (yearsFromNow <= 0) return 1.0;
      return 1 / Math.pow(1 + dRate, yearsFromNow);
    };

    // Build factor details with auto-derived and override values
    const datacenterTier = (building as any).datacenterTier || 'TIER_III';
    const fidoodleFactor = Number((building as any).fidoodleFactor) || 1.0;

    const factorDetails = {
      // Phase & Risk
      phase: building.developmentPhase,
      phaseProbability: {
        auto: getPhaseProbability(building.developmentPhase),
        override: building.probabilityOverride ? Number(building.probabilityOverride) : null,
        final: building.probabilityOverride
          ? Number(building.probabilityOverride)
          : getPhaseProbability(building.developmentPhase),
      },
      regulatoryRisk: {
        value: Number(building.regulatoryRisk) ?? 1.0,
      },

      // Size
      sizeMultiplier: {
        siteTotalMw,
        auto: getSizeMultiplier(siteTotalMw),
        override: (building as any).sizeMultOverride ? Number((building as any).sizeMultOverride) : null,
        final: (building as any).sizeMultOverride
          ? Number((building as any).sizeMultOverride)
          : getSizeMultiplier(siteTotalMw),
      },

      // Power Authority
      powerAuthority: {
        grid: building.grid,
        auto: getPowerAuthorityMultiplier(building.grid),
        override: (building as any).powerAuthMultOverride ? Number((building as any).powerAuthMultOverride) : null,
        final: (building as any).powerAuthMultOverride
          ? Number((building as any).powerAuthMultOverride)
          : getPowerAuthorityMultiplier(building.grid),
      },

      // Ownership
      ownership: {
        status: building.ownershipStatus,
        auto: getOwnershipMultiplier(building.ownershipStatus),
        override: (building as any).ownershipMultOverride ? Number((building as any).ownershipMultOverride) : null,
        final: (building as any).ownershipMultOverride
          ? Number((building as any).ownershipMultOverride)
          : getOwnershipMultiplier(building.ownershipStatus),
      },

      // Datacenter Tier
      datacenterTier: {
        tier: datacenterTier,
        auto: getTierMultiplier(datacenterTier),
        override: (building as any).tierMultOverride ? Number((building as any).tierMultOverride) : null,
        final: (building as any).tierMultOverride
          ? Number((building as any).tierMultOverride)
          : getTierMultiplier(datacenterTier),
      },

      // Lease Structure
      leaseStructure: {
        structure: leaseDetails.leaseStructure,
        auto: getLeaseStructureMultiplier(leaseDetails.leaseStructure),
        final: getLeaseStructureMultiplier(leaseDetails.leaseStructure),
      },

      // Tenant Credit
      tenantCredit: {
        tenant: leaseDetails.tenant,
        auto: getTenantCreditMultiplier(leaseDetails.tenant),
        final: getTenantCreditMultiplier(leaseDetails.tenant),
      },

      // Time Value Discount (lease start → energization date fallback)
      timeValue: {
        leaseStart: leaseDetails.leaseStart,
        energizationDate: building.energizationDate,
        source: leaseDetails.leaseStart ? 'leaseStart' : building.energizationDate ? 'energization' : 'none',
        auto: getTimeValueMultiplierDetail(leaseDetails.leaseStart, building.energizationDate),
        final: getTimeValueMultiplierDetail(leaseDetails.leaseStart, building.energizationDate),
      },

      // Custom Fidoodle Factor
      fidoodleFactor: {
        value: fidoodleFactor,
      },
    };

    // Calculate combined adjustment factor (use || 1 to protect against NaN/undefined)
    const combinedFactor =
      (factorDetails.phaseProbability.final || 1) *
      (factorDetails.regulatoryRisk.value || 1) *
      (factorDetails.sizeMultiplier.final || 1) *
      (factorDetails.powerAuthority.final || 1) *
      (factorDetails.ownership.final || 1) *
      (factorDetails.datacenterTier.final || 1) *
      (factorDetails.leaseStructure.final || 1) *
      (factorDetails.tenantCredit.final || 1) *
      (factorDetails.timeValue.final || 1) *
      (factorDetails.fidoodleFactor.value || 1);

    // HPC/AI Valuation Calculation
    const noiAnnual = leaseDetails.noiAnnualM || 0;
    const capRate = (building as any).capRateOverride ? Number((building as any).capRateOverride) : factors.hpcCapRate;
    const exitCapRate = (building as any).exitCapRateOverride ? Number((building as any).exitCapRateOverride) : factors.hpcExitCapRate;
    const terminalGrowthRate = (building as any).terminalGrowthOverride ? Number((building as any).terminalGrowthOverride) : factors.terminalGrowthRate;
    const discountRate = factors.discountRate;

    // Base Value = NOI / Cap Rate
    const baseValue = noiAnnual > 0 ? noiAnnual / capRate : 0;

    // Terminal Value using Gordon Growth Model
    // TV = NOI * (1 + g) / (r - g), then discount to present
    const leaseYears = remainingLeaseYears || leaseDetails.leaseYears || 10;
    const renewalProbability = factors.leaseRenewalProbability;

    // Calculate terminal value at end of lease, discounted to present
    // Terminal NOI = Current NOI * (1 + g)^leaseYears
    const terminalNoi = noiAnnual * Math.pow(1 + terminalGrowthRate, leaseYears);
    // Protect against division by zero (if exitCapRate == terminalGrowthRate)
    const capRateDiff = Math.max(exitCapRate - terminalGrowthRate, 0.001);
    const terminalValueAtEnd = terminalNoi / capRateDiff;
    const terminalValuePV = terminalValueAtEnd / Math.pow(1 + discountRate, leaseYears) * (renewalProbability || 0.75);

    // Gross Value = Base Value + Terminal Value PV
    const grossValue = baseValue + terminalValuePV;

    // Adjusted Value = Gross Value * Combined Factor
    const adjustedValue = grossValue * combinedFactor;

    const valuation = {
      // Method used
      method: 'NOI_CAP_RATE_TERMINAL',
      useType,

      // Key inputs
      inputs: {
        noiAnnualM: noiAnnual,
        capRate,
        exitCapRate,
        terminalGrowthRate,
        discountRate,
        leaseYears,
        remainingLeaseYears,
        renewalProbability,
      },

      // Step-by-step calculation
      calculation: {
        step1_baseValue: {
          description: 'NOI / Cap Rate',
          formula: `${noiAnnual.toFixed(2)} / ${(capRate * 100).toFixed(2)}%`,
          value: baseValue,
        },
        step2_terminalNoi: {
          description: `NOI grown at ${(terminalGrowthRate * 100).toFixed(1)}% for ${leaseYears.toFixed(1)} years`,
          formula: `${noiAnnual.toFixed(2)} × (1 + ${(terminalGrowthRate * 100).toFixed(1)}%)^${leaseYears.toFixed(1)}`,
          value: terminalNoi,
        },
        step3_terminalValueAtEnd: {
          description: 'Terminal Value at lease end (Gordon Growth)',
          formula: `${terminalNoi.toFixed(2)} / (${(exitCapRate * 100).toFixed(2)}% - ${(terminalGrowthRate * 100).toFixed(1)}%)`,
          value: terminalValueAtEnd,
        },
        step4_terminalValuePV: {
          description: `Terminal Value discounted to present (${(renewalProbability * 100).toFixed(0)}% renewal prob)`,
          formula: `${terminalValueAtEnd.toFixed(2)} / (1 + ${(discountRate * 100).toFixed(0)}%)^${leaseYears.toFixed(1)} × ${(renewalProbability * 100).toFixed(0)}%`,
          value: terminalValuePV,
        },
        step5_grossValue: {
          description: 'Base Value + Terminal Value PV',
          value: grossValue,
        },
        step6_combinedFactor: {
          description: 'Product of all adjustment factors',
          value: combinedFactor,
        },
        step7_adjustedValue: {
          description: 'Gross Value × Combined Factor',
          formula: `${grossValue.toFixed(2)} × ${combinedFactor.toFixed(4)}`,
          value: adjustedValue,
        },
      },

      // Final results (protect against NaN/Infinity)
      results: {
        baseValueM: isFinite(baseValue) ? Math.round(baseValue * 10) / 10 : 0,
        terminalValueM: isFinite(terminalValuePV) ? Math.round(terminalValuePV * 10) / 10 : 0,
        grossValueM: isFinite(grossValue) ? Math.round(grossValue * 10) / 10 : 0,
        adjustedValueM: isFinite(adjustedValue) ? Math.round(adjustedValue * 10) / 10 : 0,
      },
    };

    res.json({
      building: {
        id: building.id,
        name: building.name,
        grossMw: mw,
        itMw,
        pue: Number(building.pue) || null,
        grid: building.grid,
        ownershipStatus: building.ownershipStatus,
        developmentPhase: building.developmentPhase,
        energizationDate: building.energizationDate,
        datacenterTier,
        fidoodleFactor,
      },
      site: {
        id: building.campus.site.id,
        name: building.campus.site.name,
        totalMw: siteTotalMw,
      },
      campus: {
        id: building.campus.id,
        name: building.campus.name,
      },
      // All use periods for the building (splits + transitions)
      usePeriods: allUsePeriods.map((up: any) => ({
        id: up.id,
        useType: up.useType,
        tenant: up.tenant,
        mwAllocation: Number(up.mwAllocation) || null,
        startDate: up.startDate,
        endDate: up.endDate,
        isCurrent: up.isCurrent,
        leaseStructure: up.leaseStructure,
        leaseValueM: Number(up.leaseValueM) || null,
        leaseYears: Number(up.leaseYears) || null,
        annualRevM: Number(up.annualRevM) || null,
        noiPct: Number(up.noiPct) || null,
        noiAnnualM: Number(up.noiAnnualM) || null,
        leaseStart: up.leaseStart,
        leaseEnd: up.leaseEnd,
      })),
      // Capacity allocation summary
      capacityAllocation: {
        totalItMw: itMw,
        allocatedMw,
        unallocatedMw,
        currentSplits: currentUsePeriods.length,
      },
      // Primary lease details (backward compatibility)
      leaseDetails,
      remainingLeaseYears,
      factorDetails,
      combinedFactor,
      valuation,
      globalFactors: {
        hpcCapRate: factors.hpcCapRate,
        hpcExitCapRate: factors.hpcExitCapRate,
        terminalGrowthRate: factors.terminalGrowthRate,
        discountRate: factors.discountRate,
        renewalProbability: factors.leaseRenewalProbability,
      },
    });
  } catch (error) {
    console.error('Error calculating building valuation:', error);
    res.status(500).json({ error: 'Failed to calculate building valuation' });
  }
});

// PATCH building factor overrides (legacy endpoint)
app.patch('/api/v1/buildings/:id/factors', async (req, res) => {
  try {
    const building = await prisma.building.update({
      where: { id: req.params.id },
      data: {
        fidoodleFactor: req.body.fidoodleFactor,
        probabilityOverride: req.body.probabilityOverride,
        regulatoryRisk: req.body.regulatoryRisk,
        sizeMultOverride: req.body.sizeMultOverride,
        powerAuthMultOverride: req.body.powerAuthMultOverride,
        ownershipMultOverride: req.body.ownershipMultOverride,
        tierMultOverride: req.body.tierMultOverride,
        capRateOverride: req.body.capRateOverride,
        exitCapRateOverride: req.body.exitCapRateOverride,
        terminalGrowthOverride: req.body.terminalGrowthOverride,
        datacenterTier: req.body.datacenterTier,
      },
      include: {
        usePeriods: { where: { isCurrent: true } },
      },
    });
    res.json(building);
  } catch (error) {
    console.error('Error updating building factors:', error);
    res.status(500).json({ error: 'Failed to update building factors' });
  }
});

// PATCH building valuation details (comprehensive update)
// Updates lease details, valuation inputs, and factor overrides in one call
app.patch('/api/v1/buildings/:id/valuation-details', async (req, res) => {
  try {
    const { lease, valuation, factors } = req.body;
    const buildingId = req.params.id;

    // Get the building with its current use period
    const building = await prisma.building.findUnique({
      where: { id: buildingId },
      include: { usePeriods: { where: { isCurrent: true } } },
    });

    if (!building) {
      return res.status(404).json({ error: 'Building not found' });
    }

    // Update building with valuation inputs and factor overrides
    const buildingUpdate: Record<string, any> = {};

    // Valuation inputs
    if (valuation) {
      if (valuation.capRateOverride !== undefined) buildingUpdate.capRateOverride = valuation.capRateOverride;
      if (valuation.exitCapRateOverride !== undefined) buildingUpdate.exitCapRateOverride = valuation.exitCapRateOverride;
      if (valuation.terminalGrowthOverride !== undefined) buildingUpdate.terminalGrowthOverride = valuation.terminalGrowthOverride;
    }

    // Factor overrides
    if (factors) {
      if (factors.fidoodleFactor !== undefined) buildingUpdate.fidoodleFactor = factors.fidoodleFactor;
      if (factors.probabilityOverride !== undefined) buildingUpdate.probabilityOverride = factors.probabilityOverride;
      if (factors.regulatoryRisk !== undefined) buildingUpdate.regulatoryRisk = factors.regulatoryRisk;
      if (factors.sizeMultOverride !== undefined) buildingUpdate.sizeMultOverride = factors.sizeMultOverride;
      if (factors.powerAuthMultOverride !== undefined) buildingUpdate.powerAuthMultOverride = factors.powerAuthMultOverride;
      if (factors.ownershipMultOverride !== undefined) buildingUpdate.ownershipMultOverride = factors.ownershipMultOverride;
      if (factors.tierMultOverride !== undefined) buildingUpdate.tierMultOverride = factors.tierMultOverride;
    }

    // Update building if there are changes
    if (Object.keys(buildingUpdate).length > 0) {
      await prisma.building.update({
        where: { id: buildingId },
        data: buildingUpdate,
      });
    }

    // Update or create lease details on UsePeriod
    if (lease) {
      const currentUsePeriod = building.usePeriods[0];

      const leaseUpdate: Record<string, any> = {};
      if (lease.tenant !== undefined) leaseUpdate.tenant = lease.tenant;
      if (lease.leaseStructure !== undefined) leaseUpdate.leaseStructure = lease.leaseStructure;
      if (lease.leaseYears !== undefined) leaseUpdate.leaseYears = lease.leaseYears;
      if (lease.leaseValueM !== undefined) leaseUpdate.leaseValueM = lease.leaseValueM;
      if (lease.annualRevM !== undefined) leaseUpdate.annualRevM = lease.annualRevM;
      if (lease.noiPct !== undefined) leaseUpdate.noiPct = lease.noiPct;
      if (lease.noiAnnualM !== undefined) leaseUpdate.noiAnnualM = lease.noiAnnualM;

      if (currentUsePeriod) {
        // Update existing use period
        await prisma.usePeriod.update({
          where: { id: currentUsePeriod.id },
          data: leaseUpdate,
        });
      } else {
        // Create new use period if none exists
        await prisma.usePeriod.create({
          data: {
            buildingId,
            useType: 'HPC_AI_HOSTING',
            isCurrent: true,
            ...leaseUpdate,
          },
        });
      }
    }

    // Return updated building with use periods
    const updatedBuilding = await prisma.building.findUnique({
      where: { id: buildingId },
      include: { usePeriods: { where: { isCurrent: true } } },
    });

    res.json({ success: true, building: updatedBuilding });
  } catch (error) {
    console.error('Error updating valuation details:', error);
    res.status(500).json({ error: 'Failed to update valuation details' });
  }
});

// ===========================================
// ROUTES
// ===========================================

app.use('/api/v1/import', importRouter);
app.use('/api/v1/stock-prices', stockPricesRouter);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

export { io };

export const broadcast = (event: string, data: any) => {
  io.emit(event, data);
};

// Start server
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🚀 BTC Miner Valuation Terminal API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
