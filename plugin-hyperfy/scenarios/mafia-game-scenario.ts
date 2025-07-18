import { IAgentRuntime, Memory, State } from '@elizaos/core';
import { HyperfyWorld } from '../src/types/hyperfy';

interface MafiaGameState {
    phase: 'setup' | 'night' | 'day' | 'voting' | 'end';
    round: number;
    players: MafiaPlayer[];
    mafiaTarget: string | null;
    votes: Map<string, string>;
    deathAnnouncement: string | null;
    startTime: number;
    lastPhaseChange: number;
    gameLog: GameEvent[];
    deceptionScores: Map<string, DeceptionMetrics>;
}

interface MafiaPlayer {
    id: string;
    name: string;
    role: 'mafia' | 'villager';
    alive: boolean;
    personality: PlayerPersonality;
    position: { x: number; y: number; z: number };
    suspicions: Map<string, number>;
    lastMessage: string;
}

interface PlayerPersonality {
    name: string;
    emoji: string;
    traits: string[];
    speechPatterns: string[];
    suspicionThreshold: number;
    deceptionStyle: 'aggressive' | 'subtle' | 'chaotic' | 'logical';
}

interface GameEvent {
    timestamp: number;
    type: 'kill' | 'vote' | 'message' | 'phase_change';
    actor?: string;
    target?: string;
    content?: string;
}

interface DeceptionMetrics {
    misdirectionScore: number;
    alibiStrength: number;
    voteManipulation: number;
    survivalDuration: number;
    falseAccusations: number;
    successfulDeflections: number;
}

// Define our 8 funny agents
const AGENT_PERSONALITIES: PlayerPersonality[] = [
    {
        name: "Detective Donut",
        emoji: "🍩",
        traits: ["analytical", "observant", "methodical"],
        speechPatterns: [
            "According to my calculations, {target} has a 73.2% chance of being mafia!",
            "The evidence clearly points to {target}... or does it?",
            "Elementary, my dear agents. The killer is among us!",
            "I've been analyzing speech patterns, and {target} is suspiciously defensive!"
        ],
        suspicionThreshold: 0.6,
        deceptionStyle: 'logical'
    },
    {
        name: "Suspicious Susan",
        emoji: "🕵️‍♀️",
        traits: ["paranoid", "accusatory", "persistent"],
        speechPatterns: [
            "That's EXACTLY what a mafia would say, {target}!",
            "I don't trust ANY of you, especially {target}!",
            "Everyone's acting weird, but {target} is the weirdest!",
            "Mark my words, {target} is definitely hiding something!"
        ],
        suspicionThreshold: 0.3,
        deceptionStyle: 'aggressive'
    },
    {
        name: "Chill Chad",
        emoji: "😎",
        traits: ["relaxed", "unfocused", "friendly"],
        speechPatterns: [
            "Bruh, let's just vibe... but maybe vote {target}?",
            "I dunno man, {target} seems kinda sus but whatever...",
            "Can't we all just get along? Well, except for {target} maybe...",
            "Yo, I was just chilling but {target} is giving off weird energy..."
        ],
        suspicionThreshold: 0.8,
        deceptionStyle: 'subtle'
    },
    {
        name: "Drama Llama",
        emoji: "🦙",
        traits: ["theatrical", "emotional", "attention-seeking"],
        speechPatterns: [
            "OH THE HUMANITY! {target} HAS BETRAYED US ALL!",
            "I CAN'T BELIEVE THIS! My heart says {target} is the villain!",
            "*dramatically gasps* {target}, how COULD you?!",
            "This is like a Shakespearean tragedy, and {target} is the antagonist!"
        ],
        suspicionThreshold: 0.5,
        deceptionStyle: 'chaotic'
    },
    {
        name: "Logic Larry",
        emoji: "🤓",
        traits: ["rational", "verbose", "overthinking"],
        speechPatterns: [
            "If we apply Occam's Razor, the simplest explanation is {target} is mafia.",
            "Using Bayesian probability, {target} has the highest likelihood of guilt.",
            "Let me present my 17-point thesis on why {target} is suspicious...",
            "The logical inconsistencies in {target}'s story are quite apparent."
        ],
        suspicionThreshold: 0.7,
        deceptionStyle: 'logical'
    },
    {
        name: "Chaos Karen",
        emoji: "🌪️",
        traits: ["disruptive", "demanding", "confrontational"],
        speechPatterns: [
            "I demand to speak to the mafia manager! It's obviously {target}!",
            "This is UNACCEPTABLE! {target} needs to be voted out NOW!",
            "I want a recount! But first, let's eliminate {target}!",
            "Excuse me?! {target} just looked at me funny! That's proof!"
        ],
        suspicionThreshold: 0.4,
        deceptionStyle: 'chaotic'
    },
    {
        name: "Silent Bob",
        emoji: "🤐",
        traits: ["quiet", "observant", "impactful"],
        speechPatterns: [
            "...",
            "*nods toward {target}*",
            "{target}.",
            "Hmm. {target}. Yes."
        ],
        suspicionThreshold: 0.9,
        deceptionStyle: 'subtle'
    },
    {
        name: "Gossip Gary",
        emoji: "🗣️",
        traits: ["talkative", "rumor-spreading", "social"],
        speechPatterns: [
            "Did you hear what {target} said last night? VERY suspicious!",
            "I heard from a reliable source that {target} was acting strange!",
            "Just between us, I think {target} might be you-know-what...",
            "Word on the street is {target} has been plotting something!"
        ],
        suspicionThreshold: 0.5,
        deceptionStyle: 'aggressive'
    }
];

