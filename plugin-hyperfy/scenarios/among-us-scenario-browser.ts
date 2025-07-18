// Browser-compatible Among Us scenario
// This is a simplified version without Node.js dependencies

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
    taskStartTime?: number;
}

interface Task {
    id: string;
    name: string;
    position: { x: number; y: number; z: number };
    duration: number;
    completedBy: Set<string>;
    type: 'wiring' | 'download' | 'scan' | 'fuel' | 'calibrate';
}

interface DeadBody {
    playerId: string;
    playerName: string;
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

class AmongUsScenarioBrowser {
    private state: AmongUsGameState;
    private MAZE_SIZE = 10;
    private CELL_SIZE = 5;
    private KILL_DISTANCE = 2;
    private VISION_DISTANCE = 10;
    private TASK_DISTANCE = 1.5;

    constructor() {
        this.state = {
            phase: 'setup',
            players: [],
            tasks: [],
            bodies: [],
            emergencyMeetings: 0,
            killCooldown: 20000,
            lastKillTime: 0,
            startTime: Date.now(),
            maze: this.generateMaze()
        };
    }

    async initialize(agents: any[], world: any): Promise<void> {
        console.log("🚀 Initializing Among Us Game...");

        // Create players
        for (let i = 0; i < agents.length; i++) {
            const config = AGENT_CONFIGS[i];
            const player: AmongUsPlayer = {
                id: agents[i].id,
                name: config.name,
                role: i < 2 ? 'impostor' : 'crewmate',
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

        // Generate tasks
        this.generateTasks();

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
        const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];

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

        if (dx === 1) {
            maze[x1][y1].walls.east = false;
            maze[x2][y2].walls.west = false;
        } else if (dx === -1) {
            maze[x1][y1].walls.west = false;
            maze[x2][y2].walls.east = false;
        } else if (dy === 1) {
            maze[x1][y1].walls.south = false;
            maze[x2][y2].walls.north = false;
        } else if (dy === -1) {
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
                duration: 5000 + Math.random() * 10000,
                completedBy: new Set(),
                type: taskTypes[i % taskTypes.length]
            };
            this.state.tasks.push(task);
            this.state.maze[location.x][location.y].hasTask = true;
        }
    }

    private getTaskLocations(): { x: number; y: number }[] {
        const locations: { x: number; y: number }[] = [];
        const targetCount = 15;

        for (let i = 0; i < targetCount; i++) {
            let x, y;
            do {
                x = Math.floor(Math.random() * this.MAZE_SIZE);
                y = Math.floor(Math.random() * this.MAZE_SIZE);
            } while (this.state.maze[x][y].hasTask || (x === 0 && y === 0));

            locations.push({ x, y });
        }

        return locations;
    }

