/**
 * Shared test types to avoid duplication across test files
 */

import type { IAgentRuntime } from "@elizaos/core";

export interface TestCase {
  name: string;
  fn: (runtime: IAgentRuntime) => Promise<void> | void;
}

export interface TestSuite {
  name: string;
  description?: string;
  tests: TestCase[];
}

export interface TestAgent {
  runtime: IAgentRuntime;
  service: unknown; // Service type varies by test
  name: string;
  connected: boolean;
  chatMessages: string[];
  errors: Error[];
  position?: { x: number; y: number; z: number };
}

export interface MultiAgentTestConfig {
  numAgents: number;
  worldUrl: string;
  testDurationMs: number;
  chatIntervalMs: number;
  positionCheckIntervalMs: number;
}
