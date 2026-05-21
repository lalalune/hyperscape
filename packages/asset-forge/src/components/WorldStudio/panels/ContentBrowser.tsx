/**
 * ContentBrowser — UE5-inspired unified content browser for World Studio
 *
 * Replaces ManifestBrowserPanel with a split-pane layout:
 * - Left: narrow category tree (entities, items, combat, etc.)
 * - Right: filterable grid/list of entries with drag-to-viewport support
 * - Bottom: detail preview when an item is selected
 *
 * All data sourced from `useWorldStudio().state.manifests`.
 */

import {
  AlertCircle,
  ArrowLeft,
  ChefHat,
  ChevronRight,
  Crosshair,
  Grid3x3,
  Inbox,
  List,
  Loader2,
  MapPin,
  Music,
  Package,
  Pickaxe,
  Search,
  Sparkles,
  Swords,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import React, {
  useState,
  useCallback,
  useMemo,
  useDeferredValue,
  useRef,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import type {
  ManifestItem,
  ManifestNPC,
  ManifestCombatSpell,
  ManifestPrayer,
  ManifestRune,
  ManifestAmmunition,
  ManifestQuest,
  ManifestRecipe,
  ManifestSkillUnlock,
  ManifestTierRequirement,
  ManifestDuelArena,
  ManifestStation,
  ManifestStore,
  ManifestMiningRock,
  ManifestTree,
  ManifestFishingSpot,
  ManifestData,
} from "../types";
import { useWorldStudio } from "../WorldStudioContext";
import { hasAllRequiredAssetPacks } from "../../../gameModules/GameModule";
import { ManifestFormEditor } from "./properties/ManifestEntryEditor";

// ============== CATEGORY → MANIFEST MAPPING ==============

/**
 * Maps a Content Browser categoryKey to the manifestName expected by
 * `ManifestFormEditor`. Returns `null` when no editor route is registered
 * yet (ContentDetailPreview shows only the summary / action buttons).
 */
function categoryKeyToManifestName(categoryKey: string): string | null {
  // Entities
  if (categoryKey === "entities/npcs") return "npcs";
  if (categoryKey === "entities/mob-spawns") return "npcs";
  if (categoryKey === "entities/stores") return "stores";
  if (categoryKey === "entities/stations") return "stations";

  // Items — categoryKey is like "items/weapons", manifest router uses the
  // same prefix convention.
  if (categoryKey.startsWith("items/")) return categoryKey;

  // Combat
  if (categoryKey === "combat/spells") return "combat-spells";
  if (categoryKey === "combat/prayers") return "prayers";
  if (categoryKey === "combat/runes") return "runes";
  if (categoryKey === "combat/ammo") return "ammunition";
  if (categoryKey === "combat/duel-arenas") return "duel-arenas";

  // Recipes — categoryKey is like "recipes/cooking", manifest router uses
  // the same prefix convention.
  if (categoryKey.startsWith("recipes/")) return categoryKey;

  // Progression
  if (categoryKey === "progression/quests") return "quests";
  if (categoryKey === "progression/skill-unlocks") return "skill-unlocks";
  if (categoryKey === "progression/tier-reqs") return "tier-requirements";

  // Gathering
  if (categoryKey === "gathering/woodcutting") return "trees";
  if (categoryKey === "gathering/fishing") return "fishing-spots";
  if (categoryKey === "gathering/mining") return "mining-rocks";

  return null;
}

// ============== CONTENT ENTRY ==============

/** Unified content entry for the browser grid/list */
interface ContentEntry {
  id: string;
  name: string;
  /** Leaf category key matching a CategoryNode */
  categoryKey: string;
  /** Type label for the indicator dot */
  typeLabel: string;
  /** Color class for the type indicator dot */
  dotColor: string;
  /** Brief info shown in grid card or list row */
  info: string;
  /** Level or tier number for sorting */
  level?: number;
  /** Drag entity id (for text/entity-id) */
  entityId: string;
}

// ============== CATEGORY TREE ==============

interface CategoryNode {
  key: string;
  label: string;
  icon?: React.ReactNode;
  children?: CategoryNode[];
  /** When true, this is a leaf that maps to a content set */
  leaf?: boolean;
}

const CATEGORY_TREE: CategoryNode[] = [
  {
    key: "entities",
    label: "Entities",
    icon: <Users size={11} />,
    children: [
      { key: "entities/npcs", label: "NPCs", leaf: true },
      { key: "entities/stations", label: "Stations", leaf: true },
      { key: "entities/stores", label: "Stores", leaf: true },
      { key: "entities/mob-spawns", label: "Mob Spawns", leaf: true },
    ],
  },
  {
    key: "items",
    label: "Items",
    icon: <Package size={11} />,
    children: [
      { key: "items/weapons", label: "Weapons", leaf: true },
      { key: "items/armor", label: "Armor", leaf: true },
      { key: "items/resources", label: "Resources", leaf: true },
      { key: "items/tools", label: "Tools", leaf: true },
      { key: "items/food", label: "Food", leaf: true },
      { key: "items/misc", label: "Misc", leaf: true },
      { key: "items/ammo", label: "Ammo", leaf: true },
      { key: "items/runes", label: "Runes", leaf: true },
    ],
  },
  {
    key: "combat",
    label: "Combat",
    icon: <Swords size={11} />,
    children: [
      { key: "combat/spells", label: "Spells", leaf: true },
      { key: "combat/prayers", label: "Prayers", leaf: true },
      { key: "combat/runes", label: "Runes", leaf: true },
      { key: "combat/ammo", label: "Ammo", leaf: true },
      { key: "combat/duel-arenas", label: "Duel Arenas", leaf: true },
    ],
  },
  {
    key: "progression",
    label: "Progression",
    icon: <TrendingUp size={11} />,
    children: [
      { key: "progression/quests", label: "Quests", leaf: true },
      { key: "progression/skill-unlocks", label: "Skill Unlocks", leaf: true },
      { key: "progression/tier-reqs", label: "Tier Requirements", leaf: true },
    ],
  },
  {
    key: "recipes",
    label: "Recipes",
    icon: <ChefHat size={11} />,
    children: [
      { key: "recipes/smithing", label: "Smithing", leaf: true },
      { key: "recipes/smelting", label: "Smelting", leaf: true },
      { key: "recipes/fletching", label: "Fletching", leaf: true },
      { key: "recipes/crafting", label: "Crafting", leaf: true },
      { key: "recipes/cooking", label: "Cooking", leaf: true },
      { key: "recipes/runecrafting", label: "Runecrafting", leaf: true },
    ],
  },
  {
    key: "gathering",
    label: "Gathering",
    icon: <Pickaxe size={11} />,
    children: [
      { key: "gathering/mining", label: "Mining", leaf: true },
      { key: "gathering/woodcutting", label: "Woodcutting", leaf: true },
      { key: "gathering/fishing", label: "Fishing", leaf: true },
    ],
  },
  {
    key: "world",
    label: "World",
    icon: <MapPin size={11} />,
    children: [
      { key: "world/biomes", label: "Biomes", leaf: true },
      { key: "world/areas", label: "Areas", leaf: true },
      { key: "world/config", label: "Config", leaf: true },
      { key: "world/buildings", label: "Buildings", leaf: true },
      { key: "world/lod", label: "LOD", leaf: true },
    ],
  },
  {
    key: "audio",
    label: "Audio",
    icon: <Music size={11} />,
    children: [{ key: "audio/music", label: "Music", leaf: true }],
  },
  {
    key: "custom",
    label: "Custom Assets",
    icon: <Sparkles size={11} />,
    children: [
      { key: "custom/placed", label: "Placed", leaf: true },
      { key: "custom/prefabs", label: "Prefabs", leaf: true },
    ],
  },
];

// ============== TYPE FILTER CHIPS ==============

/** Supported filter chip types */
type FilterType =
  | "npc"
  | "item"
  | "station"
  | "spell"
  | "prayer"
  | "quest"
  | "recipe"
  | "rune"
  | "ammo";

const FILTER_TYPE_LABELS: Record<FilterType, string> = {
  npc: "NPC",
  item: "Item",
  station: "Station",
  spell: "Spell",
  prayer: "Prayer",
  quest: "Quest",
  recipe: "Recipe",
  rune: "Rune",
  ammo: "Ammo",
};

/** Dot colors for each content type */
const DOT_COLORS: Record<string, string> = {
  npc: "bg-blue-400",
  mob: "bg-red-400",
  boss: "bg-red-600",
  station: "bg-orange-400",
  store: "bg-yellow-400",
  weapon: "bg-rose-400",
  armor: "bg-indigo-400",
  resource: "bg-amber-400",
  tool: "bg-lime-400",
  food: "bg-emerald-400",
  misc: "bg-gray-400",
  ammo: "bg-cyan-400",
  rune: "bg-purple-400",
  spell: "bg-violet-400",
  prayer: "bg-sky-400",
  quest: "bg-teal-400",
  recipe: "bg-orange-300",
  "skill-unlock": "bg-green-400",
  "tier-req": "bg-yellow-300",
  "duel-arena": "bg-red-300",
  mining: "bg-amber-500",
  woodcutting: "bg-green-500",
  fishing: "bg-cyan-500",
  biome: "bg-emerald-500",
  area: "bg-lime-500",
  config: "bg-gray-500",
  building: "bg-stone-400",
  lod: "bg-zinc-400",
  music: "bg-fuchsia-400",
  "custom-asset": "bg-teal-400",
  prefab: "bg-pink-400",
};

/** Category keys that support "place in world" — shared by list row
 *  hover action and detail pane Place button. */
const PLACEABLE_CATEGORY_KEYS = new Set([
  "entities/npcs",
  "entities/stations",
  "entities/mob-spawns",
  "gathering/mining",
  "gathering/woodcutting",
  "gathering/fishing",
  "custom/placed",
  "custom/prefabs",
]);

// ============== BUILD ALL ENTRIES ==============

function buildAllEntries(manifests: ManifestData): ContentEntry[] {
  const entries: ContentEntry[] = [];

  // NPCs
  manifests.npcs.forEach((n: ManifestNPC) => {
    entries.push({
      id: `npc:${n.id}`,
      name: n.name,
      categoryKey: "entities/npcs",
      typeLabel: n.category,
      dotColor: DOT_COLORS[n.category] ?? DOT_COLORS.npc,
      info: `${n.category} Lv${n.levelRange[0]}-${n.levelRange[1]}`,
      level: n.levelRange[0],
      entityId: n.id,
    });
  });

  // Stations
  manifests.stations.forEach((s: ManifestStation) => {
    entries.push({
      id: `station:${s.type}`,
      name: s.name,
      categoryKey: "entities/stations",
      typeLabel: "station",
      dotColor: DOT_COLORS.station,
      info: s.type,
      entityId: s.type,
    });
  });

  // Mob spawns (mobs and bosses)
  manifests.npcs
    .filter((n: ManifestNPC) => n.category === "mob" || n.category === "boss")
    .forEach((n: ManifestNPC) => {
      entries.push({
        id: `mob-spawn:${n.id}`,
        name: `${n.name} Spawn`,
        categoryKey: "entities/mob-spawns",
        typeLabel: n.category,
        dotColor: DOT_COLORS[n.category] ?? DOT_COLORS.mob,
        info: `Lv${n.levelRange[0]}-${n.levelRange[1]}`,
        level: n.levelRange[0],
        entityId: n.id,
      });
    });

  // Items by type
  const itemTypeToCategory: Record<string, string> = {
    weapon: "items/weapons",
    armor: "items/armor",
    resource: "items/resources",
    tool: "items/tools",
    food: "items/food",
    misc: "items/misc",
    ammunition: "items/ammo",
    rune: "items/runes",
  };

  manifests.items.forEach((i: ManifestItem) => {
    entries.push({
      id: `item:${i.id}`,
      name: i.name,
      categoryKey: itemTypeToCategory[i.type] ?? "items/misc",
      typeLabel: i.type,
      dotColor: DOT_COLORS[i.type] ?? DOT_COLORS.misc,
      info:
        [i.tier, i.rarity, i.levelRequired ? `Lv${i.levelRequired}` : null]
          .filter(Boolean)
          .join(" · ") || i.type,
      level: i.levelRequired,
      entityId: i.id,
    });
  });

  // Combat spells
  manifests.combatSpells.forEach((s: ManifestCombatSpell) => {
    entries.push({
      id: `spell:${s.id}`,
      name: s.name,
      categoryKey: "combat/spells",
      typeLabel: "spell",
      dotColor: DOT_COLORS.spell,
      info: `Lv${s.level} ${s.element} (${s.tier})`,
      level: s.level,
      entityId: s.id,
    });
  });

  // Prayers
  manifests.prayers.forEach((p: ManifestPrayer) => {
    entries.push({
      id: `prayer:${p.id}`,
      name: p.name,
      categoryKey: "combat/prayers",
      typeLabel: "prayer",
      dotColor: DOT_COLORS.prayer,
      info: `Lv${p.level} ${p.category}`,
      level: p.level,
      entityId: p.id,
    });
  });

  // Runes (combat category)
  manifests.runes.forEach((r: ManifestRune) => {
    entries.push({
      id: `rune:${r.id}`,
      name: r.name,
      categoryKey: "combat/runes",
      typeLabel: "rune",
      dotColor: DOT_COLORS.rune,
      info: r.element ?? "basic",
      entityId: r.id,
    });
  });

  // Ammunition (combat category)
  manifests.ammunition.forEach((a: ManifestAmmunition) => {
    entries.push({
      id: `ammo:${a.id}`,
      name: a.name,
      categoryKey: "combat/ammo",
      typeLabel: "ammo",
      dotColor: DOT_COLORS.ammo,
      info: `+${a.rangedStrength} str Lv${a.requiredRangedLevel}`,
      level: a.requiredRangedLevel,
      entityId: a.id,
    });
  });

  // Duel arenas
  manifests.duelArenas.forEach((a: ManifestDuelArena) => {
    entries.push({
      id: `arena:${a.arenaId}`,
      name: `Arena ${a.arenaId}`,
      categoryKey: "combat/duel-arenas",
      typeLabel: "duel-arena",
      dotColor: DOT_COLORS["duel-arena"],
      info: `Size ${a.size}`,
      entityId: `arena_${a.arenaId}`,
    });
  });

  // Quests
  manifests.quests.forEach((q: ManifestQuest) => {
    entries.push({
      id: `quest:${q.id}`,
      name: q.name,
      categoryKey: "progression/quests",
      typeLabel: "quest",
      dotColor: DOT_COLORS.quest,
      info: `${q.difficulty} · ${q.stages.length} stages`,
      entityId: q.id,
    });
  });

  // Skill unlocks
  manifests.skillUnlocks.forEach((u: ManifestSkillUnlock, idx: number) => {
    entries.push({
      id: `skill-unlock:${u.skill}_${u.level}_${idx}`,
      name: `${u.skill} Lv${u.level}`,
      categoryKey: "progression/skill-unlocks",
      typeLabel: "skill-unlock",
      dotColor: DOT_COLORS["skill-unlock"],
      info: u.description,
      level: u.level,
      entityId: `${u.skill}_${u.level}`,
    });
  });

  // Tier requirements
  manifests.tierRequirements.forEach(
    (t: ManifestTierRequirement, idx: number) => {
      entries.push({
        id: `tier-req:${t.tier}_${t.category}_${idx}`,
        name: `${t.tier} ${t.category}`,
        categoryKey: "progression/tier-reqs",
        typeLabel: "tier-req",
        dotColor: DOT_COLORS["tier-req"],
        info: Object.entries(t.requirements)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", "),
        entityId: `${t.tier}_${t.category}`,
      });
    },
  );

  // Recipes by skill
  manifests.recipes.forEach((r: ManifestRecipe) => {
    const catKey = `recipes/${r.skill}`;
    entries.push({
      id: `recipe:${r.id}`,
      name: r.output ?? r.id,
      categoryKey: catKey,
      typeLabel: "recipe",
      dotColor: DOT_COLORS.recipe,
      info: `Lv${r.level} · ${r.xp}xp`,
      level: r.level,
      entityId: r.id,
    });
  });

  // Gathering: Mining
  manifests.miningRocks.forEach((r: ManifestMiningRock) => {
    entries.push({
      id: `mining:${r.id}`,
      name: r.name,
      categoryKey: "gathering/mining",
      typeLabel: "mining",
      dotColor: DOT_COLORS.mining,
      info: `Lv${r.levelRequired}`,
      level: r.levelRequired,
      entityId: r.id,
    });
  });

  // Gathering: Woodcutting
  manifests.trees.forEach((t: ManifestTree) => {
    entries.push({
      id: `woodcutting:${t.id}`,
      name: t.name,
      categoryKey: "gathering/woodcutting",
      typeLabel: "woodcutting",
      dotColor: DOT_COLORS.woodcutting,
      info: `Lv${t.levelRequired}`,
      level: t.levelRequired,
      entityId: t.id,
    });
  });

  // Gathering: Fishing
  manifests.fishingSpots.forEach((f: ManifestFishingSpot) => {
    entries.push({
      id: `fishing:${f.id}`,
      name: f.name,
      categoryKey: "gathering/fishing",
      typeLabel: "fishing",
      dotColor: DOT_COLORS.fishing,
      info: `Lv${f.levelRequired}`,
      level: f.levelRequired,
      entityId: f.id,
    });
  });

  // Stores
  manifests.stores.forEach((s: ManifestStore) => {
    entries.push({
      id: `store:${s.id}`,
      name: s.name,
      categoryKey: "entities/stores",
      typeLabel: "store",
      dotColor: DOT_COLORS.store,
      info: `${s.items.length} items`,
      entityId: s.id,
    });
  });

  return entries;
}

// ============== CATEGORY COUNT HELPERS ==============

function countByCategory(entries: ContentEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.categoryKey, (counts.get(entry.categoryKey) ?? 0) + 1);
  }
  return counts;
}

