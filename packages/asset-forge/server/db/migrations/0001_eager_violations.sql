ALTER TABLE "assets" ADD COLUMN "exported_to_repo" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "manifest_path" varchar(512);