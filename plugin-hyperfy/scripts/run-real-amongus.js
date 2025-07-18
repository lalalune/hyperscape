#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🎮 Starting Real Among Us with ElizaOS Agents');
console.log('===========================================');

// Check for required environment variables
const requiredEnvVars = ['OPENAI_API_KEY', 'WS_URL'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    console.log('\nPlease set:');
    console.log('export OPENAI_API_KEY=your-key');
    console.log('export WS_URL=wss://your-hyperfy-world.com/ws');
    process.exit(1);
}

console.log('✅ Environment variables configured');
console.log(`📡 Hyperfy URL: ${process.env.WS_URL}`);
console.log(`🤖 Model Provider: ${process.env.MODEL_PROVIDER || 'OpenAI'}`);

// Run the real scenario
const scenarioPath = path.join(__dirname, '..', 'scenarios', 'among-us-real-agents.ts');

console.log('\n🚀 Launching real agents...\n');

const proc = spawn('tsx', [scenarioPath], {
    stdio: 'inherit',
    env: {
        ...process.env,
        NODE_ENV: 'development'
    }
});

proc.on('error', (err) => {
    console.error('❌ Failed to start:', err.message);
    process.exit(1);
});

proc.on('exit', (code) => {
    if (code !== 0) {
        console.error(`❌ Process exited with code ${code}`);
    }
}); 