import { ChainWriter } from "./ChainWriter.js";
import type { Address } from "viem";

/**
 * Event payload types from the Hyperia game server.
 * These match the EventType events emitted by the shared systems.
 */
interface InventoryUpdatePayload {
  playerId: string;
  inventory: Array<{
    slot: number;
    itemId: string;
    quantity: number;
  }>;
  coins: number;
}

interface SkillsUpdatePayload {
  playerId: string;
  skills: Record<string, { level: number; xp: number }>;
}

interface EquipmentUpdatePayload {
  playerId: string;
  equipment: Record<string, { itemId: string; quantity: number } | null>;
}

interface MobKillPayload {
  playerId: string;
  npcId: string;
  npcType: string;
  isBoss: boolean;
}

interface PlayerDeathPayload {
  playerId: string;
  killedBy: string;
}

interface PlayerRegisteredPayload {
  playerId: string;
  playerName: string;
  walletAddress: string;
}

interface DuelCompletedPayload {
  duelId: string;
  winnerId: string;
  loserId: string;
  challengerId?: string;
  opponentId?: string;
  forfeit?: boolean;
  challengerStakeValue?: number;
  opponentStakeValue?: number;
  summary?: {
    challengerStakeValue?: number;
    targetStakeValue?: number;
  };
}

/**
 * Maps equipment slot names from the game to numeric slot types for the chain.
 */
const EQUIP_SLOT_TO_TYPE: Record<string, number> = {
  weapon: 0,
  shield: 1,
  helmet: 2,
  body: 3,
  legs: 4,
  boots: 5,
  gloves: 6,
  cape: 7,
  amulet: 8,
  ring: 9,
  arrows: 10,
};

/**
 * ChainWriterBridge connects the game server's event system to the ChainWriter.
 *
 * It subscribes to world events (inventory changes, skill updates, kills, etc.)
 * and translates them into ChainWriter queue calls. The ChainWriter then batches
 * and sends them to the chain optimistically.
 *
 * This is the glue between HyperForge's ECS event system and the MUD World contract.
 *
 * Usage in server startup:
 * ```typescript
 * if (process.env.MODE === "web3") {
 *   const chainWriter = new ChainWriter();
 *   await chainWriter.initialize();
 *   const bridge = new ChainWriterBridge(chainWriter, itemIdMap);
 *   bridge.attachToWorld(world);
 * }
 * ```
 */
export class ChainWriterBridge {
  private chainWriter: ChainWriter;
  private itemIdMap: Map<string, number>;
  private playerWalletMap: Map<string, Address>;

  /**
   * @param chainWriter The ChainWriter instance
   * @param itemIdMap String ID → numeric ID mapping (from generate-item-ids)
   */
  constructor(chainWriter: ChainWriter, itemIdMap: Map<string, number>) {
    this.chainWriter = chainWriter;
    this.itemIdMap = itemIdMap;
    this.playerWalletMap = new Map();
  }

  /**
   * Register a player's wallet address for chain writes.
   * Called when a player connects with a known wallet.
   */
  registerPlayerWallet(playerId: string, walletAddress: Address): void {
    this.playerWalletMap.set(playerId, walletAddress);
  }

  private isAutonomousAgent(playerId: string): boolean {
    return playerId.startsWith("agent-");
  }

  private shouldMirrorPlayer(playerId: string): boolean {
    return !this.isAutonomousAgent(playerId);
  }

