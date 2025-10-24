# API Integration Tests

## Overview

Comprehensive integration test suite for Asset Forge API endpoints. Tests validate API contracts, authentication, authorization, data persistence, and error handling.

## Quick Start

```bash
# Install dependencies (if not already installed)
npm install

# Run all integration tests
npm run test:integration

# Run specific test file
npm run test:integration -- routes/auth.test.mjs

# Run with coverage
npm run test:integration:coverage

# Run in watch mode (for development)
npm run test:integration:watch
```

## Test Structure

```
tests/integration/
├── setup.mjs                    # Test database initialization
├── helpers/
│   └── factories.mjs            # Test data factories
├── routes/
│   ├── auth.test.mjs            # Authentication tests ✅
│   ├── admin.test.mjs           # Admin routes tests ✅
│   ├── user.test.mjs            # User management tests (TODO)
│   ├── teams.test.mjs           # Team routes tests (TODO)
│   ├── projects.test.mjs        # Project routes tests (TODO)
│   ├── api-keys.test.mjs        # API key routes tests (TODO)
│   ├── assets.test.mjs          # Asset routes tests (TODO)
│   ├── generation.test.mjs      # Generation routes tests (TODO)
│   ├── voice.test.mjs           # Voice routes tests (TODO)
│   └── prompts.test.mjs         # Prompt routes tests (TODO)
├── TEST_IMPLEMENTATION_REPORT.md # Detailed test report
└── README.md                     # This file
```

## Test Coverage

### Completed ✅
- **Authentication Routes** (15 tests)
  - Login/logout
  - Token validation
  - User session management

- **Admin Routes** (18 tests)
  - Whitelist management
  - User administration
  - Platform statistics
  - Activity logs

### In Progress 🔄
- User management routes
- Team collaboration routes
- Project CRUD routes
- Asset generation routes

## Writing Tests

### Basic Test Pattern

```javascript
import { test, expect } from '@playwright/test'
import request from 'supertest'
import app from '../../../server/api.mjs'
import { initTestDatabase, clearTestDatabase, closeTestDatabase } from '../setup.mjs'
import { createAuthHeader, insertTestUser } from '../helpers/factories.mjs'

test.describe('Route Group', () => {
  let db = null

  test.beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.JWT_SECRET = 'test-secret-key-minimum-32-chars-long-12345'
    db = initTestDatabase()
  })

  test.afterAll(async () => {
    closeTestDatabase()
  })

  test.beforeEach(async () => {
    clearTestDatabase()
  })

  test('should handle request correctly', async () => {
    const user = await insertTestUser(db, {})

    const response = await request(app)
      .get('/api/endpoint')
      .set('Authorization', createAuthHeader(user))
      .expect(200)

    expect(response.body).toMatchObject({
      success: true,
    })
  })
})
```

### Using Test Factories

```javascript
import {
  createTestUser,
  createTestTeam,
  createTestProject,
  createAuthHeader,
  insertTestUser,
  insertTestProject,
} from '../helpers/factories.mjs'

// Create user in memory (not persisted)
const user = createTestUser({ email: 'test@example.com' })

// Create and persist user to database
const dbUser = await insertTestUser(db, { email: 'test@example.com' })

// Create auth header for requests
const authHeader = createAuthHeader(dbUser)

// Create related entities
const project = await insertTestProject(db, dbUser.id, {
  name: 'Test Project',
  type: 'rpg',
})
```

### Testing Authentication

```javascript
// Test unauthenticated access
test('should require authentication', async () => {
  await request(app)
    .get('/api/protected-route')
    .expect(401)
})

// Test authenticated access
test('should allow authenticated users', async () => {
  const user = await insertTestUser(db, {})

  await request(app)
    .get('/api/protected-route')
    .set('Authorization', createAuthHeader(user))
    .expect(200)
})
```

### Testing Authorization

```javascript
// Test admin-only routes
test('should require admin role', async () => {
  const user = await insertTestUser(db, { role: 'user' })
  const admin = await insertTestUser(db, { role: 'admin' })

  // Regular user rejected
  await request(app)
    .get('/api/admin/endpoint')
    .set('Authorization', createAuthHeader(user))
    .expect(403)

  // Admin allowed
  await request(app)
    .get('/api/admin/endpoint')
    .set('Authorization', createAuthHeader(admin))
    .expect(200)
})

// Test resource ownership
test('should only allow resource owner', async () => {
  const owner = await insertTestUser(db, {})
  const other = await insertTestUser(db, {})
  const project = await insertTestProject(db, owner.id, {})

  // Owner can access
  await request(app)
    .get(`/api/projects/${project.id}`)
    .set('Authorization', createAuthHeader(owner))
    .expect(200)

  // Non-owner rejected
  await request(app)
    .get(`/api/projects/${project.id}`)
    .set('Authorization', createAuthHeader(other))
    .expect(403)
})
```

### Testing Validation

