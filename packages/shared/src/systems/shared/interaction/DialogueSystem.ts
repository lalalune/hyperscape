/**
 * DialogueSystem - Handles NPC dialogue trees
 *
 * Features:
 * - Processes dialogue trees from npcs.json
 * - Manages dialogue state per player
 * - Executes effects (openBank, startQuest, etc.)
 * - Sends dialogue packets to clients
 */

import type { World } from "../../../core/World";
import { EventType } from "../../../types/events";
import { SystemBase } from "..";
import { ALL_NPCS, getNPCById } from "../../../data/npcs";
import type {
  NPCDialogueTree,
  NPCDialogueNode,
  NPCDialogueResponse,
} from "../../../types/entities/npc-mob-types";

interface DialogueState {
  npcId: string;
  npcName: string;
  dialogueTree: NPCDialogueTree;
  currentNodeId: string;
  npcEntityId?: string;
}

/**
 * DialogueSystem
 * Manages NPC dialogue interactions using dialogue trees from npcs.json
 */
export class DialogueSystem extends SystemBase {
  // Active dialogues per player
  private activeDialogues = new Map<string, DialogueState>();

  constructor(world: World) {
    super(world, {
      name: "dialogue",
      dependencies: {
        required: [],
        optional: ["npc", "banking", "store"],
      },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
    // Subscribe to NPC interaction events
    this.subscribe(
      EventType.NPC_INTERACTION,
      (data: {
        playerId: string;
        npcId: string;
        npc: { id: string; name: string; type: string };
        npcEntityId?: string;
      }) => {
        this.handleNPCInteraction(data);
      },
    );

    // Subscribe to dialogue response events (from client)
    this.subscribe(
      EventType.DIALOGUE_RESPONSE,
      (data: {
        playerId: string;
        npcId: string;
        responseIndex: number;
        nextNodeId: string;
        effect?: string;
      }) => {
        this.handleDialogueResponse(data);
      },
    );
  }

  /**
   * Handle NPC interaction - start dialogue if NPC has dialogue tree
   */
  private handleNPCInteraction(data: {
    playerId: string;
    npcId: string;
    npc: { id: string; name: string; type: string };
    npcEntityId?: string;
  }): void {
    const { playerId, npc, npcEntityId } = data;

    // Look up NPC data from manifest
    const npcData = getNPCById(npc.id);

    if (!npcData || !npcData.dialogue) {
      // No dialogue tree - fall back to legacy NPC handling
      // The NPCSystem will handle this via its own subscription
      return;
    }

    // Start dialogue (pass npcEntityId for distance checking on client)
    this.startDialogue(
      playerId,
      npc.id,
      npc.name,
      npcData.dialogue,
      npcEntityId,
    );
  }

  /**
   * Start a dialogue with an NPC
   */
  private startDialogue(
    playerId: string,
    npcId: string,
    npcName: string,
    dialogueTree: NPCDialogueTree,
    npcEntityId?: string,
  ): void {
    // Find entry node
    const entryNode = dialogueTree.nodes.find(
      (node) => node.id === dialogueTree.entryNodeId,
    );
    if (!entryNode) {
      this.logger.error(
        `Dialogue tree for ${npcId} has invalid entryNodeId: ${dialogueTree.entryNodeId}`,
      );
      return;
    }

    // Store dialogue state (include npcEntityId for distance checking)
    this.activeDialogues.set(playerId, {
      npcId,
      npcName,
      dialogueTree,
      currentNodeId: entryNode.id,
      npcEntityId,
    });

    // Send dialogue start to client (include npcEntityId)
    this.sendDialogueNode(
      playerId,
      npcId,
      npcName,
      entryNode,
      true,
      npcEntityId,
    );
  }

  /**
   * Handle player selecting a dialogue response
   *
   * SECURITY: Server determines nextNodeId and effect from its own dialogue state.
   * The client only sends responseIndex - we NEVER trust client-provided
   * nextNodeId or effect values to prevent dialogue skipping exploits.
   */
  private handleDialogueResponse(data: {
    playerId: string;
    npcId: string;
    responseIndex: number;
    // NOTE: nextNodeId and effect are intentionally NOT accepted from client
    // Server computes these from dialogue state based on responseIndex
  }): void {
    const { playerId, npcId, responseIndex } = data;

    const state = this.activeDialogues.get(playerId);
    if (!state || state.npcId !== npcId) {
      this.logger.warn(
        `No active dialogue for player ${playerId} with NPC ${npcId}`,
      );
      return;
    }

    // Get current node from SERVER state
    const currentNode = state.dialogueTree.nodes.find(
      (node) => node.id === state.currentNodeId,
    );
    if (
      !currentNode ||
      !currentNode.responses ||
      currentNode.responses.length === 0
    ) {
      this.logger.warn(`Current node ${state.currentNodeId} has no responses`);
      this.endDialogue(playerId, npcId);
      return;
    }

    // Validate responseIndex is in bounds (SECURITY: prevent array out-of-bounds)
    if (responseIndex < 0 || responseIndex >= currentNode.responses.length) {
      this.logger.warn(
        `Invalid responseIndex ${responseIndex} for node with ${currentNode.responses.length} responses`,
      );
      return;
    }

    // SERVER determines nextNodeId and effect from the selected response
    const selectedResponse = currentNode.responses[responseIndex];
    const nextNodeId = selectedResponse.nextNodeId;
    const effect = selectedResponse.effect;

    // Execute effect if present (now from SERVER data, not client)
    if (effect) {
      this.executeEffect(playerId, npcId, effect, state.npcEntityId);
    }

    // Find next node (using SERVER-determined nextNodeId)
    const nextNode = state.dialogueTree.nodes.find(
      (node) => node.id === nextNodeId,
    );
    if (!nextNode) {
      // End dialogue if no next node
      this.endDialogue(playerId, npcId);
      return;
    }

    // Update state
    state.currentNodeId = nextNodeId;

    // Check if this node has responses
    if (!nextNode.responses || nextNode.responses.length === 0) {
      // Send final node text then end dialogue
      this.sendDialogueNode(playerId, npcId, state.npcName, nextNode, false);
      // Auto-end after a brief moment (client will handle timing)
      this.endDialogue(playerId, npcId);
    } else {
      // Continue dialogue
      this.sendDialogueNode(playerId, npcId, state.npcName, nextNode, false);
    }
  }

  /**
   * Send dialogue node to client
   * Emits events that EventBridge forwards to the client via network packets
   */
  private sendDialogueNode(
    playerId: string,
    npcId: string,
    npcName: string,
    node: NPCDialogueNode,
    isStart: boolean,
    npcEntityId?: string,
  ): void {
    const responses = (node.responses || []).map((r) => ({
      text: r.text,
      nextNodeId: r.nextNodeId,
      effect: r.effect,
    }));

    if (isStart) {
      this.emitTypedEvent(EventType.DIALOGUE_START, {
        playerId,
        npcId,
        npcName,
        nodeId: node.id,
        text: node.text,
        responses,
        npcEntityId,
      });
    } else {
      this.emitTypedEvent(EventType.DIALOGUE_NODE_CHANGE, {
        playerId,
        npcId,
        nodeId: node.id,
        text: node.text,
        responses,
      });
    }
    // EventBridge handles forwarding these events to the client via network packets
  }

  /**
   * End a dialogue
   * Emits event that EventBridge forwards to the client via network packet
   */
  private endDialogue(playerId: string, npcId: string): void {
    this.activeDialogues.delete(playerId);

    this.emitTypedEvent(EventType.DIALOGUE_END, {
      playerId,
      npcId,
    });
    // EventBridge handles forwarding this event to the client via network packet
  }

  /**
   * Execute a dialogue effect
   */
  private executeEffect(
    playerId: string,
    npcId: string,
    effect: string,
    npcEntityId?: string,
  ): void {
    this.logger.info(
      `Executing dialogue effect: ${effect} for player ${playerId}`,
    );

    // Parse effect - format is "effectName" or "effectName:param1:param2"
    const [effectName, ...params] = effect.split(":");

    switch (effectName) {
      case "openBank":
        this.emitTypedEvent(EventType.BANK_OPEN_REQUEST, {
          playerId,
          npcId,
          npcEntityId, // Pass entity ID for distance checking
        });
        break;

      case "openShop":
      case "openStore":
        this.emitTypedEvent(EventType.STORE_OPEN_REQUEST, {
          playerId,
          npcId,
          npcEntityId, // Pass entity ID for distance checking
        });
        break;

      case "startQuest":
        // Future: implement quest system integration
        this.logger.info(
          `TODO: Start quest ${params[0]} for player ${playerId}`,
        );
        break;

      default:
        this.logger.warn(`Unknown dialogue effect: ${effectName}`);
    }
  }

  /**
   * Check if player is in a dialogue
   */
  public isInDialogue(playerId: string): boolean {
    return this.activeDialogues.has(playerId);
  }

  /**
   * Get active dialogue state for a player
   */
  public getDialogueState(playerId: string): DialogueState | undefined {
    return this.activeDialogues.get(playerId);
  }
}
