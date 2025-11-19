# ElizaOS Database Schema Memory

Complete reference for adding custom database schemas to ElizaOS plugins.

## Overview

elizaOS uses Drizzle ORM with PostgreSQL and automatically handles migrations from schema definitions. Plugins can add custom tables that are shared across all agents (no `agentId` field) or agent-specific (with `agentId` field).

## Database Adapter Interface

**IDatabaseAdapter Interface:**
- Agents, Entities, Components
- Memories (with embeddings)
- Rooms, Participants
- Relationships
- Tasks
- Caching
- Logs

**Example Database Adapter Plugin:**
```typescript
export const plugin: Plugin = {
  name: '@elizaos/plugin-sql',
  description: 'A plugin for SQL database access with dynamic schema migrations',
  priority: 0,
  schema,
  init: async (_, runtime: IAgentRuntime) => {
    const dbAdapter = createDatabaseAdapter(config, runtime.agentId);
    runtime.registerDatabaseAdapter(dbAdapter);
  }
};
```

## Schema Definition Patterns

### Shared Tables (No agentId)

**Pattern:** Tables accessible by all agents

```typescript
import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const userPreferencesTable = pgTable(
  'user_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(), // Links to the user
    preferences: jsonb('preferences').default({}).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_user_preferences_user_id').on(table.userId),
  ]
);
```

**Key Points:**
- No `agentId` field = shared across all agents
- Use `userId` or other identifiers to scope data
- elizaOS automatically creates migrations
- Use appropriate indexes for query performance

### Agent-Specific Tables (With agentId)

**Pattern:** Tables scoped to individual agents

```typescript
export const agentDataTable = pgTable(
  'agent_data',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id').notNull(), // Scopes to specific agent
    key: varchar('key', { length: 255 }).notNull(),
    value: jsonb('value').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_agent_data_agent_key').on(table.agentId, table.key),
  ]
);
```

**Key Points:**
- Include `agentId` field for agent-scoped data
- Use composite indexes for common queries
- Consider data isolation requirements

## Repository Pattern

### Basic Repository

**Pattern:** Encapsulate database operations

```typescript
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { UUID } from '@elizaos/core';
import { userPreferencesTable } from '../schema.ts';

export interface UserPreferences {
  id: UUID;
  userId: UUID;
  preferences: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class UserPreferencesRepository {
  constructor(private readonly db: ReturnType<typeof drizzle>) {}

  async upsert(userId: UUID, preferences: Record<string, any>): Promise<UserPreferences> {
    const existing = await this.findByUserId(userId);
    
    if (existing) {
      const [updated] = await this.db
        .update(userPreferencesTable)
        .set({
          preferences,
          updatedAt: new Date(),
        })
        .where(eq(userPreferencesTable.userId, userId))
        .returning();
      return this.mapToUserPreferences(updated);
    } else {
      const [created] = await this.db
        .insert(userPreferencesTable)
        .values({
          userId,
          preferences,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return this.mapToUserPreferences(created);
    }
  }

  async findByUserId(userId: UUID): Promise<UserPreferences | null> {
    const result = await this.db
      .select()
      .from(userPreferencesTable)
      .where(eq(userPreferencesTable.userId, userId))
      .limit(1);
    return result.length > 0 ? this.mapToUserPreferences(result[0]) : null;
  }

  async deleteByUserId(userId: UUID): Promise<boolean> {
    const result = await this.db
      .delete(userPreferencesTable)
      .where(eq(userPreferencesTable.userId, userId))
      .returning();
    return result.length > 0;
  }

  async findAll(offset = 0, limit = 100): Promise<UserPreferences[]> {
    const results = await this.db
      .select()
      .from(userPreferencesTable)
      .offset(offset)
      .limit(limit);
    return results.map(this.mapToUserPreferences);
  }

  private mapToUserPreferences(row: any): UserPreferences {
    return {
      id: row.id as UUID,
      userId: row.userId || row.user_id,
      preferences: row.preferences || {},
      createdAt: row.createdAt || row.created_at,
      updatedAt: row.updatedAt || row.updated_at,
    };
  }
}
```

**Key Points:**
- Encapsulate all database operations
- Map database rows to domain types
- Handle both camelCase and snake_case field names
- Provide CRUD operations
- Use Drizzle ORM query builder

### Advanced Repository Patterns

#### Transactions

```typescript
export class TransactionalRepository {
  async transferPoints(fromUserId: UUID, toUserId: UUID, points: number): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(userPointsTable)
        .set({ 
          points: sql`${userPointsTable.points} - ${points}`,
          updatedAt: new Date()
        })
        .where(eq(userPointsTable.userId, fromUserId));
      
      await tx
        .update(userPointsTable)
        .set({ 
          points: sql`${userPointsTable.points} + ${points}`,
          updatedAt: new Date()
        })
        .where(eq(userPointsTable.userId, toUserId));
      
      await tx.insert(transactionLogTable).values({
        fromUserId,
        toUserId,
        amount: points,
        createdAt: new Date()
      });
    });
  }
}
```

