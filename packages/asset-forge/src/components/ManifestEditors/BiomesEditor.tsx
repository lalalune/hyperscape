/**
 * BiomesEditor
 * Visual editor for biomes.json with mob difficulty ranges and vegetation layers
 */

import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Trees,
  Skull,
  Palette,
  Mountain,
  Droplet,
  Settings,
  Copy,
  GripVertical,
} from "lucide-react";
import React, { useState, useCallback } from "react";

// Types based on biomes.json structure
interface VegetationLayer {
  category: string;
  density: number;
  assets: string[];
  minSpacing: number;
  clustering: boolean;
  clusterSize?: number;
  noiseScale: number;
  noiseThreshold: number;
  avoidWater: boolean;
  avoidSteepSlopes?: boolean;
  minHeight?: number;
  maxHeight?: number;
}

interface VegetationConfig {
  enabled: boolean;
  layers: VegetationLayer[];
}

interface ColorScheme {
  primary: string;
  secondary: string;
  fog: string;
}

interface Biome {
  id: string;
  name: string;
  description: string;
  difficultyLevel: number;
  terrain: string;
  resources: string[];
  mobs: string[];
  mobTypes: string[];
  fogIntensity: number;
  ambientSound: string;
  colorScheme: ColorScheme;
  color: number;
  heightRange: [number, number];
  terrainMultiplier: number;
  waterLevel: number;
  maxSlope: number;
  difficulty: number;
  baseHeight: number;
  heightVariation: number;
  resourceDensity: number;
  resourceTypes: string[];
  vegetation: VegetationConfig;
}

interface BiomesEditorProps {
  biomes: Biome[];
  onChange: (biomes: Biome[]) => void;
  availableMobs: string[];
  availableVegetationAssets: Record<string, string[]>;
}

const TERRAIN_TYPES = [
  "plains",
  "forest",
  "mountains",
  "desert",
  "swamp",
  "frozen",
  "lake",
];
const VEGETATION_CATEGORIES = [
  "tree",
  "bush",
  "rock",
  "grass",
  "flower",
  "mushroom",
  "fern",
  "ivy",
];
const AMBIENT_SOUNDS = [
  "wind_gentle",
  "wind_plains",
  "wind_mountain",
  "wind_arctic",
  "wind_desolate",
  "forest_mysterious",
  "swamp_ambient",
  "water_gentle",
];
const RESOURCE_TYPES = ["trees", "fishing_spots", "mining_rocks"];

const DIFFICULTY_COLORS: Record<number, string> = {
  0: "bg-green-500",
  1: "bg-yellow-500",
  2: "bg-orange-500",
  3: "bg-red-500",
  4: "bg-purple-500",
};

const DIFFICULTY_LABELS: Record<number, string> = {
  0: "Safe",
  1: "Easy",
  2: "Medium",
  3: "Hard",
  4: "Deadly",
};

