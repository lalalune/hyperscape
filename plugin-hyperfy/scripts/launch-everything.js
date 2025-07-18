#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'http';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log(`
🚀 AMONG US COMPLETE LAUNCHER
=============================
This will automatically:
1. Find an available port for Vite
2. Start the WebSocket server
3. Open Observer and Game pages
`);

// Check if a port is in use
async function isPortInUse(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(true));
        server.once('listening', () => {
            server.close();
            resolve(false);
        });
        server.listen(port);
    });
}

// Find the Vite server port
async function findVitePort() {
    for (const port of [3000, 3001, 3002, 3003, 3004, 3005]) {
        try {
            const response = await fetch(`http://localhost:${port}`);
            if (response.ok) {
                return port;
            }
        } catch (e) {
            // Port not responding
        }
    }
    return null;
}

// Main launcher
async function launch() {
    // Step 1: Check if Vite is already running
    console.log('🔍 Checking for running Vite server...');
    let vitePort = await findVitePort();
    
    if (!vitePort) {
        console.log('📦 Starting Vite server...');
        const vite = spawn('npm', ['run', 'minigames'], {
            cwd: join(__dirname, '..'),
            stdio: 'inherit',
            shell: true
        });
        
        // Wait for Vite to start and find its port
        await new Promise(resolve => setTimeout(resolve, 5000));
        vitePort = await findVitePort();
        
        if (!vitePort) {
            console.error('❌ Failed to start Vite server');
            process.exit(1);
        }
    }
    
    console.log(`✅ Vite server running on port ${vitePort}`);
    
    // Step 2: Start WebSocket server if not running
    const wsInUse = await isPortInUse(3001);
    if (!wsInUse) {
        console.log('🌍 Starting WebSocket server...');
        spawn('node', ['scripts/start-world-server.js'], {
            cwd: join(__dirname, '..'),
            stdio: 'ignore',
            shell: true,
            detached: true
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
        console.log('✅ WebSocket server already running');
    }
    
    // Step 3: Open browser pages
    console.log('🌐 Opening browser pages...');
    const openCmd = process.platform === 'win32' ? 'start' : 
                   process.platform === 'darwin' ? 'open' : 'xdg-open';
    
    // Open Observer
    spawn(openCmd, [`http://localhost:${vitePort}/observer.html`], {
        shell: true,
        stdio: 'ignore',
        detached: true
    });
    
    // Wait a bit then open game
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    spawn(openCmd, [`http://localhost:${vitePort}/amongus.html`], {
        shell: true,
        stdio: 'ignore',
        detached: true
    });
    
    console.log(`
✅ EVERYTHING IS RUNNING!
========================

🎮 Game: http://localhost:${vitePort}/amongus.html
🔍 Observer: http://localhost:${vitePort}/observer.html
📡 WebSocket: ws://localhost:3001

What you should see:
- Observer: Real-time monitoring with "Real Agents" indicator
- Game: 8 colored agents playing Among Us

Current Status:
- Using mock agents (scripted behavior)
- To use real AI agents, build ElizaOS dependencies first

Press Ctrl+C to stop all services.
    `);
}

// Handle shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    process.exit(0);
});

// Run the launcher
launch().catch(error => {
    console.error('❌ Launch failed:', error);
    process.exit(1);
}); 