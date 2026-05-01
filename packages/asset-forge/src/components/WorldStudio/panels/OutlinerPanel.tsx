/**
 * OutlinerPanel — UE5-style World Outliner for World Studio.
 *
 * Shows ALL entities from all sources in one unified tree with:
 * - Visibility toggles (eye icon per entity/folder)
 * - Search with exclusion support (-keyword)
 * - Category filters
 * - Entity count badges
 * - Click to select, Ctrl+Click for multi-select, Shift+Click for range
 * - Viewport selection syncs to outliner (auto-scroll)
 * - Double-click to focus camera on entity
 * - Right-click context menu (Focus, Duplicate, Delete, etc.)
 */

import {
  Eye,
  EyeOff,
  Search,
  Globe,
  Building2,
  Route,
  Users,
  Swords,
  ScrollText,
  CalendarDays,
  BookOpen,
  Shield,
  Package,
  MapPin,
  Navigation,
  Skull,
  Gem,
  Flame,
  Compass,
  Droplets,
  Music,
  Volume2,
  Speaker,
  Mountain,
  TreePine,
  Radio,
  Filter,
  X,
  Copy,
  Trash2,
  Focus,
  FolderPlus,
  Folder,
  FolderOpen,
  Pencil,
  Store,
  Pickaxe,
  Axe,
  Fish,
  Crown,
  Hammer,
  Hexagon,
  Zap,
  AlertTriangle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useDeferredValue,
} from "react";

import type { HierarchyNode, Selection } from "../../WorldBuilder/types";
import { useWorldStudio } from "../WorldStudioContext";
import { useSelectionStore } from "../../../editor/stores/useSelectionStore";
import { useManifestValidation } from "../hooks/useManifestValidation";
import { ContextMenu, type ContextMenuItem } from "../layout/ContextMenu";
import { resolveLucideIcon } from "../../../gameModules/utils/lucideIconMap";
import type { EntityTypeRegistry } from "../../../gameModules/EntityTypeRegistry";
import { useContextMenu } from "../layout/useContextMenu";
import {
  executeDuplicate,
  executeDelete,
  executeCreatePrefab,
} from "../utils/entityActions";
import { useAgentWorldContent } from "../state/agentWorldContent";

// ============== CONSTANTS ==============

/** Map hierarchy node types to valid Selection.type values */
const SELECTABLE_NODE_TYPES: Record<string, Selection["type"] | undefined> = {
  terrain: "terrain",
  chunk: "chunk",
  biome: "biome",
  tile: "tile",
  town: "town",
  building: "building",
  npc: "npc",
  quest: "quest",
  boss: "boss",
  event: "event",
  lore: "lore",
  difficultyZone: "difficultyZone",
  customPlacement: "customPlacement",
  wilderness: "wilderness",
  spawnPoint: "spawnPoint",
  teleport: "teleport",
  mobSpawn: "mobSpawn",
  resource: "resource",
  station: "station",
  road: "road",
  poi: "poi",
  waterBody: "waterBody",
  musicZone: "musicZone",
  ambientZone: "ambientZone",
  sfxTrigger: "sfxTrigger",
  vegetation: "vegetation",
  gameNpc: "gameNpc" as Selection["type"],
  gameStation: "gameStation" as Selection["type"],
  gameResource: "gameResource" as Selection["type"],
  gameMobSpawn: "gameMobSpawn" as Selection["type"],
  region: "region" as Selection["type"],
  dangerSource: "dangerSource" as Selection["type"],
  wildernessBoundary: "wilderness",
  customAsset: "customAsset" as Selection["type"],
};

const TYPE_ICONS: Record<string, typeof Globe> = {
  world: Globe,
  terrain: Mountain,
  biome: TreePine,
  biomes: TreePine,
  town: Building2,
  towns: Building2,
  building: Building2,
  road: Route,
  roads: Route,
  npc: Users,
  npcs: Users,
  quest: ScrollText,
  quests: ScrollText,
  boss: Swords,
  bosses: Swords,
  event: CalendarDays,
  events: CalendarDays,
  lore: BookOpen,
  loreEntries: BookOpen,
  difficultyZone: Shield,
  difficultyZones: Shield,
  customPlacement: Package,
  customPlacements: Package,
  layers: Package,
  chunks: Mountain,
  chunk: Mountain,
  spawnPoint: MapPin,
  spawnPoints: MapPin,
  teleport: Navigation,
  teleports: Navigation,
  mobSpawn: Skull,
  mobSpawns: Skull,
  resource: Gem,
  resources: Gem,
  station: Flame,
  stations: Flame,
  poi: Compass,
  pois: Compass,
  waterBody: Droplets,
  waterBodies: Droplets,
  water: Droplets,
  audio: Radio,
  musicZones: Music,
  musicZone: Music,
  ambientZones: Volume2,
  ambientZone: Volume2,
  sfxTriggers: Speaker,
  sfxTrigger: Speaker,
  gameEntities: Package,
  gameCharacters: Users,
  gameCreatures: Skull,
  gameNpcs: Users,
  gameNpc: Users,
  gameQuestNpcs: ScrollText,
  gameShopkeepers: Store,
  gameServiceNpcs: Shield,
  gameMobs: Skull,
  gameBosses: Crown,
  gameStations: Flame,
  gameStation: Flame,
  gameCraftingStations: Hammer,
  gameServiceStations: Shield,
  gameOtherStations: Flame,
  gameResources: Gem,
  gameResource: Gem,
  gameMining: Pickaxe,
  gameWoodcutting: Axe,
  gameOtherResources: Gem,
  gameMobSpawns: Skull,
  gameMobSpawn: Skull,
  gameFishing: Fish,
  gameAreas: Compass,
  region: Hexagon,
  regions: Hexagon,
  dangerSource: Zap,
  dangerSources: Zap,
  wildernessBoundary: AlertTriangle,
  customAsset: Package,
  customAssets: Package,
  folder: Folder,
};

