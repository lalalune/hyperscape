/**
 * NPCInteractionHandler
 *
 * Handles interactions with NPCs (non-hostile characters).
 *
 * Supported NPC services:
 * - "bank" → Opens bank interface
 * - "store"/"shop" → Opens store interface
 * - (default) → Opens dialogue
 *
 * Actions:
 * - Use Bank (if bank service)
 * - Trade (if store service)
 * - Talk-to (always available)
 * - Walk here
 * - Examine
 */

import { BaseInteractionHandler } from "./BaseInteractionHandler";
import type { RaycastTarget, ContextMenuAction } from "../types";
import { INTERACTION_RANGE, MESSAGE_TYPES } from "../constants";
import { getNPCById } from "../../../../data/npcs";

/**
 * NPC entity config interface for type safety
 */
interface NPCEntityConfig {
  npcId?: string;
  npcType?: string;
  services?: string[];
}

export class NPCInteractionHandler extends BaseInteractionHandler {
  /**
   * Left-click: Execute primary action based on NPC services
   *
   * Priority: bank > store > dialogue
   */
  onLeftClick(target: RaycastTarget): void {
    const services = this.getNPCServices(target);

    if (services.includes("bank")) {
      this.openBank(target);
    } else if (services.includes("store") || services.includes("shop")) {
      this.openStore(target);
    } else {
      this.startDialogue(target);
    }
  }

  /**
   * Right-click: Show all available actions
   */
  getContextMenuActions(target: RaycastTarget): ContextMenuAction[] {
    const actions: ContextMenuAction[] = [];
    const services = this.getNPCServices(target);
    const config = this.getNPCConfig(target);

    // Bank service
    if (services.includes("bank")) {
      actions.push({
        id: "use-bank",
        label: "Use Bank",
        icon: "🏦",
        enabled: true,
        priority: 1,
        handler: () => this.openBank(target),
      });
    }

    // Store service
    if (services.includes("store") || services.includes("shop")) {
      actions.push({
        id: "trade",
        label: "Trade",
        icon: "🏪",
        enabled: true,
        priority: 2,
        handler: () => this.openStore(target),
      });
    }

    // Talk (always available)
    actions.push({
      id: "talk",
      label: "Talk-to",
      icon: "💬",
      enabled: true,
      priority: 3,
      handler: () => this.startDialogue(target),
    });

    // Walk here
    actions.push(this.createWalkHereAction(target));

    // Examine
    const examineText = this.getExamineText(target, config);
    actions.push(this.createExamineAction(target, examineText));

    return actions.sort((a, b) => a.priority - b.priority);
  }

  getActionRange(_actionId: string): number {
    return INTERACTION_RANGE.NPC;
  }

  // === Private Methods ===

  private openBank(target: RaycastTarget): void {
    this.queueInteraction({
      target,
      actionId: "use-bank",
      range: INTERACTION_RANGE.NPC,
      onExecute: () => {
        this.send(MESSAGE_TYPES.BANK_OPEN, { bankId: target.entityId });
      },
    });
  }

  private openStore(target: RaycastTarget): void {
    const config = this.getNPCConfig(target);

    this.queueInteraction({
      target,
      actionId: "trade",
      range: INTERACTION_RANGE.NPC,
      onExecute: () => {
        this.send(MESSAGE_TYPES.STORE_OPEN, {
          npcId: config.npcId || target.entityId,
          npcEntityId: target.entityId,
        });
      },
    });
  }

  private startDialogue(target: RaycastTarget): void {
    const config = this.getNPCConfig(target);

    this.queueInteraction({
      target,
      actionId: "talk",
      range: INTERACTION_RANGE.NPC,
      onExecute: () => {
        this.send(MESSAGE_TYPES.NPC_INTERACT, {
          npcId: target.entityId,
          npc: {
            id: config.npcId || target.entityId,
            name: target.name,
            type: config.npcType || "dialogue",
          },
        });
      },
    });
  }

  private getNPCConfig(target: RaycastTarget): NPCEntityConfig {
    const entity = target.entity as unknown as { config?: NPCEntityConfig };
    return entity.config || {};
  }

  private getNPCServices(target: RaycastTarget): string[] {
    return this.getNPCConfig(target).services || [];
  }

  private getExamineText(
    target: RaycastTarget,
    config: NPCEntityConfig,
  ): string {
    if (config.npcId) {
      const npcData = getNPCById(config.npcId);
      if (npcData?.description) {
        return npcData.description;
      }
    }
    return `It's ${target.name.toLowerCase()}.`;
  }
}
