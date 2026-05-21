/**
 * ProcgenPanel — UE5-inspired procedural generation tool panel
 *
 * Shown in the left sidebar when active tool is "procgen".
 * Provides full control over terrain, biomes, towns, roads, and vegetation
 * generation parameters with live preview and apply functionality.
 */

import type {
  TerrainNoiseConfig,
  NoiseLayerConfig,
} from "@hyperforge/procgen/terrain";
import { TERRAIN_PRESETS } from "@hyperforge/procgen/terrain";
import {
  Mountain,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Dice5,
  Building2,
  Route,
  Layers,
  Eye,
  Info,
  Waves,
  TreePine,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Download,
  Upload,
} from "lucide-react";
import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";

import type {
  WorldCreationConfig,
  WorldData,
  TownGenerationConfig,
  RoadGenerationConfig,
  BiomeTreeVegetationConfig,
  VegetationConfig,
} from "../../WorldBuilder/types";
import { DEFAULT_VEGETATION_CONFIG } from "../../WorldBuilder/types";
import {
  generateTerrainAndBiomes,
  generateTownsAndBuildings,
  generateRoadsForTowns,
} from "../../WorldBuilder/worldGeneration";
import { useWorldGenerationWorker } from "../hooks/useWorldGenerationWorker";
import { useWorldStudio } from "../WorldStudioContext";
import { useActiveBiomes } from "../hooks/useActiveContent";

import {
  exportHeightmap,
  downloadHeightmap,
  loadHeightmapFromFile,
  loadHeightmapMetadata,
  createHeightmapQuerier,
} from "../utils/heightmapIO";
import { ComparisonOverlay } from "./ComparisonOverlay";
import {
  PropertySection,
  SliderInput,
  Toggle,
  InfoRow,
} from "./properties/PropertyControls";

// ============== BIOME COLOR MAP ==============

const BIOME_COLORS: Record<string, string> = {
  forest: "#228B22",
  plains: "#9ACD32",
  desert: "#EDC9AF",
  mountains: "#808080",
  tundra: "#B0E0E6",
  swamp: "#556B2F",
  valley: "#6B8E23",
  lakes: "#4682B4",
  volcanic: "#8B0000",
  savanna: "#D2B48C",
  jungle: "#006400",
  taiga: "#2E8B57",
  mesa: "#CD853F",
  arctic: "#F0F8FF",
  marshland: "#3B5323",
};

// ============== PRESET ICON MAP ==============

const PRESET_ICONS: Record<string, string> = {
  "demo-island": "🎮",
  "small-island": "🏝️",
  "large-island": "🌍",
  archipelago: "🗺️",
  continent: "🌎",
  "mountain-range": "⛰️",
  "flat-plains": "🌾",
  desert: "🏜️",
};

// ============== TREE SPECIES DISPLAY NAMES ==============

const TREE_DISPLAY_NAMES: Record<string, string> = {
  tree_fir: "Fir",
  tree_pine: "Pine",
  tree_oak: "Oak",
  tree_birch: "Birch",
  tree_bamboo: "Bamboo",
  tree_chinaPine: "China Pine",
  tree_maple: "Maple",
  tree_coconut: "Coconut Palm",
  tree_palm: "Desert Palm",
  tree_dead: "Dead Tree",
  tree_cactus: "Cactus",
  tree_knotwood: "Knotwood",
  tree_windPine: "Wind Pine",
};

/**
 * Convert a 24-bit hex color int (`0xRRGGBB`) into a CSS color
 * string (`"#rrggbb"`). Used to render biome swatches from the
 * runtime registry (which stores ints) into the DOM (which
 * expects strings).
 */
function hexIntToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

/** Fixed, perceptually distinct colors for each tree species (no random hues) */
const SPECIES_COLORS: Record<string, string> = {
  tree_fir: "#2D5016",
  tree_pine: "#3B7A1F",
  tree_oak: "#8B6914",
  tree_birch: "#D4C89A",
  tree_bamboo: "#7FB069",
  tree_chinaPine: "#4A6741",
  tree_maple: "#C44D35",
  tree_coconut: "#4CAF50",
  tree_palm: "#8BC34A",
  tree_dead: "#6D4C41",
  tree_cactus: "#689F38",
  tree_knotwood: "#795548",
  tree_windPine: "#1B5E20",
};

// ============== SIZE DISTRIBUTION HELPERS ==============

/** Normalize distribution weights to sum to 1.0 */
function normalizeDistribution(
  dist: TownGenerationConfig["sizeDistribution"],
): TownGenerationConfig["sizeDistribution"] {
  const total = dist.hamlet + dist.village + dist.town;
  if (total === 0) return { hamlet: 0.33, village: 0.34, town: 0.33 };
  return {
    hamlet: Math.round((dist.hamlet / total) * 100) / 100,
    village: Math.round((dist.village / total) * 100) / 100,
    town: Math.round((dist.town / total) * 100) / 100,
  };
}

// ============== COMPONENT ==============

