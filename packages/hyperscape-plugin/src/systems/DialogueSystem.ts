/**
 * DialogueSystem - Handles NPC dialogue trees
 *
 * Features:
 * - Processes dialogue trees from npcs.json
 * - Manages dialogue state per player
 * - Executes effects (openBank, startQuest, etc.)
 * - Sends dialogue packets to clients
 */

// Migrated 2026-04-25 from `packages/shared/src/systems/shared/interaction/`
// into `@hyperforge/hyperscape` (17th system migration; 5th
// cross-cutting server-side after CoinPouch + Prayer + Banking +
// Store). tile-based-MMORPG-style NPC dialogue trees with effects (openBank,
// startQuest, …) and authored-dialogue runner.
//
// In-shared consumers (`PIEEditorSession`,
// `WorldDialogueConditionEvaluators`) duck-type the surface they
// need via local `DialogueSystemLike` interfaces.
import {
  DialogueRegistry,
  type DialogueContext,
  type DialoguePresentation,
  EventType,
  getNPCById,
  LocalizationCatalog,
  type NPCDialogueNode,
  type NPCDialogueTree,
  SystemBase,
  type World,
} from "@hyperforge/shared";
// isValidQuestId migrated to plugin types 2026-04-27 (top-10 #8 cleanup).
import { isValidQuestId } from "../types/quest-types.js";
import type { DialogueManifest } from "@hyperforge/manifest-schema";

interface DialogueState {
  npcId: string;
  npcName: string;
  dialogueTree: NPCDialogueTree;
  currentNodeId: string;
  npcEntityId?: string;
  pendingEffect?: string; // Effect to execute when player continues from terminal node
  isTerminal?: boolean; // Whether current node is terminal (no responses)
}

/**
 * Authored-path session tracking. Parallel to `DialogueState` — the
 * authored registry owns the runner + presentation state, this struct
 * only remembers which NPC the player is talking to so DIALOGUE_RESPONSE
 * and DIALOGUE_CONTINUE events can be routed back to the correct session.
 */
interface AuthoredDialogueState {
  npcId: string;
  npcName: string;
  treeId: string;
  npcEntityId?: string;
}

/**
 * Arguments supplied to every authored-dialogue predicate. Predicates
 * typically query player/world state; the concrete player/npc ids are
 * threaded through so the evaluator can resolve the right entity.
 */
export interface DialogueConditionArgs {
  readonly playerId: string;
  readonly npcId: string;
  readonly npcEntityId?: string;
}

/**
 * Predicate invoked by the authored-dialogue runner to evaluate a
 * `showIf` / branch `condition` name. Returning `true` exposes the
 * gated option / takes the true branch; `false` hides it.
 */
export type DialogueConditionEvaluator = (
  args: DialogueConditionArgs,
) => boolean;

/**
 * DialogueSystem
 * Manages NPC dialogue interactions using dialogue trees from npcs.json
 */
export class DialogueSystem extends SystemBase {
  // Active dialogues per player (legacy NPCDialogueTree path)
  private activeDialogues = new Map<string, DialogueState>();

  /**
   * Authored dialogue registry for the `@hyperforge/manifest-schema`
   * `DialogueManifest` shape. Populated by `setAuthoredDialogues()`
   * (typically from `PIEEditorSession.updateManifests({ dialogue })`
   * or server-boot DataManager wiring). Queried by future callers
   * that bind an NPC to an authored tree id; the legacy npcs.json
   * path is unaffected while this registry is empty.
   */
  private readonly authoredDialogues = new DialogueRegistry();

  // Active authored sessions per player. Existence in this map means the
  // player is in an authored-path dialogue; DIALOGUE_RESPONSE/CONTINUE
  // events should be routed to the authored registry rather than the
  // legacy NPCDialogueTree.
  private readonly authoredSessions = new Map<string, AuthoredDialogueState>();

