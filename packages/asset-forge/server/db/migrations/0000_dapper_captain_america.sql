CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid,
	"action" varchar(100) NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" varchar(45),
	"user_agent" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_whitelist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" varchar(255) NOT NULL,
	"added_by" uuid,
	"reason" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_whitelist_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"privy_user_id" varchar(255) NOT NULL,
	"email" varchar(255),
	"wallet_address" varchar(255),
	"display_name" varchar(255),
	"avatar_url" varchar(512),
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_privy_user_id_unique" UNIQUE("privy_user_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"owner_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" varchar(100) NOT NULL,
	"category" varchar(100),
	"owner_id" uuid NOT NULL,
	"project_id" uuid,
	"file_path" varchar(512),
	"file_size" bigint,
	"file_type" varchar(100),
	"thumbnail_path" varchar(512),
	"prompt" text,
	"negative_prompt" text,
	"model_used" varchar(255),
	"generation_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"parent_asset_id" uuid,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"visibility" varchar(50) DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_whitelist" ADD CONSTRAINT "admin_whitelist_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_parent_asset_id_assets_id_fk" FOREIGN KEY ("parent_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activity_user" ON "activity_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_activity_entity" ON "activity_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_activity_action" ON "activity_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_activity_created" ON "activity_log" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_admin_whitelist_wallet" ON "admin_whitelist" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "idx_users_privy_id" ON "users" USING btree ("privy_user_id");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_wallet" ON "users" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "idx_projects_owner" ON "projects" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_projects_status" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_assets_owner" ON "assets" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_assets_project" ON "assets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_assets_type" ON "assets" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_assets_status" ON "assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_assets_tags" ON "assets" USING gin ("tags");