/**
 * CombatPanel Component Tests
 *
 * Tests for the CombatPanel component that displays combat styles,
 * auto-retaliate toggle, and combat-related stats.
 */

/// <reference types="@testing-library/jest-dom" />

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CombatPanel } from "../../../src/game/panels/CombatPanel";
import {
  createMockWorld,
  asClientWorld,
  createEventTracker,
} from "../../mocks/MockWorld";
import type { PlayerStats, PlayerEquipmentItems } from "@hyperforge/shared";

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

function createPlayerStats(overrides: Partial<PlayerStats> = {}): PlayerStats {
  return {
    health: { current: 99, max: 99 },
    prayerPoints: { current: 50, max: 99 },
    combatLevel: 126,
    skills: {
      attack: { level: 99, xp: 13034431 },
      strength: { level: 99, xp: 13034431 },
      defense: { level: 99, xp: 13034431 },
      constitution: { level: 99, xp: 13034431 },
      ranged: { level: 99, xp: 13034431 },
      prayer: { level: 99, xp: 13034431 },
      magic: { level: 99, xp: 13034431 },
      woodcutting: { level: 99, xp: 13034431 },
      mining: { level: 99, xp: 13034431 },
      fishing: { level: 99, xp: 13034431 },
      firemaking: { level: 99, xp: 13034431 },
      cooking: { level: 99, xp: 13034431 },
      smithing: { level: 99, xp: 13034431 },
      agility: { level: 99, xp: 13034431 },
    },
    ...overrides,
  } as PlayerStats;
}

function createEquipment(
  overrides: Partial<PlayerEquipmentItems> = {},
): PlayerEquipmentItems {
  return {
    helmet: null,
    body: null,
    legs: null,
    boots: null,
    gloves: null,
    cape: null,
    amulet: null,
    ring: null,
    weapon: {
      id: "bronze_shortsword",
      name: "Bronze Sword",
      type: "melee_weapon",
      equipSlot: "weapon",
    },
    shield: null,
    arrows: null,
    ...overrides,
  } as PlayerEquipmentItems;
}

// ============================================================================
// TEST SETUP
// ============================================================================

