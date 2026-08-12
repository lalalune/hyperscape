import { readFile } from "node:fs/promises";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ITEMS, ProcessingDataProvider } from "@hyperforge/shared";

import {
  buildWorkerItemDataSnapshot,
  buildWorkerProcessingRecipeSnapshot,
} from "../AgentBehaviorBridge";

describe("AgentBehaviorBridge production recipe snapshot", () => {
  const previousItems = new Map<string, unknown>();

  beforeAll(async () => {
    const [
      cooking,
      firemaking,
      smelting,
      smithing,
      crafting,
      tanning,
      fletching,
      runecrafting,
    ] = await Promise.all(
      [
        "cooking",
        "firemaking",
        "smelting",
        "smithing",
        "crafting",
        "tanning",
        "fletching",
        "runecrafting",
      ].map(async (name) =>
        JSON.parse(
          await readFile(
            new URL(
              `../../../../world/assets/manifests/recipes/${name}.json`,
              import.meta.url,
            ),
            "utf8",
          ),
        ),
      ),
    );
    const itemIds = new Set<string>();
    for (const recipe of cooking.recipes) itemIds.add(recipe.raw);
    for (const recipe of firemaking.recipes) itemIds.add(recipe.log);
    for (const recipe of smelting.recipes) itemIds.add(recipe.output);
    for (const recipe of smithing.recipes) itemIds.add(recipe.output);
    for (const recipe of crafting.recipes) {
      itemIds.add(recipe.output);
      for (const input of recipe.inputs) itemIds.add(input.item);
      for (const tool of recipe.tools) itemIds.add(tool);
      for (const consumable of recipe.consumables) {
        itemIds.add(consumable.item);
      }
    }
    for (const recipe of tanning.recipes) {
      itemIds.add(recipe.input);
      itemIds.add(recipe.output);
    }
    for (const recipe of fletching.recipes) {
      itemIds.add(recipe.output);
      for (const input of recipe.inputs) itemIds.add(input.item);
      for (const tool of recipe.tools) itemIds.add(tool);
    }
    for (const recipe of runecrafting.recipes) {
      itemIds.add(recipe.runeItemId);
      for (const essence of recipe.essenceTypes) itemIds.add(essence);
    }
    for (const itemId of itemIds) {
      previousItems.set(itemId, ITEMS.get(itemId));
      if (!ITEMS.has(itemId)) {
        ITEMS.set(itemId, {
          id: itemId,
          name: itemId,
          type: "resource",
        } as never);
      }
    }

    const provider = ProcessingDataProvider.getInstance();
    provider.loadCookingRecipes(cooking);
    provider.loadFiremakingRecipes(firemaking);
    provider.loadSmeltingRecipes(smelting);
    provider.loadSmithingRecipes(smithing);
    provider.loadCraftingRecipes(crafting);
    provider.loadTanningRecipes(tanning);
    provider.loadFletchingRecipes(fletching);
    provider.loadRunecraftingRecipes(runecrafting);
    provider.rebuild();
  });

  afterAll(() => {
    for (const [itemId, item] of previousItems) {
      if (item) ITEMS.set(itemId, item as never);
      else ITEMS.delete(itemId);
    }
  });

  it("preserves every loaded cooking, smelting, and Smithing recipe exactly", () => {
    const provider = ProcessingDataProvider.getInstance();
    const snapshot = new Map(buildWorkerItemDataSnapshot());

    expect(provider.getCookableItemIds().size).toBeGreaterThan(0);
    for (const rawItemId of provider.getCookableItemIds()) {
      const recipe = provider.getCookingData(rawItemId);
      expect(snapshot.get(rawItemId)?.cooking).toEqual({
        cookedItemId: recipe?.cookedItemId,
        levelRequired: recipe?.levelRequired,
      });
    }

    expect(provider.getSmeltableBarIds().size).toBeGreaterThan(0);
    for (const barItemId of provider.getSmeltableBarIds()) {
      const recipe = provider.getSmeltingData(barItemId);
      expect(recipe?.inputs).toBeDefined();
      expect(snapshot.get(barItemId)?.smelting).toEqual({
        inputs: recipe?.inputs,
        levelRequired: recipe?.levelRequired,
      });
    }

    const smithingRecipes = provider.getAllSmithingRecipes();
    expect(smithingRecipes.length).toBeGreaterThan(0);
    for (const recipe of smithingRecipes) {
      expect(snapshot.get(recipe.itemId)?.smithing).toEqual({
        barItemId: recipe.barType,
        barsRequired: recipe.barsRequired,
        levelRequired: recipe.levelRequired,
      });
    }

    expect(() => structuredClone([...snapshot])).not.toThrow();
  });

  it("preserves every non-item-keyed processing recipe exactly", () => {
    const provider = ProcessingDataProvider.getInstance();
    const snapshot = buildWorkerProcessingRecipeSnapshot();

    expect(snapshot.firemaking).toHaveLength(provider.getBurnableLogIds().size);
    expect(snapshot.firemaking.length).toBeGreaterThan(0);
    expect(snapshot.crafting).toHaveLength(
      provider.getAllCraftingRecipes().length,
    );
    expect(snapshot.crafting.length).toBeGreaterThan(0);
    expect(snapshot.tanning).toHaveLength(
      provider.getAllTanningRecipes().length,
    );
    expect(snapshot.tanning.length).toBeGreaterThan(0);
    expect(snapshot.fletching).toHaveLength(
      provider.getAllFletchingRecipes().length,
    );
    expect(snapshot.fletching.length).toBeGreaterThan(0);
    expect(snapshot.runecrafting).toHaveLength(
      provider.getAllRunecraftingRecipes().length,
    );
    expect(snapshot.runecrafting.length).toBeGreaterThan(0);

    for (const recipe of provider.getAllFletchingRecipes()) {
      expect(
        snapshot.fletching.find(
          (candidate) => candidate.recipeId === recipe.recipeId,
        ),
      ).toEqual({
        recipeId: recipe.recipeId,
        outputItemId: recipe.output,
        outputQuantity: recipe.outputQuantity,
        category: recipe.category,
        inputs: recipe.inputs.map((input) => ({
          itemId: input.item,
          quantity: input.amount,
        })),
        tools: recipe.tools,
        levelRequired: recipe.level,
      });
    }
    for (const recipe of provider.getAllRunecraftingRecipes()) {
      expect(
        snapshot.runecrafting.find(
          (candidate) => candidate.runeType === recipe.runeType,
        ),
      ).toEqual({
        runeType: recipe.runeType,
        runeItemId: recipe.runeItemId,
        essenceItemIds: recipe.essenceTypes,
        levelRequired: recipe.levelRequired,
      });
    }
    expect(() => structuredClone(snapshot)).not.toThrow();
  });

  it("publishes only exact guaranteed authored mob-drop sources", async () => {
    const npcs = JSON.parse(
      await readFile(
        new URL(
          "../../../../world/assets/manifests/npcs.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as Array<{
      id: string;
      category: string;
      drops?: {
        defaultDrop?: { enabled: boolean; itemId: string };
        always?: Array<{ itemId: string; chance: number }>;
        common?: Array<{ itemId: string; chance: number }>;
        uncommon?: Array<{ itemId: string; chance: number }>;
        rare?: Array<{ itemId: string; chance: number }>;
        veryRare?: Array<{ itemId: string; chance: number }>;
      };
    }>;
    const combatNpcs = npcs.filter((entry) =>
      ["mob", "boss", "quest"].includes(entry.category),
    );
    const snapshot = buildWorkerProcessingRecipeSnapshot(combatNpcs as never);
    expect(snapshot.guaranteedMobDrops?.length).toBeGreaterThan(0);

    for (const npc of combatNpcs) {
      const drops = npc.drops;
      if (!drops) continue;
      const expected = [
        ...(drops.defaultDrop?.enabled ? [drops.defaultDrop.itemId] : []),
        ...[
          ...(drops.always ?? []),
          ...(drops.common ?? []),
          ...(drops.uncommon ?? []),
          ...(drops.rare ?? []),
          ...(drops.veryRare ?? []),
        ]
          .filter((drop) => drop.chance === 1)
          .map((drop) => drop.itemId),
      ];
      const actual = snapshot.guaranteedMobDrops?.find(
        (source) => source.mobType === npc.id,
      )?.itemIds;
      if (expected.length === 0) {
        expect(actual).toBeUndefined();
      } else {
        expect(actual).toEqual(
          [...new Set(expected)].sort((a, b) => a.localeCompare(b)),
        );
      }
    }

    expect(
      snapshot.guaranteedMobDrops?.find((source) => source.mobType === "cow")
        ?.itemIds,
    ).toContain("cowhide");
    expect(
      snapshot.guaranteedMobDrops?.find((source) => source.mobType === "goblin")
        ?.itemIds,
    ).toContain("coins");
  });

  it("preserves exact loaded gathering outputs and tool requirements", async () => {
    const [woodcutting, mining, fishing] = await Promise.all(
      ["woodcutting", "mining", "fishing"].map(async (name) =>
        JSON.parse(
          await readFile(
            new URL(
              `../../../../world/assets/manifests/gathering/${name}.json`,
              import.meta.url,
            ),
            "utf8",
          ),
        ),
      ),
    );
    const resources = [...woodcutting.trees, ...mining.rocks, ...fishing.spots];
    const globals = globalThis as {
      EXTERNAL_RESOURCES?: Map<string, (typeof resources)[number]>;
    };
    const previous = globals.EXTERNAL_RESOURCES;
    globals.EXTERNAL_RESOURCES = new Map(
      resources.map((resource) => [resource.id, resource]),
    );
    try {
      const snapshot = buildWorkerProcessingRecipeSnapshot();
      expect(snapshot.gathering).toHaveLength(resources.length);
      for (const resource of resources) {
        expect(
          snapshot.gathering.find(
            (candidate) => candidate.resourceId === resource.id,
          ),
        ).toEqual({
          resourceId: resource.id,
          harvestSkill: resource.harvestSkill,
          toolRequired: resource.toolRequired,
          levelRequired: resource.levelRequired,
          outputItemIds: [
            ...new Set<string>(
              resource.harvestYield.map(
                (drop: { itemId: string }) => drop.itemId,
              ),
            ),
          ].sort((a, b) => a.localeCompare(b)),
        });
      }
      expect(() => structuredClone(snapshot.gathering)).not.toThrow();
    } finally {
      if (previous) globals.EXTERNAL_RESOURCES = previous;
      else delete globals.EXTERNAL_RESOURCES;
    }
  });

  it("contains authored public recipes but no player custody or wallet state", () => {
    const serialized = JSON.stringify({
      items: buildWorkerItemDataSnapshot(),
      recipes: buildWorkerProcessingRecipeSnapshot(),
    });
    expect(serialized).toContain('"cooking"');
    expect(serialized).toContain('"smelting"');
    expect(serialized).toContain('"smithing"');
    expect(serialized).toContain('"fletching"');
    expect(serialized).toContain('"runecrafting"');
    expect(serialized).toContain('"gathering"');
    expect(serialized).not.toMatch(
      /bankItems|bankQuantity|inventoryItems|coinBalance|processingConsumableUses|wallet|privateKey|secretKey/,
    );
  });
});
