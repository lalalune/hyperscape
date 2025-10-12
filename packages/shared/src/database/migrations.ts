import type { Knex } from 'knex';

export interface Migration {
  name: string;
  up: (knex: Knex) => Promise<void>;
  down?: (knex: Knex) => Promise<void>;
}

export const Migrations: Migration[] = [
  {
    name: 'create_world_chunks',
    up: async (knex: Knex) => {
      await knex.schema.createTable('world_chunks', table => {
        table.integer('chunk_x').notNullable();
        table.integer('chunk_z').notNullable();
        table.string('biome').notNullable();
        table.text('height_data').notNullable();
        table.text('resource_states').nullable();
        table.text('mob_spawn_states').nullable();
        table.text('player_modifications').nullable();
        table.integer('chunk_seed').nullable();
        table.datetime('last_active_time').nullable();
        table.integer('player_count').defaultTo(0);
        table.boolean('needs_reset').defaultTo(false);
        table.timestamps(true, true);
        table.primary(['chunk_x', 'chunk_z']);
      });
    },
    down: async (knex: Knex) => {
      await knex.schema.dropTableIfExists('world_chunks');
    }
  },
  {
    name: 'create_player_sessions',
    up: async (knex: Knex) => {
      await knex.schema.createTable('player_sessions', table => {
        table.string('session_id').primary();
        table.string('player_id').references('id').inTable('players').onDelete('CASCADE');
        table.string('player_token').notNullable();
        table.datetime('start_time').defaultTo(knex.fn.now());
        table.datetime('end_time').nullable();
        table.datetime('last_activity').defaultTo(knex.fn.now());
        table.datetime('last_save_time').defaultTo(knex.fn.now());
        table.integer('auto_save_interval').defaultTo(30);
        table.boolean('is_active').defaultTo(true);
        table.string('disconnect_reason').nullable();
      });
    },
    down: async (knex: Knex) => {
      await knex.schema.dropTableIfExists('player_sessions');
    }
  },
  {
    name: 'create_chunk_activity',
    up: async (knex: Knex) => {
      await knex.schema.createTable('chunk_activity', table => {
        table.increments('id').primary();
        table.integer('chunk_x').notNullable();
        table.integer('chunk_z').notNullable();
        table.string('player_id').references('id').inTable('players').onDelete('CASCADE');
        table.datetime('entered_at').defaultTo(knex.fn.now());
        table.datetime('left_at').nullable();
        table.integer('session_duration').defaultTo(0);
      });
    },
    down: async (knex: Knex) => {
      await knex.schema.dropTableIfExists('chunk_activity');
    }
  },
  {
    name: 'create_players',
    up: async (knex: Knex) => {
      await knex.schema.createTable('players', table => {
        table.string('id').primary();
        table.string('hyperscape_player_id').notNullable().unique();
        table.string('name').notNullable();
        table.integer('attack_level').defaultTo(1);
        table.bigInteger('attack_xp').defaultTo(0);
        table.integer('strength_level').defaultTo(1);
        table.bigInteger('strength_xp').defaultTo(0);
        table.integer('defense_level').defaultTo(1);
        table.bigInteger('defense_xp').defaultTo(0);
        table.integer('ranged_level').defaultTo(1);
        table.bigInteger('ranged_xp').defaultTo(0);
        table.integer('woodcutting_level').defaultTo(1);
        table.bigInteger('woodcutting_xp').defaultTo(0);
        table.integer('fishing_level').defaultTo(1);
        table.bigInteger('fishing_xp').defaultTo(0);
        table.integer('firemaking_level').defaultTo(1);
        table.bigInteger('firemaking_xp').defaultTo(0);
        table.integer('cooking_level').defaultTo(1);
        table.bigInteger('cooking_xp').defaultTo(0);
        table.integer('constitution_level').defaultTo(10);
        table.bigInteger('constitution_xp').defaultTo(1154);
        table.integer('current_hitpoints').defaultTo(100);
        table.integer('max_hitpoints').defaultTo(100);
        table.decimal('position_x').defaultTo(0);
        table.decimal('position_y').defaultTo(0);
        table.decimal('position_z').defaultTo(0);
        table.boolean('alive').defaultTo(true);
        table.timestamps(true, true);
      });
    },
    down: async (knex: Knex) => {
      await knex.schema.dropTableIfExists('players');
    }
  },
  {
    name: 'create_inventory',
    up: async (knex: Knex) => {
      await knex.schema.createTable('inventory', table => {
        table.increments('id').primary();
        table.string('player_id').references('id').inTable('players').onDelete('CASCADE');
        table.integer('slot_index').notNullable();
        table.integer('item_id').notNullable();
        table.integer('quantity').defaultTo(1);
        table.json('item_data').nullable();
        table.unique(['player_id', 'slot_index']);
        table.timestamps(true, true);
      });
    },
    down: async (knex: Knex) => {
      await knex.schema.dropTableIfExists('inventory');
    }
  },
  {
    name: 'create_equipment',
    up: async (knex: Knex) => {
      await knex.schema.createTable('equipment', table => {
        table.increments('id').primary();
        table.string('player_id').references('id').inTable('players').onDelete('CASCADE');
        table.string('slot_name').notNullable(); // weapon, shield, helmet, body, legs, arrows
        table.integer('item_id').nullable();
        table.integer('quantity').defaultTo(1);
        table.json('item_data').nullable();
        table.unique(['player_id', 'slot_name']);
        table.timestamps(true, true);
      });
    },
    down: async (knex: Knex) => {
      await knex.schema.dropTableIfExists('equipment');
    }
  },
  {
    name: 'create_items',
    up: async (knex: Knex) => {
      await knex.schema.createTable('items', table => {
        table.integer('id').primary();
        table.string('name').notNullable();
        table.string('type').notNullable(); // weapon, tool, resource, food, etc
        table.string('tier').nullable(); // bronze, steel, mithril
        table.boolean('stackable').defaultTo(false);
        table.integer('attack_level').nullable();
        table.integer('strength_level').nullable();
        table.integer('defense_level').nullable();
        table.integer('ranged_level').nullable();
        table.integer('attack_bonus').defaultTo(0);
        table.integer('strength_bonus').defaultTo(0);
        table.integer('defense_bonus').defaultTo(0);
        table.integer('ranged_bonus').defaultTo(0);
        table.integer('heals').nullable(); // For food items
        table.json('metadata').nullable(); // Extra item data
        table.timestamps(true, true);
      });
    },
    down: async (knex: Knex) => {
      await knex.schema.dropTableIfExists('items');
    }
  },
  {
    name: 'alter_users_add_privy_columns',
    up: async (knex: Knex) => {
      const hasPrivy = await knex.schema.hasColumn('users', 'privyUserId');
      const hasFarcaster = await knex.schema.hasColumn('users', 'farcasterFid');
      if (!hasPrivy || !hasFarcaster) {
        await knex.schema.alterTable('users', table => {
          if (!hasPrivy) table.string('privyUserId').nullable();
          if (!hasFarcaster) table.string('farcasterFid').nullable();
        });
      }
      // Create indexes (ignore if already exist)
      try { await knex.schema.alterTable('users', t => { t.index(['privyUserId'], 'idx_users_privy'); }); } catch {}
      try { await knex.schema.alterTable('users', t => { t.index(['farcasterFid'], 'idx_users_farcaster'); }); } catch {}
    },
    down: async (knex: Knex) => {
      // Non-destructive down: drop indexes only (keep columns to preserve data)
      try { await knex.schema.alterTable('users', t => { t.dropIndex(['privyUserId'], 'idx_users_privy'); }); } catch {}
      try { await knex.schema.alterTable('users', t => { t.dropIndex(['farcasterFid'], 'idx_users_farcaster'); }); } catch {}
    }
  }
];