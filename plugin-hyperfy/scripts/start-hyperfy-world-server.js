#!/usr/bin/env node

import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🌍 Starting Hyperfy World Server for Among Us');
console.log('============================================\n');

// Import the Among Us app
import { AmongUsApp } from '../dist/apps/amongus-app.js';

const PORT = process.env.PORT || 4000;
const wss = new WebSocketServer({ port: PORT });

// Create world context
const world = {
    entities: new Map(),
    players: new Map(),
    createEntity: (config) => {
        const entity = {
            id: `entity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...config,
            setColor: (color) => { entity.color = color; },
            setVisible: (visible) => { entity.visible = visible; },
            teleport: (position) => { entity.position = position; }
        };
        world.entities.set(entity.id, entity);
        return entity;
    },
    removeEntity: (entity) => {
        world.entities.delete(entity.id);
    },
    on: (event, handler) => {
        // World event handling
    },
    broadcast: (message) => {
        const data = JSON.stringify(message);
        wss.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send(data);
            }
        });
    },
    sendToPlayer: (playerId, message) => {
        const player = world.players.get(playerId);
        if (player && player.ws && player.ws.readyState === 1) {
            player.ws.send(JSON.stringify(message));
        }
    }
};

// Create Among Us app instance
const app = new AmongUsApp(world);

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
    console.log('🔌 New connection from:', req.headers.origin || 'unknown');
    
    let playerId = null;
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            
            switch (message.type) {
                case 'join':
                    playerId = message.agentId || `player-${Date.now()}`;
                    const player = {
                        id: playerId,
                        name: message.name || 'Unknown',
                        ws: ws,
                        position: message.position || [25, 0, 25],
                        metadata: message.metadata || {}
                    };
                    
                    world.players.set(playerId, player);
                    
                    // Emit player join to app
                    world.emit('playerJoin', player);
                    
                    console.log(`✅ ${player.metadata.emoji || '👤'} ${player.name} joined as ${player.metadata.role || 'unknown'}`);
                    
                    // Send current game state
                    ws.send(JSON.stringify({
                        type: 'gameState',
                        data: app.getGameState()
                    }));
                    break;
                    
                case 'action':
                    // Handle agent actions
                    handleAgentAction(message.action, playerId, message.data);
                    break;
                    
                case 'position':
                    // Update player position
                    const p = world.players.get(playerId);
                    if (p) {
                        p.position = message.position;
                        // Broadcast position update
                        world.broadcast({
                            type: 'position_update',
                            data: {
                                playerId,
                                position: message.position
                            }
                        });
                    }
                    break;
                    
                case 'chat':
                    // Handle chat message
                    const chatPlayer = world.players.get(playerId);
                    if (chatPlayer) {
                        world.broadcast({
                            type: 'chat_message',
                            data: {
                                playerId,
                                playerName: chatPlayer.name,
                                playerEmoji: chatPlayer.metadata.emoji || '👤',
                                text: message.text,
                                timestamp: Date.now()
                            }
                        });
                    }
                    break;
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });
    
    ws.on('close', () => {
        if (playerId) {
            console.log(`👋 ${world.players.get(playerId)?.name || playerId} disconnected`);
            world.players.delete(playerId);
            world.emit('playerLeave', playerId);
        }
    });
});

// Handle agent actions
function handleAgentAction(action, playerId, data) {
    switch (action) {
        case 'HYPERFY_GOTO_ENTITY':
            // Movement handled by position updates
            break;
            
        case 'HYPERFY_START_TASK':
            app.emit('startTask', { playerId, taskId: data.taskId });
            break;
            
        case 'HYPERFY_COMPLETE_TASK':
            app.emit('completeTask', { playerId });
            break;
            
        case 'HYPERFY_KILL_PLAYER':
            app.emit('killPlayer', { killerId: playerId, targetId: data.targetId });
            break;
            
        case 'HYPERFY_REPORT_BODY':
            app.emit('reportBody', { playerId, bodyId: data.bodyId });
            break;
            
        case 'HYPERFY_VOTE_PLAYER':
            app.emit('vote', { voterId: playerId, targetId: data.targetId });
            break;
    }
}

// Broadcast game state updates periodically
setInterval(() => {
    const gameState = app.getGameState();
    
    // Add real-time stats
    const stats = {
        type: 'gameState',
        data: {
            ...gameState,
            connectedPlayers: wss.clients.size,
            timestamp: Date.now()
        }
    };
    
    world.broadcast(stats);
}, 1000);

console.log(`✅ Hyperfy World Server running on ws://localhost:${PORT}/amongus`);
console.log('\n📡 Waiting for real AI agents to connect...\n'); 