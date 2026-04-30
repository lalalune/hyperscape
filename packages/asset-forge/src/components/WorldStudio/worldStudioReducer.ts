/**
 * World Studio reducer — studio-specific actions + composition of sub-reducers.
 *
 * Extracted from WorldStudioContext.tsx to reduce file size.
 * The main worldStudioReducer composes: entityReducer → zoneReducer → uiReducer →
 * studioReducer → worldBuilderReducer.
 */

import type {
  WorldStudioState,
  WorldStudioAction,
  StudioProjectState,
  StudioPersistenceState,
  GeneratedBuilding,
  GeneratedTown,
} from "./worldStudioTypes";

import {
  initialProjectState,
  initialPersistenceState,
} from "./worldStudioTypes";

import type { WorldBuilderAction } from "../WorldBuilder/types";
import { worldBuilderReducer } from "../WorldBuilder/WorldBuilderContext";

import { EMPTY_MANIFEST_DATA, EMPTY_MANIFEST_OVERRIDES } from "./types";

import type { GeneratedDialogue, GeneratedQuest } from "./types";

import { entityReducer } from "./reducers/entityReducer";
import { zoneReducer } from "./reducers/zoneReducer";
import { uiReducer } from "./reducers/uiReducer";

// ============== STUDIO REDUCER ==============

