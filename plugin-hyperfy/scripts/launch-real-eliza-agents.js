#!/usr/bin/env node

import { AgentRuntime, ModelProviderName, defaultCharacter } from '@elizaos/core';
import { SqliteAdapter } from '@elizaos/adapter-sqlite';
import { DirectClientInterface } from '@elizaos/client-direct';
import { HyperfyClientInterface } from '@elizaos/client-hyperfy';
import hyperfyPlugin from '../dist/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🤖 Launching REAL ElizaOS Agents for Among Us');
console.log('===========================================\n');

// Character files
const characterFiles = [
    'red.json', 'purple.json', 'blue.json', 'green.json',
    'yellow.json', 'orange.json', 'black.json', 'white.json'
];

// Game configuration
const HYPERFY_URL = process.env.HYPERFY_URL || 'ws://localhost:4000/amongus';
const MODEL_PROVIDER = process.env.MODEL_PROVIDER || ModelProviderName.OPENAI;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY && MODEL_PROVIDER === ModelProviderName.OPENAI) {
    console.error('❌ OPENAI_API_KEY environment variable required');
    console.log('\nPlease set: export OPENAI_API_KEY=your-api-key');
    process.exit(1);
}

async function createAgent(characterFile) {
    const charPath = path.join(__dirname, '..', 'src', 'agents', 'characters', characterFile);
    const characterData = JSON.parse(fs.readFileSync(charPath, 'utf-8'));
    
    // Merge with default character to ensure all required fields
    const character = {
        ...defaultCharacter,
        ...characterData,
        modelProvider: MODEL_PROVIDER,
        settings: {
            ...defaultCharacter.settings,
            ...characterData.settings,
            modelProvider: MODEL_PROVIDER
        }
    };
    
    // Create unique database for each agent
    const dbPath = path.join(__dirname, '..', 'agent-dbs', `${character.name.toLowerCase()}.db`);
    const db = new Database(dbPath);
    
    // Create runtime
    const runtime = new AgentRuntime({
        databaseAdapter: new SqliteAdapter(db),
        token: `agent-${character.name.toLowerCase()}`,
        modelProvider: MODEL_PROVIDER,
        character,
        plugins: [hyperfyPlugin]
    });
    
    // Initialize runtime
    await runtime.initialize();
    
    // Add Hyperfy client for game interaction
    const hyperfyClient = new HyperfyClientInterface({
        runtime,
        url: HYPERFY_URL,
        gameRole: character.settings.gameRole,
        agentId: runtime.agentId
    });
    
    await hyperfyClient.start();
    
    // Add direct client for decision making
    const directClient = new DirectClientInterface({
        runtime,
        frequency: 2000 // Make decisions every 2 seconds
    });
    
    await directClient.start();
    
    console.log(`✅ ${character.settings.emoji} ${character.name} (${character.settings.gameRole}) - Real AI agent started`);
    
    return { runtime, hyperfyClient, directClient, character };
}

async function startAgents() {
    console.log('🚀 Starting real ElizaOS agents with AI decision making...\n');
    
    // Create agent database directory
    const dbDir = path.join(__dirname, '..', 'agent-dbs');
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    
    const agents = [];
    
    // Start all agents
    for (const charFile of characterFiles) {
        try {
            const agent = await createAgent(charFile);
            agents.push(agent);
            
            // Add a small delay between agent starts
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`❌ Failed to start agent from ${charFile}:`, error);
        }
    }
    
    console.log(`\n✅ Successfully started ${agents.length} REAL AI agents!`);
    console.log('\n📊 What makes these agents REAL:');
    console.log('   - Using actual ElizaOS AgentRuntime');
    console.log('   - Connected to language model (GPT-4)');
    console.log('   - Making autonomous decisions');
    console.log('   - Unique personalities and strategies');
    console.log('   - Real-time game state evaluation');
    console.log('   - Dynamic chat generation\n');
    
    // Monitor agent activity
    let messageCount = 0;
    let decisionCount = 0;
    const uniqueMessages = new Set();
    
    agents.forEach(({ runtime, character }) => {
        runtime.on('message', (message) => {
            messageCount++;
            uniqueMessages.add(message.content.text);
            console.log(`💬 ${character.settings.emoji} ${character.name}: ${message.content.text}`);
        });
        
        runtime.on('decision', (decision) => {
            decisionCount++;
            console.log(`🎯 ${character.settings.emoji} ${character.name} decided: ${decision.action}`);
        });
    });
    
    // Status updates
    setInterval(() => {
        console.log(`\n📊 Stats: ${messageCount} messages (${uniqueMessages.size} unique), ${decisionCount} AI decisions`);
    }, 10000);
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n\n🛑 Shutting down agents...');
        
        for (const { runtime, hyperfyClient, directClient } of agents) {
            await directClient.stop();
            await hyperfyClient.stop();
            await runtime.stop();
        }
        
        process.exit(0);
    });
}

// Start the agents
startAgents().catch(error => {
    console.error('❌ Failed to start agents:', error);
    process.exit(1);
}); 