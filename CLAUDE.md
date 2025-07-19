### 1. How do .hyp apps interact with each other?

**Technical Implementation:**

Hyperfy apps communicate through multiple mechanisms:

**Direct Method Invocation:**
```javascript
// Apps can call methods directly on other apps
const rpgApps = world.apps.getAll().filter(app => app.getRPGStats)
const playerApp = rpgApps.find(app => app.getRPGStats().name === player.name)

if (playerApp) {
  playerApp.takeDamage(damage)
  const success = playerApp.addItem(itemId, quantity)
  const levelledUp = playerApp.grantXP('attack', xpAmount)
}
```

**Event-Based Communication:**
```javascript
// Send events to all clients/server
app.send('eventName', data)

// Listen for events from other apps
app.on('eventName', (data) => {
  // Handle event
})
```

**Shared State Access:**
```javascript
// Apps can read each other's state
const otherAppState = otherApp.state
const sharedData = world.get('sharedKey')
```

**Service Discovery Pattern:**
```javascript
// Find apps by capability rather than type
const combatApps = world.apps.getAll().filter(app => 
  app.takeDamage && app.getCurrentHealth
)
```

**Critical Implementation Requirements:**
- Use capability-based detection instead of type checking
- Implement loose coupling between apps
- Handle missing dependencies gracefully
- Use event-driven communication for complex interactions

### 2. How do we save, load, create and persist different worlds?

**World Management Architecture:**

**World Directory Structure:**
```
world/
├── assets/          # 3D models, images, audio files
├── collections/     # App collections and manifests  
├── db.sqlite        # SQLite database for persistence
├── storage.json     # Key-value world storage
└── world.json       # World configuration
```

**World Creation:**
```typescript
// WorldManager handles multiple worlds
const worldManager = new WorldManager();
const world = await worldManager.createWorld({
  id: 'rpg-world-1',
  name: 'RPG World',
  type: 'server',
  settings: { playerLimit: 100 },
  persistence: { type: 'sqlite', path: './world/db.sqlite' }
});
```

**Database Persistence:**
- `users` table: Player accounts and avatars
- `entities` table: World object instances
- `blueprints` table: App/object templates
- `config` table: World settings and spawn points

**World Loading:**
```bash
# Environment variable controls which world directory
WORLD=rpg-world npm run dev

# Loads from ./rpg-world/ directory
```

**Multi-World Support:**
- Each world completely isolated with own database
- Asset management with hashed filenames for caching
- Automatic cleanup of unused assets and entities
- Hot reloading for development

### 3. How can we spawn a player with overhead camera or force camera into overhead?

**Camera System Architecture:**

**Camera Hierarchy:**
- `world.camera` - THREE.PerspectiveCamera (FOV 70°, near 0.2, far 1200)
- `world.rig` - THREE.Object3D containing camera
- `world.rig.position` controls world position
- `world.camera.position.z` controls zoom distance

**Overhead Camera Implementation:**
```javascript
// Set overhead view for testing
function setOverheadCamera(world, height = 50) {
  // Position camera high above world
  world.rig.position.set(0, height, 0);
  
  // Rotate to look down
  world.rig.rotation.set(-Math.PI/2, 0, 0);
  
  // Remove zoom offset
  world.camera.position.z = 0;
  
  // For orthographic projection (requires engine modification)
  const orthoCamera = new THREE.OrthographicCamera(
    -50, 50, 50, -50, 0.1, 1000
  );
  // Replace world.camera with orthoCamera
}
```

**Camera Control API:**
```javascript
// Get camera control with high priority
const controls = world.controls.bind({
  priority: 100  // High priority for testing
});

// Apply camera changes
controls.camera.position.set(x, y, z);
controls.camera.quaternion.set(x, y, z, w);
controls.camera.zoom = distance;
controls.camera.write = true;  // Apply changes
```

### 4. How do we remove bloom and post-processing for visual pixel testing?

**Post-Processing Control:**

**Disable via Preferences:**
```javascript
// Disable all post-processing effects
world.prefs.setPostprocessing(false);

// Disable just bloom
world.prefs.setBloom(false);

// Set device pixel ratio for consistent testing
world.prefs.setDpr(1.0);
```

**Technical Implementation:**
- Graphics system uses `postprocessing` library with EffectComposer
- Bloom effect uses SelectiveBloomEffect on layer 14 (NO_BLOOM)
- Render path: `RenderPass` → `BloomPass` → `EffectPass`
- Controlled via `ClientGraphics.usePostprocessing` flag

**Visual Testing Configuration:**
```javascript
// Configure for pixel testing
function setupVisualTesting(world) {
  world.prefs.setPostprocessing(false);  // No effects
  world.prefs.setBloom(false);          // No bloom
  world.prefs.setShadows(0);            // No shadows
  world.prefs.setDpr(1.0);              // 1:1 pixel ratio
}
```

### 5. How do we create portals between worlds?

**Portal Implementation Strategy:**

Currently, Hyperfy doesn't have built-in portals, but we can implement them:

**Portal App Structure:**
```javascript
// Portal.hyp
app.configure([
  {
    type: 'text',
    key: 'targetWorld',
    label: 'Target World ID',
    initial: 'world-2'
  },
  {
    type: 'text', 
    key: 'spawnPoint',
    label: 'Spawn Point',
    initial: 'town-center'
  }
]);

// Create trigger zone
const trigger = app.create('trigger');
trigger.radius = 2;

trigger.onEnter = (player) => {
  // Send portal request to server
  app.send('portal:transport', {
    playerId: player.id,
    targetWorld: props.targetWorld,
    spawnPoint: props.spawnPoint
  });
};
```

**Server-Side Portal System:**
```javascript
// Handle world transitions
world.on('portal:transport', (data) => {
  if (world.isServer) {
    // Save player state
    const playerData = savePlayerState(data.playerId);
    
    // Transfer to new world
    transferPlayerToWorld(data.playerId, data.targetWorld, playerData);
  }
});
```

**Multi-World Architecture Required:**
- WorldManager to handle multiple world instances
- Player state serialization/deserialization
- Cross-world communication protocols
- Load balancing for world distribution

### 6. How do we persist data and store player XP, level, items, etc?

**Extended Database Schema Required:**

```sql
-- Player progression data
CREATE TABLE rpg_players (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR REFERENCES users(id),
  character_name VARCHAR,
  level INTEGER DEFAULT 1,
  experience BIGINT DEFAULT 0,
  health INTEGER DEFAULT 100,
  position JSON,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Skills system
CREATE TABLE rpg_skills (
  player_id VARCHAR REFERENCES rpg_players(id),
  skill_name VARCHAR,
  level INTEGER DEFAULT 1,
  experience BIGINT DEFAULT 0,
  PRIMARY KEY (player_id, skill_name)
);

-- Inventory system  
CREATE TABLE rpg_inventory (
  player_id VARCHAR REFERENCES rpg_players(id),
  slot_index INTEGER,
  item_id VARCHAR,
  quantity INTEGER,
  item_data JSON,
  PRIMARY KEY (player_id, slot_index)
);

-- Equipment system
CREATE TABLE rpg_equipment (
  player_id VARCHAR REFERENCES rpg_players(id),
  slot_name VARCHAR,
  item_id VARCHAR,
  item_data JSON,
  PRIMARY KEY (player_id, slot_name)
);
```

**Persistence System Implementation:**
```javascript
// RPG persistence manager
class RPGPersistenceSystem extends System {
  async savePlayerData(playerId, data) {
    const db = this.world.db;
    
    // Save character progression
    await db.prepare(`
      UPDATE rpg_players 
      SET level = ?, experience = ?, health = ?, position = ?
      WHERE id = ?
    `).run(data.level, data.experience, data.health, 
           JSON.stringify(data.position), playerId);
    
    // Save skills
    for (const [skillName, skillData] of Object.entries(data.skills)) {
      await db.prepare(`
        INSERT OR REPLACE INTO rpg_skills 
        (player_id, skill_name, level, experience)
        VALUES (?, ?, ?, ?)
      `).run(playerId, skillName, skillData.level, skillData.experience);
    }
    
    // Save inventory
    for (let i = 0; i < data.inventory.length; i++) {
      const item = data.inventory[i];
      if (item) {
        await db.prepare(`
          INSERT OR REPLACE INTO rpg_inventory
          (player_id, slot_index, item_id, quantity, item_data)
          VALUES (?, ?, ?, ?, ?)
        `).run(playerId, i, item.id, item.quantity, JSON.stringify(item.data));
      }
    }
  }
}
```

### 7. How can we do that in such a way that players can't hack?

**Security Architecture Implementation:**

**Server Authority Model:**
```javascript
// All critical operations validated server-side
class SecuritySystem extends System {
  validatePlayerAction(player, action) {
    // Validate movement (speed limits)
    if (action.type === 'move') {
      const distance = calculateDistance(player.lastPosition, action.position);
      const maxSpeed = 10; // units per second
      const timeDelta = action.timestamp - player.lastActionTime;
      
      if (distance / timeDelta > maxSpeed) {
        this.logSuspiciousActivity(player, 'speed_hack_detected');
        return false;
      }
    }
    
    // Validate combat actions
    if (action.type === 'attack') {
      const target = this.world.entities.get(action.targetId);
      const distance = calculateDistance(player.position, target.position);
      
      if (distance > 2) { // Max attack range
        return false;
      }
      
      // Check attack cooldown
      if (Date.now() - player.lastAttack < 600) { // 600ms cooldown
        return false;
      }
    }
    
    return true;
  }
  
  // Rate limiting
  rateLimitAction(player, actionType) {
    const now = Date.now();
    const key = `${player.id}:${actionType}`;
    
    if (!this.actionTimestamps.has(key)) {
      this.actionTimestamps.set(key, []);
    }
    
    const timestamps = this.actionTimestamps.get(key);
    
    // Remove old timestamps (1 second window)
    const cutoff = now - 1000;
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }
    
    // Check rate limit (max 10 actions per second)
    if (timestamps.length >= 10) {
      return false;
    }
    
    timestamps.push(now);
    return true;
  }
}
```

**Cryptographic Protection:**
```javascript
// Item signature system
class ItemSecuritySystem {
  signItem(item) {
    const payload = JSON.stringify({
      id: item.id,
      quantity: item.quantity,
      stats: item.stats,
      timestamp: Date.now()
    });
    
    const signature = crypto
      .createHmac('sha256', process.env.ITEM_SECRET)
      .update(payload)
      .digest('hex');
    
    return { ...item, signature };
  }
  
  validateItem(item) {
    const { signature, ...itemData } = item;
    const expectedSignature = this.signItem(itemData).signature;
    
    return signature === expectedSignature;
  }
}
```

**Anti-Cheat Measures:**
- Server-side damage calculation and validation
- Movement speed and physics validation
- Rate limiting on all player actions
- Cryptographic item signatures
- Audit logging for suspicious activities
- Regular client-server state reconciliation

### 8. How do we query the current game state to check things like goblin health or player HP?

**Game State Querying System:**

**Entity State Access:**
```javascript
// Get entity by ID
const goblin = world.entities.get(goblinId);

// Check health component
const healthComponent = goblin.getComponent('health');
const currentHealth = healthComponent?.data.currentHealth;
const isAlive = currentHealth > 0;

// Get all entities of type
const allGoblins = world.entities.getAll()
  .filter(entity => entity.blueprint?.name === 'RPGGoblin');

// Spatial queries
const nearbyEnemies = world.entities.getAll()
  .filter(entity => {
    const distance = calculateDistance(player.position, entity.position);
    return distance < 10 && entity.type === 'enemy';
  });
```

**Component System Queries:**
```javascript
// Query entities with specific components
function getEntitiesWithComponents(world, componentTypes) {
  return world.entities.getAll().filter(entity => 
    componentTypes.every(type => entity.hasComponent(type))
  );
}

// Example: Find all entities with health and combat components
const combatEntities = getEntitiesWithComponents(world, ['health', 'combat']);
```

**RPG-Specific State Queries:**
```javascript
// RPG game state querying
class RPGStateQuerySystem {
  getPlayerStats(playerId) {
    const player = world.entities.get(playerId);
    const statsComponent = player.getComponent('rpgStats');
    
    return {
      level: statsComponent.data.level,
      health: statsComponent.data.health,
      experience: statsComponent.data.experience,
      skills: statsComponent.data.skills,
      inventory: statsComponent.data.inventory
    };
  }
  
  getMobsInRange(position, range) {
    return world.entities.getAll()
      .filter(entity => entity.type === 'mob')
      .filter(entity => {
        const distance = calculateDistance(position, entity.position);
        return distance <= range;
      })
      .map(mob => ({
        id: mob.id,
        type: mob.blueprint.name,
        health: mob.getComponent('health')?.data.currentHealth,
        position: mob.position,
        state: mob.getComponent('ai')?.data.state
      }));
  }
  
  getCombatState(entityId) {
    const entity = world.entities.get(entityId);
    const combat = entity.getComponent('combat');
    const health = entity.getComponent('health');
    
    return {
      inCombat: combat?.data.inCombat || false,
      target: combat?.data.target,
      health: health?.data.currentHealth || 0,
      maxHealth: health?.data.maxHealth || 0,
      lastAttack: combat?.data.lastAttack || 0
    };
  }
}
```

