import knex from 'knex'
import type { Knex } from 'knex'
import moment from 'moment'
import { getDB as getMockDB } from './db-mock'

interface PluginMigration {
  name: string;
  up: (knex: Knex) => Promise<void>;
  down?: (knex: Knex) => Promise<void>;
}

// Global registry for plugin migrations
const pluginMigrations: Record<string, PluginMigration[]> = {};

export function registerPluginMigrations(pluginName: string, migrations: PluginMigration[]): void {
  pluginMigrations[pluginName] = migrations;
  console.log(`[DB] Registered ${migrations.length} migrations for plugin: ${pluginName}`);
}

async function runPluginMigrations(knex: Knex): Promise<void> {
  for (const [pluginName, migrations] of Object.entries(pluginMigrations)) {
    const migrationTableName = `${pluginName}_migrations`;
    
    // Create plugin migration tracking table if it doesn't exist
    const exists = await knex.schema.hasTable(migrationTableName);
    if (!exists) {
      await knex.schema.createTable(migrationTableName, table => {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.timestamp('executed_at').defaultTo(knex.fn.now());
      });
    }
    
    // Get executed migrations
    const executed = await knex(migrationTableName).select('name');
    const executedNames = new Set(executed.map(row => row.name));
    
    // Run pending migrations
    for (const migration of migrations) {
      if (!executedNames.has(migration.name)) {
        console.log(`[DB] Running plugin migration: ${pluginName}.${migration.name}`);
        await migration.up(knex);
        await knex(migrationTableName).insert({ name: migration.name });
      }
    }
  }
}

let db: Knex | undefined

export async function getDB(path: string): Promise<Knex> {
  if (!db) {
    try {
      db = knex({
        client: 'better-sqlite3',
        connection: {
          filename: path,
        },
        useNullAsDefault: true,
      })
      await migrate(db)
    } catch (error) {
      console.log('[DB] better-sqlite3 not available, using mock database')
      // Fallback to mock database
      db = await getMockDB(path) as Knex
    }
  }
  return db
}

async function migrate(db: Knex): Promise<void> {
  // ensure we have our config table
  const exists = await db.schema.hasTable('config')
  if (!exists) {
    await db.schema.createTable('config', table => {
      table.string('key').primary()
      table.string('value')
    })
    await db('config').insert({ key: 'version', value: '0' })
  }
  // get current version
  const versionRow = await db('config').where('key', 'version').first()
  let version = parseInt(versionRow.value)
  // run any new migrations
  for (let i = version; i < migrations.length; i++) {
    console.log(`running migration #${i + 1}...`)
    const migration = migrations[i]
    if (migration) {
      await migration(db)
    }
    await db('config')
      .where('key', 'version')
      .update('value', (i + 1).toString())
    version = i + 1
  }
  
  // Run plugin migrations after core migrations
  await runPluginMigrations(db);
  
  console.log('[DB] All migrations completed')
}

/**
 * NOTE: always append new migrations and never modify pre-existing ones!
 */
const migrations: Array<(db: Knex) => Promise<void>> = [
  // add users table
  async db => {
    await db.schema.createTable('users', table => {
      table.string('id').primary()
      table.string('name').notNullable()
      table.string('roles').notNullable()
      table.timestamp('createdAt').notNullable()
    })
  },
  // add blueprints & entities tables
  async db => {
    await db.schema.createTable('blueprints', table => {
      table.string('id').primary()
      table.text('data').notNullable()
      table.timestamp('createdAt').notNullable()
      table.timestamp('updatedAt').notNullable()
    })
    await db.schema.createTable('entities', table => {
      table.string('id').primary()
      table.text('data').notNullable()
      table.timestamp('createdAt').notNullable()
      table.timestamp('updatedAt').notNullable()
    })
  },
  // add blueprint.version field
  async db => {
    const now = moment().toISOString()
    const blueprints = await db('blueprints')
    for (const blueprint of blueprints) {
      const data = JSON.parse(blueprint.data)
      if (data.version === undefined) {
        data.version = 0
        await db('blueprints')
          .where('id', blueprint.id)
          .update({
            data: JSON.stringify(data),
            updatedAt: now,
          })
      }
    }
  },
  // add user.vrm field
  async db => {
    await db.schema.alterTable('users', table => {
      table.string('vrm').nullable()
    })
  },
  // add blueprint.config field
  async db => {
    const blueprints = await db('blueprints')
    for (const blueprint of blueprints) {
      const data = JSON.parse(blueprint.data)
      if (data.config === undefined) {
        data.config = {}
        await db('blueprints')
          .where('id', blueprint.id)
          .update({
            data: JSON.stringify(data),
          })
      }
    }
  },
  // rename user.vrm -> user.avatar
  async db => {
    await db.schema.alterTable('users', table => {
      table.renameColumn('vrm', 'avatar')
    })
  },
  // add blueprint.preload field
  async db => {
    const blueprints = await db('blueprints')
    for (const blueprint of blueprints) {
      const data = JSON.parse(blueprint.data)
      if (data.preload === undefined) {
        data.preload = false
        await db('blueprints')
          .where('id', blueprint.id)
          .update({
            data: JSON.stringify(data),
          })
      }
    }
  },
  // blueprint.config -> blueprint.props
  async db => {
    const blueprints = await db('blueprints')
    for (const blueprint of blueprints) {
      const data = JSON.parse(blueprint.data)
      data.props = data.config
      delete data.config
      await db('blueprints')
        .where('id', blueprint.id)
        .update({
          data: JSON.stringify(data),
        })
    }
  },
  // add blueprint.public and blueprint.locked fields
  async db => {
    const blueprints = await db('blueprints')
    for (const blueprint of blueprints) {
      const data = JSON.parse(blueprint.data)
      let changed
      if (data.public === undefined) {
        data.public = false
        changed = true
      }
      if (data.locked === undefined) {
        data.locked = false
        changed = true
      }
      if (changed) {
        await db('blueprints')
          .where('id', blueprint.id)
          .update({
            data: JSON.stringify(data),
          })
      }
    }
  },
  // add blueprint.unique field
  async db => {
    const blueprints = await db('blueprints')
    for (const blueprint of blueprints) {
      const data = JSON.parse(blueprint.data)
      let changed
      if (data.unique === undefined) {
        data.unique = false
        changed = true
      }
      if (changed) {
        await db('blueprints')
          .where('id', blueprint.id)
          .update({
            data: JSON.stringify(data),
          })
      }
    }
  },
  // rename config key to settings
  async db => {
    let config = await db('config').where('key', 'config').first()
    if (config) {
      const settings = config.value
      await db('config').insert({ key: 'settings', value: settings })
      await db('config').where('key', 'config').delete()
    }
  },
  // add blueprint.disabled field
  async db => {
    const blueprints = await db('blueprints')
    for (const blueprint of blueprints) {
      const data = JSON.parse(blueprint.data)
      if (data.disabled === undefined) {
        data.disabled = false
        await db('blueprints')
          .where('id', blueprint.id)
          .update({
            data: JSON.stringify(data),
          })
      }
    }
  },
  // add entity.scale field
  async db => {
    const entities = await db('entities')
    for (const entity of entities) {
      const data = JSON.parse(entity.data)
      if (!data.scale) {
        data.scale = [1, 1, 1]
        await db('entities')
          .where('id', entity.id)
          .update({
            data: JSON.stringify(data),
          })
      }
    }
  },
]
