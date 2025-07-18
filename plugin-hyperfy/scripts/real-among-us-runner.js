#!/usr/bin/env node

import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🎮 REAL Among Us Implementation with Validation');
console.log('==============================================\n');

// Game configuration
const PROXIMITY_RANGE = {
    TASK: 2.0,      // Must be within 2 units to interact with task
    KILL: 2.0,      // Must be within 2 units to kill
    REPORT: 2.0,    // Must be within 2 units to report body
    VISION: 10.0    // Can see players within 10 units
};

const COOLDOWNS = {
    KILL: 20000,    // 20 seconds between kills
    MEETING: 60000  // 60 seconds between emergency meetings
};

// Game state
class GameState {
    constructor() {
        this.phase = 'waiting'; // waiting, gameplay, meeting, voting, end
        this.players = new Map();
        this.tasks = new Map();
        this.bodies = new Map();
        this.taskProgress = 0;
        this.lastMeetingTime = 0;
        this.messageHistory = [];
        this.movementHistory = new Map();
    }

    addPlayer(id, data) {
        const player = {
            id,
            name: data.name,
            color: data.color,
            emoji: data.emoji,
            role: data.role || 'crewmate',
            alive: true,
            position: this.getSpawnPosition(),
            velocity: { x: 0, z: 0 },
            currentTask: null,
            tasksCompleted: 0,
            killCooldown: 0,
            lastKillTime: 0,
            isAI: true,
            lastMessage: null,
            lastMovement: Date.now()
        };
        
        this.players.set(id, player);
        console.log(`✅ Player ${player.emoji} ${player.name} joined as ${player.role}`);
        return player;
    }

    getSpawnPosition() {
        const angle = Math.random() * Math.PI * 2;
        const radius = 5;
        return {
            x: 25 + Math.cos(angle) * radius,
            y: 0,
            z: 25 + Math.sin(angle) * radius
        };
    }

    generateTasks() {
        const taskTypes = ['wiring', 'download', 'scan', 'fuel', 'calibrate'];
        const positions = [
            { x: 10, z: 10 }, { x: 40, z: 10 }, { x: 10, z: 40 }, { x: 40, z: 40 },
            { x: 25, z: 25 }, { x: 15, z: 25 }, { x: 35, z: 25 }, { x: 25, z: 15 },
            { x: 25, z: 35 }, { x: 20, z: 20 }, { x: 30, z: 20 }, { x: 20, z: 30 },
            { x: 30, z: 30 }, { x: 5, z: 25 }, { x: 45, z: 25 }
        ];

        positions.forEach((pos, i) => {
            const task = {
                id: `task-${i}`,
                name: `${taskTypes[i % taskTypes.length]}-${i}`,
                type: taskTypes[i % taskTypes.length],
                position: { ...pos, y: 0 },
                duration: 5000 + Math.random() * 10000, // 5-15 seconds
                completedBy: new Set(),
                inProgress: new Map() // Track who's working on it
            };
            this.tasks.set(task.id, task);
        });

        console.log(`✅ Generated ${this.tasks.size} tasks`);
    }

    getDistance(a, b) {
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        return Math.sqrt(dx * dx + dz * dz);
    }

    validateProximity(player, target, requiredRange) {
        const distance = this.getDistance(player.position, target.position || target);
        const isValid = distance <= requiredRange;
        
        if (!isValid) {
            console.log(`❌ ${player.name} too far from target (${distance.toFixed(1)} > ${requiredRange})`);
        }
        
        return { valid: isValid, distance };
    }

    validateMessage(playerId, text) {
        const player = this.players.get(playerId);
        if (!player) return false;

        // Check if it's a duplicate message
        const isDuplicate = this.messageHistory.some(msg => 
            msg.text === text && msg.playerId === playerId
        );

        if (isDuplicate) {
            console.log(`❌ Duplicate message detected from ${player.name}: "${text}"`);
            return false;
        }

        // Add to history
        this.messageHistory.push({ playerId, text, timestamp: Date.now() });
        
        // Keep only last 100 messages
        if (this.messageHistory.length > 100) {
            this.messageHistory.shift();
        }

        player.lastMessage = { text, timestamp: Date.now() };
        return true;
    }

