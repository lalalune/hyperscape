/**
 * Error Logging Infrastructure for E2E Tests
 *
 * Captures console errors during tests and saves them to /logs/ per project rules.
 * Provides post-test error verification to ensure tests pass without hidden errors.
 *
 * @packageDocumentation
 */

import type { Page, ConsoleMessage } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/**
 * Logged error entry
 */
interface ErrorEntry {
  timestamp: string;
  type: "error" | "warning" | "console" | "uncaught";
  message: string;
  stack?: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
}

/**
 * Test log summary
 */
interface TestLogSummary {
  testName: string;
  startTime: string;
  endTime: string;
  duration: number;
  errorCount: number;
  warningCount: number;
  errors: ErrorEntry[];
  warnings: ErrorEntry[];
}

/**
 * Error logger for E2E tests
 */
export class ErrorLogger {
  private errors: ErrorEntry[] = [];
  private warnings: ErrorEntry[] = [];
  private consoleMessages: ErrorEntry[] = [];
  private testName: string;
  private startTime: Date;
  private logsDir: string;

  constructor(testName: string, logsDir: string = "logs") {
    this.testName = testName;
    this.startTime = new Date();
    this.logsDir = path.resolve(process.cwd(), logsDir);

    // Ensure logs directory exists
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  /**
   * Attaches error listeners to a Playwright page
   */
  attachToPage(page: Page): void {
    // Capture console errors
    page.on("console", (msg: ConsoleMessage) => {
      const type = msg.type();
      const entry: ErrorEntry = {
        timestamp: new Date().toISOString(),
        type:
          type === "error"
            ? "error"
            : type === "warning"
              ? "warning"
              : "console",
        message: msg.text(),
        url: msg.location().url,
        lineNumber: msg.location().lineNumber,
        columnNumber: msg.location().columnNumber,
      };

      if (type === "error") {
        this.errors.push(entry);
      } else if (type === "warning") {
        this.warnings.push(entry);
      } else {
        this.consoleMessages.push(entry);
      }
    });

    // Capture uncaught page errors
    page.on("pageerror", (error: Error) => {
      this.errors.push({
        timestamp: new Date().toISOString(),
        type: "uncaught",
        message: error.message,
        stack: error.stack,
      });
    });

    // Capture request failures that might indicate errors
    page.on("requestfailed", (request) => {
      const failure = request.failure();
      if (failure) {
        this.warnings.push({
          timestamp: new Date().toISOString(),
          type: "warning",
          message: `Request failed: ${request.url()} - ${failure.errorText}`,
          url: request.url(),
        });
      }
    });
  }

  /**
   * Gets all captured errors
   */
  getErrors(): ErrorEntry[] {
    return [...this.errors];
  }

  /**
   * Gets all captured warnings
   */
  getWarnings(): ErrorEntry[] {
    return [...this.warnings];
  }

  /**
   * Gets the count of errors
   */
  getErrorCount(): number {
    return this.errors.length;
  }

  /**
   * Gets the count of warnings
   */
  getWarningCount(): number {
    return this.warnings.length;
  }

  /**
   * Checks if there were any errors during the test
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Clears all logged entries
   */
  clear(): void {
    this.errors = [];
    this.warnings = [];
    this.consoleMessages = [];
  }

  /**
   * Generates a summary of the test log
   */
  getSummary(): TestLogSummary {
    const endTime = new Date();
    return {
      testName: this.testName,
      startTime: this.startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: endTime.getTime() - this.startTime.getTime(),
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  /**
   * Saves the log to a file
   */
  saveLog(): string {
    const summary = this.getSummary();
    const sanitizedName = this.testName.replace(/[^a-zA-Z0-9-_]/g, "_");
    const timestamp = this.startTime.toISOString().replace(/[:.]/g, "-");
    const filename = `${sanitizedName}_${timestamp}.json`;
    const filepath = path.join(this.logsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(summary, null, 2));
    return filepath;
  }

  /**
   * Verifies that no errors occurred and throws if they did
   */
  verifyNoErrors(options: { allowWarnings?: boolean } = {}): void {
    const { allowWarnings = true } = options;

    if (this.errors.length > 0) {
      const errorMessages = this.errors
        .map((e) => `  - [${e.type}] ${e.message}`)
        .join("\n");

      // Save log before throwing
      const logPath = this.saveLog();

      throw new Error(
        `Test "${this.testName}" had ${this.errors.length} error(s):\n${errorMessages}\n\nFull log saved to: ${logPath}`,
      );
    }

    if (!allowWarnings && this.warnings.length > 0) {
      const warningMessages = this.warnings
        .map((w) => `  - ${w.message}`)
        .join("\n");

      const logPath = this.saveLog();

      throw new Error(
        `Test "${this.testName}" had ${this.warnings.length} warning(s):\n${warningMessages}\n\nFull log saved to: ${logPath}`,
      );
    }
  }

  /**
   * Filters out known/expected errors
   */
  filterKnownErrors(patterns: RegExp[]): void {
    this.errors = this.errors.filter(
      (error) => !patterns.some((pattern) => pattern.test(error.message)),
    );
  }

  /**
   * Prints a summary to console
   */
  printSummary(): void {
    const summary = this.getSummary();
    console.log(`\n=== Test Log Summary: ${summary.testName} ===`);
    console.log(`Duration: ${summary.duration}ms`);
    console.log(`Errors: ${summary.errorCount}`);
    console.log(`Warnings: ${summary.warningCount}`);

    if (summary.errorCount > 0) {
      console.log("\nErrors:");
      summary.errors.forEach((e) => {
        console.log(`  [${e.timestamp}] ${e.message}`);
        if (e.stack) console.log(`    ${e.stack.split("\n")[0]}`);
      });
    }

    if (summary.warningCount > 0) {
      console.log("\nWarnings:");
      summary.warnings.forEach((w) => {
        console.log(`  [${w.timestamp}] ${w.message}`);
      });
    }
  }
}

/**
 * Creates an error logger and attaches it to a page
 */
export function createErrorLogger(page: Page, testName: string): ErrorLogger {
  const logger = new ErrorLogger(testName);
  logger.attachToPage(page);
  return logger;
}

/**
 * Filters commonly known/expected errors that don't indicate real problems
 */
export const KNOWN_ERROR_PATTERNS: RegExp[] = [
  // Source map warnings
  /DevTools failed to load source map/i,
  // WebGL context warnings
  /WebGL context/i,
  // Extension-related errors
  /Extension context invalidated/i,
  // React development warnings in dev mode
  /Warning: ReactDOM.render is no longer supported/i,
];
