import {
    type IAgentRuntime,
    type Memory,
    type State,
    type UUID,
    AgentRuntime,
    elizaLogger,
    stringToUuid,
    generateMessageResponse,
    ModelClass,
    composeContext
} from '@elizaos/core';
import { type HyperfyWorld, type HyperfyService } from '../src/types/hyperfy';
import { createAmongUsAgent } from '../src/agents/among-us-hyperfy-agent';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AmongUsAgentSetup {
    id: string;
    name: string;
    color: string;
    emoji: string;
    role: 'crewmate' | 'impostor';
    characterFile: string;
}

class AmongUsRealScenario {
    private agents: Map<string, IAgentRuntime> = new Map();
    private hyperfyAgents: Map<string, any> = new Map();
    private world: HyperfyWorld | null = null;
    
    // Agent configurations
    private agentConfigs: AmongUsAgentSetup[] = [
        { id: 'red-agent', name: 'Red', color: 'red', emoji: '🔴', role: 'impostor', characterFile: 'red.json' },
        { id: 'purple-agent', name: 'Purple', color: 'purple', emoji: '🟣', role: 'impostor', characterFile: 'purple.json' },
        { id: 'blue-agent', name: 'Blue', color: 'blue', emoji: '🔵', role: 'crewmate', characterFile: 'blue.json' },
        { id: 'green-agent', name: 'Green', color: 'green', emoji: '🟢', role: 'crewmate', characterFile: 'green.json' },
        { id: 'yellow-agent', name: 'Yellow', color: 'yellow', emoji: '🟡', role: 'crewmate', characterFile: 'yellow.json' },
        { id: 'orange-agent', name: 'Orange', color: 'orange', emoji: '🟠', role: 'crewmate', characterFile: 'orange.json' },
        { id: 'black-agent', name: 'Black', color: 'black', emoji: '⚫', role: 'crewmate', characterFile: 'black.json' },
        { id: 'white-agent', name: 'White', color: 'white', emoji: '⚪', role: 'crewmate', characterFile: 'white.json' }
    ];
    
    async initialize(): Promise<void> {
        elizaLogger.log('🎮 Initializing Real Among Us Scenario...');
        
        // Create Eliza agent runtimes
        for (const config of this.agentConfigs) {
            const agentRuntime = await this.createAgentRuntime(config);
            this.agents.set(config.id, agentRuntime);
            
            // Create Hyperfy agent wrapper
            const hyperfyAgent = createAmongUsAgent(
                agentRuntime,
                config.role,
                config.color,
                config.emoji
            );
            this.hyperfyAgents.set(config.id, hyperfyAgent);
        }
        
        elizaLogger.log('✅ All agents initialized');
    }
    
    private async createAgentRuntime(config: AmongUsAgentSetup): Promise<IAgentRuntime> {
        // Load character file
        const characterPath = path.join(__dirname, '..', 'src', 'agents', 'characters', config.characterFile);
        const characterData = JSON.parse(fs.readFileSync(characterPath, 'utf-8'));
        
        // Create runtime configuration
        const runtimeConfig = {
            agentId: stringToUuid(config.id) as UUID,
            character: {
                ...characterData,
                name: config.name,
                id: stringToUuid(config.id) as UUID,
                role: config.role
            },
            providers: [],
            actions: [],
            services: []
        };
        
        // Create agent runtime
        const runtime = new AgentRuntime(runtimeConfig);
        
        // Add Hyperfy service
        const hyperfyService: HyperfyService = {
            getWorld: () => this.world,
            connectAgent: async (agentId: string) => {
                elizaLogger.log(`Connecting agent ${agentId} to Hyperfy world`);
                return true;
            },
            sendMessage: async (agentId: string, message: string) => {
                if (this.world?.chat) {
                    await this.world.chat.send({
                        text: message,
                        from: agentId
                    });
                }
            }
        };
        
        runtime.registerService('hyperfy', hyperfyService);
        
        return runtime;
    }
    
