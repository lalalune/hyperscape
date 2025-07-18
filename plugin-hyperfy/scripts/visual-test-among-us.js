#!/usr/bin/env node

import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Visual Testing for Among Us - Verifying Actual Gameplay');
console.log('========================================================\n');

async function captureGameState(page) {
    return await page.evaluate(() => {
        const scenario = window.amongUsScenario;
        if (!scenario) return null;
        
        // Get actual positions and states
        const agents = scenario.agents.map(agent => ({
            id: agent.id,
            name: agent.name,
            color: agent.color,
            role: agent.role,
            alive: agent.alive,
            position: {
                x: agent.position.x,
                y: agent.position.y,
                z: agent.position.z
            },
            tasksCompleted: agent.tasksCompleted || 0,
            currentTask: agent.currentTask?.name || null,
            killCooldown: agent.killCooldown || 0
        }));
        
        const tasks = scenario.tasks.map(task => ({
            id: task.id,
            name: task.name,
            position: {
                x: task.position.x,
                z: task.position.z
            },
            completedBy: Array.from(task.completedBy || new Set())
        }));
        
        const bodies = scenario.bodies || [];
        
        return {
            phase: scenario.phase,
            taskProgress: scenario.taskProgress,
            agents,
            tasks,
            bodies: bodies.map(b => ({
                victimId: b.victimId,
                position: { x: b.position.x, z: b.position.z }
            }))
        };
    });
}

async function createOverheadView(page) {
    // Switch to overhead view for testing
    await page.evaluate(() => {
        const camera = window.scene?.camera;
        if (camera) {
            // Position camera overhead
            camera.position.set(0, 30, 0);
            camera.lookAt(0, 0, 0);
            
            // Disable orbit controls temporarily
            if (window.controls) {
                window.controls.enabled = false;
            }
        }
    });
}

async function addDebugCubes(page) {
    // Add colored cubes at agent positions for visual verification
    await page.evaluate(() => {
        const THREE = window.THREE;
        if (!THREE || !window.scene) return;
        
        // Remove old debug cubes
        const oldCubes = window.scene.children.filter(child => child.userData.isDebugCube);
        oldCubes.forEach(cube => window.scene.remove(cube));
        
        // Add new debug cubes
        const scenario = window.amongUsScenario;
        if (!scenario) return;
        
        // Agent position cubes
        scenario.agents.forEach(agent => {
            const geometry = new THREE.BoxGeometry(1, 0.1, 1);
            const material = new THREE.MeshBasicMaterial({ 
                color: agent.alive ? agent.color : 0x333333,
                opacity: agent.alive ? 1 : 0.5,
                transparent: true
            });
            const cube = new THREE.Mesh(geometry, material);
            cube.position.set(agent.position.x, 0.1, agent.position.z);
            cube.userData.isDebugCube = true;
            cube.userData.agentId = agent.id;
            window.scene.add(cube);
        });
        
        // Task position markers
        scenario.tasks.forEach(task => {
            const geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 8);
            const material = new THREE.MeshBasicMaterial({ 
                color: 0x00ff00,
                opacity: 0.8,
                transparent: true
            });
            const marker = new THREE.Mesh(geometry, material);
            marker.position.set(task.position.x, 0.1, task.position.z);
            marker.userData.isDebugCube = true;
            marker.userData.taskId = task.id;
            window.scene.add(marker);
        });
    });
}

async function verifyProximity(page) {
    return await page.evaluate(() => {
        const scenario = window.amongUsScenario;
        if (!scenario) return { errors: ['No scenario found'] };
        
        const errors = [];
        const TASK_PROXIMITY = 2;
        const KILL_PROXIMITY = 2;
        
        // Check task proximity
        scenario.agents.forEach(agent => {
            if (agent.currentTask) {
                const task = scenario.tasks.find(t => t.id === agent.currentTask.id);
                if (task) {
                    const distance = Math.sqrt(
                        Math.pow(agent.position.x - task.position.x, 2) +
                        Math.pow(agent.position.z - task.position.z, 2)
                    );
                    if (distance > TASK_PROXIMITY) {
                        errors.push(`${agent.name} doing task from ${distance.toFixed(2)} units away (max: ${TASK_PROXIMITY})`);
                    }
                }
            }
        });
        
        // Check kill proximity  
        const impostors = scenario.agents.filter(a => a.alive && a.role === 'impostor');
        const crewmates = scenario.agents.filter(a => a.alive && a.role === 'crewmate');
        
        impostors.forEach(impostor => {
            crewmates.forEach(crewmate => {
                const distance = Math.sqrt(
                    Math.pow(impostor.position.x - crewmate.position.x, 2) +
                    Math.pow(impostor.position.z - crewmate.position.z, 2)
                );
                
                if (impostor.lastKillTarget === crewmate.id && distance > KILL_PROXIMITY) {
                    errors.push(`${impostor.name} killed ${crewmate.name} from ${distance.toFixed(2)} units away (max: ${KILL_PROXIMITY})`);
                }
            });
        });
        
        return { errors, proximityValid: errors.length === 0 };
    });
}

