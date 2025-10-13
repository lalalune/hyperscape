/**
 * Drizzle Database Adapter
 * 
 * This adapter bridges the gap between the legacy database interface (designed for Knex/SQL builders)
 * and the new Drizzle ORM interface. It allows existing systems to continue using the old query API
 * while the underlying implementation uses Drizzle.
 * 
 * **Purpose**:
 * The shared package defines a `SystemDatabase` interface that was designed around Knex-style
 * query builders with chaining methods like `where().first()`. Rather than rewriting all systems
 * to use Drizzle directly, this adapter translates the old interface to Drizzle queries.
 * 
 * **Supported Tables**:
 * - `storage`: Key-value store for world settings and configuration
 * - `config`: System configuration and feature flags
 * - Other tables: Minimal stub implementation (use DatabaseSystem directly for these)
 * 
 * **Migration Path**:
 * This adapter is a temporary bridge. New code should use DatabaseSystem methods directly.
 * As systems are refactored, they can move away from this adapter pattern.
 * 
 * **Query Translation Examples**:
 * ```typescript
 * // Old interface (what systems call)
 * await db('storage').where('key', userId).first()
 * 
 * // Translates to Drizzle
 * await db.select().from(schema.storage)
 *   .where(eq(schema.storage.key, userId))
 *   .limit(1)
 * ```
 * 
 * **Referenced by**: index.ts (world initialization), Storage system, ServerNetwork
 */

/**
 * Drizzle Adapter - Bridge between Drizzle ORM and Legacy Database Interface
 * 
 * This adapter provides backward compatibility for systems that were built with
 * the old Knex-based database interface. It wraps Drizzle ORM operations to
 * match the expected method signatures of the legacy SystemDatabase interface.
 * 
 * **Why this exists**:
 * - Legacy systems (Storage, ServerNetwork) expect a Knex-like query builder API
 * - We migrated to Drizzle ORM for better TypeScript support
 * - Rather than rewrite all consumers, we provide this compatibility layer
 * 
 * **Supported tables**:
 * - `storage` - Key-value storage for system state
 * - `config` - Server configuration (spawn points, settings, etc.)
 * - Other tables return minimal no-op implementations
 * 
 * **Architecture**:
 * The adapter mimics Knex's chaining API:
 * ```typescript
 * // Legacy Knex style:
 * db('storage').where('key', 'spawn').first()
 * 
 * // Becomes Drizzle:
 * db.select().from(schema.storage).where(eq(schema.storage.key, 'spawn')).limit(1)
 * ```
 * 
 * **Usage**:
 * ```typescript
 * const adapter = createDrizzleAdapter(drizzleDb);
 * const spawn = await adapter('config').where('key', 'spawn').first();
 * ```
 * 
 * **Future**:
 * This adapter is temporary. Eventually all systems should migrate to native Drizzle queries.
 * 
 * **Referenced by**: index.ts (ServerNetwork/Storage initialization)
 */

import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { SystemDatabase } from '@hyperscape/shared';
import * as schema from './schema';

/**
 * Create a Drizzle adapter that implements the SystemDatabase interface
 * 
 * The returned function acts as a table selector (like Knex), and returns
 * an object with query builder methods that internally use Drizzle.
 * 
 * @param db - The Drizzle database instance to wrap
 * @returns A function that takes a table name and returns query builder methods
 */
