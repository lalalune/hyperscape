/**
 * TreeView
 *
 * A reusable tree view component for displaying hierarchical data.
 * Used in the world editor hierarchy panel.
 */

import {
  ChevronDown,
  ChevronRight,
  Globe,
  Mountain,
  Trees,
  Building2,
  MapPin,
  User,
  Layers,
  Scroll,
  Skull,
  Zap,
  BookOpen,
  Shield,
  Package,
  Lock,
  Grid3X3,
  Route,
  Swords,
  Bug,
  Navigation,
  Gem,
  Flame,
  Compass,
  Droplets,
  Music,
  Volume2,
  Speaker,
  Radio,
  Folder,
  Hexagon,
  AlertTriangle,
} from "lucide-react";
import React, { useCallback, memo } from "react";

import type { HierarchyNode } from "../types";

// ============== ICON MAPPING ==============

const NODE_ICONS: Record<HierarchyNode["type"], React.ReactNode> = {
  world: <Globe className="w-4 h-4 text-blue-400" />,
  terrain: <Grid3X3 className="w-4 h-4 text-slate-400" />,
  chunks: <Grid3X3 className="w-4 h-4 text-slate-400" />,
  chunk: <Grid3X3 className="w-4 h-4 text-slate-300" />,
  biomes: <Trees className="w-4 h-4 text-green-400" />,
  biome: <Mountain className="w-4 h-4 text-emerald-400" />,
  tiles: <Globe className="w-4 h-4 text-gray-400" />,
  tile: <Globe className="w-4 h-4 text-gray-300" />,
  towns: <MapPin className="w-4 h-4 text-orange-400" />,
  town: <Building2 className="w-4 h-4 text-amber-400" />,
  building: <Building2 className="w-4 h-4 text-yellow-400" />,
  roads: <Route className="w-4 h-4 text-stone-400" />,
  road: <Route className="w-4 h-4 text-stone-300" />,
  layers: <Layers className="w-4 h-4 text-purple-400" />,
  npcs: <User className="w-4 h-4 text-cyan-400" />,
  npc: <User className="w-4 h-4 text-cyan-300" />,
  quests: <Scroll className="w-4 h-4 text-indigo-400" />,
  quest: <Scroll className="w-4 h-4 text-indigo-300" />,
  bosses: <Skull className="w-4 h-4 text-red-400" />,
  boss: <Skull className="w-4 h-4 text-red-300" />,
  events: <Zap className="w-4 h-4 text-yellow-400" />,
  event: <Zap className="w-4 h-4 text-yellow-300" />,
  loreEntries: <BookOpen className="w-4 h-4 text-amber-400" />,
  lore: <BookOpen className="w-4 h-4 text-amber-300" />,
  difficultyZones: <Shield className="w-4 h-4 text-rose-400" />,
  difficultyZone: <Shield className="w-4 h-4 text-rose-300" />,
  wilderness: <Swords className="w-4 h-4 text-red-400" />,
  mobSpawns: <Bug className="w-4 h-4 text-lime-400" />,
  mobSpawn: <Bug className="w-4 h-4 text-lime-300" />,
  customPlacements: <Package className="w-4 h-4 text-teal-400" />,
  customPlacement: <Package className="w-4 h-4 text-teal-300" />,
  spawnPoints: <MapPin className="w-4 h-4 text-green-400" />,
  spawnPoint: <MapPin className="w-4 h-4 text-green-300" />,
  teleports: <Navigation className="w-4 h-4 text-violet-400" />,
  teleport: <Navigation className="w-4 h-4 text-violet-300" />,
  resources: <Gem className="w-4 h-4 text-sky-400" />,
  resource: <Gem className="w-4 h-4 text-sky-300" />,
  stations: <Flame className="w-4 h-4 text-orange-400" />,
  station: <Flame className="w-4 h-4 text-orange-300" />,
  pois: <Compass className="w-4 h-4 text-pink-400" />,
  poi: <Compass className="w-4 h-4 text-pink-300" />,
  waterBodies: <Droplets className="w-4 h-4 text-blue-400" />,
  waterBody: <Droplets className="w-4 h-4 text-blue-300" />,
  water: <Droplets className="w-4 h-4 text-blue-400" />,
  audio: <Radio className="w-4 h-4 text-fuchsia-400" />,
  musicZones: <Music className="w-4 h-4 text-fuchsia-400" />,
  musicZone: <Music className="w-4 h-4 text-fuchsia-300" />,
  ambientZones: <Volume2 className="w-4 h-4 text-teal-400" />,
  ambientZone: <Volume2 className="w-4 h-4 text-teal-300" />,
  sfxTriggers: <Speaker className="w-4 h-4 text-amber-400" />,
  sfxTrigger: <Speaker className="w-4 h-4 text-amber-300" />,
  gameEntities: <Package className="w-4 h-4 text-emerald-400" />,
  gameCharacters: <User className="w-4 h-4 text-cyan-400" />,
  gameCreatures: <Skull className="w-4 h-4 text-red-400" />,
  gameNpcs: <User className="w-4 h-4 text-cyan-400" />,
  gameNpc: <User className="w-4 h-4 text-cyan-300" />,
  gameQuestNpcs: <Scroll className="w-4 h-4 text-yellow-400" />,
  gameShopkeepers: <Package className="w-4 h-4 text-green-400" />,
  gameServiceNpcs: <Shield className="w-4 h-4 text-slate-400" />,
  gameMobs: <Skull className="w-4 h-4 text-red-400" />,
  gameBosses: <Skull className="w-4 h-4 text-orange-400" />,
  gameStations: <Flame className="w-4 h-4 text-orange-400" />,
  gameStation: <Flame className="w-4 h-4 text-orange-300" />,
  gameCraftingStations: <Flame className="w-4 h-4 text-orange-400" />,
  gameServiceStations: <Shield className="w-4 h-4 text-slate-400" />,
  gameOtherStations: <Flame className="w-4 h-4 text-orange-300" />,
  gameResources: <Gem className="w-4 h-4 text-sky-400" />,
  gameResource: <Gem className="w-4 h-4 text-sky-300" />,
  gameMining: <Gem className="w-4 h-4 text-amber-400" />,
  gameWoodcutting: <Trees className="w-4 h-4 text-green-400" />,
  gameOtherResources: <Gem className="w-4 h-4 text-sky-300" />,
  gameMobSpawns: <Bug className="w-4 h-4 text-lime-400" />,
  gameMobSpawn: <Bug className="w-4 h-4 text-lime-300" />,
  gameFishing: <Droplets className="w-4 h-4 text-blue-400" />,
  gameAreas: <Compass className="w-4 h-4 text-pink-400" />,
  regions: <Hexagon className="w-4 h-4 text-orange-400" />,
  region: <Hexagon className="w-4 h-4 text-orange-300" />,
  dangerSources: <Zap className="w-4 h-4 text-red-400" />,
  dangerSource: <Zap className="w-4 h-4 text-red-300" />,
  wildernessBoundary: <AlertTriangle className="w-4 h-4 text-red-400" />,
  customAssets: <Package className="w-4 h-4 text-teal-400" />,
  customAsset: <Package className="w-4 h-4 text-teal-300" />,
  folder: <Folder className="w-4 h-4 text-yellow-400" />,
};

