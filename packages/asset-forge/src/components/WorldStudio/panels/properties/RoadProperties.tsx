/**
 * RoadProperties — Editor for selected road
 *
 * Generated roads: read-only info display.
 * Custom roads: editable width, waypoints, smoothing tools.
 */

import { Route, Trash2, X, Minus } from "lucide-react";
import React, { useCallback, useMemo } from "react";

import type { WorldData } from "../../../WorldBuilder/types";
import { useWorldStudio } from "../../WorldStudioContext";
import { PropertySection, InfoRow, SliderInput } from "./PropertyControls";

interface Props {
  roadId: string;
  world: WorldData;
}

export const RoadProperties = React.memo(function RoadProperties({
  roadId,
  world,
}: Props) {
  const { actions } = useWorldStudio();

  // Check custom roads first, then generated roads
  const customRoad = world.layers.customRoads.find((r) => r.id === roadId);
  const generatedRoad = world.foundation.roads.find((r) => r.id === roadId);

  if (!customRoad && !generatedRoad) {
    return (
      <PropertySection title="Road">
        <InfoRow label="Status" value="Not found" />
      </PropertySection>
    );
  }

  // === CUSTOM ROAD (EDITABLE) ===
  if (customRoad) {
    return (
      <CustomRoadEditor
        road={customRoad}
        onUpdateWidth={(width) =>
          actions.updateCustomRoad(customRoad.id, { width })
        }
        onUpdateName={(name) =>
          actions.updateCustomRoad(customRoad.id, { name })
        }
        onRemoveWaypoint={(index) => {
          const newPath = customRoad.path.filter((_, i) => i !== index);
          actions.updateCustomRoad(customRoad.id, { path: newPath });
        }}
        onSmooth={() => {
          if (customRoad.path.length < 3) return;
          const smoothed = chaikinSmooth(customRoad.path, 2);
          actions.updateCustomRoad(customRoad.id, { path: smoothed });
        }}
        onStraighten={() => {
          if (customRoad.path.length < 3) return;
          // Keep first and last, interpolate rest
          const first = customRoad.path[0];
          const last = customRoad.path[customRoad.path.length - 1];
          const count = customRoad.path.length;
          const straightened = customRoad.path.map((pt, i) => ({
            x: first.x + ((last.x - first.x) * i) / (count - 1),
            y: pt.y,
            z: first.z + ((last.z - first.z) * i) / (count - 1),
          }));
          actions.updateCustomRoad(customRoad.id, { path: straightened });
        }}
        onDelete={() => actions.removeCustomRoad(customRoad.id)}
      />
    );
  }

  // === GENERATED ROAD (READ-ONLY) ===
  const road = generatedRoad!;
  const fromTown = world.foundation.towns.find(
    (t) => t.id === road.connectedTowns[0],
  );
  const toTown = world.foundation.towns.find(
    (t) => t.id === road.connectedTowns[1],
  );

  let pathLength = 0;
  for (let i = 1; i < road.path.length; i++) {
    const dx = road.path[i].x - road.path[i - 1].x;
    const dz = road.path[i].z - road.path[i - 1].z;
    pathLength += Math.sqrt(dx * dx + dz * dz);
  }

  return (
    <>
      <PropertySection title="Road" icon={<Route size={10} />}>
        <InfoRow label="ID" value={road.id} />
        <InfoRow
          label="From"
          value={fromTown ? fromTown.name : road.connectedTowns[0]}
        />
        <InfoRow
          label="To"
          value={toTown ? toTown.name : road.connectedTowns[1]}
        />
        <InfoRow label="Main Road" value={road.isMainRoad ? "Yes" : "No"} />
        <InfoRow label="Width" value={`${road.width}m`} />
        <InfoRow label="Waypoints" value={road.path.length} />
        <InfoRow label="Length" value={`~${Math.round(pathLength)}m`} />
      </PropertySection>

      <PropertySection title="Path Info" defaultOpen={false}>
        {road.path.length > 0 && (
          <>
            <InfoRow
              label="Start"
              value={`(${Math.round(road.path[0].x)}, ${Math.round(road.path[0].z)})`}
            />
            <InfoRow
              label="End"
              value={`(${Math.round(road.path[road.path.length - 1].x)}, ${Math.round(road.path[road.path.length - 1].z)})`}
            />
          </>
        )}
        <div className="text-[10px] text-text-tertiary italic pt-1">
          Generated road (read-only). Edit in Creation Mode.
        </div>
      </PropertySection>
    </>
  );
});

// ============== Custom Road Editor ==============

