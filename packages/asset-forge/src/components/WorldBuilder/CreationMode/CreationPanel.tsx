/**
 * CreationPanel
 *
 * The main panel for world creation mode. Contains presets, sliders, and
 * controls for configuring procedural world generation.
 */

import { TERRAIN_PRESETS } from "@hyperforge/procgen/terrain";
import {
  Mountain,
  Droplet,
  TreePine,
  MapPin,
  Route,
  Shuffle,
  Lock,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronRight,
  X,
  Home,
} from "lucide-react";
import React, { useCallback } from "react";

import { useWorldBuilder } from "../WorldBuilderContext";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
} from "@/components/common";

// ============== SECTION COMPONENT ==============

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: string;
}

const Section: React.FC<SectionProps> = ({
  title,
  icon,
  expanded,
  onToggle,
  children,
  badge,
}) => (
  <div className="border border-border-primary rounded-lg overflow-hidden">
    <button
      className="w-full px-4 py-3 bg-bg-secondary flex items-center gap-2 hover:bg-bg-tertiary transition-colors"
      onClick={onToggle}
    >
      {expanded ? (
        <ChevronDown className="w-4 h-4 text-text-muted" />
      ) : (
        <ChevronRight className="w-4 h-4 text-text-muted" />
      )}
      <span className="text-text-secondary">{icon}</span>
      <span className="font-medium text-text-primary">{title}</span>
      {badge && (
        <span className="ml-auto px-2 py-0.5 bg-primary bg-opacity-20 text-primary text-xs rounded-full">
          {badge}
        </span>
      )}
    </button>
    {expanded && <div className="p-4 bg-bg-primary space-y-3">{children}</div>}
  </div>
);

// ============== SLIDER INPUT ==============

interface SliderInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
}

const SliderInput: React.FC<SliderInputProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = "",
  hint,
}) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between">
      <label className="text-xs text-text-secondary">{label}</label>
      <span className="text-xs text-text-primary font-mono">
        {value}
        {unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-primary"
    />
    {hint && <p className="text-xs text-text-muted">{hint}</p>}
  </div>
);

// ============== TOGGLE INPUT ==============

interface ToggleInputProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}

