import { IAgentRuntime } from '@elizaos/core';
import AmongUsScenario from './among-us-scenario';
import { HyperfyWorld } from '../src/types/hyperfy';
import { PuppeteerManager } from '../src/managers/puppeteer-manager';

// Mock agent for testing
class MockAmongUsAgent implements Partial<IAgentRuntime> {
    id: string;
    name: string;
    
    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }
}

// Mock world with visual capabilities
class MockAmongUsWorld implements Partial<HyperfyWorld> {
    stage = {
        scene: {} as any
    };
    
    camera = {
        position: { set: () => {} },
        lookAt: () => {}
    } as any;
    
    controls = {
        enabled: true
    } as any;
    
    systems: any[] = [];
    
    async sendMessage(message: string): Promise<void> {
        console.log(message);
        
        // Update visual world based on message
        if ((window as any).amongUsWorld) {
            const world = (window as any).amongUsWorld;
            world.showEvent(message);
            
            // Update game state based on messages
            if (message.includes('EMERGENCY MEETING')) {
                world.triggerEmergencyMeeting();
            } else if (message.includes('eliminated during the night')) {
                // Extract player info and create dead body
                const match = message.match(/(\w+)\s*(?:🔴|🔵|🟢|🟡|🟣|🟠|⚫|⚪)\s*was eliminated/);
                if (match) {
                    const playerName = match[1];
                    // Find player position to create body
                    // This would need integration with the scenario
                }
            }
        }
    }
}

/**
 * Run the Among Us scenario
 */
export async function runAmongUs() {
    console.log("🚀 Starting Among Us Game...\n");
    
    // Create 8 agents with Among Us colors
    const agents: MockAmongUsAgent[] = [
        new MockAmongUsAgent('agent-red', 'Red'),
        new MockAmongUsAgent('agent-blue', 'Blue'),
        new MockAmongUsAgent('agent-green', 'Green'),
        new MockAmongUsAgent('agent-yellow', 'Yellow'),
        new MockAmongUsAgent('agent-purple', 'Purple'),
        new MockAmongUsAgent('agent-orange', 'Orange'),
        new MockAmongUsAgent('agent-black', 'Black'),
        new MockAmongUsAgent('agent-white', 'White')
    ];
    
    // Create mock world
    const world = new MockAmongUsWorld();
    
    // Update UI if in browser
    if ((window as any).amongUsWorld) {
        (window as any).amongUsWorld.updateGameStatus("🎮 Starting game...");
    }
    
    try {
        // Run the scenario
        const success = await AmongUsScenario.run(
            agents as unknown as IAgentRuntime[], 
            world as unknown as HyperfyWorld
        );
        
        if (success) {
            console.log("\n✅ Among Us scenario completed successfully!");
            if ((window as any).amongUsWorld) {
                (window as any).amongUsWorld.updateGameStatus("✅ Game completed!");
            }
        } else {
            console.log("\n❌ Among Us scenario failed.");
            if ((window as any).amongUsWorld) {
                (window as any).amongUsWorld.updateGameStatus("❌ Game ended.");
            }
        }
        
        return success;
        
    } catch (error) {
        console.error("\n❌ Error running Among Us:", error);
        if ((window as any).amongUsWorld) {
            (window as any).amongUsWorld.updateGameStatus(`❌ Error: ${error.message}`);
        }
        throw error;
    }
}

// Instructions for setting up the custom world
export function printSetupInstructions() {
    console.log(`
========================================
AMONG US SETUP INSTRUCTIONS
========================================

1. Start the visual display server:
   npm run dev

2. Open browser to:
   http://localhost:3001/amongus.html

3. Click "Start Game" button or run:
   window.runAmongUsScenario()

Features:
- 8 colorful agents (2 impostors, 6 crewmates)
- Maze-based map with tasks
- Line-of-sight kills (impostors must isolate victims)
- Emergency meetings when bodies are found
- Task completion system
- Visual dead bodies with bones

========================================
`);
}

// Browser-compatible check if running as main module
if (typeof window === 'undefined' && typeof process !== 'undefined' && process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
    printSetupInstructions();
    console.log('\nRun this in the browser or use: npm run minigames:amongus');
}

export { MockAmongUsAgent, MockAmongUsWorld }; 