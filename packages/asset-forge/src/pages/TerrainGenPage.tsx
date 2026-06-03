/**
 * TerrainGenPage
 * Page for procedural terrain generation with multiple presets
 *
 * Features:
 * - 7 terrain presets
 * - Custom preset saving (seed + settings)
 * - Export configuration as JSON
 * - Statistics display
 */

import { TerrainGen } from "@hyperforge/procgen";
import {
  Mountain,
  RefreshCw,
  Settings2,
  Waves,
  Grid3x3,
  Save,
  FolderOpen,
  Download,
  Trash2,
  Upload,
  Leaf,
  Sun,
  Moon,
} from "lucide-react";
import React, { useState, useCallback, useMemo, useEffect } from "react";

import {
  TerrainPreview,
  type TerrainPreviewConfig,
} from "@/components/WorldBuilder/TerrainPreview";
import type { TerrainPreset } from "@/types/ProcgenPresets";
import { notify } from "@/utils/notify";

// API base
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3401";

// Get available terrain presets
const TERRAIN_PRESETS = TerrainGen.listPresetIds();

export const TerrainGenPage: React.FC = () => {
  // Generation state
  const [preset, setPreset] = useState("small-island");
  const [seed, setSeed] = useState(12345);
  const [key, setKey] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Config state
  const [worldSize, setWorldSize] = useState(10);
  const [tileSize, setTileSize] = useState(100);
  const [maxHeight, setMaxHeight] = useState(30);
  const [waterThreshold, setWaterThreshold] = useState(5.4);

  // Visualization state
  const [showWater, setShowWater] = useState(true);
  const [showBiomeColors, setShowBiomeColors] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [showTowns, setShowTowns] = useState(true);
  const [wireframe, setWireframe] = useState(false);

  // Grass state
  const [showGrass, setShowGrass] = useState(false);
  const [grassDensity, setGrassDensity] = useState(5);
  const [grassHeight, setGrassHeight] = useState(0.4);

  // Time of day (0-24, 12 = noon)
  const [timeOfDay, setTimeOfDay] = useState(12);

  // Saved presets state
  const [savedPresets, setSavedPresets] = useState<TerrainPreset[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  // Build the config object for TerrainPreview
  const terrainConfig: Partial<TerrainPreviewConfig> = useMemo(
    () => ({
      seed,
      worldSize,
      tileSize,
      maxHeight,
      waterThreshold,
      preset,
      showWater,
      showBiomeColors,
      showGrid,
      showTowns,
      wireframe,
      showVegetation: false,
      showGrass,
      grassDensity,
      grassHeight,
      timeOfDay,
    }),
    [
      seed,
      worldSize,
      tileSize,
      maxHeight,
      waterThreshold,
      preset,
      showWater,
      showBiomeColors,
      showGrid,
      showTowns,
      wireframe,
      showGrass,
      grassDensity,
      grassHeight,
      timeOfDay,
    ],
  );

  // Load saved presets on mount
  useEffect(() => {
    loadSavedPresets();
  }, []);

  const loadSavedPresets = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/procgen/presets?category=terrain`,
      );
      if (response.ok) {
        const data = await response.json();
        setSavedPresets(data.presets || []);
      } else {
        // Server responded but with error - likely API not available
        console.warn("Could not load presets: API returned", response.status);
      }
    } catch (error) {
      // Network error or server not running - silent fail since presets are optional
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
          category: "terrain",
          settings: {
            basePreset: preset,
            seed,
            overrides: {
              worldSize,
              tileSize,
              maxHeight,
              waterThreshold,
            },
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

  const loadSavedPreset = (savedPreset: TerrainPreset) => {
    setPreset(savedPreset.settings.basePreset);
    setSeed(savedPreset.settings.seed);
    if (savedPreset.settings.overrides) {
      if (savedPreset.settings.overrides.worldSize)
        setWorldSize(savedPreset.settings.overrides.worldSize);
      if (savedPreset.settings.overrides.tileSize)
        setTileSize(savedPreset.settings.overrides.tileSize);
      if (savedPreset.settings.overrides.maxHeight)
        setMaxHeight(savedPreset.settings.overrides.maxHeight);
      if (savedPreset.settings.overrides.waterThreshold)
        setWaterThreshold(savedPreset.settings.overrides.waterThreshold);
    }
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
    // Brief delay to show loading state, actual generation is async in TerrainPreview
    setTimeout(() => {
      setIsGenerating(false);
    }, 200);
  }, []);

  const handleRandomSeed = useCallback(() => {
    setSeed(Math.floor(Math.random() * 1000000));
  }, []);

  // Export terrain config as JSON
  const exportConfig = useCallback(() => {
    const config = {
      preset,
      seed,
      worldSize,
      tileSize,
      maxHeight,
      waterThreshold,
      showWater,
      showBiomeColors,
      showTowns,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terrain-${preset}-${seed}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    notify.success("Terrain config exported");
  }, [
    preset,
    seed,
    worldSize,
    tileSize,
    maxHeight,
    waterThreshold,
    showWater,
    showBiomeColors,
    showTowns,
  ]);

  // Import terrain config from JSON
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

        // Validate preset is a valid option
        if (config.preset && TERRAIN_PRESETS.includes(config.preset)) {
          setPreset(config.preset);
        }
        // Validate numeric values
        if (typeof config.seed === "number") setSeed(config.seed);
        if (
          typeof config.worldSize === "number" &&
          config.worldSize >= 5 &&
          config.worldSize <= 50
        ) {
          setWorldSize(config.worldSize);
        }
        if (
          typeof config.tileSize === "number" &&
          config.tileSize >= 50 &&
          config.tileSize <= 200
        ) {
          setTileSize(config.tileSize);
        }
        if (
          typeof config.maxHeight === "number" &&
          config.maxHeight >= 10 &&
          config.maxHeight <= 100
        ) {
          setMaxHeight(config.maxHeight);
        }
        if (typeof config.waterThreshold === "number") {
          setWaterThreshold(config.waterThreshold);
        }
        // Boolean values
        if (typeof config.showWater === "boolean")
          setShowWater(config.showWater);
        if (typeof config.showBiomeColors === "boolean")
          setShowBiomeColors(config.showBiomeColors);
        if (typeof config.showTowns === "boolean")
          setShowTowns(config.showTowns);

        notify.success("Config imported");
        handleRegenerate();
      } catch {
        notify.error("Invalid config file");
      }
    };
    input.click();
  }, [handleRegenerate]);

  // Format preset name for display
  const formatPresetName = (name: string) => {
    return name
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <Mountain size={28} />
            Terrain Generator
          </h1>
          <p className="text-text-secondary mt-1">
            Generate procedural terrain with biomes, water, and towns
          </p>
        </div>

        <div className="flex items-center gap-2">
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
          {/* Preset Selection */}
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
            <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Settings2 size={18} />
              Terrain Preset
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  Preset
                </label>
                <select
                  value={preset}
                  onChange={(e) => setPreset(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-md text-text-primary"
                >
                  {TERRAIN_PRESETS.map((name) => (
                    <option key={name} value={name}>
                      {formatPresetName(name)}
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
                    value={seed}
                    onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
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

          {/* World Size Settings */}
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
            <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Grid3x3 size={18} />
              World Size
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  World Size (tiles): {worldSize}
                </label>
                <input
                  type="range"
                  min={5}
                  max={50}
                  value={worldSize}
                  onChange={(e) => setWorldSize(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-text-secondary mt-1">
                  <span>5</span>
                  <span>
                    {(worldSize * tileSize) / 1000}km x{" "}
                    {(worldSize * tileSize) / 1000}km
                  </span>
                  <span>50</span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  Tile Size (m): {tileSize}
                </label>
                <input
                  type="range"
                  min={50}
                  max={200}
                  step={10}
                  value={tileSize}
                  onChange={(e) => setTileSize(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  Max Height (m): {maxHeight}
                </label>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={maxHeight}
                  onChange={(e) => setMaxHeight(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Water Settings */}
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
            <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Waves size={18} />
              Water & Visualization
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  Water Level (m): {waterThreshold.toFixed(1)}
                </label>
                <input
                  type="range"
                  min={0}
                  max={maxHeight}
                  step={0.1}
                  value={waterThreshold}
                  onChange={(e) =>
                    setWaterThreshold(parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showWater}
                    onChange={(e) => setShowWater(e.target.checked)}
                    className="rounded"
                  />
                  Show Water
                </label>

                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBiomeColors}
                    onChange={(e) => setShowBiomeColors(e.target.checked)}
                    className="rounded"
                  />
                  Show Biome Colors
                </label>

                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                    className="rounded"
                  />
                  Show Grid
                </label>

                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showTowns}
                    onChange={(e) => setShowTowns(e.target.checked)}
                    className="rounded"
                  />
                  Show Towns
                </label>

                <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wireframe}
                    onChange={(e) => setWireframe(e.target.checked)}
                    className="rounded"
                  />
                  Wireframe Mode
                </label>
              </div>
            </div>
          </div>

          {/* Time of Day */}
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
            <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
              {timeOfDay >= 6 && timeOfDay < 18 ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}
              Time of Day
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  Time: {timeOfDay.toFixed(1)}:00 (
                  {timeOfDay >= 6 && timeOfDay < 18 ? "Day" : "Night"})
                </label>
                <input
                  type="range"
                  min={0}
                  max={24}
                  step={0.5}
                  value={timeOfDay}
                  onChange={(e) => setTimeOfDay(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-text-secondary mt-1">
                  <span>Midnight</span>
                  <span>Noon</span>
                  <span>Midnight</span>
                </div>
              </div>

              {/* Quick time presets */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: "🌅 Dawn", time: 6 },
                  { label: "☀️ Noon", time: 12 },
                  { label: "🌇 Dusk", time: 18 },
                  { label: "🌙 Night", time: 0 },
                ].map(({ label, time }) => (
                  <button
                    key={time}
                    onClick={() => setTimeOfDay(time)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      Math.abs(timeOfDay - time) < 2
                        ? "bg-primary text-white"
                        : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grass Settings */}
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
            <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Leaf size={18} />
              Grass
            </h3>

            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={showGrass}
                  onChange={(e) => setShowGrass(e.target.checked)}
                  className="rounded"
                />
                Show Grass
              </label>

              {showGrass && (
                <>
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">
                      Density: {grassDensity} per m²
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={15}
                      step={1}
                      value={grassDensity}
                      onChange={(e) =>
                        setGrassDensity(parseInt(e.target.value))
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-text-secondary mb-2">
                      Height: {grassHeight.toFixed(2)}m
                    </label>
                    <input
                      type="range"
                      min={0.1}
                      max={1.0}
                      step={0.05}
                      value={grassHeight}
                      onChange={(e) =>
                        setGrassHeight(parseFloat(e.target.value))
                      }
                      className="w-full"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Stats Panel */}
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
            <h3 className="font-semibold text-text-primary mb-3">
              Current Config
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-text-secondary">
                <span>Preset:</span>
                <span className="text-text-primary">
                  {formatPresetName(preset)}
                </span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Seed:</span>
                <span className="text-text-primary">{seed}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>World Area:</span>
                <span className="text-text-primary">
                  {((worldSize * tileSize) / 1000).toFixed(1)}km²
                </span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Total Tiles:</span>
                <span className="text-text-primary">
                  {worldSize * worldSize}
                </span>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleRegenerate}
            disabled={isGenerating}
            className="w-full py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RefreshCw
              size={18}
              className={isGenerating ? "animate-spin" : ""}
            />
            Generate Terrain
          </button>
        </div>

        {/* Viewer */}
        <div className="flex-1 bg-bg-secondary rounded-xl overflow-hidden border border-border-primary">
          <TerrainPreview
            key={key}
            config={terrainConfig}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Info Panel */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
          <h3 className="font-semibold text-text-primary mb-2">
            Terrain Presets
          </h3>
          <p className="text-sm text-text-secondary">
            Choose from {TERRAIN_PRESETS.length} presets: islands, continents,
            mountains, deserts, and more. Each preset configures noise, biomes,
            and shorelines.
          </p>
        </div>
        <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
          <h3 className="font-semibold text-text-primary mb-2">Biomes</h3>
          <p className="text-sm text-text-secondary">
            Automatic biome generation based on height and moisture. Plains,
            forests, mountains, deserts, swamps, and tundra.
          </p>
        </div>
        <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
          <h3 className="font-semibold text-text-primary mb-2">
            Save & Export
          </h3>
          <p className="text-sm text-text-secondary">
            Save your favorite terrain configs as presets. Export configs as
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
              Save current settings ({formatPresetName(preset)}, seed: {seed})
              as a reusable preset.
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

export default TerrainGenPage;
