# Character-Dashboard Synchronization

## Overview

All AI agent characters created in Hyperscape are now automatically synced to ElizaOS, allowing them to appear in the dashboard at `http://localhost:3333/?page=dashboard`.

---

## 🔄 Complete Flow

### 1. User Creates Character

**Location**: Character Select Screen (`http://localhost:3333`)

1. User clicks "Create New" character
2. Selects character type:
   - **🎮 Human Player** - For manual gameplay
   - **🤖 AI Agent** - For autonomous AI play (requires ElizaOS running)
3. Enters name and chooses avatar
4. Clicks "Create"

**Routing after creation**:
- **AI Agent** → Redirected to Character Editor → Configure agent personality
- **Human Player** → Shown "Enter World" confirmation screen

### 2. Hyperscape Saves Character

**File**: `packages/server/src/systems/ServerNetwork/character-selection.ts:171-178`

```typescript
const result = await databaseSystem.createCharacter(
  accountId,
  id,
  finalName,
  avatar,
  wallet,
  isAgent,
);
```

**Saved to**: Hyperscape PostgreSQL/SQLite database

### 3. ElizaOS Agent Created (NEW!)

**File**: `packages/server/src/systems/ServerNetwork/character-selection.ts:322-324`

```typescript
// Create ElizaOS agent record ONLY for AI agent characters
if (isAgent) {
  await createElizaOSAgent(id, accountId, finalName, avatar, wallet, isAgent);
}
```

**What happens**:
1. Generates ElizaOS character template with Hyperscape-specific configuration
2. Calls `POST http://localhost:3000/api/agents` with character JSON
3. ElizaOS stores agent in its database with same ID as Hyperscape character
4. Links agent to user via `settings.accountId` field

**Character Template** (`character-selection.ts:49-118`):
```typescript
{
  id: characterId, // Same ID as Hyperscape character
  name: "AgentName",
  username: "agentname",
  system: "You are AgentName, an AI agent in Hyperscape...",
  bio: [...],
  topics: ["hyperscape", "gaming", "rpg", ...],
  plugins: [
    "@hyperscape/plugin-hyperscape",
    "@elizaos/plugin-sql",
    "@elizaos/plugin-bootstrap"
  ],
  settings: {
    secrets: {
      HYPERSCAPE_CHARACTER_ID: characterId,
      HYPERSCAPE_SERVER_URL: "ws://localhost:5555/ws",
      HYPERSCAPE_ACCOUNT_ID: accountId, // Links to user
      wallet: "0x..."
    },
    accountId, // Used for dashboard filtering
    characterType: "ai-agent",
    avatar: "http://..."
  }
}
```

### 4. Character Selection Routing (NEW!)

**File**: `packages/client/src/screens/CharacterSelectScreen.tsx:506-524`

**What happens when user selects a character**:
1. Client checks character's `isAgent` flag
2. **If AI Agent** (`isAgent === true`):
   - Redirects to dashboard: `/?page=dashboard`
   - User can monitor and control agent from dashboard
3. **If Human Player** (`isAgent === false`):
   - Shows "Enter World" confirmation screen
   - User clicks "Enter World" to play

**Code**:
```typescript
const selectCharacter = React.useCallback((id: string) => {
  const character = characters.find((c) => c.id === id);

  if (character?.isAgent) {
    // AI AGENT: Redirect to dashboard
    window.location.href = `/?page=dashboard`;
    return;
  }

  // HUMAN PLAYER: Show confirmation screen
  setView("confirm");
}, [characters]);
```

### 5. Dashboard Shows User's Agents

**File**: `packages/client/src/screens/DashboardScreen.tsx:46-88`

**What happens**:
1. Dashboard fetches all agents from ElizaOS: `GET http://localhost:3000/api/agents`
2. Filters to show ONLY current user's agents:
   ```typescript
   filteredAgents = agents.filter((agent) =>
     agent.settings?.accountId === userAccountId
   );
   ```
3. Displays agents in sidebar with start/stop controls
4. User can manage, chat with, and monitor their agents

---

## 🎯 Key Features

### ✅ Unified Character-Agent System

- **Single Source of Truth**: Character ID is same in both Hyperscape and ElizaOS
- **Automatic Sync**: No manual steps required
- **User Isolation**: Dashboard only shows current user's agents

