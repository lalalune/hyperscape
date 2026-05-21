/**
 * ManifestEntryEditor — Form-based editors for all manifest entry types
 *
 * Provides inline editing for combat spells, prayers, recipes, ammunition,
 * runes, items, and other manifest data directly within the ManifestBrowserPanel.
 */

import {
  Plus,
  X,
  Sparkles,
  Swords,
  BookOpen,
  Flame,
  Shield,
  Scroll,
  Trees,
  Fish,
  Pickaxe,
  Hammer,
  Crosshair,
  TrendingUp,
  Lock,
} from "lucide-react";
import React, { useCallback } from "react";

import type {
  ManifestCombatSpell,
  ManifestPrayer,
  ManifestRecipe,
  ManifestAmmunition,
  ManifestRune,
  ManifestItem,
  ManifestNPC,
  ManifestQuest,
  ManifestStore,
  ManifestTree,
  ManifestFishingSpot,
  ManifestMiningRock,
  ManifestStation,
  ManifestDuelArena,
  ManifestSkillUnlock,
  ManifestTierRequirement,
} from "../../types";
import { useWorldStudio } from "../../WorldStudioContext";
import {
  NumberInput,
  TextInput,
  SelectInput,
  Toggle,
} from "./PropertyControls";
import { QuestStageBuilder } from "./QuestStageBuilder";
import { StoreEditor } from "./StoreEditor";

// ============== COMBAT SPELL EDITOR ==============

function CombatSpellEditor({ spell }: { spell: ManifestCombatSpell }) {
  const { state, actions } = useWorldStudio();

  const update = useCallback(
    (updates: Partial<ManifestCombatSpell>) => {
      const updated = state.manifests.combatSpells.map((s) =>
        s.id === spell.id ? { ...s, ...updates } : s,
      );
      actions.updateManifestCombatSpells(updated);
    },
    [state.manifests.combatSpells, spell.id, actions],
  );

  const updateRune = useCallback(
    (idx: number, updates: Partial<{ runeId: string; quantity: number }>) => {
      const newRunes = [...spell.runes];
      newRunes[idx] = { ...newRunes[idx], ...updates };
      update({ runes: newRunes });
    },
    [spell.runes, update],
  );

  const removeRune = useCallback(
    (idx: number) => {
      update({ runes: spell.runes.filter((_, i) => i !== idx) });
    },
    [spell.runes, update],
  );

  const addRune = useCallback(() => {
    update({ runes: [...spell.runes, { runeId: "", quantity: 1 }] });
  }, [spell.runes, update]);

  return (
    <div className="px-3 py-2 bg-bg-tertiary/20 border-t border-border-primary space-y-1.5">
      <div className="flex items-center gap-1 text-[10px] text-text-tertiary mb-1">
        <Swords size={10} />
        <span className="uppercase font-medium">Edit Spell</span>
      </div>
      <TextInput
        label="Name"
        value={spell.name}
        onChange={(name) => update({ name })}
      />
      <NumberInput
        label="Level"
        value={spell.level}
        onChange={(level) => update({ level })}
        min={1}
        max={99}
      />
      <NumberInput
        label="Max Hit"
        value={spell.baseMaxHit}
        onChange={(baseMaxHit) => update({ baseMaxHit })}
        min={1}
        max={50}
      />
      <NumberInput
        label="Base XP"
        value={spell.baseXp}
        onChange={(baseXp) => update({ baseXp })}
        min={0}
        max={500}
      />
      <SelectInput
        label="Element"
        value={spell.element}
        onChange={(element) => update({ element })}
        options={[
          { value: "air", label: "Air" },
          { value: "water", label: "Water" },
          { value: "earth", label: "Earth" },
          { value: "fire", label: "Fire" },
        ]}
      />
      <TextInput
        label="Tier"
        value={spell.tier}
        onChange={(tier) => update({ tier })}
      />
      {spell.attackSpeed != null && (
        <NumberInput
          label="Atk Speed"
          value={spell.attackSpeed}
          onChange={(attackSpeed) => update({ attackSpeed })}
          min={1}
          max={10}
          unit="ticks"
        />
      )}

      {/* Rune costs */}
      <div className="mt-1">
        <div className="text-[9px] text-text-tertiary uppercase mb-0.5">
          Rune Costs
        </div>
        {spell.runes.map((rune, idx) => (
          <div key={idx} className="flex items-center gap-1 mb-0.5">
            <input
              type="text"
              value={rune.runeId}
              onChange={(e) => updateRune(idx, { runeId: e.target.value })}
              className="flex-1 px-1 py-0.5 text-[10px] bg-bg-tertiary border border-border-primary rounded text-text-primary"
              placeholder="Rune ID"
            />
            <input
              type="number"
              value={rune.quantity}
              onChange={(e) =>
                updateRune(idx, { quantity: Number(e.target.value) })
              }
              className="w-12 px-1 py-0.5 text-[10px] bg-bg-tertiary border border-border-primary rounded text-text-primary text-center"
              min={1}
            />
            <button
              className="p-0.5 text-text-tertiary hover:text-red-400"
              onClick={() => removeRune(idx)}
            >
              <X size={8} />
            </button>
          </div>
        ))}
        <button
          className="text-[9px] text-primary/80 hover:text-primary flex items-center gap-0.5 mt-0.5"
          onClick={addRune}
        >
          <Plus size={8} />
          Add Rune
        </button>
      </div>
    </div>
  );
}

