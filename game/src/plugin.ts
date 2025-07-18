/**
 * Hyperfy RPG Plugin for ElizaOS
 * Provides actions and providers for AI agents to interact with the RPG world
 */

import type { Plugin, Action, Provider } from '@elizaos/core'

// Import all agent actions
import { MoveToLocationAction } from './plugin/actions/movement/MoveToLocationAction'
import { AttackTargetAction } from './plugin/actions/combat/AttackTargetAction'
import { PickupItemAction } from './plugin/actions/items/PickupItemAction'
import { TalkToNPCAction } from './plugin/actions/npcs/TalkToNPCAction'
import { OpenBankAction } from './plugin/actions/banking/OpenBankAction'
import { HarvestResourceAction } from './plugin/actions/skills/HarvestResourceAction'
import { AcceptQuestAction } from './plugin/actions/quests/AcceptQuestAction'
import { UseSkillAction } from './plugin/actions/skills/UseSkillAction'
import { TradeAction } from './plugin/actions/trading/TradeAction'
import { EquipItemAction } from './plugin/actions/inventory/EquipItemAction'
import { CastSpellAction } from './plugin/actions/magic/CastSpellAction'

// Import all providers
import { PlayerStatusProvider } from './plugin/providers/PlayerStatusProvider'
import { WorldStateProvider } from './plugin/providers/WorldStateProvider'
import { QuestProgressProvider } from './plugin/providers/QuestProgressProvider'
import { NearbyEntitiesProvider } from './plugin/providers/NearbyEntitiesProvider'
import { SkillProgressProvider } from './plugin/providers/SkillProgressProvider'

export const hyperfyRPGPlugin: Plugin = {
  name: 'hyperfy-rpg',
  description: 'RuneScape-style RPG plugin for Hyperfy virtual worlds',
  version: '1.0.0',
  
  actions: [
    MoveToLocationAction,
    AttackTargetAction,
    PickupItemAction,
    TalkToNPCAction,
    OpenBankAction,
    HarvestResourceAction,
    AcceptQuestAction,
    UseSkillAction,
    TradeAction,
    EquipItemAction,
    CastSpellAction
  ] as Action[],
  
  providers: [
    PlayerStatusProvider,
    WorldStateProvider,
    QuestProgressProvider,
    NearbyEntitiesProvider,
    SkillProgressProvider
  ] as Provider[],
  
  services: [],
  evaluators: []
}

// Re-export main setup function
export { setupRPGWorld, isRPGReady, getRPGStatus } from './index'

// Export types
export * from './types'
