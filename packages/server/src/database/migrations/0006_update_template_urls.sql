-- Migration: Update character template URLs
-- Description: Set templateUrl for each character archetype to point to template JSON files
-- Created: 2025-11-22

-- Update templateUrl for each character template
-- These URLs point to the static template files served by the template routes

UPDATE character_templates
SET "templateUrl" = 'http://localhost:5555/templates/skiller.json'
WHERE name = 'The Skiller';

UPDATE character_templates
SET "templateUrl" = 'http://localhost:5555/templates/pvmer.json'
WHERE name = 'PvM Slayer';

UPDATE character_templates
SET "templateUrl" = 'http://localhost:5555/templates/ironman.json'
WHERE name = 'Ironman';

UPDATE character_templates
SET "templateUrl" = 'http://localhost:5555/templates/completionist.json'
WHERE name = 'Completionist';
