#!/usr/bin/env node

import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing Among Us Gameplay Mechanics');
console.log('=====================================\n');

async function testGameplay() {
    const browser = await puppeteer.launch({
        headless: false, // Set to true for CI
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });
    
    console.log('📱 Opening Among Us game...');
    await page.goto('http://localhost:3000/amongus.html', { waitUntil: 'networkidle2' });
    
    // Wait for the start button
    await page.waitForSelector('#start-button', { timeout: 5000 });
    
    // Click start button
    console.log('🚀 Starting game...');
    await page.click('#start-button');
    
    // Wait for game to initialize
    await page.waitForTimeout(3000);
    
    // Inject test functions
    await page.evaluate(() => {
        window.testResults = {
            agentsSpawned: false,
            agentsMoving: false,
            tasksBeingCompleted: false,
            killsHappening: false,
            bodiesReported: false,
            meetingsCalled: false,
            votingOccurring: false,
            gameEnded: false,
            movements: [],
            kills: [],
            tasks: [],
            meetings: [],
            chat: []
        };
        
        // Override console.log to capture game events
        const originalLog = console.log;
        console.log = function(...args) {
            originalLog.apply(console, args);
            const message = args.join(' ');
            
            // Track movements
            if (message.includes('moving to') || message.includes('position')) {
                window.testResults.movements.push(message);
                window.testResults.agentsMoving = true;
            }
            
            // Track kills
            if (message.includes('killed') || message.includes('eliminated')) {
                window.testResults.kills.push(message);
                window.testResults.killsHappening = true;
            }
            
            // Track tasks
            if (message.includes('task') && (message.includes('completed') || message.includes('progress'))) {
                window.testResults.tasks.push(message);
                window.testResults.tasksBeingCompleted = true;
            }
            
            // Track meetings
            if (message.includes('meeting') || message.includes('body reported')) {
                window.testResults.meetings.push(message);
                window.testResults.meetingsCalled = true;
            }
            
            // Track voting
            if (message.includes('voted') || message.includes('ejected')) {
                window.testResults.votingOccurring = true;
            }
            
            // Track chat
            if (message.includes('says:') || message.includes('chat:')) {
                window.testResults.chat.push(message);
            }
            
            // Track game end
            if (message.includes('wins!') || message.includes('victory')) {
                window.testResults.gameEnded = true;
            }
        };
    });
    
    console.log('\n⏳ Monitoring game for 30 seconds...\n');
    
    // Take screenshots at intervals
    const screenshots = [];
    for (let i = 0; i < 6; i++) {
        await page.waitForTimeout(5000);
        const screenshot = await page.screenshot({ 
            path: join(__dirname, `../test-screenshots/among-us-${i}.png`) 
        });
        console.log(`📸 Screenshot ${i+1} taken`);
        
        // Check agent count
        const agentCount = await page.evaluate(() => {
            const world = window.amongUsWorld;
            if (world && world.agents) {
                window.testResults.agentsSpawned = world.agents.length === 8;
                return world.agents.length;
            }
            return 0;
        });
        console.log(`   Agents in game: ${agentCount}`);
    }
    
    // Get test results
    const results = await page.evaluate(() => window.testResults);
    
    console.log('\n📊 Test Results:');
    console.log('================\n');
    
    // Check each mechanic
    const tests = [
        { name: 'Agents Spawned (8)', passed: results.agentsSpawned },
        { name: 'Agents Moving', passed: results.agentsMoving },
        { name: 'Tasks Being Completed', passed: results.tasksBeingCompleted },
        { name: 'Kills Happening', passed: results.killsHappening },
        { name: 'Bodies Reported', passed: results.bodiesReported || results.meetingsCalled },
        { name: 'Meetings Called', passed: results.meetingsCalled },
        { name: 'Voting Occurring', passed: results.votingOccurring },
        { name: 'Chat Messages', passed: results.chat.length > 0 }
    ];
    
    tests.forEach(test => {
        console.log(`${test.passed ? '✅' : '❌'} ${test.name}`);
    });
    
    // Show statistics
    console.log('\n📈 Statistics:');
    console.log(`   Movements tracked: ${results.movements.length}`);
    console.log(`   Kills tracked: ${results.kills.length}`);
    console.log(`   Tasks tracked: ${results.tasks.length}`);
    console.log(`   Meetings tracked: ${results.meetings.length}`);
    console.log(`   Chat messages: ${results.chat.length}`);
    
    // Show sample events
    if (results.movements.length > 0) {
        console.log('\n🏃 Sample movements:');
        results.movements.slice(0, 3).forEach(m => console.log(`   - ${m}`));
    }
    
    if (results.kills.length > 0) {
        console.log('\n⚔️ Kills:');
        results.kills.forEach(k => console.log(`   - ${k}`));
    }
    
    if (results.tasks.length > 0) {
        console.log('\n✅ Tasks:');
        results.tasks.slice(0, 3).forEach(t => console.log(`   - ${t}`));
    }
    
    if (results.chat.length > 0) {
        console.log('\n💬 Sample chat:');
        results.chat.slice(0, 5).forEach(c => console.log(`   - ${c}`));
    }
    
    // Check game state directly
    const gameState = await page.evaluate(() => {
        if (window.amongUsScenario) {
            const scenario = window.amongUsScenario;
            return {
                phase: scenario.phase,
                agentCount: scenario.agents?.length || 0,
                taskProgress: scenario.taskProgress || 0,
                impostorCount: scenario.agents?.filter(a => a.role === 'impostor').length || 0,
                aliveCount: scenario.agents?.filter(a => a.alive).length || 0
            };
        }
        return null;
    });
    
    if (gameState) {
        console.log('\n🎮 Game State:');
        console.log(`   Phase: ${gameState.phase}`);
        console.log(`   Agents: ${gameState.agentCount} (${gameState.impostorCount} impostors)`);
        console.log(`   Alive: ${gameState.aliveCount}`);
        console.log(`   Task Progress: ${gameState.taskProgress}%`);
    }
    
    await browser.close();
}

// Run the test
testGameplay().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
}); 