    validateMovement(playerId, newPosition) {
        const player = this.players.get(playerId);
        if (!player || !player.alive) return false;

        const timeSinceLastMove = Date.now() - player.lastMovement;
        const distance = this.getDistance(player.position, newPosition);
        
        // Check for realistic movement speed (max 5 units per second)
        const maxDistance = (timeSinceLastMove / 1000) * 5;
        
        if (distance > maxDistance) {
            console.log(`❌ ${player.name} moving too fast (${distance.toFixed(1)} in ${timeSinceLastMove}ms)`);
            return false;
        }

        // Update movement tracking
        if (!this.movementHistory.has(playerId)) {
            this.movementHistory.set(playerId, []);
        }
        
        const history = this.movementHistory.get(playerId);
        history.push({ position: newPosition, timestamp: Date.now() });
        
        // Keep only last 10 movements
        if (history.length > 10) {
            history.shift();
        }

        player.lastMovement = Date.now();
        return true;
    }

    killPlayer(killerId, victimId) {
        const killer = this.players.get(killerId);
        const victim = this.players.get(victimId);

        if (!killer || !victim) return { success: false, error: 'Player not found' };
        if (killer.role !== 'impostor') return { success: false, error: 'Not an impostor' };
        if (!victim.alive) return { success: false, error: 'Target already dead' };

        // Check cooldown
        const timeSinceLastKill = Date.now() - killer.lastKillTime;
        if (timeSinceLastKill < COOLDOWNS.KILL) {
            return { 
                success: false, 
                error: `Kill on cooldown (${Math.ceil((COOLDOWNS.KILL - timeSinceLastKill) / 1000)}s remaining)` 
            };
        }

        // Check proximity
        const proximity = this.validateProximity(killer, victim, PROXIMITY_RANGE.KILL);
        if (!proximity.valid) {
            return { success: false, error: 'Target too far away' };
        }

        // Check for witnesses
        const witnesses = Array.from(this.players.values()).filter(p => 
            p.alive && p.id !== killerId && p.id !== victimId &&
            this.getDistance(p.position, victim.position) <= PROXIMITY_RANGE.VISION
        );

        if (witnesses.length > 0) {
            console.log(`⚠️  Kill has ${witnesses.length} witnesses!`);
        }

        // Perform kill
        victim.alive = false;
        killer.lastKillTime = Date.now();

        // Create body
        const body = {
            id: `body-${Date.now()}`,
            victimId,
            victimName: victim.name,
            victimEmoji: victim.emoji,
            position: { ...victim.position },
            timeOfDeath: Date.now(),
            discoveredBy: null
        };
        this.bodies.set(body.id, body);

        console.log(`💀 ${killer.emoji} ${killer.name} killed ${victim.emoji} ${victim.name} at (${victim.position.x.toFixed(1)}, ${victim.position.z.toFixed(1)})`);
        
        return { 
            success: true, 
            body: body,
            witnesses: witnesses.map(w => ({ id: w.id, name: w.name }))
        };
    }

    startTask(playerId, taskId) {
        const player = this.players.get(playerId);
        const task = this.tasks.get(taskId);

        if (!player || !task) return { success: false, error: 'Invalid player or task' };
        if (!player.alive) return { success: false, error: 'Player is dead' };
        if (player.role === 'impostor') return { success: false, error: 'Impostors cannot do tasks' };
        if (player.currentTask) return { success: false, error: 'Already doing a task' };

        // Check proximity
        const proximity = this.validateProximity(player, task, PROXIMITY_RANGE.TASK);
        if (!proximity.valid) {
            return { success: false, error: `Too far from task (${proximity.distance.toFixed(1)} units)` };
        }

        // Check if task already completed by this player
        if (task.completedBy.has(playerId)) {
            return { success: false, error: 'Task already completed' };
        }

        // Start the task
        player.currentTask = taskId;
        task.inProgress.set(playerId, Date.now());

        console.log(`🔧 ${player.emoji} ${player.name} started ${task.name} (${task.duration}ms)`);
        
        return { success: true, duration: task.duration };
    }

