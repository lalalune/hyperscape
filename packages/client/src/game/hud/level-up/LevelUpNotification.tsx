/**
 * LevelUpNotification - Main composition root for level-up notifications
 *
 * Combines:
 * - useLevelUpState: Event subscription and queue management
 * - LevelUpPopup: Visual popup display
 * - levelUpAudio: Placeholder fanfare sounds
 * - Chat message: OSRS-style game message
 */

import { useEffect, useRef, useMemo } from "react";
import { uuid } from "@hyperforge/shared";
import type { ChatMessage, ClientAudio, Chat } from "@hyperforge/shared";
import type { ClientWorld } from "../../../types";
import { useLevelUpState } from "./useLevelUpState";
import { LevelUpPopup } from "./LevelUpPopup";
import { playLevelUpFanfare } from "./levelUpAudio";
import { capitalizeSkill, isClientAudio, isChat } from "./utils";

interface LevelUpNotificationProps {
  world: ClientWorld;
  /** Optional audio system injection for testing/flexibility */
  audioSystem?: ClientAudio;
  /** Optional chat system injection for testing/flexibility */
  chatSystem?: Chat;
}

export function LevelUpNotification({
  world,
  audioSystem,
  chatSystem,
}: LevelUpNotificationProps) {
  const { currentLevelUp, dismissLevelUp } = useLevelUpState(world);

  // Resolve audio and chat systems with dependency injection fallback
  // Memoize to avoid recalculating on every render
  const audio = useMemo(
    () => audioSystem ?? (isClientAudio(world.audio) ? world.audio : undefined),
    [audioSystem, world.audio],
  );

  const chat = useMemo(
    () => chatSystem ?? (isChat(world.chat) ? world.chat : undefined),
    [chatSystem, world.chat],
  );

  // Track which level-ups we've already processed (by timestamp)
  const processedRef = useRef<Set<number>>(new Set());

  // Play audio and send chat message when a new level-up appears
  useEffect(() => {
    if (!currentLevelUp) return;

    // Skip if we already processed this level-up
    if (processedRef.current.has(currentLevelUp.timestamp)) return;
    processedRef.current.add(currentLevelUp.timestamp);

    // === AUDIO (uses injected or resolved audio system) ===
    if (audio) {
      const sfxVolume = audio.groupGains?.sfx?.gain?.value ?? 1;
      if (sfxVolume > 0) {
        audio.ready(() => {
          playLevelUpFanfare(
            currentLevelUp.newLevel,
            audio.ctx,
            audio.groupGains?.sfx,
          );
        });
      }
    }

    // === CHAT MESSAGE (uses injected or resolved chat system) ===
    if (chat) {
      const messageBody = `Congratulations! You've advanced a ${capitalizeSkill(currentLevelUp.skill)} level. You are now level ${currentLevelUp.newLevel}.`;

      // Reuse timestamp to avoid redundant Date operations
      const now = Date.now();
      const message: ChatMessage = {
        id: uuid(),
        from: "", // Empty = no [username] prefix, just game text (OSRS style)
        body: messageBody,
        text: messageBody, // For interface compatibility
        timestamp: now,
        createdAt: new Date(now).toISOString(),
      };

      chat.add(message, false); // false = don't broadcast to server
    }
  }, [currentLevelUp, audio, chat]);

  // Cleanup old timestamps periodically to prevent memory leak
  useEffect(() => {
    const cleanup = window.setInterval(() => {
      const now = Date.now();
      const threshold = 60000; // 1 minute
      processedRef.current.forEach((timestamp) => {
        if (now - timestamp > threshold) {
          processedRef.current.delete(timestamp);
        }
      });
    }, 30000); // Every 30 seconds while mounted

    return () => window.clearInterval(cleanup);
  }, []);

  // Don't render if no level-up to display
  if (!currentLevelUp) {
    return null;
  }

  return <LevelUpPopup event={currentLevelUp} onDismiss={dismissLevelUp} />;
}