// ============== TREE NODE COMPONENT ==============

interface TreeNodeProps {
  node: HierarchyNode;
  level: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (node: HierarchyNode) => void;
  onToggleExpand: (nodeId: string) => void;
}

// Foundation node types that are locked (cannot be moved/deleted)
const LOCKED_NODE_TYPES = new Set<HierarchyNode["type"]>([
  "biome",
  "biomes",
  "town",
  "towns",
  "building",
]);

const TreeNode: React.FC<TreeNodeProps> = memo(
  ({ node, level, selectedId, expandedIds, onSelect, onToggleExpand }) => {
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedId === node.id;
    const hasChildren = node.children && node.children.length > 0;
    const canExpand = node.expandable && hasChildren;
    const isLocked = LOCKED_NODE_TYPES.has(node.type);

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(node);
      },
      [node, onSelect],
    );

    const handleExpandClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (canExpand) {
          onToggleExpand(node.id);
        }
      },
      [canExpand, node.id, onToggleExpand],
    );

    const handleDoubleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (canExpand) {
          onToggleExpand(node.id);
        }
      },
      [canExpand, node.id, onToggleExpand],
    );

    return (
      <div>
        {/* Node row */}
        <div
          className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer rounded-md transition-colors ${
            isSelected
              ? "bg-primary/20 text-text-primary"
              : "hover:bg-bg-tertiary text-text-secondary hover:text-text-primary"
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
        >
          {/* Expand/collapse chevron */}
          <button
            className={`w-4 h-4 flex items-center justify-center flex-shrink-0 ${
              canExpand ? "opacity-100" : "opacity-0"
            }`}
            onClick={handleExpandClick}
            disabled={!canExpand}
          >
            {canExpand &&
              (isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              ))}
          </button>

          {/* Icon */}
          <span className="flex-shrink-0">
            {NODE_ICONS[node.type] || <Globe className="w-4 h-4" />}
          </span>

          {/* Label */}
          <span className="flex-1 text-sm truncate">{node.label}</span>

          {/* Lock indicator for foundation items */}
          {isLocked && (
            <span title="Foundation item - position locked">
              <Lock className="w-3 h-3 text-text-muted/50 flex-shrink-0" />
            </span>
          )}

          {/* Badge */}
          {node.badge !== undefined && node.badge > 0 && (
            <span className="px-1.5 py-0.5 bg-bg-tertiary text-text-muted text-xs rounded">
              {node.badge}
            </span>
          )}
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div>
            {node.children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                level={level + 1}
                selectedId={selectedId}
                expandedIds={expandedIds}
                onSelect={onSelect}
                onToggleExpand={onToggleExpand}
              />
            ))}
          </div>
        )}
      </div>
    );
  },
);