### ✅ Character Types

Both stored in Hyperscape DB, AI agents also synced to ElizaOS:

| Type | `isAgent` | Synced to ElizaOS | Selection Behavior |
|------|-----------|-------------------|-------------------|
| Human Player | `false` | ❌ No | ➡️ Enter World (play) |
| AI Agent | `true` | ✅ Yes | ➡️ Dashboard (monitor) |

**Key Differences**:
- **Human Player**: You control the character directly in-game
- **AI Agent**: The character plays autonomously, you monitor from dashboard

### ✅ Dashboard Filtering

**By AccountId**:
```typescript
// User's Privy account ID
const userAccountId = localStorage.getItem("privy_user_id");

// Filter agents
const myAgents = agents.filter(agent =>
  agent.settings?.accountId === userAccountId
);
```

**Result**: Each user sees ONLY their own AI agents

---

## 📊 Data Storage

### Hyperscape Database (PostgreSQL/SQLite)

**Table**: `characters`

```sql
CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT,
  wallet TEXT,
  is_agent BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### ElizaOS Database (SQLite via plugin-sql)

**Table**: `agents`

```sql
-- Managed by ElizaOS automatically
-- Schema includes:
-- - id (same as Hyperscape character ID)
-- - name
-- - character (JSON blob with full template)
-- - settings (includes accountId for filtering)
```

---

## 🔧 API Endpoints

### Hyperscape Game Server (Port 5555)

**Create Character** (WebSocket):
```typescript
socket.send("characterCreate", {
  name: "AgentName",
  avatar: "http://...",
  wallet: "0x...",
  isAgent: true  // Important!
});
```

**Response**:
```typescript
socket.on("characterCreated", (data) => {
  // { id, name, avatar, wallet }
});
```

### ElizaOS API (Port 3000)

**Create Agent** (HTTP):
```bash
POST http://localhost:3000/api/agents
Content-Type: application/json

{
  "characterJson": {
    "id": "character-uuid",
    "name": "AgentName",
    "settings": {
      "accountId": "privy-user-id",
      ...
    },
    ...
  }
}
```

**List Agents** (HTTP):
```bash
GET http://localhost:3000/api/agents

Response:
{
  "success": true,
  "data": {
    "agents": [
      {
        "id": "character-uuid",
        "name": "AgentName",
        "status": "active",
        "settings": {
          "accountId": "privy-user-id",
          "characterType": "ai-agent"
        }
      }
    ]
  }
}
```

---

## 🚀 Testing the Flow

### Test 1: Create Human Player Character

```bash
# Start all services
bun run dev

# In browser:
1. Visit http://localhost:3333
2. Login with Privy
3. Click "Create New" character
4. Select "🎮 Human Player"
5. Enter name: "MyHero"
6. Click "Create"
```

**Expected Behavior**:
- Shows "Enter World" confirmation screen
- Click "Enter World" → Enters game as human player
- Character appears in character list with `isAgent: false`

**Expected Console Output**:
```
[CharacterSelection] ✅ Character creation successful
[CharacterSelect] 🎮 Human character selected, showing confirmation...
```

### Test 2: Create AI Agent Character

```bash
# In browser (with ElizaOS running):
1. Visit http://localhost:3333
2. Login with Privy
3. Click "Create New" character
4. Select "🤖 AI Agent"
5. Enter name: "TestBot"
6. Click "Create"
```

**Expected Behavior**:
- Redirects to Character Editor
- Configure agent personality
- Save → Agent created in ElizaOS
- Character appears in character list with `isAgent: true`

**Expected Console Output**:
```
[CharacterSelection] 🎭 handleCharacterCreate called with data: { name: "TestBot", isAgent: true }
[CharacterSelection] ✅ Character creation successful
[CharacterSelection] 🤖 Creating ElizaOS agent for character: TestBot (uuid-here)
[CharacterSelection] ✅ ElizaOS agent created successfully
```

### Test 3: Select Human Player Character

```bash
# In browser:
1. At character select screen
2. Click on human character "MyHero"
```

**Expected Behavior**:
- Shows "Enter World" confirmation screen
- Click "Enter World" → Enter game normally

**Expected Console Output**:
```
[CharacterSelect] 🎮 Human character selected, showing confirmation...
```

### Test 4: Select AI Agent Character

```bash
# In browser:
1. At character select screen
2. Click on AI agent character "TestBot"
```

**Expected Behavior**:
- Immediately redirects to dashboard
- Dashboard loads with "TestBot" in sidebar
- Can monitor agent from dashboard

**Expected Console Output**:
```
[CharacterSelect] 🤖 AI agent selected, redirecting to dashboard...
[Dashboard] User account ID: privy-user-id-here
[Dashboard] ✅ Agent TestBot belongs to user privy-user-id-here
[Dashboard] Filtered 1 agents out of 2 for user privy-user-id-here
```

### Test 5: Start Agent from Dashboard

```bash
# In dashboard:
1. Agent "TestBot" visible in sidebar
2. Click ▶️ (Play) button
```

**Expected Behavior**:
- Button changes to ⏹️ (Stop)
- Status changes to "Active" (green dot)
- Agent connects to game server
- Appears in game world (visible to human players)

**Expected Console Output**:
```
[Dashboard] Starting agent TestBot...
[Dashboard] Agent started: { success: true }
[HyperscapeService] Connected to Hyperscape server
```

---

## 🐛 Troubleshooting

### Agent Not Appearing in Dashboard

**Symptom**: Created AI agent but dashboard is empty

**Causes**:
1. **ElizaOS not running**: Check `http://localhost:3000` is accessible
2. **Creation failed**: Check server logs for "ElizaOS agent created successfully"
3. **Wrong user logged in**: Dashboard filters by `userAccountId`

