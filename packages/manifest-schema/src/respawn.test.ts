/**
 * Faithfulness + defensiveness tests for `RespawnManifestSchema`.
 */

import { describe, expect, it } from "vitest";

import { RespawnManifestSchema, type RespawnManifest } from "./respawn.js";

const reference: RespawnManifest = {
  enabled: true,
  bindPoints: [
    {
      id: "stormwindCathedral",
      name: "Stormwind Cathedral",
      description: "Priests accept bind here.",
      iconId: "icon.church",
      kind: "innkeeper",
      zoneId: "stormwindCity",
      position: { x: 100, y: 10, z: -200 },
      facingYawRadians: 0,
      allowBindHere: true,
      corpseRunAllowed: true,
      applyResurrectionSickness: false,
      minCharacterLevel: 0,
      factionAllowList: ["alliance"],
      customKey: "",
    },
    {
      id: "duskwoodGraveyard",
      name: "Duskwood Graveyard",
      description: "",
      iconId: "",
      kind: "graveyard",
      zoneId: "duskwood",
      position: { x: 1500, y: 5, z: 800 },
      facingYawRadians: 1.57,
      allowBindHere: false,
      corpseRunAllowed: true,
      applyResurrectionSickness: true,
      minCharacterLevel: 0,
      factionAllowList: [],
      customKey: "",
    },
  ],
  deathPenalty: {
    xpLossFractionOfLevel: 0.1,
    xpLossCanDelevel: false,
    goldLossFraction: 0,
    goldLossMaxCurrency: 0,
    durabilityLossFraction: 0.1,
    dropItemsOnDeath: false,
    maxItemsDropped: 0,
    dropPolicy: "none",
    dropGraceSec: 60,
  },
  corpseRun: {
    enabled: true,
    ghostSpeedMultiplier: 1.25,
    ghostInvisibleToEnemies: true,
    ghostInvulnerable: true,
    corpseDespawnMinutes: 120,
    corpseLootableByOthers: false,
    resurrectOnProximityMeters: 3,
    allowCorpseTeleport: false,
  },
  resurrection: {
    sicknessMinutes: 10,
    sicknessStatReductionFraction: 0.75,
    allowInstantResByAbility: true,
    autoResAtBindAfterSec: 30,
    allowSpiritGuideRes: true,
    sicknessMinCharacterLevel: 10,
  },
};

