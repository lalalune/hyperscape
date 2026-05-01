#!/usr/bin/env bun
/**
 * `hyperforge-agent-server` — bun-runnable entry point.
 *
 * Boots the agent service from environment variables:
 *
 *   ANTHROPIC_API_KEY            (required)
 *   HYPERFORGE_CATALOG_PATH      (optional; defaults to monorepo location)
 *   HYPERFORGE_WORKSPACE_ROOT    (optional; defaults to the monorepo root,
 *                                 found by walking up from this script
 *                                 until package.json with `workspaces` is hit)
 *   AGENT_SERVER_PORT            (optional; defaults to 5180)
 *   AGENT_SERVER_HOSTNAME        (optional; defaults to 0.0.0.0)
 *   AGENT_SERVER_MODEL           (optional; defaults to claude-sonnet-4-5)
 *
 * Loads `.env` next to this file's package.json automatically so
 * the key can live in `packages/agent-server/.env`.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { GameBuilderService } from "@hyperforge/eliza-game-builder";
import type { LLMClient } from "@hyperforge/agent-runner";
import { serve } from "./server.js";

loadPackageEnv();

function loadPackageEnv(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(here, "..", ".env");
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/**
 * Walk up from the script's directory until we find a package.json
 * with a `workspaces` field — that's the monorepo root, where the
 * catalog lives. Falls back to process.cwd() if not found, matching
 * the prior behavior.
 */
function findMonorepoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  let dir = here;
  for (let i = 0; i < 10; i++) {
    const pkgPath = resolve(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
          workspaces?: unknown;
        };
        if (pkg.workspaces) return dir;
      } catch {
        // Ignore parse errors, keep walking.
      }
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function main(): void {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY missing. Set it in your environment.");
    process.exit(2);
  }

  const port = Number.parseInt(process.env.AGENT_SERVER_PORT ?? "5180", 10);
  const hostname = process.env.AGENT_SERVER_HOSTNAME ?? "0.0.0.0";
  const defaultModel = process.env.AGENT_SERVER_MODEL ?? "claude-sonnet-4-5";

  const workspaceRoot =
    process.env.HYPERFORGE_WORKSPACE_ROOT ?? findMonorepoRoot();
  const service = GameBuilderService.create({
    workspaceRoot,
    catalogPath: process.env.HYPERFORGE_CATALOG_PATH,
  });
  const stats = service.getCatalog().stats;

  const anthropic = new Anthropic({ apiKey });
  const llm: LLMClient = {
    async sendMessage(req) {
      return anthropic.messages.create({
        model: req.model,
        system: req.system,
        messages: req.messages as never,
        tools: req.tools as never,
        max_tokens: req.max_tokens,
      });
    },
  };

  const result = serve({
    port,
    hostname,
    llm,
    service,
    defaultModel,
    onTurn: (turn, calls) => {
      const tag = calls.length === 0 ? "(final)" : calls.join(", ");
      console.log(`[turn ${turn}] ${tag}`);
    },
  });

  console.log("─".repeat(72));
  console.log("HyperForge agent server");
  console.log("─".repeat(72));
  console.log(
    `Catalog:  ${stats.total} widgets across ${
      Object.keys(stats.byCategory).length
    } categories`,
  );
  console.log(`Model:    ${defaultModel}`);
  console.log(`Listening: ${result.url}`);
  console.log(`Routes:`);
  console.log(`  GET  /         → healthcheck`);
  console.log(`  POST /design   → { prompt, model?, maxTurns? }`);
  console.log("─".repeat(72));
}

main();