async function captureScreenshot(page, name) {
    const screenshotDir = join(__dirname, '..', 'test-screenshots');
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    const path = join(screenshotDir, `${name}-${Date.now()}.png`);
    await page.screenshot({ path, fullPage: false });
    console.log(`📸 Screenshot saved: ${path}`);
    return path;
}

async function verifyUIElements(page) {
    return await page.evaluate(() => {
        const elements = {
            startButton: !!document.querySelector('button:has-text("Start Among Us")'),
            taskProgress: !!document.querySelector('[id*="progress"], .task-progress'),
            chatArea: !!document.querySelector('.chat-bubble, [class*="chat"]'),
            gameCanvas: !!document.querySelector('canvas'),
            playerList: !!document.querySelector('[class*="player"], .agent-info')
        };
        
        const missingElements = Object.entries(elements)
            .filter(([_, exists]) => !exists)
            .map(([name]) => name);
            
        return {
            elements,
            missingElements,
            uiValid: missingElements.length === 0
        };
    });
}

async function runVisualTests() {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1280, height: 720 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Enable console logging
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.error('❌ Browser Error:', msg.text());
            }
        });
        
        console.log('1️⃣ Loading Among Us game...');
        await page.goto('http://localhost:3001/amongus.html', { waitUntil: 'networkidle2' });
        
        // Wait for game to load
        await page.waitForSelector('canvas', { timeout: 10000 });
        
        console.log('2️⃣ Verifying UI elements...');
        const uiCheck = await verifyUIElements(page);
        if (!uiCheck.uiValid) {
            console.error('❌ Missing UI elements:', uiCheck.missingElements);
        } else {
            console.log('✅ All UI elements present');
        }
        
        console.log('3️⃣ Starting game...');
        await page.click('button:has-text("Start Among Us")');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('4️⃣ Setting up overhead view and debug markers...');
        await createOverheadView(page);
        await addDebugCubes(page);
        await captureScreenshot(page, 'amongus-overhead-initial');
        
        console.log('5️⃣ Monitoring game state...');
        let testResults = {
            movementDetected: false,
            tasksStarted: false,
            tasksCompleted: false,
            killsDetected: false,
            bodiesReported: false,
            meetingsTriggered: false,
            proximityValid: true
        };
        
        let previousPositions = {};
        let testDuration = 30000; // 30 seconds
        let startTime = Date.now();
        
        while (Date.now() - startTime < testDuration) {
            const gameState = await captureGameState(page);
            
            if (gameState) {
                // Check movement
                gameState.agents.forEach(agent => {
                    if (previousPositions[agent.id]) {
                        const moved = 
                            Math.abs(agent.position.x - previousPositions[agent.id].x) > 0.1 ||
                            Math.abs(agent.position.z - previousPositions[agent.id].z) > 0.1;
                        if (moved) testResults.movementDetected = true;
                    }
                    previousPositions[agent.id] = { ...agent.position };
                });
                
                // Check tasks
                if (gameState.agents.some(a => a.currentTask)) {
                    testResults.tasksStarted = true;
                }
                if (gameState.taskProgress > 0) {
                    testResults.tasksCompleted = true;
                }
                
                // Check kills
                if (gameState.agents.some(a => !a.alive)) {
                    testResults.killsDetected = true;
                }
                
                // Check bodies
                if (gameState.bodies.length > 0) {
                    testResults.bodiesReported = true;
                }
                
                // Check meetings
                if (gameState.phase === 'meeting' || gameState.phase === 'voting') {
                    testResults.meetingsTriggered = true;
                }
                
                // Verify proximity
                const proximityCheck = await verifyProximity(page);
                if (!proximityCheck.proximityValid) {
                    testResults.proximityValid = false;
                    console.error('❌ Proximity violations:', proximityCheck.errors);
                }
                
                // Update debug cubes
                await addDebugCubes(page);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('6️⃣ Final state capture...');
        await captureScreenshot(page, 'amongus-overhead-final');
        
        console.log('\n📊 Test Results:');
        console.log('================');
        Object.entries(testResults).forEach(([test, passed]) => {
            console.log(`${passed ? '✅' : '❌'} ${test}`);
        });
        
        const allTestsPassed = Object.values(testResults).every(v => v);
        
        if (allTestsPassed) {
            console.log('\n✨ All visual tests PASSED! Among Us is working correctly!');
        } else {
            console.log('\n⚠️  Some tests FAILED. Check the implementation.');
        }
        
        return testResults;
        
    } catch (error) {
        console.error('❌ Test error:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// Run the tests
runVisualTests().catch(console.error); 