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
// SHARED VALUATION HELPERS
// ===========================================
// Single source of truth for all factor calculations and period valuations.
// Used by /api/v1/companies, /api/v1/valuation, and /api/v1/buildings/:id/valuation.

function createFactorHelpers(f: Record<string, any>) {
  const getPhaseProbability = (phase: string): number => {
    const phaseMap: Record<string, string> = {
      OPERATIONAL: 'probOperational', CONSTRUCTION: 'probConstruction',
      DEVELOPMENT: 'probDevelopment', EXCLUSIVITY: 'probExclusivity', DILIGENCE: 'probDiligence',
    };
    const key = phaseMap[phase];
    return key ? (f[key] ?? 0.5) : 0.5;
  };

  const getTimeValueMult = (leaseStart: Date | null, energDate: Date | null): number => {
    const dr = f.discountRate ?? 0.10;
    const ref = leaseStart ? new Date(leaseStart) : energDate ? new Date(energDate) : null;
    if (!ref) return 1.0;
    const yrs = (ref.getTime() - Date.now()) / (365.25 * 24 * 3600 * 1000);
    return yrs <= 0 ? 1.0 : 1 / Math.pow(1 + dr, yrs);
  };

  const getPAMult = (grid: string | null): number => {
    if (!grid) return f.paOther ?? 0.80;
    const g = grid.toLowerCase();
    if (g.includes('ercot')) return f.paErcot ?? 1.05;
    if (g.includes('pjm')) return f.paPjm ?? 1.00;
    if (g.includes('miso')) return f.paMiso ?? 0.95;
    if (g.includes('nyiso')) return f.paNyiso ?? 0.95;
    if (g.includes('caiso')) return f.paCaiso ?? 0.90;
    if (g.includes('canada') || g.includes('hydro')) return f.paCanada ?? 0.95;
    if (g.includes('norway')) return f.paNorway ?? 0.90;
    if (g.includes('uae')) return f.paUae ?? 0.85;
    if (g.includes('bhutan')) return f.paBhutan ?? 0.70;
    if (g.includes('paraguay')) return f.paParaguay ?? 0.70;
    if (g.includes('ethiopia')) return f.paEthiopia ?? 0.60;
    return f.paOther ?? 0.80;
  };

  const getSizeMult = (mw: number): number => {
    if (mw >= 500) return f.sizeGte500 ?? 1.10;
    if (mw >= 250) return f.size250to499 ?? 1.00;
    if (mw >= 100) return f.size100to249 ?? 0.95;
    return f.sizeLt100 ?? 0.85;
  };

  const getOwnerMult = (s: string | null): number => {
    if (!s) return f.ownedMult ?? 1.0;
    const sl = s.toLowerCase();
    if (sl.includes('own') || sl.includes('fee')) return f.ownedMult ?? 1.0;
    if (sl.includes('long') || sl.includes('ground')) return f.longtermLeaseMult ?? 0.95;
    if (sl.includes('short') || sl.includes('lease')) return f.shorttermLeaseMult ?? 0.85;
    return f.ownedMult ?? 1.0;
  };

  const getTierMult = (tier: string | null): number => {
    if (!tier) return f.tierIiiMult ?? 1.0;
    if (tier.includes('IV') || tier.includes('4')) return f.tierIvMult ?? 1.15;
    if (tier.includes('III') || tier.includes('3')) return f.tierIiiMult ?? 1.00;
    if (tier.includes('II') || tier.includes('2')) return f.tierIiMult ?? 0.90;
    return f.tierIMult ?? 0.80;
  };

  const getTenantMult = (tenant: string | null): number => {
    if (!tenant) return 1.0;
    const t = tenant.toLowerCase();
    const sofr = f.sofrRate ?? 4.3;
    let spread = f.tcOther ?? 1.0;
    if (t.includes('google')) spread = f.tcGoogle ?? -1.0;
    else if (t.includes('microsoft') || t.includes('azure')) spread = f.tcMicrosoft ?? -1.0;
    else if (t.includes('amazon') || t.includes('aws')) spread = f.tcAmazon ?? -1.0;
    else if (t.includes('meta') || t.includes('facebook')) spread = f.tcMeta ?? -0.75;
    else if (t.includes('oracle')) spread = f.tcOracle ?? -0.50;
    else if (t.includes('coreweave')) spread = f.tcCoreweave ?? 0.0;
    else if (t.includes('anthropic')) spread = f.tcAnthropic ?? 0.0;
    else if (t.includes('openai')) spread = f.tcOpenai ?? 0.0;
    else if (t.includes('xai') || t.includes('x.ai')) spread = f.tcXai ?? 0.25;
    return sofr / (sofr + spread);
  };

  const getLeaseStructMult = (structure: string | null): number => {
    if (!structure) return f.nnnMult ?? 1.0;
    const sl = structure.toLowerCase();
    if (sl.includes('nnn') || sl.includes('triple')) return f.nnnMult ?? 1.0;
    if (sl.includes('modified')) return f.modifiedGrossMult ?? 0.95;
    if (sl.includes('gross')) return f.grossMult ?? 0.90;
    return f.nnnMult ?? 1.0;
  };

  return { getPhaseProbability, getTimeValueMult, getPAMult, getSizeMult, getOwnerMult, getTierMult, getTenantMult, getLeaseStructMult };
}

