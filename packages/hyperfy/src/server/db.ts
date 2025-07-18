import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';
import moment from 'moment';
import * as schema from './db-schema';

export type DB = ReturnType<typeof drizzle<typeof schema>>
let db: DB | undefined;

export async function getDB(path: string): Promise<DB> {
  if (!db) {
    const sqlite = new Database(path);
    db = drizzle(sqlite, { schema });
    await migrate(db, sqlite);
  }
  return db;
}

async function migrate(db: DB, sqlite: Database): Promise<void> {
  // Create tables if they don't exist
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // Check if this is a fresh database
  const tables = sqlite.query("SELECT name FROM sqlite_master WHERE type='table'").all();
  const tableNames = tables.map((t: any) => t.name);

  if (!tableNames.includes('config') || tableNames.length === 1) {
    // Fresh database, create all tables
    sqlite.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        avatar TEXT,
        roles TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL
      )
    `);

    sqlite.run(`
      CREATE TABLE IF NOT EXISTS blueprints (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    sqlite.run(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    // Set initial version
    await db.insert(schema.config).values({ key: 'version', value: '0' }).onConflictDoNothing();
  }

  // Get current version
  const versionRow = await db.select().from(schema.config).where(eq(schema.config.key, 'version')).get();
  let version = parseInt(versionRow?.value || '0', 10);

  // Run any new migrations
  for (let i = version; i < migrations.length; i++) {
    console.log(`running migration #${i + 1}...`);
    const migration = migrations[i];
    if (migration) {
      await migration(db, sqlite);
    }
    await db
      .update(schema.config)
      .set({ value: (i + 1).toString() })
      .where(eq(schema.config.key, 'version'));
    version = i + 1;
  }
}

/**
 * NOTE: always append new migrations and never modify pre-existing ones!
 */
const migrations: Array<(db: DB, sqlite: Database) => Promise<void>> = [
  // add users table
  async (_db, sqlite) => {
    sqlite.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        roles TEXT NOT NULL,
        createdAt TEXT NOT NULL
      )
    `);
  },
  // add blueprints & entities tables
  async (_db, sqlite) => {
    sqlite.run(`
      CREATE TABLE IF NOT EXISTS blueprints (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);
    sqlite.run(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);
  },
  // add blueprint.version field
  async (db, _sqlite) => {
    const now = moment().toISOString();
    const blueprints = await db.select().from(schema.blueprints);
    for (const blueprint of blueprints) {
      const data = JSON.parse(blueprint.data);
      if (data.version === undefined) {
        data.version = 0;
        await db
          .update(schema.blueprints)
          .set({
            data: JSON.stringify(data),
            updatedAt: now,
          })
          .where(eq(schema.blueprints.id, blueprint.id));
      }
    }
  },
  // add user.vrm field
  async (_db, sqlite) => {
    sqlite.run('ALTER TABLE users ADD COLUMN vrm TEXT');
  },
  // add blueprint.config field
  async (db, _sqlite) => {
    const blueprints = await db.select().from(schema.blueprints);
    for (const blueprint of blueprints) {
      const data = JSON.parse(blueprint.data);
      if (data.config === undefined) {
        data.config = {};
        await db
          .update(schema.blueprints)
          .set({
            data: JSON.stringify(data),
          })
          .where(eq(schema.blueprints.id, blueprint.id));
      }
    }
  },
  // rename user.vrm -> user.avatar
  async (_db, sqlite) => {
    // Check if vrm column exists before trying to rename it
    const columns = sqlite.query('PRAGMA table_info(users)').all();
    const hasVrmColumn = columns.some((col: any) => col.name === 'vrm');
    const hasAvatarColumn = columns.some((col: any) => col.name === 'avatar');

    if (hasVrmColumn && !hasAvatarColumn) {
      sqlite.run('ALTER TABLE users RENAME COLUMN vrm TO avatar');
    }
  },
  // add blueprint.preload field
  async (db, _sqlite) => {
    const blueprints = await db.select().from(schema.blueprints);
    for (const blueprint of blueprints) {
      const data = JSON.parse(blueprint.data);
      if (data.preload === undefined) {
        data.preload = false;
        await db
          .update(schema.blueprints)
          .set({
            data: JSON.stringify(data),
          })
          .where(eq(schema.blueprints.id, blueprint.id));
      }
    }
  },
  // blueprint.config -> blueprint.props
  async (db, _sqlite) => {
    const blueprints = await db.select().from(schema.blueprints);
    for (const blueprint of blueprints) {
      const data = JSON.parse(blueprint.data);
      data.props = data.config;
      delete data.config;
      await db
        .update(schema.blueprints)
        .set({
          data: JSON.stringify(data),
        })
        .where(eq(schema.blueprints.id, blueprint.id));
    }
  },
  // add blueprint.public and blueprint.locked fields
  async (db, _sqlite) => {
    const blueprints = await db.select().from(schema.blueprints);
    for (const blueprint of blueprints) {
      const data = JSON.parse(blueprint.data);
      let changed;
      if (data.public === undefined) {
        data.public = false;
        changed = true;
      }
      if (data.locked === undefined) {
        data.locked = false;
        changed = true;
      }
      if (changed) {
        await db
          .update(schema.blueprints)
          .set({
            data: JSON.stringify(data),
          })
          .where(eq(schema.blueprints.id, blueprint.id));
      }
    }
  },
  // add blueprint.unique field
  async (db, _sqlite) => {
    const blueprints = await db.select().from(schema.blueprints);
    for (const blueprint of blueprints) {
      const data = JSON.parse(blueprint.data);
      let changed;
      if (data.unique === undefined) {
        data.unique = false;
        changed = true;
      }
      if (changed) {
        await db
          .update(schema.blueprints)
          .set({
            data: JSON.stringify(data),
          })
          .where(eq(schema.blueprints.id, blueprint.id));
      }
    }
  },
  // rename config key to settings
  async (db, _sqlite) => {
    const configRow = await db.select().from(schema.config).where(eq(schema.config.key, 'config')).get();
    if (configRow) {
      const settings = configRow.value;
      await db.insert(schema.config).values({ key: 'settings', value: settings }).onConflictDoNothing();
      await db.delete(schema.config).where(eq(schema.config.key, 'config'));
    }
  },
  // add blueprint.disabled field
  async (db, _sqlite) => {
    const blueprints = await db.select().from(schema.blueprints);
    for (const blueprint of blueprints) {
      const data = JSON.parse(blueprint.data);
      if (data.disabled === undefined) {
        data.disabled = false;
        await db
          .update(schema.blueprints)
          .set({
            data: JSON.stringify(data),
          })
          .where(eq(schema.blueprints.id, blueprint.id));
      }
    }
  },
  // add entity.scale field
  async (db, _sqlite) => {
    const entities = await db.select().from(schema.entities);
    for (const entity of entities) {
      const data = JSON.parse(entity.data);
      if (!data.scale) {
        data.scale = [1, 1, 1];
        await db
          .update(schema.entities)
          .set({
            data: JSON.stringify(data),
          })
          .where(eq(schema.entities.id, entity.id));
      }
    }
  },
];