describe("RespawnManifestSchema", () => {
  it("parses the reference manifest cleanly", () => {
    const result = RespawnManifestSchema.safeParse(reference);
    if (!result.success) {
      throw new Error(
        `Reference manifest failed validation:\n${JSON.stringify(result.error.format(), null, 2)}`,
      );
    }
    expect(result.success).toBe(true);
  });

  it("rejects empty bindPoints when enabled", () => {
    const bad = { enabled: true, bindPoints: [] };
    expect(RespawnManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts empty bindPoints when disabled", () => {
    const ok = { enabled: false, bindPoints: [] };
    expect(RespawnManifestSchema.safeParse(ok).success).toBe(true);
  });

  it("rejects bindPoints with none allowBindHere=true when enabled", () => {
    const bad = {
      enabled: true,
      bindPoints: [
        {
          id: "gy1",
          name: "GY1",
          kind: "graveyard",
          zoneId: "zone1",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: false,
        },
      ],
    };
    expect(RespawnManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts one bindPoint with allowBindHere=true", () => {
    const ok = {
      bindPoints: [
        {
          id: "inn1",
          name: "Inn",
          kind: "innkeeper",
          zoneId: "zone1",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
        },
      ],
    };
    expect(RespawnManifestSchema.safeParse(ok).success).toBe(true);
  });

  it("rejects duplicate bindPoint ids", () => {
    const bad = {
      bindPoints: [
        {
          id: "gy",
          name: "A",
          kind: "graveyard",
          zoneId: "zone",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
        },
        {
          id: "gy",
          name: "B",
          kind: "graveyard",
          zoneId: "zone",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: false,
        },
      ],
    };
    expect(RespawnManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects unknown bind kind", () => {
    const bad = {
      bindPoints: [
        {
          id: "x",
          name: "X",
          kind: "cryopod",
          zoneId: "zone",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
        },
      ],
    };
    expect(RespawnManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts all 7 bind kinds", () => {
    const kinds = [
      "graveyard",
      "innkeeper",
      "capitalSpawn",
      "dungeonEntrance",
      "raidEntrance",
      "playerHousing",
      "custom",
    ];
    for (const kind of kinds) {
      const ok = {
        bindPoints: [
          {
            id: "x",
            name: "X",
            kind,
            zoneId: "zone",
            position: { x: 0, y: 0, z: 0 },
            allowBindHere: true,
            ...(kind === "custom" ? { customKey: "guildHall" } : {}),
          },
        ],
      };
      expect(RespawnManifestSchema.safeParse(ok).success).toBe(true);
    }
  });

  it("rejects custom kind without customKey", () => {
    const bad = {
      bindPoints: [
        {
          id: "x",
          name: "X",
          kind: "custom",
          zoneId: "zone",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
        },
      ],
    };
    expect(RespawnManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts custom kind with customKey", () => {
    const ok = {
      bindPoints: [
        {
          id: "x",
          name: "X",
          kind: "custom",
          zoneId: "zone",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
          customKey: "guildHall",
        },
      ],
    };
    expect(RespawnManifestSchema.safeParse(ok).success).toBe(true);
  });

  it("rejects bad bindPoint id", () => {
    const bad = {
      bindPoints: [
        {
          id: "Has Spaces",
          name: "X",
          kind: "graveyard",
          zoneId: "zone",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
        },
      ],
    };
    expect(RespawnManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects xpLossFraction > 1", () => {
    const bad = {
      bindPoints: [
        {
          id: "b",
          name: "B",
          kind: "graveyard",
          zoneId: "z",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
        },
      ],
      deathPenalty: { xpLossFractionOfLevel: 1.5 },
    };
    expect(RespawnManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects dropItemsOnDeath=true with dropPolicy='none'", () => {
    const bad = {
      bindPoints: [
        {
          id: "b",
          name: "B",
          kind: "graveyard",
          zoneId: "z",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
        },
      ],
      deathPenalty: {
        dropItemsOnDeath: true,
        dropPolicy: "none",
        maxItemsDropped: 3,
      },
    };
    expect(RespawnManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects dropItemsOnDeath=true with maxItemsDropped=0", () => {
    const bad = {
      bindPoints: [
        {
          id: "b",
          name: "B",
          kind: "graveyard",
          zoneId: "z",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
        },
      ],
      deathPenalty: {
        dropItemsOnDeath: true,
        dropPolicy: "lowestValueFirst",
        maxItemsDropped: 0,
      },
    };
    expect(RespawnManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts dropItemsOnDeath=true with lowestValueFirst policy (tile-based MMORPG 3-item rule)", () => {
    const ok = {
      bindPoints: [
        {
          id: "b",
          name: "B",
          kind: "graveyard",
          zoneId: "z",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
        },
      ],
      deathPenalty: {
        dropItemsOnDeath: true,
        dropPolicy: "lowestValueFirst",
        maxItemsDropped: 3,
      },
    };
    expect(RespawnManifestSchema.safeParse(ok).success).toBe(true);
  });

  it("accepts dropItemsOnDeath=false with any policy", () => {
    const ok = {
      bindPoints: [
        {
          id: "b",
          name: "B",
          kind: "graveyard",
          zoneId: "z",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
        },
      ],
      deathPenalty: {
        dropItemsOnDeath: false,
        dropPolicy: "none",
        maxItemsDropped: 0,
      },
    };
    expect(RespawnManifestSchema.safeParse(ok).success).toBe(true);
  });

  it("accepts all 4 dropPolicy values", () => {
    const policies = [
      "none",
      "inventoryUnequipped",
      "inventoryAndEquipped",
      "lowestValueFirst",
    ];
    for (const p of policies) {
      const shouldDrop = p !== "none";
      const ok = {
        bindPoints: [
          {
            id: "b",
            name: "B",
            kind: "graveyard",
            zoneId: "z",
            position: { x: 0, y: 0, z: 0 },
            allowBindHere: true,
          },
        ],
        deathPenalty: {
          dropItemsOnDeath: shouldDrop,
          dropPolicy: p,
          maxItemsDropped: shouldDrop ? 3 : 0,
        },
      };
      expect(RespawnManifestSchema.safeParse(ok).success).toBe(true);
    }
  });

  it("rejects corpseLootableByOthers=true with corpseRun.enabled=false", () => {
    const bad = {
      bindPoints: [
        {
          id: "b",
          name: "B",
          kind: "graveyard",
          zoneId: "z",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
        },
      ],
      corpseRun: { enabled: false, corpseLootableByOthers: true },
    };
    expect(RespawnManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts corpseRun disabled (instant respawn at bind)", () => {
    const ok = {
      bindPoints: [
        {
          id: "b",
          name: "B",
          kind: "graveyard",
          zoneId: "z",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
        },
      ],
      corpseRun: { enabled: false, corpseLootableByOthers: false },
    };
    expect(RespawnManifestSchema.safeParse(ok).success).toBe(true);
  });

  it("rejects ghostSpeedMultiplier > 3", () => {
    const bad = {
      bindPoints: [
        {
          id: "b",
          name: "B",
          kind: "graveyard",
          zoneId: "z",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
        },
      ],
      corpseRun: { ghostSpeedMultiplier: 10 },
    };
    expect(RespawnManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects ghostSpeedMultiplier < 0.5", () => {
    const bad = {
      bindPoints: [
        {
          id: "b",
          name: "B",
          kind: "graveyard",
          zoneId: "z",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
        },
      ],
      corpseRun: { ghostSpeedMultiplier: 0.1 },
    };
    expect(RespawnManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts corpseDespawnMinutes=0 (never despawns)", () => {
    const ok = {
      bindPoints: [
        {
          id: "b",
          name: "B",
          kind: "graveyard",
          zoneId: "z",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
        },
      ],
      corpseRun: { corpseDespawnMinutes: 0 },
    };
    expect(RespawnManifestSchema.safeParse(ok).success).toBe(true);
  });

  it("rejects sicknessMinutes > 0 with reductionFraction=0", () => {
    const bad = {
      bindPoints: [
        {
          id: "b",
          name: "B",
          kind: "graveyard",
          zoneId: "z",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
        },
      ],
      resurrection: { sicknessMinutes: 10, sicknessStatReductionFraction: 0 },
    };
    expect(RespawnManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts sicknessMinutes=0 with reductionFraction=0", () => {
    const ok = {
      bindPoints: [
        {
          id: "b",
          name: "B",
          kind: "graveyard",
          zoneId: "z",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
        },
      ],
      resurrection: { sicknessMinutes: 0, sicknessStatReductionFraction: 0 },
    };
    expect(RespawnManifestSchema.safeParse(ok).success).toBe(true);
  });

  it("accepts autoResAtBindAfterSec=0 (no auto-res, ghost required)", () => {
    const ok = {
      bindPoints: [
        {
          id: "b",
          name: "B",
          kind: "graveyard",
          zoneId: "z",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
        },
      ],
      resurrection: { autoResAtBindAfterSec: 0 },
    };
    expect(RespawnManifestSchema.safeParse(ok).success).toBe(true);
  });

  it("rejects autoResAtBindAfterSec > 1800 (30 min)", () => {
    const bad = {
      bindPoints: [
        {
          id: "b",
          name: "B",
          kind: "graveyard",
          zoneId: "z",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
        },
      ],
      resurrection: { autoResAtBindAfterSec: 9999 },
    };
    expect(RespawnManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects unknown top-level field (strict mode)", () => {
    const bad = { extra: "nope" };
    expect(RespawnManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects unknown deathPenalty field (strict mode)", () => {
    const bad = {
      bindPoints: [
        {
          id: "b",
          name: "B",
          kind: "graveyard",
          zoneId: "z",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
        },
      ],
      deathPenalty: { extra: "nope" },
    };
    expect(RespawnManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects unknown bindPoint field (strict mode)", () => {
    const bad = {
      bindPoints: [
        {
          id: "b",
          name: "B",
          kind: "graveyard",
          zoneId: "z",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
          extra: "nope",
        },
      ],
    };
    expect(RespawnManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects bad zoneId format", () => {
    const bad = {
      bindPoints: [
        {
          id: "b",
          name: "B",
          kind: "graveyard",
          zoneId: "Has Spaces",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
        },
      ],
    };
    expect(RespawnManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects facingYaw > 2π", () => {
    const bad = {
      bindPoints: [
        {
          id: "b",
          name: "B",
          kind: "graveyard",
          zoneId: "z",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
          facingYawRadians: 999,
        },
      ],
    };
    expect(RespawnManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts factionAllowList with multiple factions", () => {
    const ok = {
      bindPoints: [
        {
          id: "b",
          name: "B",
          kind: "graveyard",
          zoneId: "z",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
          factionAllowList: ["alliance", "pandaren"],
        },
      ],
    };
    expect(RespawnManifestSchema.safeParse(ok).success).toBe(true);
  });

  it("rejects resurrectOnProximityMeters > 50", () => {
    const bad = {
      bindPoints: [
        {
          id: "b",
          name: "B",
          kind: "graveyard",
          zoneId: "z",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
        },
      ],
      corpseRun: { resurrectOnProximityMeters: 500 },
    };
    expect(RespawnManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("applies defaults on minimal manifest", () => {
    const parsed = RespawnManifestSchema.parse({
      bindPoints: [
        {
          id: "gy",
          name: "Graveyard",
          kind: "graveyard",
          zoneId: "zone",
          position: { x: 0, y: 0, z: 0 },
          allowBindHere: true,
        },
      ],
    });
    expect(parsed.enabled).toBe(true);
    expect(parsed.deathPenalty.xpLossFractionOfLevel).toBe(0);
    expect(parsed.deathPenalty.durabilityLossFraction).toBe(0.1);
    expect(parsed.deathPenalty.dropPolicy).toBe("none");
    expect(parsed.corpseRun.enabled).toBe(true);
    expect(parsed.corpseRun.ghostSpeedMultiplier).toBe(1.25);
    expect(parsed.corpseRun.corpseDespawnMinutes).toBe(120);
    expect(parsed.resurrection.sicknessMinutes).toBe(10);
    expect(parsed.resurrection.sicknessStatReductionFraction).toBe(0.75);
    expect(parsed.resurrection.autoResAtBindAfterSec).toBe(30);
  });
});
