// RPG Event Types for stronger type safety

export interface RPGBankUpdateEvent extends Event {
  type: 'rpg:bank:updated'
  detail: {
    playerId: string
    bankItems: Array<{
      id: string
      name: string
      quantity: number
      stackable: boolean
      slotIndex: number
    }>
    capacity: {
      used: number
      max: number
    }
  }
}

export interface RPGInventoryUpdateEvent extends Event {
  type: 'rpg:inventory:updated'
  detail: {
    playerId: string
    items: Array<{
      id: number | string
      name: string
      quantity: number
      stackable: boolean
      slotIndex: number
    }>
    coins?: number
    inventory?: {
      items: Array<{
        id: number
        name: string
        quantity: number
        stackable: boolean
        slotIndex?: number
      }>
    }
  }
}

export interface RPGBankDepositEvent extends Event {
  type: 'rpg:bank:deposit'
  detail: {
    playerId: string
    itemId: string
    quantity: number
    slotIndex: number
  }
}

export interface RPGBankWithdrawEvent extends Event {
  type: 'rpg:bank:withdraw'
  detail: {
    playerId: string
    itemId: string
    quantity: number
    slotIndex: number
  }
}

export interface RPGBankDepositAllEvent extends Event {
  type: 'rpg:bank:deposit:all'
  detail: {
    playerId: string
  }
}

export interface RPGBankWithdrawAllEvent extends Event {
  type: 'rpg:bank:withdraw:all'
  detail: {
    playerId: string
  }
}

export interface RPGBankRequestEvent extends Event {
  type: 'rpg:bank:request'
  detail: {
    playerId: string
  }
}

export interface RPGChatMessageEvent extends Event {
  type: 'rpg:chat:message'
  detail: {
    playerId: string
    playerName: string
    message: string
    type?: 'public' | 'system' | 'combat' | 'trade' | 'error'
  }
}

export interface RPGChatSystemEvent extends Event {
  type: 'rpg:chat:system'
  detail: {
    message: string
    type?: 'public' | 'system' | 'combat' | 'trade' | 'error'
  }
}

export interface RPGChatCombatEvent extends Event {
  type: 'rpg:chat:combat'
  detail: {
    message: string
  }
}

export interface RPGChatSendEvent extends Event {
  type: 'rpg:chat:send'
  detail: {
    playerId: string
    message: string
    type: 'public'
  }
}

export interface RPGCombatStartedEvent extends Event {
  type: 'rpg:combat:started'
  detail: {
    attackerId: string
    targetId: string
    target: {
      id: string
      name: string
      health: number
      maxHealth: number
    }
  }
}

export interface RPGCombatEndedEvent extends Event {
  type: 'rpg:combat:ended'
  detail: {
    playerId: string
  }
}

export interface RPGCombatStyleChangeEvent extends Event {
  type: 'rpg:combat:style:change'
  detail: {
    playerId: string
    style: 'attack' | 'strength' | 'defense' | 'ranged'
  }
}

export interface RPGEquipmentUpdateEvent extends Event {
  type: 'rpg:equipment:updated'
  detail: {
    playerId: string
    equipment: {
      weapon?: {
        id: number
        name: string
        type: 'weapon' | 'shield' | 'helmet' | 'body' | 'legs' | 'arrows'
        stats?: {
          attack?: number
          defense?: number
          strength?: number
        }
        count?: number
      }
      shield?: {
        id: number
        name: string
        type: 'weapon' | 'shield' | 'helmet' | 'body' | 'legs' | 'arrows'
        stats?: {
          attack?: number
          defense?: number
          strength?: number
        }
      }
      helmet?: {
        id: number
        name: string
        type: 'weapon' | 'shield' | 'helmet' | 'body' | 'legs' | 'arrows'
        stats?: {
          attack?: number
          defense?: number
          strength?: number
        }
      }
      body?: {
        id: number
        name: string
        type: 'weapon' | 'shield' | 'helmet' | 'body' | 'legs' | 'arrows'
        stats?: {
          attack?: number
          defense?: number
          strength?: number
        }
      }
      legs?: {
        id: number
        name: string
        type: 'weapon' | 'shield' | 'helmet' | 'body' | 'legs' | 'arrows'
        stats?: {
          attack?: number
          defense?: number
          strength?: number
        }
      }
      arrows?: {
        id: number
        name: string
        type: 'weapon' | 'shield' | 'helmet' | 'body' | 'legs' | 'arrows'
        stats?: {
          attack?: number
          defense?: number
          strength?: number
        }
        count?: number
      }
    }
  }
}

export interface RPGEquipmentUnequipEvent extends Event {
  type: 'rpg:equipment:unequip'
  detail: {
    playerId: string
    slot: string
  }
}

