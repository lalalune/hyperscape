/**
 * BiomeProperties — Editor for selected biome
 *
 * Shows biome information and allows non-destructive overrides
 * (type change, vegetation, mob spawns, materials) via BiomeOverride layer.
 */

import { TreePine, Plus, X } from "lucide-react";
import React, { useCallback, useMemo } from "react";

import type {
  WorldData,
  BiomeOverride,
  BiomeVegetationConfig,
  VegetationLayer,
  BiomeMobSpawnConfig,
} from "../../../WorldBuilder/types";
import { useWorldStudio } from "../../WorldStudioContext";
import { useActiveBiomeIds } from "../../hooks/useActiveContent";
import {
  PropertySection,
  InfoRow,
  SelectInput,
  SliderInput,
  NumberInput,
  Toggle,
} from "./PropertyControls";

interface Props {
  biomeId: string;
  world: WorldData;
}

const VEGETATION_CATEGORIES = [
  "tree",
  "bush",
  "fern",
  "rock",
  "fallen_tree",
  "flower",
  "mushroom",
  "grass",
];

export function BiomeProperties({ biomeId, world }: Props) {
  const { actions } = useWorldStudio();

  const biome = world.foundation.biomes.find((b) => b.id === biomeId);
  const override = world.layers.biomeOverrides.get(biomeId);

  const updateOverride = useCallback(
    (updates: Partial<BiomeOverride>) => {
      if (override) {
        actions.updateBiomeOverride(biomeId, updates);
      } else {
        actions.addBiomeOverride({
          biomeId,
          ...updates,
        } as BiomeOverride);
      }
    },
    [actions, biomeId, override],
  );

  const updateVegetation = useCallback(
    (vegConfig: BiomeVegetationConfig) => {
      updateOverride({ vegetationOverride: vegConfig });
    },
    [updateOverride],
  );

  const updateVegetationLayer = useCallback(
    (index: number, updates: Partial<VegetationLayer>) => {
      const current = override?.vegetationOverride ?? {
        enabled: true,
        layers: [],
      };
      const newLayers = [...current.layers];
      newLayers[index] = { ...newLayers[index], ...updates };
      updateVegetation({ ...current, layers: newLayers });
    },
    [override, updateVegetation],
  );

  const addVegetationLayer = useCallback(() => {
    const current = override?.vegetationOverride ?? {
      enabled: true,
      layers: [],
    };
    const newLayer: VegetationLayer = {
      category: "tree",
      density: 50,
      assets: [],
      minSpacing: 5,
      clustering: false,
      noiseScale: 0.02,
      noiseThreshold: 0.3,
      avoidWater: true,
    };
    updateVegetation({
      ...current,
      layers: [...current.layers, newLayer],
    });
  }, [override, updateVegetation]);

  const removeVegetationLayer = useCallback(
    (index: number) => {
      const current = override?.vegetationOverride ?? {
        enabled: true,
        layers: [],
      };
      const newLayers = current.layers.filter((_, i) => i !== index);
      updateVegetation({ ...current, layers: newLayers });
    },
    [override, updateVegetation],
  );

  const updateMobSpawns = useCallback(
    (updates: Partial<BiomeMobSpawnConfig>) => {
      const current = override?.mobSpawnConfig ?? {
        enabled: false,
        spawnRate: 0.5,
        maxPerChunk: 3,
        spawnTable: [],
      };
      updateOverride({ mobSpawnConfig: { ...current, ...updates } });
    },
    [override, updateOverride],
  );

  if (!biome) {
    return (
      <PropertySection title="Biome">
        <InfoRow label="Status" value="Not found" />
      </PropertySection>
    );
  }

  const displayType = override?.typeOverride || biome.type;
  const vegConfig = override?.vegetationOverride;
  const mobConfig = override?.mobSpawnConfig;

  // Type-override options come from the active content registry —
  // every biome a project's installed plugins / content packs
  // contribute. Empty registry means no installed biomes; the
  // dropdown still includes the current type so users on a blank
  // project can see what's in use.
  const registeredBiomeIds = useActiveBiomeIds();
  const typeOptions = useMemo(() => {
    const ids = new Set<string>(registeredBiomeIds);
    ids.add(biome.type);
    if (override?.typeOverride) ids.add(override.typeOverride);
    return Array.from(ids)
      .sort()
      .map((t) => ({
        value: t,
        label: t.charAt(0).toUpperCase() + t.slice(1),
      }));
  }, [registeredBiomeIds, biome.type, override?.typeOverride]);

  return (
    <>
      <PropertySection title="Biome" icon={<TreePine size={10} />}>
        <InfoRow label="ID" value={biome.id} />
        <InfoRow label="Original Type" value={biome.type} />
        <InfoRow label="Tiles" value={biome.tileKeys.length} />
        <SelectInput
          label="Type Override"
          value={displayType}
          onChange={(typeOverride) => updateOverride({ typeOverride })}
          options={typeOptions}
        />
        {override?.difficultyOverride != null && (
          <SliderInput
            label="Difficulty"
            value={override.difficultyOverride}
            onChange={(difficultyOverride) =>
              updateOverride({ difficultyOverride })
            }
            min={0}
            max={10}
            step={1}
          />
        )}
      </PropertySection>

      {biome.center && (
        <PropertySection title="Center" defaultOpen={false}>
          <InfoRow
            label="Position"
            value={`(${Math.round(biome.center.x)}, ${Math.round(biome.center.z)})`}
          />
          {biome.influenceRadius != null && (
            <InfoRow
              label="Influence Radius"
              value={`${biome.influenceRadius}m`}
            />
          )}
        </PropertySection>
      )}

      <PropertySection title="Vegetation" defaultOpen={false}>
        <Toggle
          label="Enabled"
          value={vegConfig?.enabled ?? true}
          onChange={(enabled) =>
            updateVegetation({
              enabled,
              layers: vegConfig?.layers ?? [],
            })
          }
        />
        {(vegConfig?.layers ?? []).map((layer, i) => (
          <div
            key={i}
            className="space-y-1 pt-2 pb-2 border-t border-border-primary/30"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-[0.12em]">
                Layer {i + 1}
              </span>
              <button
                className="p-0.5 rounded text-text-tertiary hover:text-red-400 hover:bg-red-400/10"
                onClick={() => removeVegetationLayer(i)}
                title="Remove layer"
              >
                <X size={10} />
              </button>
            </div>
            <SelectInput
              label="Category"
              value={layer.category}
              onChange={(category) => updateVegetationLayer(i, { category })}
              options={VEGETATION_CATEGORIES.map((c) => ({
                value: c,
                label: c.charAt(0).toUpperCase() + c.slice(1).replace("_", " "),
              }))}
            />
            <SliderInput
              label="Density"
              value={layer.density}
              onChange={(density) => updateVegetationLayer(i, { density })}
              min={0}
              max={200}
              step={5}
              hint="Instances per 100×100m tile"
            />
            <SliderInput
              label="Min Spacing"
              value={layer.minSpacing}
              onChange={(minSpacing) =>
                updateVegetationLayer(i, { minSpacing })
              }
              min={1}
              max={30}
              step={1}
              unit="m"
            />
            <Toggle
              label="Clustering"
              value={layer.clustering}
              onChange={(clustering) =>
                updateVegetationLayer(i, { clustering })
              }
            />
            {layer.clustering && (
              <NumberInput
                label="Cluster Size"
                value={layer.clusterSize ?? 5}
                onChange={(clusterSize) =>
                  updateVegetationLayer(i, { clusterSize })
                }
                min={2}
                max={20}
                step={1}
              />
            )}
            <SliderInput
              label="Noise Scale"
              value={layer.noiseScale}
              onChange={(noiseScale) =>
                updateVegetationLayer(i, { noiseScale })
              }
              min={0.001}
              max={0.1}
              step={0.001}
              hint="Distribution pattern size"
            />
            <SliderInput
              label="Noise Threshold"
              value={layer.noiseThreshold}
              onChange={(noiseThreshold) =>
                updateVegetationLayer(i, { noiseThreshold })
              }
              min={0}
              max={1}
              step={0.05}
              hint="Placement selectivity"
            />
            <Toggle
              label="Avoid Water"
              value={layer.avoidWater}
              onChange={(avoidWater) =>
                updateVegetationLayer(i, { avoidWater })
              }
            />
            <Toggle
              label="Avoid Steep Slopes"
              value={layer.avoidSteepSlopes ?? false}
              onChange={(avoidSteepSlopes) =>
                updateVegetationLayer(i, { avoidSteepSlopes })
              }
            />
          </div>
        ))}
        <button
          className="w-full mt-1 py-1 text-[10px] text-primary/80 hover:text-primary hover:bg-primary/5 rounded border border-dashed border-primary/30 flex items-center justify-center gap-1"
          onClick={addVegetationLayer}
        >
          <Plus size={10} />
          Add Vegetation Layer
        </button>
      </PropertySection>

      <PropertySection title="Mob Spawns" defaultOpen={false}>
        <Toggle
          label="Enabled"
          value={mobConfig?.enabled ?? false}
          onChange={(enabled) => updateMobSpawns({ enabled })}
        />
        {(mobConfig?.enabled ?? false) && (
          <>
            <SliderInput
              label="Spawn Rate"
              value={mobConfig?.spawnRate ?? 0.5}
              onChange={(spawnRate) => updateMobSpawns({ spawnRate })}
              min={0.1}
              max={5}
              step={0.1}
              hint="Spawns per 100m² per minute"
            />
            <NumberInput
              label="Max Per Chunk"
              value={mobConfig?.maxPerChunk ?? 3}
              onChange={(maxPerChunk) => updateMobSpawns({ maxPerChunk })}
              min={1}
              max={20}
              step={1}
            />
            <InfoRow
              label="Spawn Table"
              value={`${mobConfig?.spawnTable.length ?? 0} entries`}
            />
          </>
        )}
      </PropertySection>

      <PropertySection title="Override Status" defaultOpen={false}>
        <div className="text-[10px] text-text-tertiary italic">
          {override
            ? "This biome has a non-destructive override applied."
            : "No overrides applied. Changes above create an override layer."}
        </div>
      </PropertySection>
    </>
  );
}
