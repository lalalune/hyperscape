-- Migration: Add npc_kills table for tracking player NPC kill statistics
-- Created: 2025-11-03
-- Purpose: Track how many times each player has killed each NPC type for achievements and quests

-- Create npc_kills table
CREATE TABLE IF NOT EXISTS "npc_kills" (
	"id" serial PRIMARY KEY NOT NULL,
	"playerId" text NOT NULL,
	"npcId" text NOT NULL,
	"killCount" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "npc_kills_playerId_npcId_unique" UNIQUE("playerId","npcId")
);

-- Add foreign key constraint with cascade delete
ALTER TABLE "npc_kills" ADD CONSTRAINT "npc_kills_playerId_characters_id_fk"
FOREIGN KEY ("playerId") REFERENCES "characters"("id") ON DELETE cascade ON UPDATE no action;

-- Add index on playerId for fast lookups
CREATE INDEX IF NOT EXISTS "idx_npc_kills_player" ON "npc_kills" USING btree ("playerId");
