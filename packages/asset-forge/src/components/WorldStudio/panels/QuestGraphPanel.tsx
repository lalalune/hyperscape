/**
 * QuestGraphPanel — Visual DAG of quest dependencies
 *
 * Renders quest prerequisite chains as a directed acyclic graph using SVG.
 * Inspired by UE5 Blueprint / quest graph editors.
 *
 * Layout algorithm:
 * 1. Build adjacency list from quest.requirements?.quests[]
 * 2. Topological layering (depth-first) to determine column
 * 3. Within each layer, sort alphabetically
 * 4. Position nodes on a grid: x = layer * SPACING_X, y = index * SPACING_Y
 */

import { ZoomIn, ZoomOut, Maximize2, Search, Filter, X } from "lucide-react";
import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";

import type { ManifestQuest } from "../types";
import { useWorldStudio } from "../WorldStudioContext";

// ============== CONSTANTS ==============

const NODE_WIDTH = 160;
const NODE_HEIGHT = 60;
const NODE_SPACING_X = 220;
const NODE_SPACING_Y = 80;
const GRAPH_PADDING = 40;

const DIFFICULTY_COLORS: Record<string, string> = {
  novice: "#28D47A",
  intermediate: "#2D8CFF",
  advanced: "#FF7A00",
  expert: "#E84A4A",
  master: "#a855f7",
};

const DIFFICULTY_ORDER = [
  "novice",
  "intermediate",
  "advanced",
  "expert",
  "master",
];

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.15;

// ============== GRAPH LAYOUT TYPES ==============

interface GraphNode {
  quest: ManifestQuest;
  layer: number;
  indexInLayer: number;
  x: number;
  y: number;
}

interface GraphEdge {
  fromId: string;
  toId: string;
  fromNode: GraphNode;
  toNode: GraphNode;
}

interface GraphLayout {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  width: number;
  height: number;
  layerCount: number;
  chainCount: number;
  orphanCount: number;
}

// ============== GRAPH LAYOUT ALGORITHM ==============

