#!/usr/bin/env bun
/**
 * PostToolUse Hook for Read
 * Tracks file reads for research-first protocol
 */

import { readFileSync, appendFileSync, mkdirSync } from "fs";
import { join } from "path";

interface HookInput {
  hook_event_name: string;
  current_working_directory: string;
  tool_name: string;
  tool_input: {
    file_path: string;
  };
  tool_output: string;
}

interface ToolLogEntry {
  timestamp: string;
  tool: string;
  path?: string;
}

function logToolUsage(cwd: string, tool: string, filePath?: string) {
  const logsDir = join(cwd, ".claude", "logs");

  try {
    mkdirSync(logsDir, { recursive: true });

    const entry: ToolLogEntry = {
      timestamp: new Date().toISOString(),
      tool,
      ...(filePath && { path: filePath }),
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
    const filePath = input.tool_input.file_path;
    const cwd = input.current_working_directory;

    // Exit early if cwd is undefined
    if (!cwd) {
      process.exit(0);
    }

    // Log Read tool usage
    logToolUsage(cwd, "Read", filePath);

    process.exit(0);
  } catch (error) {
    // Non-critical error, don't block
    process.exit(0);
  }
}

main();
