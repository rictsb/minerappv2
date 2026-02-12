-- Create Mining Valuations table
CREATE TABLE IF NOT EXISTS "mining_valuations" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "ticker" VARCHAR(10) UNIQUE NOT NULL,
    "hashrateEh" DECIMAL(10,2),
    "hashrateType" VARCHAR(50),
    "hashrateNote" TEXT,
    "miningEvM" DECIMAL(12,2),
    "totalDebtM" DECIMAL(12,2),
    "nonMiningDebtAdjM" DECIMAL(12,2),
    "miningDebtM" DECIMAL(12,2),
    "cashM" DECIMAL(12,2),
    "sharesOutstandingM" DECIMAL(12,4),
    "fdSharesM" DECIMAL(12,4),
    "fdSharesUsedM" DECIMAL(12,4),
    "sourceUrl" TEXT,
    "sourceDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Net Liquid Assets table
CREATE TABLE IF NOT EXISTS "net_liquid_assets" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "ticker" VARCHAR(10) UNIQUE NOT NULL,
    "mcapM" DECIMAL(14,2),
    "btcHoldings" DECIMAL(18,8),
    "ethHoldings" DECIMAL(18,8),
    "totalHodlM" DECIMAL(14,2),
    "hodlMcapRatio" DECIMAL(6,4),
    "cashEquivM" DECIMAL(12,2),
    "hodlPlusCashM" DECIMAL(14,2),
    "hodlCashMcapRatio" DECIMAL(6,4),
    "sourceUrl" TEXT,
    "sourceDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for ticker lookups
CREATE INDEX IF NOT EXISTS "mining_valuations_ticker_idx" ON "mining_valuations"("ticker");
CREATE INDEX IF NOT EXISTS "net_liquid_assets_ticker_idx" ON "net_liquid_assets"("ticker");
