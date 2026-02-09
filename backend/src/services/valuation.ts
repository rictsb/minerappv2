/**
 * Valuation Engine - Core calculations for SOTP valuation
 * Implements PRD Section 6: Valuation Engine
 */

import { Decimal } from '@prisma/client/runtime/library';

// Type definitions
interface GlobalFactors {
  btcPrice: number;
  networkHashrateEh: number;
  blockSubsidy: number;
  sofrRate: number;
  investmentGradeCreditSpread: number;
  highYieldCreditSpread: number;
  datacenterCapRate: number;
  hpcRevenueMultiple: number;
  defaultPue: number;
  defaultCurtailmentPct: number;
  defaultNonpowerOpexMwMo: number;
  energizationBaseYear: number;
  energizationDecayRate: number;
}

interface MiningTenancy {
  itMw: number;
  pue: number;
  powerCostKwh: number;
  curtailmentPct: number;
  nonpowerOpexMwMo: number;
  efficiencyJth: number;
}

interface HPCTenancy {
  itMw: number;
  leaseValueM?: number;
  leaseYears?: number;
  annualRevenueM?: number;
  noiPct?: number;
  hpcConvProb: number;
  fidoodle: number;
}

// ===========================================
// BTC MINING CALCULATIONS
// ===========================================

/**
 * Calculate annual BTC mined based on site specs and network conditions
 * Formula: (IT_MW × 1000 × (1 - curtailment) × 24 × 365) / (efficiency × network_hashrate × 1e18) × block_subsidy × 6 × 24 × 365
 */
export function calculateAnnualBtcMined(
  tenancy: MiningTenancy,
  factors: GlobalFactors
): number {
  const { itMw, pue, curtailmentPct, efficiencyJth } = tenancy;
  const { networkHashrateEh, blockSubsidy } = factors;

  // Convert IT MW to hashrate (TH/s)
  // Power (MW) × 1000 (kW/MW) × 1000 (W/kW) / efficiency (J/TH) = TH/s
  const hashrateThs = (itMw * 1e6) / efficiencyJth;

  // Effective hashrate after curtailment
  const effectiveHashrateThs = hashrateThs * (1 - curtailmentPct);

  // Network hashrate in TH/s
  const networkHashrateThs = networkHashrateEh * 1e6;

  // Share of network hashrate
  const networkShare = effectiveHashrateThs / networkHashrateThs;

  // Annual blocks ≈ 6 × 24 × 365 = 52,560
  const annualBlocks = 6 * 24 * 365;

  // Annual BTC mined
  return networkShare * blockSubsidy * annualBlocks;
}

/**
 * Calculate annual mining revenue
 */
export function calculateMiningRevenueAnnualM(
  annualBtcMined: number,
  btcPrice: number
): number {
  return (annualBtcMined * btcPrice) / 1e6;
}

/**
 * Calculate annual power cost
 * Formula: IT_MW × PUE × (1 - curtailment) × 24 × 365 × 1000 × power_cost_kwh / 1e6
 */
export function calculatePowerCostAnnualM(
  tenancy: MiningTenancy
): number {
  const { itMw, pue, powerCostKwh, curtailmentPct } = tenancy;

  // Annual MWh consumed (after PUE and curtailment)
  const annualMwh = itMw * pue * (1 - curtailmentPct) * 24 * 365;

  // Convert to kWh and calculate cost
  return (annualMwh * 1000 * powerCostKwh) / 1e6;
}

/**
 * Calculate annual non-power OpEx
 * Formula: IT_MW × 12 × nonpower_opex_mw_mo / 1e6
 */
export function calculateNonpowerOpexAnnualM(
  itMw: number,
  nonpowerOpexMwMo: number
): number {
  return (itMw * 12 * nonpowerOpexMwMo) / 1e6;
}

/**
 * Calculate mining EBITDA
 */
export function calculateMiningEbitdaAnnualM(
  revenueM: number,
  powerCostM: number,
  nonpowerOpexM: number
): number {
  return revenueM - powerCostM - nonpowerOpexM;
}

// ===========================================
// HPC/LEASE CALCULATIONS
// ===========================================

/**
 * Calculate HPC lease NOI
 * If noiPct provided: annualRevenueM × noiPct
 * If leaseValueM/leaseYears provided: leaseValueM / leaseYears × implied_noi_pct
 */
