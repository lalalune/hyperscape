#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🎮 Launching Real ElizaOS Agents with Hyperfy Plugin');
console.log('===================================================\n');

// Create agent runner script
const agentRunnerScript = `
import { createAgentRuntime } from '@elizaos/core';
import { HyperfyService } from '../dist/service.js';
import hyperfyPlugin from '../dist/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load character configurations
const characterFiles = [
    'red.json', 'purple.json', 'blue.json', 'green.json',
    'yellow.json', 'orange.json', 'black.json', 'white.json'
];

async function startAgents() {
    console.log('🚀 Starting real ElizaOS agents with Hyperfy plugin...');
    
    const agents = [];
    
    for (const charFile of characterFiles) {
        const charPath = path.join(__dirname, '..', 'src', 'agents', 'characters', charFile);
        const character = JSON.parse(fs.readFileSync(charPath, 'utf-8'));
        
        // Create runtime with Hyperfy plugin
        const runtime = await createAgentRuntime({
            agentId: character.id || \`agent-\${character.name.toLowerCase()}\`,
            character,
            plugins: [hyperfyPlugin],
            services: [],
            actions: [],
            providers: []
        });
        
        // Initialize Hyperfy service
        const hyperfyService = runtime.getService(HyperfyService.serviceName);
        if (hyperfyService) {
            // Connect to Hyperfy world
            const worldUrl = process.env.HYPERFY_WORLD_URL || 'ws://localhost:4000/amongus';
            await hyperfyService.connectToWorld(worldUrl);
            
            console.log(\`✅ \${character.settings.emoji} \${character.name} connected as \${character.settings.gameRole}\`);
            
            // Join world as player
            const world = hyperfyService.getWorld();
            if (world && world.app) {
                // Emit player join event
                world.app.emit('playerJoin', {
                    id: runtime.agentId,
                    name: character.name,
                    metadata: {
                        color: character.settings.color,
                        emoji: character.settings.emoji,
                        role: character.settings.gameRole
                    },
                    position: [25 + Math.random() * 10 - 5, 0, 25 + Math.random() * 10 - 5]
                });
            }
            
            // Start decision loop
            startAgentDecisionLoop(runtime, character);
        }
        
        agents.push(runtime);
    }
    
    console.log(\`\\n✅ All \${agents.length} agents connected to Hyperfy world!\\n\`);
    
    // Keep process alive
    process.on('SIGINT', async () => {
        console.log('\\n🛑 Shutting down agents...');
        for (const agent of agents) {
            const service = agent.getService(HyperfyService.serviceName);
            if (service) {
                await service.disconnect();
            }
        }
        process.exit(0);
    });
}

function startAgentDecisionLoop(runtime, character) {
    const hyperfyService = runtime.getService(HyperfyService.serviceName);
    const isImpostor = character.settings.gameRole === 'impostor';
    
    setInterval(async () => {
        const world = hyperfyService?.getWorld();
        const app = world?.app;
        
        if (!app || app.gameState?.phase !== 'gameplay') return;
        
        const player = app.getPlayer(runtime.agentId);
        if (!player || !player.alive) return;
        
        // Get nearby entities
        const nearbyPlayers = app.getNearbyPlayers(runtime.agentId, 10);
        const nearbyTasks = app.getNearbyTasks(runtime.agentId, 10);
        const nearbyBodies = app.getNearbyBodies(runtime.agentId, 10);
        
        // Make decisions based on role
        if (isImpostor) {
            await makeImpostorDecision(runtime, player, nearbyPlayers, nearbyTasks);
        } else {
            await makeCrewmateDecision(runtime, player, nearbyTasks, nearbyBodies);
        }
        
    }, 2000 + Math.random() * 1000); // Randomize timing
}

async function makeImpostorDecision(runtime, player, nearbyPlayers, nearbyTasks) {
    // Look for isolated victims
    const victims = nearbyPlayers.filter(p => p.alive && p.role === 'crewmate');
    
    if (victims.length > 0 && Date.now() - player.lastKillTime > 20000) {
        const target = victims[0];
        const distance = calculateDistance(player.position, target.position);
        
        if (distance <= 2.0) {
            // Check for witnesses
            const witnesses = nearbyPlayers.filter(p => 
                p.id !== player.id && p.id !== target.id && p.alive
            );
            
            if (witnesses.length === 0) {
                // Execute kill action
                await runtime.execute({
                    action: 'HYPERFY_KILL_PLAYER',
                    content: { targetId: target.id }
                });
            }
        } else {
            // Move towards target
            await runtime.execute({
                action: 'HYPERFY_GOTO_ENTITY',
                content: { entityId: target.id }
            });
        }
    } else {
        // Fake task behavior
        if (nearbyTasks.length > 0) {
            const task = nearbyTasks[Math.floor(Math.random() * nearbyTasks.length)];
            await runtime.execute({
                action: 'HYPERFY_GOTO_ENTITY',
                content: { entityId: task.entity?.id || task.id }
            });
        } else {
            // Wander
            await runtime.execute({
                action: 'WALK_RANDOMLY'
            });
        }
    }
}

async function makeCrewmateDecision(runtime, player, nearbyTasks, nearbyBodies) {
    // Check for bodies to report
    if (nearbyBodies.length > 0) {
        const body = nearbyBodies[0];
        const distance = calculateDistance(player.position, body.position);
        
        if (distance <= 2.0) {
            // Report body
            await runtime.execute({
                action: 'HYPERFY_REPORT_BODY',
                content: { bodyId: body.id }
            });
        } else {
            // Move to body
            await runtime.execute({
                action: 'HYPERFY_GOTO_ENTITY',
                content: { entityId: body.entity?.id || body.id }
            });
        }
    } else if (player.currentTask) {
        // Continue current task
        // Task completion is handled by the app
    } else if (nearbyTasks.length > 0) {
        // Find uncompleted task
        const uncompletedTasks = nearbyTasks.filter(t => !t.completedBy.has(player.id));
        
        if (uncompletedTasks.length > 0) {
            const task = uncompletedTasks[0];
            const distance = calculateDistance(player.position, task.position);
            
            if (distance <= 2.0) {
                // Start task
                await runtime.execute({
                    action: 'HYPERFY_START_TASK',
                    content: { taskId: task.id }
                });
            } else {
                // Move to task
                await runtime.execute({
                    action: 'HYPERFY_GOTO_ENTITY',
                    content: { entityId: task.entity?.id || task.id }
                });
            }
        }
    } else {
        // Wander
        await runtime.execute({
            action: 'WALK_RANDOMLY'
        });
    }
    
    // Occasionally send chat
    if (Math.random() < 0.02) {
        await runtime.execute({
            action: 'REPLY',
            content: { 
                text: generateCrewmateMessage(player)
            }
        });
    }
}

function calculateDistance(pos1, pos2) {
    const dx = (pos2[0] || pos2.x) - (pos1[0] || pos1.x);
    const dz = (pos2[2] || pos2.z) - (pos1[2] || pos1.z);
    return Math.sqrt(dx * dx + dz * dz);
}

function generateCrewmateMessage(player) {
    const messages = [
        \`I'm doing tasks in \${['electrical', 'medbay', 'admin', 'cafeteria'][Math.floor(Math.random() * 4)]}\`,
        \`\${player.tasksCompleted} tasks done so far\`,
        'Anyone see anything suspicious?',
        'Stay safe everyone!',
        'We need to finish these tasks quickly',
        'I think I saw someone vent...',
        'Who was near the body?'
    ];
    
    return messages[Math.floor(Math.random() * messages.length)];
}

// Start the agents
startAgents().catch(console.error);
`;