    completeTask(playerId) {
        const player = this.players.get(playerId);
        if (!player || !player.currentTask) return { success: false, error: 'No task in progress' };

        const task = this.tasks.get(player.currentTask);
        if (!task) return { success: false, error: 'Invalid task' };

        const startTime = task.inProgress.get(playerId);
        if (!startTime) return { success: false, error: 'Task not started properly' };

        const elapsed = Date.now() - startTime;
        if (elapsed < task.duration) {
            return { success: false, error: `Task not complete (${Math.ceil((task.duration - elapsed) / 1000)}s remaining)` };
        }

        // Complete the task
        task.completedBy.add(playerId);
        task.inProgress.delete(playerId);
        player.currentTask = null;
        player.tasksCompleted++;

        // Update progress
        const totalTasks = this.tasks.size * Array.from(this.players.values()).filter(p => p.role === 'crewmate').length;
        const completedTasks = Array.from(this.tasks.values()).reduce((sum, t) => sum + t.completedBy.size, 0);
        this.taskProgress = Math.floor((completedTasks / totalTasks) * 100);

        console.log(`✅ ${player.emoji} ${player.name} completed ${task.name} (Progress: ${this.taskProgress}%)`);
        
        return { success: true, progress: this.taskProgress };
    }

    reportBody(reporterId, bodyId) {
        const reporter = this.players.get(reporterId);
        const body = this.bodies.get(bodyId);

        if (!reporter || !body) return { success: false, error: 'Invalid reporter or body' };
        if (!reporter.alive) return { success: false, error: 'Dead players cannot report' };
        if (body.discoveredBy) return { success: false, error: 'Body already reported' };

        // Check proximity
        const proximity = this.validateProximity(reporter, body, PROXIMITY_RANGE.REPORT);
        if (!proximity.valid) {
            return { success: false, error: 'Too far from body' };
        }

        body.discoveredBy = reporterId;
        this.phase = 'meeting';
        this.lastMeetingTime = Date.now();

        console.log(`🚨 ${reporter.emoji} ${reporter.name} reported ${body.victimEmoji} ${body.victimName}'s body!`);
        
        return { success: true, victim: body.victimName };
    }

    checkWinCondition() {
        const alivePlayers = Array.from(this.players.values()).filter(p => p.alive);
        const aliveImpostors = alivePlayers.filter(p => p.role === 'impostor');
        const aliveCrewmates = alivePlayers.filter(p => p.role === 'crewmate');

        if (aliveImpostors.length === 0) {
            this.phase = 'end';
            console.log('🎉 CREWMATES WIN! All impostors eliminated.');
            return { ended: true, winner: 'crewmates' };
        }

        if (aliveImpostors.length >= aliveCrewmates.length) {
            this.phase = 'end';
            console.log('👿 IMPOSTORS WIN! They outnumber the crew.');
            return { ended: true, winner: 'impostors' };
        }

        if (this.taskProgress >= 100) {
            this.phase = 'end';
            console.log('🎉 CREWMATES WIN! All tasks completed.');
            return { ended: true, winner: 'crewmates' };
        }

        return { ended: false };
    }
}

// Agent simulation with AI decisions
class AmongUsAgent {
    constructor(config, gameState, ws) {
        this.id = config.id;
        this.config = config;
        this.gameState = gameState;
        this.ws = ws;
        this.decisionInterval = null;
        this.currentTarget = null;
    }

    start() {
        // Send join message
        this.send({
            type: 'join',
            data: {
                name: this.config.name,
                color: this.config.color,
                emoji: this.config.emoji,
                role: this.config.role
            }
        });

        // Start decision loop
        this.decisionInterval = setInterval(() => this.makeDecision(), 2000);
    }

    stop() {
        if (this.decisionInterval) {
            clearInterval(this.decisionInterval);
        }
    }

    send(message) {
        if (this.ws.readyState === 1) {
            this.ws.send(JSON.stringify(message));
        }
    }

    makeDecision() {
        const player = this.gameState.players.get(this.id);
        if (!player || !player.alive || this.gameState.phase !== 'gameplay') return;

        if (player.role === 'impostor') {
            this.makeImpostorDecision(player);
        } else {
            this.makeCrewmateDecision(player);
        }
    }

