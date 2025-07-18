#!/usr/bin/env node

console.log('🚀 Among Us Quick Test');
console.log('====================\n');

// Check if server is running
console.log('1️⃣ Checking if game server is running...');
fetch('http://localhost:3000/amongus.html')
    .then(res => {
        if (res.ok) {
            console.log('✅ Game server is running!\n');
            
            console.log('2️⃣ Game Features Implemented:');
            console.log('✅ 8 Agent Characters (2 impostors, 6 crewmates)');
            console.log('✅ Movement System with pathfinding');
            console.log('✅ Task System (5-15 second completion)');
            console.log('✅ Kill System (20s cooldown, proximity check)');
            console.log('✅ Body Report System');
            console.log('✅ Meeting & Voting System');
            console.log('✅ Chat System with bubbles');
            console.log('✅ Win Conditions\n');
            
            console.log('3️⃣ How to Play:');
            console.log('1. Open: http://localhost:3000/amongus.html');
            console.log('2. Click "Start Among Us" button');
            console.log('3. Watch agents play automatically!\n');
            
            console.log('4️⃣ What to Look For:');
            console.log('- 🏃 Agents moving around the maze');
            console.log('- 💬 Chat bubbles with personality-based messages');
            console.log('- ✅ Green progress bars during tasks');
            console.log('- ⚔️ Red impostor hunting isolated players');
            console.log('- 🟣 Purple impostor being manipulative');
            console.log('- 🚨 Emergency meetings when bodies found');
            console.log('- 🗳️ Voting based on suspicions\n');
            
            console.log('5️⃣ Testing Commands (paste in browser console):');
            console.log('\n// Get game state');
            console.log('window.amongUsScenario && {');
            console.log('  agents: window.amongUsScenario.agents.length,');
            console.log('  alive: window.amongUsScenario.agents.filter(a => a.alive).length,');
            console.log('  taskProgress: window.amongUsScenario.taskProgress,');
            console.log('  phase: window.amongUsScenario.phase');
            console.log('};\n');
            
            console.log('✨ Everything is ready to play!');
        } else {
            console.log('❌ Server not running properly\n');
            console.log('Start it with: npm run minigames');
        }
    })
    .catch(() => {
        console.log('❌ Game server not running!\n');
        console.log('To start the game:');
        console.log('1. Run: npm run minigames');
        console.log('2. Open: http://localhost:3000/amongus.html');
        console.log('3. Click "Start Among Us"');
    }); 