/**
 * EntityPalette — Entity placement browser for World Studio
 *
 * Shown in the left sidebar when the Place tool is active (editing mode).
 * Displays categorized entity templates loaded from game manifests:
 * - NPCs (mobs, bosses, neutral, quest)
 * - Stations (anvil, furnace, bank, altar, etc.)
 * - Mob Spawn Zones
 * - Resources: Mining, Woodcutting, Fishing
 * - Spawn Points
 * - Teleports
 *
 * Click an item to start a placement (ghost preview follows cursor in viewport).
 */

import {
  ChevronRight,
  Compass,
  Droplets,
  Fish,
  Flame,
  Gem,
  Grid3x3,
  List,
  Loader2,
  MapPin,
  Music,
  Navigation,
  Package,
  Search,
  Shield,
  Skull,
  Speaker,
  Star,
  TreePine,
  User,
  AlertTriangle,
  Volume2,
  Zap,
} from "lucide-react";
import React, { useMemo, useState, useCallback, useDeferredValue } from "react";

import type { PaletteCategory, PaletteItem } from "../types";
import { useWorldStudio } from "../WorldStudioContext";
import { hasAllRequiredAssetPacks } from "../../../gameModules/GameModule";
import { EntityThumbnail } from "./EntityThumbnail";
import {
  buildModulePalette,
  type ModulePaletteCategory,
} from "../../../gameModules/utils/buildModulePalette";
import { hexToTailwindAccent } from "../../../gameModules/utils/hexToTailwindAccent";
import { resolveLucideIcon } from "../../../gameModules/utils/lucideIconMap";

/** Category display config */
interface CategoryConfig {
  id: PaletteCategory;
  label: string;
  icon: React.ReactNode;
  description: string;
  /** Tailwind color classes for the category accent */
  color: {
    icon: string;
    bg: string;
    bgHover: string;
    border: string;
    count: string;
  };
}