// Compute building-level factor (shared across all splits of a building)
function computeBuildingFactor(building: any, siteTotalMw: number, helpers: ReturnType<typeof createFactorHelpers>) {
  const phase = building.developmentPhase || 'DILIGENCE';
  const prob = building.probabilityOverride ? Number(building.probabilityOverride) : helpers.getPhaseProbability(phase);
  const regRisk = Number(building.regulatoryRisk) ?? 1.0;
  const paMult = helpers.getPAMult(building.grid);
  const ownerMult = helpers.getOwnerMult(building.ownershipStatus);
  const sizeMult = helpers.getSizeMult(siteTotalMw);
  const tierMult = helpers.getTierMult((building as any).datacenterTier || 'TIER_III');
  const fidoodle = Number((building as any).fidoodleFactor) ?? 1.0;
  return prob * regRisk * paMult * ownerMult * sizeMult * tierMult * fidoodle;
}

// Derive NOI from lease data. DB stores noiPct as 0-1 fraction.
function deriveNoi(up: any): number {
  let noiAnnual = Number(up.noiAnnualM) || 0;
  if (!noiAnnual) {
    const leaseValM = Number(up.leaseValueM) || 0;
    const leaseYears = Number(up.leaseYears) || 10;
    const noiPctFrac = Number(up.noiPct) || 0; // 0-1 fraction from DB
    if (leaseValM > 0 && noiPctFrac > 0) {
      const annualRev = leaseValM / Math.max(leaseYears, 0.1);
      noiAnnual = annualRev * noiPctFrac;
    }
  }
  return noiAnnual;
}

// Compute valuation for a single use period. Returns the valuation details object.
// This is the SINGLE canonical computation used everywhere.
function computePeriodValuation(
  up: any,
  periodMw: number,
  building: any,
  buildingFactor: number,
  helpers: ReturnType<typeof createFactorHelpers>,
  f: Record<string, any>
): { valuationM: number; method: string; grossValue: number; noiAnnual: number; capRate: number; periodFactor: number; tenantMult: number; leaseStructMult: number; timeValueMult: number; capexDeductionM: number } {
  // Per-period factors
  const timeValueMult = helpers.getTimeValueMult(up.leaseStart ?? null, building.energizationDate);
  const tenantMult = helpers.getTenantMult(up.tenant ?? null);
  const leaseStructMult = helpers.getLeaseStructMult(up.leaseStructure ?? null);
  const periodFactor = buildingFactor * timeValueMult * tenantMult * leaseStructMult;

  // CapEx deduction for non-operational buildings: use-period > building > global
  // Skip if building is operational OR if financing is already in reported financials
  const phase = building.developmentPhase || 'DILIGENCE';
  const isOperational = phase === 'OPERATIONAL';
  const capexInFinancials = !!(building as any).capexInFinancials;
  const useType = up.useType || 'UNCONTRACTED';
  const hasLease = up.tenant && up.leaseValueM;
  // Only deduct capex when there's an actual lease — pipeline/uncontracted MW gets no capex treatment
  const skipCapex = isOperational || capexInFinancials || !hasLease;
  const resolvedCapexPerMw = Number(up.capexPerMwOverride) || Number(building.capexPerMwOverride) || (f.capexPerMw ?? 10);
  const debtFundingPct = f.debtFundingPct ?? 0.65;
  const equityCapex = skipCapex ? 0 : resolvedCapexPerMw * (1 - debtFundingPct) * periodMw;

  const makeResult = (val: number, method: string, grossValue: number, noiAnnual: number, capRate: number) => {
    const netVal = Math.max(0, val - equityCapex);
    return { valuationM: isFinite(netVal) ? netVal : 0, method, grossValue, noiAnnual, capRate, periodFactor, tenantMult, leaseStructMult, timeValueMult, capexDeductionM: equityCapex };
  };

  // BTC Mining — simple $/MW
  if (useType === 'BTC_MINING' || useType === 'BTC_MINING_HOSTING') {
    const gross = periodMw * (f.mwValueBtcMining ?? 0.3);
    const val = gross * periodFactor;
    return makeResult(val, 'MW_VALUE', gross, 0, 0);
  }

  // HPC/AI with lease — Direct Capitalization: NOI / Cap Rate
  if ((useType === 'HPC_AI_HOSTING' || useType === 'GPU_CLOUD') && hasLease) {
    const noiAnnual = deriveNoi(up);
    const capRate = f.hpcCapRate ?? 0.075;
    if (noiAnnual > 0 && capRate > 0) {
      const grossValue = noiAnnual / capRate;
      const val = grossValue * periodFactor;
      return makeResult(val, 'NOI_CAP_RATE', grossValue, noiAnnual, capRate);
    } else {
      const leaseValM = Number(up.leaseValueM) || 0;
      const val = leaseValM * periodFactor;
      return makeResult(val, 'LEASE_VALUE', leaseValM, 0, 0);
    }
  }

  // Pipeline / uncontracted — $/MW
  const gross = periodMw * (f.mwValueHpcUncontracted ?? 8);
  const val = gross * periodFactor;
  return makeResult(val, 'MW_PIPELINE', gross, 0, 0);
}

// Compute MW for a period, handling remainder logic for splits
function computePeriodMw(up: any, buildingItMw: number, currentUses: any[], explicitlyAllocated: number): number {
  let mw = Number(up.mwAllocation) || 0;
  if (!mw) {
    mw = currentUses.length === 1 ? buildingItMw : Math.max(buildingItMw - explicitlyAllocated, 0);
  }
  return mw;
}

