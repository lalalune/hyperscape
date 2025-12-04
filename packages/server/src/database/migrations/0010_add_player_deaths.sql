-- Migration: Add player_deaths table for death lock tracking
-- This table prevents item duplication exploits on server restart

CREATE TABLE IF NOT EXISTS "player_deaths" (
	"playerId" text PRIMARY KEY NOT NULL,
	"gravestoneId" text,
	"groundItemIds" text,
	"position" text NOT NULL,
	"timestamp" bigint NOT NULL,
	"zoneType" text NOT NULL,
	"itemCount" integer DEFAULT 0 NOT NULL,
	"createdAt" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT NOT NULL,
	"updatedAt" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT NOT NULL
);

-- Add foreign key constraint
DO $$ BEGIN
 ALTER TABLE "player_deaths" ADD CONSTRAINT "player_deaths_playerId_characters_id_fk" FOREIGN KEY ("playerId") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add index for timestamp lookups
CREATE INDEX IF NOT EXISTS "idx_player_deaths_timestamp" ON "player_deaths" USING btree ("timestamp");
