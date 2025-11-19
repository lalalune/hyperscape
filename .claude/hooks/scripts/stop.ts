#!/usr/bin/env bun
/**
 * Stop Hook
 * Triggered when main agent task completes
 */

import { readFileSync, appendFileSync, mkdirSync } from "fs";
import { join } from "path";

interface HookInput {
  hook_event_name: string;
  current_working_directory: string;
}

function main() {
  try {
    const input: HookInput = JSON.parse(readFileSync(0, "utf-8"));

    if (!input.current_working_directory) {
      process.exit(0);
    }

    const logsDir = join(input.current_working_directory, ".claude", "logs");

    try {
      mkdirSync(logsDir, { recursive: true });

      const logEntry = {
        event: "task-stop",
        timestamp: new Date().toISOString(),
        cwd: input.current_working_directory,
      };

      appendFileSync(
        join(logsDir, "task-log.jsonl"),
        JSON.stringify(logEntry) + "\n",
      );
    } catch (err) {
      // Non-critical
    }

    process.exit(0);
  } catch (error) {
    console.error(`Hook error: ${error}`);
    process.exit(1);
  }
}

main();
