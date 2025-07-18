import { World } from '@hyperfy/sdk';
interface DialogueNode {
    id: string;
    text: string;
    options?: DialogueOption[];
    action?: () => void;
    condition?: () => boolean;
}
interface DialogueOption {
    text: string;
    nextNode: string;
    condition?: () => boolean;
    action?: () => void;
}
export declare class NPCDialogueManager {
    private world;
    private sessions;
    private dialogues;
    constructor(world: World);
    /**
     * Update dialogue sessions
     */
    update(_delta: number): void;
    /**
     * Start dialogue between player and NPC
     */
    startDialogue(playerId: string, npcId: string): void;
    /**
     * Handle player dialogue choice
     */
    handleChoice(playerId: string, optionIndex: number): void;
    /**
     * End dialogue session
     */
    endDialogue(playerId: string): void;
    /**
     * Send dialogue node to player
     */
    private sendDialogueNode;
    /**
     * Register dialogue for an NPC
     */
    registerDialogue(npcId: string, dialogues: Map<string, DialogueNode>): void;
    /**
     * Get dialogue node
     */
    private getDialogue;
    /**
     * Get NPC entity
     */
    private getNPC;
    /**
     * Send message to player
     */
    private sendMessage;
    /**
     * Register default dialogues
     */
    private registerDefaultDialogues;
}
export {};
//# sourceMappingURL=NPCDialogueManager.d.ts.map