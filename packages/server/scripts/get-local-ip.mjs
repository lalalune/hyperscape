#!/usr/bin/env node

/**
 * Helper script to get your local machine's IP address for mobile development
 * Usage: node scripts/get-local-ip.mjs
 */

import { networkInterfaces } from 'os';

function getLocalIP() {
  const nets = networkInterfaces();
  const results = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
      if (net.family === familyV4Value && !net.internal) {
        results.push({
          interface: name,
          address: net.address,
        });
      }
    }
  }

  return results;
}

const ips = getLocalIP();

console.log('\n📱 Hyperscape Mobile Development Setup\n');
console.log('Your local IP addresses:');
console.log('─'.repeat(50));

if (ips.length === 0) {
  console.log('❌ No network interfaces found.');
  console.log('   Make sure you are connected to WiFi or Ethernet.\n');
  process.exit(1);
}

ips.forEach(({ interface: iface, address }) => {
  console.log(`  ${iface.padEnd(20)} ${address}`);
});

console.log('─'.repeat(50));
console.log('\n📋 Setup Instructions:\n');

const primaryIP = ips[0]?.address;
const port = process.env.VITE_PORT || '3333';

console.log('1. For iOS Simulator:');
console.log(`   export CAP_SERVER_URL="http://localhost:${port}"`);
console.log(`   npm run ios:dev\n`);

console.log('2. For Android Emulator:');
console.log(`   export CAP_SERVER_URL="http://10.0.2.2:${port}"`);
console.log(`   npm run android:dev\n`);

console.log('3. For Physical Devices (iOS/Android):');
if (primaryIP) {
  console.log(`   export CAP_SERVER_URL="http://${primaryIP}:${port}"`);
} else {
  console.log(`   export CAP_SERVER_URL="http://YOUR_IP:${port}"`);
}
console.log(`   npm run ios:dev  # or android:dev\n`);

console.log('📝 Note: Make sure your dev server is running first:');
console.log(`   npm run dev\n`);

console.log('🔒 The dev server must be accessible from your device.');
console.log('   • Check firewall settings if connection fails');
console.log('   • Device and computer must be on the same network\n');

// Also output in a format that can be easily sourced
console.log('💡 Quick export (copy this):');
if (primaryIP) {
  console.log(`   export CAP_SERVER_URL="http://${primaryIP}:${port}"`);
}
console.log('');

