/**
 * NPCInteractionHandler
 *
 * Handles interactions with NPCs (non-hostile characters).
 *
 * classic MMORPG Context Menu Format: "<Action> <NPCName>" with yellow target (NPC color)
 *
 * Banker NPC:
 * - "Talk-to Banker" (yellow #ffff00 for "Banker")
 * - "Bank Banker" (yellow)
 * - "Collect Banker" (yellow) - for Grand Exchange
 * - "Examine Banker" (yellow)
 *
 * Shop Keeper NPC:
 * - "Talk-to Shop keeper" (yellow)
 * - "Trade Shop keeper" (yellow)
 * - "Examine Shop keeper" (yellow)
 *
 * Supported NPC services:
 * - "bank" → Opens bank interface
 * - "store"/"shop" → Opens store interface
 * - (default) → Opens dialogue
 *
 */

import { BaseInteractionHandler } from "./BaseInteractionHandler";
import type { RaycastTarget, ContextMenuAction } from "../types";
import { INTERACTION_RANGE, MESSAGE_TYPES } from "../constants";
import { getNPCById } from "../../../../data/npcs";
import { CONTEXT_MENU_COLORS } from "../../../../constants/GameConstants";

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
   *
   * rules-accurate format with yellow NPC names:
   * - Banker: "Talk-to Banker", "Bank Banker", "Collect Banker"
   * - Shop: "Talk-to Shop keeper", "Trade Shop keeper"
   */
  getContextMenuActions(target: RaycastTarget): ContextMenuAction[] {
    const actions: ContextMenuAction[] = [];
    const services = this.getNPCServices(target);
    const config = this.getNPCConfig(target);
    const npcName = target.name || "NPC";

    // Talk-to (always available, primary for most NPCs)
    // classic MMORPG: "Talk-to Banker" / "Talk-to Shop keeper"
    actions.push({
      id: "talk",
      label: `Talk-to ${npcName}`,
      styledLabel: [
        { text: "Talk-to " },
        { text: npcName, color: CONTEXT_MENU_COLORS.NPC },
      ],
      enabled: true,
      priority: 1,
      handler: () => this.startDialogue(target),
    });

    // Bank service - classic MMORPG: "Bank Banker"
    if (services.includes("bank")) {
      actions.push({
        id: "bank",
        label: `Bank ${npcName}`,
        styledLabel: [
          { text: "Bank " },
          { text: npcName, color: CONTEXT_MENU_COLORS.NPC },
        ],
        enabled: true,
        priority: 2,
        handler: () => this.openBank(target),
      });

      // Collect (Grand Exchange) - classic MMORPG: "Collect Banker"
      actions.push({
        id: "collect",
        label: `Collect ${npcName}`,
        styledLabel: [
          { text: "Collect " },
          { text: npcName, color: CONTEXT_MENU_COLORS.NPC },
        ],
        enabled: true,
        priority: 3,
        handler: () => this.collectFromGE(target),
      });
    }

    // Store service - classic MMORPG: "Trade Shop keeper"
    if (services.includes("store") || services.includes("shop")) {
      actions.push({
        id: "trade",
        label: `Trade ${npcName}`,
        styledLabel: [
          { text: "Trade " },
          { text: npcName, color: CONTEXT_MENU_COLORS.NPC },
        ],
        enabled: true,
        priority: 2,
        handler: () => this.openStore(target),
      });
    }

    // Walk here
    actions.push(this.createWalkHereAction(target));

    // Examine - classic MMORPG: "Examine Banker" / "Examine Shop keeper"
    const examineText = this.getExamineText(target, config);
    actions.push({
      id: "examine",
      label: `Examine ${npcName}`,
      styledLabel: [
        { text: "Examine " },
        { text: npcName, color: CONTEXT_MENU_COLORS.NPC },
      ],
      enabled: true,
      priority: 100,
      handler: () => {
        this.showExamineMessage(examineText);
      },
    });

    return actions.sort((a, b) => a.priority - b.priority);
  }

  getActionRange(_actionId: string): number {
    return INTERACTION_RANGE.NPC;
  }

  // === Private Methods ===

  private openBank(target: RaycastTarget): void {
    this.queueInteraction({
      target,
      actionId: "bank",
      range: INTERACTION_RANGE.NPC,
      onExecute: () => {
        this.send(MESSAGE_TYPES.BANK_OPEN, { bankId: target.entityId });
      },
    });
  }

  /**
   * Collect items from Grand Exchange.
   * In classic MMORPG, bankers can access GE collection box.
   */
  private collectFromGE(target: RaycastTarget): void {
    this.queueInteraction({
      target,
      actionId: "collect",
      range: INTERACTION_RANGE.NPC,
      onExecute: () => {
        // FUTURE: Implement GE collection when Grand Exchange is added
        this.showExamineMessage(
          "Grand Exchange collection is not yet available.",
        );
      },
    });
  }

  private openStore(target: RaycastTarget): void {
    const config = this.getNPCConfig(target);
    // Get manifest ID with fallback to parsing from entity ID
    const npcId =
      config.npcId || this.extractManifestIdFromEntityId(target.entityId);

    this.queueInteraction({
      target,
      actionId: "trade",
      range: INTERACTION_RANGE.NPC,
      onExecute: () => {
        this.send(MESSAGE_TYPES.STORE_OPEN, {
          npcId,
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

  /**
   * Extract manifest NPC ID from entity ID format
   *
   * Entity IDs are formatted as: npc_${manifestId}_${timestamp}
   * Example: "npc_shopkeeper_1765003446078" -> "shopkeeper"
   * Example: "npc_bank_clerk_1765003446078" -> "bank_clerk"
   *
   * Falls back to the full entityId if parsing fails.
   */
  private extractManifestIdFromEntityId(entityId: string): string {
    if (entityId.startsWith("npc_")) {
      const parts = entityId.split("_");
      if (parts.length >= 3) {
        // The manifest ID is everything between "npc_" and the final timestamp
        const timestampPart = parts[parts.length - 1];
        // Check if the last part looks like a timestamp (all digits, 13+ chars)
        if (/^\d{13,}$/.test(timestampPart)) {
          // Remove "npc_" prefix and "_timestamp" suffix
          const manifestId = parts.slice(1, -1).join("_");
          if (manifestId) {
            return manifestId;
          }
        }
      }
    }
    // Fallback: return the original entityId
    return entityId;
  }
}
