/**
 * Hyperscape Test Utilities
 *
 * Centralized test infrastructure providing:
 * 1. Strong-typed mock factories that match production interfaces
 * 2. Pure logic extraction helpers for unit testing
 * 3. Integration test world setup
 * 4. Common test fixtures and constants
 *
 * Design Philosophy:
 * - Types flow from production code, not duplicated
 * - Mocks implement the same interfaces as real systems
 * - expect/throw pattern for validation (fail fast)
 * - No `unknown` or `any` - always strong typing
 */

export { createTestWorld, destroyTestWorld } from "./createTestWorld";
export type { TestWorldOptions } from "./createTestWorld";

// Re-export mock factories
export * from "./mocks/player";
export * from "./mocks/inventory";
export * from "./mocks/combat";
export * from "./mocks/entity";
export * from "./mocks/world";

// Re-export test fixtures
export * from "./fixtures/items";
export * from "./fixtures/players";
export * from "./fixtures/positions";

// Re-export validation helpers
export * from "./validation";

// Re-export logic extractors (pure functions ready for unit testing)
export * from "./logic";
