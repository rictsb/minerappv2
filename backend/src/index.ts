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

app.post('/api/v1/use-periods', async (req, res) => {
  try {
    // If creating a new current use period, mark old ones as not current
    if (req.body.isCurrent && req.body.buildingId) {
      await prisma.usePeriod.updateMany({
        where: { buildingId: req.body.buildingId, isCurrent: true },
        data: { isCurrent: false, endDate: new Date() },
      });
    }
    const usePeriod = await prisma.usePeriod.create({
      data: req.body,
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
      settingsMap[s.key] = s.value;
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

// ===========================================
// VALUATION API
// ===========================================

// Default valuation factors
const DEFAULT_FACTORS: Record<string, any> = {
  // Market prices
  btcPrice: 97000,
  ethPrice: 2500,

  // HPC/AI valuation
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
      settings[s.key] = s.value;
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
    const getEnergizationMultiplier = (energizationDate: Date | null): number => {
      if (!energizationDate) return 1.0;
      const year = new Date(energizationDate).getFullYear();
      const baseYear = factors.energizationBaseYear ?? DEFAULT_FACTORS.energizationBaseYear;
      const decayRate = factors.energizationDecayRate ?? DEFAULT_FACTORS.energizationDecayRate;
      return Math.exp(-decayRate * (year - baseYear));
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

    const valuations = companies.map((company) => {
      // Net Liquid = Cash + BTC Value + ETH Value - Debt
      const btcValue = (Number(company.btcCount) || 0) * (factors.btcPrice / 1000000);
      const ethValue = (Number(company.ethHoldings) || 0);
      const netLiquid = (Number(company.cashM) || 0) + btcValue + ethValue - (Number(company.debtM) || 0);

      // Calculate MW by category and enterprise value
      let mwMiningOperational = 0;
      let mwHpcOperational = 0;
      let mwHpcContracted = 0;
      let mwHpcPipeline = 0;
      let evMining = 0;
      let evHpcContracted = 0;
      let evHpcPipeline = 0;

      for (const site of company.sites) {
        // Calculate total site MW for size multiplier
        let siteTotalMw = 0;
        for (const campus of site.campuses) {
          for (const building of campus.buildings) {
            siteTotalMw += Number(building.grossMw) || 0;
          }
        }
        const sizeMultiplier = getSizeMultiplier(siteTotalMw);

        for (const campus of site.campuses) {
          for (const building of campus.buildings) {
            // Skip buildings excluded from valuation
            if (!building.includeInValuation) continue;

            const mw = Number(building.grossMw) || 0;
            const phase = building.developmentPhase;

            // Get base probability from phase or override
            const prob = building.probabilityOverride
              ? Number(building.probabilityOverride)
              : getPhaseProbability(phase);

            // Regulatory risk multiplier (1.0 = no risk, 0.0 = blocked)
            const regRisk = Number(building.regulatoryRisk) ?? 1.0;

            // Energization year discount
            const energizationMult = getEnergizationMultiplier(building.energizationDate);

            // Power authority multiplier
            const paMult = getPowerAuthorityMultiplier(building.grid);

            // Ownership multiplier
            const ownershipMult = getOwnershipMultiplier(building.ownershipStatus);

            const currentUse = building.usePeriods[0];
            const useType = currentUse?.useType || 'UNCONTRACTED';
            const hasLease = currentUse?.tenant && currentUse?.leaseValueM;
            const noiAnnual = Number(currentUse?.noiAnnualM) || 0;

            // Tenant credit multiplier
            const tenantMult = getTenantCreditMultiplier(currentUse?.tenant ?? null);

            // Combined adjustment factor
            const adjFactor = prob * regRisk * energizationMult * paMult * ownershipMult * sizeMultiplier;

            // Categorize and value
            if (useType === 'BTC_MINING' || useType === 'BTC_MINING_HOSTING') {
              if (phase === 'OPERATIONAL') {
                mwMiningOperational += mw;
              }
              // Mining value based on EBITDA (calculated at company level)
            } else if (useType === 'HPC_AI_HOSTING' || useType === 'GPU_CLOUD') {
              if (phase === 'OPERATIONAL') {
                mwHpcOperational += mw;
              }
              if (hasLease) {
                mwHpcContracted += mw;
                // Value from NOI if available, otherwise from lease value
                if (noiAnnual > 0) {
                  evHpcContracted += noiAnnual * factors.noiMultiple * adjFactor * tenantMult;
                } else {
                  evHpcContracted += (Number(currentUse?.leaseValueM) || 0) * adjFactor * tenantMult;
                }
              } else {
                mwHpcPipeline += mw * adjFactor;
                evHpcPipeline += mw * factors.mwValueHpcUncontracted * adjFactor;
              }
            } else if (useType === 'HPC_AI_PLANNED' || useType === 'UNCONTRACTED' || useType === 'UNCONTRACTED_ROFR') {
              // Pipeline - uncontracted capacity
              mwHpcPipeline += mw * adjFactor;
              evHpcPipeline += mw * factors.mwValueHpcUncontracted * adjFactor;
            }
          }
        }
      }

      // Calculate mining value from company-level hashrate
      const hashrate = Number(company.hashrateEh) || 0;
      const efficiency = Number(company.efficiencyJth) || 20;
      const powerCost = Number(company.powerCostKwh) || 0.04;

      if (hashrate > 0) {
        const annualRevenue = hashrate * factors.dailyRevPerEh * 365 / 1000000;
        const annualPowerCost = hashrate * efficiency * powerCost * 8760 / 1000000;
        const poolFees = annualRevenue * factors.poolFeePct;
        const ebitda = annualRevenue - annualPowerCost - poolFees;
        evMining = Math.max(0, ebitda * factors.ebitdaMultiple);
      }

      const totalEv = evMining + evHpcContracted + evHpcPipeline;
      const fairValue = netLiquid + totalEv;

      return {
        ticker: company.ticker,
        name: company.name,
        stockPrice: Number(company.stockPrice) || null,
        netLiquid: Math.round(netLiquid * 10) / 10,
        mwMining: Math.round(mwMiningOperational),
        mwHpc: Math.round(mwHpcOperational + mwHpcContracted),
        evMining: Math.round(evMining),
        evHpcContracted: Math.round(evHpcContracted),
        evHpcPipeline: Math.round(evHpcPipeline),
        evGpu: 0, // Placeholder for GPU cloud revenue-based valuation
        totalEv: Math.round(totalEv),
        fairValue: Math.round(fairValue),
      };
    });

    res.json({ factors, valuations });
  } catch (error) {
    console.error('Error calculating valuations:', error);
    res.status(500).json({ error: 'Failed to calculate valuations' });
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
