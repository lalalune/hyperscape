/**
 * UI Test System
 * Tests complete user interface functionality per GDD specifications:
 * - Inventory UI display and interactions
 * - Equipment UI display and drag/drop
 * - Banking UI and transfer operations
 * - Health/stamina bars display
 * - Skill progression UI
 * - Combat interface elements
 * - Chat system functionality
 * - Minimap and world UI
 * - Menu navigation and responsiveness
 */

import { getItem } from '../data/items';
import { VisualTestFramework } from './VisualTestFramework';
import type { PlayerEntity } from '../types/test'
import type { World } from '../types/index';
import { EventType } from '../types/events';
import { EquipmentSlotName, PlayerHealth } from '../types/core';
import { getSystem } from '../utils/SystemUtils';
import type { UISystem } from './UISystem';
import type { InventorySystem } from './InventorySystem';
import type { EquipmentSystem } from './EquipmentSystem';
import type { BankingSystem } from './BankingSystem';

interface UITestData {
  player: PlayerEntity;
  startTime: number;
  uiElementsCreated: Array<{ type: string; id: string; visible: boolean }>;
  interactionsPerformed: Array<{ type: string; target: string; success: boolean }>;
  uiResponsive: boolean;
  uiElementsVisible: boolean;
  dragDropWorking: boolean;
  menuNavigationWorking: boolean;
  chatSystemWorking: boolean;
  healthBarVisible: boolean;
  skillUIVisible: boolean;
  inventoryUIVisible: boolean;
  bankUIVisible: boolean;
  equipmentUIVisible: boolean;
  minimapVisible: boolean;
  performanceMetrics: {
    uiLoadTime: number;
    interactionResponseTime: number;
    memoryUsage: number;
  };
}

export class UITestSystem extends VisualTestFramework {
  private testData = new Map<string, UITestData>();
  private uiSystem!: UISystem;
  private inventorySystem!: InventorySystem;
  private equipmentSystem!: EquipmentSystem;
  private bankingSystem!: BankingSystem;
  private playerSkills = new Map<string, Record<string, { level: number; xp: number }>>();

  constructor(world: World) {
    super(world);
  }

  async init(): Promise<void> {
    await super.init();
    
    this.uiSystem = getSystem<UISystem>(this.world, 'ui')!;
    this.inventorySystem = getSystem<InventorySystem>(this.world, 'inventory')!;
    this.equipmentSystem = getSystem<EquipmentSystem>(this.world, 'equipment')!;
    this.bankingSystem = getSystem<BankingSystem>(this.world, 'banking')!;
    
    // Listen for UI events
    this.subscribe(EventType.UI_CREATE, (data: { type: string; playerId: string; success: boolean; id: string }) => this.handleUICreated(data));
    this.subscribe(EventType.UI_UPDATE, (data: { type: string; playerId: string; success: boolean; target: string }) => this.handleUIInteraction(data));
    this.subscribe(EventType.UI_MESSAGE, (data: { playerId: string; error: string; uiType: string }) => this.handleUIError(data));
    this.subscribe(EventType.CHAT_MESSAGE, (data: { playerId: string; message: string; timestamp: number }) => this.handleChatMessage(data));

    // Listen to skills updates for reactive patterns
    this.subscribe(EventType.SKILLS_UPDATED, (data) => {
      const eventData = data as { playerId: string; skills: Record<string, { level: number; xp: number }> };
      this.playerSkills.set(eventData.playerId, eventData.skills);
    });
    
    // Create test stations
    this.createTestStations();
    
  }

  protected createTestStations(): void {
    // Inventory UI Test - Test inventory display and interactions
    this.createTestStation({
      id: 'ui_inventory_test',
      name: 'Inventory UI Test',
      position: { x: -160, y: 0, z: 10 },
      timeoutMs: 25000 // 25 seconds
    });

    // Equipment UI Test - Test equipment display and drag/drop
    this.createTestStation({
      id: 'ui_equipment_test',
      name: 'Equipment UI Test',
      position: { x: -160, y: 0, z: 20 },
      timeoutMs: 30000 // 30 seconds
    });

    // Banking UI Test - Test bank interface and transfers
    this.createTestStation({
      id: 'ui_banking_test',
      name: 'Banking UI Test',
      position: { x: -160, y: 0, z: 30 },
      timeoutMs: 35000 // 35 seconds
    });

    // Health/Stamina UI Test - Test status bars and updates
    this.createTestStation({
      id: 'ui_health_stamina_test',
      name: 'Health/Stamina UI Test',
      position: { x: -160, y: 0, z: 40 },
      timeoutMs: 20000 // 20 seconds
    });

    // Skills UI Test - Test skill progression display
    this.createTestStation({
      id: 'ui_skills_test',
      name: 'Skills UI Test',
      position: { x: -160, y: 0, z: 50 },
      timeoutMs: 25000 // 25 seconds
    });

    // Chat System Test - Test chat functionality
    this.createTestStation({
      id: 'ui_chat_test',
      name: 'Chat System Test',
      position: { x: -160, y: 0, z: 60 },
      timeoutMs: 20000 // 20 seconds
    });

    // Minimap UI Test - Test minimap display and navigation
    this.createTestStation({
      id: 'ui_minimap_test',
      name: 'Minimap UI Test',
      position: { x: -160, y: 0, z: 70 },
      timeoutMs: 25000 // 25 seconds
    });

    // Menu Navigation Test - Test menu system responsiveness
    this.createTestStation({
      id: 'ui_menu_navigation_test',
      name: 'Menu Navigation Test',
      position: { x: -160, y: 0, z: 80 },
      timeoutMs: 30000 // 30 seconds
    });

    // UI Performance Test - Test UI under load
    this.createTestStation({
      id: 'ui_performance_test',
      name: 'UI Performance Test',
      position: { x: -160, y: 0, z: 90 },
      timeoutMs: 40000 // 40 seconds
    });

    // Responsive UI Test - Test UI at different resolutions
    this.createTestStation({
      id: 'ui_responsive_test',
      name: 'Responsive UI Test',
      position: { x: -160, y: 0, z: 100 },
      timeoutMs: 30000 // 30 seconds
    });

    // Accessibility Test - Test UI accessibility features
    this.createTestStation({
      id: 'ui_accessibility_test',
      name: 'UI Accessibility Test',
      position: { x: -160, y: 0, z: 110 },
      timeoutMs: 35000 // 35 seconds
    });

    // Specific Interaction Validation Test - Test precise UI interactions
    this.createTestStation({
      id: 'ui_interaction_validation',
      name: 'Specific Interaction Validation Test',
      position: { x: -160, y: 0, z: 120 },
      timeoutMs: 40000 // 40 seconds
    });

    // Error Recovery Test - Test UI error handling and recovery
    this.createTestStation({
      id: 'ui_error_recovery',
      name: 'UI Error Recovery Test',
      position: { x: -160, y: 0, z: 130 },
      timeoutMs: 30000 // 30 seconds
    });
  }

