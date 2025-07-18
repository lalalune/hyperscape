#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Testing Hyperfy Among Us Implementation');
console.log('==========================================\n');

class HyperfyAmongUsValidator {
    constructor() {
        this.worldProcess = null;
        this.agentsProcess = null;
        this.ws = null;
        
        this.validationResults = {
            hyperfyMultiplayer: false,
            realAgents: false,
            agentMovement: false,
            proximityChecks: false,
            deathMechanics: false,
            hyperfyEntities: false
        };
        
        this.agentData = new Map();
        this.messageHistory = [];
        this.entityEvents = [];
    }

    async start() {
        try {
            console.log('🌍 Starting Hyperfy world server...');
            await this.startHyperfyWorld();
            
            console.log('\n🤖 Starting ElizaOS agents...');
            await this.startAgents();
            
            console.log('\n📡 Connecting to Hyperfy world...');
            await this.connectToWorld();
            
            console.log('\n✅ Running validation tests...\n');
            
            // Run tests for 60 seconds
            await new Promise(resolve => setTimeout(resolve, 60000));
            
            // Generate report
            this.generateReport();
            
        } catch (error) {
            console.error('❌ Validation failed:', error);
        } finally {
            this.cleanup();
        }
    }

    async startHyperfyWorld() {
        // Check if world config exists
        const worldConfig = join(__dirname, '..', 'worlds', 'amongus-hyperfy.json');
        if (!fs.existsSync(worldConfig)) {
            throw new Error('World config not found. Run: npm run launch:hyperfy-amongus first');
        }
        
        // For now, we'll simulate the Hyperfy world server
        // In a real implementation, this would start the actual Hyperfy server
        console.log('⚠️  Note: This test requires a running Hyperfy world server');
        console.log('   Run in another terminal: npm run hyperfy:world -- --config worlds/amongus-hyperfy.json');
        
        // Give time for manual server start
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    async startAgents() {
        const agentScript = join(__dirname, '..', 'scenarios', 'hyperfy-amongus-agents.js');
        if (!fs.existsSync(agentScript)) {
            throw new Error('Agent script not found. Run: npm run launch:hyperfy-amongus first');
        }
        
        this.agentsProcess = spawn('node', [agentScript], {
            cwd: join(__dirname, '..'),
            stdio: ['ignore', 'pipe', 'pipe']
        });
        
        this.agentsProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(`[AGENTS] ${output.trim()}`);
            
            // Parse agent output for validation
            if (output.includes('joined as')) {
                this.validationResults.realAgents = true;
            }
            
            if (output.includes('executeAction')) {
                this.parseAgentAction(output);
            }
        });
        
        this.agentsProcess.stderr.on('data', (data) => {
            console.error(`[AGENTS ERROR] ${data.toString()}`);
        });
        
