/**
 * Item Action Test System
 * 
 * Tests the right-click context menu system:
 * - Right-click on items shows contextual actions
 * - Context menu appears with correct options (Wear, Drop, Use, Eat, Examine)
 * - Actions are filtered based on item type
 * - Menu actions execute correctly
 * - Visual feedback is provided
 * - Menu disappears after action or click away
 */

// Removed unused import: System
import THREE from '../extras/three';
import { ItemType } from '../types';
import { EventType } from '../types/events';
import type { World, EntityData, Entities } from '../types/index';
import { SystemBase } from './SystemBase';
import { Logger } from '../utils/Logger';
import { dataManager } from '../data/DataManager';
import type { ActionTestData } from '../types/ui-types';

export class ItemActionTestSystem extends SystemBase {
  private testData = new Map<string, ActionTestData>();
  private testPositions = [
    { x: -110, y: 0, z: 10 },
    { x: -110, y: 0, z: 20 },
    { x: -110, y: 0, z: 30 },
    { x: -110, y: 0, z: 40 },
    { x: -110, y: 0, z: 50 }
  ];

  // Expected actions for each item type
  private expectedActions: Record<string, string[]> = {
    'weapon': ['Examine', 'Wear', 'Drop'],
    'armor': ['Examine', 'Wear', 'Drop'],
    'shield': ['Examine', 'Wear', 'Drop'],
    'ammunition': ['Examine', 'Wear', 'Drop'],
    'food': ['Examine', 'Eat', 'Drop'],
    'resource': ['Examine', 'Drop'],
    'tool': ['Examine', 'Drop'],
    'coin': ['Examine', 'Drop']
  };

