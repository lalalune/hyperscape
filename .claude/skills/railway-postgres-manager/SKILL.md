# Railway Postgres Manager

## Activation
When the user mentions any of these, activate this skill:
- "railway postgres"
- "railway database"
- "postgres on railway"
- "database migration railway"
- "railway connect postgres"
- "postgresql railway setup"
- "railway database backup"
- "prisma railway"

## Purpose
Manages PostgreSQL databases on Railway, including database creation, migrations, backups, connection management, and integration with ORMs (Prisma, TypeORM, Sequelize). Provides comprehensive database operations for applications deployed on Railway.

## Context
Railway provides managed PostgreSQL databases with automatic SSL encryption, private networking, and seamless integration with Railway services. The database automatically configures DATABASE_URL and provides both public and private connection options.

## Core Capabilities

### 1. Database Provisioning
- Add Postgres to Railway project
- Automatic DATABASE_URL configuration
- Private and public connection strings
- SSL-enabled connections

### 2. Connection Management
- Connect to database via Railway CLI
- Configure connection pooling
- Private network connections
- Public connections for external tools

### 3. Schema Management
- Run database migrations
- ORM integration (Prisma, TypeORM, Drizzle)
- Schema synchronization
- Database seeding

### 4. Backup & Recovery
- Manual backups via pg_dump
- Railway's native backup feature
- Point-in-time recovery
- Backup automation

### 5. Performance Optimization
- Connection pooling
- Query optimization
- Index management
- Performance monitoring

## Implementation Patterns

### 1. Add Postgres to Railway Project

```bash
# Add PostgreSQL database to your project
railway add --database postgres

# Railway automatically creates these variables:
# DATABASE_URL=postgresql://user:password@host:port/dbname
# DATABASE_PUBLIC_URL=postgresql://user:password@public-host:port/dbname
# DATABASE_PRIVATE_URL=postgresql://user:password@private-host:port/dbname
# PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE
```

### 2. Environment Variable Configuration

```env
# Railway provides these automatically
DATABASE_URL=${{Postgres.DATABASE_URL}}

# For private network (recommended for Railway services)
DATABASE_PRIVATE_URL=${{Postgres.DATABASE_PRIVATE_URL}}

# For external connections (pgAdmin, Postico, etc.)
DATABASE_PUBLIC_URL=${{Postgres.DATABASE_PUBLIC_URL}}

# Individual connection components
PGHOST=${{Postgres.PGHOST}}
PGPORT=${{Postgres.PGPORT}}
PGUSER=${{Postgres.PGUSER}}
PGPASSWORD=${{Postgres.PGPASSWORD}}
PGDATABASE=${{Postgres.PGDATABASE}}

# Connection pool settings
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_SSL_REQUIRED=true
```

### 3. Prisma Integration

#### Schema Configuration

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  posts     Post[]

  @@index([email])
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([authorId])
  @@index([published])
}
```

#### Migration Workflow

```bash
# Generate migration locally
npx prisma migrate dev --name init

# Deploy migration on Railway
railway run npx prisma migrate deploy

# Generate Prisma Client
railway run npx prisma generate

# Seed database
railway run npx prisma db seed
```

#### Prisma Client Configuration

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
```

#### Connection Pooling with Prisma

```typescript
// For serverless environments (high connection count)
// Use Prisma Data Proxy or connection pooling

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

// Option 1: Use external connection pooler (PgBouncer)
const connectionString = `${process.env.DATABASE_URL}?pgbouncer=true`;

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: connectionString,
    },
  },
});

// Option 2: Use pg Pool with Prisma
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: {
    rejectUnauthorized: false,
  },
});
```

### 4. TypeORM Integration

```typescript
// src/data-source.ts
import { DataSource } from 'typeorm';
import { User } from './entities/User';
import { Post } from './entities/Post';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  entities: [User, Post],
  migrations: ['src/migrations/**/*.ts'],
  subscribers: [],
  extra: {
    max: 10, // Connection pool size
    min: 2,
  },
});

// Initialize connection
export async function initializeDatabase(): Promise<void> {
  try {
    await AppDataSource.initialize();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}
```

#### TypeORM Migrations

```bash
# Generate migration
railway run npm run typeorm migration:generate -- -n CreateUsers

# Run migrations
railway run npm run typeorm migration:run

# Revert migration
railway run npm run typeorm migration:revert
```

### 5. Drizzle ORM Integration

