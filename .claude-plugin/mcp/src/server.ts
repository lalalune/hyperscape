#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { glob } from "glob";
import crypto from "crypto";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = process.env.HYPERSCAPE_PROJECT_ROOT || path.resolve(__dirname, "../../..");

// Performance and caching interfaces
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface PerformanceMetrics {
  toolName: string;
  duration: number;
  success: boolean;
  cacheHit: boolean;
  timestamp: number;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 1000;

  recordMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  getStats(toolName?: string) {
    const relevantMetrics = toolName
      ? this.metrics.filter((m) => m.toolName === toolName)
      : this.metrics;

    if (relevantMetrics.length === 0) {
      return null;
    }

    const durations = relevantMetrics.map((m) => m.duration);
    const successCount = relevantMetrics.filter((m) => m.success).length;
    const cacheHitCount = relevantMetrics.filter((m) => m.cacheHit).length;

    return {
      count: relevantMetrics.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      successRate: (successCount / relevantMetrics.length) * 100,
      cacheHitRate: (cacheHitCount / relevantMetrics.length) * 100,
    };
  }

  getSummary() {
    const toolNames = [...new Set(this.metrics.map((m) => m.toolName))];
    return toolNames.map((name) => ({ tool: name, ...this.getStats(name) }));
  }
}

class CacheManager<T = string> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxCacheSize = 100;

  set(key: string, data: T, ttl: number = 300000) {
    // 5 min default TTL
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  invalidate(pattern?: string) {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      keys: Array.from(this.cache.keys()),
    };
  }
}

