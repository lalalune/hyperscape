-- Enforce oracle-proof row integrity for streaming duel history.
--
-- Legacy rows may have no proof material at all. Fresh catch-up rows must have
-- the full tuple required for synthetic onDuelEnd replay. Mixed rows are
-- invalid because they look present to operators but cannot settle safely.

DO $$
BEGIN
  ALTER TABLE "streaming_duel_history"
    ADD CONSTRAINT "streaming_duel_history_oracle_proof_all_or_none"
    CHECK (
      (
        "duelKeyHex" IS NULL AND
        "duelEndTime" IS NULL AND
        "seed" IS NULL AND
        "replayHash" IS NULL
      )
      OR
      (
        "duelKeyHex" IS NOT NULL AND
        "duelEndTime" IS NOT NULL AND
        "seed" IS NOT NULL AND
        "replayHash" IS NOT NULL
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