/** Sum counts for a parent node (all children) */
function getNodeCount(node: CategoryNode, counts: Map<string, number>): number {
  if (node.leaf) return counts.get(node.key) ?? 0;
  if (!node.children) return 0;
  return node.children.reduce(
    (sum, child) => sum + getNodeCount(child, counts),
    0,
  );
}

// Walk the tree to find a node + its parent chain. Used by the header
// breadcrumb so the user knows which category the visible rows belong to.
function findNodePath(
  tree: CategoryNode[],
  key: string,
  ancestors: CategoryNode[] = [],
): CategoryNode[] | null {
  for (const node of tree) {
    if (node.key === key) return [...ancestors, node];
    if (node.children) {
      const found = findNodePath(node.children, key, [...ancestors, node]);
      if (found) return found;
    }
  }
  return null;
}

function categoryTotalEntries(
  tree: CategoryNode[],
  key: string,
  counts: Map<string, number>,
): number {
  const path = findNodePath(tree, key);
  if (!path) return 0;
  // Total for a leaf is its own count; for a parent it's the recursive
  // sum already exposed by getNodeCount.
  return getNodeCount(path[path.length - 1], counts);
}

// ============== FILTER CHIP PARSING ==============

interface ParsedSearch {
  text: string;
  typeFilters: FilterType[];
}