// Compute effective total MW allocated across all use periods (explicit + remainder assignments)
function computeEffectiveAllocated(currentUses: any[], buildingItMw: number): number {
  const explicitlyAllocated = currentUses.reduce((s: number, up: any) => s + (Number(up.mwAllocation) || 0), 0);
  let total = 0;
  for (const up of currentUses) {
    total += computePeriodMw(up, buildingItMw, currentUses, explicitlyAllocated);
  }
  return total;
}

// Load merged factors from settings + defaults
async function loadFactors(): Promise<Record<string, any>> {
  const settingsRows = await prisma.settings.findMany();
  const settingsMap: Record<string, any> = {};
  for (const s of settingsRows) {
    const num = Number(s.value);
    settingsMap[s.key] = isNaN(num) ? s.value : num;
  }
  const factors = { ...DEFAULT_FACTORS, ...settingsMap };

  // Derive dailyRevPerEh from btcPrice unless user has explicitly overridden dailyRevPerEh
  // Formula: dailyRevPerEh = (blockReward * 144 * btcPrice) / networkHashrateEh
  // If networkHashrateEh not set, scale proportionally from baseline ($97k → $29,400)
  if (!settingsMap.dailyRevPerEh && factors.btcPrice) {
    const baselineBtc = 97000;
    const baselineDailyRev = 29400;
    factors.dailyRevPerEh = (factors.btcPrice / baselineBtc) * baselineDailyRev;
  }

  return factors;
}

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

    const f = await loadFactors();
    const helpers = createFactorHelpers(f);

    // --- Compute per-period valuations and attach to response ---
    const enriched = companies.map((company: any) => {
      let companyImpliedDebt = 0;

      for (const site of (company.sites || [])) {
        let siteTotalMw = 0;
        for (const campus of (site.campuses || [])) {
          for (const bld of (campus.buildings || [])) {
            siteTotalMw += Number(bld.grossMw) || 0;
          }
        }

        for (const campus of (site.campuses || [])) {
          for (const bld of (campus.buildings || [])) {
            const buildingMw = Number(bld.itMw) || 0;
            const bFactor = computeBuildingFactor(bld, siteTotalMw, helpers);
            const phase = bld.developmentPhase || 'DILIGENCE';
            const isOp = phase === 'OPERATIONAL';
            const skipCapex = isOp || !!(bld as any).capexInFinancials;

            const currentUses = (bld.usePeriods || []).filter((up: any) => up.isCurrent);
            const explicitAlloc = currentUses.reduce((s: number, up: any) => s + (Number(up.mwAllocation) || 0), 0);

            for (const up of currentUses) {
              const mw = computePeriodMw(up, buildingMw, currentUses, explicitAlloc);
              const result = computePeriodValuation(up, mw, bld, bFactor, helpers, f);
              (up as any).computedValuationM = result.valuationM;
              // Only accumulate implied debt when there's a lease (not pipeline)
              const upHasLease = up.tenant && up.leaseValueM;
              if (!skipCapex && upHasLease) {
                const resolvedCapex = Number(up.capexPerMwOverride) || Number(bld.capexPerMwOverride) || (f.capexPerMw ?? 10);
                companyImpliedDebt += resolvedCapex * (f.debtFundingPct ?? 0.65) * mw;
              }
            }

            // For buildings with no use periods, treat as pipeline
            if (currentUses.length === 0) {
              const timeVal = helpers.getTimeValueMult(null, bld.energizationDate);
              const pipelineVal = buildingMw * (f.mwValueHpcUncontracted ?? 8) * bFactor * timeVal;
              (bld as any).computedValuationM = isFinite(pipelineVal) ? pipelineVal : 0;
              // No implied debt for buildings with no use periods — pure pipeline
            }

            // For split buildings with unallocated remainder, add synthetic entry
            if (currentUses.length > 0) {
              const effectiveAlloc = computeEffectiveAllocated(currentUses, buildingMw);
              const unallocMw = Math.max(0, buildingMw - effectiveAlloc);
              if (unallocMw > 0) {
                const timeVal = helpers.getTimeValueMult(null, bld.energizationDate);
                const pipelineVal = unallocMw * (f.mwValueHpcUncontracted ?? 8) * bFactor * timeVal;
                (bld as any).unallocatedMw = unallocMw;
                (bld as any).unallocatedValuationM = isFinite(pipelineVal) ? pipelineVal : 0;
                // No implied debt for unallocated remainder — pipeline
              }
            }
          }
        }
      }

      (company as any).impliedProjectDebtM = Math.round(companyImpliedDebt);
      return company;
    });

    res.json(enriched);
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