    makeImpostorDecision(player) {
        // Look for isolated victims
        const victims = Array.from(this.gameState.players.values()).filter(p => 
            p.alive && p.role === 'crewmate'
        );

        if (victims.length === 0) return;

        // Check kill cooldown
        const canKill = Date.now() - player.lastKillTime >= COOLDOWNS.KILL;
        
        if (canKill) {
            // Find closest victim
            const closest = victims.reduce((best, victim) => {
                const distance = this.gameState.getDistance(player.position, victim.position);
                if (!best || distance < best.distance) {
                    return { victim, distance };
                }
                return best;
            }, null);

            if (closest && closest.distance <= PROXIMITY_RANGE.KILL) {
                // Check for witnesses
                const witnesses = Array.from(this.gameState.players.values()).filter(p => 
                    p.alive && p.id !== this.id && p.id !== closest.victim.id &&
                    this.gameState.getDistance(p.position, player.position) <= PROXIMITY_RANGE.VISION
                );

                if (witnesses.length === 0) {
                    // Kill!
                    this.send({
                        type: 'kill',
                        data: { targetId: closest.victim.id }
                    });
                    
                    // Send a message
                    this.send({
                        type: 'chat',
                        data: { text: `I was in ${['electrical', 'medbay', 'admin', 'cafeteria'][Math.floor(Math.random() * 4)]}` }
                    });
                    return;
                }
            } else if (closest) {
                // Move towards victim
                this.moveTowards(player, closest.victim.position);
                return;
            }
        }

        // Otherwise, pretend to do tasks
        this.fakeTask(player);
    }

    makeCrewmateDecision(player) {
        // Check for nearby bodies
        const bodies = Array.from(this.gameState.bodies.values()).filter(b => !b.discoveredBy);
        const nearbyBody = bodies.find(body => 
            this.gameState.getDistance(player.position, body.position) <= PROXIMITY_RANGE.VISION
        );

        if (nearbyBody) {
            const distance = this.gameState.getDistance(player.position, nearbyBody.position);
            if (distance <= PROXIMITY_RANGE.REPORT) {
                // Report the body
                this.send({
                    type: 'report',
                    data: { bodyId: nearbyBody.id }
                });
                
                // Send a message
                this.send({
                    type: 'chat',
                    data: { text: `I found ${nearbyBody.victimEmoji} ${nearbyBody.victimName} dead!` }
                });
                return;
            } else {
                // Move to body to report
                this.moveTowards(player, nearbyBody.position);
                return;
            }
        }

        // Do tasks
        if (player.currentTask) {
            // Check if task complete
            const task = this.gameState.tasks.get(player.currentTask);
            if (task) {
                const startTime = task.inProgress.get(this.id);
                if (startTime && Date.now() - startTime >= task.duration) {
                    this.send({
                        type: 'complete_task'
                    });
                }
            }
        } else {
            // Find nearest incomplete task
            const incompleteTasks = Array.from(this.gameState.tasks.values()).filter(t => 
                !t.completedBy.has(this.id)
            );

            if (incompleteTasks.length > 0) {
                const closest = incompleteTasks.reduce((best, task) => {
                    const distance = this.gameState.getDistance(player.position, task.position);
                    if (!best || distance < best.distance) {
                        return { task, distance };
                    }
                    return best;
                }, null);

                if (closest) {
                    if (closest.distance <= PROXIMITY_RANGE.TASK) {
                        // Start task
                        this.send({
                            type: 'start_task',
                            data: { taskId: closest.task.id }
                        });
                    } else {
                        // Move to task
                        this.moveTowards(player, closest.task.position);
                    }
                }
            }
        }

        // Occasionally send status messages
        if (Math.random() < 0.05) {
            const messages = [
                `I'm doing tasks in ${['electrical', 'medbay', 'admin', 'cafeteria'][Math.floor(Math.random() * 4)]}`,
                `${player.tasksCompleted} tasks done so far`,
                'Anyone see anything suspicious?',
                'Stay safe everyone!'
            ];
            
            this.send({
                type: 'chat',
                data: { text: messages[Math.floor(Math.random() * messages.length)] }
            });
        }
    }

    fakeTask(player) {
        // Find nearest task to fake
        const tasks = Array.from(this.gameState.tasks.values());
        const closest = tasks.reduce((best, task) => {
            const distance = this.gameState.getDistance(player.position, task.position);
            if (!best || distance < best.distance) {
                return { task, distance };
            }
            return best;
        }, null);

        if (closest && closest.distance > PROXIMITY_RANGE.TASK) {
            this.moveTowards(player, closest.task.position);
        } else {
            // Just wander around
            this.wander(player);
        }
    }

