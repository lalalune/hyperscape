#!/usr/bin/env bun
/**
 * PreToolUse Hook for Edit
 * Validates file edits
 * Enforces research-first protocol
 */

import { readFileSync, existsSync, appendFileSync, mkdirSync } from "fs";
import { basename, join, dirname } from "path";

interface HookInput {
  hook_event_name: string;
  current_working_directory: string;
  tool_name: string;
  tool_input: {
    file_path: string;
    old_string: string;
    new_string: string;
  };
}

interface ToolLogEntry {
  timestamp: string;
  tool: string;
  path?: string;
  query?: string;
}

const PROTECTED_FILES = [
  "package.json",
  "package-lock.json",
  "bun.lockb",
  "yarn.lock",
];

// Libraries that require research
const EXTERNAL_LIBRARIES = [
  "@privy-io",
  "@react-three",
  "drizzle-orm",
  "elysia",
  "@elysiajs",
  "three",
  "playwright",
  "vitest",
  "zod",
  "@typebox",
];

function checkProtectedFile(filePath: string): boolean {
  const filename = basename(filePath);
  return PROTECTED_FILES.includes(filename);
}

function getToolLog(cwd: string): ToolLogEntry[] {
  const logPath = join(cwd, ".claude", "logs", "tool-usage.jsonl");

  if (!existsSync(logPath)) {
    return [];
  }

  try {
    const content = readFileSync(logPath, "utf-8");
    return content
      .trim()
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line));
  } catch (error) {
    return [];
  }
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

function hasExternalLibraries(content: string): string[] {
  const found: string[] = [];

  for (const lib of EXTERNAL_LIBRARIES) {
    if (content.includes(lib)) {
      found.push(lib);
    }
  }

  return found;
}

function hasRecentDeepwikiUsage(toolLog: ToolLogEntry[]): boolean {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

  return toolLog.some((entry) => {
    const timestamp = new Date(entry.timestamp).getTime();
    return entry.tool === "deepwiki" && timestamp > fiveMinutesAgo;
  });
}

function hasFileBeenRead(toolLog: ToolLogEntry[], filePath: string): boolean {
  // Check if file has been read in this session
  const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;

  return toolLog.some((entry) => {
    const timestamp = new Date(entry.timestamp).getTime();
    return (
      entry.tool === "Read" &&
      entry.path === filePath &&
      timestamp > thirtyMinutesAgo
    );
  });
}

function main() {
  try {
    const input: HookInput = JSON.parse(readFileSync(0, "utf-8"));
    const filePath = input.tool_input.file_path;
    const newString = input.tool_input.new_string;
    const cwd = input.current_working_directory;

    // Exit early if cwd is undefined
    if (!cwd) {
      process.exit(0);
    }

    // Log this Edit tool usage
    logToolUsage(cwd, "Edit", filePath);

    // Check 1: Protected files
    if (checkProtectedFile(filePath)) {
      const warning = {
        systemMessage: `⚠️  Editing protected file: ${basename(filePath)}\n\nThis file is critical to the project. Changes may affect dependencies or build process.`,
        additionalContext: null,
      };

      console.log(JSON.stringify(warning));
      process.exit(1); // Warn but allow
    }

    const toolLog = getToolLog(cwd);

    // Check 2: Editing file without reading it first
    if (!hasFileBeenRead(toolLog, filePath)) {
      const warning = {
        systemMessage: `⚠️  WARNING: Editing file without reading it first
File: ${basename(filePath)}

Did you:
- Read the file with Read tool to understand context?
- Check surrounding code for patterns?
- Verify your changes won't break existing functionality?

Research-first protocol: Always read files before editing them.`,
        additionalContext: null,
      };

      console.log(JSON.stringify(warning));
      process.exit(1); // Warn but allow
    }

    // Check 3: Adding external libraries without deepwiki
    const libraries = hasExternalLibraries(newString);
    if (libraries.length > 0 && !hasRecentDeepwikiUsage(toolLog)) {
      const warning = {
        systemMessage: `⚠️  WARNING: Adding external libraries without research
Libraries detected: ${libraries.join(", ")}

Did you:
- Use deepwiki to research library APIs?
- Check library documentation?
- Verify current best practices?

Research-first protocol: Always research libraries before using them.`,
        additionalContext: null,
      };

      console.log(JSON.stringify(warning));
      process.exit(1); // Warn but allow
    }

    process.exit(0);
  } catch (error) {
    console.error(`Hook error: ${error}`);
    process.exit(1);
  }
}

main();