// Bulk-set capexInFinancials for ALL buildings of a company
app.patch('/api/v1/companies/:ticker/capex-in-financials', async (req, res) => {
  try {
    const { value } = req.body; // boolean
    if (typeof value !== 'boolean') {
      return res.status(400).json({ error: 'value must be a boolean' });
    }
    // Get all building IDs for this company through the site→campus→building chain
    const sites = await prisma.site.findMany({
      where: { ticker: req.params.ticker },
      include: { campuses: { include: { buildings: true } } },
    });
    const buildingIds: string[] = [];
    for (const site of sites) {
      for (const campus of site.campuses) {
        for (const bld of campus.buildings) {
          buildingIds.push(bld.id);
        }
      }
    }
    if (buildingIds.length === 0) {
      return res.json({ updated: 0 });
    }
    const result = await prisma.building.updateMany({
      where: { id: { in: buildingIds } },
      data: { capexInFinancials: value },
    });
    res.json({ updated: result.count, value });
  } catch (error) {
    console.error('Error bulk-setting capexInFinancials:', error);
    res.status(500).json({ error: 'Failed to update' });
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
    const body = req.body;

    // Validate lease start date >= energization date
    const leaseStartStr = body.leaseStart || body.startDate;
    if (leaseStartStr) {
      const usePeriod = await prisma.usePeriod.findUnique({
        where: { id: req.params.id },
        include: { building: true },
      });
      if (usePeriod?.building?.energizationDate) {
        const leaseStart = new Date(leaseStartStr);
        const energization = new Date(usePeriod.building.energizationDate);
        if (leaseStart < energization) {
          return res.status(400).json({
            error: `Lease start date (${leaseStartStr}) cannot be before energization date (${usePeriod.building.energizationDate.toISOString().split('T')[0]})`,
          });
        }
      }
    }

    // Build a clean update object with only known Prisma fields
    const data: Record<string, any> = {};
    if (body.useType !== undefined) data.useType = body.useType;
    if (body.tenant !== undefined) data.tenant = body.tenant;
    if (body.mwAllocation !== undefined) data.mwAllocation = body.mwAllocation;
    if (body.leaseValueM !== undefined) data.leaseValueM = body.leaseValueM;
    if (body.leaseYears !== undefined) data.leaseYears = body.leaseYears;
    if (body.noiPct !== undefined) data.noiPct = body.noiPct;
    if (body.leaseStructure !== undefined) data.leaseStructure = body.leaseStructure;
    if (body.leaseStart !== undefined) data.leaseStart = body.leaseStart ? new Date(body.leaseStart) : null;
    if (body.leaseEnd !== undefined) data.leaseEnd = body.leaseEnd ? new Date(body.leaseEnd) : null;
    if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.isCurrent !== undefined) data.isCurrent = body.isCurrent;
    if (body.annualRevM !== undefined) data.annualRevM = body.annualRevM;
    if (body.noiAnnualM !== undefined) data.noiAnnualM = body.noiAnnualM;
    if (body.capexPerMwOverride !== undefined) data.capexPerMwOverride = body.capexPerMwOverride;

    // Recompute noiAnnualM if lease data changed
    if (body.leaseValueM !== undefined || body.leaseYears !== undefined || body.noiPct !== undefined) {
      const existing = await prisma.usePeriod.findUnique({ where: { id: req.params.id } });
      if (existing) {
        const leaseVal = Number(body.leaseValueM ?? existing.leaseValueM) || 0;
        const leaseYrs = Number(body.leaseYears ?? existing.leaseYears) || 10;
        const noiPctFrac = Number(body.noiPct ?? existing.noiPct) || 0;
        if (leaseVal > 0 && noiPctFrac > 0) {
          data.noiAnnualM = (leaseVal / Math.max(leaseYrs, 0.1)) * noiPctFrac;
        }
      }
    }

    const usePeriod = await prisma.usePeriod.update({
      where: { id: req.params.id },
      data,
    });
    res.json(usePeriod);
  } catch (error: any) {
    console.error('Error updating use period:', error);
    res.status(500).json({ error: error.message || 'Failed to update use period' });
  }
});

app.delete('/api/v1/use-periods/:id', async (req, res) => {
  try {
    const toDelete = await prisma.usePeriod.findUnique({ where: { id: req.params.id } });
    if (!toDelete) {
      return res.status(404).json({ error: 'Use period not found' });
    }

    // Check if this is the last current use period for the building
    const currentCount = await prisma.usePeriod.count({
      where: { buildingId: toDelete.buildingId, isCurrent: true },
    });

    if (currentCount <= 1 && toDelete.isCurrent) {
      // Last period: instead of deleting, reset to untentanted while preserving useType
      await prisma.usePeriod.update({
        where: { id: req.params.id },
        data: {
          tenant: null,
          mwAllocation: null,
          leaseValueM: null,
          leaseYears: null,
          noiPct: null,
          noiAnnualM: null,
          annualRevM: null,
          leaseStart: null,
          leaseEnd: null,
          leaseStructure: 'NNN',
        },
      });
      res.json({ success: true, reset: true });
    } else {
      await prisma.usePeriod.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    }
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
    const { ticker, cashM, btcCount, ethCount, totalDebtM, sourceDate, notes } = req.body;
    const data: Record<string, any> = {};
    if (cashM !== undefined) data.cashM = cashM;
    if (btcCount !== undefined) data.btcCount = btcCount;
    if (ethCount !== undefined) data.ethCount = ethCount;
    if (totalDebtM !== undefined) data.totalDebtM = totalDebtM;
    if (sourceDate !== undefined) data.sourceDate = sourceDate ? new Date(sourceDate) : null;
    if (notes !== undefined) data.notes = notes;

    const asset = await prisma.netLiquidAssets.upsert({
      where: { ticker },
      update: data,
      create: { ticker, ...data },
    });
    res.json(asset);
  } catch (error) {
    console.error('Error saving net liquid assets:', error);
    res.status(500).json({ error: 'Failed to save net liquid assets' });
  }
});

