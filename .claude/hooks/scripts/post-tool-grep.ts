#!/usr/bin/env bun
/**
 * PostToolUse Hook for Grep
 * Tracks grep searches for research-first protocol
 */

import { readFileSync, appendFileSync, mkdirSync } from "fs";
import { join } from "path";

interface HookInput {
  hook_event_name: string;
  current_working_directory: string;
  tool_name: string;
  tool_input: {
    pattern: string;
    path?: string;
  };
  tool_output: string;
}

interface ToolLogEntry {
  timestamp: string;
  tool: string;
  path?: string;
  query?: string;
}

function logToolUsage(
  cwd: string,
  tool: string,
  searchPath?: string,
  pattern?: string,
) {
  const logsDir = join(cwd, ".claude", "logs");

  try {
    mkdirSync(logsDir, { recursive: true });

    const entry: ToolLogEntry = {
      timestamp: new Date().toISOString(),
      tool,
      ...(searchPath && { path: searchPath }),
      ...(pattern && { query: pattern }),
    };

    appendFileSync(
      join(logsDir, "tool-usage.jsonl"),
      JSON.stringify(entry) + "\n",
    );
  } catch (error) {
    // Non-critical, continue
  }
}

function main() {
  try {
    const input: HookInput = JSON.parse(readFileSync(0, "utf-8"));
    const cwd = input.current_working_directory;

    // Exit early if cwd is undefined
    if (!cwd) {
      process.exit(0);
    }

    const searchPath = input.tool_input.path || cwd;
    const pattern = input.tool_input.pattern;

    // Log Grep tool usage
    logToolUsage(cwd, "Grep", searchPath, pattern);

    process.exit(0);
  } catch (error) {
    // Non-critical error, don't block
    process.exit(0);
  }
}

main();
