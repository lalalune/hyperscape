#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { SqliteDatabaseAdapter } from '@elizaos/adapter-sqlite';
import { AgentRuntime } from '@elizaos/core';
import { HyperfyService } from '../src/service.js';
import { HyperfyPlayerAdapter } from '../src/agents/hyperfy-player-adapter.js';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const characterIndex = args.indexOf('--character');
const worldIndex = args.indexOf('--world');

const characterName = characterIndex >= 0 ? args[characterIndex + 1] : 'red';
const worldUrl = worldIndex >= 0 ? args[worldIndex + 1] : 'ws://localhost:8080';

console.log(`🤖 Starting ${characterName} agent...`);

async function loadCharacter(name) {
    const characterPath = join(projectRoot, 'src', 'agents', 'characters', `${name}.json`);
    try {
        const data = await fs.readFile(characterPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Failed to load character ${name}:`, error);
        return null;
    }
}

async function main() {
    try {
        // Load character
        const character = await loadCharacter(characterName);
        if (!character) {
            console.error('❌ Failed to load character');
            process.exit(1);
        }
        
        console.log(`✅ Loaded character: ${character.name}`);
        
        // Create database adapter
        const dbPath = join(projectRoot, 'data', `agent-${characterName}.db`);
        const db = new SqliteDatabaseAdapter({ filename: dbPath });
        
        // Create agent runtime
        const runtime = new AgentRuntime({
            databaseAdapter: db,
            character,
            modelProvider: 'openai', // or whatever provider you're using
            services: []
        });
        
        // Initialize runtime
        await runtime.initialize();
        console.log('✅ Agent runtime initialized');
        
        // Create Hyperfy service
        const hyperfyService = new HyperfyService();
        
        // Create player adapter
        const playerAdapter = new HyperfyPlayerAdapter(runtime, hyperfyService);
        
        // Connect to world
        console.log(`🔌 Connecting to world at ${worldUrl}...`);
        await playerAdapter.connect(worldUrl);
        
        console.log(`✅ ${character.name} is now connected and playing!`);
        
        // Keep the process running
        process.on('SIGINT', () => {
            console.log(`\n👋 ${character.name} disconnecting...`);
            playerAdapter.disconnect();
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Error starting agent:', error);
        process.exit(1);
    }
}

main(); 