import React, { useState, useEffect } from 'react';
import { GameWindow } from './shared/GameWindow';
import type { DialogueNode, DialogueOption } from '@hyperscape/shared';
import type { ClientWorld } from '../types';

interface DialogueWindowProps {
  world: ClientWorld;
  npcId: string;
  npcName: string;
  dialogueTree: {
    entryNodeId: string;
    nodes: DialogueNode[];
  };
  questsAvailable?: string[];
  onClose: () => void;
}

export function DialogueWindow({ world, npcId, npcName, dialogueTree, questsAvailable, onClose }: DialogueWindowProps) {
  const [currentNodeId, setCurrentNodeId] = useState<string>(dialogueTree.entryNodeId);
  const [dialogueHistory, setDialogueHistory] = useState<Array<{ text: string; speaker: 'npc' | 'player' }>>([]);

  useEffect(() => {
    // Reset to entry node when dialogue tree changes
    setCurrentNodeId(dialogueTree.entryNodeId);
    setDialogueHistory([]);
  }, [dialogueTree, npcId]);

  const currentNode = dialogueTree.nodes.find(node => node.id === currentNodeId);

  if (!currentNode) {
    console.warn(`[DialogueWindow] Node not found: ${currentNodeId}`);
    onClose();
    return null;
  }

  const handleResponseClick = (option: DialogueOption) => {
    // Add player's response to history
    setDialogueHistory(prev => [...prev, { text: option.text, speaker: 'player' }]);

    // Handle service and quest actions
    if ('action' in option) {
      const action = option.action as string | (() => void);
      if (typeof action === 'string') {
        switch (action) {
          case 'start_quest': {
            const questId = 'questId' in option ? (option as DialogueOption & { questId: string }).questId : null;
            if (questId) {
              world.network?.send('startQuest', {
                playerId: world.entities.player?.id,
                questId
              });
            }
            break;
          }
          case 'complete_quest': {
            const questId = 'questId' in option ? (option as DialogueOption & { questId: string }).questId : null;
            if (questId) {
              world.network?.send('completeQuest', {
                playerId: world.entities.player?.id,
                questId
              });
            }
            break;
          }
          case 'open_bank':
            world.emit('bank:open_request' as never, {
              playerId: world.entities.player?.id,
              npcId
            } as never);
            onClose();
            return;
          case 'open_store':
            world.emit('store:open_request' as never, {
              playerId: world.entities.player?.id,
              npcId
            } as never);
            onClose();
            return;
        }
      } else if (typeof action === 'function') {
        action();
      }
    }

    // Navigate to next node or close
    if ('nextNode' in option && option.nextNode) {
      const nextNodeId = option.nextNode as string;
      setCurrentNodeId(nextNodeId);
      // Add NPC's next dialogue to history
      const nextNode = dialogueTree.nodes.find(n => n.id === nextNodeId);
      if (nextNode) {
        setDialogueHistory(prev => [...prev, { text: nextNode.text, speaker: 'npc' }]);
      }
    } else {
      onClose();
    }
  };

  return (
    <GameWindow
      title={npcName}
      windowId="dialogue"
      onClose={onClose}
      fitContent={true}
    >
      <div className="flex flex-col gap-4" style={{ minWidth: '320px', maxWidth: '480px' }}>
        {/* NPC Portrait (optional placeholder) */}
        <div
          className="flex items-center gap-3 p-3 rounded-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(30, 20, 10, 0.8) 0%, rgba(20, 15, 10, 0.6) 100%)',
            border: '1px solid rgba(139, 69, 19, 0.4)',
            boxShadow: 'inset 0 1px 0 rgba(242, 208, 138, 0.1)'
          }}
        >
          <div
            className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg"
            style={{
              background: 'linear-gradient(135deg, rgba(139, 69, 19, 0.9) 0%, rgba(101, 50, 15, 0.95) 100%)',
              color: '#f2d08a',
              border: '2px solid rgba(242, 208, 138, 0.3)',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)'
            }}
          >
            {npcName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div
              className="font-semibold text-sm"
              style={{
                color: '#f2d08a',
                fontFamily: "'Cinzel', serif",
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)'
              }}
            >
              {npcName}
            </div>
          </div>
        </div>

        {/* Dialogue Text */}
        <div
          className="p-4 rounded-lg"
          style={{
            background: 'rgba(10, 8, 5, 0.6)',
            border: '1px solid rgba(139, 69, 19, 0.3)',
            boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.5)'
          }}
        >
          <p
            className="text-sm leading-relaxed"
            style={{
              color: '#e8dcc0',
              textShadow: '0 1px 1px rgba(0, 0, 0, 0.6)'
            }}
          >
            {currentNode.text}
          </p>
        </div>

        {/* Quest Notifications */}
        {questsAvailable && questsAvailable.length > 0 && (
          <div
            className="p-3 rounded-lg flex items-center gap-2"
            style={{
              background: 'rgba(255, 215, 0, 0.1)',
              border: '1px solid rgba(255, 215, 0, 0.3)',
              boxShadow: 'inset 0 1px 0 rgba(255, 215, 0, 0.1)'
            }}
          >
            <span style={{ color: '#ffd700', fontSize: '1.2em' }}>!</span>
            <span className="text-xs" style={{ color: '#ffd700' }}>
              Quest Available
            </span>
          </div>
        )}

        {/* Response Options */}
        <div className="flex flex-col gap-2">
          {currentNode.options?.map((option, index) => {
            // Check condition if present
            if ('condition' in option && typeof option.condition === 'function') {
              try {
                if (!option.condition()) {
                  return null; // Hide option if condition not met
                }
              } catch (e) {
                console.warn('[DialogueWindow] Condition check failed:', e);
              }
            }

            return (
              <button
                key={index}
                onClick={() => handleResponseClick(option)}
                className="px-4 py-3 rounded-lg text-left text-sm transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, rgba(139, 69, 19, 0.7) 0%, rgba(101, 50, 15, 0.8) 100%)',
                  border: '1px solid rgba(242, 208, 138, 0.3)',
                  color: '#f2d08a',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(242, 208, 138, 0.15)',
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
                  cursor: 'pointer'
                }}
              >
                {option.text}
              </button>
            );
          })}
        </div>

        {/* Close if no options */}
        {(!currentNode.options || currentNode.options.length === 0) && (
          <button
            onClick={onClose}
            className="px-4 py-3 rounded-lg text-center text-sm transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, rgba(139, 69, 19, 0.7) 0%, rgba(101, 50, 15, 0.8) 100%)',
              border: '1px solid rgba(242, 208, 138, 0.3)',
              color: '#f2d08a',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(242, 208, 138, 0.15)',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
              cursor: 'pointer'
            }}
          >
            Goodbye
          </button>
        )}
      </div>
    </GameWindow>
  );
}
