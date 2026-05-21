/**
 * BrushSettingsPanel — Left sidebar when brush tool is active
 *
 * Shows brush type selector, radius/strength sliders, falloff curve,
 * and mode-specific options (terrain raise/lower/flatten/smooth,
 * biome paint target, vegetation add/remove).
 */

import {
  Mountain,
  TreePine,
  Leaf,
  Grid3X3,
  Paintbrush,
  Undo2,
  Trash2,
  Sprout,
} from "lucide-react";
import React, { useCallback, useMemo } from "react";

import type {
  BrushType,
  TerrainBrushMode,
  BrushFalloff,
  BiomePaintMode,
  VegetationPaintMode,
} from "../types";
import { useWorldStudio } from "../WorldStudioContext";
import { useActiveBiomeIds } from "../hooks/useActiveContent";
import {
  PropertySection,
  SliderInput,
  SelectInput,
  Toggle,
  InfoRow,
} from "./properties/PropertyControls";

const BRUSH_TYPE_OPTIONS: Array<{ value: BrushType; label: string }> = [
  { value: "terrain", label: "Terrain" },
  { value: "biome", label: "Biome" },
  { value: "vegetation", label: "Vegetation" },
  { value: "foliage", label: "Foliage" },
  { value: "material", label: "Material" },
  { value: "collision", label: "Collision" },
];

const TERRAIN_MODE_OPTIONS: Array<{
  value: TerrainBrushMode;
  label: string;
}> = [
  { value: "raise", label: "Raise" },
  { value: "lower", label: "Lower" },
  { value: "flatten", label: "Flatten" },
  { value: "smooth", label: "Smooth" },
];

const FALLOFF_OPTIONS: Array<{ value: BrushFalloff; label: string }> = [
  { value: "sharp", label: "Sharp" },
  { value: "linear", label: "Linear" },
  { value: "smooth", label: "Smooth" },
];

const BIOME_PAINT_MODE_OPTIONS: Array<{
  value: BiomePaintMode;
  label: string;
}> = [
  { value: "paint", label: "Paint" },
  { value: "erase", label: "Erase" },
];

const VEG_PAINT_MODE_OPTIONS: Array<{
  value: VegetationPaintMode;
  label: string;
}> = [
  { value: "add", label: "Add" },
  { value: "remove", label: "Remove" },
];

const VEGETATION_SPECIES = [
  "tree",
  "bush",
  "fern",
  "rock",
  "fallen_tree",
  "flower",
  "mushroom",
  "grass",
];

import { MATERIAL_LAYER_DEFINITIONS } from "@hyperforge/procgen/terrain";

const FOLIAGE_TYPES = ["grass", "flower", "rock"];

const BRUSH_ICONS: Record<BrushType, React.ReactNode> = {
  terrain: <Mountain size={10} />,
  biome: <TreePine size={10} />,
  vegetation: <Leaf size={10} />,
  foliage: <Sprout size={10} />,
  material: <Paintbrush size={10} />,
  collision: <Grid3X3 size={10} />,
};

