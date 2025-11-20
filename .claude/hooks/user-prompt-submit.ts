#!/usr/bin/env bun
/**
 * UserPromptSubmit Hook
 * Validates user prompts for sensitive data and provides context
 */

import { readFileSync } from "fs";

interface HookInput {
  hook_event_name: string;
  current_working_directory: string;
  user_prompt: string;
}

const SENSITIVE_PATTERNS = [
  /AKIA[0-9A-Z]{16}/i, // AWS Access Key
  /AIza[0-9A-Za-z\\-_]{35}/i, // Google API Key
  /sk-[a-zA-Z0-9]{48}/i, // OpenAI API Key
  /ghp_[a-zA-Z0-9]{36}/i, // GitHub Personal Access Token
  /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,32}/i, // Slack Token
];

function detectSecrets(prompt: string): string[] {
  const found: string[] = [];

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(prompt)) {
      found.push(pattern.source);
    }
  }

  return found;
}

function main() {
  try {
    const input: HookInput = JSON.parse(readFileSync(0, "utf-8"));
    const secrets = detectSecrets(input.user_prompt);

    if (secrets.length > 0) {
      // Warn about potential secrets
      const warning = {
        systemMessage: `⚠️  Potential secrets detected in prompt!\n\nPatterns found:\n${secrets.map((s) => `- ${s}`).join("\n")}\n\nPlease remove sensitive data from your prompt.`,
        additionalContext: null,
      };

      console.log(JSON.stringify(warning));
      process.exit(1); // User error - show warning but continue
    }

    // No issues, continue
    process.exit(0);
  } catch (error) {
    console.error(`Hook error: ${error}`);
    process.exit(1);
  }
}

main();
