/**
 * DialogueSystem - Manages dialogue interactions with characters
 *
 * Handles dialogue trees from Asset Forge, including:
 * - Dialogue session management (one session per player)
 * - Dialogue tree traversal
 * - Condition evaluation (quest status, level, items, flags)
 * - Effect execution (give quest, give item, set flag, give XP/gold)
 * - Response selection and branching
 *
 * Integrates with:
 * - CharacterEntity (dialogue trees)
 * - QuestSystem (quest conditions and effects)
 * - InventorySystem (item conditions and effects)
 * - PlayerEntity (level, flags, XP, gold)
 *
 * @public
 */

import { SystemBase } from './SystemBase';
import type { World } from '../World';
import { EventType } from '../types/events';
import type {
  DialogueTree,
  DialogueTreeNode,
  DialogueResponse,
  DialogueCondition,
  DialogueEffect
} from '../types/core';
import type { CharacterEntity } from '../entities/CharacterEntity';
import type { PlayerEntity } from '../entities/PlayerEntity';

// ============================================================================
// Dialogue Session State
// ============================================================================

interface DialogueSession {
  playerId: string;
  characterId: string;
  dialogueTree: DialogueTree;
  currentNodeId: string;
  history: string[]; // Node IDs visited
  startTime: number;
  lastInteractionTime: number;
}

// ============================================================================
// DialogueSystem Implementation
// ============================================================================

export class DialogueSystem extends SystemBase {
  public readonly name = 'DialogueSystem';

  // Active dialogue sessions (one per player)
  private sessions: Map<string, DialogueSession> = new Map();

  // Session timeout (5 minutes of inactivity)
  private readonly sessionTimeout: number = 5 * 60 * 1000; // ms

  constructor(world: World) {
    super(world);
  }

