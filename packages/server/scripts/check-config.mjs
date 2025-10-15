#!/usr/bin/env node

/**
 * Configuration checker - verifies your Hyperscape environment is set up correctly
 * Usage: node scripts/check-config.mjs [--mobile]
 */

import { networkInterfaces } from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const args = process.argv.slice(2);
const mobileMode = args.includes('--mobile');

function getLocalIP() {
  const nets = networkInterfaces();
  const results = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
      if (net.family === familyV4Value && !net.internal) {
        results.push({ interface: name, address: net.address });
      }
    }
  }

  return results;
}

function loadEnvFile() {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};

  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  }

  return env;
}

console.log('\n🔍 Hyperscape Configuration Check\n');
console.log('═'.repeat(60));

// Load .env
const env = loadEnvFile();
const hasEnvFile = Object.keys(env).length > 0;

if (!hasEnvFile) {
  console.log('⚠️  No .env file found');
  console.log('   Create one from .env.example template\n');
} else {
  console.log('✅ .env file loaded\n');
}

// Check key configuration
const port = env.PORT || '5555';
const vitePort = env.VITE_PORT || '3333';
const wsUrl = env.PUBLIC_WS_URL;
const cdnUrl = env.PUBLIC_CDN_URL;
const capServerUrl = process.env.CAP_SERVER_URL;

console.log('📋 Current Configuration:\n');
console.log(`  Backend Port:        ${port}`);
console.log(`  Vite Dev Port:       ${vitePort}`);
console.log(`  WebSocket URL:       ${wsUrl || '(not set - will use relative URL)'}`);
console.log(`  CDN URL:             ${cdnUrl || '(not set - defaults to http://localhost:8080)'}`);
console.log(`  Mobile Dev URL:      ${capServerUrl || '(not set)'}`);
console.log('');

// Check for issues
const issues = [];
const warnings = [];

// Check if URLs use localhost
if (wsUrl && wsUrl.includes('localhost')) {
  if (mobileMode) {
    issues.push('PUBLIC_WS_URL uses localhost - mobile devices cannot connect to localhost');
  } else {
    warnings.push('PUBLIC_WS_URL uses localhost - this will only work for desktop browsers');
  }
}

if (cdnUrl && cdnUrl.includes('localhost')) {
  if (mobileMode) {
    issues.push('PUBLIC_CDN_URL uses localhost - mobile devices cannot connect');
  } else {
    warnings.push('PUBLIC_CDN_URL uses localhost - this will only work for desktop browsers');
  }
}

// Check mobile configuration
if (mobileMode) {
  console.log('📱 Mobile Development Mode\n');

  const ips = getLocalIP();
  if (ips.length === 0) {
    issues.push('No network interfaces found - connect to WiFi or Ethernet');
  } else {
    console.log('  Your local IP addresses:');
    ips.forEach(({ interface: iface, address }) => {
      console.log(`    ${iface.padEnd(20)} ${address}`);
    });
    console.log('');

    const primaryIP = ips[0]?.address;

    if (!capServerUrl) {
      warnings.push('CAP_SERVER_URL not set - mobile app may not connect to dev server');
      console.log(`  💡 Set it with:\n     export CAP_SERVER_URL="http://${primaryIP}:${vitePort}"\n`);
    } else {
      console.log(`  ✅ CAP_SERVER_URL is set: ${capServerUrl}\n`);

      // Validate CAP_SERVER_URL
      if (capServerUrl.includes('localhost') && !capServerUrl.includes('10.0.2.2')) {
        warnings.push('CAP_SERVER_URL uses localhost - this only works for iOS Simulator');
        console.log(`     For physical devices, use: http://${primaryIP}:${vitePort}\n`);
      }
    }

    // Check if backend URLs need updating
    if (wsUrl && !wsUrl.includes(primaryIP) && wsUrl.includes('localhost')) {
      warnings.push(`PUBLIC_WS_URL should use your IP (${primaryIP}) for mobile devices`);
    }
  }
}

// Display warnings
if (warnings.length > 0) {
  console.log('⚠️  Warnings:\n');
  warnings.forEach(w => console.log(`   • ${w}`));
  console.log('');
}

// Display issues
if (issues.length > 0) {
  console.log('❌ Issues:\n');
  issues.forEach(i => console.log(`   • ${i}`));
  console.log('');
}

// Recommendations
if (mobileMode) {
  console.log('═'.repeat(60));
  console.log('\n📝 Mobile Development Setup:\n');

  const ips = getLocalIP();
  const primaryIP = ips[0]?.address || 'YOUR_IP';

  console.log('1. Update your .env file:');
  console.log(`   PORT=${port}`);
  console.log(`   PUBLIC_WS_URL=ws://${primaryIP}:${port}/ws`);
  console.log(`   PUBLIC_CDN_URL=http://${primaryIP}:8080`);
  console.log(`   VITE_PORT=${vitePort}\n`);

  console.log('2. Set mobile dev server URL:');
  console.log(`   export CAP_SERVER_URL="http://${primaryIP}:${vitePort}"\n`);

  console.log('3. Start development:');
  console.log('   npm run dev           # Terminal 1');
  console.log('   npm run ios:dev       # Terminal 2\n');

  console.log('💡 For iOS Simulator, you can use localhost:');
  console.log(`   export CAP_SERVER_URL="http://localhost:${vitePort}"\n`);

  console.log('💡 For Android Emulator, use special IP or ADB:');
  console.log(`   export CAP_SERVER_URL="http://10.0.2.2:${vitePort}"`);
  console.log('   OR');
  console.log('   adb reverse tcp:3333 tcp:3333');
  console.log('   adb reverse tcp:5555 tcp:5555\n');
}

// Summary
console.log('═'.repeat(60));
if (issues.length === 0 && warnings.length === 0) {
  console.log('\n✅ Configuration looks good!\n');
  console.log('Start development with: npm run dev\n');
} else if (issues.length === 0) {
  console.log('\n✅ Configuration is functional but has warnings\n');
} else {
  console.log('\n❌ Configuration has issues that need to be fixed\n');
  process.exit(1);
}


