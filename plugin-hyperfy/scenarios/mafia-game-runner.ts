import { IAgentRuntime, Memory, State } from '@elizaos/core';
import MafiaGameScenario from './mafia-game-scenario';
import { HyperfyWorld } from '../src/types/hyperfy';
import { PuppeteerManager } from '../src/managers/puppeteer-manager';
import * as THREE from 'three';

// Mock agent runtime for testing
class MockAgentRuntime implements Partial<IAgentRuntime> {
    id: string;
    name: string;
    
    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }
    
    // Add other required properties as needed
    async processActions(message: string): Promise<void> {
        console.log(`[${this.name}] Processing: ${message}`);
    }
}

// Mock Hyperfy World with visual support
class MockHyperfyWorld implements Partial<HyperfyWorld> {
    private messages: string[] = [];
    private currentRound: number = 0;
    private alivePlayers: number = 8;
    private totalPlayers: number = 8;
    private gamePhase: string = 'setup';
    
    stage = {
        scene: new THREE.Scene()
    };
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    controls = {
        enabled: true,
        enablePan: true,
        enableRotate: true,
        enableZoom: true,
        minDistance: 8,
        maxDistance: 20,
        target: new THREE.Vector3(0, 1, 0)
    } as any;
    
    systems: any[] = [];
    startTime = Date.now();
    
    async sendMessage(message: string): Promise<void> {
        this.messages.push(message);
        console.log(message);
        
        // Update visual world based on message
        if ((window as any).mafiaWorld) {
            const world = (window as any).mafiaWorld;
            world.showEvent(message);
            
            // Track game rounds
            const roundMatch = message.match(/(?:NIGHT|DAY|VOTING)\s+(\d+)/);
            if (roundMatch) {
                this.currentRound = parseInt(roundMatch[1], 10);
            }
            
            // Update game state visuals
            if (message.includes('NIGHT')) {
                world.setPhase('night');
                this.gamePhase = 'night';
            } else if (message.includes('DAY')) {
                world.setPhase('day');
                this.gamePhase = 'day';
            } else if (message.includes('VOTING')) {
                world.setPhase('voting');
                this.gamePhase = 'voting';
            } else if (message.includes('eliminated') || message.includes('was killed')) {
                // Extract player name and eliminate them
                const eliminationPatterns = [
                    /(\w+\s*\w*)\s*(🍩|🕵️‍♀️|😎|🦙|🤓|🌪️|🤐|🗣️)\s*(?:was|has been)\s*eliminated/,
                    /(\w+\s*\w*)\s*(🍩|🕵️‍♀️|😎|🦙|🤓|🌪️|🤐|🗣️)\s*was killed/
                ];
                
                for (const pattern of eliminationPatterns) {
                    const match = message.match(pattern);
                    if (match) {
                        const playerName = match[1].trim();
                        const players = (window as any).mafiaWorld.players;
                        
                        // Find and eliminate the player
                        for (const [id, playerGroup] of players) {
                            if (playerGroup.userData && playerGroup.userData.name === playerName) {
                                world.eliminatePlayer(id);
                                this.alivePlayers--;
                                break;
                            }
                        }
                        break;
                    }
                }
            }
            
            // Update game stats
            world.updateGameStats(this.currentRound, this.alivePlayers, this.totalPlayers);
            
            // Update time display (mock countdown)
            if (this.gamePhase !== 'setup') {
                const phaseTime = this.gamePhase === 'day' ? 90 : 30;
                world.updateTimeRemaining(phaseTime);
            }
        }
    }
    
    getMessages(): string[] {
        return this.messages;
    }
}

/**
 * Run the Mafia game scenario with visual display
 */
