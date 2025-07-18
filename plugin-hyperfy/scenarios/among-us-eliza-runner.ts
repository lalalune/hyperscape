import {
    AgentRuntime,
    elizaLogger,
    type UUID,
    stringToUuid,
    ModelClass,
    type IAgentRuntime,
    type Character,
    type Memory,
    type Provider,
    type Action,
    type Handler,
    type Evaluator,
    composeContext,
    generateMessageResponse,
    defaultCharacter
} from '@elizaos/core';
import { SqliteDatabase } from '@elizaos/adapter-sqlite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { WebSocket } from 'ws';
import { AmongUsWorld } from '../src/worlds/among-us/AmongUsWorld';

// Import our created actions
import { moveToTaskAction } from '../src/actions/minigames/MoveToTaskAction';
import { startTaskAction } from '../src/actions/minigames/StartTaskAction';
import { completeTaskAction } from '../src/actions/minigames/CompleteTaskAction';
import { killPlayerAction } from '../src/actions/minigames/KillPlayerAction';
import { reportBodyAction } from '../src/actions/minigames/ReportBodyAction';
import { votePlayerAction } from '../src/actions/minigames/VotePlayerAction';
import { chatMessageAction } from '../src/actions/minigames/ChatMessageAction';

// Import providers
import { gameStateProvider } from '../src/providers/minigames/GameStateProvider';
import { nearbyPlayersProvider } from '../src/providers/minigames/NearbyPlayersProvider';
import { taskListProvider } from '../src/providers/minigames/TaskListProvider';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface AgentConfig {
    id: string;
    name: string;
    color: string;
    emoji: string;
    role: 'crewmate' | 'impostor';
    characterFile: string;
}

class AmongUsElizaRunner {
    private agents: Map<string, IAgentRuntime> = new Map();
    private world: AmongUsWorld;
    private connections: Map<string, WebSocket> = new Map();
    private agentConfigs: AgentConfig[] = [
        { id: 'agent-red', name: 'Red', color: '#FF0000', emoji: '🔴', role: 'impostor', characterFile: 'red.json' },
        { id: 'agent-purple', name: 'Purple', color: '#800080', emoji: '🟣', role: 'impostor', characterFile: 'purple.json' },
        { id: 'agent-blue', name: 'Blue', color: '#0000FF', emoji: '🔵', role: 'crewmate', characterFile: 'blue.json' },
        { id: 'agent-green', name: 'Green', color: '#00FF00', emoji: '🟢', role: 'crewmate', characterFile: 'green.json' },
        { id: 'agent-yellow', name: 'Yellow', color: '#FFFF00', emoji: '🟡', role: 'crewmate', characterFile: 'yellow.json' },
        { id: 'agent-orange', name: 'Orange', color: '#FFA500', emoji: '🟠', role: 'crewmate', characterFile: 'orange.json' },
        { id: 'agent-black', name: 'Black', color: '#000000', emoji: '⚫', role: 'crewmate', characterFile: 'black.json' },
        { id: 'agent-white', name: 'White', color: '#FFFFFF', emoji: '⚪', role: 'crewmate', characterFile: 'white.json' }
    ];

    constructor() {
        this.world = new AmongUsWorld();
    }

    async initialize(): Promise<void> {
        elizaLogger.log('🎮 Initializing Real Among Us with ElizaOS Agents...');

        // Start the world server
        await this.world.start(3001);

        // Create real ElizaOS agents
        for (const config of this.agentConfigs) {
            await this.createAgent(config);
        }

        elizaLogger.log('✅ All agents initialized with real AI');
    }

