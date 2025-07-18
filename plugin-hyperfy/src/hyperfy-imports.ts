// Type definitions for Hyperfy integration
// These match the actual Hyperfy types but are defined locally to avoid import issues

export interface World {
    entities?: Map<string, any>;
    getSystem?(name: string): any;
    // Add other properties as needed
}

export abstract class System {
    world: World;
    
    constructor(world: World) {
        this.world = world;
    }
    
    async init(options: any): Promise<void> {}
    start(): void {}
    preTick(): void {}
    tick(deltaTime: number): void {}
    postTick(): void {}
    destroy(): void {}
} 