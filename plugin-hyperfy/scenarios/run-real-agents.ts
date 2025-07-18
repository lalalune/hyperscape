#!/usr/bin/env tsx

/**
 * Run Real Among Us Agents
 * This uses the existing HyperfyService - no separate WebSocket needed!
 */

import {
    AgentRuntime,
    ModelProviderName,
    elizaLogger,
    SqliteAdapter,
    MemoryManager,
    stringToUuid
} from '@elizaos/core';
import Database from 'better-sqlite3';

// Import plugins
import { hyperfyPlugin } from '../src/index.js';
import { amongUsPlugin } from '../src/plugins/amongus-plugin.js';

// Simple test character
const testCharacter = {
    id: stringToUuid('test-agent'),
    name: 'TestAgent',
    clients: [],
    modelProvider: ModelProviderName.OPENAI,
    settings: {
        secrets: {},
        voice: { model: 'en' }
    },
    bio: ['A test agent playing Among Us'],
    lore: ['Loves completing tasks'],
    messageExamples: [],
    postExamples: [],
    topics: ['games'],
    style: {
        all: ['helpful'],
        chat: ['friendly'],
        post: ['brief']
    },
    adjectives: ['friendly']
};

async function main() {
    elizaLogger.info('Starting real Among Us agent...');
    
    // Create database
    const db = new Database(':memory:');
    
    // Create runtime
    const runtime = new AgentRuntime({
        databaseAdapter: new SqliteAdapter(db),
        token: process.env.OPENAI_API_KEY || '',
        modelProvider: ModelProviderName.OPENAI,
        character: testCharacter,
        plugins: [hyperfyPlugin, amongUsPlugin],
        providers: [],
        actions: [],
        services: [],
        managers: [new MemoryManager()]
    });
    
    // Initialize
    await runtime.initialize();
    elizaLogger.info('Runtime initialized');
    
    // Get services (they're initialized by plugins)
    const hyperfyService = runtime.getService('hyperfy');
    const gameService = runtime.getService('amongus');
    
    if (!hyperfyService || !gameService) {
        elizaLogger.error('Services not found!');
        process.exit(1);
    }
    
    elizaLogger.info('Services found!');
    
    // The HyperfyService is already connected by the plugin
    elizaLogger.info('HyperfyService handles the WebSocket connection');
    
    // Simple game loop
    setInterval(async () => {
        // The agent will use its actions to play
        elizaLogger.info('Agent thinking...');
    }, 5000);
}

main().catch(error => {
    elizaLogger.error('Error:', error);
    process.exit(1);
}); 