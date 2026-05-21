/**
 * DialogueEditor — Reusable tree editor for NPC dialogue manifests.
 *
 * Used by both `GameNPCProperties` (for manifest-based NPCs) and `NPCProperties`
 * (for placed custom NPCs). Produces an `NPCDialogueTree`-shaped structure:
 * { entryNodeId, nodes: [{ id, text, effect?, responses: [{ text, nextNodeId?, effect?, condition? }] }] }
 */

import {
  MessageSquare,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  GitBranch,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import type { NPCManifestOverride } from "../../types";
import { PropertySection, TextInput } from "./PropertyControls";

export type DialogueData = NonNullable<NPCManifestOverride["dialogue"]>;

// =============================================================================
// Tree preview — compact SVG visualization of the dialogue graph
// =============================================================================

interface TreeLayoutNode {
  id: string;
  text: string;
  rank: number;
  col: number;
}

interface TreeLayoutEdge {
  from: string;
  to: string;
  label?: string;
}

/**
 * Layout the dialogue as ranked columns via BFS from the entry node.
 * Unreachable nodes fall into a trailing "orphan" rank.
 */
function layoutDialogue(dialogue: DialogueData): {
  nodes: TreeLayoutNode[];
  edges: TreeLayoutEdge[];
} {
  const rankOf = new Map<string, number>();
  const nodesById = new Map<string, DialogueData["nodes"][0]>();
  for (const n of dialogue.nodes) nodesById.set(n.id, n);

  // BFS ranks from entry
  const queue: string[] = [];
  if (nodesById.has(dialogue.entryNodeId)) {
    rankOf.set(dialogue.entryNodeId, 0);
    queue.push(dialogue.entryNodeId);
  }
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodesById.get(id);
    if (!node) continue;
    const r = rankOf.get(id) ?? 0;
    for (const resp of node.responses ?? []) {
      const next = resp.nextNodeId;
      if (!next || !nodesById.has(next)) continue;
      if (!rankOf.has(next)) {
        rankOf.set(next, r + 1);
        queue.push(next);
      }
    }
  }

  // Orphans — unranked nodes get a final rank
  const maxRank = Array.from(rankOf.values()).reduce(
    (a, b) => Math.max(a, b),
    -1,
  );
  for (const n of dialogue.nodes) {
    if (!rankOf.has(n.id)) rankOf.set(n.id, maxRank + 1);
  }

  // Assign column within each rank
  const rankBuckets = new Map<number, string[]>();
  for (const [id, r] of rankOf.entries()) {
    if (!rankBuckets.has(r)) rankBuckets.set(r, []);
    rankBuckets.get(r)!.push(id);
  }

  const nodes: TreeLayoutNode[] = [];
  for (const n of dialogue.nodes) {
    const rank = rankOf.get(n.id) ?? 0;
    const col = rankBuckets.get(rank)!.indexOf(n.id);
    nodes.push({ id: n.id, text: n.text, rank, col });
  }

  const edges: TreeLayoutEdge[] = [];
  for (const n of dialogue.nodes) {
    for (const r of n.responses ?? []) {
      if (r.nextNodeId && nodesById.has(r.nextNodeId)) {
        edges.push({ from: n.id, to: r.nextNodeId, label: r.text });
      }
    }
  }

  return { nodes, edges };
}

interface DialogueTreePreviewProps {
  dialogue: DialogueData;
  entryNodeId: string;
}