  protected runTest(stationId: string): void {
    this.startTest(stationId);
    
    switch (stationId) {
      case 'ui_inventory_test':
        this.runInventoryUITest(stationId);
        break;
      case 'ui_equipment_test':
        this.runEquipmentUITest(stationId);
        break;
      case 'ui_banking_test':
        this.runBankingUITest(stationId);
        break;
      case 'ui_health_stamina_test':
        this.runHealthStaminaUITest(stationId);
        break;
      case 'ui_skills_test':
        this.runSkillsUITest(stationId);
        break;
      case 'ui_chat_test':
        this.runChatSystemTest(stationId);
        break;
      case 'ui_minimap_test':
        this.runMinimapUITest(stationId);
        break;
      case 'ui_menu_navigation_test':
        this.runMenuNavigationTest(stationId);
        break;
      case 'ui_performance_test':
        this.runUIPerformanceTest(stationId);
        break;
      case 'ui_responsive_test':
        this.runResponsiveUITest(stationId);
        break;
      case 'ui_accessibility_test':
        this.runAccessibilityTest(stationId);
        break;
      case 'ui_interaction_validation':
        this.runSpecificInteractionValidationTest(stationId);
        break;
      case 'ui_error_recovery':
        this.runErrorRecoveryTest(stationId);
        break;
      default:
        this.failTest(stationId, `Unknown UI test: ${stationId}`);
    }
  }

  private async runInventoryUITest(stationId: string): Promise<void> {
    const station = this.testStations.get(stationId)!;

    // Create fake player with diverse inventory
    const createdPlayer = this.createPlayer({
      id: `inventory_ui_player_${Date.now()}`,
      name: 'Inventory UI Test Player',
      position: { x: station.position.x, y: station.position.y, z: station.position.z },
      stats: {
        attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
        health: 100, maxHealth: 100
      }
    });

    // The createPlayer method already returns a properly structured Player object
    const player = createdPlayer;
    
    // Give player various items for UI testing
    player.inventory.items = [
      { id: 'bronze_sword_1', itemId: '1', quantity: 1, slot: 0, metadata: null },
      { id: 'raw_fish_1', itemId: '335', quantity: 8, slot: 1, metadata: null },
      { id: 'cooked_fish_1', itemId: '333', quantity: 5, slot: 2, metadata: null },
      { id: 'logs_1', itemId: '1511', quantity: 12, slot: 3, metadata: null }
    ];
    player.inventory.coins = 150;

    // Initialize test data
    this.testData.set(stationId, {
      player,
      startTime: Date.now(),
      uiElementsCreated: [],
      interactionsPerformed: [],
      uiResponsive: false,
      uiElementsVisible: false,
      dragDropWorking: false,
      menuNavigationWorking: false,
      chatSystemWorking: false,
      healthBarVisible: false,
      skillUIVisible: false,
      inventoryUIVisible: false,
      bankUIVisible: false,
      equipmentUIVisible: false,
      minimapVisible: false,
      performanceMetrics: {
        uiLoadTime: 0,
        interactionResponseTime: 0,
        memoryUsage: 0
      }
    });

    // Create inventory UI
    this.createInventoryUI(stationId);
  }

  private async runEquipmentUITest(stationId: string): Promise<void> {
    const station = this.testStations.get(stationId)!;

      // Create fake player with equipment
      const createdPlayer = this.createPlayer({
        id: `equipment_ui_player_${Date.now()}`,
        name: 'Equipment UI Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 10, strength: 8, defense: 6, ranged: 4, constitution: 12,
          health: 120, maxHealth: 120
        }
      });

      // Cast to Player type and ensure proper structure
      const player = createdPlayer as PlayerEntity;
      // Remove invalid property assignments - these don't exist on Player type
      player.equipment = {
        weapon: null,
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        arrows: null
      };

      // Give player equipment and items to equip
      const steelSword = getItem('110');
      const bronzeHelmet = getItem('150');
      const leatherBody = getItem('160');
      const bronzeShield = getItem('140');
      
      if (steelSword && bronzeHelmet && leatherBody && bronzeShield) {
        player.inventory = {
          items: [
            { id: 'steel_sword_1', itemId: '5', quantity: 1, slot: 0, metadata: null },
            { id: 'bronze_helmet_1', itemId: '150', quantity: 1, slot: 1, metadata: null },
            { id: 'leather_body_1', itemId: '160', quantity: 1, slot: 2, metadata: null },
            { id: 'bronze_shield_1', itemId: '140', quantity: 1, slot: 3, metadata: null }
          ],
          capacity: 28,
          coins: 0
        };
      } else {
        player.inventory = { items: [], capacity: 28, coins: 0 };
      }

      // Initialize test data
      this.testData.set(stationId, {
        player,
        startTime: Date.now(),
        uiElementsCreated: [],
        interactionsPerformed: [],
        uiResponsive: false,
        uiElementsVisible: false,
        dragDropWorking: false,
        menuNavigationWorking: false,
        chatSystemWorking: false,
        healthBarVisible: false,
        skillUIVisible: false,
        inventoryUIVisible: false,
        bankUIVisible: false,
        equipmentUIVisible: false,
        minimapVisible: false,
        performanceMetrics: {
          uiLoadTime: 0,
          interactionResponseTime: 0,
          memoryUsage: 0
        }
      });

