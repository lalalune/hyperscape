# 0004. Use PostgreSQL for Primary Database

Date: 2025-11-06

## Status

Accepted

## Context

Hyperscape is a multiplayer 3D game with RPG elements requiring persistent storage for player data, game state, inventory systems, skill progression, NPC data, and world state. The database must support complex queries, relational data, ACID transactions, and concurrent access from multiple players.

### Current Situation
- Multiplayer game server managing 50-100 concurrent players (target)
- Complex data relationships:
  - Players have inventory items, skills, stats, positions
  - NPCs have stats, loot tables, spawn locations
  - Items have attributes, durability, ownership
  - World state includes resource nodes, respawn timers
- Real-time updates required for combat, movement, inventory
- Need for data integrity in transactions (attack, trade, quest completion)

### Requirements
- **ACID compliance** - Transactions for combat, trading, inventory management
- **Relational data model** - Complex relationships between players, items, NPCs
- **Performance** - Handle 100+ concurrent connections with real-time queries
- **Scalability** - Support growing player base and data volume
- **JSON support** - Store flexible data structures (custom item properties, quest states)
- **Type safety** - Work well with TypeScript and ORM
- **Reliability** - Data persistence and backup capabilities
- **Railway compatibility** - Easy deployment on chosen platform (ADR-0003)
- **Migration support** - Schema versioning and evolution

### Drivers
- **Data integrity** - Prevent duplication, corruption in multiplayer scenarios
- **Complex queries** - Join operations for inventory, quest, achievement systems
- **Developer experience** - Type-safe database access with minimal boilerplate
- **Operational simplicity** - Managed hosting on Railway
- **Production-ready** - Battle-tested database for game servers

## Decision

We will **use PostgreSQL as the primary database** for all persistent data storage in Hyperscape, accessed via Drizzle ORM for type-safe queries.

### Key Points
- PostgreSQL for all game data (players, NPCs, items, world state)
- Drizzle ORM for type-safe database access
- Schema defined in TypeScript (`src/db/schema.ts`)
- Migrations managed via drizzle-kit
- Railway-managed PostgreSQL instance for production
- Local PostgreSQL for development
- Connection via DATABASE_URL or POSTGRES_URL environment variable

### Implementation Details
```typescript
// drizzle.config.ts
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/hyperscape',
  },
});
```

```json
// package.json
{
  "dependencies": {
    "pg": "^8.13.1",
    "drizzle-orm": "^0.44.6"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.5",
    "@types/pg": "^8.11.10"
  }
}
```

## Alternatives Considered

### Alternative 1: SQLite
**Pros:**
- Extremely simple setup (file-based, no server)
- Zero configuration
- Perfect for single-player or local development
- Very fast for small datasets
- Mentioned in SLA report and package.json

**Cons:**
- **Poor concurrency** - Write locks entire database, unacceptable for multiplayer
- Limited to single server (no horizontal scaling)
- No native replication or backup on Railway
- Weaker JSON support than PostgreSQL
- Not production-ready for 50-100 concurrent players

**Reason for rejection:** SQLite is excellent for single-player scenarios but cannot handle concurrent writes from multiplayer game server. With target of 50-100 concurrent players, write lock contention would create severe bottlenecks.

**Note:** SQLite may be used for local testing or single-player mode, but PostgreSQL is required for multiplayer production.

### Alternative 2: MongoDB
**Pros:**
- Flexible schema (no migrations for simple changes)
- Native JSON document storage
- Horizontal scaling via sharding
- Good for rapidly evolving data models

**Cons:**
- No ACID transactions across documents (until v4.0, limited)
- Weak relational query support (manual joins)
- No foreign key constraints
- Type safety harder to enforce with ORM
- Inventory/skill systems have clear relational structure
- Railway MongoDB addon less mature than PostgreSQL

**Reason for rejection:** Game data is fundamentally relational (players own items, NPCs drop loot, quests have requirements). PostgreSQL's relational model better matches domain. ACID transactions critical for combat/trading integrity.

### Alternative 3: MySQL/MariaDB
**Pros:**
- Popular open-source database
- Good performance
- ACID compliant
- Relational model
- Wide hosting support

**Cons:**
- JSON support weaker than PostgreSQL
- Full-text search less powerful
- Some advanced features missing (arrays, better indexing)
- PostgreSQL has better TypeScript ecosystem
- Railway prefers PostgreSQL

**Reason for rejection:** PostgreSQL offers all MySQL advantages plus superior JSON support, better indexing, and stronger TypeScript/Drizzle integration. No compelling reason to choose MySQL over PostgreSQL.

### Alternative 4: Firebase/Firestore
**Pros:**
- Fully managed, serverless
- Real-time updates built-in
- Offline support
- Good for mobile clients

**Cons:**
- NoSQL document model (weak relational queries)
- Expensive at scale
- Vendor lock-in to Google
- Complex pricing model
- Not Railway-compatible
- Harder to do complex game logic server-side

**Reason for rejection:** Firebase optimized for mobile apps, not game servers. Real-time updates can be implemented with WebSockets. Vendor lock-in and cost concerns outweigh benefits.

### Alternative 5: Redis (in-memory database)
**Pros:**
- Extremely fast (in-memory)
- Good for caching and real-time data
- Pub/sub for real-time events

**Cons:**
- **Not persistent by default** - Data loss on restart unacceptable
- No complex queries or relations
- Expensive memory usage for large datasets
- Not suitable as primary database

