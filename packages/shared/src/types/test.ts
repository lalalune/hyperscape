/**
 * Test system type definitions
 * 
 * These interfaces define test data structures used by the testing framework.
 * All test interfaces use strongly typed properties to ensure test reliability.
 */

import type { PlayerEntity, Position3D } from './index';
import type { AttackType, EquipmentSlotName, PlayerEquipment, Skills, Inventory, Item, InventoryItem } from './core';

// Test Player interface for visual testing framework
// DO NOT alter -- instead alter the BasePlayer if you need more properties
// But if you need position and rotation, try .node.position and .node.rotation  
export type Player = PlayerEntity
export type { PlayerEntity }

// Type alias for skill names
export type SkillName = keyof Skills;

// Common test types
export type TestAction = 'woodcutting' | 'fishing' | 'combat' | 'firemaking' | 'cooking';

// Visual test framework interfaces
export interface TestStationConfig {
  position: Position3D;
  name: string;
  description: string;
}

// Resource test interfaces
export interface ResourceTestData {
  player: PlayerEntity;
  resourcePosition: Position3D;
  resourceType: 'tree' | 'rock' | 'ore' | 'herb' | 'fish';
  gatheringStarted: boolean;
  gatheringProgress: number;
  gatheringComplete: boolean;
  resourceRemoved: boolean;
  itemReceived: boolean;
  xpGained: number;
  startTime: number;
}

// Fishing test interfaces
export interface FishingTestData {
  player: PlayerEntity;
  fishingSpot: Position3D;
  startTime: number;
  initialFishingXP: number;
  finalFishingXP: number;
  fishCaught: number;
  attemptsMade: number;
  successRate: number;
  expectedSuccessRate: number;
  hasRodEquipped: boolean;
  nearWater: boolean;
  inventorySpace: number;
}

// Combat test interfaces
export interface CombatTestData {
  player: PlayerEntity;
  mobId: string;
  weaponType: AttackType;
  startTime: number;
  damageDealt: number;
  hitCount: number;
  missCount: number;
  expectedKillTime: number;
  arrowsUsed: number;
  initialArrows: number;
  attackInterval: NodeJS.Timeout | null;
  goblinId: string;
  goblinHealth: number;
  playerHealth: number;
  combatStarted: boolean;
  combatEnded: boolean;
  damageReceived: number;
  xpGained: number;
  lootDropped: boolean;
}

// Movement test interfaces
export interface MovementTestData {
  player: PlayerEntity;
  testType: 'basic_movement' | 'pathfinding' | 'collision' | 'teleportation' | 'comprehensive';
  startTime: number;
  startPosition: Position3D;
  targetPosition: Position3D;
  currentPosition: Position3D;
  waypoints: Array<Position3D & { reached: boolean }>;
  distanceTraveled: number;
  movementSpeed: number;
  staminaUsed: number;
  obstaclesAvoided: number;
  teleportationsAttempted: number;
  teleportationsSuccessful: number;
  collisionDetected: boolean;
  pathfindingWorked: boolean;
  boundariesRespected: boolean;
  movementEffectsTested: boolean;
  timeoutIds: NodeJS.Timeout[];
  movementStarted: boolean;
  movementCompleted: boolean;
  pathFound: boolean;
  pathNodes: Position3D[];
  currentPathIndex: number;
}

// Position3D is imported from core.ts

// XP test interfaces
export interface XPTestData {
  player: PlayerEntity;
  startTime: number;
  initialSkills: Skills;
  finalSkills: Skills;
  xpGained: Record<SkillName, number>;
  levelsGained: Record<SkillName, number>;
  levelUpsDetected: number;
  combatLevelInitial: number;
  combatLevelFinal: number;
  expectedXPPerAction: Record<TestAction, number>;
  actionsPerformed: Record<TestAction, number>;
  expectedSkillsPerAction: Record<TestAction, SkillName[]>;
  initialXP: Record<SkillName, { level: number; xp: number }>;
  currentXP: Record<SkillName, { level: number; xp: number }>;
}

// Inventory test interfaces
export interface InventoryTestData {
  player: PlayerEntity;
  testItems: string[];
  droppedItems: Array<{ itemId: string; position: Position3D; quantity: number }>;
  startTime: number;
  initialInventorySize: number;
  itemsPickedUp: number;
  itemsDropped: number;
  itemsUsed: number;
  stackingTested: boolean;
  spaceLimit_tested: boolean;
  maxSlotsTested: boolean;
  itemsAdded: number;
  itemsRemoved: number;
  testType: 'basic_pickup' | 'item_stacking' | 'inventory_limit' | 'item_movement' | 'item_use';
  initialInventory: Inventory;
  currentInventory: Inventory;
  itemsAddedArray: Array<{ item: Item; quantity: number }>;
  itemsRemovedArray: Array<{ item: Item; quantity: number }>;
  itemsMoved: Array<{ from: number; to: number }>;
  coinsGained: number;
  coinsSpent: number;
}