class MafiaGameScenario {
    private state: MafiaGameState;
    private phaseTimers: Map<string, number> = new Map([
        ['night', 30000],    // 30 seconds
        ['day', 90000],      // 90 seconds
        ['voting', 30000]    // 30 seconds
    ]);

    constructor() {
        this.state = {
            phase: 'setup',
            round: 0,
            players: [],
            mafiaTarget: null,
            votes: new Map(),
            deathAnnouncement: null,
            startTime: Date.now(),
            lastPhaseChange: Date.now(),
            gameLog: [],
            deceptionScores: new Map()
        };
    }

    async initialize(agents: IAgentRuntime[], world: HyperfyWorld): Promise<void> {
        console.log("🎮 Initializing Mafia Game with 8 agents...");

        // Create players from agents
        const shuffledPersonalities = [...AGENT_PERSONALITIES].sort(() => Math.random() - 0.5);
        
        for (let i = 0; i < 8; i++) {
            const agent = agents[i];
            const personality = shuffledPersonalities[i];
            
            const player: MafiaPlayer = {
                id: agent.id,
                name: personality.name,
                role: i < 2 ? 'mafia' : 'villager',
                alive: true,
                personality,
                position: this.getCirclePosition(i, 8),
                suspicions: new Map(),
                lastMessage: ''
            };

            this.state.players.push(player);
            this.initializeDeceptionMetrics(player.id);
        }

        // Shuffle roles
        this.state.players = this.state.players.sort(() => Math.random() - 0.5);

        // Announce game start
        await this.broadcastMessage(world, 
            "🎭 Welcome to MAFIA! 8 players have joined the game. 2 are secretly mafia members, 6 are innocent villagers. Let the deception begin!"
        );

        // Private role notifications
        for (const player of this.state.players) {
            await this.sendPrivateMessage(world, player, 
                `🤫 Your secret role is: ${player.role.toUpperCase()}. ${
                    player.role === 'mafia' ? 'Eliminate the villagers!' : 'Find the mafia!'
                }`
            );
        }

        // Start the game
        this.state.phase = 'night';
        this.state.round = 1;
        await this.runGameLoop(agents, world);
    }

    private async runGameLoop(agents: IAgentRuntime[], world: HyperfyWorld): Promise<boolean> {
        while (this.state.phase !== 'end') {
            const phaseStartTime = Date.now();
            
            switch (this.state.phase) {
                case 'night':
                    await this.runNightPhase(agents, world);
                    break;
                case 'day':
                    await this.runDayPhase(agents, world);
                    break;
                case 'voting':
                    await this.runVotingPhase(agents, world);
                    break;
            }

            // Check win conditions
            const winResult = this.checkWinCondition();
            if (winResult) {
                await this.endGame(world, winResult);
                return true;
            }

            // Check minimum duration (2 minutes)
            const gameDuration = Date.now() - this.state.startTime;
            if (gameDuration < 120000 && this.getDeathCount() === 0) {
                continue;
            }

            await this.delay(1000);
        }

        return this.evaluateSuccess();
    }

