# Content Pack Integration Guide
## From Asset Forge to ElizaOS Agents

This document explains the complete flow for getting quests, NPCs, and lore from the Asset Forge Content Builder into ElizaOS agents through the `plugin-hyperscape` system.

**Purpose**: Enable AI agents to see and interact with quests created in Asset Forge, using real game data (mobs, items, NPCs, action handlers).

**Status**: Documentation complete, converter implementation pending.

---

## Architecture Overview

```
┌─────────────────────┐
│  Asset Forge        │
│  Content Builder    │
│  ==================  │
│  • Quest Builder    │
│  • NPC Generator    │
│  • Lore Generator   │
└──────────┬──────────┘
           │
           │ Export JSON
           ▼
┌─────────────────────┐
│  Content Pack JSON  │
│  {                  │
│    quests: [...],   │
│    npcs: [...],     │
│    lore: [...]      │
│  }                  │
└──────────┬──────────┘
           │
           │ Convert to IContentPack
           ▼
┌─────────────────────┐
│  IContentPack       │
│  ==================  │
│  • Providers        │
│  • Actions          │
│  • Systems          │
│  • onLoad Hook      │
└──────────┬──────────┘
           │
           │ Load via ContentPackLoader
           ▼
┌─────────────────────┐
│  ElizaOS Agent      │
│  ==================  │
│  • Quest Provider   │
│  • Quest Actions    │
│  • Quest System     │
│  ✓ Agent can now   │
│    see & do quests  │
└─────────────────────┘
```

---

## Step 1: Export from Asset Forge

### Current Functionality
The Content Builder currently exports a `ContentPack`:

```typescript
// From useContentGenerationStore.ts
const pack: ContentPack = {
  id: `pack_${Date.now()}`,
  name: "My Content Pack",
  version: '1.0.0',
  description: "Generated with Asset Forge",
  quests: [...],      // GeneratedQuest[]
  npcs: [...],        // GeneratedNPC[]
  lore: [...],        // LoreEntry[]
  metadata: {
    createdAt: new Date().toISOString(),
    author: 'Asset Forge',
    manifestVersion: '1.0.0'
  }
}
```

### Export Location
```javascript
// In ContentGenerationPage.tsx
const handleExportPack = () => {
  const pack = createPack('My Content Pack', 'Generated with Asset Forge')
  
  // Downloads as: content-pack-{timestamp}.json
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `content-pack-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}
```

---

## Step 2: Convert to IContentPack

The exported JSON needs to be converted into an `IContentPack` that ElizaOS can load.

### Create Content Pack Converter

**Location**: `/packages/plugin-hyperscape/src/utils/content-pack-converter.ts`

```typescript
import { IContentPack, IGameSystem } from '../types/content-pack'
import { Provider, Action, IAgentRuntime } from '@elizaos/core'
import { HyperscapeService } from '../service'
import { World } from '../types/core-types'

// Import the Asset Forge content pack type
interface AssetForgeContentPack {
  id: string
  name: string
  version: string
  description: string
  quests: any[]
  npcs: any[]
  lore: any[]
  metadata: {
    createdAt: string
    author: string
    manifestVersion: string
  }
}

/**
 * Convert Asset Forge content pack to ElizaOS IContentPack
 */