export interface RPGPlayerStatsUpdateEvent extends Event {
  type: 'rpg:player:stats:updated'
  detail: {
    playerId: string
    stats: {
      constitution?: {
        current: number
        max: number
      }
      stamina?: {
        current: number
        max: number
      }
      experience?: {
        current: number
        nextLevel: number
      }
      combatLevel?: number
    }
    skills?: {
      attack: { level: number; xp: number }
      strength: { level: number; xp: number }
      defense: { level: number; xp: number }
      constitution: { level: number; xp: number }
      ranged: { level: number; xp: number }
      woodcutting: { level: number; xp: number }
      fishing: { level: number; xp: number }
      firemaking: { level: number; xp: number }
      cooking: { level: number; xp: number }
    }
  }
}

export interface RPGPlayerHealthChangeEvent extends Event {
  type: 'rpg:player:health:changed'
  detail: {
    playerId: string
    newHealth: number
    changeType: 'damage' | 'heal'
  }
}

export interface RPGPlayerStatusEffectEvent extends Event {
  type: 'rpg:player:status:effect'
  detail: {
    playerId: string
    action: 'add' | 'remove'
    effect: {
      name: string
      type: 'positive' | 'negative' | 'neutral'
      duration?: number
    }
  }
}

export interface RPGPlayerStaminaUpdateEvent extends Event {
  type: 'rpg:player:stamina:updated'
  detail: {
    playerId: string
    stamina: number
  }
}

export interface RPGInventoryEquipEvent extends Event {
  type: 'rpg:inventory:equip'
  detail: {
    playerId: string
    itemId: number
    slot: string
  }
}

export interface RPGSkillsUpdateEvent extends Event {
  type: 'rpg:skills:updated'
  detail: {
    playerId: string
    skills: {
      attack: { level: number; xp: number }
      strength: { level: number; xp: number }
      defense: { level: number; xp: number }
      constitution: { level: number; xp: number }
      ranged: { level: number; xp: number }
      woodcutting: { level: number; xp: number }
      fishing: { level: number; xp: number }
      firemaking: { level: number; xp: number }
      cooking: { level: number; xp: number }
    }
  }
}

export interface RPGStoreRequestEvent extends Event {
  type: 'rpg:store:request'
  detail: {
    playerId: string
    storeType: string
  }
}

export interface RPGStoreDataEvent extends Event {
  type: 'rpg:store:data'
  detail: {
    storeType: string
    items: Array<{
      id: string
      name: string
      description: string
      price: number
      category: 'weapons' | 'armor' | 'tools' | 'food' | 'misc'
      stock?: number
      levelRequirement?: number
    }>
  }
}

export interface RPGStoreBuyEvent extends Event {
  type: 'rpg:store:buy'
  detail: {
    playerId: string
    storeType: string
    itemId: string
    quantity: number
    totalCost: number
  }
}

// Augment the WindowEventMap to include our custom events
declare global {
  interface WindowEventMap {
    'rpg:bank:updated': RPGBankUpdateEvent
    'rpg:inventory:updated': RPGInventoryUpdateEvent
    'rpg:bank:deposit': RPGBankDepositEvent
    'rpg:bank:withdraw': RPGBankWithdrawEvent
    'rpg:bank:deposit:all': RPGBankDepositAllEvent
    'rpg:bank:withdraw:all': RPGBankWithdrawAllEvent
    'rpg:bank:request': RPGBankRequestEvent
    'rpg:chat:message': RPGChatMessageEvent
    'rpg:chat:system': RPGChatSystemEvent
    'rpg:chat:combat': RPGChatCombatEvent
    'rpg:chat:send': RPGChatSendEvent
    'rpg:combat:started': RPGCombatStartedEvent
    'rpg:combat:ended': RPGCombatEndedEvent
    'rpg:combat:style:change': RPGCombatStyleChangeEvent
    'rpg:equipment:updated': RPGEquipmentUpdateEvent
    'rpg:equipment:unequip': RPGEquipmentUnequipEvent
    'rpg:player:stats:updated': RPGPlayerStatsUpdateEvent
    'rpg:player:health:changed': RPGPlayerHealthChangeEvent
    'rpg:player:status:effect': RPGPlayerStatusEffectEvent
    'rpg:player:stamina:updated': RPGPlayerStaminaUpdateEvent
    'rpg:inventory:equip': RPGInventoryEquipEvent
    'rpg:skills:updated': RPGSkillsUpdateEvent
    'rpg:store:request': RPGStoreRequestEvent
    'rpg:store:data': RPGStoreDataEvent
    'rpg:store:buy': RPGStoreBuyEvent
  }
} 