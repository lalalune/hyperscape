#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing Among Us Setup');
console.log('========================\n');

// Check if all character files exist
console.log('📁 Checking character files...');
const characters = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'black'];
const charactersDir = join(__dirname, '..', 'src', 'agents', 'characters');

let allCharactersExist = true;
for (const char of characters) {
    const filepath = join(charactersDir, `${char}.json`);
    if (fs.existsSync(filepath)) {
        console.log(`✅ ${char}.json exists`);
        // Verify it's valid JSON
        try {
            const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
            if (data.name && data.game?.role) {
                console.log(`   Role: ${data.game.role}, Color: ${data.game.color}`);
            }
        } catch (e) {
            console.log(`❌ ${char}.json is not valid JSON`);
            allCharactersExist = false;
        }
    } else {
        console.log(`❌ ${char}.json missing`);
        allCharactersExist = false;
    }
}

console.log('\n📁 Checking system files...');
const systems = ['MovementSystem', 'TaskSystem', 'KillSystem', 'AmongUsSystemBase'];
const systemsDir = join(__dirname, '..', 'src', 'worlds', 'among-us', 'systems');

let allSystemsExist = true;
for (const system of systems) {
    const filepath = join(systemsDir, `${system}.ts`);
    if (fs.existsSync(filepath)) {
        console.log(`✅ ${system}.ts exists`);
    } else {
        console.log(`❌ ${system}.ts missing`);
        allSystemsExist = false;
    }
}

console.log('\n📁 Checking world files...');
const worldFile = join(__dirname, '..', 'src', 'worlds', 'among-us', 'AmongUsWorld.ts');
if (fs.existsSync(worldFile)) {
    console.log('✅ AmongUsWorld.ts exists');
} else {
    console.log('❌ AmongUsWorld.ts missing');
}

console.log('\n📁 Checking demo files...');
const demoFiles = [
    'public/amongus.html',
    'src/worlds/among-us-world.ts',
    'scenarios/among-us-scenario-browser.ts',
    'scenarios/among-us-runner-browser.ts'
];

let allDemoFilesExist = true;
for (const file of demoFiles) {
    const filepath = join(__dirname, '..', file);
    if (fs.existsSync(filepath)) {
        console.log(`✅ ${file} exists`);
    } else {
        console.log(`❌ ${file} missing`);
        allDemoFilesExist = false;
    }
}

// Summary
console.log('\n📊 Summary:');
console.log('===========');
if (allCharactersExist) {
    console.log('✅ All 8 character files present (2 impostors, 6 crewmates)');
} else {
    console.log('❌ Some character files missing');
}

if (allSystemsExist) {
    console.log('✅ All game system files present');
} else {
    console.log('❌ Some system files missing');
}

if (allDemoFilesExist) {
    console.log('✅ All demo files present');
} else {
    console.log('❌ Some demo files missing');
}

console.log('\n🎮 To run the demo:');
console.log('   npm run demo:amongus');
console.log('   Then open: http://localhost:3001/public/amongus.html');

// Check if server is running
console.log('\n🌐 Checking if demo server is running...');
fetch('http://localhost:3001/public/amongus.html')
    .then(res => {
        if (res.ok) {
            console.log('✅ Demo server is running on port 3001!');
            console.log('🎮 You can play the game now!');
        } else {
            console.log('⚠️  Server responded but with status:', res.status);
        }
    })
    .catch(() => {
        console.log('❌ Demo server not running. Start it with: npm run demo:amongus');
    }); 