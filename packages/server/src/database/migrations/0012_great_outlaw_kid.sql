CREATE TABLE "bank_placeholders" (
	"id" serial PRIMARY KEY NOT NULL,
	"playerId" text NOT NULL,
	"tabIndex" integer DEFAULT 0 NOT NULL,
	"slot" integer NOT NULL,
	"itemId" text NOT NULL,
	"createdAt" bigint DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT NOT NULL,
	CONSTRAINT "bank_placeholders_playerId_tabIndex_slot_unique" UNIQUE("playerId","tabIndex","slot")
);
--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "alwaysSetPlaceholder" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_placeholders" ADD CONSTRAINT "bank_placeholders_playerId_characters_id_fk" FOREIGN KEY ("playerId") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bank_placeholders_player" ON "bank_placeholders" USING btree ("playerId");--> statement-breakpoint
CREATE INDEX "idx_bank_placeholders_player_item" ON "bank_placeholders" USING btree ("playerId","itemId");
