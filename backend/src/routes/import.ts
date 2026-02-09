/**
 * Excel Import Route
 * Handles uploading and parsing Excel files to populate the database
 */

import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import * as XLSX from 'xlsx';
import { PrismaClient, OwnershipStatus, PhaseStatus, UseType } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx files are allowed'));
    }
  },
});

// Helper: Parse date from various formats
function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    // Excel serial date
    return new Date((value - 25569) * 86400 * 1000);
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

// Helper: Parse number safely
function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(String(value));
  return isNaN(num) ? null : num;
}

// Helper: Map status string to enum
function mapStatus(status: string | null): PhaseStatus {
  if (!status) return PhaseStatus.PIPELINE;
  const normalized = status.toUpperCase().replace(/[\s-]/g, '_');
  const statusMap: Record<string, PhaseStatus> = {
    'OPERATIONAL': PhaseStatus.OPERATIONAL,
    'OPERATING': PhaseStatus.OPERATIONAL,
    'ONLINE': PhaseStatus.OPERATIONAL,
    'PARTIALLY_ONLINE': PhaseStatus.PARTIALLY_ONLINE,
    'PARTIAL': PhaseStatus.PARTIALLY_ONLINE,
    'UNDER_CONSTRUCTION': PhaseStatus.UNDER_CONSTRUCTION,
    'CONSTRUCTION': PhaseStatus.UNDER_CONSTRUCTION,
    'CONTRACTED': PhaseStatus.CONTRACTED,
    'PIPELINE': PhaseStatus.PIPELINE,
    'OPTION': PhaseStatus.OPTION,
    'DISCUSSION': PhaseStatus.DISCUSSION,
  };
  return statusMap[normalized] || PhaseStatus.PIPELINE;
}

// Helper: Map use type
function mapUseType(use: string | null): UseType {
  if (!use) return UseType.BTC_MINING;
  const normalized = use.toUpperCase().replace(/[\s-]/g, '_');
  if (normalized.includes('HPC') || normalized.includes('AI') || normalized.includes('GPU')) {
    return UseType.HPC_LEASE;
  }
  if (normalized.includes('COLO')) {
    return UseType.COLOCATION;
  }
  return UseType.BTC_MINING;
}

// Helper: Map ownership status
function mapOwnershipStatus(status: string | null): OwnershipStatus {
  if (!status) return OwnershipStatus.OWNED;
  const normalized = status.toUpperCase();
  if (normalized.includes('LONG') && normalized.includes('LEASE')) {
    return OwnershipStatus.LONG_TERM_LEASE;
  }
  if (normalized.includes('LEASE') || normalized.includes('SHORT')) {
    return OwnershipStatus.SHORT_TERM_LEASE;
  }
  return OwnershipStatus.OWNED;
}