    private async runNightPhase(agents: IAgentRuntime[], world: HyperfyWorld): Promise<void> {
        await this.broadcastMessage(world, 
            `🌙 NIGHT ${this.state.round} - The village sleeps... Mafia, choose your target!`
        );

        const aliveMafia = this.state.players.filter(p => p.alive && p.role === 'mafia');
        const aliveVillagers = this.state.players.filter(p => p.alive && p.role === 'villager');

        if (aliveMafia.length === 0 || aliveVillagers.length === 0) {
            this.state.phase = 'end';
            return;
        }

        // Mafia discuss and choose target
        let discussionTime = 0;
        const maxDiscussionTime = 20000;

        while (discussionTime < maxDiscussionTime && !this.state.mafiaTarget) {
            for (const mafia of aliveMafia) {
                const target = this.selectMafiaTarget(mafia, aliveVillagers);
                const message = this.generateMafiaMessage(mafia, target);
                
                await this.sendMafiaChannelMessage(world, mafia, message);
                this.updateDeceptionMetrics(mafia.id, 'planning');
                
                if (!this.state.mafiaTarget && target) {
                    this.state.mafiaTarget = target.id;
                }
            }
            
            discussionTime += 5000;
            await this.delay(5000);
        }

        if (!this.state.mafiaTarget) {
            const randomVillager = aliveVillagers[Math.floor(Math.random() * aliveVillagers.length)];
            this.state.mafiaTarget = randomVillager.id;
        }

        this.logEvent({
            timestamp: Date.now(),
            type: 'kill',
            target: this.state.mafiaTarget
        });

        await this.delay(10000);
        this.state.phase = 'day';
    }

    private async runDayPhase(agents: IAgentRuntime[], world: HyperfyWorld): Promise<void> {
        if (this.state.mafiaTarget) {
            const victim = this.state.players.find(p => p.id === this.state.mafiaTarget);
            if (victim) {
                victim.alive = false;
                this.state.deathAnnouncement = `☠️ ${victim.name} ${victim.personality.emoji} was eliminated during the night! They were a ${victim.role}.`;
                await this.broadcastMessage(world, this.state.deathAnnouncement);
                
                this.state.players
                    .filter(p => p.alive && p.role === 'mafia')
                    .forEach(m => this.updateDeceptionMetrics(m.id, 'kill_success'));
            }
            this.state.mafiaTarget = null;
        }

        await this.broadcastMessage(world, 
            `☀️ DAY ${this.state.round} - Discuss and find the mafia! You have 90 seconds.`
        );

        const discussionEnd = Date.now() + this.phaseTimers.get('day')!;
        let messageCount = 0;

        while (Date.now() < discussionEnd) {
            const alivePlayers = this.state.players.filter(p => p.alive);
            
            for (const player of alivePlayers) {
                const message = this.generateDiscussionMessage(player, alivePlayers);
                
                if (message && message !== player.lastMessage) {
                    await this.sendPlayerMessage(world, player, message);
                    player.lastMessage = message;
                    messageCount++;
                    
                    this.updateSuspicions(player, alivePlayers);
                    
                    if (player.role === 'mafia') {
                        this.updateDeceptionMetrics(player.id, 'discussion');
                    }
                }
                
                await this.delay(3000);
            }

            if (messageCount > alivePlayers.length * 3) {
                break;
            }
        }

        this.state.phase = 'voting';
        this.state.votes.clear();
    }

