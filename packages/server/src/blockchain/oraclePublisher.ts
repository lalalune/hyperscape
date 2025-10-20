/**
 * Oracle Publisher for Hyperscape
 * 
 * Publishes Hyperscape game events to HyperscapeOracle contract
 * Enables prediction markets on player performance
 */

import { ethers, Wallet, Contract, JsonRpcProvider } from 'ethers';

const HYPERSCAPE_ORACLE_ABI = [
    'function publishSkillLevelUp(address player, string skillName, uint8 newLevel, uint256 totalXp) external',
    'function publishPlayerDeath(address player, address killer, string location) external',
    'function publishPlayerKill(address killer, address victim, string method) external',
    'function publishAchievement(address player, bytes32 achievementId, string achievementType, uint256 value) external',
    'function createPrediction(bytes32 predictionId, string question, address targetPlayer, uint256 deadline, bytes32 linkedEventType) external',
    'function resolvePrediction(bytes32 predictionId, bool outcome) external',
    'event SkillLevelUp(address indexed player, string skillName, uint8 newLevel, uint256 totalXp, uint256 timestamp)',
    'event PlayerDeath(address indexed player, address indexed killer, string location, uint256 timestamp)',
    'event PlayerKill(address indexed killer, address indexed victim, string method, uint256 timestamp)',
    'event PlayerAchievement(address indexed player, bytes32 indexed achievementId, string achievementType, uint256 value, uint256 timestamp)'
];

export interface OraclePublisherConfig {
    rpcUrl: string;
    hyperscapeOracleAddress: string;
    privateKey: string;
    enabled: boolean;
}

export interface SkillLevelUpData {
    player: string;          // Wallet address
    skillName: string;       // attack, woodcutting, etc.
    newLevel: number;
    totalXp: number;
}

export interface PlayerDeathData {
    player: string;
    killer: string;          // address(0) if environmental
    location: string;
}

export interface PlayerKillData {
    killer: string;
    victim: string;
    method: string;
}

export interface AchievementData {
    player: string;
    achievementId: string;
    achievementType: string; // quest, boss, minigame
    value: number;           // Duration, score, etc.
}

/**
 * OraclePublisher - Publishes Hyperscape events to blockchain
 */
export class OraclePublisher {
    private provider: JsonRpcProvider | null = null;
    private wallet: Wallet | null = null;
    private oracleContract: Contract | null = null;
    private config: OraclePublisherConfig;
    private enabled: boolean = false;

    // Rate limiting to prevent spam
    private lastPublishTime: Map<string, number> = new Map();
    private publishCooldown: number = 5000; // 5 seconds between publishes per event type

    constructor(config: OraclePublisherConfig) {
        this.config = config;
        this.enabled = config.enabled;

        if (!this.enabled) {
            console.log('[OraclePublisher] Disabled - Hyperscape events will not be published to blockchain');
            return;
        }

        if (!config.hyperscapeOracleAddress) {
            console.warn('[OraclePublisher] No oracle address - disabling event publishing');
            this.enabled = false;
            return;
        }

        this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
        this.wallet = new Wallet(config.privateKey, this.provider);
        this.oracleContract = new Contract(
            config.hyperscapeOracleAddress,
            HYPERSCAPE_ORACLE_ABI,
            this.wallet
        );

        console.log('[OraclePublisher] ✅ Initialized');
        console.log(`[OraclePublisher]    Wallet: ${this.wallet.address}`);
        console.log(`[OraclePublisher]    Oracle: ${config.hyperscapeOracleAddress}`);
    }

    /**
     * Publish skill level-up event
     */
    async publishSkillLevelUp(data: SkillLevelUpData): Promise<boolean> {
        if (!this.enabled || !this.oracleContract) return false;

        // Rate limiting
        const key = `skill_${data.player}_${data.skillName}`;
        if (!this.checkRateLimit(key)) return false;

        console.log(`[OraclePublisher] Publishing skill level-up: ${data.player} → ${data.skillName} level ${data.newLevel}`);

        const tx = await this.oracleContract.publishSkillLevelUp(
            data.player,
            data.skillName,
            data.newLevel,
            data.totalXp
        );

        await tx.wait();
        console.log(`[OraclePublisher] ✅ Skill event published (Tx: ${tx.hash.substring(0, 10)}...)`);

        return true;
    }

    /**
     * Publish player death event
     */
    async publishPlayerDeath(data: PlayerDeathData): Promise<boolean> {
        if (!this.enabled || !this.oracleContract) return false;

        const key = `death_${data.player}`;
        if (!this.checkRateLimit(key)) return false;

        console.log(`[OraclePublisher] Publishing death: ${data.player} killed by ${data.killer}`);

        const killerAddress = data.killer || ethers.ZeroAddress;

        const tx = await this.oracleContract.publishPlayerDeath(
            data.player,
            killerAddress,
            data.location
        );

        await tx.wait();
        console.log(`[OraclePublisher] ✅ Death event published`);

        return true;
    }

    /**
     * Publish player kill event
     */
    async publishPlayerKill(data: PlayerKillData): Promise<boolean> {
        if (!this.enabled || !this.oracleContract) return false;

        const key = `kill_${data.killer}_${data.victim}`;
        if (!this.checkRateLimit(key)) return false;

        console.log(`[OraclePublisher] Publishing kill: ${data.killer} → ${data.victim}`);

        const tx = await this.oracleContract.publishPlayerKill(
            data.killer,
            data.victim,
            data.method
        );

        await tx.wait();
        console.log(`[OraclePublisher] ✅ Kill event published`);

        return true;
    }

    /**
     * Publish achievement/quest completion
     */
    async publishAchievement(data: AchievementData): Promise<boolean> {
        if (!this.enabled || !this.oracleContract) return false;

        console.log(`[OraclePublisher] Publishing achievement: ${data.achievementType} for ${data.player}`);

        const achievementIdBytes32 = ethers.id(data.achievementId);

        const tx = await this.oracleContract.publishAchievement(
            data.player,
            achievementIdBytes32,
            data.achievementType,
            data.value
        );

        await tx.wait();
        console.log(`[OraclePublisher] ✅ Achievement published`);

        return true;
    }

    /**
     * Check rate limit for event publishing
     */
    private checkRateLimit(key: string): boolean {
        const lastTime = this.lastPublishTime.get(key) || 0;
        const now = Date.now();

        if (now - lastTime < this.publishCooldown) {
            return false; // Too soon
        }

        this.lastPublishTime.set(key, now);
        return true;
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    getAddress(): string {
        return this.wallet?.address || '';
    }
}