**Fix**:
```bash
# Check ElizaOS is running
curl http://localhost:3000/api/agents

# Check server logs
# Look for: "🤖 Creating ElizaOS agent for character"

# Verify user ID matches
localStorage.getItem("privy_user_id") in browser console
```

### Dashboard Shows All Agents (Not Filtered)

**Symptom**: Seeing other users' agents in dashboard

**Cause**: `userAccountId` not set or filtering logic broken

**Fix**:
```bash
# Check browser console for:
"[Dashboard] User account ID: ..."

# If missing:
# 1. Logout and login again
# 2. Check Privy localStorage: privy_user_id
```

### Agent Created But Not in ElizaOS

**Symptom**: Character exists in Hyperscape DB but not in ElizaOS

**Cause**: `isAgent` flag was `false` or ElizaOS API call failed

**Fix**:
```bash
# Only AI agents (isAgent: true) are synced to ElizaOS
# Check character was created as AI agent, not human player

# Manual sync (if needed):
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "characterJson": {
      "id": "character-id-here",
      "name": "AgentName",
      "settings": { "accountId": "user-id-here" },
      ...
    }
  }'
```

---

## 📝 Implementation Files

### Modified Files

1. **`packages/server/src/systems/ServerNetwork/character-selection.ts`**
   - Added `createElizaOSAgent()` function (lines 28-152)
   - Calls ElizaOS API when `isAgent === true` (lines 322-324)

2. **`packages/client/src/screens/DashboardScreen.tsx`**
   - Added `settings` field to `Agent` interface (lines 16-21)
   - Implemented accountId filtering (lines 57-68)
   - Console logging for debugging (lines 63-71)

### Related Files (Not Modified)

- `packages/client/src/utils/characterTemplate.ts` - Template generator (used as reference)
- `packages/server/src/database/repositories/CharacterRepository.ts` - Character DB operations
- `packages/client/src/components/dashboard/*` - Dashboard UI components

---

## 🔗 Related Documentation

- [DASHBOARD_SETUP.md](./DASHBOARD_SETUP.md) - Complete dashboard guide
- [WALLET_JWT_FIX_SUMMARY.md](./WALLET_JWT_FIX_SUMMARY.md) - Authentication fixes
- [CLAUDE.md](./CLAUDE.md) - Project overview

---

## 🎉 Benefits

1. **Seamless UX**: AI agents automatically appear in dashboard after creation
2. **No Manual Steps**: Users don't need to configure anything
3. **User Isolation**: Each user sees only their own agents
4. **Unified IDs**: Same character ID across both systems (simplifies debugging)
5. **Type Safety**: ElizaOS character template matches official schema
6. **Error Resilient**: Character still created even if ElizaOS sync fails

---

**Last Updated**: 2025-01-20
**Status**: ✅ Implemented and Tested
**Version**: 1.0.0
