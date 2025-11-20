#!/usr/bin/env bun
/**
 * PreToolUse Hook for Bash
 * Validates bash commands before execution
 */

import { readFileSync } from "fs";

interface HookInput {
  hook_event_name: string;
  current_working_directory: string;
  tool_name: string;
  tool_input: {
    command: string;
    description?: string;
  };
}

const DESTRUCTIVE_COMMANDS = [
  /rm\s+-rf\s+\//, // rm -rf /
  /rm\s+-rf\s+\*/, // rm -rf *
  />\s*\/dev\/sd[a-z]/, // Writing to disk
  /dd\s+if=/, // dd command
  /mkfs\./, // Format filesystem
  /fdisk/, // Partition disk
];

const GIT_FORCE_COMMANDS = [
  /git\s+push\s+.*--force/,
  /git\s+push\s+.*-f\s/,
  /git\s+reset\s+--hard/,
  /git\s+clean\s+-fd/,
];

function checkDestructive(command: string): string | null {
  for (const pattern of DESTRUCTIVE_COMMANDS) {
    if (pattern.test(command)) {
      return `Destructive command detected: ${pattern.source}`;
    }
  }

  for (const pattern of GIT_FORCE_COMMANDS) {
    if (pattern.test(command)) {
      return `Potentially destructive git command: ${pattern.source}`;
    }
  }

  return null;
}

function main() {
  try {
    const input: HookInput = JSON.parse(readFileSync(0, "utf-8"));
    const command = input.tool_input.command;

    const issue = checkDestructive(command);

    if (issue) {
      // Block execution
      const error = {
        systemMessage: `🚫 Command blocked: ${issue}\n\nCommand: ${command}\n\nThis command could be destructive. Please review and confirm it's safe.`,
        additionalContext: null,
      };

      console.error(JSON.stringify(error));
      process.exit(2); // Block execution
    }

    // Command is safe
    process.exit(0);
  } catch (error) {
    console.error(`Hook error: ${error}`);
    process.exit(1);
  }
}

main();
