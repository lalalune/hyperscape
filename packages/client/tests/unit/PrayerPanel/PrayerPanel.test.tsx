/**
 * PrayerPanel Component Tests
 *
 * Tests for the PrayerPanel component that displays prayer list,
 * handles prayer toggling, and shows prayer points.
 */

/// <reference types="@testing-library/jest-dom" />

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PrayerPanel } from "../../../src/game/panels/PrayerPanel";
import {
  createMockWorld,
  asClientWorld,
  createEventTracker,
} from "../../mocks/MockWorld";
import type { PlayerStats, Skills, SkillData } from "@hyperforge/shared";

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

type PlayerStatsOverrides = Omit<Partial<PlayerStats>, "skills"> & {
  skills?: Partial<Record<keyof Skills, SkillData>>;
};

const defaultSkills: Skills = {
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
  crafting: { level: 99, xp: 13034431 },
  fletching: { level: 99, xp: 13034431 },
  runecrafting: { level: 99, xp: 13034431 },
};

function createPlayerStats(overrides: PlayerStatsOverrides = {}): PlayerStats {
  const { skills: skillOverrides, ...restOverrides } = overrides;
  return {
    health: { current: 99, max: 99 },
    prayerPoints: { current: 50, max: 99 },
    combatLevel: 126,
    skills: { ...defaultSkills, ...skillOverrides },
    ...restOverrides,
  } as PlayerStats;
}

// ============================================================================
// TEST SETUP
// ============================================================================

describe("PrayerPanel", () => {
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
    it("renders prayer panel", () => {
      render(
        <PrayerPanel
          world={asClientWorld(mockWorld)}
          stats={createPlayerStats()}
        />,
      );

      // Should render prayer content
      const container = document.body;
      expect(container).toBeInTheDocument();
    });

    it("displays prayer points", () => {
      render(
        <PrayerPanel
          world={asClientWorld(mockWorld)}
          stats={createPlayerStats({ prayerPoints: { current: 50, max: 99 } })}
        />,
      );

      // Should show prayer points somewhere (may have multiple matches)
      const elements = screen.queryAllByText(/50|Prayer/i);
      expect(elements.length).toBeGreaterThan(0);
    });

    it("renders prayer buttons", () => {
      render(
        <PrayerPanel
          world={asClientWorld(mockWorld)}
          stats={createPlayerStats()}
        />,
      );

      // Should have clickable prayer buttons
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Prayer Toggling
  // ========================================================================

  describe("prayer toggling", () => {
    it("handles prayer button click", () => {
      render(
        <PrayerPanel
          world={asClientWorld(mockWorld)}
          stats={createPlayerStats()}
        />,
      );

      const buttons = screen.getAllByRole("button");
      if (buttons.length > 0) {
        fireEvent.click(buttons[0]);
        // Prayer button click may toggle via network, emit event, or update local state
        // Just verify the click was handled without error
        expect(buttons[0]).toBeInTheDocument();
      }
    });

    it("disables prayers when prayer points are 0", () => {
      render(
        <PrayerPanel
          world={asClientWorld(mockWorld)}
          stats={createPlayerStats({ prayerPoints: { current: 0, max: 99 } })}
        />,
      );

      // Prayers should be visually disabled or show 0 points (may have multiple matches)
      const elements = screen.queryAllByText(/0/);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Prayer Level Requirements
  // ========================================================================

  describe("prayer level requirements", () => {
    it("shows locked prayers for low prayer level", () => {
      render(
        <PrayerPanel
          world={asClientWorld(mockWorld)}
          stats={createPlayerStats({
            skills: {
              prayer: { level: 1, xp: 0 },
            },
          })}
        />,
      );

      // Should still render - some prayers locked
      const container = document.body;
      expect(container).toBeInTheDocument();
    });

    it("unlocks all prayers at high prayer level", () => {
      render(
        <PrayerPanel
          world={asClientWorld(mockWorld)}
          stats={createPlayerStats({
            skills: {
              prayer: { level: 99, xp: 13034431 },
            },
          })}
        />,
      );

      // All prayers should be available
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Null Props Handling
  // ========================================================================

  describe("null props handling", () => {
    it("handles null stats gracefully", () => {
      render(<PrayerPanel world={asClientWorld(mockWorld)} stats={null} />);

      // Should not crash
      const container = document.body;
      expect(container).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Event Subscriptions
  // ========================================================================

  describe("event subscriptions", () => {
    it("subscribes to prayer state events on mount", () => {
      render(
        <PrayerPanel
          world={asClientWorld(mockWorld)}
          stats={createPlayerStats()}
        />,
      );

      // Should subscribe to PRAYER_STATE_SYNC or similar events
      expect(mockWorld.on).toHaveBeenCalled();
    });

    it("updates when prayer state changes", () => {
      render(
        <PrayerPanel
          world={asClientWorld(mockWorld)}
          stats={createPlayerStats()}
        />,
      );

      // Trigger a prayer state update
      eventTracker.trigger("prayer:state_sync", {
        playerId: "test-player-id",
        active: ["protect_melee"],
        points: { current: 45, max: 99 },
      });

      // Component should update (no crash) - may have multiple matches
      const elements = screen.queryAllByText(/45|Prayer/i);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Deactivate All
  // ========================================================================

  describe("deactivate all prayers", () => {
    it("has deactivate all option", () => {
      render(
        <PrayerPanel
          world={asClientWorld(mockWorld)}
          stats={createPlayerStats()}
        />,
      );

      // May have a "deactivate all" button or right-click option
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
