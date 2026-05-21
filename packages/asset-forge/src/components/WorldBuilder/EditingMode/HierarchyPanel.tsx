/**
 * HierarchyPanel
 *
 * Tree view panel for navigating world elements.
 * Shows biomes, towns, buildings, and authored layers.
 */

import {
  Plus,
  FolderOpen,
  ChevronDown,
  Wand2,
  Shield,
  Skull,
} from "lucide-react";
import React, { useCallback, useState } from "react";

import { useWorldBuilder } from "../WorldBuilderContext";
import { TreeView } from "../shared/TreeView";
import type { HierarchyNode, Selection, SelectionMode } from "../types";
import { generateDifficultyZones, generateBosses } from "../utils";

// ============== SELECTION MODE DROPDOWN ==============

const SELECTION_MODES: { id: SelectionMode; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "biome", label: "Biome" },
  { id: "tile", label: "Tile" },
  { id: "town", label: "Town" },
  { id: "building", label: "Building" },
  { id: "npc", label: "NPC" },
];

// ============== CONSTANTS ==============

// Node types that map directly to selection types
const SELECTABLE_NODE_TYPES = new Set<HierarchyNode["type"]>([
  "terrain",
  "chunk",
  "tile",
  "biome",
  "town",
  "building",
  "npc",
  "quest",
  "boss",
  "event",
  "lore",
  "difficultyZone",
  "customPlacement",
]);

// ============== MAIN COMPONENT ==============

interface HierarchyPanelProps {
  /** Optional callback when a layer add button is clicked */
  onAddLayer?: (
    layerType:
      | "npc"
      | "quest"
      | "boss"
      | "event"
      | "lore"
      | "difficultyZone"
      | "customPlacement",
  ) => void;
}

