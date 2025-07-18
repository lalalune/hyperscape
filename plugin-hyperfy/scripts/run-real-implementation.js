#!/usr/bin/env node

/**
 * Run the REAL Among Us implementation
 * This uses actual ElizaOS agents, not mock ones
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log(chalk.cyan.bold(`
╔═══════════════════════════════════════════════╗
║         REAL AMONG US IMPLEMENTATION          ║
║              No More LARP!                    ║
╚═══════════════════════════════════════════════╝
`));

// Check environment
const hasOpenAI = !!process.env.OPENAI_API_KEY;
const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
const hasWsUrl = !!process.env.WS_URL;

console.log(chalk.yellow('Environment Check:'));
console.log(`  OpenAI API Key: ${hasOpenAI ? '✅' : '❌'}`);
console.log(`  Anthropic API Key: ${hasAnthropic ? '✅' : '❌'}`);
console.log(`  Hyperfy WS URL: ${hasWsUrl ? '✅' : '❌'}`);

if (!hasOpenAI && !hasAnthropic) {
    console.log(chalk.red('\n⚠️  No AI provider configured!'));
    console.log('Set either OPENAI_API_KEY or ANTHROPIC_API_KEY for real AI decisions.');
    console.log('Without this, agents will use local/fallback models.\n');
}

if (!hasWsUrl) {
    console.log(chalk.yellow('\nUsing default Hyperfy URL: wss://chill.hyperfy.xyz/ws'));
}

console.log(chalk.green('\n🚀 Starting real implementation...\n'));

// Run the real scenario
const proc = spawn('tsx', [join(__dirname, '../src/scenarios/real-amongus-agents.ts')], {
    stdio: 'inherit',
    env: {
        ...process.env,
        NODE_ENV: 'production'
    }
});

proc.on('error', (err) => {
    console.error(chalk.red('Failed to start:'), err.message);
    process.exit(1);
});

proc.on('exit', (code) => {
    if (code !== 0) {
        console.error(chalk.red(`Process exited with code ${code}`));
    }
    process.exit(code || 0);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log(chalk.yellow('\nShutting down gracefully...'));
    proc.kill('SIGTERM');
}); 