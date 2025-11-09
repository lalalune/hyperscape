/**
 * Database Schema Index
 * Exports all schema tables and types
 */

// Assets
export * from "./assets.schema";

// Re-export everything for drizzle
import * as assetsSchema from "./assets.schema";

export const schema = {
  ...assetsSchema,
};
