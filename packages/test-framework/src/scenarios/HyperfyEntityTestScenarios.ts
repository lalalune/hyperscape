import { TestScenario, TestContext, TestValidation, ValidationFailure } from '../types';

/**
 * Test scenarios for Hyperfy Entity Component System functionality
 */
export class HyperfyEntityTestScenarios {
  
  /**
   * Test basic entity creation and management
   */
  static getEntityCreationTest(): TestScenario {
    return {
      id: 'hyperfy-entity-creation',
      name: 'Hyperfy Entity Creation Test',
      description: 'Verifies basic entity lifecycle management',
      
      async setup(context: TestContext): Promise<void> {
        context.log('Setting up entity creation test');
        
        context.data.set('entityConfigs', [
          {
            id: 'test-player',
            type: 'player',
            name: 'Test Player',
            position: { x: 5, y: 0, z: 5 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 }
          },
          {
            id: 'test-app',
            type: 'app',
            name: 'Test App',
            position: { x: -5, y: 0, z: -5 }
          },
          {
            id: 'test-entity',
            type: 'generic',
            name: 'Test Entity',
            position: { x: 0, y: 1, z: 0 }
          }
        ]);
      },

      async execute(context: TestContext): Promise<void> {
        context.log('Executing entity creation test');
        
        const world = context.world;
        const entityConfigs = context.data.get('entityConfigs');
        const createdEntities = [];
        
        // Create entities
        for (const config of entityConfigs) {
          try {
            const entity = await world.entities.create(config.type, config);
            createdEntities.push(entity);
            context.log(`Created entity: ${config.id} (${config.type})`);
          } catch (error: any) {
            context.error(`Failed to create entity ${config.id}: ${error.message}`);
          }
        }
        
        context.data.set('createdEntities', createdEntities);
        
        // Test entity retrieval
        const retrievedEntities = [];
        for (const config of entityConfigs) {
          const entity = world.entities.get(config.id);
          retrievedEntities.push(entity);
        }
        context.data.set('retrievedEntities', retrievedEntities);
        
        // Test entity listing
        const allEntities = world.entities.getAll();
        context.data.set('allEntities', allEntities);
        
        // Test entity counting
        const entityCount = allEntities ? 
          (Array.isArray(allEntities) ? allEntities.length : Object.keys(allEntities).length) : 0;
        context.data.set('entityCount', entityCount);
      },

      async validate(context: TestContext): Promise<TestValidation> {
        const failures: ValidationFailure[] = [];
        const warnings: string[] = [];
        
        const entityConfigs = context.data.get('entityConfigs');
        const createdEntities = context.data.get('createdEntities');
        const retrievedEntities = context.data.get('retrievedEntities');
        const allEntities = context.data.get('allEntities');
        const entityCount = context.data.get('entityCount');
        
        // Verify all entities were created
        if (createdEntities.length !== entityConfigs.length) {
          failures.push({
            type: 'assertion',
            message: `Entity creation count mismatch: expected ${entityConfigs.length}, got ${createdEntities.length}`
          });
        }
        
        // Verify entity properties
        for (let i = 0; i < createdEntities.length; i++) {
          const entity = createdEntities[i];
          const config = entityConfigs[i];
          
          if (!entity) {
            failures.push({
              type: 'assertion',
              message: `Entity ${config.id} was not created`
            });
            continue;
          }
          
          if (entity.id !== config.id) {
            failures.push({
              type: 'assertion',
              message: `Entity ID mismatch: expected ${config.id}, got ${entity.id}`
            });
          }
          
          if (entity.type !== config.type) {
            failures.push({
              type: 'assertion',
              message: `Entity type mismatch: expected ${config.type}, got ${entity.type}`
            });
          }
          
          // Verify position
          if (entity.position && config.position) {
            const pos = entity.position;
            const expectedPos = config.position;
            if (pos.x !== expectedPos.x || pos.y !== expectedPos.y || pos.z !== expectedPos.z) {
              failures.push({
                type: 'assertion',
                message: `Entity position mismatch for ${config.id}: expected (${expectedPos.x},${expectedPos.y},${expectedPos.z}), got (${pos.x},${pos.y},${pos.z})`
              });
            }
          }
        }
        
        // Verify entity retrieval
        for (let i = 0; i < retrievedEntities.length; i++) {
          const entity = retrievedEntities[i];
          const config = entityConfigs[i];
          
          if (!entity) {
            failures.push({
              type: 'assertion',
              message: `Entity ${config.id} could not be retrieved`
            });
          }
        }
        
        // Verify entity counting
        if (typeof entityCount !== 'number' || entityCount < entityConfigs.length) {
          failures.push({
            type: 'assertion',
            message: `Entity count verification failed: expected at least ${entityConfigs.length}, got ${entityCount}`
          });
        }
        
        return {
          passed: failures.length === 0,
          failures,
          warnings
        };
      },

      async cleanup(context: TestContext): Promise<void> {
        const entityConfigs = context.data.get('entityConfigs');
        
        for (const config of entityConfigs) {
          try {
            if (context.world.entities.destroy) {
              await context.world.entities.destroy();
            }
          } catch (error: any) {
            context.warn(`Failed to destroy entity ${config.id}: ${error.message}`);
          }
        }
      }
    };
  }