TreeNode.displayName = "TreeNode";

// ============== TREE VIEW COMPONENT ==============

interface TreeViewProps {
  /** Root node of the tree */
  root: HierarchyNode | null;
  /** Currently selected node ID */
  selectedId: string | null;
  /** Set of expanded node IDs */
  expandedIds: Set<string>;
  /** Called when a node is selected */
  onSelect: (node: HierarchyNode) => void;
  /** Called when a node's expansion state should toggle */
  onToggleExpand: (nodeId: string) => void;
  /** Optional class name */
  className?: string;
  /** Show search input */
  showSearch?: boolean;
  /** Search placeholder text */
  searchPlaceholder?: string;
}

export const TreeView: React.FC<TreeViewProps> = ({
  root,
  selectedId,
  expandedIds,
  onSelect,
  onToggleExpand,
  className = "",
  showSearch = false,
  searchPlaceholder = "Search...",
}) => {
  const [searchQuery, setSearchQuery] = React.useState("");

  // Filter nodes based on search query
  const filterNode = useCallback(
    (node: HierarchyNode): HierarchyNode | null => {
      if (!searchQuery) return node;

      const matchesSearch = node.label
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      // Filter children recursively
      const filteredChildren = node.children
        .map(filterNode)
        .filter((child): child is HierarchyNode => child !== null);

      // Include node if it matches or has matching children
      if (matchesSearch || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        };
      }

      return null;
    },
    [searchQuery],
  );

  const filteredRoot = root ? filterNode(root) : null;

  // Auto-expand filtered nodes when searching
  const effectiveExpandedIds = React.useMemo(() => {
    if (!searchQuery || !filteredRoot) return expandedIds;

    // Expand all nodes when searching
    const allIds = new Set<string>();
    const collectIds = (node: HierarchyNode) => {
      allIds.add(node.id);
      node.children.forEach(collectIds);
    };
    collectIds(filteredRoot);
    return allIds;
  }, [searchQuery, filteredRoot, expandedIds]);

  if (!root) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <p className="text-sm text-text-muted">No data to display</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Search input */}
      {showSearch && (
        <div className="p-2 border-b border-border-primary">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full px-3 py-1.5 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
      )}

      {/* Tree content */}
      <div className="flex-1 overflow-y-auto py-1">
        {filteredRoot ? (
          <TreeNode
            node={filteredRoot}
            level={0}
            selectedId={selectedId}
            expandedIds={effectiveExpandedIds}
            onSelect={onSelect}
            onToggleExpand={onToggleExpand}
          />
        ) : (
          <div className="flex items-center justify-center p-8">
            <p className="text-sm text-text-muted">No matching items</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TreeView;
