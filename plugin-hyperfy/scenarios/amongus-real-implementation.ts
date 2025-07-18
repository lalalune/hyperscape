/**
 * REAL Among Us Implementation
 * This uses actual ElizaOS agents with AI decision making
 */

import {
    AgentRuntime,
    Character,
    ModelProviderName,
    IAgentRuntime,
    elizaLogger,
    SqliteAdapter,
    State,
    composeContext,
    generateMessageResponse,
    Content,
    Memory,
    UUID
} from '@elizaos/core';
import { HyperfyService } from '../src/service';
import { AmongUsGameService } from '../src/services/AmongUsGameService';
import { hyperfyPlugin } from '../src';
import { amongUsPlugin } from '../src/plugins/amongus-plugin';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Character files
const characterFiles = [
    'red.json',    // Impostor
    'purple.json', // Impostor  
    'blue.json',   // Crewmate
    'green.json',  // Crewmate
    'yellow.json', // Crewmate
    'orange.json', // Crewmate
    'pink.json',   // Crewmate
    'black.json'   // Crewmate
];

interface RealAgent {
    runtime: IAgentRuntime;
    character: Character;
    playerId?: string;
}

class RealAmongUsImplementation {
    private agents: Map<string, RealAgent> = new Map();
    private gameService?: AmongUsGameService;
    private hyperfyService?: HyperfyService;
    private isRunning = false;
    
    async initialize() {
        elizaLogger.info('🎮 Starting REAL Among Us Implementation');
        elizaLogger.info('Using actual ElizaOS agents with AI decision making');
        
        // Load characters
        const characters = await this.loadCharacters();
        
        // Create a shared runtime for services
        const sharedRuntime = await this.createSharedRuntime();
        
        // Get services
        this.hyperfyService = sharedRuntime.getService<HyperfyService>(HyperfyService.serviceName);
        this.gameService = sharedRuntime.getService<AmongUsGameService>(AmongUsGameService.serviceName);
        
        if (!this.hyperfyService || !this.gameService) {
            throw new Error('Required services not initialized');
        }
        
        // Wait for Hyperfy connection
        await this.waitForHyperfyConnection();
        
        // Create agent runtimes
        await this.createAgents(characters);
        
        // Register players
        await this.registerPlayers();
        
        // Start the game
        await this.startGame();
        
        elizaLogger.info('✅ Real implementation initialized successfully');
    }
    
    private async loadCharacters(): Promise<Character[]> {
        const characters: Character[] = [];
        
        for (const file of characterFiles) {
            const filePath = path.join(__dirname, '..', 'src', 'agents', 'characters', file);
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                const character = JSON.parse(content) as Character;
                characters.push(character);
                elizaLogger.info(`Loaded character: ${character.name}`);
            } catch (error) {
                elizaLogger.error(`Failed to load character ${file}:`, error);
            }
        }
        
