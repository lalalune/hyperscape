#!/usr/bin/env bun
/**
 * PostToolUse Hook for Edit
 * Auto-format code after file edits
 */

import { readFileSync } from "fs";
import { basename, extname } from "path";
import { spawnSync } from "child_process";

interface HookInput {
  hook_event_name: string;
  current_working_directory: string;
  tool_name: string;
  tool_input: {
    file_path: string;
    old_string: string;
    new_string: string;
  };
  tool_output: string;
}

function shouldFormat(filePath: string): boolean {
  const ext = extname(filePath);
  const formattableExtensions = [".ts", ".tsx", ".js", ".jsx", ".json", ".md"];
  return formattableExtensions.includes(ext);
}

function main() {
  try {
    const input: HookInput = JSON.parse(readFileSync(0, "utf-8"));
    const filePath = input.tool_input.file_path;

    if (shouldFormat(filePath)) {
      const result = spawnSync("bunx", ["prettier", "--write", filePath], {
        stdio: "pipe",
        timeout: 5000,
      });

      if (result.status === 0) {
        const output = {
          systemMessage: `✨ Auto-formatted: ${basename(filePath)}`,
          additionalContext: null,
        };
        console.log(JSON.stringify(output));
      }
    }

    process.exit(0);
  } catch (error) {
    process.exit(0);
  }
}

main();