export function calculateHpcNoiAnnualM(
  tenancy: HPCTenancy
): number {
  if (tenancy.annualRevenueM && tenancy.noiPct) {
    return tenancy.annualRevenueM * tenancy.noiPct;
  }
  if (tenancy.leaseValueM && tenancy.leaseYears) {
    // Default NOI margin of 60% for triple-net leases
    const impliedNoiPct = 0.6;
    return (tenancy.leaseValueM / tenancy.leaseYears) * impliedNoiPct;
  }
  return 0;
}

/**
 * Calculate HPC lease value using cap rate
 * Formula: NOI_annual / cap_rate
 */
export function calculateHpcValueM(
  noiAnnualM: number,
  capRate: number
): number {
  if (capRate === 0) return 0;
  return noiAnnualM / capRate;
}

// ===========================================
// PROBABILITY & DISCOUNT ADJUSTMENTS
// ===========================================

/**
 * Calculate energization year discount multiplier
 * Formula: e^(-decay_rate × (year - base_year))
 * Default decay rate: 0.15 (15% annual decline in value)
 */
export function calculateEnergizationMultiplier(
  energizationYear: number,
  factors: GlobalFactors
): number {
  const { energizationBaseYear, energizationDecayRate } = factors;
  const yearsOut = energizationYear - energizationBaseYear;

  if (yearsOut <= 0) return 1.0;

  return Math.exp(-energizationDecayRate * yearsOut);
}

/**
 * Get status multiplier based on phase status
 */
export function getStatusMultiplier(status: string): number {
  const multipliers: Record<string, number> = {
    'OPERATIONAL': 1.0,
    'PARTIALLY_ONLINE': 0.85,
    'UNDER_CONSTRUCTION': 0.7,
    'CONTRACTED': 0.5,
    'PIPELINE': 0.3,
    'OPTION': 0.15,
    'DISCUSSION': 0.05,
  };
  return multipliers[status] || 0.3;
}

/**
 * Apply fidoodle (user adjustment factor)
 */
export function applyFidoodle(
  value: number,
  fidoodle: number
): number {
  return value * fidoodle;
}

// ===========================================
// COMPANY-LEVEL CALCULATIONS
// ===========================================

/**
 * Calculate HODL value (BTC + ETH holdings at current prices)
 */
export function calculateHodlValueM(
  btcHoldings: number,
  btcPrice: number,
  ethHoldings: number = 0,
  ethPrice: number = 0
): number {
  return (btcHoldings * btcPrice + ethHoldings * ethPrice) / 1e6;
}

/**
 * Calculate net cash position
 */
export function calculateNetCashM(
  cashM: number,
  debtM: number
): number {
  return cashM - debtM;
}

/**
 * Calculate market cap
 */
export function calculateMarketCapM(
  stockPrice: number,
  fdSharesM: number
): number {
  return stockPrice * fdSharesM;
}

/**
 * Calculate NAV per share
 */
export function calculateNavPerShare(
  totalNavM: number,
  fdSharesM: number
): number {
  if (fdSharesM === 0) return 0;
  return totalNavM / fdSharesM;
}

/**
 * Calculate premium/discount to NAV
 */
export function calculatePremiumDiscount(
  stockPrice: number,
  navPerShare: number
): number {
  if (navPerShare === 0) return 0;
  return (stockPrice - navPerShare) / navPerShare;
}

// ===========================================
// FFO (Funds From Operations)
// ===========================================

/**
 * Calculate FFO for a company
 * FFO = Net Income + Depreciation + Amortization (simplified as EBITDA proxy)
 */
export function calculateFfoAnnualM(
  miningEbitdaM: number,
  hpcNoiM: number,
  interestExpenseM: number = 0
): number {
  return miningEbitdaM + hpcNoiM - interestExpenseM;
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Safely convert Prisma Decimal to number
 */
export function decimalToNumber(value: Decimal | null | undefined): number {
  if (!value) return 0;
  return parseFloat(value.toString());
}

/**
 * Format number as currency (millions)
 */
export function formatMillions(value: number): string {
  return `$${value.toFixed(1)}M`;
}

/**
 * Format percentage
 */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