```typescript
// src/db/schema.ts
import { pgTable, serial, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  emailIdx: index('email_idx').on(table.email),
}));

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  published: boolean('published').default(false),
  authorId: serial('author_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  authorIdx: index('author_idx').on(table.authorId),
  publishedIdx: index('published_idx').on(table.published),
}));
```

```typescript
// src/db/client.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// For query execution
const queryClient = postgres(connectionString, {
  ssl: 'require',
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });

// For migrations
const migrationClient = postgres(connectionString, {
  ssl: 'require',
  max: 1,
});

export const migrationDb = drizzle(migrationClient);
```

#### Drizzle Migrations

```bash
# Generate migration
railway run npx drizzle-kit generate:pg

# Run migrations
railway run npx drizzle-kit push:pg
```

### 6. Raw PostgreSQL Connections

```typescript
// Using node-postgres (pg)
import { Pool, Client } from 'pg';

// Connection pool (recommended)
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20,
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Query with pool
async function queryWithPool<T>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

// Single client (for one-off queries)
async function queryWithClient<T>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  await client.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    await client.end();
  }
}

// Transaction helper
async function transaction<T>(
  callback: (client: Client) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### 7. Database Backup & Recovery

#### Manual Backup

```bash
# Connect to Railway Postgres
railway connect Postgres

# Backup database to file
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup with compression
pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Backup specific tables
pg_dump $DATABASE_URL --table=users --table=posts > backup_tables.sql

# Schema-only backup
pg_dump $DATABASE_URL --schema-only > schema_backup.sql

# Data-only backup
pg_dump $DATABASE_URL --data-only > data_backup.sql
```

#### Restore from Backup

```bash
# Restore from SQL file
psql $DATABASE_URL < backup.sql

# Restore from compressed file
gunzip -c backup.sql.gz | psql $DATABASE_URL

# Restore with Railway CLI
railway run psql $DATABASE_URL < backup.sql
```

#### Automated Backup Script

```typescript
// scripts/backup.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import * as Minio from 'minio';

const execAsync = promisify(exec);

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT!,
  port: parseInt(process.env.MINIO_PORT!),
  useSSL: false,
  accessKey: process.env.MINIO_ROOT_USER!,
  secretKey: process.env.MINIO_ROOT_PASSWORD!,
});