// ============== PRAYER EDITOR ==============

function PrayerEditor({ prayer }: { prayer: ManifestPrayer }) {
  const { state, actions } = useWorldStudio();

  const update = useCallback(
    (updates: Partial<ManifestPrayer>) => {
      const updated = state.manifests.prayers.map((p) =>
        p.id === prayer.id ? { ...p, ...updates } : p,
      );
      actions.updateManifestPrayers(updated);
    },
    [state.manifests.prayers, prayer.id, actions],
  );

  const updateBonus = useCallback(
    (key: string, value: number) => {
      update({ bonuses: { ...prayer.bonuses, [key]: value } });
    },
    [prayer.bonuses, update],
  );

  return (
    <div className="px-3 py-2 bg-bg-tertiary/20 border-t border-border-primary space-y-1.5">
      <div className="flex items-center gap-1 text-[10px] text-text-tertiary mb-1">
        <Shield size={10} />
        <span className="uppercase font-medium">Edit Prayer</span>
      </div>
      <TextInput
        label="Name"
        value={prayer.name}
        onChange={(name) => update({ name })}
      />
      <TextInput
        label="Description"
        value={prayer.description}
        onChange={(description) => update({ description })}
      />
      <NumberInput
        label="Level"
        value={prayer.level}
        onChange={(level) => update({ level })}
        min={1}
        max={99}
      />
      <TextInput
        label="Category"
        value={prayer.category}
        onChange={(category) => update({ category })}
      />
      <NumberInput
        label="Drain Rate"
        value={prayer.drainEffect}
        onChange={(drainEffect) => update({ drainEffect })}
        min={0}
        max={100}
      />

      {/* Bonuses */}
      {Object.keys(prayer.bonuses).length > 0 && (
        <div className="mt-1">
          <div className="text-[9px] text-text-tertiary uppercase mb-0.5">
            Bonuses
          </div>
          {Object.entries(prayer.bonuses).map(([stat, value]) => (
            <div key={stat} className="flex items-center gap-1 mb-0.5">
              <span className="text-[10px] text-text-tertiary capitalize w-16 truncate">
                {stat}
              </span>
              <input
                type="number"
                value={value}
                onChange={(e) => updateBonus(stat, Number(e.target.value))}
                className="w-16 px-1 py-0.5 text-[10px] bg-bg-tertiary border border-border-primary rounded text-text-primary text-center"
              />
            </div>
          ))}
        </div>
      )}

      {/* Conflicts */}
      {prayer.conflicts.length > 0 && (
        <div className="mt-1">
          <div className="text-[9px] text-text-tertiary uppercase mb-0.5">
            Conflicts
          </div>
          <div className="text-[10px] text-text-secondary pl-1">
            {prayer.conflicts.join(", ")}
          </div>
        </div>
      )}
    </div>
  );
}

// ============== RECIPE EDITOR ==============

