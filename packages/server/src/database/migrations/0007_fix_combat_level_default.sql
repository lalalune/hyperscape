-- Fix combat level default from 1 to 3
-- Combat level 3 is the correct starting value (based on level 1 attack, strength, defense, ranged and level 10 constitution)

-- Update the column default
ALTER TABLE "characters" ALTER COLUMN "combatLevel" SET DEFAULT 3;

-- Update existing characters that have the incorrect default of 1
UPDATE "characters" SET "combatLevel" = 3 WHERE "combatLevel" = 1;