function CustomRoadEditor({
  road,
  onUpdateWidth,
  onUpdateName,
  onRemoveWaypoint,
  onSmooth,
  onStraighten,
  onDelete,
}: {
  road: {
    id: string;
    name: string;
    path: Array<{ x: number; y: number; z: number }>;
    width: number;
  };
  onUpdateWidth: (width: number) => void;
  onUpdateName: (name: string) => void;
  onRemoveWaypoint: (index: number) => void;
  onSmooth: () => void;
  onStraighten: () => void;
  onDelete: () => void;
}) {
  // Calculate path length
  const pathLength = useMemo(() => {
    let len = 0;
    for (let i = 1; i < road.path.length; i++) {
      const dx = road.path[i].x - road.path[i - 1].x;
      const dz = road.path[i].z - road.path[i - 1].z;
      len += Math.sqrt(dx * dx + dz * dz);
    }
    return len;
  }, [road.path]);

  return (
    <>
      <PropertySection title="Custom Road" icon={<Route size={10} />}>
        <div className="space-y-1.5">
          <div>
            <label className="text-[9px] text-text-tertiary block mb-0.5">
              Name
            </label>
            <input
              type="text"
              value={road.name}
              onChange={(e) => onUpdateName(e.target.value)}
              className="w-full px-1.5 py-1 rounded bg-bg-tertiary border border-border-primary text-[10px] text-text-primary focus:border-primary focus:outline-none"
            />
          </div>
          <SliderInput
            label="Width"
            value={road.width}
            onChange={onUpdateWidth}
            min={2}
            max={20}
            step={1}
            unit="m"
          />
          <InfoRow label="Waypoints" value={road.path.length} />
          <InfoRow label="Length" value={`~${Math.round(pathLength)}m`} />
        </div>
      </PropertySection>

      {/* Waypoint list */}
      <PropertySection
        title="Waypoints"
        badge={road.path.length}
        defaultOpen={road.path.length <= 20}
      >
        {road.path.length === 0 ? (
          <div className="text-[10px] text-amber-400/80 italic">
            No waypoints. Click terrain to add.
          </div>
        ) : (
          <div className="space-y-0.5 max-h-48 overflow-y-auto scrollbar-thin">
            {road.path.map((pt, index) => (
              <div
                key={`wp-${index}`}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-bg-tertiary/50 text-[10px] group"
              >
                <span className="text-text-tertiary w-4 text-right font-mono flex-shrink-0">
                  {index + 1}
                </span>
                <span className="flex-1 text-text-secondary font-mono truncate">
                  ({Math.round(pt.x)}, {Math.round(pt.z)})
                </span>
                <button
                  className="text-text-tertiary hover:text-red-400 transition-colors p-0.5 opacity-0 group-hover:opacity-100 ease-out"
                  onClick={() => onRemoveWaypoint(index)}
                  title="Remove waypoint"
                >
                  <X size={8} />
                </button>
              </div>
            ))}
          </div>
        )}
      </PropertySection>

      {/* Path tools */}
      {road.path.length >= 3 && (
        <PropertySection title="Path Tools">
          <div className="flex gap-1">
            <button
              className="flex-1 px-2 py-1 rounded bg-bg-tertiary hover:bg-bg-tertiary/80 text-text-secondary text-[10px] transition-colors ease-out"
              onClick={onSmooth}
              title="Apply Chaikin smoothing to the path"
            >
              Smooth
            </button>
            <button
              className="flex-1 px-2 py-1 rounded bg-bg-tertiary hover:bg-bg-tertiary/80 text-text-secondary text-[10px] transition-colors ease-out"
              onClick={onStraighten}
              title="Straighten path between start and end"
            >
              Straighten
            </button>
          </div>
        </PropertySection>
      )}

      {/* Delete */}
      <PropertySection title="Danger Zone" defaultOpen={false}>
        <button
          className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-medium transition-colors w-full justify-center ease-out"
          onClick={onDelete}
        >
          <Trash2 size={10} />
          Delete Road
        </button>
      </PropertySection>
    </>
  );
}

// ============== Path Smoothing ==============

/**
 * Chaikin corner-cutting smoothing algorithm.
 * Produces a smoother path by replacing each segment with two points at 25%/75%.
 */
function chaikinSmooth(
  path: Array<{ x: number; y: number; z: number }>,
  iterations: number,
): Array<{ x: number; y: number; z: number }> {
  let pts = path;
  for (let iter = 0; iter < iterations; iter++) {
    const result: Array<{ x: number; y: number; z: number }> = [];
    // Keep first point
    result.push(pts[0]);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      result.push({
        x: a.x * 0.75 + b.x * 0.25,
        y: a.y * 0.75 + b.y * 0.25,
        z: a.z * 0.75 + b.z * 0.25,
      });
      result.push({
        x: a.x * 0.25 + b.x * 0.75,
        y: a.y * 0.25 + b.y * 0.75,
        z: a.z * 0.25 + b.z * 0.75,
      });
    }
    // Keep last point
    result.push(pts[pts.length - 1]);
    pts = result;
  }
  return pts;
}
