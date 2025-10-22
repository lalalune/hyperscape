CREATE TABLE "manifest_voice_profiles" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manifestType" text NOT NULL,
	"entityId" text NOT NULL,
	"entityName" text NOT NULL,
	"voiceId" text NOT NULL,
	"voiceName" text NOT NULL,
	"settings" text NOT NULL,
	"sampleClips" text DEFAULT '[]',
	"assignedAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	CONSTRAINT "manifest_voice_profiles_manifestType_entityId_unique" UNIQUE("manifestType","entityId")
);
--> statement-breakpoint
CREATE INDEX "idx_manifest_voice_type" ON "manifest_voice_profiles" USING btree ("manifestType");
--> statement-breakpoint
CREATE INDEX "idx_manifest_voice_entity" ON "manifest_voice_profiles" USING btree ("entityId");
