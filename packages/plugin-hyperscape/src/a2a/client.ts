/**
 * A2A Client for Hyperscape
 *
 * HTTP client that communicates with Hyperscape A2A server,
 * enabling agents to play the game via JSON-RPC.
 */

// ============================================
// A2A Protocol Types
// ============================================

export interface A2AAgentCard {
  protocolVersion: string;
  name: string;
  description: string;
  url: string;
  skills: A2ASkill[];
}

export interface A2ASkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples: string[];
}

export interface A2AMessage {
  role: "user" | "agent";
  parts: Array<{ kind: string; text?: string; data?: Record<string, unknown> }>;
  messageId: string;
  kind: "message";
}

export interface A2ATaskResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

// ============================================
// A2A Client Implementation
// ============================================

export class HyperscapeA2AClient {
  private serverUrl: string;
  private agentId: string;
  private agentCard: A2AAgentCard | null = null;
  private messageCounter = 0;

  constructor(serverUrl: string, agentId: string) {
    this.serverUrl = serverUrl.replace(/\/$/, "");
    this.agentId = agentId;
  }

  /**
   * Discover agent capabilities by fetching agent card
   */
  async discover(): Promise<A2AAgentCard> {
    const response = await fetch(
      `${this.serverUrl}/.well-known/agent-card.json`,
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch agent card: ${response.statusText}`);
    }
    this.agentCard = (await response.json()) as A2AAgentCard;
    return this.agentCard;
  }

  /**
   * Get available skills
   */
  getSkills(): A2ASkill[] {
    return this.agentCard?.skills ?? [];
  }

  /**
   * Execute a skill via JSON-RPC
   */
  async executeSkill(
    skillId: string,
    params: Record<string, unknown> = {},
  ): Promise<A2ATaskResult> {
    const messageId = `${this.agentId}-${Date.now()}-${++this.messageCounter}`;

    const response = await fetch(`${this.serverUrl}/a2a`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "message/send",
        params: {
          message: {
            role: "user",
            parts: [
              {
                kind: "data",
                data: { skillId, agentId: this.agentId, ...params },
              },
            ],
            messageId,
            kind: "message",
          },
        },
        id: messageId,
      }),
    });

    if (!response.ok) {
      throw new Error(`A2A request failed: ${response.statusText}`);
    }

    const result = (await response.json()) as {
      result?: A2AMessage;
      error?: { message: string };
    };

    if (result.error) {
      return { success: false, message: result.error.message };
    }

    const textPart = result.result?.parts?.find((p) => p.kind === "text");
    const dataPart = result.result?.parts?.find((p) => p.kind === "data");

    return {
      success: true,
      message: textPart?.text ?? "Action completed",
      data: dataPart?.data,
    };
  }

  // ============================================
  // Convenience Methods
  // ============================================

  async joinGame(playerName?: string): Promise<A2ATaskResult> {
    return this.executeSkill("join-game", { playerName });
  }

  async getStatus(): Promise<A2ATaskResult> {
    return this.executeSkill("get-status");
  }

  async moveTo(x: number, y: number, z: number): Promise<A2ATaskResult> {
    return this.executeSkill("move-to", { x, y, z });
  }

  async attack(targetId: string, attackStyle?: string): Promise<A2ATaskResult> {
    return this.executeSkill("attack", { targetId, attackStyle });
  }

  async stopAttack(): Promise<A2ATaskResult> {
    return this.executeSkill("stop-attack");
  }

  async gatherResource(resourceId: string): Promise<A2ATaskResult> {
    return this.executeSkill("gather-resource", { resourceId });
  }

  async mineRock(rockId?: string): Promise<A2ATaskResult> {
    return this.executeSkill("mine-rock", { rockId });
  }

  async getInventory(): Promise<A2ATaskResult> {
    return this.executeSkill("get-inventory");
  }

  async getSkillLevels(): Promise<A2ATaskResult> {
    return this.executeSkill("get-skills");
  }

  async getNearbyEntities(range?: number): Promise<A2ATaskResult> {
    return this.executeSkill("get-nearby-entities", { range });
  }

  async equipItem(itemId: string, slot?: string): Promise<A2ATaskResult> {
    return this.executeSkill("equip-item", { itemId, slot });
  }

  async useItem(itemId: string): Promise<A2ATaskResult> {
    return this.executeSkill("use-item", { itemId });
  }

  async dropItem(itemId: string, quantity?: number): Promise<A2ATaskResult> {
    return this.executeSkill("drop-item", { itemId, quantity });
  }

  async pickupItem(itemId: string): Promise<A2ATaskResult> {
    return this.executeSkill("pickup-item", { itemId });
  }

  async changeAttackStyle(styleId: string): Promise<A2ATaskResult> {
    return this.executeSkill("change-attack-style", { styleId });
  }

  // ============================================
  // Additional Game Actions
  // ============================================

  async unequipItem(slot: string): Promise<A2ATaskResult> {
    return this.executeSkill("unequip-item", { slot });
  }

  async openBank(bankId?: string): Promise<A2ATaskResult> {
    return this.executeSkill("open-bank", { bankId });
  }

  async depositItem(
    itemId: string,
    quantity?: number,
    bankId?: string,
  ): Promise<A2ATaskResult> {
    return this.executeSkill("deposit-item", { itemId, quantity, bankId });
  }

  async withdrawItem(
    itemId: string,
    quantity?: number,
    bankId?: string,
  ): Promise<A2ATaskResult> {
    return this.executeSkill("withdraw-item", { itemId, quantity, bankId });
  }

  async buyItem(
    itemId: string,
    quantity?: number,
    storeId?: string,
  ): Promise<A2ATaskResult> {
    return this.executeSkill("buy-item", { itemId, quantity, storeId });
  }

  async sellItem(
    itemId: string,
    quantity?: number,
    storeId?: string,
  ): Promise<A2ATaskResult> {
    return this.executeSkill("sell-item", { itemId, quantity, storeId });
  }

  async lookAround(range?: number): Promise<A2ATaskResult> {
    return this.executeSkill("look-around", { range });
  }

  async interactNpc(npcId?: string, npcName?: string): Promise<A2ATaskResult> {
    return this.executeSkill("interact-npc", { npcId, npcName });
  }

  async lootCorpse(corpseId?: string): Promise<A2ATaskResult> {
    return this.executeSkill("loot-corpse", { corpseId });
  }

  async eatFood(): Promise<A2ATaskResult> {
    return this.executeSkill("eat-food", {});
  }

  async emote(emoteName: string): Promise<A2ATaskResult> {
    return this.executeSkill("emote", { emote: emoteName });
  }

  async respawn(): Promise<A2ATaskResult> {
    return this.executeSkill("respawn", {});
  }

  async setGoal(goalType: string, target?: string): Promise<A2ATaskResult> {
    return this.executeSkill("set-goal", { goalType, target });
  }

  async moveDirection(
    direction: string,
    distance?: number,
  ): Promise<A2ATaskResult> {
    return this.executeSkill("move-direction", { direction, distance });
  }

  async examine(entityId: string): Promise<A2ATaskResult> {
    return this.executeSkill("examine", { entityId });
  }

  async sendChat(message: string): Promise<A2ATaskResult> {
    return this.executeSkill("send-chat", { message });
  }

  async sendLocalChat(message: string): Promise<A2ATaskResult> {
    return this.executeSkill("send-local-chat", { message });
  }

  async sendWhisper(targetId: string, message: string): Promise<A2ATaskResult> {
    return this.executeSkill("send-whisper", { targetId, message });
  }

  async dialogueRespond(responseIndex: number): Promise<A2ATaskResult> {
    return this.executeSkill("dialogue-respond", { responseIndex });
  }

  async closeDialogue(): Promise<A2ATaskResult> {
    return this.executeSkill("close-dialogue", {});
  }

  async examineInventoryItem(itemId: string): Promise<A2ATaskResult> {
    return this.executeSkill("examine-inventory-item", { itemId });
  }

  // ============================================
  // Trading Actions
  // ============================================

  async tradeRequest(
    targetId?: string,
    targetName?: string,
  ): Promise<A2ATaskResult> {
    return this.executeSkill("trade-request", { targetId, targetName });
  }

  async tradeRespond(
    accept: boolean,
    requesterId?: string,
  ): Promise<A2ATaskResult> {
    return this.executeSkill("trade-respond", { accept, requesterId });
  }

  async tradeOffer(
    itemId?: string,
    quantity?: number,
    coins?: number,
  ): Promise<A2ATaskResult> {
    return this.executeSkill("trade-offer", { itemId, quantity, coins });
  }

  async tradeConfirm(): Promise<A2ATaskResult> {
    return this.executeSkill("trade-confirm", {});
  }

  async tradeCancel(): Promise<A2ATaskResult> {
    return this.executeSkill("trade-cancel", {});
  }

  /**
   * Get semantic world context for agent decision making
   */
  async getWorldContext(): Promise<string> {
    const lines: string[] = [];

    const status = await this.getStatus();
    if (status.success && status.data) {
      lines.push("=== STATUS ===");
      const health = status.data.health as
        | { current?: number; max?: number }
        | undefined;
      if (health?.max) {
        lines.push(
          `Health: ${Math.round(((health.current ?? 0) / health.max) * 100)}%`,
        );
      }
      if (status.data.inCombat) {
        lines.push("** IN COMBAT **");
      }
      lines.push("");
    }

    const nearby = await this.getNearbyEntities(30);
    if (nearby.success && nearby.data) {
      lines.push("=== NEARBY ===");
      const mobs = (nearby.data.mobs ?? []) as Array<{
        name?: string;
        distance?: number;
      }>;
      const resources = (nearby.data.resources ?? []) as Array<{
        name?: string;
        distance?: number;
      }>;
      const items = (nearby.data.items ?? []) as Array<{
        name?: string;
        distance?: number;
      }>;

      if (mobs.length > 0) {
        lines.push("Creatures:");
        mobs
          .slice(0, 5)
          .forEach((m) => lines.push(`  • ${m.name} (${m.distance}m)`));
      }
      if (resources.length > 0) {
        lines.push("Resources:");
        resources
          .slice(0, 5)
          .forEach((r) => lines.push(`  • ${r.name} (${r.distance}m)`));
      }
      if (items.length > 0) {
        lines.push("Ground Items:");
        items
          .slice(0, 5)
          .forEach((i) => lines.push(`  • ${i.name} (${i.distance}m)`));
      }
      lines.push("");
    }

    const skills = await this.getSkillLevels();
    if (skills.success && skills.data) {
      lines.push("=== SKILLS ===");
      lines.push(`Combat Level: ${skills.data.combatLevel ?? "?"}`);
      lines.push("");
    }

    return lines.join("\n");
  }
}

/**
 * Create A2A client from environment or config
 */
export function createA2AClient(
  options: {
    serverUrl?: string;
    agentId?: string;
  } = {},
): HyperscapeA2AClient {
  const serverUrl =
    options.serverUrl ??
    process.env.HYPERSCAPE_A2A_URL ??
    "http://localhost:5555";
  const agentId =
    options.agentId ?? process.env.HYPERSCAPE_AGENT_ID ?? `agent-${Date.now()}`;
  return new HyperscapeA2AClient(serverUrl, agentId);
}
