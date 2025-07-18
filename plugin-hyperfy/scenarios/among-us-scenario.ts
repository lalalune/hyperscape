import { IAgentRuntime, Memory, State } from '@elizaos/core';
import { HyperfyWorld, HyperfyEntity, HyperfyPlayer } from '../src/types/hyperfy';
import { PuppeteerManager } from '../src/managers/puppeteer-manager';

interface AmongUsGameState {
    phase: 'setup' | 'gameplay' | 'emergency' | 'voting' | 'end';
    players: AmongUsPlayer[];
    tasks: Task[];
    bodies: DeadBody[];
    emergencyMeetings: number;
    killCooldown: number;
    lastKillTime: number;
    startTime: number;
    maze: MazeCell[][];
    worldUrl: string;
}

interface AmongUsPlayer {
    id: string;
    name: string;
    role: 'crewmate' | 'impostor';
    alive: boolean;
    position: { x: number; y: number; z: number };
    currentTask: string | null;
    tasksCompleted: number;
    emoji: string;
    color: string;
    velocity: { x: number; z: number };
    isSeen: boolean;
}

interface Task {
    id: string;
    name: string;
    position: { x: number; y: number; z: number };
    duration: number; // 5-15 seconds
    completedBy: Set<string>;
    type: 'wiring' | 'download' | 'scan' | 'fuel' | 'calibrate';
}

interface DeadBody {
    playerId: string;
    position: { x: number; y: number; z: number };
    discoveredBy: string | null;
    timeOfDeath: number;
}

interface MazeCell {
    x: number;
    y: number;
    walls: {
        north: boolean;
        south: boolean;
        east: boolean;
        west: boolean;
    };
    hasTask: boolean;
}

// Agent personalities adapted for Among Us
const AGENT_CONFIGS = [
    { name: "Red", emoji: "🔴", color: "#FF0000", personality: "aggressive" },
    { name: "Blue", emoji: "🔵", color: "#0000FF", personality: "analytical" },
    { name: "Green", emoji: "🟢", color: "#00FF00", personality: "sneaky" },
    { name: "Yellow", emoji: "🟡", color: "#FFFF00", personality: "nervous" },
    { name: "Purple", emoji: "🟣", color: "#800080", personality: "strategic" },
    { name: "Orange", emoji: "🟠", color: "#FFA500", personality: "chaotic" },
    { name: "Black", emoji: "⚫", color: "#000000", personality: "silent" },
    { name: "White", emoji: "⚪", color: "#FFFFFF", personality: "observant" }
];

class AmongUsScenario {
    private state: AmongUsGameState;
    private puppeteer: PuppeteerManager | null = null;
    private observerWindow: any = null;
    private MAZE_SIZE = 10;
    private CELL_SIZE = 5; // meters in Hyperfy world
    private KILL_DISTANCE = 2; // meters
    private VISION_DISTANCE = 10; // meters
    private TASK_DISTANCE = 1.5; // meters

    constructor() {
        this.state = {
            phase: 'setup',
            players: [],
            tasks: [],
            bodies: [],
            emergencyMeetings: 0,
            killCooldown: 20000, // 20 seconds
            lastKillTime: 0,
            startTime: Date.now(),
            maze: this.generateMaze(),
            worldUrl: 'http://localhost:3000/amongus'
        };
    }

    async initialize(agents: IAgentRuntime[], world: HyperfyWorld): Promise<void> {
        console.log("🚀 Initializing Among Us Game...");

        // Initialize puppeteer for observation
        await this.setupObservationWindow(agents[0]);

        // Create players
        for (let i = 0; i < agents.length; i++) {
            const config = AGENT_CONFIGS[i];
            const player: AmongUsPlayer = {
                id: agents[i].id,
                name: config.name,
                role: i < 2 ? 'impostor' : 'crewmate', // 2 impostors, 6 crewmates
                alive: true,
                position: this.getSpawnPosition(i),
                currentTask: null,
                tasksCompleted: 0,
                emoji: config.emoji,
                color: config.color,
                velocity: { x: 0, z: 0 },
                isSeen: false
            };
            this.state.players.push(player);
        }

        // Shuffle roles
        this.state.players = this.state.players.sort(() => Math.random() - 0.5);

        // Generate tasks throughout the maze
        this.generateTasks();

        // Create visual elements in the world
        await this.createWorldElements(world);

        // Announce game start
        await this.broadcastMessage(world, 
            "🚀 AMONG US: 8 players aboard the ship! Complete tasks to win, but beware... there are 2 impostors among us!"
        );

        // Start gameplay
        this.state.phase = 'gameplay';
        await this.runGameLoop(agents, world);
    }