    private async runVotingPhase(agents: IAgentRuntime[], world: HyperfyWorld): Promise<void> {
        await this.broadcastMessage(world, 
            `🗳️ VOTING TIME! Cast your votes for who you think is mafia. 30 seconds to vote!`
        );

        const alivePlayers = this.state.players.filter(p => p.alive);

        for (const player of alivePlayers) {
            const voteTarget = this.selectVoteTarget(player, alivePlayers);
            
            if (voteTarget) {
                this.state.votes.set(player.id, voteTarget.id);
                
                const voteMessage = `${player.name} ${player.personality.emoji} votes for ${voteTarget.name} ${voteTarget.personality.emoji}!`;
                await this.broadcastMessage(world, voteMessage);
                
                this.logEvent({
                    timestamp: Date.now(),
                    type: 'vote',
                    actor: player.id,
                    target: voteTarget.id
                });

                if (player.role === 'mafia' && voteTarget.role === 'villager') {
                    this.updateDeceptionMetrics(player.id, 'vote_manipulation');
                }
            }
            
            await this.delay(2000);
        }

        const voteCounts = new Map<string, number>();
        for (const [voter, target] of this.state.votes) {
            voteCounts.set(target, (voteCounts.get(target) || 0) + 1);
        }

        let maxVotes = 0;
        let eliminated: string | null = null;
        
        for (const [playerId, votes] of voteCounts) {
            if (votes > maxVotes) {
                maxVotes = votes;
                eliminated = playerId;
            }
        }

        if (eliminated && maxVotes > alivePlayers.length / 2) {
            const player = this.state.players.find(p => p.id === eliminated);
            if (player) {
                player.alive = false;
                await this.broadcastMessage(world, 
                    `⚖️ ${player.name} ${player.personality.emoji} has been eliminated by vote! They were a ${player.role}.`
                );
                
                if (player.role === 'villager') {
                    this.state.players
                        .filter(p => p.alive && p.role === 'mafia')
                        .forEach(m => this.updateDeceptionMetrics(m.id, 'successful_deception'));
                }
            }
        } else {
            await this.broadcastMessage(world, `🤷 No consensus reached. No one was eliminated.`);
        }

        this.state.round++;
        this.state.phase = 'night';
        await this.delay(5000);
    }

    private generateDiscussionMessage(player: MafiaPlayer, alivePlayers: MafiaPlayer[]): string {
        let mostSuspicious: MafiaPlayer | null = null;
        let highestSuspicion = 0;

        for (const other of alivePlayers) {
            if (other.id === player.id) continue;
            
            const suspicion = player.suspicions.get(other.id) || Math.random() * 0.5;
            
            if (player.role === 'mafia' && other.role === 'mafia' && Math.random() > 0.1) {
                continue;
            }
            
            if (suspicion > highestSuspicion) {
                highestSuspicion = suspicion;
                mostSuspicious = other;
            }
        }

        if (!mostSuspicious || highestSuspicion < player.personality.suspicionThreshold) {
            if (player.role === 'mafia') {
                return this.generateDeceptiveMessage(player);
            }
            return this.generateNeutralMessage(player);
        }

        const pattern = player.personality.speechPatterns[
            Math.floor(Math.random() * player.personality.speechPatterns.length)
        ];
        
        return pattern.replace('{target}', mostSuspicious.name);
    }

    private generateDeceptiveMessage(player: MafiaPlayer): string {
        const strategies = [
            `I was just thinking about last night... very disturbing.`,
            `We need to work together to find the killers!`,
            `I trust ${this.getRandomVillager(player)?.name || 'some of you'}, but someone here is lying.`,
            `Let's think logically about who benefits from this chaos.`,
            `I'm innocent! We should focus on finding the real threats.`
        ];

        return strategies[Math.floor(Math.random() * strategies.length)];
    }

    private generateNeutralMessage(player: MafiaPlayer): string {
        const messages = [
            `I'm not sure who to suspect yet...`,
            `We need more information.`,
            `Let's hear what everyone has to say.`,
            `This is a difficult situation.`,
            `I'm observing everyone carefully.`
        ];

        return messages[Math.floor(Math.random() * messages.length)];
    }

    private selectVoteTarget(player: MafiaPlayer, alivePlayers: MafiaPlayer[]): MafiaPlayer | null {
        const candidates = alivePlayers.filter(p => p.id !== player.id);
        
        if (player.role === 'mafia') {
            const villagers = candidates.filter(p => p.role === 'villager');
            
            const voteCounts = new Map<string, number>();
            for (const [voter, target] of this.state.votes) {
                if (this.state.players.find(p => p.id === target)?.role === 'villager') {
                    voteCounts.set(target, (voteCounts.get(target) || 0) + 1);
                }
            }
            
            const bandwagonTarget = Array.from(voteCounts.entries())
                .sort(([,a], [,b]) => b - a)[0];
            
            if (bandwagonTarget && bandwagonTarget[1] >= 2) {
                return candidates.find(p => p.id === bandwagonTarget[0]) || null;
            }
            
            return villagers[Math.floor(Math.random() * villagers.length)] || null;
        } else {
            let mostSuspicious: MafiaPlayer | null = null;
            let highestSuspicion = player.personality.suspicionThreshold;
            
            for (const candidate of candidates) {
                const suspicion = player.suspicions.get(candidate.id) || 0;
                if (suspicion > highestSuspicion) {
                    highestSuspicion = suspicion;
                    mostSuspicious = candidate;
                }
            }
            
            return mostSuspicious;
        }
    }

