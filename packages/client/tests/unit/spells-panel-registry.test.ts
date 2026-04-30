/**
 * Proof that the SpellsPanel HUD reads spell data through the shared
 * `combatSpellsRegistry` and that `combatSpellsRegistry.onReloaded()`
 * fires across the package boundary so the panel can invalidate its
 * memoized spell list on PIE hot-reload of `combat-spells.json`.
 *
 * Companion to `xp-orb-registry.test.ts` — same pattern, different
 * registry: subscribe → load → callback fires → spellService output
 * reflects the new manifest immediately.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { combatSpellsRegistry } from "@hyperforge/shared";
import { spellService } from "@hyperforge/hyperscape";

const SAMPLE_MANIFEST = {
  standard: {
    strike: [
      {
        id: "test_strike",
        name: "Test Strike",
        level: 1,
        baseDamage: 2,
        baseExperience: 5,
        element: "air" as const,
        runeRequirements: [{ runeId: "airRune", quantity: 1 }],
        autocastable: true,
        cooldownTicks: 5,
        manaCost: 5,
      },
    ],
    bolt: [
      {
        id: "test_bolt",
        name: "Test Bolt",
        level: 17,
        baseDamage: 9,
        baseExperience: 22,
        element: "air" as const,
        runeRequirements: [
          { runeId: "airRune", quantity: 2 },
          { runeId: "chaosRune", quantity: 1 },
        ],
        autocastable: true,
        cooldownTicks: 5,
        manaCost: 10,
      },
    ],
  },
};

beforeEach(() => {
  // Start each test from an unloaded state so the registry-prefer-
  // fallback branch in spellService is exercised symmetrically.
  combatSpellsRegistry.load({ standard: { strike: [], bolt: [] } });
});

afterEach(() => {
  combatSpellsRegistry.load({ standard: { strike: [], bolt: [] } });
});

describe("SpellsPanel HUD → combatSpellsRegistry consumer wiring", () => {
  it("spellService.getAllSpells returns registry contents when loaded", () => {
    combatSpellsRegistry.load(SAMPLE_MANIFEST);
    const all = spellService.getAllSpells();
    const ids = all.map((s) => s.id);
    expect(ids).toContain("test_strike");
    expect(ids).toContain("test_bolt");
  });

  it("subsequent load() swaps the spell catalog atomically", () => {
    combatSpellsRegistry.load(SAMPLE_MANIFEST);
    expect(spellService.getAllSpells().map((s) => s.id)).toEqual([
      "test_strike",
      "test_bolt",
    ]);

    // Editor save: replace the entire catalog with one new spell.
    combatSpellsRegistry.load({
      standard: {
        strike: [
          {
            id: "editor_only",
            name: "Editor Only",
            level: 5,
            baseDamage: 3,
            baseExperience: 7,
            element: "fire",
            runeRequirements: [{ runeId: "fireRune", quantity: 1 }],
            autocastable: true,
            cooldownTicks: 5,
            manaCost: 5,
          },
        ],
        bolt: [],
      },
    });
    expect(spellService.getAllSpells().map((s) => s.id)).toEqual([
      "editor_only",
    ]);
  });
});

describe("SpellsPanel HUD → combatSpellsRegistry.onReloaded() subscription", () => {
  it("fires HUD-side reload listener on every registry load (boot + PIE)", () => {
    const calls: number[] = [];
    const unsubscribe = combatSpellsRegistry.onReloaded(() =>
      calls.push(calls.length),
    );

    combatSpellsRegistry.load(SAMPLE_MANIFEST);
    expect(calls.length).toBe(1);

    combatSpellsRegistry.load({
      standard: {
        strike: [SAMPLE_MANIFEST.standard.strike[0]!],
        bolt: [],
      },
    });
    expect(calls.length).toBe(2);

    unsubscribe();
    combatSpellsRegistry.load({ standard: { strike: [], bolt: [] } });
    // No more notifications after unsubscribe — the panel's useEffect
    // cleanup is what calls this on unmount.
    expect(calls.length).toBe(2);
  });
});
