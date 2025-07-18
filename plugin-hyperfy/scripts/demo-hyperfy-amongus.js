#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🎮 Hyperfy Among Us Demo');
console.log('========================\n');

console.log('This demo shows the complete Among Us implementation with:');
console.log('✅ Real Hyperfy plugin architecture');
console.log('✅ Real ElizaOS agents (simulated for demo)');
console.log('✅ WebSocket multiplayer');
console.log('✅ Physics-based proximity');
console.log('✅ Visual verification\n');

console.log('📦 Starting demo components...\n');

// Start Vite dev server
console.log('1️⃣ Starting development server...');
const viteProcess = spawn('npm', ['run', 'minigames'], {
    cwd: join(__dirname, '..'),
    stdio: ['ignore', 'pipe', 'pipe']
});

let serverReady = false;
let serverUrl = '';

viteProcess.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('Local:') && !serverReady) {
        serverReady = true;
        const match = output.match(/Local:\s+(http:\/\/localhost:\d+)/);
        if (match) {
            serverUrl = match[1];
            console.log(`✅ Dev server ready at ${serverUrl}\n`);
            launchDemo();
        }
    }
});

viteProcess.stderr.on('data', (data) => {
    console.error(`Dev server error: ${data}`);
});

async function launchDemo() {
    console.log('2️⃣ Opening Among Us demo page...');
    
    const demoUrl = `${serverUrl}/hyperfy-amongus.html`;
    console.log(`🌐 Opening: ${demoUrl}\n`);
    
    // Open in browser
    await open(demoUrl);
    
    console.log('📋 Demo Instructions:');
    console.log('====================\n');
    
    console.log('1. The page shows a 3D view of the Among Us game world');
    console.log('2. You\'ll see colored capsules representing the 8 agents');
    console.log('3. Watch the agents move around and interact with tasks');
    console.log('4. Chat messages appear in the bottom-left');
    console.log('5. Task states are shown on the right (green/yellow/blue)');
    console.log('6. Game state and player list are shown on the left\n');
    
    console.log('🎯 What to Look For:');
    console.log('- Agents moving to tasks');
    console.log('- Task colors changing (green→yellow→blue)');
    console.log('- Chat messages from agents');
    console.log('- Kill events (red agents eliminating others)');
    console.log('- Emergency meetings when bodies are found');
    console.log('- Voting phase after discussion\n');
    
    console.log('🔧 Technical Details:');
    console.log('- WebSocket connection to ws://localhost:4000/amongus');
    console.log('- Real-time position synchronization');
    console.log('- Proximity-based interactions (2.0 units)');
    console.log('- Task duration: 5-15 seconds');
    console.log('- Kill cooldown: 20 seconds\n');
    
    console.log('📊 To Verify Implementation:');
    console.log('1. Open browser DevTools (F12)');
    console.log('2. Check Console for game events');
    console.log('3. Check Network tab for WebSocket messages');
    console.log('4. Inspect window.hyperfyWorld object');
    console.log('5. Run: window.hyperfyWorld.app.getGameState()\n');
    
    console.log('🛑 Press Ctrl+C to stop the demo\n');
}

// Handle shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down demo...');
    viteProcess.kill();
    process.exit(0);
});

// Keep process alive
process.stdin.resume(); 