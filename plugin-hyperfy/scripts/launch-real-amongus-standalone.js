#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log(chalk.cyan.bold(`
╔═══════════════════════════════════════════════╗
║      AMONG US - STANDALONE SERVER MODE        ║
║         Real WebSocket Implementation         ║
╚═══════════════════════════════════════════════╝
`));

console.log(chalk.yellow('This will run the server and observer without ElizaOS dependencies.'));
console.log(chalk.yellow('You can connect your own agents or use the web interface.\n'));

async function main() {
    // Step 1: Start the observer/web interface
    console.log(chalk.blue('Step 1: Starting observer interface...'));
    const observer = spawn('npm', ['run', 'minigames'], {
        cwd: join(__dirname, '..'),
        stdio: 'pipe',
        shell: true
    });
    
    let observerReady = false;
    observer.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Local:') && !observerReady) {
            observerReady = true;
            const match = output.match(/Local:\s+http:\/\/localhost:(\d+)/);
            const port = match ? match[1] : '3001';
            console.log(chalk.green(`✅ Observer ready at http://localhost:${port}/observer.html`));
            console.log(chalk.green(`✅ Among Us game at http://localhost:${port}/amongus.html\n`));
            
            // Step 2: Start the WebSocket server
            console.log(chalk.blue('Step 2: Starting WebSocket server...'));
            startServer();
        }
    });
    
    observer.stderr.on('data', (data) => {
        console.error(chalk.red('Observer error:'), data.toString());
    });
    
    // Handle exit
    process.on('SIGINT', () => {
        console.log(chalk.yellow('\n\nShutting down...'));
        observer.kill();
        process.exit(0);
    });
}

async function startServer() {
    // Run the server directly using node
    const serverCode = `
import { AmongUsWorld } from './src/worlds/among-us/AmongUsWorld.js';

console.log('🚀 Starting Among Us WebSocket Server...');

const world = new AmongUsWorld();

// Start the server
world.start(3002).then(() => {
    console.log('✅ WebSocket server running on ws://localhost:3002');
    console.log('✅ Agents can connect to ws://localhost:3002/{agentId}');
    console.log('✅ Observer can connect to ws://localhost:3002/observer');
    
    // Add some test players after a delay
    setTimeout(() => {
        console.log('Adding test players...');
        world.addPlayer('test-red', 'Red', true); // impostor
        world.addPlayer('test-blue', 'Blue', false);
        world.addPlayer('test-green', 'Green', false);
        world.addPlayer('test-yellow', 'Yellow', false);
        
        // Start the game
        setTimeout(() => {
            console.log('Starting game...');
            world.startGame();
        }, 2000);
    }, 3000);
}).catch(err => {
    console.error('Failed to start server:', err);
});

// Keep process alive
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    world.stop();
    process.exit(0);
});
    `;
    
    // Write temporary server file
    const fs = await import('fs/promises');
    const tempFile = join(__dirname, '..', 'temp-server.js');
    await fs.writeFile(tempFile, serverCode);
    
    // Run the server
    const server = spawn('node', [tempFile], {
        cwd: join(__dirname, '..'),
        stdio: 'inherit',
        shell: true
    });
    
    server.on('exit', async () => {
        // Clean up temp file
        try {
            await fs.unlink(tempFile);
        } catch (e) {}
    });
    
    console.log(chalk.green(`
╔═══════════════════════════════════════════════╗
║           STANDALONE SYSTEM RUNNING!          ║
╠═══════════════════════════════════════════════╣
║ Game UI: http://localhost:3001/amongus.html   ║
║ Observer: http://localhost:3001/observer.html ║
║ WS Server: ws://localhost:3002                ║
║                                               ║
║ The server is running with test players.      ║
║ You can also connect your own agents to:     ║
║ ws://localhost:3002/{your-agent-id}           ║
╚═══════════════════════════════════════════════╝
    `));
}

main().catch(console.error); 