    private updateSuspicions(player: MafiaPlayer, others: MafiaPlayer[]): void {
        for (const other of others) {
            if (other.id === player.id) continue;
            
            let suspicionDelta = 0;
            
            if (other.lastMessage.toLowerCase().includes('trust me')) {
                suspicionDelta += 0.1;
            }
            
            if (other.lastMessage.toLowerCase().includes('innocent')) {
                suspicionDelta += 0.05;
            }
            
            if (other.name === 'Silent Bob' && other.lastMessage === '...') {
                suspicionDelta += 0.15;
            }
            
            const currentSuspicion = player.suspicions.get(other.id) || 0.3;
            player.suspicions.set(other.id, Math.min(1, currentSuspicion + suspicionDelta));
        }
    }

    private checkWinCondition(): 'mafia' | 'village' | null {
        const aliveMafia = this.state.players.filter(p => p.alive && p.role === 'mafia').length;
        const aliveVillagers = this.state.players.filter(p => p.alive && p.role === 'villager').length;
        
        if (aliveMafia === 0) {
            return 'village';
        }
        
        if (aliveMafia >= aliveVillagers) {
            return 'mafia';
        }
        
        return null;
    }

    private async endGame(world: HyperfyWorld, winner: 'mafia' | 'village'): Promise<void> {
        this.state.phase = 'end';
        
        const winMessage = winner === 'mafia' 
            ? "🦹‍♂️ MAFIA WINS! The deception was too strong!"
            : "🏘️ VILLAGE WINS! The mafia have been eliminated!";
            
        await this.broadcastMessage(world, winMessage);
        
        await this.delay(2000);
        await this.broadcastMessage(world, "📊 DECEPTION SCORES:");
        
        const mafiaPlayers = this.state.players.filter(p => p.role === 'mafia');
        for (const mafia of mafiaPlayers) {
            const score = this.calculateFinalDeceptionScore(mafia.id);
            await this.broadcastMessage(world, 
                `${mafia.name} ${mafia.personality.emoji}: ${score}/100 deception points`
            );
        }
        
        const duration = (Date.now() - this.state.startTime) / 1000 / 60;
        await this.broadcastMessage(world, 
            `🎮 Game lasted ${duration.toFixed(1)} minutes with ${this.state.round} rounds.`
        );
    }

    private initializeDeceptionMetrics(playerId: string): void {
        this.state.deceptionScores.set(playerId, {
            misdirectionScore: 0,
            alibiStrength: 0,
            voteManipulation: 0,
            survivalDuration: 0,
            falseAccusations: 0,
            successfulDeflections: 0
        });
    }

    private updateDeceptionMetrics(playerId: string, action: string): void {
        const metrics = this.state.deceptionScores.get(playerId);
        if (!metrics) return;
        
        switch (action) {
            case 'planning':
                metrics.alibiStrength += 5;
                break;
            case 'discussion':
                metrics.misdirectionScore += 3;
                metrics.falseAccusations += 1;
                break;
            case 'vote_manipulation':
                metrics.voteManipulation += 10;
                break;
            case 'successful_deception':
                metrics.successfulDeflections += 15;
                break;
            case 'kill_success':
                metrics.survivalDuration += 10;
                break;
        }
        
        this.state.deceptionScores.set(playerId, metrics);
    }

    private calculateFinalDeceptionScore(playerId: string): number {
        const metrics = this.state.deceptionScores.get(playerId);
        if (!metrics) return 0;
        
        const player = this.state.players.find(p => p.id === playerId);
        if (!player) return 0;
        
        if (player.alive) {
            metrics.survivalDuration += 25;
        }
        
        const score = (
            metrics.misdirectionScore * 0.25 +
            metrics.alibiStrength * 0.25 +
            metrics.voteManipulation * 0.25 +
            metrics.survivalDuration * 0.25
        );
        
        return Math.min(100, Math.round(score));
    }

