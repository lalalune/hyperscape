/**
 * Minimal test to validate real runtime integration infrastructure works
 */

import { logger } from '@elizaos/core';
import { 
  createTestRuntime,
  type RuntimeConfig 
} from '@elizaos/core/test-utils';

async function runMinimalTest() {
  try {
    console.log('🧪 Starting minimal runtime integration test...');
    
    // Create minimal test runtime
    console.log('Creating test runtime...');
    const { runtime, harness } = await createTestRuntime({
      character: {
        name: 'Minimal Test Agent',
        system: 'You are a minimal test agent.',
        bio: ['I test basic runtime functionality.'],
        messageExamples: [],
        postExamples: [],
        topics: ['testing'],
        knowledge: [],
        plugins: []
      },
      plugins: [],
      apiKeys: {}
    });

    console.log(`✅ Runtime created successfully: ${runtime.agentId}`);
    
    // Test basic functionality
    console.log('Testing memory creation...');
    const testMemory = {
      entityId: runtime.agentId,
      roomId: runtime.agentId,
      content: {
        text: 'Test memory creation',
        action: 'TEST_ACTION'
      },
      createdAt: Date.now()
    };

    const memoryId = await runtime.createMemory(testMemory, 'test');
    if (!memoryId) {
      throw new Error('Failed to create memory');
    }
    console.log(`✅ Memory created: ${memoryId}`);

    // Test memory retrieval using available API
    console.log('Available runtime methods:', Object.getOwnPropertyNames(runtime).filter(name => typeof (runtime as any)[name] === 'function'));
    
    // Try to retrieve memories to validate database works
    const memories = await runtime.getMemories({
      roomId: runtime.agentId,
      count: 10,
      tableName: 'test'
    });
    
    if (!memories || memories.length === 0) {
      throw new Error('Failed to retrieve created memory');
    }
    console.log(`✅ Memory retrieved successfully: Found ${memories.length} memories`);

    const foundMemory = memories.find(m => m.id === memoryId);
    if (!foundMemory) {
      throw new Error('Created memory not found in results');
    }

    if (foundMemory.content.text !== 'Test memory creation') {
      throw new Error('Memory content mismatch');
    }
    console.log('✅ Memory content verified');

    console.log('✅ Memory system working correctly');
    
    // Cleanup
    console.log('Cleaning up...');
    await harness.cleanup();
    console.log('✅ Minimal runtime integration test completed successfully');
    
    return true;
  } catch (error) {
    console.error('❌ Minimal runtime test failed:', error);
    return false;
  }
}

// Run if executed directly
if (require.main === module) {
  runMinimalTest()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      logger.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { runMinimalTest };