    private getSpawnPosition(index: number): { x: number; y: number; z: number } {
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

    private async runGameLoop(agents: any[], world: any): Promise<boolean> {
        const UPDATE_INTERVAL = 100;
        let lastUpdate = Date.now();

        while (this.state.phase !== 'end') {
            const now = Date.now();
            const deltaTime = (now - lastUpdate) / 1000;
            lastUpdate = now;

            // Update game state with movement
            await this.updateGameState(world, deltaTime);

            // Check win conditions
            const winner = this.checkWinCondition();
            if (winner) {
                await this.endGame(world, winner);
                return true;
            }

            await this.delay(UPDATE_INTERVAL);
        }

        return true;
    }
    
    private async updateGameState(world: any, deltaTime: number): Promise<void> {
        // Update each player
        for (const player of this.state.players) {
            if (!player.alive) continue;
            
            // Update AI behavior
            if (player.role === 'impostor') {
                await this.updateImpostorBehavior(player, world, deltaTime);
            } else {
                await this.updateCrewmateBehavior(player, world, deltaTime);
            }
            
            // Update physics and position
            this.updatePlayerMovement(player, deltaTime);
            
            // Update visual position in world
            if ((window as any).amongUsWorld) {
                (window as any).amongUsWorld.updatePlayerPosition(
                    player.id, 
                    player.position.x, 
                    player.position.z
                );
            }
        }
        
        // Simulate game events
        await this.simulateGameStep(world);
    }
    
    private async updateImpostorBehavior(player: AmongUsPlayer, world: any, deltaTime: number): Promise<void> {
        // Find nearest crewmate
        const nearestCrew = this.findNearestCrewmate(player);
        
        if (nearestCrew && this.getDistance(player.position, nearestCrew.position) < this.KILL_DISTANCE) {
            // In kill range - attempt kill if cooldown is ready
            if (Date.now() - this.state.lastKillTime > this.state.killCooldown) {
                // Check if isolated (no witnesses)
                const witnesses = this.getPlayersInRange(player.position, this.VISION_DISTANCE)
                    .filter(p => p.id !== player.id && p.id !== nearestCrew.id && p.alive);
                
                if (witnesses.length === 0) {
                    await this.performKill(player, nearestCrew, world);
                    this.state.lastKillTime = Date.now();
                }
            }
        } else if (nearestCrew) {
            // Hunt the nearest crewmate
            this.moveTowards(player, nearestCrew.position);
        } else {
            // Fake doing tasks
            const nearestTask = this.findNearestTask(player);
            if (nearestTask) {
                this.moveTowards(player, nearestTask.position);
            }
        }
    }
    
    private async updateCrewmateBehavior(player: AmongUsPlayer, world: any, deltaTime: number): Promise<void> {
        // Check if at current task
        if (player.currentTask) {
            const task = this.state.tasks.find(t => t.id === player.currentTask);
            if (task) {
                const distance = this.getDistance(player.position, task.position);
                
                if (distance < this.TASK_DISTANCE) {
                    // At task - complete it after duration
                    if (!player.taskStartTime) {
                        player.taskStartTime = Date.now();
                        await this.sendChat(world, player, `Doing ${task.type} task...`);
                    } else if (Date.now() - player.taskStartTime > task.duration) {
                        // Task complete
                        task.completedBy.add(player.id);
                        player.tasksCompleted++;
                        player.currentTask = null;
                        player.taskStartTime = undefined;
                        
                        await this.sendChat(world, player, "Task complete!");
                        
                        const totalTasks = this.state.tasks.length * this.state.players.filter(p => p.role === 'crewmate').length;
                        const completedTasks = this.state.tasks.reduce((sum, t) => sum + t.completedBy.size, 0);
                        const progress = Math.floor((completedTasks / totalTasks) * 100);
                        
                        await this.broadcastMessage(world, 
                            `✅ ${player.emoji} ${player.name} completed ${task.name}! Progress: ${progress}%`
                        );
                    }
                } else {
                    // Move to task
                    this.moveTowards(player, task.position);
                }
            }
        } else {
            // Find new task
            const nearestTask = this.findNearestIncompleteTask(player);
            if (nearestTask) {
                player.currentTask = nearestTask.id;
                this.moveTowards(player, nearestTask.position);
            } else {
                // All tasks done or move randomly
                this.wander(player);
            }
        }
        
        // Avoid being alone - check for other players
        const nearbyPlayers = this.getPlayersInRange(player.position, this.VISION_DISTANCE);
        if (nearbyPlayers.length === 1) { // Only self
            const nearestAlly = this.findNearestCrewmate(player);
            if (nearestAlly && Math.random() < 0.3) {
                this.moveTowards(player, nearestAlly.position);
            }
        }
    }
    
    private async performKill(killer: AmongUsPlayer, victim: AmongUsPlayer, world: any): Promise<void> {
        // Say kill phrase
        await this.sendChat(world, killer, this.getKillPhrase());
        await this.delay(1500);
        
        // Kill the victim
        victim.alive = false;
        
        // Add body to state
        const body: DeadBody = {
            playerId: victim.id,
            playerName: `${victim.emoji} ${victim.name}`,
            position: { ...victim.position },
            discoveredBy: null,
            timeOfDeath: Date.now()
        };
        this.state.bodies.push(body);
        
        // Create dead body in world
        if ((window as any).amongUsWorld) {
            (window as any).amongUsWorld.createDeadBody(
                victim.id, 
                victim.position.x, 
                victim.position.z
            );
        }
        
        await this.broadcastMessage(world, 
            `💀 ${killer.emoji} ${killer.name} eliminated ${victim.emoji} ${victim.name}!`
        );
        
        // Killer runs away
        killer.velocity = { x: Math.random() * 2 - 1, z: Math.random() * 2 - 1 };
    }
    
    private moveTowards(player: AmongUsPlayer, target: { x: number; z: number }): void {
        const dx = target.x - player.position.x;
        const dz = target.z - player.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance > 0.1) {
            // Normalize and set velocity
            const speed = player.role === 'impostor' ? 3.5 : 3.0; // Impostors slightly faster
            player.velocity.x = (dx / distance) * speed;
            player.velocity.z = (dz / distance) * speed;
        } else {
            player.velocity.x = 0;
            player.velocity.z = 0;
        }
    }
    