#### Complex Queries

```typescript
export class AnalyticsRepository {
  async getUserActivityStats(userId: UUID, days = 30): Promise<ActivityStats> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const stats = await this.db
      .select({
        totalActions: count(userActionsTable.id),
        uniqueDays: countDistinct(sql`DATE(${userActionsTable.createdAt})`),
        mostCommonAction: sql`MODE() WITHIN GROUP (ORDER BY ${userActionsTable.actionType})`,
      })
      .from(userActionsTable)
      .where(
        and(
          eq(userActionsTable.userId, userId),
          gte(userActionsTable.createdAt, startDate)
        )
      )
      .groupBy(userActionsTable.userId);
    
    return stats[0] || { totalActions: 0, uniqueDays: 0, mostCommonAction: null };
  }
}
```

## Actions for Writing Data

### Action Structure

**Pattern:** Extract structured data and store using repository

```typescript
import type { Action, IAgentRuntime, Memory, ActionResult } from '@elizaos/core';
import { parseKeyValueXml } from '@elizaos/core';
import { UserPreferencesRepository } from '../repositories/user-preferences-repository.ts';

export const storeUserPreferencesAction: Action = {
  name: 'STORE_USER_PREFERENCES',
  description: 'Extract and store user preferences from messages',
  
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';
    return text.includes('preference') || text.includes('prefer') || text.includes('like');
  },
  
  handler: async (runtime: IAgentRuntime, message: Memory) => {
    // 1. Create prompt for LLM to extract structured data
    const extractionPrompt = `
      Extract user preferences from the following message.
      Return in XML format:
      <preferences>
        <theme>light/dark/auto</theme>
        <language>en/es/fr/etc</language>
        <notifications>true/false</notifications>
        <customPreference>value</customPreference>
      </preferences>
      Message: "${message.content.text}"
    `;
    
    // 2. Use runtime's LLM
    const llmResponse = await runtime.completion({
      messages: [{ role: 'system', content: extractionPrompt }]
    });
    
    // 3. Parse the response
    const extractedPreferences = parseKeyValueXml(llmResponse.content);
    
    // 4. Get database and repository
    const db = runtime.databaseAdapter.db;
    const repository = new UserPreferencesRepository(db);
    
    // 5. Store preferences
    const userId = message.userId || message.entityId;
    const stored = await repository.upsert(userId, extractedPreferences);
    
    return {
      success: true,
      data: stored,
      text: 'Your preferences have been saved successfully.'
    };
  }
};
```

**Key Points:**
- Use `parseKeyValueXml` for structured extraction
- Access database via `runtime.databaseAdapter.db`
- Use repository pattern for database operations
- Return ActionResult with success and data

### Batch Operations

```typescript
export const batchImportAction: Action = {
  name: 'BATCH_IMPORT',
  description: 'Import multiple records at once',
  
  handler: async (runtime, message) => {
    const db = runtime.databaseAdapter.db;
    const repository = new DataRepository(db);
    
    const records = JSON.parse(message.content.text);
    
    const results = await db
      .insert(dataTable)
      .values(records.map(r => ({
        ...r,
        createdAt: new Date(),
        updatedAt: new Date()
      })))
      .returning();
    
    return {
      success: true,
      text: `Imported ${results.length} records successfully`,
      data: { importedCount: results.length }
    };
  }
};
```

## Providers for Reading Data

### Provider Structure

**Pattern:** Fetch data and format for agent context

```typescript
import type { Provider, IAgentRuntime, Memory } from '@elizaos/core';
import { UserPreferencesRepository } from '../repositories/user-preferences-repository.ts';

export const userPreferencesProvider: Provider = {
  name: 'USER_PREFERENCES',
  description: 'Provides user preferences to customize agent behavior',
  dynamic: true, // Fetches fresh data on each request
  
  get: async (runtime: IAgentRuntime, message: Memory) => {
    const userId = message.userId || message.entityId;
    const db = runtime.databaseAdapter.db;
    const repository = new UserPreferencesRepository(db);
    const userPrefs = await repository.findByUserId(userId);
    
    if (!userPrefs) {
      return {
        data: { preferences: {} },
        values: { preferences: 'No preferences found' },
        text: ''
      };
    }
    
    const preferencesText = `
# User Preferences
${Object.entries(userPrefs.preferences).map(([key, value]) => 
  `- ${key}: ${value}`
).join('\n')}
    `.trim();
    
    return {
      data: { preferences: userPrefs.preferences },
      values: userPrefs.preferences,
      text: preferencesText // This text is added to agent context
    };
  }
};
```

