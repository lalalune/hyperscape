#!/usr/bin/env node

import { AmongUsWorld } from '../src/worlds/among-us/AmongUsWorld.ts';
import WebSocket from 'ws';

console.log('🌍 Starting Among Us World Server...\n');

async function startWorldServer() {
    try {
        // Check if WebSocket server is already running
        const testWs = new WebSocket('ws://localhost:3001');
        
        await new Promise((resolve, reject) => {
            testWs.on('open', () => {
                console.log('⚠️  WebSocket server already running on port 3001');
                testWs.close();
                resolve(true);
            });
            
            testWs.on('error', () => {
                // Server not running, we can start it
                resolve(false);
            });
        });
        
        if (testWs.readyState === WebSocket.OPEN || testWs.readyState === WebSocket.CONNECTING) {
            testWs.close();
            console.log('Server already running. Exiting...');
            return;
        }
    } catch (e) {
        // Server not running, continue
    }
    
    // Create and start the world
    const world = new AmongUsWorld();
    
    await world.start(3001);
    
    console.log(`
✅ Among Us World Server Started!

📡 WebSocket Server: ws://localhost:3001
🎮 Game State: Ready
🤖 Waiting for agent connections...

The server will handle:
- Real agent connections
- Game state management
- Position updates
- Task assignments
- Kill/report mechanics

Press Ctrl+C to stop the server.
    `);
    
    // Keep the process alive
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down world server...');
        await world.stop();
        process.exit(0);
    });
    
    // Prevent process from exiting
    setInterval(() => {}, 1000);
}

startWorldServer().catch(error => {
    console.error('❌ Failed to start world server:', error);
    process.exit(1);
}); 