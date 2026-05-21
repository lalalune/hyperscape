/**
 * WaterBody custom sections — exposes the bespoke waypoint/polygon/tool
 * editor parts of WaterBodyProperties as schema-routable widgets. Simple
 * scalar fields (name, bodyType, surfaceY, bermWidth, valleyMultiplier)
 * are rendered by the schema itself; this widget covers the dynamic
 * parts: vertex-add mode toggle, river waypoint editor, lake polygon.
 *
 * Widgets exported:
 *   - WaterBodyGeometrySection ("WaterBodyGeometry")
 */

import { Plus, X } from "lucide-react";
import React, { useCallback } from "react";

import type { CustomSectionProps } from "./customSectionRegistry";
import { useWorldStudio } from "../../components/WorldStudio/WorldStudioContext";
import {
  InfoRow,
  NumberInput,
  PropertySection,
} from "../../components/WorldStudio/panels/properties/PropertyControls";
import type {
  PlacedWaterBody,
  RiverWaypoint,
} from "../../components/WorldStudio/types";

export function WaterBodyGeometrySection({ entityId }: CustomSectionProps) {
  const { state, actions } = useWorldStudio();
  const waterBody = state.extendedLayers.waterBodies.find(
    (w) => w.id === entityId,
  );
  const isAddingVertices = state.tools.isAddingWaterVertices;

  const update = useCallback(
    (updates: Partial<PlacedWaterBody>) => {
      if (!waterBody) return;
      actions.updateWaterBody(waterBody.id, updates);
    },
    [actions, waterBody],
  );

  const updateWaypoint = useCallback(
    (index: number, updates: Partial<RiverWaypoint>) => {
      if (!waterBody?.waypoints) return;
      const newWaypoints = [...waterBody.waypoints];
      newWaypoints[index] = { ...newWaypoints[index], ...updates };
      update({ waypoints: newWaypoints });
    },
    [waterBody, update],
  );

  if (!waterBody) {
    return (
      <div className="text-[10px] text-text-tertiary italic">
        Water body {entityId} not found.
      </div>
    );
  }

  // Calculate approximate length for rivers
  let pathLength = 0;
  if (waterBody.waypoints && waterBody.waypoints.length > 1) {
    for (let i = 1; i < waterBody.waypoints.length; i++) {
      const dx = waterBody.waypoints[i].x - waterBody.waypoints[i - 1].x;
      const dz = waterBody.waypoints[i].z - waterBody.waypoints[i - 1].z;
      pathLength += Math.sqrt(dx * dx + dz * dz);
    }
  }

  return (
    <>
      <button
        className={`w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] rounded border transition-colors ${
          isAddingVertices
            ? "bg-primary/20 border-primary/50 text-primary"
            : "bg-bg-tertiary border-border-primary text-text-tertiary hover:text-text-secondary hover:border-border-primary/80"
        } ease-out`}
        onClick={() => actions.setAddingWaterVertices(!isAddingVertices)}
      >
        {isAddingVertices ? <X size={10} /> : <Plus size={10} />}
        {isAddingVertices
          ? "Stop Adding"
          : waterBody.bodyType === "river"
            ? "Add Waypoints"
            : "Add Vertices"}
      </button>
      {isAddingVertices && (
        <div className="text-[10px] text-primary/70 italic">
          Click on terrain to place{" "}
          {waterBody.bodyType === "river" ? "waypoints" : "polygon vertices"}.
        </div>
      )}

      {waterBody.bodyType === "river" && waterBody.waypoints && (
        <>
          <InfoRow label="Waypoints" value={waterBody.waypoints.length} />
          <InfoRow label="Length" value={`~${Math.round(pathLength)}m`} />
          {waterBody.waypoints.length > 0 && (
            <PropertySection
              title="Waypoints"
              badge={waterBody.waypoints.length}
              defaultOpen={false}
            >
              {waterBody.waypoints.map((wp, i) => (
                <div
                  key={i}
                  className="space-y-0.5 py-1 border-b border-border-primary/20 last:border-0"
                >
                  <div className="text-[10px] font-semibold text-text-tertiary">
                    Point {i + 1}
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <NumberInput
                      label="X"
                      value={Math.round(wp.x)}
                      onChange={(x) => updateWaypoint(i, { x })}
                      step={5}
                    />
                    <NumberInput
                      label="Z"
                      value={Math.round(wp.z)}
                      onChange={(z) => updateWaypoint(i, { z })}
                      step={5}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <NumberInput
                      label="Width"
                      value={wp.halfWidth * 2}
                      onChange={(w) => updateWaypoint(i, { halfWidth: w / 2 })}
                      min={2}
                      max={100}
                      step={1}
                      unit="m"
                    />
                    <NumberInput
                      label="Depth"
                      value={wp.depth}
                      onChange={(depth) => updateWaypoint(i, { depth })}
                      min={0.1}
                      max={10}
                      step={0.1}
                      unit="m"
                    />
                  </div>
                </div>
              ))}
            </PropertySection>
          )}
        </>
      )}

      {waterBody.bodyType === "lake" && waterBody.polygon && (
        <PropertySection
          title="Lake Polygon"
          badge={waterBody.polygon.length}
          defaultOpen={false}
        >
          {waterBody.polygon.map((pt, i) => (
            <InfoRow
              key={i}
              label={`Point ${i + 1}`}
              value={`(${Math.round(pt.x)}, ${Math.round(pt.z)})`}
            />
          ))}
        </PropertySection>
      )}
    </>
  );
}
