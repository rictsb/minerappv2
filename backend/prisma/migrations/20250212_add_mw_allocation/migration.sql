-- Add mwAllocation column to use_periods table for tracking MW splits
ALTER TABLE "use_periods" ADD COLUMN IF NOT EXISTS "mwAllocation" DECIMAL(10,2);

-- Add comment for documentation
COMMENT ON COLUMN "use_periods"."mwAllocation" IS 'IT MW allocated to this use period (for splits)';
