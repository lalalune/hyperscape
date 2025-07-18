#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log(`
🎮 Hyperfy Among Us - Multiplayer Game
=====================================
This runs Among Us as a Hyperfy game bundle where both AI agents
and human players can join and play together!

Features:
- Real-time multiplayer gameplay
- AI agents connect as regular players
- Human players can join via browser
- Built-in chat and game UI
- Task completion system
- Impostor/Crewmate roles
- Emergency meetings and voting

Architecture:
- Game logic runs as a Hyperfy bundle
- Both AI and humans use the same player system
- WebSocket connections for all players
- Shared game state and UI
`);

async function startHyperfyWorld() {
    console.log('\n📡 Starting Hyperfy world server...');
    
    // Create a simple Hyperfy world config
    const worldConfig = {
        name: 'Among Us World',
        bundle: 'amongus',
        maxPlayers: 10,
        public: true
    };
    
    await fs.writeFile(
        join(projectRoot, 'worlds', 'amongus-config.json'),
        JSON.stringify(worldConfig, null, 2)
    );
    
    return new Promise((resolve, reject) => {
        const server = spawn('node', [
            join(projectRoot, 'scripts', 'start-hyperfy-world.js'),
            '--config', 'worlds/amongus-config.json'
        ], {
            cwd: projectRoot,
            stdio: 'pipe'
        });
        
        server.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(output);
            if (output.includes('World server started')) {
                resolve(server);
            }
        });
        
        server.stderr.on('data', (data) => {
            console.error('Server error:', data.toString());
        });
        
        server.on('error', reject);
    });
}

async function startAIAgents() {
    console.log('\n🤖 Starting AI agents...');
    
    const agentColors = ['Red', 'Blue', 'Green', 'Yellow', 'Orange'];
    const agents = [];
    
    for (const color of agentColors) {
        console.log(`Starting ${color} agent...`);
        
        const agent = spawn('node', [
            join(projectRoot, 'scripts', 'run-hyperfy-agent.js'),
            '--character', color.toLowerCase(),
            '--world', 'ws://localhost:8080'
        ], {
            cwd: projectRoot,
            stdio: 'inherit'
        });
        
        agents.push(agent);
        
        // Stagger agent starts
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return agents;
}

async function main() {
    try {
        // Start the Hyperfy world server
        const worldServer = await startHyperfyWorld();
        console.log('✅ World server is running');
        
        // Give server time to fully initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Start AI agents
        const agents = await startAIAgents();
        console.log(`✅ Started ${agents.length} AI agents`);
        
        console.log(`
🎮 Game is now running!
====================

Human players can join at:
http://localhost:3000/world/amongus

AI agents are connecting and will start playing automatically.

Game Controls:
- Move: WASD or Arrow keys
- Interact: E or Click
- Chat: Enter key
- Report Body: R key when near
- Emergency Meeting: Click button in cafeteria

Commands:
- /kill <player> - Kill a player (impostor only)
- /vote <player> - Vote during meetings
- /vote skip - Skip voting
- /emergency - Call emergency meeting

Press Ctrl+C to stop the game.
        `);
        
        // Handle cleanup
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down...');
            
            // Kill all agents
            agents.forEach(agent => agent.kill());
            
            // Kill world server
            worldServer.kill();
            
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Error starting game:', error);
        process.exit(1);
    }
}

main(); 