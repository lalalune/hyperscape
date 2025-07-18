
import { createAgent } from '@elizaos/core';
import { HyperfyService } from '../src/service.js';
import { hyperfyPlugin } from '../src/index.js';
import fs from 'fs';
import path from 'path';

// Agent configurations
const agents = [
    { name: 'Red', color: '#FF0000', emoji: '🔴', role: 'impostor' },
    { name: 'Purple', color: '#800080', emoji: '🟣', role: 'impostor' },
    { name: 'Blue', color: '#0000FF', emoji: '🔵', role: 'crewmate' },
    { name: 'Green', color: '#00FF00', emoji: '🟢', role: 'crewmate' },
    { name: 'Yellow', color: '#FFFF00', emoji: '🟡', role: 'crewmate' },
    { name: 'Orange', color: '#FFA500', emoji: '🟠', role: 'crewmate' },
    { name: 'Black', color: '#000000', emoji: '⚫', role: 'crewmate' },
    { name: 'White', color: '#FFFFFF', emoji: '⚪', role: 'crewmate' }
];

async function startAgents() {
    console.log('🚀 Starting Among Us agents with Hyperfy...');
    
    // World URL - modify this to your Hyperfy world
    const worldUrl = process.env.HYPERFY_WORLD_URL || 'ws://localhost:4000/amongus';
    
    for (const agentConfig of agents) {
        const characterPath = path.join(process.cwd(), 'src/agents/characters', `${agentConfig.name.toLowerCase()}.json`);
        const character = JSON.parse(fs.readFileSync(characterPath, 'utf-8'));
        
        // Add Among Us specific data
        character.settings = {
            ...character.settings,
            gameRole: agentConfig.role,
            color: agentConfig.color,
            emoji: agentConfig.emoji
        };
        
        // Create agent with Hyperfy plugin
        const agent = await createAgent({
            name: agentConfig.name,
            character,
            plugins: [hyperfyPlugin],
            settings: {
                hyperfyWorld: worldUrl,
                hyperfyAvatar: 'https://assets.hyperfy.xyz/avatars/default.vrm',
                autoJoinWorld: true
            }
        });
        
        console.log(`✅ ${agentConfig.emoji} ${agentConfig.name} joined as ${agentConfig.role}`);
        
        // Start agent decision loop
        startAgentLoop(agent, agentConfig);
    }
}

function startAgentLoop(agent, config) {
    setInterval(async () => {
        const runtime = agent.runtime;
        const worldState = runtime.worldState;
        
        if (!worldState || !worldState.gamePhase) return;
        
        if (worldState.gamePhase === 'gameplay') {
            if (config.role === 'impostor') {
                await makeImpostorDecision(agent, worldState);
            } else {
                await makeCrewmateDecision(agent, worldState);
            }
        } else if (worldState.gamePhase === 'meeting') {
            await participateInMeeting(agent, worldState);
        }
    }, 2000);
}

async function makeImpostorDecision(agent, worldState) {
    // Look for isolated targets
    const nearbyPlayers = worldState.nearbyPlayers || [];
    const targets = nearbyPlayers.filter(p => p.alive && p.role === 'crewmate');
    
    if (targets.length > 0 && !agent.killCooldown) {
        const target = targets[0];
        const distance = calculateDistance(agent.position, target.position);
        
        if (distance <= 2.0) {
            // Check for witnesses
            const witnesses = nearbyPlayers.filter(p => 
                p.id !== agent.id && p.id !== target.id && p.alive
            );
            
            if (witnesses.length === 0) {
                await agent.executeAction('KILL_PLAYER', { targetId: target.id });
                agent.killCooldown = Date.now() + 20000;
            }
        } else {
            // Move towards target
            await agent.executeAction('GOTO_ENTITY', { entityId: target.id });
        }
    } else {
        // Fake doing tasks
        await fakeTask(agent, worldState);
    }
}

async function makeCrewmateDecision(agent, worldState) {
    // Check for bodies
    const bodies = worldState.bodies || [];
    const nearbyBody = bodies.find(b => {
        const distance = calculateDistance(agent.position, b.position);
        return distance <= 10.0 && !b.reported;
    });
    
    if (nearbyBody) {
        const distance = calculateDistance(agent.position, nearbyBody.position);
        if (distance <= 2.0) {
            await agent.executeAction('REPORT_BODY', { bodyId: nearbyBody.id });
        } else {
            await agent.executeAction('GOTO_ENTITY', { entityId: nearbyBody.id });
        }
    } else {
        // Do tasks
        await doTask(agent, worldState);
    }
}

async function doTask(agent, worldState) {
    const tasks = worldState.tasks || [];
    const incompleteTasks = tasks.filter(t => !t.completedBy?.includes(agent.id));
    
    if (incompleteTasks.length > 0) {
        const nearestTask = incompleteTasks.reduce((nearest, task) => {
            const distance = calculateDistance(agent.position, task.position);
            if (!nearest || distance < nearest.distance) {
                return { task, distance };
            }
            return nearest;
        }, null);
        
        if (nearestTask.distance <= 2.0) {
            if (!agent.currentTask) {
                await agent.executeAction('START_TASK', { taskId: nearestTask.task.id });
                agent.currentTask = nearestTask.task;
            } else if (Date.now() - agent.taskStartTime >= agent.currentTask.duration) {
                await agent.executeAction('COMPLETE_TASK');
                agent.currentTask = null;
            }
        } else {
            await agent.executeAction('GOTO_ENTITY', { entityId: nearestTask.task.id });
        }
    } else {
        // Wander
        await agent.executeAction('WALK_RANDOMLY');
    }
}

async function fakeTask(agent, worldState) {
    const tasks = worldState.tasks || [];
    if (tasks.length > 0) {
        const randomTask = tasks[Math.floor(Math.random() * tasks.length)];
        await agent.executeAction('GOTO_ENTITY', { entityId: randomTask.id });
    } else {
        await agent.executeAction('WALK_RANDOMLY');
    }
}

async function participateInMeeting(agent, worldState) {
    // Send chat based on role and info
    const messages = agent.role === 'impostor' 
        ? ['I was doing tasks', 'Skip vote', 'Not enough info']
        : ['I saw them near the body', 'They were acting sus', 'Vote them out'];
        
    const message = messages[Math.floor(Math.random() * messages.length)];
    await agent.executeAction('REPLY', { text: message });
}

function calculateDistance(pos1, pos2) {
    const dx = pos2[0] - pos1[0];
    const dz = pos2[2] - pos1[2];
    return Math.sqrt(dx * dx + dz * dz);
}

// Start the agents
startAgents().catch(console.error);