const ToggleInput: React.FC<ToggleInputProps> = ({
  label,
  checked,
  onChange,
  hint,
}) => (
  <div className="flex items-center justify-between">
    <div>
      <label className="text-xs text-text-secondary">{label}</label>
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-bg-tertiary"
      }`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  </div>
);

// ============== CONFIRMATION MODAL ==============

interface ConfirmLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  config: {
    seed: number;
    worldSize: number;
    tileSize: number;
  };
  stats: {
    tiles?: number;
    biomes?: number;
    towns?: number;
    roads?: number;
  } | null;
}

const ConfirmLockModal: React.FC<ConfirmLockModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  config,
  stats,
}) => {
  if (!isOpen) return null;

  const worldSizeKm = (config.worldSize * config.tileSize) / 1000;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-bg-primary border border-border-primary rounded-lg shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-semibold text-text-primary">
              Lock World Foundation?
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-200">
              <p className="font-medium mb-1">This action cannot be undone!</p>
              <p className="text-yellow-200/70">
                Once locked, you cannot change terrain shape, town positions, or
                building locations. You can still customize content in Edit
                mode.
              </p>
            </div>
          </div>

          {/* World Summary */}
          <div className="bg-bg-secondary rounded-lg p-3 space-y-2">
            <h3 className="text-sm font-medium text-text-primary mb-2">
              World Summary
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Seed:</span>
                <span className="text-text-primary font-mono">
                  {config.seed}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Size:</span>
                <span className="text-text-primary">
                  {worldSizeKm.toFixed(1)} km²
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Tiles:</span>
                <span className="text-text-primary">
                  {stats?.tiles ?? config.worldSize * config.worldSize}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Biomes:</span>
                <span className="text-text-primary">
                  {stats?.biomes ?? "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Towns:</span>
                <span className="text-text-primary">{stats?.towns ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Roads:</span>
                <span className="text-text-primary">{stats?.roads ?? "—"}</span>
              </div>
            </div>
          </div>

          {/* What you CAN edit after locking */}
          <div className="text-xs text-text-muted">
            <p className="font-medium text-text-secondary mb-1">
              After locking, you can still:
            </p>
            <ul className="list-disc list-inside space-y-0.5 ml-1">
              <li>Change biome types (swap forest → desert)</li>
              <li>Rename towns and customize properties</li>
              <li>Add NPCs, quests, bosses, and events</li>
              <li>Define difficulty zones and lore</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-4 py-3 border-t border-border-primary">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="bg-yellow-600 hover:bg-yellow-500"
          >
            <Lock className="w-4 h-4 mr-2" />
            Lock Foundation
          </Button>
        </div>
      </div>
    </div>
  );
};

// ============== MAIN COMPONENT ==============

interface CreationPanelProps {
  onGeneratePreview: () => void;
  onApplyAndLock: () => void;
  showVegetation?: boolean;
  onToggleVegetation?: (show: boolean) => void;
  flyModeEnabled?: boolean;
  onToggleFlyMode?: (enabled: boolean) => void;
}

export const CreationPanel: React.FC<CreationPanelProps> = ({
  onGeneratePreview,
  onApplyAndLock,
  showVegetation = false,
  onToggleVegetation,
  flyModeEnabled = false,
  onToggleFlyMode,
}) => {
  const { state, actions } = useWorldBuilder();
  const {
    config,
    selectedPreset,
    isGenerating,
    hasPreview,
    generationError,
    previewStats,
  } = state.creation;

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = React.useState(false);

  // Section expansion state
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    new Set(["preset", "terrain", "towns"]),
  );

  // Handle apply and lock with confirmation
  const handleApplyClick = useCallback(() => {
    setShowConfirmModal(true);
  }, []);

  const handleConfirmLock = useCallback(() => {
    setShowConfirmModal(false);
    onApplyAndLock();
  }, [onApplyAndLock]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  // Get preset options
  const presetOptions = Object.entries(TERRAIN_PRESETS).map(([id, preset]) => ({
    id,
    name: preset.name,
    description: preset.description,
  }));

  // Handle preset selection
  const handlePresetChange = useCallback(
    (presetId: string) => {
      actions.setPreset(presetId);
      const preset = TERRAIN_PRESETS[presetId];
      if (preset) {
        // Apply preset config
        const presetConfig = preset.config;
        actions.updateCreationConfig({
          preset: presetId,
          terrain: {
            ...config.terrain,
            tileSize: presetConfig.tileSize ?? config.terrain.tileSize,
            worldSize: presetConfig.worldSize ?? config.terrain.worldSize,
            maxHeight: presetConfig.maxHeight ?? config.terrain.maxHeight,
            waterThreshold:
              presetConfig.waterThreshold ?? config.terrain.waterThreshold,
          },
        });
        if (presetConfig.island) {
          actions.updateIslandConfig(presetConfig.island);
        }
        if (presetConfig.biomes) {
          actions.updateBiomeConfig(presetConfig.biomes);
        }
        if (presetConfig.noise) {
          actions.updateNoiseConfig(presetConfig.noise);
        }
      }
    },
    [actions, config.terrain],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border-primary">
        <div className="flex items-center gap-2 mb-2">
          <Mountain className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-text-primary">
            World Creation
          </h2>
        </div>
        <p className="text-xs text-text-muted">
          Configure procedural world generation. Changes here will create a new
          world foundation.
        </p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Preset Selection */}
        <Section
          title="Preset"
          icon={<Mountain className="w-4 h-4" />}
          expanded={expandedSections.has("preset")}
          onToggle={() => toggleSection("preset")}
        >
          <div className="space-y-3">
            <select
              value={selectedPreset || ""}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-text-primary text-sm"
            >
              <option value="">Custom Configuration</option>
              {presetOptions.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
            {selectedPreset && (
              <p className="text-xs text-text-muted">
                {TERRAIN_PRESETS[selectedPreset]?.description}
              </p>
            )}
          </div>
        </Section>

        {/* Seed */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Shuffle className="w-4 h-4" />
              World Seed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <input
              type="number"
              value={config.seed}
              onChange={(e) => actions.setSeed(Number(e.target.value))}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-text-primary text-sm"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={actions.randomizeSeed}
              className="w-full"
            >
              <Shuffle className="w-4 h-4 mr-2" />
              Randomize
            </Button>
          </CardContent>
        </Card>

        {/* Terrain Settings */}
        <Section
          title="Terrain"
          icon={<Mountain className="w-4 h-4" />}
          expanded={expandedSections.has("terrain")}
          onToggle={() => toggleSection("terrain")}
        >
          <SliderInput
            label="World Size"
            value={config.terrain.worldSize}
            onChange={(v) => actions.updateTerrainConfig({ worldSize: v })}
            min={10}
            max={1000}
            step={10}
            hint={`${((config.terrain.worldSize * config.terrain.tileSize) / 1000).toFixed(1)}km x ${((config.terrain.worldSize * config.terrain.tileSize) / 1000).toFixed(1)}km${config.terrain.worldSize > 100 ? " (large world)" : ""}${config.terrain.worldSize > 500 ? " - may be slow" : ""}`}
          />
          <SliderInput
            label="Max Height"
            value={config.terrain.maxHeight}
            onChange={(v) => actions.updateTerrainConfig({ maxHeight: v })}
            min={10}
            max={100}
            step={5}
            unit="m"
          />
          <SliderInput
            label="Water Level"
            value={config.terrain.waterThreshold}
            onChange={(v) => actions.updateTerrainConfig({ waterThreshold: v })}
            min={0}
            max={20}
            step={0.5}
            unit="m"
          />
          <SliderInput
            label="Tile Resolution"
            value={config.terrain.tileResolution}
            onChange={(v) => actions.updateTerrainConfig({ tileResolution: v })}
            min={16}
            max={64}
            step={8}
            hint={`${Math.round(((config.terrain.worldSize * config.terrain.tileResolution) ** 2 * 36) / 1024 / 1024)}MB mesh`}
          />
        </Section>

        {/* Island Settings */}
        <Section
          title="Island Shape"
          icon={<Droplet className="w-4 h-4" />}
          expanded={expandedSections.has("island")}
          onToggle={() => toggleSection("island")}
        >
          <ToggleInput
            label="Enable Island Mask"
            checked={config.island.enabled}
            onChange={(v) => actions.updateIslandConfig({ enabled: v })}
            hint="Creates coastlines around the world edge"
          />
          {config.island.enabled && (
            <>
              <SliderInput
                label="Coastline Falloff"
                value={config.island.falloffTiles}
                onChange={(v) =>
                  actions.updateIslandConfig({ falloffTiles: v })
                }
                min={1}
                max={10}
                step={1}
                hint="Width of the transition to ocean"
              />
              <SliderInput
                label="Edge Noise Scale"
                value={config.island.edgeNoiseScale * 10000}
                onChange={(v) =>
                  actions.updateIslandConfig({ edgeNoiseScale: v / 10000 })
                }
                min={5}
                max={50}
                step={5}
                hint="Coastline irregularity frequency"
              />
              <SliderInput
                label="Edge Noise Strength"
                value={config.island.edgeNoiseStrength * 100}
                onChange={(v) =>
                  actions.updateIslandConfig({ edgeNoiseStrength: v / 100 })
                }
                min={0}
                max={20}
                step={1}
                hint="Coastline irregularity amount"
              />
            </>
          )}
        </Section>

        {/* Biome Settings */}
        <Section
          title="Biomes"
          icon={<TreePine className="w-4 h-4" />}
          expanded={expandedSections.has("biomes")}
          onToggle={() => toggleSection("biomes")}
        >
          <SliderInput
            label="Biome Grid Size"
            value={config.biomes.gridSize}
            onChange={(v) => actions.updateBiomeConfig({ gridSize: v })}
            min={2}
            max={6}
            step={1}
            hint={`${config.biomes.gridSize * config.biomes.gridSize} biome regions`}
          />
          <SliderInput
            label="Biome Jitter"
            value={config.biomes.jitter * 100}
            onChange={(v) => actions.updateBiomeConfig({ jitter: v / 100 })}
            min={0}
            max={50}
            step={5}
            hint="Randomness in biome placement"
          />
          <SliderInput
            label="Min Influence Radius"
            value={config.biomes.minInfluence}
            onChange={(v) => actions.updateBiomeConfig({ minInfluence: v })}
            min={500}
            max={5000}
            step={100}
            unit="m"
          />
          <SliderInput
            label="Max Influence Radius"
            value={config.biomes.maxInfluence}
            onChange={(v) => actions.updateBiomeConfig({ maxInfluence: v })}
            min={1000}
            max={8000}
            step={100}
            unit="m"
          />
          <SliderInput
            label="Boundary Noise"
            value={config.biomes.boundaryNoiseAmount * 100}
            onChange={(v) =>
              actions.updateBiomeConfig({ boundaryNoiseAmount: v / 100 })
            }
            min={0}
            max={30}
            step={1}
            hint="Organic edge variation"
          />
        </Section>

        {/* Town Settings */}
        <Section
          title="Towns"
          icon={<MapPin className="w-4 h-4" />}
          expanded={expandedSections.has("towns")}
          onToggle={() => toggleSection("towns")}
        >
          <SliderInput
            label="Town Count"
            value={config.towns.townCount}
            onChange={(v) => actions.updateTownConfig({ townCount: v })}
            min={0}
            max={20}
            step={1}
          />
          <SliderInput
            label="Min Town Spacing"
            value={config.towns.minTownSpacing}
            onChange={(v) => actions.updateTownConfig({ minTownSpacing: v })}
            min={200}
            max={2000}
            step={100}
            unit="m"
          />
          <SliderInput
            label="Min Flatness Score"
            value={config.towns.minFlatnessScore * 100}
            onChange={(v) =>
              actions.updateTownConfig({ minFlatnessScore: v / 100 })
            }
            min={50}
            max={100}
            step={5}
            hint="Required terrain flatness for towns"
          />

          {/* Town Size Distribution */}
          <div className="pt-2 border-t border-border-primary">
            <p className="text-xs text-text-secondary mb-2">
              Town Size Distribution
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Hamlets</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={config.towns.sizeDistribution.hamlet * 100}
                  onChange={(e) =>
                    actions.updateTownConfig({
                      sizeDistribution: {
                        ...config.towns.sizeDistribution,
                        hamlet: Number(e.target.value) / 100,
                      },
                    })
                  }
                  className="w-32 h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-green-500"
                />
                <span className="text-xs text-text-primary w-8 text-right">
                  {Math.round(config.towns.sizeDistribution.hamlet * 100)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Villages</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={config.towns.sizeDistribution.village * 100}
                  onChange={(e) =>
                    actions.updateTownConfig({
                      sizeDistribution: {
                        ...config.towns.sizeDistribution,
                        village: Number(e.target.value) / 100,
                      },
                    })
                  }
                  className="w-32 h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-yellow-500"
                />
                <span className="text-xs text-text-primary w-8 text-right">
                  {Math.round(config.towns.sizeDistribution.village * 100)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Towns</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={config.towns.sizeDistribution.town * 100}
                  onChange={(e) =>
                    actions.updateTownConfig({
                      sizeDistribution: {
                        ...config.towns.sizeDistribution,
                        town: Number(e.target.value) / 100,
                      },
                    })
                  }
                  className="w-32 h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
                <span className="text-xs text-text-primary w-8 text-right">
                  {Math.round(config.towns.sizeDistribution.town * 100)}%
                </span>
              </div>
            </div>
          </div>
        </Section>

        {/* Town Landmarks Settings */}
        <Section
          title="Town Landmarks"
          icon={<Home className="w-4 h-4" />}
          expanded={expandedSections.has("landmarks")}
          onToggle={() => toggleSection("landmarks")}
        >
          <ToggleInput
            label="Fences"
            checked={config.towns.landmarks.fencesEnabled}
            onChange={(v) =>
              actions.updateTownConfig({
                landmarks: { ...config.towns.landmarks, fencesEnabled: v },
              })
            }
            hint="Place fence posts around building lots"
          />
          {config.towns.landmarks.fencesEnabled && (
            <SliderInput
              label="Fence Density"
              value={config.towns.landmarks.fenceDensity * 100}
              onChange={(v) =>
                actions.updateTownConfig({
                  landmarks: {
                    ...config.towns.landmarks,
                    fenceDensity: v / 100,
                  },
                })
              }
              min={10}
              max={100}
              step={10}
              hint="Percentage of valid corners with fence posts"
            />
          )}
          <ToggleInput
            label="Village Lampposts"
            checked={config.towns.landmarks.lamppostsInVillages}
            onChange={(v) =>
              actions.updateTownConfig({
                landmarks: {
                  ...config.towns.landmarks,
                  lamppostsInVillages: v,
                },
              })
            }
            hint="Add lampposts to villages (always enabled for towns)"
          />
          <ToggleInput
            label="Market Stalls"
            checked={config.towns.landmarks.marketStallsEnabled}
            onChange={(v) =>
              actions.updateTownConfig({
                landmarks: {
                  ...config.towns.landmarks,
                  marketStallsEnabled: v,
                },
              })
            }
            hint="Place market stalls in town plazas"
          />
          <ToggleInput
            label="Decorations"
            checked={config.towns.landmarks.decorationsEnabled}
            onChange={(v) =>
              actions.updateTownConfig({
                landmarks: {
                  ...config.towns.landmarks,
                  decorationsEnabled: v,
                },
              })
            }
            hint="Add barrels, crates, planters near buildings"
          />
        </Section>

        {/* Road Settings */}
        <Section
          title="Roads"
          icon={<Route className="w-4 h-4" />}
          expanded={expandedSections.has("roads")}
          onToggle={() => toggleSection("roads")}
        >
          <SliderInput
            label="Road Width"
            value={config.roads.roadWidth}
            onChange={(v) => actions.updateRoadConfig({ roadWidth: v })}
            min={2}
            max={10}
            step={1}
            unit="m"
          />
          <SliderInput
            label="Extra Connections"
            value={config.roads.extraConnectionsRatio * 100}
            onChange={(v) =>
              actions.updateRoadConfig({ extraConnectionsRatio: v / 100 })
            }
            min={0}
            max={100}
            step={10}
            hint="Additional road connections beyond minimum"
          />
          <SliderInput
            label="Smoothing Iterations"
            value={config.roads.smoothingIterations}
            onChange={(v) =>
              actions.updateRoadConfig({ smoothingIterations: v })
            }
            min={0}
            max={10}
            step={1}
            hint="More = smoother curves"
          />
          <SliderInput
            label="Slope Cost"
            value={config.roads.costSlopeMultiplier}
            onChange={(v) =>
              actions.updateRoadConfig({ costSlopeMultiplier: v })
            }
            min={0.5}
            max={5}
            step={0.5}
            hint="Higher = roads avoid slopes"
          />
        </Section>

        {/* Generation Error */}
        {generationError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{generationError}</span>
          </div>
        )}

        {/* Preview Stats */}
        {previewStats && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Generation Results</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-text-secondary space-y-1">
              <div className="flex justify-between">
                <span>Tiles:</span>
                <span className="text-text-primary">{previewStats.tiles}</span>
              </div>
              <div className="flex justify-between">
                <span>Biomes:</span>
                <span className="text-text-primary">{previewStats.biomes}</span>
              </div>
              <div className="flex justify-between">
                <span>Towns:</span>
                <span className="text-text-primary">{previewStats.towns}</span>
              </div>
              <div className="flex justify-between">
                <span>Roads:</span>
                <span className="text-text-primary">{previewStats.roads}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-border-primary">
                <span>Generation Time:</span>
                <span className="text-text-primary">
                  {previewStats.generationTime.toFixed(0)}ms
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Visualization Options */}
      <div className="p-3 border-t border-border-primary space-y-3">
        {/* Camera Mode Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Camera Mode</span>
          <div className="flex bg-bg-tertiary rounded-lg p-0.5">
            <button
              onClick={() => onToggleFlyMode?.(false)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                !flyModeEnabled
                  ? "bg-primary text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Select
            </button>
            <button
              onClick={() => onToggleFlyMode?.(true)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                flyModeEnabled
                  ? "bg-blue-500 text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Fly
            </button>
          </div>
        </div>
        <p className="text-xs text-text-muted">
          {flyModeEnabled
            ? "Click viewport to capture mouse, WASD to fly"
            : "Click terrain, towns, or buildings to select"}
        </p>

        {/* Vegetation Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Show Vegetation</span>
          <button
            onClick={() => onToggleVegetation?.(!showVegetation)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              showVegetation ? "bg-green-500" : "bg-bg-tertiary"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                showVegetation ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        <p className="text-xs text-text-muted">
          GPU-instanced trees and rocks (may impact performance)
        </p>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border-primary space-y-3">
        {/* Live preview note */}
        <p className="text-xs text-text-muted text-center bg-bg-tertiary rounded p-2">
          Preview updates automatically as you adjust settings
        </p>

        {/* New Variation button - randomizes seed */}
        <Button
          onClick={onGeneratePreview}
          variant="secondary"
          className="w-full"
          disabled={isGenerating}
          title="Generate a new random world with different terrain and town placement"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Shuffle className="w-4 h-4 mr-2" />
              New Variation (Random Seed)
            </>
          )}
        </Button>

        {/* Apply & Lock - the primary action */}
        <Button
          onClick={handleApplyClick}
          className="w-full"
          disabled={!hasPreview || isGenerating}
        >
          <Lock className="w-4 h-4 mr-2" />
          Apply & Lock Foundation
        </Button>

        {hasPreview && (
          <p className="text-xs text-yellow-400/80 text-center">
            Warning: Locking is permanent. You cannot change terrain, town
            positions, or buildings after this step.
          </p>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmLockModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmLock}
        config={{
          seed: config.seed,
          worldSize: config.terrain.worldSize,
          tileSize: config.terrain.tileSize,
        }}
        stats={previewStats}
      />
    </div>
  );
};

export default CreationPanel;
