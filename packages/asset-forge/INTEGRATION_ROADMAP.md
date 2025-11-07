# Asset Forge Integration Roadmap
## Character Wallets & Hyperscape Integration

**Status:** Phase 1 Complete ✅
**Date:** 2025-11-06

---

## 🎯 Current Architecture (Phase 1)

### **Authentication Layer**

Asset Forge uses **Privy JWT authentication** with a single primary wallet per user:

```typescript
// users table
{
  id: UUID
  privyUserId: string           // "did:privy:..."
  walletAddress: string         // Primary wallet (HD index 0)
  email: string
  role: 'admin' | 'member'
  ...
}
```

**Key Points:**
- ✅ `users.walletAddress` stores **primary wallet only** (HD index 0)
- ✅ Used for **authentication and authorization**
- ✅ One wallet per user in Asset Forge database
- ✅ Privy SDK handles JWT verification

---

## 🎮 Future: Hyperscape Character Integration

### **User's Requirement**

> "The users other wallets will be for their characters in game"

This means:
- **Primary Wallet (HD index 0)** → Authentication & account ownership
- **Character Wallets (HD index 1, 2, 3...)** → In-game character identities

### **Privy HD Wallet System**

Privy supports **Hierarchical Deterministic (HD) wallets**:

```typescript
// Single seed phrase generates multiple wallets
HD Index 0: 0xABC...123  // Primary (authentication)
HD Index 1: 0xDEF...456  // Character 1
HD Index 2: 0xGHI...789  // Character 2
HD Index 3: 0xJKL...012  // Character 3
```

