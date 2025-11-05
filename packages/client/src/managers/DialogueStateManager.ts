import type { ClientWorld } from '../types';
import type { DialogueNode } from '@hyperscape/shared';
import { EventType } from '@hyperscape/shared';

interface DialogueTree {
  entryNodeId: string;
  nodes: DialogueNode[];
}

export class DialogueStateManager {
  private world: ClientWorld;
  private currentNpcId: string | null = null;
  private currentNodeId: string | null = null;
  private dialogueTree: DialogueTree | null = null;
  private questsAvailable: string[] = [];

  constructor(world: ClientWorld) {
    this.world = world;
    this.setupEventListeners();
  }

  public openDialogue(npcId: string, npcName: string, dialogueTree: DialogueTree, entryNodeId: string, questsAvailable?: string[]): void {
    this.currentNpcId = npcId;
    this.currentNodeId = entryNodeId;
    this.dialogueTree = dialogueTree;
    this.questsAvailable = questsAvailable || [];

    // Emit UI event to open DialogueWindow
    this.world.emit('dialogue:open' as never, {
      npcId,
      npcName,
      dialogueTree,
      questsAvailable: this.questsAvailable
    } as never);
  }

  public selectResponse(responseId: string): void {
    if (!this.currentNodeId || !this.dialogueTree) {
      console.warn('[DialogueStateManager] No active dialogue');
      return;
    }

    // Send response to server
    this.world.network?.send('dialogueResponse', {
      playerId: this.world.entities.player?.id,
      npcId: this.currentNpcId,
      responseId
    });
  }

  public closeDialogue(): void {
    this.currentNpcId = null;
    this.currentNodeId = null;
    this.dialogueTree = null;
    this.questsAvailable = [];

    // Emit UI event to close DialogueWindow
    this.world.emit('dialogue:close' as never, {} as never);
  }

  private setupEventListeners(): void {
    // Listen for NPC_DIALOGUE event from server
    this.world.on(EventType.NPC_DIALOGUE, (data) => {
      const dialogueData = data as {
        playerId: string;
        npcId: string;
        npcType?: string;
        dialogueLines?: string[];
        services?: string[];
        dialogueTree?: DialogueTree;
        entryNodeId?: string;
        questsAvailable?: string[];
        npcName?: string;
      };

      // Only open dialogue for local player
      if (dialogueData.playerId !== this.world.entities.player?.id) {
        return;
      }

      // If dialogueTree is provided, use it; otherwise create simple tree from dialogueLines
      let tree: DialogueTree;
      if (dialogueData.dialogueTree) {
        tree = dialogueData.dialogueTree;
      } else {
        // Fallback: create simple single-node tree from dialogueLines
        const text = dialogueData.dialogueLines?.[0] || 'Hello!';
        tree = {
          entryNodeId: 'greeting',
          nodes: [
            {
              id: 'greeting',
              text,
              options: [
                {
                  text: 'Goodbye',
                  nextNode: ''
                }
              ]
            }
          ]
        };
      }

      const entryNodeId = dialogueData.entryNodeId || tree.entryNodeId || 'greeting';
      const npcName = dialogueData.npcName || dialogueData.npcId || 'NPC';

      this.openDialogue(
        dialogueData.npcId,
        npcName,
        tree,
        entryNodeId,
        dialogueData.questsAvailable
      );
    });

    // Listen for dialogue navigation events from server
    this.world.on('dialogue:navigate' as never, (data: { nodeId: string }) => {
      this.currentNodeId = data.nodeId;
    });

    // Listen for dialogue close events
    this.world.on('dialogue:close' as never, () => {
      this.closeDialogue();
    });
  }

  public getCurrentNpcId(): string | null {
    return this.currentNpcId;
  }

  public getCurrentNodeId(): string | null {
    return this.currentNodeId;
  }

  public getDialogueTree(): DialogueTree | null {
    return this.dialogueTree;
  }

  public destroy(): void {
    // Clean up event listeners
    this.closeDialogue();
  }
}
