/**
 * Real Among Us Implementation
 * Uses the existing HyperfyService - no separate WebSocket needed!
 */

import {
    AgentRuntime,
    Character,
    ModelProviderName,
    IAgentRuntime,
    elizaLogger,
    SqliteAdapter,
    MemoryManager,
    stringToUuid,
    composeContext,
    generateMessageResponse,
    ModelClass,
    State,
    Memory,
    Content
} from '@elizaos/core';
import { HyperfyService } from '../src/service';
import { AmongUsGameService } from '../src/services/AmongUsGameService';
import { hyperfyPlugin } from '../src';
import { amongUsPlugin } from '../src/plugins/amongus-plugin';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class RealAmongUsImplementation {
    private agents: IAgentRuntime[] = [];
    private gameService?: AmongUsGameService;
    
    async start() {
        elizaLogger.info('🎮 Starting REAL Among Us Implementation');
        elizaLogger.info('✅ Using existing HyperfyService - no separate WebSocket needed!');
        
        // Load character files
        const characters = await this.loadCharacters();
        
        // Create agents with real ElizaOS runtimes
        for (const character of characters) {
            const agent = await this.createRealAgent(character);
            this.agents.push(agent);
        }
        
        // The first agent's services are shared
        const firstAgent = this.agents[0];
        const hyperfyService = firstAgent.getService<HyperfyService>(HyperfyService.serviceName);
        this.gameService = firstAgent.getService<AmongUsGameService>(AmongUsGameService.serviceName);
        
        if (!hyperfyService || !this.gameService) {
            throw new Error('Services not initialized - make sure plugins are loaded');
        }
        
        // The HyperfyService is already connected by the plugin!
        elizaLogger.info('✅ HyperfyService is already connected to world');
        
        // Register all agents in the game
        for (const agent of this.agents) {
            const character = (agent as any).character;
            const playerId = await this.gameService.registerPlayer(
                agent.agentId,
                character.name,
                character.name.toLowerCase()
            );
            elizaLogger.info(`Registered ${character.name} as player ${playerId}`);
        }
        
        // Start the game
        await this.gameService.startGame();
        elizaLogger.info('🎮 Game started!');
        
        // Run agent decision loops
        for (const agent of this.agents) {
            this.runAgentLoop(agent);
        }
        
        elizaLogger.info('✅ All agents running with real AI!');
    }
    
    private async loadCharacters(): Promise<Character[]> {
        const characterDir = path.join(__dirname, '..', 'src', 'agents', 'characters');
        const files = await fs.readdir(characterDir);
        const characters: Character[] = [];
        
        for (const file of files.filter(f => f.endsWith('.json'))) {
            const content = await fs.readFile(path.join(characterDir, file), 'utf-8');
            const character = JSON.parse(content) as Character;
            
            // Ensure required fields
            character.id = character.id || stringToUuid(character.name);
            character.clients = character.clients || [];
            character.modelProvider = character.modelProvider || this.getModelProvider();
            
            characters.push(character);
        }
        
        return characters;
    }
    
    private getModelProvider(): ModelProviderName {
        if (process.env.OPENAI_API_KEY) return ModelProviderName.OPENAI;
        if (process.env.ANTHROPIC_API_KEY) return ModelProviderName.ANTHROPIC;
        return ModelProviderName.LLAMALOCAL;
    }
    
    private async createRealAgent(character: Character): Promise<IAgentRuntime> {
        const dbPath = path.join(__dirname, '..', 'data', `${character.name.toLowerCase()}.db`);
        await fs.mkdir(path.dirname(dbPath), { recursive: true });
        
        const db = new Database(dbPath);
        const runtime = new AgentRuntime({
            databaseAdapter: new SqliteAdapter(db),
            token: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '',
            modelProvider: this.getModelProvider(),
            character,
            plugins: [hyperfyPlugin, amongUsPlugin],
            providers: [],
            actions: [],
            services: [],
            managers: [new MemoryManager()]
        });
        
        await runtime.initialize();
        return runtime;
    }
    
    private async runAgentLoop(agent: IAgentRuntime) {
        const character = (agent as any).character;
        
        const makeDecision = async () => {
            if (!this.gameService) return;
            
            try {
                const gameState = this.gameService.getGameState();
                const player = Array.from(gameState.players.values()).find(
                    p => p.agentId === agent.agentId
                );
                
                if (!player || !player.alive || gameState.phase === 'ended') {
                    return;
                }
                
                // Build context
                const nearbyPlayers = this.gameService.getNearbyPlayers(player.id);
                const availableTasks = this.gameService.getAvailableTasks(player.id);
                
                const gameContext = {
                    role: player.role,
                    phase: gameState.phase,
                    position: player.position,
                    nearbyPlayers: nearbyPlayers.map(p => ({ name: p.name, distance: this.calculateDistance(player.position!, p.position!) })),
                    tasks: availableTasks.map(t => ({ name: t.name, distance: this.calculateDistance(player.position!, t.position) })),
                    bodies: Array.from(gameState.bodies.values()).map(b => ({ distance: this.calculateDistance(player.position!, b.position) }))
                };
                
                // Create memory
                const memory: Memory = {
                    id: stringToUuid(`${Date.now()}-${agent.agentId}`),
                    userId: agent.agentId,
                    agentId: agent.agentId,
                    roomId: stringToUuid('amongus'),
                    content: {
                        text: `I'm ${player.role === 'impostor' ? 'an impostor' : 'a crewmate'}. What should I do?`,
                        source: 'game_context',
                        gameContext
                    } as Content,
                    createdAt: Date.now()
                };
                
                // Generate AI response
                const context = composeContext({
                    state: {
                        ...gameContext,
                        characterName: character.name,
                        characterPersonality: character.bio
                    } as State,
                    template: character.messageExamples?.[0] || 'Respond based on your role and situation'
                });
                
                const response = await generateMessageResponse({
                    runtime: agent,
                    context,
                    modelClass: ModelClass.SMALL
                });
                
                elizaLogger.info(`${character.name}: ${response.text}`);
                
                // Process actions based on response
                await agent.processActions(memory, [response], { gameContext } as State);
                
            } catch (error) {
                elizaLogger.error(`Error in agent loop for ${character.name}:`, error);
            }
        };
        
        // Run decision loop
        setInterval(makeDecision, 3000 + Math.random() * 2000);
    }
    
    private calculateDistance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
        return Math.sqrt(
            Math.pow(a.x - b.x, 2) +
            Math.pow(a.y - b.y, 2) +
            Math.pow(a.z - b.z, 2)
        );
    }
}

// Run it
async function main() {
    const implementation = new RealAmongUsImplementation();
    
    try {
        await implementation.start();
        
        console.log('\n✅ Real Among Us is running!');
        console.log('📊 Using:');
        console.log('   - Real ElizaOS agents with AI');
        console.log('   - Existing HyperfyService connection');
        console.log('   - Proper game state management');
        console.log('   - No fake WebSocket connections!');
        
        // Keep running
        process.on('SIGINT', () => {
            console.log('\nShutting down...');
            process.exit(0);
        });
        
    } catch (error) {
        console.error('Failed:', error);
        process.exit(1);
    }
}

main().catch(console.error); 