// Equipment test interfaces
export interface TestItem {
  id: string;
  name: string;
  slot: EquipmentSlotName;
  stats: { attack: number; defense: number; strength: number; ranged: number };
}

export interface EquipmentTestData {
  player: PlayerEntity;
  testItems: TestItem[];
  equipmentSlots: Array<EquipmentSlotName>;
  currentEquipment: {
    weapon: TestItem | null;
    shield: TestItem | null;
    helmet: TestItem | null;
    body: TestItem | null;
    legs: TestItem | null;
    arrows: TestItem | null;
  };
  equipmentChanges: Array<{ slot: EquipmentSlotName; item: TestItem | null; timestamp: number }>;
  startTime: number;
}

// Cooking test interfaces
export interface CookingTestData {
  player: PlayerEntity;
  fireId: string;
  startTime: number;
  initialCookingXP: number;
  finalCookingXP: number;
  rawFishUsed: number;
  cookedFishCreated: number;
  burntFishCreated: number;
  successfulCooks: number;
  burnedCooks: number;
  attemptsMade: number;
  expectedSuccessRate: number;
  listeners: Array<{ event: string; handler: Function }>;
  firePosition: Position3D;
  cookingStarted: boolean;
  cookingProgress: number;
  cookingComplete: boolean;
  itemCooked: boolean;
  xpGained: number;
  hasFire: boolean;
  hasRawFish: boolean;
  inventorySpace: number;
}



// Store test interfaces
export interface StoreTestData {
  player: PlayerEntity;
  storePosition: Position3D;
  storeOpen: boolean;
  itemsBought: Array<{ item: Item; quantity: number; price: number }>;
  itemsSold: Array<{ item: Item; quantity: number; price: number }>;
  startingCoins: number;
  currentCoins: number;
  startTime: number;
}

// Death test interfaces
export interface DeathTestData {
  player: PlayerEntity;
  deathLocation: Position3D;
  respawnLocation: Position3D;
  startTime: number;
  initialHealth: number;
  deathOccurred: boolean;
  respawnOccurred: boolean;
  itemsDropped: Array<{ item: Record<string, unknown>; quantity: number }>;
  itemsRetrieved: Array<{ item: Record<string, unknown>; quantity: number }>;
  deathCause: string;
  respawnTime: number;
  distanceFromDeathToRespawn: number;
  headstoneCreated: boolean;
  headstoneLocation: Position3D | null;
  respawnedAtTown: boolean;
  originalPosition?: Position3D;
  deathProcessed?: boolean;
}

// Persistence test interfaces
export interface PersistenceTestData {
  player: PlayerEntity;
  saveTime: number;
  loadTime: number;
  savedData: {
    skills: Skills;
    inventory: Inventory;
    equipment: Array<{ slot: EquipmentSlotName; item: Item }>;
    bankStorage: Array<{ item: Item; quantity: number }>;
    position: Position3D;
    health: number;
    coins: number;
  } | null;
  loadedData: {
    skills: Skills;
    inventory: Inventory;
    equipment: Array<{ slot: EquipmentSlotName; item: Item }>;
    bankStorage: Array<{ item: Item; quantity: number }>;
    position: Position3D;
    health: number;
    coins: number;
  } | null;
  dataMatches: boolean;
  saveSuccessful: boolean;
  loadSuccessful: boolean;
}

// UI test interfaces
export interface UITestData {
  player: PlayerEntity;
  uiOpen: boolean;
  uiType: 'inventory' | 'equipment' | 'skills' | 'bank' | 'store' | 'combat';
  uiData: {
    inventory: Inventory | null;
    equipment: PlayerEquipment | null;
    skills: Skills | null;
    bank: Array<{ item: Item; quantity: number }> | null;
    store: { storeId: string; items: Array<{ item: Item; price: number }> } | null;
  };
  uiInteractions: Array<{ 
    action: 'click' | 'drag' | 'drop' | 'equip' | 'unequip' | 'buy' | 'sell'; 
    timestamp: number; 
    data: {
      itemId: string;
      slot: string;
      quantity: number;
      targetSlot: string;
    };
  }>;
  startTime: number;
}

// Aggro test result interfaces
export interface AggroTestResult {
  player: PlayerEntity;
  mobId: string;
  mobPosition: Position3D;
  aggroTriggered: boolean;
  aggroDistance: number;
  combatStarted: boolean;
  playerDetected: boolean;
  startTime: number;
}