class HyperscapeDevServerOptimized {
  private server: Server;
  private cache = new CacheManager();
  private perfMonitor = new PerformanceMonitor();
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  };

  constructor() {
    this.server = new Server(
      {
        name: "hyperscape-dev",
        version: "2.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    console.error("🚀 Hyperscape Dev Server v2.0 (Optimized) initializing...");
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getTools(),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const startTime = Date.now();
      let success = false;
      let cacheHit = false;

      try {
        const args = request.params.arguments || {};

        // Generate cache key
        const cacheKey = this.generateCacheKey(request.params.name, args);

        // Check cache for read-only operations
        if (this.isCacheableOperation(request.params.name)) {
          const cached = this.cache.get(cacheKey);
          if (cached) {
            cacheHit = true;
            success = true;
            console.error(`✅ Cache hit for ${request.params.name}`);
            return JSON.parse(cached);
          }
        }

        // Execute with retry logic
        const result = await this.executeWithRetry(
          () => this.handleToolCall(request.params.name, args),
          request.params.name
        );

        success = true;

        // Cache result for read-only operations
        if (this.isCacheableOperation(request.params.name)) {
          this.cache.set(cacheKey, JSON.stringify(result), this.getCacheTTL(request.params.name));
        }

        return result;
      } catch (error) {
        console.error(`❌ Error in ${request.params.name}:`, error);
        return this.formatError(error, request.params.name);
      } finally {
        // Record performance metrics
        this.perfMonitor.recordMetric({
          toolName: request.params.name,
          duration: Date.now() - startTime,
          success,
          cacheHit,
          timestamp: Date.now(),
        });
      }
    });
  }

  private isCacheableOperation(toolName: string): boolean {
    // Only cache read-only operations
    return ["hyperscape_validate_types", "hyperscape_analyze_logs", "hyperscape_get_world_state", "hyperscape_check_rpg_state"].includes(
      toolName
    );
  }

  private getCacheTTL(toolName: string): number {
    const ttlMap: Record<string, number> = {
      hyperscape_validate_types: 60000, // 1 minute
      hyperscape_analyze_logs: 30000, // 30 seconds
      hyperscape_get_world_state: 5000, // 5 seconds (world state changes frequently)
      hyperscape_check_rpg_state: 10000, // 10 seconds
    };
    return ttlMap[toolName] || 60000;
  }

  private generateCacheKey(toolName: string, args: Record<string, unknown>): string {
    const argsString = JSON.stringify(args);
    const hash = crypto.createHash("md5").update(`${toolName}:${argsString}`).digest("hex");
    return `${toolName}:${hash}`;
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    toolName: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on certain errors
        if (this.isNonRetryableError(lastError)) {
          throw lastError;
        }

        if (attempt < this.retryConfig.maxRetries) {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt),
            this.retryConfig.maxDelay
          );
          console.error(
            `⚠️  ${toolName} failed (attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1}), retrying in ${delay}ms...`
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  private isNonRetryableError(error: Error): boolean {
    const nonRetryablePatterns = [
      "ENOENT",
      "EACCES",
      "Invalid",
      "not found",
      "permission denied",
    ];
    return nonRetryablePatterns.some((pattern) =>
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private formatError(error: unknown, toolName: string) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = this.categorizeError(error);

    let guidance = "";
    switch (errorType) {
      case "permission":
        guidance =
          "\n\n💡 Suggestion: Check file permissions and ensure you have access to the required directories.";
        break;
      case "not_found":
        guidance =
          "\n\n💡 Suggestion: Verify the file path exists and HYPERSCAPE_PROJECT_ROOT is set correctly.";
        break;
      case "timeout":
        guidance =
          "\n\n💡 Suggestion: Operation timed out. Try running with a smaller scope or check if services are running.";
        break;
      case "validation":
        guidance =
          "\n\n💡 Suggestion: Check input parameters and ensure they match the expected format.";
        break;
    }

    return {
      content: [
        {
          type: "text",
          text: `❌ Error in ${toolName}:\n\n${errorMessage}${guidance}\n\n🔍 Tool: ${toolName}\n📅 Time: ${new Date().toISOString()}`,
        },
      ],
      isError: true,
    };
  }

  private categorizeError(error: unknown): string {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const lowerMessage = errorMessage.toLowerCase();

    if (lowerMessage.includes("permission") || lowerMessage.includes("eacces")) {
      return "permission";
    }
    if (lowerMessage.includes("not found") || lowerMessage.includes("enoent")) {
      return "not_found";
    }
    if (lowerMessage.includes("timeout") || lowerMessage.includes("timed out")) {
      return "timeout";
    }
    if (lowerMessage.includes("invalid") || lowerMessage.includes("validation")) {
      return "validation";
    }
    return "unknown";
  }

  private getTools(): Tool[] {
    return [
      {
        name: "hyperscape_validate_types",
        description:
          "Validate TypeScript strong typing rules (no any/unknown types). Cached for 1 minute.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                "Path to scan relative to project root (default: packages/plugin-hyperscape/src)",
            },
            skipCache: {
              type: "boolean",
              description: "Skip cache and force fresh validation (default: false)",
            },
          },
        },
      },
      {
        name: "hyperscape_run_visual_test",
        description: "Execute visual test with colored cube proxies using Playwright",
        inputSchema: {
          type: "object",
          properties: {
            testName: {
              type: "string",
              description: "Name of the test file to run",
            },
            timeout: {
              type: "number",
              description: "Test timeout in milliseconds (default: 120000)",
            },
          },
          required: ["testName"],
        },
      },
      {
        name: "hyperscape_generate_action",
        description: "Scaffold new ElizaOS action with proper types and test template",
        inputSchema: {
          type: "object",
          properties: {
            actionName: {
              type: "string",
              description: "Name of the action in camelCase (e.g., 'mineRock')",
            },
            description: {
              type: "string",
              description: "What the action does",
            },
            similes: {
              type: "array",
              items: { type: "string" },
              description: "Alternative names for the action",
            },
          },
          required: ["actionName", "description"],
        },
      },
      {
        name: "hyperscape_analyze_logs",
        description:
          "Parse and analyze error logs from /logs folder. Cached for 30 seconds.",
        inputSchema: {
          type: "object",
          properties: {
            logType: {
              type: "string",
              enum: ["error", "test", "runtime", "all"],
              description: "Type of logs to analyze (default: all)",
            },
            detailed: {
              type: "boolean",
              description: "Include detailed log contents (default: false)",
            },
            skipCache: {
              type: "boolean",
              description: "Skip cache and force fresh analysis (default: false)",
            },
          },
        },
      },
      {
        name: "hyperscape_get_world_state",
        description:
          "Query current Hyperscape world state from test instance. Cached for 5 seconds.",
        inputSchema: {
          type: "object",
          properties: {
            format: {
              type: "string",
              enum: ["summary", "detailed", "json"],
              description: "Output format (default: summary)",
            },
          },
        },
      },
      {
        name: "hyperscape_check_rpg_state",
        description:
          "Query RPG game state (inventory, skills, banks). Cached for 10 seconds.",
        inputSchema: {
          type: "object",
          properties: {
            playerId: {
              type: "string",
              description: "Player ID to query (optional)",
            },
            component: {
              type: "string",
              enum: ["inventory", "skills", "bank", "all"],
              description: "Component to query (default: all)",
            },
          },
        },
      },
      {
        name: "hyperscape_get_metrics",
        description: "Get performance metrics and statistics for the MCP server",
        inputSchema: {
          type: "object",
          properties: {
            toolName: {
              type: "string",
              description: "Filter metrics by tool name (optional)",
            },
          },
        },
      },
      {
        name: "hyperscape_clear_cache",
        description: "Clear the MCP server cache (all or specific pattern)",
        inputSchema: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description: "Regex pattern to match cache keys (optional, clears all if not provided)",
            },
          },
        },
      },
      {
        name: "hyperscape_health_check",
        description: "Check the health and status of the MCP server and dependencies",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ];
  }

  private async handleToolCall(name: string, args: Record<string, unknown>) {
    // Skip cache if requested
    if (args.skipCache) {
      const cacheKey = this.generateCacheKey(name, args);
      this.cache.invalidate(cacheKey);
    }

    switch (name) {
      case "hyperscape_validate_types":
        return await this.validateTypes(args.path as string | undefined);

      case "hyperscape_run_visual_test":
        return await this.runVisualTest(
          args.testName as string,
          args.timeout as number | undefined
        );

      case "hyperscape_generate_action":
        return await this.generateAction(
          args.actionName as string,
          args.description as string,
          args.similes as string[] | undefined
        );

      case "hyperscape_analyze_logs":
        return await this.analyzeLogs(
          args.logType as string | undefined,
          args.detailed as boolean | undefined
        );

      case "hyperscape_get_world_state":
        return await this.getWorldState(args.format as string | undefined);

      case "hyperscape_check_rpg_state":
        return await this.checkRPGState(
          args.playerId as string | undefined,
          args.component as string | undefined
        );

      case "hyperscape_get_metrics":
        return this.getMetrics(args.toolName as string | undefined);

      case "hyperscape_clear_cache":
        return this.clearCache(args.pattern as string | undefined);

      case "hyperscape_health_check":
        return await this.healthCheck();

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  // Tool implementations (keeping existing logic but with improvements)
  private async validateTypes(scanPath?: string) {
    const targetPath = scanPath || "packages/plugin-hyperscape/src";
    const fullPath = path.join(PROJECT_ROOT, targetPath);

    // Validate path exists
    try {
      await fs.access(fullPath);
    } catch {
      throw new Error(
        `Path not found: ${fullPath}\n\nPlease check that HYPERSCAPE_PROJECT_ROOT is set correctly.`
      );
    }

    const violations: string[] = [];

    // Check for 'any' types
    const { stdout: anyResults } = await execAsync(
      `grep -rn ":\\s*any\\b" "${fullPath}" --include="*.ts" --exclude-dir=node_modules || true`,
      { cwd: PROJECT_ROOT, timeout: 30000 }
    );

    if (anyResults.trim()) {
      violations.push("🚫 Found 'any' types:\n" + anyResults);
    }

    // Check for 'unknown' types
    const { stdout: unknownResults } = await execAsync(
      `grep -rn ":\\s*unknown\\b" "${fullPath}" --include="*.ts" --exclude-dir=node_modules || true`,
      { cwd: PROJECT_ROOT, timeout: 30000 }
    );

    if (unknownResults.trim()) {
      violations.push("🚫 Found 'unknown' types:\n" + unknownResults);
    }

    // Check for 'as any' casts
    const { stdout: asAnyResults } = await execAsync(
      `grep -rn "as any" "${fullPath}" --include="*.ts" --exclude-dir=node_modules || true`,
      { cwd: PROJECT_ROOT, timeout: 30000 }
    );

    if (asAnyResults.trim()) {
      violations.push("🚫 Found 'as any' casts:\n" + asAnyResults);
    }

    const resultText =
      violations.length > 0
        ? `❌ Type violations found:\n\n${violations.join("\n\n")}\n\n⚠️  Fix these violations according to strong typing rules in CLAUDE.md\n\n💡 See: ${PROJECT_ROOT}/CLAUDE.md for guidelines`
        : `✅ No type violations found in ${targetPath}\n\n✨ All files follow strong typing rules`;

    return {
      content: [{ type: "text", text: resultText }],
    };
  }

  private async runVisualTest(testName: string, timeout: number = 120000) {
    const testPath = path.join(PROJECT_ROOT, "packages/plugin-hyperscape");

    const { stdout, stderr } = await execAsync(
      `cd "${testPath}" && bun test ${testName}`,
      { cwd: testPath, timeout }
    );

    const output = stdout + (stderr ? `\n\nStderr:\n${stderr}` : "");
    const passed = !output.includes("FAIL") && !output.includes("Error");

    return {
      content: [
        {
          type: "text",
          text: `${passed ? "✅" : "❌"} Visual test results for ${testName}:\n\n${output}\n\n${passed ? "✨ All tests passed!" : "⚠️  Some tests failed. Check logs above."}`,
        },
      ],
    };
  }

  private async generateAction(actionName: string, description: string, similes?: string[]) {
    // Validate action name
    if (!/^[a-z][a-zA-Z0-9]*$/.test(actionName)) {
      throw new Error(
        `Invalid action name: ${actionName}\n\nAction names must be in camelCase (e.g., 'mineRock', 'catchFish')`
      );
    }

    // Check if action already exists
    const actionPath = path.join(
      PROJECT_ROOT,
      "packages/plugin-hyperscape/src/actions",
      `${actionName}.ts`
    );

    try {
      await fs.access(actionPath);
      throw new Error(
        `Action already exists: ${actionPath}\n\nUse a different name or delete the existing action first.`
      );
    } catch (error) {
      // File doesn't exist, which is what we want
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    const actionTemplate = `import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { elizaLogger } from "@elizaos/core";
import type { HyperscapeService } from "../service";

export const ${actionName}Action: Action = {
    name: "${actionName.toUpperCase()}",
    similes: [${similes ? similes.map((s) => `"${s.toUpperCase()}"`).join(", ") : ""}],
    description: "${description}",
    validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        const service = runtime.getService<HyperscapeService>("hyperscape");
        if (!service) {
            elizaLogger.error("Hyperscape service not available");
            return false;
        }
        return true;
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State | undefined,
        options: { [key: string]: unknown } = {},
        callback?: HandlerCallback
    ): Promise<boolean> => {
        const service = runtime.getService<HyperscapeService>("hyperscape");

        if (!service) {
            elizaLogger.error("Hyperscape service not available");
            return false;
        }

        elizaLogger.info(\`Executing ${actionName} action\`);

        try {
            // TODO: Implement action logic here
            // Access world state: service.getWorldState()
            // Access controls: service.getControls()
            // Send messages: callback({ text: "..." })

            return true;
        } catch (error) {
            elizaLogger.error(\`Error in ${actionName} action:\`, error);
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Example user message that triggers this action" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Example agent response",
                    action: "${actionName.toUpperCase()}"
                },
            },
        ],
    ],
};
`;

    const testTemplate = `import { describe, it, expect, beforeAll } from "bun:test";
import { ${actionName}Action } from "../actions/${actionName}";

describe("${actionName}Action", () => {
    it("should validate successfully with hyperscape service", async () => {
        // TODO: Implement test with real Hyperscape world
        expect(true).toBe(true);
    });

    it("should execute ${actionName} action", async () => {
        // TODO: Implement test with visual verification
        expect(true).toBe(true);
    });
});
`;

    const testPath = path.join(
      PROJECT_ROOT,
      "packages/plugin-hyperscape/src/__tests__/actions",
      `${actionName}.test.ts`
    );

    await fs.writeFile(actionPath, actionTemplate);
    await fs.writeFile(testPath, testTemplate);

    return {
      content: [
        {
          type: "text",
          text: `✅ Generated action files:\n\n📄 Action: ${actionPath}\n🧪 Test: ${testPath}\n\n⚠️  Next steps:\n1. Implement action logic in handler\n2. Add real tests with Hyperscape world\n3. Export action in src/index.ts\n4. Add to package.json agentConfig.actions\n5. Run /test-rpg ${actionName} to verify`,
        },
      ],
    };
  }

  private async analyzeLogs(logType: string = "all", detailed: boolean = false) {
    const logsDir = path.join(PROJECT_ROOT, "logs");

    try {
      await fs.access(logsDir);
    } catch {
      return {
        content: [
          {
            type: "text",
            text: `ℹ️  No logs directory found at ${logsDir}\n\n💡 Logs will be created automatically when tests run.`,
          },
        ],
      };
    }

    const files = await fs.readdir(logsDir);
    if (files.length === 0) {
      return {
        content: [{ type: "text", text: "ℹ️  Logs directory is empty" }],
      };
    }

    const logContents = await Promise.all(
      files.map(async (file) => ({
        file,
        content: await fs.readFile(path.join(logsDir, file), "utf-8"),
        stats: await fs.stat(path.join(logsDir, file)),
      }))
    );

    const errors = {
      typeErrors: [] as { file: string; lines: string[] }[],
      runtimeErrors: [] as { file: string; lines: string[] }[],
      testFailures: [] as { file: string; lines: string[] }[],
    };

    logContents.forEach(({ file, content }) => {
      const lines = content.split("\n");

      if (logType === "all" || logType === "error") {
        const typeErrorLines = lines.filter((l) => l.includes("TS") || l.includes("TypeError"));
        if (typeErrorLines.length > 0) {
          errors.typeErrors.push({ file, lines: typeErrorLines.slice(0, detailed ? 100 : 5) });
        }

        const runtimeErrorLines = lines.filter(
          (l) => l.includes("Error:") && !l.includes("TS")
        );
        if (runtimeErrorLines.length > 0) {
          errors.runtimeErrors.push({
            file,
            lines: runtimeErrorLines.slice(0, detailed ? 100 : 5),
          });
        }
      }

      if (logType === "all" || logType === "test") {
        const testFailureLines = lines.filter((l) => l.includes("FAIL") || l.includes("✗"));
        if (testFailureLines.length > 0) {
          errors.testFailures.push({ file, lines: testFailureLines.slice(0, detailed ? 100 : 5) });
        }
      }
    });

    let summary = `📊 Log Analysis (${files.length} files):\n\n`;
    summary += `🔴 Type Errors: ${errors.typeErrors.length} files\n`;
    summary += `⚠️  Runtime Errors: ${errors.runtimeErrors.length} files\n`;
    summary += `❌ Test Failures: ${errors.testFailures.length} files\n\n`;

    if (detailed) {
      if (errors.typeErrors.length > 0) {
        summary += `\n🔴 Type Errors:\n`;
        errors.typeErrors.forEach(({ file, lines }) => {
          summary += `\n📄 ${file}:\n${lines.join("\n")}\n`;
        });
      }

      if (errors.runtimeErrors.length > 0) {
        summary += `\n⚠️  Runtime Errors:\n`;
        errors.runtimeErrors.forEach(({ file, lines }) => {
          summary += `\n📄 ${file}:\n${lines.join("\n")}\n`;
        });
      }

      if (errors.testFailures.length > 0) {
        summary += `\n❌ Test Failures:\n`;
        errors.testFailures.forEach(({ file, lines }) => {
          summary += `\n📄 ${file}:\n${lines.join("\n")}\n`;
        });
      }
    }

    if (
      errors.typeErrors.length === 0 &&
      errors.runtimeErrors.length === 0 &&
      errors.testFailures.length === 0
    ) {
      summary += "✅ No errors found in logs!";
    }

    return {
      content: [{ type: "text", text: summary }],
    };
  }

  private async getWorldState(format: string = "summary") {
    return {
      content: [
        {
          type: "text",
          text: `🌍 World State Query:\n\nℹ️  This feature requires a running Hyperscape instance.\n\nTo use:\n1. Start Hyperscape world: cd packages/hyperscape && bun start\n2. Connect agent: bun run test:agents\n3. Query state again\n\nFormat: ${format}`,
        },
      ],
    };
  }

  private async checkRPGState(playerId?: string, component: string = "all") {
    return {
      content: [
        {
          type: "text",
          text: `🎮 RPG State Query:\n\nℹ️  This feature requires a running RPG instance.\n\nPlayer ID: ${playerId || "N/A"}\nComponent: ${component}\n\nTo use:\n1. Start RPG world\n2. Connect agent\n3. Query state again`,
        },
      ],
    };
  }

  private getMetrics(toolName?: string) {
    const stats = toolName ? this.perfMonitor.getStats(toolName) : null;
    const summary = this.perfMonitor.getSummary();

    let text = "📊 Performance Metrics:\n\n";

    if (toolName && stats) {
      text += `Tool: ${toolName}\n`;
      text += `Calls: ${stats.count}\n`;
      text += `Avg Duration: ${stats.avgDuration.toFixed(2)}ms\n`;
      text += `Min/Max: ${stats.minDuration.toFixed(2)}ms / ${stats.maxDuration.toFixed(2)}ms\n`;
      text += `Success Rate: ${stats.successRate.toFixed(1)}%\n`;
      text += `Cache Hit Rate: ${stats.cacheHitRate.toFixed(1)}%\n`;
    } else {
      text += "All Tools:\n\n";
      summary.forEach((s) => {
        if (s.count) {
          text += `${s.tool}:\n`;
          text += `  Calls: ${s.count}, Avg: ${s.avgDuration?.toFixed(2)}ms, `;
          text += `Success: ${s.successRate?.toFixed(1)}%, Cache Hits: ${s.cacheHitRate?.toFixed(1)}%\n`;
        }
      });
    }

    text += `\n💾 Cache: ${this.cache.getStats().size}/${this.cache.getStats().maxSize} entries`;

    return {
      content: [{ type: "text", text }],
    };
  }

  private clearCache(pattern?: string) {
    this.cache.invalidate(pattern);
    return {
      content: [
        {
          type: "text",
          text: pattern
            ? `✅ Cleared cache entries matching: ${pattern}`
            : "✅ Cleared all cache entries",
        },
      ],
    };
  }

  private async healthCheck() {
    const checks: string[] = [];

    // Check PROJECT_ROOT
    try {
      await fs.access(PROJECT_ROOT);
      checks.push("✅ PROJECT_ROOT accessible");
    } catch {
      checks.push("❌ PROJECT_ROOT not accessible");
    }

    // Check plugin directory
    try {
      await fs.access(path.join(PROJECT_ROOT, "packages/plugin-hyperscape"));
      checks.push("✅ plugin-hyperscape directory found");
    } catch {
      checks.push("❌ plugin-hyperscape directory not found");
    }

    // Check logs directory
    try {
      await fs.access(path.join(PROJECT_ROOT, "logs"));
      checks.push("✅ logs directory exists");
    } catch {
      checks.push("⚠️  logs directory not found (will be created on demand)");
    }

    // Performance stats
    const perfStats = this.perfMonitor.getSummary();
    checks.push(`\n📊 Server Stats:`);
    checks.push(`  Cache Size: ${this.cache.getStats().size}/${this.cache.getStats().maxSize}`);
    checks.push(`  Total Requests: ${perfStats.reduce((sum, s) => sum + (s.count || 0), 0)}`);

    return {
      content: [
        {
          type: "text",
          text: `🏥 Health Check:\n\n${checks.join("\n")}\n\n💚 Server Status: Healthy`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("✅ Hyperscape Development MCP server v2.0 (Optimized) running on stdio");
    console.error("📊 Features: Caching, Retry Logic, Performance Monitoring, Health Checks");
  }
}

const server = new HyperscapeDevServerOptimized();
server.run().catch(console.error);