export function convertAssetForgePackToElizaOS(
  afPack: AssetForgeContentPack
): IContentPack {
  
  // 1. Create Quest Provider - injects quest data into agent context
  const questProvider: Provider = {
    name: 'QUESTS',
    description: 'Available quests and quest progress',
    get: async (runtime: IAgentRuntime) => {
      const service = runtime.getService<HyperscapeService>(
        HyperscapeService.serviceName
      )
      
      if (!service || !service.isConnected()) {
        return {
          text: '# Quests\nNo quests available (not connected to world)',
          data: {}
        }
      }
      
      // Get quest system from world
      const world = service.getWorld()!
      const questSystem = world.systems.find(s => s.constructor.name === 'QuestSystem')
      
      if (!questSystem) {
        // Provide quests from pack
        const questList = afPack.quests.map(q => 
          `- **${q.title}** (${q.difficulty}): ${q.description}\n  ${q.objectives.length} objectives, ${q.rewards.experience} XP reward`
        ).join('\n')
        
        return {
          text: `# Available Quests\n\n${questList}`,
          data: { quests: afPack.quests }
        }
      }
      
      // Get active quest progress
      const activeQuests = (questSystem as any).getActiveQuests?.() || []
      const completedQuests = (questSystem as any).getCompletedQuests?.() || []
      
      let text = '# Quest Status\n\n'
      
      if (activeQuests.length > 0) {
        text += '## Active Quests\n'
        activeQuests.forEach((q: any) => {
          const progress = q.objectives.filter((o: any) => o.completed).length
          text += `- ${q.title}: ${progress}/${q.objectives.length} objectives\n`
        })
        text += '\n'
      }
      
      if (completedQuests.length > 0) {
        text += `## Completed: ${completedQuests.length} quests\n\n`
      }
      
      // Available quests
      const available = afPack.quests.filter(q => 
        !activeQuests.some((aq: any) => aq.id === q.id) &&
        !completedQuests.includes(q.id)
      )
      
      if (available.length > 0) {
        text += '## Available Quests\n'
        available.forEach(q => {
          text += `- **${q.title}**: ${q.description}\n`
        })
      }
      
      return {
        text,
        data: { 
          activeQuests, 
          completedQuests, 
          availableQuests: available 
        }
      }
    }
  }
  
  // 2. Create NPC Provider - injects NPC data into agent context
  const npcProvider: Provider = {
    name: 'NPCS',
    description: 'NPCs and their services',
    get: async (runtime: IAgentRuntime) => {
      const service = runtime.getService<HyperscapeService>(
        HyperscapeService.serviceName
      )
      
      if (!service || !service.isConnected()) {
        return {
          text: '# NPCs\nNo NPCs available',
          data: {}
        }
      }
      
      const npcList = afPack.npcs.map(npc => {
        const services = npc.services?.join(', ') || 'none'
        const quests = npc.personality.questsOffered?.length || 0
        return `- **${npc.personality.name}** (${npc.personality.archetype})\n  Services: ${services}\n  Quests: ${quests}`
      }).join('\n')
      
      return {
        text: `# NPCs in the World\n\n${npcList}`,
        data: { npcs: afPack.npcs }
      }
    }
  }
  
  // 3. Create Quest Actions
  const acceptQuestAction: Action = {
    name: 'ACCEPT_QUEST',
    description: 'Accept a quest from an NPC',
    similes: ['take quest', 'start quest', 'accept task'],
    validate: async (runtime, message) => {
      // Check if there are available quests
      return afPack.quests.length > 0
    },
    handler: async (runtime, message, state, options, callback) => {
      const service = runtime.getService<HyperscapeService>(
        HyperscapeService.serviceName
      )!
      const world = service.getWorld()!
      
      // Extract quest title from message
      const messageText = message.content.text.toLowerCase()
      const quest = afPack.quests.find(q => 
        messageText.includes(q.title.toLowerCase())
      )
      
      if (!quest) {
        if (callback) {
          await callback({
            text: `I don't recognize that quest. Available quests: ${afPack.quests.map(q => q.title).join(', ')}`,
            source: 'quest-system'
          })
        }
        return {
          text: 'Quest not found',
          success: false
        }
      }
      
      // Add quest to player's active quests
      const questSystem = world.systems.find(s => s.constructor.name === 'QuestSystem')
      if (questSystem) {
        (questSystem as any).startQuest?.(quest.id)
      }
      
      if (callback) {
        await callback({
          text: `Quest accepted: ${quest.title}. ${quest.objectives.length} objectives to complete.`,
          source: 'quest-system'
        })
      }
      
      return {
        text: `Accepted quest: ${quest.title}`,
        success: true,
        data: { questId: quest.id, quest }
      }
    },
    examples: [
      [
        { name: "user", content: { text: "Accept the goblin slayer quest" } },
        { name: "agent", content: { text: "Quest accepted! I need to kill 5 goblins." } }
      ]
    ]
  }
  
  // 4. Create Quest System to manage state
  const questSystem: IGameSystem = {
    id: 'quest-system',
    name: 'Quest System',
    type: 'quests',
    
    async init(world: World) {
      // Initialize quest tracking on the world
      if (!world.quests) {
        (world as any).quests = {
          active: new Map(),
          completed: new Set(),
          data: afPack.quests
        }
      }
      console.log(`[QuestSystem] Loaded ${afPack.quests.length} quests`)
    },
    
    update(deltaTime: number) {
      // Quest system doesn't need continuous updates
    },
    
    cleanup() {
      // Clean up quest state
    }
  }
  
  // 5. Create the IContentPack
  return {
    id: afPack.id,
    name: afPack.name,
    description: afPack.description,
    version: afPack.version,
    
    // Providers inject data into agent context
    providers: [questProvider, npcProvider],
    
    // Actions enable agent to interact with quests
    actions: [acceptQuestAction],
    
    // Systems manage quest state
    systems: [questSystem],
    
    // Lifecycle hooks
    onLoad: async (runtime: IAgentRuntime, world: World) => {
      console.log(`[ContentPack] Loaded: ${afPack.name}`)
      console.log(`  - ${afPack.quests.length} quests`)
      console.log(`  - ${afPack.npcs.length} NPCs`)
      console.log(`  - ${afPack.lore.length} lore entries`)
      
      // Inject NPCs into world
      const npcSystem = world.systems.find(s => s.constructor.name === 'NPCSystem')
      if (npcSystem) {
        afPack.npcs.forEach(npc => {
          // Spawn NPC in world
          (npcSystem as any).spawnNPC?.({
            npcId: npc.id,
            name: npc.personality.name,
            type: npc.personality.archetype,
            position: { x: 0, y: 43, z: 0 },
            services: npc.services
          })
        })
      }
    },
    
    onUnload: async (runtime: IAgentRuntime, world: World) => {
      console.log(`[ContentPack] Unloaded: ${afPack.name}`)
    }
  }
}
```

---

## Step 3: Load into ElizaOS

### Option A: Via ContentPackLoader (Testing/Development)

```typescript
import { ContentPackLoader } from '@hyperscape/plugin-hyperscape/managers/content-pack-loader'
import { convertAssetForgePackToElizaOS } from '@hyperscape/plugin-hyperscape/utils/content-pack-converter'

