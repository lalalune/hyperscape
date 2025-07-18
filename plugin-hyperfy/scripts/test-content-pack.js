#!/usr/bin/env node

/**
 * Test script for content pack loading
 * This creates a real agent and tests the full flow
 */

const { createAgentRuntime } = require('@elizaos/core');
const { HyperfyService, hyperfyPlugin } = require('../dist');
const contentPackScenario = require('../dist/scenarios/test-content-pack-loading').default;

async function main() {
  console.log('🚀 Starting Content Pack Loading Test\n');
  
  try {
    // Create a test runtime configuration
    const runtimeConfig = {
      agentId: 'test-agent-' + Date.now(),
      serverUrl: 'http://localhost:3000',
      token: 'test-token',
      modelProvider: 'openai', // Can be mocked for testing
      character: {
        name: 'TestRPGAgent',
        description: 'An agent for testing RPG content pack loading',
        bio: 'I am a test agent designed to verify content pack functionality'
      },
      plugins: [hyperfyPlugin]
    };
    
    // Create the agent runtime
    console.log('Creating agent runtime...');
    const runtime = await createAgentRuntime(runtimeConfig);
    
    // Initialize the Hyperfy plugin
    console.log('Initializing Hyperfy plugin...');
    await hyperfyPlugin.init?.(runtime);
    
    // Get the service
    const service = runtime.getService(HyperfyService.serviceName);
    if (!service) {
      throw new Error('HyperfyService not initialized');
    }
    
    // Run the content pack loading scenario
    console.log('Running content pack loading scenario...\n');
    await contentPackScenario.run(runtime);
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Alternative test that doesn't require full runtime
async function testWithMockRuntime() {
  console.log('🧪 Running with mock runtime...\n');
  
  const mockRuntime = {
    agentId: 'mock-agent',
    serverUrl: 'http://localhost:3000',
    token: 'mock-token',
    modelProvider: 'mock',
    character: { name: 'MockAgent' },
    
    // Action/Provider registry
    _actions: new Map(),
    _providers: new Map(),
    
    registerAction: function(action) {
      this._actions.set(action.name, action);
      console.log(`✅ Registered action: ${action.name}`);
    },
    
    registerProvider: function(provider) {
      this._providers.set(provider.name, provider);
      console.log(`✅ Registered provider: ${provider.name}`);
    },
    
    getAction: function(name) {
      return this._actions.get(name);
    },
    
    getProvider: function(name) {
      return this._providers.get(name);
    },
    
    // Service registry
    _services: new Map(),
    
    registerService: function(service) {
      this._services.set(service.constructor.serviceName || service.name, service);
    },
    
    getService: function(name) {
      return this._services.get(name);
    },
    
    // Stub other methods
    registerEvaluator: () => {},
    getSetting: () => null,
    getConversationLength: () => 0,
    processActions: async () => [],
    evaluate: async () => [],
    findNearestCachedMemory: async () => null,
    
    // Mock database
    databaseAdapter: {
      init: async () => {},
      close: async () => {},
      createMemory: async () => {},
      getMemories: async () => [],
      searchMemories: async () => []
    },
    
    messageManager: {
      createMemory: () => {},
      addEmbeddingToMemory: async () => {},
      getMemories: async () => []
    },
    
    descriptionManager: {
      getDescription: () => 'Mock description'
    },
    
    loreManager: {
      getLore: () => []
    }
  };
  
  // Create and register service
  const service = new HyperfyService();
  mockRuntime.registerService(service);
  
  // Run the scenario
  const { testContentPackLoading } = require('../dist/scenarios/test-content-pack-loading');
  await testContentPackLoading(mockRuntime);
}

// Command line argument handling
const args = process.argv.slice(2);
const useMock = args.includes('--mock');

if (useMock) {
  testWithMockRuntime().catch(console.error);
} else {
  main().catch(console.error);
}

console.log('\nUsage:');
console.log('  npm run test:content-pack        # Run with real runtime');
console.log('  npm run test:content-pack:mock   # Run with mock runtime'); 