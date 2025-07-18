// Browser-compatible Among Us runner - no Node.js dependencies
// This file provides mock implementations for browser usage

// Mock types to replace @elizaos/core imports
interface IAgentRuntime {
    id: string;
    name: string;
}

interface Memory {
    content: string;
    timestamp: number;
}

interface State {
    [key: string]: any;
}

// Mock types to replace hyperfy imports
interface HyperfyWorld {
    stage: {
        scene: any;
    };
    camera: any;
    controls: any;
    systems: any[];
    sendMessage?(message: string): Promise<void>;
}

interface HyperfyEntity {
    id: string;
    position: { x: number; y: number; z: number };
}

interface HyperfyPlayer extends HyperfyEntity {
    name: string;
}

// Import only the scenario logic
import AmongUsScenario from './among-us-scenario-browser';

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
            const visualWorld = (window as any).amongUsWorld;
            visualWorld.showEvent(message);
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
            (window as any).amongUsWorld.updateGameStatus(`❌ Error: ${(error as Error).message}`);
        }
        throw error;
    }
}

export { MockAmongUsAgent, MockAmongUsWorld }; 