// In test or agent initialization
const service = runtime.getService<HyperscapeService>(HyperscapeService.serviceName)!
const loader = new ContentPackLoader(runtime)

// Load exported JSON
const afPack = JSON.parse(fs.readFileSync('content-pack-123.json', 'utf-8'))

// Convert and load
const elizaPack = convertAssetForgePackToElizaOS(afPack)
await loader.loadPack(elizaPack, runtime)
```

### Option B: Via UGC Content (Runtime)

```typescript
// Create ContentBundle from our content pack
const contentBundle: ContentBundle = {
  id: afPack.id,
  name: afPack.name,
  description: afPack.description,
  version: afPack.version,
  
  providers: elizaPack.providers,
  actions: elizaPack.actions,
  
  install: async (world, runtime) => {
    // Install quest system
    if (elizaPack.systems) {
      for (const system of elizaPack.systems) {
        await system.init(world)
      }
    }
    
    return {
      actions: elizaPack.actions,
      providers: elizaPack.providers,
      metadata: { loadedAt: Date.now() }
    }
  }
}

// Load via service
await service.loadUGCContent(afPack.id, contentBundle)
```

---

## Step 4: Agent Access Flow

### How Agents See Quest Data

1. **Provider Injection** - Quest data appears in agent context:
```
# Available Quests

- **Goblin Slayer** (medium): Hunt down dangerous goblins
  3 objectives, 100 XP reward
  
- **Tree Chopper** (easy): Gather logs for the town
  1 objective, 50 XP reward
```

2. **Agent Decision** - Agent sees quest context in every prompt:
```
User: "Is there anything I can do?"

Agent Context:
  - CHARACTER: [agent bio]
  - WORLD: [nearby entities]
  - QUESTS: [available quests ← FROM PROVIDER]
  - ACTIONS: [ACCEPT_QUEST, ...] ← FROM ACTIONS

Agent Response: "Yes! There's a quest to hunt goblins. Would you like me to help?"
```

3. **Action Execution** - Agent can use ACCEPT_QUEST action:
```typescript
// When agent decides to accept quest
runtime.executeAction('ACCEPT_QUEST', { questId: 'quest_123' })