function RecipeEditor({ recipe }: { recipe: ManifestRecipe }) {
  const { state, actions } = useWorldStudio();

  const update = useCallback(
    (updates: Partial<ManifestRecipe>) => {
      const updated = state.manifests.recipes.map((r) =>
        r.id === recipe.id ? { ...r, ...updates } : r,
      );
      actions.updateManifestRecipes(updated);
    },
    [state.manifests.recipes, recipe.id, actions],
  );

  const updateInput = useCallback(
    (idx: number, updates: Partial<{ itemId: string; quantity: number }>) => {
      const newInputs = [...recipe.inputs];
      newInputs[idx] = { ...newInputs[idx], ...updates };
      update({ inputs: newInputs });
    },
    [recipe.inputs, update],
  );

  const removeInput = useCallback(
    (idx: number) => {
      update({ inputs: recipe.inputs.filter((_, i) => i !== idx) });
    },
    [recipe.inputs, update],
  );

  const addInput = useCallback(() => {
    update({ inputs: [...recipe.inputs, { itemId: "", quantity: 1 }] });
  }, [recipe.inputs, update]);

  return (
    <div className="px-3 py-2 bg-bg-tertiary/20 border-t border-border-primary space-y-1.5">
      <div className="flex items-center gap-1 text-[10px] text-text-tertiary mb-1">
        <Flame size={10} />
        <span className="uppercase font-medium">Edit Recipe</span>
      </div>
      <TextInput
        label="Skill"
        value={recipe.skill}
        onChange={(skill) => update({ skill })}
      />
      <TextInput
        label="Output"
        value={recipe.output ?? ""}
        onChange={(output) => update({ output })}
      />
      <NumberInput
        label="Level"
        value={recipe.level}
        onChange={(level) => update({ level })}
        min={1}
        max={99}
      />
      <NumberInput
        label="XP"
        value={recipe.xp}
        onChange={(xp) => update({ xp })}
        min={0}
        max={10000}
      />
      {recipe.ticks != null && (
        <NumberInput
          label="Ticks"
          value={recipe.ticks}
          onChange={(ticks) => update({ ticks })}
          min={1}
          max={100}
          unit="ticks"
        />
      )}
      {recipe.category && (
        <TextInput
          label="Category"
          value={recipe.category}
          onChange={(category) => update({ category })}
        />
      )}

      {/* Inputs */}
      <div className="mt-1">
        <div className="text-[9px] text-text-tertiary uppercase mb-0.5">
          Inputs
        </div>
        {recipe.inputs.map((input, idx) => (
          <div key={idx} className="flex items-center gap-1 mb-0.5">
            <input
              type="text"
              value={input.itemId}
              onChange={(e) => updateInput(idx, { itemId: e.target.value })}
              className="flex-1 px-1 py-0.5 text-[10px] bg-bg-tertiary border border-border-primary rounded text-text-primary"
              placeholder="Item ID"
            />
            <input
              type="number"
              value={input.quantity}
              onChange={(e) =>
                updateInput(idx, { quantity: Number(e.target.value) })
              }
              className="w-12 px-1 py-0.5 text-[10px] bg-bg-tertiary border border-border-primary rounded text-text-primary text-center"
              min={1}
            />
            <button
              className="p-0.5 text-text-tertiary hover:text-red-400"
              onClick={() => removeInput(idx)}
            >
              <X size={8} />
            </button>
          </div>
        ))}
        <button
          className="text-[9px] text-primary/80 hover:text-primary flex items-center gap-0.5 mt-0.5"
          onClick={addInput}
        >
          <Plus size={8} />
          Add Input
        </button>
      </div>
    </div>
  );
}

// ============== AMMUNITION EDITOR ==============

function AmmunitionEditor({ ammo }: { ammo: ManifestAmmunition }) {
  const { state, actions } = useWorldStudio();

  const update = useCallback(
    (updates: Partial<ManifestAmmunition>) => {
      const updated = state.manifests.ammunition.map((a) =>
        a.id === ammo.id ? { ...a, ...updates } : a,
      );
      actions.updateManifestAmmunition(updated);
    },
    [state.manifests.ammunition, ammo.id, actions],
  );

  return (
    <div className="px-3 py-2 bg-bg-tertiary/20 border-t border-border-primary space-y-1.5">
      <div className="flex items-center gap-1 text-[10px] text-text-tertiary mb-1">
        <Sparkles size={10} />
        <span className="uppercase font-medium">Edit Ammunition</span>
      </div>
      <TextInput
        label="Name"
        value={ammo.name}
        onChange={(name) => update({ name })}
      />
      <NumberInput
        label="Ranged Str"
        value={ammo.rangedStrength}
        onChange={(rangedStrength) => update({ rangedStrength })}
        min={0}
        max={200}
      />
      <NumberInput
        label="Req Level"
        value={ammo.requiredRangedLevel}
        onChange={(requiredRangedLevel) => update({ requiredRangedLevel })}
        min={1}
        max={99}
      />
      {ammo.requiredBowTier != null && (
        <NumberInput
          label="Bow Tier"
          value={ammo.requiredBowTier}
          onChange={(requiredBowTier) => update({ requiredBowTier })}
          min={0}
          max={10}
        />
      )}
    </div>
  );
}

// ============== RUNE EDITOR ==============

function RuneEditor({ rune }: { rune: ManifestRune }) {
  const { state, actions } = useWorldStudio();

  const update = useCallback(
    (updates: Partial<ManifestRune>) => {
      const updated = state.manifests.runes.map((r) =>
        r.id === rune.id ? { ...r, ...updates } : r,
      );
      actions.updateManifestRunes(updated);
    },
    [state.manifests.runes, rune.id, actions],
  );

  return (
    <div className="px-3 py-2 bg-bg-tertiary/20 border-t border-border-primary space-y-1.5">
      <div className="flex items-center gap-1 text-[10px] text-text-tertiary mb-1">
        <BookOpen size={10} />
        <span className="uppercase font-medium">Edit Rune</span>
      </div>
      <TextInput
        label="Name"
        value={rune.name}
        onChange={(name) => update({ name })}
      />
      <SelectInput
        label="Element"
        value={rune.element ?? "none"}
        onChange={(element) =>
          update({ element: element === "none" ? null : element })
        }
        options={[
          { value: "none", label: "None" },
          { value: "air", label: "Air" },
          { value: "water", label: "Water" },
          { value: "earth", label: "Earth" },
          { value: "fire", label: "Fire" },
        ]}
      />
      <Toggle
        label="Stackable"
        value={rune.stackable}
        onChange={(stackable) => update({ stackable })}
      />
    </div>
  );
}

