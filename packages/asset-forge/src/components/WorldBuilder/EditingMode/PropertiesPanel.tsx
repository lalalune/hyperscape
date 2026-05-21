/**
 * PropertiesPanel
 *
 * Context-sensitive properties editor for the currently selected element.
 * Shows different editors based on selection type.
 */

import {
  Settings,
  Mountain,
  Building2,
  MapPin,
  User,
  Scroll,
  Skull,
  Zap,
  BookOpen,
  Shield,
  Package,
  ChevronRight,
  ChevronDown,
  TreePine,
  Volume2,
  Lock,
  Grid3X3,
  Footprints,
  Swords,
  Navigation,
  X,
} from "lucide-react";
import React from "react";

import { useWorldBuilder } from "../WorldBuilderContext";
import type {
  GeneratedBiome,
  GeneratedTown,
  GeneratedBuilding,
  PlacedNPC,
  BiomeOverride,
  TownOverride,
  Selection,
  BiomeMaterialConfig,
  BiomeHeightConfig,
  BiomeMobSpawnConfig,
  MobSpawnEntry,
} from "../types";

import {
  QuestEditor,
  BossEditor,
  EventEditor,
  LoreEditor,
  DifficultyZoneEditor,
  CustomPlacementEditor,
} from "./LayerEditors";

// ============== SECTION COMPONENT ==============

interface SectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const Section: React.FC<SectionProps> = ({
  title,
  icon,
  children,
  defaultOpen = true,
}) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className="border-b border-border-primary last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 flex items-center gap-2 hover:bg-bg-tertiary transition-colors ease-out"
      >
        <ChevronRight
          className={`w-4 h-4 text-text-muted transition-transform ${
            isOpen ? "rotate-90" : ""
          } ease-out`}
        />
        {icon && <span className="text-text-secondary">{icon}</span>}
        <span className="font-medium text-sm text-text-primary">{title}</span>
      </button>
      {isOpen && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
};

// ============== FIELD COMPONENTS ==============

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, children }) => (
  <div className="space-y-1">
    <label className="text-xs text-text-muted">{label}</label>
    {children}
  </div>
);

const ReadOnlyField: React.FC<{ label: string; value: string | number }> = ({
  label,
  value,
}) => (
  <div className="flex items-center justify-between py-1">
    <span className="text-xs text-text-muted">{label}</span>
    <span className="text-xs text-text-primary font-mono">{value}</span>
  </div>
);

// ============== LOCKED BANNER ==============

interface LockedBannerProps {
  itemType: "biome" | "town" | "building";
}

