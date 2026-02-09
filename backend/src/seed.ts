/**
 * Database seed script - Initial data setup
 * Run with: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.tenancy.deleteMany();
  await prisma.phase.deleteMany();
  await prisma.siteFactor.deleteMany();
  await prisma.companyFactor.deleteMany();
  await prisma.site.deleteMany();
  await prisma.company.deleteMany();
  await prisma.globalFactor.deleteMany();

  // Seed Global Factors
  const globalFactors = [
    // Market
    { category: 'market', key: 'btc_price', value: 95000, description: 'Current BTC price in USD' },
    { category: 'market', key: 'network_hashrate_eh', value: 750, description: 'Network hashrate in EH/s' },
    { category: 'market', key: 'block_subsidy', value: 3.125, description: 'Current block subsidy in BTC' },

    // Valuation
    { category: 'valuation', key: 'sofr_rate', value: 0.043, description: 'SOFR rate (4.3%)' },
    { category: 'valuation', key: 'ig_credit_spread', value: 0.012, description: 'Investment grade spread (1.2%)' },
    { category: 'valuation', key: 'hy_credit_spread', value: 0.035, description: 'High yield spread (3.5%)' },
    { category: 'valuation', key: 'datacenter_cap_rate', value: 0.065, description: 'Datacenter cap rate (6.5%)' },
    { category: 'valuation', key: 'hpc_revenue_multiple', value: 12, description: 'HPC revenue multiple' },

    // Operations
    { category: 'operations', key: 'default_pue', value: 1.25, description: 'Default PUE if not specified' },
    { category: 'operations', key: 'default_curtailment_pct', value: 0.05, description: 'Default curtailment (5%)' },
    { category: 'operations', key: 'default_nonpower_opex_mw_mo', value: 4500, description: 'Default non-power OpEx $/MW/mo' },
    { category: 'operations', key: 'default_efficiency_jth', value: 22, description: 'Default miner efficiency J/TH' },

    // Energization
    { category: 'energization', key: 'base_year', value: 2025, description: 'Base year for energization discount' },
    { category: 'energization', key: 'decay_rate', value: 0.15, description: 'Annual decay rate (15%)' },
  ];

  for (const factor of globalFactors) {
    await prisma.globalFactor.create({
      data: {
        category: factor.category,
        key: factor.key,
        value: factor.value,
        description: factor.description,
      },
    });
  }
  console.log(`✅ Created ${globalFactors.length} global factors`);

  // Seed sample company (MARA as example)
  const mara = await prisma.company.create({
    data: {
      ticker: 'MARA',
      name: 'Marathon Digital Holdings',
      btcHoldings: 44893,
      cashM: 874,
      debtM: 1252,
      fdSharesM: 327,
      stockPrice: 18.75,
      hashrateEh: 50,
      hashrateType: 'SELF',
      irPageUrl: 'https://ir.mara.com/',
      twitterAccounts: ['@MarathonDH'],
    },
  });

  // Create sample site
  const gardenCity = await prisma.site.create({
    data: {
      ticker: 'MARA',
      name: 'Garden City',
      country: 'USA',
      state: 'Texas',
      latitude: 31.3654,
      longitude: -101.4846,
      powerAuthority: 'ERCOT',
      grid: 'ERCOT',
      ownershipStatus: 'OWNED',
      datacenterTier: 'TIER_II',
      includeInValuation: true,
      confidence: 'HIGH',
    },
  });

  // Create sample phase
  const phase1 = await prisma.phase.create({
    data: {
      siteId: gardenCity.id,
      name: 'Phase 1',
      status: 'OPERATIONAL',
      grossMw: 200,
      itMw: 160,
      pue: 1.2,
      energizationDate: new Date('2023-06-01'),
      energizationActual: true,
      currentUse: 'BTC_MINING',
    },
  });

  // Create sample tenancy (self-mining)
  await prisma.tenancy.create({
    data: {
      phaseId: phase1.id,
      tenant: 'MARA (self)',
      useType: 'BTC_MINING',
      miningPowerCostKwh: 0.042,
      miningCurtailmentPct: 0.05,
      miningNonpowerOpexMwMo: 4500,
      miningEfficiencyJth: 20,
      fidoodle: 1.0,
    },
  });

  console.log('✅ Created sample company: MARA');
  console.log('✅ Created sample site: Garden City');
  console.log('✅ Created sample phase and tenancy');

  // Create a second company (CLSK as example)
  await prisma.company.create({
    data: {
      ticker: 'CLSK',
      name: 'CleanSpark Inc',
      btcHoldings: 10000,
      cashM: 320,
      debtM: 140,
      fdSharesM: 258,
      stockPrice: 12.50,
      hashrateEh: 25,
      hashrateType: 'SELF',
      irPageUrl: 'https://ir.cleanspark.com/',
      twitterAccounts: ['@CleanSpark_Inc'],
    },
  });

  console.log('✅ Created sample company: CLSK');

  console.log('\n🎉 Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
