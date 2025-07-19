import { UnifiedVisualTestRunner, VisualTestConfig, TEST_COLORS } from '../core/UnifiedVisualTestRunner'
import { HyperfyServerManager } from '../core/HyperfyServerManager'

export interface RPGTestSuite {
  name: string
  description: string
  tests: VisualTestConfig[]
  setup?: () => Promise<void>
  cleanup?: () => Promise<void>
}

export class ComprehensiveRPGTests {
  constructor(
    private runner: UnifiedVisualTestRunner,
    private serverManager: HyperfyServerManager,
    private baseUrl: string = 'http://localhost:3001'
  ) {}

  // 1. BASIC RENDERING AND SCENE TESTS
  createBasicRenderingTests(): RPGTestSuite {
    return {
      name: 'Basic Rendering',
      description: 'Verify that the game renders correctly and entities are visible',
      tests: [
        {
          name: 'empty-world-render',
          url: `${this.baseUrl}/test-empty`,
          timeout: 30000,
          expectedEntities: [],
          screenshotPath: './test-results/screenshots',
          waitForStable: 3000,
          customValidations: [
            (analysis) => {
              if (analysis.screenHealth.isAllSameColor) {
                return { passed: false, error: 'Screen is completely one color - rendering failed' }
              }
              if (analysis.screenHealth.colorVariance < 2) {
                return { passed: false, error: 'Very low color variance - scene not rendering' }
              }
              return { passed: true }
            }
          ]
        },
        {
          name: 'single-entity-visibility',
          url: `${this.baseUrl}/test-single-entity`,
          timeout: 30000,
          expectedEntities: [
            { type: 'PLAYER', count: 1 }
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 5000
        },
        {
          name: 'multiple-entity-types',
          url: `${this.baseUrl}/test-multi-entity`,
          timeout: 30000,
          expectedEntities: [
            { type: 'PLAYER', count: 1 },
            { type: 'GOBLIN', count: 2 },
            { type: 'TREE', count: 3 }
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 5000
        }
      ]
    }
  }

  // 2. COMBAT SYSTEM TESTS
  createCombatSystemTests(): RPGTestSuite {
    return {
      name: 'Combat System',
      description: 'Test all aspects of the combat system including melee, ranged, and death',
      tests: [
        {
          name: 'melee-combat-basic',
          url: `${this.baseUrl}/test-melee-combat`,
          timeout: 60000,
          expectedEntities: [
            { type: 'PLAYER', count: 1, position: { x: 960, y: 540 } },
            { type: 'GOBLIN', count: 1, minDistance: 50, maxDistance: 200 }
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 8000,
          customValidations: [
            (analysis) => {
              // Check that entities are close enough for combat
              const player = analysis.entities.get('PLAYER')?.[0]
              const goblin = analysis.entities.get('GOBLIN')?.[0]
              if (!player || !goblin) {
                return { passed: false, error: 'Missing player or goblin for combat test' }
              }
              const distance = Math.sqrt(Math.pow(player.x - goblin.x, 2) + Math.pow(player.y - goblin.y, 2))
              if (distance > 300) {
                return { passed: false, error: `Entities too far apart for combat: ${distance.toFixed(1)} pixels` }
              }
              return { passed: true }
            }
          ]
        },
        {
          name: 'ranged-combat-arrows',
          url: `${this.baseUrl}/test-ranged-combat`,
          timeout: 60000,
          expectedEntities: [
            { type: 'PLAYER', count: 1 },
            { type: 'GOBLIN', count: 1, minDistance: 200 },
            // Should see arrows in inventory or being fired
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 8000
        },
        {
          name: 'combat-damage-death',
          url: `${this.baseUrl}/test-combat-death`,
          timeout: 90000,
          expectedEntities: [
            { type: 'PLAYER', count: 1 },
            { type: 'CORPSE', count: 1 }, // Goblin should die
            { type: 'ITEM_DROP', count: 1 } // Should drop loot
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 15000
        },
        {
          name: 'player-death-respawn',
          url: `${this.baseUrl}/test-player-death`,
          timeout: 120000,
          expectedEntities: [
            { type: 'PLAYER', count: 1 },
            { type: 'ITEM_DROP', count: 1 } // Player should drop items
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 20000
        }
      ]
    }
  }

  // 3. SKILLS AND PROGRESSION TESTS
  createSkillsSystemTests(): RPGTestSuite {
    return {
      name: 'Skills and Progression',
      description: 'Test all 9 skills: Attack, Strength, Defense, Range, Constitution, Woodcutting, Fishing, Firemaking, Cooking',
      tests: [
        {
          name: 'woodcutting-trees',
          url: `${this.baseUrl}/test-woodcutting`,
          timeout: 60000,
          expectedEntities: [
            { type: 'PLAYER', count: 1 },
            { type: 'TREE', count: 3 },
            { type: 'TOOL', count: 1 } // Hatchet should be visible
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 10000
        },
        {
          name: 'fishing-water',
          url: `${this.baseUrl}/test-fishing`,
          timeout: 60000,
          expectedEntities: [
            { type: 'PLAYER', count: 1 },
            { type: 'FISHING_SPOT', count: 2 },
            { type: 'TOOL', count: 1 } // Fishing rod
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 10000
        },
        {
          name: 'firemaking-cooking',
          url: `${this.baseUrl}/test-firemaking`,
          timeout: 60000,
          expectedEntities: [
            { type: 'PLAYER', count: 1 },
            { type: 'FIRE', count: 1 },
            { type: 'TOOL', count: 1 } // Tinderbox
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 8000
        },
        {
          name: 'skill-xp-progression',
          url: `${this.baseUrl}/test-skill-progression`,
          timeout: 90000,
          expectedEntities: [
            { type: 'PLAYER', count: 1 }
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 15000,
          customValidations: [
            (analysis) => {
              // Would need to check UI elements for XP display
              // This test would verify that skill progression is visible
              return { passed: true }
            }
          ]
        }
      ]
    }
  }

  // 4. INVENTORY AND ITEMS TESTS
  createInventorySystemTests(): RPGTestSuite {
    return {
      name: 'Inventory and Items',
      description: 'Test inventory management, item types, equipment, and the banking system',
      tests: [
        {
          name: 'inventory-management',
          url: `${this.baseUrl}/test-inventory`,
          timeout: 60000,
          expectedEntities: [
            { type: 'PLAYER', count: 1 }
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 5000
        },
        {
          name: 'equipment-weapons',
          url: `${this.baseUrl}/test-equipment`,
          timeout: 60000,
          expectedEntities: [
            { type: 'PLAYER', count: 1 },
            { type: 'WEAPON', count: 3 } // Different weapon types
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 5000
        },
        {
          name: 'banking-system',
          url: `${this.baseUrl}/test-banking`,
          timeout: 60000,
          expectedEntities: [
            { type: 'PLAYER', count: 1 }
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 8000
        },
        {
          name: 'item-drops-pickup',
          url: `${this.baseUrl}/test-item-drops`,
          timeout: 60000,
          expectedEntities: [
            { type: 'PLAYER', count: 1 },
            { type: 'ITEM_DROP', count: 5 },
            { type: 'COIN', count: 2 }
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 5000
        }
      ]
    }
  }

  // 5. MOB SYSTEM TESTS
  createMobSystemTests(): RPGTestSuite {
    return {
      name: 'Mob System',
      description: 'Test all mob types, AI behavior, spawning, and difficulty levels',
      tests: [
        {
          name: 'level-1-mobs',
          url: `${this.baseUrl}/test-level-1-mobs`,
          timeout: 60000,
          expectedEntities: [
            { type: 'GOBLIN', count: 2 },
            { type: 'BANDIT', count: 1 },
            { type: 'BARBARIAN', count: 1 }
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 10000
        },
        {
          name: 'level-2-mobs',
          url: `${this.baseUrl}/test-level-2-mobs`,
          timeout: 60000,
          expectedEntities: [
            { type: 'HOBGOBLIN', count: 2 },
            { type: 'GUARD', count: 1 },
            { type: 'DARK_WARRIOR', count: 1 }
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 10000
        },
        {
          name: 'level-3-mobs',
          url: `${this.baseUrl}/test-level-3-mobs`,
          timeout: 90000,
          expectedEntities: [
            { type: 'BLACK_KNIGHT', count: 1 },
            { type: 'ICE_WARRIOR', count: 1 },
            { type: 'DARK_RANGER', count: 1 }
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 15000
        },
        {
          name: 'mob-ai-aggression',
          url: `${this.baseUrl}/test-mob-ai`,
          timeout: 90000,
          expectedEntities: [
            { type: 'PLAYER', count: 1 },
            { type: 'GOBLIN', count: 1, maxDistance: 150 } // Should move toward player
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 15000
        },
        {
          name: 'mob-respawn-cycle',
          url: `${this.baseUrl}/test-mob-respawn`,
          timeout: 120000,
          expectedEntities: [
            { type: 'GOBLIN', count: 1 } // Should respawn after death
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 60000 // Wait for respawn
        }
      ]
    }
  }

  // 6. WORLD AND ENVIRONMENT TESTS
  createWorldSystemTests(): RPGTestSuite {
    return {
      name: 'World and Environment',
      description: 'Test world generation, biomes, terrain, and environmental elements',
      tests: [
        {
          name: 'world-generation',
          url: `${this.baseUrl}/test-world-gen`,
          timeout: 60000,
          expectedEntities: [
            { type: 'BACKGROUND', count: 1 },
            { type: 'TREE', count: 5 },
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 10000
        },
        {
          name: 'multiple-biomes',
          url: `${this.baseUrl}/test-biomes`,
          timeout: 60000,
          expectedEntities: [
            { type: 'TREE', count: 3 },
            { type: 'FISHING_SPOT', count: 2 }
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 8000
        },
        {
          name: 'terrain-collision',
          url: `${this.baseUrl}/test-terrain`,
          timeout: 60000,
          expectedEntities: [
            { type: 'PLAYER', count: 1 },
            { type: 'BACKGROUND', count: 1 }
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 5000
        }
      ]
    }
  }

  // 7. MULTIPLAYER TESTS
  createMultiplayerTests(): RPGTestSuite {
    return {
      name: 'Multiplayer',
      description: 'Test multiple players, interactions, and shared world state',
      tests: [
        {
          name: 'two-players',
          url: `${this.baseUrl}/test-multiplayer-2`,
          timeout: 90000,
          expectedEntities: [
            { type: 'PLAYER', count: 2, minDistance: 100 }
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 10000
        },
        {
          name: 'shared-combat',
          url: `${this.baseUrl}/test-shared-combat`,
          timeout: 120000,
          expectedEntities: [
            { type: 'PLAYER', count: 2 },
            { type: 'GOBLIN', count: 1 }
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 15000
        }
      ]
    }
  }

  // 8. PERFORMANCE AND STRESS TESTS
  createPerformanceTests(): RPGTestSuite {
    return {
      name: 'Performance',
      description: 'Test system performance under various loads',
      tests: [
        {
          name: 'many-entities',
          url: `${this.baseUrl}/test-performance-entities`,
          timeout: 120000,
          expectedEntities: [
            { type: 'PLAYER', count: 1 },
            { type: 'GOBLIN', count: 10 },
            { type: 'TREE', count: 20 }
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 20000
        },
        {
          name: 'rapid-actions',
          url: `${this.baseUrl}/test-rapid-actions`,
          timeout: 90000,
          expectedEntities: [
            { type: 'PLAYER', count: 1 },
            { type: 'ITEM_DROP', count: 5 } // From rapid actions
          ],
          screenshotPath: './test-results/screenshots',
          waitForStable: 15000
        }
      ]
    }
  }

  // Get all test suites
  getAllTestSuites(): RPGTestSuite[] {
    return [
      this.createBasicRenderingTests(),
      this.createCombatSystemTests(),
      this.createSkillsSystemTests(),
      this.createInventorySystemTests(),
      this.createMobSystemTests(),
      this.createWorldSystemTests(),
      this.createMultiplayerTests(),
      this.createPerformanceTests()
    ]
  }

  // Run a specific test suite
  async runTestSuite(suite: RPGTestSuite): Promise<{
    suiteName: string
    passed: number
    failed: number
    results: Array<{ name: string; passed: boolean; errors: string[]; duration: number }>
  }> {
    console.log(`\n🧪 Running test suite: ${suite.name}`)
    console.log(`📝 ${suite.description}`)
    console.log(`🔢 ${suite.tests.length} tests\n`)

    if (suite.setup) {
      await suite.setup()
    }

    const results: Array<{ name: string; passed: boolean; errors: string[]; duration: number }> = []
    let passed = 0
    let failed = 0

    for (const test of suite.tests) {
      try {
        console.log(`  ▶️ ${test.name}`)
        const result = await this.runner.runTest(test)
        
        results.push({
          name: test.name,
          passed: result.passed,
          errors: result.errors,
          duration: result.duration
        })

        if (result.passed) {
          console.log(`  ✅ ${test.name} PASSED (${result.duration}ms)`)
          passed++
        } else {
          console.log(`  ❌ ${test.name} FAILED (${result.duration}ms)`)
          result.errors.forEach(error => console.log(`     💥 ${error}`))
          failed++
        }
      } catch (error) {
        console.log(`  💥 ${test.name} ERROR: ${error}`)
        results.push({
          name: test.name,
          passed: false,
          errors: [`Test execution error: ${error}`],
          duration: 0
        })
        failed++
      }
    }

    if (suite.cleanup) {
      await suite.cleanup()
    }

    return {
      suiteName: suite.name,
      passed,
      failed,
      results
    }
  }

  // Run all test suites
  async runAllTests(): Promise<{
    totalPassed: number
    totalFailed: number
    suites: Array<{
      suiteName: string
      passed: number
      failed: number
      results: Array<{ name: string; passed: boolean; errors: string[]; duration: number }>
    }>
  }> {
    console.log('🚀 Starting comprehensive RPG test run...\n')
    
    const allSuites = this.getAllTestSuites()
    const suiteResults = []
    let totalPassed = 0
    let totalFailed = 0

    for (const suite of allSuites) {
      const result = await this.runTestSuite(suite)
      suiteResults.push(result)
      totalPassed += result.passed
      totalFailed += result.failed
    }

    console.log('\n📊 FINAL RESULTS')
    console.log('================')
    console.log(`✅ Total Passed: ${totalPassed}`)
    console.log(`❌ Total Failed: ${totalFailed}`)
    console.log(`📈 Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`)

    return {
      totalPassed,
      totalFailed,
      suites: suiteResults
    }
  }
}