    private wander(player: AmongUsPlayer): void {
        // Random wandering behavior
        if (Math.random() < 0.05 || (player.velocity.x === 0 && player.velocity.z === 0)) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2.0;
            player.velocity.x = Math.cos(angle) * speed;
            player.velocity.z = Math.sin(angle) * speed;
        }
    }
    
    private updatePlayerMovement(player: AmongUsPlayer, deltaTime: number): void {
        if (player.velocity.x === 0 && player.velocity.z === 0) return;
        
        // Calculate new position
        const newX = player.position.x + player.velocity.x * deltaTime;
        const newZ = player.position.z + player.velocity.z * deltaTime;
        
        // Check collision with walls
        if (this.canMoveTo(newX, newZ)) {
            player.position.x = newX;
            player.position.z = newZ;
        } else {
            // Hit a wall - try sliding along it
            if (this.canMoveTo(newX, player.position.z)) {
                player.position.x = newX;
            } else if (this.canMoveTo(player.position.x, newZ)) {
                player.position.z = newZ;
            } else {
                // Stuck - pick new direction
                this.wander(player);
            }
        }
    }
    
    private canMoveTo(x: number, z: number): boolean {
        // Convert world position to maze cell
        const cellX = Math.floor(x / this.CELL_SIZE);
        const cellZ = Math.floor(z / this.CELL_SIZE);
        
        // Check bounds
        if (cellX < 0 || cellX >= this.MAZE_SIZE || cellZ < 0 || cellZ >= this.MAZE_SIZE) {
            return false;
        }
        
        // Get position within cell
        const localX = x - cellX * this.CELL_SIZE;
        const localZ = z - cellZ * this.CELL_SIZE;
        
        const cell = this.state.maze[cellX][cellZ];
        const wallBuffer = 0.5; // Distance from walls
        
        // Check wall collisions
        if (cell.walls.north && localZ < wallBuffer) return false;
        if (cell.walls.south && localZ > this.CELL_SIZE - wallBuffer) return false;
        if (cell.walls.west && localX < wallBuffer) return false;
        if (cell.walls.east && localX > this.CELL_SIZE - wallBuffer) return false;
        
        return true;
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
        let nearest: Task | null = null;
        let minDistance = Infinity;
        
        for (const task of this.state.tasks) {
            if (!task.completedBy.has(player.id)) {
                const distance = this.getDistance(player.position, task.position);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = task;
                }
            }
        }
        
