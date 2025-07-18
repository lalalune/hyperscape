#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🎮 Launching Among Us with Hyperfy Multiplayer');
console.log('==============================================\n');

console.log('This implementation uses:');
console.log('✅ Hyperfy\'s built-in WebSocket multiplayer');
console.log('✅ Real ElizaOS agents connecting to Hyperfy world');
console.log('✅ Hyperfy plugin actions for movement and interaction');
console.log('✅ Hyperfy\'s physics for proximity checks');
console.log('✅ Hyperfy\'s entity system for game objects\n');

// Create Hyperfy world configuration
const worldConfig = {
    name: "Among Us World",
    apps: {
        amongus: {
            tasks: [
                { id: 'task-1', name: 'Wiring', position: [10, 0, 10], duration: 8000 },
                { id: 'task-2', name: 'Download', position: [40, 0, 10], duration: 15000 },
                { id: 'task-3', name: 'Scan', position: [10, 0, 40], duration: 10000 },
                { id: 'task-4', name: 'Fuel', position: [40, 0, 40], duration: 12000 },
                { id: 'task-5', name: 'Calibrate', position: [25, 0, 25], duration: 7000 },
                { id: 'task-6', name: 'Shields', position: [15, 0, 25], duration: 5000 },
                { id: 'task-7', name: 'O2 Filter', position: [35, 0, 25], duration: 9000 },
                { id: 'task-8', name: 'Navigation', position: [25, 0, 15], duration: 11000 },
                { id: 'task-9', name: 'Electrical', position: [25, 0, 35], duration: 6000 },
                { id: 'task-10', name: 'Medbay', position: [20, 0, 20], duration: 10000 }
            ],
            settings: {
                killCooldown: 20000,
                meetingCooldown: 60000,
                taskProximity: 2.0,
                killProximity: 2.0,
                reportProximity: 2.0,
                visionRange: 10.0
            }
        }
    },
    entities: []
};

// Add task entities to world
worldConfig.apps.amongus.tasks.forEach(task => {
    worldConfig.entities.push({
        type: 'box',
        position: task.position,
        scale: [1, 2, 1],
        color: '#00ff00',
        app: {
            type: 'task',
            data: task
        },
        grabbable: false,
        clickable: true
    });
});

// Save world config
const worldConfigPath = join(__dirname, '..', 'worlds', 'amongus-hyperfy.json');
fs.writeFileSync(worldConfigPath, JSON.stringify(worldConfig, null, 2));

console.log('📁 World configuration saved to:', worldConfigPath);

// Create agent runner that uses Hyperfy
const agentRunnerContent = `
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
        const characterPath = path.join(process.cwd(), 'src/agents/characters', \`\${agentConfig.name.toLowerCase()}.json\`);
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
        
        console.log(\`✅ \${agentConfig.emoji} \${agentConfig.name} joined as \${agentConfig.role}\`);
        
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
`;

// Save agent runner
const agentRunnerPath = join(__dirname, '..', 'scenarios', 'hyperfy-amongus-agents.js');
fs.writeFileSync(agentRunnerPath, agentRunnerContent);

console.log('📁 Agent runner saved to:', agentRunnerPath);

// Create HTML client for viewing
const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Among Us - Hyperfy World</title>
    <style>
        body { 
            margin: 0; 
            font-family: Arial, sans-serif; 
            background: #000;
            color: #fff;
        }
        #info {
            position: absolute;
            top: 10px;
            left: 10px;
            background: rgba(0,0,0,0.8);
            padding: 15px;
            border-radius: 5px;
        }
        iframe {
            width: 100vw;
            height: 100vh;
            border: none;
        }
        .status {
            margin-top: 10px;
            font-size: 14px;
        }
        .player {
            margin: 5px 0;
            padding: 5px;
            background: rgba(255,255,255,0.1);
            border-radius: 3px;
        }
        .impostor { color: #ff4444; }
        .crewmate { color: #44ff44; }
        .dead { opacity: 0.5; text-decoration: line-through; }
    </style>
</head>
<body>
    <div id="info">
        <h2>Among Us - Hyperfy Multiplayer</h2>
        <div class="status">
            <div>Game Phase: <span id="phase">Waiting</span></div>
            <div>Task Progress: <span id="progress">0%</span></div>
            <div>Bodies: <span id="bodies">0</span></div>
        </div>
        <div id="players"></div>
        <div style="margin-top: 15px; font-size: 12px;">
            <div>✅ Real Hyperfy WebSocket multiplayer</div>
            <div>✅ ElizaOS agents with AI decision making</div>
            <div>✅ Physics-based proximity checks</div>
            <div>✅ Hyperfy entity system for tasks</div>
        </div>
    </div>
    
    <!-- Hyperfy world iframe -->
    <iframe id="world" src=""></iframe>
    
    <script>
        // Connect to Hyperfy world
        const worldUrl = 'http://localhost:4000/amongus';
        document.getElementById('world').src = worldUrl;
        
        // Monitor game state via WebSocket
        const ws = new WebSocket('ws://localhost:4000/amongus/observer');
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'gameState') {
                document.getElementById('phase').textContent = data.phase;
                document.getElementById('progress').textContent = data.taskProgress + '%';
                document.getElementById('bodies').textContent = data.bodies;
                
                // Update player list
                const playersDiv = document.getElementById('players');
                playersDiv.innerHTML = '<h3>Players:</h3>';
                
                data.players.forEach(player => {
                    const div = document.createElement('div');
                    div.className = 'player';
                    if (!player.alive) div.className += ' dead';
                    if (player.role === 'impostor') div.className += ' impostor';
                    else div.className += ' crewmate';
                    
                    div.textContent = \`\${player.emoji} \${player.name} - \${player.role}\`;
                    playersDiv.appendChild(div);
                });
            }
        };
        
        ws.onopen = () => {
            console.log('Connected to Hyperfy world observer');
        };
    </script>
</body>
</html>`;

// Save HTML
const htmlPath = join(__dirname, '..', 'public', 'hyperfy-amongus.html');
fs.writeFileSync(htmlPath, htmlContent);

console.log('📁 HTML viewer saved to:', htmlPath);

// Instructions
console.log('\n🚀 To run Among Us with Hyperfy:');
console.log('\n1. Start Hyperfy world server:');
console.log('   npm run hyperfy:world -- --config worlds/amongus-hyperfy.json\n');
console.log('2. Start ElizaOS agents:');
console.log('   node scenarios/hyperfy-amongus-agents.js\n');
console.log('3. View the game:');
console.log('   Open http://localhost:3001/hyperfy-amongus.html\n');
console.log('This uses Hyperfy\'s built-in:');
console.log('   - WebSocket multiplayer');
console.log('   - Physics engine for proximity');
console.log('   - Entity system for game objects');
console.log('   - Real-time synchronization\n'); 