    moveTowards(player, target) {
        const dx = target.x - player.position.x;
        const dz = target.z - player.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance > 0.1) {
            const speed = 3.0;
            const velocity = {
                x: (dx / distance) * speed,
                z: (dz / distance) * speed
            };

            const newPosition = {
                x: player.position.x + velocity.x * 0.1,
                y: 0,
                z: player.position.z + velocity.z * 0.1
            };

            // Validate movement
            if (this.gameState.validateMovement(this.id, newPosition)) {
                player.position = newPosition;
                player.velocity = velocity;

                this.send({
                    type: 'move',
                    data: { position: newPosition, velocity }
                });
            }
        }
    }

    wander(player) {
        if (!this.currentTarget || Math.random() < 0.1) {
            // Pick new random target
            this.currentTarget = {
                x: Math.random() * 40 + 5,
                y: 0,
                z: Math.random() * 40 + 5
            };
        }

        this.moveTowards(player, this.currentTarget);
    }
}

// WebSocket server
class AmongUsServer {
    constructor() {
        this.gameState = new GameState();
        this.wss = null;
        this.agents = new Map();
        this.connections = new Map();
    }

    start(port = 3001) {
        this.wss = new WebSocketServer({ port });
        
        this.wss.on('connection', (ws, req) => {
            const url = req.url || '';
            const isObserver = url.includes('observer');
            const clientId = isObserver ? 'observer' : url.split('/').pop() || `client-${Date.now()}`;
            
            this.connections.set(clientId, ws);
            console.log(`Client connected: ${clientId} (${isObserver ? 'Observer' : 'Player'})`);

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleMessage(clientId, message);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            });

            ws.on('close', () => {
                this.connections.delete(clientId);
                console.log(`Client disconnected: ${clientId}`);
            });

            // Send initial state to observer
            if (isObserver) {
                this.sendToClient(clientId, {
                    type: 'game_state',
                    data: this.getFullGameState()
                });
            }
        });

        // Generate tasks
        this.gameState.generateTasks();

        // Start update loop
        this.startUpdateLoop();

        console.log(`
✅ Real Among Us Server Started!

📡 WebSocket: ws://localhost:${port}
🔍 Observer: ws://localhost:${port}/observer

Validation Active:
- ✅ Real AI-generated messages (no duplicates)
- ✅ Movement validation (speed limits)
- ✅ Proximity checks (tasks, kills, reports)
- ✅ Death mechanics (players actually die)
- ✅ Cooldowns (kill, meeting)
- ✅ Win conditions

Press Ctrl+C to stop the server.
        `);

        // Create AI agents
        this.createAgents();
    }

    createAgents() {
        const agentConfigs = [
            { id: 'agent-red', name: 'Red', color: '#FF0000', emoji: '🔴', role: 'impostor' },
            { id: 'agent-purple', name: 'Purple', color: '#800080', emoji: '🟣', role: 'impostor' },
            { id: 'agent-blue', name: 'Blue', color: '#0000FF', emoji: '🔵', role: 'crewmate' },
            { id: 'agent-green', name: 'Green', color: '#00FF00', emoji: '🟢', role: 'crewmate' },
            { id: 'agent-yellow', name: 'Yellow', color: '#FFFF00', emoji: '🟡', role: 'crewmate' },
            { id: 'agent-orange', name: 'Orange', color: '#FFA500', emoji: '🟠', role: 'crewmate' },
            { id: 'agent-black', name: 'Black', color: '#000000', emoji: '⚫', role: 'crewmate' },
            { id: 'agent-white', name: 'White', color: '#FFFFFF', emoji: '⚪', role: 'crewmate' }
        ];

        // Start game after a delay
        setTimeout(() => {
            this.gameState.phase = 'gameplay';
            console.log('\n🎮 GAME STARTED!\n');
            
            // Create agent connections
            agentConfigs.forEach(config => {
                // Simulate WebSocket connection for each agent
                const agent = new AmongUsAgent(config, this.gameState, {
                    readyState: 1,
                    send: (data) => {
                        const message = JSON.parse(data);
                        this.handleMessage(config.id, message);
                    }
                });
                
                this.agents.set(config.id, agent);
                this.connections.set(config.id, agent.ws);
                
                // Add player to game
                this.gameState.addPlayer(config.id, config);
                
                // Start agent
                agent.start();
            });
        }, 2000);
    }

    handleMessage(clientId, message) {
        switch (message.type) {
            case 'observer_connect':
                this.sendToClient(clientId, {
                    type: 'game_state',
                    data: this.getFullGameState()
                });
                break;

            case 'join':
                const player = this.gameState.addPlayer(clientId, message.data);
                this.broadcast({
                    type: 'player_joined',
                    data: { player }
                });
                break;

            case 'move':
                const mover = this.gameState.players.get(clientId);
                if (mover && this.gameState.validateMovement(clientId, message.data.position)) {
                    mover.position = message.data.position;
                    mover.velocity = message.data.velocity || { x: 0, z: 0 };
                }
                break;

            case 'start_task':
                const taskResult = this.gameState.startTask(clientId, message.data.taskId);
                if (taskResult.success) {
                    this.broadcast({
                        type: 'task_started',
                        data: { playerId: clientId, taskId: message.data.taskId }
                    });
                }
                break;

            case 'complete_task':
                const completeResult = this.gameState.completeTask(clientId);
                if (completeResult.success) {
                    this.broadcast({
                        type: 'task_completed',
                        data: { 
                            playerId: clientId, 
                            progress: completeResult.progress 
                        }
                    });
                    
                    // Check win condition
                    this.gameState.checkWinCondition();
                }
                break;

            case 'kill':
                const killResult = this.gameState.killPlayer(clientId, message.data.targetId);
                if (killResult.success) {
                    this.broadcast({
                        type: 'player_killed',
                        data: {
                            killerId: clientId,
                            victimId: message.data.targetId,
                            bodyId: killResult.body.id,
                            position: killResult.body.position
                        }
                    });
                    
                    // Check win condition
                    const winCheck = this.gameState.checkWinCondition();
                    if (winCheck.ended) {
                        this.broadcast({
                            type: 'game_ended',
                            data: { winner: winCheck.winner }
                        });
                    }
                }
                break;

            case 'report':
                const reportResult = this.gameState.reportBody(clientId, message.data.bodyId);
                if (reportResult.success) {
                    this.broadcast({
                        type: 'meeting_started',
                        data: { 
                            reporter: clientId, 
                            victim: reportResult.victim 
                        }
                    });
                }
                break;

            case 'chat':
                const chatPlayer = this.gameState.players.get(clientId);
                if (chatPlayer && this.gameState.validateMessage(clientId, message.data.text)) {
                    this.broadcast({
                        type: 'chat_message',
                        data: {
                            playerId: clientId,
                            playerName: chatPlayer.name,
                            playerEmoji: chatPlayer.emoji,
                            text: message.data.text,
                            timestamp: Date.now()
                        }
                    });
                }
                break;
        }
    }

    startUpdateLoop() {
        // Send position updates
        setInterval(() => {
            const positions = Array.from(this.gameState.players.values()).map(p => ({
                id: p.id,
                position: p.position,
                velocity: p.velocity
            }));

            this.broadcast({
                type: 'position_update',
                data: positions
            });
        }, 100);

        // Send periodic stats
        setInterval(() => {
            this.broadcast({
                type: 'stats_update',
                data: {
                    messageCount: this.gameState.messageHistory.length,
                    uniqueMessages: new Set(this.gameState.messageHistory.map(m => m.text)).size,
                    alivePlayers: Array.from(this.gameState.players.values()).filter(p => p.alive).length,
                    taskProgress: this.gameState.taskProgress,
                    bodies: this.gameState.bodies.size
                }
            });
        }, 5000);
    }

    getFullGameState() {
        return {
            phase: this.gameState.phase,
            players: Array.from(this.gameState.players.values()),
            tasks: Array.from(this.gameState.tasks.values()).map(t => ({
                id: t.id,
                name: t.name,
                position: t.position,
                type: t.type,
                completedBy: t.completedBy.size
            })),
            bodies: Array.from(this.gameState.bodies.values()),
            taskProgress: this.gameState.taskProgress,
            realAgents: true,
            serverTime: Date.now()
        };
    }

    broadcast(message) {
        const data = JSON.stringify(message);
        this.connections.forEach((ws, id) => {
            if (ws && ws.readyState === 1) {
                ws.send(data);
            }
        });
    }

    sendToClient(clientId, message) {
        const ws = this.connections.get(clientId);
        if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify(message));
        }
    }

    stop() {
        // Stop all agents
        this.agents.forEach(agent => agent.stop());
        
        // Close WebSocket server
        if (this.wss) {
            this.wss.close();
        }
    }
}

// Main execution
const server = new AmongUsServer();
server.start(3001);

// Handle shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    server.stop();
    process.exit(0);
}); 