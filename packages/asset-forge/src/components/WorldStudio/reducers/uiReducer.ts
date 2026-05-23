/**
 * UI/Tool/Viewport sub-reducer — handles tool switching, placement workflow,
 * camera teleport, transform gizmo, brush tool, viewport overlays, and
 * wizard preview.
 *
 * Extracted from WorldStudioContext.tsx to reduce file size.
 * Covers actions related to: tools, placement, camera, transform mode/space,
 * brush settings & strokes, viewport overlays, and wizard preview.
 */

import type { WorldStudioState, WorldStudioAction } from "../worldStudioTypes";
import { EMPTY_BRUSH_OVERLAYS } from "../types";
import { assertNever } from "../../../utils/assertNever";

/** Handle UI/tool/viewport actions. Returns the new state, or null if unhandled. */
export function uiReducer(
  state: WorldStudioState,
  action: WorldStudioAction,
): WorldStudioState | null {
  switch (action.type) {
    // Tool actions
    case "SET_TOOL": {
      const newTools = {
        ...state.tools,
        activeTool: action.tool,
        // Clear active placement when switching away from place tool
        activePlacement:
          action.tool !== "place" ? null : state.tools.activePlacement,
      };

      // Auto-stop zone paint when switching AWAY from zonePaint tool
      if (action.tool !== "zonePaint" && state.tools.zonePaint) {
        newTools.zonePaint = null;
      }

      // Auto-start zone paint when switching TO zonePaint tool
      if (action.tool === "zonePaint" && !state.tools.zonePaint) {
        // Pick the selected region, or the first region, or null
        const selectedRegionId =
          state.builder.editing.selection?.type === "region"
            ? state.builder.editing.selection.id
            : null;
        const targetRegion =
          selectedRegionId ??
          (state.extendedLayers.regions.length > 0
            ? state.extendedLayers.regions[0].id
            : null);
        if (targetRegion) {
          newTools.zonePaint = {
            regionId: targetRegion,
            brushSize: 1,
            cursorTile: null,
            mode: "paint",
          };
        }
      }

      return { ...state, tools: newTools };
    }

    case "SET_TRANSFORM_MODE":
      return {
        ...state,
        tools: { ...state.tools, transformMode: action.mode },
      };
    case "SET_TRANSFORM_SPACE":
      return {
        ...state,
        tools: { ...state.tools, transformSpace: action.space },
      };

    case "SET_GRID_SIZE":
      return {
        ...state,
        tools: { ...state.tools, gridSize: action.size },
      };

    case "SET_ADDING_WATER_VERTICES":
      return {
        ...state,
        tools: { ...state.tools, isAddingWaterVertices: action.enabled },
      };

    case "CAMERA_TELEPORT":
      return {
        ...state,
        tools: { ...state.tools, cameraTeleportTarget: action.target },
      };
    case "CAMERA_TELEPORT_CONSUMED":
      return {
        ...state,
        tools: { ...state.tools, cameraTeleportTarget: null },
      };

    // Placement actions
    case "START_PLACEMENT":
      return {
        ...state,
        tools: {
          ...state.tools,
          activeTool: "place",
          activePlacement: {
            category: action.category,
            templateId: action.templateId,
            templateName: action.templateName,
            entityTypeId: action.entityTypeId,
            position: { x: 0, y: 0, z: 0 },
            rotation: 0,
            confirmed: false,
          },
        },
      };

    case "UPDATE_PLACEMENT_POSITION":
      if (!state.tools.activePlacement) return state;
      return {
        ...state,
        tools: {
          ...state.tools,
          activePlacement: {
            ...state.tools.activePlacement,
            position: action.position,
            rotation: action.rotation ?? state.tools.activePlacement.rotation,
          },
        },
      };

    case "CONFIRM_PLACEMENT":
      if (!state.tools.activePlacement) return state;
      return {
        ...state,
        tools: {
          ...state.tools,
          activePlacement: {
            ...state.tools.activePlacement,
            confirmed: true,
          },
        },
      };

    case "CANCEL_PLACEMENT":
      return {
        ...state,
        tools: {
          ...state.tools,
          activeTool: "select",
          activePlacement: null,
        },
      };

    // Brush tool actions
    case "SET_BRUSH_SETTINGS":
      return {
        ...state,
        tools: {
          ...state.tools,
          brushSettings: { ...state.tools.brushSettings, ...action.settings },
        },
      };

    case "ADD_TERRAIN_SCULPT":
      return {
        ...state,
        brushOverlays: {
          ...state.brushOverlays,
          terrainSculpts: [
            ...state.brushOverlays.terrainSculpts,
            action.stroke,
          ],
        },
      };

    case "ADD_BIOME_PAINT":
      return {
        ...state,
        brushOverlays: {
          ...state.brushOverlays,
          biomePaints: [...state.brushOverlays.biomePaints, action.stroke],
        },
      };

    case "ADD_VEGETATION_PAINT":
      return {
        ...state,
        brushOverlays: {
          ...state.brushOverlays,
          vegetationPaints: [
            ...state.brushOverlays.vegetationPaints,
            action.stroke,
          ],
        },
      };

    case "ADD_MATERIAL_PAINT":
      return {
        ...state,
        brushOverlays: {
          ...state.brushOverlays,
          materialPaints: [
            ...state.brushOverlays.materialPaints,
            action.stroke,
          ],
        },
      };

    case "ADD_FOLIAGE_PAINT":
      return {
        ...state,
        brushOverlays: {
          ...state.brushOverlays,
          foliagePaints: [...state.brushOverlays.foliagePaints, action.stroke],
        },
      };

    case "SET_TILE_COLLISION": {
      // Upsert tile collision overrides by (tileX, tileZ) key
      const existing = [...state.brushOverlays.tileCollisions];
      for (const tile of action.tiles) {
        const idx = existing.findIndex(
          (t) => t.tileX === tile.tileX && t.tileZ === tile.tileZ,
        );
        if (idx >= 0) {
          existing[idx] = { ...existing[idx], blocked: tile.blocked };
        } else {
          existing.push(tile);
        }
      }
      return {
        ...state,
        brushOverlays: { ...state.brushOverlays, tileCollisions: existing },
      };
    }

    case "UNDO_LAST_BRUSH_STROKE": {
      const overlays = { ...state.brushOverlays };
      const bt = action.brushType;
      switch (bt) {
        case "terrain":
          overlays.terrainSculpts = overlays.terrainSculpts.slice(0, -1);
          break;
        case "biome":
          overlays.biomePaints = overlays.biomePaints.slice(0, -1);
          break;
        case "vegetation":
          overlays.vegetationPaints = overlays.vegetationPaints.slice(0, -1);
          break;
        case "material":
          overlays.materialPaints = overlays.materialPaints.slice(0, -1);
          break;
        case "foliage":
          overlays.foliagePaints = overlays.foliagePaints.slice(0, -1);
          break;
        case "collision":
          // Remove last N tile collision entries (batch)
          overlays.tileCollisions = overlays.tileCollisions.slice(0, -1);
          break;
        default:
          assertNever(bt);
      }
      return { ...state, brushOverlays: overlays };
    }

    case "RESTORE_BRUSH_OVERLAYS":
      return {
        ...state,
        brushOverlays: {
          ...action.overlays,
          // Ensure new fields exist when loading old projects
          materialPaints: action.overlays.materialPaints ?? [],
          foliagePaints: action.overlays.foliagePaints ?? [],
        },
      };

    case "CLEAR_BRUSH_OVERLAYS": {
      if (action.brushType) {
        const cleared = { ...state.brushOverlays };
        const bt = action.brushType;
        switch (bt) {
          case "terrain":
            cleared.terrainSculpts = [];
            break;
          case "biome":
            cleared.biomePaints = [];
            break;
          case "vegetation":
            cleared.vegetationPaints = [];
            break;
          case "material":
            cleared.materialPaints = [];
            break;
          case "foliage":
            cleared.foliagePaints = [];
            break;
          case "collision":
            cleared.tileCollisions = [];
            break;
          default:
            assertNever(bt);
        }
        return { ...state, brushOverlays: cleared };
      }
      return { ...state, brushOverlays: EMPTY_BRUSH_OVERLAYS };
    }

    // Phase 9: Viewport overlays
    case "SET_OVERLAY":
      return {
        ...state,
        overlays: { ...state.overlays, ...action.overlay },
      };

    // Wizard preview overlay
    case "SET_WIZARD_PREVIEW":
      return { ...state, wizardPreview: action.preview };

    case "CLEAR_WIZARD_PREVIEW":
      return { ...state, wizardPreview: null };

    // Phase 4: Play-In-Editor
    case "PIE_START":
      return {
        ...state,
        pie: {
          ...state.pie,
          active: false,
          loading: true,
          error: null,
          paused: false,
        },
      };
    case "PIE_STARTED":
      return {
        ...state,
        pie: {
          ...state.pie,
          active: true,
          loading: false,
          error: null,
          paused: false,
        },
      };
    case "PIE_STOP":
      return {
        ...state,
        pie: {
          ...state.pie,
          active: false,
          loading: false,
          error: null,
          paused: false,
        },
      };
    case "PIE_ERROR":
      return {
        ...state,
        pie: {
          ...state.pie,
          active: false,
          loading: false,
          error: action.error,
        },
      };
    case "PIE_SET_MODE":
      // Only allowed while PIE is idle — switching mode mid-session would
      // require tearing down and re-attaching the controller stack.
      if (state.pie.active || state.pie.loading) return state;
      return { ...state, pie: { ...state.pie, mode: action.mode } };
    case "PIE_PAUSE":
      // No-op when PIE isn't running or is already paused. UE5 parity:
      // pause is only meaningful mid-session. Phase 1.3.a of
      // PLAN_AAA_UE5_PARITY.
      if (!state.pie.active || state.pie.paused) return state;
      return { ...state, pie: { ...state.pie, paused: true } };
    case "PIE_RESUME":
      if (!state.pie.paused) return state;
      return { ...state, pie: { ...state.pie, paused: false } };

    default:
      return null;
  }
}