// ============== ITEM EDITOR ==============

function ItemEditor({ item }: { item: ManifestItem }) {
  const { state, actions } = useWorldStudio();

  const update = useCallback(
    (updates: Partial<ManifestItem>) => {
      const updated = state.manifests.items.map((i) =>
        i.id === item.id ? { ...i, ...updates } : i,
      );
      actions.updateManifestItems(updated);
    },
    [state.manifests.items, item.id, actions],
  );

  return (
    <div className="px-3 py-2 bg-bg-tertiary/20 border-t border-border-primary space-y-1.5">
      <TextInput
        label="Name"
        value={item.name}
        onChange={(name) => update({ name })}
      />
      <TextInput
        label="Examine"
        value={item.examine ?? ""}
        onChange={(examine) => update({ examine: examine || undefined })}
      />
      {item.value != null && (
        <NumberInput
          label="Value"
          value={item.value}
          onChange={(value) => update({ value })}
          min={0}
          max={999999}
          unit="gp"
        />
      )}
      {item.levelRequired != null && (
        <NumberInput
          label="Req Level"
          value={item.levelRequired}
          onChange={(levelRequired) => update({ levelRequired })}
          min={1}
          max={99}
        />
      )}
      {item.tier && (
        <TextInput
          label="Tier"
          value={item.tier}
          onChange={(tier) => update({ tier })}
        />
      )}
      {item.rarity && (
        <SelectInput
          label="Rarity"
          value={item.rarity}
          onChange={(rarity) => update({ rarity })}
          options={[
            { value: "common", label: "Common" },
            { value: "uncommon", label: "Uncommon" },
            { value: "rare", label: "Rare" },
            { value: "epic", label: "Epic" },
            { value: "legendary", label: "Legendary" },
          ]}
        />
      )}
      <Toggle
        label="Tradeable"
        value={item.tradeable ?? true}
        onChange={(tradeable) => update({ tradeable })}
      />
      <Toggle
        label="Stackable"
        value={item.stackable ?? false}
        onChange={(stackable) => update({ stackable })}
      />
      {item.equipSlot && (
        <TextInput
          label="Equip Slot"
          value={item.equipSlot}
          onChange={(equipSlot) => update({ equipSlot })}
        />
      )}
    </div>
  );
}

// ============== NPC MANIFEST EDITOR ==============

function NPCManifestEditor({ npc }: { npc: ManifestNPC }) {
  const { state, actions } = useWorldStudio();

  const update = useCallback(
    (updates: Partial<ManifestNPC>) => {
      const updated = state.manifests.npcs.map((n) =>
        n.id === npc.id ? { ...n, ...updates } : n,
      );
      actions.updateManifestNPCs(updated);
    },
    [state.manifests.npcs, npc.id, actions],
  );

  return (
    <div className="px-3 py-2 bg-bg-tertiary/20 border-t border-border-primary space-y-1.5">
      <TextInput
        label="Name"
        value={npc.name}
        onChange={(name) => update({ name })}
      />
      <TextInput
        label="Description"
        value={npc.description}
        onChange={(description) => update({ description })}
      />
      <SelectInput
        label="Category"
        value={npc.category}
        onChange={(category) =>
          update({ category: category as ManifestNPC["category"] })
        }
        options={[
          { value: "mob", label: "Mob" },
          { value: "boss", label: "Boss" },
          { value: "neutral", label: "Neutral" },
          { value: "quest", label: "Quest" },
        ]}
      />
      <div className="flex gap-1">
        <NumberInput
          label="Min Lv"
          value={npc.levelRange[0]}
          onChange={(min) => update({ levelRange: [min, npc.levelRange[1]] })}
          min={1}
          max={99}
        />
        <NumberInput
          label="Max Lv"
          value={npc.levelRange[1]}
          onChange={(max) => update({ levelRange: [npc.levelRange[0], max] })}
          min={1}
          max={99}
        />
      </div>
      <TextInput
        label="Model"
        value={npc.appearance.modelPath}
        onChange={(modelPath) =>
          update({ appearance: { ...npc.appearance, modelPath } })
        }
      />
      {npc.appearance.scale != null && (
        <NumberInput
          label="Scale"
          value={npc.appearance.scale}
          onChange={(scale) =>
            update({ appearance: { ...npc.appearance, scale } })
          }
          min={0.1}
          max={10}
        />
      )}
    </div>
  );
}

// ============== QUEST EDITOR ==============

