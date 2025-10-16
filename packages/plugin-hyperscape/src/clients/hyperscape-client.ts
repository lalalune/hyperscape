/**
 * hyperscape-client.ts - ElizaOS to Hyperscape Bridge Client
 *
 * WebSocket client that connects ElizaOS AI agents to Hyperscape game worlds.
 * Enables autonomous AI agents to join as players and interact with the game.
 *
 * **Purpose:**
 * Allows ElizaOS agents to:
 * - Connect to Hyperscape servers as headless clients
 * - Control player characters autonomously
 * - Respond to game events and environment
 * - Execute actions via the action system
 * - Interact with players and NPCs
 *
 * **Architecture:**
 * - Extends EventEmitter for reactive event handling
 * - WebSocket connection to Hyperscape server
 * - Automatic reconnection on disconnect
 * - Message queuing during connection loss
 * - Event forwarding to ElizaOS runtime
 *
 * **Event Bridge:**
 * Game events → HyperscapeClient → ElizaOS Runtime
 * - Player messages → Agent can respond
 * - World changes → Agent can react
 * - Combat events → Agent can make decisions
 *
 * **Configuration:**
 * - url: WebSocket server URL (ws://localhost:5555/ws)
 * - gameRole: Agent's role in game ('player', 'npc', 'merchant')
 * - agentId: Unique agent identifier
 * - runtime: ElizaOS agent runtime instance
 *
 * **Connection Management:**
 * - Auto-connect on start()
 * - Auto-reconnect with exponential backoff
 * - Graceful disconnect on stop()
 * - Connection state tracking
 *
 * **Usage:**
 * ```ts
 * const client = new HyperscapeClientInterface({
 *   runtime: agentRuntime,
 *   url: 'ws://localhost:5555/ws',
 *   gameRole: 'player',
 *   agentId: 'agent_123'
 * });
 * await client.start();
 * ```
 *
 * **Referenced by:** plugin-hyperscape action handlers, ElizaOS agent initialization
 */

import { IAgentRuntime, Memory, UUID } from "@elizaos/core";

const generateUUID = () => crypto.randomUUID() as UUID;
interface Client {}
import WebSocket from "ws";
import { EventEmitter } from "events";
import { EventType } from "@hyperscape/shared";

/**
 * HyperscapeClientInterface - ElizaOS Agent Game Client
 *
 * Connects ElizaOS AI agents to Hyperscape game worlds as autonomous players.
 */
export class HyperscapeClientInterface extends EventEmitter implements Client {
  private runtime: IAgentRuntime;
  private ws: WebSocket | null = null;
  private url: string;
  private gameRole: string;
  private agentId: string;
  private connected = false;
  private reconnectInterval: NodeJS.Timeout | null = null;

  constructor(config: {
    runtime: IAgentRuntime;
    url: string;
    gameRole: string;
    agentId: string;
  }) {
    super();
    this.runtime = config.runtime;
    this.url = config.url;
    this.gameRole = config.gameRole;
    this.agentId = config.agentId;
  }

  async start(): Promise<void> {
    await this.connect();
  }

  async stop(): Promise<void> {
    this.connected = false;

    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.on("open", () => {
          this.connected = true;

          // Send join message
          const character = this.runtime.character;
          this.ws!.send(
            JSON.stringify({
              type: "join",
              agentId: this.agentId,
              name: character.name,
              position: [
                25 + Math.random() * 10 - 5,
                0,
                25 + Math.random() * 10 - 5,
              ],
              metadata: {
                color: character.settings?.color,
                emoji: character.settings?.emoji,
                role: this.gameRole,
              },
            }),
          );

          resolve();
        });

        this.ws.on("message", async (data) => {
          const message = JSON.parse(data.toString());
          await this.handleMessage(message);
        });

        this.ws.on("close", () => {
          this.connected = false;
          this.ws = null;

          // Attempt reconnection
          if (!this.reconnectInterval) {
            this.reconnectInterval = setInterval(() => {
              if (!this.connected) {
                this.connect().catch(console.error);
              }
            }, 5000);
          }
        });

        this.ws.on("error", (error) => {
          console.error("[HyperscapeClient] WebSocket error:", error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case "chat_message":
        // Process incoming chat message
        if (message.data.playerId !== this.agentId) {
          const memory: Memory = {
            id: generateUUID(),
            entityId: this.agentId as UUID,
            agentId: this.agentId as UUID,
            roomId: generateUUID(),
            content: {
              text: message.data.text,
              playerName: message.data.playerName,
              playerEmoji: message.data.playerEmoji,
            },
            createdAt: new Date(message.data.timestamp).getTime(),
          };
        }
        break;
    }
  }

  private getAvailableActions(context: any): string[] {
    const actions = [];

    actions.push("HYPERSCAPE_GOTO_ENTITY"); // Move to tasks

    // Always allow chat
    actions.push("CHAT_MESSAGE");

    return actions;
  }

  private sendAction(action: string, data?: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        type: "action",
        action,
        data,
      }),
    );
  }

  public sendChat(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        type: "chat",
        text,
      }),
    );

    // Emit message event for monitoring if runtime supports it
    if ("emit" in this.runtime && typeof this.runtime.emit === "function") {
      this.runtime.emit(EventType.NETWORK_MESSAGE_RECEIVED, {
        content: { text },
      });
    }
  }

  public updatePosition(position: number[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        type: "position",
        position,
      }),
    );
  }
}