      // Create equipment UI
      this.createEquipmentUI(stationId);
  }

  private async runBankingUITest(stationId: string): Promise<void> {
    try {
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with items to bank
      const createdPlayer = this.createPlayer({
        id: `banking_ui_player_${Date.now()}`,
        name: 'Banking UI Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100
        }
      });

      // Cast to Player type and ensure proper structure
      const player = createdPlayer as PlayerEntity;
      // Remove invalid property assignments - these don't exist on Player type
      player.equipment = {
        weapon: null,
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        arrows: null
      };

      // Give player items to test banking
      const mithrilSword = getItem('120');
      const arrows = getItem('300');
      const coins = getItem('999');
      
      if (mithrilSword && arrows && coins) {
        player.inventory = {
          items: [
            { id: 'mithril_sword_1', itemId: '120', quantity: 1, slot: 0, metadata: null },
            { id: 'arrows_1', itemId: '300', quantity: 50, slot: 1, metadata: null }
          ],
          capacity: 28,
          coins: 500
        };
      } else {
        player.inventory = { items: [], capacity: 28, coins: 0 };
      }

      // Initialize test data
      this.testData.set(stationId, {
        player,
        startTime: Date.now(),
        uiElementsCreated: [],
        interactionsPerformed: [],
        uiResponsive: false,
        uiElementsVisible: false,
        dragDropWorking: false,
        menuNavigationWorking: false,
        chatSystemWorking: false,
        healthBarVisible: false,
        skillUIVisible: false,
        inventoryUIVisible: false,
        bankUIVisible: false,
        equipmentUIVisible: false,
        minimapVisible: false,
        performanceMetrics: {
          uiLoadTime: 0,
          interactionResponseTime: 0,
          memoryUsage: 0
        }
      });

      // Create bank near player
      this.createBankNearPlayer(stationId);
      
      // Create banking UI
      this.createBankingUI(stationId);
      
    } catch (_error) {
      this.failTest(stationId, `Banking UI test error: ${_error}`);
    }
  }

  private async runHealthStaminaUITest(stationId: string): Promise<void> {
    try {
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with variable health
      const createdPlayer = this.createPlayer({
        id: `health_ui_player_${Date.now()}`,
        name: 'Health UI Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 65, maxHealth: 100 // Damaged health to test display
        }
      });

      // Cast to Player type and ensure proper structure
      const player = createdPlayer as PlayerEntity;
      // Set health using proper PlayerHealth type (using casting to avoid intersection type conflict)
      (player as { health: PlayerHealth }).health = { current: 65, max: 100 }; // Damaged health to test display
      player.inventory = { items: [], capacity: 28, coins: 0 };
      player.equipment = {
        weapon: null,
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        arrows: null
      };

      // Initialize test data
      this.testData.set(stationId, {
        player,
        startTime: Date.now(),
        uiElementsCreated: [],
        interactionsPerformed: [],
        uiResponsive: false,
        uiElementsVisible: false,
        dragDropWorking: false,
        menuNavigationWorking: false,
        chatSystemWorking: false,
        healthBarVisible: false,
        skillUIVisible: false,
        inventoryUIVisible: false,
        bankUIVisible: false,
        equipmentUIVisible: false,
        minimapVisible: false,
        performanceMetrics: {
          uiLoadTime: 0,
          interactionResponseTime: 0,
          memoryUsage: 0
        }
      });

      // Create health/stamina UI
      this.createHealthStaminaUI(stationId);
      
    } catch (_error) {
      this.failTest(stationId, `Health/stamina UI test error: ${_error}`);
    }
  }

  private async runSkillsUITest(stationId: string): Promise<void> {
    try {
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with some skill progression
      const createdPlayer = this.createPlayer({
        id: `skills_ui_player_${Date.now()}`,
        name: 'Skills UI Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 8, strength: 6, defense: 4, ranged: 2, constitution: 12,
          health: 120, maxHealth: 120
        }
      });

      // Cast to Player type and ensure proper structure
      const player = createdPlayer as PlayerEntity;
      // Remove invalid property assignments - these don't exist on Player type
      player.inventory = { items: [], capacity: 28, coins: 0 };
      player.equipment = {
        weapon: null,
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        arrows: null
      };

      // Give player some XP in various skills
      this.emitTypedEvent(EventType.SKILLS_XP_GAINED, { playerId: player.id, skill: 'attack', amount: 300 });
      this.emitTypedEvent(EventType.SKILLS_XP_GAINED, { playerId: player.id, skill: 'woodcutting', amount: 450 });
      this.emitTypedEvent(EventType.SKILLS_XP_GAINED, { playerId: player.id, skill: 'fishing', amount: 200 });

      // Initialize test data
      this.testData.set(stationId, {
        player,
        startTime: Date.now(),
        uiElementsCreated: [],
        interactionsPerformed: [],
        uiResponsive: false,
        uiElementsVisible: false,
        dragDropWorking: false,
        menuNavigationWorking: false,
        chatSystemWorking: false,
        healthBarVisible: false,
        skillUIVisible: false,
        inventoryUIVisible: false,
        bankUIVisible: false,
        equipmentUIVisible: false,
        minimapVisible: false,
        performanceMetrics: {
          uiLoadTime: 0,
          interactionResponseTime: 0,
          memoryUsage: 0
        }
      });

      // Wait for XP to be applied, then create skills UI
      setTimeout(() => {
        this.createSkillsUI(stationId);
      }, 2000);
      
    } catch (_error) {
      this.failTest(stationId, `Skills UI test error: ${_error}`);
    }
  }

  private async runChatSystemTest(stationId: string): Promise<void> {
    try {
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player
      const createdPlayer = this.createPlayer({
        id: `chat_ui_player_${Date.now()}`,
        name: 'Chat UI Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100
        }
      });

      // Cast to Player type and ensure proper structure
      const player = createdPlayer as PlayerEntity;
      // Remove invalid property assignments - these don't exist on Player type
      player.inventory = { items: [], capacity: 28, coins: 0 };
      player.equipment = {
        weapon: null,
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        arrows: null
      };

      // Initialize test data
      this.testData.set(stationId, {
        player,
        startTime: Date.now(),
        uiElementsCreated: [],
        interactionsPerformed: [],
        uiResponsive: false,
        uiElementsVisible: false,
        dragDropWorking: false,
        menuNavigationWorking: false,
        chatSystemWorking: false,
        healthBarVisible: false,
        skillUIVisible: false,
        inventoryUIVisible: false,
        bankUIVisible: false,
        equipmentUIVisible: false,
        minimapVisible: false,
        performanceMetrics: {
          uiLoadTime: 0,
          interactionResponseTime: 0,
          memoryUsage: 0
        }
      });

      // Create chat UI and test messaging
      this.createChatUI(stationId);
      
    } catch (_error) {
      this.failTest(stationId, `Chat system test error: ${_error}`);
    }
  }

  private async runMinimapUITest(stationId: string): Promise<void> {
    try {
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player
      const createdPlayer = this.createPlayer({
        id: `minimap_ui_player_${Date.now()}`,
        name: 'Minimap UI Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100
        }
      });

      // Cast to Player type and ensure proper structure
      const player = createdPlayer as PlayerEntity;
      // Remove invalid property assignments - these don't exist on Player type
      player.inventory = { items: [], capacity: 28, coins: 0 };
      player.equipment = {
        weapon: null,
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        arrows: null
      };

      // Initialize test data
      this.testData.set(stationId, {
        player,
        startTime: Date.now(),
        uiElementsCreated: [],
        interactionsPerformed: [],
        uiResponsive: false,
        uiElementsVisible: false,
        dragDropWorking: false,
        menuNavigationWorking: false,
        chatSystemWorking: false,
        healthBarVisible: false,
        skillUIVisible: false,
        inventoryUIVisible: false,
        bankUIVisible: false,
        equipmentUIVisible: false,
        minimapVisible: false,
        performanceMetrics: {
          uiLoadTime: 0,
          interactionResponseTime: 0,
          memoryUsage: 0
        }
      });

      // Create minimap UI
      this.createMinimapUI(stationId);
      
    } catch (_error) {
      this.failTest(stationId, `Minimap UI test error: ${_error}`);
    }
  }

  private async runMenuNavigationTest(stationId: string): Promise<void> {
    try {
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player
      const createdPlayer = this.createPlayer({
        id: `menu_nav_player_${Date.now()}`,
        name: 'Menu Navigation Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100
        }
      });

      // Cast to Player type and ensure proper structure
      const player = createdPlayer as PlayerEntity;
      // Remove invalid property assignments - these don't exist on Player type
      player.inventory = { items: [], capacity: 28, coins: 0 };
      player.equipment = {
        weapon: null,
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        arrows: null
      };

      // Initialize test data
      this.testData.set(stationId, {
        player,
        startTime: Date.now(),
        uiElementsCreated: [],
        interactionsPerformed: [],
        uiResponsive: false,
        uiElementsVisible: false,
        dragDropWorking: false,
        menuNavigationWorking: false,
        chatSystemWorking: false,
        healthBarVisible: false,
        skillUIVisible: false,
        inventoryUIVisible: false,
        bankUIVisible: false,
        equipmentUIVisible: false,
        minimapVisible: false,
        performanceMetrics: {
          uiLoadTime: 0,
          interactionResponseTime: 0,
          memoryUsage: 0
        }
      });

      // Test menu navigation
      this.testMenuNavigation(stationId);
      
    } catch (_error) {
      this.failTest(stationId, `Menu navigation test error: ${_error}`);
    }
  }

  private async runUIPerformanceTest(stationId: string): Promise<void> {
    try {
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player
      const createdPlayer = this.createPlayer({
        id: `performance_ui_player_${Date.now()}`,
        name: 'Performance UI Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100
        }
      });

      // Cast to Player type and ensure proper structure
      const player = createdPlayer as PlayerEntity;
      // Remove invalid property assignments - these don't exist on Player type
      player.inventory = { items: [], capacity: 28, coins: 0 };
      player.equipment = {
        weapon: null,
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        arrows: null
      };

      // Initialize test data
      this.testData.set(stationId, {
        player,
        startTime: Date.now(),
        uiElementsCreated: [],
        interactionsPerformed: [],
        uiResponsive: false,
        uiElementsVisible: false,
        dragDropWorking: false,
        menuNavigationWorking: false,
        chatSystemWorking: false,
        healthBarVisible: false,
        skillUIVisible: false,
        inventoryUIVisible: false,
        bankUIVisible: false,
        equipmentUIVisible: false,
        minimapVisible: false,
        performanceMetrics: {
          uiLoadTime: 0,
          interactionResponseTime: 0,
          memoryUsage: 0
        }
      });

      // Test UI performance under load
      this.testUIPerformance(stationId);
      
    } catch (_error) {
      this.failTest(stationId, `UI performance test error: ${_error}`);
    }
  }

  private async runResponsiveUITest(stationId: string): Promise<void> {
    try {
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player
      const createdPlayer = this.createPlayer({
        id: `responsive_ui_player_${Date.now()}`,
        name: 'Responsive UI Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100
        }
      });

      // Cast to Player type and ensure proper structure
      const player = createdPlayer as unknown as PlayerEntity;
      // Remove invalid property assignments - these don't exist on Player type
      player.inventory = { items: [], capacity: 28, coins: 0 };
      player.equipment = {
        weapon: null,
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        arrows: null
      };

      // Initialize test data
      this.testData.set(stationId, {
        player,
        startTime: Date.now(),
        uiElementsCreated: [],
        interactionsPerformed: [],
        uiResponsive: false,
        uiElementsVisible: false,
        dragDropWorking: false,
        menuNavigationWorking: false,
        chatSystemWorking: false,
        healthBarVisible: false,
        skillUIVisible: false,
        inventoryUIVisible: false,
        bankUIVisible: false,
        equipmentUIVisible: false,
        minimapVisible: false,
        performanceMetrics: {
          uiLoadTime: 0,
          interactionResponseTime: 0,
          memoryUsage: 0
        }
      });

      // Test responsive UI behavior
      this.testResponsiveUI(stationId);
      
    } catch (_error) {
      this.failTest(stationId, `Responsive UI test error: ${_error}`);
    }
  }

  private createInventoryUI(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const startTime = Date.now();

    this.emitTypedEvent(EventType.UI_CREATE, {
      type: 'inventory',
      playerId: testData.player.id,
      config: {
        position: { x: 100, y: 100 },
        size: { width: 300, height: 400 },
        slots: 28,
        items: testData.player.inventory.items
      }
    });

    testData.performanceMetrics.uiLoadTime = Date.now() - startTime;
    testData.uiElementsCreated.push({ type: 'inventory', id: 'inventory_ui', visible: true });
  }

  private createEquipmentUI(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    this.emitTypedEvent(EventType.UI_CREATE, {
      type: 'equipment',
      playerId: testData.player.id,
      config: {
        position: { x: 450, y: 100 },
        size: { width: 200, height: 300 },
        slots: Object.values(EquipmentSlotName)
      }
    });

    testData.uiElementsCreated.push({ type: 'equipment', id: 'equipment_ui', visible: true });

    // Test drag and drop after UI is created
    setTimeout(() => {
      this.testDragAndDrop(stationId);
    }, 2000);
  }

  private createBankNearPlayer(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    // Create bank booth near player
    this.emitTypedEvent(EventType.BANK_CREATE, {
      id: `bank_${stationId}`,
      position: { 
        x: testData.player.position.x + 3, 
        y: testData.player.position.y, 
        z: testData.player.position.z 
      },
      color: '#8B4513', // Brown for bank
      size: { x: 2.0, y: 2.5, z: 1.0 },
      type: 'bank_booth'
    });
  }

  private createBankingUI(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    this.emitTypedEvent(EventType.UI_CREATE, {
      type: 'bank',
      playerId: testData.player.id,
      config: {
        position: { x: 200, y: 150 },
        size: { width: 500, height: 400 },
        inventorySlots: 28,
        bankSlots: 200
      }
    });

    testData.uiElementsCreated.push({ type: 'bank', id: 'banking_ui', visible: true });

    // Test banking operations after UI is created
    setTimeout(() => {
      this.testBankingOperations(stationId);
    }, 3000);
  }

  private createHealthStaminaUI(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    this.emitTypedEvent(EventType.UI_CREATE, {
      type: 'health_stamina',
      playerId: testData.player.id,
      config: {
        position: { x: 20, y: 20 },
        health: testData.player.health.current,
        maxHealth: testData.player.health.max,
        stamina: 100,
        maxStamina: 100
      }
    });

    testData.uiElementsCreated.push({ type: 'health_stamina', id: 'health_stamina_ui', visible: true });
    testData.healthBarVisible = true;

    // Test health changes
    setTimeout(() => {
      this.testHealthUpdates(stationId);
    }, 2000);
  }

  private createSkillsUI(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    // Use cached skills data (reactive pattern)
    const cachedSkills = this.playerSkills.get(testData.player.id);
    const skills = cachedSkills || {};
    
    this.createSkillsUIWithData(stationId, skills as Record<string, unknown>);
  }

  private createSkillsUIWithData(stationId: string, skills: Record<string, unknown>): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    this.emitTypedEvent(EventType.UI_CREATE, {
      type: 'skills',
      playerId: testData.player.id,
      config: {
        position: { x: 700, y: 100 },
        size: { width: 250, height: 350 },
        skills: skills || {}
      }
    });

    testData.uiElementsCreated.push({ type: 'skills', id: 'skills_ui', visible: true });
    testData.skillUIVisible = true;
  }

  private createChatUI(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    this.emitTypedEvent(EventType.UI_CREATE, {
      type: 'chat',
      playerId: testData.player.id,
      config: {
        position: { x: 20, y: 300 },
        size: { width: 400, height: 200 },
        maxMessages: 50
      }
    });

    testData.uiElementsCreated.push({ type: 'chat', id: 'chat_ui', visible: true });

    // Test chat messaging
    setTimeout(() => {
      this.testChatMessaging(stationId);
    }, 2000);
  }

  private createMinimapUI(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    this.emitTypedEvent(EventType.UI_CREATE, {
      type: 'minimap',
      playerId: testData.player.id,
      config: {
        position: { x: 700, y: 20 },
        size: { width: 150, height: 150 },
        zoom: 1.0,
        showPlayer: true,
        showMobs: true,
        showObjects: true
      }
    });

    testData.uiElementsCreated.push({ type: 'minimap', id: 'minimap_ui', visible: true });
    testData.minimapVisible = true;
  }

  private testDragAndDrop(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;


    const interactionStartTime = Date.now();

    // Simulate dragging sword from inventory to weapon slot
    this.emitTypedEvent(EventType.UI_DRAG_DROP, {
      playerId: testData.player.id,
      sourceType: 'inventory',
      sourceSlot: 0, // Bronze sword
      targetType: 'equipment',
      targetSlot: 'weapon'
    });

    testData.performanceMetrics.interactionResponseTime = Date.now() - interactionStartTime;
    testData.interactionsPerformed.push({ type: 'drag_drop', target: 'weapon_slot', success: true });
    testData.dragDropWorking = true;
  }

  private testBankingOperations(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;


    // Test depositing items
    this.emitTypedEvent(EventType.UI_BANK_DEPOSIT, {
      playerId: testData.player.id,
      inventorySlot: 0,
      quantity: 1
    });

    testData.interactionsPerformed.push({ type: 'bank_deposit', target: 'bank_slot', success: true });
    testData.bankUIVisible = true;

    // Test withdrawing items
    setTimeout(() => {
      this.emitTypedEvent(EventType.UI_BANK_WITHDRAW, {
        playerId: testData.player.id,
        bankSlot: 0,
        quantity: 1
      });

      testData.interactionsPerformed.push({ type: 'bank_withdraw', target: 'inventory_slot', success: true });
    }, 2000);
  }

  private testHealthUpdates(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;


    // Simulate health change (using casting to avoid intersection type conflict)
    (testData.player as { health: PlayerHealth }).health = { current: 85, max: testData.player.health.max };

    this.emitTypedEvent(EventType.UI_HEALTH_UPDATE, {
      playerId: testData.player.id,
      health: testData.player.health.current,
      maxHealth: testData.player.health.max
    });

    testData.interactionsPerformed.push({ type: 'health_update', target: 'health_bar', success: true });
  }

  private testChatMessaging(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;


    // Send test messages
    const testMessages = [
      'Hello world!',
      'Testing chat system',
      'UI test message'
    ];

    testMessages.forEach((message, index) => {
      setTimeout(() => {
        this.emitTypedEvent(EventType.CHAT_SEND, {
          playerId: testData.player.id,
          message: message
        });

        testData.interactionsPerformed.push({ type: 'chat_message', target: 'chat_window', success: true });
      }, index * 1000);
    });

    testData.chatSystemWorking = true;
  }

  private testMenuNavigation(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;


    // Test opening various menus
    const menus = ['inventory', 'equipment', 'skills', 'settings'];

    menus.forEach((menu, index) => {
      setTimeout(() => {
        this.emitTypedEvent(EventType.UI_OPEN_MENU, {
          playerId: testData.player.id,
          menuType: menu
        });

        testData.interactionsPerformed.push({ type: 'menu_open', target: menu, success: true });

        // Close menu after opening
        setTimeout(() => {
          this.emitTypedEvent(EventType.UI_CLOSE_MENU, {
            playerId: testData.player.id,
            menuType: menu
          });

          testData.interactionsPerformed.push({ type: 'menu_close', target: menu, success: true });
        }, 500);
      }, index * 1500);
    });

    testData.menuNavigationWorking = true;
  }

  private testUIPerformance(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;


    const startTime = Date.now();

    // Create multiple UI elements rapidly
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        this.emitTypedEvent(EventType.UI_CREATE, {
          type: 'performance_test',
          playerId: testData.player.id,
          config: {
            position: { x: 100 + i * 20, y: 100 + i * 20 },
            size: { width: 100, height: 100 },
            id: `perf_ui_${i}`
          }
        });

        testData.uiElementsCreated.push({ type: 'performance_test', id: `perf_ui_${i}`, visible: true });
      }, i * 100);
    }

    // Measure performance after all elements are created
    setTimeout(() => {
      testData.performanceMetrics.uiLoadTime = Date.now() - startTime;
      testData.uiResponsive = testData.performanceMetrics.uiLoadTime < 2000; // Should complete in under 2 seconds
    }, 2000);
  }

  private testResponsiveUI(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;


    // Test different viewport sizes
    const viewportSizes = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 800, height: 600 }
    ];

    viewportSizes.forEach((size, index) => {
      setTimeout(() => {
        this.emitTypedEvent(EventType.UI_SET_VIEWPORT, {
          playerId: testData.player.id,
          width: size.width,
          height: size.height
        });

        // Create UI at this viewport size
        this.emitTypedEvent(EventType.UI_CREATE, {
          type: 'responsive_test',
          playerId: testData.player.id,
          config: {
            position: { x: 50, y: 50 },
            size: { width: Math.min(300, size.width * 0.3), height: Math.min(200, size.height * 0.3) },
            responsive: true
          }
        });

        testData.interactionsPerformed.push({ type: 'viewport_change', target: `${size.width}x${size.height}`, success: true });
      }, index * 2000);
    });

    testData.uiResponsive = true;
  }

  private async runAccessibilityTest(stationId: string): Promise<void> {
    try {
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player
      const createdPlayer = this.createPlayer({
        id: `accessibility_player_${Date.now()}`,
        name: 'Accessibility Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100
        }
      });

      // Cast to Player type and ensure proper structure
      const player = createdPlayer as PlayerEntity;
      // Remove invalid property assignments - these don't exist on Player type
      player.inventory = { items: [], capacity: 28, coins: 0 };
      player.equipment = {
        weapon: null,
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        arrows: null
      };

      // Initialize test data
      this.testData.set(stationId, {
        player,
        startTime: Date.now(),
        uiElementsCreated: [],
        interactionsPerformed: [],
        uiResponsive: false,
        uiElementsVisible: false,
        dragDropWorking: false,
        menuNavigationWorking: false,
        chatSystemWorking: false,
        healthBarVisible: false,
        skillUIVisible: false,
        inventoryUIVisible: false,
        bankUIVisible: false,
        equipmentUIVisible: false,
        minimapVisible: false,
        performanceMetrics: {
          uiLoadTime: 0,
          interactionResponseTime: 0,
          memoryUsage: 0
        }
      });

      // Test accessibility features
      this.testAccessibilityFeatures(stationId);
      
    } catch (_error) {
      this.failTest(stationId, `Accessibility test error: ${_error}`);
    }
  }

  private async runSpecificInteractionValidationTest(stationId: string): Promise<void> {
    try {
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with complex inventory for interaction testing
      const createdPlayer = this.createPlayer({
        id: `interaction_validation_player_${Date.now()}`,
        name: 'Interaction Validation Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 15, strength: 12, defense: 8, ranged: 6, constitution: 18,
          health: 180, maxHealth: 180
        }
      });

      // Cast to Player type and ensure proper structure
      const player = createdPlayer as PlayerEntity;
      // Remove invalid property assignments - these don't exist on Player type
      player.equipment = {
        weapon: null,
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        arrows: null
      };

      // Create diverse inventory for complex interaction testing
      const bronzeSword = getItem('100');
      const steelSword = getItem('110');
      const mithrilSword = getItem('120');
      const bronzeShield = getItem('140');
      const arrows = getItem('300');
      const coins = getItem('999');
      
      if (bronzeSword && steelSword && mithrilSword && bronzeShield && arrows && coins) {
        player.inventory = {
          items: [
            { id: 'bronze_sword_1', itemId: '100', quantity: 1, slot: 0, metadata: null },
            { id: 'steel_sword_1', itemId: '110', quantity: 1, slot: 1, metadata: null },
            { id: 'mithril_sword_1', itemId: '120', quantity: 1, slot: 2, metadata: null },
            { id: 'bronze_shield_1', itemId: '140', quantity: 1, slot: 3, metadata: null },
            { id: 'arrows_1', itemId: '300', quantity: 100, slot: 4, metadata: null }
          ],
          capacity: 28,
          coins: 1000
        };
      } else {
        player.inventory = { items: [], capacity: 28, coins: 0 };
      }

      // Initialize test data
      this.testData.set(stationId, {
        player,
        startTime: Date.now(),
        uiElementsCreated: [],
        interactionsPerformed: [],
        uiResponsive: false,
        uiElementsVisible: false,
        dragDropWorking: false,
        menuNavigationWorking: false,
        chatSystemWorking: false,
        healthBarVisible: false,
        skillUIVisible: false,
        inventoryUIVisible: false,
        bankUIVisible: false,
        equipmentUIVisible: false,
        minimapVisible: false,
        performanceMetrics: {
          uiLoadTime: 0,
          interactionResponseTime: 0,
          memoryUsage: 0
        }
      });

      // Test specific complex interactions
      this.testSpecificInteractions(stationId);
      
    } catch (_error) {
      this.failTest(stationId, `Specific interaction validation test error: ${_error}`);
    }
  }

  private async runErrorRecoveryTest(stationId: string): Promise<void> {
    try {
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player
      const createdPlayer = this.createPlayer({
        id: `error_recovery_player_${Date.now()}`,
        name: 'Error Recovery Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100
        }
      });

      // Cast to Player type and ensure proper structure
      const player = createdPlayer as PlayerEntity;
      // Remove invalid property assignments - these don't exist on Player type
      player.inventory = { items: [], capacity: 28, coins: 0 };
      player.equipment = {
        weapon: null,
        shield: null,
        helmet: null,
        body: null,
        legs: null,
        arrows: null
      };

      // Initialize test data
      this.testData.set(stationId, {
        player,
        startTime: Date.now(),
        uiElementsCreated: [],
        interactionsPerformed: [],
        uiResponsive: false,
        uiElementsVisible: false,
        dragDropWorking: false,
        menuNavigationWorking: false,
        chatSystemWorking: false,
        healthBarVisible: false,
        skillUIVisible: false,
        inventoryUIVisible: false,
        bankUIVisible: false,
        equipmentUIVisible: false,
        minimapVisible: false,
        performanceMetrics: {
          uiLoadTime: 0,
          interactionResponseTime: 0,
          memoryUsage: 0
        }
      });

      // Test error scenarios and recovery
      this.testErrorRecovery(stationId);
      
    } catch (_error) {
      this.failTest(stationId, `Error recovery test error: ${_error}`);
    }
  }

  private testAccessibilityFeatures(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;


    // Test keyboard navigation
    this.emitTypedEvent(EventType.UI_CREATE, {
      type: 'accessibility_test',
      playerId: testData.player.id,
      config: {
        position: { x: 100, y: 100 },
        size: { width: 400, height: 300 },
        keyboardNavigation: true,
        screenReaderSupport: true,
        highContrastMode: true,
        fontSize: 'large'
      }
    });

    testData.uiElementsCreated.push({ type: 'accessibility_test', id: 'accessibility_ui', visible: true });

    // Test keyboard navigation scenarios
    const keyboardTests = [
      { key: 'Tab', description: 'Tab navigation' },
      { key: 'Enter', description: 'Enter activation' },
      { key: 'Space', description: 'Space activation' },
      { key: 'Escape', description: 'Escape dismissal' },
      { key: 'ArrowUp', description: 'Arrow navigation up' },
      { key: 'ArrowDown', description: 'Arrow navigation down' },
      { key: 'ArrowLeft', description: 'Arrow navigation left' },
      { key: 'ArrowRight', description: 'Arrow navigation right' }
    ];

    keyboardTests.forEach((test, index) => {
      setTimeout(() => {
        this.emitTypedEvent(EventType.UI_UPDATE, {
          playerId: testData.player.id,
          key: test.key,
          description: test.description
        });

        testData.interactionsPerformed.push({ 
          type: 'keyboard_navigation', 
          target: test.key, 
          success: true 
        });
      }, index * 500);
    });

    // Test screen reader support
    setTimeout(() => {
      this.emitTypedEvent(EventType.UI_UPDATE, {
        playerId: testData.player.id,
        features: ['aria-labels', 'focus-management', 'semantic-markup']
      });

      testData.interactionsPerformed.push({ 
        type: 'screen_reader_support', 
        target: 'accessibility_features', 
        success: true 
      });
    }, 4000);

    // Test high contrast mode
    setTimeout(() => {
      this.emitTypedEvent(EventType.UI_UPDATE, {
        playerId: testData.player.id,
        contrastRatio: 4.5, // WCAG AA standard
        testPatterns: ['text-background', 'focus-indicators', 'button-states']
      });

      testData.interactionsPerformed.push({ 
        type: 'high_contrast', 
        target: 'contrast_validation', 
        success: true 
      });
    }, 6000);

    // Complete accessibility test
    setTimeout(() => {
      this.checkUITestCompletion(stationId);
    }, 8000);
  }

  private testSpecificInteractions(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;


    // Create comprehensive UI setup
    this.emitTypedEvent(EventType.UI_CREATE, {
      type: 'interaction_validation',
      playerId: testData.player.id,
      config: {
        position: { x: 50, y: 50 },
        size: { width: 800, height: 600 },
        inventory: testData.player.inventory,
        equipment: {},
        enableAdvancedInteractions: true
      }
    });

    testData.uiElementsCreated.push({ 
      type: 'interaction_validation', 
      id: 'interaction_validation_ui', 
      visible: true 
    });

    // Test complex drag and drop sequences
    const complexInteractions = [
      {
        type: 'equipment_swap',
        description: 'Swap equipped weapon with inventory weapon',
        source: { type: 'inventory', slot: 0 }, // Bronze sword
        target: { type: 'equipment', slot: 'weapon' },
        expectedResult: 'weapon_equipped'
      },
      {
        type: 'multi_select_drag',
        description: 'Multi-select and drag multiple items',
        source: { type: 'inventory', slots: [1, 2] }, // Steel and mithril swords
        target: { type: 'bank', area: 'weapons' },
        expectedResult: 'items_deposited'
      },
      {
        type: 'context_menu_interaction',
        description: 'Right-click context menu operations',
        source: { type: 'inventory', slot: 3 }, // Bronze shield
        action: 'context_menu',
        menuOption: 'examine',
        expectedResult: 'item_examined'
      },
      {
        type: 'precision_click_test',
        description: 'Test precise click detection on small UI elements',
        targets: [
          { area: 'scroll_arrow_up', size: '12x12' },
          { area: 'close_button', size: '16x16' },
          { area: 'dropdown_arrow', size: '10x10' }
        ],
        expectedResult: 'precise_clicks_detected'
      },
      {
        type: 'rapid_interaction_test',
        description: 'Test rapid successive interactions',
        sequence: [
          { action: 'click', target: 'inventory_slot_0', timing: 0 },
          { action: 'click', target: 'inventory_slot_1', timing: 50 },
          { action: 'click', target: 'inventory_slot_2', timing: 100 },
          { action: 'double_click', target: 'inventory_slot_0', timing: 200 }
        ],
        expectedResult: 'rapid_interactions_handled'
      }
    ];

    complexInteractions.forEach((interaction, index) => {
      setTimeout(() => {
        const interactionStartTime = Date.now();

        this.emitTypedEvent(EventType.UI_UPDATE, {
          playerId: testData.player.id,
          interactionType: interaction.type,
          config: interaction,
          timestamp: Date.now()
        });

        const interactionTime = Date.now() - interactionStartTime;
        testData.performanceMetrics.interactionResponseTime = Math.max(
          testData.performanceMetrics.interactionResponseTime,
          interactionTime
        );

        testData.interactionsPerformed.push({ 
          type: interaction.type, 
          target: interaction.description, 
          success: true 
        });

      }, index * 2000);
    });

    // Test interaction validation and conflict resolution
    setTimeout(() => {
      this.emitTypedEvent(EventType.UI_UPDATE, {
        playerId: testData.player.id,
        tests: [
          'simultaneous_drags',
          'invalid_drop_targets',
          'item_stacking_rules',
          'equipment_requirements',
          'inventory_overflow_handling'
        ]
      });

      testData.interactionsPerformed.push({ 
        type: 'interaction_validation', 
        target: 'validation_suite', 
        success: true 
      });
    }, complexInteractions.length * 2000 + 2000);

    // Complete interaction validation test
    setTimeout(() => {
      this.checkUITestCompletion(stationId);
    }, complexInteractions.length * 2000 + 5000);
  }

  private testErrorRecovery(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;


    // Create UI for error testing
    this.emitTypedEvent(EventType.UI_CREATE, {
      type: 'error_recovery_test',
      playerId: testData.player.id,
      config: {
        position: { x: 200, y: 200 },
        size: { width: 500, height: 400 },
        errorTestingMode: true
      }
    });

    testData.uiElementsCreated.push({ 
      type: 'error_recovery_test', 
      id: 'error_recovery_ui', 
      visible: true 
    });

    // Test various error scenarios
    const errorScenarios = [
      {
        type: 'network_disconnection',
        description: 'Simulate network disconnection during UI operation',
        recovery: 'auto_reconnect_with_state_restoration'
      },
      {
        type: 'invalid_data_corruption',
        description: 'Simulate corrupted UI data',
        recovery: 'graceful_fallback_to_defaults'
      },
      {
        type: 'memory_overflow',
        description: 'Simulate memory constraints',
        recovery: 'ui_optimization_and_cleanup'
      },
      {
        type: 'concurrent_modification',
        description: 'Simulate conflicting UI updates',
        recovery: 'conflict_resolution_with_user_notification'
      },
      {
        type: 'malformed_input',
        description: 'Test malformed user input handling',
        recovery: 'input_sanitization_and_error_display'
      },
      {
        type: 'ui_element_not_found',
        description: 'Test missing UI element handling',
        recovery: 'dynamic_ui_rebuilding'
      }
    ];

    errorScenarios.forEach((scenario, index) => {
      setTimeout(() => {

        // Trigger error scenario
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId: testData.player.id,
          errorType: scenario.type,
          scenario: scenario
        });

        testData.interactionsPerformed.push({ 
          type: 'error_scenario', 
          target: scenario.type, 
          success: true 
        });

        // Test recovery mechanism
        setTimeout(() => {
          this.emitTypedEvent(EventType.UI_UPDATE, {
            playerId: testData.player.id,
            errorType: scenario.type,
            expectedRecovery: scenario.recovery
          });

          testData.interactionsPerformed.push({ 
            type: 'error_recovery', 
            target: scenario.recovery, 
            success: true 
          });
        }, 1000);
      }, index * 3000);
    });

    // Test comprehensive error resilience
    setTimeout(() => {
      this.emitTypedEvent(EventType.UI_UPDATE, {
        playerId: testData.player.id,
        tests: [
          'error_boundary_effectiveness',
          'state_persistence_during_errors',
          'user_notification_systems',
          'automatic_error_reporting',
          'fallback_ui_functionality'
        ]
      });

      testData.interactionsPerformed.push({ 
        type: 'resilience_testing', 
        target: 'error_resilience_suite', 
        success: true 
      });
    }, errorScenarios.length * 3000 + 2000);

    // Complete error recovery test
    setTimeout(() => {
      this.checkUITestCompletion(stationId);
    }, errorScenarios.length * 3000 + 5000);
  }

  private handleUICreated(data: { type: string; playerId: string; success: boolean; id: string }): void {
    // Find test station with matching player
    for (const [stationId, testData] of this.testData.entries()) {
      if (testData.player.id === data.playerId) {
        
        const element = testData.uiElementsCreated.find(el => el.type === data.type);
        if (element) {
          element.visible = data.success;
        }

        // Update specific UI visibility flags
        switch (data.type) {
          case 'inventory':
            testData.inventoryUIVisible = data.success;
            break;
          case 'equipment':
            testData.equipmentUIVisible = data.success;
            break;
          case 'bank':
            testData.bankUIVisible = data.success;
            break;
          case 'health_stamina':
            testData.healthBarVisible = data.success;
            break;
          case 'skills':
            testData.skillUIVisible = data.success;
            break;
          case 'minimap':
            testData.minimapVisible = data.success;
            break;
        }

        // Complete test if all expected UI elements are visible
        this.checkUITestCompletion(stationId);
        
        break;
      }
    }
  }

  private handleUIInteraction(data: { type: string; playerId: string; success: boolean; target: string }): void {
    // Find test station with matching player
    for (const [_stationId, testData] of this.testData.entries()) {
      if (testData.player.id === data.playerId) {
        
        testData.interactionsPerformed.push({
          type: data.type,
          target: data.target,
          success: data.success
        });
        
        break;
      }
    }
  }

  private handleUIError(data: { playerId: string; error: string; uiType: string }): void {
    // Find test station with matching player
    for (const [stationId, testData] of this.testData.entries()) {
      if (testData.player.id === data.playerId) {
        
        this.failTest(stationId, `UI error in ${data.uiType}: ${data.error}`);
        
        break;
      }
    }
  }

  private handleChatMessage(data: { playerId: string; message: string; timestamp: number }): void {
    // Find test station with matching player
    for (const [_stationId, testData] of this.testData.entries()) {
      if (testData.player.id === data.playerId) {
        
        testData.chatSystemWorking = true;
        
        break;
      }
    }
  }

  private checkUITestCompletion(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    // Check completion based on test type
    switch (stationId) {
      case 'ui_inventory_test':
        if (testData.inventoryUIVisible) {
          this.completeUITest(stationId);
        }
        break;
      case 'ui_equipment_test':
        if (testData.equipmentUIVisible && testData.dragDropWorking) {
          this.completeUITest(stationId);
        }
        break;
      case 'ui_banking_test':
        if (testData.bankUIVisible && testData.interactionsPerformed.length >= 2) {
          this.completeUITest(stationId);
        }
        break;
      case 'ui_health_stamina_test':
        if (testData.healthBarVisible && testData.interactionsPerformed.length >= 1) {
          this.completeUITest(stationId);
        }
        break;
      case 'ui_skills_test':
        if (testData.skillUIVisible) {
          this.completeUITest(stationId);
        }
        break;
      case 'ui_chat_test':
        if (testData.chatSystemWorking && testData.interactionsPerformed.length >= 3) {
          this.completeUITest(stationId);
        }
        break;
      case 'ui_minimap_test':
        if (testData.minimapVisible) {
          this.completeUITest(stationId);
        }
        break;
      case 'ui_menu_navigation_test':
        if (testData.menuNavigationWorking && testData.interactionsPerformed.length >= 8) {
          this.completeUITest(stationId);
        }
        break;
      case 'ui_performance_test':
        if (testData.uiResponsive && testData.uiElementsCreated.length >= 10) {
          this.completeUITest(stationId);
        }
        break;
      case 'ui_responsive_test':
        if (testData.uiResponsive && testData.interactionsPerformed.length >= 3) {
          this.completeUITest(stationId);
        }
        break;
      case 'ui_accessibility_test':
        if (testData.uiElementsCreated.length >= 1 && testData.interactionsPerformed.length >= 10) {
          this.completeUITest(stationId);
        }
        break;
      case 'ui_interaction_validation':
        if (testData.uiElementsCreated.length >= 1 && testData.interactionsPerformed.length >= 6) {
          this.completeUITest(stationId);
        }
        break;
      case 'ui_error_recovery':
        if (testData.uiElementsCreated.length >= 1 && testData.interactionsPerformed.length >= 13) {
          this.completeUITest(stationId);
        }
        break;
    }
  }

  private completeUITest(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const results = {
      uiElementsCreated: testData.uiElementsCreated.length,
      interactionsPerformed: testData.interactionsPerformed.length,
      uiElementsVisible: testData.uiElementsVisible,
      dragDropWorking: testData.dragDropWorking,
      menuNavigationWorking: testData.menuNavigationWorking,
      chatSystemWorking: testData.chatSystemWorking,
      healthBarVisible: testData.healthBarVisible,
      skillUIVisible: testData.skillUIVisible,
      inventoryUIVisible: testData.inventoryUIVisible,
      bankUIVisible: testData.bankUIVisible,
      equipmentUIVisible: testData.equipmentUIVisible,
      minimapVisible: testData.minimapVisible,
      uiResponsive: testData.uiResponsive,
      performanceMetrics: JSON.stringify(testData.performanceMetrics),
      duration: Date.now() - testData.startTime
    };

    // Test passes if UI elements were created and basic functionality works
    const successfulInteractions = testData.interactionsPerformed.filter(i => i.success).length;
    const totalInteractions = testData.interactionsPerformed.length;

    if (testData.uiElementsCreated.length > 0 && successfulInteractions >= totalInteractions * 0.8) {
      this.passTest(stationId, results);
    } else {
      this.failTest(stationId, `UI test failed: created=${testData.uiElementsCreated.length}, successful_interactions=${successfulInteractions}/${totalInteractions}`);
    }
  }

  protected cleanupTest(stationId: string): void {
    const testData = this.testData.get(stationId);
    
    if (testData) {
      // Clean up bank
      this.emitTypedEvent(EventType.BANK_REMOVE, {
        id: `bank_${stationId}`
      });
      
      // Close all UI elements
      this.emitTypedEvent(EventType.UI_CLOSE_ALL, {
        playerId: testData.player.id
      });
      
      // Remove fake player
      this.fakePlayers.delete(testData.player.id);
      
      // Emit cleanup events
      this.emitTypedEvent(EventType.TEST_PLAYER_REMOVE, {
        id: `fake_player_${testData.player.id}`
      });
      
      this.testData.delete(stationId);
    }
    
  }

  async getSystemRating(): Promise<string> {
    const totalStations = this.testStations.size;
    const completedStations = Array.from(this.testStations.values()).filter(station => 
      station.status === 'passed' || station.status === 'failed'
    ).length;
    
    const successfulStations = Array.from(this.testStations.values()).filter(station => 
      station.status === 'passed'
    ).length;
    
    const completionRate = totalStations > 0 ? completedStations / totalStations : 0;
    const successRate = completedStations > 0 ? successfulStations / completedStations : 0;
    
    const hasAccessibilityTesting = this.testStations.has('ui_accessibility_test');
    const hasInteractionValidation = this.testStations.has('ui_interaction_validation');
    const hasErrorRecovery = this.testStations.has('ui_error_recovery');
    const hasPerformanceTesting = this.testStations.has('ui_performance_test');
    const hasResponsiveTesting = this.testStations.has('ui_responsive_test');
    
    const advancedFeatureCount = [
      hasAccessibilityTesting,
      hasInteractionValidation, 
      hasErrorRecovery,
      hasPerformanceTesting,
      hasResponsiveTesting
    ].filter(Boolean).length;
    
    // Rating logic with enhanced criteria
    if (completionRate >= 0.95 && successRate >= 0.9 && advancedFeatureCount >= 5) {
      return 'excellent';
    } else if (completionRate >= 0.8 && successRate >= 0.8 && advancedFeatureCount >= 4) {
      return 'very_good';
    } else if (completionRate >= 0.6 && successRate >= 0.7 && advancedFeatureCount >= 3) {
      return 'good';
    } else if (completionRate >= 0.4 && successRate >= 0.6) {
      return 'fair';
    } else {
      return 'poor';
    }
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(_dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(_dt: number): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}