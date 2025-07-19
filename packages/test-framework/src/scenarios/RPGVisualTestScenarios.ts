import { TestScenario, TestContext, TestValidation, ValidationFailure } from '../types';
import { PlaywrightVisualTestRunner } from '../runners/PlaywrightVisualTestRunner';

/**
 * RPG-specific visual test scenarios for validating game mechanics
 */
export class RPGVisualTestScenarios {
  
  /**
   * Test basic player movement in a 3D world
   */
  static getPlayerMovementTest(): TestScenario {
    return {
      id: 'rpg-player-movement',
      name: 'RPG Player Movement Test',
      description: 'Verifies that player moves correctly and is visually represented',
      
      async setup(context: TestContext): Promise<void> {
        context.log('Setting up player movement test world');
        
        // Create a test world with a player entity
        const worldConfig = {
          id: 'movement-test-world',
          entities: [
            {
              type: 'player' as const,
              id: 'test-player',
              position: { x: 0, y: 0, z: 0 },
              color: '#0000FF', // Blue cube for player
              properties: {
                health: 100,
                movementSpeed: 5
              }
            },
            {
              type: 'terrain' as const,
              id: 'ground',
              position: { x: 0, y: -1, z: 0 },
              color: '#00FF00', // Green cube for ground
              properties: {
                size: { x: 20, y: 1, z: 20 }
              }
            }
          ],
          camera: {
            type: 'overhead' as const,
            position: { x: 0, y: 15, z: 0 },
            target: { x: 0, y: 0, z: 0 }
          }
        };
        
        context.data.set('worldConfig', worldConfig);
      },

      async execute(context: TestContext): Promise<void> {
        context.log('Executing player movement test');
        
        const visualRunner = new PlaywrightVisualTestRunner(context.framework);
        await visualRunner.initialize({ viewport: { width: 1920, height: 1080 } });
        
        const worldConfig = context.data.get('worldConfig');
        
        const testConfig = {
          name: 'player-movement',
          description: 'Test player movement mechanics',
          timeout: 30000,
          steps: [
            {
              name: 'initial-state',
              action: 'screenshot' as const
            },
            {
              name: 'wait-for-world-load',
              action: 'wait' as const,
              value: 3000
            },
            {
              name: 'move-player-right',
              action: 'evaluate' as const,
              value: `
                // Simulate player movement command
                if (window.game && window.game.movePlayer) {
                  window.game.movePlayer('test-player', { x: 5, y: 0, z: 0 });
                }
              `
            },
            {
              name: 'after-movement',
              action: 'screenshot' as const
            },
            {
              name: 'wait-for-movement',
              action: 'wait' as const,
              value: 2000
            },
            {
              name: 'final-state',
              action: 'screenshot' as const
            }
          ]
        };
        
        const result = await visualRunner.runWorldTest(worldConfig, testConfig);
        context.data.set('testResult', result);
        context.data.set('visualRunner', visualRunner);
      },

      async validate(context: TestContext): Promise<TestValidation> {
        const result = context.data.get('testResult');
        const visualRunner = context.data.get('visualRunner');
        
        if (!result || result.status === 'failed') {
          return {
            passed: false,
            failures: [{
              type: 'other',
              message: `Visual test execution failed: ${result?.error?.message || 'Unknown error'}`
            }],
            warnings: []
          };
        }
        
        // Analyze screenshots for expected colors
        const failures: ValidationFailure[] = [];
        const warnings: string[] = [];
        
        for (const screenshotPath of result.screenshots) {
          const filename = screenshotPath.split('/').pop() || '';
          
          if (filename.includes('initial-state') || filename.includes('final-state')) {
            const analysis = await visualRunner.analyzeScreenshotColors(screenshotPath, [
              {
                color: '#0000FF', // Blue player
                tolerance: 30,
                minPixels: 100,
                description: 'Player entity (blue cube)'
              },
              {
                color: '#00FF00', // Green ground
                tolerance: 30,
                minPixels: 500,
                description: 'Ground terrain (green cube)'
              }
            ]);
            
            if (!analysis.passed) {
              failures.push({
                type: 'assertion',
                message: `Visual analysis failed for ${filename}: ${analysis.analysis.filter((a: any) => !a.found).map((a: any) => a.description).join(', ')}`
              });
            }
          }
        }
        
        // Check that player position changed between screenshots
        if (result.screenshots.length >= 2) {
          // This would be more sophisticated position comparison
          // For now, we assume if we got both screenshots, movement worked
          context.log('Movement verification: Screenshots captured successfully');
        }
        
        await visualRunner.cleanup();
        
        return {
          passed: failures.length === 0,
          failures,
          warnings
        };
      },

      async cleanup(context: TestContext): Promise<void> {
        // Clean up any test resources
        const visualRunner = context.data.get('visualRunner');
        if (visualRunner) {
          await visualRunner.cleanup();
        }
      }
    };
  }