// Loot drop test interfaces
export interface LootTestData {
  player: PlayerEntity;
  mobId: string;
  lootDropped: boolean;
  lootItems: Array<{ item: Item; quantity: number }>;
  lootCollected: boolean;
  corpseCreated: boolean;
  startTime: number;
}

// Corpse test interfaces
export interface CorpseTestData {
  testId: string;
  corpseId: string;
  position: Position3D;
  mobType: string;
  startTime: number;
  phase: 'spawning' | 'verifying_visual' | 'testing_interaction' | 'checking_loot' | 'verifying_cleanup' | 'completed' | 'failed';
  corpseSpawned: boolean;
  corpseVisible: boolean;
  corpseInteractable: boolean;
  lootAccessible: boolean;
  corpseCleanedUp: boolean;
  expectedLootItems: string[];
  actualLootItems: string[];
  errors: string[];
}

// Firemaking test interfaces
export interface FiremakingTestData {
  player: PlayerEntity;
  firePosition: Position3D;
  fireCreated: boolean;
  logsUsed: number;
  xpGained: number;
  fireDecayed: boolean;
  startTime: number;
  hasLogs: boolean;
  inventorySpace: number;
}

// Woodcutting test interfaces
export interface WoodcuttingTestSession {
  player: PlayerEntity;
  treePosition: Position3D;
  treeId: string;
  startTime: number;
  chopStarted: boolean;
  chopComplete: boolean;
  logsReceived: number;
  xpGained: number;
  treeRespawned: boolean;
  respawnTime: number;
}

// Action test interfaces
export interface ActionTestData {
  player: PlayerEntity;
  actionName: 'attack' | 'pickup' | 'drop' | 'equip' | 'unequip' | 'use' | 'move' | 'gather' | 'cook' | 'fish';
  actionParams: {
    targetId: string | null;
    itemId: string | null;
    quantity: number | null;
    position: Position3D | null;
    slot: string | null;
  };
  actionStarted: boolean;
  actionCompleted: boolean;
  actionResult: {
    success: boolean;
    message: string;
    data: Record<string, string | number | boolean>;
    error: string | null;
  } | null;
  startTime: number;
}

// System validation interfaces
export interface SystemValidationData {
  systemName: string;
  initialized: boolean;
  dependencies: string[];
  missingDependencies: string[];
  methods: string[];
  missingMethods: string[];
  validationPassed: boolean;
  errors: string[];
}

export interface SystemValidationResult {
  systemName: string;
  exists: boolean;
  initialized: boolean;
  hasRequiredMethods: boolean;
  missingMethods: string[];
  errors: string[];
}

export interface ValidationResults {
  totalSystems: number;
  passedSystems: number;
  failedSystems: number;
  missingDependencies: Set<string>;
  errors: string[];
  allPassed: boolean;
}

// Database test interfaces
export interface DatabaseTestData {
  testType: 'crud_operations' | 'inventory_persistence' | 'equipment_storage' | 'chunk_management' | 'session_tracking' | 'transactions' | 'comprehensive';
  startTime: number;
  operationsPerformed: Record<string, number>;
  dataCreated: Record<string, boolean>;
  dataRetrieved: Record<string, boolean>;
  dataUpdated: Record<string, boolean>;
  dataDeleted: Record<string, boolean>;
  transactionTests: Record<string, boolean>;
  validationTests: Record<string, boolean>;
  performanceMetrics: Record<string, number>;
  errors: string[];
}

// Aggro test interfaces
export interface AggroTestData {
  player: PlayerEntity;
  mobId: string;
  mobType: string; // Using string instead of MobType to avoid circular dependency
  playerLevel: number;
  expectedAggressive: boolean;
  startTime: number;
  initialMobPosition: Position3D;
  aggroDetected: boolean;
  chaseStarted: boolean;
  maxChaseDistance: number;
  leashTested: boolean;
  returnedToSpawn: boolean;
}

export interface AggroTestResults {
  duration: number;
  playerLevel: number;
  mobType: string;
  expectedAggressive: boolean;
  actualAggressive: boolean;
  chaseOccurred?: boolean;
  chaseStarted?: boolean;
  maxChaseDistance?: number;
  leashTriggered?: boolean;
  leashTested?: boolean;
  aggroRangeRespected?: boolean;
  passed: boolean;
  success?: boolean;
  failureReason?: string;
  returnedToSpawn?: boolean;
}

// Banking test interfaces  
export interface BankingTestData {
  player: PlayerEntity;
  bankLocation: Position3D;
  testItems: Array<{ itemId: string; quantity: number }>;
  startTime: number;
  depositedItems: number;
  withdrawnItems: number;
  bankBalance: Record<string, number>;
  inventoryBefore: InventoryItem[];
  inventoryAfter: InventoryItem[];
  depositTested: boolean;
  withdrawTested: boolean;
  bulkTested: boolean;
}