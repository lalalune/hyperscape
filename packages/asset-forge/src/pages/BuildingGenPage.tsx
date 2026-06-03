/**
 * BuildingGenPage
 * Page for procedural building and town generation
 *
 * Features:
 * - Single building and full town generation modes
 * - 9 building types (bank, store, inn, smithy, etc.)
 * - Custom preset saving (seed + settings)
 * - Export configuration as JSON
 * - Navigation mesh visualization and pathfinding testing
 */

import type {
  BuildingViewerHandle,
  TownViewerHandle,
  PathInfo,
  NavStats,
  NavigationVisualizerOptions,
} from "@hyperforge/procgen/building/viewer";
import {
  Building2,
  MapPin,
  RefreshCw,
  Settings2,
  Save,
  FolderOpen,
  Download,
  Upload,
  Trash2,
  Navigation,
  Eye,
  EyeOff,
  Route,
} from "lucide-react";
import React, {
  useState,
  useCallback,
  Suspense,
  useEffect,
  useRef,
} from "react";

import type { BuildingPreset } from "@/types/ProcgenPresets";
import { notify } from "@/utils/notify";

// API base
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3401";

// Lazy load the viewers to avoid SSR issues with Three.js
const BuildingViewer = React.lazy(() =>
  import("@hyperforge/procgen/building/viewer").then((m) => ({
    default: m.BuildingViewer,
  })),
);
const TownViewer = React.lazy(() =>
  import("@hyperforge/procgen/building/viewer").then((m) => ({
    default: m.TownViewer,
  })),
);

type ViewMode = "building" | "town";
type BuildingType =
  | "bank"
  | "store"
  | "inn"
  | "smithy"
  | "chapel"
  | "house"
  | "long-house"
  | "cottage"
  | "shed";
type TownSize = "hamlet" | "village" | "town";

const BUILDING_TYPES: Record<
  BuildingType,
  { label: string; description: string }
> = {
  bank: { label: "Bank", description: "Secure vault for player storage" },
  store: { label: "Store", description: "General goods merchant" },
  inn: { label: "Inn", description: "Rest and recovery" },
  smithy: { label: "Smithy", description: "Weapon and armor crafting" },
  chapel: { label: "Chapel", description: "Religious building" },
  house: { label: "House", description: "Standard residential" },
  "long-house": { label: "Long House", description: "Large communal dwelling" },
  cottage: { label: "Cottage", description: "Small cozy home" },
  shed: { label: "Shed", description: "Storage building" },
};

const TOWN_SIZES: Record<
  TownSize,
  { label: string; buildings: string; radius: string }
> = {
  hamlet: { label: "Hamlet", buildings: "3-5", radius: "25m" },
  village: { label: "Village", buildings: "6-10", radius: "40m" },
  town: { label: "Town", buildings: "11-16", radius: "60m" },
};

