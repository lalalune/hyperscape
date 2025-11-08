#!/usr/bin/env bun
/**
 * PreCompact Hook
 * Save conversation state before compaction
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

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logsDir = join(input.current_working_directory, ".claude", "logs");

    try {
      mkdirSync(logsDir, { recursive: true });

      const logEntry = {
        event: "pre-compact",
        timestamp: new Date().toISOString(),
        cwd: input.current_working_directory,
      };

      writeFileSync(
        join(logsDir, `compact-${timestamp}.json`),
        JSON.stringify(logEntry, null, 2),
      );

      const output = {
        systemMessage: `💾 Conversation state saved before compaction`,
        additionalContext: null,
      };
      console.log(JSON.stringify(output));
    } catch (err) {
      // Non-critical error
    }

    process.exit(0);
  } catch (error) {
    console.error(`Hook error: ${error}`);
    process.exit(1);
  }
}

main();