export function BrushSettingsPanel() {
  const { state, actions } = useWorldStudio();
  const settings = state.tools.brushSettings;
  const overlays = state.brushOverlays;

  const updateSetting = useCallback(
    (updates: Record<string, unknown>) => {
      actions.setBrushSettings(updates);
    },
    [actions],
  );

  // Biome paint targets come from the active content registry —
  // every biome a project's installed plugins / content packs
  // contribute. Empty registry → empty list (the dropdown
  // displays a "(none)" placeholder).
  const registeredBiomeIds = useActiveBiomeIds();
  const biomeOptions = useMemo(() => {
    // Always include the currently-selected target if it's not
    // in the registry (e.g. a project saved before installing
    // the relevant pack), so the dropdown can still show what's
    // in use without forcing a silent change.
    const ids = new Set<string>(registeredBiomeIds);
    if (settings.biomePaintTarget) ids.add(settings.biomePaintTarget);
    return Array.from(ids)
      .sort()
      .map((t) => ({
        value: t,
        label: t.charAt(0).toUpperCase() + t.slice(1),
      }));
  }, [registeredBiomeIds, settings.biomePaintTarget]);

  const strokeCount =
    settings.brushType === "terrain"
      ? overlays.terrainSculpts.length
      : settings.brushType === "biome"
        ? overlays.biomePaints.length
        : settings.brushType === "foliage"
          ? overlays.foliagePaints.length
          : settings.brushType === "material"
            ? overlays.materialPaints.length
            : settings.brushType === "collision"
              ? overlays.tileCollisions.length
              : overlays.vegetationPaints.length;

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary">
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-[0.12em]">
          Brush Settings
        </span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Brush type selector */}
        <PropertySection title="Brush Type">
          <div className="flex gap-1">
            {BRUSH_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] rounded border transition-colors ${
                  settings.brushType === opt.value
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : "bg-bg-tertiary border-border-primary text-text-tertiary hover:text-text-secondary hover:border-border-primary/80"
                } ease-out`}
                onClick={() => updateSetting({ brushType: opt.value })}
              >
                {BRUSH_ICONS[opt.value]}
                {opt.label}
              </button>
            ))}
          </div>
        </PropertySection>

        {/* Common brush settings */}
        <PropertySection title="Brush">
          <SliderInput
            label="Radius"
            value={settings.radius}
            onChange={(radius) => updateSetting({ radius })}
            min={1}
            max={50}
            step={1}
            unit="m"
          />
          <SliderInput
            label="Strength"
            value={settings.strength}
            onChange={(strength) => updateSetting({ strength })}
            min={0.05}
            max={1}
            step={0.05}
          />
          <SelectInput
            label="Falloff"
            value={settings.falloff}
            onChange={(falloff) => updateSetting({ falloff })}
            options={FALLOFF_OPTIONS}
          />
        </PropertySection>

        {/* Terrain-specific settings */}
        {settings.brushType === "terrain" && (
          <PropertySection title="Terrain Mode" icon={<Mountain size={10} />}>
            <div className="grid grid-cols-2 gap-1">
              {TERRAIN_MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                    settings.terrainMode === opt.value
                      ? "bg-primary/20 border-primary/50 text-primary"
                      : "bg-bg-tertiary border-border-primary text-text-tertiary hover:text-text-secondary"
                  } ease-out`}
                  onClick={() => updateSetting({ terrainMode: opt.value })}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {settings.terrainMode === "flatten" && (
              <div className="text-[10px] text-text-tertiary italic pt-1">
                Click to set target height, drag to flatten area.
              </div>
            )}
          </PropertySection>
        )}

        {/* Biome-specific settings */}
        {settings.brushType === "biome" && (
          <PropertySection title="Biome Paint" icon={<TreePine size={10} />}>
            <SelectInput
              label="Mode"
              value={settings.biomePaintMode}
              onChange={(mode) =>
                updateSetting({
                  biomePaintMode: mode,
                })
              }
              options={BIOME_PAINT_MODE_OPTIONS}
            />
            {settings.biomePaintMode === "paint" && (
              <SelectInput
                label="Target Biome"
                value={settings.biomePaintTarget}
                onChange={(biomePaintTarget) =>
                  updateSetting({ biomePaintTarget })
                }
                options={biomeOptions}
              />
            )}
            {settings.biomePaintMode === "paint" &&
              biomeOptions.length === 0 && (
                <InfoRow
                  label="No biomes"
                  value="Install a content pack or plugin to add biomes."
                />
              )}
          </PropertySection>
        )}

        {/* Vegetation-specific settings */}
        {settings.brushType === "vegetation" && (
          <PropertySection title="Vegetation Paint" icon={<Leaf size={10} />}>
            <SelectInput
              label="Mode"
              value={settings.vegetationPaintMode}
              onChange={(mode) =>
                updateSetting({
                  vegetationPaintMode: mode,
                })
              }
              options={VEG_PAINT_MODE_OPTIONS}
            />
            <div className="text-[10px] text-text-tertiary pt-1">
              Species Filter:
            </div>
            <div className="space-y-0.5">
              {VEGETATION_SPECIES.map((species) => (
                <Toggle
                  key={species}
                  label={
                    species.charAt(0).toUpperCase() +
                    species.slice(1).replace("_", " ")
                  }
                  value={
                    settings.vegetationSpeciesFilter.length === 0 ||
                    settings.vegetationSpeciesFilter.includes(species)
                  }
                  onChange={(enabled) => {
                    const current = settings.vegetationSpeciesFilter;
                    if (enabled) {
                      // Add to filter (or clear filter if all selected)
                      const newFilter = [...current, species];
                      if (newFilter.length >= VEGETATION_SPECIES.length) {
                        updateSetting({
                          vegetationSpeciesFilter: [],
                        });
                      } else {
                        updateSetting({
                          vegetationSpeciesFilter: newFilter,
                        });
                      }
                    } else {
                      // Remove from filter
                      const newFilter =
                        current.length === 0
                          ? VEGETATION_SPECIES.filter((s) => s !== species)
                          : current.filter((s) => s !== species);
                      updateSetting({
                        vegetationSpeciesFilter: newFilter,
                      });
                    }
                  }}
                />
              ))}
            </div>
            <div className="text-[10px] text-text-tertiary italic pt-1">
              Trees are applied on regenerate or deploy.
            </div>
          </PropertySection>
        )}

        {/* Foliage-specific settings */}
        {settings.brushType === "foliage" && (
          <PropertySection title="Foliage Paint" icon={<Sprout size={10} />}>
            <SelectInput
              label="Mode"
              value={settings.foliagePaintMode}
              onChange={(mode) => updateSetting({ foliagePaintMode: mode })}
              options={VEG_PAINT_MODE_OPTIONS}
            />
            <div className="text-[10px] text-text-tertiary pt-1">
              Type Filter:
            </div>
            <div className="space-y-0.5">
              {FOLIAGE_TYPES.map((ft) => (
                <Toggle
                  key={ft}
                  label={ft.charAt(0).toUpperCase() + ft.slice(1)}
                  value={
                    settings.foliageTypeFilter.length === 0 ||
                    settings.foliageTypeFilter.includes(ft)
                  }
                  onChange={(enabled) => {
                    const current = settings.foliageTypeFilter;
                    if (enabled) {
                      const newFilter = [...current, ft];
                      if (newFilter.length >= FOLIAGE_TYPES.length) {
                        updateSetting({ foliageTypeFilter: [] });
                      } else {
                        updateSetting({ foliageTypeFilter: newFilter });
                      }
                    } else {
                      const newFilter =
                        current.length === 0
                          ? FOLIAGE_TYPES.filter((t) => t !== ft)
                          : current.filter((t) => t !== ft);
                      updateSetting({ foliageTypeFilter: newFilter });
                    }
                  }}
                />
              ))}
            </div>
            <div className="text-[10px] text-text-tertiary italic pt-1">
              Paint ground cover density. Add increases, remove suppresses
              foliage.
            </div>
            <InfoRow
              label="Foliage Strokes"
              value={overlays.foliagePaints.length}
            />
          </PropertySection>
        )}

        {/* Material-specific settings */}
        {settings.brushType === "material" && (
          <PropertySection
            title="Material Layer"
            icon={<Paintbrush size={10} />}
          >
            <div className="grid grid-cols-2 gap-1">
              {MATERIAL_LAYER_DEFINITIONS.map((layer) => (
                <button
                  key={layer.id}
                  className={`flex items-center gap-1.5 px-2 py-1.5 text-[10px] rounded border transition-colors ${
                    settings.materialPaintTarget === layer.id
                      ? "bg-primary/20 border-primary/50 text-primary"
                      : "bg-bg-tertiary border-border-primary text-text-tertiary hover:text-text-secondary"
                  } ease-out`}
                  onClick={() =>
                    updateSetting({ materialPaintTarget: layer.id })
                  }
                >
                  <span
                    className="w-3 h-3 rounded-sm flex-shrink-0 border border-border-primary/30"
                    style={{ backgroundColor: layer.uiColor }}
                  />
                  {layer.name}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-text-tertiary italic pt-1">
              Paint material layers onto terrain. Overrides biome-based
              auto-material.
            </div>
            <InfoRow
              label="Material Strokes"
              value={overlays.materialPaints.length}
            />
          </PropertySection>
        )}

        {/* Collision-specific settings */}
        {settings.brushType === "collision" && (
          <PropertySection title="Collision Paint" icon={<Grid3X3 size={10} />}>
            <div className="grid grid-cols-2 gap-1">
              <button
                className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                  settings.collisionMode === "block"
                    ? "bg-red-400/20 border-red-400/50 text-red-400"
                    : "bg-bg-tertiary border-border-primary text-text-tertiary hover:text-text-secondary"
                } ease-out`}
                onClick={() => updateSetting({ collisionMode: "block" })}
              >
                Block
              </button>
              <button
                className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                  settings.collisionMode === "unblock"
                    ? "bg-green-400/20 border-green-400/50 text-green-400"
                    : "bg-bg-tertiary border-border-primary text-text-tertiary hover:text-text-secondary"
                } ease-out`}
                onClick={() => updateSetting({ collisionMode: "unblock" })}
              >
                Unblock
              </button>
            </div>
            <div className="text-[10px] text-text-tertiary italic pt-1">
              Paint to mark tiles as blocked (unwalkable) or unblock previously
              blocked tiles. 1m grid resolution.
            </div>
            <InfoRow
              label="Blocked Tiles"
              value={overlays.tileCollisions.filter((t) => t.blocked).length}
            />
            <InfoRow
              label="Total Overrides"
              value={overlays.tileCollisions.length}
            />
          </PropertySection>
        )}

        {/* Stroke history */}
        <PropertySection title="History" defaultOpen={false}>
          <InfoRow label="Strokes" value={strokeCount} />
          <div className="flex gap-1 pt-1">
            <button
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] rounded border border-border-primary text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary transition-colors disabled:opacity-30 ease-out"
              onClick={() => actions.undoLastBrushStroke(settings.brushType)}
              disabled={strokeCount === 0}
            >
              <Undo2 size={10} />
              Undo Last
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] rounded border border-red-400/30 text-red-400/60 hover:text-red-400 hover:bg-red-400/5 transition-colors disabled:opacity-30 ease-out"
              onClick={() => actions.clearBrushOverlays(settings.brushType)}
              disabled={strokeCount === 0}
            >
              <Trash2 size={10} />
              Clear All
            </button>
          </div>
        </PropertySection>
      </div>
    </div>
  );
}
