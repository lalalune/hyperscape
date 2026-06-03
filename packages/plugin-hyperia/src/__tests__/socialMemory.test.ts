import { describe, it, expect, beforeEach } from "vitest";
import {
  recordEncounter,
  recordSocialAction,
  getTimeSinceLastSocial,
} from "../providers/socialMemory";

describe("socialMemory", () => {
  describe("recordEncounter", () => {
    it("creates a new encounter for unknown player", () => {
      recordEncounter("agent-new-1", "player-1", "Alice");

      recordEncounter("agent-new-1", "player-1", "Alice");
    });

    it("increments meetCount on repeated encounters", () => {
      const testAgent = "agent-meet-count";

      recordEncounter(testAgent, "player-repeat", "Bob");
      recordEncounter(testAgent, "player-repeat", "Bob");
      recordEncounter(testAgent, "player-repeat", "Bob");
    });

    it("adds notes without duplicates", () => {
      const testAgent = "agent-notes";
      recordEncounter(
        testAgent,
        "player-notes",
        "Charlie",
        "helped with quest",
      );
      recordEncounter(
        testAgent,
        "player-notes",
        "Charlie",
        "helped with quest",
      );
      recordEncounter(testAgent, "player-notes", "Charlie", "traded items");
    });

    it("handles undefined note gracefully", () => {
      recordEncounter("agent-no-note", "player-5", "Eve");
      recordEncounter("agent-no-note", "player-5", "Eve", undefined);
    });
  });

  describe("recordSocialAction / getTimeSinceLastSocial", () => {
    it("returns Infinity when no social action recorded", () => {
      const time = getTimeSinceLastSocial();
      expect(time).toBeGreaterThanOrEqual(0);
    });

    it("returns small value immediately after recordSocialAction", () => {
      recordSocialAction();
      const time = getTimeSinceLastSocial();
      expect(time).toBeLessThan(100);
    });
  });
});
