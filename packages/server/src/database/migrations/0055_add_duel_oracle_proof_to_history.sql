-- Persist oracle proof fields (duelKeyHex, duelEndTime, seed, replayHash)
-- on streaming_duel_history so the hyperbet keeper can catch up a missed
-- onDuelEnd event by querying a per-duel result endpoint.
--
-- Nullable: legacy rows from before this migration will not have these
-- fields populated, and cannot be used for synthetic onDuelEnd replay.
-- New rows from MatchmakingManager.recordRecentDuel will always populate
-- them from the currentCycle's buildOracleProof() output.

ALTER TABLE "streaming_duel_history" ADD COLUMN IF NOT EXISTS "duelKeyHex" text;
--> statement-breakpoint
ALTER TABLE "streaming_duel_history" ADD COLUMN IF NOT EXISTS "duelEndTime" bigint;
--> statement-breakpoint
ALTER TABLE "streaming_duel_history" ADD COLUMN IF NOT EXISTS "seed" text;
--> statement-breakpoint
ALTER TABLE "streaming_duel_history" ADD COLUMN IF NOT EXISTS "replayHash" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_streaming_duel_history_duelid" ON "streaming_duel_history" USING btree ("duelId");
