CREATE TABLE "characters" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"name" text NOT NULL,
	"createdAt" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
	"combatLevel" integer DEFAULT 1,
	"attackLevel" integer DEFAULT 1,
	"strengthLevel" integer DEFAULT 1,
	"defenseLevel" integer DEFAULT 1,
	"constitutionLevel" integer DEFAULT 10,
	"rangedLevel" integer DEFAULT 1,
	"woodcuttingLevel" integer DEFAULT 1,
	"fishingLevel" integer DEFAULT 1,
	"firemakingLevel" integer DEFAULT 1,
	"cookingLevel" integer DEFAULT 1,
	"attackXp" integer DEFAULT 0,
	"strengthXp" integer DEFAULT 0,
	"defenseXp" integer DEFAULT 0,
	"constitutionXp" integer DEFAULT 1154,
	"rangedXp" integer DEFAULT 0,
	"woodcuttingXp" integer DEFAULT 0,
	"fishingXp" integer DEFAULT 0,
	"firemakingXp" integer DEFAULT 0,
	"cookingXp" integer DEFAULT 0,
	"health" integer DEFAULT 100,
	"maxHealth" integer DEFAULT 100,
	"coins" integer DEFAULT 0,
	"positionX" real DEFAULT 0,
	"positionY" real DEFAULT 10,
	"positionZ" real DEFAULT 0,
	"lastLogin" bigint DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "chunk_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"chunkX" integer NOT NULL,
	"chunkZ" integer NOT NULL,
	"playerId" text NOT NULL,
	"entryTime" bigint NOT NULL,
	"exitTime" bigint
);
--> statement-breakpoint
CREATE TABLE "config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" text PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" serial PRIMARY KEY NOT NULL,
	"playerId" text NOT NULL,
	"slotType" text NOT NULL,
	"itemId" text,
	"quantity" integer DEFAULT 1,
	CONSTRAINT "equipment_playerId_slotType_unique" UNIQUE("playerId","slotType")
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"playerId" text NOT NULL,
	"itemId" text NOT NULL,
	"quantity" integer DEFAULT 1,
	"slotIndex" integer DEFAULT -1,
	"metadata" text
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"value" integer DEFAULT 0,
	"weight" real DEFAULT 0,
	"stackable" integer DEFAULT 0,
	"tradeable" integer DEFAULT 1,
	"attackLevel" integer,
	"strengthLevel" integer,
	"defenseLevel" integer,
	"rangedLevel" integer,
	"attackBonus" integer DEFAULT 0,
	"strengthBonus" integer DEFAULT 0,
	"defenseBonus" integer DEFAULT 0,
	"rangedBonus" integer DEFAULT 0,
	"heals" integer
);
--> statement-breakpoint
CREATE TABLE "player_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"playerId" text NOT NULL,
	"sessionStart" bigint NOT NULL,
	"sessionEnd" bigint,
	"playtimeMinutes" integer DEFAULT 0,
	"reason" text,
	"lastActivity" bigint DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "storage" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updatedAt" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"roles" text NOT NULL,
	"createdAt" text NOT NULL,
	"avatar" text,
	"privyUserId" text,
	"farcasterFid" text,
	CONSTRAINT "users_privyUserId_unique" UNIQUE("privyUserId")
);
--> statement-breakpoint
CREATE TABLE "world_chunks" (
	"chunkX" integer NOT NULL,
	"chunkZ" integer NOT NULL,
	"data" text NOT NULL,
	"lastActive" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
	"playerCount" integer DEFAULT 0,
	"version" integer DEFAULT 1,
	"needsReset" integer DEFAULT 0,
	CONSTRAINT "world_chunks_chunkX_chunkZ_unique" UNIQUE("chunkX","chunkZ")
);
--> statement-breakpoint
ALTER TABLE "chunk_activity" ADD CONSTRAINT "chunk_activity_playerId_characters_id_fk" FOREIGN KEY ("playerId") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_playerId_characters_id_fk" FOREIGN KEY ("playerId") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_playerId_characters_id_fk" FOREIGN KEY ("playerId") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_sessions" ADD CONSTRAINT "player_sessions_playerId_characters_id_fk" FOREIGN KEY ("playerId") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_characters_account" ON "characters" USING btree ("accountId");--> statement-breakpoint
CREATE INDEX "idx_users_privy" ON "users" USING btree ("privyUserId");--> statement-breakpoint
CREATE INDEX "idx_users_farcaster" ON "users" USING btree ("farcasterFid");