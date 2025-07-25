#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

console.log('🚀 Starting Hyperfy development server...');

// Start vite dev server
const vite = spawn('npx', ['vite', 'serve', 'src/client', '--port', '3334', '--host'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: { ...process.env }
});

// Wait a moment for vite to start, then start the hyperfy server
setTimeout(() => {
  console.log('🎮 Starting Hyperfy game server...');
  
  const server = spawn('node', ['build/index.js', 'start', '--world', './world', '--port', '3333'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { 
      ...process.env,
      NODE_ENV: 'development',
      VITE_DEV_SERVER: 'http://localhost:3334'
    }
  });

  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    vite.kill();
    server.kill();
    process.exit(0);
  });

  server.on('exit', (code) => {
    console.log(`Server exited with code ${code}`);
    vite.kill();
    process.exit(code);
  });

  vite.on('exit', (code) => {
    console.log(`Vite exited with code ${code}`);
    server.kill();
    process.exit(code);
  });

}, 2000); 