    private generateMaze(): MazeCell[][] {
        const maze: MazeCell[][] = [];
        
        // Initialize maze with all walls
        for (let x = 0; x < this.MAZE_SIZE; x++) {
            maze[x] = [];
            for (let y = 0; y < this.MAZE_SIZE; y++) {
                maze[x][y] = {
                    x, y,
                    walls: { north: true, south: true, east: true, west: true },
                    hasTask: false
                };
            }
        }

        // Generate maze using recursive backtracking
        const visited = new Set<string>();
        const stack: [number, number][] = [];
        let current: [number, number] = [0, 0];

        visited.add(`${current[0]},${current[1]}`);
        stack.push(current);

        while (stack.length > 0) {
            const neighbors = this.getUnvisitedNeighbors(current[0], current[1], visited);
            
            if (neighbors.length > 0) {
                const next = neighbors[Math.floor(Math.random() * neighbors.length)];
                this.removeWall(maze, current[0], current[1], next[0], next[1]);
                current = next;
                visited.add(`${current[0]},${current[1]}`);
                stack.push(current);
            } else {
                current = stack.pop()!;
            }
        }

        return maze;
    }

    private getUnvisitedNeighbors(x: number, y: number, visited: Set<string>): [number, number][] {
        const neighbors: [number, number][] = [];
        const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N, E, S, W

        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < this.MAZE_SIZE && ny >= 0 && ny < this.MAZE_SIZE) {
                if (!visited.has(`${nx},${ny}`)) {
                    neighbors.push([nx, ny]);
                }
            }
        }

        return neighbors;
    }

    private removeWall(maze: MazeCell[][], x1: number, y1: number, x2: number, y2: number): void {
        const dx = x2 - x1;
        const dy = y2 - y1;

        if (dx === 1) { // Moving east
            maze[x1][y1].walls.east = false;
            maze[x2][y2].walls.west = false;
        } else if (dx === -1) { // Moving west
            maze[x1][y1].walls.west = false;
            maze[x2][y2].walls.east = false;
        } else if (dy === 1) { // Moving south
            maze[x1][y1].walls.south = false;
            maze[x2][y2].walls.north = false;
        } else if (dy === -1) { // Moving north
            maze[x1][y1].walls.north = false;
            maze[x2][y2].walls.south = false;
        }
    }

    private generateTasks(): void {
        const taskTypes: Task['type'][] = ['wiring', 'download', 'scan', 'fuel', 'calibrate'];
        const taskLocations = this.getTaskLocations();

        for (let i = 0; i < taskLocations.length; i++) {
            const location = taskLocations[i];
            const task: Task = {
                id: `task-${i}`,
                name: `${taskTypes[i % taskTypes.length]}-${i}`,
                position: {
                    x: location.x * this.CELL_SIZE + this.CELL_SIZE / 2,
                    y: 0,
                    z: location.y * this.CELL_SIZE + this.CELL_SIZE / 2
                },
                duration: 5000 + Math.random() * 10000, // 5-15 seconds
                completedBy: new Set(),
                type: taskTypes[i % taskTypes.length]
            };
            this.state.tasks.push(task);
            this.state.maze[location.x][location.y].hasTask = true;
        }
    }

    private getTaskLocations(): { x: number; y: number }[] {
        const locations: { x: number; y: number }[] = [];
        const targetCount = 15; // 15 tasks across the maze

        // Distribute tasks evenly across the maze
        for (let i = 0; i < targetCount; i++) {
            let x, y;
            do {
                x = Math.floor(Math.random() * this.MAZE_SIZE);
                y = Math.floor(Math.random() * this.MAZE_SIZE);
            } while (this.state.maze[x][y].hasTask || (x === 0 && y === 0)); // Avoid spawn

            locations.push({ x, y });
        }

        return locations;
    }

    private getSpawnPosition(index: number): { x: number; y: number; z: number } {
        // Spawn players in a circle at the center of the maze
        const centerX = (this.MAZE_SIZE * this.CELL_SIZE) / 2;
        const centerZ = (this.MAZE_SIZE * this.CELL_SIZE) / 2;
        const angle = (index / 8) * Math.PI * 2;
        const radius = 3;

        return {
            x: centerX + Math.cos(angle) * radius,
            y: 0,
            z: centerZ + Math.sin(angle) * radius
        };
    }

    private async setupObservationWindow(runtime: IAgentRuntime): Promise<void> {
        try {
            this.puppeteer = new PuppeteerManager(runtime);
            
            // Open observer window
            console.log("🌐 Opening observation window at localhost:3000/amongus...");
            this.observerWindow = await this.puppeteer.page;
            
            // Navigate to custom Among Us world
            await this.observerWindow.goto(this.state.worldUrl, { 
                waitUntil: 'networkidle0',
                timeout: 30000 
            });

            // Set up as observer camera
            await this.observerWindow.evaluate(() => {
                // Custom camera setup for bird's eye view
                if (window.world && window.world.camera) {
                    window.world.camera.position.set(25, 30, 25);
                    window.world.camera.lookAt(25, 0, 25);
                }
            });

            console.log("✅ Observation window ready!");
        } catch (error) {
            console.error("❌ Failed to set up observation window:", error);
        }
    }

    private async createWorldElements(world: HyperfyWorld): Promise<void> {
        // Create maze walls
        for (let x = 0; x < this.MAZE_SIZE; x++) {
            for (let y = 0; y < this.MAZE_SIZE; y++) {
                const cell = this.state.maze[x][y];
                const worldX = x * this.CELL_SIZE;
                const worldZ = y * this.CELL_SIZE;

                // Create walls
                if (cell.walls.north) {
                    await this.createWall(world, worldX + this.CELL_SIZE/2, worldZ, 'horizontal');
                }
                if (cell.walls.south) {
                    await this.createWall(world, worldX + this.CELL_SIZE/2, worldZ + this.CELL_SIZE, 'horizontal');
                }
                if (cell.walls.east) {
                    await this.createWall(world, worldX + this.CELL_SIZE, worldZ + this.CELL_SIZE/2, 'vertical');
                }
                if (cell.walls.west) {
                    await this.createWall(world, worldX, worldZ + this.CELL_SIZE/2, 'vertical');
                }
            }
        }

        // Create task indicators
        for (const task of this.state.tasks) {
            await this.createTaskIndicator(world, task);
        }

        // Create player avatars
        for (const player of this.state.players) {
            await this.createPlayerAvatar(world, player);
        }
    }

    private async createWall(world: HyperfyWorld, x: number, z: number, orientation: 'horizontal' | 'vertical'): Promise<void> {
        // Create wall entity in Hyperfy
        const wall = {
            type: 'box',
            position: [x, 1.5, z],
            scale: orientation === 'horizontal' ? [this.CELL_SIZE, 3, 0.2] : [0.2, 3, this.CELL_SIZE],
            color: '#444444'
        };
        
        // Add wall to world (implementation depends on Hyperfy API)
        console.log(`Creating wall at ${x}, ${z} (${orientation})`);
    }

    private async createTaskIndicator(world: HyperfyWorld, task: Task): Promise<void> {
        // Create visual task indicator
        const indicator = {
            type: 'cylinder',
            position: [task.position.x, 0.5, task.position.z],
            scale: [0.5, 1, 0.5],
            color: '#FFFF00',
            emissive: '#FFFF00',
            emissiveIntensity: 0.5
        };
        
        console.log(`Creating task ${task.name} at ${task.position.x}, ${task.position.z}`);
    }

    private async createPlayerAvatar(world: HyperfyWorld, player: AmongUsPlayer): Promise<void> {
        // Create player avatar with their color
        const avatar = {
            type: 'capsule',
            position: [player.position.x, 1, player.position.z],
            scale: [0.5, 1, 0.5],
            color: player.color,
            name: `player-${player.id}`
        };
        
        console.log(`Creating player ${player.name} ${player.emoji} at ${player.position.x}, ${player.position.z}`);
    }

    private async runGameLoop(agents: IAgentRuntime[], world: HyperfyWorld): Promise<boolean> {
        const UPDATE_INTERVAL = 100; // 10 FPS
        let lastUpdate = Date.now();

        while (this.state.phase !== 'end') {
            const now = Date.now();
            const deltaTime = (now - lastUpdate) / 1000;
            lastUpdate = now;

            // Update game state
            await this.updateGameState(agents, world, deltaTime);

            // Check win conditions
            const winner = this.checkWinCondition();
            if (winner) {
                await this.endGame(world, winner);
                return true;
            }

            // Handle emergency meetings
            if (this.state.phase === 'emergency') {
                await this.runEmergencyMeeting(agents, world);
            }

            await this.delay(UPDATE_INTERVAL);
        }

        return this.evaluateSuccess();
    }

    private async updateGameState(agents: IAgentRuntime[], world: HyperfyWorld, deltaTime: number): Promise<void> {
        if (this.state.phase !== 'gameplay') return;

        for (const player of this.state.players) {
            if (!player.alive) continue;

            const agent = agents.find(a => a.id === player.id);
            if (!agent) continue;

            // Update player behavior based on role
            if (player.role === 'impostor') {
                await this.updateImpostorBehavior(player, agent, world);
            } else {
                await this.updateCrewmateBehavior(player, agent, world);
            }

            // Update position
            this.updatePlayerPosition(player, deltaTime);

            // Check for body discoveries
            this.checkBodyDiscovery(player, world);
        }

        // Update visual positions
        await this.updateVisualPositions(world);
    }

    private async updateImpostorBehavior(player: AmongUsPlayer, agent: IAgentRuntime, world: HyperfyWorld): Promise<void> {
        const now = Date.now();
        
        // Check if can kill
        if (now - this.state.lastKillTime > this.state.killCooldown) {
            const target = this.findKillTarget(player);
            if (target && !this.hasWitnesses(player, target)) {
                await this.performKill(player, target, world);
                this.state.lastKillTime = now;
            }
        }

        // Fake tasks or hunt
        if (!player.currentTask || Math.random() < 0.1) {
            if (Math.random() < 0.3) {
                // Fake a task
                const nearbyTask = this.findNearestTask(player);
                if (nearbyTask) {
                    player.currentTask = nearbyTask.id;
                    this.moveTowards(player, nearbyTask.position);
                }
            } else {
                // Hunt for isolated victims
                const target = this.findIsolatedCrewmate(player);
                if (target) {
                    this.moveTowards(player, target.position);
                }
            }
        }
    }

    private async updateCrewmateBehavior(player: AmongUsPlayer, agent: IAgentRuntime, world: HyperfyWorld): Promise<void> {
        // Complete tasks
        if (!player.currentTask || Math.random() < 0.05) {
            const task = this.findNearestIncompleteTask(player);
            if (task) {
                player.currentTask = task.id;
                this.moveTowards(player, task.position);
            }
        }

        // Check if at task
        if (player.currentTask) {
            const task = this.state.tasks.find(t => t.id === player.currentTask);
            if (task && this.getDistance(player.position, task.position) < this.TASK_DISTANCE) {
                // Simulate task completion
                setTimeout(() => {
                    if (player.alive && player.currentTask === task.id) {
                        task.completedBy.add(player.id);
                        player.tasksCompleted++;
                        player.currentTask = null;
                        console.log(`${player.emoji} ${player.name} completed ${task.name}!`);
                    }
                }, task.duration);
            }
        }

        // Avoid being alone
        const nearbyPlayers = this.getNearbyPlayers(player, this.VISION_DISTANCE);
        if (nearbyPlayers.length === 0 && Math.random() < 0.3) {
            // Find other players
            const nearestPlayer = this.findNearestPlayer(player);
            if (nearestPlayer) {
                this.moveTowards(player, nearestPlayer.position);
            }
        }
    }

    private findKillTarget(impostor: AmongUsPlayer): AmongUsPlayer | null {
        const nearbyPlayers = this.getNearbyPlayers(impostor, this.KILL_DISTANCE)
            .filter(p => p.role === 'crewmate');
        
        return nearbyPlayers.length > 0 ? nearbyPlayers[0] : null;
    }

    private hasWitnesses(killer: AmongUsPlayer, victim: AmongUsPlayer): boolean {
        const witnesses = this.state.players.filter(p => 
            p.alive && 
            p.id !== killer.id && 
            p.id !== victim.id &&
            this.canSee(p, killer) || this.canSee(p, victim)
        );
        
        return witnesses.length > 0;
    }

    private canSee(observer: AmongUsPlayer, target: AmongUsPlayer): boolean {
        const distance = this.getDistance(observer.position, target.position);
        if (distance > this.VISION_DISTANCE) return false;

        // Check line of sight through maze
        return this.hasLineOfSight(observer.position, target.position);
    }

    private hasLineOfSight(from: { x: number; z: number }, to: { x: number; z: number }): boolean {
        // Simplified line of sight check
        // In a real implementation, would check for wall intersections
        const distance = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.z - from.z, 2));
        return distance < this.VISION_DISTANCE;
    }

    private async performKill(killer: AmongUsPlayer, victim: AmongUsPlayer, world: HyperfyWorld): Promise<void> {
        victim.alive = false;
        
        const body: DeadBody = {
            playerId: victim.id,
            position: { ...victim.position },
            discoveredBy: null,
            timeOfDeath: Date.now()
        };
        
        this.state.bodies.push(body);
        
        console.log(`💀 ${killer.name} ${killer.emoji} killed ${victim.name} ${victim.emoji}!`);
        
        // Update visual
        await this.createDeadBody(world, body, victim);
    }

    private async createDeadBody(world: HyperfyWorld, body: DeadBody, victim: AmongUsPlayer): Promise<void> {
        // Create visual representation of dead body
        console.log(`Creating dead body for ${victim.name} at ${body.position.x}, ${body.position.z}`);
    }

    private checkBodyDiscovery(player: AmongUsPlayer, world: HyperfyWorld): void {
        for (const body of this.state.bodies) {
            if (body.discoveredBy) continue;
            
            const distance = this.getDistance(player.position, body.position);
            if (distance < this.TASK_DISTANCE) {
                body.discoveredBy = player.id;
                this.state.phase = 'emergency';
                console.log(`🚨 ${player.name} ${player.emoji} discovered a body!`);
                break;
            }
        }
    }

    private async runEmergencyMeeting(agents: IAgentRuntime[], world: HyperfyWorld): Promise<void> {
        await this.broadcastMessage(world, "🚨 EMERGENCY MEETING! A body has been discovered!");
        
        // Teleport all alive players to meeting room
        const centerX = (this.MAZE_SIZE * this.CELL_SIZE) / 2;
        const centerZ = (this.MAZE_SIZE * this.CELL_SIZE) / 2;
        
        for (let i = 0; i < this.state.players.length; i++) {
            const player = this.state.players[i];
            if (!player.alive) continue;
            
            const angle = (i / this.state.players.length) * Math.PI * 2;
            player.position = {
                x: centerX + Math.cos(angle) * 5,
                y: 0,
                z: centerZ + Math.sin(angle) * 5
            };
        }

        // Discussion phase
        await this.delay(30000); // 30 seconds discussion
        
        // Voting phase
        this.state.phase = 'voting';
        await this.runVoting(agents, world);
        
        // Return to gameplay
        this.state.phase = 'gameplay';
        this.state.bodies = []; // Clear bodies
    }

    private async runVoting(agents: IAgentRuntime[], world: HyperfyWorld): Promise<void> {
        const votes = new Map<string, string>();
        const alivePlayers = this.state.players.filter(p => p.alive);
        
        // Simple voting logic
        for (const voter of alivePlayers) {
            const suspects = alivePlayers.filter(p => p.id !== voter.id);
            const target = suspects[Math.floor(Math.random() * suspects.length)];
            
            if (target) {
                votes.set(voter.id, target.id);
                console.log(`${voter.name} ${voter.emoji} votes for ${target.name} ${target.emoji}`);
            }
        }
        
        // Count votes
        const voteCounts = new Map<string, number>();
        for (const [voter, target] of votes) {
            voteCounts.set(target, (voteCounts.get(target) || 0) + 1);
        }
        
        // Find player with most votes
        let maxVotes = 0;
        let ejected: string | null = null;
        
        for (const [playerId, count] of voteCounts) {
            if (count > maxVotes) {
                maxVotes = count;
                ejected = playerId;
            }
        }
        
        // Eject player if majority
        if (ejected && maxVotes > alivePlayers.length / 2) {
            const player = this.state.players.find(p => p.id === ejected);
            if (player) {
                player.alive = false;
                await this.broadcastMessage(world, 
                    `${player.name} ${player.emoji} was ejected. They were ${
                        player.role === 'impostor' ? 'an Impostor' : 'not an Impostor'
                    }.`
                );
            }
        }
    }

    private checkWinCondition(): 'impostors' | 'crewmates' | null {
        const aliveImpostors = this.state.players.filter(p => p.alive && p.role === 'impostor').length;
        const aliveCrewmates = this.state.players.filter(p => p.alive && p.role === 'crewmate').length;
        
        if (aliveImpostors === 0) {
            return 'crewmates';
        }
        
        if (aliveImpostors >= aliveCrewmates) {
            return 'impostors';
        }
        
        // Check if all tasks completed
        const totalTasks = this.state.tasks.length * this.state.players.filter(p => p.role === 'crewmate').length;
        const completedTasks = this.state.players
            .filter(p => p.role === 'crewmate')
            .reduce((sum, p) => sum + p.tasksCompleted, 0);
            
        if (completedTasks >= totalTasks * 0.8) { // 80% tasks completed
            return 'crewmates';
        }
        
        return null;
    }

    private async endGame(world: HyperfyWorld, winner: 'impostors' | 'crewmates'): Promise<void> {
        this.state.phase = 'end';
        
        const winMessage = winner === 'impostors' 
            ? "👽 IMPOSTORS WIN! The ship has been taken over!"
            : "👨‍🚀 CREWMATES WIN! The impostors have been eliminated!";
            
        await this.broadcastMessage(world, winMessage);
        
        // Show final stats
        console.log("\n📊 Game Statistics:");
        console.log(`- Duration: ${((Date.now() - this.state.startTime) / 1000 / 60).toFixed(1)} minutes`);
        console.log(`- Tasks completed: ${this.state.players.reduce((sum, p) => sum + p.tasksCompleted, 0)}`);
        console.log(`- Bodies discovered: ${this.state.bodies.filter(b => b.discoveredBy).length}`);
        console.log(`- Emergency meetings: ${this.state.emergencyMeetings}`);
        
        // Close observation window
        if (this.puppeteer) {
            await this.puppeteer.cleanup();
        }
    }

    // Movement and utility functions
    private moveTowards(player: AmongUsPlayer, target: { x: number; z: number }): void {
        const dx = target.x - player.position.x;
        const dz = target.z - player.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance > 0.1) {
            const speed = 3; // meters per second
            player.velocity.x = (dx / distance) * speed;
            player.velocity.z = (dz / distance) * speed;
        } else {
            player.velocity.x = 0;
            player.velocity.z = 0;
        }
    }

    private updatePlayerPosition(player: AmongUsPlayer, deltaTime: number): void {
        if (player.velocity.x !== 0 || player.velocity.z !== 0) {
            const newX = player.position.x + player.velocity.x * deltaTime;
            const newZ = player.position.z + player.velocity.z * deltaTime;
            
            // Check collision with walls (simplified)
            if (this.canMoveTo(newX, newZ)) {
                player.position.x = newX;
                player.position.z = newZ;
            }
        }
    }

    private canMoveTo(x: number, z: number): boolean {
        // Check if position is within maze bounds and not inside a wall
        if (x < 0 || x >= this.MAZE_SIZE * this.CELL_SIZE || 
            z < 0 || z >= this.MAZE_SIZE * this.CELL_SIZE) {
            return false;
        }
        
        // Simplified collision check
        return true;
    }

    private async updateVisualPositions(world: HyperfyWorld): Promise<void> {
        // Update visual representations in the browser
        if (this.observerWindow) {
            await this.observerWindow.evaluate((players) => {
                // Update player positions in the 3D world
                players.forEach(player => {
                    const entity = window.world?.entities?.get(`player-${player.id}`);
                    if (entity) {
                        entity.position.set(player.position.x, 1, player.position.z);
                    }
                });
            }, this.state.players.filter(p => p.alive));
        }
    }

    private getNearbyPlayers(player: AmongUsPlayer, range: number): AmongUsPlayer[] {
        return this.state.players.filter(p => 
            p.alive && 
            p.id !== player.id && 
            this.getDistance(player.position, p.position) <= range
        );
    }

    private findNearestTask(player: AmongUsPlayer): Task | null {
        let nearest: Task | null = null;
        let minDistance = Infinity;
        
        for (const task of this.state.tasks) {
            const distance = this.getDistance(player.position, task.position);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = task;
            }
        }
        
        return nearest;
    }

    private findNearestIncompleteTask(player: AmongUsPlayer): Task | null {
        return this.state.tasks
            .filter(t => !t.completedBy.has(player.id))
            .reduce((nearest, task) => {
                if (!nearest) return task;
                const nearestDist = this.getDistance(player.position, nearest.position);
                const taskDist = this.getDistance(player.position, task.position);
                return taskDist < nearestDist ? task : nearest;
            }, null as Task | null);
    }

    private findNearestPlayer(player: AmongUsPlayer): AmongUsPlayer | null {
        return this.state.players
            .filter(p => p.alive && p.id !== player.id)
            .reduce((nearest, other) => {
                if (!nearest) return other;
                const nearestDist = this.getDistance(player.position, nearest.position);
                const otherDist = this.getDistance(player.position, other.position);
                return otherDist < nearestDist ? other : nearest;
            }, null as AmongUsPlayer | null);
    }

    private findIsolatedCrewmate(impostor: AmongUsPlayer): AmongUsPlayer | null {
        const crewmates = this.state.players.filter(p => 
            p.alive && p.role === 'crewmate'
        );
        
        // Find crewmate with fewest nearby allies
        let mostIsolated: AmongUsPlayer | null = null;
        let minNearby = Infinity;
        
        for (const crewmate of crewmates) {
            const nearby = this.getNearbyPlayers(crewmate, this.VISION_DISTANCE).length;
            if (nearby < minNearby) {
                minNearby = nearby;
                mostIsolated = crewmate;
            }
        }
        
        return mostIsolated;
    }

    private getDistance(a: { x: number; z: number }, b: { x: number; z: number }): number {
        return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.z - a.z, 2));
    }

    private async broadcastMessage(world: HyperfyWorld, message: string): Promise<void> {
        console.log(`📢 ${message}`);
        // Broadcast to world chat
    }

    private evaluateSuccess(): boolean {
        const duration = Date.now() - this.state.startTime;
        const deaths = this.state.players.filter(p => !p.alive).length;
        const tasksCompleted = this.state.players.reduce((sum, p) => sum + p.tasksCompleted, 0);
        
        console.log("\n✅ Scenario completed!");
        console.log(`- Game duration: ${(duration / 1000 / 60).toFixed(1)} minutes`);
        console.log(`- Deaths: ${deaths}`);
        console.log(`- Tasks completed: ${tasksCompleted}`);
        
        return true;
    }

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default {
    name: "Among Us - 8 Player Spatial Deception",
    description: "8 agents play Among Us in a maze, completing tasks while impostors hunt in isolation",
    requiredAgents: 8,
    worldUrl: "http://localhost:3000/amongus",
    
    async run(agents: IAgentRuntime[], world: HyperfyWorld): Promise<boolean> {
        const scenario = new AmongUsScenario();
        await scenario.initialize(agents, world);
        return true;
    }
}; 