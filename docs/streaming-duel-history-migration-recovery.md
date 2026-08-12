# Streaming duel history migration and recovery

This runbook covers migrations `0052`, `0055`, and `0058` for
`streaming_duel_history`. The production strategy is forward-only at the
database layer: roll back the application while retaining the additive schema,
then restore data from a verified backup if data recovery is required. Do not
drop the outcome, participant, damage, or cancellation columns during an
incident; that would destroy draw/cancellation evidence.

## Safety boundary

- Put the scheduler in maintenance or disable streaming duels before the
  migration window. Allow any active sporting result and persistence write to
  finish before stopping writers.
- Record the application SHA, database server/version, migration journal,
  database name, table row count, minimum/maximum `finishedAt`, and backup
  checksum in the incident/change record.
- Take a custom-format PostgreSQL backup that includes schema and data for
  `streaming_duel_history`; retain the full database backup required by the
  normal production policy as the authoritative recovery point.
- Restore into a separate recovery database first. Never test a restore by
  overwriting the only production copy.

Example backup command (replace every placeholder explicitly):

```sh
pg_dump --format=custom \
  --table='public.streaming_duel_history' \
  --file='/approved/backup/location/streaming-duel-history.dump' \
  'postgresql://USER@HOST:PORT/DATABASE'
sha256sum '/approved/backup/location/streaming-duel-history.dump'
```

## Migration verification

Run the reusable verifier only against a newly created, empty disposable
database whose name begins with `hyperia_streaming_history_verify_`:

```sh
STREAMING_MIGRATION_VERIFY_DATABASE_URL='postgresql://USER@HOST:PORT/hyperia_streaming_history_verify_CHANGE_ID' \
STREAMING_MIGRATION_VERIFY_ALLOW_RESET=true \
bun run --cwd packages/server db:verify-streaming-history-migration
```

The verifier fails if the database contains any public table. It applies the
legacy schema, migrates a legacy win, writes a draw, replays the cancellation
migration twice, writes a cancellation, and simulates a pre-draw application
binary writing after the new schema is present. It then truncates and restores
the table inside the disposable database and proves exact row equality and a
stable SHA-256 fingerprint.

## Application rollback

1. Disable new streaming duel cycles and wait for the active write to settle.
2. Preserve the migrated schema. The new columns are additive, defaulted, or
   nullable, so the original winner/loser-only insert remains accepted.
3. Deploy the previously approved application artifact with streaming duels
   still disabled. Do not let an older binary create new product outcomes whose
   draw/cancellation policy it does not understand.
4. Check database connectivity, read-only game health, row-count invariants,
   and logs. If the rollback is stable, either keep streaming duels disabled or
   return to a forward-fixed artifact before resuming cycles.
5. The current reader reconstructs a rollback writer's missing participant and
   damage columns from the original winner/loser fields, so those rows remain
   visible after the forward fix is restored.

## Data recovery

1. Stop all history writers and capture a second forensic backup of the current
   state before changing anything.
2. Create a separate recovery database with the same PostgreSQL major version.
3. Restore the approved full backup or table backup into that database with
   `pg_restore`; apply migrations through `0058`; then run row counts, outcome
   counts, nullability checks, timestamp bounds, and application hydration/API
   validation.
4. Compare the restored artifact checksum and database evidence with the change
   record. Have a second operator approve the recovery target and evidence.
5. Promote the recovered database using the infrastructure's approved database
   cutover procedure. Keep streaming duels disabled until the public history,
   authenticated monitor, and scheduler startup load all agree.

This local verifier proves migration semantics, legacy-writer compatibility,
and exact table-data restoration. A production-volume anonymized copy, external
backup/restore rehearsal, measured timing, and two-person staging cutover remain
required before this runbook can be signed off for launch.
