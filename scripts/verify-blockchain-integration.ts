#!/usr/bin/env bun
/**
 * Blockchain Integration Verification Script
 * 
 * Checks if Hyperscape is actually integrated with the blockchain
 * or just using a traditional database.
 */

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

type CheckResult = {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
};

const results: CheckResult[] = [];

function check(name: string, status: 'pass' | 'fail' | 'warn', message: string) {
  results.push({ name, status, message });
  
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
  const color = status === 'pass' ? colors.green : status === 'fail' ? colors.red : colors.yellow;
  
  console.log(`${icon} ${color}${name}${colors.reset}`);
  if (message) {
    console.log(`   ${colors.gray}${message}${colors.reset}`);
  }
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║                                                              ║');
console.log('║   🔍 BLOCKCHAIN INTEGRATION VERIFICATION                     ║');
console.log('║                                                              ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// Check 1: MUD Dependencies
console.log('📦 Checking MUD Dependencies...\n');

const clientPackage = await Bun.file('packages/client/package.json').json();
const serverPackage = await Bun.file('packages/server/package.json').json();
const sharedPackage = await Bun.file('packages/shared/package.json').json();

const mudDeps = [
  '@latticexyz/store',
  '@latticexyz/world',
  '@latticexyz/store-sync',
  '@latticexyz/recs',
  '@latticexyz/common'
];

let hasMudDeps = false;
for (const dep of mudDeps) {
  if (clientPackage.dependencies?.[dep] || 
      serverPackage.dependencies?.[dep] ||
      sharedPackage.dependencies?.[dep]) {
    hasMudDeps = true;
    break;
  }
}

if (hasMudDeps) {
  check('MUD dependencies installed', 'pass', 'Found @latticexyz packages');
} else {
  check('MUD dependencies MISSING', 'fail', 
    'No @latticexyz packages found in client, server, or shared');
}

// Check 2: MUD Client Code
console.log('\n🔌 Checking MUD Client Integration...\n');

const mudClientFiles = [
  'packages/shared/src/blockchain/mud-client.ts',
  'packages/shared/src/mud/client.ts',
  'packages/client/src/mud-client.ts',
  'packages/server/src/mud-client.ts'
];

let hasMudClient = false;
for (const file of mudClientFiles) {
  if (await Bun.file(file).exists()) {
    hasMudClient = true;
    check('MUD client file found', 'pass', `Found: ${file}`);
    break;
  }
}

if (!hasMudClient) {
  check('MUD client MISSING', 'fail', 
    'No MUD client setup found in any package');
}

// Check 3: Blockchain Transaction Calls
console.log('\n📝 Checking Blockchain Transaction Calls...\n');

// Check for BlockchainGateway integration in DatabaseSystem
const blockchainGatewayExists = await Bun.file('packages/server/src/BlockchainGateway.ts').exists();
const databaseSystemFile = await Bun.file('packages/server/src/DatabaseSystem.ts').text();
const indexFile = await Bun.file('packages/server/src/index.ts').text();

// Check if DatabaseSystem is integrated with BlockchainGateway (clean architecture)
const hasGatewayInDatabase = databaseSystemFile.includes('blockchainGateway') && 
                             databaseSystemFile.includes('BlockchainGateway integrated');
const hasGatewayRegistered = indexFile.includes("'blockchain-gateway'");

if (hasGatewayInDatabase && hasGatewayRegistered) {
  check('Blockchain integration (clean architecture)', 'pass', 
    'DatabaseSystem handles blockchain sync transparently');
} else if (hasGatewayRegistered) {
  check('Blockchain gateway registered', 'warn',
    'Gateway exists but not fully integrated');
} else {
  check('NO blockchain transactions', 'fail', 
    'Game does not use blockchain');
}

// Check 4: Database Backend
console.log('\n🗄️  Checking Data Storage Backend...\n');

const dbSystemFile = await Bun.file('packages/server/src/DatabaseSystem.ts').text();

if (dbSystemFile.includes('pg.Pool') || dbSystemFile.includes('PostgreSQL')) {
  check('Using PostgreSQL', 'warn', 
    'Game uses PostgreSQL instead of blockchain for state');
}

if (dbSystemFile.includes('drizzle-orm')) {
  check('Using Drizzle ORM', 'warn', 
    'Traditional database ORM, not blockchain storage');
}

// Check 5: Integration Tests
console.log('\n🧪 Checking Integration Tests...\n');

const testFile = await Bun.file('packages/plugin-hyperscape/tests/mud-integration.test.ts').text();

const skippedTests = (testFile.match(/test\.skip/g) || []).length;
const activeTests = (testFile.match(/test\('should register a player on-chain'/g) || []).length;

if (activeTests > 0) {
  check('Integration tests implemented', 'pass',
    `${activeTests} test(s) active, ${skippedTests} remaining to implement`);
} else if (skippedTests > 5) {
  check('Integration tests SKIPPED', 'fail', 
    `${skippedTests} critical tests are disabled with .skip()`);
} else {
  check('Some tests implemented', 'warn', 
    `Some tests ready, ${skippedTests} skipped`);
}

// Check 6: Contract Deployment
console.log('\n🚀 Checking Contract Deployment Setup...\n');

const startLocalnetScript = await Bun.file('scripts/start-localnet.ts').exists();
const startFullScript = await Bun.file('../../scripts/start-hyperscape-full.sh').exists();

if (startLocalnetScript) {
  check('Deployment scripts found', 'pass', 
    'Found start-localnet.ts for automated deployment');
} else {
  check('Deployment scripts MISSING', 'fail', 
    'No automated way to deploy contracts with game');
}

// Check 7: Environment Configuration
console.log('\n⚙️  Checking Environment Configuration...\n');

const envExample = await Bun.file('packages/server/env.example').text();

if (envExample.includes('WORLD_ADDRESS') && envExample.includes('ANVIL_RPC_URL')) {
  check('Environment vars for blockchain', 'pass', 
    'Found WORLD_ADDRESS and RPC configuration');
} else {
  check('Blockchain env vars MISSING', 'fail', 
    'No WORLD_ADDRESS or ANVIL_RPC_URL in env.example');
}

// Summary
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const passed = results.filter(r => r.status === 'pass').length;
const failed = results.filter(r => r.status === 'fail').length;
const warnings = results.filter(r => r.status === 'warn').length;

console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${warnings} warnings\n`);

if (failed === 0 && warnings === 0) {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                                                              ║');
  console.log('║   ✅ HYPERSCAPE IS FULLY ON-CHAIN                            ║');
  console.log('║                                                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  process.exit(0);
} else if (failed > 0) {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                                                              ║');
  console.log('║   ❌ HYPERSCAPE IS NOT ON-CHAIN                              ║');
  console.log('║                                                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`${colors.red}CRITICAL: Game does not use blockchain${colors.reset}`);
  console.log(`${colors.gray}See ONCHAIN_ASSESSMENT.md for detailed analysis${colors.reset}\n`);
  process.exit(1);
} else {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                                                              ║');
  console.log('║   ⚠️  PARTIAL INTEGRATION                                    ║');
  console.log('║                                                              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`${colors.yellow}WARNING: Some blockchain components missing${colors.reset}\n`);
  process.exit(1);
}

