/**
 * Excel Import Route
 * Handles uploading and parsing Excel files with Site → Campus → Building → UsePeriod hierarchy
 */

import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx files are allowed'));
    }
  },
});

// Map spreadsheet Current_Use to UseType enum
function mapUseType(currentUse: string | null): string {
  if (!currentUse) return 'UNCONTRACTED';
  const use = currentUse.toLowerCase().trim();

  // HPC/AI - check for hpc, ai (but not in "mining"), or "hyperscale"
  if (use.includes('hpc') || use === 'ai' || use.includes('hpc/ai') || use.includes('hyperscale')) {
    if (use.includes('planned')) return 'HPC_AI_PLANNED';
    return 'HPC_AI_HOSTING';
  }

  // GPU Cloud
  if (use.includes('gpu') || use.includes('cloud/ai')) return 'GPU_CLOUD';

  // BTC Mining
  if (use.includes('btc') || use.includes('bitcoin') || use.includes('mining') || use.includes('self-mining')) {
    if (use.includes('hosting')) return 'BTC_MINING_HOSTING';
    return 'BTC_MINING';
  }

  // Other types
  if (use.includes('colocation') || use.includes('colo')) return 'COLOCATION';
  if (use.includes('mixed')) return 'MIXED';
  if (use.includes('rofr')) return 'UNCONTRACTED_ROFR';
  if (use.includes('uncontracted')) return 'UNCONTRACTED';

  // Default fallback
  return 'UNCONTRACTED';
}

// Map spreadsheet Site_Phase to DevelopmentPhase enum
function mapDevelopmentPhase(sitePhase: string | null): string {
  if (!sitePhase) return 'DILIGENCE';
  const phase = sitePhase.toLowerCase();

  if (phase.includes('operational')) return 'OPERATIONAL';
  if (phase.includes('construction')) return 'CONSTRUCTION';
  if (phase.includes('development')) return 'DEVELOPMENT';
  if (phase.includes('exclusivity')) return 'EXCLUSIVITY';
  if (phase.includes('diligence')) return 'DILIGENCE';

  return 'DILIGENCE';
}

// Map confidence
function mapConfidence(conf: string | null): string {
  if (!conf) return 'MEDIUM';
  const c = conf.toLowerCase();
  if (c === 'high') return 'HIGH';
  if (c.includes('medium') && c.includes('high')) return 'MEDIUM_HIGH';
  if (c === 'medium') return 'MEDIUM';
  if (c === 'low') return 'LOW';
  return 'MEDIUM';
}

// Parse date helper
function parseDate(dateStr: unknown): Date | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;

  // Handle Excel serial dates
  if (typeof dateStr === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + dateStr * 24 * 60 * 60 * 1000);
  }

  // Handle string dates like "Jan-2022", "Oct-2025"
  const str = String(dateStr).trim();
  const monthYearMatch = str.match(/^([A-Za-z]+)-(\d{4})$/);
  if (monthYearMatch) {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const month = months[monthYearMatch[1].toLowerCase()];
    const year = parseInt(monthYearMatch[2]);
    if (month !== undefined && year) {
      return new Date(year, month, 1);
    }
  }

  // Try standard date parsing
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// Parse number helper
function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '' || val === 'NaN') return null;
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[,$]/g, ''));
  return isNaN(num) ? null : num;
}

// Clean column name (remove trailing spaces)
function cleanCol(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key];
    if (row[key + ' '] !== undefined) return row[key + ' '];
    if (row[key.trim()] !== undefined) return row[key.trim()];
  }
  return null;
}

// Helper to find sheet name case-insensitively
function findSheet(workbook: XLSX.WorkBook, ...names: string[]): string | null {
  for (const name of names) {
    // Exact match first
    if (workbook.SheetNames.includes(name)) return name;
    // Case-insensitive match
    const found = workbook.SheetNames.find(s => s.toLowerCase().trim() === name.toLowerCase().trim());
    if (found) return found;
  }
  return null;
}