  /**
   * Test entity component system
   */
  static getComponentSystemTest(): TestScenario {
    return {
      id: 'hyperfy-component-system',
      name: 'Hyperfy Component System Test',
      description: 'Verifies entity component attachment and management',
      
      async setup(context: TestContext): Promise<void> {
        context.log('Setting up component system test');
        
        context.data.set('componentTypes', [
          'health',
          'inventory',
          'transform',
          'physics',
          'ai'
        ]);
      },

      async execute(context: TestContext): Promise<void> {
        context.log('Executing component system test');
        
        const world = context.world;
        const componentTypes = context.data.get('componentTypes');
        
        // Create test entity
        const entity = await world.entities.create('generic', {
          id: 'component-test-entity',
          name: 'Component Test Entity',
          position: { x: 0, y: 0, z: 0 }
        });
        context.data.set('testEntity', entity);
        
        if (!entity) {
          context.error('Failed to create test entity for component testing');
          return;
        }
        
        // Test component addition
        const addedComponents = [];
        for (const componentType of componentTypes) {
          try {
            let componentData;
            
            // Create appropriate component data
            switch (componentType) {
              case 'health':
                componentData = { maxHealth: 100, currentHealth: 100 };
                break;
              case 'inventory':
                componentData = { items: [], capacity: 28 };
                break;
              case 'transform':
                componentData = { 
                  position: { x: 0, y: 0, z: 0 },
                  rotation: { x: 0, y: 0, z: 0, w: 1 },
                  scale: { x: 1, y: 1, z: 1 }
                };
                break;
              case 'physics':
                componentData = { 
                  velocity: { x: 0, y: 0, z: 0 },
                  mass: 1,
                  friction: 0.5
                };
                break;
              case 'ai':
                componentData = { 
                  state: 'idle',
                  target: null,
                  aggroRange: 10
                };
                break;
              default:
                componentData = { type: componentType };
            }
            
            // Add component (method varies by implementation)
            if ((entity as any).addComponent) {
              await (entity as any).addComponent(componentType, componentData as any);
              addedComponents.push(componentType);
            } else if (entity.components) {
              entity.components.set(componentType, componentData as any);
              addedComponents.push(componentType);
            }
            
          } catch (error: any) {
            context.warn(`Failed to add component ${componentType}: ${error.message}`);
          }
        }
        
        context.data.set('addedComponents', addedComponents);
        
        // Test component retrieval
        const retrievedComponents = [];
        for (const componentType of addedComponents) {
          try {
            let component;
            if ((entity as any).getComponent) {
              component = (entity as any).getComponent(componentType);
            } else if (entity.components) {
              component = entity.components.get(componentType);
            }
            
            if (component) {
              retrievedComponents.push({ type: componentType, data: component });
            }
          } catch (error: any) {
            context.warn(`Failed to retrieve component ${componentType}: ${error.message}`);
          }
        }
        
        context.data.set('retrievedComponents', retrievedComponents);
        
        // Test component queries
        const hasHealthComponent = (entity as any).hasComponent ? 
          (entity as any).hasComponent('health') : 
          (entity.components && entity.components.has('health'));
        
        context.data.set('hasHealthComponent', hasHealthComponent);
      },

      async validate(context: TestContext): Promise<TestValidation> {
        const failures: ValidationFailure[] = [];
        const warnings: string[] = [];
        
        const testEntity = context.data.get('testEntity');
        const componentTypes = context.data.get('componentTypes');
        const addedComponents = context.data.get('addedComponents');
        const retrievedComponents = context.data.get('retrievedComponents');
        const hasHealthComponent = context.data.get('hasHealthComponent');
        
        // Verify entity was created
        if (!testEntity) {
          failures.push({
            type: 'assertion',
            message: 'Test entity creation failed'
          });
          return { passed: false, failures, warnings };
        }
        
        // Verify components were added
        if (addedComponents.length === 0) {
          failures.push({
            type: 'assertion',
            message: 'No components were successfully added to entity'
          });
        }
        
        // Verify component retrieval
        if (retrievedComponents.length !== addedComponents.length) {
          failures.push({
            type: 'assertion',
            message: `Component retrieval mismatch: added ${addedComponents.length}, retrieved ${retrievedComponents.length}`
          });
        }
        
        // Verify specific component data
        const healthComponent = retrievedComponents.find((c: any) => c.type === 'health');
        if (healthComponent) {
          if (!healthComponent.data.maxHealth || !healthComponent.data.currentHealth) {
            failures.push({
              type: 'assertion',
              message: 'Health component data is incomplete'
            });
          }
        }
        
        // Verify component queries
        if (addedComponents.includes('health') && !hasHealthComponent) {
          failures.push({
            type: 'assertion',
            message: 'Component query failed: hasComponent("health") returned false'
          });
        }
        
        return {
          passed: failures.length === 0,
          failures,
          warnings
        };
      },

      async cleanup(context: TestContext): Promise<void> {
        const testEntity = context.data.get('testEntity');
        if (testEntity && context.world.entities.destroy) {
          try {
            await context.world.entities.destroy();
          } catch (error: any) {
            context.warn(`Failed to cleanup test entity: ${error.message}`);
          }
        }
      }
    };
  }