**Reason for rejection:** Redis is excellent for caching and sessions but unsuitable as primary database. May use Redis as cache layer on top of PostgreSQL in future.

## Consequences

### Positive
- **ACID transactions** - Safe combat, trading, inventory operations
- **Relational integrity** - Foreign keys prevent orphaned items, invalid references
- **Complex queries** - Efficient joins for inventory, quest, leaderboard systems
- **JSON support** - Store flexible quest state, custom item properties via JSONB
- **Full-text search** - Search items, NPCs, quests by name/description
- **Type safety** - Drizzle ORM provides full TypeScript typing
- **Schema migration** - Versioned migrations via drizzle-kit
- **Railway integration** - One-click PostgreSQL addon, managed backups
- **Battle-tested** - PostgreSQL powers millions of applications
- **Performance** - Handles thousands of players efficiently with proper indexing

### Negative
- **Server required** - Cannot use file-based database like SQLite
- **Schema migrations** - Changes require migration scripts (vs schemaless MongoDB)
- **Learning curve** - Team must understand SQL and relational design
- **Resource usage** - PostgreSQL requires memory and CPU (managed by Railway)
- **Cost** - Railway PostgreSQL addon has usage-based pricing (vs free SQLite)

### Neutral
- SQL knowledge required (standard skill for backend developers)
- Connection pooling needed for high concurrency (standard practice)
- Backup strategy required (handled by Railway)
- Indexing strategy needed for performance (standard database practice)

### Risks
- **Risk 1: Performance degradation with player growth**
  - Mitigation: Proper indexing on frequently queried fields (player_id, item_id)
  - Monitoring: Track query performance, add indexes as needed
  - Scaling: Railway can upgrade database tier if needed

- **Risk 2: Migration failures during deployment**
  - Mitigation: Test migrations locally before production
  - Backup: Railway automatic backups allow rollback
  - Process: Run migrations in separate step before deploying server

- **Risk 3: Database connection exhaustion**
  - Mitigation: Implement connection pooling
  - Configuration: Limit max connections per instance
  - Status: To be implemented as player count grows

- **Risk 4: Railway database costs**
  - Mitigation: Monitor usage, optimize queries
  - Fallback: Can migrate to self-hosted PostgreSQL if needed
  - Assessment: Low risk - PostgreSQL efficient at game data scale

## Implementation

### Action Items
- [x] Add pg and drizzle-orm dependencies
- [x] Configure drizzle.config.ts with PostgreSQL dialect
- [x] Define database schema in src/db/schema.ts
- [x] Set up DATABASE_URL environment variable
- [x] Create initial migration
- [x] Add Railway PostgreSQL addon
- [ ] Implement connection pooling for production
- [ ] Create backup/restore procedures documentation
- [ ] Set up database monitoring and alerting
- [ ] Optimize indexes based on query patterns

### Timeline
- **2025**: PostgreSQL adopted as primary database
- **Nov 6, 2025**: ADR documented
- **Future**: Connection pooling, advanced indexing, read replicas if needed

### Success Metrics
- ✅ Zero data loss incidents - **ACHIEVED**
- ✅ Transaction integrity maintained (no duplicate items, corrupted state) - **ACHIEVED**
- ✅ Query response time < 100ms for 95th percentile - **TO BE MEASURED**
- ✅ Support 100+ concurrent connections - **TO BE TESTED AT SCALE**
- [ ] Database uptime > 99.9% - **MONITORED BY RAILWAY**

## References

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Railway PostgreSQL Guide](https://docs.railway.app/databases/postgresql)
- packages/server/drizzle.config.ts:10 - PostgreSQL dialect
- packages/server/package.json:60 - pg dependency
- Root package.json:102 - pg version override
- Related: ADR-0003 (Railway deployment)

## Notes

**Drizzle ORM choice**: Selected for excellent TypeScript support, zero runtime overhead, and SQL-like query syntax. Alternative ORMs considered:
- **Prisma**: More batteries-included but slower, runtime overhead
- **TypeORM**: Mature but decorator-heavy, not as type-safe
- **Kysely**: Excellent type safety but lower-level (more boilerplate)

Drizzle provides best balance of type safety, performance, and developer experience.

**Schema organization**: Database schema in `src/db/schema.ts` allows sharing types across server package. Migrations in `src/db/migrations` provide version history.

**Environment variables**: Support both `DATABASE_URL` (standard) and `POSTGRES_URL` (Railway default) for flexibility.

**JSON support**: PostgreSQL JSONB type perfect for:
- Quest state (dynamic quest objectives, progress tracking)
- Custom item properties (enchantments, modifications)
- Player settings/preferences
- NPC dialogue trees
- Event logs

**Future optimizations**:
- **Read replicas**: If read load increases, Railway supports read replicas
- **Connection pooling**: PgBouncer for efficient connection management
- **Partitioning**: Large tables (logs, events) can be partitioned by date
- **Materialized views**: Pre-compute leaderboards, statistics
- **Redis caching**: Layer caching on frequently accessed data

**SQLite note**: While SQLite appears in dependencies (better-sqlite3), it's used for local development or testing, not production multiplayer. PostgreSQL is authoritative for production.

**Migration strategy**: Use drizzle-kit for schema changes:
```bash
bun run drizzle-kit generate:pg  # Generate migration
bun run drizzle-kit migrate      # Apply migration
```

**Backup strategy**: Railway provides automated daily backups. Manual backups via pg_dump for critical releases.