// POST /api/v1/import/excel
router.post('/excel', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('Processing file:', req.file.originalname);
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    console.log('Available sheets:', workbook.SheetNames);

    const results: Record<string, number | string[]> = {
      sites: 0,
      campuses: 0,
      buildings: 0,
      usePeriods: 0,
      companies: 0,
      debts: 0,
      errors: [] as string[],
    };

    // Process Sites sheet
    const sitesSheetName = findSheet(workbook, 'Sites', 'Site', 'sites');
    if (sitesSheetName) {
      console.log('Processing Sites sheet:', sitesSheetName);
      const sitesSheet = workbook.Sheets[sitesSheetName];
      const sitesData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sitesSheet, { defval: null });

      // Skip header row if it contains column descriptions
      const rows = sitesData.filter((row) => {
        const ticker = cleanCol(row, 'Ticker');
        return ticker && !String(ticker).toLowerCase().includes('company ticker');
      });

      // Group by ticker to create companies
      const companiesByTicker = new Map<string, Record<string, unknown>[]>();
      for (const row of rows) {
        const ticker = String(cleanCol(row, 'Ticker') || '').trim();
        if (!ticker) continue;

        if (!companiesByTicker.has(ticker)) {
          companiesByTicker.set(ticker, []);
        }
        companiesByTicker.get(ticker)!.push(row);
      }

      // Process each company
      for (const [ticker, companyRows] of companiesByTicker) {
        // Upsert company
        await prisma.company.upsert({
          where: { ticker },
          update: { updatedAt: new Date() },
          create: { ticker, name: ticker },
        });
        (results.companies as number)++;

        // Group rows by Site_Name
        const siteGroups = new Map<string, Record<string, unknown>[]>();
        for (const row of companyRows) {
          const siteName = String(cleanCol(row, 'Site_Name') || '').trim();
          if (!siteName) continue;
          if (!siteGroups.has(siteName)) {
            siteGroups.set(siteName, []);
          }
          siteGroups.get(siteName)!.push(row);
        }

        // Create sites and their campuses/buildings
        for (const [siteName, siteRows] of siteGroups) {
          const firstRow = siteRows[0];
          const country = String(cleanCol(firstRow, 'Country') || 'USA').trim();
          const state = cleanCol(firstRow, 'State');
          const lat = parseNum(cleanCol(firstRow, 'Latitude'));
          const lng = parseNum(cleanCol(firstRow, 'Longitude'));

          // Upsert site
          const site = await prisma.site.upsert({
            where: { ticker_name: { ticker, name: siteName } },
            update: {
              country,
              state: state ? String(state).trim() : null,
              latitude: lat,
              longitude: lng,
            },
            create: {
              ticker,
              name: siteName,
              country,
              state: state ? String(state).trim() : null,
              latitude: lat,
              longitude: lng,
            },
          });
          (results.sites as number)++;

          // Group by Campus within this site
          const campusGroups = new Map<string, Record<string, unknown>[]>();
          for (const row of siteRows) {
            const campusName = String(cleanCol(row, 'Campus_Name') || siteName).trim();
            if (!campusGroups.has(campusName)) {
              campusGroups.set(campusName, []);
            }
            campusGroups.get(campusName)!.push(row);
          }

          // Create campuses and buildings
          for (const [campusName, campusRows] of campusGroups) {
            // Upsert campus
            const campus = await prisma.campus.upsert({
              where: { siteId_name: { siteId: site.id, name: campusName } },
              update: {},
              create: { siteId: site.id, name: campusName },
            });
            (results.campuses as number)++;

            // Each row in campusRows is a building
            for (const row of campusRows) {
              const buildingName = String(cleanCol(row, 'Building_Name') || 'Main').trim();
              const externalId = cleanCol(row, 'Site_ID');

              // Check if building exists
              let building = await prisma.building.findFirst({
                where: { campusId: campus.id, name: buildingName },
              });

              const buildingData = {
                name: buildingName,
                externalId: externalId ? String(externalId) : null,
                grossMw: parseNum(cleanCol(row, 'Gross_MW')),
                itMw: parseNum(cleanCol(row, 'IT_MW')),
                petaflops: parseNum(cleanCol(row, 'Petaflops')),
                pue: parseNum(cleanCol(row, 'PUE')),
                grid: cleanCol(row, 'Grid') ? String(cleanCol(row, 'Grid')) : null,
                ownershipStatus: cleanCol(row, 'Ownership Status') ? String(cleanCol(row, 'Ownership Status')) : null,
                developmentPhase: mapDevelopmentPhase(cleanCol(row, 'Site_Phase') as string | null) as any,
                energizationDate: parseDate(cleanCol(row, 'Energization_Date')),
                confidence: mapConfidence(cleanCol(row, 'Confidence') as string | null) as any,
                notes: cleanCol(row, 'Notes') ? String(cleanCol(row, 'Notes')) : null,
                sourceUrl: cleanCol(row, 'Source_URL') ? String(cleanCol(row, 'Source_URL')) : null,
                sourceDate: parseDate(cleanCol(row, 'Source_Date')),
              };

              if (building) {
                building = await prisma.building.update({
                  where: { id: building.id },
                  data: buildingData,
                });
              } else {
                building = await prisma.building.create({
                  data: { campusId: campus.id, ...buildingData },
                });
              }
              (results.buildings as number)++;

              // Create current use period
              const currentUse = cleanCol(row, 'Current_Use') as string | null;
              const useType = mapUseType(currentUse);
              const tenant = cleanCol(row, 'Lessee');

              // Delete existing current use periods for this building
              await prisma.usePeriod.deleteMany({
                where: { buildingId: building.id, isCurrent: true },
              });

              // Create new use period
              await prisma.usePeriod.create({
                data: {
                  buildingId: building.id,
                  useType: useType as any,
                  startDate: parseDate(cleanCol(row, 'Energization_Date')),
                  isCurrent: true,
                  tenant: tenant ? String(tenant).trim() : null,
                  leaseValueM: parseNum(cleanCol(row, 'Lease_Value_M')),
                  leaseYears: parseNum(cleanCol(row, 'Lease_Yrs')),
                  annualRevM: parseNum(cleanCol(row, 'Annual_Rev_M')),
                  noiPct: parseNum(cleanCol(row, 'NOI_Pct')),
                  noiAnnualM: parseNum(cleanCol(row, 'NOI_Annual_M')),
                  leaseStart: parseDate(cleanCol(row, 'Lease_Start')),
                  leaseNotes: cleanCol(row, 'Lease_Notes') ? String(cleanCol(row, 'Lease_Notes')) : null,
                  allocationMethod: cleanCol(row, 'Allocation_Method') ? String(cleanCol(row, 'Allocation_Method')) : null,
                },
              });
              (results.usePeriods as number)++;
            }
          }
        }
      }
    }

    // Process Net Liquid Assets sheet (company financials)
    const netLiquidSheetName = findSheet(workbook, 'Net Liquid Assets', 'Net_Liquid_Assets', 'NetLiquidAssets', 'Liquid Assets');
    if (netLiquidSheetName) {
      console.log('Processing Net Liquid Assets sheet:', netLiquidSheetName);
      const sheet = workbook.Sheets[netLiquidSheetName];
      const data: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null, range: 1 });

      for (const row of data) {
        const ticker = row['Ticker'];
        if (!ticker || String(ticker).toLowerCase().includes('company ticker')) continue;

        try {
          await prisma.company.update({
            where: { ticker: String(ticker).trim() },
            data: {
              cashM: parseNum(row['Cash_$M']),
              btcCount: parseNum(row['BTC_Count']),
              btcHoldings: parseNum(row['BTC_Value_$M']),
              ethHoldings: parseNum(row['ETH_Value_$M']),
              debtM: parseNum(row['Total_Debt_$M']),
              sourceDate: parseDate(row['Source_Date']),
            },
          });
        } catch (e) {
          // Company may not exist yet
        }
      }
    }

    // Process Mining Valuation sheet
    const miningSheetName = findSheet(workbook, 'Mining Valuation', 'Mining_Valuation', 'MiningValuation', 'Mining');
    if (miningSheetName) {
      console.log('Processing Mining Valuation sheet:', miningSheetName);
      const sheet = workbook.Sheets[miningSheetName];
      const data: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null, range: 1 });

      for (const row of data) {
        const ticker = row['Ticker'];
        if (!ticker || String(ticker).toLowerCase().includes('company ticker')) continue;

        try {
          await prisma.company.update({
            where: { ticker: String(ticker).trim() },
            data: {
              hashrateEh: parseNum(row['EH/s']),
              efficiencyJth: parseNum(row['Eff (J/TH)']),
              powerCostKwh: parseNum(row['Power ($/kWh)']),
            },
          });
        } catch (e) {
          // Company may not exist
        }
      }
    }

    // Process Debt sheet
    const debtSheetName = findSheet(workbook, 'Debt', 'Debts', 'debt');
    if (debtSheetName) {
      console.log('Processing Debt sheet:', debtSheetName);
      const sheet = workbook.Sheets[debtSheetName];
      const data: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

      for (const row of data) {
        const ticker = row['Ticker'];
        const instrument = row['Instrument'];
        if (!ticker || !instrument) continue;

        // Skip summary/total rows and header rows
        const tickerStr = String(ticker).toLowerCase().trim();
        if (tickerStr.includes('total') ||
            tickerStr.includes('company ticker') ||
            tickerStr.includes('sum') ||
            tickerStr === '' ||
            tickerStr.includes('header')) continue;

        try {
          // Check if company exists first
          const company = await prisma.company.findUnique({
            where: { ticker: String(ticker).trim() },
          });
          if (!company) {
            (results.errors as string[]).push(`Debt skipped: Company '${ticker}' not found`);
            continue;
          }

          const existingDebt = await prisma.debt.findFirst({
            where: {
              ticker: String(ticker).trim(),
              instrument: String(instrument).trim(),
            },
          });

          const debtData = {
            ticker: String(ticker).trim(),
            instrument: String(instrument).trim(),
            debtType: row['Type'] ? String(row['Type']) : null,
            issuer: row['Issuer'] ? String(row['Issuer']) : null,
            principalM: parseNum(row['Principal_$M']),
            originalM: parseNum(row['Original_$M']),
            maturity: parseDate(row['Maturity']),
            couponPct: parseNum(row['Coupon_%']),
            annualInterestM: parseNum(row['Ann_Interest_$M']),
            secured: row['Secured'] === 'Y' || row['Secured'] === true,
            collateral: row['Collateral'] ? String(row['Collateral']) : null,
            level: row['Level'] ? String(row['Level']) : null,
            linkedSite: row['Site_Name'] ? String(row['Site_Name']) : null,
            convertible: row['Convertible'] === 'Y' || row['Convertible'] === true,
            conversionPrice: parseNum(row['Conv_Price_$']),
            status: row['Status'] ? String(row['Status']) : null,
            confidence: mapConfidence(row['Confidence'] as string | null) as any,
            source: row['Source'] ? String(row['Source']) : null,
            sourceDate: parseDate(row['Source_Date']),
          };

          if (existingDebt) {
            await prisma.debt.update({
              where: { id: existingDebt.id },
              data: debtData,
            });
          } else {
            await prisma.debt.create({ data: debtData });
          }
          (results.debts as number)++;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          (results.errors as string[]).push(`Debt row error: ${msg}`);
        }
      }
    }

    // Check if any sheets were found
    const sheetsFound = [sitesSheetName, netLiquidSheetName, miningSheetName, debtSheetName].filter(Boolean);
    console.log('Sheets found:', sheetsFound);
    console.log('Import results:', results);

    if (sheetsFound.length === 0) {
      return res.status(400).json({
        error: 'No recognized sheets found',
        details: `Available sheets: ${workbook.SheetNames.join(', ')}. Expected: Sites, Net Liquid Assets, Mining Valuation, or Debt`,
      });
    }

    res.json({
      success: true,
      message: `Import completed. Processed sheets: ${sheetsFound.join(', ')}`,
      results,
    });
  } catch (error: unknown) {
    console.error('Import error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Import failed', details: msg });
  }
});