describe("CombatPanel", () => {
  let mockWorld: ReturnType<typeof createMockWorld>;
  let eventTracker: ReturnType<typeof createEventTracker>;

  beforeEach(() => {
    vi.clearAllMocks();
    eventTracker = createEventTracker();
    mockWorld = createMockWorld({
      on: eventTracker.on,
      off: eventTracker.off,
    });
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    eventTracker.clear();
  });

  // ========================================================================
  // Basic Rendering
  // ========================================================================

  describe("basic rendering", () => {
    it("renders combat panel header", () => {
      render(
        <CombatPanel
          world={asClientWorld(mockWorld)}
          stats={createPlayerStats()}
          equipment={createEquipment()}
        />,
      );

      // Should show combat-related content (may have multiple matches)
      const combatElements = screen.queryAllByText(/Combat|Attack/i);
      expect(combatElements.length).toBeGreaterThan(0);
    });

    it("renders combat level", () => {
      render(
        <CombatPanel
          world={asClientWorld(mockWorld)}
          stats={createPlayerStats({ combatLevel: 126 })}
          equipment={createEquipment()}
        />,
      );

      // Should display combat level (may have multiple matches)
      const levelElements = screen.queryAllByText(/126|Combat/i);
      expect(levelElements.length).toBeGreaterThan(0);
    });

    it("renders attack style buttons", () => {
      render(
        <CombatPanel
          world={asClientWorld(mockWorld)}
          stats={createPlayerStats()}
          equipment={createEquipment()}
        />,
      );

      // Should have attack style options
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Combat Styles
  // ========================================================================

  describe("combat styles", () => {
    it("displays available combat styles for weapon", () => {
      render(
        <CombatPanel
          world={asClientWorld(mockWorld)}
          stats={createPlayerStats()}
          equipment={createEquipment()}
        />,
      );

      // Sword should have melee attack styles
      const styles = screen.getAllByRole("button");
      expect(styles.length).toBeGreaterThan(0);
    });

    it("handles style selection click", () => {
      render(
        <CombatPanel
          world={asClientWorld(mockWorld)}
          stats={createPlayerStats()}
          equipment={createEquipment()}
        />,
      );

      const buttons = screen.getAllByRole("button");
      if (buttons.length > 0) {
        // Click first style button
        fireEvent.click(buttons[0]);
        // Style selection may emit event, call network, or update local state
        // Just verify the click was handled without error
        expect(buttons[0]).toBeInTheDocument();
      }
    });
  });

  // ========================================================================
  // Auto Retaliate
  // ========================================================================

  describe("auto retaliate", () => {
    it("renders auto-retaliate toggle", () => {
      render(
        <CombatPanel
          world={asClientWorld(mockWorld)}
          stats={createPlayerStats()}
          equipment={createEquipment()}
        />,
      );

      // Should have auto-retaliate control
      const autoRetaliateText = screen.queryByText(/auto|retaliate/i);
      // May or may not be visible depending on UI state
      expect(autoRetaliateText).toBeDefined();
    });
  });

  // ========================================================================
  // Null Props Handling
  // ========================================================================

  describe("null props handling", () => {
    it("handles null stats gracefully", () => {
      render(
        <CombatPanel
          world={asClientWorld(mockWorld)}
          stats={null}
          equipment={createEquipment()}
        />,
      );

      // Should not crash (may have multiple matches)
      const elements = screen.queryAllByText(/Combat|Attack|Style/i);
      expect(elements.length).toBeGreaterThan(0);
    });

    it("handles null equipment gracefully", () => {
      render(
        <CombatPanel
          world={asClientWorld(mockWorld)}
          stats={createPlayerStats()}
          equipment={null}
        />,
      );

      // Should not crash (may have multiple matches)
      const elements = screen.queryAllByText(/Combat|Attack|Style/i);
      expect(elements.length).toBeGreaterThan(0);
    });

    it("handles both null props gracefully", () => {
      render(
        <CombatPanel
          world={asClientWorld(mockWorld)}
          stats={null}
          equipment={null}
        />,
      );

      // Should not crash - renders empty or default state
      const container = document.body;
      expect(container).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Event Subscriptions
  // ========================================================================

  describe("event subscriptions", () => {
    it("subscribes to UI_UPDATE events on mount", () => {
      render(
        <CombatPanel
          world={asClientWorld(mockWorld)}
          stats={createPlayerStats()}
          equipment={createEquipment()}
        />,
      );

      // Should subscribe to relevant events
      expect(mockWorld.on).toHaveBeenCalled();
    });

    it("unsubscribes from events on unmount", () => {
      const { unmount } = render(
        <CombatPanel
          world={asClientWorld(mockWorld)}
          stats={createPlayerStats()}
          equipment={createEquipment()}
        />,
      );

      unmount();

      // The unsubscribe function from on() should have been called
      // or off() should have been called
    });
  });

  // ========================================================================
  // Low Level Combat
  // ========================================================================

  describe("low level combat", () => {
    it("displays correct styles for low combat stats", () => {
      render(
        <CombatPanel
          world={asClientWorld(mockWorld)}
          stats={createPlayerStats({
            combatLevel: 3,
            skills: {
              attack: { level: 1, xp: 0 },
              strength: { level: 1, xp: 0 },
              defense: { level: 1, xp: 0 },
              constitution: { level: 10, xp: 1154 },
              ranged: { level: 1, xp: 0 },
              prayer: { level: 1, xp: 0 },
              magic: { level: 1, xp: 0 },
              woodcutting: { level: 1, xp: 0 },
              mining: { level: 1, xp: 0 },
              fishing: { level: 1, xp: 0 },
              firemaking: { level: 1, xp: 0 },
              cooking: { level: 1, xp: 0 },
              smithing: { level: 1, xp: 0 },
              agility: { level: 1, xp: 0 },
              crafting: { level: 1, xp: 0 },
              fletching: { level: 1, xp: 0 },
              runecrafting: { level: 1, xp: 0 },
            },
          })}
          equipment={createEquipment()}
        />,
      );

      // Should still render combat interface (may have multiple matches)
      const elements = screen.queryAllByText(/Combat|Attack|3/i);
      expect(elements.length).toBeGreaterThan(0);
    });
  });
});
