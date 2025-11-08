---
description: Analyze Drizzle database schema structure and relationships
allowed-tools: [Read, Grep, Glob, Bash]
---

# Database Schema Analysis

Comprehensive analysis of the Drizzle database schema structure, relationships, and type safety for asset-forge.

## Schema Overview

Reading all schema files:
- @packages/asset-forge/server/db/schema/index.ts
- @packages/asset-forge/server/db/schema/teams.schema.ts
- @packages/asset-forge/server/db/schema/rigging.schema.ts

## Analysis Tasks

### 1. List All Tables

Identify all table definitions in schema files:

```
Search for sqliteTable or table declarations
```

### 2. Table Relationships

Map foreign key relationships:
- One-to-many relationships
- Many-to-many through junction tables
- Cascading deletes and updates

### 3. Index Analysis

Check for:
- Primary keys
- Unique constraints
- Foreign key indexes
- Custom indexes for performance

### 4. Type Safety

Verify:
- All columns have explicit types
- No `any` types in schema definitions
- Proper use of Drizzle type helpers
- TypeScript inference compatibility

### 5. Schema Quality Metrics

Provide summary of:
- **Total tables**: Count of table definitions
- **Total columns**: Across all tables
- **Relationships**: Number of foreign key constraints
- **Indexes**: Custom indexes defined
- **Issues**: Missing indexes, circular dependencies, type issues

## Common Schema Issues to Check

### Missing Indexes

Tables with foreign keys should have indexes:

```typescript
// ❌ Missing index
export const teams = sqliteTable('teams', {
  userId: text('user_id').notNull(),
});

// ✅ With index
export const teams = sqliteTable('teams', {
  userId: text('user_id').notNull(),
}, (table) => ({
  userIdIdx: index('user_id_idx').on(table.userId),
}));
```

### Circular Dependencies

Check for circular references between tables:
- Can cause migration issues
- May require deferred constraints

### Type Consistency

Ensure consistent types across related columns:
- Foreign keys match primary key types
- Timestamps use consistent format
- JSON columns properly typed

## Expected Schema (asset-forge)

### Core Tables

1. **teams** - Team/project management
   - `id` - Primary key (integer)
   - `name` - Team name (text, required)
   - `description` - Team description (text)
   - `createdAt` - Timestamp
   - `updatedAt` - Timestamp

2. **rigging** - Character rigging configurations
   - `id` - Primary key (integer)
   - `name` - Configuration name
   - `config` - JSON configuration
   - `teamId` - Foreign key to teams
   - `createdAt` - Timestamp

### Relationships

- teams ← (1:many) → rigging
- Additional relationships as schema evolves

## Recommendations

Based on analysis, provide:

1. **Performance Improvements**
   - Missing indexes to add
   - Query optimization opportunities
   - Denormalization candidates

2. **Schema Enhancements**
   - Additional constraints needed
   - Type improvements
   - Better relationship modeling

3. **Migration Planning**
   - Breaking changes to avoid
   - Safe migration strategies
   - Backward compatibility considerations

## Visual Schema

Generate a text-based ERD:

```
┌─────────────────┐
│     teams       │
├─────────────────┤
│ id (PK)         │
│ name            │
│ description     │
│ createdAt       │
│ updatedAt       │
└────────┬────────┘
         │
         │ 1:N
         │
┌────────┴────────┐
│    rigging      │
├─────────────────┤
│ id (PK)         │
│ teamId (FK)     │
│ name            │
│ config (JSON)   │
│ createdAt       │
└─────────────────┘
```

## See Also

- `/migrate` - Generate and apply schema changes
- `/db/studio` - Visual database browser
- @packages/asset-forge/server/db/schema/ - Schema source files
- @packages/asset-forge/drizzle.config.ts - Drizzle configuration