// Save the runner script
const runnerPath = join(__dirname, '..', 'temp-agent-runner.js');
fs.writeFileSync(runnerPath, agentRunnerScript);

console.log('✅ Agent runner script created');

// Check if plugin is built
const distPath = join(__dirname, '..', 'dist', 'index.js');
if (!fs.existsSync(distPath)) {
    console.log('\n⚠️  Plugin not built. Building now...');
    const buildProcess = spawn('npm', ['run', 'build'], {
        cwd: join(__dirname, '..'),
        stdio: 'inherit'
    });
    
    buildProcess.on('close', (code) => {
        if (code === 0) {
            console.log('\n✅ Plugin built successfully');
            launchAgents(runnerPath);
        } else {
            console.error('❌ Build failed');
            process.exit(1);
        }
    });
} else {
    launchAgents(runnerPath);
}

function launchAgents(runnerPath) {
    console.log('\n🚀 Launching agents...\n');
    
    const agentProcess = spawn('node', [runnerPath], {
        cwd: join(__dirname, '..'),
        stdio: 'inherit',
        env: {
            ...process.env,
            HYPERFY_WORLD_URL: process.env.HYPERFY_WORLD_URL || 'ws://localhost:4000/amongus'
        }
    });
    
    agentProcess.on('error', (error) => {
        console.error('❌ Failed to start agents:', error);
        cleanup();
    });
    
    agentProcess.on('close', (code) => {
        console.log(`Agent process exited with code ${code}`);
        cleanup();
    });
    
    // Handle cleanup
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down...');
        agentProcess.kill();
        cleanup();
    });
}

function cleanup() {
    const runnerPath = join(__dirname, '..', 'temp-agent-runner.js');
    if (fs.existsSync(runnerPath)) {
        fs.unlinkSync(runnerPath);
    }
    process.exit(0);
} 