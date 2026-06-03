/**
 * RoadsGenPage
 * Page for procedural road network generation within towns
 *
 * Features:
 * - 3 town sizes (hamlet, village, town)
 * - 3 road layouts (terminus, throughway, crossroads)
 * - Custom preset saving (seed + settings)
 * - Export configuration as JSON
 * - Statistics display
 */

import {
  Route,
  RefreshCw,
  MapPin,
  Settings2,
  Save,
  FolderOpen,
  Download,
  Upload,
  Trash2,
} from "lucide-react";
import React, { useState, useCallback, Suspense, useEffect } from "react";

import type { RoadsPreset } from "@/types/ProcgenPresets";
import { notify } from "@/utils/notify";

// API base
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3401";

// Lazy load the TownViewer to avoid SSR issues with Three.js
const TownViewer = React.lazy(() =>
  import("@hyperforge/procgen/building/viewer").then((m) => ({
    default: m.TownViewer,
  })),
);

type TownSize = "hamlet" | "village" | "town";
type RoadLayout = "terminus" | "throughway" | "crossroads";

interface RoadLayoutInfo {
  name: string;
  description: string;
  entryPoints: number;
}

const ROAD_LAYOUTS: Record<RoadLayout, RoadLayoutInfo> = {
  terminus: {
    name: "Terminus",
    description: "Single road ends here (dead end). Common for hamlets.",
    entryPoints: 1,
  },
  throughway: {
    name: "Throughway",
    description: "Road passes through with 2 entry points on opposite sides.",
    entryPoints: 2,
  },
  crossroads: {
    name: "Crossroads",
    description: "Two roads cross creating 4 entry points (X-shape).",
    entryPoints: 4,
  },
};

const TOWN_SIZES: Record<
  TownSize,
  { label: string; buildings: string; radius: string }
> = {
  hamlet: { label: "Hamlet", buildings: "3-5", radius: "25m" },
  village: { label: "Village", buildings: "6-10", radius: "40m" },
  town: { label: "Town", buildings: "11-16", radius: "60m" },
};

export const RoadsGenPage: React.FC = () => {
  const [seed, setSeed] = useState(12345);
  const [townSize, setTownSize] = useState<TownSize>("village");
  const [key, setKey] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Saved presets state
  const [savedPresets, setSavedPresets] = useState<RoadsPreset[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  // Load saved presets on mount
  useEffect(() => {
    loadSavedPresets();
  }, []);

  const loadSavedPresets = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/procgen/presets?category=roads`,
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
          category: "roads",
          settings: {
            townSize,
            seed,
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

  const loadSavedPreset = (savedPreset: RoadsPreset) => {
    setTownSize(savedPreset.settings.townSize);
    setSeed(savedPreset.settings.seed);
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
    // Brief delay to show loading state, actual generation is async in TownViewer
    setTimeout(() => {
      setIsGenerating(false);
    }, 200);
  }, []);

  const handleRandomSeed = useCallback(() => {
    setSeed(Math.floor(Math.random() * 100000));
  }, []);

  // Export config as JSON
  const exportConfig = useCallback(() => {
    const config = {
      townSize,
      seed,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roads-${townSize}-${seed}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    notify.success("Roads config exported");
  }, [townSize, seed]);

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

        // Validate townSize is a valid option
        const validSizes = ["hamlet", "village", "town"];
        if (config.townSize && validSizes.includes(config.townSize)) {
          setTownSize(config.townSize);
        }
        if (typeof config.seed === "number") {
          setSeed(config.seed);
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
            <Route size={28} />
            Road Network Generator
          </h1>
          <p className="text-text-secondary mt-1">
            Generate procedural road layouts for towns with various
            configurations
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Town Size Toggle */}
          <div className="flex bg-bg-tertiary rounded-lg p-1">
            {(Object.keys(TOWN_SIZES) as TownSize[]).map((size) => (
              <button
                key={size}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  townSize === size
                    ? "bg-primary text-white"
                    : "text-text-secondary hover:text-text-primary"
                }`}
                onClick={() => setTownSize(size)}
              >
                {TOWN_SIZES[size].label}
              </button>
            ))}
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
              Generation Settings
            </h3>

            <div className="space-y-4">
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

              <button
                onClick={handleRegenerate}
                disabled={isGenerating}
                className="w-full py-2 bg-primary hover:bg-primary-dark text-white rounded-md transition-all disabled:opacity-50"
              >
                Generate Roads
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

          {/* Road Layout Info */}
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
            <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
              <MapPin size={18} />
              Road Layouts
            </h3>
            <p className="text-xs text-text-secondary mb-3">
              Road layout is chosen based on town size. Larger towns get more
              complex layouts.
            </p>
            <div className="space-y-3">
              {(Object.keys(ROAD_LAYOUTS) as RoadLayout[]).map((layout) => (
                <div key={layout} className="p-2 bg-bg-tertiary rounded-md">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-text-primary">
                      {ROAD_LAYOUTS[layout].name}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {ROAD_LAYOUTS[layout].entryPoints} entry
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary">
                    {ROAD_LAYOUTS[layout].description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Stats Panel */}
          <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
            <h3 className="font-semibold text-text-primary mb-3">
              Current: {TOWN_SIZES[townSize].label}
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-text-secondary">
                <span>Buildings:</span>
                <span className="text-text-primary">
                  {TOWN_SIZES[townSize].buildings}
                </span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Safe Zone Radius:</span>
                <span className="text-text-primary">
                  {TOWN_SIZES[townSize].radius}
                </span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Likely Layout:</span>
                <span className="text-text-primary">
                  {townSize === "hamlet"
                    ? "Terminus"
                    : townSize === "village"
                      ? "Throughway"
                      : "Crossroads"}
                </span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Seed:</span>
                <span className="text-text-primary">{seed}</span>
              </div>
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
                  <span>Loading Road Generator...</span>
                </div>
              </div>
            }
          >
            <TownViewer
              key={`roads-${key}-${seed}-${townSize}`}
              initialSeed={seed}
              initialSize={townSize}
              width="100%"
              height="100%"
              showStats
              showControls
              backgroundColor={0x1a1a2e}
            />
          </Suspense>
        </div>
      </div>

      {/* Info Panel */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
          <h3 className="font-semibold text-text-primary mb-2">Road Types</h3>
          <p className="text-sm text-text-secondary">
            <strong>Terminus:</strong> Dead-end road for small settlements.
            <br />
            <strong>Throughway:</strong> Road passing through with opposite
            entries.
            <br />
            <strong>Crossroads:</strong> Intersection with 4 entry points.
          </p>
        </div>
        <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
          <h3 className="font-semibold text-text-primary mb-2">
            Building Placement
          </h3>
          <p className="text-sm text-text-secondary">
            Buildings are placed along roads with proper setbacks. Essential
            buildings (bank, store) are placed first, then residential buildings
            fill remaining lots.
          </p>
        </div>
        <div className="bg-bg-secondary rounded-lg p-4 border border-border-primary">
          <h3 className="font-semibold text-text-primary mb-2">
            Save & Export
          </h3>
          <p className="text-sm text-text-secondary">
            Save your favorite road configs as presets. Export configs as JSON
            to share or backup.
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
              Save current settings ({TOWN_SIZES[townSize].label}, seed: {seed})
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

export default RoadsGenPage;
