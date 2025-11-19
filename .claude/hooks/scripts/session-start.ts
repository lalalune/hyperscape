#!/usr/bin/env bun
/**
 * SessionStart Hook
 * Triggered when a new conversation session begins
 */

import { readFileSync } from "fs";

interface HookInput {
  hook_event_name: string;
  current_working_directory: string;
}

function main() {
  try {
    // Read input from stdin
    const input: HookInput = JSON.parse(readFileSync(0, "utf-8"));

    if (!input.current_working_directory) {
      process.exit(0);
    }

    const timestamp = new Date().toISOString();
    const cwd = input.current_working_directory;

    // Output session start info
    const output = {
      systemMessage: `📍 Session started at ${timestamp}\n💼 Working directory: ${cwd}\n🎯 Project: asset-forge`,
      additionalContext: null,
    };

    console.log(JSON.stringify(output));
    process.exit(0);
  } catch (error) {
    console.error(`Hook error: ${error}`);
    process.exit(1);
  }
}

main();