    async connectToWorld(worldUrl: string): Promise<void> {
        elizaLogger.log(`🌍 Connecting to Hyperfy world: ${worldUrl}`);
        
        // In real implementation, this would establish WebSocket connection
        // For now, we'll simulate the connection
        this.world = {
            id: 'among-us-world',
            url: worldUrl,
            players: new Map(),
            entities: new Map(),
            chat: {
                send: async (message: any) => {
                    elizaLogger.log(`💬 ${message.from}: ${message.text}`);
                },
                onMessage: (callback: any) => {
                    // Register chat listener
                }
            },
            systems: {
                game: {
                    phase: 'setup',
                    taskProgress: 0,
                    players: []
                },
                movement: {
                    movePlayer: async (playerId: string, position: any) => {
                        elizaLogger.log(`🏃 ${playerId} moving to ${position.x}, ${position.z}`);
                    }
                },
                task: {
                    getTasks: () => [],
                    startTask: async (playerId: string, taskId: string) => {
                        elizaLogger.log(`✅ ${playerId} starting task ${taskId}`);
                    }
                }
            }
        } as any;
        
        // Connect all agents to the world
        for (const [agentId, runtime] of this.agents) {
            const service = runtime.getService('hyperfy') as HyperfyService;
            await service.connectAgent(agentId);
        }
        
        elizaLogger.log('✅ All agents connected to world');
    }
    
    async startGame(): Promise<void> {
        elizaLogger.log('🚀 Starting Among Us game...');
        
        if (!this.world) {
            throw new Error('World not connected');
        }
        
        // Update game phase
        this.world.systems.game.phase = 'gameplay';
        
        // Start agent decision loops
        for (const [agentId, hyperfyAgent] of this.hyperfyAgents) {
            elizaLogger.log(`🤖 Activating agent: ${agentId}`);
            // Agent decision loops are started in the constructor
        }
        
        // Monitor game state
        this.monitorGameState();
    }
    
    private async monitorGameState(): Promise<void> {
        setInterval(async () => {
            if (!this.world) return;
            
            const gameState = this.world.systems.game;
            
            // Check win conditions
            const alivePlayers = Array.from(this.agents.values()).filter(agent => {
                const state = agent.getState();
                return state?.isAlive !== false;
            });
            
            const aliveImpostors = alivePlayers.filter(agent => {
                const character = agent.character;
                return character.role === 'impostor';
            });
            
            const aliveCrewmates = alivePlayers.filter(agent => {
                const character = agent.character;
                return character.role === 'crewmate';
            });
            
            if (aliveImpostors.length === 0) {
                elizaLogger.log('🎉 CREWMATES WIN! All impostors eliminated.');
                this.endGame('crewmates');
            } else if (aliveImpostors.length >= aliveCrewmates.length) {
                elizaLogger.log('👹 IMPOSTORS WIN! They outnumber the crew.');
                this.endGame('impostors');
            } else if (gameState.taskProgress >= 100) {
                elizaLogger.log('🎉 CREWMATES WIN! All tasks completed.');
                this.endGame('crewmates');
            }
        }, 5000); // Check every 5 seconds
    }
    
    private endGame(winner: 'crewmates' | 'impostors'): void {
        if (this.world) {
            this.world.systems.game.phase = 'end';
        }
        
        // Stop all agent loops
        for (const agent of this.agents.values()) {
            // In real implementation, would stop agent loops
        }
        
        elizaLogger.log(`🏁 Game ended. Winner: ${winner}`);
    }
}

// Export runner function
export async function runRealAmongUs(worldUrl: string = 'ws://localhost:3001/among-us'): Promise<void> {
    const scenario = new AmongUsRealScenario();
    
    try {
        // Initialize agents
        await scenario.initialize();
        
        // Connect to Hyperfy world
        await scenario.connectToWorld(worldUrl);
        
        // Start the game
        await scenario.startGame();
        
        elizaLogger.log('✅ Among Us game running with real Eliza agents!');
        
        // Keep process alive
        process.on('SIGINT', () => {
            elizaLogger.log('🛑 Shutting down...');
            process.exit(0);
        });
        
    } catch (error) {
        elizaLogger.error('❌ Error running Among Us:', error);
        throw error;
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runRealAmongUs().catch(console.error);
} 