/** UE5-style colored icons — each type gets a distinct color */
const TYPE_ICON_COLORS: Record<string, string> = {
  world: "#7c8fa6",
  terrain: "#8b9467",
  biome: "#6b9e5a",
  biomes: "#6b9e5a",
  town: "#c4a24e",
  towns: "#c4a24e",
  building: "#c4a24e",
  road: "#8a8a8a",
  roads: "#8a8a8a",
  npc: "#5b9bd5",
  npcs: "#5b9bd5",
  quest: "#d4a03e",
  quests: "#d4a03e",
  boss: "#d45b5b",
  bosses: "#d45b5b",
  event: "#b07cd4",
  events: "#b07cd4",
  lore: "#9b8ec4",
  loreEntries: "#9b8ec4",
  difficultyZone: "#d47c3e",
  difficultyZones: "#d47c3e",
  customPlacement: "#7ca6c4",
  customPlacements: "#7ca6c4",
  layers: "#7ca6c4",
  chunks: "#8b9467",
  chunk: "#8b9467",
  spawnPoint: "#4ec46e",
  spawnPoints: "#4ec46e",
  teleport: "#4ec4c4",
  teleports: "#4ec4c4",
  mobSpawn: "#d45b5b",
  mobSpawns: "#d45b5b",
  resource: "#5bd4a0",
  resources: "#5bd4a0",
  station: "#d4a03e",
  stations: "#d4a03e",
  poi: "#c4a24e",
  pois: "#c4a24e",
  waterBody: "#5b9bd5",
  waterBodies: "#5b9bd5",
  water: "#5b9bd5",
  audio: "#b07cd4",
  musicZones: "#b07cd4",
  musicZone: "#b07cd4",
  ambientZones: "#9b8ec4",
  ambientZone: "#9b8ec4",
  sfxTriggers: "#8a7cb0",
  sfxTrigger: "#8a7cb0",
  gameEntities: "#7ca6c4",
  gameCharacters: "#5b9bd5",
  gameCreatures: "#d45b5b",
  gameNpcs: "#5b9bd5",
  gameNpc: "#5b9bd5",
  gameQuestNpcs: "#d4a03e",
  gameShopkeepers: "#4ec46e",
  gameServiceNpcs: "#7ca6c4",
  gameMobs: "#d45b5b",
  gameBosses: "#d47c3e",
  gameStations: "#d4a03e",
  gameStation: "#d4a03e",
  gameCraftingStations: "#d4a03e",
  gameServiceStations: "#7ca6c4",
  gameOtherStations: "#d4a03e",
  gameResources: "#5bd4a0",
  gameResource: "#5bd4a0",
  gameMining: "#8b9467",
  gameWoodcutting: "#6b9e5a",
  gameOtherResources: "#5bd4a0",
  gameMobSpawns: "#d45b5b",
  gameMobSpawn: "#d45b5b",
  gameFishing: "#5b9bd5",
  gameAreas: "#c4a24e",
  region: "#d47c3e",
  regions: "#d47c3e",
  dangerSource: "#e54545",
  dangerSources: "#e54545",
  wildernessBoundary: "#d45b5b",
  customAsset: "#2dd4bf",
  customAssets: "#2dd4bf",
  folder: "#c4a24e",
};

/** Resolve icon for a node type — hardcoded map first, then registry fallback. */
function getTypeIcon(
  nodeType: string,
  registry: EntityTypeRegistry,
): LucideIcon {
  if (TYPE_ICONS[nodeType]) return TYPE_ICONS[nodeType];
  const schema =
    registry.get(nodeType) ?? registry.getBySelectionType(nodeType);
  return schema ? resolveLucideIcon(schema.icon) : Package;
}

/** Resolve icon color for a node type — hardcoded map first, then registry fallback. */
function getTypeIconColor(
  nodeType: string,
  registry: EntityTypeRegistry,
): string {
  if (TYPE_ICON_COLORS[nodeType]) return TYPE_ICON_COLORS[nodeType];
  const schema =
    registry.get(nodeType) ?? registry.getBySelectionType(nodeType);
  return schema ? schema.color : "#888888";
}

/** UE5-style filled triangle arrow for expand/collapse */
function ExpandArrow({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className="flex-shrink-0"
      style={{
        transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 0.1s ease",
      }}
    >
      <path d="M3 1.5L7.5 5L3 8.5z" fill="currentColor" />
    </svg>
  );
}

/**
 * Color-coded provenance indicator. P0.4 of
 * PLAN_AGENT_STUDIO_PARITY — the outliner now color-codes by
 * `source` so a user can tell at a glance which entries came
 * from the agent vs. procgen vs. their own placements. Designer
 * entries get no indicator (the absence is the default state;
 * we only highlight non-default origins).
 *
 * Color choices match the studio's existing palette:
 *   agent   → primary purple (matches the Sparkles brand color)
 *   procgen → amber (procgen-generated content is "automated")
 *   designer / hand-placed → no indicator
 */
const SOURCE_INDICATOR_COLORS: Record<string, string> = {
  agent: "#a855f7", // violet/purple — matches Sparkles brand
  procgen: "#f59e0b", // amber
};

function SourceIndicator({
  source,
}: {
  source: unknown;
}): React.ReactElement | null {
  if (typeof source !== "string") return null;
  const color = SOURCE_INDICATOR_COLORS[source];
  if (!color) return null;
  return (
    <span
      className="w-1.5 h-1.5 rounded-full flex-shrink-0 ml-0.5"
      style={{ backgroundColor: color }}
      title={`Source: ${source}`}
    />
  );
}

const CATEGORY_FILTERS = [
  { id: "all", label: "All" },
  { id: "foundation", label: "Foundation" },
  { id: "entities", label: "Entities" },
  { id: "npcs", label: "NPCs" },
  { id: "stations", label: "Stations" },
  { id: "resources", label: "Resources" },
  { id: "spawns", label: "Spawns" },
  { id: "audio", label: "Audio" },
] as const;

// ============== LAYER DEFINITIONS ==============

interface LayerDef {
  id: string;
  label: string;
  icon: typeof Globe;
  /** Entity types this layer controls */
  types: string[];
}

