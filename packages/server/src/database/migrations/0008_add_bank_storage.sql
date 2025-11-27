CREATE TABLE IF NOT EXISTS "bank_storage" (
	"id" serial PRIMARY KEY NOT NULL,
	"playerId" text NOT NULL,
	"itemId" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"slot" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "bank_storage_playerId_slot_unique" UNIQUE("playerId","slot")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "bank_storage" ADD CONSTRAINT "bank_storage_playerId_characters_id_fk" FOREIGN KEY ("playerId") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bank_storage_player" ON "bank_storage" USING btree ("playerId");
