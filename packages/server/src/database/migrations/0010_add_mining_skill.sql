-- Add mining skill columns to characters table
-- Following the same pattern as woodcutting skill

ALTER TABLE "characters" ADD COLUMN "miningLevel" integer DEFAULT 1;
ALTER TABLE "characters" ADD COLUMN "miningXp" integer DEFAULT 0;
