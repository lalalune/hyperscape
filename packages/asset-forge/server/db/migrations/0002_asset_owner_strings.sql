ALTER TABLE "assets" DROP CONSTRAINT IF EXISTS "assets_owner_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "owner_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ALTER COLUMN "owner_id" TYPE varchar(255) USING "owner_id"::text;
