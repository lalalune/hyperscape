import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

/**
 * Creates a minimal adapter to make Drizzle work with systems expecting the old database interface.
 * This is only used for Storage and ServerNetwork initialization.
 */
export function createDrizzleAdapter(db: NodePgDatabase<typeof schema>) {
  return function(tableName: string) {
    // Special handling for storage table
    if (tableName === 'storage') {
      return {
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
        insert: async (data: Record<string, unknown> | Record<string, unknown>[]) => {
          type StorageInsert = typeof schema.storage.$inferInsert;
          const rows = Array.isArray(data) ? data : [data];
          await db.insert(schema.storage).values(rows as StorageInsert[]);
        }
      };
    }
    
    // Special handling for config table
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
          }
        }),
        insert: async (data: Record<string, unknown> | Record<string, unknown>[]) => {
          type ConfigInsert = typeof schema.config.$inferInsert;
          const rows = Array.isArray(data) ? data : [data];
          await db.insert(schema.config).values(rows as ConfigInsert[]);
        }
      };
    }
    
    // For other tables, provide a minimal interface
    return {
      where: () => ({
        first: async () => undefined,
        update: async () => 0,
        delete: async () => 0
      }),
      insert: async () => {}
    };
  };
}
