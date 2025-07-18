#!/usr/bin/env node

import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import Tesseract from 'tesseract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Visual Verification System - Real Gameplay Testing');
console.log('==================================================\n');

class GameplayVerifier {
    constructor() {
        this.screenshotDir = join(__dirname, '..', 'test-screenshots');
        this.results = {
            amongUs: {
                realMovement: false,
                uniqueMessages: new Set(),
                duplicateMessages: [],
                proximityViolations: [],
                taskCompletions: 0,
                kills: 0,
                meetings: 0,
                actualAI: false
            },
            mafia: {
                realMovement: false,
                uniqueMessages: new Set(),
                duplicateMessages: [],
                dayNightCycles: 0,
                votes: 0,
                roleActions: 0,
                actualAI: false
            }
        };
    }
    
    async verifyAmongUs(page) {
        console.log('🎮 Verifying Among Us Gameplay...\n');
        
        // 1. Setup overhead view with debug visualization
        await this.setupOverheadView(page);
        
        // 2. Add colored cube markers
        await this.addDebugMarkers(page);
        
        // 3. Take initial screenshot
        const initialScreen = await this.captureScreenshot(page, 'amongus-initial');
        
        // 4. Monitor for 60 seconds
        const startTime = Date.now();
        const positions = new Map();
        const messages = [];
        
        while (Date.now() - startTime < 60000) {
            // Capture game state
            const state = await page.evaluate(() => {
                const scenario = window.amongUsScenario;
                if (!scenario) return null;
                
                return {
                    agents: scenario.agents.map(a => ({
                        id: a.id,
                        name: a.name,
                        position: { x: a.position.x, z: a.position.z },
                        alive: a.alive,
                        currentTask: a.currentTask,
                        role: a.role
                    })),
                    phase: scenario.phase,
                    taskProgress: scenario.taskProgress,
                    bodies: scenario.bodies || []
                };
            });
            
            if (state) {
                // Check for real movement
                state.agents.forEach(agent => {
                    const key = agent.id;
                    const lastPos = positions.get(key);
                    if (lastPos) {
                        const moved = Math.abs(agent.position.x - lastPos.x) > 0.1 || 
                                     Math.abs(agent.position.z - lastPos.z) > 0.1;
                        if (moved) {
                            this.results.amongUs.realMovement = true;
                        }
                    }
                    positions.set(key, { x: agent.position.x, z: agent.position.z });
                });
                
                // Check task completions
                if (state.taskProgress > this.results.amongUs.taskCompletions) {
                    this.results.amongUs.taskCompletions = state.taskProgress;
                }
                
                // Check for kills
                const deadCount = state.agents.filter(a => !a.alive).length;
                if (deadCount > this.results.amongUs.kills) {
                    this.results.amongUs.kills = deadCount;
                }
                
                // Check for meetings
                if (state.phase === 'meeting' || state.phase === 'voting') {
                    this.results.amongUs.meetings++;
                }
            }
            
            // Capture messages
            const consoleMessages = await page.evaluate(() => {
                const logs = window.consoleLogs || [];
                window.consoleLogs = [];
                return logs;
            });
            
            messages.push(...consoleMessages);
            
            // Update visualization
            await this.updateDebugMarkers(page);
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // 5. Analyze messages for duplicates and AI behavior
        this.analyzeMessages(messages, 'amongUs');
        
        // 6. Take final screenshot
        const finalScreen = await this.captureScreenshot(page, 'amongus-final');
        
        // 7. Use OCR to verify UI elements
        await this.verifyUIWithOCR(finalScreen, 'amongUs');
        
        // 8. Check proximity violations
        await this.checkProximityViolations(page);
        
        return this.results.amongUs;
    }
    
    async verifyMafia(page) {
        console.log('🎭 Verifying Mafia Gameplay...\n');
        
        // Similar verification for Mafia game
        // ... implementation similar to Among Us
        
        return this.results.mafia;
    }
    
    async setupOverheadView(page) {
        await page.evaluate(() => {
            // Create overhead camera
            if (window.scene && window.scene.camera) {
                window.scene.camera.position.set(0, 50, 0);
                window.scene.camera.lookAt(0, 0, 0);
                
                // Disable user controls
                if (window.controls) {
                    window.controls.enabled = false;
                }
                
                // Set orthographic projection for better overhead view
                if (window.THREE) {
                    const aspect = window.innerWidth / window.innerHeight;
                    const frustumSize = 40;
                    const camera = new window.THREE.OrthographicCamera(
                        frustumSize * aspect / -2,
                        frustumSize * aspect / 2,
                        frustumSize / 2,
                        frustumSize / -2,
                        1,
                        1000
                    );
                    camera.position.set(0, 50, 0);
                    camera.lookAt(0, 0, 0);
                    window.scene.camera = camera;
                }
            }
        });
    }
    
    async addDebugMarkers(page) {
        await page.evaluate(() => {
            if (!window.THREE || !window.scene) return;
            
            // Create debug group
            window.debugGroup = new window.THREE.Group();
            window.debugGroup.name = 'debug-markers';
            window.scene.add(window.debugGroup);
            
            // Function to update markers
            window.updateDebugMarkers = () => {
                // Clear old markers
                while (window.debugGroup.children.length > 0) {
                    window.debugGroup.remove(window.debugGroup.children[0]);
                }
                
                const scenario = window.amongUsScenario || window.mafiaScenario;
                if (!scenario || !scenario.agents) return;
                
                // Add flat colored squares for each agent
                scenario.agents.forEach(agent => {
                    const geometry = new window.THREE.PlaneGeometry(2, 2);
                    const material = new window.THREE.MeshBasicMaterial({
                        color: agent.color || 0xffffff,
                        side: window.THREE.DoubleSide,
                        opacity: agent.alive ? 1 : 0.3,
                        transparent: true
                    });
                    
                    const plane = new window.THREE.Mesh(geometry, material);
                    plane.position.set(agent.position.x, 0.1, agent.position.z);
                    plane.rotation.x = -Math.PI / 2;
                    
                    // Add text label
                    if (window.THREE.FontLoader) {
                        // Would add text labels here
                    }
                    
                    window.debugGroup.add(plane);
                });
                
                // Add task markers
                if (scenario.tasks) {
                    scenario.tasks.forEach(task => {
                        const geometry = new window.THREE.RingGeometry(0.5, 1, 6);
                        const material = new window.THREE.MeshBasicMaterial({
                            color: 0x00ff00,
                            side: window.THREE.DoubleSide
                        });
                        
                        const ring = new window.THREE.Mesh(geometry, material);
                        ring.position.set(task.position.x, 0.1, task.position.z);
                        ring.rotation.x = -Math.PI / 2;
                        
                        window.debugGroup.add(ring);
                    });
                }
            };
            
            // Initial update
            window.updateDebugMarkers();
        });
    }
    
    async updateDebugMarkers(page) {
        await page.evaluate(() => {
            if (window.updateDebugMarkers) {
                window.updateDebugMarkers();
            }
        });
    }
    
    async captureScreenshot(page, name) {
        if (!fs.existsSync(this.screenshotDir)) {
            fs.mkdirSync(this.screenshotDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filepath = join(this.screenshotDir, `${name}-${timestamp}.png`);
        
        await page.screenshot({ 
            path: filepath,
            fullPage: false,
            clip: {
                x: 0,
                y: 0,
                width: 1280,
                height: 720
            }
        });
        
        console.log(`📸 Screenshot saved: ${filepath}`);
        return filepath;
    }
    
    analyzeMessages(messages, game) {
        const messageMap = new Map();
        
        messages.forEach(msg => {
            if (msg && typeof msg === 'string' && msg.includes(':')) {
                // Extract the actual message content
                const parts = msg.split(':');
                if (parts.length >= 2) {
                    const content = parts.slice(1).join(':').trim();
                    
                    // Check for duplicates
                    if (messageMap.has(content)) {
                        const count = messageMap.get(content);
                        messageMap.set(content, count + 1);
                        if (count === 1) {
                            this.results[game].duplicateMessages.push(content);
                        }
                    } else {
                        messageMap.set(content, 1);
                        this.results[game].uniqueMessages.add(content);
                    }
                }
            }
        });
        
        // Check for actual AI behavior vs scripted
        const uniqueCount = this.results[game].uniqueMessages.size;
        const duplicateCount = this.results[game].duplicateMessages.length;
        
        // Real AI should have mostly unique messages
        this.results[game].actualAI = uniqueCount > duplicateCount * 2;
    }
    
    async verifyUIWithOCR(screenshotPath, game) {
        try {
            const { data: { text } } = await Tesseract.recognize(
                screenshotPath,
                'eng',
                {
                    logger: m => {} // Suppress logs
                }
            );
            
            // Check for expected UI elements
            const expectedElements = {
                amongUs: ['Task Progress', 'Emergency', 'Report', 'Kill'],
                mafia: ['Day', 'Night', 'Vote', 'Role']
            };
            
            const found = expectedElements[game].filter(element => 
                text.toLowerCase().includes(element.toLowerCase())
            );
            
            console.log(`📝 OCR found UI elements: ${found.join(', ')}`);
        } catch (error) {
            console.error('OCR failed:', error);
        }
    }
    
    async checkProximityViolations(page) {
        const violations = await page.evaluate(() => {
            const scenario = window.amongUsScenario;
            if (!scenario) return [];
            
            const violations = [];
            const TASK_PROXIMITY = 2;
            const KILL_PROXIMITY = 2;
            
            // Check all recent actions
            scenario.agents.forEach(agent => {
                // Check task proximity
                if (agent.currentTask) {
                    const task = scenario.tasks.find(t => t.id === agent.currentTask);
                    if (task) {
                        const dist = Math.sqrt(
                            Math.pow(agent.position.x - task.position.x, 2) +
                            Math.pow(agent.position.z - task.position.z, 2)
                        );
                        if (dist > TASK_PROXIMITY) {
                            violations.push(`${agent.name} doing task from ${dist.toFixed(1)} units away`);
                        }
                    }
                }
            });
            
            return violations;
        });
        
        this.results.amongUs.proximityViolations = violations;
    }
    
    generateReport() {
        console.log('\n📊 VERIFICATION REPORT');
        console.log('===================\n');
        
        console.log('🎮 Among Us Results:');
        console.log(`  ✅ Real Movement: ${this.results.amongUs.realMovement ? 'YES' : 'NO'}`);
        console.log(`  ✅ Unique Messages: ${this.results.amongUs.uniqueMessages.size}`);
        console.log(`  ❌ Duplicate Messages: ${this.results.amongUs.duplicateMessages.length}`);
        console.log(`  ✅ Task Completions: ${this.results.amongUs.taskCompletions}`);
        console.log(`  ✅ Kills: ${this.results.amongUs.kills}`);
        console.log(`  ✅ Meetings: ${this.results.amongUs.meetings}`);
        console.log(`  ✅ Actual AI Behavior: ${this.results.amongUs.actualAI ? 'YES' : 'NO'}`);
        console.log(`  ❌ Proximity Violations: ${this.results.amongUs.proximityViolations.length}`);
        
        console.log('\n🎭 Mafia Results:');
        console.log(`  ✅ Real Movement: ${this.results.mafia.realMovement ? 'YES' : 'NO'}`);
        console.log(`  ✅ Unique Messages: ${this.results.mafia.uniqueMessages.size}`);
        console.log(`  ❌ Duplicate Messages: ${this.results.mafia.duplicateMessages.length}`);
        console.log(`  ✅ Day/Night Cycles: ${this.results.mafia.dayNightCycles}`);
        console.log(`  ✅ Votes: ${this.results.mafia.votes}`);
        console.log(`  ✅ Role Actions: ${this.results.mafia.roleActions}`);
        console.log(`  ✅ Actual AI Behavior: ${this.results.mafia.actualAI ? 'YES' : 'NO'}`);
        
        // Overall assessment
        const amongUsScore = (
            (this.results.amongUs.realMovement ? 1 : 0) +
            (this.results.amongUs.actualAI ? 1 : 0) +
            (this.results.amongUs.taskCompletions > 0 ? 1 : 0) +
            (this.results.amongUs.kills > 0 ? 1 : 0) +
            (this.results.amongUs.proximityViolations.length === 0 ? 1 : 0)
        ) / 5 * 100;
        
        console.log(`\n🏆 Among Us Implementation Score: ${amongUsScore}%`);
        
        if (amongUsScore < 80) {
            console.log('\n⚠️  WARNING: Implementation appears to be scripted/fake!');
            console.log('Issues found:');
            if (!this.results.amongUs.realMovement) console.log('  - No real agent movement detected');
            if (!this.results.amongUs.actualAI) console.log('  - Messages appear scripted (too many duplicates)');
            if (this.results.amongUs.proximityViolations.length > 0) {
                console.log('  - Proximity violations detected:');
                this.results.amongUs.proximityViolations.forEach(v => console.log(`    - ${v}`));
            }
        }
    }
}

// Run verification
async function runVerification() {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1280, height: 720 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Capture console logs
        page.on('console', msg => {
            if (!page.consoleLogs) page.consoleLogs = [];
            page.consoleLogs.push(msg.text());
        });
        
        await page.evaluateOnNewDocument(() => {
            window.consoleLogs = [];
            const originalLog = console.log;
            console.log = function(...args) {
                window.consoleLogs.push(args.join(' '));
                originalLog.apply(console, args);
            };
        });
        
        const verifier = new GameplayVerifier();
        
        // Test Among Us
        console.log('🎮 Testing Among Us...\n');
        await page.goto('http://localhost:3001/amongus.html', { waitUntil: 'networkidle2' });
        await page.waitForSelector('button', { timeout: 5000 });
        await page.click('button:has-text("Start")');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await verifier.verifyAmongUs(page);
        
        // Test Mafia (if available)
        // await page.goto('http://localhost:3001/mafia.html', { waitUntil: 'networkidle2' });
        // await verifier.verifyMafia(page);
        
        // Generate report
        verifier.generateReport();
        
    } catch (error) {
        console.error('❌ Verification error:', error);
    } finally {
        await browser.close();
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runVerification().catch(console.error);
}

export { GameplayVerifier, runVerification }; 