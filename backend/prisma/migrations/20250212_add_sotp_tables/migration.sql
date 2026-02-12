-- Drop existing tables if they exist (recreate with correct structure)
DROP TABLE IF EXISTS "mining_valuations";
DROP TABLE IF EXISTS "net_liquid_assets";

-- Create Mining Valuations table (correct structure from spreadsheet)
CREATE TABLE IF NOT EXISTS "mining_valuations" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "ticker" VARCHAR(10) UNIQUE NOT NULL,
    "hashrateEh" DECIMAL(10,2),
    "efficiencyJth" DECIMAL(6,2),
    "powerCostKwh" DECIMAL(6,4),
    "hostedMw" DECIMAL(10,2),
    "sourceDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Net Liquid Assets table (correct structure from spreadsheet)
CREATE TABLE IF NOT EXISTS "net_liquid_assets" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "ticker" VARCHAR(10) UNIQUE NOT NULL,
    "cashM" DECIMAL(12,2),
    "btcCount" DECIMAL(18,8),
    "ethCount" DECIMAL(18,8),
    "totalDebtM" DECIMAL(12,2),
    "sourceDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for ticker lookups
CREATE INDEX IF NOT EXISTS "mining_valuations_ticker_idx" ON "mining_valuations"("ticker");
CREATE INDEX IF NOT EXISTS "net_liquid_assets_ticker_idx" ON "net_liquid_assets"("ticker");
