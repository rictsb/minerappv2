-- Set includeInValuation defaults
-- Contracted HPC/AI with a tenant → included (default true already, but be explicit)
-- Pipeline / uncontracted / BTC mining → excluded

-- First, set ALL buildings to NOT included
UPDATE buildings SET include_in_valuation = FALSE;

-- Then, include only HPC/AI buildings that have a contracted tenant
-- (i.e., use type is HPC_AI_HOSTING or GPU_CLOUD and there is a tenant on the current use period)
UPDATE buildings b
SET include_in_valuation = TRUE
FROM use_periods up
WHERE up.building_id = b.id
  AND up.is_current = TRUE
  AND up.use_type IN ('HPC_AI_HOSTING', 'GPU_CLOUD')
  AND up.tenant IS NOT NULL
  AND up.tenant != '';
