CREATE TABLE "agent_mappings" (
	"agent_id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"character_id" text NOT NULL,
	"agent_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_mappings" ADD CONSTRAINT "agent_mappings_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_mappings" ADD CONSTRAINT "agent_mappings_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_mappings_account" ON "agent_mappings" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_agent_mappings_character" ON "agent_mappings" USING btree ("character_id");