function parseSearchQuery(raw: string): ParsedSearch {
  const typeFilters: FilterType[] = [];
  let text = raw;

  // Extract type:xxx chips
  const typeRegex = /type:(\w+)/gi;
  let match: RegExpExecArray | null;
  while ((match = typeRegex.exec(raw)) !== null) {
    const val = match[1].toLowerCase() as FilterType;
    if (val in FILTER_TYPE_LABELS) {
      typeFilters.push(val);
    }
  }
  text = text.replace(/type:\w+/gi, "").trim();

  return { text, typeFilters };
}

/** Check if a content entry matches filter type chips */
function matchesTypeFilter(
  entry: ContentEntry,
  filters: FilterType[],
): boolean {
  if (filters.length === 0) return true;
  return filters.some((f) => {
    switch (f) {
      case "npc":
        return entry.id.startsWith("npc:") || entry.id.startsWith("mob-spawn:");
      case "item":
        return entry.id.startsWith("item:");
      case "station":
        return entry.id.startsWith("station:") || entry.id.startsWith("store:");
      case "spell":
        return entry.id.startsWith("spell:");
      case "prayer":
        return entry.id.startsWith("prayer:");
      case "quest":
        return entry.id.startsWith("quest:");
      case "recipe":
        return entry.id.startsWith("recipe:");
      case "rune":
        return entry.id.startsWith("rune:");
      case "ammo":
        return entry.id.startsWith("ammo:");
      default:
        return false;
    }
  });
}

