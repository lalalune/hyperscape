interface ItemConfig {
    id: number;
    name: string;
    type: string;
    value?: number;
    stackable?: boolean;
    equipable?: boolean;
    slot?: string;
    stats?: any;
}
interface NPCConfig {
    id: number;
    name: string;
    type?: string;
    level?: number;
    combatLevel?: number;
    behavior?: string;
    aggressionRange?: number;
    wanderRadius?: number;
    aggressionLevel?: number;
    dropTable?: string;
    dialogue?: string;
    faction?: string;
    attackSpeed?: number;
    combatStyle?: string;
    stats?: {
        hitpoints?: number;
        attack?: number;
        strength?: number;
        defence?: number;
        speed?: number;
    };
}
interface LootTable {
    id: string;
    name: string;
    drops: Array<{
        itemId: number;
        chance: number;
        minQuantity?: number;
        maxQuantity?: number;
    }>;
}
interface SkillConfig {
    name: string;
    baseExperience: number;
    experienceTable: number[];
}
interface QuestConfig {
    id: number;
    name: string;
    description: string;
    requirements?: any;
    rewards?: any;
    steps?: any[];
}
export declare class ConfigLoader {
    private static instance;
    private configLoaded;
    private npcs;
    private items;
    private lootTables;
    private skills;
    private quests;
    private constructor();
    static getInstance(): ConfigLoader;
    /**
     * Enable test mode with hardcoded data
     */
    enableTestMode(): void;
    /**
     * Load all configurations
     */
    loadAllConfigurations(): Promise<void>;
    /**
     * Load configurations from files
     */
    private loadFromFiles;
    /**
     * Load test data for development and testing
     */
    private loadTestData;
    /**
     * Get NPC configuration by ID
     */
    getNPC(id: number): NPCConfig | null;
    /**
     * Get all NPCs
     */
    getAllNPCs(): {
        [key: number]: NPCConfig;
    };
    /**
     * Get item configuration by ID
     */
    getItem(id: number): ItemConfig | null;
    /**
     * Get all items
     */
    getAllItems(): {
        [key: number]: ItemConfig;
    };
    /**
     * Get loot table by ID
     */
    getLootTable(id: string): LootTable | null;
    /**
     * Get all loot tables
     */
    getAllLootTables(): {
        [key: string]: LootTable;
    };
    /**
     * Get skill configuration by name
     */
    getSkill(name: string): SkillConfig | null;
    /**
     * Get all skills
     */
    getAllSkills(): {
        [key: string]: SkillConfig;
    };
    /**
     * Get quest configuration by ID
     */
    getQuest(id: number): QuestConfig | null;
    /**
     * Get all quests
     */
    getAllQuests(): {
        [key: number]: QuestConfig;
    };
    /**
     * Check if configuration is loaded
     */
    isConfigLoaded(): boolean;
    /**
     * Reload all configurations
     */
    reload(): Promise<void>;
}
export {};
//# sourceMappingURL=ConfigLoader.d.ts.map