const CATEGORIES: CategoryConfig[] = [
  {
    id: "npcs",
    label: "NPCs",
    icon: <User size={13} />,
    description: "Place NPC entities from manifest",
    color: {
      icon: "text-blue-400",
      bg: "bg-blue-500/5",
      bgHover: "hover:bg-blue-500/10",
      border: "border-l-blue-500/60",
      count: "bg-blue-500/15 text-blue-400",
    },
  },
  {
    id: "stations",
    label: "Stations",
    icon: <Flame size={13} />,
    description: "Crafting and service stations",
    color: {
      icon: "text-orange-400",
      bg: "bg-orange-500/5",
      bgHover: "hover:bg-orange-500/10",
      border: "border-l-orange-500/60",
      count: "bg-orange-500/15 text-orange-400",
    },
  },
  {
    id: "mob-spawns",
    label: "Mob Spawns",
    icon: <Skull size={13} />,
    description: "Mob spawn zone markers",
    color: {
      icon: "text-red-400",
      bg: "bg-red-500/5",
      bgHover: "hover:bg-red-500/10",
      border: "border-l-red-500/60",
      count: "bg-red-500/15 text-red-400",
    },
  },
  {
    id: "resources-mining",
    label: "Mining Rocks",
    icon: <Gem size={13} />,
    description: "Ore nodes and mining spots",
    color: {
      icon: "text-amber-400",
      bg: "bg-amber-500/5",
      bgHover: "hover:bg-amber-500/10",
      border: "border-l-amber-500/60",
      count: "bg-amber-500/15 text-amber-400",
    },
  },
  {
    id: "resources-woodcutting",
    label: "Trees",
    icon: <TreePine size={13} />,
    description: "Woodcutting trees",
    color: {
      icon: "text-green-400",
      bg: "bg-green-500/5",
      bgHover: "hover:bg-green-500/10",
      border: "border-l-green-500/60",
      count: "bg-green-500/15 text-green-400",
    },
  },
  {
    id: "resources-fishing",
    label: "Fishing Spots",
    icon: <Fish size={13} />,
    description: "Fishing spot markers",
    color: {
      icon: "text-cyan-400",
      bg: "bg-cyan-500/5",
      bgHover: "hover:bg-cyan-500/10",
      border: "border-l-cyan-500/60",
      count: "bg-cyan-500/15 text-cyan-400",
    },
  },
  {
    id: "spawn-points",
    label: "Spawn Points",
    icon: <MapPin size={13} />,
    description: "Player spawn locations",
    color: {
      icon: "text-emerald-400",
      bg: "bg-emerald-500/5",
      bgHover: "hover:bg-emerald-500/10",
      border: "border-l-emerald-500/60",
      count: "bg-emerald-500/15 text-emerald-400",
    },
  },
  {
    id: "teleports",
    label: "Teleports",
    icon: <Navigation size={13} />,
    description: "Teleport network nodes",
    color: {
      icon: "text-purple-400",
      bg: "bg-purple-500/5",
      bgHover: "hover:bg-purple-500/10",
      border: "border-l-purple-500/60",
      count: "bg-purple-500/15 text-purple-400",
    },
  },
  {
    id: "pois",
    label: "Points of Interest",
    icon: <Compass size={13} />,
    description: "Dungeons, shrines, landmarks, camps",
    color: {
      icon: "text-pink-400",
      bg: "bg-pink-500/5",
      bgHover: "hover:bg-pink-500/10",
      border: "border-l-pink-500/60",
      count: "bg-pink-500/15 text-pink-400",
    },
  },
  {
    id: "water-bodies",
    label: "Water Bodies",
    icon: <Droplets size={13} />,
    description: "Rivers, lakes, ponds",
    color: {
      icon: "text-sky-400",
      bg: "bg-sky-500/5",
      bgHover: "hover:bg-sky-500/10",
      border: "border-l-sky-500/60",
      count: "bg-sky-500/15 text-sky-400",
    },
  },
  {
    id: "danger-sources",
    label: "Danger Sources",
    icon: <Zap size={13} />,
    description: "Localized difficulty hotspots",
    color: {
      icon: "text-rose-400",
      bg: "bg-rose-500/5",
      bgHover: "hover:bg-rose-500/10",
      border: "border-l-rose-500/60",
      count: "bg-rose-500/15 text-rose-400",
    },
  },
  {
    id: "music-zones",
    label: "Music Zones",
    icon: <Music size={13} />,
    description: "Background music regions",
    color: {
      icon: "text-violet-400",
      bg: "bg-violet-500/5",
      bgHover: "hover:bg-violet-500/10",
      border: "border-l-violet-500/60",
      count: "bg-violet-500/15 text-violet-400",
    },
  },
  {
    id: "ambient-zones",
    label: "Ambient Zones",
    icon: <Volume2 size={13} />,
    description: "Environmental ambient sound areas",
    color: {
      icon: "text-indigo-400",
      bg: "bg-indigo-500/5",
      bgHover: "hover:bg-indigo-500/10",
      border: "border-l-indigo-500/60",
      count: "bg-indigo-500/15 text-indigo-400",
    },
  },
  {
    id: "sfx-triggers",
    label: "SFX Triggers",
    icon: <Speaker size={13} />,
    description: "Point-source sound effect triggers",
    color: {
      icon: "text-fuchsia-400",
      bg: "bg-fuchsia-500/5",
      bgHover: "hover:bg-fuchsia-500/10",
      border: "border-l-fuchsia-500/60",
      count: "bg-fuchsia-500/15 text-fuchsia-400",
    },
  },
  {
    id: "custom-assets",
    label: "Custom Assets",
    icon: <Package size={13} />,
    description: "Imported models from Asset Forge",
    color: {
      icon: "text-teal-400",
      bg: "bg-teal-500/5",
      bgHover: "hover:bg-teal-500/10",
      border: "border-l-teal-500/60",
      count: "bg-teal-500/15 text-teal-400",
    },
  },
];

