/**
 * AgentCommandDispatcher - Routes commands to an agent's EmbeddedHyperiaService
 *
 * Extracted from AgentManager.sendCommand() to isolate the command dispatch
 * switch/case logic into a dedicated, single-responsibility class.
 */

import type { EmbeddedHyperiaService } from "../EmbeddedHyperiaService.js";
import type { AgentState } from "../types.js";

/**
 * Minimal agent instance shape required by the dispatcher.
 * Avoids coupling to the full AgentInstance interface internal to AgentManager.
 */
export interface DispatchableAgent {
  service: EmbeddedHyperiaService;
  state: AgentState;
  lastActivity: number;
  operatorCommandAt: number;
  navigationTarget: {
    position: [number, number, number];
    description: string;
    setAt: number;
  } | null;
  currentTargetId: string | null;
  lastCombatReEngageAt: number;
  combatPrayerActive: boolean;
}

/**
 * AgentCommandDispatcher routes string-based commands to the appropriate
 * method on an agent's EmbeddedHyperiaService.
 */
export class AgentCommandDispatcher {
  constructor(
    private readonly getAgent: (
      characterId: string,
    ) => DispatchableAgent | undefined,
  ) {}

  /**
   * Dispatch a command to the agent identified by characterId.
   *
   * @param characterId - The agent's character ID
   * @param command - The command type (e.g. "move", "attack", "bankDeposit")
   * @param data - Command payload (shape depends on command type)
   */
  async dispatch(
    characterId: string,
    command: string,
    data: unknown,
  ): Promise<void> {
    const instance = this.getAgent(characterId);
    if (!instance) {
      throw new Error(`Agent ${characterId} not found`);
    }

    if (instance.state !== "running") {
      throw new Error(`Agent ${characterId} is not running`);
    }

    const now = Date.now();
    instance.lastActivity = now;
    // Mark operator command timestamp so the behavior ticker defers to it
    // instead of overriding the command with its own autonomous action.
    instance.operatorCommandAt = now;

    const service = instance.service;
    const commandData = data as Record<string, unknown>;

    switch (command) {
      case "move":
        // Disengage from combat so the agent actually moves instead of
        // re-engaging the mob on the next behavior tick.
        instance.currentTargetId = null;
        instance.lastCombatReEngageAt = 0;
        instance.combatPrayerActive = false;
        await service.executeStop();
        // Set persistent navigation target so the bridge re-issues move each
        // tick until the agent arrives (survives grace period and BFS limits).
        instance.navigationTarget = {
          position: commandData.target as [number, number, number],
          description:
            (commandData.description as string) || "operator destination",
          setAt: now,
        };
        await service.executeMove(
          commandData.target as [number, number, number],
          commandData.runMode as boolean | undefined,
        );
        break;

      case "attack":
        await service.executeAttack(commandData.targetId as string);
        break;

      case "gather":
        await service.executeGather(commandData.resourceId as string);
        break;

      case "pickup":
        await service.executePickup(commandData.itemId as string);
        break;

      case "drop":
        await service.executeDrop(
          commandData.itemId as string,
          commandData.quantity as number | undefined,
        );
        break;

      case "equip":
        await service.executeEquip(commandData.itemId as string);
        break;

      case "use":
        await service.executeUse(commandData.itemId as string);
        break;

      case "chat":
        await service.executeChat(commandData.message as string);
        break;

      case "stop":
        instance.navigationTarget = null;
        instance.currentTargetId = null;
        instance.lastCombatReEngageAt = 0;
        instance.combatPrayerActive = false;
        await service.executeStop();
        break;

      case "bankOpen":
        await service.executeBankOpen(commandData.bankId as string);
        break;

      case "bankDeposit":
        await service.executeBankDeposit(
          commandData.itemId as string,
          commandData.quantity as number | undefined,
        );
        break;

      case "bankWithdraw":
        await service.executeBankWithdraw(
          commandData.itemId as string,
          commandData.quantity as number | undefined,
        );
        break;

      case "bankDepositAll":
        await service.executeBankDepositAll();
        break;

      case "storeBuy":
        await service.executeStoreBuy(
          commandData.storeId as string,
          commandData.itemId as string,
          commandData.quantity as number | undefined,
        );
        break;

      case "storeSell":
        await service.executeStoreSell(
          commandData.storeId as string,
          commandData.itemId as string,
          commandData.quantity as number | undefined,
        );
        break;

      case "cook":
        await service.executeCook(commandData.itemId as string);
        break;

      case "smelt":
        await service.executeSmelt(commandData.recipe as string);
        break;

      case "smith":
        await service.executeSmith(commandData.recipe as string);
        break;

      case "firemake":
        await service.executeFiremake();
        break;

      case "npcInteract":
        await service.executeNpcInteract(
          commandData.npcId as string,
          commandData.interaction as string | undefined,
        );
        break;

      case "unequip":
        await service.executeUnequip(commandData.slot as string);
        break;

      case "prayerToggle":
        await service.executePrayerToggle(commandData.prayerId as string);
        break;

      case "prayerDeactivateAll":
        await service.executePrayerDeactivateAll();
        break;

      case "changeStyle":
        await service.executeChangeStyle(commandData.style as string);
        break;

      case "autoRetaliate":
        await service.executeSetAutoRetaliate(commandData.enabled as boolean);
        break;

      case "homeTeleport":
        await service.executeHomeTeleport();
        break;

      case "follow":
        await service.executeFollow(commandData.targetId as string);
        break;

      case "respawn":
        await service.executeRespawn();
        break;

      case "questAccept":
        await service.executeQuestAccept(commandData.questId as string);
        break;

      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }
}
