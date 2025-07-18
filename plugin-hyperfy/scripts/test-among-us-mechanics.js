#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing Among Us Gameplay Mechanics');
console.log('====================================\n');

console.log('This script will open the game and monitor for:');
console.log('- Agent movement');
console.log('- Task completion');
console.log('- Kills and body reports'); 
console.log('- Meetings and voting\n');

console.log('📋 Manual Test Steps:\n');

console.log('1. Open browser to: http://localhost:3000/amongus.html');
console.log('2. Open Developer Console (F12)');
console.log('3. Click "Start Among Us" button');
console.log('4. In console, run these commands to test:\n');

console.log('🏃 TEST MOVEMENT:');
console.log('   // Watch agent positions update');
console.log('   setInterval(() => {');
console.log('     const agents = window.amongUsScenario?.agents || [];');
console.log('     console.log("Agent positions:", agents.map(a => ({');
console.log('       name: a.name,');
console.log('       pos: `${Math.round(a.position.x)},${Math.round(a.position.z)}`');
console.log('     })));');
console.log('   }, 2000);\n');

console.log('✅ TEST TASKS:');
console.log('   // Monitor task progress');
console.log('   setInterval(() => {');
console.log('     const progress = window.amongUsScenario?.taskProgress || 0;');
console.log('     const tasks = window.amongUsScenario?.agents?.reduce((sum, a) => sum + (a.tasksCompleted || 0), 0) || 0;');
console.log('     console.log(`Task Progress: ${progress}% (${tasks} tasks completed)`);');
console.log('   }, 3000);\n');

console.log('⚔️ TEST KILLS:');
console.log('   // Count alive players');
console.log('   setInterval(() => {');
console.log('     const agents = window.amongUsScenario?.agents || [];');
console.log('     const alive = agents.filter(a => a.alive).length;');
console.log('     const dead = agents.filter(a => !a.alive).length;');
console.log('     console.log(`Players: ${alive} alive, ${dead} dead`);');
console.log('   }, 5000);\n');

console.log('💬 TEST CHAT:');
console.log('   // Monitor chat messages');
console.log('   const originalLog = console.log;');
console.log('   console.log = function(...args) {');
console.log('     originalLog.apply(console, args);');
console.log('     const msg = args.join(" ");');
console.log('     if (msg.includes("says:")) {');
console.log('       document.querySelector("#chat-log")?.insertAdjacentHTML("beforeend",');
console.log('         `<div>${new Date().toLocaleTimeString()}: ${msg}</div>`);');
console.log('     }');
console.log('   };\n');

console.log('🔍 VERIFY MECHANICS:');
console.log('   // Get current game state');
console.log('   const getGameState = () => {');
console.log('     const scenario = window.amongUsScenario;');
console.log('     if (!scenario) return "No game running";');
console.log('     ');
console.log('     const agents = scenario.agents || [];');
console.log('     const alive = agents.filter(a => a.alive);');
console.log('     const impostors = alive.filter(a => a.role === "impostor");');
console.log('     const crewmates = alive.filter(a => a.role === "crewmate");');
console.log('     ');
console.log('     return {');
console.log('       phase: scenario.phase,');
console.log('       agents: agents.length,');
console.log('       alive: alive.length,');
console.log('       impostors: impostors.length,');
console.log('       crewmates: crewmates.length,');
console.log('       taskProgress: scenario.taskProgress || 0,');
console.log('       bodies: scenario.bodies?.length || 0');
console.log('     };');
console.log('   };');
console.log('   ');
console.log('   // Call this to see game state');
console.log('   getGameState();\n');

console.log('🎯 FORCE ACTIONS (Testing):');
console.log('   // Force a kill (if impostor exists)');
console.log('   const forceKill = () => {');
console.log('     const scenario = window.amongUsScenario;');
console.log('     const impostor = scenario.agents.find(a => a.alive && a.role === "impostor");');
console.log('     const victim = scenario.agents.find(a => a.alive && a.role === "crewmate");');
console.log('     if (impostor && victim) {');
console.log('       // Move impostor to victim');
console.log('       impostor.position.x = victim.position.x;');
console.log('       impostor.position.z = victim.position.z;');
console.log('       // Trigger kill check');
console.log('       scenario.checkProximityActions();');
console.log('       console.log(`${impostor.name} moved to ${victim.name}`);');
console.log('     }');
console.log('   };\n');

console.log('   // Force task completion');
console.log('   const forceTask = () => {');
console.log('     const scenario = window.amongUsScenario;');
console.log('     const agent = scenario.agents.find(a => a.alive && a.role === "crewmate");');
console.log('     if (agent && !agent.currentTask) {');
console.log('       const task = scenario.tasks.find(t => !t.completedBy.has(agent.id));');
console.log('       if (task) {');
console.log('         agent.position.x = task.position.x;');
console.log('         agent.position.z = task.position.z;');
console.log('         agent.startTask(task);');
console.log('         console.log(`${agent.name} started ${task.name}`);');
console.log('       }');
console.log('     }');
console.log('   };\n');

console.log('📊 EXPECTED RESULTS:');
console.log('- Agents should move smoothly, not teleport');
console.log('- Task progress should increase as crewmates work');
console.log('- Kills should only happen when impostor is near isolated crewmate');
console.log('- Bodies should appear and be reportable');
console.log('- Meetings should pause gameplay and start voting');
console.log('- Chat messages should appear above agents\n');

console.log('⚠️  TROUBLESHOOTING:');
console.log('- If no movement: Check pathfinding in console');
console.log('- If no kills: Impostors need isolated victims');
console.log('- If no tasks: Check task proximity calculations');
console.log('- If no chat: Check chat bubble rendering\n');

console.log('🎮 The game is running at: http://localhost:3000/amongus.html'); 