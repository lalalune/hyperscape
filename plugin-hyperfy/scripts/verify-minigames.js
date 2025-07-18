#!/usr/bin/env node

import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function fileExists(path) {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
}

async function verifyMinigames() {
    log('\n🎮 Minigames Visual Verification Checklist\n', 'magenta');
    
    // Check required files
    log('📁 Checking required files...', 'cyan');
    
    const requiredFiles = [
        { path: 'public/minigames.html', desc: 'Minigames menu page' },
        { path: 'public/mafia.html', desc: 'Mafia game page' },
        { path: 'public/amongus.html', desc: 'Among Us game page' },
        { path: 'src/worlds/mafia-world.ts', desc: 'Mafia 3D world' },
        { path: 'src/worlds/among-us-world.ts', desc: 'Among Us 3D world' },
        { path: 'scenarios/mafia-game-scenario.ts', desc: 'Mafia game logic' },
        { path: 'scenarios/among-us-scenario.ts', desc: 'Among Us game logic' },
        { path: 'scenarios/mafia-game-runner.ts', desc: 'Mafia runner' },
        { path: 'scenarios/among-us-runner.ts', desc: 'Among Us runner' }
    ];
    
    let allFilesExist = true;
    
    for (const file of requiredFiles) {
        const fullPath = join(rootDir, file.path);
        const exists = await fileExists(fullPath);
        
        if (exists) {
            log(`  ✓ ${file.desc} (${file.path})`, 'green');
        } else {
            log(`  ✗ ${file.desc} (${file.path})`, 'red');
            allFilesExist = false;
        }
    }
    
    if (!allFilesExist) {
        log('\n❌ Some required files are missing!', 'red');
        return;
    }
    
    log('\n✅ All required files exist!', 'green');
    
    // Manual testing instructions
    log('\n📋 Manual Testing Instructions:\n', 'cyan');
    
    log('1. Start the development server:', 'yellow');
    log('   npm run minigames', 'blue');
    log('   (or if already running, skip this step)\n', 'blue');
    
    log('2. Open your browser to:', 'yellow');
    log('   http://localhost:3000/minigames.html\n', 'blue');
    
    log('3. Visual checks for the menu page:', 'yellow');
    log('   ✓ Two game cards should be visible', 'green');
    log('   ✓ Mafia card with 🎭 icon', 'green');
    log('   ✓ Among Us card with 🚀 icon', 'green');
    log('   ✓ Hover effects on cards\n', 'green');
    
    log('4. Test Mafia Game:', 'yellow');
    log('   a. Click on the Mafia card', 'blue');
    log('   b. You should see:', 'blue');
    log('      ✓ A circular room with a round table', 'green');
    log('      ✓ 8 colored chairs around the table', 'green');
    log('      ✓ Chandelier and candle on table', 'green');
    log('      ✓ UI overlay on top-left (game info)', 'green');
    log('      ✓ Player list on top-right', 'green');
    log('   c. Open browser console (F12) and run:', 'blue');
    log('      window.runMafiaScenario()', 'magenta');
    log('   d. Watch for:', 'blue');
    log('      ✓ 8 players appearing at chairs', 'green');
    log('      ✓ Day/night lighting changes', 'green');
    log('      ✓ Voting arrows between players', 'green');
    log('      ✓ Player eliminations\n', 'green');
    
    log('5. Test Among Us Game:', 'yellow');
    log('   a. Click on the Among Us card', 'blue');
    log('   b. You should see:', 'blue');
    log('      ✓ Overhead view of a maze', 'green');
    log('      ✓ Yellow task indicators', 'green');
    log('      ✓ UI overlay with game status', 'green');
    log('      ✓ Emergency button (bottom-right)', 'green');
    log('   c. Open browser console (F12) and run:', 'blue');
    log('      window.runAmongUsScenario()', 'magenta');
    log('   d. Watch for:', 'blue');
    log('      ✓ 8 colored players spawning', 'green');
    log('      ✓ Players navigating the maze', 'green');
    log('      ✓ Task completion animations', 'green');
    log('      ✓ Kill events and dead bodies\n', 'green');
    
    log('6. Camera Controls (both games):', 'yellow');
    log('   ✓ Left click + drag to rotate', 'green');
    log('   ✓ Right click + drag to pan', 'green');
    log('   ✓ Scroll to zoom in/out\n', 'green');
    
    log('🎯 Quick Test Commands:\n', 'cyan');
    log('# Test menu loads correctly:', 'yellow');
    log('curl -s http://localhost:3000/minigames.html | grep -c "game-card"', 'blue');
    log('# Should output: 2\n', 'green');
    
    log('# Test Mafia page loads:', 'yellow');
    log('curl -s http://localhost:3000/mafia.html | grep -c "mafiaWorld"', 'blue');
    log('# Should output: 1 or more\n', 'green');
    
    log('# Test Among Us page loads:', 'yellow');
    log('curl -s http://localhost:3000/amongus.html | grep -c "amongUsWorld"', 'blue');
    log('# Should output: 1 or more\n', 'green');
    
    log('📸 For automated testing with screenshots:', 'cyan');
    log('npm run minigames:test', 'blue');
    log('(requires Chrome/Chromium installed)\n', 'blue');
    
    log('✨ Happy testing! ✨\n', 'magenta');
}

// Run verification
verifyMinigames().catch(console.error); 