const LAYERS: LayerDef[] = [
  {
    id: "terrain",
    label: "Terrain",
    icon: Mountain,
    types: ["terrain", "chunk", "biome"],
  },
  {
    id: "towns",
    label: "Towns & Buildings",
    icon: Building2,
    types: ["town", "building"],
  },
  {
    id: "npcs",
    label: "NPCs",
    icon: Users,
    types: [
      "npc",
      "boss",
      "gameNpc",
      "gameNpcs",
      "gameCharacters",
      "gameQuestNpcs",
      "gameShopkeepers",
      "gameServiceNpcs",
    ],
  },
  {
    id: "quests",
    label: "Quests & Events",
    icon: ScrollText,
    types: ["quest", "event", "lore"],
  },
  {
    id: "spawns",
    label: "Spawns & Teleports",
    icon: MapPin,
    types: [
      "spawnPoint",
      "teleport",
      "mobSpawn",
      "gameMobSpawns",
      "gameMobSpawn",
      "gameCreatures",
      "gameMobs",
      "gameBosses",
    ],
  },
  {
    id: "resources",
    label: "Resources & Stations",
    icon: Gem,
    types: [
      "resource",
      "station",
      "gameStation",
      "gameResource",
      "gameStations",
      "gameResources",
      "gameFishing",
      "gameCraftingStations",
      "gameServiceStations",
      "gameOtherStations",
      "gameMining",
      "gameWoodcutting",
      "gameOtherResources",
    ],
  },
  {
    id: "world",
    label: "World Features",
    icon: Compass,
    types: [
      "poi",
      "waterBody",
      "road",
      "difficultyZone",
      "region",
      "dangerSource",
      "wildernessBoundary",
      "gameAreas",
      "gameEntities",
    ],
  },
  {
    id: "audio",
    label: "Audio Zones",
    icon: Music,
    types: ["musicZone", "ambientZone", "sfxTrigger"],
  },
  {
    id: "vegetation",
    label: "Vegetation",
    icon: TreePine,
    types: ["vegetation", "customPlacement"],
  },
  {
    id: "customAssets",
    label: "Custom Assets",
    icon: Package,
    types: ["customAsset"],
  },
];

const LAYER_STORAGE_KEY = "worldstudio-layers";

