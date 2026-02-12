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
  const phase = sitePhase.toLowerCase().trim();

  // Operational - check various terms
  if (phase.includes('operational') || phase === 'ops' || phase === 'op' ||
      phase.includes('live') || phase.includes('running') || phase.includes('active') ||
      phase === 'complete' || phase === 'completed' || phase.includes('energized')) {
    return 'OPERATIONAL';
  }

  // Construction - check various terms
  if (phase.includes('construction') || phase.includes('building') ||
      phase.includes('under const') || phase === 'uc' || phase.includes('build out') ||
      phase.includes('buildout')) {
    return 'CONSTRUCTION';
  }

  // Development - check various terms
  if (phase.includes('development') || phase === 'dev' || phase.includes('in dev') ||
      phase.includes('pre-construction') || phase.includes('preconstruction') ||
      phase.includes('planning') || phase.includes('planned') || phase.includes('permitting')) {
    return 'DEVELOPMENT';
  }

  // Exclusivity
  if (phase.includes('exclusivity') || phase.includes('exclusive') || phase === 'excl' ||
      phase.includes('loi') || phase.includes('letter of intent')) {
    return 'EXCLUSIVITY';
  }

  // Diligence
  if (phase.includes('diligence') || phase.includes('dd') || phase.includes('due dil') ||
      phase.includes('evaluation') || phase.includes('evaluating') || phase.includes('prospect')) {
    return 'DILIGENCE';
  }

  return 'DILIGENCE';
}