**Visual Testing State Queries:**
```javascript
// For automated testing
function verifyGameState(world, expectedState) {
  const player = world.entities.player;
  const playerPos = player.position;
  
  // Check player movement
  const hasMoved = calculateDistance(playerPos, expectedState.playerStartPos) > 0.1;
  
  // Check mob states
  const goblins = world.entities.getAll()
    .filter(e => e.blueprint?.name === 'RPGGoblin');
  
  const deadGoblins = goblins.filter(g => 
    g.getComponent('health')?.data.currentHealth <= 0
  );
  
  return {
    playerMoved: hasMoved,
    goblinsAlive: goblins.length - deadGoblins.length,
    goblinsKilled: deadGoblins.length
  };
}
```

### 9. What does Hyperfy NOT give us that we need to build an MMORPG?

**Critical Missing Systems (Estimated 60-70% of total MMORPG functionality):**

**1. Game Logic Systems (16-20 weeks development):**
- Character progression and leveling systems
- Combat mechanics and damage calculation  
- Inventory and equipment management
- Skill trees and ability systems
- Quest and dialogue systems
- Loot generation and item systems
- Economy and trading systems
- NPC AI and behavior trees

**2. Scalability Infrastructure (6-8 weeks):**
- Horizontal scaling and load balancing
- Multi-server architecture  
- Database clustering and optimization
- Memory management and entity pooling
- Network optimization and delta compression

**3. Security & Anti-Cheat (4-6 weeks):**
- Server-side validation of all actions
- Advanced cheat detection systems
- Rate limiting and DDoS protection
- Cryptographic protection for items/currency
- Audit logging and monitoring

**4. User Interface Framework (8-10 weeks):**
- Game-specific UI components (inventory, character sheet, skill tree)
- HUD systems (health bars, minimaps, action bars)
- Menu systems and settings
- Tooltips and help systems
- Accessibility features

**5. Database Extensions (3-4 weeks):**
- Complex schema for player progression
- Optimized queries for MMORPG operations
- Data migration and backup systems
- Analytics and telemetry collection

