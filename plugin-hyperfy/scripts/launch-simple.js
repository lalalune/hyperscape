#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Launching Among Us Full Stack...\n');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    // Start Vite server first
    console.log('1️⃣  Starting Vite server...');
    const vite = spawn('npm', ['run', 'minigames'], {
        cwd: join(__dirname, '..'),
        stdio: 'inherit',
        shell: true
    });
    
    // Give Vite time to start
    await sleep(5000);
    
    // Open browser to observer
    console.log('\n2️⃣  Opening Observer in browser...');
    const platform = process.platform;
    let openCommand;
    if (platform === 'win32') {
        openCommand = 'start';
    } else if (platform === 'darwin') {
        openCommand = 'open';
    } else {
        openCommand = 'xdg-open';
    }
    
    spawn(openCommand, ['http://localhost:3001/observer.html'], {
        shell: true,
        detached: true,
        stdio: 'ignore'
    });
    
    await sleep(2000);
    
    // Open game page
    console.log('3️⃣  Opening Among Us game in browser...');
    spawn(openCommand, ['http://localhost:3001/amongus.html'], {
        shell: true,
        detached: true,
        stdio: 'ignore'
    });
    
    console.log(`
✅ Full stack launched!

📍 URLs:
- Observer: http://localhost:3001/observer.html
- Game: http://localhost:3001/amongus.html

Press Ctrl+C to stop the server.
    `);
    
    // Handle shutdown
    process.on('SIGINT', () => {
        console.log('\nShutting down...');
        vite.kill();
        process.exit(0);
    });
}

main().catch(console.error); 