// Map confidence
function mapConfidence(conf: string | null): string {
  if (!conf) return 'MEDIUM';
  const c = String(conf).toLowerCase().trim();

  // High confidence - various terms
  if (c === 'high' || c === 'h' || c === 'hi' ||
      c.includes('confirmed') || c.includes('certain') || c.includes('definite') ||
      c === '1' || c === '100%' || c === '100' || c === '90%' || c === '95%') {
    return 'HIGH';
  }

  // Medium-High
  if (c.includes('medium') && c.includes('high') || c === 'mh' || c === 'm-h' ||
      c === '80%' || c === '85%' || c.includes('likely')) {
    return 'MEDIUM_HIGH';
  }

  // Medium confidence
  if (c === 'medium' || c === 'm' || c === 'med' || c === 'moderate' ||
      c === '50%' || c === '60%' || c === '70%' || c.includes('probable')) {
    return 'MEDIUM';
  }

  // Low confidence
  if (c === 'low' || c === 'l' || c === 'lo' ||
      c.includes('uncertain') || c.includes('speculative') || c.includes('unlikely') ||
      c === '0' || c === '10%' || c === '20%' || c === '30%' || c === '40%') {
    return 'LOW';
  }

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

  const str = String(dateStr).trim();
  if (!str || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'tbd') return null;

  const months: Record<string, number> = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11
  };

  // Handle "Jan-2022", "Oct-2025", "Jan 2022", "January 2022", "January-2022"
  const monthYearMatch = str.match(/^([A-Za-z]+)[\s\-\/]?(\d{4})$/);
  if (monthYearMatch) {
    const month = months[monthYearMatch[1].toLowerCase()];
    const year = parseInt(monthYearMatch[2]);
    if (month !== undefined && year) {
      return new Date(year, month, 1);
    }
  }

  // Handle "01/2022", "1/2022", "01-2022", "1-2022" (month/year)
  const mmYearMatch = str.match(/^(\d{1,2})[\-\/](\d{4})$/);
  if (mmYearMatch) {
    const month = parseInt(mmYearMatch[1]) - 1; // 0-indexed
    const year = parseInt(mmYearMatch[2]);
    if (month >= 0 && month <= 11 && year) {
      return new Date(year, month, 1);
    }
  }

  // Handle "2022-01" (ISO year-month format)
  const isoYearMonthMatch = str.match(/^(\d{4})[\-\/](\d{1,2})$/);
  if (isoYearMonthMatch) {
    const year = parseInt(isoYearMonthMatch[1]);
    const month = parseInt(isoYearMonthMatch[2]) - 1;
    if (month >= 0 && month <= 11 && year) {
      return new Date(year, month, 1);
    }
  }

  // Handle quarterly: "Q1 2022", "1Q22", "Q1-2022", "1Q 2022", "Q1'22"
  const quarterMatch = str.match(/^Q?(\d)[Q']?\s*[\-']?(\d{2,4})$/i) ||
                       str.match(/^(\d)Q[\s\-']?(\d{2,4})$/i);
  if (quarterMatch) {
    const quarter = parseInt(quarterMatch[1]);
    let year = parseInt(quarterMatch[2]);
    if (year < 100) year += 2000; // Convert 22 to 2022
    if (quarter >= 1 && quarter <= 4 && year) {
      const month = (quarter - 1) * 3; // Q1=Jan, Q2=Apr, Q3=Jul, Q4=Oct
      return new Date(year, month, 1);
    }
  }

  // Handle "2025" (year only)
  const yearOnlyMatch = str.match(/^(\d{4})$/);
  if (yearOnlyMatch) {
    const year = parseInt(yearOnlyMatch[1]);
    if (year >= 1990 && year <= 2100) {
      return new Date(year, 0, 1); // January 1st of that year
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

// Parse boolean helper - flexible matching
function parseBool(val: unknown): boolean {
  if (val === true || val === 1) return true;
  if (!val) return false;
  const str = String(val).toLowerCase().trim();
  return str === 'y' || str === 'yes' || str === 'true' || str === '1' ||
         str === 'x' || str === 'checked' || str === 'on';
}

// Normalize grid/power authority for consistent matching
function normalizeGrid(grid: string | null): string | null {
  if (!grid) return null;
  const g = String(grid).toUpperCase().trim();

  // Known power authorities - normalize to standard names
  const gridMap: Record<string, string> = {
    'ERCOT': 'ERCOT',
    'PJM': 'PJM',
    'MISO': 'MISO',
    'CAISO': 'CAISO',
    'CAL-ISO': 'CAISO',
    'CALIFORNIA ISO': 'CAISO',
    'SPP': 'SPP',
    'SOUTHWEST POWER POOL': 'SPP',
    'NYISO': 'NYISO',
    'NEW YORK ISO': 'NYISO',
    'ISO-NE': 'ISO_NE',
    'ISONE': 'ISO_NE',
    'ISO NE': 'ISO_NE',
    'NEW ENGLAND': 'ISO_NE',
    'SERC': 'SERC',
    'WECC': 'WECC',
    'WESTERN': 'WECC',
    'AESO': 'AESO',
    'ALBERTA': 'AESO',
    'IESO': 'IESO',
    'ONTARIO': 'IESO',
    'BC HYDRO': 'BC_HYDRO',
    'BCHYDRO': 'BC_HYDRO',
    'HYDRO QUEBEC': 'HYDRO_QUEBEC',
    'HQ': 'HYDRO_QUEBEC',
    'CFE': 'CFE',
    'MEXICO': 'CFE',
    'NORDIC': 'NORDIC',
    'NORDPOOL': 'NORDIC',
    'OTHER': 'OTHER',
  };

  // Handle N/A and TBD as null
  if (g === 'N/A' || g === 'TBD') return null;

  // Check for exact match
  if (gridMap[g] !== undefined) return gridMap[g];

  // Check for partial match
  for (const [key, value] of Object.entries(gridMap)) {
    if (g.includes(key) || key.includes(g)) {
      return value;
    }
  }

  // Return as-is if no match found
  return g;
}

// Normalize column name for matching (lowercase, remove spaces/underscores/dashes)
function normalizeColName(name: string): string {
  return name.toLowerCase().replace(/[\s_\-\.]+/g, '').trim();
}

// Clean column name - flexible matching (case-insensitive, different separators)
function cleanCol(row: Record<string, unknown>, ...keys: string[]): unknown {
  // Build a map of normalized row keys to actual keys
  const rowKeys = Object.keys(row);
  const normalizedMap = new Map<string, string>();
  for (const k of rowKeys) {
    normalizedMap.set(normalizeColName(k), k);
  }

  // Try each provided key
  for (const key of keys) {
    // Direct match first
    if (row[key] !== undefined) return row[key];
    if (row[key + ' '] !== undefined) return row[key + ' '];
    if (row[key.trim()] !== undefined) return row[key.trim()];

    // Normalized match
    const normalizedKey = normalizeColName(key);
    const matchedKey = normalizedMap.get(normalizedKey);
    if (matchedKey && row[matchedKey] !== undefined) {
      return row[matchedKey];
    }
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
        const ticker = cleanCol(row, 'Ticker', 'Symbol', 'Company');
        return ticker && !String(ticker).toLowerCase().includes('company ticker');
      });

      // Group by ticker to create companies
      const companiesByTicker = new Map<string, Record<string, unknown>[]>();
      for (const row of rows) {
        const ticker = String(cleanCol(row, 'Ticker', 'Symbol', 'Company') || '').trim();
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
          const siteName = String(cleanCol(row, 'Site_Name', 'SiteName', 'Site', 'Location', 'Project') || '').trim();
          if (!siteName) continue;
          if (!siteGroups.has(siteName)) {
            siteGroups.set(siteName, []);
          }
          siteGroups.get(siteName)!.push(row);
        }

        // Create sites and their campuses/buildings
        for (const [siteName, siteRows] of siteGroups) {
          const firstRow = siteRows[0];
          const country = String(cleanCol(firstRow, 'Country', 'Nation', 'Region') || 'USA').trim();
          const state = cleanCol(firstRow, 'State', 'Province', 'St');
          const lat = parseNum(cleanCol(firstRow, 'Latitude', 'Lat', 'Y'));
          const lng = parseNum(cleanCol(firstRow, 'Longitude', 'Long', 'Lng', 'X'));

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
            const campusName = String(cleanCol(row, 'Campus_Name', 'CampusName', 'Campus', 'Phase', 'Area') || siteName).trim();
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
              const buildingName = String(cleanCol(row, 'Building_Name', 'BuildingName', 'Building', 'Unit', 'Facility') || 'Main').trim();
              const externalId = cleanCol(row, 'Site_ID', 'SiteID', 'ID', 'External_ID', 'Ref');

              // Check if building exists
              let building = await prisma.building.findFirst({
                where: { campusId: campus.id, name: buildingName },
              });

              const buildingData = {
                name: buildingName,
                externalId: externalId ? String(externalId) : null,
                grossMw: parseNum(cleanCol(row, 'Gross_MW', 'GrossMW', 'Gross MW', 'MW')),
                itMw: parseNum(cleanCol(row, 'IT_MW', 'ITMW', 'IT MW', 'IT_Power')),
                petaflops: parseNum(cleanCol(row, 'Petaflops', 'PF', 'PFLOPS')),
                pue: parseNum(cleanCol(row, 'PUE', 'Power_Usage_Effectiveness')),
                grid: normalizeGrid(cleanCol(row, 'Grid', 'Power_Authority', 'ISO', 'RTO') as string | null),
                ownershipStatus: cleanCol(row, 'Ownership Status', 'Ownership_Status', 'OwnershipStatus', 'Ownership') ? String(cleanCol(row, 'Ownership Status', 'Ownership_Status', 'OwnershipStatus', 'Ownership')) : null,
                developmentPhase: mapDevelopmentPhase(cleanCol(row, 'Site_Phase', 'SitePhase', 'Phase', 'Development_Phase', 'Status') as string | null) as any,
                energizationDate: parseDate(cleanCol(row, 'Energization_Date', 'EnergizationDate', 'Energization', 'COD', 'Commercial_Operation_Date')),
                confidence: mapConfidence(cleanCol(row, 'Confidence', 'Conf', 'Certainty') as string | null) as any,
                notes: cleanCol(row, 'Notes', 'Note', 'Comments', 'Comment') ? String(cleanCol(row, 'Notes', 'Note', 'Comments', 'Comment')) : null,
                sourceUrl: cleanCol(row, 'Source_URL', 'SourceURL', 'Source', 'URL') ? String(cleanCol(row, 'Source_URL', 'SourceURL', 'Source', 'URL')) : null,
                sourceDate: parseDate(cleanCol(row, 'Source_Date', 'SourceDate')),
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
              const currentUse = cleanCol(row, 'Current_Use', 'CurrentUse', 'Use', 'Use_Type', 'UseType') as string | null;
              const useType = mapUseType(currentUse);
              const tenant = cleanCol(row, 'Lessee', 'Tenant', 'Customer', 'Client', 'Counterparty');

              // Delete existing current use periods for this building
              await prisma.usePeriod.deleteMany({
                where: { buildingId: building.id, isCurrent: true },
              });

              // Create new use period
              await prisma.usePeriod.create({
                data: {
                  buildingId: building.id,
                  useType: useType as any,
                  startDate: parseDate(cleanCol(row, 'Energization_Date', 'EnergizationDate', 'Start_Date', 'COD')),
                  isCurrent: true,
                  tenant: tenant ? String(tenant).trim() : null,
                  leaseValueM: parseNum(cleanCol(row, 'Lease_Value_M', 'LeaseValue', 'Lease_Value', 'Contract_Value')),
                  leaseYears: parseNum(cleanCol(row, 'Lease_Yrs', 'Lease_Years', 'LeaseYears', 'Term', 'Contract_Term')),
                  annualRevM: parseNum(cleanCol(row, 'Annual_Rev_M', 'AnnualRev', 'Annual_Revenue', 'Revenue_$M')),
                  noiPct: parseNum(cleanCol(row, 'NOI_Pct', 'NOI_%', 'NOI_Percent', 'Margin')),
                  noiAnnualM: parseNum(cleanCol(row, 'NOI_Annual_M', 'NOI_$M', 'Annual_NOI')),
                  leaseStart: parseDate(cleanCol(row, 'Lease_Start', 'LeaseStart', 'Contract_Start')),
                  leaseNotes: cleanCol(row, 'Lease_Notes', 'LeaseNotes', 'Contract_Notes') ? String(cleanCol(row, 'Lease_Notes', 'LeaseNotes', 'Contract_Notes')) : null,
                  allocationMethod: cleanCol(row, 'Allocation_Method', 'AllocationMethod', 'Allocation') ? String(cleanCol(row, 'Allocation_Method', 'AllocationMethod', 'Allocation')) : null,
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
        const ticker = cleanCol(row, 'Ticker', 'Symbol');
        if (!ticker || String(ticker).toLowerCase().includes('company ticker')) continue;

        try {
          await prisma.company.update({
            where: { ticker: String(ticker).trim() },
            data: {
              cashM: parseNum(cleanCol(row, 'Cash_$M', 'Cash', 'Cash_M', 'CashM')),
              btcCount: parseNum(cleanCol(row, 'BTC_Count', 'BTCCount', 'BTC', 'Bitcoin_Count')),
              btcHoldings: parseNum(cleanCol(row, 'BTC_Value_$M', 'BTCValue', 'BTC_Value', 'Bitcoin_Value')),
              ethHoldings: parseNum(cleanCol(row, 'ETH_Value_$M', 'ETHValue', 'ETH_Value', 'Ethereum_Value')),
              debtM: parseNum(cleanCol(row, 'Total_Debt_$M', 'TotalDebt', 'Debt', 'Debt_$M')),
              sourceDate: parseDate(cleanCol(row, 'Source_Date', 'SourceDate', 'Date')),
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
        const ticker = cleanCol(row, 'Ticker', 'Symbol');
        if (!ticker || String(ticker).toLowerCase().includes('company ticker')) continue;

        try {
          await prisma.company.update({
            where: { ticker: String(ticker).trim() },
            data: {
              hashrateEh: parseNum(cleanCol(row, 'EH/s', 'Hashrate', 'HashRate', 'EH', 'Hashrate_EH')),
              efficiencyJth: parseNum(cleanCol(row, 'Eff (J/TH)', 'Efficiency', 'J/TH', 'Eff', 'Efficiency_JTH')),
              powerCostKwh: parseNum(cleanCol(row, 'Power ($/kWh)', 'Power_Cost', 'PowerCost', '$/kWh', 'Power_$/kWh')),
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
        const ticker = cleanCol(row, 'Ticker', 'Symbol');
        const instrument = cleanCol(row, 'Instrument', 'Name', 'Debt_Name', 'Description');
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
            debtType: cleanCol(row, 'Type', 'Debt_Type', 'DebtType') ? String(cleanCol(row, 'Type', 'Debt_Type', 'DebtType')) : null,
            issuer: cleanCol(row, 'Issuer', 'Lender') ? String(cleanCol(row, 'Issuer', 'Lender')) : null,
            principalM: parseNum(cleanCol(row, 'Principal_$M', 'Principal', 'Principal_M', 'Amount_$M')),
            originalM: parseNum(cleanCol(row, 'Original_$M', 'Original', 'Original_M')),
            maturity: parseDate(cleanCol(row, 'Maturity', 'Maturity_Date', 'MaturityDate')),
            couponPct: parseNum(cleanCol(row, 'Coupon_%', 'Coupon', 'Rate', 'Interest_Rate', 'Rate_%')),
            annualInterestM: parseNum(cleanCol(row, 'Ann_Interest_$M', 'Annual_Interest', 'Interest_$M')),
            secured: parseBool(cleanCol(row, 'Secured', 'Is_Secured')),
            collateral: cleanCol(row, 'Collateral', 'Security') ? String(cleanCol(row, 'Collateral', 'Security')) : null,
            level: cleanCol(row, 'Level', 'Seniority', 'Priority') ? String(cleanCol(row, 'Level', 'Seniority', 'Priority')) : null,
            linkedSite: cleanCol(row, 'Site_Name', 'SiteName', 'Linked_Site') ? String(cleanCol(row, 'Site_Name', 'SiteName', 'Linked_Site')) : null,
            convertible: parseBool(cleanCol(row, 'Convertible', 'Is_Convertible', 'Conv')),
            conversionPrice: parseNum(cleanCol(row, 'Conv_Price_$', 'Conversion_Price', 'ConvPrice')),
            status: cleanCol(row, 'Status', 'Debt_Status') ? String(cleanCol(row, 'Status', 'Debt_Status')) : null,
            confidence: mapConfidence(cleanCol(row, 'Confidence', 'Conf') as string | null) as any,
            source: cleanCol(row, 'Source', 'Source_URL') ? String(cleanCol(row, 'Source', 'Source_URL')) : null,
            sourceDate: parseDate(cleanCol(row, 'Source_Date', 'SourceDate')),
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
