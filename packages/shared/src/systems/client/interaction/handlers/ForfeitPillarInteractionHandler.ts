/**
 * ForfeitPillarInteractionHandler
 *
 * Handles interactions with forfeit pillars in the Duel Arena.
 * Players can click a pillar during an active duel to forfeit and surrender.
 *
 * classic MMORPG Context Menu Format:
 * - "Forfeit Trapdoor" (primary action - only enabled during active duel)
 * - "Examine Trapdoor"
 *
 * Rules:
 * - Only available during an active duel (FIGHTING state)
 * - Disabled if the duel has "noForfeit" rule enabled
 * - Immediately ends the duel with the opponent as winner
 *
 */

import { BaseInteractionHandler } from "./BaseInteractionHandler";
import type { RaycastTarget, ContextMenuAction } from "../types";
import { INTERACTION_RANGE, MESSAGE_TYPES } from "../constants";

/** classic MMORPG scenery/object color (cyan) for context menu target names */
const SCENERY_COLOR = "#00ffff";

export class ForfeitPillarInteractionHandler extends BaseInteractionHandler {
  /**
   * Left-click: Forfeit duel if in active duel
   */
  onLeftClick(target: RaycastTarget): void {
    if (this.isInActiveDuel()) {
      this.forfeitDuel(target);
    } else {
      this.showExamineMessage("You are not currently in a duel.");
    }
  }

  /**
   * Right-click: Show forfeit pillar options
   *
   * rules-accurate format:
   * - "Forfeit Trapdoor" (action white, target cyan) - only if in duel
   * - "Examine Trapdoor" (action white, target cyan)
   */
  getContextMenuActions(target: RaycastTarget): ContextMenuAction[] {
    const actions: ContextMenuAction[] = [];
    const targetName = target.name || "Trapdoor";
    const inActiveDuel = this.isInActiveDuel();
    const canForfeit = inActiveDuel && !this.isNoForfeitDuel();

    // Forfeit action (primary) - only if in active duel
    actions.push({
      id: "forfeit",
      label: `Forfeit ${targetName}`,
      styledLabel: [
        { text: "Forfeit " },
        { text: targetName, color: SCENERY_COLOR },
      ],
      enabled: canForfeit,
      priority: 1,
      handler: () => {
        if (canForfeit) {
          this.forfeitDuel(target);
        } else if (inActiveDuel) {
          this.showExamineMessage(
            "You cannot forfeit - this duel is to the death!",
          );
        } else {
          this.showExamineMessage("You are not currently in a duel.");
        }
      },
    });

    // Examine action
    actions.push({
      id: "examine",
      label: `Examine ${targetName}`,
      styledLabel: [
        { text: "Examine " },
        { text: targetName, color: SCENERY_COLOR },
      ],
      enabled: true,
      priority: 100,
      handler: () => {
        this.showExamineMessage(
          "A trapdoor for surrendering during a duel. Click to forfeit.",
        );
      },
    });

    return actions.sort((a, b) => a.priority - b.priority);
  }

  getActionRange(_actionId: string): number {
    return INTERACTION_RANGE.ADJACENT;
  }

  // === Private Methods ===

  /**
   * Check if the local player is in an active duel (FIGHTING state)
   */
  private isInActiveDuel(): boolean {
    const activeDuel = (
      this.world as {
        activeDuel?: { duelId: string; arenaId: number };
      }
    ).activeDuel;

    return !!activeDuel?.duelId;
  }

  /**
   * Check if the current duel has noForfeit rule enabled
   */
  private isNoForfeitDuel(): boolean {
    const activeDuel = (
      this.world as {
        activeDuel?: { duelId: string; rules?: { noForfeit?: boolean } };
      }
    ).activeDuel;

    return activeDuel?.rules?.noForfeit === true;
  }

  /**
   * Get the current duel ID
   */
  private getDuelId(): string | null {
    const activeDuel = (
      this.world as {
        activeDuel?: { duelId: string };
      }
    ).activeDuel;

    return activeDuel?.duelId || null;
  }

  /**
   * Send forfeit request to server
   */
  private forfeitDuel(target: RaycastTarget): void {
    const duelId = this.getDuelId();

    if (!duelId) {
      this.showExamineMessage("You are not currently in a duel.");
      return;
    }

    if (this.isNoForfeitDuel()) {
      this.showExamineMessage(
        "You cannot forfeit - this duel is to the death!",
      );
      return;
    }

    // Queue the interaction (walk to pillar if needed)
    this.queueInteraction({
      target: {
        ...target,
        position: target.hitPoint,
      },
      actionId: "forfeit",
      range: INTERACTION_RANGE.ADJACENT,
      onExecute: () => {
        this.send(MESSAGE_TYPES.DUEL_FORFEIT, { duelId });
        this.addChatMessage("You have forfeited the duel.");
      },
    });
  }
}
