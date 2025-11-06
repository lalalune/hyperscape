-- Migration: Add player_factions table for tracking player faction reputation
-- Created: 2025-11-05
-- Purpose: Track reputation with harmonyCouncil, purists, and freelancers factions

-- Create player_factions table
CREATE TABLE IF NOT EXISTS "player_factions" (
	"playerId" text PRIMARY KEY NOT NULL,
	"harmonyCouncil" integer DEFAULT 0 NOT NULL,
	"purists" integer DEFAULT 0 NOT NULL,
	"freelancers" integer DEFAULT 0 NOT NULL,
	"updatedAt" bigint NOT NULL
);

-- Add foreign key constraint with cascade delete
ALTER TABLE "player_factions" ADD CONSTRAINT "player_factions_playerId_characters_id_fk"
FOREIGN KEY ("playerId") REFERENCES "characters"("id") ON DELETE cascade ON UPDATE no action;

-- Add index on playerId for fast lookups
CREATE INDEX IF NOT EXISTS "idx_player_factions_player" ON "player_factions" USING btree ("playerId");