// Quest system updates state
world.quests.active.set('quest_123', {
  status: 'in_progress',
  objectives: { ... },
  startedAt: Date.now()
})
```

---

## Step 5: Real Data Integration

### Mob Data Flow

```typescript
// From Asset Forge Quest Builder
{
  "objectiveType": "combat",
  "actionHandler": "ATTACK_MOB",
  "target": "goblin",
  "targetMob": {
    "id": "goblin",
    "name": "Goblin",
    "level": 2,
    "xpReward": 8,
    "stats": {
      "health": 5,
      "attack": 1,
      "defense": 1
    },
    "modelPath": "asset://models/goblin/goblin_rigged.glb"
  },
  "quantity": 5
}
```

↓ **Converted to quest objective** ↓

```typescript
// In agent's quest provider context
"Kill 5 Goblins (Level 2) - 8 XP each = 40 XP total"
```

↓ **Agent sees in prompt** ↓

```
Quest Objective: Kill 5 Goblins
- Goblin Level: 2
- XP per kill: 8
- Total XP: 40
- Current progress: 0/5
```

↓ **Agent executes** ↓

```typescript
// Agent uses ATTACK_MOB action (from plugin-hyperscape/src/actions/attack.ts)
runtime.executeAction('ATTACK_MOB', { targetId: 'mob_goblin_123' })
```

↓ **Quest system tracks** ↓

```typescript
// Quest system detects mob kill
world.on('mob:killed', (data) => {
  const questSystem = world.systems.find(s => s.type === 'quests')
  questSystem.checkObjectives(data.mobType) // Updates 0/5 → 1/5
})
```

---

## Step 6: NPC Integration

### Quest Giver NPCs

From Asset Forge:
```json
{
  "id": "npc_elder",
  "personality": {
    "name": "Village Elder",
    "archetype": "quest-giver",
    "questsOffered": ["quest_goblin_slayer"]
  },
  "dialogues": [
    {
      "id": "greeting",
      "text": "Greetings! I have matters that need attention.",
      "responses": [
        {
          "text": "What do you need?",
          "nextNodeId": "quest_offer",
          "questReference": "quest_goblin_slayer"
        }
      ]
    },
    {
      "id": "quest_offer",
      "text": "Goblins are terrorizing our village...",
      "responses": [
        {
          "text": "I'll help",
          "effects": [{ "type": "ACCEPT_QUEST", "value": "quest_goblin_slayer" }]
        }
      ]
    }
  ]
}
```

↓ **Loaded into world** ↓

```typescript
// onLoad hook spawns NPC
const npcSystem = world.systems.find(s => s.constructor.name === 'NPCSystem')
npcSystem.spawnNPC({
  npcId: 'npc_elder',
  name: 'Village Elder',
  type: 'quest_giver',
  position: { x: 0, y: 43, z: 0 },
  services: ['quests']
})

// Store dialogue tree in NPC entity
const npcEntity = world.entities.get('npc_elder')
npcEntity.data.dialogues = npc.dialogues
npcEntity.data.questsOffered = ['quest_goblin_slayer']
```

↓ **Agent interacts** ↓

```typescript
// Agent uses TALK_TO_NPC action
runtime.executeAction('TALK_TO_NPC', { npcId: 'npc_elder' })

// NPC responds with dialogue from tree
// Agent sees quest offer in dialogue
// Agent can use ACCEPT_QUEST action
```

---

## Current Implementation Status

### ✅ Completed
1. **Asset Forge Content Builder**
   - Quest Builder with real mobs, items, NPCs
   - NPC Generator with quest assignment
   - Lore Generator
   - Content Pack export

2. **Type Definitions**
   - Action handlers mapped to real game actions
   - Quest tracking types
   - Content generation types

3. **Validation**
   - Quest validator checks action handlers
   - Validates targets match action requirements
   - Shows errors inline

### 🔨 To Be Created

1. **Content Pack Converter** (`/packages/plugin-hyperscape/src/utils/content-pack-converter.ts`)
   - Convert Asset Forge JSON → IContentPack
   - Create quest/NPC providers
   - Create quest actions (ACCEPT_QUEST, COMPLETE_QUEST, ABANDON_QUEST)
   - Create QuestSystem for state management

2. **Quest System** (`/packages/shared/src/systems/QuestSystem.ts`)
   - Manage active/completed quests per player
   - Track objective progress
   - Listen for game events (mob killed, item collected)
   - Update quest state automatically
   - Reward players on completion

3. **Content Pack Loader Integration**
   - Add method to HyperscapeService: `loadContentPack(packJson: string)`
   - Auto-convert and load content packs
   - Store in world state for persistence

4. **Agent Character Configuration**
   - Add content pack reference to character JSON
   - Auto-load pack when agent joins world
   - Example: `"contentPacks": ["quest-pack-123"]`

---

## Full Integration Example

### 1. Create Quest in Asset Forge
```
Asset Forge → Content Builder → Quests Tab
- Title: "Goblin Slayer"
- Quest Giver: Village Elder (quest_giver)
- Objective: Kill 5 Goblins (ATTACK_MOB action handler)
- Reward: 100 XP, 50 Gold, 1x Bronze Sword
→ Click "Generate Quest"
→ Click "Export Pack"
→ Saves: quest-pack-123.json
```

### 2. Load into Game World
```bash
# Copy pack to game server
cp quest-pack-123.json packages/server/content-packs/

