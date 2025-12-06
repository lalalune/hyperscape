/**
 * DialoguePanel - NPC dialogue interface
 *
 * Features:
 * - Displays NPC dialogue text
 * - Shows response options as clickable buttons
 * - Closes when dialogue ends (no responses)
 * - OSRS-style appearance
 *
 * PRODUCTION PATTERN (OSRS/WoW style):
 * - Server is the single source of truth for UI state
 * - Server tracks active dialogue sessions via InteractionSessionManager
 * - Server validates distance and sends close packets when player moves away
 * - Client NEVER independently polls distance - this prevents race conditions
 *   with server/client position sync under network lag
 */

import React from "react";
import type { World } from "@hyperscape/shared";

interface DialogueResponse {
  text: string;
  nextNodeId: string;
  effect?: string;
}

interface DialoguePanelProps {
  visible: boolean;
  npcName: string;
  npcId: string;
  text: string;
  responses: DialogueResponse[];
  npcEntityId?: string;
  onSelectResponse: (index: number, response: DialogueResponse) => void;
  onClose: () => void;
  world: World;
}

export function DialoguePanel({
  visible,
  npcName,
  npcId,
  text,
  responses,
  npcEntityId,
  onSelectResponse,
  onClose,
  world,
}: DialoguePanelProps) {
  // NOTE: Distance validation is handled server-side by InteractionSessionManager.
  // The server sends 'dialogueClose' packets when the player moves too far away.
  // This prevents race conditions between client and server position sync under lag.

  if (!visible) return null;

  const handleResponseClick = (index: number, response: DialogueResponse) => {
    // Send response to server
    // SECURITY: Only send responseIndex - server determines nextNodeId and effect
    // from its own dialogue state to prevent dialogue skipping exploits
    if (world.network?.send) {
      world.network.send("dialogueResponse", {
        npcId,
        responseIndex: index,
      });
    }
    onSelectResponse(index, response);
  };

  const handleContinue = () => {
    // If no responses, this is the end of dialogue
    onClose();
  };

  return (
    <div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto"
      style={{
        width: "40rem",
        maxWidth: "90vw",
        background: "rgba(11, 10, 21, 0.98)",
        border: "2px solid #c9a227",
        borderRadius: "0.5rem",
        padding: "1.5rem",
        backdropFilter: "blur(10px)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* NPC Name Header */}
      <div
        className="flex justify-between items-center mb-3 pb-2"
        style={{ borderBottom: "1px solid #c9a227" }}
      >
        <h3 className="m-0 text-lg font-bold" style={{ color: "#c9a227" }}>
          {npcName}
        </h3>
        <button
          onClick={onClose}
          className="bg-transparent border-none text-gray-400 hover:text-white cursor-pointer text-xl leading-none"
          title="Close dialogue"
        >
          x
        </button>
      </div>

      {/* Dialogue Text */}
      <div
        className="mb-4 text-white leading-relaxed"
        style={{
          fontSize: "1rem",
          minHeight: "3rem",
        }}
      >
        {text}
      </div>

      {/* Response Options */}
      <div className="flex flex-col gap-2">
        {responses.length > 0 ? (
          responses.map((response, index) => (
            <button
              key={index}
              onClick={() => handleResponseClick(index, response)}
              className="w-full text-left py-2 px-4 rounded cursor-pointer transition-all"
              style={{
                background: "rgba(201, 162, 39, 0.1)",
                border: "1px solid rgba(201, 162, 39, 0.3)",
                color: "#e0d6c0",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(201, 162, 39, 0.2)";
                e.currentTarget.style.borderColor = "#c9a227";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(201, 162, 39, 0.1)";
                e.currentTarget.style.borderColor = "rgba(201, 162, 39, 0.3)";
              }}
            >
              {index + 1}. {response.text}
            </button>
          ))
        ) : (
          <button
            onClick={handleContinue}
            className="w-full py-2 px-4 rounded cursor-pointer transition-all"
            style={{
              background: "rgba(201, 162, 39, 0.2)",
              border: "1px solid #c9a227",
              color: "#c9a227",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(201, 162, 39, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(201, 162, 39, 0.2)";
            }}
          >
            Click to continue...
          </button>
        )}
      </div>
    </div>
  );
}
