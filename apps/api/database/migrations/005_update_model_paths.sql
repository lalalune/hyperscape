-- Update mob model paths to actual files
UPDATE assets
SET file_url = 'http://localhost:8080/assets/world/models/mobs/' || (metadata->>'mob_id') || '.glb'
WHERE type = 'character' AND category = 'mob';

-- Update tool model paths
UPDATE assets
SET file_url = 'http://localhost:8080/assets/world/models/tools/bronze_hatchet.glb'
WHERE metadata->>'item_id' = 'bronze_hatchet';

UPDATE assets
SET file_url = 'http://localhost:8080/assets/world/models/tools/fishing_rod.glb'
WHERE metadata->>'item_id' = 'fishing_rod';

UPDATE assets
SET file_url = 'http://localhost:8080/assets/world/models/tools/tinderbox.glb'
WHERE metadata->>'item_id' = 'tinderbox';

-- Set weapons/shields/bows to NULL since models don't exist yet
UPDATE assets
SET file_url = NULL
WHERE type = 'equipment' AND category = 'weapon'
AND metadata->>'item_id' NOT IN ('bronze_hatchet', 'fishing_rod', 'tinderbox');
