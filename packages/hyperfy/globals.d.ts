// Global type definitions for Bun test environment

// Export types instead of declaring globals to avoid conflicts
export interface Assertion<T = unknown> {
  toBe(expected: T): void;
  toEqual(expected: T): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toBeNull(): void;
  toBeUndefined(): void;
  toBeGreaterThan(expected: number): void;
  toBeGreaterThanOrEqual(expected: number): void;
  toBeLessThan(expected: number): void;
  toBeLessThanOrEqual(expected: number): void;
  toContain(expected: any): void;
  toContainEqual(expected: any): void;
  toHaveLength(expected: number): void;
  toThrow(expected?: any): void;
  not: Assertion<T>;
}

// Re-export bun:test types
export { describe, it, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'bun:test';

// Extend bun:test matchers
declare module "bun:test" {
  interface Matchers<R = unknown> {
    toHaveBeenCalledWith(...args: any[]): R;
    objectContaining(obj: any): any;
    any(constructor: any): any;
  }
} 