export const BuildingGenPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("town");
  const [key, setKey] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Building settings
  const [buildingType, setBuildingType] = useState<BuildingType>("bank");
  const [seed, setSeed] = useState("building-001");
  const [showRoof, setShowRoof] = useState(true);

  // Town settings
  const [townSize, setTownSize] = useState<TownSize>("village");
  const [townSeed, setTownSeed] = useState(12345);

  // Saved presets state
  const [savedPresets, setSavedPresets] = useState<BuildingPreset[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  // Navigation state
  const [navigationEnabled, setNavigationEnabled] = useState(false);
  const [navigationOptions, setNavigationOptions] =
    useState<NavigationVisualizerOptions>({
      showWalkableTiles: true,
      showDoors: true,
      showStairs: true,
      showWalls: true,
      showEntryPoints: true,
      showDemoPaths: false,
    });
  const [pathInfo, setPathInfo] = useState<PathInfo | null>(null);
  const [navStats, setNavStats] = useState<NavStats | null>(null);

  // Viewer refs for external control
  const buildingViewerRef = useRef<BuildingViewerHandle>(null);
  const townViewerRef = useRef<TownViewerHandle>(null);

  // Load saved presets on mount
  useEffect(() => {
    loadSavedPresets();
  }, []);

  const loadSavedPresets = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/procgen/presets?category=building`,
      );
      if (response.ok) {
        const data = await response.json();
        setSavedPresets(data.presets || []);
      } else {
        console.warn("Could not load presets: API returned", response.status);
      }
    } catch (error) {
      console.warn("Preset API not available:", error);
    }
  };

  const saveCurrentAsPreset = async () => {
    if (!newPresetName.trim()) {
      notify.error("Please enter a preset name");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/procgen/presets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPresetName,
          category: "building",
          settings: {
            buildingType: viewMode === "building" ? buildingType : "town",
            seed: viewMode === "building" ? seed : String(townSeed),
            showRoof,
            overrides: viewMode === "town" ? { townSize } : undefined,
          },
        }),
      });

      if (response.ok) {
        notify.success(`Saved preset: ${newPresetName}`);
        setShowSaveDialog(false);
        setNewPresetName("");
        loadSavedPresets();
      } else {
        notify.error("Failed to save preset");
      }
    } catch (error) {
      console.error("Failed to save preset:", error);
      notify.error("Failed to save preset");
    }
  };

  const loadSavedPreset = (savedPreset: BuildingPreset) => {
    if (savedPreset.settings.buildingType === "town") {
      setViewMode("town");
      setTownSeed(parseInt(savedPreset.settings.seed) || 12345);
      if (savedPreset.settings.overrides?.townSize) {
        setTownSize(savedPreset.settings.overrides.townSize as TownSize);
      }
    } else {
      setViewMode("building");
      setBuildingType(savedPreset.settings.buildingType as BuildingType);
      setSeed(savedPreset.settings.seed);
    }
    setShowRoof(savedPreset.settings.showRoof);
    notify.info(`Loaded preset: ${savedPreset.name}`);
    handleRegenerate();
  };

  const deleteSavedPreset = async (presetId: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/procgen/presets/${presetId}`,
        {
          method: "DELETE",
        },
      );
      if (response.ok) {
        notify.success("Preset deleted");
        loadSavedPresets();
      } else {
        notify.error("Failed to delete preset");
      }
    } catch (error) {
      console.error("Failed to delete preset:", error);
      notify.error("Failed to delete preset");
    }
  };

  const handleRegenerate = useCallback(() => {
    setIsGenerating(true);
    setKey((k) => k + 1);
    // Brief delay to show loading state, actual generation is async in viewer components
    setTimeout(() => {
      setIsGenerating(false);
    }, 200);
  }, []);

  // Navigation callbacks
  const handlePathUpdate = useCallback((info: PathInfo) => {
    setPathInfo(info);
  }, []);

  const handleNavStatsUpdate = useCallback((stats: NavStats | null) => {
    setNavStats(stats);
  }, []);

  const handleToggleNavOption = useCallback(
    (optionKey: keyof NavigationVisualizerOptions) => {
      setNavigationOptions((prev) => ({
        ...prev,
        [optionKey]: !prev[optionKey],
      }));
    },
    [],
  );

  const handleClearPath = useCallback(() => {
    if (viewMode === "building") {
      buildingViewerRef.current?.clearNavigationPath();
    } else {
      townViewerRef.current?.clearNavigationPath();
    }
    setPathInfo(null);
  }, [viewMode]);

  const handleRandomSeed = useCallback(() => {
    if (viewMode === "building") {
      setSeed(
        `building-${Math.floor(Math.random() * 100000)
          .toString()
          .padStart(5, "0")}`,
      );
    } else {
      setTownSeed(Math.floor(Math.random() * 100000));
    }
  }, [viewMode]);

  // Export config as JSON
  const exportConfig = useCallback(() => {
    const config =
      viewMode === "building"
        ? {
            mode: "building",
            buildingType,
            seed,
            showRoof,
            exportedAt: new Date().toISOString(),
          }
        : {
            mode: "town",
            townSize,
            seed: townSeed,
            exportedAt: new Date().toISOString(),
          };

    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      viewMode === "building"
        ? `building-${buildingType}-${seed}.json`
        : `town-${townSize}-${townSeed}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    notify.success("Config exported");
  }, [viewMode, buildingType, seed, showRoof, townSize, townSeed]);

  // Import config from JSON
  const importConfig = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const config = JSON.parse(text);

        const validBuildingTypes = Object.keys(BUILDING_TYPES);
        const validTownSizes = Object.keys(TOWN_SIZES);

        if (config.mode === "building") {
          setViewMode("building");
          // Validate building type
          if (
            config.buildingType &&
            validBuildingTypes.includes(config.buildingType)
          ) {
            setBuildingType(config.buildingType);
          }
          if (typeof config.seed === "string") setSeed(config.seed);
          if (typeof config.showRoof === "boolean")
            setShowRoof(config.showRoof);
        } else if (config.mode === "town") {
          setViewMode("town");
          // Validate town size
          if (config.townSize && validTownSizes.includes(config.townSize)) {
            setTownSize(config.townSize as TownSize);
          }
          if (typeof config.seed === "number") setTownSeed(config.seed);
        }

        notify.success("Config imported");
        handleRegenerate();
      } catch {
        notify.error("Invalid config file");
      }
    };
    input.click();
  }, [handleRegenerate]);

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <Building2 size={28} />
            Building & Town Generator
          </h1>
          <p className="text-text-secondary mt-1">
            Generate procedural buildings and complete towns with various
            layouts
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-bg-tertiary rounded-lg p-1">
            <button
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === "building"
                  ? "bg-primary text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => setViewMode("building")}
            >
              <Building2 size={16} className="inline mr-2" />
              Building
            </button>
            <button
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === "town"
                  ? "bg-primary text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => setViewMode("town")}
            >
              <MapPin size={16} className="inline mr-2" />
              Town
            </button>
          </div>

          {/* Save Preset */}
          <button
            onClick={() => setShowSaveDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary text-text-secondary hover:text-text-primary rounded-lg transition-all"
            title="Save as preset"
          >
            <Save size={18} />
            Save
          </button>

          {/* Export Config */}
          <button
            onClick={exportConfig}
            className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary text-text-secondary hover:text-text-primary rounded-lg transition-all"
            title="Export config"
          >
            <Download size={18} />
            Export
          </button>

          {/* Import Config */}
          <button
            onClick={importConfig}
            className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary text-text-secondary hover:text-text-primary rounded-lg transition-all"
            title="Import config"
          >
            <Upload size={18} />
            Import
          </button>

          {/* Random Seed */}
          <button
            onClick={handleRandomSeed}
            className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-bg-secondary rounded-lg text-text-secondary hover:text-text-primary transition-all"
            title="Random seed"
          >
            🎲
          </button>

          {/* Generate */}
          <button
            onClick={handleRegenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-all disabled:opacity-50"
          >
            <RefreshCw
              size={18}
              className={isGenerating ? "animate-spin" : ""}
            />
            Generate
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-6">
        {/* Controls Panel */}
        <div className="w-72 flex-shrink-0 space-y-4 overflow-y-auto">
          {/* Generation Settings */}
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
            <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Settings2 size={18} />
              {viewMode === "building" ? "Building Settings" : "Town Settings"}
            </h3>

            <div className="space-y-4">
              {viewMode === "building" ? (
                <>
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">
                      Building Type
                    </label>
                    <select
                      value={buildingType}
                      onChange={(e) =>
                        setBuildingType(e.target.value as BuildingType)
                      }
                      className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-md text-text-primary"
                    >
                      {(Object.keys(BUILDING_TYPES) as BuildingType[]).map(
                        (type) => (
                          <option key={type} value={type}>
                            {BUILDING_TYPES[type].label}
                          </option>
                        ),
                      )}
                    </select>
                    <p className="text-xs text-text-secondary mt-1">
                      {BUILDING_TYPES[buildingType].description}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm text-text-secondary mb-2">
                      Seed
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={seed}
                        onChange={(e) => setSeed(e.target.value)}
                        className="flex-1 px-3 py-2 bg-bg-tertiary border border-border-primary rounded-md text-text-primary"
                      />
                      <button
                        onClick={handleRandomSeed}
                        className="px-3 py-2 bg-bg-tertiary border border-border-primary rounded-md text-text-secondary hover:text-text-primary transition-colors"
                        title="Random seed"
                      >
                        🎲
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showRoof}
                      onChange={(e) => setShowRoof(e.target.checked)}
                      className="rounded"
                    />
                    Show Roof
                  </label>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">
                      Town Size
                    </label>
                    <select
                      value={townSize}
                      onChange={(e) => setTownSize(e.target.value as TownSize)}
                      className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-md text-text-primary"
                    >
                      {(Object.keys(TOWN_SIZES) as TownSize[]).map((size) => (
                        <option key={size} value={size}>
                          {TOWN_SIZES[size].label} ({TOWN_SIZES[size].buildings}{" "}
                          buildings)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-text-secondary mb-2">
                      Seed
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={townSeed}
                        onChange={(e) =>
                          setTownSeed(parseInt(e.target.value) || 0)
                        }
                        className="flex-1 px-3 py-2 bg-bg-tertiary border border-border-primary rounded-md text-text-primary"
                      />
                      <button
                        onClick={handleRandomSeed}
                        className="px-3 py-2 bg-bg-tertiary border border-border-primary rounded-md text-text-secondary hover:text-text-primary transition-colors"
                        title="Random seed"
                      >
                        🎲
                      </button>
                    </div>
                  </div>
                </>
              )}

              <button
                onClick={handleRegenerate}
                disabled={isGenerating}
                className="w-full py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition-all disabled:opacity-50"
              >
                Generate
              </button>
            </div>
          </div>

          {/* Saved Presets */}
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
            <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
              <FolderOpen size={18} />
              Saved Presets
            </h3>

            {savedPresets.length === 0 ? (
              <p className="text-sm text-text-secondary italic">
                No saved presets
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {savedPresets.map((savedPreset) => (
                  <div
                    key={savedPreset.id}
                    className="flex items-center justify-between p-2 bg-bg-tertiary rounded-md group"
                  >
                    <button
                      onClick={() => loadSavedPreset(savedPreset)}
                      className="flex-1 text-left text-sm text-text-primary hover:text-primary truncate"
                    >
                      {savedPreset.name}
                    </button>
                    <button
                      onClick={() => deleteSavedPreset(savedPreset.id)}
                      className="p-1 text-text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
            <h3 className="font-semibold text-text-primary mb-3">
              Generation Stats
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-text-secondary">
                <span>Mode:</span>
                <span className="text-text-primary capitalize">{viewMode}</span>
              </div>
              {viewMode === "building" ? (
                <>
                  <div className="flex justify-between text-text-secondary">
                    <span>Type:</span>
                    <span className="text-text-primary">
                      {BUILDING_TYPES[buildingType].label}
                    </span>
                  </div>
                  <div className="flex justify-between text-text-secondary">
                    <span>Seed:</span>
                    <span className="text-text-primary font-mono text-xs">
                      {seed}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-text-secondary">
                    <span>Size:</span>
                    <span className="text-text-primary">
                      {TOWN_SIZES[townSize].label}
                    </span>
                  </div>
                  <div className="flex justify-between text-text-secondary">
                    <span>Buildings:</span>
                    <span className="text-text-primary">
                      {TOWN_SIZES[townSize].buildings}
                    </span>
                  </div>
                  <div className="flex justify-between text-text-secondary">
                    <span>Seed:</span>
                    <span className="text-text-primary">{townSeed}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Building Types Reference (for building mode) */}
          {viewMode === "building" && (
            <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
              <h3 className="font-semibold text-text-primary mb-3">
                Building Types
              </h3>
              <div className="space-y-2 text-sm max-h-48 overflow-y-auto">
                {(Object.keys(BUILDING_TYPES) as BuildingType[]).map((type) => (
                  <div
                    key={type}
                    className={`p-2 rounded-md cursor-pointer transition-colors ${
                      buildingType === type
                        ? "bg-primary/20 text-primary"
                        : "bg-bg-tertiary hover:bg-bg-tertiary/70"
                    }`}
                    onClick={() => setBuildingType(type)}
                  >
                    <div className="font-medium text-text-primary">
                      {BUILDING_TYPES[type].label}
                    </div>
                    <div className="text-xs text-text-secondary">
                      {BUILDING_TYPES[type].description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Testing Panel */}
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
            <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Navigation size={18} />
              Navigation Testing
            </h3>

            <div className="space-y-4">
              {/* Enable/Disable Toggle */}
              <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={navigationEnabled}
                  onChange={(e) => setNavigationEnabled(e.target.checked)}
                  className="rounded"
                />
                <span className="flex items-center gap-1">
                  {navigationEnabled ? <Eye size={14} /> : <EyeOff size={14} />}
                  Show Nav Mesh
                </span>
              </label>

              {navigationEnabled && (
                <>
                  {/* Visualization Options */}
                  <div className="space-y-2">
                    <p className="text-xs text-text-secondary">Show:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-1 text-xs text-text-primary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={navigationOptions.showWalkableTiles}
                          onChange={() =>
                            handleToggleNavOption("showWalkableTiles")
                          }
                          className="rounded w-3 h-3"
                        />
                        Walkable
                      </label>
                      <label className="flex items-center gap-1 text-xs text-text-primary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={navigationOptions.showWalls}
                          onChange={() => handleToggleNavOption("showWalls")}
                          className="rounded w-3 h-3"
                        />
                        Walls
                      </label>
                      <label className="flex items-center gap-1 text-xs text-text-primary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={navigationOptions.showDoors}
                          onChange={() => handleToggleNavOption("showDoors")}
                          className="rounded w-3 h-3"
                        />
                        Doors
                      </label>
                      <label className="flex items-center gap-1 text-xs text-text-primary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={navigationOptions.showStairs}
                          onChange={() => handleToggleNavOption("showStairs")}
                          className="rounded w-3 h-3"
                        />
                        Stairs
                      </label>
                      <label className="flex items-center gap-1 text-xs text-text-primary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={navigationOptions.showEntryPoints}
                          onChange={() =>
                            handleToggleNavOption("showEntryPoints")
                          }
                          className="rounded w-3 h-3"
                        />
                        Entry Points
                      </label>
                      <label className="flex items-center gap-1 text-xs text-text-primary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={navigationOptions.showDemoPaths}
                          onChange={() =>
                            handleToggleNavOption("showDemoPaths")
                          }
                          className="rounded w-3 h-3"
                        />
                        Demo Paths
                      </label>
                    </div>
                  </div>

                  {/* Path Info */}
                  <div className="border-t border-border-primary pt-3">
                    <p className="text-xs text-text-secondary mb-2 flex items-center gap-1">
                      <Route size={12} />
                      Click Testing
                    </p>
                    <p className="text-xs text-text-secondary mb-2">
                      Left-click: Set start | Right-click: Set end
                    </p>

                    {pathInfo && (pathInfo.start || pathInfo.end) ? (
                      <div className="bg-bg-tertiary rounded p-2 space-y-1">
                        {pathInfo.start && (
                          <div className="text-xs">
                            <span className="text-cyan-400">Start:</span>{" "}
                            <span className="text-text-primary font-mono">
                              ({pathInfo.start.x}, {pathInfo.start.z})
                            </span>
                          </div>
                        )}
                        {pathInfo.end && (
                          <div className="text-xs">
                            <span className="text-fuchsia-400">End:</span>{" "}
                            <span className="text-text-primary font-mono">
                              ({pathInfo.end.x}, {pathInfo.end.z})
                            </span>
                          </div>
                        )}
                        {pathInfo.length > 0 && (
                          <div className="text-xs">
                            <span className="text-text-secondary">Path:</span>{" "}
                            <span
                              className={
                                pathInfo.partial
                                  ? "text-orange-400"
                                  : "text-green-400"
                              }
                            >
                              {pathInfo.length} tiles
                              {pathInfo.partial && " (partial)"}
                            </span>
                          </div>
                        )}
                        {pathInfo.start &&
                          pathInfo.end &&
                          pathInfo.length === 0 && (
                            <div className="text-xs text-red-400">
                              No path found!
                            </div>
                          )}
                        <button
                          onClick={handleClearPath}
                          className="mt-2 text-xs px-2 py-1 bg-bg-secondary rounded hover:bg-bg-primary transition-colors"
                        >
                          Clear Path
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-text-secondary italic">
                        Click on the building to test paths
                      </p>
                    )}
                  </div>

                  {/* Nav Stats */}
                  {navStats && (
                    <div className="border-t border-border-primary pt-3">
                      <p className="text-xs text-text-secondary mb-2">
                        Nav Mesh Stats:
                      </p>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <span className="text-text-secondary">Floors:</span>
                        <span className="text-text-primary">
                          {navStats.floors}
                        </span>
                        <span className="text-text-secondary">Walkable:</span>
                        <span className="text-text-primary">
                          {navStats.walkableTiles}
                        </span>
                        <span className="text-text-secondary">Walls:</span>
                        <span className="text-text-primary">
                          {navStats.walls}
                        </span>
                        <span className="text-text-secondary">Doors:</span>
                        <span className="text-text-primary">
                          {navStats.doors}
                        </span>
                        <span className="text-text-secondary">Stairs:</span>
                        <span className="text-text-primary">
                          {navStats.stairs}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Viewer */}
        <div className="flex-1 bg-bg-secondary rounded-xl overflow-hidden border border-border-primary">
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center text-text-secondary">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
                  <span>
                    Loading {viewMode === "building" ? "Building" : "Town"}{" "}
                    Generator...
                  </span>
                </div>
              </div>
            }
          >
            {viewMode === "building" ? (
              <BuildingViewer
                ref={buildingViewerRef}
                key={`building-${key}-${buildingType}-${seed}`}
                initialType={buildingType}
                initialSeed={seed}
                width="100%"
                height="100%"
                showStats
                showControls
                backgroundColor={0x1a1a2e}
                navigationEnabled={navigationEnabled}
                navigationOptions={navigationOptions}
                onPathUpdate={handlePathUpdate}
                onNavStatsUpdate={handleNavStatsUpdate}
              />
            ) : (
              <TownViewer
                ref={townViewerRef}
                key={`town-${key}-${townSeed}-${townSize}`}
                initialSeed={townSeed}
                initialSize={townSize}
                width="100%"
                height="100%"
                showStats
                showControls
                backgroundColor={0x1a1a2e}
                navigationEnabled={navigationEnabled}
                navigationOptions={navigationOptions}
                onPathUpdate={handlePathUpdate}
                onNavStatsUpdate={handleNavStatsUpdate}
              />
            )}
          </Suspense>
        </div>
      </div>

      {/* Info Panel */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
          <h3 className="font-semibold text-text-primary mb-2">
            Building Types
          </h3>
          <p className="text-sm text-text-secondary">
            Generate 9 building types: banks, stores, inns, smithies, houses,
            and more. Each with unique layouts, rooms, and props.
          </p>
        </div>
        <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
          <h3 className="font-semibold text-text-primary mb-2">Town Sizes</h3>
          <p className="text-sm text-text-secondary">
            <strong>Hamlet:</strong> 3-5 buildings, 25m safe zone
            <br />
            <strong>Village:</strong> 6-10 buildings, 40m safe zone
            <br />
            <strong>Town:</strong> 11-16 buildings, 60m safe zone
          </p>
        </div>
        <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
          <h3 className="font-semibold text-text-primary mb-2">
            Save & Export
          </h3>
          <p className="text-sm text-text-secondary">
            Save your favorite building configs as presets. Export configs as
            JSON to share or backup.
          </p>
        </div>
      </div>

      {/* Save Preset Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary rounded-lg p-6 w-96 border border-border-primary">
            <h3 className="text-lg font-semibold text-text-primary mb-4">
              Save Preset
            </h3>
            <p className="text-sm text-text-secondary mb-4">
              Save current {viewMode} settings as a reusable preset.
            </p>
            <input
              type="text"
              placeholder="Preset name..."
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-md text-text-primary mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setNewPresetName("");
                }}
                className="px-4 py-2 text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={saveCurrentAsPreset}
                disabled={!newPresetName.trim()}
                className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuildingGenPage;
