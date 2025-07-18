#!/usr/bin/env node

import { WebSocketServer } from 'ws';

console.log('🌍 Starting Simple WebSocket Server for Observer...\n');

const wss = new WebSocketServer({ port: 3001 });

// Game state
const gameState = {
    phase: 'gameplay',
    players: new Map(),
    tasks: [],
    taskProgress: 0,
    realAgents: false // This is still mock data
};

// Initialize some demo players
const demoPlayers = [
    { id: 'red', name: 'Red', color: '#FF0000', emoji: '🔴', role: 'impostor', alive: true, position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, z: 0 } },
    { id: 'purple', name: 'Purple', color: '#800080', emoji: '🟣', role: 'impostor', alive: true, position: { x: 5, y: 0, z: 5 }, velocity: { x: 0, z: 0 } },
    { id: 'blue', name: 'Blue', color: '#0000FF', emoji: '🔵', role: 'crewmate', alive: true, position: { x: -5, y: 0, z: -5 }, velocity: { x: 0, z: 0 } },
    { id: 'green', name: 'Green', color: '#00FF00', emoji: '🟢', role: 'crewmate', alive: true, position: { x: 10, y: 0, z: 0 }, velocity: { x: 0, z: 0 } },
    { id: 'yellow', name: 'Yellow', color: '#FFFF00', emoji: '🟡', role: 'crewmate', alive: true, position: { x: -10, y: 0, z: 0 }, velocity: { x: 0, z: 0 } },
    { id: 'orange', name: 'Orange', color: '#FFA500', emoji: '🟠', role: 'crewmate', alive: true, position: { x: 0, y: 0, z: 10 }, velocity: { x: 0, z: 0 } },
    { id: 'black', name: 'Black', color: '#000000', emoji: '⚫', role: 'crewmate', alive: true, position: { x: 0, y: 0, z: -10 }, velocity: { x: 0, z: 0 } },
    { id: 'white', name: 'White', color: '#FFFFFF', emoji: '⚪', role: 'crewmate', alive: true, position: { x: 15, y: 0, z: 15 }, velocity: { x: 0, z: 0 } }
];

// Initialize players
demoPlayers.forEach(player => {
    gameState.players.set(player.id, player);
});

// Initialize tasks
for (let i = 0; i < 15; i++) {
    gameState.tasks.push({
        id: `task-${i}`,
        name: `Task ${i + 1}`,
        position: {
            x: Math.random() * 40 - 20,
            y: 0,
            z: Math.random() * 40 - 20
        },
        type: ['wiring', 'download', 'scan', 'fuel', 'calibrate'][i % 5]
    });
}

// Handle connections
wss.on('connection', (ws, req) => {
    const isObserver = req.url?.includes('observer');
    console.log(`${isObserver ? 'Observer' : 'Client'} connected`);
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'observer_connect') {
                // Send full game state to observer
                ws.send(JSON.stringify({
                    type: 'game_state',
                    data: {
                        phase: gameState.phase,
                        players: Array.from(gameState.players.values()),
                        tasks: gameState.tasks,
                        taskProgress: gameState.taskProgress,
                        realAgents: gameState.realAgents,
                        serverTime: Date.now()
                    }
                }));
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Simulate movement and updates
setInterval(() => {
    // Update player positions
    gameState.players.forEach(player => {
        if (player.alive) {
            // Random movement
            player.velocity.x = (Math.random() - 0.5) * 2;
            player.velocity.z = (Math.random() - 0.5) * 2;
            
            player.position.x += player.velocity.x * 0.1;
            player.position.z += player.velocity.z * 0.1;
            
            // Keep within bounds
            player.position.x = Math.max(-20, Math.min(20, player.position.x));
            player.position.z = Math.max(-20, Math.min(20, player.position.z));
        }
    });
    
    // Broadcast position update
    const positions = Array.from(gameState.players.values()).map(p => ({
        id: p.id,
        position: p.position,
        velocity: p.velocity
    }));
    
    broadcast({
        type: 'position_update',
        data: positions
    });
}, 100); // Update every 100ms

// Simulate chat messages
const chatMessages = [
    "Where is everyone?",
    "I'm doing tasks in electrical",
    "Anyone see anything suspicious?",
    "Meeting! I found a body!",
    "I was with Green the whole time",
    "That's kinda sus...",
    "I saw Red vent!",
    "I'm innocent I swear",
    "Skip vote?",
    "Let's stick together"
];

setInterval(() => {
    const players = Array.from(gameState.players.values()).filter(p => p.alive);
    if (players.length > 0) {
        const player = players[Math.floor(Math.random() * players.length)];
        const message = chatMessages[Math.floor(Math.random() * chatMessages.length)];
        
        broadcast({
            type: 'chat_message',
            data: {
                playerId: player.id,
                playerName: player.name,
                playerEmoji: player.emoji,
                text: message,
                timestamp: Date.now()
            }
        });
    }
}, 5000); // Chat every 5 seconds

// Simulate task completion
setInterval(() => {
    if (gameState.taskProgress < 100) {
        gameState.taskProgress += 5;
        broadcast({
            type: 'task_completed',
            data: {
                progress: gameState.taskProgress
            }
        });
    }
}, 10000); // Complete task every 10 seconds

function broadcast(message) {
    const data = JSON.stringify(message);
    wss.clients.forEach(client => {
        if (client.readyState === 1) { // OPEN
            client.send(data);
        }
    });
}

console.log(`
✅ WebSocket Server Started!

📡 Server: ws://localhost:3001
🔍 Observer endpoint: ws://localhost:3001/observer

This is a simple mock server that:
- Sends position updates
- Simulates chat messages
- Updates task progress
- No real game logic (yet)

Press Ctrl+C to stop the server.
`);

// Handle shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    wss.close();
    process.exit(0);
}); 