function QuestManifestEditor({ quest }: { quest: ManifestQuest }) {
  const { state, actions } = useWorldStudio();

  const update = useCallback(
    (updates: Partial<ManifestQuest>) => {
      const updated = state.manifests.quests.map((q) =>
        q.id === quest.id ? { ...q, ...updates } : q,
      );
      actions.updateManifestQuests(updated);
    },
    [state.manifests.quests, quest.id, actions],
  );

  return (
    <div className="px-3 py-2 bg-bg-tertiary/20 border-t border-border-primary space-y-1.5">
      <div className="flex items-center gap-1 text-[10px] text-text-tertiary mb-1">
        <Scroll size={10} />
        <span className="uppercase font-medium">Edit Quest</span>
      </div>
      <TextInput
        label="Name"
        value={quest.name}
        onChange={(name) => update({ name })}
      />
      <TextInput
        label="Description"
        value={quest.description}
        onChange={(description) => update({ description })}
      />
      <SelectInput
        label="Difficulty"
        value={quest.difficulty}
        onChange={(difficulty) => update({ difficulty })}
        options={[
          { value: "novice", label: "Novice" },
          { value: "intermediate", label: "Intermediate" },
          { value: "experienced", label: "Experienced" },
          { value: "master", label: "Master" },
          { value: "grandmaster", label: "Grandmaster" },
        ]}
      />
      <NumberInput
        label="Quest Points"
        value={quest.questPoints}
        onChange={(questPoints) => update({ questPoints })}
        min={0}
        max={10}
      />
      <TextInput
        label="Start NPC"
        value={quest.startNpc ?? ""}
        onChange={(startNpc) => update({ startNpc: startNpc || undefined })}
      />
      <Toggle
        label="Replayable"
        value={quest.replayable ?? false}
        onChange={(replayable) => update({ replayable })}
      />

      {/* Stage editor — reuses the existing builder. */}
      <div className="pt-1">
        <QuestStageBuilder quest={quest} />
      </div>
    </div>
  );
}

// ============== STORE EDITOR WRAPPER ==============

/**
 * Thin adapter so the manifest router can route `stores` to the existing
 * `StoreEditor` component (which was built for the NPC properties panel).
 */
function StoreManifestEditorWrapper({ store }: { store: ManifestStore }) {
  return (
    <div className="px-3 py-2 bg-bg-tertiary/20 border-t border-border-primary space-y-1.5">
      <div className="flex items-center gap-1 text-[10px] text-text-tertiary mb-1">
        <BookOpen size={10} />
        <span className="uppercase font-medium">Edit Store</span>
      </div>
      <StoreEditor store={store} />
    </div>
  );
}

// ============== TREE EDITOR ==============

