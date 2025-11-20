---
name: run-drizzle-kit
description: Safely run bunx drizzle-kit commands for packages/server with repo-specific checks.
allowed-tools: Read, Grep, Bash(cd packages/server && bun*), Bash(cd packages/server && bunx drizzle-kit *), Bash(cd packages/server && git status*)
---

## When to use this skill
- You need to inspect, generate, push, migrate, or open Drizzle Studio for the Hyperscape server database.
- You must ensure migrations target `packages/server/src/database/schema.ts` and land in `packages/server/src/database/migrations`.
- You need to confirm env configuration before touching production data.

## Repository context to remember
1. Drizzle config: `packages/server/drizzle.config.ts`. It loads `.env` (or `POSTGRES_*` vars) and falls back to `postgresql://hyperscape:hyperscape_dev@localhost:5432/hyperscape`.
2. Commands **must** run from `packages/server/` so Bun picks up the correct `node_modules` and config.
3. Bun version must satisfy repo engines (>= 1.1.38). Check with `bun --version` before running toolkit commands.
4. Common commands:
   - `bunx drizzle-kit generate --config drizzle.config.ts`
   - `bunx drizzle-kit push`
   - `bunx drizzle-kit migrate`
   - `bunx drizzle-kit studio`
5. Never run `bunx drizzle-kit drop` or destructive SQL without explicit user confirmation.

## Step-by-step procedure
1. `cd packages/server` (already handled in allowed Bash commands).
2. Confirm Bun is available and the version is acceptable: `bun --version`.
3. Verify environment configuration:
   - If `.env` exists, `bunx env | grep DATABASE_URL` (redact secrets when reporting).
   - If `.env` is missing, ask the user which connection string to use before proceeding.
4. Show current git status with `git status -sb` so the user sees pending migration files.
5. Echo the exact Drizzle command you plan to run and wait for confirmation when the action is destructive (`push`, `migrate`).
6. Run the requested `bunx drizzle-kit ...` command. Capture stdout/stderr verbatim for the user.
7. After the command, list any new or changed files under `src/database/migrations`.
8. If the command fails, read relevant logs (e.g., `logs/*.log`) or show the stack trace so the user can diagnose quickly.

## Safety rails
- Stop immediately if the connection string hostname is not `localhost` or an approved staging host unless the user explicitly approves.
- Do not edit schema files or migrations automatically; only run bunx commands as requested.
- If Bun or Drizzle Kit is missing, suggest `bun add -d drizzle-kit` or `bun install` but do not install without direction.
- Always remind the user to review generated SQL before pushing to production.

## References
- Drizzle Kit docs: https://github.com/drizzle-team/drizzle-orm/tree/main/drizzle-kit
- Hyperscape server schema entry point: `packages/server/src/database/schema.ts`
- Hyperscape engines requirements: `package.json` → `"bun": ">=1.1.38"`