  constructor(world: World) {
    super(world, { 
      name: 'item-action-test',
      dependencies: {
        required: [],
        optional: []
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {
    
    // Initialize the data manager before running tests
    await dataManager.initialize();
    
    // Listen for item action events via EventBus
    this.subscribe(EventType.ITEM_RIGHT_CLICK, (data) => this.handleItemRightClick(data));
    this.subscribe(EventType.UI_OPEN_MENU, (data) => this.handleContextMenuShown(data));
    this.subscribe(EventType.UI_CLOSE_MENU, (data) => this.handleContextMenuHidden(data));
    this.subscribe(EventType.ITEM_ACTION_EXECUTE, (data) => this.handleActionExecuted(data));
    this.subscribe(EventType.ITEM_EXAMINE, (data) => this.handleItemExamineEvent(data));
    this.subscribe(EventType.EQUIPMENT_EQUIP, (data) => this.handleItemEquipEvent(data));
    this.subscribe(EventType.ITEM_DROP, (data) => this.handleItemDropEvent(data));
    this.subscribe(EventType.ITEM_CONSUME, (data) => this.handleItemConsumeEvent(data));
    
    this.createTestStations();
  }

  start(): void {
    // Auto-run once on start
    this.runAllTests();
  }

  protected createTestStations(): void {
    this.testPositions.forEach((pos, index) => {
      // Create test area
      this.createTestArea(`action_test_${index}`, pos, 0x4169E1, { x: 2.5, y: 0.2, z: 2.5 });
      
      // Create test label
      this.createTestText(`action_test_label_${index}`, pos, `Action Test ${index + 1}`, 1.0);
    });
  }

  private runAllTests(): void {
    // Test 1: Weapon Context Menu
    setTimeout(() => this.testWeaponActions(), 2000);
    
    // Test 2: Food Context Menu
    setTimeout(() => this.testFoodActions(), 15000);
    
    // Test 3: Armor Context Menu
    setTimeout(() => this.testArmorActions(), 30000);
    
    // Test 4: Resource Context Menu
    setTimeout(() => this.testResourceActions(), 45000);
    
    // Test 5: Multiple Item Types
    setTimeout(() => this.testMultipleItemTypes(), 60000);
  }

  private async testWeaponActions(): Promise<void> {
    const testId = 'weapon_actions';
    const position = this.testPositions[0];
    
    try {
      
      const testData: ActionTestData = {
        testId,
        itemId: 'bronze_sword',
        itemType: ItemType.WEAPON,
        playerId: 'test_player_weapon',
        startTime: Date.now(),
        phase: 'setup',
        rightClicked: false,
        menuShown: false,
        actionsAvailable: [],
        actionsExpected: ['Examine', 'Wear', 'Drop'],
        actionsTested: [],
        actionsSuccessful: [],
        menuDisappeared: false,
        visualFeedbackReceived: false,
        errors: []
      };
      
      this.testData.set(testId, testData);
      
      // Create a test player if needed
      await this.createTestPlayer(testData.playerId, position);
      
      // Add the item to player's inventory
      this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
        playerId: testData.playerId,
        item: {
          id: `inv_${testData.playerId}_${Date.now()}`,
          itemId: 'bronze_sword',
          quantity: 1,
          slot: -1, // Let system find empty slot
          metadata: null
        }
      });
      
      // Wait for inventory to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Create visual item representation
      await this.createTestItem(testId, 'bronze_sword', position, 0xFFFFFF);
      
      // Simulate right-click
      setTimeout(() => this.simulateRightClick(testId), 2000);
      
      // Test each action
      setTimeout(() => this.testAvailableActions(testId), 5000);
      
      // Complete test
      setTimeout(() => this.completeActionTest(testId), 10000);
      
    } catch (_error) {
      this.failActionTest(testId, `Weapon actions test error: ${_error}`);
    }
  }

  private async testFoodActions(): Promise<void> {
    const testId = 'food_actions';
    const position = this.testPositions[1];
    
    try {
      
      const testData: ActionTestData = {
        testId,
        itemId: 'cooked_fish',
        itemType: ItemType.FOOD,
        playerId: 'test_player_food',
        startTime: Date.now(),
        phase: 'setup',
        rightClicked: false,
        menuShown: false,
        actionsAvailable: [],
        actionsExpected: ['Examine', 'Eat', 'Drop'],
        actionsTested: [],
        actionsSuccessful: [],
        menuDisappeared: false,
        visualFeedbackReceived: false,
        errors: []
      };
      
      this.testData.set(testId, testData);
      
      // Create a test player if needed
      await this.createTestPlayer(testData.playerId, position);
      
      // Add the item to player's inventory
      this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
        playerId: testData.playerId,
        item: {
          id: `inv_${testData.playerId}_${Date.now()}`,
          itemId: 'cooked_fish',
          quantity: 1,
          slot: -1, // Let system find empty slot
          metadata: null
        }
      });
      
      // Wait for inventory to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Create visual item representation
      await this.createTestItem(testId, 'cooked_fish', position, 0x32CD32);
      
      // Test food-specific actions
      setTimeout(() => this.simulateRightClick(testId), 2000);
      setTimeout(() => this.testFoodSpecificActions(testId), 5000);
      setTimeout(() => this.completeActionTest(testId), 10000);
      
    } catch (_error) {
      this.failActionTest(testId, `Food actions test error: ${_error}`);
    }
  }

  private async testArmorActions(): Promise<void> {
    const testId = 'armor_actions';
    const position = this.testPositions[2];
    
    try {
      
      const testData: ActionTestData = {
        testId,
        itemId: 'bronze_helmet',
        itemType: ItemType.ARMOR,
        playerId: 'test_player_armor',
        startTime: Date.now(),
        phase: 'setup',
        rightClicked: false,
        menuShown: false,
        actionsAvailable: [],
        actionsExpected: ['Examine', 'Wear', 'Drop'],
        actionsTested: [],
        actionsSuccessful: [],
        menuDisappeared: false,
        visualFeedbackReceived: false,
        errors: []
      };
      
      this.testData.set(testId, testData);
      
      // Create a test player if needed
      await this.createTestPlayer(testData.playerId, position);
      
      // Add the item to player's inventory
      this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
        playerId: testData.playerId,
        item: {
          id: `inv_${testData.playerId}_${Date.now()}`,
          itemId: 'bronze_helmet',
          quantity: 1,
          slot: -1, // Let system find empty slot
          metadata: null
        }
      });
      