function buildGraphLayout(quests: ManifestQuest[]): GraphLayout {
  if (quests.length === 0) {
    return {
      nodes: new Map(),
      edges: [],
      width: 0,
      height: 0,
      layerCount: 0,
      chainCount: 0,
      orphanCount: 0,
    };
  }

  const questMap = new Map<string, ManifestQuest>();
  for (const q of quests) {
    questMap.set(q.id, q);
  }

  // Build forward adjacency: prerequisite -> dependent
  // And reverse adjacency: dependent -> prerequisites
  const dependents = new Map<string, string[]>(); // prereq -> quests that depend on it
  const prerequisites = new Map<string, string[]>(); // quest -> its prerequisites

  for (const q of quests) {
    const reqs = (q.requirements?.quests ?? []).filter((rid) =>
      questMap.has(rid),
    );
    prerequisites.set(q.id, reqs);
    for (const req of reqs) {
      const existing = dependents.get(req) ?? [];
      existing.push(q.id);
      dependents.set(req, existing);
    }
  }

  // Compute layers via longest path from roots (topological layering)
  const layerOf = new Map<string, number>();

  function computeLayer(id: string, visited: Set<string>): number {
    const cached = layerOf.get(id);
    if (cached !== undefined) return cached;

    // Cycle protection
    if (visited.has(id)) return 0;
    visited.add(id);

    const reqs = prerequisites.get(id) ?? [];
    if (reqs.length === 0) {
      layerOf.set(id, 0);
      return 0;
    }

    let maxParent = 0;
    for (const req of reqs) {
      maxParent = Math.max(maxParent, computeLayer(req, visited));
    }
    const layer = maxParent + 1;
    layerOf.set(id, layer);
    return layer;
  }

  for (const q of quests) {
    computeLayer(q.id, new Set());
  }

  // Group by layer
  const layers = new Map<number, ManifestQuest[]>();
  let maxLayer = 0;

  for (const q of quests) {
    const layer = layerOf.get(q.id) ?? 0;
    maxLayer = Math.max(maxLayer, layer);
    const arr = layers.get(layer) ?? [];
    arr.push(q);
    layers.set(layer, arr);
  }

  // Sort within each layer alphabetically
  for (const [, layerQuests] of layers) {
    layerQuests.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Position nodes
  const nodes = new Map<string, GraphNode>();
  let maxY = 0;

  for (let layer = 0; layer <= maxLayer; layer++) {
    const layerQuests = layers.get(layer) ?? [];
    for (let idx = 0; idx < layerQuests.length; idx++) {
      const quest = layerQuests[idx];
      const x = GRAPH_PADDING + layer * NODE_SPACING_X;
      const y = GRAPH_PADDING + idx * NODE_SPACING_Y;
      maxY = Math.max(maxY, y + NODE_HEIGHT);
      nodes.set(quest.id, { quest, layer, indexInLayer: idx, x, y });
    }
  }

  // Build edges
  const edges: GraphEdge[] = [];
  for (const q of quests) {
    const toNode = nodes.get(q.id);
    if (!toNode) continue;
    const reqs = prerequisites.get(q.id) ?? [];
    for (const reqId of reqs) {
      const fromNode = nodes.get(reqId);
      if (fromNode) {
        edges.push({ fromId: reqId, toId: q.id, fromNode, toNode });
      }
    }
  }

  // Count chains (connected components) and orphans (no edges at all)
  const visited = new Set<string>();
  let chainCount = 0;
  let orphanCount = 0;

  // Build undirected adjacency for component counting
  const undirectedAdj = new Map<string, Set<string>>();
  for (const q of quests) {
    undirectedAdj.set(q.id, new Set());
  }
  for (const edge of edges) {
    undirectedAdj.get(edge.fromId)?.add(edge.toId);
    undirectedAdj.get(edge.toId)?.add(edge.fromId);
  }

  for (const q of quests) {
    if (visited.has(q.id)) continue;
    const neighbors = undirectedAdj.get(q.id) ?? new Set();
    if (neighbors.size === 0) {
      orphanCount++;
      visited.add(q.id);
      continue;
    }

    // BFS to mark component
    chainCount++;
    const queue = [q.id];
    visited.add(q.id);
    while (queue.length > 0) {
      const curr = queue.pop()!;
      for (const neighbor of undirectedAdj.get(curr) ?? new Set()) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  const width = GRAPH_PADDING * 2 + (maxLayer + 1) * NODE_SPACING_X;
  const height = maxY + GRAPH_PADDING;

  return {
    nodes,
    edges,
    width,
    height,
    layerCount: maxLayer + 1,
    chainCount,
    orphanCount,
  };
}

// ============== SVG HELPERS ==============

/** Build a cubic bezier path from the right edge of source to left edge of target */
function edgePath(from: GraphNode, to: GraphNode): string {
  const x1 = from.x + NODE_WIDTH;
  const y1 = from.y + NODE_HEIGHT / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_HEIGHT / 2;
  const cpOffset = Math.min(NODE_SPACING_X / 2, Math.abs(x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + cpOffset} ${y1}, ${x2 - cpOffset} ${y2}, ${x2} ${y2}`;
}

/** Truncate text to fit within a width (approximate) */
function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1) + "\u2026";
}

// ============== QUEST DETAIL PANEL ==============

function QuestDetailPanel({
  quest,
  onClose,
}: {
  quest: ManifestQuest;
  onClose: () => void;
}) {
  const diffColor = DIFFICULTY_COLORS[quest.difficulty] ?? "#7A7A82";

  return (
    <div className="border-t border-border-primary bg-bg-tertiary/50 p-3 space-y-2 text-xs">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-text-primary font-medium text-sm">
            {quest.name}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{ backgroundColor: diffColor + "20", color: diffColor }}
            >
              {quest.difficulty}
            </span>
            <span className="text-text-tertiary">{quest.questPoints} QP</span>
            {quest.startNpc && (
              <span className="text-text-tertiary">
                Start: {quest.startNpc}
              </span>
            )}
          </div>
        </div>
        <button
          className="p-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          onClick={onClose}
        >
          <X size={12} />
        </button>
      </div>

      {/* Description */}
      <div className="text-text-secondary">{quest.description}</div>

      {/* Requirements */}
      {quest.requirements && (
        <div>
          <div className="text-text-tertiary font-medium mb-1">
            Requirements
          </div>
          <div className="space-y-0.5 pl-2">
            {quest.requirements.quests &&
              quest.requirements.quests.length > 0 && (
                <div className="text-text-secondary">
                  Quests: {quest.requirements.quests.join(", ")}
                </div>
              )}
            {quest.requirements.skills &&
              Object.keys(quest.requirements.skills).length > 0 && (
                <div className="text-text-secondary">
                  Skills:{" "}
                  {Object.entries(quest.requirements.skills)
                    .map(([skill, level]) => `${skill} ${level}`)
                    .join(", ")}
                </div>
              )}
            {quest.requirements.items &&
              quest.requirements.items.length > 0 && (
                <div className="text-text-secondary">
                  Items: {quest.requirements.items.join(", ")}
                </div>
              )}
          </div>
        </div>
      )}

      {/* Stages */}
      {quest.stages.length > 0 && (
        <div>
          <div className="text-text-tertiary font-medium mb-1">
            Stages ({quest.stages.length})
          </div>
          <div className="space-y-0.5 pl-2">
            {quest.stages.map((stage, idx) => (
              <div key={stage.id} className="text-text-secondary">
                <span className="text-text-tertiary">{idx + 1}.</span>{" "}
                <span className="text-text-tertiary/80">[{stage.type}]</span>{" "}
                {stage.description}
                {stage.target && (
                  <span className="text-text-tertiary">
                    {" "}
                    ({stage.target}
                    {stage.count ? ` x${stage.count}` : ""})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rewards */}
      {quest.rewards && (
        <div>
          <div className="text-text-tertiary font-medium mb-1">Rewards</div>
          <div className="space-y-0.5 pl-2">
            {quest.rewards.questPoints !== undefined &&
              quest.rewards.questPoints > 0 && (
                <div className="text-text-secondary">
                  Quest Points: {quest.rewards.questPoints}
                </div>
              )}
            {quest.rewards.items && quest.rewards.items.length > 0 && (
              <div className="text-text-secondary">
                Items:{" "}
                {quest.rewards.items
                  .map((item) => `${item.itemId} x${item.quantity}`)
                  .join(", ")}
              </div>
            )}
            {quest.rewards.xp && Object.keys(quest.rewards.xp).length > 0 && (
              <div className="text-text-secondary">
                XP:{" "}
                {Object.entries(quest.rewards.xp)
                  .map(([skill, xp]) => `${skill} ${xp}`)
                  .join(", ")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============== MAIN COMPONENT ==============

export const QuestGraphPanel = React.memo(function QuestGraphPanel() {
  const { state } = useWorldStudio();
  const quests = state.manifests.quests;

  // State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<Set<string>>(
    new Set(DIFFICULTY_ORDER),
  );
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  const svgContainerRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);

  // Filter quests by difficulty
  const filteredQuests = useMemo(() => {
    return quests.filter((q) => difficultyFilter.has(q.difficulty));
  }, [quests, difficultyFilter]);

  // Build graph layout
  const layout = useMemo(
    () => buildGraphLayout(filteredQuests),
    [filteredQuests],
  );

  // Search highlight set
  const highlightedIds = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const lower = searchQuery.toLowerCase();
    const ids = new Set<string>();
    for (const q of filteredQuests) {
      if (
        q.name.toLowerCase().includes(lower) ||
        q.id.toLowerCase().includes(lower)
      ) {
        ids.add(q.id);
      }
    }
    return ids;
  }, [searchQuery, filteredQuests]);

  // Selected quest object
  const selectedQuest = useMemo(() => {
    if (!selectedQuestId) return null;
    return quests.find((q) => q.id === selectedQuestId) ?? null;
  }, [selectedQuestId, quests]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP));
  }, []);

  const handleFitToView = useCallback(() => {
    if (!svgContainerRef.current || layout.width === 0 || layout.height === 0)
      return;
    const container = svgContainerRef.current;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const scaleX = cw / layout.width;
    const scaleY = ch / layout.height;
    const newZoom = Math.min(scaleX, scaleY, 1) * 0.9; // 90% to leave margin
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom)));
    setPan({ x: 0, y: 0 });
  }, [layout.width, layout.height]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
  }, []);

  // Pan via mouse drag on SVG background
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only pan on middle-click or left-click on background
      if (
        e.button === 1 ||
        (e.button === 0 && (e.target as HTMLElement).tagName === "svg")
      ) {
        e.preventDefault();
        setIsPanning(true);
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          panX: pan.x,
          panY: pan.y,
        };
      }
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!panStartRef.current || !isPanning) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      });
    },
    [isPanning],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    panStartRef.current = null;
  }, []);

  // Global mouse up to end pan even if mouse leaves the SVG
  useEffect(() => {
    const handleGlobalUp = () => {
      setIsPanning(false);
      panStartRef.current = null;
    };
    window.addEventListener("mouseup", handleGlobalUp);
    return () => window.removeEventListener("mouseup", handleGlobalUp);
  }, []);

  // Toggle difficulty filter
  const toggleDifficulty = useCallback((diff: string) => {
    setDifficultyFilter((prev) => {
      const next = new Set(prev);
      if (next.has(diff)) {
        next.delete(diff);
      } else {
        next.add(diff);
      }
      return next;
    });
  }, []);

  // Node click
  const handleNodeClick = useCallback((questId: string) => {
    setSelectedQuestId((prev) => (prev === questId ? null : questId));
  }, []);

  // Empty state
  if (quests.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-text-tertiary text-xs">
        No quests in manifests
      </div>
    );
  }

  // Stats
  const totalFiltered = filteredQuests.length;
  const totalQuests = quests.length;

  return (
    <div className="flex flex-col" style={{ minHeight: 300 }}>
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border-primary/50">
        {/* Search */}
        <div className="relative flex-1 max-w-[200px]">
          <Search
            size={10}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search quests..."
            className="w-full pl-5 pr-1.5 py-1 text-[10px] bg-bg-tertiary border border-border-primary rounded text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50"
          />
        </div>

        {/* Filter toggle */}
        <button
          className={`p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors ${showFilters ? "bg-bg-tertiary text-text-primary" : ""}`}
          onClick={() => setShowFilters((v) => !v)}
          title="Filter by difficulty"
        >
          <Filter size={12} />
        </button>

        <div className="w-px h-4 bg-border-primary/50" />

        {/* Zoom controls */}
        <button
          className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          onClick={handleZoomOut}
          title="Zoom out"
        >
          <ZoomOut size={12} />
        </button>
        <span className="text-[10px] text-text-tertiary w-8 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          onClick={handleZoomIn}
          title="Zoom in"
        >
          <ZoomIn size={12} />
        </button>
        <button
          className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          onClick={handleFitToView}
          title="Fit to view"
        >
          <Maximize2 size={12} />
        </button>

        <div className="w-px h-4 bg-border-primary/50" />

        {/* Stats */}
        <span className="text-[10px] text-text-tertiary whitespace-nowrap">
          {totalFiltered === totalQuests
            ? totalQuests
            : `${totalFiltered}/${totalQuests}`}{" "}
          quests
          {layout.chainCount > 0 && (
            <>
              , {layout.chainCount} chain{layout.chainCount !== 1 ? "s" : ""}
            </>
          )}
          {layout.orphanCount > 0 && (
            <>
              , {layout.orphanCount} orphan{layout.orphanCount !== 1 ? "s" : ""}
            </>
          )}
        </span>
      </div>

      {/* Difficulty filter bar */}
      {showFilters && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-border-primary/50">
          {DIFFICULTY_ORDER.map((diff) => {
            const active = difficultyFilter.has(diff);
            const color = DIFFICULTY_COLORS[diff];
            return (
              <button
                key={diff}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border ${
                  active
                    ? "border-transparent"
                    : "border-border-primary opacity-40"
                }`}
                style={
                  active ? { backgroundColor: color + "20", color } : { color }
                }
                onClick={() => toggleDifficulty(diff)}
              >
                {diff}
              </button>
            );
          })}
        </div>
      )}

      {/* SVG Graph */}
      <div
        ref={svgContainerRef}
        className="flex-1 overflow-hidden bg-bg-primary/50"
        style={{ minHeight: 200, cursor: isPanning ? "grabbing" : "grab" }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <svg width="100%" height="100%" style={{ display: "block" }}>
          <defs>
            {/* Arrowhead marker */}
            <marker
              id="quest-graph-arrow"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#7A7A82" />
            </marker>
            <marker
              id="quest-graph-arrow-highlight"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#2D8CFF" />
            </marker>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Edges */}
            {layout.edges.map((edge) => {
              const isConnectedToSelected =
                selectedQuestId === edge.fromId ||
                selectedQuestId === edge.toId;
              const isSearchDimmed =
                highlightedIds !== null &&
                !highlightedIds.has(edge.fromId) &&
                !highlightedIds.has(edge.toId);

              return (
                <path
                  key={`${edge.fromId}-${edge.toId}`}
                  d={edgePath(edge.fromNode, edge.toNode)}
                  fill="none"
                  stroke={isConnectedToSelected ? "#2D8CFF" : "#7A7A82"}
                  strokeWidth={isConnectedToSelected ? 2 : 1}
                  strokeOpacity={
                    isSearchDimmed ? 0.15 : isConnectedToSelected ? 0.9 : 0.4
                  }
                  markerEnd={
                    isConnectedToSelected
                      ? "url(#quest-graph-arrow-highlight)"
                      : "url(#quest-graph-arrow)"
                  }
                />
              );
            })}

            {/* Nodes */}
            {Array.from(layout.nodes.values()).map((node) => {
              const q = node.quest;
              const diffColor = DIFFICULTY_COLORS[q.difficulty] ?? "#7A7A82";
              const isSelected = selectedQuestId === q.id;
              const isSearchMatch = highlightedIds?.has(q.id) ?? false;
              const isSearchDimmed =
                highlightedIds !== null && !highlightedIds.has(q.id);

              return (
                <g
                  key={q.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNodeClick(q.id);
                  }}
                  style={{ cursor: "pointer" }}
                  opacity={isSearchDimmed ? 0.25 : 1}
                >
                  {/* Node background */}
                  <rect
                    x={0}
                    y={0}
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx={6}
                    ry={6}
                    fill="#1e1e2e"
                    stroke={
                      isSelected
                        ? "#2D8CFF"
                        : isSearchMatch
                          ? "#FF7A00"
                          : "#3A3D45"
                    }
                    strokeWidth={isSelected ? 2 : 1}
                  />

                  {/* Difficulty color bar (left edge) */}
                  <rect
                    x={0}
                    y={0}
                    width={4}
                    height={NODE_HEIGHT}
                    rx={2}
                    fill={diffColor}
                  />
                  {/* Clip the left side rounded corners */}
                  <rect
                    x={2}
                    y={1}
                    width={2}
                    height={NODE_HEIGHT - 2}
                    fill={diffColor}
                  />

                  {/* Quest name */}
                  <text
                    x={12}
                    y={22}
                    fill="#e5e7eb"
                    fontSize={11}
                    fontWeight={500}
                    fontFamily="system-ui, sans-serif"
                  >
                    {truncateText(q.name, 18)}
                  </text>

                  {/* Badges row */}
                  {/* Stage count */}
                  <rect
                    x={12}
                    y={32}
                    width={28}
                    height={16}
                    rx={3}
                    fill="#3A3D45"
                  />
                  <text
                    x={26}
                    y={43}
                    fill="#A8A8B0"
                    fontSize={9}
                    textAnchor="middle"
                    fontFamily="system-ui, sans-serif"
                  >
                    {q.stages.length}s
                  </text>

                  {/* Quest points */}
                  <rect
                    x={44}
                    y={32}
                    width={32}
                    height={16}
                    rx={3}
                    fill="#3A3D45"
                  />
                  <text
                    x={60}
                    y={43}
                    fill="#A8A8B0"
                    fontSize={9}
                    textAnchor="middle"
                    fontFamily="system-ui, sans-serif"
                  >
                    {q.questPoints}qp
                  </text>

                  {/* Hover tooltip via SVG title */}
                  <title>
                    {q.name}
                    {"\n"}
                    {q.description}
                    {"\n"}
                    Difficulty: {q.difficulty} | Stages: {q.stages.length} | QP:{" "}
                    {q.questPoints}
                  </title>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Selected quest detail */}
      {selectedQuest && (
        <QuestDetailPanel
          quest={selectedQuest}
          onClose={() => setSelectedQuestId(null)}
        />
      )}
    </div>
  );
});