export function createDrizzleAdapter(db: NodePgDatabase<typeof schema>): SystemDatabase {
  return function(tableName: string) {
    // ========================================================================
    // STORAGE TABLE ADAPTER
    // ========================================================================
    // The storage table is used by the Storage system for key-value persistence.
    // Provides CRUD operations that match the Knex API.
    if (tableName === 'storage') {
      return {
        // WHERE clause - filters by key and returns query methods
        where: (key: string, value: unknown) => ({
          first: async () => {
            const results = await db.select()
              .from(schema.storage)
              .where(eq(schema.storage.key, value as string))
              .limit(1);
            return results[0];
          },
          update: async (data: Record<string, unknown>) => {
            await db.update(schema.storage)
              .set(data)
              .where(eq(schema.storage.key, value as string));
            return 1;
          },
          delete: async () => {
            await db.delete(schema.storage)
              .where(eq(schema.storage.key, value as string));
            return 1;
          }
        }),
        select: () => ({
          where: (key: string, value: unknown) => ({
            first: async () => {
              const results = await db.select()
                .from(schema.storage)
                .where(eq(schema.storage.key, value as string))
                .limit(1);
              return results[0];
            }
          })
        }),
        insert: async (data: Record<string, unknown> | Record<string, unknown>[]) => {
          type StorageInsert = typeof schema.storage.$inferInsert;
          const rows = Array.isArray(data) ? data : [data];
          await db.insert(schema.storage).values(rows as StorageInsert[]);
        },
        update: async (data: Record<string, unknown>) => {
          await db.update(schema.storage).set(data);
          return 1;
        },
        delete: async () => {
          await db.delete(schema.storage);
          return 1;
        },
        first: async () => {
          const results = await db.select().from(schema.storage).limit(1);
          return results[0];
        },
        then: async <T>(onfulfilled: (value: unknown[]) => T) => {
          const results = await db.select().from(schema.storage);
          return onfulfilled(results);
        },
        catch: async <T>(onrejected: (reason: unknown) => T) => {
          try {
            const results = await db.select().from(schema.storage);
            return results as unknown as T;
          } catch (error) {
            return onrejected(error);
          }
        }
      };
    }
    
    // ========================================================================
    // CONFIG TABLE ADAPTER
    // ========================================================================
    // The config table stores server configuration like spawn points and settings.
    // Used by ServerNetwork during initialization.
    if (tableName === 'config') {
      return {
        where: (key: string, value: unknown) => ({
          first: async () => {
            const results = await db.select()
              .from(schema.config)
              .where(eq(schema.config.key, value as string))
              .limit(1);
            return results[0];
          },
          update: async (data: Record<string, unknown>) => {
            await db.update(schema.config)
              .set(data)
              .where(eq(schema.config.key, value as string));
            return 1;
          },
          delete: async () => {
            await db.delete(schema.config)
              .where(eq(schema.config.key, value as string));
            return 1;
          }
        }),
        select: () => ({
          where: (key: string, value: unknown) => ({
            first: async () => {
              const results = await db.select()
                .from(schema.config)
                .where(eq(schema.config.key, value as string))
                .limit(1);
              return results[0];
            }
          })
        }),
        insert: async (data: Record<string, unknown> | Record<string, unknown>[]) => {
          type ConfigInsert = typeof schema.config.$inferInsert;
          const rows = Array.isArray(data) ? data : [data];
          await db.insert(schema.config).values(rows as ConfigInsert[]);
        },
        update: async (data: Record<string, unknown>) => {
          await db.update(schema.config).set(data);
          return 1;
        },
        delete: async () => {
          await db.delete(schema.config);
          return 1;
        },
        first: async () => {
          const results = await db.select().from(schema.config).limit(1);
          return results[0];
        },
        then: async <T>(onfulfilled: (value: unknown[]) => T) => {
          const results = await db.select().from(schema.config);
          return onfulfilled(results);
        },
        catch: async <T>(onrejected: (reason: unknown) => T) => {
          try {
            const results = await db.select().from(schema.config);
            return results as unknown as T;
          } catch (error) {
            return onrejected(error);
          }
        }
      };
    }
    
    // ========================================================================
    // FALLBACK ADAPTER (OTHER TABLES)
    // ========================================================================
    // For tables not specifically implemented, provide no-op methods.
    // These tables should use DatabaseSystem directly instead of the adapter.
    return {
      where: () => ({
        first: async () => undefined,
        update: async () => 0,
        delete: async () => 0
      }),
      select: () => ({
        where: (_key: string, _value: unknown) => ({
          first: async () => undefined
        })
      }),
      insert: async () => {},
      update: async () => 0,
      delete: async () => 0,
      first: async () => undefined,
      then: async <T>(onfulfilled: (value: unknown[]) => T) => {
        return onfulfilled([]);
      },
      catch: async <T>(_onrejected: (reason: unknown) => T) => {
        return [] as unknown as T;
      }
    };
  };
}
