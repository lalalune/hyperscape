/**
 * World Builder Context
 *
 * Provides state management for the two-phase world authoring system.
 * Uses React Context with a reducer pattern for predictable state updates.
 */

import type {
  TerrainNoiseConfig,
  BiomeConfig,
  IslandConfig,
} from "@hyperforge/procgen/terrain";
import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

import type {
  WorldBuilderState,
  WorldBuilderAction,
  WorldBuilderMode,
  WorldCreationConfig,
  WorldData,
  Selection,
  SelectionMode,
  HoverInfo,
  CameraMode,
  ViewportOverlays,
  BiomeOverride,
  TownOverride,
  PlacedNPC,
  PlacedQuest,
  PlacedBoss,
  PlacedEvent,
  PlacedLore,
  DifficultyZone,
  CustomPlacement,
  CreationModeState,
  HierarchyNode,
} from "./types";
import { DEFAULT_CREATION_CONFIG, DEFAULT_VIEWPORT_OVERLAYS } from "./types";

// ============== INITIAL STATE ==============

const initialCreationState: CreationModeState = {
  config: DEFAULT_CREATION_CONFIG,
  selectedPreset: "large-island",
  hasPreview: false,
  isGenerating: false,
  generationError: null,
  previewStats: null,
};

const initialState: WorldBuilderState = {
  mode: "creation",
  creation: initialCreationState,
  editing: {
    world: null,
    selection: null,
    hoveredElement: null,
    selectionMode: "auto",
    expandedNodes: new Set(["world", "biomes", "towns", "layers"]),
    hasUnsavedChanges: false,
    saveError: null,
  },
  viewport: {
    cameraMode: "orbit",
    cameraHeight: 1.7,
    moveSpeed: 10,
    overlays: DEFAULT_VIEWPORT_OVERLAYS,
  },
  history: {
    past: [],
    future: [],
    maxSize: 50,
  },
};

// ============== REDUCER ==============

// Actions that should be tracked in history (undoable)
const UNDOABLE_ACTIONS = new Set([
  "ADD_BIOME_OVERRIDE",
  "UPDATE_BIOME_OVERRIDE",
  "REMOVE_BIOME_OVERRIDE",
  "ADD_TOWN_OVERRIDE",
  "UPDATE_TOWN_OVERRIDE",
  "REMOVE_TOWN_OVERRIDE",
  "ADD_NPC",
  "UPDATE_NPC",
  "REMOVE_NPC",
  "ADD_QUEST",
  "UPDATE_QUEST",
  "REMOVE_QUEST",
  "ADD_BOSS",
  "UPDATE_BOSS",
  "REMOVE_BOSS",
  "ADD_EVENT",
  "UPDATE_EVENT",
  "REMOVE_EVENT",
  "ADD_LORE",
  "UPDATE_LORE",
  "REMOVE_LORE",
  "ADD_DIFFICULTY_ZONE",
  "UPDATE_DIFFICULTY_ZONE",
  "REMOVE_DIFFICULTY_ZONE",
  "ADD_CUSTOM_PLACEMENT",
  "UPDATE_CUSTOM_PLACEMENT",
  "REMOVE_CUSTOM_PLACEMENT",
]);