  /**
   * Attach event listeners to the game world.
   * Must be called after world.init() when all systems are ready.
   *
   * @param world The game world instance (has .on() method for events)
   */
  attachToWorld(world: {
    on: (event: string, handler: (payload: unknown) => void) => void;
  }): void {
    console.log("[ChainWriterBridge] Attaching to world events...");

    // Event string values from EventType enum in shared/types/events/event-types.ts
    // These MUST match exactly or the listeners silently receive nothing.

    // Inventory updates (EventType.INVENTORY_UPDATED = "inventory:updated")
    world.on("inventory:updated", (payload: unknown) => {
      const data = payload as InventoryUpdatePayload;
      if (!data.playerId || !data.inventory) return;
      if (!this.shouldMirrorPlayer(data.playerId)) return;

      // Convert string item IDs to numeric IDs
      const changedSlots = data.inventory
        .map((slot) => ({
          slotIndex: slot.slot,
          itemId: this.itemIdMap.get(slot.itemId) ?? 0,
          quantity: slot.quantity,
        }))
        .filter((slot) => slot.itemId > 0 || slot.quantity === 0);

      if (changedSlots.length > 0) {
        this.chainWriter.queueInventoryUpdate(data.playerId, changedSlots);
      }

      // Gold update
      if (data.coins !== undefined) {
        this.chainWriter.queueGoldUpdate(data.playerId, data.coins);
      }
    });

    // Skills updates (EventType.SKILLS_UPDATED = "skills:updated")
    world.on("skills:updated", (payload: unknown) => {
      const data = payload as SkillsUpdatePayload;
      if (!data.playerId || !data.skills) return;
      if (!this.shouldMirrorPlayer(data.playerId)) return;

      const skills = data.skills;

      // Check if combat skills changed
      const hasCombatSkills =
        skills.attack ||
        skills.strength ||
        skills.defense ||
        skills.constitution ||
        skills.ranged ||
        skills.magic ||
        skills.prayer;
      if (hasCombatSkills) {
        this.chainWriter.queueCombatSkillsUpdate(data.playerId, {
          attackLevel: skills.attack?.level ?? 1,
          attackXp: skills.attack?.xp ?? 0,
          strengthLevel: skills.strength?.level ?? 1,
          strengthXp: skills.strength?.xp ?? 0,
          defenseLevel: skills.defense?.level ?? 1,
          defenseXp: skills.defense?.xp ?? 0,
          constitutionLevel: skills.constitution?.level ?? 1,
          constitutionXp: skills.constitution?.xp ?? 0,
          rangedLevel: skills.ranged?.level ?? 1,
          rangedXp: skills.ranged?.xp ?? 0,
          magicLevel: skills.magic?.level ?? 1,
          magicXp: skills.magic?.xp ?? 0,
          prayerLevel: skills.prayer?.level ?? 1,
          prayerXp: skills.prayer?.xp ?? 0,
        });
      }

      // Check if gathering skills changed
      const hasGatheringSkills =
        skills.woodcutting ||
        skills.mining ||
        skills.fishing ||
        skills.firemaking ||
        skills.cooking ||
        skills.smithing ||
        skills.agility ||
        skills.crafting ||
        skills.fletching ||
        skills.runecrafting;
      if (hasGatheringSkills) {
        this.chainWriter.queueGatheringSkillsUpdate(data.playerId, {
          woodcuttingLevel: skills.woodcutting?.level ?? 1,
          woodcuttingXp: skills.woodcutting?.xp ?? 0,
          miningLevel: skills.mining?.level ?? 1,
          miningXp: skills.mining?.xp ?? 0,
          fishingLevel: skills.fishing?.level ?? 1,
          fishingXp: skills.fishing?.xp ?? 0,
          firemakingLevel: skills.firemaking?.level ?? 1,
          firemakingXp: skills.firemaking?.xp ?? 0,
          cookingLevel: skills.cooking?.level ?? 1,
          cookingXp: skills.cooking?.xp ?? 0,
          smithingLevel: skills.smithing?.level ?? 1,
          smithingXp: skills.smithing?.xp ?? 0,
          agilityLevel: skills.agility?.level ?? 1,
          agilityXp: skills.agility?.xp ?? 0,
          craftingLevel: skills.crafting?.level ?? 1,
          craftingXp: skills.crafting?.xp ?? 0,
          fletchingLevel: skills.fletching?.level ?? 1,
          fletchingXp: skills.fletching?.xp ?? 0,
          runecraftingLevel: skills.runecrafting?.level ?? 1,
          runecraftingXp: skills.runecrafting?.xp ?? 0,
        });
      }
    });

    // Equipment updates (EventType.PLAYER_EQUIPMENT_CHANGED = "player:equipment_changed")
    world.on("player:equipment_changed", (payload: unknown) => {
      const data = payload as EquipmentUpdatePayload;
      if (!data.playerId || !data.equipment) return;
      if (!this.shouldMirrorPlayer(data.playerId)) return;

      const changedSlots: Array<{
        slotType: number;
        itemId: number;
        quantity: number;
      }> = [];

      for (const [slotName, slotData] of Object.entries(data.equipment)) {
        const slotType = EQUIP_SLOT_TO_TYPE[slotName];
        if (slotType === undefined) continue;

        if (slotData && slotData.itemId) {
          const numericId = this.itemIdMap.get(slotData.itemId) ?? 0;
          changedSlots.push({
            slotType,
            itemId: numericId,
            quantity: slotData.quantity ?? 1,
          });
        } else {
          // Slot cleared
          changedSlots.push({ slotType, itemId: 0, quantity: 0 });
        }
      }

      if (changedSlots.length > 0) {
        this.chainWriter.queueEquipmentUpdate(data.playerId, changedSlots);
      }
    });

    // Mob kills (EventType.NPC_DIED = "npc:died")
    world.on("npc:died", (payload: unknown) => {
      const data = payload as MobKillPayload;
      if (!data.playerId || !data.npcId) return;
      if (!this.shouldMirrorPlayer(data.playerId)) return;

      this.chainWriter.queueMobKill(
        data.playerId,
        data.npcType ?? data.npcId,
        data.isBoss ?? false,
      );
    });

    // Player deaths — listen to ENTITY_DEATH (PLAYER_DIED is deprecated/never emitted)
    // String literal "entity:death" must match EventType.ENTITY_DEATH from @hyperforge/shared
    world.on("entity:death", (payload: unknown) => {
      const data = payload as {
        entityId: string;
        entityType: string;
        killedBy?: string;
      };
      if (data.entityType !== "player") return;
      if (!data.entityId) return;
      if (!this.shouldMirrorPlayer(data.entityId)) return;
      this.chainWriter.queueDeath(data.entityId);
    });

    // Player registration (EventType.PLAYER_REGISTERED = "player:registered")
    world.on("player:registered", (payload: unknown) => {
      const data = payload as PlayerRegisteredPayload;
      if (!data.playerId || !data.walletAddress) return;

      this.registerPlayerWallet(data.playerId, data.walletAddress as Address);
      this.chainWriter.queuePlayerRegistration(
        data.walletAddress as Address,
        data.playerId,
        data.playerName,
      );
    });

    // Duel completion (EventType.DUEL_COMPLETED = "duel:completed")
    world.on("duel:completed", (payload: unknown) => {
      const data = payload as DuelCompletedPayload;
      if (!data.duelId || !data.winnerId || !data.loserId) return;

      const challengerId = data.challengerId;
      const opponentId = data.opponentId;
      if (!challengerId || !opponentId) {
        console.log(
          "[ChainWriterBridge] Skipping duel record - missing challengerId/opponentId on payload",
        );
        return;
      }

      const challengerWallet = this.playerWalletMap.get(challengerId);
      const opponentWallet = this.playerWalletMap.get(opponentId);
      const winnerWallet = this.playerWalletMap.get(data.winnerId);

      if (!challengerWallet || !opponentWallet || !winnerWallet) {
        console.log(
          "[ChainWriterBridge] Skipping duel record - not all players have wallets registered",
        );
        return;
      }

      const cStake =
        typeof data.challengerStakeValue === "number"
          ? data.challengerStakeValue
          : (data.summary?.challengerStakeValue ?? 0);
      const oStake =
        typeof data.opponentStakeValue === "number"
          ? data.opponentStakeValue
          : (data.summary?.targetStakeValue ?? 0);

      this.chainWriter.queueDuelRecord(
        data.duelId,
        challengerWallet,
        opponentWallet,
        winnerWallet,
        challengerId,
        opponentId,
        cStake,
        oStake,
        data.forfeit ?? false,
      );
    });

    console.log("[ChainWriterBridge] Event listeners attached");
  }

  /**
   * Get the underlying ChainWriter for direct access (e.g. trades).
   */
  getChainWriter(): ChainWriter {
    return this.chainWriter;
  }

  /**
   * Flush pending writes and shut down.
   */
  async shutdown(): Promise<void> {
    await this.chainWriter.shutdown();
  }
}