async function backupDatabase(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_${timestamp}.sql.gz`;
  const localPath = `/tmp/${filename}`;

  try {
    // Create backup
    console.log('Creating database backup...');
    await execAsync(
      `pg_dump ${process.env.DATABASE_URL} | gzip > ${localPath}`
    );

    // Upload to MinIO
    console.log('Uploading backup to MinIO...');
    await minioClient.fPutObject('backups', filename, localPath);

    // Clean up local file
    await execAsync(`rm ${localPath}`);

    console.log(`Backup completed: ${filename}`);
  } catch (error) {
    console.error('Backup failed:', error);
    throw error;
  }
}

// Run backup
backupDatabase()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
```

### 8. Connection via Railway CLI

```bash
# Connect to Postgres shell
railway connect Postgres

# Once connected, you can run SQL:
\dt              # List tables
\d users         # Describe users table
\l               # List databases
\du              # List users
\q               # Quit

# Run SQL queries
SELECT * FROM users LIMIT 10;

# Create index
CREATE INDEX idx_users_email ON users(email);

# Analyze query performance
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'user@example.com';
```

### 9. Performance Optimization

#### Connection Pooling Configuration

```typescript
// lib/db.ts
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },

  // Pool configuration
  max: 20,                    // Maximum pool size
  min: 5,                     // Minimum pool size
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Timeout connection attempts after 2s

  // Statement timeout
  statement_timeout: 10000,   // 10 seconds

  // Query timeout
  query_timeout: 10000,       // 10 seconds
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await pool.end();
});
```

#### Query Optimization

```sql
-- Create indexes for common queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_posts_author_id ON posts(author_id);
CREATE INDEX idx_posts_published ON posts(published) WHERE published = true;

-- Composite indexes
CREATE INDEX idx_posts_author_published ON posts(author_id, published);

-- Full-text search index
CREATE INDEX idx_posts_search ON posts USING gin(to_tsvector('english', title || ' ' || content));

-- Analyze query performance
EXPLAIN ANALYZE
SELECT p.*, u.name as author_name
FROM posts p
JOIN users u ON p.author_id = u.id
WHERE p.published = true
ORDER BY p.created_at DESC
LIMIT 10;
```

## Best Practices

### 1. Connection Management
- **Use connection pooling** for all production applications
- **Set appropriate pool sizes** (max 20 for most applications)
- **Configure timeouts** to prevent hanging connections
- **Use private networking** for Railway service connections
- **Close connections gracefully** on application shutdown

### 2. Migration Safety
- **Always backup** before running migrations
- **Test migrations** in staging environment first
- **Use transactions** in migrations when possible
- **Make migrations reversible** with down migrations
- **Run migrations** during low-traffic periods

### 3. Security
- **Never expose DATABASE_PUBLIC_URL** in client-side code
- **Use environment variables** for credentials
- **Enable SSL** for all connections
- **Rotate credentials** periodically
- **Use least privilege** for database users
- **Sanitize inputs** to prevent SQL injection

### 4. Performance
- **Create indexes** for frequently queried columns
- **Use prepared statements** to prevent SQL injection and improve performance
- **Implement query timeouts** to prevent long-running queries
- **Monitor slow queries** and optimize them
- **Use connection pooling** to reduce connection overhead
- **Consider read replicas** for read-heavy workloads (future Railway feature)

### 5. Backup Strategy
- **Automate backups** with scheduled tasks
- **Store backups** in multiple locations (MinIO + external)
- **Test restore procedures** regularly
- **Keep multiple backup versions** (7 daily, 4 weekly, 12 monthly)
- **Use Railway's native backup feature** for point-in-time recovery

### 6. Monitoring
- **Log slow queries** for optimization
- **Monitor connection pool usage**
- **Track database size growth**
- **Set up alerts** for connection pool exhaustion
- **Monitor query performance** with EXPLAIN ANALYZE

## Common Workflows

### 1. Initial Database Setup

```bash
# Add Postgres to project
railway add --database postgres

# Initialize Prisma (or your ORM)
npx prisma init

# Create migration
npx prisma migrate dev --name init

# Deploy to Railway
railway run npx prisma migrate deploy
railway run npx prisma generate
railway run npx prisma db seed
```

### 2. Running Migrations

```bash
# Test migration locally with Railway variables
railway run npx prisma migrate dev

# Deploy migration to production
railway environment production
railway run npx prisma migrate deploy
```

### 3. Database Seeding

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create users
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'alice@example.com',
        name: 'Alice',
      },
    }),
    prisma.user.create({
      data: {
        email: 'bob@example.com',
        name: 'Bob',
      },
    }),
  ]);

  // Create posts
  await Promise.all([
    prisma.post.create({
      data: {
        title: 'First Post',
        content: 'Hello World!',
        published: true,
        authorId: users[0].id,
      },
    }),
    prisma.post.create({
      data: {
        title: 'Second Post',
        content: 'Railway is awesome!',
        published: true,
        authorId: users[1].id,
      },
    }),
  ]);

  console.log('Database seeded successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

```bash
# Run seed script
railway run npm run seed
```

### 4. Database Reset (Development Only)

```bash
# WARNING: This deletes all data!
railway environment development
railway run npx prisma migrate reset
```

### 5. Query Database from CLI

```bash
# Connect to database
railway connect Postgres

# Run queries
SELECT COUNT(*) FROM users;
SELECT * FROM posts WHERE published = true;

# Check database size
SELECT pg_size_pretty(pg_database_size(current_database()));

# List all tables
\dt
```

## Troubleshooting

### Connection Errors
- Verify DATABASE_URL is set correctly
- Check if using SSL (required by Railway)
- Ensure service is in same project for private networking
- Verify Railway Postgres service is running
- Check connection pool configuration

### Migration Failures
- Check migration syntax for errors
- Verify database schema state
- Ensure migrations are run in correct order
- Check for conflicting migrations
- Review migration logs for specific errors

### Performance Issues
- Review slow query logs
- Check for missing indexes
- Verify connection pool isn't exhausted
- Monitor Railway database metrics
- Use EXPLAIN ANALYZE to understand query plans

### SSL/TLS Errors
- Always set `ssl: { rejectUnauthorized: false }` for Railway
- Verify SSL is enabled in connection string
- Check if SSL certificates are up to date

## Resources

- Railway Postgres Docs: https://docs.railway.com/guides/postgresql
- Prisma Documentation: https://www.prisma.io/docs
- TypeORM Documentation: https://typeorm.io/
- Drizzle Documentation: https://orm.drizzle.team/
- PostgreSQL Documentation: https://www.postgresql.org/docs/

## Notes
- Railway Postgres includes automatic SSL encryption
- DATABASE_URL uses private networking by default
- Use DATABASE_PUBLIC_URL for external connections (pgAdmin, etc.)
- Railway provides automatic backups in Pro plans
- Connection pooling is essential for serverless deployments
- Always test migrations in staging before production
