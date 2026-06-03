import { describe, it, expect } from "vitest";
import {
  resolveLocation,
  findAllLocations,
  parseLocationFromMessage,
} from "../utils/location-resolver";
import type { Entity } from "../types";

function makeEntity(name: string, position: [number, number, number]): Entity {
  return {
    id: `entity-${name.toLowerCase().replace(/\s/g, "-")}`,
    name,
    position,
  } as Entity;
}

const ENTITIES: Entity[] = [
  makeEntity("Furnace", [10, 0, 10]),
  makeEntity("Anvil", [15, 0, 12]),
  makeEntity("Oak Tree", [5, 0, 20]),
  makeEntity("Willow Tree", [8, 0, 25]),
  makeEntity("Fishing Spot", [30, 0, 30]),
  makeEntity("Bank Booth", [50, 0, 50]),
  makeEntity("Goblin", [40, 0, 15]),
  makeEntity("General Store", [55, 0, 48]),
  makeEntity("Copper Rock", [20, 0, 5]),
];

describe("location-resolver", () => {
  describe("resolveLocation", () => {
    it("resolves exact name match", () => {
      const result = resolveLocation("furnace", ENTITIES, [0, 0, 0]);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Furnace");
      expect(result!.category).toBe("station");
      expect(result!.position).toEqual([10, 0, 10]);
    });

    it("resolves alias match (mine -> rock)", () => {
      const result = resolveLocation("mine", ENTITIES, [0, 0, 0]);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Copper Rock");
    });

    it("resolves tree query to nearest tree", () => {
      const result = resolveLocation("tree", ENTITIES, [0, 0, 0]);
      expect(result).not.toBeNull();
      expect(result!.name).toContain("Tree");
      expect(result!.category).toBe("resource");
    });

    it("resolves bank query", () => {
      const result = resolveLocation("bank", ENTITIES, [0, 0, 0]);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Bank Booth");
      expect(result!.category).toBe("bank");
    });

    it("resolves shop/store query", () => {
      const result = resolveLocation("shop", ENTITIES, [0, 0, 0]);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("General Store");
    });

    it("resolves fishing query", () => {
      const result = resolveLocation("fishing", ENTITIES, [0, 0, 0]);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Fishing Spot");
    });

    it("returns null for unknown location", () => {
      const result = resolveLocation("volcano", ENTITIES, [0, 0, 0]);
      expect(result).toBeNull();
    });

    it("calculates distance from player position", () => {
      const result = resolveLocation("furnace", ENTITIES, [0, 0, 0]);
      expect(result).not.toBeNull();
      expect(result!.distance).toBeGreaterThan(0);
      expect(result!.distance).toBeCloseTo(Math.sqrt(200), 1);
    });

    it("handles entities without position gracefully", () => {
      const entities = [{ id: "no-pos", name: "Furnace" } as Entity];
      const result = resolveLocation("furnace", entities, [0, 0, 0]);
      expect(result).toBeNull();
    });

    it("handles empty entity list", () => {
      const result = resolveLocation("furnace", [], [0, 0, 0]);
      expect(result).toBeNull();
    });

    it("handles case-insensitive queries", () => {
      const result = resolveLocation("FURNACE", ENTITIES, [0, 0, 0]);
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Furnace");
    });
  });

  describe("findAllLocations", () => {
    it("finds all matching locations for tree query", () => {
      const results = findAllLocations("tree", ENTITIES, [0, 0, 0]);
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.every((r) => r.name.toLowerCase().includes("tree"))).toBe(
        true,
      );
    });

    it("sorts by distance", () => {
      const results = findAllLocations("tree", ENTITIES, [0, 0, 0]);
      for (let i = 1; i < results.length; i++) {
        expect(results[i].distance!).toBeGreaterThanOrEqual(
          results[i - 1].distance!,
        );
      }
    });

    it("limits results to specified count", () => {
      const results = findAllLocations("tree", ENTITIES, [0, 0, 0], 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it("returns empty array for no matches", () => {
      const results = findAllLocations("volcano", ENTITIES, [0, 0, 0]);
      expect(results).toHaveLength(0);
    });
  });

  describe("parseLocationFromMessage", () => {
    it("parses 'go to the furnace'", () => {
      expect(parseLocationFromMessage("go to the furnace")).toBe("furnace");
    });

    it("parses 'move to a bank'", () => {
      expect(parseLocationFromMessage("move to a bank")).toBe("bank");
    });

    it("parses 'walk to the fishing spot'", () => {
      expect(parseLocationFromMessage("walk to the fishing spot")).toBe(
        "fishing spot",
      );
    });

    it("parses 'find the anvil'", () => {
      expect(parseLocationFromMessage("find the anvil")).toBe("anvil");
    });

    it("parses 'take me to the store please'", () => {
      expect(parseLocationFromMessage("take me to the store please")).toBe(
        "store",
      );
    });

    it("parses 'where is the bank'", () => {
      expect(parseLocationFromMessage("where is the bank")).toBe("bank");
    });

    it("removes trailing punctuation", () => {
      expect(parseLocationFromMessage("go to the furnace!")).toBe("furnace");
      expect(parseLocationFromMessage("go to the furnace?")).toBe("furnace");
    });

    it("returns null for unrecognized patterns", () => {
      expect(parseLocationFromMessage("hello there")).toBeNull();
      expect(parseLocationFromMessage("nice weather today")).toBeNull();
    });
  });
});