# Server loads on startup or via API
POST /api/content-packs/load
{
  "packFile": "quest-pack-123.json"
}
```

### 3. Agent Joins World
```typescript
// In agent character JSON
{
  "name": "GoblinHunter",
  "plugins": ["@hyperscape/plugin-hyperscape"],
  "contentPacks": ["quest-pack-123"], // ← Auto-loads pack
  "settings": {
    "hyperscape": {
      "autoAcceptQuests": true,
      "preferredDifficulty": "medium"
    }
  }
}
```

### 4. Agent Sees & Does Quest
```
[Agent spawns in world]
[Quest Provider injects context]

User: "What should we do?"

Agent: "I see there's a quest from the Village Elder to hunt goblins. 
        We need to kill 5 of them for 100 XP and a bronze sword reward."

User: "Let's do it"

[Agent executes ACCEPT_QUEST]
[Agent uses ATTACK_MOB repeatedly]
[Quest system tracks: 0/5 → 1/5 → 2/5 → ... → 5/5]
[Quest auto-completes]

Agent: "Quest complete! We've cleared out the goblins. 
        Let's return to the Village Elder for our reward."
```

---

## Data Flow Diagram

```
┌──────────────┐
│ Asset Forge  │ exports JSON
│ (Editor UI)  ├──────┐
└──────────────┘      │
                      ▼
              ┌───────────────┐
              │ quest-pack.json│
              └───────┬────────┘
                      │
                      │ convert
                      ▼
              ┌───────────────┐
              │  IContentPack │
              │ ============= │
              │ • Providers   │ ←─┐ Inject into
              │ • Actions     │   │ agent prompts
              │ • Systems     │   │
              └───────┬────────┘   │
                      │            │
                      │ load       │
                      ▼            │
          ┌──────────────────┐    │
          │ HyperscapeService│    │
          │ ================ │    │
          │ • World State    │    │
          │ • Quest System   │    │
          │ • NPC System     │    │
          └────────┬─────────┘    │
                   │               │
                   │ provides      │
                   ▼               │
            ┌─────────────┐        │
            │ ElizaOS     │────────┘
            │ Agent       │
            │ =========== │
            │ • Sees      │
            │   quests    │
            │ • Can       │
            │   accept/   │
            │   complete  │
            └─────────────┘