/** Handle studio-specific actions; returns null if action is not studio-specific */
function studioReducer(
  state: WorldStudioState,
  action: WorldStudioAction,
): WorldStudioState | null {
  switch (action.type) {
    // Project actions
    case "SET_PROJECT":
      return {
        ...state,
        project: {
          ...state.project,
          currentTeamId: action.teamId,
          currentGameId: action.gameId,
          currentProjectId: action.projectId,
          projectName: action.name,
          projectVersion: action.version,
          gameMode: action.gameMode,
          templateId: action.templateId,
          plugins: action.plugins,
          assetPacks: action.assetPacks,
        },
      };

    case "CLEAR_PROJECT":
      return {
        ...state,
        project: initialProjectState,
        persistence: initialPersistenceState,
      };

    case "SET_PROJECT_LOCK":
      return {
        ...state,
        project: {
          ...state.project,
          lockedBy: action.lockedBy,
        },
      };

    case "UPDATE_PROJECT_VERSION":
      return {
        ...state,
        project: {
          ...state.project,
          projectVersion: action.version,
        },
      };

    case "SET_GAME_MODE":
      return {
        ...state,
        project: {
          ...state.project,
          gameMode: action.gameMode,
        },
      };

    // Persistence actions
    case "SAVE_START":
      return {
        ...state,
        persistence: {
          ...state.persistence,
          isSaving: true,
          saveError: null,
        },
      };

    case "SAVE_SUCCESS":
      return {
        ...state,
        project: {
          ...state.project,
          projectVersion: action.version,
        },
        persistence: {
          ...state.persistence,
          isSaving: false,
          lastSavedAt: action.savedAt,
          saveError: null,
        },
        // Mark builder state as saved
        builder: {
          ...state.builder,
          editing: {
            ...state.builder.editing,
            hasUnsavedChanges: false,
            saveError: null,
          },
        },
      };

    case "SAVE_ERROR":
      return {
        ...state,
        persistence: {
          ...state.persistence,
          isSaving: false,
          saveError: action.error,
        },
      };

    case "LOAD_START":
      return {
        ...state,
        persistence: {
          ...state.persistence,
          isLoading: true,
          loadError: null,
        },
      };

    case "LOAD_SUCCESS":
      return {
        ...state,
        persistence: {
          ...state.persistence,
          isLoading: false,
          loadError: null,
        },
      };

    case "LOAD_ERROR":
      return {
        ...state,
        persistence: {
          ...state.persistence,
          isLoading: false,
          loadError: action.error,
        },
      };

    case "SET_AUTO_SAVE":
      return {
        ...state,
        persistence: {
          ...state.persistence,
          autoSaveEnabled: action.enabled,
        },
      };

    // Town unification — merge runtime-generated towns into foundation
    case "SYNC_RUNTIME_TOWNS": {
      const world = state.builder.editing.world;
      if (!world) return state;

      const existingIds = new Set(world.foundation.towns.map((t) => t.id));
      const incomingIds = new Set(action.towns.map((t) => t.id));

      // Convert ALL incoming buildings (both new and existing towns)
      const incomingBuildings: GeneratedBuilding[] = [];
      for (const rt of action.towns) {
        if (rt.buildings) {
          for (const b of rt.buildings) {
            const typeName =
              b.type.charAt(0).toUpperCase() +
              b.type.slice(1).replace(/-/g, " ");
            incomingBuildings.push({
              id: b.id,
              type: b.type,
              name: typeName,
              position: { x: b.position.x, y: b.position.y, z: b.position.z },
              rotation: b.rotation,
              townId: rt.id,
              dimensions: {
                width: b.size.width,
                depth: b.size.depth,
                floors: 1,
              },
            });
          }
        }
      }

      // Update existing towns (position, radius, buildingIds) and add new ones
      const updatedTowns = world.foundation.towns.map((existing) => {
        const runtime = action.towns.find((rt) => rt.id === existing.id);
        if (!runtime) return existing;
        return {
          ...existing,
          name: runtime.name,
          size: runtime.size,
          position: {
            x: runtime.position.x,
            y: runtime.position.y,
            z: runtime.position.z,
          },
          safeZoneRadius: runtime.safeZoneRadius,
          buildingIds: (runtime.buildings ?? []).map((b) => b.id),
        };
      });

      const newTowns = action.towns
        .filter((rt) => !existingIds.has(rt.id))
        .map(
          (rt): GeneratedTown => ({
            id: rt.id,
            name: rt.name,
            size: rt.size,
            position: { x: rt.position.x, y: rt.position.y, z: rt.position.z },
            layoutType: "terminus",
            buildingIds: (rt.buildings ?? []).map((b) => b.id),
            entryPoints: [],
            biomeId: rt.biomeId ?? "unknown",
            safeZoneRadius: rt.safeZoneRadius,
          }),
        );

      // Replace buildings for incoming towns, keep buildings for unaffected towns
      const keptBuildings = world.foundation.buildings.filter(
        (b) => !incomingIds.has(b.townId),
      );

      return {
        ...state,
        builder: {
          ...state.builder,
          editing: {
            ...state.builder.editing,
            world: {
              ...world,
              foundation: {
                ...world.foundation,
                towns: [...updatedTowns, ...newTowns],
                buildings: [...keptBuildings, ...incomingBuildings],
              },
            },
          },
        },
      };
    }

    case "MOVE_TOWN": {
      const world = state.builder.editing.world;
      if (!world) return state;

      // Compute delta so entry points and buildings shift with the town
      const oldTown = world.foundation.towns.find(
        (t) => t.id === action.townId,
      );
      if (!oldTown) return state;
      const dx = action.position.x - oldTown.position.x;
      const dy = action.position.y - oldTown.position.y;
      const dz = action.position.z - oldTown.position.z;

      const movedTowns = world.foundation.towns.map((t) => {
        if (t.id !== action.townId) return t;
        return {
          ...t,
          position: { ...action.position },
          // Shift entry/exit points by the same delta so roads connect correctly
          entryPoints: t.entryPoints.map((ep) => ({
            ...ep,
            position: ep.position
              ? {
                  x: ep.position.x + dx,
                  y: ep.position.y + dy,
                  z: ep.position.z + dz,
                }
              : ep.position,
          })),
        };
      });

      // Shift buildings that belong to this town
      const movedBuildings = world.foundation.buildings.map((b) => {
        if (b.townId !== action.townId) return b;
        return {
          ...b,
          position: {
            x: b.position.x + dx,
            y: b.position.y + dy,
            z: b.position.z + dz,
          },
        };
      });

      return {
        ...state,
        builder: {
          ...state.builder,
          editing: {
            ...state.builder.editing,
            world: {
              ...world,
              foundation: {
                ...world.foundation,
                towns: movedTowns,
                buildings: movedBuildings,
              },
            },
          },
        },
      };
    }

    case "SET_FOUNDATION_ROADS": {
      const world = state.builder.editing.world;
      if (!world) return state;
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: {
            ...state.builder.editing,
            world: {
              ...world,
              foundation: { ...world.foundation, roads: action.roads },
            },
          },
        },
      };
    }

    case "ADD_CUSTOM_ROAD": {
      const world = state.builder.editing.world;
      if (!world) return state;
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: {
            ...state.builder.editing,
            hasUnsavedChanges: true,
            world: {
              ...world,
              layers: {
                ...world.layers,
                customRoads: [...world.layers.customRoads, action.road],
              },
            },
          },
        },
      };
    }

    case "UPDATE_CUSTOM_ROAD": {
      const world = state.builder.editing.world;
      if (!world) return state;
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: {
            ...state.builder.editing,
            hasUnsavedChanges: true,
            world: {
              ...world,
              layers: {
                ...world.layers,
                customRoads: world.layers.customRoads.map((r) =>
                  r.id === action.roadId ? { ...r, ...action.updates } : r,
                ),
              },
            },
          },
        },
      };
    }

    case "REMOVE_CUSTOM_ROAD": {
      const world = state.builder.editing.world;
      if (!world) return state;
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: {
            ...state.builder.editing,
            hasUnsavedChanges: true,
            world: {
              ...world,
              layers: {
                ...world.layers,
                customRoads: world.layers.customRoads.filter(
                  (r) => r.id !== action.roadId,
                ),
              },
            },
          },
        },
      };
    }

    case "SET_FOUNDATION_TOWNS": {
      const world = state.builder.editing.world;
      if (!world) return state;
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: {
            ...state.builder.editing,
            hasUnsavedChanges: true,
            world: {
              ...world,
              foundation: {
                ...world.foundation,
                towns: action.towns,
                buildings: action.buildings,
              },
            },
          },
        },
      };
    }

    case "SET_FOUNDATION_CONFIG": {
      const world = state.builder.editing.world;
      if (!world) return state;
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: {
            ...state.builder.editing,
            hasUnsavedChanges: true,
            world: {
              ...world,
              foundation: {
                ...world.foundation,
                config: action.config,
              },
            },
          },
        },
      };
    }

    // Manifest loading
    case "MANIFESTS_LOAD_START":
      return {
        ...state,
        manifests: {
          ...state.manifests,
          loading: true,
          error: null,
        },
      };

    case "MANIFESTS_LOAD_SUCCESS":
      return {
        ...state,
        manifests: {
          ...EMPTY_MANIFEST_DATA,
          ...action.data,
          loaded: true,
          loading: false,
          error: null,
        },
      };

    case "MANIFESTS_LOAD_ERROR":
      return {
        ...state,
        manifests: {
          ...state.manifests,
          loading: false,
          error: action.error,
        },
      };

    // Manifest editing — update raw manifest in local state
    // All MANIFEST_UPDATE_* cases set hasUnsavedChanges so the save indicator triggers.
    case "MANIFEST_UPDATE_RAW":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        manifests: {
          ...state.manifests,
          rawManifests: {
            ...state.manifests.rawManifests,
            [action.name]: action.content,
          },
        },
      };

    case "MANIFEST_UPDATE_ITEMS":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        manifests: { ...state.manifests, items: action.items },
      };

    case "MANIFEST_UPDATE_QUESTS":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        manifests: { ...state.manifests, quests: action.quests },
      };

    case "MANIFEST_UPDATE_STORES":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        manifests: { ...state.manifests, stores: action.stores },
      };
    case "MANIFEST_UPDATE_NPCS":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        manifests: { ...state.manifests, npcs: action.npcs },
      };
    case "MANIFEST_UPDATE_COMBAT_SPELLS":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        manifests: { ...state.manifests, combatSpells: action.combatSpells },
      };
    case "MANIFEST_UPDATE_PRAYERS":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        manifests: { ...state.manifests, prayers: action.prayers },
      };
    case "MANIFEST_UPDATE_RECIPES":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        manifests: { ...state.manifests, recipes: action.recipes },
      };
    case "MANIFEST_UPDATE_AMMUNITION":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        manifests: { ...state.manifests, ammunition: action.ammunition },
      };
    case "MANIFEST_UPDATE_RUNES":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        manifests: { ...state.manifests, runes: action.runes },
      };
    case "MANIFEST_UPDATE_SKILL_UNLOCKS":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        manifests: { ...state.manifests, skillUnlocks: action.skillUnlocks },
      };
    case "MANIFEST_UPDATE_TIER_REQUIREMENTS":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        manifests: {
          ...state.manifests,
          tierRequirements: action.tierRequirements,
        },
      };
    case "MANIFEST_UPDATE_DUEL_ARENAS":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        manifests: { ...state.manifests, duelArenas: action.duelArenas },
      };
    case "MANIFEST_UPDATE_STATIONS":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        manifests: { ...state.manifests, stations: action.stations },
      };
    case "MANIFEST_UPDATE_TREES":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        manifests: { ...state.manifests, trees: action.trees },
      };
    case "MANIFEST_UPDATE_FISHING_SPOTS":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        manifests: {
          ...state.manifests,
          fishingSpots: action.fishingSpots,
        },
      };
    case "MANIFEST_UPDATE_MINING_ROCKS":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        manifests: {
          ...state.manifests,
          miningRocks: action.miningRocks,
        },
      };

    // Phase 7: Audio zone CRUD — all set hasUnsavedChanges for save indicator
    case "ADD_MUSIC_ZONE":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        audioLayers: {
          ...state.audioLayers,
          musicZones: [...state.audioLayers.musicZones, action.zone],
        },
      };
    case "UPDATE_MUSIC_ZONE":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        audioLayers: {
          ...state.audioLayers,
          musicZones: state.audioLayers.musicZones.map((z) =>
            z.id === action.id ? { ...z, ...action.updates } : z,
          ),
        },
      };
    case "REMOVE_MUSIC_ZONE":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        audioLayers: {
          ...state.audioLayers,
          musicZones: state.audioLayers.musicZones.filter(
            (z) => z.id !== action.id,
          ),
        },
      };
    case "ADD_AMBIENT_ZONE":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        audioLayers: {
          ...state.audioLayers,
          ambientZones: [...state.audioLayers.ambientZones, action.zone],
        },
      };
    case "UPDATE_AMBIENT_ZONE":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        audioLayers: {
          ...state.audioLayers,
          ambientZones: state.audioLayers.ambientZones.map((z) =>
            z.id === action.id ? { ...z, ...action.updates } : z,
          ),
        },
      };
    case "REMOVE_AMBIENT_ZONE":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        audioLayers: {
          ...state.audioLayers,
          ambientZones: state.audioLayers.ambientZones.filter(
            (z) => z.id !== action.id,
          ),
        },
      };
    case "ADD_SFX_TRIGGER":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        audioLayers: {
          ...state.audioLayers,
          sfxTriggers: [...state.audioLayers.sfxTriggers, action.trigger],
        },
      };
    case "UPDATE_SFX_TRIGGER":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        audioLayers: {
          ...state.audioLayers,
          sfxTriggers: state.audioLayers.sfxTriggers.map((t) =>
            t.id === action.id ? { ...t, ...action.updates } : t,
          ),
        },
      };
    case "REMOVE_SFX_TRIGGER":
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        audioLayers: {
          ...state.audioLayers,
          sfxTriggers: state.audioLayers.sfxTriggers.filter(
            (t) => t.id !== action.id,
          ),
        },
      };

    // Phase 7: AI generation state tracking
    case "AI_GENERATION_START": {
      const gen = {
        ...state.aiGeneration,
        status: "generating" as const,
        activeEntityId: action.entityId,
        error: null,
      };
      if (action.generationType === "dialogue") {
        gen.dialogues = [
          ...gen.dialogues.filter((d) => d.npcId !== action.entityId),
          { npcId: action.entityId, status: "generating" as const },
        ];
      } else if (action.generationType === "quest") {
        gen.quests = [...gen.quests, { status: "generating" as const }];
      }
      return { ...state, aiGeneration: gen };
    }
    case "AI_GENERATION_COMPLETE": {
      const gen = {
        ...state.aiGeneration,
        status: "idle" as const,
        activeEntityId: null,
      };
      if (action.generationType === "dialogue") {
        gen.dialogues = gen.dialogues.map((d) =>
          d.npcId === action.entityId
            ? {
                ...d,
                status: "reviewing" as const,
                nodes: (action.result as { nodes: GeneratedDialogue["nodes"] })
                  .nodes,
              }
            : d,
        );
      } else if (action.generationType === "voice") {
        gen.voiceClips = gen.voiceClips.map((v) =>
          v.npcId === action.entityId && v.status === "generating"
            ? {
                ...v,
                status: "reviewing" as const,
                audioUrl: (action.result as { audioUrl: string }).audioUrl,
              }
            : v,
        );
      } else if (action.generationType === "quest") {
        gen.quests = gen.quests.map((q) =>
          q.status === "generating"
            ? {
                ...q,
                status: "reviewing" as const,
                quest: action.result as GeneratedQuest["quest"],
              }
            : q,
        );
      }
      return { ...state, aiGeneration: gen };
    }
    case "AI_GENERATION_ERROR": {
      const gen = {
        ...state.aiGeneration,
        status: "error" as const,
        error: action.error,
      };
      if (action.generationType === "dialogue") {
        gen.dialogues = gen.dialogues.map((d) =>
          d.npcId === action.entityId
            ? { ...d, status: "rejected" as const, error: action.error }
            : d,
        );
      } else if (action.generationType === "voice") {
        gen.voiceClips = gen.voiceClips.map((v) =>
          v.npcId === action.entityId && v.status === "generating"
            ? { ...v, status: "rejected" as const }
            : v,
        );
      } else if (action.generationType === "quest") {
        gen.quests = gen.quests.map((q) =>
          q.status === "generating"
            ? { ...q, status: "rejected" as const, error: action.error }
            : q,
        );
      }
      return { ...state, aiGeneration: gen };
    }
    case "AI_GENERATION_ACCEPT": {
      const gen = { ...state.aiGeneration };
      if (action.generationType === "dialogue") {
        gen.dialogues = gen.dialogues.map((d) =>
          d.npcId === action.entityId
            ? { ...d, status: "accepted" as const }
            : d,
        );
      } else if (action.generationType === "voice") {
        gen.voiceClips = gen.voiceClips.map((v) =>
          v.npcId === action.entityId && v.status === "reviewing"
            ? { ...v, status: "accepted" as const }
            : v,
        );
      } else if (action.generationType === "quest") {
        gen.quests = gen.quests.map((q) =>
          q.status === "reviewing" ? { ...q, status: "accepted" as const } : q,
        );
      }
      return { ...state, aiGeneration: gen };
    }
    case "AI_GENERATION_REJECT": {
      const gen = { ...state.aiGeneration };
      if (action.generationType === "dialogue") {
        gen.dialogues = gen.dialogues.map((d) =>
          d.npcId === action.entityId
            ? { ...d, status: "rejected" as const }
            : d,
        );
      } else if (action.generationType === "voice") {
        gen.voiceClips = gen.voiceClips.map((v) =>
          v.npcId === action.entityId && v.status === "reviewing"
            ? { ...v, status: "rejected" as const }
            : v,
        );
      } else if (action.generationType === "quest") {
        gen.quests = gen.quests.map((q) =>
          q.status === "reviewing" ? { ...q, status: "rejected" as const } : q,
        );
      }
      return { ...state, aiGeneration: gen };
    }

    // Phase 8: Deployment pipeline
    case "DEPLOY_STAGING_START":
      return {
        ...state,
        deployment: {
          ...state.deployment,
          stagingStatus: "compiling",
          error: null,
        },
      };
    case "DEPLOY_STAGING_STATUS":
      return {
        ...state,
        deployment: {
          ...state.deployment,
          stagingStatus: action.status,
          error: action.error ?? state.deployment.error,
        },
      };
    case "DEPLOY_STAGING_COMPLETE":
      return {
        ...state,
        deployment: {
          ...state.deployment,
          stagingStatus: "success",
          history: [action.record, ...state.deployment.history],
        },
      };
    case "DEPLOY_PRODUCTION_START":
      return {
        ...state,
        deployment: {
          ...state.deployment,
          productionStatus: "deploying",
          error: null,
        },
      };
    case "DEPLOY_PRODUCTION_STATUS":
      return {
        ...state,
        deployment: {
          ...state.deployment,
          productionStatus: action.status,
          error: action.error ?? state.deployment.error,
        },
      };
    case "DEPLOY_PRODUCTION_COMPLETE":
      return {
        ...state,
        deployment: {
          ...state.deployment,
          productionStatus: "success",
          pendingPromotion: null,
          history: [action.record, ...state.deployment.history],
        },
      };
    case "DEPLOY_DIFF_START":
      return {
        ...state,
        deployment: {
          ...state.deployment,
          isComputingDiff: true,
          currentDiff: null,
        },
      };
    case "DEPLOY_DIFF_COMPLETE":
      return {
        ...state,
        deployment: {
          ...state.deployment,
          isComputingDiff: false,
          currentDiff: action.diff,
        },
      };
    case "DEPLOY_HISTORY_LOAD":
      return {
        ...state,
        deployment: { ...state.deployment, history: action.history },
      };
    case "DEPLOY_ROLLBACK":
      return {
        ...state,
        deployment: {
          ...state.deployment,
          history: state.deployment.history.map((r) =>
            r.id === action.deploymentId
              ? { ...r, status: "rolled-back" as const }
              : r,
          ),
        },
      };
    case "DEPLOY_PROMOTION_REQUEST":
      return {
        ...state,
        deployment: {
          ...state.deployment,
          productionStatus: "pending-approval",
          pendingPromotion: {
            id: action.id,
            requestedBy: action.requestedBy,
            requestedAt: new Date().toISOString(),
            diff: action.diff,
          },
        },
      };
    case "DEPLOY_PROMOTION_APPROVE":
      return {
        ...state,
        deployment: {
          ...state.deployment,
          productionStatus: "deploying",
          pendingPromotion: null,
        },
      };
    case "DEPLOY_PROMOTION_REJECT":
      return {
        ...state,
        deployment: {
          ...state.deployment,
          productionStatus: "idle",
          pendingPromotion: null,
        },
      };

    case "SET_MANIFEST_OVERRIDE": {
      const mapClone = new Map(state.manifestOverrides[action.overrideType]);
      const existing = mapClone.get(action.entityId) ?? {};
      mapClone.set(action.entityId, {
        ...existing,
        ...action.data,
        entityId: action.entityId,
      } as never);
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        manifestOverrides: {
          ...state.manifestOverrides,
          [action.overrideType]: mapClone,
        },
      };
    }

    case "CLEAR_MANIFEST_OVERRIDE": {
      const mapClone = new Map(state.manifestOverrides[action.overrideType]);
      mapClone.delete(action.entityId);
      return {
        ...state,
        builder: {
          ...state.builder,
          editing: { ...state.builder.editing, hasUnsavedChanges: true },
        },
        manifestOverrides: {
          ...state.manifestOverrides,
          [action.overrideType]: mapClone,
        },
      };
    }

    case "LOAD_MANIFEST_OVERRIDES":
      return { ...state, manifestOverrides: action.overrides };

    case "CLEAR_ALL_MANIFEST_OVERRIDES":
      return { ...state, manifestOverrides: EMPTY_MANIFEST_OVERRIDES };

    // Live terrain config for real-time slider updates
    case "SET_LIVE_TERRAIN_CONFIG":
      return { ...state, liveTerrainConfig: action.config };

    case "CLEAR_LIVE_TERRAIN_CONFIG":
      return { ...state, liveTerrainConfig: null };

    default:
      return null; // Not a studio-specific action
  }
}

// ============== COMBINED REDUCER ==============

/** Combined reducer: sub-reducers first, then studio-specific, then world builder */
export function worldStudioReducer(
  state: WorldStudioState,
  action: WorldStudioAction,
): WorldStudioState {
  // Try extracted sub-reducers first
  const entityResult = entityReducer(state, action);
  if (entityResult !== null) return entityResult;

  const zoneResult = zoneReducer(state, action);
  if (zoneResult !== null) return zoneResult;

  const uiResult = uiReducer(state, action);
  if (uiResult !== null) return uiResult;

  // Try remaining studio-specific actions
  const studioResult = studioReducer(state, action);
  if (studioResult !== null) {
    return studioResult;
  }

  // Delegate to world builder reducer for all WB actions
  const newBuilder = worldBuilderReducer(
    state.builder,
    action as WorldBuilderAction,
  );
  if (newBuilder !== state.builder) {
    return { ...state, builder: newBuilder };
  }

  return state;
}
