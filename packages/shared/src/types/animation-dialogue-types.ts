/**
 * Dialogue Types
 * All dialogue system related type definitions
 *
 * Note: AnimationTask is defined in combat-types.ts since animations are primarily used for combat
 */

// ============== DIALOGUE TYPES ==============

/**
 * DialogueSession - tracks an active dialogue between a player and NPC
 */
export interface DialogueSession {
  playerId: string;
  npcId: string;
  currentNode: string;
  startTime: number;
  variables: Map<string, unknown>;
}

/**
 * DialogueNode - a single node in a dialogue tree
 */
export interface DialogueNode {
  id: string;
  text: string;
  options?: DialogueOption[];
  action?: () => void;
  condition?: () => boolean;
}

/**
 * DialogueOption - an option the player can select in a dialogue
 */
export interface DialogueOption {
  text: string;
  nextNode: string;
  condition?: () => boolean;
  action?: () => void;
}
