#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log(chalk.cyan.bold(`
╔═══════════════════════════════════════════════╗
║         REAL AMONG US IMPLEMENTATION          ║
║         ElizaOS Agents with Real AI           ║
╚═══════════════════════════════════════════════╝
`));

// Check for API key
if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    console.log(chalk.yellow('⚠️  Warning: No AI API key detected'));
    console.log(chalk.yellow('Set OPENAI_API_KEY or ANTHROPIC_API_KEY for real AI decisions'));
    console.log();
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function question(prompt) {
    return new Promise(resolve => {
        rl.question(prompt, resolve);
    });
}

async function main() {
    console.log(chalk.green('This will launch the REAL Among Us implementation with:'));
    console.log('• 8 ElizaOS agents with unique personalities');
    console.log('• AI-driven decision making (not random)');
    console.log('• WebSocket networking');
    console.log('• Server-authoritative game state');
    console.log('• Real-time observer interface');
    console.log();
    
    const choice = await question(chalk.cyan('Choose an option:\n') +
        '1. Launch full system (Server + Agents + Observer)\n' +
        '2. Launch server only\n' +
        '3. Launch observer only\n' +
        '4. View implementation details\n' +
        'Choice (1-4): ');
    
    switch (choice.trim()) {
        case '1':
            await launchFullSystem();
            break;
        case '2':
            await launchServer();
            break;
        case '3':
            await launchObserver();
            break;
        case '4':
            showImplementationDetails();
            break;
        default:
            console.log(chalk.red('Invalid choice'));
            process.exit(1);
    }
}

async function launchFullSystem() {
    console.log(chalk.green('\n🚀 Launching full system...\n'));
    
    // Step 1: Start the observer
    console.log(chalk.blue('Step 1: Starting observer interface...'));
    const observer = spawn('npm', ['run', 'observer'], {
        cwd: join(__dirname, '..'),
        stdio: 'pipe',
        shell: true
    });
    
    observer.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Local:')) {
            console.log(chalk.green('✅ Observer ready at http://localhost:3001/observer.html'));
        }
    });
    
    // Wait for observer to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 2: Start the real ElizaOS agents
    console.log(chalk.blue('\nStep 2: Starting real ElizaOS agents...'));
    const agents = spawn('npm', ['run', 'real:amongus'], {
        cwd: join(__dirname, '..'),
        stdio: 'inherit',
        shell: true
    });
    
    console.log(chalk.green(`
╔═══════════════════════════════════════════════╗
║             SYSTEM RUNNING!                   ║
╠═══════════════════════════════════════════════╣
║ Observer: http://localhost:3001/observer.html ║
║ Server: ws://localhost:3001                   ║
║                                               ║
║ Watch the observer to see:                    ║
║ • Real agent movements                        ║
║ • AI-generated messages                       ║
║ • Actual game mechanics                       ║
╚═══════════════════════════════════════════════╝
`));
    
    // Handle exit
    process.on('SIGINT', () => {
        console.log(chalk.yellow('\n\nShutting down...'));
        observer.kill();
        agents.kill();
        process.exit(0);
    });
}

async function launchServer() {
    console.log(chalk.blue('\n🚀 Launching server only...'));
    
    const server = spawn('tsx', ['scenarios/among-us-eliza-runner.ts'], {
        cwd: join(__dirname, '..'),
        stdio: 'inherit',
        shell: true
    });
    
    process.on('SIGINT', () => {
        server.kill();
        process.exit(0);
    });
}

async function launchObserver() {
    console.log(chalk.blue('\n🚀 Launching observer only...'));
    
    const observer = spawn('npm', ['run', 'observer'], {
        cwd: join(__dirname, '..'),
        stdio: 'inherit',
        shell: true
    });
    
    process.on('SIGINT', () => {
        observer.kill();
        process.exit(0);
    });
}

function showImplementationDetails() {
    console.log(chalk.cyan(`
╔═══════════════════════════════════════════════╗
║        REAL IMPLEMENTATION DETAILS            ║
╚═══════════════════════════════════════════════╝

${chalk.green('✅ REAL Components:')}
• AgentRuntime from @elizaos/core
• AI decision making via generateMessageResponse
• WebSocket server with bidirectional communication
• Server-authoritative game state
• Actual Hyperfy plugin architecture

${chalk.red('❌ NOT Like the Fake Demo:')}
• No MockAmongUsAgent
• No hardcoded phrases arrays
• No Math.random() for decisions
• No browser-only execution
• No direct Three.js manipulation

${chalk.blue('📁 Key Files:')}
• scenarios/among-us-eliza-runner.ts - Real runner
• src/worlds/among-us/AmongUsWorld.ts - World server
• src/actions/minigames/*.ts - Real actions
• src/providers/minigames/*.ts - Real providers
• src/agents/characters/*.json - Agent personalities

${chalk.yellow('🔍 Verification:')}
In the observer, check:
• "Real Agents" shows ✅
• Unique messages > Duplicate messages
• AI Decisions counter increases
• Movement is strategic, not random

${chalk.magenta('📖 Documentation:')}
• REAL_IMPLEMENTATION_INSTRUCTIONS.md
• REAL_IMPLEMENTATION_STATUS.md
• FINAL_IMPLEMENTATION_REPORT.md
`));
    
    rl.close();
}

main().catch(console.error); 