export async function runMafiaGame() {
    console.log("🎭 Starting Mafia Game Runner...\n");
    
    // Create 8 mock agents
    const agents: MockAgentRuntime[] = [
        new MockAgentRuntime('agent-1', 'Detective Donut'),
        new MockAgentRuntime('agent-2', 'Suspicious Susan'),
        new MockAgentRuntime('agent-3', 'Chill Chad'),
        new MockAgentRuntime('agent-4', 'Drama Llama'),
        new MockAgentRuntime('agent-5', 'Logic Larry'),
        new MockAgentRuntime('agent-6', 'Chaos Karen'),
        new MockAgentRuntime('agent-7', 'Silent Bob'),
        new MockAgentRuntime('agent-8', 'Gossip Gary')
    ];
    
    // Create mock world
    const world = new MockHyperfyWorld();
    
    // If running in browser environment, initialize visual world
    if (typeof window !== 'undefined' && (window as any).mafiaWorld) {
        const mafiaWorld = (window as any).mafiaWorld;
        
        // Create visual players
        const personalities = [
            { name: 'Detective Donut', emoji: '🍩' },
            { name: 'Suspicious Susan', emoji: '🕵️‍♀️' },
            { name: 'Chill Chad', emoji: '😎' },
            { name: 'Drama Llama', emoji: '🦙' },
            { name: 'Logic Larry', emoji: '🤓' },
            { name: 'Chaos Karen', emoji: '🌪️' },
            { name: 'Silent Bob', emoji: '🤐' },
            { name: 'Gossip Gary', emoji: '🗣️' }
        ];
        
        agents.forEach((agent, index) => {
            const personality = personalities[index];
            mafiaWorld.createPlayer(agent.id, personality.name, personality.emoji);
        });
        
        // Update player list
        mafiaWorld.updatePlayerList(personalities.map(p => ({ 
            name: p.name, 
            alive: true, 
            emoji: p.emoji 
        })));
    }
    
    try {
        // Update UI to show game is starting
        if ((window as any).mafiaWorld) {
            (window as any).mafiaWorld.showEvent("🎮 Game starting...");
        }
        
        // Run the scenario
        const success = await MafiaGameScenario.run(
            agents as unknown as IAgentRuntime[], 
            world as unknown as HyperfyWorld
        );
        
        if (success) {
            console.log("\n✅ Mafia game scenario completed successfully!");
            if ((window as any).mafiaWorld) {
                (window as any).mafiaWorld.showEvent("✅ Game completed successfully!");
            }
        } else {
            console.log("\n❌ Mafia game scenario failed to meet success criteria.");
            if ((window as any).mafiaWorld) {
                (window as any).mafiaWorld.showEvent("❌ Game ended.");
            }
        }
        
        // Show game statistics
        console.log("\n📊 Game Statistics:");
        const messages = world.getMessages();
        console.log(`- Total messages: ${messages.length}`);
        console.log(`- Game phases completed: ${messages.filter(m => m.includes('NIGHT') || m.includes('DAY')).length}`);
        console.log(`- Deaths: ${messages.filter(m => m.includes('eliminated')).length}`);
        
        return success;
        
    } catch (error) {
        console.error("\n❌ Error running Mafia game:", error);
        if ((window as any).mafiaWorld) {
            (window as any).mafiaWorld.showEvent(`❌ Error: ${error.message}`);
        }
        throw error;
    }
}

// Setup instructions (only for CLI usage)
export function printSetupInstructions() {
    console.log(`
========================================
MAFIA GAME SETUP INSTRUCTIONS
========================================

1. Start the visual display server:
   npm run dev
   
2. Open browser to:
   http://localhost:3001/mafia.html

3. Click "Start Game" button or run:
   window.runMafiaScenario()

Features:
- 8 unique personalities sitting around a table
- Day/night cycle with dynamic lighting
- Visual voting indicators
- Death animations
- Real-time game state display

Game Rules:
- 2 Mafia vs 6 Villagers
- Night: Mafia choose victim
- Day: Discussion phase
- Voting: Eliminate suspect
- Win: Mafia = equal numbers, Village = eliminate all mafia

========================================
`);
}

// Browser-compatible check if running as main module
if (typeof window === 'undefined' && typeof process !== 'undefined' && process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
    printSetupInstructions();
    console.log('\nRun this in the browser or use: npm run minigames:mafia');
}

export { MockAgentRuntime, MockHyperfyWorld }; 