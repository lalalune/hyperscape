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
import { useThemeStore } from "@/ui";
import { getInteractiveTileStyle, getPanelInsetStyle } from "@/ui/theme/themes";
import { DialogueCharacterPortrait } from "./dialogue/DialogueCharacterPortrait";
import type { ClientWorld } from "../../types";

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
  world: ClientWorld;
}

export function DialoguePanel({
  visible,
  npcName,
  npcId,
  text,
  responses,
  npcEntityId,
  onSelectResponse,
  world,
}: DialoguePanelProps) {
  const theme = useThemeStore((s) => s.theme);

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
    // Terminal node - send continue packet to server so it can execute any pending effects
    // Server will then send dialogueEnd which clears the shell-owned modal state.
    if (world.network?.send) {
      world.network.send("dialogueContinue", {
        npcId,
      });
    }
  };

  return (
    <div className="flex min-w-0 w-full flex-col gap-2 overflow-visible">
      <div
        className="grid min-h-0 gap-3 md:grid-cols-[136px_minmax(0,1fr)]"
        style={{ alignItems: "start" }}
      >
        <DialogueCharacterPortrait
          world={world}
          npcEntityId={npcEntityId}
          npcName={npcName}
          className="self-start"
        />

        <div className="flex min-w-0 flex-col gap-2">
          <div
            className="shrink-0 text-white leading-relaxed"
            style={{
              fontSize: "0.89rem",
              lineHeight: 1.5,
              minHeight: "3.8rem",
              color: theme.colors.text.primary,
              ...getPanelInsetStyle(theme, {
                emphasis: "normal",
                radius: theme.borderRadius.lg,
                padding: `${theme.spacing.sm - 1}px ${theme.spacing.md - 1}px`,
              }),
            }}
          >
            {text}
          </div>

          <div
            className="flex min-h-0 flex-col gap-2 overflow-y-auto pr-1"
            style={{ maxHeight: "min(10.5rem, 22vh)" }}
          >
            {responses.length > 0 ? (
              responses.map((response, index) => (
                <button
                  key={index}
                  onClick={() => handleResponseClick(index, response)}
                  className="w-full rounded text-left transition-all"
                  aria-label={`Response ${index + 1}: ${response.text}`}
                  style={{
                    ...getInteractiveTileStyle(theme, {
                      radius: theme.borderRadius.md,
                      accentColor: theme.colors.accent.primary,
                    }),
                    color: theme.colors.text.primary,
                    padding: `${theme.spacing.sm - 1}px ${theme.spacing.md - 1}px`,
                    fontWeight: theme.typography.fontWeight.semibold,
                    fontSize: "0.95rem",
                    display: "flex",
                    alignItems: "center",
                    gap: theme.spacing.sm - 1,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      theme.name === "hyperia"
                        ? "linear-gradient(180deg, rgba(255, 255, 255, 0.065) 0%, rgba(190, 165, 123, 0.12) 22%, rgba(25, 29, 35, 0.98) 100%)"
                        : `${theme.colors.accent.primary}18`;
                    e.currentTarget.style.borderColor = `${theme.colors.accent.primary}80`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      theme.name === "hyperia"
                        ? "linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.012) 18%, rgba(22, 26, 31, 0.99) 100%)"
                        : `${theme.colors.accent.primary}12`;
                    e.currentTarget.style.borderColor = `${theme.colors.border.default}80`;
                  }}
                >
                  <span
                    style={{
                      color: theme.colors.text.muted,
                      fontSize: "10px",
                      minWidth: 14,
                    }}
                  >
                    {index + 1}.
                  </span>
                  <span className="leading-snug">{response.text}</span>
                </button>
              ))
            ) : (
              <button
                onClick={handleContinue}
                className="w-full rounded transition-all"
                aria-label="Continue dialogue"
                style={{
                  ...getInteractiveTileStyle(theme, {
                    active: true,
                    radius: theme.borderRadius.md,
                    accentColor: theme.colors.accent.primary,
                  }),
                  color: theme.colors.text.primary,
                  padding: `${theme.spacing.sm - 1}px ${theme.spacing.md - 1}px`,
                  fontWeight: theme.typography.fontWeight.semibold,
                  fontSize: "0.95rem",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    theme.name === "hyperia"
                      ? "linear-gradient(180deg, rgba(255, 255, 255, 0.075) 0%, rgba(190, 165, 123, 0.14) 22%, rgba(27, 31, 37, 0.98) 100%)"
                      : `${theme.colors.accent.primary}28`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    theme.name === "hyperia"
                      ? "linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(190, 165, 123, 0.12) 20%, rgba(25, 29, 35, 0.98) 100%)"
                      : `${theme.colors.accent.primary}20`;
                }}
              >
                Click to continue...
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
