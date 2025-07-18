#!/usr/bin/env node

import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import express from 'express';
import { amongUsBundle } from '../src/bundles/amongus-bundle.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const configIndex = args.indexOf('--config');
const configPath = configIndex >= 0 ? args[configIndex + 1] : 'worlds/amongus-config.json';

console.log('🌍 Starting Hyperfy World Server...');

// Create Express app for HTTP server
const app = express();
app.use(express.static(join(projectRoot, 'public')));

// Create WebSocket server
const wss = new WebSocketServer({ port: 8080 });

// World state
const world = {
    players: new Map(),
    entities: new Map(),
    state: new Map(),
    bundle: null,
    
    // World API methods
    createEntity(options) {
        const entity = {
            id: `entity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...options,
            setColor: (color) => {
                entity.color = color;
                this.broadcastEntityUpdate(entity.id, { color });
            },
            getMetadata: () => entity.metadata || {}
        };
        this.entities.set(entity.id, entity);
        this.broadcast({
            type: 'entity_created',
            entity: this.serializeEntity(entity)
        });
        return entity;
    },
    
    removeEntity(entity) {
        this.entities.delete(entity.id);
        this.broadcast({
            type: 'entity_removed',
            entityId: entity.id
        });
    },
    
    getEntity(entityId) {
        return this.entities.get(entityId) || null;
    },
    
    getPlayer(playerId) {
        return this.players.get(playerId) || null;
    },
    
    getPlayerByName(name) {
        for (const player of this.players.values()) {
            if (player.name === name) return player;
        }
        return null;
    },
    
    getPlayers() {
        return Array.from(this.players.values());
    },
    
    setState(key, value) {
        this.state.set(key, value);
    },
    
    getState(key) {
        return this.state.get(key);
    },
    
    sendToPlayer(playerId, data) {
        const player = this.players.get(playerId);
        if (player && player.ws) {
            player.ws.send(JSON.stringify(data));
        }
    },
    
    broadcast(data) {
        const message = JSON.stringify(data);
        for (const player of this.players.values()) {
            if (player.ws) {
                player.ws.send(message);
            }
        }
    },
    
    broadcastEntityUpdate(entityId, changes) {
        this.broadcast({
            type: 'entity_updated',
            entityId,
            changes
        });
    },
    
    serializeEntity(entity) {
        return {
            id: entity.id,
            type: entity.type,
            position: entity.position,
            scale: entity.scale,
            color: entity.color,
            metadata: entity.metadata
        };
    },
    
    // Event system
    events: new Map(),
    
    on(event, handler) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(handler);
    },
    
    off(event) {
        this.events.delete(event);
    },
    
    emit(event, data) {
        const handlers = this.events.get(event);
        if (handlers) {
            handlers.forEach(handler => handler(data));
        }
    }
};

// Load and initialize the bundle
async function loadBundle() {
    try {
        console.log('📦 Loading Among Us bundle...');
        world.bundle = amongUsBundle;
        await amongUsBundle.init(world);
        console.log('✅ Bundle loaded successfully');
    } catch (error) {
        console.error('❌ Failed to load bundle:', error);
    }
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('🔌 New connection');
    
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString());
            
            switch (data.type) {
                case 'player:join':
                    handlePlayerJoin(ws, data);
                    break;
                    
                case 'action:move_to':
                    handlePlayerMove(data);
                    break;
                    
                case 'action:interact':
                    handleInteraction(data);
                    break;
                    
                case 'chat':
                    handleChat(data);
                    break;
                    
                case 'action:complete_task':
                    // Forward to game logic
                    world.emit('task_completed', data);
                    break;
                    
                case 'action:look_for_bodies':
                    // Check for nearby bodies
                    handleLookForBodies(data);
                    break;
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });
    
    ws.on('close', () => {
        // Find and remove player
        for (const [playerId, player] of world.players.entries()) {
            if (player.ws === ws) {
                console.log(`👋 Player ${player.name} disconnected`);
                world.players.delete(playerId);
                world.emit('playerLeave', playerId);
                world.broadcast({
                    type: 'player_left',
                    playerId,
                    playerName: player.name
                });
                break;
            }
        }
    });
});

function handlePlayerJoin(ws, data) {
    const player = {
        id: data.id,
        name: data.name,
        position: { x: 25 + Math.random() * 10 - 5, y: 0, z: 25 + Math.random() * 10 - 5 },
        ws,
        isAgent: data.isAgent || false,
        character: data.character,
        
        // Player methods
        teleport(position) {
            this.position = { x: position[0], y: position[1], z: position[2] };
            world.broadcast({
                type: 'player_teleported',
                playerId: this.id,
                position: this.position
            });
        },
        
        setVisible(visible) {
            this.visible = visible;
            world.broadcast({
                type: 'player_visibility',
                playerId: this.id,
                visible
            });
        }
    };
    
    world.players.set(player.id, player);
    console.log(`👤 Player ${player.name} joined (${player.isAgent ? 'AI Agent' : 'Human'})`);
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'welcome',
        playerId: player.id,
        worldState: {
            players: Array.from(world.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                position: p.position,
                visible: p.visible !== false
            })),
            entities: Array.from(world.entities.values()).map(e => world.serializeEntity(e))
        }
    }));
    
    // Notify others
    world.broadcast({
        type: 'player_joined',
        player: {
            id: player.id,
            name: player.name,
            position: player.position,
            isAgent: player.isAgent
        }
    });
    
    // Emit event for game logic
    world.emit('playerJoin', player);
}

function handlePlayerMove(data) {
    const player = world.players.get(data.playerId);
    if (!player) return;
    
    // Update position
    player.position = { 
        x: data.target[0], 
        y: data.target[1], 
        z: data.target[2] 
    };
    
    // Broadcast movement
    world.broadcast({
        type: 'player_moved',
        playerId: data.playerId,
        position: player.position,
        reason: data.reason
    });
}

function handleInteraction(data) {
    world.emit('interaction', {
        playerId: data.playerId,
        entityId: data.entityId
    });
}

function handleChat(data) {
    const player = world.players.get(data.playerId);
    if (!player) return;
    
    console.log(`💬 ${player.name}: ${data.text}`);
    
    // Broadcast chat message
    world.broadcast({
        type: 'chat',
        playerId: data.playerId,
        playerName: player.name,
        text: data.text,
        timestamp: Date.now()
    });
    
    // Emit chat event for game logic
    world.emit('chat', {
        playerId: data.playerId,
        text: data.text
    });
}

function handleLookForBodies(data) {
    const player = world.players.get(data.playerId);
    if (!player) return;
    
    // Check for nearby bodies
    const gameState = world.getState('amongus');
    if (gameState && gameState.bodies) {
        for (const body of gameState.bodies.values()) {
            const distance = calculateDistance(
                [player.position.x, player.position.y, player.position.z],
                body.position
            );
            
            if (distance < 3) {
                world.sendToPlayer(data.playerId, {
                    type: 'body_found',
                    body: {
                        id: body.id,
                        position: body.position,
                        playerName: body.playerName
                    }
                });
                break;
            }
        }
    }
}

function calculateDistance(pos1, pos2) {
    const dx = pos2[0] - pos1[0];
    const dz = pos2[2] - pos1[2];
    return Math.sqrt(dx * dx + dz * dz);
}

// Start HTTP server
const httpPort = 3000;
app.listen(httpPort, () => {
    console.log(`🌐 HTTP server running at http://localhost:${httpPort}`);
});

// Initialize
loadBundle().then(() => {
    console.log('🚀 World server started on ws://localhost:8080');
    console.log('Waiting for players to connect...');
}); 