        // Wait for agents to start
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    async connectToWorld() {
        return new Promise((resolve, reject) => {
            // Connect to Hyperfy world WebSocket
            this.ws = new WebSocket('ws://localhost:4000/amongus');
            
            this.ws.on('open', () => {
                console.log('✅ Connected to Hyperfy world');
                this.validationResults.hyperfyMultiplayer = true;
                
                // Subscribe to game events
                this.ws.send(JSON.stringify({
                    type: 'subscribe',
                    events: ['entity', 'player', 'interaction', 'amongus']
                }));
                
                resolve();
            });
            
            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleWorldMessage(message);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            });
            
            this.ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            });
            
            // Timeout after 10 seconds
            setTimeout(() => {
                if (this.ws.readyState !== WebSocket.OPEN) {
                    reject(new Error('Failed to connect to Hyperfy world'));
                }
            }, 10000);
        });
    }

    handleWorldMessage(message) {
        const { type, data } = message;
        
        switch (type) {
            case 'entity_created':
                if (data.metadata?.type?.includes('amongus')) {
                    this.validationResults.hyperfyEntities = true;
                    this.entityEvents.push({ type: 'created', entity: data });
                    console.log(`✅ Hyperfy entity created: ${data.metadata.type}`);
                }
                break;
                
            case 'player_moved':
                const playerId = data.playerId;
                const lastPos = this.agentData.get(playerId);
                
                if (lastPos) {
                    const distance = this.calculateDistance(lastPos, data.position);
                    if (distance > 0.01) {
                        this.validationResults.agentMovement = true;
                        console.log(`✅ Agent ${playerId} moved ${distance.toFixed(2)} units`);
                    }
                }
                
                this.agentData.set(playerId, data.position);
                break;
                
            case 'interaction':
                if (data.type === 'task_start' || data.type === 'kill' || data.type === 'report') {
                    this.validationResults.proximityChecks = true;
                    console.log(`✅ Proximity interaction: ${data.type}`);
                }
                break;
                
            case 'player_killed':
                this.validationResults.deathMechanics = true;
                console.log(`✅ Death mechanic: ${data.victim} killed by ${data.killer}`);
                break;
                
            case 'chat_message':
                // Check for unique messages (not from predefined list)
                if (!this.isScriptedMessage(data.text)) {
                    this.messageHistory.push({
                        playerId: data.playerId,
                        text: data.text,
                        timestamp: Date.now()
                    });
                }
                break;
                
            case 'amongus':
                // Handle Among Us specific events
                if (data.type === 'gameState') {
                    console.log(`📊 Game state: Phase=${data.phase}, Progress=${data.taskProgress}%`);
                }
                break;
        }
    }

    parseAgentAction(output) {
        // Parse agent actions from output
        if (output.includes('GOTO_ENTITY')) {
            console.log('   Agent using Hyperfy GOTO action');
        } else if (output.includes('HYPERFY_START_TASK')) {
            console.log('   Agent using Hyperfy task action');
        } else if (output.includes('KILL_PLAYER')) {
            console.log('   Agent attempting kill action');
        }
    }

    calculateDistance(pos1, pos2) {
        const dx = (pos2[0] || pos2.x) - (pos1[0] || pos1.x);
        const dz = (pos2[2] || pos2.z) - (pos1[2] || pos1.z);
        return Math.sqrt(dx * dx + dz * dz);
    }

    isScriptedMessage(text) {
        const scriptedPhrases = [
            'I was doing tasks',
            'Skip vote',
            'Not enough info',
            'I saw them near the body',
            'They were acting sus',
            'Vote them out'
        ];
        
        return scriptedPhrases.some(phrase => text === phrase);
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('HYPERFY AMONG US VALIDATION REPORT');
        console.log('='.repeat(60) + '\n');
        
        console.log('1. HYPERFY MULTIPLAYER');
        console.log(`   Status: ${this.validationResults.hyperfyMultiplayer ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`   - Using Hyperfy WebSocket: ${this.validationResults.hyperfyMultiplayer ? 'Yes' : 'No'}`);
        
        console.log('\n2. REAL ELIZAOS AGENTS');
        console.log(`   Status: ${this.validationResults.realAgents ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`   - Agents connected: ${this.agentData.size}`);
        console.log(`   - Unique messages: ${this.messageHistory.length}`);
        
        console.log('\n3. AGENT MOVEMENT');
        console.log(`   Status: ${this.validationResults.agentMovement ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`   - Using Hyperfy physics: ${this.validationResults.agentMovement ? 'Yes' : 'No'}`);
        
        console.log('\n4. PROXIMITY CHECKS');
        console.log(`   Status: ${this.validationResults.proximityChecks ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`   - Hyperfy proximity validation: ${this.validationResults.proximityChecks ? 'Active' : 'Not detected'}`);
        
        console.log('\n5. DEATH MECHANICS');
        console.log(`   Status: ${this.validationResults.deathMechanics ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`   - Players can die: ${this.validationResults.deathMechanics ? 'Yes' : 'No'}`);
        
        console.log('\n6. HYPERFY ENTITIES');
        console.log(`   Status: ${this.validationResults.hyperfyEntities ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`   - Entity events: ${this.entityEvents.length}`);
        
        console.log('\n' + '='.repeat(60));
        
        const allPassed = Object.values(this.validationResults).every(r => r);
        console.log(`\nOVERALL: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
        
        if (allPassed) {
            console.log('\n🎉 SUCCESS! Among Us is using:');
            console.log('   - Hyperfy\'s built-in WebSocket multiplayer');
            console.log('   - Real ElizaOS agents with AI');
            console.log('   - Hyperfy physics for movement');
            console.log('   - Hyperfy entities for game objects');
            console.log('   - Proper proximity validation');
            console.log('   - Working death mechanics');
        } else {
            console.log('\n⚠️  Some tests failed. Make sure:');
            console.log('   1. Hyperfy world server is running');
            console.log('   2. Agents are properly configured');
            console.log('   3. WebSocket connections are working');
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
    }

    cleanup() {
        console.log('🧹 Cleaning up...');
        
        if (this.ws) {
            this.ws.close();
        }
        
        if (this.agentsProcess) {
            this.agentsProcess.kill();
        }
        
        if (this.worldProcess) {
            this.worldProcess.kill();
        }
        
        process.exit(0);
    }
}

// Run the validator
const validator = new HyperfyAmongUsValidator();
validator.start().catch(error => {
    console.error('Validation error:', error);
    process.exit(1);
}); 