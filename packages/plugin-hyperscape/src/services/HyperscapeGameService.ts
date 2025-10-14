import { THREE } from "@hyperscape/shared";
import { HyperscapeService } from "../service";
import { elizaLogger } from "@elizaos/core";

export class HyperscapeGameService {
  private hyperscapeService: HyperscapeService;

  constructor(hyperscapeService: HyperscapeService) {
    this.hyperscapeService = hyperscapeService;
  }

  async movePlayer(playerId: string, position: THREE.Vector3): Promise<void> {
    const world = this.hyperscapeService.getWorld()!;

    // Update player position
    const player = world.entities.players.get(playerId)!;
    player.node.position.copy(position);

    // Broadcast movement
    world.network.send("playerMove", {
      playerId,
      position,
    });

    elizaLogger.info(
      `Player ${playerId} moved to ${position.x}, ${position.y}, ${position.z}`,
    );
  }

  async startTask(playerId: string, taskId: string): Promise<void> {
    const world = this.hyperscapeService.getWorld()!;

    // Start task logic
    world.network.send("taskStart", {
      playerId,
      taskId,
      timestamp: Date.now(),
    });

    elizaLogger.info(`Player ${playerId} started task ${taskId}`);
  }

  async performKill(killerId: string, victimId: string): Promise<void> {
    const world = this.hyperscapeService.getWorld()!;

    // Kill animation and effects
    world.network.send("playerKill", {
      killerId,
      victimId,
      timestamp: Date.now(),
    });

    elizaLogger.info(`Player ${killerId} eliminated ${victimId}`);
  }

  async reportBody(reporterId: string, bodyId: string): Promise<void> {
    const world = this.hyperscapeService.getWorld()!;

    // Trigger meeting
    world.network.send("bodyReport", {
      reporterId,
      bodyId,
      timestamp: Date.now(),
    });

    elizaLogger.info(`Player ${reporterId} reported body ${bodyId}`);
  }

  async sendChat(playerId: string, message: string): Promise<void> {
    const world = this.hyperscapeService.getWorld()!;

    // Send chat message
    const chatSystem = world.chat as { add: (message: { id: string; entityId: string; text: string; timestamp: number }) => void };
    chatSystem.add({
      id: `msg-${Date.now()}`,
      entityId: playerId,
      text: message,
      timestamp: Date.now(),
    });

    elizaLogger.info(`Player ${playerId} said: ${message}`);
  }

  async castVote(voterId: string, targetId: string | null): Promise<void> {
    const world = this.hyperscapeService.getWorld()!;

    // Cast vote
    world.network.send("castVote", {
      voterId,
      targetId,
      timestamp: Date.now(),
    });

    elizaLogger.info(`Player ${voterId} voted for ${targetId || "skip"}`);
  }

  async createGameEntity(entityData: { id: string; type: string; position?: [number, number, number]; [key: string]: string | number | boolean | [number, number, number] | undefined }): Promise<void> {
    const world = this.hyperscapeService.getWorld()!;

    // Add entity to world
    world.entities.add(entityData);

    elizaLogger.info(`Created game entity: ${entityData.id}`);
  }

  async updateGameState(stateUpdate: Record<string, string | number | boolean>): Promise<void> {
    const world = this.hyperscapeService.getWorld()!;

    // Update game state
    world.network.send("gameStateUpdate", stateUpdate);

    elizaLogger.info(`Updated game state: ${JSON.stringify(stateUpdate)}`);
  }

  getWorld() {
    return this.hyperscapeService.getWorld();
  }

  isConnected(): boolean {
    return this.hyperscapeService.isConnected();
  }
}
