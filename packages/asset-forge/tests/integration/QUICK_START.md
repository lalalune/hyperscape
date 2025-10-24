# Integration Tests - Quick Start Guide

## 🚀 Getting Started (2 minutes)

### 1. Install Dependencies
```bash
cd /Users/home/hyperscape-1/packages/asset-forge
npm install
```

### 2. Run Tests
```bash
# Run all integration tests
npm run test:integration

# Run authentication tests only
npm run test:integration:auth

# Run admin tests only
npm run test:integration:admin
```

## 📊 What's Implemented

### ✅ Complete Test Infrastructure
- **In-memory SQLite database** for isolated testing
- **Test factories** for creating test data
- **Authentication helpers** for JWT tokens
- **Database utilities** for setup and cleanup

### ✅ Fully Tested Routes (33 tests)

#### Authentication Routes (15 tests)
- ✅ POST /api/auth/login
- ✅ GET /api/auth/me
- ✅ POST /api/auth/logout

#### Admin Routes (18 tests)
- ✅ POST /api/admin/whitelist/add
- ✅ POST /api/admin/whitelist/remove
- ✅ GET /api/admin/whitelist
- ✅ GET /api/admin/users
- ✅ GET /api/admin/stats
- ✅ GET /api/admin/activity

## 📁 File Structure

```
tests/integration/
├── setup.mjs                           # Database initialization
├── helpers/
│   └── factories.mjs                   # Test data factories
├── routes/
│   ├── auth.test.mjs                   # ✅ Authentication tests
│   └── admin.test.mjs                  # ✅ Admin tests
├── README.md                           # Full documentation
├── TEST_IMPLEMENTATION_REPORT.md       # Detailed analysis
├── AGENT_REPORT.json                   # Structured report
└── QUICK_START.md                      # This file
```

## 🎯 Test Coverage Status

| Category | Status | Coverage |
|----------|--------|----------|
| **Infrastructure** | ✅ Complete | 100% |
| **Authentication Routes** | ✅ Complete | 100% (3/3 endpoints) |
| **Admin Routes** | ✅ Complete | 100% (6/6 endpoints) |
| **User Routes** | 🔄 Framework Ready | 0% (0/6 endpoints) |
| **Team Routes** | 🔄 Framework Ready | 0% (0/9 endpoints) |
| **Project Routes** | 🔄 Framework Ready | 0% (0/6 endpoints) |
| **Generation Routes** | 🔄 Framework Ready | 0% (0/12 endpoints) |
| **Other Routes** | 🔄 Framework Ready | 0% (0/34 endpoints) |

**Overall Progress:** 2/16 route groups (12.5%)

## 💡 Quick Examples

### Example 1: Test Authenticated Request
```javascript
import { test, expect } from '@playwright/test'
import request from 'supertest'
import app from '../../../server/api.mjs'
import { createAuthHeader, insertTestUser } from '../helpers/factories.mjs'

test('should get user profile', async () => {
  const user = await insertTestUser(db, { email: 'test@example.com' })

  const response = await request(app)
    .get('/api/user/profile')
    .set('Authorization', createAuthHeader(user))
    .expect(200)

  expect(response.body.user.email).toBe('test@example.com')
})
```

### Example 2: Test Admin Authorization
```javascript
test('should require admin access', async () => {
  const regularUser = await insertTestUser(db, { role: 'user' })
  const adminUser = await insertTestUser(db, { role: 'admin' })

  // Regular user rejected
  await request(app)
    .get('/api/admin/stats')
    .set('Authorization', createAuthHeader(regularUser))
    .expect(403)

  // Admin allowed
  await request(app)
    .get('/api/admin/stats')
    .set('Authorization', createAuthHeader(adminUser))
    .expect(200)
})
```

### Example 3: Test Data Persistence
```javascript
test('should create project in database', async () => {
  const user = await insertTestUser(db, {})

  await request(app)
    .post('/api/projects')
    .set('Authorization', createAuthHeader(user))
    .send({ name: 'Test Project', type: 'rpg' })
    .expect(201)

  const projects = await db.query.projects.findMany()
  expect(projects).toHaveLength(1)
})
```

## 🔧 Available Test Commands