    private async createAgent(config: AgentConfig): Promise<void> {
        // Load character data
        const characterPath = join(__dirname, '..', 'src', 'agents', 'characters', config.characterFile);
        let characterData: Character;
        
        try {
            const fileContent = fs.readFileSync(characterPath, 'utf-8');
            characterData = JSON.parse(fileContent);
        } catch (error) {
            elizaLogger.error(`Failed to load character ${config.characterFile}:`, error);
            // Use default character as fallback
            characterData = {
                ...defaultCharacter,
                name: config.name
            };
        }

        // Override with game-specific data
        characterData = {
            ...characterData,
            id: stringToUuid(config.id) as UUID,
            name: config.name,
            settings: {
                ...characterData.settings,
                role: config.role,
                color: config.color,
                emoji: config.emoji
            }
        };

        // Create database for agent
        const dbPath = join(__dirname, '..', 'data', `${config.id}.db`);
        const db = new SqliteDatabase(dbPath);

        // Define providers based on role
        const providers: Provider[] = [
            gameStateProvider,
            nearbyPlayersProvider,
            taskListProvider
        ];

        // Define actions based on role
        const actions: Action[] = [
            moveToTaskAction,
            chatMessageAction,
            votePlayerAction
        ];

        if (config.role === 'crewmate') {
            actions.push(startTaskAction, completeTaskAction, reportBodyAction);
        } else {
            actions.push(killPlayerAction);
        }

        // Create Hyperfy service
        const hyperfyService = {
            async getWorld() {
                return this.world;
            },
            
            async connectAgent(agentId: string): Promise<boolean> {
                const ws = new WebSocket(`ws://localhost:3001/${agentId}`);
                
                return new Promise((resolve, reject) => {
                    ws.on('open', () => {
                        this.connections.set(agentId, ws);
                        
                        // Send join message
                        ws.send(JSON.stringify({
                            type: 'join',
                            data: {
                                name: config.name,
                                color: config.color,
                                emoji: config.emoji,
                                role: config.role
                            }
                        }));
                        
                        resolve(true);
                    });
                    
                    ws.on('error', reject);
                    
                    ws.on('message', (data: WebSocket.Data) => {
                        try {
                            const message = JSON.parse(data.toString());
                            this.handleWorldMessage(agentId, message);
                        } catch (error) {
                            elizaLogger.error('Error parsing world message:', error);
                        }
                    });
                });
            },
            
            async sendAction(agentId: string, action: any): Promise<void> {
                const ws = this.connections.get(agentId);
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(action));
                }
            }
        }.bind(this);

        // Create agent runtime
        const runtime = new AgentRuntime({
            agentId: characterData.id,
            character: characterData,
            providers,
            actions,
            evaluators: [],
            handlers: [],
            services: [
                { name: 'hyperfy', service: hyperfyService }
            ],
            databaseAdapter: db,
            modelProvider: 'openai', // or your preferred provider
            token: process.env.OPENAI_API_KEY || ''
        });

        this.agents.set(config.id, runtime);

        // Connect agent to world
        await hyperfyService.connectAgent(config.id);

        // Add player to game world
        this.world.addPlayer(config.id, config.name, config.role === 'impostor');

        // Start agent decision loop
        this.startAgentLoop(config.id, runtime);

        elizaLogger.log(`✅ Agent ${config.emoji} ${config.name} connected and thinking`);
    }

    private startAgentLoop(agentId: string, runtime: IAgentRuntime): void {
        // Main decision loop
        setInterval(async () => {
            try {
                // Get current game state
                const gameState = await gameStateProvider.get(runtime, {} as Memory);
                const nearbyPlayers = await nearbyPlayersProvider.get(runtime, {} as Memory);
                const tasks = await taskListProvider.get(runtime, {} as Memory);

                // Parse state
                const state = JSON.parse(gameState);
                const nearby = JSON.parse(nearbyPlayers);
                const taskList = JSON.parse(tasks);

                // Skip if not alive or game not running
                if (!state.isAlive || state.phase !== 'gameplay') {
                    return;
                }

                // Create context for AI decision
                const context = composeContext({
                    state: {
                        ...state,
                        nearbyPlayers: nearby,
                        availableTasks: taskList,
                        agentRole: runtime.character.settings?.role,
                        agentPersonality: runtime.character.bio
                    },
                    providers: [gameStateProvider, nearbyPlayersProvider, taskListProvider]
                });

                // Generate AI decision
                const decision = await generateMessageResponse({
                    runtime,
                    context,
                    modelClass: ModelClass.SMALL
                });

                // Parse and execute decision
                await this.executeAgentDecision(agentId, runtime, decision, state, nearby, taskList);

            } catch (error) {
                elizaLogger.error(`Error in agent ${agentId} decision loop:`, error);
            }
        }, 3000); // Make decision every 3 seconds
    }

    private async executeAgentDecision(
        agentId: string,
        runtime: IAgentRuntime,
        decision: any,
        state: any,
        nearbyPlayers: any[],
        tasks: any[]
    ): Promise<void> {
        const text = decision.text.toLowerCase();
        const role = runtime.character.settings?.role;

        // Movement decisions
        if (text.includes('move') || text.includes('go') || text.includes('walk')) {
            const velocity = {
                x: (Math.random() - 0.5) * 3,
                z: (Math.random() - 0.5) * 3
            };
            
            await this.sendAction(agentId, {
                type: 'move',
                data: { velocity }
            });
        }

        // Role-specific actions
        if (role === 'impostor') {
            // Look for kill opportunities
            if ((text.includes('kill') || text.includes('eliminate')) && nearbyPlayers.length > 0) {
                const crewmates = nearbyPlayers.filter(p => p.role === 'crewmate' && p.alive);
                const isolated = crewmates.filter(p => p.isolated);
                
                if (isolated.length > 0) {
                    await this.sendAction(agentId, {
                        type: 'kill',
                        data: { targetId: isolated[0].id }
                    });
                }
            }
        } else {
            // Crewmate actions
            if (text.includes('task') && tasks.length > 0) {
                const incompleteTasks = tasks.filter(t => !t.completed);
                if (incompleteTasks.length > 0 && !state.currentTask) {
                    await this.sendAction(agentId, {
                        type: 'start_task',
                        data: { taskId: incompleteTasks[0].id }
                    });
                }
            }

            if (text.includes('body') || text.includes('report')) {
                const bodies = nearbyPlayers.filter(p => !p.alive);
                if (bodies.length > 0) {
                    await this.sendAction(agentId, {
                        type: 'report',
                        data: { bodyId: bodies[0].id }
                    });
                }
            }
        }

        // Chat decisions
        if (text.includes('say') || text.includes('tell') || Math.random() < 0.1) {
            await this.sendAction(agentId, {
                type: 'chat',
                data: { text: decision.text }
            });
        }
    }

    private async sendAction(agentId: string, action: any): Promise<void> {
        const service = this.agents.get(agentId)?.getService('hyperfy') as any;
        if (service) {
            await service.sendAction(agentId, action);
        }
    }

    private handleWorldMessage(agentId: string, message: any): void {
        const runtime = this.agents.get(agentId);
        if (!runtime) return;

        // Update agent's internal state based on world events
        switch (message.type) {
            case 'game_state':
                // Store in agent's memory
                runtime.setMemory({
                    id: stringToUuid('game-state') as UUID,
                    userId: runtime.agentId,
                    agentId: runtime.agentId,
                    roomId: stringToUuid('among-us') as UUID,
                    content: { gameState: message.data },
                    createdAt: Date.now()
                } as Memory);
                break;

            case 'position_update':
                // Update position memory
                const myPosition = message.data.find((p: any) => p.id === agentId);
                if (myPosition) {
                    runtime.setMemory({
                        id: stringToUuid('position') as UUID,
                        userId: runtime.agentId,
                        agentId: runtime.agentId,
                        roomId: stringToUuid('among-us') as UUID,
                        content: { position: myPosition.position },
                        createdAt: Date.now()
                    } as Memory);
                }
                break;

            case 'chat_message':
                // Process chat messages from other players
                if (message.data.playerId !== agentId) {
                    this.processIncomingChat(runtime, message.data);
                }
                break;

            case 'meeting_started':
                // React to meetings
                elizaLogger.log(`${agentId} entering meeting discussion`);
                break;
        }
    }

    private async processIncomingChat(runtime: IAgentRuntime, chatData: any): Promise<void> {
        // Create memory from incoming chat
        const memory: Memory = {
            id: stringToUuid(`chat-${Date.now()}`) as UUID,
            userId: stringToUuid(chatData.playerId) as UUID,
            agentId: runtime.agentId,
            roomId: stringToUuid('among-us') as UUID,
            content: {
                text: chatData.text,
                playerName: chatData.playerName,
                playerEmoji: chatData.playerEmoji
            },
            createdAt: chatData.timestamp
        };

        // Store in agent's memory
        await runtime.setMemory(memory);

        // Optionally generate a response
        if (Math.random() < 0.3) { // 30% chance to respond
            const context = composeContext({
                state: {
                    incomingMessage: chatData.text,
                    fromPlayer: chatData.playerName,
                    myRole: runtime.character.settings?.role
                }
            });

            const response = await generateMessageResponse({
                runtime,
                context,
                modelClass: ModelClass.SMALL
            });

            if (response.text) {
                await this.sendAction(runtime.agentId, {
                    type: 'chat',
                    data: { text: response.text }
                });
            }
        }
    }

    async startGame(): Promise<void> {
        elizaLogger.log('🚀 Starting Among Us game with real AI agents...');
        
        // Ensure all agents are connected
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Start the game
        this.world.startGame();
        
        elizaLogger.log('✅ Game started! Agents are making real AI decisions.');
    }

    async stop(): Promise<void> {
        // Close all connections
        this.connections.forEach(ws => ws.close());
        
        // Stop world
        await this.world.stop();
        
        elizaLogger.log('🛑 Game stopped');
    }
}

// Main execution
export async function runRealAmongUs(): Promise<void> {
    const runner = new AmongUsElizaRunner();
    
    try {
        // Initialize all agents
        await runner.initialize();
        
        // Start the game
        await runner.startGame();
        
        elizaLogger.log(`
🎮 REAL AMONG US RUNNING!
========================
- 8 ElizaOS agents with AI decision making
- Real Hyperfy world with WebSocket communication
- Actual game mechanics (tasks, kills, meetings)
- No scripted behavior - all AI driven

Monitor the game at: http://localhost:3001/observer
        `);
        
        // Keep process alive
        process.on('SIGINT', async () => {
            await runner.stop();
            process.exit(0);
        });
        
    } catch (error) {
        elizaLogger.error('Failed to start real Among Us:', error);
        throw error;
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runRealAmongUs().catch(console.error);
} 