// ============== MAIN COMPONENT ==============

export const ContentBrowser = React.memo(function ContentBrowser() {
  const { state, actions, activeModule } = useWorldStudio();
  const manifests = state.manifests;

  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(
    () => new Set(["entities", "items"]),
  );
  // Default to list view. Grid is too dense for a narrow sidebar — 3-col
  // cards truncate names to 3 chars and waste vertical space on a single
  // letter placeholder.
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [sortBy, setSortBy] = useState<"default" | "name" | "type" | "level">(
    "default",
  );
  const [selectedEntry, setSelectedEntry] = useState<ContentEntry | null>(null);

  const customAssets = state.extendedLayers.customAssets;
  const prefabs = state.prefabs;
  // AP6 — manifest-driven entries are gated on the active module's
  // required asset packs being installed (per `GameModule.requiredAssetPacks`).
  // Custom assets + prefabs (project-scoped, not pack-scoped) are
  // always shown.
  const requiredPacksSatisfied = hasAllRequiredAssetPacks(
    activeModule,
    state.project.assetPacks,
  );

  // Build all content entries
  const allEntries = useMemo(() => {
    const entries =
      manifests.loaded && requiredPacksSatisfied
        ? buildAllEntries(manifests)
        : [];

    // Add placed custom assets
    for (const ca of customAssets) {
      entries.push({
        id: `custom-asset:${ca.id}`,
        name: ca.name,
        categoryKey: "custom/placed",
        typeLabel: "custom-asset",
        dotColor: DOT_COLORS["custom-asset"],
        info: ca.assetName || ca.assetId,
        entityId: ca.id,
      });
    }

    // Add prefabs
    for (const pf of prefabs) {
      entries.push({
        id: `prefab:${pf.id}`,
        name: pf.name,
        categoryKey: "custom/prefabs",
        typeLabel: "prefab",
        dotColor: DOT_COLORS.prefab,
        info: `${pf.entries.length} entities`,
        entityId: pf.id,
      });
    }

    return entries;
  }, [manifests, customAssets, prefabs, requiredPacksSatisfied]);

  const categoryCounts = useMemo(
    () => countByCategory(allEntries),
    [allEntries],
  );

  // Parse search (uses deferred value for filtering performance)
  const parsed = useMemo(
    () => parseSearchQuery(deferredSearch),
    [deferredSearch],
  );

  // Filter entries
  const filteredEntries = useMemo(() => {
    let result = allEntries;

    // Category filter
    if (selectedCategory) {
      result = result.filter((e) => e.categoryKey === selectedCategory);
    }

    // Type chip filter
    if (parsed.typeFilters.length > 0) {
      result = result.filter((e) => matchesTypeFilter(e, parsed.typeFilters));
    }

    // Text search
    if (parsed.text) {
      const q = parsed.text.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.info.toLowerCase().includes(q) ||
          e.typeLabel.toLowerCase().includes(q) ||
          e.entityId.toLowerCase().includes(q),
      );
    }

    // Sort. Copy before sorting so memo inputs stay referentially stable.
    if (sortBy !== "default") {
      result = [...result].sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "type") {
          return (
            a.typeLabel.localeCompare(b.typeLabel) ||
            a.name.localeCompare(b.name)
          );
        }
        // level — undefined levels sort last
        const al = a.level ?? Number.POSITIVE_INFINITY;
        const bl = b.level ?? Number.POSITIVE_INFINITY;
        return al - bl || a.name.localeCompare(b.name);
      });
    }

    return result;
  }, [allEntries, selectedCategory, parsed, sortBy]);

  // Virtualizer for large content lists
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const GRID_COLS = 3;
  const gridRowCount = Math.ceil(filteredEntries.length / GRID_COLS);
  const gridVirtualizer = useVirtualizer({
    count: viewMode === "grid" ? gridRowCount : filteredEntries.length,
    getScrollElement: () => contentScrollRef.current,
    estimateSize: () => (viewMode === "grid" ? 56 : 26),
    overscan: 8,
  });

  // Toggle parent expansion
  const toggleParent = useCallback((key: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Select a leaf category
  const handleCategorySelect = useCallback((key: string) => {
    setSelectedCategory((prev) => (prev === key ? null : key));
    setSelectedEntry(null);
  }, []);

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  // Drag start handler
  const handleDragStart = useCallback(
    (e: React.DragEvent, entry: ContentEntry) => {
      e.dataTransfer.setData("text/entity-id", entry.entityId);
      e.dataTransfer.setData(
        "application/x-content-browser",
        JSON.stringify({
          id: entry.entityId,
          name: entry.name,
          type: entry.typeLabel,
          categoryKey: entry.categoryKey,
        }),
      );
      e.dataTransfer.effectAllowed = "copy";
    },
    [],
  );

  // Place in world handler
  const handlePlaceInWorld = useCallback(
    (entry: ContentEntry) => {
      // Map content type to palette category for the placement system
      const categoryKey = entry.categoryKey;
      if (categoryKey === "entities/npcs") {
        actions.startPlacement("npcs", entry.entityId, entry.name);
      } else if (categoryKey === "entities/stations") {
        actions.startPlacement("stations", entry.entityId, entry.name);
      } else if (categoryKey === "entities/mob-spawns") {
        actions.startPlacement("mob-spawns", entry.entityId, entry.name);
      } else if (categoryKey === "gathering/mining") {
        actions.startPlacement("resources-mining", entry.entityId, entry.name);
      } else if (categoryKey === "gathering/woodcutting") {
        actions.startPlacement(
          "resources-woodcutting",
          entry.entityId,
          entry.name,
        );
      } else if (categoryKey === "gathering/fishing") {
        actions.startPlacement("resources-fishing", entry.entityId, entry.name);
      } else if (categoryKey === "custom/placed") {
        actions.startPlacement("custom-assets", entry.entityId, entry.name);
      } else if (categoryKey === "custom/prefabs") {
        actions.startPlacement("prefabs", entry.entityId, entry.name);
      }
    },
    [actions],
  );

  // Header context: when a leaf category is active, the header shows
  // "Parent ›" as a breadcrumb and the leaf name as the title, plus
  // `X / Y` (filtered-of-total) so the user knows how many rows were
  // hidden by the search/type-chip filters.
  const selectedPath = useMemo(
    () =>
      selectedCategory ? findNodePath(CATEGORY_TREE, selectedCategory) : null,
    [selectedCategory],
  );
  const browseTitle = selectedPath
    ? selectedPath[selectedPath.length - 1].label
    : "Content";
  const browseBreadcrumb =
    selectedPath && selectedPath.length > 1
      ? selectedPath
          .slice(0, -1)
          .map((n) => n.label)
          .join(" › ")
      : null;
  const browseTotal = selectedCategory
    ? categoryTotalEntries(CATEGORY_TREE, selectedCategory, categoryCounts)
    : allEntries.length;

  // Loading state
  if (!manifests.loaded) {
    return (
      <div className="flex flex-col h-full">
        <BrowserHeader
          title="Content"
          subtitle={null}
          breadcrumb={null}
          onBack={null}
          resultCount={0}
          totalCount={null}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          showViewToggle={false}
          sortBy={sortBy}
          onSortChange={setSortBy}
          showSort={false}
        />
        <div className="flex-1 flex items-center justify-center">
          {manifests.loading ? (
            <div className="text-center text-text-tertiary">
              <Loader2 size={16} className="mx-auto mb-2 animate-spin" />
              <p className="text-xs">Loading manifests...</p>
            </div>
          ) : manifests.error ? (
            <div className="text-center text-red-400 px-4">
              <AlertCircle size={16} className="mx-auto mb-2" />
              <p className="text-xs">{manifests.error}</p>
            </div>
          ) : (
            <p className="text-xs text-text-tertiary">Manifests not loaded</p>
          )}
        </div>
      </div>
    );
  }

  // Master-detail mode: when an entry is selected, the content pane
  // swaps to a dedicated detail view so the inline manifest editor gets
  // the whole panel's height instead of being squeezed under a
  // simultaneously-rendered grid.
  if (selectedEntry) {
    return (
      <div className="flex flex-col h-full">
        <BrowserHeader
          title={selectedEntry.name}
          subtitle={`${selectedEntry.typeLabel} · ${selectedEntry.info}`}
          breadcrumb={null}
          onBack={() => setSelectedEntry(null)}
          resultCount={null}
          totalCount={null}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          showViewToggle={false}
          sortBy={sortBy}
          onSortChange={setSortBy}
          showSort={false}
        />
        <ContentDetailPane
          entry={selectedEntry}
          onPlaceInWorld={() => handlePlaceInWorld(selectedEntry)}
        />
      </div>
    );
  }

  const hasBreadcrumb = Boolean(browseBreadcrumb);

  return (
    <div className="flex flex-col h-full">
      {/* Unified compact toolbar — search pill spans width, count/sort/view
          inline at right. No more "Content" title row (the tab label
          already says "Content"). */}
      <div className="flex items-center gap-2 px-2 py-1 border-b border-border-primary">
        <div className="relative flex-1 min-w-0">
          <Search
            size={12}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              hasBreadcrumb
                ? `Search in ${browseTitle}`
                : "Search by name, id, or description"
            }
            className="w-full pl-7 pr-7 py-1 text-xs bg-black/20 border border-transparent rounded-md text-text-primary placeholder:text-text-tertiary hover:bg-black/25 focus:outline-none focus:bg-black/30 focus:border-primary/40"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-text-tertiary hover:text-text-primary rounded"
              title="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <span
          className="text-[10px] text-text-tertiary tabular-nums"
          title={
            browseTotal !== filteredEntries.length
              ? `${filteredEntries.length} shown of ${browseTotal}`
              : `${filteredEntries.length} entries`
          }
        >
          {browseTotal !== filteredEntries.length
            ? `${filteredEntries.length} / ${browseTotal}`
            : filteredEntries.length}
        </span>
        <select
          value={sortBy}
          onChange={(e) =>
            setSortBy(e.target.value as "default" | "name" | "type" | "level")
          }
          className="text-[10px] bg-black/20 border border-transparent rounded px-1 py-0.5 text-text-secondary hover:text-text-primary hover:bg-black/30 focus:outline-none focus:border-primary/40"
          title="Sort entries"
        >
          <option value="default">Sort</option>
          <option value="name">Name</option>
          <option value="type">Type</option>
          <option value="level">Level</option>
        </select>
        <div className="flex items-center gap-0.5">
          <button
            className={`p-1 rounded transition-colors ${
              viewMode === "list"
                ? "text-primary bg-primary/10"
                : "text-text-tertiary hover:text-text-primary"
            } ease-out`}
            onClick={() => setViewMode("list")}
            title="List view"
          >
            <List size={12} />
          </button>
          <button
            className={`p-1 rounded transition-colors ${
              viewMode === "grid"
                ? "text-primary bg-primary/10"
                : "text-text-tertiary hover:text-text-primary"
            } ease-out`}
            onClick={() => setViewMode("grid")}
            title="Grid view"
          >
            <Grid3x3 size={12} />
          </button>
        </div>
      </div>

      {/* Main body: tree + content grid/list */}
      <div className="flex-1 flex min-h-0">
        {/* Left category tree */}
        <div className="w-[170px] flex-shrink-0 bg-black/10 overflow-y-auto scrollbar-thin py-1">
          {CATEGORY_TREE.map((node) => (
            <CategoryTreeNode
              key={node.key}
              node={node}
              depth={0}
              expandedParents={expandedParents}
              selectedCategory={selectedCategory}
              categoryCounts={categoryCounts}
              onToggleParent={toggleParent}
              onSelectCategory={handleCategorySelect}
            />
          ))}
        </div>

        {/* Right content area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div
            ref={contentScrollRef}
            className="flex-1 overflow-y-auto scrollbar-thin"
          >
            {filteredEntries.length === 0 ? (
              <EmptyState hasQuery={Boolean(searchQuery || selectedCategory)} />
            ) : (
              <div
                style={{
                  height: `${gridVirtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
                className={viewMode === "grid" ? "p-2" : ""}
              >
                {gridVirtualizer.getVirtualItems().map((virtualRow) => {
                  if (viewMode === "grid") {
                    const startIdx = virtualRow.index * GRID_COLS;
                    const rowEntries = filteredEntries.slice(
                      startIdx,
                      startIdx + GRID_COLS,
                    );
                    return (
                      <div
                        key={virtualRow.key}
                        className="grid grid-cols-3 gap-1.5"
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 8,
                          right: 8,
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        {rowEntries.map((entry) => (
                          <ContentGridCard
                            key={entry.id}
                            entry={entry}
                            onClick={() => setSelectedEntry(entry)}
                            onDragStart={(e) => handleDragStart(e, entry)}
                          />
                        ))}
                      </div>
                    );
                  } else {
                    const entry = filteredEntries[virtualRow.index];
                    return (
                      <div
                        key={virtualRow.key}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <ContentListRow
                          entry={entry}
                          index={virtualRow.index}
                          onClick={() => setSelectedEntry(entry)}
                          onDragStart={(e) => handleDragStart(e, entry)}
                          onPlace={
                            PLACEABLE_CATEGORY_KEYS.has(entry.categoryKey)
                              ? () => handlePlaceInWorld(entry)
                              : null
                          }
                        />
                      </div>
                    );
                  }
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// ============== EMPTY STATE ==============

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center text-text-tertiary px-6 max-w-[240px]">
        <Inbox size={28} className="mx-auto mb-3 opacity-30" />
        <p className="text-xs font-medium text-text-secondary mb-1">
          {hasQuery ? "No matches" : "Browse content"}
        </p>
        <p className="text-[11px] leading-relaxed opacity-80">
          {hasQuery
            ? "Try a different search or filter, or pick a different category."
            : "Pick a category on the left, or search for an item, NPC, spell, or quest."}
        </p>
      </div>
    </div>
  );
}

// ============== HEADER ==============

function BrowserHeader({
  title,
  subtitle,
  breadcrumb,
  onBack,
  resultCount,
  totalCount,
  viewMode,
  onViewModeChange,
  showViewToggle,
  sortBy,
  onSortChange,
  showSort,
}: {
  title: string;
  subtitle: string | null;
  /** "Items › Misc" — shown in place of title when present (browse mode) */
  breadcrumb: string | null;
  onBack: (() => void) | null;
  /** Filtered (visible) row count; null to hide */
  resultCount: number | null;
  /** Total rows in the selected category (ignoring filters); null to hide */
  totalCount: number | null;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  showViewToggle: boolean;
  sortBy: "default" | "name" | "type" | "level";
  onSortChange: (sort: "default" | "name" | "type" | "level") => void;
  showSort: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border-primary">
      {onBack ? (
        <button
          onClick={onBack}
          className="p-0.5 -ml-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary/50 transition-colors ease-out"
          title="Back to browse"
        >
          <ArrowLeft size={14} />
        </button>
      ) : null}
      <div className="flex-1 min-w-0">
        {breadcrumb ? (
          <div className="text-[10px] text-text-tertiary truncate">
            {breadcrumb}
          </div>
        ) : null}
        <div className="text-xs font-semibold text-text-primary truncate">
          {title}
        </div>
        {subtitle ? (
          <div className="text-[10px] text-text-tertiary truncate">
            {subtitle}
          </div>
        ) : null}
      </div>
      {resultCount !== null ? (
        <span
          className="text-[10px] text-text-tertiary tabular-nums mr-1"
          title={
            totalCount !== null && totalCount !== resultCount
              ? `${resultCount} shown of ${totalCount} total`
              : `${resultCount} entries`
          }
        >
          {totalCount !== null && totalCount !== resultCount
            ? `${resultCount} / ${totalCount}`
            : resultCount}
        </span>
      ) : null}
      {showSort ? (
        <select
          value={sortBy}
          onChange={(e) =>
            onSortChange(
              e.target.value as "default" | "name" | "type" | "level",
            )
          }
          className="text-[10px] bg-black/20 border border-transparent rounded px-1 py-0.5 text-text-secondary hover:text-text-primary hover:bg-black/30 focus:outline-none focus:border-primary/40"
          title="Sort entries"
        >
          <option value="default">Sort</option>
          <option value="name">Name</option>
          <option value="type">Type</option>
          <option value="level">Level</option>
        </select>
      ) : null}
      {showViewToggle ? (
        <div className="flex items-center gap-0.5">
          <button
            className={`p-1 rounded transition-colors ${
              viewMode === "list"
                ? "text-primary bg-primary/10"
                : "text-text-tertiary hover:text-text-primary"
            } ease-out`}
            onClick={() => onViewModeChange("list")}
            title="List view"
          >
            <List size={12} />
          </button>
          <button
            className={`p-1 rounded transition-colors ${
              viewMode === "grid"
                ? "text-primary bg-primary/10"
                : "text-text-tertiary hover:text-text-primary"
            } ease-out`}
            onClick={() => onViewModeChange("grid")}
            title="Grid view"
          >
            <Grid3x3 size={12} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ============== CATEGORY TREE NODE ==============

function CategoryTreeNode({
  node,
  depth,
  expandedParents,
  selectedCategory,
  categoryCounts,
  onToggleParent,
  onSelectCategory,
}: {
  node: CategoryNode;
  depth: number;
  expandedParents: Set<string>;
  selectedCategory: string | null;
  categoryCounts: Map<string, number>;
  onToggleParent: (key: string) => void;
  onSelectCategory: (key: string) => void;
}) {
  const count = getNodeCount(node, categoryCounts);
  const isExpanded = expandedParents.has(node.key);
  const isSelected = selectedCategory === node.key;
  const hasChildren = !node.leaf && node.children && node.children.length > 0;

  return (
    <div>
      <button
        className={`w-full flex items-center gap-1 py-1 pr-2 text-left transition-colors ${
          isSelected
            ? "bg-primary/15 text-primary"
            : "text-text-secondary hover:bg-bg-tertiary/50 hover:text-text-primary"
        } ease-out`}
        style={{ paddingLeft: `${depth * 10 + 6}px` }}
        onClick={() => {
          if (node.leaf) {
            onSelectCategory(node.key);
          } else {
            onToggleParent(node.key);
          }
        }}
      >
        {hasChildren ? (
          <ChevronRight
            size={10}
            className={`flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""} ease-out`}
          />
        ) : (
          <span className="w-[10px] flex-shrink-0" />
        )}
        {node.icon && (
          <span className="flex-shrink-0 opacity-70">{node.icon}</span>
        )}
        <span className="text-[11px] flex-1 truncate">{node.label}</span>
        {count > 0 && (
          <span className="text-[9px] text-text-tertiary tabular-nums flex-shrink-0">
            {count}
          </span>
        )}
      </button>

      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <CategoryTreeNode
              key={child.key}
              node={child}
              depth={depth + 1}
              expandedParents={expandedParents}
              selectedCategory={selectedCategory}
              categoryCounts={categoryCounts}
              onToggleParent={onToggleParent}
              onSelectCategory={onSelectCategory}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============== CONTENT GRID CARD ==============

function ContentGridCard({
  entry,
  onClick,
  onDragStart,
}: {
  entry: ContentEntry;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  return (
    <div
      className="group flex flex-col justify-center gap-0.5 px-2 py-1.5 rounded-md bg-black/10 border border-transparent cursor-pointer transition-colors hover:bg-bg-tertiary/50 hover:border-primary/30 ease-out"
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      title={`${entry.name}\n${entry.info}`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${entry.dotColor}`}
        />
        <span className="text-[11px] text-text-primary truncate leading-tight flex-1 min-w-0">
          {entry.name}
        </span>
      </div>
      <span className="text-[9px] text-text-tertiary truncate leading-tight pl-3.5">
        {entry.info}
      </span>
    </div>
  );
}

// ============== CONTENT LIST ROW ==============

function ContentListRow({
  entry,
  index,
  onClick,
  onDragStart,
  onPlace,
}: {
  entry: ContentEntry;
  index: number;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  /** Non-null for placeable entries — reveals a Place button on hover. */
  onPlace: (() => void) | null;
}) {
  // UE5-style alternating row shading (no hard dividers).
  const bandClass = index % 2 === 1 ? "bg-bg-tertiary/30" : "";
  return (
    <div
      className={`group flex items-center gap-2 px-3 h-[26px] cursor-pointer transition-colors hover:bg-bg-tertiary/50 ${bandClass} ease-out`}
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
    >
      {/* Type dot */}
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${entry.dotColor}`}
      />
      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-text-primary truncate">
          {entry.name}
        </div>
      </div>
      {/* Hover action: Place in World (placeable types only) */}
      {onPlace ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPlace();
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] rounded bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 flex-shrink-0 ease-out"
          title="Place in world"
        >
          <Crosshair size={9} />
        </button>
      ) : null}
      {/* Type label */}
      <span className="text-[9px] text-text-tertiary flex-shrink-0">
        {entry.typeLabel}
      </span>
      {/* Level/info */}
      {entry.level != null && (
        <span className="text-[9px] text-text-tertiary tabular-nums flex-shrink-0 w-8 text-right">
          Lv{entry.level}
        </span>
      )}
    </div>
  );
}

// ============== DETAIL PANE ==============

// Full-pane detail view rendered when an entry is selected. The
// BrowserHeader sits above (and owns the title + back button), so this
// pane only shows the entry's type chip, action buttons, and the inline
// manifest form editor — which now gets the entire content area height
// instead of being capped at 45% of the panel.
function ContentDetailPane({
  entry,
  onPlaceInWorld,
}: {
  entry: ContentEntry;
  onPlaceInWorld: () => void;
}) {
  const isPlaceable = PLACEABLE_CATEGORY_KEYS.has(entry.categoryKey);

  const manifestName = categoryKeyToManifestName(entry.categoryKey);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin bg-bg-secondary">
      {/* Compact summary strip */}
      <div className="flex items-center gap-2 px-3 py-2 bg-black/10">
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${entry.dotColor}`}
        />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-text-tertiary truncate opacity-70">
            ID: {entry.entityId}
          </div>
        </div>
        {isPlaceable && (
          <button
            onClick={onPlaceInWorld}
            className="flex items-center gap-1 px-2 py-1 text-[10px] bg-primary/15 border border-primary/30 rounded text-primary hover:bg-primary/25 transition-colors flex-shrink-0 ease-out"
            title="Start placement in viewport"
          >
            <Crosshair size={10} />
            Place in World
          </button>
        )}
      </div>

      {/* Inline form editor. Renders when this entry's category has a
          registered ManifestFormEditor route. Edits commit straight into
          WorldStudio state (same store the deployment panel diffs against). */}
      {manifestName ? (
        <ManifestFormEditor
          manifestName={manifestName}
          entryId={entry.entityId}
        />
      ) : (
        <div className="px-3 py-6 text-center text-text-tertiary">
          <p className="text-[11px]">
            No inline editor for this content type yet.
          </p>
          <p className="text-[10px] opacity-70 mt-1">
            Drag it to the viewport to place an instance, or edit the manifest
            directly.
          </p>
        </div>
      )}
    </div>
  );
}