  // Optional localization catalog. When set, authored-path `textKey`
  // strings are resolved through `catalog.resolveTemplate(key)` before
  // being emitted as `text`. When null, the raw textKey is echoed to
  // preserve existing editor-loop behavior for unlocalized trees.
  private localizationCatalog: LocalizationCatalog | null = null;

  // Predicate registry for authored dialogue `showIf` / branch conditions.
  // Unknown predicate names evaluate to `false` — a safe default that hides
  // gated choices rather than exposing them by accident. Populated via
  // `registerConditionEvaluator`; cleared via `clearConditionEvaluators`.
  private readonly conditionEvaluators = new Map<
    string,
    DialogueConditionEvaluator
  >();

  private isImmediateHandoffEffect(effect?: string): boolean {
    if (!effect) {
      return false;
    }

    const [effectName] = effect.split(":");
    return (
      effectName === "openBank" ||
      effectName === "openShop" ||
      effectName === "openStore" ||
      effectName === "openTanner"
    );
  }

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

    // Subscribe to dialogue continue events (from client on terminal nodes)
    this.subscribe(
      EventType.DIALOGUE_CONTINUE,
      (data: { playerId: string; npcId: string }) => {
        this.handleDialogueContinue(data);
      },
    );

    // Subscribe to dialogue end events (from dialogueClose handler when player clicks X)
    // This cleans up state WITHOUT executing pending effects
    this.subscribe(
      EventType.DIALOGUE_END,
      (data: { playerId: string; npcId: string }) => {
        // Only clean up if this came from external source (dialogueClose handler)
        // Our own endDialogue also emits this, but after we've already cleaned up
        const state = this.activeDialogues.get(data.playerId);
        if (state && state.npcId === data.npcId) {
          // Don't execute pending effect - player explicitly closed dialogue
          this.activeDialogues.delete(data.playerId);
        }
        // Authored path — close the runner session and drop our state if
        // the close event targets the NPC the player is actually talking
        // to. Matches the legacy-path semantics above.
        const authored = this.authoredSessions.get(data.playerId);
        if (authored && authored.npcId === data.npcId) {
          this.authoredDialogues.closeSession(data.playerId);
          this.authoredSessions.delete(data.playerId);
        }
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

    // Authored dialogue wins when a binding + loaded tree exist. This
    // lets editors override legacy `npcs.json` dialogue without touching
    // the manifest. `resolveAuthoredTreeIdForNpc` returns `null` for
    // stale bindings (binding present but tree unloaded) so we safely
    // fall back to the legacy path in that case.
    const authoredTreeId = this.resolveAuthoredTreeIdForNpc(npc.id);
    if (authoredTreeId !== null) {
      this.startAuthoredDialogue(
        playerId,
        npc.id,
        npc.name,
        authoredTreeId,
        npcEntityId,
      );
      return;
    }

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
    // Determine entry node ID, considering quest overrides
    let entryNodeId = dialogueTree.entryNodeId;

    // Check for quest-based entry node overrides
    if (dialogueTree.questOverrides) {
      const questSystem = this.world.getSystem("quest") as {
        getQuestStatus?: (
          playerId: string,
          questId: string,
        ) => "not_started" | "in_progress" | "ready_to_complete" | "completed";
      };

      if (questSystem?.getQuestStatus) {
        // Check each quest's status and use override if available
        for (const [questId, overrides] of Object.entries(
          dialogueTree.questOverrides,
        )) {
          const status = questSystem.getQuestStatus(playerId, questId);

          // Priority: ready_to_complete > in_progress > completed > default
          if (status === "ready_to_complete" && overrides.ready_to_complete) {
            entryNodeId = overrides.ready_to_complete;
            break; // Use first matching quest override
          } else if (status === "in_progress" && overrides.in_progress) {
            entryNodeId = overrides.in_progress;
            break;
          } else if (status === "completed" && overrides.completed) {
            entryNodeId = overrides.completed;
            break;
          }
        }
      }
    }

    // Find entry node
    const entryNode = dialogueTree.nodes.find(
      (node) => node.id === entryNodeId,
    );
    if (!entryNode) {
      this.logger.error(
        `Dialogue tree for ${npcId} has invalid entryNodeId: ${entryNodeId}`,
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

    // Check if entry node is terminal (no responses)
    if (!entryNode.responses || entryNode.responses.length === 0) {
      // Store pending effect for terminal node - will execute when player clicks continue
      const state = this.activeDialogues.get(playerId);
      if (state && entryNode.effect) {
        state.pendingEffect = entryNode.effect;
        state.isTerminal = true;
        this.logger.info(
          `[DialogueSystem] Terminal entry node ${entryNode.id} has pending effect: ${entryNode.effect}`,
        );
      } else if (state) {
        state.isTerminal = true;
      }
      // Don't end dialogue yet - wait for player to click continue
    }
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

    // Authored sessions take precedence — when a player is in an authored
    // conversation, `responseIndex` maps to the presentation's `originalIndex`
    // (VisibleChoice.originalIndex, not a filtered position). The authored
    // runner validates bounds and throws on hidden-option picks; we catch
    // and end the session rather than crash the server.
    const authored = this.authoredSessions.get(playerId);
    if (authored && authored.npcId === npcId) {
      this.handleAuthoredDialogueResponse(playerId, responseIndex);
      return;
    }

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

    // Service panel handoff responses should end the dialogue immediately.
    // These are not real conversational branches; the next UI owns the flow.
    if (effect && this.isImmediateHandoffEffect(effect)) {
      this.executeEffect(playerId, npcId, effect, state.npcEntityId);
      this.endDialogue(playerId, npcId);
      return;
    }

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

    const nextNodeIsTerminal =
      !nextNode.responses || nextNode.responses.length === 0;

    // Update state
    state.currentNodeId = nextNodeId;

    // Check if this node has responses
    if (nextNodeIsTerminal) {
      // Terminal node - store pending effect instead of executing immediately
      // Effect will execute when player clicks continue
      if (nextNode.effect) {
        state.pendingEffect = nextNode.effect;
        this.logger.info(
          `[DialogueSystem] Terminal node ${nextNode.id} has pending effect: ${nextNode.effect}`,
        );
      } else {
        this.logger.info(
          `[DialogueSystem] Terminal node ${nextNode.id} has no effect`,
        );
      }
      state.isTerminal = true;
      // Send final node text - don't end dialogue yet, wait for player continue
      this.sendDialogueNode(playerId, npcId, state.npcName, nextNode, false);
    } else {
      // Continue dialogue
      this.sendDialogueNode(playerId, npcId, state.npcName, nextNode, false);
    }
  }

  /**
   * Handle player clicking "continue" on a terminal dialogue node
   * This executes any pending effects and ends the dialogue
   */
  private handleDialogueContinue(data: {
    playerId: string;
    npcId: string;
  }): void {
    const { playerId, npcId } = data;

    // Authored sessions: continue advances the runner past a `line`/`end`
    // presentation. The presentation dictates whether we emit NODE_CHANGE
    // (next visible node) or DIALOGUE_END (conversation terminated).
    const authored = this.authoredSessions.get(playerId);
    if (authored && authored.npcId === npcId) {
      this.handleAuthoredDialogueContinue(playerId);
      return;
    }

    const state = this.activeDialogues.get(playerId);
    if (!state || state.npcId !== npcId) {
      // No active dialogue or wrong NPC - just ignore
      return;
    }

    // Execute pending effect if present
    if (state.pendingEffect) {
      this.logger.info(
        `[DialogueSystem] Executing pending effect on continue: ${state.pendingEffect}`,
      );
      this.executeEffect(
        playerId,
        npcId,
        state.pendingEffect,
        state.npcEntityId,
      );
    }

    // End the dialogue
    this.endDialogue(playerId, npcId);
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

  // =========================================================================
  // Authored dialogue — wire-protocol translator
  //
  // Bridges the authored `DialogueRegistry` (manifest-schema shapes) into the
  // legacy `DIALOGUE_START`/`DIALOGUE_NODE_CHANGE`/`DIALOGUE_END` event shape
  // that the existing client + EventBridge understand. Localization keys are
  // passed through as the `text`/response `text` fields — the UI is
  // responsible for catalog resolution. `text` resolution to the translation
  // catalog is a follow-up slice; for now the UI receives the raw textKey
  // which is sufficient for editor-loop verification.
  // =========================================================================

  /**
   * Build a DialogueContext for a given player. Unknown conditions evaluate
   * to `false` (conservative — hides gated choices until a condition
   * evaluator is wired). Actions are forwarded to the existing effect
   * dispatcher so authored choice-actions land on the same listeners as
   * legacy dialogue effects.
   */
  private buildAuthoredContext(
    playerId: string,
    npcId: string,
    npcEntityId: string | undefined,
  ): DialogueContext {
    const condArgs: DialogueConditionArgs = { playerId, npcId, npcEntityId };
    return {
      evaluateCondition: (name: string) => {
        const fn = this.conditionEvaluators.get(name);
        if (fn === undefined) {
          // Unknown predicate → false. Safe default: a missing evaluator
          // should hide the gated choice rather than expose it.
          this.logger.warn(
            `[DialogueSystem] unknown dialogue condition "${name}" — returning false`,
          );
          return false;
        }
        try {
          return fn(condArgs);
        } catch (err) {
          this.logger.warn(
            `[DialogueSystem] condition "${name}" threw — treating as false: ${err instanceof Error ? err.message : String(err)}`,
          );
          return false;
        }
      },
      executeAction: (name: string, _params) => {
        // Empty string means "no action" — runner already filters it, but
        // guard here too so we never dispatch an empty effect.
        if (name === "") return;
        this.executeEffect(playerId, npcId, name, npcEntityId);
      },
    };
  }

  private startAuthoredDialogue(
    playerId: string,
    npcId: string,
    npcName: string,
    treeId: string,
    npcEntityId: string | undefined,
  ): void {
    // Close any previous authored session for this player before opening a
    // new one. Prevents DuplicateDialogueSessionError from the registry.
    if (this.authoredDialogues.hasSession(playerId)) {
      this.authoredDialogues.closeSession(playerId);
    }
    this.authoredSessions.set(playerId, {
      npcId,
      npcName,
      treeId,
      npcEntityId,
    });

    const ctx = this.buildAuthoredContext(playerId, npcId, npcEntityId);
    const presentation = this.authoredDialogues.openSession(
      playerId,
      treeId,
      ctx,
    );
    this.emitAuthoredPresentation(playerId, presentation, /*isStart*/ true);
  }

  private handleAuthoredDialogueResponse(
    playerId: string,
    responseIndex: number,
  ): void {
    const session = this.authoredSessions.get(playerId);
    if (!session) return;

    const ctx = this.buildAuthoredContext(
      playerId,
      session.npcId,
      session.npcEntityId,
    );
    let presentation: DialoguePresentation;
    try {
      presentation = this.authoredDialogues.pickChoice(
        playerId,
        responseIndex,
        ctx,
      );
    } catch (err) {
      // Illegal picks (bad index / hidden option) end the session cleanly
      // rather than crashing the server.
      this.logger.warn(
        `[DialogueSystem] authored pickChoice rejected for ${playerId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.authoredSessions.delete(playerId);
      this.emitTypedEvent(EventType.DIALOGUE_END, {
        playerId,
        npcId: session.npcId,
      });
      return;
    }
    this.emitAuthoredPresentation(playerId, presentation, /*isStart*/ false);
  }

  private handleAuthoredDialogueContinue(playerId: string): void {
    const session = this.authoredSessions.get(playerId);
    if (!session) return;

    const ctx = this.buildAuthoredContext(
      playerId,
      session.npcId,
      session.npcEntityId,
    );
    let presentation: DialoguePresentation;
    try {
      presentation = this.authoredDialogues.advance(playerId, ctx);
    } catch (err) {
      this.logger.warn(
        `[DialogueSystem] authored advance rejected for ${playerId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.authoredSessions.delete(playerId);
      this.emitTypedEvent(EventType.DIALOGUE_END, {
        playerId,
        npcId: session.npcId,
      });
      return;
    }
    this.emitAuthoredPresentation(playerId, presentation, /*isStart*/ false);
  }

  /**
   * Translate a `DialoguePresentation` into the wire-shape events the client
   * + EventBridge already understand. `line` presentations emit a node with
   * no responses (client will show a "continue" affordance). `choice`
   * presentations emit responses where `responseIndex` = VisibleChoice
   * `originalIndex` — the index the runner expects back on `pickChoice`.
   * `end` presentations tear down the session and emit DIALOGUE_END.
   */
  private emitAuthoredPresentation(
    playerId: string,
    presentation: DialoguePresentation,
    isStart: boolean,
  ): void {
    const session = this.authoredSessions.get(playerId);
    if (!session) return;

    if (presentation.kind === "end") {
      this.authoredSessions.delete(playerId);
      this.emitTypedEvent(EventType.DIALOGUE_END, {
        playerId,
        npcId: session.npcId,
      });
      return;
    }

    if (presentation.kind === "line") {
      // Line nodes are terminal-from-the-client's-perspective: no responses,
      // client will emit DIALOGUE_CONTINUE to advance. `text` carries the
      // raw localization key for now.
      const payload = {
        playerId,
        npcId: session.npcId,
        npcName: session.npcName,
        nodeId: `line:${presentation.textKey}`,
        text: this.resolveText(presentation.textKey),
        responses: [],
        ...(session.npcEntityId !== undefined && {
          npcEntityId: session.npcEntityId,
        }),
      };
      if (isStart) {
        this.emitTypedEvent(EventType.DIALOGUE_START, payload);
      } else {
        this.emitTypedEvent(EventType.DIALOGUE_NODE_CHANGE, payload);
      }
      return;
    }

    // kind === "choice"
    const promptKey = presentation.promptKey ?? "";
    const responses = presentation.options.map((opt) => ({
      text: this.resolveText(opt.textKey),
      nextNodeId: `choice:${opt.originalIndex}`,
      effect: opt.action === "" ? undefined : opt.action,
    }));
    const payload = {
      playerId,
      npcId: session.npcId,
      npcName: session.npcName,
      nodeId: `choice:${promptKey}`,
      text: promptKey === "" ? "" : this.resolveText(promptKey),
      responses,
      ...(session.npcEntityId !== undefined && {
        npcEntityId: session.npcEntityId,
      }),
    };
    if (isStart) {
      this.emitTypedEvent(EventType.DIALOGUE_START, payload);
    } else {
      this.emitTypedEvent(EventType.DIALOGUE_NODE_CHANGE, payload);
    }
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

      case "openTanner":
        this.emitTypedEvent(EventType.TANNING_INTERACT, {
          playerId,
          npcId,
        });
        break;

      case "startQuest": {
        const questId = params[0];
        if (!questId || !isValidQuestId(questId)) {
          this.logger.warn(
            `startQuest effect has invalid quest ID: ${questId}`,
          );
          break;
        }
        // Get QuestSystem and request quest start (shows confirmation screen)
        const questSystem = this.world.getSystem("quest") as {
          requestQuestStart?: (playerId: string, questId: string) => boolean;
        };
        if (questSystem?.requestQuestStart) {
          questSystem.requestQuestStart(playerId, questId);
        } else {
          this.logger.warn("QuestSystem not available for startQuest effect");
        }
        break;
      }

      case "completeQuest": {
        const questIdToComplete = params[0];
        this.logger.info(
          `[DialogueSystem] completeQuest effect called for quest: ${questIdToComplete}`,
        );
        if (!questIdToComplete || !isValidQuestId(questIdToComplete)) {
          this.logger.warn(
            `completeQuest effect has invalid quest ID: ${questIdToComplete}`,
          );
          break;
        }
        // Get QuestSystem and complete the quest
        const questSystemForComplete = this.world.getSystem("quest") as {
          completeQuest?: (
            playerId: string,
            questId: string,
          ) => Promise<boolean>;
        };
        if (questSystemForComplete?.completeQuest) {
          this.logger.info(
            `[DialogueSystem] Calling QuestSystem.completeQuest for ${questIdToComplete}`,
          );
          questSystemForComplete
            .completeQuest(playerId, questIdToComplete)
            .then((success) => {
              this.logger.info(
                `[DialogueSystem] completeQuest returned: ${success}`,
              );
            })
            .catch((err) => {
              this.logger.error(
                `Failed to complete quest ${questIdToComplete}:`,
                err,
              );
            });
        } else {
          this.logger.warn(
            "QuestSystem not available for completeQuest effect",
          );
        }
        break;
      }

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

  // ==========================================================================
  // Authored dialogue registry — hot-reload + lookup surface.
  //
  // Authored trees coexist with the legacy npcs.json `NPCDialogueTree`
  // path. The legacy path is untouched while the registry is empty;
  // consumers that want to use authored trees must call
  // `openAuthoredDialogueSession` / `advanceAuthoredDialogueSession`
  // explicitly. A follow-up slice will add an NPC → authored-tree
  // binding that routes NPC_INTERACTION to the new path automatically.
  // ==========================================================================

  /**
   * Attach (or detach with `null`) a localization catalog used to
   * resolve authored `textKey` strings before they hit the wire. When
   * no catalog is set, the raw textKey is echoed as `text` — this
   * preserves the editor-loop default. Catalog misses fall back to the
   * raw textKey as well (see `resolveText`), so attaching an empty
   * catalog never erases existing lines.
   */
  public setLocalizationCatalog(catalog: LocalizationCatalog | null): void {
    this.localizationCatalog = catalog;
  }

  /**
   * Register a predicate for authored dialogue `showIf` / branch
   * `condition`. Subsequent registrations with the same name overwrite
   * the previous evaluator (last-write-wins). Evaluators that throw
   * are treated as `false` at the callsite — a malformed plugin
   * predicate should never take down the dialogue loop.
   */
  public registerConditionEvaluator(
    name: string,
    fn: DialogueConditionEvaluator,
  ): void {
    if (name === "") {
      throw new Error(
        "DialogueSystem.registerConditionEvaluator: empty name is reserved (runner treats empty showIf as always-visible)",
      );
    }
    this.conditionEvaluators.set(name, fn);
  }

  /** Remove a single registered predicate. No-op if absent. */
  public unregisterConditionEvaluator(name: string): void {
    this.conditionEvaluators.delete(name);
  }

  /** Drop every registered predicate. Mainly for test / reload isolation. */
  public clearConditionEvaluators(): void {
    this.conditionEvaluators.clear();
  }

  /** Snapshot the currently registered predicate names (stable order). */
  public getRegisteredConditionNames(): readonly string[] {
    return Array.from(this.conditionEvaluators.keys()).sort();
  }

  /**
   * Resolve an authored textKey through the localization catalog, or
   * fall through to the raw key if the catalog is absent or does not
   * define the key. Intentionally permissive: the editor can ship
   * partially localized trees without breaking the dialogue loop.
   */
  private resolveText(textKey: string): string {
    if (this.localizationCatalog === null) return textKey;
    const resolved = this.localizationCatalog.resolveTemplate(textKey);
    return resolved === undefined ? textKey : resolved;
  }

  /**
   * Replace the authored dialogue manifest. Passing `null` clears the
   * registry (falls back to legacy-only). By default every open
   * authored session is closed for safety — pass the
   * `preserveOpenSessionsByTreeId` option to keep sessions whose tree
   * survived the reload.
   */
  public setAuthoredDialogues(
    manifest: DialogueManifest | null,
    opts: { preserveOpenSessionsByTreeId?: boolean } = {},
  ): void {
    if (manifest === null) {
      this.authoredDialogues.closeAllSessions();
      this.authoredDialogues.load([]);
      return;
    }
    this.authoredDialogues.load(manifest, opts);
  }

  /** Validate-then-load. Throws on schema violation; prior state untouched. */
  public setAuthoredDialoguesFromJson(raw: unknown): void {
    this.authoredDialogues.loadFromJson(raw);
  }

  /** True when an authored tree with this id is loaded. */
  public hasAuthoredDialogue(treeId: string): boolean {
    return this.authoredDialogues.hasTree(treeId);
  }

  /** Enumerate the authored tree ids currently loaded (stable order). */
  public getAuthoredDialogueIds(): readonly string[] {
    return this.authoredDialogues.treeIds;
  }

  /**
   * Direct accessor for integration tests + a future NPC→authored-tree
   * bridge. Returns the registry itself so callers can `openSession` /
   * `advance` / `pickChoice` against the fully-tested session manager.
   */
  public getAuthoredDialogueRegistry(): DialogueRegistry {
    return this.authoredDialogues;
  }

  /**
   * NPC → authored dialogue-tree id bindings.
   *
   * Populated by `setAuthoredNpcDialogueBindings()` — typically wired
   * from `PIEEditorSession.updateManifests({ npcDialogueBindings })`
   * when an editor user assigns an authored dialogue tree to an NPC
   * via the NPC property inspector. Read by future routing code that
   * prefers an authored tree over the legacy `NPCDialogueTree`
   * embedded in `npcs.json`.
   *
   * Stored as a plain `Map` so a single `setAuthoredNpcDialogueBindings`
   * call replaces the prior map atomically without tearing.
   */
  private readonly authoredNpcBindings = new Map<string, string>();

  /**
   * Replace the entire NPC → authored-tree-id binding table.
   *
   * Passing `null` clears all bindings — useful when the editor
   * unloads the authored dialogue manifest or a plugin tears down
   * its contribution. Unlike `setAuthoredDialogues`, this does NOT
   * validate that the referenced tree ids exist in the registry;
   * the lookup at interaction time (`resolveAuthoredTreeIdForNpc`)
   * returns `null` for stale references so binding rows can survive
   * a manifest reload order where bindings arrive first.
   */
  public setAuthoredNpcDialogueBindings(
    bindings: Record<string, string> | null,
  ): void {
    this.authoredNpcBindings.clear();
    if (bindings === null) return;
    for (const [npcId, treeId] of Object.entries(bindings)) {
      this.authoredNpcBindings.set(npcId, treeId);
    }
  }

  /** Set or update a single NPC → authored-tree binding. */
  public setAuthoredNpcDialogueBinding(npcId: string, treeId: string): void {
    this.authoredNpcBindings.set(npcId, treeId);
  }

  /** Remove a single NPC → authored-tree binding. */
  public clearAuthoredNpcDialogueBinding(npcId: string): void {
    this.authoredNpcBindings.delete(npcId);
  }

  /**
   * Resolve the authored tree id bound to `npcId`, or `null` when
   * either no binding exists or the binding points at a tree that is
   * not currently loaded in the authored registry. Callers should
   * fall back to the legacy npcs.json dialogue in the null case.
   */
  public resolveAuthoredTreeIdForNpc(npcId: string): string | null {
    const treeId = this.authoredNpcBindings.get(npcId);
    if (treeId === undefined) return null;
    if (!this.authoredDialogues.hasTree(treeId)) return null;
    return treeId;
  }

  /** Read-only snapshot of the current binding table. */
  public getAuthoredNpcDialogueBindings(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [npcId, treeId] of this.authoredNpcBindings) {
      out[npcId] = treeId;
    }
    return out;
  }
}