function coreReducer(
  state: WorldBuilderState,
  action: WorldBuilderAction,
): WorldBuilderState {
  switch (action.type) {
    // Mode actions
    case "SET_MODE":
      return { ...state, mode: action.mode };

    // Creation actions
    case "SET_PRESET":
      return {
        ...state,
        creation: {
          ...state.creation,
          selectedPreset: action.presetId,
          hasPreview: false,
        },
      };

    case "UPDATE_CREATION_CONFIG":
      return {
        ...state,
        creation: {
          ...state.creation,
          config: { ...state.creation.config, ...action.config },
          hasPreview: false,
        },
      };

    case "UPDATE_TERRAIN_CONFIG":
      return {
        ...state,
        creation: {
          ...state.creation,
          config: {
            ...state.creation.config,
            terrain: { ...state.creation.config.terrain, ...action.config },
          },
          hasPreview: false,
        },
      };

    case "UPDATE_NOISE_CONFIG":
      return {
        ...state,
        creation: {
          ...state.creation,
          config: {
            ...state.creation.config,
            noise: { ...state.creation.config.noise, ...action.config },
          },
          hasPreview: false,
        },
      };

    case "UPDATE_BIOME_CONFIG":
      return {
        ...state,
        creation: {
          ...state.creation,
          config: {
            ...state.creation.config,
            biomes: { ...state.creation.config.biomes, ...action.config },
          },
          hasPreview: false,
        },
      };

    case "UPDATE_ISLAND_CONFIG":
      return {
        ...state,
        creation: {
          ...state.creation,
          config: {
            ...state.creation.config,
            island: { ...state.creation.config.island, ...action.config },
          },
          hasPreview: false,
        },
      };

    case "UPDATE_TOWN_CONFIG":
      return {
        ...state,
        creation: {
          ...state.creation,
          config: {
            ...state.creation.config,
            towns: { ...state.creation.config.towns, ...action.config },
          },
          hasPreview: false,
        },
      };

    case "UPDATE_ROAD_CONFIG":
      return {
        ...state,
        creation: {
          ...state.creation,
          config: {
            ...state.creation.config,
            roads: { ...state.creation.config.roads, ...action.config },
          },
          hasPreview: false,
        },
      };

    case "SET_SEED":
      return {
        ...state,
        creation: {
          ...state.creation,
          config: { ...state.creation.config, seed: action.seed },
          hasPreview: false,
        },
      };

    case "RANDOMIZE_SEED":
      return {
        ...state,
        creation: {
          ...state.creation,
          config: {
            ...state.creation.config,
            seed: Math.floor(Math.random() * 1000000),
          },
          hasPreview: false,
        },
      };

    case "GENERATE_PREVIEW_START":
      return {
        ...state,
        creation: {
          ...state.creation,
          isGenerating: true,
          generationError: null,
        },
      };

    case "GENERATE_PREVIEW_SUCCESS":
      return {
        ...state,
        creation: {
          ...state.creation,
          isGenerating: false,
          hasPreview: true,
          previewStats: action.stats,
        },
      };

    case "GENERATE_PREVIEW_ERROR":
      return {
        ...state,
        creation: {
          ...state.creation,
          isGenerating: false,
          generationError: action.error,
        },
      };

    case "APPLY_AND_LOCK":
      return {
        ...state,
        mode: "editing",
        editing: {
          ...state.editing,
          world: action.world,
          hasUnsavedChanges: true,
        },
      };

    // Editing actions
    case "LOAD_WORLD":
      return {
        ...state,
        mode: "editing",
        editing: {
          ...state.editing,
          world: action.world,
          selection: null,
          hasUnsavedChanges: false,
        },
      };

    case "UNLOAD_WORLD":
      return {
        ...state,
        editing: {
          ...state.editing,
          world: null,
          selection: null,
          hoveredElement: null,
          hasUnsavedChanges: false,
        },
      };

    case "SET_SELECTION":
      return {
        ...state,
        editing: {
          ...state.editing,
          selection: action.selection,
        },
      };

    case "SET_HOVERED":
      return {
        ...state,
        editing: {
          ...state.editing,
          hoveredElement: action.info,
        },
      };

    case "SET_SELECTION_MODE":
      return {
        ...state,
        editing: {
          ...state.editing,
          selectionMode: action.mode,
        },
      };

    case "TOGGLE_NODE_EXPANDED": {
      const newExpanded = new Set(state.editing.expandedNodes);
      if (newExpanded.has(action.nodeId)) {
        newExpanded.delete(action.nodeId);
      } else {
        newExpanded.add(action.nodeId);
      }
      return {
        ...state,
        editing: {
          ...state.editing,
          expandedNodes: newExpanded,
        },
      };
    }

    case "EXPAND_NODE": {
      const newExpanded = new Set(state.editing.expandedNodes);
      newExpanded.add(action.nodeId);
      return {
        ...state,
        editing: {
          ...state.editing,
          expandedNodes: newExpanded,
        },
      };
    }

    case "COLLAPSE_NODE": {
      const newExpanded = new Set(state.editing.expandedNodes);
      newExpanded.delete(action.nodeId);
      return {
        ...state,
        editing: {
          ...state.editing,
          expandedNodes: newExpanded,
        },
      };
    }

    // Layer editing actions
    case "ADD_BIOME_OVERRIDE": {
      if (!state.editing.world) return state;
      const newOverrides = new Map(state.editing.world.layers.biomeOverrides);
      newOverrides.set(action.override.biomeId, action.override);
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              biomeOverrides: newOverrides,
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "UPDATE_BIOME_OVERRIDE": {
      if (!state.editing.world) return state;
      const existing = state.editing.world.layers.biomeOverrides.get(
        action.biomeId,
      );
      if (!existing) return state;
      const newOverrides = new Map(state.editing.world.layers.biomeOverrides);
      newOverrides.set(action.biomeId, { ...existing, ...action.override });
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              biomeOverrides: newOverrides,
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "REMOVE_BIOME_OVERRIDE": {
      if (!state.editing.world) return state;
      const newOverrides = new Map(state.editing.world.layers.biomeOverrides);
      newOverrides.delete(action.biomeId);
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              biomeOverrides: newOverrides,
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "ADD_TOWN_OVERRIDE": {
      if (!state.editing.world) return state;
      const newOverrides = new Map(state.editing.world.layers.townOverrides);
      newOverrides.set(action.override.townId, action.override);
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              townOverrides: newOverrides,
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "UPDATE_TOWN_OVERRIDE": {
      if (!state.editing.world) return state;
      const existing = state.editing.world.layers.townOverrides.get(
        action.townId,
      );
      if (!existing) return state;
      const newOverrides = new Map(state.editing.world.layers.townOverrides);
      newOverrides.set(action.townId, { ...existing, ...action.override });
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              townOverrides: newOverrides,
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "REMOVE_TOWN_OVERRIDE": {
      if (!state.editing.world) return state;
      const newOverrides = new Map(state.editing.world.layers.townOverrides);
      newOverrides.delete(action.townId);
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              townOverrides: newOverrides,
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "ADD_NPC": {
      if (!state.editing.world) return state;
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              npcs: [...state.editing.world.layers.npcs, action.npc],
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "UPDATE_NPC": {
      if (!state.editing.world) return state;
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              npcs: state.editing.world.layers.npcs.map((npc) =>
                npc.id === action.npcId ? { ...npc, ...action.updates } : npc,
              ),
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "REMOVE_NPC": {
      if (!state.editing.world) return state;
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              npcs: state.editing.world.layers.npcs.filter(
                (npc) => npc.id !== action.npcId,
              ),
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "ADD_QUEST": {
      if (!state.editing.world) return state;
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              quests: [...state.editing.world.layers.quests, action.quest],
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "UPDATE_QUEST": {
      if (!state.editing.world) return state;
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              quests: state.editing.world.layers.quests.map((quest) =>
                quest.id === action.questId
                  ? { ...quest, ...action.updates }
                  : quest,
              ),
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "REMOVE_QUEST": {
      if (!state.editing.world) return state;
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              quests: state.editing.world.layers.quests.filter(
                (quest) => quest.id !== action.questId,
              ),
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "ADD_BOSS": {
      if (!state.editing.world) return state;
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              bosses: [...state.editing.world.layers.bosses, action.boss],
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "UPDATE_BOSS": {
      if (!state.editing.world) return state;
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              bosses: state.editing.world.layers.bosses.map((boss) =>
                boss.id === action.bossId
                  ? { ...boss, ...action.updates }
                  : boss,
              ),
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "REMOVE_BOSS": {
      if (!state.editing.world) return state;
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              bosses: state.editing.world.layers.bosses.filter(
                (boss) => boss.id !== action.bossId,
              ),
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "ADD_EVENT": {
      if (!state.editing.world) return state;
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              events: [...state.editing.world.layers.events, action.event],
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "UPDATE_EVENT": {
      if (!state.editing.world) return state;
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              events: state.editing.world.layers.events.map((event) =>
                event.id === action.eventId
                  ? { ...event, ...action.updates }
                  : event,
              ),
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "REMOVE_EVENT": {
      if (!state.editing.world) return state;
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              events: state.editing.world.layers.events.filter(
                (event) => event.id !== action.eventId,
              ),
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "ADD_LORE": {
      if (!state.editing.world) return state;
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              lore: [...state.editing.world.layers.lore, action.lore],
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "UPDATE_LORE": {
      if (!state.editing.world) return state;
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              lore: state.editing.world.layers.lore.map((lore) =>
                lore.id === action.loreId
                  ? { ...lore, ...action.updates }
                  : lore,
              ),
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "REMOVE_LORE": {
      if (!state.editing.world) return state;
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              lore: state.editing.world.layers.lore.filter(
                (lore) => lore.id !== action.loreId,
              ),
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "ADD_DIFFICULTY_ZONE": {
      if (!state.editing.world) return state;
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              difficultyZones: [
                ...state.editing.world.layers.difficultyZones,
                action.zone,
              ],
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "UPDATE_DIFFICULTY_ZONE": {
      if (!state.editing.world) return state;
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              difficultyZones: state.editing.world.layers.difficultyZones.map(
                (zone) =>
                  zone.id === action.zoneId
                    ? { ...zone, ...action.updates }
                    : zone,
              ),
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "REMOVE_DIFFICULTY_ZONE": {
      if (!state.editing.world) return state;
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              difficultyZones:
                state.editing.world.layers.difficultyZones.filter(
                  (zone) => zone.id !== action.zoneId,
                ),
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "ADD_CUSTOM_PLACEMENT": {
      if (!state.editing.world) return state;
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              customPlacements: [
                ...state.editing.world.layers.customPlacements,
                action.placement,
              ],
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "UPDATE_CUSTOM_PLACEMENT": {
      if (!state.editing.world) return state;
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              customPlacements: state.editing.world.layers.customPlacements.map(
                (placement) =>
                  placement.id === action.placementId
                    ? { ...placement, ...action.updates }
                    : placement,
              ),
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "REMOVE_CUSTOM_PLACEMENT": {
      if (!state.editing.world) return state;
      return {
        ...state,
        editing: {
          ...state.editing,
          world: {
            ...state.editing.world,
            layers: {
              ...state.editing.world.layers,
              customPlacements:
                state.editing.world.layers.customPlacements.filter(
                  (placement) => placement.id !== action.placementId,
                ),
            },
            modifiedAt: Date.now(),
          },
          hasUnsavedChanges: true,
        },
      };
    }

    case "MARK_SAVED":
      return {
        ...state,
        editing: {
          ...state.editing,
          hasUnsavedChanges: false,
          saveError: null,
        },
      };

    case "SET_SAVE_ERROR":
      return {
        ...state,
        editing: {
          ...state.editing,
          saveError: action.error,
        },
      };

    // Viewport actions
    case "SET_CAMERA_MODE":
      return {
        ...state,
        viewport: {
          ...state.viewport,
          cameraMode: action.mode,
        },
      };

    case "SET_CAMERA_HEIGHT":
      return {
        ...state,
        viewport: {
          ...state.viewport,
          cameraHeight: action.height,
        },
      };

    case "SET_MOVE_SPEED":
      return {
        ...state,
        viewport: {
          ...state.viewport,
          moveSpeed: action.speed,
        },
      };

    case "TOGGLE_OVERLAY": {
      return {
        ...state,
        viewport: {
          ...state.viewport,
          overlays: {
            ...state.viewport.overlays,
            [action.overlay]: !state.viewport.overlays[action.overlay],
          },
        },
      };
    }

    case "SET_OVERLAYS":
      return {
        ...state,
        viewport: {
          ...state.viewport,
          overlays: { ...state.viewport.overlays, ...action.overlays },
        },
      };

    // History actions (undo/redo)
    case "UNDO": {
      if (state.history.past.length === 0) return state;

      const past = [...state.history.past];
      const previousEntry = past.pop()!;

      // Current state becomes future
      const currentEntry = {
        timestamp: Date.now(),
        description: "Current state",
        editingState: state.editing,
      };

      return {
        ...state,
        editing: previousEntry.editingState,
        history: {
          ...state.history,
          past,
          future: [currentEntry, ...state.history.future].slice(
            0,
            state.history.maxSize,
          ),
        },
      };
    }

    case "REDO": {
      if (state.history.future.length === 0) return state;

      const future = [...state.history.future];
      const nextEntry = future.shift()!;

      // Current state becomes past
      const currentEntry = {
        timestamp: Date.now(),
        description: "Current state",
        editingState: state.editing,
      };

      return {
        ...state,
        editing: nextEntry.editingState,
        history: {
          ...state.history,
          past: [...state.history.past, currentEntry].slice(
            -state.history.maxSize,
          ),
          future,
        },
      };
    }

    case "CLEAR_HISTORY":
      return {
        ...state,
        history: {
          ...state.history,
          past: [],
          future: [],
        },
      };

    default:
      return state;
  }
}

// Wrapper reducer that handles history tracking for undoable actions
function worldBuilderReducer(
  state: WorldBuilderState,
  action: WorldBuilderAction,
): WorldBuilderState {
  // Skip history for undo/redo/clear actions (they manage history directly)
  if (
    action.type === "UNDO" ||
    action.type === "REDO" ||
    action.type === "CLEAR_HISTORY"
  ) {
    return coreReducer(state, action);
  }

  // For undoable actions, push current state to history before applying
  if (UNDOABLE_ACTIONS.has(action.type) && state.editing.world) {
    const historyEntry = {
      timestamp: Date.now(),
      description: action.type,
      editingState: state.editing,
    };

    const newState = coreReducer(state, action);

    // Only track history if the state actually changed
    if (newState.editing !== state.editing) {
      return {
        ...newState,
        history: {
          ...newState.history,
          past: [...state.history.past, historyEntry].slice(
            -state.history.maxSize,
          ),
          future: [], // Clear redo stack on new action
        },
      };
    }

    return newState;
  }

  // Non-undoable actions pass through directly
  return coreReducer(state, action);
}

// ============== CONTEXT ==============

interface WorldBuilderContextValue {
  state: WorldBuilderState;
  dispatch: React.Dispatch<WorldBuilderAction>;

  // Convenience action creators
  actions: {
    // Mode
    setMode: (mode: WorldBuilderMode) => void;
    switchToCreation: () => void;
    switchToEditing: () => void;

    // Creation
    setPreset: (presetId: string | null) => void;
    updateCreationConfig: (config: Partial<WorldCreationConfig>) => void;
    updateTerrainConfig: (
      config: Partial<WorldCreationConfig["terrain"]>,
    ) => void;
    updateNoiseConfig: (config: Partial<TerrainNoiseConfig>) => void;
    updateBiomeConfig: (config: Partial<BiomeConfig>) => void;
    updateIslandConfig: (config: Partial<IslandConfig>) => void;
    updateTownConfig: (config: Partial<WorldCreationConfig["towns"]>) => void;
    updateRoadConfig: (config: Partial<WorldCreationConfig["roads"]>) => void;
    setSeed: (seed: number) => void;
    randomizeSeed: () => void;
    startGeneration: () => void;
    finishGeneration: (stats: CreationModeState["previewStats"]) => void;
    failGeneration: (error: string) => void;
    applyAndLock: (world: WorldData) => void;

    // Editing
    loadWorld: (world: WorldData) => void;
    unloadWorld: () => void;
    setSelection: (selection: Selection | null) => void;
    setHovered: (info: HoverInfo | null) => void;
    setSelectionMode: (mode: SelectionMode) => void;
    toggleNodeExpanded: (nodeId: string) => void;
    expandNode: (nodeId: string) => void;
    collapseNode: (nodeId: string) => void;

    // Layer editing
    addBiomeOverride: (override: BiomeOverride) => void;
    updateBiomeOverride: (
      biomeId: string,
      override: Partial<BiomeOverride>,
    ) => void;
    removeBiomeOverride: (biomeId: string) => void;
    addTownOverride: (override: TownOverride) => void;
    updateTownOverride: (
      townId: string,
      override: Partial<TownOverride>,
    ) => void;
    removeTownOverride: (townId: string) => void;
    addNPC: (npc: PlacedNPC) => void;
    updateNPC: (npcId: string, updates: Partial<PlacedNPC>) => void;
    removeNPC: (npcId: string) => void;
    addQuest: (quest: PlacedQuest) => void;
    updateQuest: (questId: string, updates: Partial<PlacedQuest>) => void;
    removeQuest: (questId: string) => void;
    addBoss: (boss: PlacedBoss) => void;
    updateBoss: (bossId: string, updates: Partial<PlacedBoss>) => void;
    removeBoss: (bossId: string) => void;
    addEvent: (event: PlacedEvent) => void;
    updateEvent: (eventId: string, updates: Partial<PlacedEvent>) => void;
    removeEvent: (eventId: string) => void;
    addLore: (lore: PlacedLore) => void;
    updateLore: (loreId: string, updates: Partial<PlacedLore>) => void;
    removeLore: (loreId: string) => void;
    addDifficultyZone: (zone: DifficultyZone) => void;
    updateDifficultyZone: (
      zoneId: string,
      updates: Partial<DifficultyZone>,
    ) => void;
    removeDifficultyZone: (zoneId: string) => void;
    addCustomPlacement: (placement: CustomPlacement) => void;
    updateCustomPlacement: (
      placementId: string,
      updates: Partial<CustomPlacement>,
    ) => void;
    removeCustomPlacement: (placementId: string) => void;
    markSaved: () => void;
    setSaveError: (error: string | null) => void;

    // Viewport
    setCameraMode: (mode: CameraMode) => void;
    setCameraHeight: (height: number) => void;
    setMoveSpeed: (speed: number) => void;
    toggleOverlay: (overlay: keyof ViewportOverlays) => void;
    setOverlays: (overlays: Partial<ViewportOverlays>) => void;

    // History (undo/redo)
    undo: () => void;
    redo: () => void;
    clearHistory: () => void;
  };

  // Computed values
  computed: {
    /** Whether we're in creation mode */
    isCreationMode: boolean;
    /** Whether we're in editing mode */
    isEditingMode: boolean;
    /** Whether a world is currently loaded */
    hasLoadedWorld: boolean;
    /** Whether the creation config has been modified from preset */
    isConfigModified: boolean;
    /** Get the hierarchy tree for the current world */
    getHierarchyTree: () => HierarchyNode | null;
    /** Whether undo is available */
    canUndo: boolean;
    /** Whether redo is available */
    canRedo: boolean;
    /** Number of undo steps available */
    undoCount: number;
    /** Number of redo steps available */
    redoCount: number;
  };
}

const WorldBuilderContext = createContext<WorldBuilderContextValue | null>(
  null,
);

// ============== PROVIDER ==============

interface WorldBuilderProviderProps {
  children: ReactNode;
  initialState?: Partial<WorldBuilderState>;
}

export function WorldBuilderProvider({
  children,
  initialState: customInitialState,
}: WorldBuilderProviderProps) {
  const mergedInitialState = customInitialState
    ? { ...initialState, ...customInitialState }
    : initialState;

  const [state, dispatch] = useReducer(worldBuilderReducer, mergedInitialState);

  // Memoized action creators
  const actions = useMemo(
    () => ({
      // Mode
      setMode: (mode: WorldBuilderMode) => dispatch({ type: "SET_MODE", mode }),
      switchToCreation: () => dispatch({ type: "SET_MODE", mode: "creation" }),
      switchToEditing: () => dispatch({ type: "SET_MODE", mode: "editing" }),

      // Creation
      setPreset: (presetId: string | null) =>
        dispatch({ type: "SET_PRESET", presetId }),
      updateCreationConfig: (config: Partial<WorldCreationConfig>) =>
        dispatch({ type: "UPDATE_CREATION_CONFIG", config }),
      updateTerrainConfig: (config: Partial<WorldCreationConfig["terrain"]>) =>
        dispatch({ type: "UPDATE_TERRAIN_CONFIG", config }),
      updateNoiseConfig: (config: Partial<TerrainNoiseConfig>) =>
        dispatch({ type: "UPDATE_NOISE_CONFIG", config }),
      updateBiomeConfig: (config: Partial<BiomeConfig>) =>
        dispatch({ type: "UPDATE_BIOME_CONFIG", config }),
      updateIslandConfig: (config: Partial<IslandConfig>) =>
        dispatch({ type: "UPDATE_ISLAND_CONFIG", config }),
      updateTownConfig: (config: Partial<WorldCreationConfig["towns"]>) =>
        dispatch({ type: "UPDATE_TOWN_CONFIG", config }),
      updateRoadConfig: (config: Partial<WorldCreationConfig["roads"]>) =>
        dispatch({ type: "UPDATE_ROAD_CONFIG", config }),
      setSeed: (seed: number) => dispatch({ type: "SET_SEED", seed }),
      randomizeSeed: () => dispatch({ type: "RANDOMIZE_SEED" }),
      startGeneration: () => dispatch({ type: "GENERATE_PREVIEW_START" }),
      finishGeneration: (stats: CreationModeState["previewStats"]) =>
        dispatch({ type: "GENERATE_PREVIEW_SUCCESS", stats }),
      failGeneration: (error: string) =>
        dispatch({ type: "GENERATE_PREVIEW_ERROR", error }),
      applyAndLock: (world: WorldData) =>
        dispatch({ type: "APPLY_AND_LOCK", world }),

      // Editing
      loadWorld: (world: WorldData) => dispatch({ type: "LOAD_WORLD", world }),
      unloadWorld: () => dispatch({ type: "UNLOAD_WORLD" }),
      setSelection: (selection: Selection | null) =>
        dispatch({ type: "SET_SELECTION", selection }),
      setHovered: (info: HoverInfo | null) =>
        dispatch({ type: "SET_HOVERED", info }),
      setSelectionMode: (mode: SelectionMode) =>
        dispatch({ type: "SET_SELECTION_MODE", mode }),
      toggleNodeExpanded: (nodeId: string) =>
        dispatch({ type: "TOGGLE_NODE_EXPANDED", nodeId }),
      expandNode: (nodeId: string) => dispatch({ type: "EXPAND_NODE", nodeId }),
      collapseNode: (nodeId: string) =>
        dispatch({ type: "COLLAPSE_NODE", nodeId }),

      // Layer editing
      addBiomeOverride: (override: BiomeOverride) =>
        dispatch({ type: "ADD_BIOME_OVERRIDE", override }),
      updateBiomeOverride: (
        biomeId: string,
        override: Partial<BiomeOverride>,
      ) => dispatch({ type: "UPDATE_BIOME_OVERRIDE", biomeId, override }),
      removeBiomeOverride: (biomeId: string) =>
        dispatch({ type: "REMOVE_BIOME_OVERRIDE", biomeId }),
      addTownOverride: (override: TownOverride) =>
        dispatch({ type: "ADD_TOWN_OVERRIDE", override }),
      updateTownOverride: (townId: string, override: Partial<TownOverride>) =>
        dispatch({ type: "UPDATE_TOWN_OVERRIDE", townId, override }),
      removeTownOverride: (townId: string) =>
        dispatch({ type: "REMOVE_TOWN_OVERRIDE", townId }),
      addNPC: (npc: PlacedNPC) => dispatch({ type: "ADD_NPC", npc }),
      updateNPC: (npcId: string, updates: Partial<PlacedNPC>) =>
        dispatch({ type: "UPDATE_NPC", npcId, updates }),
      removeNPC: (npcId: string) => dispatch({ type: "REMOVE_NPC", npcId }),
      addQuest: (quest: PlacedQuest) => dispatch({ type: "ADD_QUEST", quest }),
      updateQuest: (questId: string, updates: Partial<PlacedQuest>) =>
        dispatch({ type: "UPDATE_QUEST", questId, updates }),
      removeQuest: (questId: string) =>
        dispatch({ type: "REMOVE_QUEST", questId }),
      addBoss: (boss: PlacedBoss) => dispatch({ type: "ADD_BOSS", boss }),
      updateBoss: (bossId: string, updates: Partial<PlacedBoss>) =>
        dispatch({ type: "UPDATE_BOSS", bossId, updates }),
      removeBoss: (bossId: string) => dispatch({ type: "REMOVE_BOSS", bossId }),
      addEvent: (event: PlacedEvent) => dispatch({ type: "ADD_EVENT", event }),
      updateEvent: (eventId: string, updates: Partial<PlacedEvent>) =>
        dispatch({ type: "UPDATE_EVENT", eventId, updates }),
      removeEvent: (eventId: string) =>
        dispatch({ type: "REMOVE_EVENT", eventId }),
      addLore: (lore: PlacedLore) => dispatch({ type: "ADD_LORE", lore }),
      updateLore: (loreId: string, updates: Partial<PlacedLore>) =>
        dispatch({ type: "UPDATE_LORE", loreId, updates }),
      removeLore: (loreId: string) => dispatch({ type: "REMOVE_LORE", loreId }),
      addDifficultyZone: (zone: DifficultyZone) =>
        dispatch({ type: "ADD_DIFFICULTY_ZONE", zone }),
      updateDifficultyZone: (
        zoneId: string,
        updates: Partial<DifficultyZone>,
      ) => dispatch({ type: "UPDATE_DIFFICULTY_ZONE", zoneId, updates }),
      removeDifficultyZone: (zoneId: string) =>
        dispatch({ type: "REMOVE_DIFFICULTY_ZONE", zoneId }),
      addCustomPlacement: (placement: CustomPlacement) =>
        dispatch({ type: "ADD_CUSTOM_PLACEMENT", placement }),
      updateCustomPlacement: (
        placementId: string,
        updates: Partial<CustomPlacement>,
      ) => dispatch({ type: "UPDATE_CUSTOM_PLACEMENT", placementId, updates }),
      removeCustomPlacement: (placementId: string) =>
        dispatch({ type: "REMOVE_CUSTOM_PLACEMENT", placementId }),
      markSaved: () => dispatch({ type: "MARK_SAVED" }),
      setSaveError: (error: string | null) =>
        dispatch({ type: "SET_SAVE_ERROR", error }),

      // Viewport
      setCameraMode: (mode: CameraMode) =>
        dispatch({ type: "SET_CAMERA_MODE", mode }),
      setCameraHeight: (height: number) =>
        dispatch({ type: "SET_CAMERA_HEIGHT", height }),
      setMoveSpeed: (speed: number) =>
        dispatch({ type: "SET_MOVE_SPEED", speed }),
      toggleOverlay: (overlay: keyof ViewportOverlays) =>
        dispatch({ type: "TOGGLE_OVERLAY", overlay }),
      setOverlays: (overlays: Partial<ViewportOverlays>) =>
        dispatch({ type: "SET_OVERLAYS", overlays }),

      // History (undo/redo)
      undo: () => dispatch({ type: "UNDO" }),
      redo: () => dispatch({ type: "REDO" }),
      clearHistory: () => dispatch({ type: "CLEAR_HISTORY" }),
    }),
    [],
  );

  // Build hierarchy tree from world data
  const getHierarchyTree = useCallback((): HierarchyNode | null => {
    const world = state.editing.world;
    if (!world) return null;

    const foundation = world.foundation;
    const layers = world.layers;

    // Build biome children
    const biomeChildren: HierarchyNode[] = foundation.biomes.map((biome) => {
      const override = layers.biomeOverrides.get(biome.id);
      const displayType = override?.typeOverride || biome.type;
      return {
        id: `biome-${biome.id}`,
        label: `${displayType.charAt(0).toUpperCase() + displayType.slice(1)} (${biome.tileKeys.length} tiles)`,
        type: "biome",
        children: [],
        dataId: biome.id,
        expandable: false,
        metadata: { biomeType: displayType, tileCount: biome.tileKeys.length },
      };
    });

    // Build town children
    const townChildren: HierarchyNode[] = foundation.towns.map((town) => {
      const override = layers.townOverrides.get(town.id);
      const displayName = override?.nameOverride || town.name;

      // Building children for this town
      const buildingChildren: HierarchyNode[] = foundation.buildings
        .filter((b) => b.townId === town.id)
        .map((building) => ({
          id: `building-${building.id}`,
          label: building.name,
          type: "building" as const,
          children: [],
          dataId: building.id,
          expandable: false,
          metadata: { buildingType: building.type },
        }));

      // NPCs in this town
      const townNpcs = layers.npcs.filter(
        (npc) =>
          npc.parentContext.type === "town" &&
          npc.parentContext.townId === town.id,
      );
      const npcChildren: HierarchyNode[] = townNpcs.map((npc) => ({
        id: `npc-${npc.id}`,
        label: npc.name,
        type: "npc" as const,
        children: [],
        dataId: npc.id,
        expandable: false,
        metadata: { npcType: npc.npcTypeId },
      }));

      return {
        id: `town-${town.id}`,
        label: `${displayName} (${town.size})`,
        type: "town" as const,
        children: [
          ...buildingChildren,
          ...(npcChildren.length > 0
            ? [
                {
                  id: `town-${town.id}-npcs`,
                  label: "NPCs",
                  type: "npcs" as const,
                  children: npcChildren,
                  expandable: true,
                  badge: npcChildren.length,
                },
              ]
            : []),
        ],
        dataId: town.id,
        badge: buildingChildren.length,
        expandable: buildingChildren.length > 0 || npcChildren.length > 0,
        metadata: { townSize: town.size, layoutType: town.layoutType },
      };
    });

    // Build layers children
    const worldNpcs = layers.npcs.filter(
      (npc) => npc.parentContext.type === "world",
    );
    const layersChildren: HierarchyNode[] = [
      {
        id: "layer-npcs",
        label: "NPCs",
        type: "npcs",
        children: worldNpcs.map((npc) => ({
          id: `npc-${npc.id}`,
          label: npc.name,
          type: "npc" as const,
          children: [],
          dataId: npc.id,
          expandable: false,
        })),
        badge: layers.npcs.length,
        expandable: layers.npcs.length > 0,
      },
      {
        id: "layer-quests",
        label: "Quests",
        type: "quests",
        children: layers.quests.map((quest) => ({
          id: `quest-${quest.id}`,
          label: quest.name,
          type: "quest" as const,
          children: [],
          dataId: quest.id,
          expandable: false,
        })),
        badge: layers.quests.length,
        expandable: layers.quests.length > 0,
      },
      {
        id: "layer-bosses",
        label: "Bosses",
        type: "bosses",
        children: layers.bosses.map((boss) => ({
          id: `boss-${boss.id}`,
          label: boss.name,
          type: "boss" as const,
          children: [],
          dataId: boss.id,
          expandable: false,
        })),
        badge: layers.bosses.length,
        expandable: layers.bosses.length > 0,
      },
      {
        id: "layer-events",
        label: "Events",
        type: "events",
        children: layers.events.map((event) => ({
          id: `event-${event.id}`,
          label: event.name,
          type: "event" as const,
          children: [],
          dataId: event.id,
          expandable: false,
        })),
        badge: layers.events.length,
        expandable: layers.events.length > 0,
      },
      {
        id: "layer-lore",
        label: "Lore",
        type: "loreEntries",
        children: layers.lore.map((lore) => ({
          id: `lore-${lore.id}`,
          label: lore.title,
          type: "lore" as const,
          children: [],
          dataId: lore.id,
          expandable: false,
          metadata: { category: lore.category },
        })),
        badge: layers.lore.length,
        expandable: layers.lore.length > 0,
      },
      {
        id: "layer-difficulty-zones",
        label: "Difficulty Zones",
        type: "difficultyZones",
        children: layers.difficultyZones.map((zone) => ({
          id: `zone-${zone.id}`,
          label: zone.name,
          type: "difficultyZone" as const,
          children: [],
          dataId: zone.id,
          expandable: false,
          metadata: { difficultyLevel: zone.difficultyLevel },
        })),
        badge: layers.difficultyZones.length,
        expandable: layers.difficultyZones.length > 0,
      },
      {
        id: "layer-custom-placements",
        label: "Custom Placements",
        type: "customPlacements",
        children: layers.customPlacements.map((placement) => ({
          id: `placement-${placement.id}`,
          label: `${placement.objectType} @ (${Math.round(placement.position.x)}, ${Math.round(placement.position.z)})`,
          type: "customPlacement" as const,
          children: [],
          dataId: placement.id,
          expandable: false,
          metadata: { objectType: placement.objectType },
        })),
        badge: layers.customPlacements.length,
        expandable: layers.customPlacements.length > 0,
      },
    ];

    // Build terrain chunks (group tiles into 10x10 chunks)
    const worldSize = foundation.config.terrain.worldSize;
    const chunksPerSide = Math.ceil(worldSize / 10);
    const chunkChildren: HierarchyNode[] = [];

    for (let cx = 0; cx < chunksPerSide; cx++) {
      for (let cz = 0; cz < chunksPerSide; cz++) {
        const chunkId = `chunk-${cx}-${cz}`;
        const tilesInChunk =
          Math.min(10, worldSize - cx * 10) * Math.min(10, worldSize - cz * 10);
        chunkChildren.push({
          id: chunkId,
          label: `Chunk (${cx}, ${cz})`,
          type: "chunk",
          children: [],
          dataId: chunkId,
          expandable: false,
          badge: tilesInChunk,
          metadata: { chunkX: cx, chunkZ: cz, tileCount: tilesInChunk },
        });
      }
    }

    // Build road children
    const roadChildren: HierarchyNode[] = foundation.roads.map((road, idx) => ({
      id: `road-${road.id || idx}`,
      label: `Road ${road.connectedTowns[0]} → ${road.connectedTowns[1]}`,
      type: "road" as const,
      children: [],
      dataId: road.id || `road-${idx}`,
      expandable: false,
      metadata: {
        fromTown: road.connectedTowns[0],
        toTown: road.connectedTowns[1],
        length: road.path.length,
        isMainRoad: road.isMainRoad,
      },
    }));

    // Root node
    return {
      id: "world",
      label: world.name,
      type: "world",
      children: [
        // Foundation (locked after creation)
        {
          id: "terrain",
          label: "Terrain",
          type: "terrain",
          children: [
            {
              id: "chunks",
              label: "Chunks",
              type: "chunks",
              children: chunkChildren,
              badge: chunkChildren.length,
              expandable: chunkChildren.length > 0,
            },
          ],
          badge: worldSize * worldSize,
          expandable: true,
          metadata: {
            worldSize,
            tileSize: foundation.config.terrain.tileSize,
            totalTiles: worldSize * worldSize,
          },
        },
        {
          id: "biomes",
          label: "Biomes",
          type: "biomes",
          children: biomeChildren,
          badge: biomeChildren.length,
          expandable: biomeChildren.length > 0,
        },
        {
          id: "towns",
          label: "Towns",
          type: "towns",
          children: townChildren,
          badge: townChildren.length,
          expandable: townChildren.length > 0,
        },
        {
          id: "roads",
          label: "Roads",
          type: "roads",
          children: roadChildren,
          badge: roadChildren.length,
          expandable: roadChildren.length > 0,
        },
        // Layers (editable)
        {
          id: "layers",
          label: "Layers",
          type: "layers",
          children: layersChildren,
          expandable: true,
        },
      ],
      expandable: true,
    };
  }, [state.editing.world]);

  // Computed values
  const computed = useMemo(
    () => ({
      isCreationMode: state.mode === "creation",
      isEditingMode: state.mode === "editing",
      hasLoadedWorld: state.editing.world !== null,
      isConfigModified: state.creation.selectedPreset === null,
      getHierarchyTree,
      canUndo: state.history.past.length > 0,
      canRedo: state.history.future.length > 0,
      undoCount: state.history.past.length,
      redoCount: state.history.future.length,
    }),
    [
      state.mode,
      state.editing.world,
      state.creation.selectedPreset,
      getHierarchyTree,
      state.history.past.length,
      state.history.future.length,
    ],
  );

  const contextValue = useMemo(
    () => ({ state, dispatch, actions, computed }),
    [state, actions, computed],
  );

  return (
    <WorldBuilderContext.Provider value={contextValue}>
      {children}
    </WorldBuilderContext.Provider>
  );
}

// ============== HOOK ==============

export function useWorldBuilder(): WorldBuilderContextValue {
  const context = useContext(WorldBuilderContext);
  if (!context) {
    throw new Error(
      "useWorldBuilder must be used within a WorldBuilderProvider",
    );
  }
  return context;
}

// ============== SELECTOR HOOKS ==============

/**
 * Select specific state from the world builder
 */
export function useWorldBuilderSelector<T>(
  selector: (state: WorldBuilderState) => T,
): T {
  const { state } = useWorldBuilder();
  return selector(state);
}

/**
 * Get the current mode
 */
export function useWorldBuilderMode(): WorldBuilderMode {
  return useWorldBuilderSelector((state) => state.mode);
}

/**
 * Get the creation state
 */
export function useCreationState(): CreationModeState {
  return useWorldBuilderSelector((state) => state.creation);
}

/**
 * Get the editing state
 */
export function useEditingState() {
  return useWorldBuilderSelector((state) => state.editing);
}

/**
 * Get the viewport state
 */
export function useViewportState() {
  return useWorldBuilderSelector((state) => state.viewport);
}

/**
 * Get the current world data (or null)
 */
export function useCurrentWorld(): WorldData | null {
  return useWorldBuilderSelector((state) => state.editing.world);
}

/**
 * Get the current selection (or null)
 */
export function useSelection(): Selection | null {
  return useWorldBuilderSelector((state) => state.editing.selection);
}

export default WorldBuilderContext;
