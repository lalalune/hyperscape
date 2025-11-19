#!/usr/bin/env bun
/**
 * PreToolUse Hook for Write
 * Prevents writing sensitive files
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
    content: string;
  };
}

interface ToolLogEntry {
  timestamp: string;
  tool: string;
  path?: string;
  query?: string;
}

const SENSITIVE_FILES = [
  ".env",
  ".env.local",
  ".env.production",
  "credentials.json",
  "serviceAccount.json",
  "secrets.json",
  "id_rsa",
  "id_ed25519",
];

const SENSITIVE_EXTENSIONS = [".pem", ".key", ".p12", ".pfx"];

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

function isSensitiveFile(filePath: string): boolean {
  const filename = basename(filePath);

  if (SENSITIVE_FILES.includes(filename)) {
    return true;
  }

  for (const ext of SENSITIVE_EXTENSIONS) {
    if (filename.endsWith(ext)) {
      return true;
    }
  }

  return false;
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
  // Check if file or its parent directory has been researched
  const fileDir = dirname(filePath);

  return toolLog.some((entry) => {
    if (entry.tool === "Read" && entry.path === filePath) {
      return true;
    }
    if (entry.tool === "Glob" && entry.path && filePath.includes(entry.path)) {
      return true;
    }
    if (
      entry.tool === "Grep" &&
      entry.path &&
      filePath.startsWith(entry.path)
    ) {
      return true;
    }
    return false;
  });
}

function main() {
  try {
    const input: HookInput = JSON.parse(readFileSync(0, "utf-8"));
    const filePath = input.tool_input.file_path;
    const content = input.tool_input.content;
    const cwd = input.current_working_directory;

    // Exit early if cwd is undefined
    if (!cwd) {
      process.exit(0);
    }

    // Log this Write tool usage
    logToolUsage(cwd, "Write", filePath);

    // Check 1: Sensitive files
    if (isSensitiveFile(filePath)) {
      const warning = {
        systemMessage: `⚠️  Writing sensitive file: ${basename(filePath)}\n\nThis file may contain secrets or credentials.\nEnsure it's added to .gitignore before committing.`,
        additionalContext: null,
      };

      console.log(JSON.stringify(warning));
      process.exit(1); // Warn but allow
    }

    const toolLog = getToolLog(cwd);
    const fileExists = existsSync(filePath);

    // Check 2: New file without research
    if (!fileExists && !hasFileBeenRead(toolLog, filePath)) {
      const parentDir = dirname(filePath);
      const hasSearched = toolLog.some(
        (entry) =>
          (entry.tool === "Glob" || entry.tool === "Grep") &&
          entry.path &&
          parentDir.includes(entry.path!),
      );

      if (!hasSearched) {
        const warning = {
          systemMessage: `⚠️  WARNING: Creating new file without research
File: ${basename(filePath)}

Did you:
- Search for existing similar files with Glob?
- Search for related code with Grep?
- Ask user for verification?

Research-first protocol: Always research before creating files.`,
          additionalContext: null,
        };

        console.log(JSON.stringify(warning));
        process.exit(1); // Warn but allow
      }
    }

    // Check 3: External libraries without deepwiki
    const libraries = hasExternalLibraries(content);
    if (libraries.length > 0 && !hasRecentDeepwikiUsage(toolLog)) {
      const warning = {
        systemMessage: `⚠️  WARNING: Using external libraries without research
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
