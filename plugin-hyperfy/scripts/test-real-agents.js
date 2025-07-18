#!/usr/bin/env node

/**
 * Test Real Agents
 * Uses the existing HyperfyService properly
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🎮 Testing Real Among Us Agents');
console.log('================================');
console.log('');
console.log('✅ Using existing HyperfyService (no separate WebSocket!)');
console.log('✅ Real ElizaOS AgentRuntime instances');
console.log('✅ Proper plugin architecture');
console.log('');

// Check environment
if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    console.log('⚠️  No API key set - agents will use fallback model');
    console.log('   Set OPENAI_API_KEY or ANTHROPIC_API_KEY for best results');
    console.log('');
}

// Run the real scenario
const scenarioPath = join(__dirname, '..', 'scenarios', 'run-real-agents.ts');

console.log('Starting agents...\n');

const proc = spawn('tsx', [scenarioPath], {
    stdio: 'inherit',
    env: {
        ...process.env,
        NODE_ENV: 'development'
    }
});

proc.on('error', (err) => {
    console.error('Failed to start:', err.message);
    process.exit(1);
});

proc.on('exit', (code) => {
    if (code !== 0) {
        console.error(`Process exited with code ${code}`);
    }
    process.exit(code || 0);
}); 