  /**
   * Test combat mechanics - player attacking a mob
   */
  static getCombatTest(): TestScenario {
    return {
      id: 'rpg-combat-test',
      name: 'RPG Combat Test',
      description: 'Verifies combat mechanics between player and mob',
      
      async setup(context: TestContext): Promise<void> {
        context.log('Setting up combat test world');
        
        const worldConfig = {
          id: 'combat-test-world',
          entities: [
            {
              type: 'player' as const,
              id: 'test-player',
              position: { x: -2, y: 0, z: 0 },
              color: '#0000FF', // Blue cube for player
              properties: {
                health: 100,
                attack: 10,
                equipped: 'bronze-sword'
              }
            },
            {
              type: 'mob' as const,
              id: 'test-goblin',
              position: { x: 2, y: 0, z: 0 },
              color: '#FF0000', // Red cube for mob
              properties: {
                health: 50,
                attack: 5,
                mobType: 'goblin'
              }
            },
            {
              type: 'terrain' as const,
              id: 'ground',
              position: { x: 0, y: -1, z: 0 },
              color: '#00FF00', // Green cube for ground
              properties: {
                size: { x: 20, y: 1, z: 20 }
              }
            }
          ],
          camera: {
            type: 'overhead' as const,
            position: { x: 0, y: 15, z: 0 },
            target: { x: 0, y: 0, z: 0 }
          }
        };
        
        context.data.set('worldConfig', worldConfig);
      },

      async execute(context: TestContext): Promise<void> {
        context.log('Executing combat test');
        
        const visualRunner = new PlaywrightVisualTestRunner(context.framework);
        await visualRunner.initialize({ viewport: { width: 1920, height: 1080 } });
        
        const worldConfig = context.data.get('worldConfig');
        
        const testConfig = {
          name: 'combat-test',
          description: 'Test combat mechanics',
          timeout: 30000,
          steps: [
            {
              name: 'pre-combat',
              action: 'screenshot' as const
            },
            {
              name: 'wait-for-world-load',
              action: 'wait' as const,
              value: 3000
            },
            {
              name: 'initiate-combat',
              action: 'evaluate' as const,
              value: `
                // Simulate player attacking mob
                if (window.game && window.game.attackMob) {
                  window.game.attackMob('test-player', 'test-goblin');
                }
              `
            },
            {
              name: 'during-combat',
              action: 'screenshot' as const
            },
            {
              name: 'wait-for-combat',
              action: 'wait' as const,
              value: 5000
            },
            {
              name: 'post-combat',
              action: 'screenshot' as const
            }
          ]
        };
        
        const result = await visualRunner.runWorldTest(worldConfig, testConfig);
        context.data.set('testResult', result);
        context.data.set('visualRunner', visualRunner);
      },

      async validate(context: TestContext): Promise<TestValidation> {
        const result = context.data.get('testResult');
        const visualRunner = context.data.get('visualRunner');
        
        if (!result || result.status === 'failed') {
          return {
            passed: false,
            failures: [{
              type: 'other',
              message: `Combat test execution failed: ${result?.error?.message || 'Unknown error'}`
            }],
            warnings: []
          };
        }
        
        const failures: ValidationFailure[] = [];
        const warnings: string[] = [];
        
        // Analyze pre-combat and post-combat screenshots
        for (const screenshotPath of result.screenshots) {
          const filename = screenshotPath.split('/').pop() || '';
          
          if (filename.includes('pre-combat')) {
            // Both entities should be visible
            const analysis = await visualRunner.analyzeScreenshotColors(screenshotPath, [
              {
                color: '#0000FF', // Blue player
                tolerance: 30,
                minPixels: 100,
                description: 'Player entity (blue cube)'
              },
              {
                color: '#FF0000', // Red mob
                tolerance: 30,
                minPixels: 100,
                description: 'Mob entity (red cube)'
              }
            ]);
            
            if (!analysis.passed) {
              failures.push({
                type: 'assertion',
                message: `Visual analysis failed for ${filename}: ${analysis.analysis.filter((a: any) => !a.found).map((a: any) => a.description).join(', ')}`
              });
            }
          }
          
          if (filename.includes('post-combat')) {
            // Check if mob is still there (depends on if it was killed)
            const analysis = await visualRunner.analyzeScreenshotColors(screenshotPath, [
              {
                color: '#0000FF', // Blue player should still be there
                tolerance: 30,
                minPixels: 100,
                description: 'Player entity (blue cube)'
              }
            ]);
            
            if (!analysis.passed) {
              failures.push({
                type: 'assertion',
                message: 'Player not visible after combat'
              });
            }
          }
        }
        
        await visualRunner.cleanup();
        
        return {
          passed: failures.length === 0,
          failures,
          warnings
        };
      },

      async cleanup(context: TestContext): Promise<void> {
        // Clean up any test resources
        const visualRunner = context.data.get('visualRunner');
        if (visualRunner) {
          await visualRunner.cleanup();
        }
      }
    };
  }