```

---

## Real Game Values

### Mob Stats (from manifests/mobs.json)
- **Goblin**: Level 2, 5 HP, 8 XP, drops 10 coins
- **Bandit**: Level 3, 8 HP, 12 XP, drops 8 coins
- **Barbarian**: Level 4, 12 HP, 15 XP

### Item Values (from manifests/items.json)
- **Bronze Sword**: 100g value, weapon type
- **Bronze Helmet**: 50g value, armor type
- **Logs**: 10g value, resource type

### NPC Services (from manifests/npcs.json)
- **Bank Clerk**: banking service
- **Shopkeeper**: buy_items, sell_items services
- **Quest Giver**: quests service
- **Skill Trainer**: training service

### Action Handlers (from plugin-hyperscape/src/actions/)
- **ATTACK_MOB** → chopTree.ts pattern
- **CHOP_TREE** → requires axe/hatchet
- **BANK_ITEMS** → finds nearest bank NPC
- **COOK_FOOD** → requires raw_food + fire

---

## Next Steps

To complete the integration:

1. **Create** `/packages/plugin-hyperscape/src/utils/content-pack-converter.ts`
2. **Create** `/packages/shared/src/systems/QuestSystem.ts`
3. **Update** `HyperscapeService` to add `loadContentPack(packJson: string)` method
4. **Create** API endpoint: `POST /api/content-packs/load`
5. **Update** ElizaOS character config to support `"contentPacks": []` field
6. **Test** full flow: Export → Convert → Load → Agent Uses

---

## File Locations

### Asset Forge (Content Creation)
- `/packages/asset-forge/src/pages/ContentGenerationPage.tsx` - UI
- `/packages/asset-forge/src/store/useContentGenerationStore.ts` - State
- `/packages/asset-forge/src/components/GameContent/QuestBuilder.tsx` - Quest editor
- `/packages/asset-forge/src/types/content-generation.ts` - Types

### Plugin Hyperscape (Agent Integration)
- `/packages/plugin-hyperscape/src/types/content-pack.ts` - IContentPack interface
- `/packages/plugin-hyperscape/src/managers/content-pack-loader.ts` - Loader
- `/packages/plugin-hyperscape/src/service.ts` - HyperscapeService.loadUGCContent()
- `/packages/plugin-hyperscape/src/content-packs/content-pack.ts` - Example pack

### Shared (Game Systems)
- `/packages/shared/src/data/DataManager.ts` - Loads manifests from CDN
- `/packages/shared/src/systems/NPCSystem.ts` - NPC management
- `/packages/shared/src/systems/EntityManager.ts` - Entity spawning

### Manifests (Game Data)
- `/packages/server/.assets-repo/manifests/mobs.json` - Mob data
- `/packages/server/.assets-repo/manifests/npcs.json` - NPC data
- `/packages/server/.assets-repo/manifests/items.json` - Item data
- `/packages/server/.assets-repo/manifests/resources.json` - Resource data

---

## Summary

The complete flow is:

1. **Asset Forge** creates quests using real game data (mobs, items, NPCs)
2. **Export** generates JSON with all quest/NPC/lore data
3. **Converter** transforms JSON into IContentPack with providers/actions/systems
4. **ContentPackLoader** loads pack into ElizaOS runtime
5. **Providers** inject quest context into every agent prompt
6. **Actions** enable agent to accept/complete quests
7. **QuestSystem** tracks progress and updates state
8. **Agent** can now see quests, accept them, and complete objectives

All using **real mob stats**, **real item values**, **real action handlers**, and **real NPC data** from the game manifests.

---

## Quick Reference

### Files Created (Asset Forge)
- ✅ `src/types/action-handlers.ts` - 17 action handler definitions
- ✅ `src/types/quest-tracking.ts` - Quest progress tracking types
- ✅ `src/utils/quest-validator.ts` - Quest validation logic
- ✅ `src/utils/quest-exporter.ts` - Export to game format
- ✅ `src/store/useQuestTrackingStore.ts` - Quest state management
- ✅ `src/components/GameContent/ActionHandlerSelector.tsx` - Action picker UI
- ✅ `src/components/GameContent/QuestTracker.tsx` - Progress tracker UI

### Files Modified (Asset Forge)
- ✅ `src/types/content-generation.ts` - Added action handler fields
- ✅ `src/components/GameContent/QuestBuilder.tsx` - Real data integration
- ✅ `src/components/GameContent/NPCScriptGenerator.tsx` - Quest giver support
- ✅ `src/pages/ContentGenerationPage.tsx` - Added tracking tab
- ✅ `src/store/useContentGenerationStore.ts` - Added tracking tab type

### Files to Create (Plugin Hyperscape)
- 🔨 `src/utils/content-pack-converter.ts` - JSON → IContentPack converter
- 🔨 `src/systems/QuestSystem.ts` - Quest state management
- 🔨 `src/actions/accept-quest.ts` - ACCEPT_QUEST action
- 🔨 `src/actions/complete-quest.ts` - COMPLETE_QUEST action
- 🔨 `src/providers/quest-provider.ts` - Quest context for prompts

### Integration Steps
1. Export content pack from Asset Forge → `content-pack-123.json`
2. Convert using `convertAssetForgePackToElizaOS()` → `IContentPack`
3. Load using `ContentPackLoader.loadPack()` → Registered with agent
4. Agent sees quests via **Provider** in prompts
5. Agent can **ACCEPT_QUEST** via Actions
6. **QuestSystem** tracks progress automatically
7. Agent completes objectives → Quest completes → Rewards granted