function TreeEditor({ tree }: { tree: ManifestTree }) {
  const { state, actions } = useWorldStudio();

  const update = useCallback(
    (updates: Partial<ManifestTree>) => {
      const updated = state.manifests.trees.map((t) =>
        t.id === tree.id ? { ...t, ...updates } : t,
      );
      actions.updateManifestTrees(updated);
    },
    [state.manifests.trees, tree.id, actions],
  );

  const updateModelVariant = useCallback(
    (idx: number, value: string) => {
      const next = [...tree.modelVariants];
      next[idx] = value;
      update({ modelVariants: next });
    },
    [tree.modelVariants, update],
  );

  const removeModelVariant = useCallback(
    (idx: number) => {
      update({ modelVariants: tree.modelVariants.filter((_, i) => i !== idx) });
    },
    [tree.modelVariants, update],
  );

  const addModelVariant = useCallback(() => {
    update({ modelVariants: [...tree.modelVariants, ""] });
  }, [tree.modelVariants, update]);

  return (
    <div className="px-3 py-2 bg-bg-tertiary/20 border-t border-border-primary space-y-1.5">
      <div className="flex items-center gap-1 text-[10px] text-text-tertiary mb-1">
        <Trees size={10} />
        <span className="uppercase font-medium">Edit Tree</span>
      </div>
      <TextInput
        label="Name"
        value={tree.name}
        onChange={(name) => update({ name })}
      />
      <TextInput
        label="Type"
        value={tree.type}
        onChange={(type) => update({ type })}
      />
      <NumberInput
        label="Level Required"
        value={tree.levelRequired}
        onChange={(levelRequired) => update({ levelRequired })}
        min={1}
        max={99}
      />
      <TextInput
        label="Examine"
        value={tree.examine}
        onChange={(examine) => update({ examine })}
      />

      {/* Model variants */}
      <div className="mt-1">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[9px] text-text-tertiary uppercase">
            Model Variants
          </span>
          <button
            onClick={addModelVariant}
            className="p-0.5 text-text-tertiary hover:text-text-primary"
            title="Add variant"
          >
            <Plus size={10} />
          </button>
        </div>
        {tree.modelVariants.map((variant, idx) => (
          <div key={idx} className="flex items-center gap-1 mb-0.5">
            <input
              type="text"
              value={variant}
              onChange={(e) => updateModelVariant(idx, e.target.value)}
              placeholder="path/to/model.glb"
              className="flex-1 px-1 py-0.5 text-[10px] bg-bg-tertiary border border-border-primary rounded text-text-primary"
            />
            <button
              onClick={() => removeModelVariant(idx)}
              className="p-0.5 text-text-tertiary hover:text-red-400"
            >
              <X size={10} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== FISHING SPOT EDITOR ==============

function FishingSpotEditor({ spot }: { spot: ManifestFishingSpot }) {
  const { state, actions } = useWorldStudio();

  const update = useCallback(
    (updates: Partial<ManifestFishingSpot>) => {
      const updated = state.manifests.fishingSpots.map((f) =>
        f.id === spot.id ? { ...f, ...updates } : f,
      );
      actions.updateManifestFishingSpots(updated);
    },
    [state.manifests.fishingSpots, spot.id, actions],
  );

  return (
    <div className="px-3 py-2 bg-bg-tertiary/20 border-t border-border-primary space-y-1.5">
      <div className="flex items-center gap-1 text-[10px] text-text-tertiary mb-1">
        <Fish size={10} />
        <span className="uppercase font-medium">Edit Fishing Spot</span>
      </div>
      <TextInput
        label="Name"
        value={spot.name}
        onChange={(name) => update({ name })}
      />
      <TextInput
        label="Type"
        value={spot.type}
        onChange={(type) => update({ type })}
      />
      <TextInput
        label="Tool Required"
        value={spot.toolRequired}
        onChange={(toolRequired) => update({ toolRequired })}
      />
      <NumberInput
        label="Level Required"
        value={spot.levelRequired}
        onChange={(levelRequired) => update({ levelRequired })}
        min={1}
        max={99}
      />
      <TextInput
        label="Examine"
        value={spot.examine}
        onChange={(examine) => update({ examine })}
      />
    </div>
  );
}

// ============== MINING ROCK EDITOR ==============

function MiningRockEditor({ rock }: { rock: ManifestMiningRock }) {
  const { state, actions } = useWorldStudio();

  const update = useCallback(
    (updates: Partial<ManifestMiningRock>) => {
      const updated = state.manifests.miningRocks.map((r) =>
        r.id === rock.id ? { ...r, ...updates } : r,
      );
      actions.updateManifestMiningRocks(updated);
    },
    [state.manifests.miningRocks, rock.id, actions],
  );

  return (
    <div className="px-3 py-2 bg-bg-tertiary/20 border-t border-border-primary space-y-1.5">
      <div className="flex items-center gap-1 text-[10px] text-text-tertiary mb-1">
        <Pickaxe size={10} />
        <span className="uppercase font-medium">Edit Mining Rock</span>
      </div>
      <TextInput
        label="Name"
        value={rock.name}
        onChange={(name) => update({ name })}
      />
      <TextInput
        label="Type"
        value={rock.type}
        onChange={(type) => update({ type })}
      />
      <TextInput
        label="Model Path"
        value={rock.modelPath}
        onChange={(modelPath) => update({ modelPath })}
      />
      <NumberInput
        label="Level Required"
        value={rock.levelRequired}
        onChange={(levelRequired) => update({ levelRequired })}
        min={1}
        max={99}
      />
      <TextInput
        label="Examine"
        value={rock.examine}
        onChange={(examine) => update({ examine })}
      />
    </div>
  );
}

// ============== STATION EDITOR ==============

function StationEditor({ station }: { station: ManifestStation }) {
  const { state, actions } = useWorldStudio();

  const update = useCallback(
    (updates: Partial<ManifestStation>) => {
      const updated = state.manifests.stations.map((s) =>
        s.type === station.type ? { ...s, ...updates } : s,
      );
      actions.updateManifestStations(updated);
    },
    [state.manifests.stations, station.type, actions],
  );

  return (
    <div className="px-3 py-2 bg-bg-tertiary/20 border-t border-border-primary space-y-1.5">
      <div className="flex items-center gap-1 text-[10px] text-text-tertiary mb-1">
        <Hammer size={10} />
        <span className="uppercase font-medium">Edit Station</span>
      </div>
      <TextInput
        label="Name"
        value={station.name}
        onChange={(name) => update({ name })}
      />
      <TextInput
        label="Type"
        value={station.type}
        onChange={(type) => update({ type })}
      />
      <TextInput
        label="Model"
        value={station.model}
        onChange={(model) => update({ model })}
      />
      <TextInput
        label="Examine"
        value={station.examine}
        onChange={(examine) => update({ examine })}
      />
    </div>
  );
}

// ============== DUEL ARENA EDITOR ==============

function DuelArenaEditor({ arena }: { arena: ManifestDuelArena }) {
  const { state, actions } = useWorldStudio();

  const update = useCallback(
    (updates: Partial<ManifestDuelArena>) => {
      const updated = state.manifests.duelArenas.map((a) =>
        a.arenaId === arena.arenaId ? { ...a, ...updates } : a,
      );
      actions.updateManifestDuelArenas(updated);
    },
    [state.manifests.duelArenas, arena.arenaId, actions],
  );

  return (
    <div className="px-3 py-2 bg-bg-tertiary/20 border-t border-border-primary space-y-1.5">
      <div className="flex items-center gap-1 text-[10px] text-text-tertiary mb-1">
        <Crosshair size={10} />
        <span className="uppercase font-medium">Edit Duel Arena</span>
      </div>
      <NumberInput
        label="Arena ID"
        value={arena.arenaId}
        onChange={(arenaId) => update({ arenaId })}
        min={0}
      />
      <div className="grid grid-cols-2 gap-1">
        <NumberInput
          label="Center X"
          value={arena.center.x}
          onChange={(x) => update({ center: { ...arena.center, x } })}
        />
        <NumberInput
          label="Center Z"
          value={arena.center.z}
          onChange={(z) => update({ center: { ...arena.center, z } })}
        />
      </div>
      <NumberInput
        label="Size"
        value={arena.size}
        onChange={(size) => update({ size })}
        min={1}
      />
      <div className="text-[10px] text-text-tertiary pt-1">
        {arena.spawnPoints.length} spawn point
        {arena.spawnPoints.length === 1 ? "" : "s"},{" "}
        {arena.trapdoorPositions?.length ?? 0} trapdoor
        {(arena.trapdoorPositions?.length ?? 0) === 1 ? "" : "s"}
      </div>
    </div>
  );
}

// ============== SKILL UNLOCK EDITOR ==============

function SkillUnlockEditor({
  unlock,
  index,
}: {
  unlock: ManifestSkillUnlock;
  index: number;
}) {
  const { state, actions } = useWorldStudio();

  const update = useCallback(
    (updates: Partial<ManifestSkillUnlock>) => {
      const updated = state.manifests.skillUnlocks.map((u, i) =>
        i === index ? { ...u, ...updates } : u,
      );
      actions.updateManifestSkillUnlocks(updated);
    },
    [state.manifests.skillUnlocks, index, actions],
  );

  return (
    <div className="px-3 py-2 bg-bg-tertiary/20 border-t border-border-primary space-y-1.5">
      <div className="flex items-center gap-1 text-[10px] text-text-tertiary mb-1">
        <Lock size={10} />
        <span className="uppercase font-medium">Edit Skill Unlock</span>
      </div>
      <TextInput
        label="Skill"
        value={unlock.skill}
        onChange={(skill) => update({ skill })}
      />
      <NumberInput
        label="Level"
        value={unlock.level}
        onChange={(level) => update({ level })}
        min={1}
        max={99}
      />
      <TextInput
        label="Description"
        value={unlock.description}
        onChange={(description) => update({ description })}
      />
      <TextInput
        label="Type"
        value={unlock.type ?? ""}
        onChange={(type) => update({ type: type || undefined })}
      />
    </div>
  );
}

// ============== TIER REQUIREMENT EDITOR ==============

function TierRequirementEditor({
  req,
  index,
}: {
  req: ManifestTierRequirement;
  index: number;
}) {
  const { state, actions } = useWorldStudio();

  const update = useCallback(
    (updates: Partial<ManifestTierRequirement>) => {
      const updated = state.manifests.tierRequirements.map((r, i) =>
        i === index ? { ...r, ...updates } : r,
      );
      actions.updateManifestTierRequirements(updated);
    },
    [state.manifests.tierRequirements, index, actions],
  );

  const setRequirement = useCallback(
    (skill: string, value: number) => {
      const next = { ...req.requirements };
      if (value <= 0) {
        delete next[skill];
      } else {
        next[skill] = value;
      }
      update({ requirements: next });
    },
    [req.requirements, update],
  );

  const renameRequirement = useCallback(
    (oldSkill: string, newSkill: string) => {
      if (newSkill === oldSkill) return;
      const next: Record<string, number> = {};
      for (const [k, v] of Object.entries(req.requirements)) {
        next[k === oldSkill ? newSkill : k] = v;
      }
      update({ requirements: next });
    },
    [req.requirements, update],
  );

  const addRequirement = useCallback(() => {
    const base = "skill";
    let name = base;
    let i = 1;
    while (name in req.requirements) {
      name = `${base}${i++}`;
    }
    update({ requirements: { ...req.requirements, [name]: 1 } });
  }, [req.requirements, update]);

  return (
    <div className="px-3 py-2 bg-bg-tertiary/20 border-t border-border-primary space-y-1.5">
      <div className="flex items-center gap-1 text-[10px] text-text-tertiary mb-1">
        <TrendingUp size={10} />
        <span className="uppercase font-medium">Edit Tier Requirement</span>
      </div>
      <TextInput
        label="Tier"
        value={req.tier}
        onChange={(tier) => update({ tier })}
      />
      <TextInput
        label="Category"
        value={req.category}
        onChange={(category) => update({ category })}
      />
      <div className="pt-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-text-tertiary uppercase">
            Requirements
          </span>
          <button
            type="button"
            onClick={addRequirement}
            className="flex items-center gap-1 text-[10px] text-text-secondary hover:text-text-primary"
          >
            <Plus size={10} /> add
          </button>
        </div>
        {Object.entries(req.requirements).map(([skill, value]) => (
          <div key={skill} className="flex items-center gap-1 mb-1">
            <input
              type="text"
              value={skill}
              onChange={(e) => renameRequirement(skill, e.target.value)}
              className="flex-1 h-5 px-1 text-[11px] bg-bg-primary border border-border-primary rounded text-text-primary"
            />
            <input
              type="number"
              value={value}
              min={1}
              max={99}
              onChange={(e) =>
                setRequirement(skill, Number.parseInt(e.target.value, 10) || 0)
              }
              className="w-12 h-5 px-1 text-[11px] bg-bg-primary border border-border-primary rounded text-text-primary"
            />
            <button
              type="button"
              onClick={() => setRequirement(skill, 0)}
              className="text-text-tertiary hover:text-text-primary"
            >
              <X size={10} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== ENTRY EDITOR ROUTER ==============

/**
 * Routes to the appropriate editor based on manifest name and entry ID.
 * Returns null if no editor is available for the given manifest type.
 */
export function ManifestFormEditor({
  manifestName,
  entryId,
}: {
  manifestName: string;
  entryId: string;
}): React.ReactElement | null {
  const { state } = useWorldStudio();
  const manifests = state.manifests;

  switch (manifestName) {
    case "npcs": {
      const npc = manifests.npcs.find((n) => n.id === entryId);
      return npc ? <NPCManifestEditor npc={npc} /> : null;
    }
    case "combat-spells": {
      const spell = manifests.combatSpells.find((s) => s.id === entryId);
      return spell ? <CombatSpellEditor spell={spell} /> : null;
    }
    case "prayers": {
      const prayer = manifests.prayers.find((p) => p.id === entryId);
      return prayer ? <PrayerEditor prayer={prayer} /> : null;
    }
    case "runes": {
      const rune = manifests.runes.find((r) => r.id === entryId);
      return rune ? <RuneEditor rune={rune} /> : null;
    }
    case "ammunition": {
      const ammo = manifests.ammunition.find((a) => a.id === entryId);
      return ammo ? <AmmunitionEditor ammo={ammo} /> : null;
    }
    case "quests": {
      const quest = manifests.quests.find((q) => q.id === entryId);
      return quest ? <QuestManifestEditor quest={quest} /> : null;
    }
    case "stores": {
      const store = manifests.stores.find((s) => s.id === entryId);
      return store ? <StoreManifestEditorWrapper store={store} /> : null;
    }
    case "trees": {
      const tree = manifests.trees.find((t) => t.id === entryId);
      return tree ? <TreeEditor tree={tree} /> : null;
    }
    case "fishing-spots": {
      const spot = manifests.fishingSpots.find((s) => s.id === entryId);
      return spot ? <FishingSpotEditor spot={spot} /> : null;
    }
    case "mining-rocks": {
      const rock = manifests.miningRocks.find((r) => r.id === entryId);
      return rock ? <MiningRockEditor rock={rock} /> : null;
    }
    case "stations": {
      const station = manifests.stations.find((s) => s.type === entryId);
      return station ? <StationEditor station={station} /> : null;
    }
    case "duel-arenas": {
      // Content Browser entries use "arena_<n>" as entityId; parse the number.
      const idNum = Number.parseInt(entryId.replace(/^arena_/, ""), 10);
      if (!Number.isFinite(idNum)) return null;
      const arena = manifests.duelArenas.find((a) => a.arenaId === idNum);
      return arena ? <DuelArenaEditor arena={arena} /> : null;
    }
    case "skill-unlocks": {
      // Content Browser entityId is "${skill}_${level}".
      const idx = manifests.skillUnlocks.findIndex(
        (u) => `${u.skill}_${u.level}` === entryId,
      );
      if (idx < 0) return null;
      return (
        <SkillUnlockEditor unlock={manifests.skillUnlocks[idx]} index={idx} />
      );
    }
    case "tier-requirements": {
      // Content Browser entityId is "${tier}_${category}".
      const idx = manifests.tierRequirements.findIndex(
        (r) => `${r.tier}_${r.category}` === entryId,
      );
      if (idx < 0) return null;
      return (
        <TierRequirementEditor
          req={manifests.tierRequirements[idx]}
          index={idx}
        />
      );
    }
    default: {
      // Items
      if (manifestName.startsWith("items/")) {
        const item = manifests.items.find((i) => i.id === entryId);
        return item ? <ItemEditor item={item} /> : null;
      }
      // Recipes
      if (manifestName.startsWith("recipes/")) {
        const recipe = manifests.recipes.find((r) => r.id === entryId);
        return recipe ? <RecipeEditor recipe={recipe} /> : null;
      }
      return null;
    }
  }
}
