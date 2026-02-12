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
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  },
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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
const DEFAULT_FACTORS = {
  btcPrice: 97000,
  ethPrice: 2500,
  mwValueHpcContracted: 25, // $M per MW for contracted HPC
  mwValueHpcUncontracted: 8, // $M per MW for pipeline/uncontracted
  mwValueBtcMining: 0.3, // $M per MW for BTC mining
  noiMultiple: 10, // NOI multiple for valuation
  ebitdaMultiple: 6, // EBITDA multiple for mining
  dailyRevPerEh: 29400, // Daily revenue per EH/s
  poolFeePct: 0.02,
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
        for (const campus of site.campuses) {
          for (const building of campus.buildings) {
            const mw = Number(building.grossMw) || 0;
            const phase = building.developmentPhase;
            const prob = building.probabilityOverride
              ? Number(building.probabilityOverride)
              : (factors.phaseProbabilities as any)[phase] || 0.5;

            const currentUse = building.usePeriods[0];
            const useType = currentUse?.useType || 'UNCONTRACTED';
            const hasLease = currentUse?.tenant && currentUse?.leaseValueM;
            const noiAnnual = Number(currentUse?.noiAnnualM) || 0;

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
                  evHpcContracted += noiAnnual * factors.noiMultiple * prob;
                } else {
                  evHpcContracted += Number(currentUse?.leaseValueM) || 0;
                }
              } else {
                mwHpcPipeline += mw * prob;
                evHpcPipeline += mw * factors.mwValueHpcUncontracted * prob;
              }
            } else if (useType === 'HPC_AI_PLANNED' || useType === 'UNCONTRACTED' || useType === 'UNCONTRACTED_ROFR') {
              // Pipeline - uncontracted capacity
              mwHpcPipeline += mw * prob;
              evHpcPipeline += mw * factors.mwValueHpcUncontracted * prob;
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
