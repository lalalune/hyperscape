#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log(chalk.cyan.bold(`
╔═══════════════════════════════════════════════╗
║         AMONG US FULL STACK LAUNCHER          ║
║      Launching Everything Automatically       ║
╚═══════════════════════════════════════════════╝
`));

const processes = [];

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function launchFullStack() {
    try {
        // Step 1: Start Vite dev server
        console.log(chalk.blue('\n📦 Step 1: Starting Vite dev server...'));
        const vite = spawn('npm', ['run', 'minigames'], {
            cwd: join(__dirname, '..'),
            stdio: 'pipe',
            shell: true
        });
        processes.push(vite);
        
        // Wait for Vite to start
        await new Promise((resolve) => {
            vite.stdout.on('data', (data) => {
                const output = data.toString();
                process.stdout.write(chalk.gray(output));
                if (output.includes('Local:')) {
                    console.log(chalk.green('✅ Vite server ready!'));
                    resolve();
                }
            });
            
            vite.stderr.on('data', (data) => {
                process.stderr.write(chalk.red(data.toString()));
            });
        });
        
        await sleep(2000);
        
        // Step 2: Launch the observer page
        console.log(chalk.blue('\n🔍 Step 2: Opening Observer interface...'));
        let openCmd;
        if (process.platform === 'win32') {
            openCmd = 'start';
        } else if (process.platform === 'darwin') {
            openCmd = 'open';
        } else {
            openCmd = 'xdg-open';
        }
        
        spawn(openCmd, ['http://localhost:3001/observer.html'], {
            shell: true,
            detached: true
        });
        console.log(chalk.green('✅ Observer opened in browser!'));
        
        await sleep(1000);
        
        // Step 3: Start the Among Us world server
        console.log(chalk.blue('\n🌍 Step 3: Starting Among Us World Server...'));
        const worldServer = spawn('node', ['-e', `
            import { AmongUsWorld } from './src/worlds/among-us/AmongUsWorld.js';
            
            const world = new AmongUsWorld();
            world.start(3001).then(() => {
                console.log('World server started successfully');
            }).catch(err => {
                console.error('Failed to start world server:', err);
            });
            
            // Keep process alive
            process.on('SIGINT', () => {
                world.stop();
                process.exit();
            });
        `], {
            cwd: join(__dirname, '..'),
            stdio: 'inherit',
            shell: true
        });
        processes.push(worldServer);
        
        await sleep(2000);
        
        // Step 4: Launch the Among Us game page
        console.log(chalk.blue('\n🎮 Step 4: Opening Among Us game...'));
        spawn(openCmd, ['http://localhost:3001/amongus.html'], {
            shell: true,
            detached: true
        });
        console.log(chalk.green('✅ Among Us game opened in browser!'));
        
        console.log(chalk.green.bold(`
╔═══════════════════════════════════════════════╗
║           FULL STACK RUNNING!                 ║
╠═══════════════════════════════════════════════╣
║ • Vite Server: http://localhost:3001          ║
║ • Observer: http://localhost:3001/observer    ║
║ • Game: http://localhost:3001/amongus.html    ║
║ • WS Server: ws://localhost:3001              ║
║                                               ║
║ Press Ctrl+C to stop all services             ║
╚═══════════════════════════════════════════════╝
        `));
        
        // Handle process cleanup
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        
    } catch (error) {
        console.error(chalk.red('\n❌ Error launching full stack:'), error);
        cleanup();
    }
}

function cleanup() {
    console.log(chalk.yellow('\n\n🛑 Shutting down all services...'));
    processes.forEach(proc => {
        try {
            proc.kill();
        } catch (e) {
            // Ignore errors
        }
    });
    process.exit(0);
}

// Launch everything
launchFullStack(); 