const LockedBanner: React.FC<LockedBannerProps> = ({ itemType }) => {
  const messages: Record<
    string,
    { title: string; description: string; canEdit: string[] }
  > = {
    biome: {
      title: "Biome Position Locked",
      description:
        "Biome location and boundaries are fixed after world creation.",
      canEdit: [
        "Biome type (visual)",
        "Difficulty level",
        "Vegetation settings",
        "Ambient sounds",
      ],
    },
    town: {
      title: "Town Position Locked",
      description: "Town location and size are fixed after world creation.",
      canEdit: ["Town name", "Custom properties", "Add NPCs to town"],
    },
    building: {
      title: "Building Position Locked",
      description:
        "Building location, size, and type are fixed after world creation.",
      canEdit: ["Building name", "Custom properties"],
    },
  };

  const info = messages[itemType];
  if (!info) return null;

  return (
    <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
      <div className="flex items-start gap-2">
        <Lock className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-yellow-400">{info.title}</p>
          <p className="text-xs text-yellow-200/70 mt-1">{info.description}</p>
          <div className="mt-2">
            <p className="text-xs text-text-muted mb-1">You can still edit:</p>
            <ul className="text-xs text-text-secondary space-y-0.5">
              {info.canEdit.map((item, i) => (
                <li key={i} className="flex items-center gap-1">
                  <span className="text-green-400">•</span> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============== BIOME EDITOR CONSTANTS ==============

const BIOME_TYPES = [
  "plains",
  "forest",
  "valley",
  "mountains",
  "tundra",
  "desert",
  "lakes",
  "swamp",
] as const;

const DIFFICULTY_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Safe", color: "bg-green-500" },
  1: { label: "Easy", color: "bg-yellow-500" },
  2: { label: "Medium", color: "bg-orange-500" },
  3: { label: "Hard", color: "bg-red-500" },
  4: { label: "Deadly", color: "bg-purple-500" },
};

const TEXTURE_OPTIONS = [
  { id: "grass_01", name: "Grass (Light)" },
  { id: "grass_02", name: "Grass (Dark)" },
  { id: "dirt_01", name: "Dirt" },
  { id: "sand_01", name: "Sand" },
  { id: "rock_01", name: "Rock (Gray)" },
  { id: "rock_02", name: "Rock (Brown)" },
  { id: "snow_01", name: "Snow" },
  { id: "mud_01", name: "Mud" },
  { id: "gravel_01", name: "Gravel" },
] as const;

const MOB_TYPES = [
  { id: "goblin", name: "Goblin", baseLevel: 1 },
  { id: "wolf", name: "Wolf", baseLevel: 5 },
  { id: "spider", name: "Giant Spider", baseLevel: 8 },
  { id: "skeleton", name: "Skeleton", baseLevel: 12 },
  { id: "orc", name: "Orc", baseLevel: 18 },
  { id: "troll", name: "Troll", baseLevel: 25 },
  { id: "dragon", name: "Dragon", baseLevel: 50 },
  { id: "elemental", name: "Elemental", baseLevel: 35 },
] as const;

const DEFAULT_MATERIAL: BiomeMaterialConfig = {
  baseTextureId: "grass_01",
  blendMode: "height",
  blendThreshold: 0.5,
  roughness: 0.8,
  colorTint: "#4a7c39",
  uvScale: 1.0,
};

const DEFAULT_HEIGHT: BiomeHeightConfig = {
  minHeight: 0,
  maxHeight: 30,
  variance: 5,
  smoothness: 0.5,
};

const DEFAULT_MOB_SPAWN: BiomeMobSpawnConfig = {
  enabled: true,
  spawnRate: 0.5,
  maxPerChunk: 3,
  spawnTable: [],
};

// ============== BIOME EDITOR ==============

interface BiomeEditorProps {
  biome: GeneratedBiome;
  override: BiomeOverride | undefined;
}

const BiomeEditor: React.FC<BiomeEditorProps> = ({ biome, override }) => {
  const { actions } = useWorldBuilder();
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    new Set(["type"]),
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const effectiveType = override?.typeOverride || biome.type;
  const effectiveDifficulty = override?.difficultyOverride ?? 0;
  const effectiveMaterial = override?.materialOverride;
  const effectiveHeight = override?.heightOverride;
  const effectiveMobSpawn = override?.mobSpawnConfig;

  const handleTypeChange = (newType: string) => {
    if (override) {
      actions.updateBiomeOverride(biome.id, { typeOverride: newType });
    } else {
      actions.addBiomeOverride({
        biomeId: biome.id,
        typeOverride: newType,
      });
    }
  };

  const handleDifficultyChange = (difficulty: number) => {
    if (override) {
      actions.updateBiomeOverride(biome.id, { difficultyOverride: difficulty });
    } else {
      actions.addBiomeOverride({
        biomeId: biome.id,
        difficultyOverride: difficulty,
      });
    }
  };

  const handleMaterialChange = (material: Partial<BiomeMaterialConfig>) => {
    const updated = { ...(effectiveMaterial || DEFAULT_MATERIAL), ...material };
    if (override) {
      actions.updateBiomeOverride(biome.id, { materialOverride: updated });
    } else {
      actions.addBiomeOverride({
        biomeId: biome.id,
        materialOverride: updated,
      });
    }
  };

  const handleHeightChange = (height: Partial<BiomeHeightConfig>) => {
    const updated = { ...(effectiveHeight || DEFAULT_HEIGHT), ...height };
    if (override) {
      actions.updateBiomeOverride(biome.id, { heightOverride: updated });
    } else {
      actions.addBiomeOverride({ biomeId: biome.id, heightOverride: updated });
    }
  };

  const handleMobSpawnChange = (mobSpawn: Partial<BiomeMobSpawnConfig>) => {
    const updated = {
      ...(effectiveMobSpawn || DEFAULT_MOB_SPAWN),
      ...mobSpawn,
    };
    if (override) {
      actions.updateBiomeOverride(biome.id, { mobSpawnConfig: updated });
    } else {
      actions.addBiomeOverride({ biomeId: biome.id, mobSpawnConfig: updated });
    }
  };

  const handleRemoveOverride = () => {
    actions.removeBiomeOverride(biome.id);
  };

  return (
    <>
      <LockedBanner itemType="biome" />

      <Section title="Biome Info" icon={<Mountain className="w-4 h-4" />}>
        <ReadOnlyField label="ID" value={biome.id} />
        <ReadOnlyField label="Original Type" value={biome.type} />
        <ReadOnlyField label="Tiles" value={biome.tileKeys.length} />
        <ReadOnlyField
          label="Center"
          value={`${biome.center.x.toFixed(0)}, ${biome.center.z.toFixed(0)}`}
        />
        <ReadOnlyField
          label="Influence Radius"
          value={`${biome.influenceRadius.toFixed(0)}m`}
        />
      </Section>

      {/* Collapsible: Biome Type */}
      <div className="border-t border-border-primary">
        <button
          onClick={() => toggleSection("type")}
          className="w-full p-3 flex items-center justify-between hover:bg-bg-tertiary transition-colors ease-out"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <TreePine className="w-4 h-4 text-green-400" />
            Biome Type
          </span>
          <ChevronDown
            className={`w-4 h-4 text-text-muted transition-transform ${expandedSections.has("type") ? "" : "-rotate-90"} ease-out`}
          />
        </button>
        {expandedSections.has("type") && (
          <div className="px-3 pb-3 space-y-3">
            <Field label="Biome Type">
              <select
                value={effectiveType}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full px-5 py-4 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
              >
                {BIOME_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
            {override?.typeOverride && (
              <p className="text-xs text-yellow-400">
                Overridden from &quot;{biome.type}&quot;
              </p>
            )}
          </div>
        )}
      </div>

      {/* Collapsible: Material & Texture */}
      <div className="border-t border-border-primary">
        <button
          onClick={() => toggleSection("material")}
          className="w-full p-3 flex items-center justify-between hover:bg-bg-tertiary transition-colors ease-out"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <Settings className="w-4 h-4 text-purple-400" />
            Material & Texture
          </span>
          <ChevronDown
            className={`w-4 h-4 text-text-muted transition-transform ${expandedSections.has("material") ? "" : "-rotate-90"} ease-out`}
          />
        </button>
        {expandedSections.has("material") && (
          <div className="px-3 pb-3 space-y-3">
            <Field label="Base Texture">
              <select
                value={effectiveMaterial?.baseTextureId || "grass_01"}
                onChange={(e) =>
                  handleMaterialChange({ baseTextureId: e.target.value })
                }
                className="w-full px-5 py-4 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
              >
                {TEXTURE_OPTIONS.map((tex) => (
                  <option key={tex.id} value={tex.id}>
                    {tex.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Secondary Texture">
              <select
                value={effectiveMaterial?.secondaryTextureId || ""}
                onChange={(e) =>
                  handleMaterialChange({
                    secondaryTextureId: e.target.value || undefined,
                  })
                }
                className="w-full px-5 py-4 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
              >
                <option value="">None</option>
                {TEXTURE_OPTIONS.map((tex) => (
                  <option key={tex.id} value={tex.id}>
                    {tex.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Blend Mode">
              <select
                value={effectiveMaterial?.blendMode || "height"}
                onChange={(e) =>
                  handleMaterialChange({
                    blendMode: e.target.value as "height" | "slope" | "noise",
                  })
                }
                className="w-full px-5 py-4 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
              >
                <option value="height">Height-based</option>
                <option value="slope">Slope-based</option>
                <option value="noise">Noise-based</option>
              </select>
            </Field>
            <Field
              label={`Roughness: ${((effectiveMaterial?.roughness ?? 0.8) * 100).toFixed(0)}%`}
            >
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={effectiveMaterial?.roughness ?? 0.8}
                onChange={(e) =>
                  handleMaterialChange({ roughness: Number(e.target.value) })
                }
                className="w-full"
              />
            </Field>
            <Field label="Color Tint">
              <div className="flex gap-2">
                <input
                  type="color"
                  value={effectiveMaterial?.colorTint || "#4a7c39"}
                  onChange={(e) =>
                    handleMaterialChange({ colorTint: e.target.value })
                  }
                  className="w-10 h-10 rounded border border-border-primary cursor-pointer"
                />
                <input
                  type="text"
                  value={effectiveMaterial?.colorTint || "#4a7c39"}
                  onChange={(e) =>
                    handleMaterialChange({ colorTint: e.target.value })
                  }
                  className="flex-1 px-5 py-4 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary font-mono"
                />
              </div>
            </Field>
            <Field
              label={`UV Scale: ${(effectiveMaterial?.uvScale ?? 1).toFixed(1)}x`}
            >
              <input
                type="range"
                min={0.1}
                max={4}
                step={0.1}
                value={effectiveMaterial?.uvScale ?? 1}
                onChange={(e) =>
                  handleMaterialChange({ uvScale: Number(e.target.value) })
                }
                className="w-full"
              />
            </Field>
          </div>
        )}
      </div>

      {/* Collapsible: Height Configuration */}
      <div className="border-t border-border-primary">
        <button
          onClick={() => toggleSection("height")}
          className="w-full p-3 flex items-center justify-between hover:bg-bg-tertiary transition-colors ease-out"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <Mountain className="w-4 h-4 text-amber-400" />
            Height & Terrain
          </span>
          <ChevronDown
            className={`w-4 h-4 text-text-muted transition-transform ${expandedSections.has("height") ? "" : "-rotate-90"} ease-out`}
          />
        </button>
        {expandedSections.has("height") && (
          <div className="px-3 pb-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Min Height (m)">
                <input
                  type="number"
                  value={effectiveHeight?.minHeight ?? 0}
                  onChange={(e) =>
                    handleHeightChange({ minHeight: Number(e.target.value) })
                  }
                  className="w-full px-5 py-4 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                />
              </Field>
              <Field label="Max Height (m)">
                <input
                  type="number"
                  value={effectiveHeight?.maxHeight ?? 30}
                  onChange={(e) =>
                    handleHeightChange({ maxHeight: Number(e.target.value) })
                  }
                  className="w-full px-5 py-4 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
                />
              </Field>
            </div>
            <Field
              label={`Variance: ${(effectiveHeight?.variance ?? 5).toFixed(1)}m`}
            >
              <input
                type="range"
                min={0}
                max={20}
                step={0.5}
                value={effectiveHeight?.variance ?? 5}
                onChange={(e) =>
                  handleHeightChange({ variance: Number(e.target.value) })
                }
                className="w-full"
              />
            </Field>
            <Field
              label={`Smoothness: ${((effectiveHeight?.smoothness ?? 0.5) * 100).toFixed(0)}%`}
            >
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={effectiveHeight?.smoothness ?? 0.5}
                onChange={(e) =>
                  handleHeightChange({ smoothness: Number(e.target.value) })
                }
                className="w-full"
              />
            </Field>
          </div>
        )}
      </div>

      {/* Collapsible: Difficulty */}
      <div className="border-t border-border-primary">
        <button
          onClick={() => toggleSection("difficulty")}
          className="w-full p-3 flex items-center justify-between hover:bg-bg-tertiary transition-colors ease-out"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <Skull className="w-4 h-4 text-red-400" />
            Difficulty
          </span>
          <ChevronDown
            className={`w-4 h-4 text-text-muted transition-transform ${expandedSections.has("difficulty") ? "" : "-rotate-90"} ease-out`}
          />
        </button>
        {expandedSections.has("difficulty") && (
          <div className="px-3 pb-3">
            <Field label="Difficulty Level">
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={4}
                  value={effectiveDifficulty}
                  onChange={(e) =>
                    handleDifficultyChange(Number(e.target.value))
                  }
                  className="flex-1"
                />
                <span
                  className={`px-2 py-1 rounded text-xs text-white ${
                    DIFFICULTY_LABELS[effectiveDifficulty]?.color ||
                    "bg-gray-500"
                  }`}
                >
                  {DIFFICULTY_LABELS[effectiveDifficulty]?.label || "Unknown"}
                </span>
              </div>
            </Field>
          </div>
        )}
      </div>

      {/* Collapsible: Mob Spawns */}
      <div className="border-t border-border-primary">
        <button
          onClick={() => toggleSection("mobs")}
          className="w-full p-3 flex items-center justify-between hover:bg-bg-tertiary transition-colors ease-out"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <Swords className="w-4 h-4 text-orange-400" />
            Mob Spawns
          </span>
          <ChevronDown
            className={`w-4 h-4 text-text-muted transition-transform ${expandedSections.has("mobs") ? "" : "-rotate-90"} ease-out`}
          />
        </button>
        {expandedSections.has("mobs") && (
          <div className="px-3 pb-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">
                Enable Mob Spawning
              </span>
              <button
                onClick={() =>
                  handleMobSpawnChange({
                    enabled: !(effectiveMobSpawn?.enabled ?? true),
                  })
                }
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  (effectiveMobSpawn?.enabled ?? true)
                    ? "bg-green-500"
                    : "bg-bg-tertiary"
                } ease-out`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    (effectiveMobSpawn?.enabled ?? true)
                      ? "translate-x-5"
                      : "translate-x-0"
                  } ease-out`}
                />
              </button>
            </div>

            {(effectiveMobSpawn?.enabled ?? true) && (
              <>
                <Field
                  label={`Spawn Rate: ${(effectiveMobSpawn?.spawnRate ?? 0.5).toFixed(2)}/min/100m²`}
                >
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.05}
                    value={effectiveMobSpawn?.spawnRate ?? 0.5}
                    onChange={(e) =>
                      handleMobSpawnChange({
                        spawnRate: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </Field>
                <Field
                  label={`Max Per Chunk: ${effectiveMobSpawn?.maxPerChunk ?? 3}`}
                >
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    value={effectiveMobSpawn?.maxPerChunk ?? 3}
                    onChange={(e) =>
                      handleMobSpawnChange({
                        maxPerChunk: Number(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </Field>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">
                      Spawn Table
                    </span>
                    <button
                      onClick={() => {
                        const newEntry: MobSpawnEntry = {
                          mobTypeId: "goblin",
                          weight: 10,
                          levelRange: [1, 5],
                          groupSize: [1, 3],
                        };
                        handleMobSpawnChange({
                          spawnTable: [
                            ...(effectiveMobSpawn?.spawnTable || []),
                            newEntry,
                          ],
                        });
                      }}
                      className="px-2 py-1 text-xs bg-accent-primary text-white rounded hover:bg-accent-primary/80"
                    >
                      + Add Mob
                    </button>
                  </div>

                  {(effectiveMobSpawn?.spawnTable || []).map((entry, idx) => (
                    <div
                      key={idx}
                      className="bg-bg-tertiary rounded p-2 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <select
                          value={entry.mobTypeId}
                          onChange={(e) => {
                            const newTable = [
                              ...(effectiveMobSpawn?.spawnTable || []),
                            ];
                            newTable[idx] = {
                              ...entry,
                              mobTypeId: e.target.value,
                            };
                            handleMobSpawnChange({ spawnTable: newTable });
                          }}
                          className="flex-1 px-2 py-1 bg-bg-quaternary border border-border-primary rounded text-xs text-text-primary"
                        >
                          {MOB_TYPES.map((mob) => (
                            <option key={mob.id} value={mob.id}>
                              {mob.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            const newTable = [
                              ...(effectiveMobSpawn?.spawnTable || []),
                            ];
                            newTable.splice(idx, 1);
                            handleMobSpawnChange({ spawnTable: newTable });
                          }}
                          className="ml-2 p-1 text-red-400 hover:text-red-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-text-muted">Weight:</span>
                          <input
                            type="number"
                            value={entry.weight}
                            onChange={(e) => {
                              const newTable = [
                                ...(effectiveMobSpawn?.spawnTable || []),
                              ];
                              newTable[idx] = {
                                ...entry,
                                weight: Number(e.target.value),
                              };
                              handleMobSpawnChange({ spawnTable: newTable });
                            }}
                            min={1}
                            max={100}
                            className="w-full px-2 py-1 bg-bg-quaternary border border-border-primary rounded text-text-primary"
                          />
                        </div>
                        <div>
                          <span className="text-text-muted">Level:</span>
                          <div className="flex gap-1">
                            <input
                              type="number"
                              value={entry.levelRange[0]}
                              onChange={(e) => {
                                const newTable = [
                                  ...(effectiveMobSpawn?.spawnTable || []),
                                ];
                                newTable[idx] = {
                                  ...entry,
                                  levelRange: [
                                    Number(e.target.value),
                                    entry.levelRange[1],
                                  ],
                                };
                                handleMobSpawnChange({ spawnTable: newTable });
                              }}
                              min={1}
                              max={99}
                              className="w-full px-2 py-1 bg-bg-quaternary border border-border-primary rounded text-text-primary"
                            />
                            <span className="text-text-muted">-</span>
                            <input
                              type="number"
                              value={entry.levelRange[1]}
                              onChange={(e) => {
                                const newTable = [
                                  ...(effectiveMobSpawn?.spawnTable || []),
                                ];
                                newTable[idx] = {
                                  ...entry,
                                  levelRange: [
                                    entry.levelRange[0],
                                    Number(e.target.value),
                                  ],
                                };
                                handleMobSpawnChange({ spawnTable: newTable });
                              }}
                              min={1}
                              max={99}
                              className="w-full px-2 py-1 bg-bg-quaternary border border-border-primary rounded text-text-primary"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {(effectiveMobSpawn?.spawnTable || []).length === 0 && (
                    <p className="text-xs text-text-muted text-center py-2">
                      No mobs configured. Click &quot;+ Add Mob&quot; to add
                      spawn entries.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Collapsible: Atmosphere */}
      <div className="border-t border-border-primary">
        <button
          onClick={() => toggleSection("atmosphere")}
          className="w-full p-3 flex items-center justify-between hover:bg-bg-tertiary transition-colors ease-out"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <Volume2 className="w-4 h-4 text-cyan-400" />
            Atmosphere
          </span>
          <ChevronDown
            className={`w-4 h-4 text-text-muted transition-transform ${expandedSections.has("atmosphere") ? "" : "-rotate-90"} ease-out`}
          />
        </button>
        {expandedSections.has("atmosphere") && (
          <div className="px-3 pb-3">
            <Field label="Ambient Sound">
              <select
                value={override?.ambientSoundOverride || "default"}
                onChange={(e) => {
                  const value =
                    e.target.value === "default" ? undefined : e.target.value;
                  if (override) {
                    actions.updateBiomeOverride(biome.id, {
                      ambientSoundOverride: value,
                    });
                  } else if (value) {
                    actions.addBiomeOverride({
                      biomeId: biome.id,
                      ambientSoundOverride: value,
                    });
                  }
                }}
                className="w-full px-5 py-4 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
              >
                <option value="default">Default for biome type</option>
                <option value="wind_gentle">Wind (Gentle)</option>
                <option value="wind_plains">Wind (Plains)</option>
                <option value="wind_mountain">Wind (Mountain)</option>
                <option value="forest_mysterious">Forest (Mysterious)</option>
                <option value="swamp_ambient">Swamp</option>
                <option value="water_gentle">Water (Gentle)</option>
              </select>
            </Field>
          </div>
        )}
      </div>

      {override && (
        <div className="px-4 py-4 border-t border-border-primary">
          <button
            onClick={handleRemoveOverride}
            className="w-full py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors ease-out"
          >
            Remove All Overrides
          </button>
        </div>
      )}
    </>
  );
};

// ============== TOWN EDITOR ==============

interface TownEditorProps {
  town: GeneratedTown;
  override: TownOverride | undefined;
}

const TownEditor: React.FC<TownEditorProps> = ({ town, override }) => {
  const { actions } = useWorldBuilder();

  const effectiveName = override?.nameOverride || town.name;

  const handleNameChange = (newName: string) => {
    if (override) {
      actions.updateTownOverride(town.id, { nameOverride: newName });
    } else {
      actions.addTownOverride({
        townId: town.id,
        nameOverride: newName,
      });
    }
  };

  return (
    <>
      <LockedBanner itemType="town" />

      <Section title="Town Info" icon={<MapPin className="w-4 h-4" />}>
        <ReadOnlyField label="ID" value={town.id} />
        <ReadOnlyField label="Size" value={town.size} />
        <ReadOnlyField label="Layout" value={town.layoutType} />
        <ReadOnlyField label="Buildings" value={town.buildingIds.length} />
        <ReadOnlyField
          label="Position"
          value={`${town.position.x.toFixed(0)}, ${town.position.z.toFixed(0)}`}
        />
        <ReadOnlyField label="Biome" value={town.biomeId} />
      </Section>

      <Section title="Name" icon={<Building2 className="w-4 h-4" />}>
        <Field label="Town Name">
          <input
            type="text"
            value={effectiveName}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full px-5 py-4 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
          />
        </Field>
        {override?.nameOverride && (
          <p className="text-xs text-yellow-400">
            Renamed from &quot;{town.name}&quot;
          </p>
        )}
      </Section>

      <Section title="Entry Points">
        <div className="space-y-2">
          {town.entryPoints.map((entry, index) => (
            <div
              key={index}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-text-muted">{entry.direction}</span>
              <span className="text-text-primary font-mono">
                {entry.position.x.toFixed(0)}, {entry.position.z.toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
};

// ============== BUILDING EDITOR ==============

interface BuildingEditorProps {
  building: GeneratedBuilding;
}

const BuildingEditor: React.FC<BuildingEditorProps> = ({ building }) => {
  const [showImpostorAtlas, setShowImpostorAtlas] = React.useState(false);

  return (
    <>
      <LockedBanner itemType="building" />

      <Section title="Building Info" icon={<Building2 className="w-4 h-4" />}>
        <ReadOnlyField label="ID" value={building.id} />
        <ReadOnlyField label="Type" value={building.type} />
        <ReadOnlyField label="Name" value={building.name} />
        <ReadOnlyField label="Town" value={building.townId} />
        <ReadOnlyField
          label="Position"
          value={`${building.position.x.toFixed(1)}, ${building.position.z.toFixed(1)}`}
        />
        <ReadOnlyField
          label="Rotation"
          value={`${((building.rotation * 180) / Math.PI).toFixed(0)}°`}
        />
      </Section>

      <Section title="Dimensions">
        <ReadOnlyField
          label="Width"
          value={`${building.dimensions.width} cells`}
        />
        <ReadOnlyField
          label="Depth"
          value={`${building.dimensions.depth} cells`}
        />
        <ReadOnlyField label="Floors" value={building.dimensions.floors} />
      </Section>

      <Section title="LOD & Impostor" icon={<Settings className="w-4 h-4" />}>
        <div className="space-y-3">
          {/* LOD Distances */}
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-text-muted">LOD 0 (Full)</span>
              <span className="text-green-400">0 - 200m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">LOD 1 (Simple)</span>
              <span className="text-yellow-400">200 - 500m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">LOD 2 (Box)</span>
              <span className="text-orange-400">500m+</span>
            </div>
          </div>

          {/* Impostor Preview Toggle */}
          <button
            onClick={() => setShowImpostorAtlas(!showImpostorAtlas)}
            className="w-full px-5 py-4 bg-bg-tertiary hover:bg-bg-quaternary border border-border-primary rounded text-sm text-text-primary transition-colors ease-out"
          >
            {showImpostorAtlas ? "Hide Impostor Atlas" : "Show Impostor Atlas"}
          </button>

          {showImpostorAtlas && (
            <div className="bg-bg-tertiary rounded p-2 space-y-2">
              <div className="text-xs text-text-muted text-center">
                Impostor atlas preview
              </div>
              <div className="aspect-square bg-black/50 rounded border border-border-primary flex items-center justify-center">
                <div className="text-center text-text-muted text-xs">
                  <div className="font-display text-4xl mb-2 tracking-tight">
                    🖼️
                  </div>
                  <div>Atlas texture</div>
                  <div className="text-text-secondary mt-1">2048 × 2048</div>
                  <div className="text-text-secondary">31 × 31 views</div>
                </div>
              </div>
              <p className="text-xs text-text-muted">
                Octahedral impostor with 961 view angles for distance rendering.
              </p>
            </div>
          )}

          {/* Bake Button */}
          <button className="w-full px-3 py-2 bg-accent-primary hover:bg-accent-primary/80 rounded text-sm text-white font-medium transition-colors ease-out">
            Bake Impostor
          </button>
        </div>
      </Section>
    </>
  );
};

// ============== NPC EDITOR ==============

interface NPCEditorProps {
  npc: PlacedNPC;
}

const NPCEditor: React.FC<NPCEditorProps> = ({ npc }) => {
  const { actions } = useWorldBuilder();

  const handleNameChange = (name: string) => {
    actions.updateNPC(npc.id, { name });
  };

  const handlePositionChange = (axis: "x" | "y" | "z", value: number) => {
    actions.updateNPC(npc.id, {
      position: { ...npc.position, [axis]: value },
    });
  };

  return (
    <>
      <Section title="NPC Info" icon={<User className="w-4 h-4" />}>
        <ReadOnlyField label="ID" value={npc.id} />
        <ReadOnlyField label="Type" value={npc.npcTypeId} />

        <Field label="Name">
          <input
            type="text"
            value={npc.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full px-5 py-4 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
          />
        </Field>
      </Section>

      <Section title="Position">
        <div className="grid grid-cols-3 gap-2">
          <Field label="X">
            <input
              type="number"
              value={npc.position.x}
              onChange={(e) =>
                handlePositionChange("x", Number(e.target.value))
              }
              step={0.5}
              className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
            />
          </Field>
          <Field label="Y">
            <input
              type="number"
              value={npc.position.y}
              onChange={(e) =>
                handlePositionChange("y", Number(e.target.value))
              }
              step={0.5}
              className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
            />
          </Field>
          <Field label="Z">
            <input
              type="number"
              value={npc.position.z}
              onChange={(e) =>
                handlePositionChange("z", Number(e.target.value))
              }
              step={0.5}
              className="w-full px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
            />
          </Field>
        </div>
      </Section>

      <Section title="Context">
        <ReadOnlyField label="Parent Type" value={npc.parentContext.type} />
        {npc.parentContext.type === "town" && (
          <ReadOnlyField label="Town ID" value={npc.parentContext.townId} />
        )}
        {npc.parentContext.type === "building" && (
          <ReadOnlyField
            label="Building ID"
            value={npc.parentContext.buildingId}
          />
        )}
        {npc.storeId && <ReadOnlyField label="Store ID" value={npc.storeId} />}
        {npc.dialogId && (
          <ReadOnlyField label="Dialog ID" value={npc.dialogId} />
        )}
      </Section>

      <div className="px-4 pb-4">
        <button
          onClick={() => actions.removeNPC(npc.id)}
          className="w-full py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors ease-out"
        >
          Delete NPC
        </button>
      </div>
    </>
  );
};

// ============== TILE INSPECTOR ==============

interface TileInspectorProps {
  selection: Selection;
}

const TileInspector: React.FC<TileInspectorProps> = ({ selection }) => {
  const tileData = selection.tileData;

  if (!tileData) {
    return (
      <div className="p-4">
        <p className="text-sm text-text-muted">
          No tile data available for this selection.
        </p>
      </div>
    );
  }

  const getDifficultyColor = (level: number) => {
    const colors = [
      "text-green-400", // 0 - Safe
      "text-lime-400", // 1 - Easy
      "text-yellow-400", // 2 - Medium
      "text-orange-400", // 3 - Hard
      "text-red-400", // 4 - Extreme
    ];
    return colors[Math.min(level, 4)];
  };

  const getDifficultyLabel = (level: number) => {
    const labels = ["Safe Zone", "Easy", "Medium", "Hard", "Extreme"];
    return labels[Math.min(level, 4)];
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-border-primary">
        <Grid3X3 className="w-5 h-5 text-blue-400" />
        <span className="font-medium text-text-primary">Tile Inspector</span>
      </div>

      {/* Location */}
      <Section title="Location" icon={<Navigation className="w-4 h-4" />}>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-text-muted">Tile:</span>
            <span className="ml-2 text-text-primary font-mono">
              ({tileData.tileX}, {tileData.tileZ})
            </span>
          </div>
          <div>
            <span className="text-text-muted">Chunk:</span>
            <span className="ml-2 text-text-primary font-mono">
              ({tileData.chunkX}, {tileData.chunkZ})
            </span>
          </div>
          <div className="col-span-2">
            <span className="text-text-muted">World:</span>
            <span className="ml-2 text-text-primary font-mono">
              ({tileData.worldX.toFixed(1)}, {tileData.worldZ.toFixed(1)})
            </span>
          </div>
        </div>
      </Section>

      {/* Terrain */}
      <Section title="Terrain" icon={<Mountain className="w-4 h-4" />}>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">Height:</span>
            <span className="text-text-primary">
              {tileData.height.toFixed(2)}m
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Slope:</span>
            <span className="text-text-primary">
              {(tileData.slope * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Biome:</span>
            <span className="text-text-primary capitalize">
              {tileData.biome}
            </span>
          </div>
        </div>
      </Section>

      {/* Walkability */}
      <Section title="Navigation" icon={<Footprints className="w-4 h-4" />}>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-text-muted">Walkable:</span>
            <span
              className={tileData.walkable ? "text-green-400" : "text-red-400"}
            >
              {tileData.walkable ? "Yes" : "No"}
            </span>
          </div>
          {!tileData.walkable && (
            <p className="text-xs text-text-muted">
              {tileData.slope >= 0.7 ? "Too steep" : "Underwater"}
            </p>
          )}
        </div>
      </Section>

      {/* Zone Info */}
      <Section title="Zone" icon={<Shield className="w-4 h-4" />}>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-text-muted">In Town:</span>
            <span
              className={
                tileData.inTown ? "text-green-400" : "text-text-secondary"
              }
            >
              {tileData.inTown ? "Yes" : "No"}
            </span>
          </div>
          {tileData.inTown && tileData.townId && (
            <div className="text-xs text-text-muted">
              Town: {tileData.townId}
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-text-muted">Wilderness:</span>
            <span
              className={
                tileData.inWilderness ? "text-red-400" : "text-text-secondary"
              }
            >
              {tileData.inWilderness ? "Yes (PVP)" : "No"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-muted">Difficulty:</span>
            <span className={getDifficultyColor(tileData.difficultyLevel)}>
              {getDifficultyLabel(tileData.difficultyLevel)} (
              {tileData.difficultyLevel})
            </span>
          </div>
        </div>
      </Section>

      {/* Combat Info (if applicable) */}
      {!tileData.inTown && (
        <Section title="Combat" icon={<Swords className="w-4 h-4" />}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Mob Level Range:</span>
              <span className="text-text-primary">
                {Math.max(1, tileData.difficultyLevel * 10)} -{" "}
                {Math.min(99, (tileData.difficultyLevel + 1) * 10)}
              </span>
            </div>
            {tileData.inWilderness && (
              <div className="text-xs text-red-400/80 bg-red-500/10 p-2 rounded">
                ⚠️ PVP enabled - players can attack each other here
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
};

// ============== MAIN COMPONENT ==============

export const PropertiesPanel: React.FC = () => {
  const { state } = useWorldBuilder();
  const { selection, world } = state.editing;

  if (!world) {
    return (
      <div className="flex flex-col h-full bg-bg-secondary">
        <div className="p-4 border-b border-border-primary">
          <h3 className="font-medium text-text-primary flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Properties
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <p className="text-sm text-text-muted text-center">No world loaded</p>
        </div>
      </div>
    );
  }

  if (!selection) {
    return (
      <div className="flex flex-col h-full bg-bg-secondary">
        <div className="p-4 border-b border-border-primary">
          <h3 className="font-medium text-text-primary flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Properties
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <p className="text-sm text-text-muted text-center">
            Select an element to view and edit its properties
          </p>
        </div>
      </div>
    );
  }

  // Render appropriate editor based on selection type
  const renderEditor = () => {
    switch (selection.type) {
      case "biome": {
        const biome = world.foundation.biomes.find(
          (b) => b.id === selection.id,
        );
        if (!biome)
          return <p className="p-4 text-sm text-red-400">Biome not found</p>;
        const override = world.layers.biomeOverrides.get(selection.id);
        return <BiomeEditor biome={biome} override={override} />;
      }

      case "town": {
        const town = world.foundation.towns.find((t) => t.id === selection.id);
        if (!town)
          return <p className="p-4 text-sm text-red-400">Town not found</p>;
        const override = world.layers.townOverrides.get(selection.id);
        return <TownEditor town={town} override={override} />;
      }

      case "building": {
        const building = world.foundation.buildings.find(
          (b) => b.id === selection.id,
        );
        if (!building)
          return <p className="p-4 text-sm text-red-400">Building not found</p>;
        return <BuildingEditor building={building} />;
      }

      case "npc": {
        const npc = world.layers.npcs.find((n) => n.id === selection.id);
        if (!npc)
          return <p className="p-4 text-sm text-red-400">NPC not found</p>;
        return <NPCEditor npc={npc} />;
      }

      case "quest": {
        const quest = world.layers.quests.find((q) => q.id === selection.id);
        if (!quest)
          return <p className="p-4 text-sm text-red-400">Quest not found</p>;
        return <QuestEditor quest={quest} />;
      }

      case "boss": {
        const boss = world.layers.bosses.find((b) => b.id === selection.id);
        if (!boss)
          return <p className="p-4 text-sm text-red-400">Boss not found</p>;
        return <BossEditor boss={boss} />;
      }

      case "event": {
        const event = world.layers.events.find((e) => e.id === selection.id);
        if (!event)
          return <p className="p-4 text-sm text-red-400">Event not found</p>;
        return <EventEditor event={event} />;
      }

      case "lore": {
        const lore = world.layers.lore.find((l) => l.id === selection.id);
        if (!lore)
          return <p className="p-4 text-sm text-red-400">Lore not found</p>;
        return <LoreEditor lore={lore} />;
      }

      case "difficultyZone": {
        const zone = world.layers.difficultyZones.find(
          (z) => z.id === selection.id,
        );
        if (!zone)
          return (
            <p className="p-4 text-sm text-red-400">
              Difficulty zone not found
            </p>
          );
        return <DifficultyZoneEditor zone={zone} />;
      }

      case "customPlacement": {
        const placement = world.layers.customPlacements.find(
          (p) => p.id === selection.id,
        );
        if (!placement)
          return (
            <p className="p-4 text-sm text-red-400">
              Custom placement not found
            </p>
          );
        return <CustomPlacementEditor placement={placement} />;
      }

      case "tile":
      case "terrain":
      case "chunk": {
        // Tile inspector - show detailed tile data
        return <TileInspector selection={selection} />;
      }

      default:
        return (
          <p className="p-4 text-sm text-text-muted">
            No editor available for this selection type
          </p>
        );
    }
  };

  // Get selection icon and title
  const getSelectionHeader = () => {
    const icons: Record<string, React.ReactNode> = {
      tile: <Grid3X3 className="w-5 h-5 text-blue-400" />,
      terrain: <Grid3X3 className="w-5 h-5 text-blue-400" />,
      chunk: <Grid3X3 className="w-5 h-5 text-blue-400" />,
      biome: <Mountain className="w-5 h-5 text-emerald-400" />,
      town: <MapPin className="w-5 h-5 text-orange-400" />,
      building: <Building2 className="w-5 h-5 text-yellow-400" />,
      npc: <User className="w-5 h-5 text-cyan-400" />,
      quest: <Scroll className="w-5 h-5 text-indigo-400" />,
      boss: <Skull className="w-5 h-5 text-red-400" />,
      event: <Zap className="w-5 h-5 text-yellow-400" />,
      lore: <BookOpen className="w-5 h-5 text-amber-400" />,
      difficultyZone: <Shield className="w-5 h-5 text-rose-400" />,
      customPlacement: <Package className="w-5 h-5 text-teal-400" />,
      wilderness: <Swords className="w-5 h-5 text-red-400" />,
    };

    return (
      <div className="flex items-center gap-2">
        {icons[selection.type] || <Settings className="w-5 h-5" />}
        <div>
          <h3 className="font-medium text-text-primary">
            {selection.type.charAt(0).toUpperCase() + selection.type.slice(1)}
          </h3>
          <p className="text-xs text-text-muted font-mono">{selection.id}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      {/* Header with breadcrumb */}
      <div className="p-4 border-b border-border-primary">
        {getSelectionHeader()}

        {/* Breadcrumb */}
        {selection.path.length > 1 && (
          <div className="flex items-center gap-1 mt-2 text-xs text-text-muted overflow-x-auto">
            {selection.path.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && (
                  <ChevronRight className="w-3 h-3 flex-shrink-0" />
                )}
                <span
                  className={`truncate ${
                    index === selection.path.length - 1
                      ? "text-text-primary"
                      : ""
                  }`}
                >
                  {item.name}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Editor content */}
      <div className="flex-1 overflow-y-auto">{renderEditor()}</div>
    </div>
  );
};

export default PropertiesPanel;
