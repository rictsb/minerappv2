-- Add lease_confirmed flag to use_periods
-- Tracks whether a lease is verified (press release, SEC filing, signed deal)
-- vs speculative / thesis-based

ALTER TABLE "use_periods" ADD COLUMN "lease_confirmed" BOOLEAN NOT NULL DEFAULT false;
