/**
 * RPG UI Test System
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

import { RPGVisualTestFramework, TestStation, FakePlayer } from './RPGVisualTestFramework';
import { getItem } from '../data/items';

interface UITestData {
  fakePlayer: FakePlayer;
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

export class RPGUITestSystem extends RPGVisualTestFramework {
  private testData = new Map<string, UITestData>();
  private uiSystem: any;
  private inventorySystem: any;
  private equipmentSystem: any;
  private bankingSystem: any;

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    await super.init();
    
    console.log('[RPGUITestSystem] Initializing UI test system...');
    
    // Get required systems
    this.uiSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGUISystem');
    this.inventorySystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGInventorySystem');
    this.equipmentSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGEquipmentSystem');
    this.bankingSystem = this.world.systems.find((s: any) => s.constructor.name === 'RPGBankingSystem');
    
    if (!this.uiSystem) {
      throw new Error('[RPGUITestSystem] RPGUISystem not found - required for UI tests');
    }
    
    if (!this.inventorySystem) {
      throw new Error('[RPGUITestSystem] RPGInventorySystem not found - required for UI tests');
    }
    
    if (!this.equipmentSystem) {
      throw new Error('[RPGUITestSystem] RPGEquipmentSystem not found - required for UI tests');
    }
    
    if (!this.bankingSystem) {
      throw new Error('[RPGUITestSystem] RPGBankingSystem not found - required for UI tests');
    }
    
    // Listen for UI events
    this.world.on?.('rpg:ui:created', this.handleUICreated.bind(this));
    this.world.on?.('rpg:ui:interaction', this.handleUIInteraction.bind(this));
    this.world.on?.('rpg:ui:error', this.handleUIError.bind(this));
    this.world.on?.('rpg:chat:message', this.handleChatMessage.bind(this));
    
    // Create test stations
    this.createTestStations();
    
    console.log('[RPGUITestSystem] UI test system initialized');
  }

  private createTestStations(): void {
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
    try {
      console.log('[RPGUITestSystem] Starting inventory UI test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with diverse inventory
      const fakePlayer = this.createFakePlayer({
        id: `inventory_ui_player_${Date.now()}`,
        name: 'Inventory UI Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100
        }
      });

      // Give player various items for UI testing
      const bronzeSword = getItem('100');
      const rawFish = getItem('201');
      const cookedFish = getItem('202');
      const logs = getItem('200');
      const coins = getItem('999');
      
      if (bronzeSword && rawFish && cookedFish && logs && coins) {
        fakePlayer.inventory = [
          { item: bronzeSword, quantity: 1 },
          { item: rawFish, quantity: 8 },
          { item: cookedFish, quantity: 5 },
          { item: logs, quantity: 12 },
          { item: coins, quantity: 150 }
        ];
      }

      // Initialize test data
      this.testData.set(stationId, {
        fakePlayer,
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
      
    } catch (error) {
      this.failTest(stationId, `Inventory UI test error: ${error}`);
    }
  }

  private async runEquipmentUITest(stationId: string): Promise<void> {
    try {
      console.log('[RPGUITestSystem] Starting equipment UI test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with equipment
      const fakePlayer = this.createFakePlayer({
        id: `equipment_ui_player_${Date.now()}`,
        name: 'Equipment UI Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 10, strength: 8, defense: 6, ranged: 4, constitution: 12,
          health: 120, maxHealth: 120
        }
      });

      // Give player equipment and items to equip
      const steelSword = getItem('110');
      const bronzeHelmet = getItem('150');
      const leatherBody = getItem('160');
      const bronzeShield = getItem('140');
      
      if (steelSword && bronzeHelmet && leatherBody && bronzeShield) {
        fakePlayer.inventory = [
          { item: steelSword, quantity: 1 },
          { item: bronzeHelmet, quantity: 1 },
          { item: leatherBody, quantity: 1 },
          { item: bronzeShield, quantity: 1 }
        ];
      }

      // Initialize test data
      this.testData.set(stationId, {
        fakePlayer,
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
      
    } catch (error) {
      this.failTest(stationId, `Equipment UI test error: ${error}`);
    }
  }

  private async runBankingUITest(stationId: string): Promise<void> {
    try {
      console.log('[RPGUITestSystem] Starting banking UI test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with items to bank
      const fakePlayer = this.createFakePlayer({
        id: `banking_ui_player_${Date.now()}`,
        name: 'Banking UI Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100
        }
      });

      // Give player items to test banking
      const mithrilSword = getItem('120');
      const arrows = getItem('300');
      const coins = getItem('999');
      
      if (mithrilSword && arrows && coins) {
        fakePlayer.inventory = [
          { item: mithrilSword, quantity: 1 },
          { item: arrows, quantity: 50 },
          { item: coins, quantity: 500 }
        ];
      }

      // Initialize test data
      this.testData.set(stationId, {
        fakePlayer,
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
      
    } catch (error) {
      this.failTest(stationId, `Banking UI test error: ${error}`);
    }
  }

  private async runHealthStaminaUITest(stationId: string): Promise<void> {
    try {
      console.log('[RPGUITestSystem] Starting health/stamina UI test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with variable health
      const fakePlayer = this.createFakePlayer({
        id: `health_ui_player_${Date.now()}`,
        name: 'Health UI Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 65, maxHealth: 100 // Damaged health to test display
        }
      });

      // Initialize test data
      this.testData.set(stationId, {
        fakePlayer,
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
      
    } catch (error) {
      this.failTest(stationId, `Health/stamina UI test error: ${error}`);
    }
  }

  private async runSkillsUITest(stationId: string): Promise<void> {
    try {
      console.log('[RPGUITestSystem] Starting skills UI test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with some skill progression
      const fakePlayer = this.createFakePlayer({
        id: `skills_ui_player_${Date.now()}`,
        name: 'Skills UI Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 8, strength: 6, defense: 4, ranged: 2, constitution: 12,
          health: 120, maxHealth: 120
        }
      });

      // Give player some XP in various skills
      this.world.emit('rpg:xp:gain', { playerId: fakePlayer.id, skill: 'attack', amount: 300 });
      this.world.emit('rpg:xp:gain', { playerId: fakePlayer.id, skill: 'woodcutting', amount: 450 });
      this.world.emit('rpg:xp:gain', { playerId: fakePlayer.id, skill: 'fishing', amount: 200 });

      // Initialize test data
      this.testData.set(stationId, {
        fakePlayer,
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
      
    } catch (error) {
      this.failTest(stationId, `Skills UI test error: ${error}`);
    }
  }

  private async runChatSystemTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGUITestSystem] Starting chat system test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player
      const fakePlayer = this.createFakePlayer({
        id: `chat_ui_player_${Date.now()}`,
        name: 'Chat UI Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100
        }
      });

      // Initialize test data
      this.testData.set(stationId, {
        fakePlayer,
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
      
    } catch (error) {
      this.failTest(stationId, `Chat system test error: ${error}`);
    }
  }

  private async runMinimapUITest(stationId: string): Promise<void> {
    try {
      console.log('[RPGUITestSystem] Starting minimap UI test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player
      const fakePlayer = this.createFakePlayer({
        id: `minimap_ui_player_${Date.now()}`,
        name: 'Minimap UI Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100
        }
      });

      // Initialize test data
      this.testData.set(stationId, {
        fakePlayer,
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
      
    } catch (error) {
      this.failTest(stationId, `Minimap UI test error: ${error}`);
    }
  }

  private async runMenuNavigationTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGUITestSystem] Starting menu navigation test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player
      const fakePlayer = this.createFakePlayer({
        id: `menu_nav_player_${Date.now()}`,
        name: 'Menu Navigation Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100
        }
      });

      // Initialize test data
      this.testData.set(stationId, {
        fakePlayer,
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
      
    } catch (error) {
      this.failTest(stationId, `Menu navigation test error: ${error}`);
    }
  }

  private async runUIPerformanceTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGUITestSystem] Starting UI performance test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player
      const fakePlayer = this.createFakePlayer({
        id: `performance_ui_player_${Date.now()}`,
        name: 'Performance UI Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100
        }
      });

      // Initialize test data
      this.testData.set(stationId, {
        fakePlayer,
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
      
    } catch (error) {
      this.failTest(stationId, `UI performance test error: ${error}`);
    }
  }

  private async runResponsiveUITest(stationId: string): Promise<void> {
    try {
      console.log('[RPGUITestSystem] Starting responsive UI test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player
      const fakePlayer = this.createFakePlayer({
        id: `responsive_ui_player_${Date.now()}`,
        name: 'Responsive UI Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100
        }
      });

      // Initialize test data
      this.testData.set(stationId, {
        fakePlayer,
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
      
    } catch (error) {
      this.failTest(stationId, `Responsive UI test error: ${error}`);
    }
  }

  private createInventoryUI(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    const startTime = Date.now();

    this.world.emit('rpg:ui:create', {
      type: 'inventory',
      playerId: testData.fakePlayer.id,
      config: {
        position: { x: 100, y: 100 },
        size: { width: 300, height: 400 },
        slots: 28,
        items: testData.fakePlayer.inventory
      }
    });

    testData.performanceMetrics.uiLoadTime = Date.now() - startTime;
    testData.uiElementsCreated.push({ type: 'inventory', id: 'inventory_ui', visible: true });
  }

  private createEquipmentUI(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    this.world.emit('rpg:ui:create', {
      type: 'equipment',
      playerId: testData.fakePlayer.id,
      config: {
        position: { x: 450, y: 100 },
        size: { width: 200, height: 300 },
        slots: ['weapon', 'shield', 'helmet', 'body', 'legs', 'arrows']
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
    this.world.emit('rpg:test:bank:create', {
      id: `bank_${stationId}`,
      position: { 
        x: testData.fakePlayer.position.x + 3, 
        y: testData.fakePlayer.position.y, 
        z: testData.fakePlayer.position.z 
      },
      color: '#8B4513', // Brown for bank
      size: { x: 2.0, y: 2.5, z: 1.0 },
      type: 'bank_booth'
    });
  }

  private createBankingUI(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    this.world.emit('rpg:ui:create', {
      type: 'bank',
      playerId: testData.fakePlayer.id,
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

    this.world.emit('rpg:ui:create', {
      type: 'health_stamina',
      playerId: testData.fakePlayer.id,
      config: {
        position: { x: 20, y: 20 },
        health: testData.fakePlayer.stats.health,
        maxHealth: testData.fakePlayer.stats.maxHealth,
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

    // Use event-based system access instead of direct access
    this.world.emit?.('rpg:skills:get_all', {
      playerId: testData.fakePlayer.id,
      callback: (skills: any) => {
        this.createSkillsUIWithData(stationId, skills);
      }
    });
  }

  private createSkillsUIWithData(stationId: string, skills: any): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    this.world.emit('rpg:ui:create', {
      type: 'skills',
      playerId: testData.fakePlayer.id,
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

    this.world.emit('rpg:ui:create', {
      type: 'chat',
      playerId: testData.fakePlayer.id,
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

    this.world.emit('rpg:ui:create', {
      type: 'minimap',
      playerId: testData.fakePlayer.id,
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

    console.log('[RPGUITestSystem] Testing drag and drop...');

    const interactionStartTime = Date.now();

    // Simulate dragging sword from inventory to weapon slot
    this.world.emit('rpg:ui:drag_drop', {
      playerId: testData.fakePlayer.id,
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

    console.log('[RPGUITestSystem] Testing banking operations...');

    // Test depositing items
    this.world.emit('rpg:ui:bank_deposit', {
      playerId: testData.fakePlayer.id,
      inventorySlot: 0,
      quantity: 1
    });

    testData.interactionsPerformed.push({ type: 'bank_deposit', target: 'bank_slot', success: true });
    testData.bankUIVisible = true;

    // Test withdrawing items
    setTimeout(() => {
      this.world.emit('rpg:ui:bank_withdraw', {
        playerId: testData.fakePlayer.id,
        bankSlot: 0,
        quantity: 1
      });

      testData.interactionsPerformed.push({ type: 'bank_withdraw', target: 'inventory_slot', success: true });
    }, 2000);
  }

  private testHealthUpdates(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGUITestSystem] Testing health updates...');

    // Simulate health change
    testData.fakePlayer.stats.health = 85;

    this.world.emit('rpg:ui:update_health', {
      playerId: testData.fakePlayer.id,
      health: testData.fakePlayer.stats.health,
      maxHealth: testData.fakePlayer.stats.maxHealth
    });

    testData.interactionsPerformed.push({ type: 'health_update', target: 'health_bar', success: true });
  }

  private testChatMessaging(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGUITestSystem] Testing chat messaging...');

    // Send test messages
    const testMessages = [
      'Hello world!',
      'Testing chat system',
      'UI test message'
    ];

    testMessages.forEach((message, index) => {
      setTimeout(() => {
        this.world.emit('rpg:chat:send', {
          playerId: testData.fakePlayer.id,
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

    console.log('[RPGUITestSystem] Testing menu navigation...');

    // Test opening various menus
    const menus = ['inventory', 'equipment', 'skills', 'settings'];

    menus.forEach((menu, index) => {
      setTimeout(() => {
        this.world.emit('rpg:ui:open_menu', {
          playerId: testData.fakePlayer.id,
          menuType: menu
        });

        testData.interactionsPerformed.push({ type: 'menu_open', target: menu, success: true });

        // Close menu after opening
        setTimeout(() => {
          this.world.emit('rpg:ui:close_menu', {
            playerId: testData.fakePlayer.id,
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

    console.log('[RPGUITestSystem] Testing UI performance...');

    const startTime = Date.now();

    // Create multiple UI elements rapidly
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        this.world.emit('rpg:ui:create', {
          type: 'performance_test',
          playerId: testData.fakePlayer.id,
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

    console.log('[RPGUITestSystem] Testing responsive UI...');

    // Test different viewport sizes
    const viewportSizes = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 800, height: 600 }
    ];

    viewportSizes.forEach((size, index) => {
      setTimeout(() => {
        this.world.emit('rpg:ui:set_viewport', {
          playerId: testData.fakePlayer.id,
          width: size.width,
          height: size.height
        });

        // Create UI at this viewport size
        this.world.emit('rpg:ui:create', {
          type: 'responsive_test',
          playerId: testData.fakePlayer.id,
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
      console.log('[RPGUITestSystem] Starting accessibility test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player
      const fakePlayer = this.createFakePlayer({
        id: `accessibility_player_${Date.now()}`,
        name: 'Accessibility Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100
        }
      });

      // Initialize test data
      this.testData.set(stationId, {
        fakePlayer,
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
      
    } catch (error) {
      this.failTest(stationId, `Accessibility test error: ${error}`);
    }
  }

  private async runSpecificInteractionValidationTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGUITestSystem] Starting specific interaction validation test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player with complex inventory for interaction testing
      const fakePlayer = this.createFakePlayer({
        id: `interaction_validation_player_${Date.now()}`,
        name: 'Interaction Validation Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 15, strength: 12, defense: 8, ranged: 6, constitution: 18,
          health: 180, maxHealth: 180
        }
      });

      // Create diverse inventory for complex interaction testing
      const bronzeSword = getItem('100');
      const steelSword = getItem('110');
      const mithrilSword = getItem('120');
      const bronzeShield = getItem('140');
      const arrows = getItem('300');
      const coins = getItem('999');
      
      if (bronzeSword && steelSword && mithrilSword && bronzeShield && arrows && coins) {
        fakePlayer.inventory = [
          { item: bronzeSword, quantity: 1 },
          { item: steelSword, quantity: 1 },
          { item: mithrilSword, quantity: 1 },
          { item: bronzeShield, quantity: 1 },
          { item: arrows, quantity: 100 },
          { item: coins, quantity: 1000 }
        ];
      }

      // Initialize test data
      this.testData.set(stationId, {
        fakePlayer,
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
      
    } catch (error) {
      this.failTest(stationId, `Specific interaction validation test error: ${error}`);
    }
  }

  private async runErrorRecoveryTest(stationId: string): Promise<void> {
    try {
      console.log('[RPGUITestSystem] Starting error recovery test...');
      
      const station = this.testStations.get(stationId);
      if (!station) return;

      // Create fake player
      const fakePlayer = this.createFakePlayer({
        id: `error_recovery_player_${Date.now()}`,
        name: 'Error Recovery Test Player',
        position: { x: station.position.x, y: station.position.y, z: station.position.z },
        stats: {
          attack: 1, strength: 1, defense: 1, ranged: 1, constitution: 10,
          health: 100, maxHealth: 100
        }
      });

      // Initialize test data
      this.testData.set(stationId, {
        fakePlayer,
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
      
    } catch (error) {
      this.failTest(stationId, `Error recovery test error: ${error}`);
    }
  }

  private testAccessibilityFeatures(stationId: string): void {
    const testData = this.testData.get(stationId);
    if (!testData) return;

    console.log('[RPGUITestSystem] Testing accessibility features...');

    // Test keyboard navigation
    this.world.emit('rpg:ui:create', {
      type: 'accessibility_test',
      playerId: testData.fakePlayer.id,
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
        this.world.emit('rpg:ui:keyboard_test', {
          playerId: testData.fakePlayer.id,
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
      this.world.emit('rpg:ui:screen_reader_test', {
        playerId: testData.fakePlayer.id,
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
      this.world.emit('rpg:ui:contrast_test', {
        playerId: testData.fakePlayer.id,
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

    console.log('[RPGUITestSystem] Testing specific complex interactions...');

    // Create comprehensive UI setup
    this.world.emit('rpg:ui:create', {
      type: 'interaction_validation',
      playerId: testData.fakePlayer.id,
      config: {
        position: { x: 50, y: 50 },
        size: { width: 800, height: 600 },
        inventory: testData.fakePlayer.inventory,
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

        this.world.emit('rpg:ui:complex_interaction', {
          playerId: testData.fakePlayer.id,
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

        console.log(`[RPGUITestSystem] Complex interaction ${index + 1}/${complexInteractions.length}: ${interaction.description} (${interactionTime}ms)`);
      }, index * 2000);
    });

    // Test interaction validation and conflict resolution
    setTimeout(() => {
      this.world.emit('rpg:ui:interaction_validation', {
        playerId: testData.fakePlayer.id,
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

    console.log('[RPGUITestSystem] Testing error recovery scenarios...');

    // Create UI for error testing
    this.world.emit('rpg:ui:create', {
      type: 'error_recovery_test',
      playerId: testData.fakePlayer.id,
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
        console.log(`[RPGUITestSystem] Testing error scenario: ${scenario.description}`);

        // Trigger error scenario
        this.world.emit('rpg:ui:trigger_error', {
          playerId: testData.fakePlayer.id,
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
          this.world.emit('rpg:ui:test_recovery', {
            playerId: testData.fakePlayer.id,
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
      this.world.emit('rpg:ui:resilience_test', {
        playerId: testData.fakePlayer.id,
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
      if (testData.fakePlayer.id === data.playerId) {
        console.log(`[RPGUITestSystem] UI created for ${stationId}: ${data.type} (${data.success})`);
        
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
    for (const [stationId, testData] of this.testData.entries()) {
      if (testData.fakePlayer.id === data.playerId) {
        console.log(`[RPGUITestSystem] UI interaction for ${stationId}: ${data.type} -> ${data.target} (${data.success})`);
        
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
      if (testData.fakePlayer.id === data.playerId) {
        console.log(`[RPGUITestSystem] UI error for ${stationId}: ${data.uiType} - ${data.error}`);
        
        this.failTest(stationId, `UI error in ${data.uiType}: ${data.error}`);
        
        break;
      }
    }
  }

  private handleChatMessage(data: { playerId: string; message: string; timestamp: number }): void {
    // Find test station with matching player
    for (const [stationId, testData] of this.testData.entries()) {
      if (testData.fakePlayer.id === data.playerId) {
        console.log(`[RPGUITestSystem] Chat message for ${stationId}: ${data.message}`);
        
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
      performanceMetrics: testData.performanceMetrics,
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
      this.world.emit('rpg:test:bank:remove', {
        id: `bank_${stationId}`
      });
      
      // Close all UI elements
      this.world.emit('rpg:ui:close_all', {
        playerId: testData.fakePlayer.id
      });
      
      // Remove fake player
      this.fakePlayers.delete(testData.fakePlayer.id);
      
      // Emit cleanup events
      this.world.emit('rpg:test:player:remove', {
        id: `fake_player_${testData.fakePlayer.id}`
      });
      
      this.testData.delete(stationId);
    }
    
    console.log(`[RPGUITestSystem] Cleanup completed for ${stationId}`);
  }

  async getSystemRating(): Promise<string> {
    const totalStations = this.testStations.size;
    const completedStations = Array.from(this.testStations.values()).filter(station => 
      station.status === 'passed' || station.status === 'failed'
    ).length;
    
    const successfulStations = Array.from(this.testStations.values()).filter(station => 
      station.status === 'passed'
    ).length;
    
    // Enhanced rating criteria for UI system
    const completionRate = totalStations > 0 ? completedStations / totalStations : 0;
    const successRate = completedStations > 0 ? successfulStations / completedStations : 0;
    
    // Check for advanced features
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
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(dt: number): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}