// DELETE /api/v1/import/clear - Clear all data
router.delete('/clear', async (req: Request, res: Response) => {
  try {
    // Delete in correct order due to foreign keys
    await prisma.usePeriod.deleteMany();
    await prisma.building.deleteMany();
    await prisma.campus.deleteMany();
    await prisma.siteFactor.deleteMany();
    await prisma.site.deleteMany();
    await prisma.debt.deleteMany();
    await prisma.companyFactor.deleteMany();
    await prisma.company.deleteMany();

    res.json({ success: true, message: 'All data cleared' });
  } catch (error: unknown) {
    console.error('Clear error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to clear data', details: msg });
  }
});

// GET /api/v1/import/template
router.get('/template', (req: Request, res: Response) => {
  res.json({
    sitesColumns: [
      'Site_ID', 'Ticker', 'Site_Name', 'Campus_Name', 'Building_Name',
      'Site_Phase', 'Country', 'State', 'Gross_MW', 'IT_MW', 'Petaflops',
      'PUE', 'Grid', 'Ownership Status', 'Current_Use', 'Energization_Date',
      'Lessee', 'Lease_Value_M', 'Lease_Yrs', 'Annual_Rev_M', 'NOI_Pct',
      'NOI_Annual_M', 'Lease_Start', 'Lease_Notes', 'Confidence', 'Notes',
      'Source_URL', 'Latitude', 'Longitude', 'Allocation_Method', 'Source_Date'
    ],
    debtColumns: [
      'Ticker', 'Instrument', 'Type', 'Issuer', 'Principal_$M', 'Original_$M',
      'Maturity', 'Coupon_%', 'Ann_Interest_$M', 'Secured', 'Collateral',
      'Level', 'Site_Name', 'Convertible', 'Conv_Price_$', 'Status',
      'Confidence', 'Source', 'Source_Date'
    ],
    netLiquidColumns: [
      'Ticker', 'Cash_$M', 'BTC_Count', 'BTC_Value_$M', 'ETH_Count',
      'ETH_Value_$M', 'Total_Liquid_$M', 'Total_Debt_$M', 'Net_Liquid_$M',
      'Source_Date', 'Notes'
    ],
  });
});

export default router;