```javascript
// Test required fields
test('should validate required fields', async () => {
  const user = await insertTestUser(db, {})

  const response = await request(app)
    .post('/api/projects')
    .set('Authorization', createAuthHeader(user))
    .send({ name: 'Test' }) // Missing 'type' field
    .expect(400)

  expect(response.body.error).toContain('required')
})

// Test input format
test('should validate input format', async () => {
  const response = await request(app)
    .post('/api/endpoint')
    .send({ email: 'not-an-email' })
    .expect(400)

  expect(response.body.error).toContain('invalid')
})
```

### Testing Database Operations

```javascript
// Test data persistence
test('should persist data correctly', async () => {
  const user = await insertTestUser(db, {})

  await request(app)
    .post('/api/projects')
    .set('Authorization', createAuthHeader(user))
    .send({ name: 'Test Project', type: 'rpg' })
    .expect(201)

  const projects = await db.query.projects.findMany()
  expect(projects).toHaveLength(1)
  expect(projects[0].name).toBe('Test Project')
})

// Test cascade deletion
test('should cascade delete related records', async () => {
  const user = await insertTestUser(db, {})
  const project = await insertTestProject(db, user.id, {})
  const asset = await insertTestAsset(db, project.id, user.id, {})

  await request(app)
    .delete(`/api/projects/${project.id}`)
    .set('Authorization', createAuthHeader(user))
    .expect(200)

  const assets = await db.query.assets.findMany()
  expect(assets).toHaveLength(0)
})
```

## Best Practices

### 1. Test Isolation
- Each test should be independent
- Use `clearTestDatabase()` in `beforeEach`
- Don't rely on test execution order

### 2. Meaningful Test Names
```javascript
// ❌ Bad
test('test 1', async () => { ... })

// ✅ Good
test('should return 401 when user is not authenticated', async () => { ... })
```

### 3. Arrange-Act-Assert Pattern
```javascript
test('should create project successfully', async () => {
  // Arrange
  const user = await insertTestUser(db, {})
  const projectData = { name: 'Test', type: 'rpg' }

  // Act
  const response = await request(app)
    .post('/api/projects')
    .set('Authorization', createAuthHeader(user))
    .send(projectData)

  // Assert
  expect(response.status).toBe(201)
  expect(response.body.project.name).toBe('Test')
})
```

### 4. Test Edge Cases
- Empty inputs
- Maximum length inputs
- Invalid formats
- Boundary values
- Concurrent operations

### 5. Error Messages
```javascript
test('should return descriptive error messages', async () => {
  const response = await request(app)
    .post('/api/endpoint')
    .send({ invalid: 'data' })
    .expect(400)

  // Verify error message is helpful
  expect(response.body.error).toBeDefined()
  expect(response.body.message).toContain('required')
})
```

## Debugging Tests

### Run Single Test
```bash
# Run specific test file
npm run test:integration -- routes/auth.test.mjs

# Run specific test by name
npm run test:integration -- -g "should return 401"
```

### Enable Debug Output
```javascript
test('debug test', async () => {
  const response = await request(app).get('/api/endpoint')

  console.log('Status:', response.status)
  console.log('Body:', JSON.stringify(response.body, null, 2))
  console.log('Headers:', response.headers)
})
```

### Inspect Database State
```javascript
test('check database', async () => {
  const user = await insertTestUser(db, {})

  // Check database state
  const users = await db.query.users.findMany()
  console.log('Users in DB:', users)

  // Continue with test...
})
```

## Environment Variables

Test environment variables are set in test setup:

```javascript
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-key-minimum-32-chars-long-12345'
process.env.DATABASE_PATH = ':memory:' // In-memory database
```

## Contributing

### Adding New Tests

1. Create test file in `tests/integration/routes/`
2. Follow existing test patterns
3. Use test factories for data creation
4. Ensure tests are isolated and independent
5. Document any special setup requirements

### Test Checklist

- [ ] Tests follow AAA pattern (Arrange-Act-Assert)
- [ ] Tests are isolated and independent
- [ ] Test names are descriptive
- [ ] Edge cases are covered
- [ ] Error scenarios are tested
- [ ] Database state is verified
- [ ] Authentication is tested
- [ ] Authorization is tested
- [ ] Input validation is tested

## Troubleshooting

### "Database locked" Error
Ensure `clearTestDatabase()` is called in `beforeEach` and database connections are properly closed.

### "Authentication required" in All Tests
Check that `JWT_SECRET` is set in test setup:
```javascript
process.env.JWT_SECRET = 'test-secret-key-minimum-32-chars-long-12345'
```

### Tests Timing Out
- Check for unclosed database connections
- Verify async/await usage
- Increase test timeout if needed

### Flaky Tests
- Ensure test isolation (use `clearTestDatabase()`)
- Check for race conditions
- Verify test data cleanup

## Resources

- [Playwright Test Documentation](https://playwright.dev/docs/test-intro)
- [SuperTest Documentation](https://github.com/ladjs/supertest)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [Better-SQLite3 Documentation](https://github.com/WiseLibs/better-sqlite3)

## Support

For questions or issues:
1. Check existing test examples
2. Review test patterns in this README
3. Consult TEST_IMPLEMENTATION_REPORT.md
4. Open an issue with reproduction steps