**Key Points:**
- Set `dynamic: true` for fresh data
- Access database via `runtime.databaseAdapter.db`
- Format text for LLM consumption
- Return ProviderResult with text, values, data

### Caching Provider

```typescript
export const cachedDataProvider: Provider = {
  name: 'CACHED_DATA',
  private: true,
  
  get: async (runtime, message) => {
    const cacheKey = `data_${message.roomId}`;
    const cached = runtime.cacheManager.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
      return cached.data;
    }
    
    const db = runtime.databaseAdapter.db;
    const repository = new DataRepository(db);
    const freshData = await repository.getRoomData(message.roomId);
    
    const result = {
      text: formatData(freshData),
      data: freshData,
      values: { roomData: freshData }
    };
    
    runtime.cacheManager.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
  }
};
```

## Plugin Registration

**Pattern:** Register schema, actions, and providers

```typescript
import type { Plugin } from '@elizaos/core';

export const myPlugin: Plugin = {
  name: 'my-plugin',
  description: 'My custom plugin',
  actions: [storeUserPreferencesAction],
  providers: [userPreferencesProvider],
  schema: customSchema, // Your schema export
};
```

## Important Considerations

### 1. Database Access Pattern

- Always access through `runtime.databaseAdapter.db`
- Use repository classes to encapsulate operations
- Database type is properly typed from runtime adapter

### 2. Shared Data Pattern

- Without `agentId`: All agents can read/write same data
- Use `userId` or other identifiers to scope data
- Consider data consistency across multiple agents

### 3. Type Safety

- Define interfaces for domain types
- Map database rows to domain types in repository
- Handle both camelCase and snake_case field names

### 4. Error Handling

```typescript
try {
  const result = await repository.upsert(userId, preferences);
  return { success: true, data: result };
} catch (error) {
  console.error('Failed to store preferences:', error);
  return { 
    success: false, 
    error: error instanceof Error ? error.message : 'Unknown error' 
  };
}
```

### 5. Migration Strategy

```typescript
export const schemaVersion = 2;
export const migrations = {
  1: async (db) => {
    // Initial schema
  },
  2: async (db) => {
    await db.schema.alterTable('user_preferences', (table) => {
      table.addColumn('version', 'integer').defaultTo(1);
    });
  }
};
```

## Advanced Patterns

### Embeddings and Vector Search

```typescript
export const documentTable = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
  metadata: jsonb('metadata').default({})
});

export class DocumentRepository {
  async searchSimilar(embedding: number[], limit = 10): Promise<Document[]> {
    return await this.db
      .select()
      .from(documentTable)
      .orderBy(sql`${documentTable.embedding} <-> ${embedding}`)
      .limit(limit);
  }
}
```

### Time-Series Data

```typescript
export const metricsTable = pgTable('metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  metric: varchar('metric', { length: 255 }).notNull(),
  value: real('value').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  tags: jsonb('tags').default({})
});

export class MetricsRepository {
  async getTimeSeries(metric: string, hours = 24): Promise<TimeSeries> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return await this.db
      .select({
        time: metricsTable.timestamp,
        value: avg(metricsTable.value),
      })
      .from(metricsTable)
      .where(
        and(
          eq(metricsTable.metric, metric),
          gte(metricsTable.timestamp, since)
        )
      )
      .groupBy(sql`DATE_TRUNC('hour', ${metricsTable.timestamp})`)
      .orderBy(metricsTable.timestamp);
  }
}
```

## Example Flow

1. **User sends message**: "I prefer dark theme and Spanish language"
2. **Action triggered**:
   - LLM extracts: `{ theme: 'dark', language: 'es' }`
   - Repository stores in database
3. **Provider supplies data**:
   - On next interaction, provider fetches preferences
   - Agent context includes: "User Preferences: theme: dark, language: es"
4. **Multiple agents**: Any agent can access this user's preferences

## Summary

To add custom schema to an elizaOS plugin:

1. **Define schema** without `agentId` for shared data
2. **Create repository** classes following elizaOS's pattern
3. **Create actions** to write data using `parseKeyValueXml` for structure
4. **Create providers** to read data and supply to agent context
5. **Register everything** in your plugin configuration

elizaOS handles the rest - migrations, database connections, and making your data available across all agents.

## Documentation References

- **Database Schema**: https://docs.elizaos.ai/plugins/database-schema
- **Plugin Components**: https://docs.elizaos.ai/plugins/components
- **Plugin Development**: https://docs.elizaos.ai/plugins/development
- **Plugin Patterns**: https://docs.elizaos.ai/plugins/patterns

