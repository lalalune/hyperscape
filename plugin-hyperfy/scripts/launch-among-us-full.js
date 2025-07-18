#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Launching Among Us Complete System');
console.log('=====================================');

const processes = [];

// Step 1: Start the Hyperfy world server
console.log('\n1️⃣ Starting Hyperfy World Server...');
const worldServer = spawn('node', [join(__dirname, 'start-among-us-world.js')], {
    stdio: 'inherit',
    cwd: join(__dirname, '..'),
    env: { ...process.env }
});
processes.push(worldServer);

// Wait for server to start
await new Promise(resolve => setTimeout(resolve, 3000));

// Step 2: Start the browser observer
console.log('\n2️⃣ Starting Browser Observer...');
const viteServer = spawn('npm', ['run', 'minigames'], {
    stdio: 'inherit',
    cwd: join(__dirname, '..'),
    shell: true
});
processes.push(viteServer);

// Wait for vite to start
await new Promise(resolve => setTimeout(resolve, 2000));

// Step 3: Launch agents
console.log('\n3️⃣ Launching Eliza Agents...');

const agentConfigs = [
    { name: 'Red', file: 'src/agents/characters/red.json', impostor: true },
    { name: 'Blue', file: 'src/agents/characters/blue.json', impostor: false },
    { name: 'Green', file: 'src/agents/characters/green.json', impostor: false },
    { name: 'Yellow', file: 'src/agents/characters/yellow.json', impostor: false },
    { name: 'Purple', file: 'src/agents/characters/purple.json', impostor: true },
    { name: 'Orange', file: 'src/agents/characters/orange.json', impostor: false },
    { name: 'Pink', file: 'src/agents/characters/pink.json', impostor: false },
    { name: 'Black', file: 'src/agents/characters/black.json', impostor: false }
];

// For now, use the test agents since full Eliza integration isn't complete
console.log('\n⚠️  Note: Using test agents for demonstration');
console.log('Full Eliza agent integration is in progress');

const testAgents = spawn('node', [join(__dirname, 'test-among-us-agents.js')], {
    stdio: 'inherit',
    cwd: join(__dirname, '..'),
    env: { ...process.env }
});
processes.push(testAgents);

// Display status
console.log('\n✅ All systems launched!');
console.log('\n📊 System Status:');
console.log('- World Server: ws://localhost:3001');
console.log('- Observer UI: http://localhost:3000/public/amongus.html');
console.log('- Agents: 8 agents (2 impostors, 6 crewmates)');
console.log('\n🎮 Game Instructions:');
console.log('- Agents will move around and complete tasks');
console.log('- Impostors will hunt and kill isolated players');
console.log('- Dead bodies can be reported to trigger meetings');
console.log('- Watch the action in the browser observer');
console.log('\nPress Ctrl+C to stop all processes');

// Handle shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down all processes...');
    processes.forEach(proc => {
        if (proc && !proc.killed) {
            proc.kill('SIGTERM');
        }
    });
    process.exit(0);
});

// Keep main process alive
process.stdin.resume(); 