  /**
   * Test entity events and lifecycle
   */
  static getEntityLifecycleTest(): TestScenario {
    return {
      id: 'hyperfy-entity-lifecycle',
      name: 'Hyperfy Entity Lifecycle Test',
      description: 'Verifies entity events, updates, and lifecycle management',
      
      async setup(context: TestContext): Promise<void> {
        context.log('Setting up entity lifecycle test');
        
        context.data.set('lifecycleEvents', []);
      },

      async execute(context: TestContext): Promise<void> {
        context.log('Executing entity lifecycle test');
        
        const world = context.world;
        const lifecycleEvents = context.data.get('lifecycleEvents');
        
        // Create entity with lifecycle tracking
        const entity = await world.entities.create('generic', {
          id: 'lifecycle-test-entity',
          name: 'Lifecycle Test Entity',
          position: { x: 0, y: 0, z: 0 }
        });
        context.data.set('testEntity', entity);
        
        if (!entity) {
          context.error('Failed to create test entity for lifecycle testing');
          return;
        }
        
        // Set up event listeners if supported
        const eventTypes = ['created', 'updated', 'destroyed'];
        
        for (const eventType of eventTypes) {
          if (entity.on) {
            entity.on(eventType, () => {
              lifecycleEvents.push(eventType);
            });
          }
        }
        
        // Test entity updates
        const originalPosition = { ...entity.position };
        
        if ((entity as any).setPosition) {
          await (entity as any).setPosition({ x: 10, y: 5, z: 10 });
        } else {
          entity.position = { x: 10, y: 5, z: 10 };
        }
        
        const updatedPosition = { ...entity.position };
        context.data.set('originalPosition', originalPosition);
        context.data.set('updatedPosition', updatedPosition);
        
        // Test entity property updates
        if ((entity as any).setProperty) {
          await (entity as any).setProperty('testValue', 'updated');
        } else if ((entity as any).data) {
          (entity as any).data.testValue = 'updated';
        }
        
        // Simulate tick updates
        if ((entity as any).update) {
          (entity as any).update(0.016); // 60 FPS delta
        }
        
        // Test entity state
        const entityState = {
          id: entity.id,
          type: entity.type,
          position: entity.position,
          isActive: (entity as any).isActive !== undefined ? (entity as any).isActive : true
        };
        context.data.set('entityState', entityState);
      },

      async validate(context: TestContext): Promise<TestValidation> {
        const failures: ValidationFailure[] = [];
        const warnings: string[] = [];
        
        const testEntity = context.data.get('testEntity');
        const originalPosition = context.data.get('originalPosition');
        const updatedPosition = context.data.get('updatedPosition');
        const entityState = context.data.get('entityState');
        
        // Verify entity exists
        if (!testEntity) {
          failures.push({
            type: 'assertion',
            message: 'Test entity creation failed'
          });
          return { passed: false, failures, warnings };
        }
        
        // Verify position updates
        if (originalPosition && updatedPosition) {
          if (originalPosition.x === updatedPosition.x && 
              originalPosition.y === updatedPosition.y && 
              originalPosition.z === updatedPosition.z) {
            failures.push({
              type: 'assertion',
              message: 'Entity position update failed - position unchanged'
            });
          }
          
          if (updatedPosition.x !== 10 || updatedPosition.y !== 5 || updatedPosition.z !== 10) {
            failures.push({
              type: 'assertion',
              message: `Position update incorrect: expected (10,5,10), got (${updatedPosition.x},${updatedPosition.y},${updatedPosition.z})`
            });
          }
        }
        
        // Verify entity state
        if (!entityState || !entityState.id) {
          failures.push({
            type: 'assertion',
            message: 'Entity state verification failed'
          });
        }
        
        // Verify entity is still active
        if (entityState && entityState.isActive === false) {
          warnings.push('Entity is not active after updates');
        }
        
        return {
          passed: failures.length === 0,
          failures,
          warnings
        };
      },

      async cleanup(context: TestContext): Promise<void> {
        const testEntity = context.data.get('testEntity');
        if (testEntity && context.world.entities.destroy) {
          try {
            await context.world.entities.destroy();
          } catch (error: any) {
            context.warn(`Failed to cleanup test entity: ${error.message}`);
          }
        }
      }
    };
  }

  /**
   * Get all Hyperfy Entity test scenarios
   */
  static getAllScenarios(): TestScenario[] {
    return [
      this.getEntityCreationTest(),
      this.getComponentSystemTest(),
      this.getEntityLifecycleTest()
    ];
  }
}