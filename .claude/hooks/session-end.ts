#!/usr/bin/env bun
/**
 * SessionEnd Hook
 * Triggered when session terminates
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
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
    const timestamp = new Date().toISOString();

    try {
      mkdirSync(logsDir, { recursive: true });

      const sessionSummary = {
        event: "session-end",
        timestamp,
        cwd: input.current_working_directory,
        endTime: timestamp,
      };

      writeFileSync(
        join(logsDir, `session-${timestamp.replace(/[:.]/g, "-")}.json`),
        JSON.stringify(sessionSummary, null, 2),
      );

      const output = {
        systemMessage: `✅ Session ended at ${timestamp}`,
        additionalContext: null,
      };
      console.log(JSON.stringify(output));
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