        return characters;
    }
    
    private async createSharedRuntime(): Promise<IAgentRuntime> {
        // Create a shared runtime for services
        const dbPath = path.join(__dirname, '..', 'data', 'shared-services.db');
        
        // Ensure data directory exists
        await fs.mkdir(path.dirname(dbPath), { recursive: true });
        
        const runtime = new AgentRuntime({
            databaseAdapter: new SqliteAdapter(new Database(dbPath)),
            modelProvider: this.getModelProvider(),
            character: {
                id: 'services' as UUID,
                name: 'Service Runtime',
                clients: [],
                modelProvider: this.getModelProvider()
            } as Character,
            plugins: [hyperfyPlugin, amongUsPlugin],
            providers: [],
            actions: [],
            services: [],
            managers: []
        });
        
        await runtime.initialize();
        return runtime;
    }
    
    private getModelProvider(): ModelProviderName {
        if (process.env.OPENAI_API_KEY) return ModelProviderName.OPENAI;
        if (process.env.ANTHROPIC_API_KEY) return ModelProviderName.ANTHROPIC;
        if (process.env.TOGETHER_API_KEY) return ModelProviderName.TOGETHER;
        
        elizaLogger.warn('No API key found, using local model (may be limited)');
        return ModelProviderName.LLAMALOCAL;
    }
    
    private async waitForHyperfyConnection(): Promise<void> {
        elizaLogger.info('Waiting for Hyperfy connection...');
        
        let attempts = 0;
        while (attempts < 30) { // 30 seconds timeout
            if (this.hyperfyService?.isConnected()) {
                elizaLogger.info('✅ Connected to Hyperfy world');
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }
        
        throw new Error('Failed to connect to Hyperfy world');
    }
    
    private async createAgents(characters: Character[]): Promise<void> {
        for (const character of characters) {
            const agent = await this.createAgent(character);
            this.agents.set(character.id, agent);
        }
        
        elizaLogger.info(`Created ${this.agents.size} agent runtimes`);
    }
    
    private async createAgent(character: Character): Promise<RealAgent> {
        const dbPath = path.join(__dirname, '..', 'data', `agent-${character.name.toLowerCase()}.db`);
        
        const runtime = new AgentRuntime({
            databaseAdapter: new SqliteAdapter(new Database(dbPath)),
            modelProvider: this.getModelProvider(),
            character,
            plugins: [hyperfyPlugin, amongUsPlugin],
            providers: [],
            actions: [],
            services: [],
            managers: []
        });
        
        await runtime.initialize();
        
        return { runtime, character };
    }
    
    private async registerPlayers(): Promise<void> {
        if (!this.gameService) throw new Error('Game service not initialized');
        
        for (const [id, agent] of this.agents) {
            const playerId = await this.gameService.registerPlayer(
                agent.runtime.agentId,
                agent.character.name,
                agent.character.name.toLowerCase()
            );
            
            agent.playerId = playerId;
            elizaLogger.info(`Registered ${agent.character.name} as player ${playerId}`);
        }
    }
    
    private async startGame(): Promise<void> {
        if (!this.gameService) throw new Error('Game service not initialized');
        
        await this.gameService.startGame();
        this.isRunning = true;
        
        elizaLogger.info('🎮 Game started! Agents are now making decisions.');
        
        // Start decision loops for each agent
        for (const agent of this.agents.values()) {
            this.startAgentDecisionLoop(agent);
        }
        
        // Start game monitoring
        this.startGameMonitoring();
    }
    
    private async startAgentDecisionLoop(agent: RealAgent): Promise<void> {
        const makeDecision = async () => {
            if (!this.isRunning || !this.gameService) return;
            
            try {
                const gameState = this.gameService.getGameState();
                const player = Array.from(gameState.players.values()).find(
                    p => p.agentId === agent.runtime.agentId
                );
                
                if (!player || !player.alive) {
                    // Agent is dead, no decisions to make
                    return;
                }
                
                // Build context for decision
                const nearbyPlayers = this.gameService.getNearbyPlayers(player.id);
                const availableTasks = this.gameService.getAvailableTasks(player.id);
                
                const context = `
You are ${agent.character.name}, ${agent.character.description}.
You are a ${player.role} in Among Us.
Game Phase: ${gameState.phase}
Your Position: (${Math.round(player.position?.x || 0)}, ${Math.round(player.position?.z || 0)})
Nearby Players: ${nearbyPlayers.map(p => p.name).join(', ') || 'None'}
${player.role === 'crewmate' ? `Available Tasks: ${availableTasks.length}` : ''}
${player.role === 'impostor' ? `Kill Cooldown: ${Math.ceil((gameState.killCooldowns.get(player.id) || 0) / 1000)}s` : ''}

What should you do next? Consider your role and the current situation.
`;
                
                // Create a memory for the context
                const memory: Memory = {
                    id: agent.runtime.agentId,
                    userId: agent.runtime.agentId,
                    agentId: agent.runtime.agentId,
                    roomId: 'amongus' as UUID,
                    content: {
                        text: context,
                        source: 'game_context'
                    } as Content,
                    createdAt: Date.now()
                };
                
                // Compose state
                const state = await agent.runtime.composeState(memory, {
                    gameState: gameState,
                    player: player,
                    nearbyPlayers: nearbyPlayers,
                    availableTasks: availableTasks
                });
                
                // Generate response using AI
                const response = await generateMessageResponse({
                    runtime: agent.runtime,
                    context: composeContext({ state, template: context }),
                    modelClass: ModelProviderName.SMALL
                });
                
                // The response will trigger appropriate actions via the agent's action system
                elizaLogger.debug(`${agent.character.name} decision: ${response.text}`);
                
                // Process the response through the runtime's action system
                await agent.runtime.processActions(
                    memory,
                    [response],
                    state
                );
                
            } catch (error) {
                elizaLogger.error(`Error in decision loop for ${agent.character.name}:`, error);
            }
        };
        
        // Make decisions every 2-5 seconds (varied to feel more natural)
        const loop = async () => {
            while (this.isRunning) {
                await makeDecision();
                const delay = 2000 + Math.random() * 3000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        };
        
        loop().catch(error => {
            elizaLogger.error(`Decision loop crashed for ${agent.character.name}:`, error);
        });
    }
    
    private startGameMonitoring(): void {
        setInterval(() => {
            if (!this.gameService) return;
            
            const gameState = this.gameService.getGameState();
            
            if (gameState.phase === 'ended') {
                elizaLogger.info('🏁 Game ended!');
                const alivePlayers = Array.from(gameState.players.values()).filter(p => p.alive);
                const winners = alivePlayers.filter(p => 
                    p.role === 'impostor' ? true : alivePlayers.every(ap => ap.role !== 'impostor')
                );
                
                elizaLogger.info(`Winners: ${winners.map(w => w.name).join(', ')}`);
                this.stop();
            }
        }, 1000);
    }
    
    async stop(): Promise<void> {
        this.isRunning = false;
        
        elizaLogger.info('Stopping agents...');
        
        for (const agent of this.agents.values()) {
            await agent.runtime.stop();
        }
        
        elizaLogger.info('All agents stopped');
    }
}

// Run the real implementation
async function main() {
    const implementation = new RealAmongUsImplementation();
    
    try {
        await implementation.initialize();
        
        elizaLogger.info('');
        elizaLogger.info('🎮 REAL Among Us implementation is running!');
        elizaLogger.info('📊 This is using:');
        elizaLogger.info('   - Real ElizaOS AgentRuntime instances');
        elizaLogger.info('   - Actual AI decision making (not random)');
        elizaLogger.info('   - Proper HyperfyService integration');
        elizaLogger.info('   - Server-authoritative game state');
        elizaLogger.info('');
        elizaLogger.info('Watch the agents play with real AI!');
        
        // Keep running until interrupted
        process.on('SIGINT', async () => {
            elizaLogger.info('\nShutting down...');
            await implementation.stop();
            process.exit(0);
        });
        
    } catch (error) {
        elizaLogger.error('Failed to start:', error);
        process.exit(1);
    }
}

main().catch(console.error); 