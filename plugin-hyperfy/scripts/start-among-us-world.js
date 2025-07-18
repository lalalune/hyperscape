#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

async function startAmongUsWorld() {
    console.log('🚀 Starting Among Us World Server...\n');
    
    try {
        // Import the Among Us world
        const { AmongUsWorld } = await import('../src/worlds/among-us/AmongUsWorld.ts');
        
        // Create world instance
        const world = new AmongUsWorld();
        
        // Add 8 players (2 impostors, 6 crewmates)
        console.log('Adding players...');
        world.addPlayer('agent_red', 'Red', true); // Impostor
        world.addPlayer('agent_blue', 'Blue', false);
        world.addPlayer('agent_green', 'Green', false);
        world.addPlayer('agent_yellow', 'Yellow', false);
        world.addPlayer('agent_purple', 'Purple', true); // Impostor
        world.addPlayer('agent_orange', 'Orange', false);
        world.addPlayer('agent_black', 'Black', false);
        world.addPlayer('agent_white', 'White', false);
        
        // Start the world server
        await world.start(3001);
        
        console.log('\n✅ Among Us world ready!');
        console.log('📡 WebSocket server running on ws://localhost:3001');
        console.log('\nWaiting for agents to connect...');
        
        // Start the game when all agents are connected
        setTimeout(() => {
            console.log('\n🎮 Starting game...');
            world.startGame();
        }, 5000);
        
        // Handle shutdown
        process.on('SIGINT', async () => {
            console.log('\n\nShutting down world server...');
            await world.stop();
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Failed to start world server:', error);
        process.exit(1);
    }
}

startAmongUsWorld().catch(console.error); 