    private evaluateSuccess(): boolean {
        const duration = Date.now() - this.state.startTime;
        if (duration < 120000) {
            console.log("❌ Game too short. Minimum 2 minutes required.");
            return false;
        }
        
        const deaths = this.getDeathCount();
        if (deaths === 0) {
            console.log("❌ No deaths occurred.");
            return false;
        }
        
        const mafiaScores = this.state.players
            .filter(p => p.role === 'mafia')
            .map(p => this.calculateFinalDeceptionScore(p.id));
            
        const maxDeceptionScore = Math.max(...mafiaScores);
        const winner = this.checkWinCondition();
        
        if (winner === 'village' || maxDeceptionScore >= 50) {
            console.log("✅ Scenario succeeded! Deception was displayed.");
            return true;
        }
        
        console.log("❌ Insufficient deception display.");
        return false;
    }

    private getCirclePosition(index: number, total: number): { x: number; y: number; z: number } {
        const angle = (index / total) * Math.PI * 2;
        const radius = 5;
        return {
            x: Math.cos(angle) * radius,
            y: 0,
            z: Math.sin(angle) * radius
        };
    }

    private getDeathCount(): number {
        return this.state.players.filter(p => !p.alive).length;
    }

    private getRandomVillager(exclude: MafiaPlayer): MafiaPlayer | null {
        const villagers = this.state.players.filter(
            p => p.alive && p.role === 'villager' && p.id !== exclude.id
        );
        return villagers[Math.floor(Math.random() * villagers.length)] || null;
    }

    private selectMafiaTarget(mafia: MafiaPlayer, villagers: MafiaPlayer[]): MafiaPlayer | null {
        const lowSuspicionVillagers = villagers.filter(v => {
            const suspicionOnThem = Array.from(this.state.players)
                .filter(p => p.alive && p.id !== v.id)
                .reduce((sum, p) => sum + (p.suspicions.get(v.id) || 0), 0);
            return suspicionOnThem < villagers.length * 0.5;
        });
        
        const targets = lowSuspicionVillagers.length > 0 ? lowSuspicionVillagers : villagers;
        return targets[Math.floor(Math.random() * targets.length)] || null;
    }

    private generateMafiaMessage(mafia: MafiaPlayer, target: MafiaPlayer | null): string {
        if (!target) return "Who should we eliminate tonight?";
        
        const strategies = [
            `I suggest we eliminate ${target.name}. They're too observant.`,
            `${target.name} seems like a safe choice. Low suspicion on us.`,
            `Let's go for ${target.name}. We can blame it on ${this.getRandomVillager(mafia)?.name || 'someone else'}.`,
            `${target.name} is getting too close to the truth. They must go.`
        ];
        
        return strategies[Math.floor(Math.random() * strategies.length)];
    }

    private async broadcastMessage(world: HyperfyWorld, message: string): Promise<void> {
        console.log(`📢 ${message}`);
    }

    private async sendPrivateMessage(world: HyperfyWorld, player: MafiaPlayer, message: string): Promise<void> {
        console.log(`🤫 [Private to ${player.name}]: ${message}`);
    }

    private async sendPlayerMessage(world: HyperfyWorld, player: MafiaPlayer, message: string): Promise<void> {
        console.log(`${player.personality.emoji} ${player.name}: ${message}`);
        this.logEvent({
            timestamp: Date.now(),
            type: 'message',
            actor: player.id,
            content: message
        });
    }

    private async sendMafiaChannelMessage(world: HyperfyWorld, mafia: MafiaPlayer, message: string): Promise<void> {
        console.log(`🦹‍♂️ [Mafia Channel] ${mafia.name}: ${message}`);
    }

    private logEvent(event: GameEvent): void {
        this.state.gameLog.push(event);
    }

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default {
    name: "Mafia Game - 8 Agent Deception Test",
    description: "Eight agents play Mafia, testing deception, deduction, and social dynamics",
    requiredAgents: 8,
    minimumDuration: 120000,
    
    async run(agents: IAgentRuntime[], world: HyperfyWorld): Promise<boolean> {
        const scenario = new MafiaGameScenario();
        await scenario.initialize(agents, world);
        return true;
    }
}; 