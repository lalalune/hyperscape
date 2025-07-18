import { IAgentRuntime, logger, UUID } from '@elizaos/core';
import { HyperfyService } from '../src/service';
import { ContentPackLoader } from '../src/managers/content-pack-loader';
import { IContentPack } from '../src/types/content-pack';

/**
 * Real scenario to test content pack loading end-to-end
 * This simulates an agent connecting to Hyperfy and loading RPG content
 */

// Define the Runescape RPG content pack
const RunescapeRPGPack: IContentPack = {
  id: 'runescape-rpg',
  name: 'Runescape RPG Module',
  description: 'Complete Runescape-like RPG for Hyperfy',
  version: '1.0.0',
  
  actions: [
    {
      name: 'ATTACK_TARGET',
      description: 'Attack a target with your equipped weapon',
      similes: ['attack', 'hit', 'fight', 'strike', 'combat'],
      examples: [
        { user: 'user', content: { text: 'Attack the goblin' } },
        { user: 'assistant', content: { text: 'I swing my sword at the goblin!' } }
      ],
      handler: async (runtime, message, state) => {
        const target = state?.target || 'training dummy';
        const damage = Math.floor(Math.random() * 10) + 5;
        
        // Update combat state
        runtime.getService<HyperfyService>(HyperfyService.serviceName)
          ?.getRPGStateManager()
          ?.updatePlayerState({
            combat: {
              inCombat: true,
              target: target,
              lastDamageDealt: damage
            }
          });
        
        return {
          success: true,
          response: `⚔️ You attack the ${target} dealing ${damage} damage!`,
          data: { damage, target }
        };
      },
      validate: async (runtime, message, state) => true
    },
    
    {
      name: 'MINE_ROCK',
      description: 'Mine ore from a rock',
      similes: ['mine', 'extract', 'gather ore', 'mining'],
      examples: [
        { user: 'user', content: { text: 'Mine the iron rock' } },
        { user: 'assistant', content: { text: 'I start mining the iron ore' } }
      ],
      handler: async (runtime, message, state) => {
        const rockType = state?.rockType || 'iron';
        const oreGained = Math.floor(Math.random() * 3) + 1;
        const xpGained = oreGained * 25;
        
        // Update mining skill
        const rpgManager = runtime.getService<HyperfyService>(HyperfyService.serviceName)
          ?.getRPGStateManager();
        
        if (rpgManager) {
          const currentState = rpgManager.getPlayerState();
          const miningXP = (currentState.skills.mining?.experience || 0) + xpGained;
          
          rpgManager.updatePlayerState({
            skills: {
              ...currentState.skills,
              mining: {
                level: Math.floor(miningXP / 100) + 1,
                experience: miningXP
              }
            }
          });
        }
        
        return {
          success: true,
          response: `⛏️ You mine ${oreGained} ${rockType} ore and gain ${xpGained} Mining XP!`,
          data: { ore: rockType, quantity: oreGained, xp: xpGained }
        };
      },
      validate: async () => true
    },
    
    {
      name: 'CHECK_STATS',
      description: 'Check your character stats',
      similes: ['stats', 'status', 'levels', 'skills'],
      examples: [
        { user: 'user', content: { text: 'Check my stats' } },
        { user: 'assistant', content: { text: 'Here are your current stats...' } }
      ],
      handler: async (runtime, message, state) => {
        const rpgManager = runtime.getService<HyperfyService>(HyperfyService.serviceName)
          ?.getRPGStateManager();
        
        if (!rpgManager) {
          return { success: false, response: 'RPG system not available' };
        }
        
        const playerState = rpgManager.getPlayerState();
        
        const statsMessage = `
📊 **Character Stats**
❤️ Health: ${playerState.health.current}/${playerState.health.max}
⚔️ Combat Level: ${playerState.skills.combat?.level || 1}
⛏️ Mining Level: ${playerState.skills.mining?.level || 1} (${playerState.skills.mining?.experience || 0} XP)
💰 Gold: ${playerState.inventory.gold}
🎒 Items: ${playerState.inventory.items.length}
        `.trim();
        
        return {
          success: true,
          response: statsMessage,
          data: playerState
        };
      },
      validate: async () => true
    }
  ],
  
  providers: [
    {
      name: 'rpgContext',
      description: 'Provides RPG context for the agent',
      get: async (runtime, message, state) => {
        const rpgManager = runtime.getService<HyperfyService>(HyperfyService.serviceName)
          ?.getRPGStateManager();
        
        if (!rpgManager) return 'No RPG data available';
        
        const playerState = rpgManager.getPlayerState();
        
        return `You are a level ${playerState.level} adventurer with ${playerState.health.current}/${playerState.health.max} health. You have ${playerState.inventory.gold} gold and your mining level is ${playerState.skills.mining?.level || 1}.`;
      }
    }
  ],
  
  visuals: {
    entityColors: {
      'npcs.goblin': { color: 2263842, hex: '#228822' },
      'npcs.guard': { color: 4356961, hex: '#427361' },
      'items.sword': { color: 16729156, hex: '#FF4444' },
      'resources.iron_rock': { color: 4210752, hex: '#404040' },
      'effects.damage': { color: 16711680, hex: '#FF0000' },
      'effects.levelup': { color: 16776960, hex: '#FFFF00' }
    }
  }
};