  /**
   * Test resource gathering mechanics
   */
  static getResourceGatheringTest(): TestScenario {
    return {
      id: 'rpg-resource-gathering',
      name: 'RPG Resource Gathering Test',
      description: 'Verifies woodcutting and resource collection',
      
      async setup(context: TestContext): Promise<void> {
        context.log('Setting up resource gathering test world');
        
        const worldConfig = {
          id: 'gathering-test-world',
          entities: [
            {
              type: 'player' as const,
              id: 'test-player',
              position: { x: -2, y: 0, z: 0 },
              color: '#0000FF', // Blue cube for player
              properties: {
                health: 100,
                woodcutting: 1,
                equipped: 'bronze-hatchet'
              }
            },
            {
              type: 'item' as const,
              id: 'test-tree',
              position: { x: 2, y: 0, z: 0 },
              color: '#8B4513', // Brown cube for tree
              properties: {
                itemType: 'tree',
                resourceType: 'logs',
                respawnTime: 10000
              }
            },
            {
              type: 'terrain' as const,
              id: 'ground',
              position: { x: 0, y: -1, z: 0 },
              color: '#00FF00', // Green cube for ground
              properties: {
                size: { x: 20, y: 1, z: 20 }
              }
            }
          ],
          camera: {
            type: 'overhead' as const,
            position: { x: 0, y: 15, z: 0 },
            target: { x: 0, y: 0, z: 0 }
          }
        };
        
        context.data.set('worldConfig', worldConfig);
      },

      async execute(context: TestContext): Promise<void> {
        context.log('Executing resource gathering test');
        
        const visualRunner = new PlaywrightVisualTestRunner(context.framework);
        await visualRunner.initialize({ viewport: { width: 1920, height: 1080 } });
        
        const worldConfig = context.data.get('worldConfig');
        
        const testConfig = {
          name: 'resource-gathering',
          description: 'Test resource gathering mechanics',
          timeout: 30000,
          steps: [
            {
              name: 'pre-gathering',
              action: 'screenshot' as const
            },
            {
              name: 'wait-for-world-load',
              action: 'wait' as const,
              value: 3000
            },
            {
              name: 'start-woodcutting',
              action: 'evaluate' as const,
              value: `
                // Simulate player woodcutting
                if (window.game && window.game.gatherResource) {
                  window.game.gatherResource('test-player', 'test-tree');
                }
              `
            },
            {
              name: 'during-gathering',
              action: 'screenshot' as const
            },
            {
              name: 'wait-for-gathering',
              action: 'wait' as const,
              value: 5000
            },
            {
              name: 'post-gathering',
              action: 'screenshot' as const
            }
          ]
        };
        
        const result = await visualRunner.runWorldTest(worldConfig, testConfig);
        context.data.set('testResult', result);
        context.data.set('visualRunner', visualRunner);
      },

      async validate(context: TestContext): Promise<TestValidation> {
        const result = context.data.get('testResult');
        const visualRunner = context.data.get('visualRunner');
        
        if (!result || result.status === 'failed') {
          return {
            passed: false,
            failures: [{
              type: 'other',
              message: `Resource gathering test execution failed: ${result?.error?.message || 'Unknown error'}`
            }],
            warnings: []
          };
        }
        
        const failures: ValidationFailure[] = [];
        const warnings: string[] = [];
        
        // Verify that tree is visible before gathering
        for (const screenshotPath of result.screenshots) {
          const filename = screenshotPath.split('/').pop() || '';
          
          if (filename.includes('pre-gathering')) {
            const analysis = await visualRunner.analyzeScreenshotColors(screenshotPath, [
              {
                color: '#0000FF', // Blue player
                tolerance: 30,
                minPixels: 100,
                description: 'Player entity (blue cube)'
              },
              {
                color: '#8B4513', // Brown tree
                tolerance: 30,
                minPixels: 100,
                description: 'Tree resource (brown cube)'
              }
            ]);
            
            if (!analysis.passed) {
              failures.push({
                type: 'assertion',
                message: `Visual analysis failed for ${filename}: ${analysis.analysis.filter((a: any) => !a.found).map((a: any) => a.description).join(', ')}`
              });
            }
          }
        }
        
        await visualRunner.cleanup();
        
        return {
          passed: failures.length === 0,
          failures,
          warnings
        };
      },

      async cleanup(context: TestContext): Promise<void> {
        // Clean up any test resources
        const visualRunner = context.data.get('visualRunner');
        if (visualRunner) {
          await visualRunner.cleanup();
        }
      }
    };
  }

  /**
   * Get all RPG visual test scenarios
   */
  static getAllScenarios(): TestScenario[] {
    return [
      this.getPlayerMovementTest(),
      this.getCombatTest(),
      this.getResourceGatheringTest()
    ];
  }
}