**Reference:** [Privy HD Wallets Documentation](https://docs.privy.io/guide/react/wallets/usage/hd-wallets)

---

## 🔮 Integration Strategy Options

### **Option A: Deferred (Recommended for Phase 1)**

**Keep Asset Forge schema as-is** and handle character wallets in Hyperscape:

**Asset Forge (Current):**
```typescript
users {
  walletAddress: "0xABC...123"  // HD index 0 only
}
```

**Hyperscape Server (Future):**
```typescript
characters {
  id: UUID
  user_id: UUID                  // Link to Asset Forge user
  wallet_address: string         // HD index 1, 2, 3...
  wallet_index: number           // HD derivation index
  name: string
  ...
}
```

**Pros:**
- ✅ Separation of concerns (auth vs game data)
- ✅ No changes needed to Asset Forge now
- ✅ Hyperscape already has its own database
- ✅ Simple and modular

**Cons:**
- ⚠️ Need to sync user IDs between systems
- ⚠️ Two databases to maintain

**When to implement:** When Hyperscape integration spec is ready

---

### **Option B: Shared Database**

Asset Forge and Hyperscape share the same PostgreSQL database:

**Unified Schema:**
```typescript
// Asset Forge tables (existing)
users, admin_whitelist, projects, assets, activity_log

// Hyperscape tables (new)
characters, character_wallets, game_sessions, ...
```

**Character Wallets Table:**
```sql
CREATE TABLE character_wallets (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  character_id UUID,  -- Reference to Hyperscape character
  wallet_address VARCHAR(255) UNIQUE NOT NULL,
  wallet_index INTEGER NOT NULL,  -- HD derivation index (1, 2, 3...)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Pros:**
- ✅ Single source of truth
- ✅ No sync needed
- ✅ Unified authentication
- ✅ Easy to query cross-system data

**Cons:**
- ⚠️ Tight coupling between Asset Forge and Hyperscape
- ⚠️ Need to migrate Hyperscape from SQLite
- ⚠️ More complex deployment

**When to implement:** If Hyperscape switches to PostgreSQL

---

### **Option C: Character Wallets in Asset Forge**

Add character wallet tracking to Asset Forge now:

**New Table:**
```typescript
character_wallets {
  id: UUID
  user_id: UUID                  // FK to users
  wallet_address: string         // HD derived wallet
  wallet_index: number           // 1, 2, 3...
  character_name: string?        // Optional game character name
  metadata: JSONB                // Game-specific data
  created_at: TIMESTAMP
}
```

**Service:**
```typescript
class CharacterWalletService {
  async createCharacterWallet(userId: string, walletIndex: number) {
    // Derive wallet from Privy HD system
    const wallet = await privy.createHDWallet(userId, walletIndex)

    // Store in database
    return db.insert(characterWallets).values({
      userId,
      walletAddress: wallet.address,
      walletIndex,
    })
  }

  async getCharacterWallets(userId: string) {
    return db.select()
      .from(characterWallets)
      .where(eq(characterWallets.userId, userId))
  }
}
```

**Pros:**
- ✅ Ready for game integration
- ✅ Asset Forge manages all wallets
- ✅ Can link wallets to assets

**Cons:**
- ⚠️ Premature optimization (no game yet)
- ⚠️ Unused table until Hyperscape integration
- ⚠️ Asset Forge becomes more complex

**When to implement:** If Asset Forge will manage character creation

---

## 📋 Recommended Approach

### **Phase 1 (Current): Option A - Deferred**

**Rationale:**
1. Asset Forge is **standalone** right now (3D asset generation)
2. Hyperscape integration **spec is not defined yet**
3. Don't build features until they're needed (YAGNI principle)
4. Current schema is **correct** for authentication use case

**Current Implementation:**
```typescript
// ✅ Correct: Primary wallet for authentication
users.walletAddress = "0xABC...123"  // HD index 0
```

**Future Migration Path:**
1. When Hyperscape integration is ready, **choose Option B or C**
2. Run migration to add `character_wallets` table
3. Implement wallet derivation service
4. Link wallets to game characters

---

## 🛠️ Implementation Checklist (When Ready)

### **Prerequisites**
- [ ] Hyperscape integration spec defined
- [ ] Character system designed
- [ ] Database choice finalized (PostgreSQL vs SQLite)

### **Option A Implementation (Separate DBs)**
- [ ] Define user ID mapping strategy
- [ ] Add `characters` table to Hyperscape DB
- [ ] Implement character wallet derivation
- [ ] Create sync service for user IDs

### **Option B Implementation (Shared DB)**
- [ ] Migrate Hyperscape to PostgreSQL
- [ ] Add Hyperscape tables to Asset Forge migrations
- [ ] Update connection configs
- [ ] Test cross-system queries

### **Option C Implementation (Asset Forge Manages)**
- [ ] Add `character_wallets` migration
- [ ] Implement `CharacterWalletService`
- [ ] Add API endpoints (`POST /api/characters/wallets`)
- [ ] Integrate Privy HD wallet derivation
- [ ] Add character wallet UI

---

## 🔐 Security Considerations

### **Wallet Derivation**

**Privy handles HD derivation securely:**
```typescript
// User never sees seed phrase
// Privy manages key derivation internally
const wallet = await privy.createHDWallet(userId, index)
```

**Asset Forge should:**
- ✅ Store only **wallet addresses** (not private keys)
- ✅ Use Privy SDK for all wallet operations
- ✅ Log wallet creation in `activity_log`
- ✅ Validate wallet ownership before operations

### **Access Control**

**Character wallets should:**
- ✅ Only be accessible by owning user
- ✅ Require primary wallet authentication
- ✅ Support wallet recovery via Privy
- ✅ Allow wallet revocation if compromised

---

## 📊 Data Flow (Future)

### **Character Creation Flow**

```
1. User authenticates with Primary Wallet (HD index 0)
   ↓
2. User creates character in Hyperscape
   ↓
3. System requests Character Wallet from Privy
   ↓
4. Privy derives HD wallet (index 1)
   ↓
5. Store wallet address in database
   ↓
6. Character uses this wallet for in-game transactions
```

### **Asset Linking Flow**

```
1. User generates 3D asset in Asset Forge
   ↓
2. Asset metadata stored with user_id
   ↓
3. User assigns asset to Character
   ↓
4. Asset linked to character_wallet_address
   ↓
5. Hyperscape loads asset for that character
```

---

## 🎯 Success Criteria

### **Phase 1 (Current) - DONE ✅**
- [x] Primary wallet authentication working
- [x] User table stores HD index 0 wallet
- [x] Privy JWT verification implemented
- [x] Asset ownership tracked by user

### **Phase 2 (Future) - Character Integration**
- [ ] Character wallet derivation working
- [ ] Multiple wallets per user supported
- [ ] Character ↔ Wallet mapping stored
- [ ] Assets can be assigned to characters
- [ ] Hyperscape loads character assets

---

## 📚 References

### **Documentation**
- [Privy HD Wallets](https://docs.privy.io/guide/react/wallets/usage/hd-wallets)
- [Privy Server Auth](https://docs.privy.io/guide/server/authorization/verification)
- [Drizzle ORM](https://orm.drizzle.team/docs/overview)

### **Related Files**
- `server/db/schema/users.schema.ts` - Current user schema
- `server/middleware/privyAuth.ts` - JWT authentication
- `server/services/UserService.ts` - User management
- `PHASE1_IMPLEMENTATION_SUMMARY.md` - Implementation details
- `RAILWAY_SETUP.md` - Deployment guide

---

## 🔄 Next Steps

**Immediate (Now):**
- ✅ Phase 1 database setup complete
- ✅ Primary wallet authentication working
- ✅ Asset ownership tracking ready

**Short-term (1-2 weeks):**
- [ ] Define Hyperscape integration requirements
- [ ] Choose integration option (A, B, or C)
- [ ] Design character system

**Medium-term (1-2 months):**
- [ ] Implement character wallet management
- [ ] Build asset-character linking
- [ ] Test end-to-end flow

---

**Last Updated:** 2025-11-06
**Status:** Phase 1 Complete, awaiting Hyperscape integration spec
**Recommendation:** Proceed with Option A (Deferred) until game requirements are clear