```bash
# Run all integration tests
npm run test:integration

# Run in watch mode (auto-rerun on changes)
npm run test:integration:watch

# Run with coverage report
npm run test:integration:coverage

# Run specific test file
npm run test:integration:auth
npm run test:integration:admin

# Run tests matching pattern
npm run test:integration -- -g "should require admin"
```

## 📖 Documentation

- **[README.md](./README.md)** - Complete testing guide with patterns and best practices
- **[TEST_IMPLEMENTATION_REPORT.md](./TEST_IMPLEMENTATION_REPORT.md)** - Detailed analysis and roadmap
- **[AGENT_REPORT.json](./AGENT_REPORT.json)** - Structured JSON report for CI/CD

## 🚧 Next Steps

### Priority 1: Core Routes (4-6 hours)
Expand coverage to high-traffic routes:
- [ ] User management routes (6 endpoints, ~20 tests)
- [ ] Project routes (6 endpoints, ~25 tests)
- [ ] Team routes (9 endpoints, ~35 tests)

### Priority 2: Generation Routes (3-4 hours)
Test AI generation endpoints:
- [ ] Mock external services (OpenAI, ElevenLabs, Meshy)
- [ ] Quest/NPC/Dialogue generation
- [ ] Voice generation and manifests

### Priority 3: Complete Coverage (2-3 hours)
- [ ] API keys routes
- [ ] Asset routes
- [ ] Prompt routes
- [ ] Weapon detection routes

## ✨ Key Features

### 1. Isolated Testing
Each test runs in a clean database environment:
```javascript
test.beforeEach(async () => {
  clearTestDatabase() // Fresh state for every test
})
```

### 2. Realistic Data
Factory functions create valid test data:
```javascript
const user = await insertTestUser(db, { email: 'test@example.com' })
const project = await insertTestProject(db, user.id, { type: 'rpg' })
```

### 3. Security Testing
Every test validates authentication and authorization:
```javascript
// ❌ Without auth
await request(app).get('/api/protected').expect(401)

// ✅ With valid auth
await request(app)
  .get('/api/protected')
  .set('Authorization', createAuthHeader(user))
  .expect(200)
```

## 🎓 Learning Resources

### Test Patterns
See **README.md** for detailed patterns covering:
- Authentication testing
- Authorization testing
- Input validation
- Database operations
- Error handling

### Factory Functions
Available in `helpers/factories.mjs`:
- `createTestUser()` - Create user object
- `insertTestUser()` - Create and persist user
- `createTestTeam()` - Create team object
- `createTestProject()` - Create project object
- `createAuthHeader()` - Generate auth header

### Database Helpers
Available in `setup.mjs`:
- `initTestDatabase()` - Initialize test DB
- `clearTestDatabase()` - Clear all data
- `closeTestDatabase()` - Close connection
- `getTestDb()` - Get DB instance

## 💪 Success Metrics

### Infrastructure ✅
- [x] Test database setup
- [x] Factory functions
- [x] Helper utilities
- [x] Documentation

### Authentication Routes ✅
- [x] 15 tests covering all scenarios
- [x] 100% endpoint coverage
- [x] Security validation

### Admin Routes ✅
- [x] 18 tests covering all scenarios
- [x] 100% endpoint coverage
- [x] Role-based access control

### Framework Ready 🔄
- [x] Expandable to 200+ tests
- [x] Reusable patterns established
- [x] Clear implementation path

## 🤝 Contributing

To add tests for a new route group:

1. Create test file: `tests/integration/routes/your-route.test.mjs`
2. Copy structure from existing tests
3. Use factories for test data
4. Follow AAA pattern (Arrange-Act-Assert)
5. Test authentication, authorization, validation
6. Update this documentation

## 📊 Report Summary

```json
{
  "status": "Framework Complete",
  "tests_written": 33,
  "route_coverage": "12.5% (2/16 groups)",
  "infrastructure": "100% complete",
  "estimated_completion": "11-16 hours remaining"
}
```

## 🎉 Ready to Use!

The test infrastructure is **production-ready** and **immediately usable**:

1. ✅ Run tests: `npm run test:integration`
2. ✅ Add new tests using documented patterns
3. ✅ Expand coverage following established structure
4. ✅ Use factories and helpers for rapid development

---

**Created by:** API Integration Test Engineer
**Date:** 2025-10-24
**Status:** Framework Complete & Production Ready
**Next:** Expand coverage to remaining routes