export const HierarchyPanel: React.FC<HierarchyPanelProps> = ({
  onAddLayer,
}) => {
  const { state, actions, computed } = useWorldBuilder();
  const { selection, selectionMode, expandedNodes, world } = state.editing;

  // Get hierarchy tree
  const hierarchyTree = computed.getHierarchyTree();

  // Handle node selection
  const handleSelect = useCallback(
    (node: HierarchyNode) => {
      const dataId = node.dataId || node.id;

      // Check if this is a selectable node type
      if (SELECTABLE_NODE_TYPES.has(node.type)) {
        const path = buildSelectionPath(hierarchyTree, node.id);
        actions.setSelection({
          type: node.type as Selection["type"],
          id: dataId,
          path,
        });
        return;
      }

      // For container nodes, just toggle expansion
      if (node.expandable) {
        actions.toggleNodeExpanded(node.id);
      }
    },
    [actions, hierarchyTree],
  );

  // Handle expand toggle
  const handleToggleExpand = useCallback(
    (nodeId: string) => {
      actions.toggleNodeExpanded(nodeId);
    },
    [actions],
  );

  // Handle selection mode change
  const handleSelectionModeChange = useCallback(
    (mode: SelectionMode) => {
      actions.setSelectionMode(mode);
    },
    [actions],
  );

  // Handle add layer button clicks - unified handler
  const handleAddLayer = useCallback(
    (type: Parameters<NonNullable<typeof onAddLayer>>[0]) => () =>
      onAddLayer?.(type),
    [onAddLayer],
  );

  // State for auto-generation
  const [isGenerating, setIsGenerating] = useState(false);

  // Handle auto-generate difficulty zones
  const handleAutoGenerateZones = useCallback(() => {
    if (!world) return;
    setIsGenerating(true);

    const worldSize = world.foundation.config.terrain.worldSize;
    const tileSize = world.foundation.config.terrain.tileSize;

    // Generate zones based on towns
    const zones = generateDifficultyZones(
      world.foundation.towns,
      worldSize,
      tileSize,
    );

    // Add each zone
    for (const zone of zones) {
      actions.addDifficultyZone(zone);
    }

    setIsGenerating(false);
  }, [world, actions]);

  // Handle auto-generate bosses
  const handleAutoGenerateBosses = useCallback(() => {
    if (!world) return;
    setIsGenerating(true);

    // Generate bosses based on world data
    const bosses = generateBosses(world, 10);

    // Add each boss
    for (const boss of bosses) {
      actions.addBoss(boss);
    }

    setIsGenerating(false);
  }, [world, actions]);

  // Get selected node ID for TreeView
  const selectedNodeId = selection ? `${selection.type}-${selection.id}` : null;

  if (!world) {
    return (
      <div className="flex flex-col h-full bg-bg-secondary">
        <div className="p-4 border-b border-border-primary">
          <h3 className="font-medium text-text-primary flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            Hierarchy
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <p className="text-sm text-text-muted text-center">
            No world loaded.
            <br />
            Create a new world or import an existing one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      {/* Header */}
      <div className="p-3 border-b border-border-primary">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-text-primary flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            Hierarchy
          </h3>
          <span className="text-xs text-text-muted">
            {world.foundation.biomes.length} biomes,{" "}
            {world.foundation.towns.length} towns
          </span>
        </div>

        {/* Selection Mode Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">Selection:</span>
          <div className="relative flex-1">
            <select
              value={selectionMode}
              onChange={(e) =>
                handleSelectionModeChange(e.target.value as SelectionMode)
              }
              className="w-full px-2 py-1 pr-8 bg-bg-tertiary border border-border-primary rounded text-xs text-text-primary appearance-none cursor-pointer"
            >
              {SELECTION_MODES.map((mode) => (
                <option key={mode.id} value={mode.id}>
                  {mode.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Tree View */}
      <TreeView
        root={hierarchyTree}
        selectedId={selectedNodeId}
        expandedIds={expandedNodes}
        onSelect={handleSelect}
        onToggleExpand={handleToggleExpand}
        showSearch
        searchPlaceholder="Search world..."
        className="flex-1"
      />

      {/* Auto-Generate Section */}
      <div className="p-2 border-t border-border-primary space-y-2">
        <p className="text-xs text-text-muted px-1 flex items-center gap-1">
          <Wand2 className="w-3 h-3" />
          Auto-Generate
        </p>
        <div className="flex gap-1">
          <button
            onClick={handleAutoGenerateZones}
            disabled={isGenerating || world.layers.difficultyZones.length > 0}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors ease-out"
            title={
              world.layers.difficultyZones.length > 0
                ? "Clear existing zones first"
                : "Generate difficulty zones based on towns"
            }
          >
            <Shield className="w-3 h-3" />
            Zones
          </button>
          <button
            onClick={handleAutoGenerateBosses}
            disabled={isGenerating}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-red-600/20 text-red-300 hover:bg-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors ease-out"
            title="Generate random bosses across the world"
          >
            <Skull className="w-3 h-3" />
            Bosses
          </button>
        </div>
        {world.layers.difficultyZones.length > 0 && (
          <p className="text-xs text-yellow-400/70 px-1">
            {world.layers.difficultyZones.length} zones exist. Clear to
            regenerate.
          </p>
        )}
      </div>

      {/* Quick Add Buttons */}
      <div className="p-2 border-t border-border-primary space-y-1">
        <p className="text-xs text-text-muted px-1">Quick Add</p>
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["npc", "NPC"],
              ["quest", "Quest"],
              ["boss", "Boss"],
              ["event", "Event"],
              ["lore", "Lore"],
              ["difficultyZone", "Zone"],
              ["customPlacement", "Object"],
            ] as const
          ).map(([type, label]) => (
            <button
              key={type}
              onClick={handleAddLayer(type)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors ease-out"
            >
              <Plus className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============== HELPER FUNCTIONS ==============

/**
 * Build a selection path by finding the node in the tree
 */
function buildSelectionPath(
  root: HierarchyNode | null,
  targetId: string,
): Selection["path"] {
  if (!root) return [];

  const path: Selection["path"] = [];

  function findPath(
    node: HierarchyNode,
    currentPath: Selection["path"],
  ): boolean {
    const newPath = [
      ...currentPath,
      { type: node.type, id: node.dataId || node.id, name: node.label },
    ];

    if (node.id === targetId) {
      path.push(...newPath);
      return true;
    }

    for (const child of node.children) {
      if (findPath(child, newPath)) {
        return true;
      }
    }

    return false;
  }

  findPath(root, []);
  return path;
}

export default HierarchyPanel;