app.patch('/api/v1/net-liquid-assets/:ticker', async (req, res) => {
  try {
    const { cashM, btcCount, ethCount, totalDebtM, sourceDate, notes } = req.body;
    const data: Record<string, any> = {};
    if (cashM !== undefined) data.cashM = cashM;
    if (btcCount !== undefined) data.btcCount = btcCount;
    if (ethCount !== undefined) data.ethCount = ethCount;
    if (totalDebtM !== undefined) data.totalDebtM = totalDebtM;
    if (sourceDate !== undefined) data.sourceDate = sourceDate ? new Date(sourceDate) : null;
    if (notes !== undefined) data.notes = notes;

    const asset = await prisma.netLiquidAssets.update({
      where: { ticker: req.params.ticker },
      data,
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
  dailyRevPerEh: 29400, // Daily revenue per EH/s (derived from btcPrice if not overridden)
  networkHashrateEh: 0, // Network hashrate in EH/s (0 = auto-derive dailyRevPerEh from btcPrice)
  blockReward: 3.125, // BTC block reward (post-2024 halving)
  poolFeePct: 0.02,

  // Development costs
  capexPerMw: 10, // $10M per MW default build cost
  debtFundingPct: 0.65, // 65% of capex financed with project debt

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
    const factors = await loadFactors();
    const helpers = createFactorHelpers(factors);

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

    const miningValuations = await prisma.miningValuation.findMany();
    const netLiquidAssets = await prisma.netLiquidAssets.findMany();
    const miningByTicker = new Map(miningValuations.map((mv: any) => [mv.ticker, mv]));
    const netLiquidByTicker = new Map(netLiquidAssets.map((nla: any) => [nla.ticker, nla]));

    const valuations = companies.map((company: any) => {
      // Net Liquid
      const nlaRecord: any = netLiquidByTicker.get(company.ticker);
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

      // Mining Valuation
      const mvRecord: any = miningByTicker.get(company.ticker);
      let evMining = 0;
      if (mvRecord) {
        const eh = Number(mvRecord.hashrateEh) || 0;
        const eff = Number(mvRecord.efficiencyJth) || 0;
        const power = Number(mvRecord.powerCostKwh) || 0;
        const hostedMw = Number(mvRecord.hostedMw) || 0;
        if (eh > 0) {
          const annRevM = (eh * factors.dailyRevPerEh * 365) / 1_000_000;
          const annPowerM = eh * eff * power * 8.76;
          const poolFeesM = factors.poolFeePct * annRevM;
          const ebitdaM = annRevM - annPowerM - poolFeesM;
          evMining += Math.max(0, ebitdaM * factors.ebitdaMultiple);
        }
        if (hostedMw > 0) evMining += hostedMw * factors.mwValueBtcMining;
      }

      let totalItMw = 0;
      let mwHpcContracted = 0;
      let mwHpcPipeline = 0;
      let evHpcContracted = 0;
      let evHpcPipeline = 0;
      const hpcSites: any[] = [];
      let totalLeaseValueM = 0;
      let impliedProjectDebtM = 0;
      const periodValuations: { buildingId: string; usePeriodId: string | null; valuationM: number }[] = [];

      for (const site of company.sites) {
        let siteTotalMw = 0;
        for (const campus of site.campuses) {
          for (const building of campus.buildings) {
            siteTotalMw += Number(building.grossMw) || 0;
            totalItMw += Number(building.itMw) || 0;
          }
        }

        for (const campus of site.campuses) {
          for (const building of campus.buildings) {
            if (!building.includeInValuation) continue;

            const buildingMw = Number(building.itMw) || 0;
            const bFactor = computeBuildingFactor(building, siteTotalMw, helpers);
            const currentUses = building.usePeriods.filter((up: any) => up.isCurrent);

            // Accumulate implied project debt for non-operational buildings
            // Skip if operational OR financing already in reported financials
            const phase = (building as any).developmentPhase || 'DILIGENCE';
            const isOperational = phase === 'OPERATIONAL';
            const bldCapexInFinancials = !!(building as any).capexInFinancials;
            const skipCapexDeductions = isOperational || bldCapexInFinancials;

            if (currentUses.length === 0) {
              const timeVal = helpers.getTimeValueMult(null, building.energizationDate);
              const pipelineVal = buildingMw * (factors.mwValueHpcUncontracted ?? 8) * bFactor * timeVal;
              mwHpcPipeline += buildingMw;
              evHpcPipeline += pipelineVal;
              periodValuations.push({ buildingId: building.id, usePeriodId: null, valuationM: pipelineVal });
              // No implied debt for buildings with no use periods — they're pure pipeline
            } else {
              const explicitlyAllocated = currentUses.reduce((sum: number, up: any) => sum + (Number(up.mwAllocation) || 0), 0);

              for (const currentUse of currentUses) {
                const mw = computePeriodMw(currentUse, buildingMw, currentUses, explicitlyAllocated);
                const result = computePeriodValuation(currentUse, mw, building, bFactor, helpers, factors);
                const useType = currentUse.useType || 'UNCONTRACTED';
                const hasLease = currentUse.tenant && currentUse.leaseValueM;
                const leaseValM = Number(currentUse.leaseValueM) || 0;

                if (useType === 'BTC_MINING' || useType === 'BTC_MINING_HOSTING') {
                  // Mining period already handled
                } else if ((useType === 'HPC_AI_HOSTING' || useType === 'GPU_CLOUD') && hasLease) {
                  mwHpcContracted += mw;
                  totalLeaseValueM += leaseValM;
                  evHpcContracted += result.valuationM;
                  hpcSites.push({
                    siteName: site.name,
                    buildingName: building.name,
                    tenant: currentUse.tenant || '',
                    mw,
                    leaseValueM: leaseValM,
                    noiAnnualM: result.noiAnnual,
                    valuation: Math.round(result.valuationM),
                    phase: building.developmentPhase,
                  });
                } else {
                  mwHpcPipeline += mw;
                  evHpcPipeline += result.valuationM;
                }

                periodValuations.push({ buildingId: building.id, usePeriodId: currentUse.id, valuationM: result.valuationM });

                // Implied debt for this period's MW — only when a lease exists (not pipeline)
                if (!skipCapexDeductions && hasLease) {
                  const resolvedCapex = Number(currentUse.capexPerMwOverride) || Number((building as any).capexPerMwOverride) || (factors.capexPerMw ?? 10);
                  impliedProjectDebtM += resolvedCapex * (factors.debtFundingPct ?? 0.65) * mw;
                }
              }

              // Add unallocated remainder as pipeline
              const effectiveAlloc = computeEffectiveAllocated(currentUses, buildingMw);
              const unallocMw = Math.max(0, buildingMw - effectiveAlloc);
              if (unallocMw > 0) {
                const timeVal = helpers.getTimeValueMult(null, building.energizationDate);
                const pipelineVal = unallocMw * (factors.mwValueHpcUncontracted ?? 8) * bFactor * timeVal;
                mwHpcPipeline += unallocMw;
                evHpcPipeline += pipelineVal;
                periodValuations.push({ buildingId: building.id, usePeriodId: null, valuationM: pipelineVal });
                // No implied debt for unallocated remainder — it's pipeline
              }
            }
          }
        }
      }

      const totalEv = (evMining || 0) + (evHpcContracted || 0) + (evHpcPipeline || 0);
      const totalValueM = (netLiquid || 0) + totalEv - impliedProjectDebtM;
      const fdSharesM = Number(company.fdSharesM) || 0;
      const fairValuePerShare = fdSharesM > 0 ? totalValueM / fdSharesM : null;

      return {
        ticker: company.ticker,
        name: company.name,
        stockPrice: Number(company.stockPrice) || null,
        fdSharesM: fdSharesM > 0 ? Math.round(fdSharesM * 10) / 10 : null,
        netLiquid: Math.round(netLiquid * 10) / 10,
        totalMw: Math.round(totalItMw),
        evMining: Math.round(evMining),
        evHpcContracted: Math.round(evHpcContracted),
        evHpcPipeline: Math.round(evHpcPipeline),
        evGpu: 0,
        totalEv: Math.round(totalEv),
        impliedProjectDebtM: Math.round(impliedProjectDebtM),
        totalValueM: Math.round(totalValueM),
        fairValuePerShare: fairValuePerShare !== null ? Math.round(fairValuePerShare * 100) / 100 : null,
        totalLeaseValueM: Math.round(totalLeaseValueM),
        hpcSites: hpcSites.sort((a: any, b: any) => b.valuation - a.valuation),
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

    const factors = await loadFactors();
    const helpers = createFactorHelpers(factors);

    // Calculate total site MW for size multiplier
    let siteTotalMw = 0;
    for (const campus of building.campus.site.campuses) {
      for (const b of campus.buildings) {
        siteTotalMw += Number(b.grossMw) || 0;
      }
    }

    const mw = Number(building.grossMw) || 0;
    const itMw = Number(building.itMw) || 0;

    const currentUsePeriods = building.usePeriods.filter((up: any) => up.isCurrent);
    const allUsePeriods = building.usePeriods;
    const currentUse = currentUsePeriods[0];
    const useType = currentUse?.useType || 'UNCONTRACTED';

    const explicitAllocatedMw = currentUsePeriods.reduce((sum: number, up: any) => sum + (Number(up.mwAllocation) || 0), 0);
    const effectiveAllocatedMw = computeEffectiveAllocated(currentUsePeriods, itMw);
    const allocatedMw = explicitAllocatedMw; // For display: what's explicitly set
    const unallocatedMw = Math.max(0, itMw - effectiveAllocatedMw);

    // Lease details from primary current use period
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

    // Remaining lease years
    let remainingLeaseYears = leaseDetails.leaseYears || 0;
    if (leaseDetails.leaseStart && leaseDetails.leaseYears) {
      const startDate = new Date(leaseDetails.leaseStart);
      const endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + leaseDetails.leaseYears);
      const now = new Date();
      remainingLeaseYears = Math.max(0, (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365));
    }

    // Build factor details for the UI (auto-derived + overrides)
    const datacenterTier = (building as any).datacenterTier || 'TIER_III';
    const fidoodleFactor = Number((building as any).fidoodleFactor) || 1.0;

    const factorDetails = {
      phase: building.developmentPhase,
      phaseProbability: {
        auto: helpers.getPhaseProbability(building.developmentPhase),
        override: building.probabilityOverride ? Number(building.probabilityOverride) : null,
        final: building.probabilityOverride ? Number(building.probabilityOverride) : helpers.getPhaseProbability(building.developmentPhase),
      },
      regulatoryRisk: { value: Number(building.regulatoryRisk) ?? 1.0 },
      sizeMultiplier: {
        siteTotalMw,
        auto: helpers.getSizeMult(siteTotalMw),
        override: (building as any).sizeMultOverride ? Number((building as any).sizeMultOverride) : null,
        final: (building as any).sizeMultOverride ? Number((building as any).sizeMultOverride) : helpers.getSizeMult(siteTotalMw),
      },
      powerAuthority: {
        grid: building.grid,
        auto: helpers.getPAMult(building.grid),
        override: (building as any).powerAuthMultOverride ? Number((building as any).powerAuthMultOverride) : null,
        final: (building as any).powerAuthMultOverride ? Number((building as any).powerAuthMultOverride) : helpers.getPAMult(building.grid),
      },
      ownership: {
        status: building.ownershipStatus,
        auto: helpers.getOwnerMult(building.ownershipStatus),
        override: (building as any).ownershipMultOverride ? Number((building as any).ownershipMultOverride) : null,
        final: (building as any).ownershipMultOverride ? Number((building as any).ownershipMultOverride) : helpers.getOwnerMult(building.ownershipStatus),
      },
      datacenterTier: {
        tier: datacenterTier,
        auto: helpers.getTierMult(datacenterTier),
        override: (building as any).tierMultOverride ? Number((building as any).tierMultOverride) : null,
        final: (building as any).tierMultOverride ? Number((building as any).tierMultOverride) : helpers.getTierMult(datacenterTier),
      },
      leaseStructure: {
        structure: leaseDetails.leaseStructure,
        auto: helpers.getLeaseStructMult(leaseDetails.leaseStructure),
        final: helpers.getLeaseStructMult(leaseDetails.leaseStructure),
      },
      tenantCredit: {
        tenant: leaseDetails.tenant,
        auto: helpers.getTenantMult(leaseDetails.tenant),
        final: helpers.getTenantMult(leaseDetails.tenant),
      },
      timeValue: {
        leaseStart: leaseDetails.leaseStart,
        energizationDate: building.energizationDate,
        source: leaseDetails.leaseStart ? 'leaseStart' : building.energizationDate ? 'energization' : 'none',
        auto: helpers.getTimeValueMult(leaseDetails.leaseStart, building.energizationDate),
        final: helpers.getTimeValueMult(leaseDetails.leaseStart, building.energizationDate),
      },
      fidoodleFactor: { value: fidoodleFactor },
      capexPerMw: {
        global: factors.capexPerMw ?? 10,
        buildingOverride: Number(building.capexPerMwOverride) || null,
        debtFundingPct: factors.debtFundingPct ?? 0.65,
        resolved: Number(building.capexPerMwOverride) || (factors.capexPerMw ?? 10),
      },
    };

    // Building-level factor (shared across all splits)
    const bFactor = computeBuildingFactor(building, siteTotalMw, helpers);

    // Compute per-period valuations using the shared canonical function
    const explicitlyAllocated = currentUsePeriods.reduce((sum: number, up: any) => sum + (Number(up.mwAllocation) || 0), 0);
    const periodValuations = currentUsePeriods.map((up: any) => {
      const periodMw = computePeriodMw(up, itMw, currentUsePeriods, explicitlyAllocated);
      const result = computePeriodValuation(up, periodMw, building, bFactor, helpers, factors);
      const noiAnnual = deriveNoi(up);
      const leaseValM = Number(up.leaseValueM) || 0;
      const leaseYrs = Number(up.leaseYears) || 0;
      const noiPctRaw = Number(up.noiPct) || 0;
      const annualRev = leaseValM > 0 && leaseYrs > 0 ? leaseValM / leaseYrs : 0;
      return {
        usePeriodId: up.id,
        tenant: up.tenant,
        useType: up.useType,
        mw: periodMw,
        method: result.method,
        grossValue: result.grossValue,
        noiAnnual: result.noiAnnual || noiAnnual,
        capRate: result.capRate || (factors.hpcCapRate ?? 0.075),
        periodFactor: result.periodFactor,
        tenantMult: result.tenantMult,
        leaseStructMult: result.leaseStructMult,
        timeValueMult: result.timeValueMult,
        capexDeductionM: result.capexDeductionM,
        valuationM: result.valuationM,
        // Lease summary for display
        leaseValueM: leaseValM,
        leaseYears: leaseYrs,
        noiPct: noiPctRaw,
        annualRev,
        leaseStart: up.leaseStart || up.startDate,
        leaseStructure: up.leaseStructure,
        capexPerMwOverride: Number(up.capexPerMwOverride) || null,
      };
    });

    // Add valuation for unallocated MW (pipeline value)
    if (unallocatedMw > 0) {
      const timeVal = helpers.getTimeValueMult(null, building.energizationDate);
      const pipelineRate = factors.mwValueHpcUncontracted ?? 8;
      const grossVal = unallocatedMw * pipelineRate;
      const pFactor = bFactor * timeVal;
      const valM = grossVal * pFactor;
      // CapEx deduction for unallocated pipeline (non-operational, financing not yet arranged)
      const phase = building.developmentPhase || 'DILIGENCE';
      const isOp = phase === 'OPERATIONAL';
      const bldCapexInFin = !!(building as any).capexInFinancials;
      const resolvedCapex = Number(building.capexPerMwOverride) || (factors.capexPerMw ?? 10);
      const equityCapex = (isOp || bldCapexInFin) ? 0 : resolvedCapex * (1 - (factors.debtFundingPct ?? 0.65)) * unallocatedMw;
      const netValM = Math.max(0, valM - equityCapex);
      periodValuations.push({
        usePeriodId: null,
        tenant: 'Unallocated Pipeline',
        useType: 'UNCONTRACTED',
        mw: unallocatedMw,
        method: 'MW_PIPELINE',
        grossValue: grossVal,
        noiAnnual: 0,
        capRate: 0,
        periodFactor: pFactor,
        tenantMult: 1,
        leaseStructMult: 1,
        timeValueMult: timeVal,
        capexDeductionM: equityCapex,
        valuationM: isFinite(netValM) ? netValM : 0,
        leaseValueM: 0,
        leaseYears: 0,
        noiPct: 0,
        annualRev: 0,
        leaseStart: null,
        leaseStructure: null,
        capexPerMwOverride: null,
      });
    }

    const totalValuation = periodValuations.reduce((sum: number, p: any) => sum + p.valuationM, 0);

    // Combined factor for display (building-level only for reference)
    const combinedFactor =
      (factorDetails.phaseProbability.final || 1) *
      (factorDetails.regulatoryRisk.value || 1) *
      (factorDetails.sizeMultiplier.final || 1) *
      (factorDetails.powerAuthority.final || 1) *
      (factorDetails.ownership.final || 1) *
      (factorDetails.datacenterTier.final || 1) *
      (factorDetails.fidoodleFactor.value || 1);

    // Simple valuation summary for backward compatibility (using first period)
    const capRate = factors.hpcCapRate ?? 0.075;
    const noiAnnual = leaseDetails.noiAnnualM || (deriveNoi(currentUse || {}));
    const baseValue = noiAnnual > 0 && capRate > 0 ? noiAnnual / capRate : 0;

    const valuation = {
      method: 'NOI_CAP_RATE',
      useType,
      inputs: {
        noiAnnualM: noiAnnual,
        capRate,
        discountRate: factors.discountRate,
      },
      calculation: {
        step1_baseValue: {
          description: 'NOI / Cap Rate (Direct Capitalization)',
          formula: `${noiAnnual.toFixed(2)} / ${(capRate * 100).toFixed(2)}%`,
          value: baseValue,
        },
      },
      results: {
        baseValueM: isFinite(baseValue) ? Math.round(baseValue * 10) / 10 : 0,
        grossValueM: isFinite(baseValue) ? Math.round(baseValue * 10) / 10 : 0,
        adjustedValueM: isFinite(totalValuation) ? Math.round(totalValuation * 10) / 10 : 0,
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
        capexInFinancials: !!(building as any).capexInFinancials,
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
      capacityAllocation: {
        totalItMw: itMw,
        allocatedMw: effectiveAllocatedMw,
        unallocatedMw,
        currentSplits: currentUsePeriods.length,
      },
      leaseDetails,
      remainingLeaseYears,
      factorDetails,
      combinedFactor,
      // NEW: Per-period valuation breakdown computed server-side
      periodValuations,
      totalValuation: isFinite(totalValuation) ? totalValuation : 0,
      valuation,
      globalFactors: {
        hpcCapRate: factors.hpcCapRate,
        hpcExitCapRate: factors.hpcExitCapRate,
        terminalGrowthRate: factors.terminalGrowthRate,
        discountRate: factors.discountRate,
        renewalProbability: factors.leaseRenewalProbability,
        sofrRate: factors.sofrRate,
        tcGoogle: factors.tcGoogle, tcMicrosoft: factors.tcMicrosoft, tcAmazon: factors.tcAmazon,
        tcMeta: factors.tcMeta, tcOracle: factors.tcOracle, tcCoreweave: factors.tcCoreweave,
        tcAnthropic: factors.tcAnthropic, tcOpenai: factors.tcOpenai, tcXai: factors.tcXai,
        tcOther: factors.tcOther, tcSelf: factors.tcSelf,
        nnnMult: factors.nnnMult, modifiedGrossMult: factors.modifiedGrossMult, grossMult: factors.grossMult,
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
      if (factors.capexPerMwOverride !== undefined) buildingUpdate.capexPerMwOverride = factors.capexPerMwOverride;
      if (factors.capexInFinancials !== undefined) buildingUpdate.capexInFinancials = factors.capexInFinancials;
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

httpServer.listen(PORT, async () => {
  console.log(`🚀 BTC Miner Valuation Terminal API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);

  // One-time data migration: add IREN Goldman/JPM term loan if not exists
  try {
    const existing = await prisma.debt.findFirst({
      where: { ticker: 'IREN', instrument: { contains: 'Goldman Sachs' } },
    });
    if (!existing) {
      await prisma.debt.create({
        data: {
          ticker: 'IREN',
          instrument: '$3.6B Goldman Sachs / JPMorgan Delayed-Draw Term Loan',
          debtType: 'Term Loan',
          issuer: 'Goldman Sachs / JPMorgan',
          principalM: 3600.00,
          originalM: 3600.00,
          maturity: new Date('2030-12-31'),
          couponPct: 0.0550,
          annualInterestM: 198.00,
          secured: true,
          collateral: 'GPU equipment + Microsoft contract cash flows',
          level: 'Project',
          linkedSite: 'Childress',
          convertible: false,
          status: 'Outstanding (delayed-draw)',
          confidence: 'MEDIUM',
        },
      });
      console.log('✅ Added IREN Goldman Sachs / JPMorgan term loan');
    }

    // Remove any saved dailyRevPerEh override so it derives from btcPrice
    await prisma.settings.deleteMany({ where: { key: 'dailyRevPerEh' } });

    // Add capexPerMwOverride columns if they don't exist
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE buildings ADD COLUMN IF NOT EXISTS "capexPerMwOverride" DECIMAL(12,2)`);
      await prisma.$executeRawUnsafe(`ALTER TABLE use_periods ADD COLUMN IF NOT EXISTS "capexPerMwOverride" DECIMAL(12,2)`);
      console.log('✅ Ensured capexPerMwOverride columns exist');
    } catch (e) {
      console.log('capexPerMwOverride columns may already exist:', (e as any).message);
    }

    // Add capexInFinancials boolean column
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE buildings ADD COLUMN IF NOT EXISTS "capexInFinancials" BOOLEAN NOT NULL DEFAULT false`);
      console.log('✅ Ensured capexInFinancials column exists');
    } catch (e) {
      console.log('capexInFinancials column may already exist:', (e as any).message);
    }
  } catch (e) {
    console.error('Migration error (non-fatal):', e);
  }
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