export const EntityPalette = React.memo(function EntityPalette() {
  const { state, actions, activeModule } = useWorldStudio();
  const { manifests, tools } = state;
  const activePlacement = tools.activePlacement;
  const isHyperia = activeModule.id === "hyperia";
  // AP6 — palette items are gated on the project having installed
  // every pack the active module declares as required (per
  // `GameModule.requiredAssetPacks`). A blank project or one that
  // uninstalled a required pack gets an empty palette + a hint
  // to install, even if `manifests.loaded` is true (the global
  // manifest store may still hold the data for other consumers —
  // runtime placeholders, server tooling).
  const requiredPacksSatisfied = hasAllRequiredAssetPacks(
    activeModule,
    state.project.assetPacks,
  );

  const [expandedCategory, setExpandedCategory] =
    useState<PaletteCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [recentPlacements, setRecentPlacements] = useState<string[]>([]);

  // Build palette items from loaded manifests
  const paletteItems = useMemo((): Map<PaletteCategory, PaletteItem[]> => {
    const map = new Map<PaletteCategory, PaletteItem[]>();

    // AP6 — gate every category on the active module's required
    // packs being installed, NOT just manifests.loaded. Without
    // this a fresh project shows trees + rocks + NPCs in the
    // palette even when it hasn't installed any pack.
    if (!manifests.loaded || !requiredPacksSatisfied) {
      CATEGORIES.forEach((c) => map.set(c.id, []));
      return map;
    }

    // NPCs
    map.set(
      "npcs",
      manifests.npcs.map((npc) => ({
        id: npc.id,
        name: npc.name,
        category: "npcs" as PaletteCategory,
        modelPath: npc.appearance?.modelPath || undefined,
        iconPath: npc.appearance?.iconPath,
        description: npc.description,
        levelRequired: npc.levelRange?.[0],
        manifestData: { ...npc } as unknown as Record<string, unknown>,
      })),
    );

    // Stations
    map.set(
      "stations",
      manifests.stations.map((s) => ({
        id: s.type,
        name: s.name,
        category: "stations" as PaletteCategory,
        modelPath: s.model || undefined,
        description: s.examine,
        manifestData: { ...s } as unknown as Record<string, unknown>,
      })),
    );

    // Mob spawns — reuse NPC mobs for the template list
    map.set(
      "mob-spawns",
      manifests.npcs
        .filter((npc) => npc.category === "mob" || npc.category === "boss")
        .map((npc) => ({
          id: npc.id,
          name: `${npc.name} Spawn`,
          category: "mob-spawns" as PaletteCategory,
          modelPath: npc.appearance?.modelPath || undefined,
          description: `Lvl ${npc.levelRange?.[0] ?? "?"}–${npc.levelRange?.[1] ?? "?"} — ${npc.description}`,
          levelRequired: npc.levelRange?.[0],
          manifestData: { ...npc } as unknown as Record<string, unknown>,
        })),
    );

    // Mining rocks
    map.set(
      "resources-mining",
      manifests.miningRocks.map((r) => ({
        id: r.id,
        name: r.name,
        category: "resources-mining" as PaletteCategory,
        modelPath: r.modelPath || undefined,
        description: r.examine,
        levelRequired: r.levelRequired,
        manifestData: { ...r } as unknown as Record<string, unknown>,
      })),
    );

    // Woodcutting trees
    map.set(
      "resources-woodcutting",
      manifests.trees.map((t) => ({
        id: t.id,
        name: t.name,
        category: "resources-woodcutting" as PaletteCategory,
        modelPath: t.modelVariants?.[0] || undefined,
        description: t.examine,
        levelRequired: t.levelRequired,
        manifestData: { ...t } as unknown as Record<string, unknown>,
      })),
    );

    // Fishing spots
    map.set(
      "resources-fishing",
      manifests.fishingSpots.map((f) => ({
        id: f.id,
        name: f.name,
        category: "resources-fishing" as PaletteCategory,
        description: f.examine,
        levelRequired: f.levelRequired,
        manifestData: { ...f } as unknown as Record<string, unknown>,
      })),
    );

    // Spawn points — templates are created by the user, not from manifests
    map.set("spawn-points", [
      {
        id: "spawn-initial",
        name: "Initial Spawn",
        category: "spawn-points" as PaletteCategory,
        description: "Where new players first appear",
        manifestData: { spawnType: "initial" },
      },
      {
        id: "spawn-death-respawn",
        name: "Death Respawn",
        category: "spawn-points" as PaletteCategory,
        description: "Where players respawn after death",
        manifestData: { spawnType: "death-respawn" },
      },
      {
        id: "spawn-teleport-arrival",
        name: "Teleport Arrival",
        category: "spawn-points" as PaletteCategory,
        description: "Teleport destination point",
        manifestData: { spawnType: "teleport-arrival" },
      },
    ]);

    // Teleports — user-created templates
    map.set("teleports", [
      {
        id: "teleport-lodestone",
        name: "Lodestone",
        category: "teleports" as PaletteCategory,
        description:
          "Teleport node unlocked by visiting (tile-based-MMORPG-style)",
        manifestData: { nodeType: "lodestone" },
      },
      {
        id: "teleport-portal",
        name: "Portal",
        category: "teleports" as PaletteCategory,
        description: "Always-available teleport destination",
        manifestData: { nodeType: "portal" },
      },
      {
        id: "teleport-shortcut",
        name: "Shortcut",
        category: "teleports" as PaletteCategory,
        description: "Quest-gated teleport shortcut",
        manifestData: { nodeType: "shortcut" },
      },
    ]);

    // POIs — templates for each category
    map.set("pois", [
      {
        id: "poi-dungeon",
        name: "Dungeon Entrance",
        category: "pois" as PaletteCategory,
        description: "Underground dungeon access point",
        manifestData: { poiCategory: "dungeon" },
      },
      {
        id: "poi-shrine",
        name: "Shrine",
        category: "pois" as PaletteCategory,
        description: "Healing or buff shrine",
        manifestData: { poiCategory: "shrine" },
      },
      {
        id: "poi-landmark",
        name: "Landmark",
        category: "pois" as PaletteCategory,
        description: "Notable visual feature",
        manifestData: { poiCategory: "landmark" },
      },
      {
        id: "poi-resource-area",
        name: "Resource Area",
        category: "pois" as PaletteCategory,
        description: "Rich gathering zone",
        manifestData: { poiCategory: "resource_area" },
      },
      {
        id: "poi-ruin",
        name: "Ruin",
        category: "pois" as PaletteCategory,
        description: "Ancient structure remnants",
        manifestData: { poiCategory: "ruin" },
      },
      {
        id: "poi-camp",
        name: "Camp",
        category: "pois" as PaletteCategory,
        description: "NPC or player campsite",
        manifestData: { poiCategory: "camp" },
      },
      {
        id: "poi-crossing",
        name: "Crossing",
        category: "pois" as PaletteCategory,
        description: "Road or river crossing point",
        manifestData: { poiCategory: "crossing" },
      },
      {
        id: "poi-waystation",
        name: "Waystation",
        category: "pois" as PaletteCategory,
        description: "Rest stop along roads",
        manifestData: { poiCategory: "waystation" },
      },
      {
        id: "poi-fishing-spot",
        name: "Fishing Spot",
        category: "pois" as PaletteCategory,
        description: "Notable fishing location",
        manifestData: { poiCategory: "fishing_spot" },
      },
    ]);

    // Water bodies — templates for each type
    map.set("water-bodies", [
      {
        id: "water-river",
        name: "River",
        category: "water-bodies" as PaletteCategory,
        description: "Flowing water with waypoints",
        manifestData: { bodyType: "river" },
      },
      {
        id: "water-lake",
        name: "Lake",
        category: "water-bodies" as PaletteCategory,
        description: "Still water body with polygon",
        manifestData: { bodyType: "lake" },
      },
      {
        id: "water-pond",
        name: "Pond",
        category: "water-bodies" as PaletteCategory,
        description: "Small water feature",
        manifestData: { bodyType: "pond" },
      },
    ]);

    // Danger sources — user-created templates
    map.set("danger-sources", [
      {
        id: "danger-dark-wizard",
        name: "Dark Wizard Circle",
        category: "danger-sources" as PaletteCategory,
        description:
          "High-intensity danger pocket (like dark wizards south of Varrock)",
        manifestData: { intensity: 2, radius: 40, falloffCurve: 1.5 },
      },
      {
        id: "danger-spider-nest",
        name: "Spider Nest",
        category: "danger-sources" as PaletteCategory,
        description: "Medium danger zone with sharp falloff",
        manifestData: { intensity: 1.5, radius: 30, falloffCurve: 2 },
      },
      {
        id: "danger-weak",
        name: "Danger Zone (Weak)",
        category: "danger-sources" as PaletteCategory,
        description: "Slight difficulty increase over a wide area",
        manifestData: { intensity: 0.5, radius: 60, falloffCurve: 1 },
      },
      {
        id: "danger-strong",
        name: "Danger Zone (Strong)",
        category: "danger-sources" as PaletteCategory,
        description: "Intense danger with gradual falloff",
        manifestData: { intensity: 3, radius: 50, falloffCurve: 1.2 },
      },
    ]);

    // Phase 9.3: Audio zone templates
    map.set("music-zones", [
      {
        id: "music-zone-default",
        name: "Music Zone",
        category: "music-zones" as PaletteCategory,
        description: "Background music region with polygon boundary",
        manifestData: { priority: 0, blendDistance: 10 },
      },
      {
        id: "music-zone-combat",
        name: "Combat Music Zone",
        category: "music-zones" as PaletteCategory,
        description: "Zone with combat music override",
        manifestData: { priority: 1, blendDistance: 5 },
      },
    ]);

    map.set("ambient-zones", [
      {
        id: "ambient-forest",
        name: "Forest Ambience",
        category: "ambient-zones" as PaletteCategory,
        description: "Birds, rustling leaves, wind through trees",
        manifestData: {
          ambientType: "forest",
          volume: 0.7,
          falloffDistance: 15,
        },
      },
      {
        id: "ambient-cave",
        name: "Cave Ambience",
        category: "ambient-zones" as PaletteCategory,
        description: "Dripping water, echoes, distant rumbles",
        manifestData: { ambientType: "cave", volume: 0.8, falloffDistance: 10 },
      },
      {
        id: "ambient-ocean",
        name: "Ocean Ambience",
        category: "ambient-zones" as PaletteCategory,
        description: "Waves, seagulls, wind",
        manifestData: {
          ambientType: "ocean",
          volume: 0.6,
          falloffDistance: 20,
        },
      },
      {
        id: "ambient-town",
        name: "Town Ambience",
        category: "ambient-zones" as PaletteCategory,
        description: "Crowd chatter, merchants, activity",
        manifestData: { ambientType: "town", volume: 0.5, falloffDistance: 10 },
      },
      {
        id: "ambient-desert",
        name: "Desert Ambience",
        category: "ambient-zones" as PaletteCategory,
        description: "Wind, sand, distant heat shimmer",
        manifestData: {
          ambientType: "desert",
          volume: 0.4,
          falloffDistance: 25,
        },
      },
      {
        id: "ambient-swamp",
        name: "Swamp Ambience",
        category: "ambient-zones" as PaletteCategory,
        description: "Frogs, insects, bubbling mud",
        manifestData: {
          ambientType: "swamp",
          volume: 0.7,
          falloffDistance: 12,
        },
      },
    ]);

    map.set("sfx-triggers", [
      {
        id: "sfx-waterfall",
        name: "Waterfall SFX",
        category: "sfx-triggers" as PaletteCategory,
        description: "Looping waterfall sound at a point",
        manifestData: { radius: 30, volume: 0.8, looping: true },
      },
      {
        id: "sfx-campfire",
        name: "Campfire SFX",
        category: "sfx-triggers" as PaletteCategory,
        description: "Crackling fire sound",
        manifestData: { radius: 10, volume: 0.6, looping: true },
      },
      {
        id: "sfx-bell",
        name: "Bell Chime SFX",
        category: "sfx-triggers" as PaletteCategory,
        description: "One-shot bell chime trigger",
        manifestData: { radius: 50, volume: 0.9, looping: false },
      },
    ]);

    // Phase 9.1: Custom assets (populated from state)
    map.set("custom-assets", []);

    return map;
  }, [manifests, requiredPacksSatisfied]);

  // Build palette from GameModule schema for non-Hyperia modules
  const modulePalette = useMemo((): ModulePaletteCategory[] | null => {
    if (isHyperia) return null;
    return buildModulePalette(activeModule);
  }, [isHyperia, activeModule]);

  // Unified category list + item map for rendering
  const effectiveCategories = useMemo(() => {
    if (modulePalette) {
      // Dynamic module mode — derive categories from module palette
      return modulePalette.map((cat) => {
        const accent = hexToTailwindAccent(cat.color);
        const IconComponent = resolveLucideIcon(cat.icon);
        return {
          id: cat.id as PaletteCategory,
          label: cat.label,
          icon: <IconComponent size={13} />,
          description: cat.description,
          color: accent,
          items: cat.items.map(
            (item): PaletteItem => ({
              id: item.id,
              name: item.name,
              category: cat.id as PaletteCategory,
              description: item.description,
              manifestData: item.defaults,
              entityTypeId: item.entityTypeId,
            }),
          ),
        };
      });
    }
    // Hyperia mode — use hardcoded CATEGORIES with manifest-driven items
    return CATEGORIES.map((cat) => ({
      ...cat,
      items: paletteItems.get(cat.id) ?? [],
    }));
  }, [modulePalette, paletteItems]);

  // Filter categories and items by search
  const filteredCategories = useMemo(() => {
    if (!deferredSearch.trim()) return effectiveCategories;

    const query = deferredSearch.toLowerCase();
    return effectiveCategories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            item.name.toLowerCase().includes(query) ||
            item.description?.toLowerCase().includes(query),
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [effectiveCategories, deferredSearch]);

  const handleCategoryToggle = useCallback((categoryId: PaletteCategory) => {
    setExpandedCategory((prev) => (prev === categoryId ? null : categoryId));
  }, []);

  const handleItemClick = useCallback(
    (item: PaletteItem & { entityTypeId?: string }) => {
      actions.startPlacement(
        item.category,
        item.id,
        item.name,
        item.entityTypeId,
      );
      // Track recent placements
      setRecentPlacements((prev) => {
        const key = `${item.category}:${item.id}`;
        const filtered = prev.filter((k) => k !== key);
        return [key, ...filtered].slice(0, 8);
      });
    },
    [actions],
  );

  const toggleFavorite = useCallback((itemId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  // Drag start handler for drag-and-drop placement
  // Starts placement immediately so the ghost preview appears as the cursor
  // enters the viewport during drag.
  const handleDragStart = useCallback(
    (e: React.DragEvent, item: PaletteItem) => {
      e.dataTransfer.setData(
        "application/x-entity-palette",
        JSON.stringify({
          category: item.category,
          id: item.id,
          name: item.name,
        }),
      );
      e.dataTransfer.effectAllowed = "copy";
      // Start placement so ghost renders during drag
      actions.startPlacement(item.category, item.id, item.name);
    },
    [actions],
  );

  // Loading state (only relevant for Hyperia manifest-driven palette)
  if (isHyperia && manifests.loading) {
    return (
      <div className="flex flex-col h-full">
        <PaletteHeader viewMode={viewMode} onViewModeChange={setViewMode} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <Loader2
              size={20}
              className="mx-auto animate-spin text-text-tertiary"
            />
            <p className="text-xs text-text-tertiary">Loading manifests...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state (only relevant for Hyperia)
  if (isHyperia && manifests.error) {
    return (
      <div className="flex flex-col h-full">
        <PaletteHeader viewMode={viewMode} onViewModeChange={setViewMode} />
        <div className="flex-1 flex items-center justify-center px-3">
          <div className="text-center space-y-2">
            <AlertTriangle size={20} className="mx-auto text-red-400" />
            <p className="text-xs text-red-400">{manifests.error}</p>
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // AP6 — empty state when the active module's required packs are
  // not installed. Distinct from "loading" / "error": the project
  // simply hasn't opted into the module's content. User installs
  // via the AI companion or a future Asset Library pack picker.
  if (isHyperia && !requiredPacksSatisfied) {
    const missing = (activeModule.requiredAssetPacks ?? []).filter(
      (id) => !state.project.assetPacks.includes(id),
    );
    return (
      <div className="flex flex-col h-full">
        <PaletteHeader viewMode={viewMode} onViewModeChange={setViewMode} />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center space-y-2 max-w-[240px]">
            <Package size={20} className="mx-auto text-text-tertiary/60" />
            <p className="text-xs text-text-tertiary">
              {missing.length === 1
                ? "Required asset pack not installed."
                : `${missing.length} required asset packs not installed.`}
            </p>
            <p className="text-[10px] text-text-tertiary/70 leading-relaxed">
              The {activeModule.name} module needs:
            </p>
            <ul className="text-[10px] text-text-tertiary/80 font-mono space-y-0.5">
              {missing.map((id) => (
                <li key={id} className="truncate">
                  {id}
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-text-tertiary/70 leading-relaxed pt-1">
              Ask the AI companion to install{" "}
              {missing.length === 1 ? "it" : "them"} or add via the Asset
              Library.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PaletteHeader viewMode={viewMode} onViewModeChange={setViewMode} />

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-white/[0.06]">
        <div className="relative">
          <Search
            size={11}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary/60"
          />
          <input
            type="text"
            placeholder="Search entities..."
            className="w-full pl-6.5 pr-2 py-1.5 text-xs bg-white/[0.03] border border-transparent rounded text-text-primary placeholder:text-text-tertiary/50 focus:outline-none focus:border-primary/30 focus:bg-white/[0.05] transition-colors"
            style={{ paddingLeft: "1.625rem" }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Active placement indicator */}
      {activePlacement && (
        <div className="mx-2.5 mt-2 mb-0 px-2.5 py-2 bg-primary/10 border border-primary/20 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[11px] text-primary font-medium">
                Placing: {activePlacement.templateName}
              </span>
            </div>
            <button
              className="text-[10px] text-text-tertiary hover:text-text-primary px-1.5 py-0.5 rounded hover:bg-white/[0.05] transition-colors"
              onClick={actions.cancelPlacement}
            >
              ESC
            </button>
          </div>
        </div>
      )}

      {/* Category list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-1.5 py-1.5 space-y-1">
        {filteredCategories.map((category) => {
          const items = category.items;
          const itemCount = items.length;
          const isExpanded = expandedCategory === category.id;

          return (
            <div
              key={category.id}
              className={`rounded-md overflow-hidden transition-colors ${
                isExpanded ? category.color.bg : ""
              }`}
            >
              {/* Category header */}
              <button
                className={`w-full flex items-center gap-2 px-2.5 py-2 text-left transition-colors rounded-md border-l-2 ${
                  isExpanded
                    ? `${category.color.border} ${category.color.bg}`
                    : `border-l-transparent ${category.color.bgHover}`
                }`}
                onClick={() => handleCategoryToggle(category.id)}
              >
                <ChevronRight
                  size={11}
                  className={`text-text-tertiary transition-transform flex-shrink-0 ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                />
                <span className={`flex-shrink-0 ${category.color.icon}`}>
                  {category.icon}
                </span>
                <span className="text-xs font-medium text-text-primary flex-1 truncate">
                  {category.label}
                </span>
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${category.color.count}`}
                >
                  {itemCount}
                </span>
              </button>

              {/* Expanded items */}
              {isExpanded && items && (
                <div className="pb-1.5 pt-0.5">
                  {items.length === 0 ? (
                    <div className="px-7 py-2 text-[10px] text-text-tertiary italic">
                      No items available
                    </div>
                  ) : viewMode === "grid" ? (
                    <div className="grid grid-cols-3 gap-1.5 px-2 py-1">
                      {items.map((item) => (
                        <PaletteItemCard
                          key={item.id}
                          item={item}
                          isActive={
                            activePlacement?.templateId === item.id &&
                            activePlacement?.category === item.category
                          }
                          onClick={() => handleItemClick(item)}
                          onDragStart={(e) => handleDragStart(e, item)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-px px-1">
                      {items.map((item) => (
                        <PaletteItemRow
                          key={item.id}
                          item={item}
                          isActive={
                            activePlacement?.templateId === item.id &&
                            activePlacement?.category === item.category
                          }
                          isFavorite={favorites.has(item.id)}
                          onClick={() => handleItemClick(item)}
                          onDragStart={(e) => handleDragStart(e, item)}
                          onToggleFavorite={() => toggleFavorite(item.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

/** Header for the palette panel */
function PaletteHeader({
  viewMode,
  onViewModeChange,
}: {
  viewMode: "list" | "grid";
  onViewModeChange: (mode: "list" | "grid") => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
      <Shield size={13} className="text-primary/70" />
      <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider flex-1">
        Entity Palette
      </span>
      <div className="flex items-center gap-px rounded-md p-px bg-white/[0.04]">
        <button
          className={`p-1 rounded transition-colors ${viewMode === "list" ? "text-primary bg-primary/15" : "text-text-tertiary hover:text-text-secondary"}`}
          onClick={() => onViewModeChange("list")}
          title="List view"
        >
          <List size={12} />
        </button>
        <button
          className={`p-1 rounded transition-colors ${viewMode === "grid" ? "text-primary bg-primary/15" : "text-text-tertiary hover:text-text-secondary"}`}
          onClick={() => onViewModeChange("grid")}
          title="Grid view"
        >
          <Grid3x3 size={12} />
        </button>
      </div>
    </div>
  );
}

/** Single item row in the palette (list view) */
function PaletteItemRow({
  item,
  isActive,
  isFavorite,
  onClick,
  onDragStart,
  onToggleFavorite,
}: {
  item: PaletteItem;
  isActive: boolean;
  isFavorite: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onToggleFavorite: () => void;
}) {
  return (
    <div
      className={`group w-full flex items-center gap-2.5 px-2 py-1 text-left transition-all cursor-pointer rounded-md ${
        isActive
          ? "bg-primary/15 ring-1 ring-primary/30"
          : "hover:bg-white/[0.03]"
      }`}
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      title={item.description}
    >
      <div
        className={`w-8 h-8 rounded-md overflow-hidden flex-shrink-0 ring-1 ${
          isActive ? "ring-primary/40" : "ring-white/[0.06]"
        }`}
      >
        <EntityThumbnail
          category={item.category}
          templateId={item.id}
          className="w-full h-full"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-text-primary truncate leading-tight">
          {item.name}
        </div>
        {item.levelRequired != null && item.levelRequired > 1 && (
          <div className="text-[10px] text-text-tertiary leading-tight mt-0.5">
            Lvl {item.levelRequired}
          </div>
        )}
      </div>
      <button
        className={`p-0.5 rounded transition-opacity ${isFavorite ? "text-amber-400 opacity-100" : "text-text-tertiary opacity-0 group-hover:opacity-100"}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        title={isFavorite ? "Unpin" : "Pin to favorites"}
      >
        <Star size={10} fill={isFavorite ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

/** Grid card view for an entity */
function PaletteItemCard({
  item,
  isActive,
  onClick,
  onDragStart,
}: {
  item: PaletteItem;
  isActive: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  return (
    <div
      className={`group flex flex-col items-center p-1.5 rounded-lg cursor-pointer transition-all ${
        isActive
          ? "ring-1 ring-primary/40 bg-primary/10"
          : "hover:bg-white/[0.04] ring-1 ring-transparent hover:ring-white/[0.06]"
      }`}
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      title={item.description}
    >
      {/* 3D model thumbnail */}
      <div
        className={`w-full aspect-square rounded-md overflow-hidden ring-1 ${
          isActive ? "ring-primary/30" : "ring-white/[0.06]"
        }`}
      >
        <EntityThumbnail
          category={item.category}
          templateId={item.id}
          className="w-full h-full"
        />
      </div>
      <span className="text-[10px] text-text-primary text-center truncate w-full leading-tight mt-1.5">
        {item.name}
      </span>
      {item.levelRequired != null && item.levelRequired > 1 && (
        <span className="text-[9px] text-text-tertiary mt-0.5">
          Lvl {item.levelRequired}
        </span>
      )}
    </div>
  );
}