function DialogueTreePreview({
  dialogue,
  entryNodeId,
}: DialogueTreePreviewProps) {
  const { nodes, edges } = useMemo(() => layoutDialogue(dialogue), [dialogue]);

  // Dimensions
  const nodeW = 90;
  const nodeH = 28;
  const gapX = 40;
  const gapY = 18;
  const padX = 12;
  const padY = 12;

  const ranks = new Map<number, TreeLayoutNode[]>();
  for (const n of nodes) {
    if (!ranks.has(n.rank)) ranks.set(n.rank, []);
    ranks.get(n.rank)!.push(n);
  }
  const sortedRanks = Array.from(ranks.keys()).sort((a, b) => a - b);
  const maxNodesInAnyRank = sortedRanks.reduce(
    (acc, r) => Math.max(acc, ranks.get(r)!.length),
    0,
  );

  const width = padX * 2 + sortedRanks.length * (nodeW + gapX) - gapX;
  const height = padY * 2 + maxNodesInAnyRank * (nodeH + gapY) - gapY;

  function nodePosition(id: string): { x: number; y: number } | null {
    const n = nodes.find((m) => m.id === id);
    if (!n) return null;
    const rankIdx = sortedRanks.indexOf(n.rank);
    return {
      x: padX + rankIdx * (nodeW + gapX),
      y: padY + n.col * (nodeH + gapY),
    };
  }

  if (nodes.length === 0) {
    return (
      <div className="text-[10px] text-text-tertiary italic py-2">
        No nodes to visualize.
      </div>
    );
  }

  return (
    <div
      className="w-full overflow-auto"
      style={{
        maxHeight: 260,
        background: "var(--bg-tertiary)",
        borderRadius: 4,
        border: "1px solid var(--border-primary)",
      }}
    >
      <svg
        width={Math.max(width, 120)}
        height={Math.max(height, 60)}
        style={{ display: "block" }}
      >
        <defs>
          <marker
            id="dialogue-arrow"
            viewBox="0 0 8 8"
            refX={7}
            refY={4}
            markerWidth={6}
            markerHeight={6}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 8 4 L 0 8 z" fill="#64748b" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((e, i) => {
          const a = nodePosition(e.from);
          const b = nodePosition(e.to);
          if (!a || !b) return null;
          const x1 = a.x + nodeW;
          const y1 = a.y + nodeH / 2;
          const x2 = b.x;
          const y2 = b.y + nodeH / 2;
          const mx = (x1 + x2) / 2;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
              stroke="#64748b"
              strokeWidth={1}
              fill="none"
              markerEnd="url(#dialogue-arrow)"
              opacity={0.6}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((n) => {
          const isEntry = n.id === entryNodeId;
          const pos = nodePosition(n.id)!;
          const stroke = isEntry ? "#4FDD96" : "var(--border-primary)";
          const fill = isEntry
            ? "rgba(52, 211, 153, 0.12)"
            : "rgba(148, 163, 184, 0.08)";
          const textPreview =
            n.text.length > 14 ? n.text.slice(0, 12) + "…" : n.text;
          return (
            <g key={n.id} transform={`translate(${pos.x}, ${pos.y})`}>
              <rect
                width={nodeW}
                height={nodeH}
                rx={4}
                fill={fill}
                stroke={stroke}
                strokeWidth={isEntry ? 1.5 : 1}
              />
              <text
                x={6}
                y={11}
                fontSize={9}
                fontFamily="var(--font-mono)"
                fill="#c4b5fd"
              >
                {n.id}
              </text>
              <text x={6} y={22} fontSize={9} fill="var(--text-tertiary)">
                {textPreview}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

interface DialogueEditorProps {
  dialogue: DialogueData;
  /** Whether this editor is editing an override (vs reading the base manifest). Used to show "Reset to Base". */
  isOverridden?: boolean;
  onUpdate: (dialogue: DialogueData) => void;
  onReset?: () => void;
  /** Section title (default: "Dialogue"). */
  title?: string;
  /** Key for persisting open/closed state (default: "dialogue-editor"). */
  persistKey?: string;
  /** Whether the section is open by default (default: false). */
  defaultOpen?: boolean;
}

export function DialogueEditor({
  dialogue,
  isOverridden = false,
  onUpdate,
  onReset,
  title = "Dialogue",
  persistKey = "dialogue-editor",
  defaultOpen = false,
}: DialogueEditorProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showTree, setShowTree] = useState(false);

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const ensureOverride = useCallback((): DialogueData => {
    if (isOverridden) return dialogue;
    return JSON.parse(JSON.stringify(dialogue)) as DialogueData;
  }, [isOverridden, dialogue]);

  const setEntryNode = useCallback(
    (entryNodeId: string) => {
      const d = ensureOverride();
      onUpdate({ ...d, entryNodeId });
    },
    [ensureOverride, onUpdate],
  );

  const addNode = useCallback(() => {
    const d = ensureOverride();
    const id = `node_${d.nodes.length + 1}`;
    onUpdate({
      ...d,
      nodes: [...d.nodes, { id, text: "New dialogue...", responses: [] }],
    });
  }, [ensureOverride, onUpdate]);

  const updateNode = useCallback(
    (idx: number, updates: Partial<DialogueData["nodes"][0]>) => {
      const d = ensureOverride();
      onUpdate({
        ...d,
        nodes: d.nodes.map((n, i) => (i === idx ? { ...n, ...updates } : n)),
      });
    },
    [ensureOverride, onUpdate],
  );

  const deleteNode = useCallback(
    (idx: number) => {
      const d = ensureOverride();
      onUpdate({ ...d, nodes: d.nodes.filter((_, i) => i !== idx) });
    },
    [ensureOverride, onUpdate],
  );

  const addResponse = useCallback(
    (nodeIdx: number) => {
      const d = ensureOverride();
      const node = d.nodes[nodeIdx];
      onUpdate({
        ...d,
        nodes: d.nodes.map((n, i) =>
          i === nodeIdx
            ? {
                ...n,
                responses: [...(node.responses ?? []), { text: "Response..." }],
              }
            : n,
        ),
      });
    },
    [ensureOverride, onUpdate],
  );

  const updateResponse = useCallback(
    (nodeIdx: number, respIdx: number, updates: Record<string, unknown>) => {
      const d = ensureOverride();
      const node = d.nodes[nodeIdx];
      onUpdate({
        ...d,
        nodes: d.nodes.map((n, i) =>
          i === nodeIdx
            ? {
                ...n,
                responses: (node.responses ?? []).map((r, j) =>
                  j === respIdx ? { ...r, ...updates } : r,
                ),
              }
            : n,
        ),
      });
    },
    [ensureOverride, onUpdate],
  );

  const deleteResponse = useCallback(
    (nodeIdx: number, respIdx: number) => {
      const d = ensureOverride();
      const node = d.nodes[nodeIdx];
      onUpdate({
        ...d,
        nodes: d.nodes.map((n, i) =>
          i === nodeIdx
            ? {
                ...n,
                responses: (node.responses ?? []).filter(
                  (_, j) => j !== respIdx,
                ),
              }
            : n,
        ),
      });
    },
    [ensureOverride, onUpdate],
  );

  const allNodeIds = dialogue.nodes.map((n) => n.id);

  return (
    <PropertySection
      title={title}
      icon={<MessageSquare size={10} />}
      persistKey={persistKey}
      defaultOpen={defaultOpen}
      badge={dialogue.nodes.length}
    >
      {isOverridden && onReset && (
        <div className="flex justify-end mb-1">
          <button
            className="text-[9px] text-text-tertiary hover:text-primary transition-colors"
            onClick={onReset}
          >
            Reset to Base
          </button>
        </div>
      )}

      {/* Entry Node selector + tree-view toggle */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[9px] text-text-tertiary shrink-0">Entry:</span>
        <select
          className="ws-input flex-1"
          value={dialogue.entryNodeId}
          onChange={(e) => setEntryNode(e.target.value)}
          style={{ fontSize: 10, padding: "2px 6px" }}
        >
          {allNodeIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowTree((v) => !v)}
          className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] rounded border border-border-primary text-text-tertiary hover:text-text-secondary hover:border-text-tertiary transition-colors shrink-0"
          title={showTree ? "Hide tree preview" : "Show tree preview"}
        >
          <GitBranch size={9} />
          {showTree ? "Hide Tree" : "Tree"}
        </button>
      </div>

      {/* Tree preview */}
      {showTree && (
        <div className="mb-2">
          <DialogueTreePreview
            dialogue={dialogue}
            entryNodeId={dialogue.entryNodeId}
          />
        </div>
      )}

      {/* Dialogue Nodes */}
      {dialogue.nodes.map((node, idx) => {
        const isExpanded = expandedNodes.has(node.id);
        const textPreview =
          node.text.length > 35 ? node.text.slice(0, 35) + "..." : node.text;
        return (
          <div
            key={node.id}
            className="border-b border-border-primary/30 last:border-0"
          >
            {/* Node header */}
            <div
              className="flex items-center gap-1 py-1 cursor-pointer text-[10px] text-text-secondary hover:text-text-primary transition-colors"
              onClick={() => toggleNode(node.id)}
            >
              {isExpanded ? (
                <ChevronDown size={10} className="shrink-0" />
              ) : (
                <ChevronRight size={10} className="shrink-0" />
              )}
              <span className="font-mono text-[9px] text-primary/70 shrink-0">
                {node.id}
              </span>
              <span className="truncate text-text-tertiary">
                — {textPreview}
              </span>
              <button
                className="ml-auto p-0.5 text-text-tertiary hover:text-error transition-colors shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNode(idx);
                }}
                title="Delete node"
              >
                <Trash2 size={9} />
              </button>
            </div>

            {/* Node body (expanded) */}
            {isExpanded && (
              <div className="pl-4 pb-2 space-y-1.5">
                <TextInput
                  label="Node ID"
                  value={node.id}
                  onChange={(v) => updateNode(idx, { id: v })}
                />
                <div>
                  <div className="text-[9px] text-text-tertiary mb-0.5">
                    Text
                  </div>
                  <textarea
                    className="ws-input w-full resize-none"
                    rows={2}
                    value={node.text}
                    onChange={(e) => updateNode(idx, { text: e.target.value })}
                    style={{
                      fontSize: 10,
                      padding: "4px 6px",
                      lineHeight: 1.4,
                    }}
                  />
                </div>
                <TextInput
                  label="Effect"
                  value={node.effect ?? ""}
                  onChange={(v) => updateNode(idx, { effect: v || undefined })}
                />

                {/* Responses */}
                <div>
                  <div className="text-[9px] text-text-tertiary uppercase tracking-wider mb-1">
                    Responses ({node.responses?.length ?? 0})
                  </div>
                  {(node.responses ?? []).map((resp, rIdx) => (
                    <div
                      key={rIdx}
                      className="pl-2 py-1 border-l-2 border-border-primary/40 mb-1 space-y-1"
                    >
                      <div className="flex items-start gap-1">
                        <textarea
                          className="ws-input flex-1 resize-none"
                          rows={1}
                          value={resp.text}
                          onChange={(e) =>
                            updateResponse(idx, rIdx, {
                              text: e.target.value,
                            })
                          }
                          style={{ fontSize: 10, padding: "2px 6px" }}
                        />
                        <button
                          className="p-0.5 text-text-tertiary hover:text-error transition-colors shrink-0 mt-0.5"
                          onClick={() => deleteResponse(idx, rIdx)}
                          title="Remove response"
                        >
                          <Trash2 size={9} />
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-text-tertiary">→</span>
                        <select
                          className="ws-input flex-1"
                          value={resp.nextNodeId ?? ""}
                          onChange={(e) =>
                            updateResponse(idx, rIdx, {
                              nextNodeId: e.target.value || undefined,
                            })
                          }
                          style={{ fontSize: 10, padding: "2px 6px" }}
                        >
                          <option value="">(End)</option>
                          {allNodeIds.map((id) => (
                            <option key={id} value={id}>
                              {id}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <TextInput
                          label="Effect"
                          value={resp.effect ?? ""}
                          onChange={(v) =>
                            updateResponse(idx, rIdx, {
                              effect: v || undefined,
                            })
                          }
                        />
                        <TextInput
                          label="Condition"
                          value={resp.condition ?? ""}
                          onChange={(v) =>
                            updateResponse(idx, rIdx, {
                              condition: v || undefined,
                            })
                          }
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    className="w-full flex items-center justify-center gap-1 py-1 text-[9px] text-text-tertiary hover:text-text-secondary transition-colors"
                    onClick={() => addResponse(idx)}
                  >
                    <Plus size={8} /> Add Response
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add Node button */}
      <button
        className="w-full flex items-center justify-center gap-1 px-2 py-1.5 mt-1 text-[10px] rounded border border-dashed border-border-primary text-text-tertiary hover:text-text-secondary hover:border-text-tertiary transition-colors"
        onClick={addNode}
      >
        <Plus size={10} /> Add Node
      </button>
    </PropertySection>
  );
}