export const ProcgenPanel = React.memo(function ProcgenPanel() {
  const { state, actions, viewportRef } = useWorldStudio();
  const { generateWorld } = useWorldGenerationWorker();
  const world = state.builder.editing.world;
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRegeneratingTrees, setIsRegeneratingTrees] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localConfig, setLocalConfig] = useState<WorldCreationConfig | null>(
    null,
  );
  const [showNoiseViz, setShowNoiseViz] = useState(false);
  const [showAdvancedNoise, setShowAdvancedNoise] = useState(false);

  // Active biome tabs come from the content registry — every
  // biome installed plugins / content packs contribute. Empty
  // registry = no tabs (an empty-state line renders below).
  const registeredBiomes = useActiveBiomes();
  const registeredBiomeIds = useMemo(
    () => Object.keys(registeredBiomes).sort(),
    [registeredBiomes],
  );
  const [activeBiomeTab, setActiveBiomeTab] = useState<string | null>(null);
  // Keep the active tab in sync with the registry: if the
  // current tab vanishes (project switch / pack uninstall),
  // fall back to the first available biome. Initial mount also
  // resolves through this effect.
  useEffect(() => {
    if (
      registeredBiomeIds.length > 0 &&
      (activeBiomeTab === null || !registeredBiomeIds.includes(activeBiomeTab))
    ) {
      setActiveBiomeTab(registeredBiomeIds[0]!);
    } else if (registeredBiomeIds.length === 0 && activeBiomeTab !== null) {
      setActiveBiomeTab(null);
    }
  }, [registeredBiomeIds, activeBiomeTab]);
  const [previewStats, setPreviewStats] = useState<{
    tiles: number;
    biomes: number;
    towns: number;
    roads: number;
    generationTimeMs: number;
  } | null>(null);
  /** Original world stored when entering comparison mode, used for revert on reject */
  const [originalWorld, setOriginalWorld] = useState<WorldData | null>(null);

  // Use world's current config or local override
  const config = localConfig ?? world?.foundation.config ?? null;
  const hasLocalChanges = localConfig !== null;

  // Debounced live config dispatch — updates viewport terrain in ~150ms
  const liveConfigTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dispatchLiveConfig = useCallback(
    (cfg: WorldCreationConfig) => {
      if (liveConfigTimerRef.current) clearTimeout(liveConfigTimerRef.current);
      liveConfigTimerRef.current = setTimeout(() => {
        actions.setLiveTerrainConfig(cfg);
      }, 150);
    },
    [actions],
  );
  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (liveConfigTimerRef.current) clearTimeout(liveConfigTimerRef.current);
    };
  }, []);

  // Compute world stats from current foundation
  const worldStats = useMemo(() => {
    if (!world) return null;
    return {
      tileCount: world.foundation.config.terrain.worldSize ** 2,
      biomeCount: world.foundation.biomes.length,
      townCount: world.foundation.towns.length,
      roadCount: world.foundation.roads.length,
      buildingCount: world.foundation.buildings.length,
      worldSizeMeters:
        world.foundation.config.terrain.worldSize *
        world.foundation.config.terrain.tileSize,
    };
  }, [world]);

  // Collect unique biome types from the current world
  const activeBiomes = useMemo(() => {
    if (!world) return [];
    const biomeMap = new Map<
      string,
      { type: string; color: number; count: number }
    >();
    for (const biome of world.foundation.biomes) {
      const existing = biomeMap.get(biome.type);
      if (existing) {
        existing.count += 1;
      } else {
        biomeMap.set(biome.type, {
          type: biome.type,
          color: biome.color,
          count: 1,
        });
      }
    }
    return Array.from(biomeMap.values()).sort((a, b) => b.count - a.count);
  }, [world]);

  const handleConfigChange = useCallback(
    (partial: Partial<WorldCreationConfig>) => {
      let merged: WorldCreationConfig | null = null;
      setLocalConfig((prev) => {
        const base = prev ?? world?.foundation.config;
        if (!base) return null;
        merged = { ...base, ...partial };
        return merged;
      });
      // Dispatch live config so the viewport updates terrain in real-time
      if (merged) dispatchLiveConfig(merged);
      // Clear preview stats when config changes
      setPreviewStats(null);
    },
    [world?.foundation.config, dispatchLiveConfig],
  );

  const handleTerrainChange = useCallback(
    (partial: Partial<WorldCreationConfig["terrain"]>) => {
      handleConfigChange({
        terrain: {
          ...(localConfig?.terrain ??
            world?.foundation.config.terrain ?? {
              tileSize: 100,
              worldSize: 20,
              tileResolution: 32,
              maxHeight: 30,
              waterThreshold: 5.4,
            }),
          ...partial,
        },
      });
    },
    [handleConfigChange, localConfig, world],
  );

  const handleNoiseChannelChange = useCallback(
    (channel: keyof TerrainNoiseConfig, partial: Partial<NoiseLayerConfig>) => {
      const currentNoise = localConfig?.noise ?? world?.foundation.config.noise;
      if (!currentNoise) return;
      handleConfigChange({
        noise: {
          ...currentNoise,
          [channel]: { ...currentNoise[channel], ...partial },
        },
      });
    },
    [handleConfigChange, localConfig, world],
  );

  const handleTownChange = useCallback(
    (partial: Partial<TownGenerationConfig>) => {
      handleConfigChange({
        towns: {
          ...(localConfig?.towns ??
            world?.foundation.config.towns ?? {
              townCount: 5,
              minTownSpacing: 800,
              sizeDistribution: { hamlet: 0.4, village: 0.4, town: 0.2 },
              minFlatnessScore: 0.7,
              maxSlope: 0.15,
              biomePreferences: {},
              landmarks: {
                fencesEnabled: true,
                fenceDensity: 0.7,
                fencePostHeight: 1.2,
                lamppostsInVillages: true,
                lamppostSpacing: 15,
                marketStallsEnabled: true,
                decorationsEnabled: true,
              },
            }),
          ...partial,
        },
      });
    },
    [handleConfigChange, localConfig, world],
  );

  const handleRoadChange = useCallback(
    (partial: Partial<RoadGenerationConfig>) => {
      handleConfigChange({
        roads: {
          ...(localConfig?.roads ??
            world?.foundation.config.roads ?? {
              roadWidth: 6,
              pathStepSize: 10,
              smoothingIterations: 3,
              extraConnectionsRatio: 0.3,
              costSlopeMultiplier: 2.0,
              costWaterPenalty: 100,
              heuristicWeight: 1.2,
            }),
          ...partial,
        },
      });
    },
    [handleConfigChange, localConfig, world],
  );

  // Resolved vegetation config (local override → world config → defaults)
  const vegetationConfig = useMemo((): VegetationConfig => {
    return (
      localConfig?.vegetation ??
      world?.foundation.config.vegetation ??
      DEFAULT_VEGETATION_CONFIG
    );
  }, [localConfig, world]);

  const handleBiomeVegetationChange = useCallback(
    (biomeId: string, partial: Partial<BiomeTreeVegetationConfig>) => {
      const currentVeg =
        localConfig?.vegetation ??
        world?.foundation.config.vegetation ??
        DEFAULT_VEGETATION_CONFIG;
      const currentBiome =
        currentVeg[biomeId] ?? DEFAULT_VEGETATION_CONFIG[biomeId];
      if (!currentBiome) return;
      handleConfigChange({
        vegetation: {
          ...currentVeg,
          [biomeId]: { ...currentBiome, ...partial },
        },
      });
    },
    [handleConfigChange, localConfig, world],
  );

  const handleTreeWeightChange = useCallback(
    (biomeId: string, treeId: string, weight: number) => {
      const currentVeg =
        localConfig?.vegetation ??
        world?.foundation.config.vegetation ??
        DEFAULT_VEGETATION_CONFIG;
      const currentBiome =
        currentVeg[biomeId] ?? DEFAULT_VEGETATION_CONFIG[biomeId];
      if (!currentBiome) return;
      handleConfigChange({
        vegetation: {
          ...currentVeg,
          [biomeId]: {
            ...currentBiome,
            trees: {
              ...currentBiome.trees,
              [treeId]: { ...currentBiome.trees[treeId], weight },
            },
          },
        },
      });
    },
    [handleConfigChange, localConfig, world],
  );

  const handleRegenerateTrees = useCallback(async () => {
    setIsRegeneratingTrees(true);
    setError(null);
    try {
      // Invalidate server cache first, then refresh with current vegetation config
      await fetch("/api/world/trees/invalidate", { method: "POST" });
      await viewportRef.current.refreshVegetation?.(
        vegetationConfig,
        undefined,
        state.brushOverlays.vegetationPaints,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tree regeneration failed");
    } finally {
      setIsRegeneratingTrees(false);
    }
  }, [viewportRef, vegetationConfig]);

  const handleResetBiomeVegetation = useCallback(
    (biomeId: string) => {
      const defaults = DEFAULT_VEGETATION_CONFIG[biomeId];
      if (!defaults) return;
      const currentVeg =
        localConfig?.vegetation ??
        world?.foundation.config.vegetation ??
        DEFAULT_VEGETATION_CONFIG;
      handleConfigChange({
        vegetation: {
          ...currentVeg,
          [biomeId]: { ...defaults },
        },
      });
    },
    [handleConfigChange, localConfig, world],
  );

  const handlePresetChange = useCallback(
    (presetId: string) => {
      const preset = TERRAIN_PRESETS[presetId];
      if (!preset || !config) return;
      const pc = preset.config;
      handleConfigChange({
        preset: presetId,
        terrain: {
          ...config.terrain,
          tileSize: pc.tileSize ?? config.terrain.tileSize,
          worldSize: pc.worldSize ?? config.terrain.worldSize,
          maxHeight: pc.maxHeight ?? config.terrain.maxHeight,
          waterThreshold: pc.waterThreshold ?? config.terrain.waterThreshold,
        },
        ...(pc.noise ? { noise: { ...config.noise, ...pc.noise } } : {}),
        ...(pc.biomes ? { biomes: { ...config.biomes, ...pc.biomes } } : {}),
        ...(pc.island ? { island: { ...config.island, ...pc.island } } : {}),
      });
    },
    [config, handleConfigChange],
  );

  const handleRandomizeSeed = useCallback(() => {
    handleConfigChange({ seed: Math.floor(Math.random() * 2147483647) });
  }, [handleConfigChange]);

  // Stats for the before world — use originalWorld when in comparison mode
  const beforeStats = useMemo(() => {
    const src = originalWorld ?? world;
    if (!src) return { tiles: 0, biomes: 0, towns: 0, roads: 0 };
    return {
      tiles: src.foundation.config.terrain.worldSize ** 2,
      biomes: src.foundation.biomes.length,
      towns: src.foundation.towns.length,
      roads: src.foundation.roads.length,
    };
  }, [originalWorld, world]);

  const handlePreview = useCallback(async () => {
    if (!config || !world) return;
    setIsPreviewing(true);
    setError(null);
    try {
      // Store the current world so we can revert on reject
      setOriginalWorld(world);

      const { world: newWorld, elapsedMs } = await generateWorld(config);
      setPreviewStats({
        tiles: config.terrain.worldSize ** 2,
        biomes: newWorld.foundation.biomes.length,
        towns: newWorld.foundation.towns.length,
        roads: newWorld.foundation.roads.length,
        generationTimeMs: elapsedMs,
      });
      // Load the preview world into the viewport immediately
      actions.loadWorld(newWorld);
    } catch (err) {
      setOriginalWorld(null);
      setError(
        err instanceof Error ? err.message : "Preview generation failed",
      );
    } finally {
      setIsPreviewing(false);
    }
  }, [config, world, actions, generateWorld]);

  const handleAcceptPreview = useCallback(() => {
    // Preview world is already loaded in the viewport — just clean up comparison state
    setOriginalWorld(null);
    setPreviewStats(null);
    setLocalConfig(null);
    actions.clearLiveTerrainConfig();
  }, [actions]);

  const handleRejectPreview = useCallback(() => {
    // Revert to the original world
    if (originalWorld) {
      actions.loadWorld(originalWorld);
    }
    setOriginalWorld(null);
    setPreviewStats(null);
    actions.clearLiveTerrainConfig();
  }, [originalWorld, actions]);

  const handleRegenerate = useCallback(async () => {
    if (!config) return;
    setIsGenerating(true);
    setError(null);
    try {
      const { world: newWorld } = await generateWorld(config);
      actions.loadWorld(newWorld);
      setLocalConfig(null);
      setPreviewStats(null);
      setOriginalWorld(null);
      actions.clearLiveTerrainConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setIsGenerating(false);
    }
  }, [config, actions, generateWorld]);

  // Selective regeneration: towns only (keeps terrain and roads)
  const handleRegenerateTowns = useCallback(async () => {
    if (!config || !world) return;
    setIsGenerating(true);
    setError(null);
    try {
      const { terrainGenerator, biomes } = generateTerrainAndBiomes(config);
      const { towns, buildings } = generateTownsAndBuildings(
        config,
        terrainGenerator,
        biomes,
      );
      actions.setFoundationTowns(towns, buildings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Town regeneration failed");
    } finally {
      setIsGenerating(false);
    }
  }, [config, world, actions]);

  // Selective regeneration: roads only (keeps terrain and towns)
  const handleRegenerateRoads = useCallback(async () => {
    if (!config || !world) return;
    setIsGenerating(true);
    setError(null);
    try {
      const { terrainGenerator, biomes } = generateTerrainAndBiomes(config);
      // Use existing towns, regenerate just roads
      const { rawTowns } = generateTownsAndBuildings(
        config,
        terrainGenerator,
        biomes,
      );
      const roads = generateRoadsForTowns(
        config,
        terrainGenerator,
        world.foundation.towns,
        rawTowns,
      );
      actions.setFoundationRoads(roads);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Road regeneration failed");
    } finally {
      setIsGenerating(false);
    }
  }, [config, world, actions]);

  // Heightmap export
  const [isExporting, setIsExporting] = useState(false);
  const handleExportHeightmap = useCallback(async () => {
    if (!config) return;
    const querier = viewportRef.current.getTerrainQuerier?.();
    if (!querier) {
      setError("Terrain not ready — wait for tiles to load");
      return;
    }
    setIsExporting(true);
    setError(null);
    try {
      const result = await exportHeightmap(
        querier,
        config.terrain.worldSize,
        config.terrain.tileSize,
        config.terrain.maxHeight,
        config.terrain.waterThreshold,
      );
      downloadHeightmap(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Heightmap export failed");
    } finally {
      setIsExporting(false);
    }
  }, [config, viewportRef]);

  // Heightmap import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const metaInputRef = useRef<HTMLInputElement>(null);
  const [pendingHeightmap, setPendingHeightmap] = useState<{
    heights: Float32Array;
    width: number;
    height: number;
  } | null>(null);

  const handleImportPng = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const data = await loadHeightmapFromFile(file);
        setPendingHeightmap(data);
        // Now request the metadata JSON
        metaInputRef.current?.click();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load heightmap PNG",
        );
      }
      // Reset input so same file can be re-selected
      e.target.value = "";
    },
    [],
  );

  const handleImportMeta = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !pendingHeightmap) return;
      try {
        const meta = await loadHeightmapMetadata(file);
        const querier = createHeightmapQuerier(
          pendingHeightmap.heights,
          pendingHeightmap.width,
          pendingHeightmap.height,
          meta,
        );
        viewportRef.current.setImportedQuerier?.(querier);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load heightmap metadata",
        );
      }
      setPendingHeightmap(null);
      e.target.value = "";
    },
    [pendingHeightmap, viewportRef],
  );

  if (!world || !config) {
    return (
      <div className="p-4 text-sm text-text-tertiary">
        No world loaded. Load a project first.
      </div>
    );
  }

  const busy =
    isGenerating || isPreviewing || isRegeneratingTrees || isExporting;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-primary">
        <Mountain size={14} className="text-primary" />
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-[0.12em]">
          Procgen
        </span>
        {hasLocalChanges && (
          <span className="ml-auto text-[10px] text-amber-400 font-medium">
            Modified
          </span>
        )}
      </div>

      {/* Seed Display */}
      <div className="px-3 py-2 bg-bg-tertiary/30 border-b border-border-primary">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-tertiary uppercase tracking-[0.12em]">
            Current Seed
          </span>
          <span className="text-xs font-mono text-primary font-semibold">
            {config.seed}
          </span>
        </div>
        {worldStats && (
          <div className="mt-1 grid grid-cols-4 gap-1">
            <div className="text-center">
              <div className="text-[10px] font-mono text-text-secondary">
                {worldStats.tileCount.toLocaleString()}
              </div>
              <div className="text-[8px] text-text-tertiary uppercase tracking-[0.12em]">
                Tiles
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-mono text-text-secondary">
                {worldStats.biomeCount}
              </div>
              <div className="text-[8px] text-text-tertiary uppercase tracking-[0.12em]">
                Biomes
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-mono text-text-secondary">
                {worldStats.townCount}
              </div>
              <div className="text-[8px] text-text-tertiary uppercase tracking-[0.12em]">
                Towns
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-mono text-text-secondary">
                {worldStats.roadCount}
              </div>
              <div className="text-[8px] text-text-tertiary uppercase tracking-[0.12em]">
                Roads
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* ============== TERRAIN SECTION ============== */}
        <PropertySection
          title="Terrain"
          icon={<Mountain size={10} />}
          defaultOpen={true}
        >
          {/* Preset gallery */}
          <div className="space-y-1">
            <label className="text-xs text-text-secondary">World Preset</label>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(TERRAIN_PRESETS).map(([id, preset]) => {
                const isActive = config.preset === id;
                const icon = PRESET_ICONS[id] ?? "🌍";
                return (
                  <button
                    key={id}
                    className={`flex flex-col items-center gap-1 p-2 rounded border text-center transition-all ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
                        : "border-border-primary bg-bg-tertiary text-text-secondary hover:border-primary/40 hover:bg-primary/5"
                    } ${busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ease-out`}
                    onClick={() => !busy && handlePresetChange(id)}
                    disabled={busy}
                  >
                    <span className="text-lg leading-none">{icon}</span>
                    <span className="text-[10px] font-medium leading-tight">
                      {preset.name}
                    </span>
                    <span className="text-[9px] text-text-tertiary leading-tight">
                      {preset.config.worldSize
                        ? `${preset.config.worldSize}×${preset.config.worldSize}`
                        : ""}
                    </span>
                  </button>
                );
              })}
            </div>
            {config.preset && TERRAIN_PRESETS[config.preset] && (
              <p className="text-[10px] text-text-tertiary leading-tight mt-0.5">
                {TERRAIN_PRESETS[config.preset].description}
              </p>
            )}
          </div>

          {/* Game Mode / Creative Mode toggle */}
          <div className="space-y-1">
            <label className="text-xs text-text-secondary">
              Terrain Pipeline
            </label>
            <div className="flex gap-1 rounded border border-border-primary overflow-hidden">
              <button
                className={`flex-1 py-1 text-[10px] font-medium transition-colors ${
                  config.useGamePipeline !== false
                    ? "bg-primary/20 text-primary border-r border-primary/30"
                    : "bg-bg-tertiary text-text-tertiary hover:text-text-secondary border-r border-border-primary"
                } ease-out`}
                onClick={() => handleConfigChange({ useGamePipeline: true })}
                disabled={busy}
              >
                Game Mode
              </button>
              <button
                className={`flex-1 py-1 text-[10px] font-medium transition-colors ${
                  config.useGamePipeline === false
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-bg-tertiary text-text-tertiary hover:text-text-secondary"
                } ease-out`}
                onClick={() => handleConfigChange({ useGamePipeline: false })}
                disabled={busy}
              >
                Creative Mode
              </button>
            </div>
            <p className="text-[9px] text-text-tertiary leading-tight">
              {config.useGamePipeline !== false
                ? "Terrain matches the live game exactly."
                : "Experimental terrain with full noise control. May not match game."}
            </p>
          </div>

          {/* Seed with randomize */}
          <div className="space-y-0.5">
            <label className="text-xs text-text-secondary">Seed</label>
            <div className="flex gap-1.5">
              <input
                type="number"
                className="flex-1 px-2 py-1 text-xs bg-bg-tertiary border border-border-primary rounded font-mono text-text-primary focus:outline-none focus:border-primary/50 disabled:opacity-50"
                value={config.seed}
                onChange={(e) =>
                  handleConfigChange({ seed: Number(e.target.value) })
                }
                disabled={busy}
              />
              <button
                className="px-2 py-1 text-xs bg-bg-tertiary border border-border-primary rounded text-text-secondary hover:text-primary hover:border-primary/50 transition-colors disabled:opacity-50 ease-out"
                onClick={handleRandomizeSeed}
                disabled={busy}
                title="Randomize seed"
              >
                <Dice5 size={14} />
              </button>
            </div>
          </div>

          <SliderInput
            label="World Size"
            value={config.terrain.worldSize}
            onChange={(v) => handleTerrainChange({ worldSize: v })}
            min={5}
            max={200}
            step={5}
            unit="tiles"
            hint={`${config.terrain.worldSize * config.terrain.tileSize}m x ${config.terrain.worldSize * config.terrain.tileSize}m`}
          />

          <div className="text-[10px] text-text-tertiary -mt-1 pl-0.5">
            {(
              (config.terrain.worldSize * config.terrain.tileSize) /
              1000
            ).toFixed(1)}
            km x{" "}
            {(
              (config.terrain.worldSize * config.terrain.tileSize) /
              1000
            ).toFixed(1)}
            km
          </div>

          <SliderInput
            label="Max Height"
            value={config.terrain.maxHeight}
            onChange={(v) => handleTerrainChange({ maxHeight: v })}
            min={5}
            max={200}
            step={5}
            unit="m"
          />

          <SliderInput
            label="Water Threshold"
            value={config.terrain.waterThreshold}
            onChange={(v) => handleTerrainChange({ waterThreshold: v })}
            min={0}
            max={30}
            step={0.1}
            unit="m"
          />

          <Toggle
            label="Noise Visualization"
            value={showNoiseViz}
            onChange={setShowNoiseViz}
          />
        </PropertySection>

        {/* ============== TERRAIN SHAPE (NOISE CHANNELS) ============== */}
        <PropertySection
          title="Terrain Shape"
          icon={<SlidersHorizontal size={10} />}
          defaultOpen={false}
        >
          {config.useGamePipeline !== false && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 mb-2 rounded bg-amber-500/10 border border-amber-500/20">
              <span className="text-[9px] text-amber-400 leading-tight">
                Terrain shape is fixed in Game Mode. Switch to Creative Mode to
                customize noise layers.
              </span>
            </div>
          )}
          <p className="text-[10px] text-text-tertiary leading-tight mb-2">
            Control how bumpy or flat the terrain is. Weight = strength of each
            noise layer in the final heightmap.
          </p>

          {/* Channel weight sliders */}
          {(
            [
              {
                key: "continent",
                label: "Continent",
                hint: "Broad landmass shape",
              },
              { key: "ridge", label: "Ridges", hint: "Sharp mountain ridges" },
              { key: "hill", label: "Hills", hint: "Rolling hills" },
              { key: "erosion", label: "Erosion", hint: "Valley carving" },
              { key: "detail", label: "Detail", hint: "Fine micro-variation" },
            ] as const
          ).map(({ key, label, hint }) => (
            <div key={key}>
              <SliderInput
                label={`${label} Weight`}
                value={config.noise[key].weight}
                onChange={(v) => handleNoiseChannelChange(key, { weight: v })}
                min={0}
                max={0.6}
                step={0.01}
                hint={hint}
              />

              {/* Advanced controls per channel */}
              {showAdvancedNoise && (
                <div className="ml-3 pl-2 border-l border-border-primary/50 space-y-1 mb-2">
                  <SliderInput
                    label="Scale"
                    value={config.noise[key].scale}
                    onChange={(v) =>
                      handleNoiseChannelChange(key, { scale: v })
                    }
                    min={0.0001}
                    max={0.06}
                    step={0.0001}
                    hint="Frequency — lower = broader features"
                  />
                  {config.noise[key].octaves !== undefined && (
                    <SliderInput
                      label="Octaves"
                      value={config.noise[key].octaves ?? 4}
                      onChange={(v) =>
                        handleNoiseChannelChange(key, { octaves: v })
                      }
                      min={1}
                      max={8}
                      step={1}
                      hint="Layers of detail"
                    />
                  )}
                  {config.noise[key].persistence !== undefined && (
                    <SliderInput
                      label="Persistence"
                      value={config.noise[key].persistence ?? 0.5}
                      onChange={(v) =>
                        handleNoiseChannelChange(key, { persistence: v })
                      }
                      min={0.1}
                      max={0.9}
                      step={0.05}
                      hint="How much each octave contributes"
                    />
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Total weight indicator */}
          <div className="flex items-center justify-between px-1 py-1.5 rounded bg-bg-tertiary/30 mt-1">
            <span className="text-[10px] text-text-tertiary">Total Weight</span>
            <span
              className={`text-[10px] font-mono font-semibold ${(() => {
                const total = Object.values(config.noise).reduce(
                  (sum: number, ch: NoiseLayerConfig) => sum + ch.weight,
                  0,
                );
                return total > 0.8 ? "text-amber-400" : "text-text-secondary";
              })()}`}
            >
              {Object.values(config.noise)
                .reduce(
                  (sum: number, ch: NoiseLayerConfig) => sum + ch.weight,
                  0,
                )
                .toFixed(2)}
            </span>
          </div>

          {/* Advanced toggle */}
          <button
            className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-text-secondary transition-colors mt-1 ease-out"
            onClick={() => setShowAdvancedNoise((p) => !p)}
          >
            {showAdvancedNoise ? (
              <ChevronDown size={10} />
            ) : (
              <ChevronRight size={10} />
            )}
            {showAdvancedNoise ? "Hide" : "Show"} advanced (scale, octaves,
            persistence)
          </button>
        </PropertySection>

        {/* ============== BIOMES SECTION ============== */}
        <PropertySection
          title="Biomes"
          icon={<Layers size={10} />}
          defaultOpen={false}
          badge={activeBiomes.length}
        >
          {config.useGamePipeline !== false && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 mb-2 rounded bg-amber-500/10 border border-amber-500/20">
              <span className="text-[9px] text-amber-400 leading-tight">
                Biome layout is fixed in Game Mode. Switch to Creative Mode to
                customize.
              </span>
            </div>
          )}
          {/* Biome grid config */}
          <SliderInput
            label="Grid Size"
            value={config.biomes.gridSize}
            onChange={(v) =>
              handleConfigChange({
                biomes: { ...config.biomes, gridSize: v },
              })
            }
            min={1}
            max={10}
            step={1}
            hint="Voronoi grid divisions per axis"
          />

          <SliderInput
            label="Boundary Noise"
            value={config.biomes.boundaryNoiseAmount}
            onChange={(v) =>
              handleConfigChange({
                biomes: { ...config.biomes, boundaryNoiseAmount: v },
              })
            }
            min={0}
            max={0.5}
            step={0.01}
            hint="Noise added to biome boundaries for organic shapes"
          />

          <SliderInput
            label="Jitter"
            value={config.biomes.jitter}
            onChange={(v) =>
              handleConfigChange({
                biomes: { ...config.biomes, jitter: v },
              })
            }
            min={0}
            max={1}
            step={0.05}
            hint="Voronoi point jitter for less regular regions"
          />

          {/* Active biome list */}
          {activeBiomes.length > 0 && (
            <div className="space-y-1 mt-2">
              <div className="text-[10px] text-text-tertiary uppercase tracking-[0.12em]">
                Active Biomes
              </div>
              <div className="space-y-0.5">
                {activeBiomes.map((biome) => {
                  const hexColor =
                    BIOME_COLORS[biome.type] ??
                    `#${biome.color.toString(16).padStart(6, "0")}`;
                  return (
                    <div
                      key={biome.type}
                      className="flex items-center gap-2 px-1.5 py-0.5 rounded bg-bg-tertiary/30"
                    >
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0 border border-border-primary"
                        style={{ backgroundColor: hexColor }}
                      />
                      <span className="text-xs text-text-secondary capitalize flex-1">
                        {biome.type}
                      </span>
                      <span className="text-[10px] text-text-tertiary font-mono">
                        x{biome.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </PropertySection>

        {/* ============== TOWNS SECTION ============== */}
        <PropertySection
          title="Towns"
          icon={<Building2 size={10} />}
          defaultOpen={false}
          badge={config.towns.townCount}
        >
          <SliderInput
            label="Town Count"
            value={config.towns.townCount}
            onChange={(v) => handleTownChange({ townCount: v })}
            min={0}
            max={30}
            step={1}
          />

          <SliderInput
            label="Min Spacing"
            value={config.towns.minTownSpacing}
            onChange={(v) => handleTownChange({ minTownSpacing: v })}
            min={200}
            max={3000}
            step={100}
            unit="m"
            hint="Minimum distance between town centers"
          />

          {/* Size distribution */}
          <div className="space-y-1 mt-1">
            <div className="text-[10px] text-text-tertiary uppercase tracking-[0.12em]">
              Size Distribution
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Hamlet</span>
                <span className="text-[10px] text-text-tertiary font-mono">
                  {Math.round(config.towns.sizeDistribution.hamlet * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(config.towns.sizeDistribution.hamlet * 100)}
                onChange={(e) => {
                  const hamlet = Number(e.target.value) / 100;
                  const remaining = 1 - hamlet;
                  const villageRatio =
                    config.towns.sizeDistribution.village +
                      config.towns.sizeDistribution.town >
                    0
                      ? config.towns.sizeDistribution.village /
                        (config.towns.sizeDistribution.village +
                          config.towns.sizeDistribution.town)
                      : 0.5;
                  handleTownChange({
                    sizeDistribution: normalizeDistribution({
                      hamlet,
                      village: remaining * villageRatio,
                      town: remaining * (1 - villageRatio),
                    }),
                  });
                }}
                disabled={busy}
                className="w-full h-1 bg-bg-tertiary rounded appearance-none cursor-pointer accent-primary"
              />

              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Village</span>
                <span className="text-[10px] text-text-tertiary font-mono">
                  {Math.round(config.towns.sizeDistribution.village * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(config.towns.sizeDistribution.village * 100)}
                onChange={(e) => {
                  const village = Number(e.target.value) / 100;
                  const remaining = 1 - village;
                  const hamletRatio =
                    config.towns.sizeDistribution.hamlet +
                      config.towns.sizeDistribution.town >
                    0
                      ? config.towns.sizeDistribution.hamlet /
                        (config.towns.sizeDistribution.hamlet +
                          config.towns.sizeDistribution.town)
                      : 0.5;
                  handleTownChange({
                    sizeDistribution: normalizeDistribution({
                      hamlet: remaining * hamletRatio,
                      village,
                      town: remaining * (1 - hamletRatio),
                    }),
                  });
                }}
                disabled={busy}
                className="w-full h-1 bg-bg-tertiary rounded appearance-none cursor-pointer accent-primary"
              />

              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary">Town</span>
                <span className="text-[10px] text-text-tertiary font-mono">
                  {Math.round(config.towns.sizeDistribution.town * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(config.towns.sizeDistribution.town * 100)}
                onChange={(e) => {
                  const town = Number(e.target.value) / 100;
                  const remaining = 1 - town;
                  const hamletRatio =
                    config.towns.sizeDistribution.hamlet +
                      config.towns.sizeDistribution.village >
                    0
                      ? config.towns.sizeDistribution.hamlet /
                        (config.towns.sizeDistribution.hamlet +
                          config.towns.sizeDistribution.village)
                      : 0.5;
                  handleTownChange({
                    sizeDistribution: normalizeDistribution({
                      hamlet: remaining * hamletRatio,
                      village: remaining * (1 - hamletRatio),
                      town,
                    }),
                  });
                }}
                disabled={busy}
                className="w-full h-1 bg-bg-tertiary rounded appearance-none cursor-pointer accent-primary"
              />
            </div>

            {/* Visual distribution bar */}
            <div className="flex h-2 rounded overflow-hidden mt-1">
              <div
                className="bg-green-600 transition-all ease-out"
                style={{
                  width: `${config.towns.sizeDistribution.hamlet * 100}%`,
                }}
                title={`Hamlet: ${Math.round(config.towns.sizeDistribution.hamlet * 100)}%`}
              />
              <div
                className="bg-blue-500 transition-all ease-out"
                style={{
                  width: `${config.towns.sizeDistribution.village * 100}%`,
                }}
                title={`Village: ${Math.round(config.towns.sizeDistribution.village * 100)}%`}
              />
              <div
                className="bg-purple-500 transition-all ease-out"
                style={{
                  width: `${config.towns.sizeDistribution.town * 100}%`,
                }}
                title={`Town: ${Math.round(config.towns.sizeDistribution.town * 100)}%`}
              />
            </div>
            <div className="flex justify-between text-[8px] text-text-tertiary">
              <span className="text-green-400">Hamlet</span>
              <span className="text-blue-400">Village</span>
              <span className="text-purple-400">Town</span>
            </div>
          </div>

          {/* Regenerate towns only */}
          <button
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 mt-2 text-[10px] font-medium rounded border border-border-primary bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors disabled:opacity-40 ease-out"
            onClick={handleRegenerateTowns}
            disabled={busy}
          >
            <RefreshCw size={10} />
            Regenerate Towns
          </button>
        </PropertySection>

        {/* ============== ROADS SECTION ============== */}
        <PropertySection
          title="Roads"
          icon={<Route size={10} />}
          defaultOpen={false}
          badge={worldStats?.roadCount}
        >
          <SliderInput
            label="Road Width"
            value={config.roads.roadWidth}
            onChange={(v) => handleRoadChange({ roadWidth: v })}
            min={2}
            max={20}
            step={1}
            unit="m"
          />

          <SliderInput
            label="Extra Connections"
            value={config.roads.extraConnectionsRatio}
            onChange={(v) => handleRoadChange({ extraConnectionsRatio: v })}
            min={0}
            max={1}
            step={0.05}
            hint="Ratio of extra road connections beyond minimum spanning tree"
          />

          <SliderInput
            label="Smoothing"
            value={config.roads.smoothingIterations}
            onChange={(v) => handleRoadChange({ smoothingIterations: v })}
            min={0}
            max={10}
            step={1}
            hint="Path smoothing iterations for natural-looking roads"
          />

          <SliderInput
            label="Slope Cost"
            value={config.roads.costSlopeMultiplier}
            onChange={(v) => handleRoadChange({ costSlopeMultiplier: v })}
            min={0.5}
            max={10}
            step={0.5}
            hint="Higher values make roads avoid steep terrain"
          />

          <SliderInput
            label="Water Penalty"
            value={config.roads.costWaterPenalty}
            onChange={(v) => handleRoadChange({ costWaterPenalty: v })}
            min={0}
            max={500}
            step={10}
            hint="Pathfinding penalty for crossing water"
          />

          {/* Regenerate roads only */}
          <button
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 mt-2 text-[10px] font-medium rounded border border-border-primary bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors disabled:opacity-40 ease-out"
            onClick={handleRegenerateRoads}
            disabled={busy}
          >
            <RefreshCw size={10} />
            Regenerate Roads
          </button>
        </PropertySection>

        {/* ============== ISLAND & COASTLINE SECTION ============== */}
        <PropertySection
          title="Island & Coastline"
          icon={<Waves size={10} />}
          defaultOpen={false}
        >
          {config.useGamePipeline !== false && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 mb-2 rounded bg-amber-500/10 border border-amber-500/20">
              <span className="text-[9px] text-amber-400 leading-tight">
                Island shape is fixed in Game Mode. Switch to Creative Mode to
                customize coastline.
              </span>
            </div>
          )}
          <div className="space-y-1">
            <InfoRow
              label="Island Mask"
              value={config.island.enabled ? "Enabled" : "Disabled"}
            />
            <InfoRow label="Falloff Tiles" value={config.island.falloffTiles} />

            <SliderInput
              label="Edge Noise Scale"
              value={config.island.edgeNoiseScale}
              onChange={(v) =>
                handleConfigChange({
                  island: { ...config.island, edgeNoiseScale: v },
                })
              }
              min={0}
              max={0.01}
              step={0.0005}
              hint="Controls coastline irregularity"
            />

            <SliderInput
              label="Edge Noise Strength"
              value={config.island.edgeNoiseStrength}
              onChange={(v) =>
                handleConfigChange({
                  island: { ...config.island, edgeNoiseStrength: v },
                })
              }
              min={0}
              max={0.3}
              step={0.01}
              hint="Amplitude of coastline noise"
            />

            <Toggle
              label="Island Masking"
              value={config.island.enabled}
              onChange={(v) =>
                handleConfigChange({
                  island: { ...config.island, enabled: v },
                })
              }
            />
          </div>

          <div className="mt-2 p-1.5 bg-bg-tertiary/30 rounded text-[10px] text-text-tertiary leading-relaxed">
            <Info size={10} className="inline mr-1 text-text-tertiary/60" />
            Controls the island mask and coastline shape. When enabled, terrain
            is clamped to an island silhouette with configurable falloff and
            edge noise for natural-looking shorelines.
          </div>
        </PropertySection>

        {/* ============== VEGETATION SECTION ============== */}
        <PropertySection
          title="Vegetation"
          icon={<TreePine size={10} />}
          defaultOpen={false}
        >
          {/* Biome tab bar — driven by the runtime content
              registry (every biome a project's installed plugins
              / content packs contribute). Empty registry shows
              an explicit empty state below instead of phantom
              tabs. */}
          {registeredBiomeIds.length === 0 ? (
            <div className="text-[10px] text-text-tertiary py-2">
              No biomes installed. Install a content pack or gameplay plugin to
              add biomes.
            </div>
          ) : (
            <div className="flex rounded-md overflow-hidden border border-border-primary mb-2">
              {registeredBiomeIds.map((biomeId) => {
                const def = registeredBiomes[biomeId]!;
                const isActive = activeBiomeTab === biomeId;
                return (
                  <button
                    key={biomeId}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-medium transition-colors ${
                      isActive
                        ? "bg-bg-secondary text-text-primary"
                        : "bg-bg-tertiary/30 text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary/60"
                    } ease-out`}
                    onClick={() => setActiveBiomeTab(biomeId)}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: hexIntToCss(def.color) }}
                    />
                    {def.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Active biome content */}
          {(() => {
            const biomeId = activeBiomeTab;
            if (!biomeId) return null;
            const biomeVeg = vegetationConfig[biomeId];
            if (!biomeVeg) return null;
            const totalWeight = Object.values(biomeVeg.trees).reduce(
              (sum, t) => sum + t.weight,
              0,
            );

            // Estimate tree count: density × number of tiles of this biome
            const biomeTileCount =
              activeBiomes.find((b) => b.type === biomeId)?.count ?? 0;
            const estimatedTrees = biomeVeg.enabled
              ? biomeVeg.density * biomeTileCount
              : 0;

            return (
              <div className="space-y-1">
                <Toggle
                  label="Trees Enabled"
                  value={biomeVeg.enabled}
                  onChange={(v) =>
                    handleBiomeVegetationChange(biomeId, { enabled: v })
                  }
                />

                {biomeVeg.enabled && (
                  <>
                    {/* Placement controls */}
                    <SliderInput
                      label="Density"
                      value={biomeVeg.density}
                      onChange={(v) =>
                        handleBiomeVegetationChange(biomeId, { density: v })
                      }
                      min={0}
                      max={40}
                      step={1}
                      unit="/tile"
                    />

                    <SliderInput
                      label="Min Spacing"
                      value={biomeVeg.minSpacing}
                      onChange={(v) =>
                        handleBiomeVegetationChange(biomeId, { minSpacing: v })
                      }
                      min={2}
                      max={40}
                      step={1}
                      unit="m"
                    />

                    <SliderInput
                      label="Max Slope"
                      value={biomeVeg.maxSlope ?? 1.5}
                      onChange={(v) =>
                        handleBiomeVegetationChange(biomeId, { maxSlope: v })
                      }
                      min={0.5}
                      max={5}
                      step={0.1}
                    />

                    {/* Clustering */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <Toggle
                          label="Clustering"
                          value={biomeVeg.clustering}
                          onChange={(v) =>
                            handleBiomeVegetationChange(biomeId, {
                              clustering: v,
                            })
                          }
                        />
                      </div>
                      {biomeVeg.clustering && (
                        <div className="w-24">
                          <SliderInput
                            label="Size"
                            value={biomeVeg.clusterSize ?? 5}
                            onChange={(v) =>
                              handleBiomeVegetationChange(biomeId, {
                                clusterSize: v,
                              })
                            }
                            min={2}
                            max={20}
                            step={1}
                          />
                        </div>
                      )}
                    </div>

                    {/* Scale variation — compact inline */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <SliderInput
                        label="Scale Min"
                        value={biomeVeg.scaleVariation?.[0] ?? 0.8}
                        onChange={(v) =>
                          handleBiomeVegetationChange(biomeId, {
                            scaleVariation: [
                              v,
                              biomeVeg.scaleVariation?.[1] ?? 1.2,
                            ],
                          })
                        }
                        min={0.3}
                        max={1.5}
                        step={0.05}
                      />
                      <SliderInput
                        label="Scale Max"
                        value={biomeVeg.scaleVariation?.[1] ?? 1.2}
                        onChange={(v) =>
                          handleBiomeVegetationChange(biomeId, {
                            scaleVariation: [
                              biomeVeg.scaleVariation?.[0] ?? 0.8,
                              v,
                            ],
                          })
                        }
                        min={0.5}
                        max={2.0}
                        step={0.05}
                      />
                    </div>

                    {/* Species distribution */}
                    <div className="mt-2 space-y-1">
                      <div className="text-[10px] text-text-tertiary uppercase tracking-[0.12em]">
                        Species Distribution
                      </div>

                      {Object.entries(biomeVeg.trees).map(
                        ([treeId, treeConfig]) => {
                          const pct =
                            totalWeight > 0
                              ? Math.round(
                                  (treeConfig.weight / totalWeight) * 100,
                                )
                              : 0;
                          const speciesColor =
                            SPECIES_COLORS[treeId] ?? "#7A7A82";
                          return (
                            <SliderInput
                              key={treeId}
                              label={
                                <span className="flex items-center gap-1.5">
                                  <span
                                    className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                                    style={{ backgroundColor: speciesColor }}
                                  />
                                  {TREE_DISPLAY_NAMES[treeId] ?? treeId}
                                </span>
                              }
                              value={treeConfig.weight}
                              onChange={(v) =>
                                handleTreeWeightChange(biomeId, treeId, v)
                              }
                              min={0}
                              max={100}
                              step={5}
                              hint={`${pct}%`}
                            />
                          );
                        },
                      )}

                      {/* Species distribution bar */}
                      {totalWeight > 0 && (
                        <div className="flex h-1.5 rounded overflow-hidden">
                          {Object.entries(biomeVeg.trees).map(
                            ([treeId, treeConfig]) => {
                              const pct =
                                (treeConfig.weight / totalWeight) * 100;
                              if (pct < 0.5) return null;
                              return (
                                <div
                                  key={treeId}
                                  className="transition-all ease-out"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor:
                                      SPECIES_COLORS[treeId] ?? "#7A7A82",
                                  }}
                                  title={`${TREE_DISPLAY_NAMES[treeId] ?? treeId}: ${Math.round(pct)}%`}
                                />
                              );
                            },
                          )}
                        </div>
                      )}
                    </div>

                    {/* Estimated count + reset */}
                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border-primary/50">
                      <span className="text-[10px] text-text-tertiary">
                        ~{estimatedTrees.toLocaleString()} trees (
                        {biomeTileCount} tiles)
                      </span>
                      <button
                        className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-text-secondary transition-colors ease-out"
                        onClick={() => handleResetBiomeVegetation(biomeId)}
                        title="Reset to defaults"
                      >
                        <RotateCcw size={10} />
                        Reset
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* Regenerate Trees button — vegetation only, no terrain change */}
          <div className="mt-3 pt-2 border-t border-border-primary/50">
            <button
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded bg-green-600/90 text-white hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ease-out"
              onClick={handleRegenerateTrees}
              disabled={busy || isRegeneratingTrees}
            >
              {isRegeneratingTrees ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Regenerating Trees...
                </>
              ) : (
                <>
                  <TreePine size={14} />
                  Regenerate Trees
                </>
              )}
            </button>
            <p className="text-[9px] text-text-tertiary mt-1 text-center">
              Trees only — terrain is not affected.
            </p>
          </div>
        </PropertySection>

        {/* ============== HEIGHTMAP SECTION ============== */}
        <PropertySection
          title="Heightmap"
          icon={<Layers size={10} />}
          defaultOpen={false}
        >
          <div className="space-y-2">
            <p className="text-[9px] text-text-tertiary leading-relaxed">
              Export terrain as a 16-bit PNG heightmap for editing in external
              tools (World Machine, Gaea, Photoshop), then re-import.
            </p>

            <button
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-medium rounded border border-border-primary bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors disabled:opacity-40 ease-out"
              onClick={handleExportHeightmap}
              disabled={busy || isExporting}
            >
              {isExporting ? (
                <>
                  <Loader2 size={10} className="animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download size={10} />
                  Export Heightmap
                </>
              )}
            </button>

            <button
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-medium rounded border border-border-primary bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors disabled:opacity-40 ease-out"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              <Upload size={10} />
              Import Heightmap
            </button>

            {/* Hidden file inputs for import */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png"
              className="hidden"
              onChange={handleImportPng}
            />
            <input
              ref={metaInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportMeta}
            />

            {pendingHeightmap && (
              <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] text-blue-400">
                PNG loaded ({pendingHeightmap.width}x{pendingHeightmap.height}).
                Select the .meta.json file...
              </div>
            )}
          </div>
        </PropertySection>

        {/* Warning */}
        {!originalWorld && (
          <div className="px-3 py-2">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] text-amber-400 leading-relaxed">
              <AlertTriangle size={10} className="inline mr-1" />
              This will regenerate terrain. Manual edits will be preserved.
              Entity placements on layers may need repositioning.
            </div>
          </div>
        )}

        {/* Comparison mode indicator in sidebar */}
        {originalWorld && (
          <div className="px-3 py-2">
            <div className="p-2 bg-primary/10 border border-primary/20 rounded text-[10px] text-primary leading-relaxed">
              <Eye size={10} className="inline mr-1" />
              Comparison mode active — use the viewport overlay to accept or
              reject.
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-3 pb-2">
            <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-[10px] text-red-400">
              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons — hidden during comparison mode (accept/reject is on the overlay) */}
      {!originalWorld && (
        <div className="px-3 py-3 border-t border-border-primary space-y-2">
          {/* Preview button */}
          <button
            className="w-full flex items-center justify-center gap-2 px-5 py-1.5 text-xs font-medium rounded border border-border-primary bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed ease-out"
            onClick={handlePreview}
            disabled={busy || !hasLocalChanges}
            title={
              !hasLocalChanges ? "Modify config values to enable preview" : ""
            }
          >
            {isPreviewing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Generating Preview...
              </>
            ) : (
              <>
                <Eye size={14} />
                Preview Changes
              </>
            )}
          </button>

          {/* Apply button */}
          <button
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ease-out"
            onClick={handleRegenerate}
            disabled={busy}
          >
            {isGenerating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RefreshCw size={14} />
                Apply Regeneration
              </>
            )}
          </button>
        </div>
      )}

      {/* Comparison overlay — shown when preview is active (world already rendered in viewport) */}
      {originalWorld && previewStats && (
        <ComparisonOverlay
          beforeStats={beforeStats}
          afterStats={{
            tiles: previewStats.tiles,
            biomes: previewStats.biomes,
            towns: previewStats.towns,
            roads: previewStats.roads,
          }}
          generationTimeMs={previewStats.generationTimeMs}
          onAccept={handleAcceptPreview}
          onReject={handleRejectPreview}
        />
      )}
    </div>
  );
});