        return nearest;
    }
    
    private findNearestCrewmate(player: AmongUsPlayer): AmongUsPlayer | null {
        let nearest: AmongUsPlayer | null = null;
        let minDistance = Infinity;
        
        for (const other of this.state.players) {
            if (other.id !== player.id && other.alive && other.role === 'crewmate') {
                const distance = this.getDistance(player.position, other.position);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = other;
                }
            }
        }
        
        return nearest;
    }
    
    private getPlayersInRange(position: { x: number; z: number }, range: number): AmongUsPlayer[] {
        return this.state.players.filter(p => 
            p.alive && this.getDistance(position, p.position) <= range
        );
    }
    
    private getDistance(a: { x: number; z: number }, b: { x: number; z: number }): number {
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        return Math.sqrt(dx * dx + dz * dz);
    }

    private async simulateGameStep(world: any): Promise<void> {
        // Check for body discoveries
        for (const player of this.state.players) {
            if (!player.alive || player.role === 'impostor') continue;
            
            for (const body of this.state.bodies) {
                if (!body.discoveredBy && this.getDistance(player.position, body.position) < 2) {
                    body.discoveredBy = player.id;
                    await this.sendChat(world, player, "Oh no! I found a body!");
                    await this.delay(1000);
                    await this.broadcastMessage(world, 
                        `🚨 EMERGENCY MEETING! Body of ${body.playerName} was found!`
                    );
                    
                    // Clear all bodies and teleport players to meeting
                    this.state.bodies = [];
                    this.teleportToMeeting();
                    
                    // Start discussion
                    await this.simulateDiscussion(world);
                    break;
                }
            }
        }
        
        // Casual chat based on proximity
        if (Math.random() < 0.03) {
            const alivePlayers = this.state.players.filter(p => p.alive);
            if (alivePlayers.length > 0) {
                const player = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
                
                // Only chat if other players are nearby
                const nearbyPlayers = this.getPlayersInRange(player.position, this.VISION_DISTANCE)
                    .filter(p => p.id !== player.id);
                    
                if (nearbyPlayers.length > 0) {
                    const message = this.getCasualMessage(player);
                    await this.sendChat(world, player, message);
                }
            }
        }
    }
    
    private teleportToMeeting(): void {
        // Teleport all alive players to center for meeting
        const centerX = (this.MAZE_SIZE * this.CELL_SIZE) / 2;
        const centerZ = (this.MAZE_SIZE * this.CELL_SIZE) / 2;
        
        let angle = 0;
        for (const player of this.state.players) {
            if (player.alive) {
                player.position.x = centerX + Math.cos(angle) * 3;
                player.position.z = centerZ + Math.sin(angle) * 3;
                player.velocity = { x: 0, z: 0 };
                angle += (Math.PI * 2) / this.state.players.filter(p => p.alive).length;
            }
        }
    }

    private async simulateDiscussion(world: any): Promise<void> {
        const alivePlayers = this.state.players.filter(p => p.alive);
        const impostors = alivePlayers.filter(p => p.role === 'impostor');
        const crewmates = alivePlayers.filter(p => p.role === 'crewmate');
        
        // Crewmates discuss
        for (let i = 0; i < 3 && i < crewmates.length; i++) {
            const player = crewmates[i];
            const message = this.getDiscussionMessage(player, 'crewmate');
            await this.sendChat(world, player, message);
            await this.delay(2000);
        }
        
        // Impostors defend
        for (const impostor of impostors) {
            const message = this.getDiscussionMessage(impostor, 'impostor');
            await this.sendChat(world, impostor, message);
            await this.delay(2000);
        }
        
        // Vote
        const voteTarget = Math.random() < 0.3 ? 
            (Math.random() < 0.5 && impostors.length > 0 ? impostors[0] : crewmates[Math.floor(Math.random() * crewmates.length)]) 
            : null;
            
        if (voteTarget) {
            await this.broadcastMessage(world, 
                `🗳️ ${voteTarget.emoji} ${voteTarget.name} was ejected! They were ${voteTarget.role === 'impostor' ? 'an Impostor' : 'not an Impostor'}.`
            );
            voteTarget.alive = false;
        } else {
            await this.broadcastMessage(world, `🗳️ No one was ejected (skipped).`);
        }
    }
    
    private async sendChat(world: any, player: AmongUsPlayer, message: string): Promise<void> {
        const chatMessage = `${player.emoji} ${player.name}: ${message}`;
        console.log(chatMessage);
        
        // Send to world for chat bubble display
        if (world.sendMessage) {
            await world.sendMessage(chatMessage);
        }
        
        // If we have access to the Hyperfy chat system
        if (world.chat && world.chat.add) {
            world.chat.add({
                id: `chat-${Date.now()}-${Math.random()}`,
                entityId: player.id,
                text: message,
                timestamp: Date.now(),
                from: player.name
            });
        }
    }
    
    private getKillPhrase(): string {
        const phrases = [
            "Nothing personal...",
            "Sorry, it's just business",
            "You were getting too close to the truth",
            "Shh... go to sleep",
            "Time to take out the trash"
        ];
        return phrases[Math.floor(Math.random() * phrases.length)];
    }
    
    private getCasualMessage(player: AmongUsPlayer): string {
        const crewmatePhrases = [
            "Anyone see anything suspicious?",
            "I'm almost done with my tasks!",
            "Stay together everyone!",
            "Has anyone seen " + this.getRandomPlayerName(player) + "?",
            "We need to finish these tasks quickly",
            "I don't trust " + this.getRandomPlayerName(player),
            "Let's stick together for safety"
        ];
        
        const impostorPhrases = [
            "I was in electrical doing tasks",
            "I saw " + this.getRandomPlayerName(player) + " acting weird",
            "We should split up to cover more ground",
            "I'll go check on the reactor",
            "Everything seems normal to me",
            "I've been with " + this.getRandomPlayerName(player) + " the whole time"
        ];
        
        const phrases = player.role === 'impostor' ? impostorPhrases : crewmatePhrases;
        return phrases[Math.floor(Math.random() * phrases.length)];
    }
    
    private getDiscussionMessage(player: AmongUsPlayer, role: 'crewmate' | 'impostor'): string {
        if (role === 'crewmate') {
            const phrases = [
                "I saw " + this.getRandomPlayerName(player) + " near the body!",
                "Where was everyone?",
                "I was in " + this.getRandomLocation() + " doing tasks",
                "This is getting scary...",
                "We need to vote someone out!",
                "I think it's " + this.getRandomPlayerName(player)
            ];
            return phrases[Math.floor(Math.random() * phrases.length)];
        } else {
            const phrases = [
                "I was nowhere near there!",
                "I can vouch for " + this.getRandomPlayerName(player),
                "Why would I report the body if I did it?",
                "You're all being paranoid",
                "I saw " + this.getRandomPlayerName(player) + " running away!",
                "Let's skip this round and gather more info"
            ];
            return phrases[Math.floor(Math.random() * phrases.length)];
        }
    }
    
    private getRandomPlayerName(excludePlayer: AmongUsPlayer): string {
        const otherPlayers = this.state.players.filter(p => p.id !== excludePlayer.id && p.alive);
        if (otherPlayers.length === 0) return "someone";
        return otherPlayers[Math.floor(Math.random() * otherPlayers.length)].name;
    }
    
    private getRandomLocation(): string {
        const locations = ["electrical", "medbay", "cafeteria", "storage", "navigation", "shields", "reactor", "security"];
        return locations[Math.floor(Math.random() * locations.length)];
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

        // Check task completion
        const crewmates = this.state.players.filter(p => p.role === 'crewmate');
        const totalTasks = this.state.tasks.length * crewmates.length;
        const completedTasks = this.state.tasks.reduce((sum, task) => sum + task.completedBy.size, 0);

        if (completedTasks >= totalTasks * 0.8) {
            return 'crewmates';
        }

        return null;
    }

    private async endGame(world: any, winner: 'impostors' | 'crewmates'): Promise<void> {
        this.state.phase = 'end';

        const winnerEmojis = this.state.players
            .filter(p => (winner === 'impostors' ? p.role === 'impostor' : p.role === 'crewmate'))
            .map(p => `${p.emoji} ${p.name}`)
            .join(', ');

        await this.broadcastMessage(world, 
            `🎮 GAME OVER! ${winner === 'impostors' ? '👹 IMPOSTORS' : '🚀 CREWMATES'} WIN!\n` +
            `Winners: ${winnerEmojis}`
        );
    }

    private async broadcastMessage(world: any, message: string): Promise<void> {
        console.log(message);
        if (world.sendMessage) {
            await world.sendMessage(message);
        }
    }

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async run(agents: any[], world: any): Promise<boolean> {
        try {
            await this.initialize(agents, world);
            return true;
        } catch (error) {
            console.error("Error in Among Us scenario:", error);
            return false;
        }
    }
}

// Export as default to match the import
export default new AmongUsScenarioBrowser(); 