/**
 * TerrainProperties — Procgen terrain configuration editor
 *
 * Shows when terrain or chunk is selected. Displays current terrain config
 * with interactive sliders for noise layers, island shape, and shoreline.
 * Changes dispatch to WorldStudioContext creation config update actions.
 * Foundation data is shown read-only; noise/island/shoreline are editable
 * and flagged as requiring regeneration.
 */

import { Mountain, RefreshCw } from "lucide-react";
import React, { useCallback } from "react";

import type { TerrainNoiseConfig } from "@hyperforge/procgen/terrain";
import type { WorldData } from "../../../WorldBuilder/types";
import { useWorldStudio } from "../../WorldStudioContext";
import {
  PropertySection,
  SliderInput,
  NumberInput,
  Toggle,
  InfoRow,
} from "./PropertyControls";

interface Props {
  world: WorldData;
}

const NOISE_LAYERS = [
  "continent",
  "ridge",
  "hill",
  "erosion",
  "detail",
] as const;

const NOISE_LAYER_HINTS: Record<string, string> = {
  continent: "Large landmass shapes",
  ridge: "Mountain ridge features",
  hill: "Rolling hill variations",
  erosion: "Erosion valley carving",
  detail: "Fine surface detail",
};

export function TerrainProperties({ world }: Props) {
  const { actions, state } = useWorldStudio();
  const config = world.foundation.config;
  const terrain = config.terrain;
  const isEditing = state.builder.mode === "editing";

  const updateNoiseLayer = useCallback(
    (layer: (typeof NOISE_LAYERS)[number], field: string, value: number) => {
      const current = config.noise[layer];
      if (!current) return;
      actions.updateNoiseConfig({
        [layer]: { ...current, [field]: value },
      } as Partial<TerrainNoiseConfig>);
    },
    [actions, config.noise],
  );

  const updateIsland = useCallback(
    (field: string, value: number | boolean) => {
      actions.updateIslandConfig({ [field]: value });
    },
    [actions],
  );

  const updateShoreline = useCallback(
    (field: string, value: number) => {
      actions.updateCreationConfig({
        shoreline: { ...config.shoreline, [field]: value },
      });
    },
    [actions, config.shoreline],
  );

  return (
    <>
      <PropertySection title="Terrain" icon={<Mountain size={10} />}>
        <InfoRow
          label="World Size"
          value={`${terrain.worldSize}×${terrain.worldSize}`}
        />
        <InfoRow label="Tile Size" value={`${terrain.tileSize}m`} />
        <InfoRow label="Max Height" value={`${terrain.maxHeight}m`} />
        <InfoRow label="Water Level" value={terrain.waterThreshold} />
        <InfoRow
          label="Resolution"
          value={`${terrain.tileResolution} verts/tile`}
        />
        <InfoRow
          label="Total Area"
          value={`${terrain.worldSize * terrain.tileSize}×${terrain.worldSize * terrain.tileSize}m`}
        />
        <InfoRow label="Seed" value={config.seed} />
      </PropertySection>

      {config.noise && (
        <PropertySection title="Noise Layers" defaultOpen={false}>
          {isEditing && (
            <div className="text-[10px] text-amber-400/80 italic pb-1 flex items-center gap-1">
              <RefreshCw size={8} />
              Changes require regeneration to take effect.
            </div>
          )}
          {NOISE_LAYERS.map((layer) => {
            const cfg = config.noise[layer];
            if (!cfg) return null;
            return (
              <div
                key={layer}
                className="space-y-1 pb-2 border-b border-border-primary/30 last:border-0"
              >
                <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-[0.12em]">
                  {layer}
                  <span className="font-normal ml-1 opacity-60">
                    — {NOISE_LAYER_HINTS[layer]}
                  </span>
                </div>
                <SliderInput
                  label="Scale"
                  value={cfg.scale}
                  onChange={(v) => updateNoiseLayer(layer, "scale", v)}
                  min={0.0001}
                  max={0.01}
                  step={0.0001}
                  hint="Noise frequency"
                />
                <SliderInput
                  label="Weight"
                  value={cfg.weight}
                  onChange={(v) => updateNoiseLayer(layer, "weight", v)}
                  min={0}
                  max={1}
                  step={0.01}
                  hint="Contribution to final height"
                />
                {cfg.octaves != null && (
                  <SliderInput
                    label="Octaves"
                    value={cfg.octaves}
                    onChange={(v) => updateNoiseLayer(layer, "octaves", v)}
                    min={1}
                    max={8}
                    step={1}
                    hint="Fractal detail levels"
                  />
                )}
                {cfg.persistence != null && (
                  <SliderInput
                    label="Persistence"
                    value={cfg.persistence}
                    onChange={(v) => updateNoiseLayer(layer, "persistence", v)}
                    min={0.1}
                    max={1}
                    step={0.05}
                    hint="Amplitude reduction per octave"
                  />
                )}
                {cfg.lacunarity != null && (
                  <SliderInput
                    label="Lacunarity"
                    value={cfg.lacunarity}
                    onChange={(v) => updateNoiseLayer(layer, "lacunarity", v)}
                    min={1}
                    max={4}
                    step={0.1}
                    hint="Frequency increase per octave"
                  />
                )}
              </div>
            );
          })}
        </PropertySection>
      )}

      {config.island && (
        <PropertySection title="Island Shape" defaultOpen={false}>
          {isEditing && (
            <div className="text-[10px] text-amber-400/80 italic pb-1 flex items-center gap-1">
              <RefreshCw size={8} />
              Changes require regeneration.
            </div>
          )}
          <Toggle
            label="Enabled"
            value={config.island.enabled}
            onChange={(v) => updateIsland("enabled", v)}
          />
          <SliderInput
            label="Max Size"
            value={config.island.maxWorldSizeTiles}
            onChange={(v) => updateIsland("maxWorldSizeTiles", v)}
            min={10}
            max={200}
            step={5}
            unit="tiles"
          />
          <SliderInput
            label="Falloff"
            value={config.island.falloffTiles}
            onChange={(v) => updateIsland("falloffTiles", v)}
            min={1}
            max={20}
            step={1}
            unit="tiles"
            hint="Coastline transition width"
          />
          <SliderInput
            label="Edge Noise Scale"
            value={config.island.edgeNoiseScale}
            onChange={(v) => updateIsland("edgeNoiseScale", v)}
            min={0.0001}
            max={0.01}
            step={0.0001}
            hint="Coastline irregularity frequency"
          />
          <SliderInput
            label="Edge Noise Strength"
            value={config.island.edgeNoiseStrength}
            onChange={(v) => updateIsland("edgeNoiseStrength", v)}
            min={0}
            max={0.2}
            step={0.005}
            hint="Coastline variation amount"
          />
        </PropertySection>
      )}

      {config.shoreline && (
        <PropertySection title="Shoreline" defaultOpen={false}>
          {isEditing && (
            <div className="text-[10px] text-amber-400/80 italic pb-1 flex items-center gap-1">
              <RefreshCw size={8} />
              Changes require regeneration.
            </div>
          )}
          <SliderInput
            label="Water Level"
            value={config.shoreline.waterLevelNormalized}
            onChange={(v) => updateShoreline("waterLevelNormalized", v)}
            min={0}
            max={1}
            step={0.01}
            hint="Normalized water level (0-1)"
          />
          <SliderInput
            label="Threshold"
            value={config.shoreline.threshold}
            onChange={(v) => updateShoreline("threshold", v)}
            min={0}
            max={1}
            step={0.01}
          />
          <SliderInput
            label="Color Strength"
            value={config.shoreline.colorStrength}
            onChange={(v) => updateShoreline("colorStrength", v)}
            min={0}
            max={1}
            step={0.05}
          />
          <NumberInput
            label="Land Band"
            value={config.shoreline.landBand}
            onChange={(v) => updateShoreline("landBand", v)}
            min={0}
            max={50}
            step={1}
            unit="m"
          />
          <NumberInput
            label="Underwater Band"
            value={config.shoreline.underwaterBand}
            onChange={(v) => updateShoreline("underwaterBand", v)}
            min={0}
            max={50}
            step={1}
            unit="m"
          />
        </PropertySection>
      )}
    </>
  );
}
