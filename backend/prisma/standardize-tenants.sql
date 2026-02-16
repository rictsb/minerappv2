-- Standardize tenant names and preserve details in leaseNotes
-- Run each UPDATE separately to avoid transaction rollback issues

-- CoreWeave variants
UPDATE use_periods SET "leaseNotes" = COALESCE("leaseNotes" || '; ', '') || 'Original: ' || tenant, tenant = 'CoreWeave' WHERE tenant = 'Coreweave (test)';

-- AWS variants
UPDATE use_periods SET "leaseNotes" = COALESCE("leaseNotes" || '; ', '') || 'Original: ' || tenant, tenant = 'AWS' WHERE tenant = 'Amazon Web Services';
UPDATE use_periods SET "leaseNotes" = COALESCE("leaseNotes" || '; ', '') || 'Original: ' || tenant, tenant = 'AWS' WHERE tenant = 'Amazon Web Services (from Oct-2026)';

-- AMD variants
UPDATE use_periods SET "leaseNotes" = COALESCE("leaseNotes" || '; ', '') || 'Original: ' || tenant, tenant = 'AMD' WHERE tenant = 'AMD (Advanced Micro Devices)';
UPDATE use_periods SET "leaseNotes" = COALESCE("leaseNotes" || '; ', '') || 'Original: ' || tenant, tenant = 'AMD' WHERE tenant = 'AMD (option + ROFR)';

-- Core42
UPDATE use_periods SET "leaseNotes" = COALESCE("leaseNotes" || '; ', '') || 'Original: ' || tenant, tenant = 'Core42' WHERE tenant = 'Core42 (G42 subsidiary)';

-- Fluidstack variants
UPDATE use_periods SET "leaseNotes" = COALESCE("leaseNotes" || '; ', '') || 'Original: ' || tenant, tenant = 'Fluidstack' WHERE tenant = 'Fluidstack (Anthropic end-user)';
UPDATE use_periods SET "leaseNotes" = COALESCE("leaseNotes" || '; ', '') || 'Original: ' || tenant, tenant = 'Fluidstack' WHERE tenant = 'Fluidstack (ROFO)';

-- Neocloud
UPDATE use_periods SET "leaseNotes" = COALESCE("leaseNotes" || '; ', '') || 'Original: ' || tenant, tenant = 'Neocloud' WHERE tenant = 'Neocloud (LOI)';

-- Bitmain
UPDATE use_periods SET "leaseNotes" = COALESCE("leaseNotes" || '; ', '') || 'Original: ' || tenant, tenant = 'Bitmain' WHERE tenant = 'Bitmain (managed services)';

-- Self-Mining variants (standardize capitalization)
UPDATE use_periods SET tenant = 'Self-Mining' WHERE tenant = 'Self-mining';
UPDATE use_periods SET "leaseNotes" = COALESCE("leaseNotes" || '; ', '') || 'Original: ' || tenant, tenant = 'Self-Mining' WHERE tenant = 'Self-mining (23MW) + hosting tenants (18MW) + available (19MW)';
UPDATE use_periods SET "leaseNotes" = COALESCE("leaseNotes" || '; ', '') || 'Original: ' || tenant, tenant = 'Self-Mining' WHERE tenant = 'Self-mining + GPU cloud customers';
UPDATE use_periods SET "leaseNotes" = COALESCE("leaseNotes" || '; ', '') || 'Original: ' || tenant, tenant = 'Self-Mining' WHERE tenant = 'Self-mining (JV)';

-- US IG Hyperscaler
UPDATE use_periods SET "leaseNotes" = COALESCE("leaseNotes" || '; ', '') || 'Original: ' || tenant, tenant = 'US IG Hyperscaler' WHERE tenant = 'U.S. Investment-Grade Hyperscaler (ROFR)';
UPDATE use_periods SET "leaseNotes" = COALESCE("leaseNotes" || '; ', '') || 'Original: ' || tenant, tenant = 'US IG Hyperscaler' WHERE tenant = 'U.S. Investment-Grade Hyperscaler (undisclosed)';

-- Various Hosting
UPDATE use_periods SET tenant = 'Various Hosting' WHERE tenant = 'Various hosting customers';
UPDATE use_periods SET "leaseNotes" = COALESCE("leaseNotes" || '; ', '') || 'Original: ' || tenant, tenant = 'Various Hosting' WHERE tenant = 'Various hosting customers; Marathon Digital (70MW option)';