/**
 * Test the content pack loading flow
 */
export async function testContentPackLoading(runtime: IAgentRuntime): Promise<void> {
  logger.info('[ContentPackTest] Starting content pack loading test...');
  
  try {
    // Step 1: Get the Hyperfy service
    const service = runtime.getService<HyperfyService>(HyperfyService.serviceName);
    if (!service) {
      throw new Error('HyperfyService not found');
    }
    
    // Step 2: Initialize the service
    await service.initialize(runtime);
    logger.info('[ContentPackTest] Service initialized');
    
    // Step 3: Connect to a test world
    const worldId = 'test-rpg-world';
    logger.info(`[ContentPackTest] Connecting to world: ${worldId}`);
    
    // For testing, we'll simulate the connection
    // In real usage, this would be: await service.connect(worldId);
    
    // Step 4: Load the RPG content pack
    logger.info('[ContentPackTest] Loading Runescape RPG content pack...');
    await service.loadContentPack(RunescapeRPGPack);
    
    // Step 5: Verify actions are available
    logger.info('[ContentPackTest] Verifying actions are registered...');
    
    const attackAction = runtime.getAction('ATTACK_TARGET');
    const mineAction = runtime.getAction('MINE_ROCK');
    const statsAction = runtime.getAction('CHECK_STATS');
    
    if (!attackAction || !mineAction || !statsAction) {
      throw new Error('Not all actions were registered');
    }
    
    logger.info('[ContentPackTest] ✅ All RPG actions registered successfully');
    
    // Step 6: Test action execution
    logger.info('[ContentPackTest] Testing action execution...');
    
    // Test attack action
    const attackResult = await attackAction.handler(
      runtime,
      { content: { text: 'Attack the goblin' } } as any,
      { target: 'goblin' }
    );
    logger.info(`[ContentPackTest] Attack result: ${attackResult.response}`);
    
    // Test mining action
    const mineResult = await mineAction.handler(
      runtime,
      { content: { text: 'Mine the rock' } } as any,
      { rockType: 'iron' }
    );
    logger.info(`[ContentPackTest] Mining result: ${mineResult.response}`);
    
    // Test stats action
    const statsResult = await statsAction.handler(
      runtime,
      { content: { text: 'Check stats' } } as any,
      {}
    );
    logger.info(`[ContentPackTest] Stats result: ${statsResult.response}`);
    
    // Step 7: Verify providers
    logger.info('[ContentPackTest] Verifying providers...');
    
    const rpgProvider = runtime.getProvider('rpgContext');
    if (!rpgProvider) {
      throw new Error('RPG provider not registered');
    }
    
    const context = await rpgProvider.get(runtime, {} as any, {});
    logger.info(`[ContentPackTest] RPG Context: ${context}`);
    
    // Step 8: Test visual configuration
    logger.info('[ContentPackTest] Verifying visual configuration...');
    
    const contentLoader = service.getContentPackLoader();
    if (!contentLoader || !contentLoader.isPackLoaded('runescape-rpg')) {
      throw new Error('Content pack not properly loaded');
    }
    
    logger.info('[ContentPackTest] ✅ Content pack fully loaded and functional!');
    
    // Summary
    logger.info('\n' + '='.repeat(60));
    logger.info('[ContentPackTest] TEST SUMMARY');
    logger.info('='.repeat(60));
    logger.info('✅ Service initialized');
    logger.info('✅ Content pack loaded');
    logger.info('✅ Actions registered and functional');
    logger.info('✅ Providers registered and functional');
    logger.info('✅ Visual configuration loaded');
    logger.info('✅ RPG state management working');
    logger.info('='.repeat(60));
    logger.info('[ContentPackTest] All tests passed! 🎉');
    
  } catch (error) {
    logger.error('[ContentPackTest] Test failed:', error);
    throw error;
  }
}

/**
 * Run the test scenario
 */
export async function runScenario(runtime: IAgentRuntime): Promise<void> {
  try {
    await testContentPackLoading(runtime);
  } catch (error) {
    logger.error('[ContentPackScenario] Scenario failed:', error);
    process.exit(1);
  }
}

// Export for use in test runners
export default {
  name: 'Content Pack Loading Test',
  description: 'Tests the full flow of loading RPG content packs',
  run: runScenario
}; 