#!/usr/bin/env node

console.log('🔍 Checking if Among Us gameplay is real or fake...\n');

// Quick test in browser console
console.log('1️⃣ Open browser to: http://localhost:3001/amongus.html');
console.log('2️⃣ Click "Start Among Us" button');
console.log('3️⃣ Open Developer Console (F12)');
console.log('4️⃣ Run these tests:\n');

console.log('// TEST 1: Check for duplicate messages');
console.log(`
const messageLog = [];
const originalLog = console.log;
console.log = function(...args) {
    const msg = args.join(' ');
    messageLog.push(msg);
    originalLog.apply(console, args);
};

// Wait 30 seconds then check
setTimeout(() => {
    const duplicates = messageLog.filter((msg, i) => messageLog.indexOf(msg) !== i);
    console.warn('Duplicate messages found:', duplicates.length);
    console.warn('Unique messages:', new Set(messageLog).size);
    console.warn('FAKE INDICATOR: High duplicate count means scripted behavior');
}, 30000);
`);

console.log('\n// TEST 2: Check if agents actually move');
console.log(`
const positions = new Map();
setInterval(() => {
    const agents = window.amongUsScenario?.agents || [];
    let movedCount = 0;
    
    agents.forEach(agent => {
        const lastPos = positions.get(agent.id);
        if (lastPos) {
            const moved = Math.abs(agent.position.x - lastPos.x) > 0.01 || 
                         Math.abs(agent.position.z - lastPos.z) > 0.01;
            if (moved) movedCount++;
        }
        positions.set(agent.id, { x: agent.position.x, z: agent.position.z });
    });
    
    console.warn('Agents moving:', movedCount + '/' + agents.length);
}, 2000);
`);

console.log('\n// TEST 3: Check if it\'s using Hyperfy or just Three.js');
console.log(`
console.warn('Using Hyperfy plugin?', !!window.hyperfyWorld);
console.warn('Using raw Three.js?', !!window.THREE && !window.hyperfyWorld);
console.warn('Agent runtimes:', window.agentRuntimes ? Object.keys(window.agentRuntimes) : 'None');
console.warn('Mock agents?', !!window.MockAmongUsAgent);
`);

console.log('\n// TEST 4: Check message patterns');
console.log(`
// Collect messages for 20 seconds
const messages = [];
const tempLog = console.log;
console.log = function(...args) {
    messages.push(args.join(' '));
    tempLog.apply(console, args);
};

setTimeout(() => {
    console.log = tempLog;
    
    // Analyze patterns
    const redMessages = messages.filter(m => m.includes('Red:'));
    const uniqueRed = new Set(redMessages);
    
    console.warn('Red agent messages:', redMessages.length);
    console.warn('Unique Red messages:', uniqueRed.size);
    console.warn('Repetition rate:', ((redMessages.length - uniqueRed.size) / redMessages.length * 100).toFixed(1) + '%');
    console.warn('REAL AI would have >80% unique messages');
}, 20000);
`);

console.log('\n// TEST 5: Check actual implementation');
console.log(`
// Look at the scenario object
const scenario = window.amongUsScenario;
console.warn('Scenario type:', scenario?.constructor?.name || 'Unknown');
console.warn('Has AI decision making?', !!scenario?.makeDecision || !!scenario?.agentDecisionLoop);
console.warn('Has scripted behaviors?', !!scenario?.getCasualMessage || !!scenario?.getKillPhrase);
console.warn('VERDICT:', (scenario?.getCasualMessage ? 'FAKE - Using scripted messages' : 'Could be real'));
`);

console.log('\n🎯 SUMMARY OF INDICATORS:');
console.log('FAKE/Scripted:');
console.log('  - High message duplication (same phrases repeated)');
console.log('  - No real agent movement (positions static)');
console.log('  - Using MockAmongUsAgent class');
console.log('  - Has getCasualMessage() method');
console.log('  - Not using Hyperfy plugin');
console.log('\nREAL Implementation:');
console.log('  - Unique AI-generated messages');
console.log('  - Actual position updates');
console.log('  - Real ElizaOS agent runtimes');
console.log('  - Connected to Hyperfy world');
console.log('  - Using action/provider system'); 