  public init(): void {
    super.init();

    // Listen for dialogue events
    this.listenToEvent(EventType.DIALOGUE_START, this.onDialogueStart.bind(this));
    this.listenToEvent(EventType.DIALOGUE_ADVANCE, this.onDialogueAdvance.bind(this));
    this.listenToEvent(EventType.DIALOGUE_CHOICE, this.onDialogueChoice.bind(this));
    this.listenToEvent(EventType.DIALOGUE_END, this.onDialogueEnd.bind(this));

    // Listen for character interaction to auto-start dialogue
    this.listenToEvent(EventType.CHARACTER_INTERACTION, this.onCharacterInteraction.bind(this));

    // Cleanup expired sessions every 30 seconds
    if (this.world.isServer) {
      this.world.intervals.push(
        setInterval(() => this.cleanupExpiredSessions(), 30000)
      );
    }
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  private onDialogueStart(data: { playerId: string; characterId: string }): void {
    const { playerId, characterId } = data;

    // Get character entity
    const character = this.world.getEntity(characterId) as CharacterEntity;
    if (!character || !character.dialogueTree) {
      console.warn(`[DialogueSystem] Character ${characterId} has no dialogue tree`);
      return;
    }

    // Get player entity
    const player = this.world.getEntity(playerId) as PlayerEntity;
    if (!player) {
      console.warn(`[DialogueSystem] Player ${playerId} not found`);
      return;
    }

    // Close any existing session for this player
    if (this.sessions.has(playerId)) {
      this.endSession(playerId);
    }

    // Create new dialogue session
    const session: DialogueSession = {
      playerId,
      characterId,
      dialogueTree: character.dialogueTree,
      currentNodeId: character.dialogueTree.entryNodeId,
      history: [],
      startTime: Date.now(),
      lastInteractionTime: Date.now()
    };

    this.sessions.set(playerId, session);

    // Send initial dialogue node to player
    this.sendDialogueNode(session);
  }

  private onDialogueAdvance(data: { playerId: string }): void {
    const { playerId } = data;

    const session = this.sessions.get(playerId);
    if (!session) {
      console.warn(`[DialogueSystem] No active dialogue session for player ${playerId}`);
      return;
    }

    // Update last interaction time
    session.lastInteractionTime = Date.now();

    // Get current node
    const currentNode = this.findNode(session.dialogueTree, session.currentNodeId);
    if (!currentNode) {
      console.warn(`[DialogueSystem] Node ${session.currentNodeId} not found`);
      this.endSession(playerId);
      return;
    }

    // If node has only one response, automatically advance to it
    if (currentNode.responses.length === 1) {
      const response = currentNode.responses[0];
      this.handleResponse(session, response);
    } else {
      // Node has multiple responses, wait for player choice
      // Just refresh the current node
      this.sendDialogueNode(session);
    }
  }

  private onDialogueChoice(data: { playerId: string; responseIndex: number }): void {
    const { playerId, responseIndex } = data;

    const session = this.sessions.get(playerId);
    if (!session) {
      console.warn(`[DialogueSystem] No active dialogue session for player ${playerId}`);
      return;
    }

    // Update last interaction time
    session.lastInteractionTime = Date.now();

    // Get current node
    const currentNode = this.findNode(session.dialogueTree, session.currentNodeId);
    if (!currentNode) {
      console.warn(`[DialogueSystem] Node ${session.currentNodeId} not found`);
      this.endSession(playerId);
      return;
    }

    // Validate response index
    if (responseIndex < 0 || responseIndex >= currentNode.responses.length) {
      console.warn(`[DialogueSystem] Invalid response index ${responseIndex}`);
      return;
    }

    // Handle the selected response
    const response = currentNode.responses[responseIndex];
    this.handleResponse(session, response);
  }

  private onDialogueEnd(data: { playerId: string }): void {
    const { playerId } = data;
    this.endSession(playerId);
  }

  private onCharacterInteraction(data: {
    playerId: string;
    characterId: string;
    interactionType: string
  }): void {
    const { playerId, characterId, interactionType } = data;

    // Only auto-start dialogue for 'talk' interactions
    if (interactionType !== 'talk') {
      return;
    }

    // Start dialogue session
    this.onDialogueStart({ playerId, characterId });
  }

  // ============================================================================
  // Dialogue Tree Traversal
  // ============================================================================

  private handleResponse(session: DialogueSession, response: DialogueResponse): void {
    const player = this.world.getEntity(session.playerId) as PlayerEntity;
    if (!player) {
      this.endSession(session.playerId);
      return;
    }

    // Add current node to history
    session.history.push(session.currentNodeId);

    // Execute response effects
    if (response.effects) {
      for (const effect of response.effects) {
        this.executeEffect(player, effect);
      }
    }

    // Check if response leads to another node
    if (response.nextNodeId) {
      // Move to next node
      session.currentNodeId = response.nextNodeId;
      this.sendDialogueNode(session);
    } else {
      // No next node - end dialogue
      this.endSession(session.playerId);
    }
  }

  private sendDialogueNode(session: DialogueSession): void {
    const currentNode = this.findNode(session.dialogueTree, session.currentNodeId);
    if (!currentNode) {
      console.warn(`[DialogueSystem] Node ${session.currentNodeId} not found`);
      this.endSession(session.playerId);
      return;
    }

    const player = this.world.getEntity(session.playerId) as PlayerEntity;
    if (!player) {
      this.endSession(session.playerId);
      return;
    }

    // Filter responses based on conditions
    const availableResponses = currentNode.responses.filter(response =>
      this.checkResponseConditions(player, response)
    );

    // If no responses are available, end dialogue
    if (availableResponses.length === 0) {
      console.warn(`[DialogueSystem] No available responses for node ${session.currentNodeId}`);
      this.endSession(session.playerId);
      return;
    }

    // Execute node effects (effects that trigger when entering a node)
    if (currentNode.effects) {
      for (const effect of currentNode.effects) {
        this.executeEffect(player, effect);
      }
    }

    // Send dialogue node to client
    this.emitTypedEvent(EventType.DIALOGUE_START, {
      playerId: session.playerId,
      characterId: session.characterId,
      nodeId: session.currentNodeId,
      text: currentNode.text,
      responses: availableResponses.map((response, index) => ({
        index,
        text: response.text,
        icon: response.icon
      })),
      characterName: (this.world.getEntity(session.characterId) as CharacterEntity)?.name
    });
  }

  // ============================================================================
  // Condition Evaluation
  // ============================================================================

  private checkResponseConditions(
    player: PlayerEntity,
    response: DialogueResponse
  ): boolean {
    if (!response.conditions || response.conditions.length === 0) {
      return true; // No conditions = always available
    }

    // ALL conditions must be true
    return response.conditions.every(condition =>
      this.evaluateCondition(player, condition)
    );
  }

  private evaluateCondition(player: PlayerEntity, condition: DialogueCondition): boolean {
    switch (condition.type) {
      case 'HAS_QUEST':
        return this.checkHasQuest(player, condition);

      case 'QUEST_COMPLETE':
        return this.checkQuestComplete(player, condition);

      case 'LEVEL_REQUIREMENT':
        return this.checkLevelRequirement(player, condition);

      case 'HAS_ITEM':
        return this.checkHasItem(player, condition);

      case 'FLAG_SET':
        return this.checkFlagSet(player, condition);

      case 'FACTION_REPUTATION':
        return this.checkFactionReputation(player, condition);

      case 'GOLD_REQUIREMENT':
        return this.checkGoldRequirement(player, condition);

      default:
        console.warn(`[DialogueSystem] Unknown condition type: ${(condition as DialogueCondition).type}`);
        return false;
    }
  }

  private checkHasQuest(player: PlayerEntity, condition: DialogueCondition): boolean {
    if (condition.type !== 'HAS_QUEST') return false;

    // Check if player has the specified quest
    // This requires QuestSystem integration
    const questId = condition.questId;
    const questStatus = (player as { quests?: Map<string, { status: string }> }).quests?.get(questId);

    return questStatus?.status === 'active';
  }

  private checkQuestComplete(player: PlayerEntity, condition: DialogueCondition): boolean {
    if (condition.type !== 'QUEST_COMPLETE') return false;

    // Check if player completed the specified quest
    const questId = condition.questId;
    const questStatus = (player as { quests?: Map<string, { status: string }> }).quests?.get(questId);

    return questStatus?.status === 'completed';
  }

  private checkLevelRequirement(player: PlayerEntity, condition: DialogueCondition): boolean {
    if (condition.type !== 'LEVEL_REQUIREMENT') return false;

    const playerLevel = player.level || 1;
    const requiredLevel = condition.level || 1;

    return playerLevel >= requiredLevel;
  }

  private checkHasItem(player: PlayerEntity, condition: DialogueCondition): boolean {
    if (condition.type !== 'HAS_ITEM') return false;

    // Check if player has the specified item
    // This requires InventorySystem integration
    const itemId = condition.itemId;
    const quantity = condition.quantity || 1;

    const playerInventory = (player as { inventory?: Array<{ itemId: string; quantity: number }> }).inventory;
    if (!playerInventory) return false;

    const item = playerInventory.find(i => i.itemId === itemId);
    return item ? item.quantity >= quantity : false;
  }

  private checkFlagSet(player: PlayerEntity, condition: DialogueCondition): boolean {
    if (condition.type !== 'FLAG_SET') return false;

    // Check if player has the specified flag set
    const flagName = condition.flag;
    const expectedValue = condition.value !== undefined ? condition.value : true;

    const playerFlags = (player as { flags?: Map<string, boolean | string | number> }).flags;
    if (!playerFlags) return false;

    return playerFlags.get(flagName) === expectedValue;
  }

  private checkFactionReputation(player: PlayerEntity, condition: DialogueCondition): boolean {
    if (condition.type !== 'FACTION_REPUTATION') return false;

    // Check if player has minimum reputation with faction
    const faction = condition.faction;
    const minReputation = condition.minReputation || 0;

    const playerFactions = (player as { factions?: Map<string, number> }).factions;
    if (!playerFactions) return false;

    const reputation = playerFactions.get(faction) || 0;
    return reputation >= minReputation;
  }

  private checkGoldRequirement(player: PlayerEntity, condition: DialogueCondition): boolean {
    if (condition.type !== 'GOLD_REQUIREMENT') return false;

    const requiredGold = condition.gold || 0;
    const playerGold = (player as { gold?: number }).gold || 0;

    return playerGold >= requiredGold;
  }

  // ============================================================================
  // Effect Execution
  // ============================================================================

  private executeEffect(player: PlayerEntity, effect: DialogueEffect): void {
    switch (effect.type) {
      case 'ACCEPT_QUEST':
        this.executeAcceptQuest(player, effect);
        break;

      case 'COMPLETE_QUEST':
        this.executeCompleteQuest(player, effect);
        break;

      case 'GIVE_ITEM':
        this.executeGiveItem(player, effect);
        break;

      case 'TAKE_ITEM':
        this.executeTakeItem(player, effect);
        break;

      case 'SET_FLAG':
        this.executeSetFlag(player, effect);
        break;

      case 'GIVE_XP':
        this.executeGiveXP(player, effect);
        break;

      case 'GIVE_GOLD':
        this.executeGiveGold(player, effect);
        break;

      case 'MODIFY_REPUTATION':
        this.executeModifyReputation(player, effect);
        break;

      default:
        console.warn(`[DialogueSystem] Unknown effect type: ${(effect as DialogueEffect).type}`);
        break;
    }
  }

  private executeAcceptQuest(player: PlayerEntity, effect: DialogueEffect): void {
    if (effect.type !== 'ACCEPT_QUEST') return;

    // Emit quest accept event for QuestSystem to handle
    this.emitTypedEvent(EventType.QUEST_ACCEPT_REQUEST, {
      playerId: player.id,
      questId: effect.questId
    });
  }

  private executeCompleteQuest(player: PlayerEntity, effect: DialogueEffect): void {
    if (effect.type !== 'COMPLETE_QUEST') return;

    // Emit quest complete event for QuestSystem to handle
    this.emitTypedEvent(EventType.QUEST_COMPLETE_REQUEST, {
      playerId: player.id,
      questId: effect.questId
    });
  }

  private executeGiveItem(player: PlayerEntity, effect: DialogueEffect): void {
    if (effect.type !== 'GIVE_ITEM') return;

    // Emit item give event for InventorySystem to handle
    this.emitTypedEvent(EventType.ITEM_GIVE_REQUEST, {
      playerId: player.id,
      itemId: effect.itemId,
      quantity: effect.quantity || 1
    });
  }

  private executeTakeItem(player: PlayerEntity, effect: DialogueEffect): void {
    if (effect.type !== 'TAKE_ITEM') return;

    // Emit item take event for InventorySystem to handle
    this.emitTypedEvent(EventType.ITEM_TAKE_REQUEST, {
      playerId: player.id,
      itemId: effect.itemId,
      quantity: effect.quantity || 1
    });
  }

  private executeSetFlag(player: PlayerEntity, effect: DialogueEffect): void {
    if (effect.type !== 'SET_FLAG') return;

    // Set flag on player directly (server only)
    if (!this.world.isServer) return;

    const flags = (player as { flags?: Map<string, boolean | string | number> }).flags
      || new Map();

    flags.set(effect.flag, effect.value !== undefined ? effect.value : true);
    (player as { flags?: Map<string, boolean | string | number> }).flags = flags;

    // Mark player as network dirty to sync flag change
    player.markNetworkDirty();
  }

  private executeGiveXP(player: PlayerEntity, effect: DialogueEffect): void {
    if (effect.type !== 'GIVE_XP') return;

    // Emit XP gain event for XP system to handle
    this.emitTypedEvent(EventType.PLAYER_XP_GAINED, {
      playerId: player.id,
      xp: effect.xp || 0
    });
  }

  private executeGiveGold(player: PlayerEntity, effect: DialogueEffect): void {
    if (effect.type !== 'GIVE_GOLD') return;

    // Give gold to player directly (server only)
    if (!this.world.isServer) return;

    const currentGold = (player as { gold?: number }).gold || 0;
    (player as { gold?: number }).gold = currentGold + (effect.gold || 0);

    // Mark player as network dirty to sync gold change
    player.markNetworkDirty();
  }

  private executeModifyReputation(player: PlayerEntity, effect: DialogueEffect): void {
    if (effect.type !== 'MODIFY_REPUTATION') return;

    // Modify player's reputation with faction (server only)
    if (!this.world.isServer) return;

    const factions = (player as { factions?: Map<string, number> }).factions
      || new Map();

    const currentRep = factions.get(effect.faction) || 0;
    factions.set(effect.faction, currentRep + (effect.amount || 0));
    (player as { factions?: Map<string, number> }).factions = factions;

    // Mark player as network dirty to sync reputation change
    player.markNetworkDirty();
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  private endSession(playerId: string): void {
    const session = this.sessions.get(playerId);
    if (!session) return;

    // Send dialogue end event to client
    this.emitTypedEvent(EventType.DIALOGUE_END, {
      playerId: session.playerId,
      characterId: session.characterId
    });

    // Remove session
    this.sessions.delete(playerId);
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();

    for (const [playerId, session] of this.sessions.entries()) {
      const timeSinceLastInteraction = now - session.lastInteractionTime;

      if (timeSinceLastInteraction > this.sessionTimeout) {
        console.log(`[DialogueSystem] Session expired for player ${playerId}`);
        this.endSession(playerId);
      }
    }
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private findNode(tree: DialogueTree, nodeId: string): DialogueTreeNode | null {
    return tree.nodes.find(node => node.id === nodeId) || null;
  }

  /**
   * Get active dialogue session for a player
   */
  public getSession(playerId: string): DialogueSession | undefined {
    return this.sessions.get(playerId);
  }

  /**
   * Check if player has an active dialogue session
   */
  public hasActiveSession(playerId: string): boolean {
    return this.sessions.has(playerId);
  }

  /**
   * Force end a dialogue session
   */
  public forceEndSession(playerId: string): void {
    this.endSession(playerId);
  }

  // ============================================================================
  // System Lifecycle
  // ============================================================================

  public destroy(): void {
    // End all active sessions
    for (const playerId of this.sessions.keys()) {
      this.endSession(playerId);
    }

    this.sessions.clear();

    super.destroy();
  }
}
