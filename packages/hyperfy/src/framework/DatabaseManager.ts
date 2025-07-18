import knex from 'knex';
import type { Knex } from 'knex';
import moment from 'moment';
import path from 'path';
import fs from 'fs-extra';

/**
 * Database Manager for Multi-World Support
 * Each world gets its own isolated database instance
 */
export class DatabaseManager {
  private databases: Map<string, Knex> = new Map();

  /**
   * Get database for a specific world
   */
  async getDatabase(dbPath: string): Promise<Knex> {
    const normalizedPath = path.resolve(dbPath);
    
    if (this.databases.has(normalizedPath)) {
      return this.databases.get(normalizedPath)!;
    }

    // Ensure directory exists
    await fs.ensureDir(path.dirname(normalizedPath));

    // Create new database instance
    const db = knex({
      client: 'better-sqlite3',
      connection: {
        filename: normalizedPath,
      },
      useNullAsDefault: true,
    });

    // Run migrations
    await this.migrate(db);

    // Store database instance
    this.databases.set(normalizedPath, db);

    return db;
  }

  /**
   * Close and remove database
   */
  async closeDatabase(dbPath: string): Promise<void> {
    const normalizedPath = path.resolve(dbPath);
    const db = this.databases.get(normalizedPath);
    
    if (db) {
      await db.destroy();
      this.databases.delete(normalizedPath);
    }
  }

  /**
   * Close all databases
   */
  async closeAllDatabases(): Promise<void> {
    for (const [path, db] of this.databases) {
      await db.destroy();
    }
    this.databases.clear();
  }

  /**
   * Run database migrations
   */
  private async migrate(db: Knex): Promise<void> {
    // ensure we have our config table
    const exists = await db.schema.hasTable('config');
    if (!exists) {
      await db.schema.createTable('config', table => {
        table.string('key').primary();
        table.string('value');
      });
      await db('config').insert({ key: 'version', value: '0' });
    }
    
    // get current version
    const versionRow = await db('config').where('key', 'version').first();
    let version = parseInt(versionRow.value);
    
    // run any new migrations
    for (let i = version; i < migrations.length; i++) {
      console.log(`running migration #${i + 1}...`);
      const migration = migrations[i];
      if (migration) {
        await migration(db);
      }
      await db('config')
        .where('key', 'version')
        .update('value', (i + 1).toString());
      version = i + 1;
    }
  }
}

/**
 * Global database manager instance
 */
export const databaseManager = new DatabaseManager();

/**
 * Database migrations
 * NOTE: always append new migrations and never modify pre-existing ones!
 */
const migrations = [
  // migration #1: add collections table
  async (db: Knex) => {
    await db.schema.createTable('collections', table => {
      table.string('id').primary();
      table.text('data');
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });
  },

  // migration #2: add apps table
  async (db: Knex) => {
    await db.schema.createTable('apps', table => {
      table.string('id').primary();
      table.text('data');
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });
  },

  // migration #3: add blueprints table
  async (db: Knex) => {
    await db.schema.createTable('blueprints', table => {
      table.string('id').primary();
      table.text('data');
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });
  },

  // migration #4: add entities table
  async (db: Knex) => {
    await db.schema.createTable('entities', table => {
      table.string('id').primary();
      table.text('data');
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });
  },

  // migration #5: add worlds table
  async (db: Knex) => {
    await db.schema.createTable('worlds', table => {
      table.string('id').primary();
      table.text('data');
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });
  },

  // migration #6: add players table
  async (db: Knex) => {
    await db.schema.createTable('players', table => {
      table.string('id').primary();
      table.text('data');
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });
  },

  // migration #7: add chat table
  async (db: Knex) => {
    await db.schema.createTable('chat', table => {
      table.increments('id').primary();
      table.string('player_id');
      table.text('message');
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
  },

  // migration #8: add default spawn config
  async (db: Knex) => {
    const defaultSpawn = JSON.stringify({
      position: [0, 5, 0],
      rotation: [0, 0, 0]
    });
    await db('config').insert({ 
      key: 'spawn', 
      value: defaultSpawn 
    }).onConflict('key').ignore();
  },

  // migration #9: add settings table
  async (db: Knex) => {
    await db.schema.createTable('settings', table => {
      table.string('key').primary();
      table.text('value');
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });
  },

  // migration #10: add logs table
  async (db: Knex) => {
    await db.schema.createTable('logs', table => {
      table.increments('id').primary();
      table.string('level');
      table.text('message');
      table.text('data');
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
  },

  // migration #11: add events table
  async (db: Knex) => {
    await db.schema.createTable('events', table => {
      table.increments('id').primary();
      table.string('type');
      table.text('data');
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
  },

  // migration #12: add analytics table
  async (db: Knex) => {
    await db.schema.createTable('analytics', table => {
      table.increments('id').primary();
      table.string('event');
      table.string('player_id');
      table.text('data');
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
  },

  // migration #13: add sessions table
  async (db: Knex) => {
    await db.schema.createTable('sessions', table => {
      table.string('id').primary();
      table.string('player_id');
      table.timestamp('started_at').defaultTo(db.fn.now());
      table.timestamp('ended_at');
      table.text('data');
    });
  }
];