export const BiomesEditor: React.FC<BiomesEditorProps> = ({
  biomes,
  onChange,
  availableMobs,
  availableVegetationAssets,
}) => {
  const [selectedBiomeId, setSelectedBiomeId] = useState<string | null>(
    biomes[0]?.id || null,
  );
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["general", "mobs", "vegetation"]),
  );

  const selectedBiome = biomes.find((b) => b.id === selectedBiomeId);

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

  const updateBiome = useCallback(
    (biomeId: string, updates: Partial<Biome>) => {
      const newBiomes = biomes.map((b) =>
        b.id === biomeId ? { ...b, ...updates } : b,
      );
      onChange(newBiomes);
    },
    [biomes, onChange],
  );

  const addMobToBiome = useCallback(
    (biomeId: string, mobId: string) => {
      const biome = biomes.find((b) => b.id === biomeId);
      if (!biome || biome.mobs.includes(mobId)) return;

      updateBiome(biomeId, {
        mobs: [...biome.mobs, mobId],
        mobTypes: [...biome.mobTypes, mobId],
      });
    },
    [biomes, updateBiome],
  );

  const removeMobFromBiome = useCallback(
    (biomeId: string, mobId: string) => {
      const biome = biomes.find((b) => b.id === biomeId);
      if (!biome) return;

      updateBiome(biomeId, {
        mobs: biome.mobs.filter((m) => m !== mobId),
        mobTypes: biome.mobTypes.filter((m) => m !== mobId),
      });
    },
    [biomes, updateBiome],
  );

  const updateVegetationLayer = useCallback(
    (
      biomeId: string,
      layerIndex: number,
      updates: Partial<VegetationLayer>,
    ) => {
      const biome = biomes.find((b) => b.id === biomeId);
      if (!biome) return;

      const newLayers = biome.vegetation.layers.map((layer, i) =>
        i === layerIndex ? { ...layer, ...updates } : layer,
      );

      updateBiome(biomeId, {
        vegetation: { ...biome.vegetation, layers: newLayers },
      });
    },
    [biomes, updateBiome],
  );

  const addVegetationLayer = useCallback(
    (biomeId: string) => {
      const biome = biomes.find((b) => b.id === biomeId);
      if (!biome) return;

      const newLayer: VegetationLayer = {
        category: "bush",
        density: 10,
        assets: [],
        minSpacing: 5,
        clustering: false,
        noiseScale: 0.03,
        noiseThreshold: 0.5,
        avoidWater: true,
      };

      updateBiome(biomeId, {
        vegetation: {
          ...biome.vegetation,
          layers: [...biome.vegetation.layers, newLayer],
        },
      });
    },
    [biomes, updateBiome],
  );

  const removeVegetationLayer = useCallback(
    (biomeId: string, layerIndex: number) => {
      const biome = biomes.find((b) => b.id === biomeId);
      if (!biome) return;

      updateBiome(biomeId, {
        vegetation: {
          ...biome.vegetation,
          layers: biome.vegetation.layers.filter((_, i) => i !== layerIndex),
        },
      });
    },
    [biomes, updateBiome],
  );

  const duplicateBiome = useCallback(
    (biomeId: string) => {
      const biome = biomes.find((b) => b.id === biomeId);
      if (!biome) return;

      const newBiome: Biome = {
        ...JSON.parse(JSON.stringify(biome)),
        id: `${biome.id}_copy`,
        name: `${biome.name} (Copy)`,
      };

      onChange([...biomes, newBiome]);
      setSelectedBiomeId(newBiome.id);
    },
    [biomes, onChange],
  );

  const deleteBiome = useCallback(
    (biomeId: string) => {
      if (!confirm(`Delete biome "${biomeId}"?`)) return;

      const newBiomes = biomes.filter((b) => b.id !== biomeId);
      onChange(newBiomes);

      if (selectedBiomeId === biomeId) {
        setSelectedBiomeId(newBiomes[0]?.id || null);
      }
    },
    [biomes, onChange, selectedBiomeId],
  );

  return (
    <div className="flex h-full">
      {/* Biome list sidebar */}
      <div className="w-64 border-r border-border-primary bg-bg-secondary flex flex-col">
        <div className="p-3 border-b border-border-primary flex items-center justify-between">
          <h3 className="font-medium text-text-primary">Biomes</h3>
          <span className="text-xs text-text-muted">{biomes.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {biomes.map((biome) => (
            <button
              key={biome.id}
              className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-bg-tertiary transition-colors ${
                selectedBiomeId === biome.id
                  ? "bg-primary bg-opacity-10 border-l-2 border-primary"
                  : ""
              }`}
              onClick={() => setSelectedBiomeId(biome.id)}
            >
              <div
                className={`w-3 h-3 rounded-full ${DIFFICULTY_COLORS[biome.difficultyLevel] || "bg-gray-500"}`}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-text-primary truncate text-sm">
                  {biome.name}
                </div>
                <div className="text-xs text-text-muted flex items-center gap-2">
                  <span>{biome.terrain}</span>
                  {biome.mobs.length > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Skull className="w-3 h-3" />
                      {biome.mobs.length}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Editor panel */}
      {selectedBiome ? (
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-bg-secondary border-b border-border-primary p-4 flex items-center justify-between z-10">
            <div>
              <input
                type="text"
                value={selectedBiome.name}
                onChange={(e) =>
                  updateBiome(selectedBiome.id, { name: e.target.value })
                }
                className="text-lg font-semibold text-text-primary bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-1"
              />
              <div className="text-xs text-text-muted">
                ID: {selectedBiome.id}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => duplicateBiome(selectedBiome.id)}
                className="p-2 hover:bg-bg-tertiary rounded text-text-secondary"
                title="Duplicate biome"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => deleteBiome(selectedBiome.id)}
                className="p-2 hover:bg-red-500 hover:bg-opacity-20 rounded text-red-400"
                title="Delete biome"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* General Section */}
            <Section
              title="General"
              icon={<Settings className="w-4 h-4" />}
              expanded={expandedSections.has("general")}
              onToggle={() => toggleSection("general")}
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Description">
                  <textarea
                    value={selectedBiome.description}
                    onChange={(e) =>
                      updateBiome(selectedBiome.id, {
                        description: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary resize-none"
                    rows={2}
                  />
                </FormField>

                <FormField label="Terrain Type">
                  <select
                    value={selectedBiome.terrain}
                    onChange={(e) =>
                      updateBiome(selectedBiome.id, { terrain: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  >
                    {TERRAIN_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Difficulty Level">
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="4"
                      value={selectedBiome.difficultyLevel}
                      onChange={(e) =>
                        updateBiome(selectedBiome.id, {
                          difficultyLevel: parseInt(e.target.value, 10),
                          difficulty: parseInt(e.target.value, 10),
                        })
                      }
                      className="flex-1"
                    />
                    <span
                      className={`px-2 py-1 rounded text-xs text-white ${DIFFICULTY_COLORS[selectedBiome.difficultyLevel]}`}
                    >
                      {DIFFICULTY_LABELS[selectedBiome.difficultyLevel]}
                    </span>
                  </div>
                </FormField>

                <FormField label="Ambient Sound">
                  <select
                    value={selectedBiome.ambientSound}
                    onChange={(e) =>
                      updateBiome(selectedBiome.id, {
                        ambientSound: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  >
                    {AMBIENT_SOUNDS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
            </Section>

            {/* Terrain Section */}
            <Section
              title="Terrain"
              icon={<Mountain className="w-4 h-4" />}
              expanded={expandedSections.has("terrain")}
              onToggle={() => toggleSection("terrain")}
            >
              <div className="grid grid-cols-3 gap-4">
                <FormField label="Height Range">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={selectedBiome.heightRange[0]}
                      onChange={(e) =>
                        updateBiome(selectedBiome.id, {
                          heightRange: [
                            parseFloat(e.target.value),
                            selectedBiome.heightRange[1],
                          ],
                        })
                      }
                      className="w-20 px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                    />
                    <span className="text-text-muted">to</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={selectedBiome.heightRange[1]}
                      onChange={(e) =>
                        updateBiome(selectedBiome.id, {
                          heightRange: [
                            selectedBiome.heightRange[0],
                            parseFloat(e.target.value),
                          ],
                        })
                      }
                      className="w-20 px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                    />
                  </div>
                </FormField>

                <FormField label="Base Height">
                  <input
                    type="number"
                    step="0.1"
                    value={selectedBiome.baseHeight}
                    onChange={(e) =>
                      updateBiome(selectedBiome.id, {
                        baseHeight: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  />
                </FormField>

                <FormField label="Height Variation">
                  <input
                    type="number"
                    step="0.05"
                    value={selectedBiome.heightVariation}
                    onChange={(e) =>
                      updateBiome(selectedBiome.id, {
                        heightVariation: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  />
                </FormField>

                <FormField label="Max Slope">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={selectedBiome.maxSlope}
                    onChange={(e) =>
                      updateBiome(selectedBiome.id, {
                        maxSlope: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  />
                </FormField>

                <FormField label="Water Level">
                  <input
                    type="number"
                    step="0.1"
                    value={selectedBiome.waterLevel}
                    onChange={(e) =>
                      updateBiome(selectedBiome.id, {
                        waterLevel: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  />
                </FormField>

                <FormField label="Fog Intensity">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={selectedBiome.fogIntensity}
                    onChange={(e) =>
                      updateBiome(selectedBiome.id, {
                        fogIntensity: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  />
                </FormField>
              </div>
            </Section>

            {/* Colors Section */}
            <Section
              title="Colors"
              icon={<Palette className="w-4 h-4" />}
              expanded={expandedSections.has("colors")}
              onToggle={() => toggleSection("colors")}
            >
              <div className="grid grid-cols-3 gap-4">
                <FormField label="Primary Color">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedBiome.colorScheme.primary}
                      onChange={(e) =>
                        updateBiome(selectedBiome.id, {
                          colorScheme: {
                            ...selectedBiome.colorScheme,
                            primary: e.target.value,
                          },
                        })
                      }
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={selectedBiome.colorScheme.primary}
                      onChange={(e) =>
                        updateBiome(selectedBiome.id, {
                          colorScheme: {
                            ...selectedBiome.colorScheme,
                            primary: e.target.value,
                          },
                        })
                      }
                      className="flex-1 px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary font-mono"
                    />
                  </div>
                </FormField>

                <FormField label="Secondary Color">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedBiome.colorScheme.secondary}
                      onChange={(e) =>
                        updateBiome(selectedBiome.id, {
                          colorScheme: {
                            ...selectedBiome.colorScheme,
                            secondary: e.target.value,
                          },
                        })
                      }
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={selectedBiome.colorScheme.secondary}
                      onChange={(e) =>
                        updateBiome(selectedBiome.id, {
                          colorScheme: {
                            ...selectedBiome.colorScheme,
                            secondary: e.target.value,
                          },
                        })
                      }
                      className="flex-1 px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary font-mono"
                    />
                  </div>
                </FormField>

                <FormField label="Fog Color">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedBiome.colorScheme.fog}
                      onChange={(e) =>
                        updateBiome(selectedBiome.id, {
                          colorScheme: {
                            ...selectedBiome.colorScheme,
                            fog: e.target.value,
                          },
                        })
                      }
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={selectedBiome.colorScheme.fog}
                      onChange={(e) =>
                        updateBiome(selectedBiome.id, {
                          colorScheme: {
                            ...selectedBiome.colorScheme,
                            fog: e.target.value,
                          },
                        })
                      }
                      className="flex-1 px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary font-mono"
                    />
                  </div>
                </FormField>
              </div>
            </Section>

            {/* Mobs Section */}
            <Section
              title="Mobs"
              icon={<Skull className="w-4 h-4" />}
              expanded={expandedSections.has("mobs")}
              onToggle={() => toggleSection("mobs")}
              badge={selectedBiome.mobs.length.toString()}
            >
              <div className="space-y-3">
                <p className="text-xs text-text-muted">
                  Mobs that can spawn in this biome. Difficulty level affects
                  mob level scaling.
                </p>

                {/* Current mobs */}
                <div className="flex flex-wrap gap-2">
                  {selectedBiome.mobs.map((mobId) => (
                    <div
                      key={mobId}
                      className="flex items-center gap-1 px-2 py-1 bg-bg-tertiary rounded-full text-sm"
                    >
                      <Skull className="w-3 h-3 text-red-400" />
                      <span className="text-text-primary">{mobId}</span>
                      <button
                        onClick={() =>
                          removeMobFromBiome(selectedBiome.id, mobId)
                        }
                        className="ml-1 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {selectedBiome.mobs.length === 0 && (
                    <span className="text-text-muted text-sm italic">
                      No mobs (safe zone)
                    </span>
                  )}
                </div>

                {/* Add mob dropdown */}
                <div className="flex items-center gap-2">
                  <select
                    className="flex-1 px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                    onChange={(e) => {
                      if (e.target.value) {
                        addMobToBiome(selectedBiome.id, e.target.value);
                        e.target.value = "";
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="">Add mob...</option>
                    {availableMobs
                      .filter((m) => !selectedBiome.mobs.includes(m))
                      .map((mob) => (
                        <option key={mob} value={mob}>
                          {mob}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </Section>

            {/* Resources Section */}
            <Section
              title="Resources"
              icon={<Droplet className="w-4 h-4" />}
              expanded={expandedSections.has("resources")}
              onToggle={() => toggleSection("resources")}
            >
              <div className="space-y-3">
                <FormField label="Resource Density">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={selectedBiome.resourceDensity}
                    onChange={(e) =>
                      updateBiome(selectedBiome.id, {
                        resourceDensity: parseFloat(e.target.value),
                      })
                    }
                    className="w-32 px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                  />
                </FormField>

                <FormField label="Resource Types">
                  <div className="flex flex-wrap gap-2">
                    {RESOURCE_TYPES.map((rt) => (
                      <label
                        key={rt}
                        className="flex items-center gap-1 px-2 py-1 bg-bg-tertiary rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedBiome.resourceTypes.includes(rt)}
                          onChange={(e) => {
                            const newTypes = e.target.checked
                              ? [...selectedBiome.resourceTypes, rt]
                              : selectedBiome.resourceTypes.filter(
                                  (t) => t !== rt,
                                );
                            updateBiome(selectedBiome.id, {
                              resourceTypes: newTypes,
                              resources: newTypes,
                            });
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-text-primary">{rt}</span>
                      </label>
                    ))}
                  </div>
                </FormField>
              </div>
            </Section>

            {/* Vegetation Section */}
            <Section
              title="Vegetation"
              icon={<Trees className="w-4 h-4" />}
              expanded={expandedSections.has("vegetation")}
              onToggle={() => toggleSection("vegetation")}
              badge={selectedBiome.vegetation.layers.length.toString()}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedBiome.vegetation.enabled}
                      onChange={(e) =>
                        updateBiome(selectedBiome.id, {
                          vegetation: {
                            ...selectedBiome.vegetation,
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="rounded"
                    />
                    <span className="text-sm text-text-primary">
                      Enable vegetation
                    </span>
                  </label>
                  <button
                    onClick={() => addVegetationLayer(selectedBiome.id)}
                    className="flex items-center gap-1 px-3 py-1 bg-primary bg-opacity-20 text-primary rounded text-sm hover:bg-opacity-30"
                  >
                    <Plus className="w-4 h-4" />
                    Add Layer
                  </button>
                </div>

                {/* Vegetation layers */}
                <div className="space-y-3">
                  {selectedBiome.vegetation.layers.map((layer, index) => (
                    <VegetationLayerEditor
                      key={index}
                      layer={layer}
                      index={index}
                      availableAssets={
                        availableVegetationAssets[layer.category] || []
                      }
                      onChange={(updates) =>
                        updateVegetationLayer(selectedBiome.id, index, updates)
                      }
                      onDelete={() =>
                        removeVegetationLayer(selectedBiome.id, index)
                      }
                    />
                  ))}
                </div>
              </div>
            </Section>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-text-muted">
          Select a biome to edit
        </div>
      )}
    </div>
  );
};

// Section component
interface SectionProps {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({
  title,
  icon,
  expanded,
  onToggle,
  badge,
  children,
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
    {expanded && <div className="p-4 bg-bg-primary">{children}</div>}
  </div>
);

// Form field component
interface FormFieldProps {
  label: string;
  children: React.ReactNode;
}

const FormField: React.FC<FormFieldProps> = ({ label, children }) => (
  <div className="space-y-1">
    <label className="text-xs text-text-secondary font-medium">{label}</label>
    {children}
  </div>
);

// Vegetation layer editor
interface VegetationLayerEditorProps {
  layer: VegetationLayer;
  index: number;
  availableAssets: string[];
  onChange: (updates: Partial<VegetationLayer>) => void;
  onDelete: () => void;
}

const VegetationLayerEditor: React.FC<VegetationLayerEditorProps> = ({
  layer,
  index: _index,
  availableAssets: _availableAssets,
  onChange,
  onDelete,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border-primary rounded bg-bg-secondary">
      <div className="px-3 py-2 flex items-center gap-2">
        <GripVertical className="w-4 h-4 text-text-muted cursor-move" />
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center gap-2 text-left"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-text-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-muted" />
          )}
          <span className="font-medium text-text-primary capitalize">
            {layer.category}
          </span>
          <span className="text-xs text-text-muted">
            density: {layer.density} | spacing: {layer.minSpacing}m
          </span>
        </button>
        <button
          onClick={onDelete}
          className="p-1 hover:bg-red-500 hover:bg-opacity-20 rounded text-red-400"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border-primary space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Category">
              <select
                value={layer.category}
                onChange={(e) => onChange({ category: e.target.value })}
                className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
              >
                {VEGETATION_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Density">
              <input
                type="number"
                value={layer.density}
                onChange={(e) =>
                  onChange({ density: parseInt(e.target.value, 10) })
                }
                className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
              />
            </FormField>

            <FormField label="Min Spacing">
              <input
                type="number"
                step="0.5"
                value={layer.minSpacing}
                onChange={(e) =>
                  onChange({ minSpacing: parseFloat(e.target.value) })
                }
                className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
              />
            </FormField>

            <FormField label="Noise Scale">
              <input
                type="number"
                step="0.01"
                value={layer.noiseScale}
                onChange={(e) =>
                  onChange({ noiseScale: parseFloat(e.target.value) })
                }
                className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
              />
            </FormField>

            <FormField label="Noise Threshold">
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={layer.noiseThreshold}
                onChange={(e) =>
                  onChange({ noiseThreshold: parseFloat(e.target.value) })
                }
                className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
              />
            </FormField>

            <FormField label="Cluster Size">
              <input
                type="number"
                value={layer.clusterSize || 0}
                onChange={(e) =>
                  onChange({ clusterSize: parseInt(e.target.value, 10) })
                }
                disabled={!layer.clustering}
                className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary disabled:opacity-50"
              />
            </FormField>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={layer.clustering}
                onChange={(e) => onChange({ clustering: e.target.checked })}
                className="rounded"
              />
              <span className="text-text-primary">Clustering</span>
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={layer.avoidWater}
                onChange={(e) => onChange({ avoidWater: e.target.checked })}
                className="rounded"
              />
              <span className="text-text-primary">Avoid Water</span>
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={layer.avoidSteepSlopes || false}
                onChange={(e) =>
                  onChange({ avoidSteepSlopes: e.target.checked })
                }
                className="rounded"
              />
              <span className="text-text-primary">Avoid Steep Slopes</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Min Height">
              <input
                type="number"
                value={layer.minHeight || ""}
                placeholder="None"
                onChange={(e) =>
                  onChange({
                    minHeight: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
                className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
              />
            </FormField>
            <FormField label="Max Height">
              <input
                type="number"
                value={layer.maxHeight || ""}
                placeholder="None"
                onChange={(e) =>
                  onChange({
                    maxHeight: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
                className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
              />
            </FormField>
          </div>

          <FormField label="Assets">
            <div className="flex flex-wrap gap-1 mb-2">
              {layer.assets.map((asset, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 px-2 py-0.5 bg-bg-tertiary rounded text-xs"
                >
                  {asset}
                  <button
                    onClick={() =>
                      onChange({
                        assets: layer.assets.filter((_, j) => j !== i),
                      })
                    }
                    className="text-text-muted hover:text-red-400"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="Add asset ID..."
              className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.currentTarget.value) {
                  onChange({
                    assets: [...layer.assets, e.currentTarget.value],
                  });
                  e.currentTarget.value = "";
                }
              }}
            />
          </FormField>
        </div>
      )}
    </div>
  );
};

export default BiomesEditor;