// POST /api/v1/import/excel
router.post('/excel', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });

    const results = {
      companies: 0,
      sites: 0,
      phases: 0,
      tenancies: 0,
      factors: 0,
      errors: [] as string[],
    };

    // Process "Project List V9" or similar sheet (main data)
    const projectSheetName = workbook.SheetNames.find(name =>
      name.toLowerCase().includes('project') || name.toLowerCase().includes('list')
    );

    if (projectSheetName) {
      const sheet = workbook.Sheets[projectSheetName];
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

      // Group rows by ticker to create companies
      const companiesMap = new Map<string, Record<string, unknown>[]>();

      for (const row of rows) {
        const ticker = (row['Ticker'] || row['ticker'] || row['TICKER']) as string | undefined;
        if (!ticker) continue;

        if (!companiesMap.has(ticker)) {
          companiesMap.set(ticker, []);
        }
        companiesMap.get(ticker)!.push(row);
      }

      // Process each company
      for (const [ticker, companyRows] of companiesMap) {
        try {
          // Upsert company
          const firstRow = companyRows[0];
          const company = await prisma.company.upsert({
            where: { ticker },
            update: {
              name: (firstRow['Company'] || firstRow['company_name'] || ticker) as string,
              updatedAt: new Date(),
            },
            create: {
              ticker,
              name: (firstRow['Company'] || firstRow['company_name'] || ticker) as string,
            },
          });
          results.companies++;

          // Group by site
          const sitesMap = new Map<string, Record<string, unknown>[]>();
          for (const row of companyRows) {
            const siteName = (row['Site_Name'] || row['Site'] || row['site_name'] || 'Unknown Site') as string;
            if (!sitesMap.has(siteName)) {
              sitesMap.set(siteName, []);
            }
            sitesMap.get(siteName)!.push(row);
          }

          // Process each site
          for (const [siteName, siteRows] of sitesMap) {
            const firstSiteRow = siteRows[0];

            // Create or update site
            let site = await prisma.site.findFirst({
              where: { ticker, name: siteName },
            });

            if (!site) {
              site = await prisma.site.create({
                data: {
                  ticker,
                  name: siteName,
                  country: (firstSiteRow['Country'] as string) || 'USA',
                  state: (firstSiteRow['State'] || firstSiteRow['Location']) as string | undefined,
                  latitude: parseNumber(firstSiteRow['Latitude'] || firstSiteRow['lat']),
                  longitude: parseNumber(firstSiteRow['Longitude'] || firstSiteRow['lng'] || firstSiteRow['long']),
                  powerAuthority: (firstSiteRow['Power_Authority'] || firstSiteRow['Utility']) as string | undefined,
                  grid: (firstSiteRow['Grid'] || firstSiteRow['ISO']) as string | undefined,
                  ownershipStatus: mapOwnershipStatus(firstSiteRow['Ownership'] as string | null),
                  includeInValuation: true,
                  confidence: 'MEDIUM',
                },
              });
              results.sites++;
            }

            // Process phases (each row can be a phase)
            for (const row of siteRows) {
              const phaseName = (row['Site_Phase'] || row['Phase'] || row['phase_name'] || 'Phase 1') as string;

              // Check if phase exists
              let phase = await prisma.phase.findFirst({
                where: { siteId: site.id, name: phaseName },
              });

              if (!phase) {
                phase = await prisma.phase.create({
                  data: {
                    siteId: site.id,
                    name: phaseName,
                    status: mapStatus((row['Status'] || row['status']) as string | null),
                    grossMw: parseNumber(row['Gross_MW'] || row['Phase_MW']),
                    itMw: parseNumber(row['IT_MW'] || row['IT MW']),
                    pue: parseNumber(row['PUE']) || 1.25,
                    energizationDate: parseDate(row['Energization_Date'] || row['Energization'] || row['COD']),
                    energizationActual: row['Energization_Actual'] === true || row['Energization_Actual'] === 'Yes',
                    currentUse: mapUseType((row['Current_Use'] || row['Use']) as string | null),
                  },
                });
                results.phases++;
              }

              // Create tenancy if mining or lease data present
              const hasMiningData = row['Mining_Power_Cost'] || row['Power_Cost_kWh'] || row['Efficiency_JTH'];
              const hasLeaseData = row['Lessee'] || row['Lease_Value_M'] || row['Annual_Revenue_M'];

              if (hasMiningData || hasLeaseData) {
                const useType = mapUseType((row['Current_Use'] || row['Use']) as string | null);

                await prisma.tenancy.create({
                  data: {
                    phaseId: phase.id,
                    tenant: (row['Lessee'] || row['Tenant'] || `${ticker} (self)`) as string,
                    useType,
                    // Mining fields
                    miningPowerCostKwh: parseNumber(row['Mining_Power_Cost'] || row['Power_Cost_kWh']),
                    miningCurtailmentPct: parseNumber(row['Curtailment_Pct'] || row['Curtailment']) ?
                      parseNumber(row['Curtailment_Pct'] || row['Curtailment'])! / 100 : 0.05,
                    miningNonpowerOpexMwMo: parseNumber(row['Nonpower_OpEx'] || row['OpEx_MW_Mo']),
                    miningEfficiencyJth: parseNumber(row['Efficiency_JTH'] || row['J_TH']),
                    // Lease fields
                    leaseValueM: parseNumber(row['Lease_Value_M']),
                    leaseYears: parseNumber(row['Lease_Years']),
                    annualRevenueM: parseNumber(row['Annual_Revenue_M']),
                    noiPct: parseNumber(row['NOI_Pct']) ? parseNumber(row['NOI_Pct'])! / 100 : null,
                    hpcConvProb: parseNumber(row['HPC_Conv_Prob']) ? parseNumber(row['HPC_Conv_Prob'])! / 100 : 1.0,
                    fidoodle: parseNumber(row['Fidoodle']) || 1.0,
                  },
                });
                results.tenancies++;
              }
            }
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          results.errors.push(`Error processing ${ticker}: ${message}`);
        }
      }
    } else {
      results.errors.push('No project list sheet found in Excel file');
    }

    // Process "Factors" sheet if present
    const factorsSheetName = workbook.SheetNames.find(name =>
      name.toLowerCase().includes('factor')
    );

    if (factorsSheetName) {
      const sheet = workbook.Sheets[factorsSheetName];
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

      for (const row of rows) {
        const key = (row['Factor'] || row['Key'] || row['Name']) as string | undefined;
        const value = parseNumber(row['Value']);
        const category = (row['Category'] as string) || 'valuation';

        if (key && value !== null) {
          await prisma.globalFactor.upsert({
            where: {
              category_key: { category, key: key.toLowerCase().replace(/\s+/g, '_') }
            },
            update: { value },
            create: {
              category,
              key: key.toLowerCase().replace(/\s+/g, '_'),
              value,
              description: (row['Description'] as string) || null,
            },
          });
          results.factors++;
        }
      }
    }

    // Process "HODL Value" sheet if present (company BTC holdings)
    const hodlSheetName = workbook.SheetNames.find(name =>
      name.toLowerCase().includes('hodl')
    );

    if (hodlSheetName) {
      const sheet = workbook.Sheets[hodlSheetName];
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

      for (const row of rows) {
        const ticker = (row['Ticker'] || row['ticker']) as string | undefined;
        const btcHoldings = parseNumber(row['BTC'] || row['BTC_Holdings'] || row['Bitcoin']);

        if (ticker && btcHoldings !== null) {
          await prisma.company.updateMany({
            where: { ticker },
            data: { btcHoldings },
          });
        }
      }
    }

    res.json({
      success: true,
      message: 'Import completed',
      results,
    });

  } catch (error: unknown) {
    console.error('Import error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: 'Import failed',
      message
    });
  }
});

// GET /api/v1/import/template
// Returns expected column names for import
router.get('/template', (req: Request, res: Response) => {
  res.json({
    projectListColumns: [
      'Ticker', 'Company', 'Site_Name', 'Site_Phase', 'Status',
      'Gross_MW', 'IT_MW', 'PUE', 'Energization_Date', 'Energization_Actual',
      'Current_Use', 'Country', 'State', 'Latitude', 'Longitude',
      'Power_Authority', 'Grid', 'Ownership',
      'Mining_Power_Cost', 'Curtailment_Pct', 'Nonpower_OpEx', 'Efficiency_JTH',
      'Lessee', 'Lease_Value_M', 'Lease_Years', 'Annual_Revenue_M', 'NOI_Pct',
      'HPC_Conv_Prob', 'Fidoodle'
    ],
    factorsColumns: ['Category', 'Key', 'Value', 'Description'],
    hodlColumns: ['Ticker', 'BTC_Holdings'],
  });
});

export default router;