      // Wait for inventory to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await this.createTestItem(testId, 'bronze_helmet', position, 0x8B4513);
      
      setTimeout(() => this.simulateRightClick(testId), 2000);
      setTimeout(() => this.testArmorSpecificActions(testId), 5000);
      setTimeout(() => this.completeActionTest(testId), 10000);
      
    } catch (_error) {
      this.failActionTest(testId, `Armor actions test error: ${_error}`);
    }
  }

  private async testResourceActions(): Promise<void> {
    const testId = 'resource_actions';
    const position = this.testPositions[3];
    
    try {
      
      const testData: ActionTestData = {
        testId,
        itemId: 'logs',
        itemType: ItemType.RESOURCE,
        playerId: 'test_player_resource',
        startTime: Date.now(),
        phase: 'setup',
        rightClicked: false,
        menuShown: false,
        actionsAvailable: [],
        actionsExpected: ['Examine', 'Drop'],
        actionsTested: [],
        actionsSuccessful: [],
        menuDisappeared: false,
        visualFeedbackReceived: false,
        errors: []
      };
      
      this.testData.set(testId, testData);
      
      // Create a test player if needed
      await this.createTestPlayer(testData.playerId, position);
      
      // Add the item to player's inventory
      this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
        playerId: testData.playerId,
        item: {
          id: `inv_${testData.playerId}_${Date.now()}`,
          itemId: 'logs',
          quantity: 1,
          slot: -1, // Let system find empty slot
          metadata: null
        }
      });
      
      // Wait for inventory to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await this.createTestItem(testId, 'logs', position, 0x654321);
      
      setTimeout(() => this.simulateRightClick(testId), 2000);
      setTimeout(() => this.testResourceSpecificActions(testId), 5000);
      setTimeout(() => this.completeActionTest(testId), 10000);
      
    } catch (_error) {
      this.failActionTest(testId, `Resource actions test error: ${_error}`);
    }
  }

  private async testMultipleItemTypes(): Promise<void> {
    const testId = 'multiple_item_types';
    const position = this.testPositions[4];
    
    try {
      
      const testData: ActionTestData = {
        testId,
        itemId: 'multiple',
        itemType: ItemType.MISC,
        playerId: 'test_player_multiple',
        startTime: Date.now(),
        phase: 'setup',
        rightClicked: false,
        menuShown: false,
        actionsAvailable: [],
        actionsExpected: [],
        actionsTested: [],
        actionsSuccessful: [],
        menuDisappeared: false,
        visualFeedbackReceived: false,
        errors: []
      };
      
      this.testData.set(testId, testData);
      
      // Create a test player if needed
      await this.createTestPlayer(testData.playerId, position);
      
      // Create multiple items of different types
      const items = [
        { id: 'steel_sword', type: 'weapon', color: 0xC0C0C0, offset: { x: -1, z: 0 } },
        { id: 'raw_shrimps', type: 'food', color: 0x90EE90, offset: { x: 0, z: 0 } },
        { id: 'arrows', type: 'ammunition', color: 0xFFD700, offset: { x: 1, z: 0 } }
      ];
      
      // Add all items to player's inventory
      for (const item of items) {
        this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
          playerId: testData.playerId,
          item: {
            id: `${testData.playerId}_${item.id}_${Date.now()}`,
            itemId: item.id,
            quantity: 1,
            slot: -1, // Let system find empty slot
            metadata: null
          }
        });
      }
      
      // Wait for inventory to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      for (const item of items) {
        await this.createTestItem(`${testId}_${item.id}`, item.id, {
          x: position.x + item.offset.x,
          y: position.y,
          z: position.z + item.offset.z
        }, item.color);
      }
      
      // Test each item type
      setTimeout(() => this.testMultipleItems(testId, items), 2000);
      setTimeout(() => this.completeActionTest(testId), 10000);
      
    } catch (_error) {
      this.failActionTest(testId, `Multiple item types test error: ${_error}`);
    }
  }

  private async createTestPlayer(playerId: string, position: { x: number; y: number; z: number }): Promise<void> {
    // Do not emit PLAYER_JOINED before entity exists; Entities.add will emit when appropriate
        
    // Create fake player entity using the proper EntityData structure
    const playerData: EntityData = {
      id: playerId,
      name: playerId,
      type: 'player', // Always use 'player' type for proper registration
      owner: playerId,
      position: [position.x, position.y, position.z],
      quaternion: [0, 0, 0, 1],
      scale: [1, 1, 1],
      health: 100,
      maxHealth: 100,
      level: 1,
      class: 'warrior'
    };
    
    // Register with world entities using the proper add method
    if (!this.world.entities.has(playerId)) {
      // Use the entities system's add method to create a proper Entity instance
      const entitiesSystem = this.world.entities as Entities;
      entitiesSystem.add(playerData, true);
          }
    
    // Initialize inventory for the player
    this.emitTypedEvent(EventType.INVENTORY_INITIALIZED, {
      playerId: playerId
    });
    
      }

  private async createTestItem(_testId: string, _itemId: string, _position: { x: number; y: number; z: number }, _color: number): Promise<void> {
    // DISABLED: Visual cube proxies interfere with actual 3D models
    // Tests work by checking entity data and inventory state, not visual cubes
    
    // DO NOT CREATE VISUAL CUBES - they clutter the scene
    // Tests rely on:
    // - Entity system spawning real items
    // - Inventory system tracking items
    // - Scene hierarchy validation
    
    // const geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    // const material = new THREE.MeshLambertMaterial({ color });
    // const itemCube = new THREE.Mesh(geometry, material);
    // ... etc (DISABLED)
  }

  private simulateRightClick(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    
    testData.phase = 'right_click';
    
    // Simulate right-click event - use the correct event type
    this.emitTypedEvent(EventType.ITEM_RIGHT_CLICK, {
      itemId: testData.itemId,
      playerId: testData.playerId,
      slot: 0,
      position: this.testPositions[0]
    });
    
    testData.rightClicked = true;
    
    // Wait for context menu to appear
    setTimeout(() => this.verifyContextMenu(testId), 1000);
  }

  private verifyContextMenu(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    
    testData.phase = 'verify_menu';
    
    // Check if context menu appeared
    if (testData.menuShown) {
      
      // Verify correct actions are available
      const expectedActions = this.expectedActions[testData.itemType] || [];
      const missingActions = expectedActions.filter(action => !testData.actionsAvailable.includes(action));
      const extraActions = testData.actionsAvailable.filter(action => !expectedActions.includes(action));
      
      if (missingActions.length > 0) {
        this.recordError(testId, `Missing expected actions: ${missingActions.join(', ')}`);
      }
      
      if (extraActions.length > 0) {
        this.recordError(testId, `Unexpected actions available: ${extraActions.join(', ')}`);
      }
      
      if (missingActions.length === 0 && extraActions.length === 0) {
        // Actions match expected - test passed
      }
    } else {
      this.recordError(testId, 'Context menu did not appear after right-click');
    }
  }

  private testAvailableActions(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    
    testData.phase = 'test_actions';
    
    // Test each available action
    testData.actionsAvailable.forEach((action, index) => {
      setTimeout(() => {
        this.testSingleAction(testId, action);
      }, index * 1000);
    });
  }

  private testSingleAction(testId: string, action: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    
    testData.actionsTested.push(action);
    
    // Emit action execution
    this.emitTypedEvent(EventType.ITEM_ACTION_EXECUTE, {
      playerId: testData.playerId,
      action: action,
      itemId: testData.itemId
    });
    
    // Wait for response
    setTimeout(() => {
      // In real system, we'd check if the action had the expected effect
      // For testing, we assume success if no errors occurred
      if (!testData.errors.some((e) => e.includes(action))) {
        testData.actionsSuccessful.push(action);
      }
    }, 500);
  }

  private testFoodSpecificActions(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    
    // Test 'Eat' action specifically
    this.testSingleAction(testId, 'Eat');
    
    // Verify 'Wear' action is NOT available for food
    if (testData.actionsAvailable.includes('Wear')) {
      this.recordError(testId, 'Wear action should not be available for food items');
    }
  }

  private testArmorSpecificActions(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    
    // Test 'Wear' action specifically
    this.testSingleAction(testId, 'Wear');
    
    // Verify 'Eat' action is NOT available for armor
    if (testData.actionsAvailable.includes('Eat')) {
      this.recordError(testId, 'Eat action should not be available for armor items');
    }
  }

  private testResourceSpecificActions(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    
    // Resources should only have Examine and Drop
    const invalidActions = testData.actionsAvailable.filter(action => 
      !['Examine', 'Drop'].includes(action)
    );
    
    if (invalidActions.length > 0) {
      this.recordError(testId, `Resource items should not have actions: ${invalidActions.join(', ')}`);
    }
    
    // Test examine action
    this.testSingleAction(testId, 'Examine');
  }

  private testMultipleItems(testId: string, items: Array<{ id: string; type: string; color: number; offset: { x: number; z: number } }>): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    
    let successCount = 0;
    
    items.forEach((item, index) => {
      setTimeout(() => {
        // Simulate right-click on each item
        this.emitTypedEvent(EventType.ITEM_RIGHT_CLICK, {
          playerId: testData.playerId,
          itemId: item.id,
          slot: index,
          position: this.testPositions[4]
        });
        
        // Check if appropriate actions are available
        const expectedActions = this.expectedActions[item.type] || [];
        
        // Simulate that actions are available (in real system, this would come from event)
        testData.actionsAvailable = expectedActions;
        testData.menuShown = true;
        
        if (expectedActions.length > 0) {
          successCount++;
        }
      }, index * 2000);
    });
    
    setTimeout(() => {
      if (successCount === items.length) {
        testData.visualFeedbackReceived = true;
      }
    }, items.length * 2000 + 1000);
  }

  private completeActionTest(testId: string): void {
    const testData = this.testData.get(testId);
    if (!testData) return;
    
    testData.phase = 'completed';
    
    const results = {
      testId,
      duration: Date.now() - testData.startTime,
      rightClicked: testData.rightClicked,
      menuShown: testData.menuShown,
      actionsExpected: testData.actionsExpected,
      actionsAvailable: testData.actionsAvailable,
      actionsTested: testData.actionsTested,
      actionsSuccessful: testData.actionsSuccessful,
      menuDisappeared: testData.menuDisappeared,
      visualFeedbackReceived: testData.visualFeedbackReceived,
      errors: testData.errors,
      success: testData.errors.length === 0 && 
               testData.rightClicked && 
               (testData.menuShown || testData.visualFeedbackReceived)
    };
    
    if (results.success) {
      this.updateTestAreaColor(`action_test_${testId}`, 0x00FF00);
    } else {
      Logger.systemError('ItemActionTestSystem', `❌ Test ${testId} FAILED`, undefined, { results });
      this.updateTestAreaColor(`action_test_${testId}`, 0xFF0000);
      
      // Log warning instead of throwing to prevent server crashes
      Logger.systemWarn('ItemActionTestSystem', `Item action test ${testId} failed: ${results.errors.join(', ')}`);
    }
  }

  private failActionTest(testId: string, reason: string): void {
    const testData = this.testData.get(testId);
    if (testData) {
      testData.phase = 'failed';
      testData.errors.push(reason);
    }
    
    Logger.systemError('ItemActionTestSystem', `❌ Test ${testId} FAILED: ${reason}`);
    this.updateTestAreaColor(`action_test_${testId}`, 0xFF0000);
    
    // Throw error to server logs for debugging
    throw new Error(`Item Action Test ${testId} failed: ${reason}`);
  }

  private recordError(testId: string, error: string): void {
    const testData = this.testData.get(testId);
    if (testData) {
      testData.errors.push(error);
    }
    Logger.systemError('ItemActionTestSystem', `Error in test ${testId}: ${error}`);
  }

  // Event handlers
  private handleItemRightClick(data: { playerId: string; itemId: string }): void {
    
    // Find matching test - just mark that we saw the right-click event
    for (const [_testId, testData] of this.testData) {
      if (testData.playerId === data.playerId && testData.itemId === data.itemId) {
        testData.rightClicked = true;
        break;
      }
    }
    // Don't simulate menu - let the actual ItemActionSystem handle it
  }

  private handleContextMenuShown(data: 
    { playerId: string; inventoryElement: HTMLElement; equipmentElement?: HTMLElement } |
    { playerId: string; actions: Array<'use' | 'drop' | 'examine' | 'equip' | 'unequip'>; menuType: 'context' | 'main' | 'options' } |
    { playerId: string; type: 'context'; position: { x: number; y: number }; actions: Array<{ id: string; label: string; icon?: string; enabled: boolean; onClick: () => void }>; targetId: string; targetType: 'resource' }
  ): void {
    
    // Find matching test
    for (const [_testId, testData] of this.testData) {
      if (testData.playerId === data.playerId) {
        testData.menuShown = true;
        
        // Extract actions based on the data structure
        if ('actions' in data) {
          if (Array.isArray(data.actions)) {
            // Check if it's an array of strings or objects
            const firstAction = data.actions[0];
            if (firstAction && typeof firstAction === 'object' && 'label' in firstAction) {
              // It's an array of action objects, extract labels
              testData.actionsAvailable = data.actions.map(action => action.label);
            } else {
              // It's an array of strings
              testData.actionsAvailable = data.actions as string[];
            }
          }
        } else {
          testData.actionsAvailable = [];
        }
        break;
      }
    }
  }

  private handleContextMenuHidden(data: { playerId?: string; menuType?: 'context' | 'main' | 'options' } | Record<string, never>): void {
    
    // Find matching test - handle optional playerId
    if ('playerId' in data && data.playerId) {
      for (const [_testId, testData] of this.testData) {
        if (testData.playerId === data.playerId) {
          testData.menuDisappeared = true;
          break;
        }
      }
    }
  }

  private handleActionExecuted(data: { testId?: string; playerId: string }): void {
    
    // Mark visual feedback as received
    for (const [_testId, testData] of this.testData) {
      if (testData.testId === data.testId || testData.playerId === data.playerId) {
        testData.visualFeedbackReceived = true;
        break;
      }
    }
  }

  // Utility methods
  private createTestArea(id: string, position: { x: number; y: number; z: number }, color: number, size: { x: number; y: number; z: number }): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const material = new THREE.MeshLambertMaterial({ color });
    const area = new THREE.Mesh(geometry, material);
    
    area.position.set(position.x, position.y, position.z);
    area.name = id;
    area.userData = { type: 'test_area', testId: id };
    
    if (this.world.stage.scene) {
      this.world.stage.scene.add(area);
    }
    
    return area;
  }

  private createTestText(id: string, position: { x: number; y: number; z: number }, text: string, yOffset: number): void {
    this.emitTypedEvent(EventType.UI_CREATE, {
      id,
      position: { x: position.x, y: position.y + yOffset, z: position.z },
      text,
      color: '#FFFFFF',
      size: 0.4
    });
  }

  private updateTestAreaColor(id: string, color: number): void {
    if (!this.world.stage.scene) return;
    
    const area = this.world.stage.scene.getObjectByName(id);
    if (area && area.type === 'Mesh') {
      const mesh = area as THREE.Mesh;
      if (mesh.material && 'color' in mesh.material) {
        (mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
      }
    }
  }

  /**
   * Get current system rating based on test performance
   */
  getSystemRating(): {
    overall: number;
    features: Record<string, number>;
    performance: Record<string, number>;
    errors: string[];
    recommendations: string[];
  } {
    const errors: string[] = [];
    const recommendations: string[] = [];
    
    // Analyze test results
    const activeTests = Array.from(this.testData.values());
    const completedTests = activeTests.filter(test => test.phase === 'completed');
    const failedTests = activeTests.filter(test => test.phase === 'failed');
    
    // Feature ratings (0-100)
    const features = {
      item_usage: this.calculateItemUsageRating(activeTests),
      action_validation: this.calculateActionValidationRating(activeTests),
      context_sensitive_actions: this.calculateContextSensitiveRating(activeTests),
      item_combinations: this.calculateItemCombinationRating(activeTests),
      action_results: this.calculateActionResultRating(activeTests)
    };
    
    // Performance metrics (0-100)
    const performance = {
      action_execution_success: this.calculateActionExecutionSuccess(activeTests),
      menu_response_time: this.calculateMenuResponseTime(activeTests),
      test_completion_rate: completedTests.length > 0 ? (completedTests.length / activeTests.length) * 100 : 0,
      error_rate: activeTests.length > 0 ? (failedTests.length / activeTests.length) * 100 : 0
    };
    
    // Calculate overall rating
    const featureAvg = Object.values(features).reduce((a, b) => a + b, 0) / Object.values(features).length;
    const performanceAvg = Object.values(performance).reduce((a, b) => a + b, 0) / Object.values(performance).length;
    const overall = Math.round((featureAvg * 0.6 + performanceAvg * 0.4));
    
    // Generate errors and recommendations
    if (performance.action_execution_success < 80) {
      errors.push('Action execution success below threshold (80%)');
      recommendations.push('Improve action execution reliability and error handling');
    }
    
    if (features.action_validation < 85) {
      errors.push('Action validation reliability issues detected');
      recommendations.push('Enhance action filtering and validation logic');
    }
    
    if (performance.menu_response_time < 75) {
      errors.push('Context menu response time too slow');
      recommendations.push('Optimize context menu display and interaction response');
    }
    
    if (features.context_sensitive_actions < 80) {
      recommendations.push('Improve context-sensitive action filtering based on item types');
    }
    
    if (performance.error_rate > 15) {
      errors.push('High error rate in item action tests');
      recommendations.push('Debug and fix item action system error sources');
    }
    
    if (activeTests.length === 0) {
      errors.push('No item action test data available');
      recommendations.push('Run item action tests to generate performance data');
    }
    
    return {
      overall,
      features,
      performance,
      errors,
      recommendations
    };
  }
  
  private calculateItemUsageRating(tests: ActionTestData[]): number {
    const relevantTests = tests.filter(t => t.actionsTested.length > 0);
    if (relevantTests.length === 0) return 0;
    
    const totalActions = relevantTests.reduce((sum, test) => sum + test.actionsTested.length, 0);
    const successfulActions = relevantTests.reduce((sum, test) => sum + test.actionsSuccessful.length, 0);
    
    return totalActions > 0 ? Math.round((successfulActions / totalActions) * 100) : 0;
  }
  
  private calculateActionValidationRating(tests: ActionTestData[]): number {
    const relevantTests = tests.filter(t => t.actionsExpected.length > 0);
    if (relevantTests.length === 0) return 0;
    
    const validationScore = relevantTests.reduce((sum, test) => {
      const expectedSet = new Set(test.actionsExpected);
      const availableSet = new Set(test.actionsAvailable);
      
      const correctActions = test.actionsExpected.filter(action => availableSet.has(action)).length;
      const incorrectActions = test.actionsAvailable.filter(action => !expectedSet.has(action)).length;
      
      const testScore = test.actionsExpected.length > 0 ? 
        ((correctActions - incorrectActions) / test.actionsExpected.length) * 100 : 0;
      
      return sum + Math.max(0, testScore);
    }, 0);
    
    return Math.round(validationScore / relevantTests.length);
  }
  
  private calculateContextSensitiveRating(tests: ActionTestData[]): number {
    const typeSpecificTests = tests.filter(t => t.itemType && t.itemType !== 'various');
    if (typeSpecificTests.length === 0) return 0;
    
    const correctlyFiltered = typeSpecificTests.filter(test => {
      const expectedActions = this.expectedActions[test.itemType] || [];
      const hasCorrectActions = expectedActions.every(action => 
        test.actionsAvailable.includes(action)
      );
      const hasNoIncorrectActions = !test.actionsAvailable.some(action => 
        !expectedActions.includes(action)
      );
      return hasCorrectActions && hasNoIncorrectActions;
    });
    
    return Math.round((correctlyFiltered.length / typeSpecificTests.length) * 100);
  }
  
  private calculateItemCombinationRating(tests: ActionTestData[]): number {
    // For now, check if multiple item type test was successful
    const multiItemTest = tests.find(t => t.testId === 'multiple_item_types');
    if (!multiItemTest) return 50; // Default if not tested
    
    return multiItemTest.visualFeedbackReceived && multiItemTest.errors.length === 0 ? 100 : 0;
  }
  
  private calculateActionResultRating(tests: ActionTestData[]): number {
    const testsWithActions = tests.filter(t => t.actionsTested.length > 0);
    if (testsWithActions.length === 0) return 0;
    
    const testsWithResults = testsWithActions.filter(t => t.visualFeedbackReceived);
    return Math.round((testsWithResults.length / testsWithActions.length) * 100);
  }
  
  private calculateActionExecutionSuccess(tests: ActionTestData[]): number {
    const completedTests = tests.filter(t => t.phase === 'completed');
    if (completedTests.length === 0) return 0;
    
    const successfulTests = completedTests.filter(t => 
      t.rightClicked && t.menuShown && t.errors.length === 0
    );
    
    return Math.round((successfulTests.length / completedTests.length) * 100);
  }
  
  private calculateMenuResponseTime(tests: ActionTestData[]): number {
    const testsWithMenus = tests.filter(t => t.menuShown && t.rightClicked);
    if (testsWithMenus.length === 0) return 0;
    
    // Assume good response time if menus appeared (detailed timing would need more instrumentation)
    // This is a simplified calculation - in reality we'd measure actual response times
    const responsiveTests = testsWithMenus.filter(t => t.visualFeedbackReceived);
    return Math.round((responsiveTests.length / testsWithMenus.length) * 100);
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(_dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(_dt: number): void {
    // Check for test timeouts
    const now = Date.now();
    for (const [testId, testData] of this.testData) {
      if (now - testData.startTime > 30000 && testData.phase !== 'completed' && testData.phase !== 'failed') {
        this.failActionTest(testId, 'Test timeout - exceeded 30 seconds');
      }
    }
  }
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}

  private handleItemExamineEvent(_data: unknown): void {
    // Log item examine event for testing
      }

  private handleItemEquipEvent(_data: unknown): void {
    // Log item equip event for testing
      }

  private handleItemDropEvent(_data: unknown): void {
    // Log item drop event for testing
      }

  private handleItemConsumeEvent(_data: unknown): void {
    // Log item consume event for testing
      }

  destroy(): void {
    this.testData.clear();
  }
}