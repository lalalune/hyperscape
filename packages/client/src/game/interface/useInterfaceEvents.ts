/**
 * useInterfaceEvents Hook
 *
 * Handles additional UI events not covered by usePlayerData and useModalPanels.
 * This includes:
 * - UI_OPEN_PANE for programmatic panel opening
 * - World map hotkey (M key)
 *
 * @packageDocumentation
 */

import { useEffect, useCallback, useState } from "react";
import { EventType } from "@hyperforge/shared";
import type { ClientWorld } from "../../types";

/**
 * useWorldMapHotkey - Handle M key to toggle world map
 *
 * @param onToggle - Callback when world map should be toggled
 */
export function useWorldMapHotkey(onToggle: () => void): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // M key toggles world map
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        onToggle();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggle]);
}

/**
 * useOpenPaneEvent - Handle UI_OPEN_PANE event for programmatic panel opening
 *
 * @param world - The game world instance
 * @param onPanelClick - Callback to handle panel opening
 */
export function useOpenPaneEvent(
  world: ClientWorld | null,
  onPanelClick: (panelId: string) => void,
): void {
  useEffect(() => {
    if (!world) return;

    const onOpenPane = (payload: unknown) => {
      const data = payload as { pane: string };
      if (data?.pane) {
        onPanelClick(data.pane);
      }
    };

    world.on(EventType.UI_OPEN_PANE, onOpenPane);
    return () => {
      world.off(EventType.UI_OPEN_PANE, onOpenPane);
    };
  }, [world, onPanelClick]);
}

/**
 * useInterfaceUIState - Simple UI state for modal toggles
 *
 * @returns UI state and setters
 */
export function useInterfaceUIState() {
  const [worldMapOpen, setWorldMapOpen] = useState(false);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [deathModalOpen, setDeathModalOpen] = useState(false);

  const toggleWorldMap = useCallback(() => {
    setWorldMapOpen((prev) => !prev);
  }, []);

  return {
    worldMapOpen,
    setWorldMapOpen,
    statsModalOpen,
    setStatsModalOpen,
    deathModalOpen,
    setDeathModalOpen,
    toggleWorldMap,
  };
}