function loadLayerVisibility(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(LAYER_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {};
}

function saveLayerVisibility(vis: Record<string, boolean>) {
  try {
    localStorage.setItem(LAYER_STORAGE_KEY, JSON.stringify(vis));
  } catch {
    /* ignore */
  }
}

// ============== CUSTOM FOLDERS ==============

const FOLDER_STORAGE_KEY = "worldstudio-custom-folders";

interface CustomFolder {
  name: string;
  entityIds: string[];
}

function loadCustomFolders(): Map<string, CustomFolder> {
  try {
    const raw = localStorage.getItem(FOLDER_STORAGE_KEY);
    if (raw) {
      const entries: [string, CustomFolder][] = JSON.parse(raw);
      return new Map(entries);
    }
  } catch {
    /* ignore */
  }
  return new Map();
}

function saveCustomFolders(folders: Map<string, CustomFolder>) {
  try {
    localStorage.setItem(
      FOLDER_STORAGE_KEY,
      JSON.stringify(Array.from(folders.entries())),
    );
  } catch {
    /* ignore */
  }
}

let folderIdCounter = 0;
function generateFolderId(): string {
  return `folder-${Date.now()}-${++folderIdCounter}`;
}

// ============== SEARCH HELPERS ==============

function parseSearchQuery(query: string): {
  include: string[];
  exclude: string[];
} {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const include: string[] = [];
  const exclude: string[] = [];
  for (const term of terms) {
    if (term.startsWith("-") && term.length > 1) {
      exclude.push(term.slice(1));
    } else {
      include.push(term);
    }
  }
  return { include, exclude };
}

function matchesSearch(
  label: string,
  search: { include: string[]; exclude: string[] },
): boolean {
  const lower = label.toLowerCase();
  for (const ex of search.exclude) {
    if (lower.includes(ex)) return false;
  }
  if (search.include.length === 0) return true;
  for (const inc of search.include) {
    if (lower.includes(inc)) return true;
  }
  return false;
}

function nodeMatchesSearch(
  node: HierarchyNode,
  search: { include: string[]; exclude: string[] },
): boolean {
  if (matchesSearch(node.label, search)) return true;
  if (node.children) {
    return node.children.some((child) => nodeMatchesSearch(child, search));
  }
  return false;
}

// ============== VISIBILITY STATE ==============

type VisibilityMap = Map<string, boolean>;

// ============== TREE NODE COMPONENT ==============

interface OutlinerNodeProps {
  node: HierarchyNode;
  depth: number;
  expandedNodes: Set<string>;
  selectedId: string | null;
  multiSelectedIds: Set<string>;
  visibilityMap: VisibilityMap;
  validationIssueIds: Set<string>;
  registry: EntityTypeRegistry;
  onToggle: (nodeId: string) => void;
  onSelect: (node: HierarchyNode, e: React.MouseEvent) => void;
  onDoubleClick: (node: HierarchyNode) => void;
  onContextMenu: (node: HierarchyNode, e: React.MouseEvent) => void;
  onToggleVisibility: (nodeId: string) => void;
  searchQuery: { include: string[]; exclude: string[] } | null;
}

function OutlinerNode({
  node,
  depth,
  expandedNodes,
  selectedId,
  multiSelectedIds,
  visibilityMap,
  validationIssueIds,
  registry,
  onToggle,
  onSelect,
  onDoubleClick,
  onContextMenu,
  onToggleVisibility,
  searchQuery,
}: OutlinerNodeProps) {
  if (searchQuery && !nodeMatchesSearch(node, searchQuery)) return null;

  const isExpanded = expandedNodes.has(node.id) || searchQuery !== null;
  const nodeDataId = node.dataId ?? node.id;
  const isSelected = selectedId != null && selectedId === nodeDataId;
  const isMultiSelected = multiSelectedIds.has(nodeDataId);
  const hasChildren = node.children && node.children.length > 0;
  const Icon = getTypeIcon(node.type, registry);
  const iconColor = getTypeIconColor(node.type, registry);
  const isVisible = visibilityMap.get(node.id) !== false;
  const hasValidationIssue = nodeDataId
    ? validationIssueIds.has(nodeDataId)
    : false;

  return (
    <div data-outliner-id={nodeDataId}>
      <div
        className={`group flex items-center gap-1 py-[3px] pr-1 text-xs cursor-pointer ${
          isSelected
            ? "bg-primary/15 text-primary"
            : isMultiSelected
              ? "bg-primary/8 text-primary/80"
              : "text-text-secondary hover:text-text-primary hover:bg-white/[0.04]"
        }`}
        style={{ paddingLeft: depth * 16 + 4 }}
        onClick={(e) => {
          if (
            hasChildren &&
            node.expandable !== false &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.shiftKey
          ) {
            onToggle(node.id);
          }
          onSelect(node, e);
        }}
        onDoubleClick={() => onDoubleClick(node)}
        onContextMenu={(e) => onContextMenu(node, e)}
      >
        {/* Expand/collapse filled triangle */}
        <span className="w-3 flex-shrink-0 flex items-center justify-center">
          {hasChildren && node.expandable !== false ? (
            <ExpandArrow expanded={isExpanded} />
          ) : null}
        </span>

        {/* Colored type icon */}
        <Icon
          size={12}
          className="flex-shrink-0"
          style={{ color: iconColor }}
        />
        <span
          className={`truncate flex-1 text-left ${!isVisible ? "opacity-40 line-through" : ""}`}
        >
          {node.label}
        </span>

        {/* Source indicator — color-coded dot for non-designer
            entries so a user can scan the tree and see at a glance
            which entries came from which path. P0.4 of
            PLAN_AGENT_STUDIO_PARITY. */}
        <SourceIndicator source={node.metadata?.source} />

        {/* Badge count */}
        {node.badge !== undefined && node.badge > 0 && (
          <span className="text-[9px] text-text-tertiary bg-bg-tertiary px-1 rounded ml-0.5">
            {node.badge}
          </span>
        )}

        {/* Validation issue indicator */}
        {hasValidationIssue && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 ml-0.5"
            title="Has validation issues"
          />
        )}

        {/* Visibility toggle — hover-revealed (UE5 style) */}
        <button
          className={`p-0.5 flex-shrink-0 transition-opacity ${
            isVisible
              ? "opacity-0 group-hover:opacity-60 hover:!opacity-100"
              : "opacity-100"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility(node.id);
          }}
          title={isVisible ? "Hide" : "Show"}
        >
          {isVisible ? (
            <Eye size={11} className="text-text-tertiary" />
          ) : (
            <EyeOff size={11} className="text-amber-400" />
          )}
        </button>
      </div>

      {/* Children */}
      {(isExpanded || searchQuery !== null) && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <OutlinerNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedNodes={expandedNodes}
              selectedId={selectedId}
              multiSelectedIds={multiSelectedIds}
              visibilityMap={visibilityMap}
              validationIssueIds={validationIssueIds}
              registry={registry}
              onToggle={onToggle}
              onSelect={onSelect}
              onDoubleClick={onDoubleClick}
              onContextMenu={onContextMenu}
              onToggleVisibility={onToggleVisibility}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============== OUTLINER PANEL ==============

export const OutlinerPanel = React.memo(function OutlinerPanel() {
  const { state, actions, computed, registry, dispatch } = useWorldStudio();
  const multiSelection = useSelectionStore((store) => store.multiSelection);
  const addToMulti = useSelectionStore((store) => store.addToMultiSelection);
  const removeFromMulti = useSelectionStore(
    (store) => store.removeFromMultiSelection,
  );
  const clearMulti = useSelectionStore((store) => store.clearMultiSelection);

  const [searchText, setSearchText] = useState("");
  const deferredSearchText = useDeferredValue(searchText);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [visibilityMap, setVisibilityMap] = useState<VisibilityMap>(
    () => new Map(),
  );
  const [layerVisibility, setLayerVisibility] =
    useState<Record<string, boolean>>(loadLayerVisibility);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Custom folders
  const [customFolders, setCustomFolders] =
    useState<Map<string, CustomFolder>>(loadCustomFolders);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderName, setRenameFolderName] = useState("");
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const renameFolderInputRef = useRef<HTMLInputElement>(null);

  // Context menu
  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu();
  const [contextNode, setContextNode] = useState<HierarchyNode | null>(null);

  const expandedNodes = state.builder.editing.expandedNodes;
  const selection = state.builder.editing.selection;
  const selectedId = selection ? selection.id : null;
  const baseHierarchyTree = computed.getHierarchyTree();

  // Subscribe to agent-emitted world content so the outliner shows
  // NPCs / mob spawns / quests / zones / resources the agent
  // produced via chat — they live in `agentWorldContent`, not in
  // `state.extendedLayers`, so the base hierarchy tree misses them.
  // We merge here as a top-level "AI Generated" folder so agent vs
  // designer content is visually distinguishable.
  const agentContent = useAgentWorldContent();
  const hierarchyTree = useMemo<HierarchyNode | null>(() => {
    if (!baseHierarchyTree) return baseHierarchyTree;
    const aiNode = buildAgentContentNode(agentContent);
    if (!aiNode) return baseHierarchyTree;
    // Prepend the AI folder as the first top-level child so it's
    // visible without scrolling.
    return {
      ...baseHierarchyTree,
      children: [aiNode, ...baseHierarchyTree.children],
    };
  }, [baseHierarchyTree, agentContent]);

  // Multi-selection set for efficient lookup
  const multiSelectedIds = useMemo(
    () => new Set<string>(multiSelection.map((sel: { id: string }) => sel.id)),
    [multiSelection],
  );

  const searchQuery = useMemo(() => {
    if (!deferredSearchText.trim()) return null;
    return parseSearchQuery(deferredSearchText);
  }, [deferredSearchText]);

  const handleToggle = useCallback(
    (nodeId: string) => actions.toggleNodeExpanded(nodeId),
    [actions],
  );

  // ---- Custom folder operations ----

  const handleCreateFolder = useCallback(() => {
    setIsCreatingFolder(true);
    setNewFolderName("");
    // Focus the input after render
    setTimeout(() => newFolderInputRef.current?.focus(), 50);
  }, []);

  const handleConfirmNewFolder = useCallback(() => {
    const name = newFolderName.trim();
    if (!name) {
      setIsCreatingFolder(false);
      return;
    }
    const id = generateFolderId();
    setCustomFolders((prev) => {
      const next = new Map(prev);
      next.set(id, { name, entityIds: [] });
      saveCustomFolders(next);
      return next;
    });
    setIsCreatingFolder(false);
    setNewFolderName("");
  }, [newFolderName]);

  const handleCancelNewFolder = useCallback(() => {
    setIsCreatingFolder(false);
    setNewFolderName("");
  }, []);

  const handleDeleteFolder = useCallback((folderId: string) => {
    setCustomFolders((prev) => {
      const next = new Map(prev);
      next.delete(folderId);
      saveCustomFolders(next);
      return next;
    });
  }, []);

  const handleRenameFolder = useCallback(
    (folderId: string) => {
      const folder = customFolders.get(folderId);
      if (!folder) return;
      setRenamingFolderId(folderId);
      setRenameFolderName(folder.name);
      setTimeout(() => renameFolderInputRef.current?.focus(), 50);
    },
    [customFolders],
  );

  const handleConfirmRenameFolder = useCallback(() => {
    if (!renamingFolderId) return;
    const name = renameFolderName.trim();
    if (!name) {
      setRenamingFolderId(null);
      return;
    }
    setCustomFolders((prev) => {
      const next = new Map(prev);
      const existing = next.get(renamingFolderId);
      if (existing) {
        next.set(renamingFolderId, { ...existing, name });
        saveCustomFolders(next);
      }
      return next;
    });
    setRenamingFolderId(null);
    setRenameFolderName("");
  }, [renamingFolderId, renameFolderName]);

  const handleMoveToFolder = useCallback(
    (entityId: string, folderId: string) => {
      setCustomFolders((prev) => {
        const next = new Map(prev);
        // Remove from any existing folder first
        for (const [id, folder] of next) {
          const idx = folder.entityIds.indexOf(entityId);
          if (idx !== -1) {
            next.set(id, {
              ...folder,
              entityIds: folder.entityIds.filter((eid) => eid !== entityId),
            });
          }
        }
        // Add to target folder
        const target = next.get(folderId);
        if (target && !target.entityIds.includes(entityId)) {
          next.set(folderId, {
            ...target,
            entityIds: [...target.entityIds, entityId],
          });
        }
        saveCustomFolders(next);
        return next;
      });
    },
    [],
  );

  const handleRemoveFromFolder = useCallback((entityId: string) => {
    setCustomFolders((prev) => {
      const next = new Map(prev);
      for (const [id, folder] of next) {
        const idx = folder.entityIds.indexOf(entityId);
        if (idx !== -1) {
          next.set(id, {
            ...folder,
            entityIds: folder.entityIds.filter((eid) => eid !== entityId),
          });
        }
      }
      saveCustomFolders(next);
      return next;
    });
  }, []);

  // Selection with multi-select support
  const handleSelect = useCallback(
    (node: HierarchyNode, e: React.MouseEvent) => {
      const selectionType = SELECTABLE_NODE_TYPES[node.type];
      if (!node.dataId || !selectionType) return;

      // For game entities, build full entityData by looking up the game entity info.
      // This mirrors the userData the viewport provides on click (npcType, entityId, storeId, etc.)
      const isGameEntity =
        node.type === "gameNpc" ||
        node.type === "gameStation" ||
        node.type === "gameResource" ||
        node.type === "gameMobSpawn";
      let entityData: Record<string, unknown> | undefined;
      if (isGameEntity && state.gameEntities) {
        const ge = state.gameEntities;
        // Find the matching entity info across all lists
        const gameTypeLists: Record<string, typeof ge.npcs> = {
          gameNpc: ge.npcs,
          gameStation: ge.stations,
          gameResource: ge.resources,
          gameMobSpawn: ge.mobSpawns,
        };
        const list = gameTypeLists[node.type];
        const info = list?.find(
          (e) =>
            e.selectableId === (node.metadata?.selectableId as string) ||
            e.entityId === node.dataId,
        );
        if (info) {
          entityData = {
            selectableId: info.selectableId,
            entityId: info.entityId,
            displayName: info.name,
            npcType: info.npcType,
            storeId: info.storeId,
            stationType: info.stationType,
            entityType:
              info.resourceType ??
              (node.type === "gameMobSpawn" ? "mob_spawn" : undefined),
            spawnRadius: info.spawnRadius,
            maxCount: info.maxCount,
            position: { x: info.position.x, y: 0, z: info.position.z },
          };
        } else if (node.dataId) {
          // Virtual node (e.g., mob parent with no placed NPC) — build from node + metadata
          entityData = {
            entityId: node.dataId,
            displayName: node.label,
            ...(node.metadata?.selectableId
              ? { selectableId: node.metadata.selectableId as string }
              : {}),
            ...(node.metadata?.position
              ? {
                  position: {
                    x: (node.metadata.position as { x: number }).x,
                    y: 0,
                    z: (node.metadata.position as { z: number }).z,
                  },
                }
              : {}),
          };
        }
      }

      const sel = {
        type: selectionType,
        id: node.dataId,
        path: [{ type: node.type, id: node.dataId, name: node.label }],
        entityData,
      };

      if (e.ctrlKey || e.metaKey) {
        // Toggle in multi-selection
        if (multiSelectedIds.has(node.dataId)) {
          removeFromMulti(node.dataId);
        } else {
          addToMulti({ type: selectionType, id: node.dataId });
        }
      } else {
        // Single select — clear multi
        clearMulti();
        actions.setSelection(sel);
      }
    },
    [
      actions,
      addToMulti,
      removeFromMulti,
      clearMulti,
      multiSelectedIds,
      state.gameEntities,
    ],
  );

  // Double-click to focus camera
  const handleDoubleClick = useCallback(
    (node: HierarchyNode) => {
      if (node.dataId) {
        // Focus camera on this entity's position
        const position = findEntityPosition(state, node.type, node.dataId);
        if (position) {
          actions.cameraTeleport(position);
        }
      }
    },
    [state, actions],
  );

  // Right-click context menu
  const handleContextMenu = useCallback(
    (node: HierarchyNode, e: React.MouseEvent) => {
      setContextNode(node);
      showContextMenu(e);
      // Also select the node
      if (node.dataId) {
        const selectionType = SELECTABLE_NODE_TYPES[node.type];
        if (selectionType) {
          actions.setSelection({
            type: selectionType,
            id: node.dataId,
            path: [{ type: node.type, id: node.dataId, name: node.label }],
          });
        }
      }
    },
    [actions, showContextMenu],
  );

  const contextMenuItems = useMemo((): ContextMenuItem[] => {
    if (!contextNode) return [];

    // If right-clicking a folder node, show folder-specific operations
    if (contextNode.type === "folder") {
      const folderId = contextNode.id;
      return [
        {
          label: "Rename Folder",
          icon: Pencil,
          onClick: () => {
            handleRenameFolder(folderId);
            hideContextMenu();
          },
        },
        {
          label: "Delete Folder",
          icon: Trash2,
          danger: true,
          onClick: () => {
            handleDeleteFolder(folderId);
            hideContextMenu();
          },
        },
      ];
    }

    const items: ContextMenuItem[] = [
      {
        label: "Focus Camera",
        icon: Focus,
        shortcut: "F",
        onClick: () => {
          if (contextNode.dataId) {
            const pos = findEntityPosition(
              state,
              contextNode.type,
              contextNode.dataId,
            );
            if (pos) actions.cameraTeleport(pos);
          }
          hideContextMenu();
        },
      },
    ];

    const selType = SELECTABLE_NODE_TYPES[contextNode.type];
    if (selType && contextNode.dataId) {
      const nodeType = selType;
      const nodeId = contextNode.dataId;

      // "Move to Folder" submenu items
      if (customFolders.size > 0) {
        items.push({ label: "", separator: true });
        for (const [fId, folder] of customFolders) {
          const isInFolder = folder.entityIds.includes(nodeId);
          items.push({
            label: isInFolder
              ? `Remove from "${folder.name}"`
              : `Move to "${folder.name}"`,
            icon: isInFolder ? X : FolderOpen,
            onClick: () => {
              if (isInFolder) {
                handleRemoveFromFolder(nodeId);
              } else {
                handleMoveToFolder(nodeId, fId);
              }
              hideContextMenu();
            },
          });
        }
      }

      items.push(
        { label: "", separator: true },
        {
          label: "Duplicate",
          icon: Copy,
          shortcut: "\u2318D",
          onClick: () => {
            executeDuplicate(
              state,
              actions,
              nodeType,
              nodeId,
              registry,
              dispatch,
            );
            hideContextMenu();
          },
        },
        {
          label: "Delete",
          icon: Trash2,
          shortcut: "Del",
          danger: true,
          onClick: () => {
            executeDelete(state, actions, nodeType, nodeId, registry, dispatch);
            hideContextMenu();
          },
        },
        {
          label: "Create Prefab",
          icon: Package,
          onClick: () => {
            const name = executeCreatePrefab(state, actions, [
              { type: nodeType, id: nodeId },
            ]);
            if (!name) {
              console.warn("[Outliner] Failed to create prefab from selection");
            }
            hideContextMenu();
          },
        },
      );
    }

    // Always offer "Create Folder" at the bottom
    items.push(
      { label: "", separator: true },
      {
        label: "Create Folder",
        icon: FolderPlus,
        onClick: () => {
          handleCreateFolder();
          hideContextMenu();
        },
      },
    );

    return items;
  }, [
    contextNode,
    state,
    actions,
    hideContextMenu,
    customFolders,
    handleCreateFolder,
    handleDeleteFolder,
    handleRenameFolder,
    handleMoveToFolder,
    handleRemoveFromFolder,
  ]);

  const handleToggleVisibility = useCallback((nodeId: string) => {
    setVisibilityMap((prev) => {
      const next = new Map(prev);
      const current = next.get(nodeId);
      next.set(nodeId, current === false ? true : false);
      return next;
    });
  }, []);

  const handleLayerToggle = useCallback((layerId: string) => {
    setLayerVisibility((prev) => {
      const next = {
        ...prev,
        [layerId]: prev[layerId] === false ? true : false,
      };
      saveLayerVisibility(next);
      return next;
    });
  }, []);

  // Filter hierarchy nodes by active layer visibility
  // Build set of entity IDs that are in folders for efficient lookup
  const folderEntityIds = useMemo(() => {
    const ids = new Set<string>();
    for (const folder of customFolders.values()) {
      for (const eid of folder.entityIds) ids.add(eid);
    }
    return ids;
  }, [customFolders]);

  const filteredTree = useMemo(() => {
    const hiddenTypes = new Set<string>();
    for (const layer of LAYERS) {
      if (layerVisibility[layer.id] === false) {
        for (const t of layer.types) hiddenTypes.add(t);
      }
    }

    const baseTree = hierarchyTree;
    if (!baseTree) return null;

    // Step 1: Filter by hidden layer types
    const filterNode = (node: HierarchyNode): HierarchyNode | null => {
      if (hiddenTypes.has(node.type)) return null;
      if (!node.children) return node;
      const filtered = node.children
        .map(filterNode)
        .filter(Boolean) as HierarchyNode[];
      return { ...node, children: filtered };
    };
    const layerFiltered =
      hiddenTypes.size === 0 ? baseTree : filterNode(baseTree);
    if (!layerFiltered) return null;

    // Step 2: Inject custom folder nodes into the tree
    if (customFolders.size === 0) return layerFiltered;

    // Collect leaf nodes that are in folders by walking the tree
    const collectLeafNodes = (
      node: HierarchyNode,
    ): Map<string, HierarchyNode> => {
      const map = new Map<string, HierarchyNode>();
      const walk = (n: HierarchyNode) => {
        if (n.dataId && folderEntityIds.has(n.dataId)) {
          map.set(n.dataId, n);
        }
        n.children?.forEach(walk);
      };
      walk(node);
      return map;
    };
    const leafMap = collectLeafNodes(layerFiltered);

    // Remove folder-assigned entities from their original position in the tree
    const stripFolderEntities = (node: HierarchyNode): HierarchyNode => {
      if (!node.children || node.children.length === 0) return node;
      const filtered = node.children
        .filter((child) => !(child.dataId && folderEntityIds.has(child.dataId)))
        .map(stripFolderEntities);
      return { ...node, children: filtered };
    };
    const strippedTree = stripFolderEntities(layerFiltered);

    // Build folder hierarchy nodes
    const folderNodes: HierarchyNode[] = [];
    for (const [fId, folder] of customFolders) {
      const childNodes: HierarchyNode[] = [];
      for (const entityId of folder.entityIds) {
        const leaf = leafMap.get(entityId);
        if (leaf) childNodes.push(leaf);
      }
      folderNodes.push({
        id: fId,
        label: folder.name,
        type: "folder",
        children: childNodes,
        badge: childNodes.length,
        expandable: true,
      });
    }

    // Insert folder nodes at the beginning of the root's children
    return {
      ...strippedTree,
      children: [...folderNodes, ...strippedTree.children],
    };
  }, [hierarchyTree, layerVisibility, customFolders, folderEntityIds]);

  // Auto-scroll to selected item
  useEffect(() => {
    if (!selectedId || !scrollContainerRef.current) return;
    const target = scrollContainerRef.current.querySelector(
      `[data-outliner-id="${selectedId}"]`,
    );
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedId]);

  // Validation issues — map entry IDs to highlight in tree
  const validationIssues = useManifestValidation();
  const validationIssueIds = useMemo(
    () => new Set<string>(validationIssues.map((issue) => issue.entryId)),
    [validationIssues],
  );

  // Entity count
  const entityCount = useMemo(() => {
    const ext = state.extendedLayers;
    return (
      (ext.spawnPoints?.length ?? 0) +
      (ext.teleports?.length ?? 0) +
      (ext.mobSpawns?.length ?? 0) +
      (ext.resources?.length ?? 0) +
      (ext.stations?.length ?? 0) +
      (ext.pois?.length ?? 0) +
      (ext.waterBodies?.length ?? 0) +
      (ext.customAssets?.length ?? 0)
    );
  }, [state.extendedLayers]);

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{
          borderBottom: "1px solid var(--border-primary)",
          background: "var(--bg-tertiary)",
          borderTop: "1px solid var(--surface-highlight)",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Outliner
          </span>
          <span className="text-[9px] text-text-tertiary tabular-nums">
            {entityCount}
          </span>
        </div>
        <div className="flex items-center gap-1 relative">
          <button
            className="p-1 rounded transition-colors text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary"
            onClick={handleCreateFolder}
            title="New Folder"
          >
            <FolderPlus size={12} />
          </button>
          <button
            className={`p-1 rounded transition-colors ${showFilterDropdown ? "text-primary bg-primary/10" : "text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary"}`}
            onClick={() => setShowFilterDropdown((v) => !v)}
            title="Filter by category"
          >
            <Filter size={12} />
          </button>
          {showFilterDropdown && (
            <div
              className="absolute right-0 top-full mt-1 z-50 bg-bg-elevated border border-border-secondary rounded-lg py-1 min-w-[180px] ws-dropdown"
              style={{
                borderTop: "1px solid var(--surface-highlight-strong)",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
              }}
            >
              {CATEGORY_FILTERS.map((f) => (
                <button
                  key={f.id}
                  className={`w-full px-3 py-1 text-left text-xs transition-colors ${
                    activeFilter === f.id
                      ? "text-primary bg-primary/10"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
                  }`}
                  onClick={() => {
                    setActiveFilter(f.id);
                    setShowFilterDropdown(false);
                  }}
                >
                  {f.label}
                </button>
              ))}
              {/* Separator */}
              <div className="border-t border-border-secondary my-1" />
              <div className="px-3 py-1 text-[10px] text-text-tertiary uppercase tracking-wider">
                Layers
              </div>
              {LAYERS.map((layer) => {
                const LayerIcon = layer.icon;
                const isLayerVisible = layerVisibility[layer.id] !== false;
                return (
                  <button
                    key={layer.id}
                    className="w-full px-3 py-1 text-left text-xs transition-colors text-text-secondary hover:text-text-primary hover:bg-bg-tertiary flex items-center gap-2"
                    onClick={() => handleLayerToggle(layer.id)}
                  >
                    {isLayerVisible ? (
                      <Eye
                        size={11}
                        className="text-text-tertiary flex-shrink-0"
                      />
                    ) : (
                      <EyeOff
                        size={11}
                        className="text-amber-400 flex-shrink-0"
                      />
                    )}
                    <LayerIcon
                      size={11}
                      className="flex-shrink-0"
                      style={{
                        color: getTypeIconColor(layer.types[0], registry),
                      }}
                    />
                    <span className={!isLayerVisible ? "opacity-50" : ""}>
                      {layer.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Search with clear button */}
      <div
        className="px-2 py-1.5"
        style={{ borderBottom: "1px solid var(--border-primary)" }}
      >
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary"
          />
          <input
            type="text"
            placeholder="Search... (-term to exclude)"
            className="w-full pl-6 pr-7 py-1 text-xs rounded-[3px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary/50"
            style={{
              background: "var(--input-bg)",
              border: "1px solid var(--input-border)",
              boxShadow: "var(--input-shadow)",
            }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          {searchText && (
            <button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-text-tertiary hover:text-text-primary"
              onClick={() => setSearchText("")}
            >
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Inline new folder input */}
      {isCreatingFolder && (
        <div className="px-2 py-1.5 border-b border-border-primary bg-primary/5">
          <div className="flex items-center gap-1.5">
            <Folder size={12} className="text-primary flex-shrink-0" />
            <input
              ref={newFolderInputRef}
              type="text"
              placeholder="Folder name..."
              className="flex-1 px-2 py-0.5 text-xs bg-bg-tertiary rounded-sm border border-primary/50 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmNewFolder();
                if (e.key === "Escape") handleCancelNewFolder();
              }}
              onBlur={handleConfirmNewFolder}
            />
          </div>
        </div>
      )}

      {/* Inline rename folder input */}
      {renamingFolderId && (
        <div className="px-2 py-1.5 border-b border-border-primary bg-primary/5">
          <div className="flex items-center gap-1.5">
            <Pencil size={12} className="text-primary flex-shrink-0" />
            <input
              ref={renameFolderInputRef}
              type="text"
              placeholder="Rename folder..."
              className="flex-1 px-2 py-0.5 text-xs bg-bg-tertiary rounded-sm border border-primary/50 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-primary"
              value={renameFolderName}
              onChange={(e) => setRenameFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmRenameFolder();
                if (e.key === "Escape") setRenamingFolderId(null);
              }}
              onBlur={handleConfirmRenameFolder}
            />
          </div>
        </div>
      )}

      {/* Multi-select indicator */}
      {multiSelection.length > 0 && (
        <div className="px-3 py-1 border-b border-border-primary bg-primary/5 flex items-center justify-between">
          <span className="text-[10px] text-primary font-medium">
            {multiSelection.length} selected
          </span>
          <button
            className="text-[10px] text-text-tertiary hover:text-text-primary"
            onClick={clearMulti}
          >
            Clear
          </button>
        </div>
      )}

      {/* Tree content */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto py-0.5 scrollbar-thin"
      >
        {filteredTree ? (
          <OutlinerNode
            node={filteredTree}
            depth={0}
            expandedNodes={expandedNodes}
            selectedId={selectedId}
            multiSelectedIds={multiSelectedIds}
            visibilityMap={visibilityMap}
            validationIssueIds={validationIssueIds}
            registry={registry}
            onToggle={handleToggle}
            onSelect={handleSelect}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            onToggleVisibility={handleToggleVisibility}
            searchQuery={searchQuery}
          />
        ) : (
          <div className="flex items-center justify-center h-32 text-text-tertiary text-xs">
            No world loaded
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="px-3 py-1.5 text-[10px] text-text-tertiary flex items-center gap-2"
        style={{
          borderTop: "1px solid var(--border-primary)",
          background: "var(--bg-tertiary)",
        }}
      >
        {activeFilter !== "all" && (
          <span className="text-primary">
            Filter: {CATEGORY_FILTERS.find((f) => f.id === activeFilter)?.label}
          </span>
        )}
        {Object.values(layerVisibility).some((v) => v === false) && (
          <span className="text-amber-400 flex items-center gap-0.5">
            <EyeOff size={9} />
            {
              Object.values(layerVisibility).filter((v) => v === false).length
            }{" "}
            layer
            {Object.values(layerVisibility).filter((v) => v === false)
              .length !== 1
              ? "s"
              : ""}{" "}
            hidden
          </span>
        )}
        {validationIssues.length > 0 && (
          <span className="text-amber-400 flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
            {validationIssues.length} issue
            {validationIssues.length !== 1 ? "s" : ""}
          </span>
        )}
        <span className="ml-auto">Ctrl+Click to multi-select</span>
      </div>

      {/* Context menu */}
      {contextMenu.visible && (
        <ContextMenu
          items={contextMenuItems}
          position={contextMenu.position}
          onClose={hideContextMenu}
        />
      )}
    </div>
  );
});

// ============== HELPER ==============

/**
 * Build the "AI Generated" outliner subtree from the agent's
 * world-content store. Returns null when nothing is present, so
 * the folder doesn't render an empty heading.
 *
 * This is a pure function over the agentWorldContent snapshot —
 * the outliner's `useMemo` invalidates when the snapshot changes
 * (the store guarantees reference stability per `notify()`).
 */
function buildAgentContentNode(
  content: ReturnType<typeof useAgentWorldContent>,
): HierarchyNode | null {
  // P0.5.b of PLAN_AGENT_STUDIO_PARITY — placement kinds (npcs,
  // spawns, resources, stations, teleports) no longer flow
  // through agentWorldContent. They live in `extendedLayers`
  // alongside designer + procgen entries (P0.3 emit + P0.6
  // rehydrate) and render in the studio's existing "Game
  // Entities" subtree, color-coded by `source: "agent"` via the
  // SourceIndicator (P0.4). This subtree now only surfaces the
  // two kinds without a Placed* counterpart yet — quests + zones
  // — until P0.7+ migrates them too.
  const totalCount = content.quests.size + content.zones.size;
  if (totalCount === 0) return null;

  const folders: HierarchyNode[] = [];
  if (content.quests.size > 0) {
    folders.push({
      id: "ai-quests",
      label: "Quests",
      // Reusing "pois" type here is harmless — the outliner uses it
      // for icon resolution; PoI's scroll-icon fits a quest visually.
      type: "pois" as const,
      badge: content.quests.size,
      expandable: true,
      children: Array.from(content.quests.values()).map((quest) => ({
        id: `ai-quest-${quest.id}`,
        label: quest.name ?? quest.id,
        type: "poi" as const,
        children: [],
        dataId: quest.id,
        expandable: false,
        metadata: {
          difficulty: quest.difficulty,
          stages: quest.stages.length,
          source: "agent",
        },
      })),
    });
  }
  if (content.zones.size > 0) {
    folders.push({
      id: "ai-zones",
      label: "Zones",
      type: "regions" as const,
      badge: content.zones.size,
      expandable: true,
      children: Array.from(content.zones.values()).map((zone) => ({
        id: `ai-zone-${zone.id}`,
        label: zone.name,
        type: "region" as const,
        children: [],
        dataId: zone.id,
        expandable: false,
        metadata: {
          biomeType: zone.biomeType,
          difficulty: zone.difficultyLevel,
          source: "agent",
        },
      })),
    });
  }

  return {
    id: "ai-generated",
    label: "AI Generated",
    type: "gameEntities" as const,
    children: folders,
    badge: totalCount,
    expandable: true,
    metadata: { source: "agent" },
  };
}

function findEntityPosition(
  state: ReturnType<typeof useWorldStudio>["state"],
  type: string,
  id: string,
): { x: number; y: number; z: number; close?: boolean } | null {
  const ext = state.extendedLayers;
  const world = state.builder.editing.world;

  type HasPosition = { position?: { x: number; y: number; z: number } };
  type HasId = { id: string };

  // Search through entity lists for matching id and extract position
  const lists: Record<string, (HasId & HasPosition)[]> = {
    spawnPoint: ext.spawnPoints as (HasId & HasPosition)[],
    teleport: ext.teleports as (HasId & HasPosition)[],
    mobSpawn: ext.mobSpawns as (HasId & HasPosition)[],
    resource: ext.resources as (HasId & HasPosition)[],
    station: ext.stations as (HasId & HasPosition)[],
    poi: ext.pois as (HasId & HasPosition)[],
    customAsset: ext.customAssets as (HasId & HasPosition)[],
  };

  const list = lists[type];
  if (list) {
    const entity = list.find((e) => e.id === id);
    if (entity?.position) return { ...entity.position, close: true };
  }

  // Towns have a position field
  if (type === "town" && world) {
    const town = world.foundation.towns.find((t) => t.id === id);
    if (town?.position) return town.position;
  }

  // Biomes: use centroid of assigned tiles (biome.center can be in ocean for island maps)
  if (type === "biome" && world) {
    const biome = world.foundation.biomes.find((b) => b.id === id);
    if (biome) {
      if (biome.tileKeys.length > 0) {
        const ts = world.foundation.config.terrain.tileSize;
        let sumX = 0;
        let sumZ = 0;
        for (const key of biome.tileKeys) {
          const [tx, tz] = key.split(",").map(Number);
          sumX += tx * ts;
          sumZ += tz * ts;
        }
        return {
          x: sumX / biome.tileKeys.length,
          y: 0,
          z: sumZ / biome.tileKeys.length,
        };
      }
      if (biome.center) return biome.center;
    }
  }

  // Buildings: look up parent town position as fallback
  if (type === "building" && world) {
    const building = world.foundation.buildings.find((b) => b.id === id);
    if (building?.position) return { ...building.position, close: true };
  }

  // Game manifest entities — positions are in game-centered coords, need offset to render coords
  const ge = state.gameEntities;
  if (ge) {
    const gameTypeLists: Record<
      string,
      Array<{ entityId: string; position: { x: number; z: number } }>
    > = {
      gameNpc: ge.npcs,
      gameStation: ge.stations,
      gameResource: ge.resources,
      gameMobSpawn: ge.mobSpawns,
    };
    const gameList = gameTypeLists[type];
    if (gameList) {
      const entity = gameList.find((e) => e.entityId === id);
      if (entity) {
        const cfg = world?.foundation.config.terrain;
        const offset = cfg ? (cfg.worldSize * cfg.tileSize) / 2 : 0;
        return {
          x: entity.position.x + offset,
          y: 0,
          z: entity.position.z + offset,
          close: true,
        };
      }
    }
  }

  return null;
}