**Performance Limitations:**
- Single-server architecture (no horizontal scaling)
- 8Hz network update rate (may be too slow for fast combat)
- SQLite database (won't scale beyond ~100 concurrent players)
- No entity pooling or advanced memory management
- Limited spatial indexing for large worlds

### 10. How do we actually start the RPG and get into the world?

**Complete Launch Procedure:**

**1. Development Setup:**
```bash
# Navigate to hyperfy directory
cd packages/hyperfy

# Install dependencies
npm install

# Start development server
npm run dev

# Server starts on http://localhost:3000
```

**2. Production Deployment:**
```bash
# Build the application
npm run build

# Start production server
npm start

# Or with environment variables
WORLD=rpg-world PORT=3000 npm start
```

**3. Client Connection Flow:**
- Browser navigates to server URL
- WebSocket connection established to `/ws` endpoint
- Authentication with JWT tokens (auto-created for new users)
- World snapshot received (settings, entities, collections)
- PhysX physics engine initialized
- Assets preloaded (models, textures, avatars)
- Player entity spawned at configured spawn point
- Game session begins

**4. RPG-Specific Initialization:**
```javascript
// RPG collections loaded automatically
world/collections/default/
├── RPGPlayer.js        # Player stats and inventory
├── RPGGoblin.js        # Enemy AI and combat
├── RPGTree.js          # Resource gathering
├── RPGBank.js          # Storage systems
└── manifest.json       # Collection definition
```

**5. World Configuration:**
```bash
# Environment variables
WORLD=rpg-world         # World directory name
PORT=3000               # Server port
ADMIN_CODE=secret123    # Admin access code
SAVE_INTERVAL=60000     # Auto-save frequency
```

**6. Player Spawning Process:**
- New players spawn at configurable spawn point (default: origin)
- Spawn point set via `/spawn set` admin command
- Starting equipment and stats defined in RPGPlayer.js
- Persistent character data loaded from database
- Multiplayer synchronization established

### 11. How does player spawning and position in the world work?

**Player Spawning Architecture:**

**1. Spawn Point Management:**
```javascript
// Default spawn configuration
const defaultSpawn = {
  position: [0, 0, 0],
  quaternion: [0, 0, 0, 1]
};

// Admin commands to set spawn
world.on('command', (data) => {
  if (data.command === '/spawn set' && isAdmin(data.player)) {
    const newSpawn = {
      position: data.player.position.slice(),
      quaternion: data.player.quaternion.slice()
    };
    
    // Save to database
    world.db.prepare(`
      INSERT OR REPLACE INTO config (key, value)
      VALUES ('spawn', ?)
    `).run(JSON.stringify(newSpawn));
  }
});
```

**2. Player Entity Creation:**
```javascript
// ServerNetwork.onConnection
socket.player = world.entities.add({
  id: user.id,
  type: 'player',
  position: this.spawn.position.slice(),  // Spawn point position
  quaternion: this.spawn.quaternion.slice(), // Spawn point rotation  
  name: name || user.name,
  health: 100,
  avatar: user.avatar || settings.avatar?.url || 'asset://avatar.vrm',
  roles: user.roles
}, true); // true = broadcast to all clients
```

**3. Player Types:**

**PlayerLocal (controlling player):**
- Physics-enabled capsule controller
- Input handling (WASD movement, mouse look)
- Camera control and rig positioning
- Network state transmission to server

**PlayerRemote (other players):**
- Interpolated movement from network updates
- Avatar rendering and animation
- No physics simulation (receives positions)
- Limited interaction capabilities

**4. Position Synchronization:**
```javascript
// Client sends position updates
world.network.send('playerUpdate', {
  position: player.position.toArray(),
  quaternion: player.quaternion.toArray(),
  velocity: player.velocity.toArray(),
  input: player.input
});

// Server validates and broadcasts
world.network.broadcast('playerUpdate', {
  playerId: player.id,
  position: validatedPosition,
  quaternion: validatedQuaternion
});
```

**5. Multi-Player Spawning:**
- All players spawn at same configured spawn point
- No spawn point randomization (would need custom implementation)
- Supports unlimited concurrent players (hardware dependent)
- Player limit configurable via world settings
- Automatic cleanup on disconnect

**6. RPG-Specific Spawning:**
```javascript
// RPGPlayer.js initialization
app.on('init', () => {
  // Load persistent character data
  const playerData = loadPlayerData(player.id);
  
  if (playerData) {
    // Existing character - restore state
    app.state = {
      level: playerData.level,
      health: playerData.health,
      inventory: playerData.inventory,
      skills: playerData.skills,
      equipment: playerData.equipment
    };
    
    // Restore position if saved
    if (playerData.lastPosition) {
      player.position.copy(playerData.lastPosition);
    }
  } else {
    // New character - default stats
    app.state = {
      level: 1,
      health: 100,
      inventory: new Array(28).fill(null),
      skills: { attack: 1, strength: 1, defense: 1 },
      equipment: { weapon: 'bronze_sword', shield: null }
    };
  }
});
```

### Technical Risks:
1. **Scalability Bottlenecks**: Hyperfy's single-server architecture may limit player count
   - *Mitigation*: Implement load balancing and horizontal scaling early
   
2. **Database Performance**: SQLite won't scale beyond ~100 concurrent players
   - *Mitigation*: Plan PostgreSQL migration for production
   
3. **Network Latency**: 8Hz update rate may feel unresponsive for combat
   - *Mitigation*: Implement client-side prediction and lag compensation

### Development Risks:
1. **Scope Creep**: MMORPG feature requests beyond GDD scope
   - *Mitigation*: Strict adherence to GDD, phased implementation
   
2. **Testing Complexity**: No mocks allowed, all real-world testing
   - *Mitigation*: Invest heavily in test framework and automation

3. **Security Vulnerabilities**: Online game attracts hackers and exploiters
   - *Mitigation*: Security-first development, regular penetration testing

# ElizaOS Actions, Providers, and Services Architecture

## Overview

ElizaOS is an AI agent framework that uses a modular architecture based on three core concepts:

- **Actions**: Discrete operations that agents can perform in response to messages
- **Providers**: Context suppliers that inject relevant information into the agent's decision-making
- **Services**: Persistent connections and functionality managers (databases, APIs, game worlds)

These components work together to create intelligent agents that can perceive their environment, make decisions, and take actions.

## Actions

### What are Actions?

Actions are the executable capabilities of an ElizaOS agent. They define what an agent can DO in response to user input or environmental stimuli. Each action is a self-contained module that:

- Validates whether it can be executed in the current context
- Handles the execution logic
- Provides examples for the AI to learn from
- Returns structured results

### Action Structure

Every action in ElizaOS follows this interface:

```typescript
interface Action {
  name: string;                    // Unique identifier
  similes: string[];              // Alternative names/aliases
  description: string;            // What the action does
  validate: (runtime, message, state) => Promise<boolean>;
  handler: (runtime, message, state, options, callback) => Promise<ActionResult>;
  examples: ActionExample[][];    // Training examples
}
```

### Action Lifecycle

1. **Discovery**: The agent identifies available actions through the actions provider
2. **Validation**: Each action's `validate` function checks if it can be executed
3. **Selection**: The AI model chooses appropriate actions based on context
4. **Execution**: The `handler` function performs the action
5. **Callback**: Results are communicated back through the callback
6. **Result**: Structured data is returned for further processing

### Example: Reply Action

The `REPLY` action demonstrates a basic communication action:

```typescript
export const replyAction = {
  name: 'REPLY',
  similes: ['GREET', 'RESPOND', 'SEND_REPLY'],
  description: "Sends a direct message into in-game chat",
  
  validate: async (runtime) => {
    return true; // Always available
  },
  
  handler: async (runtime, message, state, options, callback) => {
    // Generate response using LLM
    const response = await runtime.useModel(ModelType.OBJECT_LARGE, {
      prompt: composePromptFromState({ state, template: replyTemplate })
    });
    
    // Send via callback
    await callback({
      text: response.message,
      actions: ['REPLY'],
      source: 'hyperfy'
    });
    
    return {
      text: response.message,
      values: { replied: true },
      data: { action: 'REPLY' }
    };
  }
}
```

### Complex Actions: Build/Edit

The `HYPERFY_EDIT_ENTITY` action shows how complex operations work:

1. **Multi-step Processing**: Extracts operations from user intent
2. **Validation**: Ensures world and build systems are available
3. **Execution**: Performs multiple scene edits (duplicate, move, scale, delete)
4. **Summarization**: Generates natural language summary of changes
5. **Error Handling**: Gracefully handles failures with retry logic

### Action Chaining

Actions can be chained together for complex behaviors:
- `GOTO` → `USE_ITEM`: Navigate to an object then interact with it
- `REPLY` → `WALK_RANDOMLY`: Respond to user then start wandering
- `PERCEPTION` → `BUILD`: Look around then modify the environment

## Providers

### What are Providers?

Providers inject contextual information into the agent's decision-making process. They gather and format relevant data that helps the AI understand the current situation and make appropriate decisions.

### Provider Structure

```typescript
interface Provider {
  name: string;              // Identifier used in templates
  description: string;       // What information it provides
  dynamic?: boolean;         // Whether content changes over time
  get: (runtime, message, state?) => Promise<ProviderResult>;
}

interface ProviderResult {
  text: string;      // Formatted text for LLM context
  values: object;    // Structured data for templates
  data: object;      // Raw data for processing
}
```

### Types of Providers

#### 1. **World State Provider** (`HYPERFY_WORLD_STATE`)
Provides real-time information about the 3D world:
- Entity positions and rotations
- Nearby interactable objects
- Other players/NPCs in the area
- Recent chat messages
- Agent's current position and state

#### 2. **Character Provider** (`CHARACTER`)
Supplies agent personality and behavior:
- Biography and backstory
- Communication style
- Example conversations
- Topics of interest
- System behavior rules

#### 3. **Actions Provider** (`ACTIONS`)
Lists available actions based on context:
- Valid actions for current state
- Action descriptions and examples
- Formatted for LLM understanding

#### 4. **Emote Provider** (`HYPERFY_EMOTE_LIST`)
Simple provider for available animations:
- List of emote names
- Descriptions of each animation
- Helps agent express emotions visually

### Provider Integration

Providers are automatically invoked when composing state:

```typescript
const state = await runtime.composeState(message, [
  'HYPERFY_WORLD_STATE',    // Current world information
  'CHARACTER',               // Agent personality
  'ACTIONS'                  // Available actions
]);
```

The composed state includes all provider outputs formatted for the LLM.

## Services

### What are Services?

Services are long-lived components that manage external connections, APIs, and stateful operations. Unlike actions (which are stateless), services maintain persistent connections and provide ongoing functionality.

### Service Structure

```typescript
interface Service {
  // Not shown in code but typical pattern:
  initialize(): Promise<void>;
  isConnected(): boolean;
  cleanup(): Promise<void>;
}
```

### HyperfyService Architecture

The HyperfyService manages the connection to Hyperfy virtual worlds:

1. **Connection Management**
   - WebSocket connection to world server
   - Authentication and session handling
   - Reconnection logic
   - Connection state tracking

2. **World Interface**
   - Access to world entities
   - Player/agent controls
   - Chat system interface
   - Build/edit capabilities

3. **Sub-Managers**
   - MessageManager: Handles chat history and message sending
   - BuildManager: Provides world editing capabilities
   - Controls: Agent movement and interaction

### HyperfyGameService

Extends base functionality for game-specific features:

```typescript
class HyperfyGameService {
  // Player movement in 3D space
  async movePlayer(playerId, position) {
    const world = this.hyperfyService.getWorld();
    world.entities.players.get(playerId).position = position;
    world.network.send('playerMove', { playerId, position });
  }
  
  // Game-specific actions
  async startTask(playerId, taskId) { }
  async performKill(killerId, victimId) { }
  async reportBody(reporterId, bodyId) { }
  async castVote(voterId, targetId) { }
}
```

## Hyperfy Integration

### Connection Flow

1. **Service Initialization**
   ```
   ElizaOS Runtime → HyperfyService → WebSocket → Hyperfy World
   ```

2. **Agent Embodiment**
   - Service creates visual representation in world
   - Establishes control interface
   - Begins receiving world updates

3. **Perception Loop**
   - World state provider polls environment
   - Updates include positions, nearby objects, chat
   - Information formatted for AI consumption

4. **Action Execution**
   - User input triggers action selection
   - Action validates against world state
   - Handler uses service methods to affect world
   - Results broadcast to all connected clients

### Integration Points

#### 1. **World State Synchronization**
The world provider continuously updates the agent's understanding:
- Entity positions via THREE.js vectors
- Quaternion rotations for orientations
- Scale information for objects
- Real-time chat messages

#### 2. **Control Interface**
Actions use the control system to:
- Navigate to positions (`goto(x, z)`)
- Follow entities (`followEntity(id)`)
- Interact with objects (`performAction(id)`)
- Start/stop behaviors (`startRandomWalk()`)

#### 3. **Build System**
Complex world modifications through:
- Entity duplication
- Position/rotation/scale transforms
- Entity deletion
- Asset importing

#### 4. **Message System**
Bi-directional communication:
- Receiving player messages
- Sending agent responses
- Tracking conversation history
- Managing message context

## Architecture Flow

### Complete Action Flow

1. **Input Reception**
   ```
   Player Message → Hyperfy World → WebSocket → HyperfyService
   ```

2. **Context Composition**
   ```
   Runtime.composeState() → 
     - Character Provider (personality)
     - World Provider (environment)
     - Actions Provider (capabilities)
   ```

3. **Decision Making**
   ```
   LLM processes composed state →
     Selects appropriate action(s) →
     Extracts parameters
   ```

4. **Action Execution**
   ```
   Action.validate() → 
   Action.handler() →
     - Use HyperfyService methods
     - Modify world state
     - Send callbacks
   ```

5. **Result Broadcasting**
   ```
   World state changes →
   Network broadcast →
   All clients update
   ```

### State Management

ElizaOS maintains state at multiple levels:

1. **Runtime State**: Core agent memory and context
2. **Service State**: Persistent connections and session data
3. **World State**: Current 3D environment snapshot
4. **Action State**: Temporary execution context

## Best Practices

### Action Development

1. **Clear Validation**
   - Check all prerequisites in `validate()`
   - Return false if action impossible
   - Don't throw errors in validation

2. **Robust Error Handling**
   - Try-catch in handlers
   - Graceful degradation
   - Meaningful error messages

3. **Comprehensive Examples**
   - Cover success cases
   - Include failure scenarios
   - Show parameter variations

4. **Callback Usage**
   - Always call callback for UI updates
   - Include metadata for debugging
   - Use appropriate response format

### Provider Implementation

1. **Efficient Data Gathering**
   - Cache when appropriate
   - Minimize computation
   - Filter irrelevant information

2. **Clear Formatting**
   - Structure text for LLM comprehension
   - Use headers and sections
   - Include only relevant context

3. **Data Types**
   - `text`: Formatted for LLM
   - `values`: For template variables
   - `data`: Raw for processing

### Service Design

1. **Connection Resilience**
   - Implement reconnection logic
   - Handle network interruptions
   - Maintain state across disconnects

2. **Resource Management**
   - Clean up connections
   - Remove event listeners
   - Clear intervals/timeouts

3. **Method Organization**
   - Group related functionality
   - Consistent error handling
   - Clear method naming

### Integration Guidelines

1. **Loose Coupling**
   - Actions shouldn't depend on specific services
   - Use runtime.getService() for access
   - Handle service unavailability

2. **Event-Driven Updates**
   - Use callbacks for async operations
   - Emit events for state changes
   - Subscribe to relevant world events

3. **Performance Considerations**
   - Throttle frequent updates
   - Batch operations when possible
   - Use efficient data structures

## Conclusion

The ElizaOS architecture provides a flexible framework for creating intelligent agents that can perceive and act in virtual worlds. Through the combination of:

- **Actions** for capabilities
- **Providers** for context
- **Services** for connections

Agents can engage in complex behaviors while maintaining clean separation of concerns. The Hyperfy integration demonstrates how this architecture scales to support real-time 3D virtual worlds with multiple participants, complex interactions, and persistent state.

The modular design allows developers to extend functionality by adding new actions, providers, or services without modifying core systems, making ElizaOS a powerful platform for creating embodied AI agents.
description: ElizaOS AI agent integration into Hyperfy
alwaysApply: false
---

# RuneScape-Inspired MVP Game Design Document

## Table of Contents

1. [Game Overview](#1-game-overview)
2. [World Design](#2-world-design)
3. [Player Systems](#3-player-systems)
4. [Combat System](#4-combat-system)
5. [Skills System](#5-skills-system)
6. [Items and Equipment](#6-items-and-equipment)
7. [NPCs and Mobs](#7-npcs-and-mobs)
8. [Economy and Trading](#8-economy-and-trading)
9. [User Interface](#9-user-interface)
10. [Multiplayer Architecture](#10-multiplayer-architecture)
11. [AI Agent Integration](#11-ai-agent-integration)
12. [Technical Implementation](#12-technical-implementation)
13. [Testing Framework](#13-testing-framework)
14. [MVP Scope and Future Expansions](#14-mvp-scope-and-future-expansions)

---

## 1. Game Overview

### Core Concept
A simplified MVP version of RuneScape built as a self-contained package using Hyperfy's Entity Component System and multiplayer architecture. The game features classic MMORPG mechanics including combat, skills, resource gathering, and progression in a persistent 3D world.

### Key Features
- Grid-based world with height-mapped terrain
- Real-time multiplayer gameplay
- Skill-based progression system
- Resource gathering and crafting
- PvE combat with loot drops
- Banking and inventory management
- Support for both human players and AI agents

### Target Experience
Players start with minimal equipment and must progress through combat and resource gathering to acquire better gear and increase their skills. The game emphasizes gradual progression and resource management in a shared persistent world.

---

## 2. World Design

### World Structure
- **Grid System**: World divided into discrete grid cells
- **Height Map**: Vertex-colored terrain with PhysX collision
- **Shared World**: Single persistent world for all players
- **No Occlusions**: Entirely height-map based with no overhangs

### Biome Types
Various biomes with appropriate resources and mob spawns:
- **Mistwood Valley**: Foggy forests with goblin camps
- **Goblin Wastes**: Barren lands dominated by goblin tribes
- **Darkwood Forest**: Dense, shadowy woods hiding dark warriors
- **Northern Reaches**: Frozen tundra with ice caves
- **Blasted Lands**: Desolate areas corrupted by dark magic
- **Lakes**: Fishing spots along shorelines
- **Plains**: General purpose areas with roads and camps

### Difficulty Zones
Four difficulty levels distributed across the map:
- **Level 0**: Starter towns (safe zones)
- **Level 1**: Low-level mob areas (Goblins, Bandits, Barbarians)
- **Level 2**: Intermediate mob areas (Hobgoblins, Guards, Dark Warriors)
- **Level 3**: High-level mob areas (Black Knights, Ice Warriors, Dark Rangers)

### Starter Towns
Multiple starter towns with:
- **Bank**: Item storage facility
- **General Store**: Basic equipment vendor
- **Safe Zone**: No hostile mobs
- **Random Spawn**: New players randomly assigned to different towns

### Resource Distribution
- **Trees**: Scattered throughout appropriate biomes
- **Fishing Spots**: Along lake shorelines
- **Mob Spawns**: Based on biome and difficulty level

### Terrain Rules
- Water bodies are impassable
- Steep mountain slopes block movement
- PhysX engine handles collision detection

---

## 3. Player Systems

### Starting Conditions
- **Equipment**: Bronze sword (equipped)
- **Location**: Random starter town
- **Stats**: Base level 1 in all skills

### Core Stats
- **ATK (Attack)**: Determines accuracy and weapon access
- **STR (Strength)**: Determines damage dealt
- **RANGE**: Ranged combat effectiveness
- **DEF (Defense)**: Damage reduction and armor access
- **CON (Constitution)**: Health points

### Derived Stats
- **Combat Level**: Aggregate of ATK, STR, RANGE, DEF
- **Health Points**: Determined by Constitution level
- **Armor Rating**: Based on Defense and equipment

### Movement System
- **Walking**: Default movement speed
- **Running**: Faster movement, consumes stamina
- **Stamina Bar**: Depletes while running, regenerates when walking
- **Click-to-Move**: Orthographic overhead camera with point-and-click navigation

### Death Mechanics
- Items dropped at death location (headstone)
- Player respawns at nearest starter town
- Must retrieve items from death location

### Level Progression
- Experience-based leveling following RuneScape formulas
- Skills level independently through use
- No point allocation system

---

## 4. Combat System

### Combat Mechanics
- **Real-time combat**: Auto-attack when in range
- **Attack Styles**: Player selects focus for XP distribution
- **Damage Calculation**: Based on RuneScape formulas
- **Hit Frequency**: Determined by Attack level and equipment
- **Damage Amount**: Determined by Strength and weapon
- **Ranged Combat**: Requires bow and arrows equipped

### Ranged Combat Specifics
- **Arrow Requirement**: Must have arrows equipped to use bow
- **Arrow Consumption**: Arrows are depleted with each shot
- **No Arrows**: Cannot attack with bow if no arrows equipped

### Combat Flow
1. Player initiates combat by attacking mob
2. Auto-attack continues while in range
3. XP distributed based on selected combat style
4. Constitution XP always gained
5. Loot drops on mob death

### PvP Status
- **MVP Scope**: PvE only
- **Future**: PvP combat planned

---

## 5. Skills System

### Available Skills (MVP)
1. **Attack**: Melee accuracy and weapon requirements
2. **Strength**: Melee damage
3. **Defense**: Damage reduction and armor requirements
4. **Constitution**: Health points
5. **Range**: Ranged combat
6. **Woodcutting**: Tree harvesting
7. **Fishing**: Fish gathering
8. **Firemaking**: Creating fires from logs
9. **Cooking**: Preparing food

### Skill Mechanics
- **Experience Gain**: Through relevant actions
- **Level Requirements**: Gate equipment and activities
- **Level Cap**: Following RuneScape standards

### Resource Gathering
- **Woodcutting**: Click tree with hatchet equipped
- **Fishing**: Click water edge with fishing rod equipped
- **Success Rates**: Based on skill level

### Processing Skills
- **Firemaking**: Use tinderbox on logs in inventory
- **Cooking**: Use raw fish on fire

---

## 6. Items and Equipment

### Weapon Types
1. **Swords**
   - Bronze (Level 1+)
   - Steel (Level 10+)
   - Mithril (Level 20+)

2. **Bows**
   - Wood (Level 1+)
   - Oak (Level 10+)
   - Willow (Level 20+)

3. **Shields**
   - Bronze (Level 1+)
   - Steel (Level 10+)
   - Mithril (Level 20+)

### Ammunition
- **Arrows**: Required for bow usage
- **Consumption**: Depleted on use
- **Equipment Slot**: Dedicated arrow slot
- **Stackable**: Can carry multiple arrows in one slot

### Armor Types
Three equipment slots:
1. **Helmet**
2. **Body**
3. **Legs**

Armor Materials:
- Leather/Hard Leather/Studded Leather
- Bronze/Steel/Mithril

### Equipment Slots
- **Weapon**: Primary weapon slot
- **Shield**: Off-hand slot
- **Helmet**: Head protection
- **Body**: Torso protection
- **Legs**: Leg protection
- **Arrows**: Ammunition slot (required for bows)

### Tools
- **Hatchet**: Bronze only (MVP)
- **Fishing Rod**: Standard
- **Tinderbox**: Fire creation

### Resources
- **Logs**: From trees
- **Raw Fish**: From fishing
- **Cooked Fish**: Processed food

### Currency
- **Coins**: Universal currency
- Dropped by mobs
- Used at general store

### Item Properties
- **Stack Limit**: 28 inventory slots
- **Bank Storage**: Unlimited slots per bank
- **Tradeable**: All items (future feature)
- **Requirements**: Level gates for equipment

---

## 7. NPCs and Mobs

### Difficulty Level 1 - Beginner Enemies

**Goblins**
- **Description**: Small green humanoids with crude weapons
- **Locations**: Mistwood Valley, Goblin Wastes
- **Behavior**: Moderately aggressive, low aggro range
- **Combat Stats**: Low attack/defense, minimal HP
- **Drops**: Coins (common), bronze equipment (rare)
- **Lore**: The classic first enemy - every adventurer remembers their first goblin kill

**Men/Women (Desperate Bandits)**
- **Description**: Humans who turned to crime after the Calamity
- **Locations**: Near roads and town outskirts
- **Behavior**: Aggressive to low-level players only
- **Combat Stats**: Slightly stronger than goblins
- **Drops**: Small amounts of coins
- **Lore**: More desperate than evil, victims of circumstance

**Barbarians**
- **Description**: Primitive humans living in the wilderness
- **Locations**: Forest camps and clearings
- **Behavior**: Aggressive within camp boundaries
- **Combat Stats**: Tougher than bandits, more HP
- **Drops**: Coins, basic equipment (bronze tier)
- **Lore**: Wild warriors who reject civilization

### Difficulty Level 2 - Intermediate Enemies

**Hobgoblins**
- **Description**: Larger, militaristic cousins of goblins
- **Locations**: Deeper areas of Goblin Wastes
- **Behavior**: Highly aggressive, larger aggro range
- **Combat Stats**: Organized fighters with better accuracy
- **Drops**: More coins, steel equipment (uncommon)
- **Lore**: Elite goblin warriors with military discipline

**Guards (Corrupted Soldiers)**
- **Description**: Former kingdom soldiers serving dark masters
- **Locations**: Ancient ruins, abandoned fortresses
- **Behavior**: Aggressive, patrol fixed areas
- **Combat Stats**: Well-trained, balanced offense/defense
- **Drops**: Steel equipment (common), coins
- **Lore**: Once protectors, now enslaved by darkness

**Dark Warriors**
- **Description**: Warriors who embraced darkness after the Calamity
- **Locations**: Depths of Darkwood Forest
- **Behavior**: Very aggressive, ignore player level
- **Combat Stats**: High damage, moderate defense
- **Drops**: Steel equipment, cursed items (future content)
- **Lore**: Fallen knights who chose power over honor

### Difficulty Level 3 - Advanced Enemies

**Black Knights**
- **Description**: The most feared human enemies, masters of combat
- **Locations**: Black Knight Fortress, dark strongholds
- **Behavior**: Extremely aggressive, always hostile
- **Combat Stats**: Elite warriors with high stats across the board
- **Drops**: Mithril equipment (uncommon), substantial coins
- **Lore**: Elite dark warriors in pitch-black armor

**Ice Warriors**
- **Description**: Ancient warriors of Valorhall, frozen but still fighting
- **Locations**: Ice caves in the Northern Reaches
- **Behavior**: Aggressive, slow but extremely tough
- **Combat Stats**: Very high defense and HP
- **Drops**: Mithril equipment, ancient treasures
- **Lore**: Frozen champions guarding old kingdom treasures

**Dark Rangers**
- **Description**: Master bowmen who turned to darkness
- **Locations**: Shadows of the Blasted Lands
- **Behavior**: Aggressive at long range
- **Combat Stats**: Deadly accuracy, high ranged damage
- **Drops**: Mithril equipment, arrows (common)
- **Lore**: Elite archers with powerful longbows

### Mob Properties (All Enemies)
- **Stats**: Same system as players (ATK, STR, DEF, etc.)
- **Aggression**: Variable per mob type
- **Aggro Range**: Distance at which aggressive mobs attack
- **Level Check**: High-level players ignored by low-level aggressive mobs (except special cases)
- **Chase Mechanics**: Return to spawn if player escapes range
- **Special Cases**: Dark Warriors and higher always aggressive regardless of player level

### Spawning System
- **Global Timer**: 15-minute respawn cycle
- **Fixed Locations**: Mobs spawn at predetermined points
- **Biome Appropriate**: Mobs match their environment
- **Difficulty Appropriate**: Mob level matches zone difficulty

### Loot System
- **Guaranteed Drops**: Every mob drops something
- **Drop Tables**: 
  - Level 1 mobs: Coins (always), bronze equipment (rare)
  - Level 2 mobs: More coins (always), steel equipment (uncommon)
  - Level 3 mobs: Substantial coins (always), mithril equipment (uncommon), arrows (common for Dark Rangers)
- **Level Scaling**: Better items from harder mobs
- **Common Drops**: Coins (most frequent)
- **Equipment Drops**: Match mob's difficulty tier

---

## 8. Economy and Trading

### General Store
Available Items:
- **Hatchet** (Bronze) - For woodcutting
- **Fishing Rod** - For fishing
- **Tinderbox** - For firemaking
- **Arrows** - Ammunition for bows

### Banking System
- **Location**: One per starter town
- **Storage**: Unlimited slots
- **Independence**: Each bank separate (no shared storage)
- **Interface**: Click to open, drag items to store/retrieve

### Economy Flow
1. Kill mobs for coins
2. Purchase tools and arrows from store
3. Gather resources with tools
4. Process resources for consumables
5. Use consumables to sustain combat

---

## 9. User Interface

### HUD Elements
- **Health Bar**: Current/Max HP
- **Stamina Bar**: Running energy
- **Combat Style Selector**: XP distribution choice
- **Arrow Counter**: Shows equipped arrow count

### Interface Windows
- **Inventory**: 28-slot grid
- **Bank**: Unlimited storage grid
- **Skills**: Skill levels and XP
- **Equipment**: Worn items display (including arrow slot)
- **Map**: World overview

### Control Scheme
- **Movement**: Click-to-move (orthographic overhead view)
- **Combat**: Click enemy to attack
- **Interaction**: Click objects/NPCs
- **Inventory Management**: Drag and drop

---

## 10. Multiplayer Architecture

### Network Structure
- **WebSocket Connection**: Real-time communication
- **Persistent World**: Shared game state
- **Entity Synchronization**: Via Hyperfy ECS

### Player Management
- **Authentication**: Account-based system
- **Character Persistence**: Stats and inventory saved
- **Concurrent Players**: Unlimited (infrastructure dependent)

---

## 11. AI Agent Integration

### Agent Capabilities
- **Connection**: WebSocket (same as players)
- **Physics Simulation**: Accurate world model
- **Vision**: Screenshot capability (future)
- **Decision Making**: LLM-driven via ElizaOS

### Agent Actions
All player actions available:
- Attack
- Gather (contextual: chop/fish)
- Interact
- Go To
- Equip/Unequip
- Drop/Pick Up
- Loot
- Eat
- Inventory management

### Agent Interfaces
Queryable game state:
- Inventory contents
- Player stats
- Nearby entities
- Skills and XP
- Equipment status
- Arrow count

### Navigation
- **Semantic**: North/South/East/West
- **Relative**: Near/far descriptions
- **Text-based**: MUD-like interface

---

## 12. Technical Implementation

### Core Technology
- **Engine**: Hyperfy (TypeScript)
- **Networking**: LiveKit WebRTC
- **3D Graphics**: Three.js
- **Physics**: PhysX
- **Avatar Format**: VRM
- **Model Format**: GLB

### Asset Pipeline
1. **Concept**: AI-generated designs
2. **3D Generation**: MeshyAI
3. **Rigging**: Automatic for humanoids
4. **Hardpoint Detection**: AI-assisted attachment points
5. **Optimization**: 2000 triangle target

### World Generation
- **Height Maps**: Procedural generation
- **Vertex Coloring**: Biome representation
- **Collision Mesh**: PhysX integration

### Animation System
Shared rig for all humanoids:
- Walk/Run cycles
- Combat animations (melee and ranged)
- Gathering animations
- Generic interaction
- Death animation

---

## 13. Testing Framework

### Visual Testing System
- **Camera Setup**: Overhead orthographic view
- **Color Proxies**: Unique colors per entity type
- **Pixel Analysis**: Verify entity positions
- **Automation**: Puppeteer/Cypress integration

### Test Scenarios
Individual test worlds for:
- Combat verification (melee and ranged)
- Movement validation
- Inventory management
- Resource gathering
- Banking operations
- Mob spawning
- Arrow depletion

### Verification Methods
- **Visual**: Color-based position tracking
- **Programmatic**: Direct state queries
- **Behavioral**: Action sequence validation
- **Statistical**: Damage/XP calculations

### Test Requirements
- No simulation or "fake" tests
- Real world interaction
- Visual confirmation required
- Automated regression testing

---

## 14. MVP Scope and Future Expansions

### MVP Deliverables
- Core combat system (melee and ranged)
- Basic resource gathering (wood, fish)
- Three equipment tiers
- Arrow system for ranged combat
- Simple progression system
- Banking and inventory
- Multiplayer support
- AI agent compatibility

### Explicit MVP Limitations
- No PvP combat
- Limited skills (9 total)
- Three equipment tiers only
- Single tool tier (bronze)
- No trading between players
- No quests or NPCs beyond mobs
- Basic arrow type only

### Future Expansions (NOT IN THE SCOPE OF THIS PROJECT)
- Complete RuneScape skill set
- Full equipment tiers
- Multiple arrow types
- Player trading/Grand Exchange
- Quest system
- PvP combat
- Clans/guilds
- More complex crafting
- Additional biomes
- Dungeons/instances
- Mini-games

### Success Metrics
- Stable multiplayer performance
- Functional progression loop
- AI agents successfully playing
- All systems visually testable
- Complete end-to-end testing of every system with no mocks, all tests passing

---
description: Hyperfy docs and links to important parts of the Hyperfy 3D engine (and three.js)
alwaysApply: false
---
# Scripts

## IMPORTANT

As Hyperfy is in alpha, the scripting API is likely to evolve fast with breaking changes.
This means your apps can and will break as you upgrade worlds.
Once scripting is stable we'll move toward a forward compatible model, which will allow apps to be shared/traded with more confidence that they will continue to run correctly.

## Lifecycle

TODO: explain the app lifecycle across client and server

## Globals

Apps run inside their own secure environment with a strict API that allows apps built by many different authors to co-exist in a real-time digital world.

Just as websites run inside a DOM-based environment that provides browser APIs via globals, Apps run inside an app-based environment that provides app specific APIs by way of its own set of globals.

- [app](hyperfy/docs/ref/App.md)
- [world](hyperfy/docs/ref/World.md)
- [props](hyperfy/docs/ref/Props.md)
- [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [num](hyperfy/docs/ref/num.md)
- [Vector3](https://threejs.org/docs/#api/en/math/Vector3)
- [Quaternion](https://threejs.org/docs/#api/en/math/Quaternion)
- [Euler](https://threejs.org/docs/#api/en/math/Euler)
- [Matrix4](https://threejs.org/docs/#api/en/math/Matrix4)

## Nodes

Apps are made up of a hierarchy of nodes that you can view and modify within the app runtime using scripts.

The gltf model that each app is based on is automatically converted into nodes and inserted into the app runtime for you to interact with.

Some nodes can also be created and used on the fly using `app.create(nodeName)`.

- [Group](hyperfy/docs/ref/Group.md)
- [Mesh](hyperfy/docs/ref/Mesh.md)
- [LOD](hyperfy/docs/ref/LOD.md)
- [Avatar](hyperfy/docs/ref/Avatar.md)
- [Action](hyperfy/docs/ref/Action.md)
- [Controller](hyperfy/docs/ref/Controller.md)
- [RigidBody](hyperfy/docs/ref/RigidBody.md)
- [Collider](hyperfy/docs/ref/Collider.md)
- [Joint](hyperfy/docs/ref/Joint.md)
# Scripts

## IMPORTANT

As Hyperfy is in alpha, the scripting API is likely to evolve fast with breaking changes.
This means your apps can and will break as you upgrade worlds.
Once scripting is stable we'll move toward a forward compatible model, which will allow apps to be shared/traded with more confidence that they will continue to run correctly.

## Lifecycle

TODO: explain the app lifecycle across client and server

## Globals

Apps run inside their own secure environment with a strict API that allows apps built by many different authors to co-exist in a real-time digital world.

Just as websites run inside a DOM-based environment that provides browser APIs via globals, Apps run inside an app-based environment that provides app specific APIs by way of its own set of globals.

- [app](hyperfy/docs/ref/App.md)
- [world](hyperfy/docs/ref/World.md)
- [props](hyperfy/docs/ref/Props.md)
- [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [num](hyperfy/docs/ref/num.md)
- [Vector3](https://threejs.org/docs/#api/en/math/Vector3)
- [Quaternion](https://threejs.org/docs/#api/en/math/Quaternion)
- [Euler](https://threejs.org/docs/#api/en/math/Euler)
- [Matrix4](https://threejs.org/docs/#api/en/math/Matrix4)

## Nodes

Apps are made up of a hierarchy of nodes that you can view and modify within the app runtime using scripts.

The gltf model that each app is based on is automatically converted into nodes and inserted into the app runtime for you to interact with.

Some nodes can also be created and used on the fly using `app.create(nodeName)`.

- [Group](hyperfy/docs/ref/Group.md)
- [Mesh](hyperfy/docs/ref/Mesh.md)
- [LOD](hyperfy/docs/ref/LOD.md)
- [Avatar](hyperfy/docs/ref/Avatar.md)
- [Action](hyperfy/docs/ref/Action.md)
- [Controller](hyperfy/docs/ref/Controller.md)
- [RigidBody](hyperfy/docs/ref/RigidBody.md)
- [Collider](hyperfy/docs/ref/Collider.md)
- [Joint](hyperfy/docs/ref/Joint.md)

# Building Games on Hyperfy: A Conceptual Guide

## Understanding Hyperfy as a Game Platform

Hyperfy is fundamentally different from traditional game engines. Rather than being a tool for creating isolated game experiences, it's a platform for persistent, shared virtual worlds where multiple experiences can coexist and interact.

### Core Principles

**Persistence Over Sessions**: Unlike traditional games that exist only while players are actively engaged, Hyperfy worlds persist continuously. This changes how you think about game state, progression, and world evolution.

**Shared Reality**: Every player experiences the same world state. There's no concept of "single player" or isolated instances - everything happens in a shared space that all participants can affect.

**Real-time Synchronization**: The platform handles the complexity of keeping all participants synchronized. As a game designer, you define what happens; Hyperfy ensures everyone sees it happen simultaneously.

**Apps as Building Blocks**: Instead of monolithic game logic, Hyperfy uses "Apps" - self-contained interactive objects that can be combined to create complex experiences. Think of them as smart objects that know how to behave and interact.

## The Virtual World Philosophy

### Worlds vs Games

In Hyperfy, you don't build a "game" in the traditional sense. You build a world with game-like mechanics. This distinction is crucial:

- **Traditional Game**: Players launch, play through designed experiences, then exit
- **Hyperfy World**: A persistent space where gameplay emerges from the interaction of systems, players, and objects

## Architecture and Design Patterns

### The Client-Server Authority Model

Hyperfy uses an authoritative server model, which fundamentally shapes how you design game mechanics:

**Server Authority Means**:
- The server is the single source of truth
- Clients send intentions, not actions
- All game logic validation happens server-side
- State changes propagate from server to clients

**Design Implications**:
- Never trust client input
- Design with latency in mind
- Implement prediction for responsive feel
- Plan for conflict resolution

### System-Based Architecture

Hyperfy encourages system-based thinking. Instead of objects with behaviors, you have:

- **Systems**: Logic processors that operate on components
- **Components**: Pure data containers
- **Entities**: Identifiers that link components together

This separation allows for incredible flexibility and reusability.

### Event-Driven Communication

Systems communicate through events rather than direct calls. This creates loose coupling and allows for:
- Easy extension of functionality
- Multiple systems responding to single actions
- Clean separation of concerns
- Easier debugging and testing

## The Entity Component System Paradigm

### Thinking in Components

Traditional object-oriented game design often leads to complex inheritance hierarchies. ECS flips this by using composition:

**Traditional Approach**: 
- Player inherits from Character
- Character inherits from GameObject
- Deep, rigid hierarchies

**ECS Approach**:
- Player is an entity with Position, Health, Inventory components
- NPC is an entity with Position, Health, AI components
- Flexible composition

### System Responsibilities

Each system should have a single, clear responsibility:

- **Movement System**: Handles all position updates
- **Combat System**: Manages damage calculations and combat state
- **Inventory System**: Tracks items and equipment
- **AI System**: Processes NPC decisions

Systems query for entities with specific component combinations and process them accordingly.

### Data-Driven Design

Components should be pure data. This enables:
- Easy serialization for networking
- Simple state persistence
- Clear separation of data and logic
- Predictable behavior

## Building Interactive Worlds

### Terrain and Environment

Hyperfy worlds start with terrain. The approach you take shapes everything else:

**Height-Map Based Worlds**:
- Efficient for large, open environments
- Natural-looking landscapes
- Easy to generate procedurally
- Limited to no overhangs or caves

**Constructed Environments**:
- Built from 3D models and prefabs
- Allows for complex architecture
- More control over aesthetics
- Higher performance cost

## The App System Philosophy

### Apps as Smart Objects

Apps in Hyperfy are more than just 3D models - they're complete interactive experiences:

**Self-Contained Logic**:
- Each app manages its own behavior
- Clear boundaries of responsibility
- Reusable across different contexts

**Configurable Properties**:
- Expose key parameters for customization
- Allow non-programmers to modify behavior
- Create variants without code duplication

### Composition Over Complexity

Build complex experiences from simple apps:
- A shop is a building app + NPC app + inventory interface
- A quest is an NPC app + objective tracker + reward system
- A dungeon is terrain apps + monster apps + loot apps

### Interoperability

Design apps to work together:
- Standard communication protocols
- Consistent data formats
- Clear interaction patterns
- Predictable behaviors

## Technical Implementation Examples

### Building Apps in Hyperfy

Apps are the fundamental building blocks of interactive content. Here's how they work technically:

```javascript
// App configuration - expose customizable properties
app.configure([
  {
    type: 'number',
    key: 'health',
    label: 'Starting Health',
    initial: 100,
    min: 1,
    max: 1000
  },
  {
    type: 'text',
    key: 'mobType',
    label: 'Mob Type',
    initial: 'goblin'
  }
])

// Access the 3D model nodes
const model = app.get('GoblinModel') // Reference to GLB model node
const nameTag = app.get('NameTag') // Reference to text display

// App state management
app.state = {
  currentHealth: props.health,
  isAggro: false,
  target: null
}

// Create interactive elements
const action = app.create('action')
action.label = 'Attack Goblin'
action.distance = 5
action.duration = 0.5

action.onTrigger = () => {
  // Send attack request to server
  app.send('mob:attack', { 
    mobId: app.instanceId,
    attackerId: world.getPlayer().id 
  })
}

model.add(action)

// Handle server events
app.on('mob:damaged', (data) => {
  app.state.currentHealth = data.newHealth
  
  // Visual feedback
  const flash = app.create('mesh')
  flash.material.color = 'red'
  flash.material.opacity = 0.5
  // ... animate flash effect
})

// Update loop for client-side animations
app.on('update', (dt) => {
  // Idle animation
  model.rotation.y += dt * 0.5
  
  // Update health display
  if (nameTag) {
    nameTag.text = `${props.mobType} (${app.state.currentHealth}/${props.health})`
  }
})
```

### Creating Game Systems

Systems in Hyperfy extend a base System class and process entities with specific components:

```typescript
import { System } from 'hyperfy'

export class MobSystem extends System {
  name = 'MobSystem'
  
  // System state
  private mobs: Map<string, MobData> = new Map()
  private respawnQueue: RespawnEntry[] = []
  
  async init(): Promise<void> {
    // Listen for world events
    this.world.events.on('entity:created', this.onEntityCreated.bind(this))
    this.world.events.on('mob:attack', this.handleAttack.bind(this))
    
    // Start update loop
    this.startUpdateLoop()
  }
  
  private onEntityCreated(event: any) {
    const entity = this.getEntity(event.entityId)
    if (entity?.type === 'mob') {
      this.registerMob(entity)
    }
  }
  
  private registerMob(entity: Entity) {
    const mobData = {
      id: entity.id,
      type: entity.data.mobType,
      level: entity.data.level || 1,
      maxHealth: entity.data.health || 100,
      currentHealth: entity.data.health || 100,
      position: entity.position,
      spawnPoint: entity.position.clone(),
      aggroRange: 10,
      state: 'idle'
    }
    
    this.mobs.set(entity.id, mobData)
    
    // Add components
    entity.addComponent('stats', {
      attack: this.calculateAttack(mobData.level),
      strength: this.calculateStrength(mobData.level),
      defense: this.calculateDefense(mobData.level)
    })
    
    entity.addComponent('combat', {
      inCombat: false,
      target: null,
      lastAttack: 0
    })
  }
  
  update(deltaTime: number) {
    const now = Date.now()
    
    // Process each mob
    for (const [mobId, mobData] of this.mobs) {
      const entity = this.getEntity(mobId)
      if (!entity) continue
      
      // AI behavior based on state
      switch (mobData.state) {
        case 'idle':
          this.processIdleState(entity, mobData)
          break
        case 'aggressive':
          this.processAggressiveState(entity, mobData)
          break
        case 'returning':
          this.processReturningState(entity, mobData)
          break
      }
    }
    
    // Process respawns
    this.processRespawnQueue(now)
  }
  
  private processIdleState(entity: Entity, mobData: MobData) {
    // Check for nearby players
    const players = this.world.getPlayers()
    
    for (const player of players) {
      const distance = entity.position.distanceTo(player.position)
      
      if (distance <= mobData.aggroRange) {
        // Check if mob is aggressive type
        if (this.isAggressiveMob(mobData.type)) {
          mobData.state = 'aggressive'
          mobData.target = player.id
          
          // Emit aggro event
          this.world.events.emit('mob:aggro', {
            mobId: entity.id,
            targetId: player.id
          })
        }
      }
    }
  }
  
  private handleAttack(event: { mobId: string, attackerId: string }) {
    const mob = this.mobs.get(event.mobId)
    const attacker = this.getEntity(event.attackerId)
    
    if (!mob || !attacker) return
    
    // Validate attack
    const distance = this.calculateDistance(
      this.getEntity(event.mobId), 
      attacker
    )
    
    if (distance > 2) {
      // Too far away
      return
    }
    
    // Apply damage
    const damage = this.calculateDamage(attacker, mob)
    mob.currentHealth -= damage
    
    // Broadcast damage event
    this.world.broadcast('mob:damaged', {
      mobId: event.mobId,
      damage,
      newHealth: mob.currentHealth,
      attackerId: event.attackerId
    })
    
    // Check death
    if (mob.currentHealth <= 0) {
      this.handleMobDeath(event.mobId, event.attackerId)
    }
  }
  
  private handleMobDeath(mobId: string, killerId: string) {
    const mob = this.mobs.get(mobId)
    if (!mob) return
    
    // Drop loot
    this.world.events.emit('loot:drop', {
      position: this.getEntity(mobId).position,
      drops: this.calculateLoot(mob),
      killerId
    })
    
    // Award experience
    this.world.events.emit('experience:grant', {
      playerId: killerId,
      skill: 'combat',
      amount: mob.level * 10
    })
    
    // Schedule respawn
    this.respawnQueue.push({
      mobType: mob.type,
      position: mob.spawnPoint,
      respawnTime: Date.now() + 30000 // 30 seconds
    })
    
    // Remove entity
    const entity = this.getEntity(mobId)
    entity?.destroy()
    this.mobs.delete(mobId)
  }
}
```

### Combat System Implementation

The combat system manages all combat interactions between entities:

```typescript
export class CombatSystem extends System {
  name = 'CombatSystem'
  
  private combatSessions: Map<string, CombatSession> = new Map()
  private readonly TICK_RATE = 600 // Game tick in ms
  
  async init(): Promise<void> {
    // Combat initiation
    this.world.events.on('combat:initiate', this.startCombat.bind(this))
    this.world.events.on('combat:cancel', this.endCombat.bind(this))
    
    // Start combat tick
    setInterval(() => this.processCombatTick(), this.TICK_RATE)
  }
  
  private startCombat(event: { attackerId: string, targetId: string }) {
    // Validate combat initiation
    const attacker = this.getEntity(event.attackerId)
    const target = this.getEntity(event.targetId)
    
    if (!this.canAttack(attacker, target)) {
      return
    }
    
    // Create combat session
    const session: CombatSession = {
      attackerId: event.attackerId,
      targetId: event.targetId,
      startTime: Date.now(),
      attackStyle: this.getAttackStyle(attacker)
    }
    
    this.combatSessions.set(event.attackerId, session)
    
    // Update components
    const combatComp = attacker.getComponent('combat')
    combatComp.inCombat = true
    combatComp.target = event.targetId
  }
  
  private processCombatTick() {
    for (const [sessionId, session] of this.combatSessions) {
      const attacker = this.getEntity(session.attackerId)
      const target = this.getEntity(session.targetId)
      
      // Validate session
      if (!this.isValidSession(attacker, target)) {
        this.endCombat({ entityId: session.attackerId })
        continue
      }
      
      // Calculate hit
      const hitResult = this.calculateHit(attacker, target)
      
      // Apply damage
      if (hitResult.hit) {
        this.applyDamage(target, hitResult.damage)
        
        // Special effects for different attack types
        if (session.attackStyle === 'magic') {
          this.processMagicEffects(attacker, target, hitResult)
        } else if (session.attackStyle === 'ranged') {
          this.consumeAmmunition(attacker)
        }
      }
      
      // Broadcast combat update
      this.world.broadcast('combat:update', {
        attackerId: session.attackerId,
        targetId: session.targetId,
        damage: hitResult.damage,
        hitType: hitResult.hit ? 'hit' : 'miss'
      })
      
      // Award experience
      if (hitResult.hit) {
        this.awardCombatExperience(attacker, hitResult.damage, session.attackStyle)
      }
    }
  }
  
  private calculateHit(attacker: Entity, target: Entity): HitResult {
    const attackerStats = attacker.getComponent('stats')
    const targetStats = target.getComponent('stats')
    const equipment = attacker.getComponent('equipment')
    
    // Get attack bonuses from equipment
    const attackBonus = this.getEquipmentBonus(equipment, 'attack')
    const strengthBonus = this.getEquipmentBonus(equipment, 'strength')
    
    // Calculate accuracy
    const attackRoll = Math.random() * (attackerStats.attack + attackBonus + 8)
    const defenseRoll = Math.random() * (targetStats.defense + 8)
    
    if (attackRoll <= defenseRoll) {
      return { hit: false, damage: 0 }
    }
    
    // Calculate damage
    const maxHit = Math.floor(
      0.5 + (attackerStats.strength + strengthBonus + 8) / 10
    )
    const damage = Math.floor(Math.random() * (maxHit + 1))
    
    return { hit: true, damage }
  }
  
  private awardCombatExperience(
    attacker: Entity, 
    damage: number, 
    style: string
  ) {
    const xpAmount = damage * 4 // RuneScape style
    
    switch (style) {
      case 'accurate':
        this.world.events.emit('experience:grant', {
          entityId: attacker.id,
          skill: 'attack',
          amount: xpAmount
        })
        break
      case 'aggressive':
        this.world.events.emit('experience:grant', {
          entityId: attacker.id,
          skill: 'strength',
          amount: xpAmount
        })
        break
      case 'defensive':
        this.world.events.emit('experience:grant', {
          entityId: attacker.id,
          skill: 'defense',
          amount: xpAmount
        })
        break
    }
    
    // Always award constitution XP
    this.world.events.emit('experience:grant', {
      entityId: attacker.id,
      skill: 'constitution',
      amount: xpAmount * 0.33
    })
  }
}
```

### Creating Interactive NPCs

NPCs combine apps with AI behavior:

```javascript
// NPC App Script
app.configure([
  {
    type: 'text',
    key: 'npcName',
    label: 'NPC Name',
    initial: 'Guard'
  },
  {
    type: 'file',
    key: 'dialogue',
    label: 'Dialogue Tree',
    kind: 'json'
  }
])

// Create interaction zones
const interactionZone = app.create('trigger')
interactionZone.radius = 5
interactionZone.height = 2

interactionZone.onEnter = (other) => {
  if (other.tag === 'player') {
    // Show interaction prompt
    app.send('ui:show_prompt', {
      playerId: other.id,
      message: `Talk to ${props.npcName}`
    })
  }
}

// Create dialogue action
const talkAction = app.create('action')
talkAction.label = `Talk to ${props.npcName}`
talkAction.distance = 3

talkAction.onTrigger = () => {
  const player = world.getPlayer()
  
  app.send('dialogue:start', {
    npcId: app.instanceId,
    playerId: player.id,
    dialogueTree: props.dialogue
  })
}

// NPC behavior patterns
let behaviorState = 'idle'
let patrolPath = [
  { x: 0, z: 0 },
  { x: 10, z: 0 },
  { x: 10, z: 10 },
  { x: 0, z: 10 }
]
let currentPatrolIndex = 0

app.on('update', (dt) => {
  switch (behaviorState) {
    case 'idle':
      // Random chance to start patrol
      if (Math.random() < 0.001) {
        behaviorState = 'patrolling'
      }
      break
      
    case 'patrolling':
      const target = patrolPath[currentPatrolIndex]
      const distance = Math.sqrt(
        Math.pow(app.position.x - target.x, 2) + 
        Math.pow(app.position.z - target.z, 2)
      )
      
      if (distance < 0.5) {
        currentPatrolIndex = (currentPatrolIndex + 1) % patrolPath.length
      } else {
        // Move towards target
        const dir = {
          x: target.x - app.position.x,
          z: target.z - app.position.z
        }
        const len = Math.sqrt(dir.x * dir.x + dir.z * dir.z)
        dir.x /= len
        dir.z /= len
        
        app.position.x += dir.x * dt * 2
        app.position.z += dir.z * dt * 2
      }
      break
  }
})
```

## Physics and Spatial Reasoning

### Understanding PhysX Integration

Hyperfy uses PhysX for physics simulation, which provides:
- Realistic collision detection
- Efficient broad-phase culling
- Stable constraint solving
- Deterministic results

### Designing with Physics

Physics isn't just for realism - it's a design tool:

**Movement Mechanics**:
- Controller capsules for character movement
- Terrain collision for environmental boundaries
- Trigger volumes for area detection

**Interaction Systems**:
- Proximity-based activation
- Line-of-sight checks
- Projectile trajectories
- Area effects

### Practical Physics Implementation

```javascript
// Create a physics-enabled mob controller
const controller = app.create('controller')
controller.radius = 0.5
controller.height = 1.8
controller.layer = 'enemy'

// Movement with physics
app.on('update', (dt) => {
  if (app.state.target) {
    const direction = new Vector3()
      .subVectors(app.state.target.position, app.position)
      .normalize()
    
    // Apply movement with physics constraints
    controller.move(direction.multiplyScalar(dt * 5))
    
    // Gravity
    controller.move(new Vector3(0, -9.81 * dt, 0))
  }
})

// Create trigger zones for abilities
const aoeAttack = app.create('trigger')
aoeAttack.radius = 5
aoeAttack.tag = 'damage_zone'

aoeAttack.onEnter = (other) => {
  if (other.tag === 'player') {
    app.send('damage:area', {
      targetId: other.id,
      damage: 10,
      damageType: 'fire'
    })
  }
}
```

## Performance Considerations

When building complex systems:

1. **Entity Pooling**: Reuse entities instead of creating/destroying
2. **Spatial Partitioning**: Only process nearby entities
3. **LOD Systems**: Reduce detail for distant objects
4. **Update Throttling**: Not everything needs to update every frame

## Security and Trust

Never trust the client:
- Validate all inputs server-side
- Implement rate limiting
- Check permissions for actions
- Log suspicious behavior

Virtual economies need protection:
- Transaction validation
- Exploit detection
- Market manipulation prevention
- Item duplication checks

Protect player experiences:
- Anti-griefing mechanics
- Reporting systems
- Moderation tools
- Community guidelines

---
description: Lore for the game, generation of world and mobs, history of the world, different regions and zones
alwaysApply: false
---
# The World of Hyperia

## Welcome, Adventurer!

Hyperia is an ancient land where heroes rise and legends are forged! Once ruled by powerful kingdoms that have long since fallen to ruin, the realm is now a frontier where adventurers seek glory and fortune among the remnants of lost civilizations. Monsters roam the wilderness, treasures lie hidden in forgotten places, and the brave few who dare to explore may write their names in history!

## The History of Hyperia

### The First Age: The Great Kingdoms
Long ago, Hyperia was home to mighty kingdoms that controlled vast territories. The Kingdom of Valorhall ruled the northern mountains with their legendary warriors. The Eastern Reaches were governed by wise merchant princes who built great trade routes. The western forests were protected by elite rangers who knew every tree and trail. These kingdoms prospered for a thousand years until the Great Calamity struck.

### The Calamity
No one alive remembers exactly what happened, but ancient texts speak of a dark day when the sky burned red and monsters poured forth from tears in reality. The great cities fell one by one, their populations scattered or slain. The very fabric of the world became unstable. The survivors fled to small settlements, and civilization collapsed into isolated towns and villages.

### The Current Era
Now, 500 years after the Calamity, Hyperia has become a land of opportunity for adventurers. The old kingdoms are ruins filled with treasure and danger. Monsters have claimed much of the wilderness. Small towns dot the landscape, connected by dangerous roads. This is where your story begins.

## The Regions of Hyperia

### **Mistwood Valley** (Starting Region)
Once the breadbasket of the old kingdoms, now a patchwork of small farming communities:
- **Brookhaven**: A peaceful starter town by a babbling brook (general store and bank)
- **Millharbor**: Built around an ancient watermill (general store and bank)
- **Crosshill**: Where old trade routes meet (general store and bank)
- **The Old Oak**: A massive tree where adventurers gather and share tales
- **Stone Circle of Beginning**: Ancient standing stones where new heroes often train
- **The Abandoned Farmstead**: Overrun by goblins, perfect for first adventures
- **Broken Bridge**: Once connected regions, now guards patrol one side
- Rolling hills dotted with lone trees and small goblin camps

### **The Goblin Wastes**
A barren region claimed by goblin tribes after the fall:
- **Goblin Hill**: A large mound where goblins gather for war councils
- **The Ruined Tower**: An old watchtower, now a hobgoblin stronghold
- **Bonepile Monument**: Where goblins display their "trophies"
- **The Dusty Crossroads**: Barbarian camps control this vital passage
- **Three Rocks**: Massive boulders where goblin shamans once performed rituals
- **The Burnt Village**: A cautionary tale of what happens to the unprepared
- Rocky badlands with scattered goblin camps and crude totems
- Small bands of human barbarians compete with goblins for resources

### **Darkwood Forest**
An ancient forest that has grown wild and dangerous:
- **The Hanged Man's Tree**: Where the bandit chief displays warnings
- **Old Ranger Monument**: A stone statue marking a forgotten hero's last stand
- **The Hollow Stump**: A massive tree stump that serves as a bandit meeting spot
- **Twilight Clearing**: Where dark warriors train at dusk
- **The Moss-Covered Obelisk**: An ancient marker, its inscriptions long faded
- **Woodcutter's Folly**: An abandoned lumber camp, now a guard outpost
- Dense trees create natural paths and clearings
- Bandit camps hidden throughout, marked by crude flags

### **The Northern Reaches**
Cold mountains where the Kingdom of Valorhall once stood:
- **The Frozen Throne**: A massive ice-covered stone chair overlooking the valley
- **Warrior's Gate**: Twin pillars marking the old kingdom's border
- **The Ice Warrior Memorial**: Where frozen champions stand eternal vigil
- **Valorhall Ruins**: Broken walls where barbarians now make camp
- **The Shattered Shield**: A giant stone shield embedded in the mountainside
- **Frostwind Pass**: The only safe passage, heavily guarded by corrupted soldiers
- Snow-covered terrain with exposed rock formations
- Mountain barbarian camps clustered around ancient monuments

### **The Great Lakes**
A region of interconnected lakes where bandits and smugglers rule:
- **Smuggler's Dock**: Makeshift piers where bandits move stolen goods
- **The Sunken Statue**: A giant figure half-submerged in the lake
- **Bandit's Rest**: A notorious gathering spot on a small island
- **The Old Lighthouse**: Still burning mysteriously on the largest lake's shore
- **Fisherman's Lament**: An abandoned fishing village, now a guard checkpoint
- **Twin Rocks**: Two massive stones jutting from the water, perfect for ambushes
- Multiple lakes connected by rivers, with fishing spots along the shores
- Bandit camps control the best crossing points

### **The Blasted Lands**
Southern wastes where the Calamity hit hardest:
- **The Black Citadel**: A dark fortress where Black Knights gather
- **The Ash Monument**: A pillar of fused ash marking the Calamity's epicenter
- **Skull Ridge**: A line of rocks resembling skulls, where Dark Rangers patrol
- **The Scorched Battlefield**: Ancient weapons still litter the ground
- **Dead Man's Marker**: A lone signpost warning travelers to turn back
- **The Obsidian Spire**: A twisted black tower reaching toward the sky
- Barren wasteland of ash and volcanic rock
- Elite enemies patrol between monuments of destruction

### **The Windswept Plains**
Open grasslands between the forests and mountains:
- **The Lone Watchtower**: An abandoned tower where guards have set up camp
- **Merchant's Memorial**: A stone marker where traders were ambushed long ago
- **The Battle Standard**: A tattered flag still flying from an ancient conflict
- **Crow's Perch**: A dead tree where ravens gather, overlooking hobgoblin territory
- **The Forgotten Well**: Once gave water to travelers, now dry and surrounded by bandits
- **Standing Sentry**: A weathered statue of an unknown soldier
- Wide open spaces with scattered rock formations
- Mix of human bandits and hobgoblin war parties

### **Bramblewood Thicket**
Dense thorny woodland between major regions:
- **The Thorn Arch**: Natural archway formed by twisted brambles
- **Poacher's Platform**: Wooden structure where bandits watch for travelers
- **The Gnarled Sentinel**: Ancient tree that seems to watch passersby
- **Broken Wagon Circle**: Where a merchant caravan made its last stand
- **The Bramble Maze**: Natural thorny barriers creating a confusing path
- **Hunter's Mark**: Stone pillar marked with crude directions
- Difficult terrain that funnels travelers along predictable paths
- Perfect ambush territory for bandits and barbarians

### **The Iron Hills**
Mining region between the mountains and plains:
- **The Abandoned Mineshaft Entrance**: Boarded up but guards patrol nearby
- **Overseer's Chair**: Carved stone seat overlooking old mining operations
- **The Rust Monument**: Iron statue corroded by time and weather
- **Cart Graveyard**: Where old mining carts were left to decay
- **The Hammer Stone**: Massive rock shaped like a blacksmith's hammer
- **Claim Marker 47**: One of many territorial stones, this one still defended
- Rocky hills with exposed ore veins
- Dark Warriors control the best mining spots

## Your Path to Glory

### The Novice's Journey
Every hero starts somewhere. Your first task is to prove yourself against the goblin menace plaguing Mistwood Valley. These green-skinned raiders may seem weak to veteran adventurers, but they'll test your mettle as you learn the ways of combat. With the coins from your victories, purchase tools from the general store - a hatchet for woodcutting, a fishing rod for sustenance, and a tinderbox to cook your catch.

### Rising Through the Ranks  
As your skills grow, venture beyond the starter regions. The corrupted guards and dark warriors of the middle lands await those brave enough to face them. Steel equipment becomes available to those who prove themselves, and the ancient ruins hold secrets for those willing to explore. This is where boys and girls become true adventurers.

### Legendary Status
Only the greatest warriors dare face the Black Knights in their fortress or brave the frozen halls where Ice Warriors stand eternal vigil. These champions of darkness guard the mithril equipment that marks a true master of combat. In the Blasted Lands, the Dark Rangers strike from the shadows with deadly precision, hoarding treasures from the old world. To defeat them is to write your name in the annals of history.

## Ancient Legends and Lost Treasures

### The Legend of the First Heroes
When the Calamity struck, a band of heroes made a last stand at what is now Crossroads. Though they fell, their sacrifice allowed thousands to escape. Some say their spirits still guard the town, which is why monsters rarely venture too close to starter towns.

### The Goblin Emergence  
The goblins weren't always surface dwellers. Ancient texts speak of them living deep underground until the Calamity cracked open their cavern homes. Now they've claimed much of the surface world, though they still fear the deepest forests and highest mountains.

### The Black Knight Order
Once the elite guard of the Eastern kingdoms, the Black Knights were corrupted by the darkness of the Calamity. They now serve no master but chaos itself, dwelling in their forbidden fortress and emerging only to spread fear and destruction.

### Lost Treasures of the Kingdoms
- **The Crown of Valorhall**: Said to grant its wearer unmatched combat prowess
- **The Merchant Prince's Ledger**: Contains the locations of hidden treasure vaults
- **The Ranger General's Bow**: The finest bow ever crafted, lost in Darkwood Forest
- **The Beacon Keeper's Lantern**: Lights the way through any darkness

### Places of Power
Scattered across Hyperia are ancient sites of great significance:
- **The Standing Stones**: Stone circles that seem to vibrate with ancient power
- **The Warrior's Rest**: Ancient burial mounds of fallen heroes
- **The Crystal Caves**: Where strange crystals formed during the Calamity
- **The Whispering Ruins**: Where the voices of the past can still be heard# The World of Hyperia

## Welcome, Adventurer!

Hyperia is an ancient land where heroes rise and legends are forged! Once ruled by powerful kingdoms that have long since fallen to ruin, the realm is now a frontier where adventurers seek glory and fortune among the remnants of lost civilizations. Monsters roam the wilderness, treasures lie hidden in forgotten places, and the brave few who dare to explore may write their names in history!

## The History of Hyperia

### The First Age: The Great Kingdoms
Long ago, Hyperia was home to mighty kingdoms that controlled vast territories. The Kingdom of Valorhall ruled the northern mountains with their legendary warriors. The Eastern Reaches were governed by wise merchant princes who built great trade routes. The western forests were protected by elite rangers who knew every tree and trail. These kingdoms prospered for a thousand years until the Great Calamity struck.

### The Calamity
No one alive remembers exactly what happened, but ancient texts speak of a dark day when the sky burned red and monsters poured forth from tears in reality. The great cities fell one by one, their populations scattered or slain. The very fabric of the world became unstable. The survivors fled to small settlements, and civilization collapsed into isolated towns and villages.

### The Current Era
Now, 500 years after the Calamity, Hyperia has become a land of opportunity for adventurers. The old kingdoms are ruins filled with treasure and danger. Monsters have claimed much of the wilderness. Small towns dot the landscape, connected by dangerous roads. This is where your story begins.

## The Regions of Hyperia

### **Mistwood Valley** (Starting Region)
Once the breadbasket of the old kingdoms, now a patchwork of small farming communities:
- **Brookhaven**: A peaceful starter town by a babbling brook (general store and bank)
- **Millharbor**: Built around an ancient watermill (general store and bank)
- **Crosshill**: Where old trade routes meet (general store and bank)
- **The Old Oak**: A massive tree where adventurers gather and share tales
- **Stone Circle of Beginning**: Ancient standing stones where new heroes often train
- **The Abandoned Farmstead**: Overrun by goblins, perfect for first adventures
- **Broken Bridge**: Once connected regions, now guards patrol one side
- Rolling hills dotted with lone trees and small goblin camps

### **The Goblin Wastes**
A barren region claimed by goblin tribes after the fall:
- **Goblin Hill**: A large mound where goblins gather for war councils
- **The Ruined Tower**: An old watchtower, now a hobgoblin stronghold
- **Bonepile Monument**: Where goblins display their "trophies"
- **The Dusty Crossroads**: Barbarian camps control this vital passage
- **Three Rocks**: Massive boulders where goblin shamans once performed rituals
- **The Burnt Village**: A cautionary tale of what happens to the unprepared
- Rocky badlands with scattered goblin camps and crude totems
- Small bands of human barbarians compete with goblins for resources

### **Darkwood Forest**
An ancient forest that has grown wild and dangerous:
- **The Hanged Man's Tree**: Where the bandit chief displays warnings
- **Old Ranger Monument**: A stone statue marking a forgotten hero's last stand
- **The Hollow Stump**: A massive tree stump that serves as a bandit meeting spot
- **Twilight Clearing**: Where dark warriors train at dusk
- **The Moss-Covered Obelisk**: An ancient marker, its inscriptions long faded
- **Woodcutter's Folly**: An abandoned lumber camp, now a guard outpost
- Dense trees create natural paths and clearings
- Bandit camps hidden throughout, marked by crude flags

### **The Northern Reaches**
Cold mountains where the Kingdom of Valorhall once stood:
- **The Frozen Throne**: A massive ice-covered stone chair overlooking the valley
- **Warrior's Gate**: Twin pillars marking the old kingdom's border
- **The Ice Warrior Memorial**: Where frozen champions stand eternal vigil
- **Valorhall Ruins**: Broken walls where barbarians now make camp
- **The Shattered Shield**: A giant stone shield embedded in the mountainside
- **Frostwind Pass**: The only safe passage, heavily guarded by corrupted soldiers
- Snow-covered terrain with exposed rock formations
- Mountain barbarian camps clustered around ancient monuments

### **The Great Lakes**
A region of interconnected lakes where bandits and smugglers rule:
- **Smuggler's Dock**: Makeshift piers where bandits move stolen goods
- **The Sunken Statue**: A giant figure half-submerged in the lake
- **Bandit's Rest**: A notorious gathering spot on a small island
- **The Old Lighthouse**: Still burning mysteriously on the largest lake's shore
- **Fisherman's Lament**: An abandoned fishing village, now a guard checkpoint
- **Twin Rocks**: Two massive stones jutting from the water, perfect for ambushes
- Multiple lakes connected by rivers, with fishing spots along the shores
- Bandit camps control the best crossing points

### **The Blasted Lands**
Southern wastes where the Calamity hit hardest:
- **The Black Citadel**: A dark fortress where Black Knights gather
- **The Ash Monument**: A pillar of fused ash marking the Calamity's epicenter
- **Skull Ridge**: A line of rocks resembling skulls, where Dark Rangers patrol
- **The Scorched Battlefield**: Ancient weapons still litter the ground
- **Dead Man's Marker**: A lone signpost warning travelers to turn back
- **The Obsidian Spire**: A twisted black tower reaching toward the sky
- Barren wasteland of ash and volcanic rock
- Elite enemies patrol between monuments of destruction

### **The Windswept Plains**
Open grasslands between the forests and mountains:
- **The Lone Watchtower**: An abandoned tower where guards have set up camp
- **Merchant's Memorial**: A stone marker where traders were ambushed long ago
- **The Battle Standard**: A tattered flag still flying from an ancient conflict
- **Crow's Perch**: A dead tree where ravens gather, overlooking hobgoblin territory
- **The Forgotten Well**: Once gave water to travelers, now dry and surrounded by bandits
- **Standing Sentry**: A weathered statue of an unknown soldier
- Wide open spaces with scattered rock formations
- Mix of human bandits and hobgoblin war parties

### **Bramblewood Thicket**
Dense thorny woodland between major regions:
- **The Thorn Arch**: Natural archway formed by twisted brambles
- **Poacher's Platform**: Wooden structure where bandits watch for travelers
- **The Gnarled Sentinel**: Ancient tree that seems to watch passersby
- **Broken Wagon Circle**: Where a merchant caravan made its last stand
- **The Bramble Maze**: Natural thorny barriers creating a confusing path
- **Hunter's Mark**: Stone pillar marked with crude directions
- Difficult terrain that funnels travelers along predictable paths
- Perfect ambush territory for bandits and barbarians

### **The Iron Hills**
Mining region between the mountains and plains:
- **The Abandoned Mineshaft Entrance**: Boarded up but guards patrol nearby
- **Overseer's Chair**: Carved stone seat overlooking old mining operations
- **The Rust Monument**: Iron statue corroded by time and weather
- **Cart Graveyard**: Where old mining carts were left to decay
- **The Hammer Stone**: Massive rock shaped like a blacksmith's hammer
- **Claim Marker 47**: One of many territorial stones, this one still defended
- Rocky hills with exposed ore veins
- Dark Warriors control the best mining spots

## Your Path to Glory

### The Novice's Journey
Every hero starts somewhere. Your first task is to prove yourself against the goblin menace plaguing Mistwood Valley. These green-skinned raiders may seem weak to veteran adventurers, but they'll test your mettle as you learn the ways of combat. With the coins from your victories, purchase tools from the general store - a hatchet for woodcutting, a fishing rod for sustenance, and a tinderbox to cook your catch.

### Rising Through the Ranks  
As your skills grow, venture beyond the starter regions. The corrupted guards and dark warriors of the middle lands await those brave enough to face them. Steel equipment becomes available to those who prove themselves, and the ancient ruins hold secrets for those willing to explore. This is where boys and girls become true adventurers.

### Legendary Status
Only the greatest warriors dare face the Black Knights in their fortress or brave the frozen halls where Ice Warriors stand eternal vigil. These champions of darkness guard the mithril equipment that marks a true master of combat. In the Blasted Lands, the Dark Rangers strike from the shadows with deadly precision, hoarding treasures from the old world. To defeat them is to write your name in the annals of history.

## Ancient Legends and Lost Treasures

### The Legend of the First Heroes
When the Calamity struck, a band of heroes made a last stand at what is now Crossroads. Though they fell, their sacrifice allowed thousands to escape. Some say their spirits still guard the town, which is why monsters rarely venture too close to starter towns.

### The Goblin Emergence  
The goblins weren't always surface dwellers. Ancient texts speak of them living deep underground until the Calamity cracked open their cavern homes. Now they've claimed much of the surface world, though they still fear the deepest forests and highest mountains.

### The Black Knight Order
Once the elite guard of the Eastern kingdoms, the Black Knights were corrupted by the darkness of the Calamity. They now serve no master but chaos itself, dwelling in their forbidden fortress and emerging only to spread fear and destruction.

### Lost Treasures of the Kingdoms
- **The Crown of Valorhall**: Said to grant its wearer unmatched combat prowess
- **The Merchant Prince's Ledger**: Contains the locations of hidden treasure vaults
- **The Ranger General's Bow**: The finest bow ever crafted, lost in Darkwood Forest
- **The Beacon Keeper's Lantern**: Lights the way through any darkness

### Places of Power
Scattered across Hyperia are ancient sites of great significance:
- **The Standing Stones**: Stone circles that seem to vibrate with ancient power
- **The Warrior's Rest**: Ancient burial mounds of fallen heroes
- **The Crystal Caves**: Where strange crystals formed during the Calamity
- **The Whispering Ruins**: Where the voices of the past can still be heard

---
description: When using LLM models like OpenAI or Anthropic, for image recogntion, image generation,text generation and embeddnigs
alwaysApply: false
---
For text and image generation, as well as image desciption, use gpt-4o and gpt-4o-mini from OpenAI.

For 3D item generation, remeshing, retexturing, avatar creation and rigging, we are using meshy.ai

The API keys for these are available in the root project .env, so use dotenv to access environment variables

Current Anthropic models:
Claude Opus 4 claude-opus-4-20250514
Claude Sonnet 4	claude-sonnet-4-20250514

Current OpenAI models:
'gpt-4o'
'gpt-4o-mini'
'o1-2024-12-17'

Current OpenAI image models:
'gpt-image-1' // newer and better, more controllable but needs special API key access / KYC
'dall-e-3'

---
alwaysApply: true
---
# Tech Stack

Hyperfy (in packages/hypefy) - A 3D multiplayer game engine built on three.js -- includes voice with LiveKit, avatars with VRM, an application abstraction for building self-contained world apps and more
We need to make sure we build persistence into Hyperfy for our apps

Playwright - Browser engine for running tests and simulating gameplay

React - UI and frontend is done in React

ElizaOS - Our AI agent framework. Eliza runs with 'elizaos start' and we have a plugin-hyperfy for Eliza which enables Eliza plugins to join Hyperfy worlds and call all available actions.

Three.js - Our 3D graphics library -- we should try to use the Hyperfy abstractions where possible

Sqlite - for persistence we will store all application data in the database, which is currently a local Sqlite instance# Tech Stack

Hyperfy (in packages/hypefy) - A 3D multiplayer game engine built on three.js -- includes voice with LiveKit, avatars with VRM, an application abstraction for building self-contained world apps and more
We need to make sure we build persistence into Hyperfy for our apps

Playwright - Browser engine for running tests and simulating gameplay

React - UI and frontend is done in React

ElizaOS - Our AI agent framework. Eliza runs with 'elizaos start' and we have a plugin-hyperfy for Eliza which enables Eliza plugins to join Hyperfy worlds and call all available actions.

Three.js - Our 3D graphics library -- we should try to use the Hyperfy abstractions where possible

Sqlite - for persistence we will store all application data in the database, which is currently a local Sqlite instance

---
alwaysApply: true
---
# Tech Stack

Hyperfy (in packages/hypefy) - A 3D multiplayer game engine built on three.js -- includes voice with LiveKit, avatars with VRM, an application abstraction for building self-contained world apps and more
We need to make sure we build persistence into Hyperfy for our apps

Playwright - Browser engine for running tests and simulating gameplay

React - UI and frontend is done in React

ElizaOS - Our AI agent framework. Eliza runs with 'elizaos start' and we have a plugin-hyperfy for Eliza which enables Eliza plugins to join Hyperfy worlds and call all available actions.

Three.js - Our 3D graphics library -- we should try to use the Hyperfy abstractions where possible

Sqlite - for persistence we will store all application data in the database, which is currently a local Sqlite instance# Tech Stack

Hyperfy (in packages/hypefy) - A 3D multiplayer game engine built on three.js -- includes voice with LiveKit, avatars with VRM, an application abstraction for building self-contained world apps and more
We need to make sure we build persistence into Hyperfy for our apps

Playwright - Browser engine for running tests and simulating gameplay

React - UI and frontend is done in React

ElizaOS - Our AI agent framework. Eliza runs with 'elizaos start' and we have a plugin-hyperfy for Eliza which enables Eliza plugins to join Hyperfy worlds and call all available actions.

Three.js - Our 3D graphics library -- we should try to use the Hyperfy abstractions where possible

Sqlite - for persistence we will store all application data in the database, which is currently a local Sqlite instance

---
alwaysApply: true
---

# Real code only
For testing the RPG, we will not be using any mocks, spies, or other kinds of test framework structure -- instead we build mini-worlds where we test each feature individually, with clear structure and saving of all error logs to that after running the tests we can identify if the test passed or if there were failures or errors

# Test Multimodally and Verify in Browser
We will test these scenarios a few different ways -- first, we will evaluate the in-game world metrics we would expect
    -> If we're testing if a player has moved, we can check the position of the player in the three.js scene
    -> We should also build visual testing with screenshots to verify that objects are actually on screen -- to do this we need an overhead camera rig and solid color proxies for each of the objects (cube proxies)
    -> Any other kinds of testing that actually test the real runtime and gameplay should be implemented
    -> We want to minimize test-specific code and objects, since it leads to bugs. We want to use real objects, real items from the game, real mobs and player proxies etc

# Basic Screen Testing
Is the entire screen all white? All black? 95%+ one single color? Something might be wrong. Verify that the player object is actually visible, the camera rig actually works, the world actually loads using basic pixel  and have statistics to help yourself understand when there might be something weird

# Visual Testing
For visual testing, we will use Playwright and a testing rig that screenshots the overhead of the scenario and checks for the existing of very specific colored pixels. Each entity (items, mobs, player, etc) in our scenario tests will be represented by a cube with a specific known color which we can check for. If a blue player kills a green goblin and loots the corpse, we can check that the green pixels went away and there are now red corpse pixels, for example. We can also check the distance of cubes from each other by getting all pixels of a color and average the positions. So if we are testing melee attack, for example, we can visualize the cubes as being adjacent and test the adjacency.

# Three.js Testing
Three.js creates a hierarchy of scene objects which have known properties like position. For testing if a player has moved, we can get their current position and verify that, say, they aren't just at 0. We can also verify that they exist in the hierarchy, etc. Our testing setup should make it easy to log and get this information.

# Systems and Data
Hyperfy is an ECS engine, to verify certain things we will want to be able to introspect systems and data attached to components. So if we want to check player money, we need to go through the Hyperfy systems to see how much money they have.

# LLM Based Verification
OpenAI GPT-4o and Anthropic Claude can now see images which we screenshot from Playwright and answer questions about them or verify stuff. We should use this sparingly as it is slow and expensive, but useful for figuring out what's going wrong, especially with UI or complicated scenarios. We can build this into our screenshot testing loop for tests where we want to verify, say, that something is on screen in the UI in the right place, that the UI looks good and doesn't have overlaps, etc.

# Testing Frameworks
We will use Playwright and custom tests which set up a Hyperfy world, add all of the entities, verify they are added, runs the test and verifies everything passes with no errors
We are using Cursor and Claude Code which most tend to swallow errors in the logs, so we need to make sure the logs are output somewhere and contain all errors, and that after running our tests we verify that the logs are empty and free of any errors.

So all tests MUST use Hyperfy and Playwright, and real elements of the RPG.# Real code only
For testing the RPG, we will not be using any mocks, spies, or other kinds of test framework structure -- instead we build mini-worlds where we test each feature individually, with clear structure and saving of all error logs to that after running the tests we can identify if the test passed or if there were failures or errors

# Test Multimodally and Verify in Browser
We will test these scenarios a few different ways -- first, we will evaluate the in-game world metrics we would expect
    -> If we're testing if a player has moved, we can check the position of the player in the three.js scene
    -> We should also build visual testing with screenshots to verify that objects are actually on screen -- to do this we need an overhead camera rig and solid color proxies for each of the objects (cube proxies)
    -> Any other kinds of testing that actually test the real runtime and gameplay should be implemented
    -> We want to minimize test-specific code and objects, since it leads to bugs. We want to use real objects, real items from the game, real mobs and player proxies etc

# Basic Screen Testing
Is the entire screen all white? All black? 95%+ one single color? Something might be wrong. Verify that the player object is actually visible, the camera rig actually works, the world actually loads using basic pixel  and have statistics to help yourself understand when there might be something weird

# Visual Testing
For visual testing, we will use Playwright and a testing rig that screenshots the overhead of the scenario and checks for the existing of very specific colored pixels. Each entity (items, mobs, player, etc) in our scenario tests will be represented by a cube with a specific known color which we can check for. If a blue player kills a green goblin and loots the corpse, we can check that the green pixels went away and there are now red corpse pixels, for example. We can also check the distance of cubes from each other by getting all pixels of a color and average the positions. So if we are testing melee attack, for example, we can visualize the cubes as being adjacent and test the adjacency.

# Three.js Testing
Three.js creates a hierarchy of scene objects which have known properties like position. For testing if a player has moved, we can get their current position and verify that, say, they aren't just at 0. We can also verify that they exist in the hierarchy, etc. Our testing setup should make it easy to log and get this information.

# Systems and Data
Hyperfy is an ECS engine, to verify certain things we will want to be able to introspect systems and data attached to components. So if we want to check player money, we need to go through the Hyperfy systems to see how much money they have.

# LLM Based Verification
OpenAI GPT-4o and Anthropic Claude can now see images which we screenshot from Playwright and answer questions about them or verify stuff. We should use this sparingly as it is slow and expensive, but useful for figuring out what's going wrong, especially with UI or complicated scenarios. We can build this into our screenshot testing loop for tests where we want to verify, say, that something is on screen in the UI in the right place, that the UI looks good and doesn't have overlaps, etc.

# Testing Frameworks
We will use Playwright and custom tests which set up a Hyperfy world, add all of the entities, verify they are added, runs the test and verifies everything passes with no errors
We are using Cursor and Claude Code which most tend to swallow errors in the logs, so we need to make sure the logs are output somewhere and contain all errors, and that after running our tests we verify that the logs are empty and free of any errors.

So all tests MUST use Hyperfy and Playwright, and real elements of the RPG to be tested. No LARP code, no fakes, no mocks, no workarounds.

# All Features Must have tests

This is extremely important. If you make a feature, make a test for it and make sure all tests pass

# All Tests Must Pass
It's important that we always get all tests to pass before moving on -- even "minor" ones. No tests are minor if any are failing.
If our goal is to demonstrate something isn't working, start out by making tests that fail, then fix the underlying code so they pass
Testing is extremely important! If it's not tested, it's probably broken.
NEVER shortcut, simplify or skip in tests. The goal of tests is to identify bugs in the code, NOT to get the tests to pass.

---
description:
globs:
alwaysApply: false
---

# Packages in this project

We have the following packages:

## Generation

Responsible for 3D generation of all items, characters, mobs, buildings, etc. Uses meshy.ai and OpenAI. Standalone package which outputs JSON and 3D models, this can be consumed by the RPG for dynamic runtime generation, but also comes with its own scripts and CLI for generation and testing.

## Hyperfy

three.js based world engine. Should stay pure to world engine and NOT include any code specific to the RPG, but should be flexible and extensible to allow games such as the RPG to be built. IT IS VERY IMPORTANT that we don't add RPG code or modify or hardcode stuff into Hyperfy, it needs to be a flexible world/metaverse engine for all games.

## Plugin Hyperfy

This is a plugin for elizaOS agents to connect to Hyperfy. This should be general and not have RPG code specific to the RPG, but it needs to dynamically load in the available actions from the game so that it can contextually give the agents a list of actions they can perform when those actions are valid. For example, a use item action is valid on an item in the agent's inventory. All elizaOS code should go here, and any action definitions should not be specific to elizaOS agents, but should just be a general manifest of available actions that the client can receive.

## RPG

This is an RPG game based on Runescape, but with a twist-- everything is AI generated. The world, the lore, the items, the mobs, the player, the animation, everything. The RPG is built on Hyperfy, but is cleanly separated from it. It uses Hyperfy's generic structure and serialization system to build a full-scale MMORPG. We make need to add systems to enable persistent, serialization, shared state, and anti-cheat. We will build general system implementations into Hyperfy as needed which are extended and customized by the RPG for this specific game. It's the difference between the framework and application layer, and it's very important we keep this boundary.

## test-framework

This is a standalone Hyperfy testing framework which we can use for the RPG to test everything. We want to test data on Systems, in the three.js scene graph and visually through the browser, as well as with logs in Playwright and whatever else we can get in terms of actual telemetry on the actual game. We don't use mocks or unit tests, we ONLY do gameplay testing on the real gameplay elements, real game engine, etc. This prevents us from creating garbage tests and hallucinated code that doesn't actually work. We should make sure this test framework is robust, and then used in the RPG to test every single aspect of the RPG. But we want this standalone so we can use it for other games as well, so no hardcoded RPG stuff.

---
alwaysApply: true
---

# Important notes on development

- Always make sure that whatever you build has tests
- Don't create new files to test things out or fix things
- KEEP IT SIMPLE!
- Always implement real working code, never examples or shortcuts-- those just cause problems in the future.
- When writing tests, don't use mocks-- they don't work-- instead write real runtime tests and lean on visual testing, testing the three.js scene hierarchy and real data values, etc
- Checking where things are in space is also a good way to test stuff!
- If you're not sure, ask me about something, I know a lot about the system.
- Don't create new files unless you need to. Revise existing files whenever possible. It makes cleanup much easier in the future.
- Instead of creating a _v2.ts, just update the v1 file.
- IF you write docs, store them in the /docs folder, but generally don't bother writing a bunch of markdown files
- If you save logs, store them in the /logs folder, it could help you to read back the actual outputs since your other method of seeing them gets clipped
- Don't change foundational code or stuff unless yuo have to, especially if it's to address the symptom of a problem
- Always make sure you are absolutely certain and have a clear test demonstrating that something core is wrong before changing it
- Do not make assumptions about game features-- always refer to the GDD
- Do not add any extra features that are not covered in the GDD
- Use environment variables in the .env with dotenv package
- Always use Hyperfy as the game engine and backend but keep it isolated from the RPG code by making the RPG a standalone Hyperfy app (.hyp)
- Always define types in a types.ts and use the existing types before making new ones
- Try to make each package self-contained and modular, they can import each other through the workspace if needed (but no circular dependencies)
- If it doesn't have a real test that starts up Puppeteer and actually runs the actions and screenshots the world, then it probably isnt actually working
- So PLEASE use Puppeteer and make sure that every feature, item, interaction, etc is tested with every means we have
- Tests are extremely important -- use real tests with the real files, NO MOCKS ALLOWED
- We can create Hyperfy worlds for each test and run them individually so we don't need mocks
- Always write production code -- instead of TODO or "will fill this out later" actually take the time to write out all of the code
- Don't hardcode anything, always make sure yuo are building toward the general case and a system that will have many more items, players, mobs, etc
- Don't work around problems -- fix the root cause. Don't just write code to avoid something that isn't doing what you want, lets make it work how we want it to
- Instead of writing new abstractions, deepy research Hyperfy and how we can use the existing code and systems to achieve our goals
- Always separate data from logic -- DON'T hardcode data or examples into the code. Move it to a JSON if necessary, and don't just make up examples

## VERY IMPORTANT

Don't create new files. Especialy don't create "check-*.ts", "test-*.mjs", "fix-*.js" etc. NO files like that. You can run shell commands, you can change the code and run it, but creating new files adds confusing and bloat. Don't save reports or guides or any markdown files either, OTHER than modifying the README.md when you make a significant feature change that changes the docs.

You VERY rarely need to create new files, if you're creating a new file you might be accidentally recreating a file that exists or causing bloat and should do some research first.

Clean up after yourself. If you do create any test files, delete them when you're done.