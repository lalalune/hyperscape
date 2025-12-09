# Quick Start - Branch Validation Tests

## TL;DR

```bash
cd /Users/home/hyperscape/packages/server
npm test tests/branch-validation
```

## Prerequisites

### 1. Start Hyperscape Server
```bash
cd /Users/home/hyperscape/packages/server
bun start
```

Server should be running on `http://localhost:5555`

### 2. Start ElizaOS
```bash
cd /path/to/elizaos
npm start
```

ElizaOS API should be running on `http://localhost:4001`

### 3. Verify Services
```bash
# Check Hyperscape
curl http://localhost:5555/api/characters

# Check ElizaOS
curl http://localhost:4001/api/agents
```

---

## Run Tests

### All Tests (27 test cases)
```bash
cd /Users/home/hyperscape/packages/server
npm test tests/branch-validation
```

Expected runtime: ~2-3 minutes

### Individual Test Files

#### Character Selection (6 tests)
```bash
npm test tests/branch-validation/character-selection.spec.ts
```

#### Character Editor (6 tests)
```bash
npm test tests/branch-validation/character-editor.spec.ts
```

#### Dashboard Agents (5 tests)
```bash
npm test tests/branch-validation/dashboard-agents.spec.ts
```

#### Plugin Integration (6 tests)
```bash
npm test tests/branch-validation/plugin-integration.spec.ts
```

#### Complete Flow (4 tests)
```bash
npm test tests/branch-validation/complete-flow.spec.ts
```

---

## Check Results

### View Logs
```bash
cd /Users/home/hyperscape/logs/branch-validation
ls -la
```

### View Specific Test Log
```bash
cat /Users/home/hyperscape/logs/branch-validation/agent-creation-valid.log
```

### View Summary
```bash
cat /Users/home/hyperscape/logs/branch-validation/TEST_SUMMARY.md
```

---

## Troubleshooting

### Tests Failing?

**Check services are running:**
```bash
lsof -i :5555  # Hyperscape server
lsof -i :3000  # ElizaOS API
```

**Check database:**
```bash
cd /Users/home/hyperscape/packages/server
# Verify database connection in .env
```

**Clean state:**
```bash
# Stop all services
# Clear test data from database (optional)
# Restart services
# Run tests again
```

### Port Conflicts?

```bash
# Kill processes on ports
lsof -ti:5555 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

### Database Issues?

```bash
# Check .env file
cat /Users/home/hyperscape/packages/server/.env

# Verify DATABASE_URL is set correctly
```

---

## What Each Test Does

### character-selection.spec.ts
Tests server-side character selection system:
- Character list with new fields (avatar, wallet, isAgent)
- Character creation via WebSocket
- World entry with validation
- Duplicate connection handling
- Stale entity cleanup

### character-editor.spec.ts
Tests client-side character editor:
- Agent creation flow
- Rollback on failure
- JWT retry logic
- Template generation
- Secure credential handling

### dashboard-agents.spec.ts
Tests dashboard components:
- Agent list filtering by account
- Atomic deletion with rollback
- Log streaming
- Viewport credentials
- System status

### plugin-integration.spec.ts
Tests HyperscapeService plugin:
- Service initialization
- Connection retry
- Packet encoding/decoding
- Auto-reconnection
- Snapshot handling

### complete-flow.spec.ts
End-to-end integration tests:
- Complete agent lifecycle
- Crash recovery
- Agent deletion
- Multiple agents per account

---

## Expected Output

### Success
```
✅ Character Selection System (plugin-work branch)
  ✅ Character list includes avatar, wallet, and isAgent fields
  ✅ Character creation via WebSocket includes new fields
  ✅ Enter world with valid character loads avatar
  ✅ Enter world with missing character auto-creates record
  ✅ Duplicate character connection is rejected
  ✅ Stale entity cleanup on reconnection

✅ Character Editor Screen (plugin-work branch)
  ✅ Agent creation with valid credentials
  ✅ Agent creation rollback on mapping failure
  ✅ JWT generation retry logic
  ✅ Character template application
  ✅ Agent update functionality
  ✅ Secure JWT fetching (never from URL)

[... etc ...]

27 passing (2m 30s)
```

### Failure
```
❌ Character Selection System (plugin-work branch)
  ❌ Character list includes avatar, wallet, and isAgent fields
    Error: Timeout waiting for packet: characterList

Check log file: /Users/home/hyperscape/logs/branch-validation/character-list-new-fields.log
```

---

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run branch validation tests
  run: |
    cd packages/server
    npm test tests/branch-validation
```

### Railway Deployment
```bash
# Run tests before deployment
npm test tests/branch-validation && railway up
```

---

## Support

- **README:** `/Users/home/hyperscape/packages/server/tests/branch-validation/README.md`
- **Summary:** `/Users/home/hyperscape/logs/branch-validation/TEST_SUMMARY.md`
- **Logs:** `/Users/home/hyperscape/logs/branch-validation/`
- **Auth Helper:** `/Users/home/hyperscape/packages/server/tests/helpers/auth-helper.ts`

---

## Quick Commands

```bash
# Run all tests
npm test tests/branch-validation

# Run with verbose output
npm test tests/branch-validation -- --verbose

# Run specific test
npm test tests/branch-validation/character-selection.spec.ts

# Run tests matching pattern
npm test tests/branch-validation -- --grep "Agent creation"

# View logs
ls /Users/home/hyperscape/logs/branch-validation

# View test summary
cat /Users/home/hyperscape/logs/branch-validation/TEST_SUMMARY.md
```
