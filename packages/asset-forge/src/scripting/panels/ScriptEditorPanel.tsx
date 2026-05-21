/**
 * ScriptEditorPanel — Full-screen modal overlay for the visual scripting editor.
 *
 * Layout:
 *  - Left sidebar: NodePalette (draggable node types)
 *  - Center: React Flow canvas with custom nodes
 *  - Right sidebar: NodeInspector (selected node properties)
 *  - Top header: graph name, validation status, save/cancel
 *
 * NOTE: Requires @xyflow/react to be installed in package.json.
 *       Run: bun add @xyflow/react
 */

import {
  ReactFlow,
  MiniMap,
  Background,
  BackgroundVariant,
  Controls,
  type ReactFlowInstance,
} from "@xyflow/react";
// @ts-expect-error — CSS import handled by Vite bundler
import "@xyflow/react/dist/style.css";
import {
  X,
  Save,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Workflow,
  FileCode,
  Bug,
  Skull,
  Crosshair,
  ShoppingCart,
  ScrollText,
  HeartPulse,
  Gift,
  TreeDeciduous,
  MapPin,
  Hammer,
  Shield,
  ChevronUp,
  ChevronDown,
  Terminal,
  Search,
  Locate,
  Filter,
  BookMarked,
} from "lucide-react";
import React, {
  useCallback,
  useRef,
  useState,
  useEffect,
  useMemo,
} from "react";

import { cn } from "../../styles";
import type { ScriptGraph, ScriptNode } from "../types";
import { useScriptGraphState } from "../hooks/useScriptGraphState";
import { allNodeTypes } from "../nodes";
import { NodePalette } from "./NodePalette";
import { NodeInspector } from "./NodeInspector";
import {
  SCRIPT_TEMPLATES,
  getTemplateCategories,
  type ScriptTemplate,
} from "../templates";
import type { ScriptEditorEntityContext } from "../../components/WorldStudio/ScriptEditorContext";
import { createScript } from "../../utils/scriptLibraryApi";

// ============== TEMPLATE ICON MAP ==============

const TEMPLATE_ICON_MAP: Record<
  string,
  React.ComponentType<{ size?: number }>
> = {
  Bug,
  Skull,
  Crosshair,
  AlertTriangle,
  ShoppingCart,
  ScrollText,
  HeartPulse,
  Gift,
  TreeDeciduous,
  MapPin,
  Hammer,
  Shield,
};

const CATEGORY_COLORS: Record<string, string> = {
  combat: "#E84A4A",
  npc: "#2D8CFF",
  quest: "#FF7A00",
  resource: "#28D47A",
  zone: "#6D3AFF",
  economy: "#FF7A00",
  utility: "#7A7A82",
};

// ============== TYPES ==============

export interface ScriptEditorPanelProps {
  /** Whether the editor is visible. */
  open: boolean;
  /** Close callback — passes the saved graph on save, undefined on cancel. */
  onClose: (savedGraph?: ScriptGraph) => void;
  /** Initial graph to load (edit mode) or undefined (new graph). */
  initialGraph?: ScriptGraph;
  /** Domain context (e.g. NPC dialogue tree) for context-aware inspector UIs. */
  entityContext?: ScriptEditorEntityContext;
  /** Team ID for "Save to Library" — when absent, the library button is disabled. */
  teamId?: string | null;
  /** Optional game scope for library saves (scripts are scoped by (team, game, slug)). */
  gameId?: string | null;
}

// ============== COMPONENT ==============

export function ScriptEditorPanel({
  open,
  onClose,
  initialGraph,
  entityContext,
  teamId = null,
  gameId = null,
}: ScriptEditorPanelProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);

  const {
    rfNodes,
    rfEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    loadGraph,
    removeNode,
    selectedNodeId,
    selectNode,
    validate,
    validationResult,
    getGraph,
    save,
    graphName,
    setGraphName,
  } = useScriptGraphState(initialGraph);

  // Sync graph state when the panel opens with a new initialGraph
  // (useState only reads initialGraph on first mount, so subsequent opens need loadGraph)
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      if (initialGraph) {
        loadGraph(initialGraph);
      }
    }
    prevOpenRef.current = open;
  }, [open, initialGraph, loadGraph]);

  // Find the selected node data for the inspector
  const selectedNode: ScriptNode | null = useMemo(() => {
    if (!selectedNodeId) return null;
    const graph = getGraph();
    return graph.nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [selectedNodeId, getGraph]);

  // ---- Drag-and-drop from palette ----

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const nodeType = event.dataTransfer.getData(
        "application/script-node-type",
      );
      if (!nodeType || !reactFlowInstance || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      addNode(nodeType, position);
    },
    [reactFlowInstance, addNode],
  );

  // ---- Keyboard shortcuts ----

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete selected nodes
      if (e.key === "Delete" || e.key === "Backspace") {
        if (
          selectedNodeId &&
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA" &&
          document.activeElement?.tagName !== "SELECT"
        ) {
          removeNode(selectedNodeId);
        }
      }

      // Escape to close
      if (e.key === "Escape") {
        onClose();
      }

      // Ctrl+S to save
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        const graph = save();
        onClose(graph);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, selectedNodeId, removeNode, onClose, save]);

  // ---- Validate on changes ----

  useEffect(() => {
    validate();
  }, [rfNodes.length, rfEdges.length]);

  // ---- Field change handler for inspector ----

  const handleFieldChange = useCallback(
    (nodeId: string, key: string, value: unknown) => {
      // Find the node and call the onFieldChange from its data
      const rfNode = rfNodes.find((n) => n.id === nodeId);
      if (rfNode) {
        const data = rfNode.data as Record<string, unknown>;
        const onFieldChangeFn = data.onFieldChange as
          | ((nid: string, k: string, v: unknown) => void)
          | undefined;
        onFieldChangeFn?.(nodeId, key, value);
      }
    },
    [rfNodes],
  );

  // ---- Save & Cancel ----

  const handleSave = useCallback(() => {
    const graph = save();
    onClose(graph);
  }, [save, onClose]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  // ---- Save to Library ----

  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const [librarySaving, setLibrarySaving] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [librarySuccess, setLibrarySuccess] = useState<string | null>(null);
  const [libraryForm, setLibraryForm] = useState({
    name: "",
    description: "",
    isTemplate: false,
    isPublic: false,
  });

  const openLibraryModal = useCallback(() => {
    setLibraryError(null);
    setLibrarySuccess(null);
    setLibraryForm({
      name: graphName || "Untitled Script",
      description: "",
      isTemplate: false,
      isPublic: false,
    });
    setLibraryModalOpen(true);
  }, [graphName]);

  const closeLibraryModal = useCallback(() => {
    setLibraryModalOpen(false);
    setLibraryError(null);
  }, []);

  const handleSaveToLibrary = useCallback(async () => {
    if (!teamId) {
      setLibraryError("No active team — open a project first.");
      return;
    }
    const trimmedName = libraryForm.name.trim();
    if (!trimmedName) {
      setLibraryError("Name is required.");
      return;
    }
    if (validationResult.errors.length > 0) {
      setLibraryError(
        "Graph has validation errors — fix them before saving to the library.",
      );
      return;
    }

    setLibrarySaving(true);
    setLibraryError(null);
    setLibrarySuccess(null);
    try {
      const graph = save();
      const result = await createScript(teamId, {
        name: trimmedName,
        description: libraryForm.description.trim() || undefined,
        gameId: gameId ?? undefined,
        graphData: graph,
        isTemplate: libraryForm.isTemplate,
        isPublic: libraryForm.isPublic,
      });
      setLibrarySuccess(`Saved "${result.name}" to library.`);
      setLibraryModalOpen(false);
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : String(err));
    } finally {
      setLibrarySaving(false);
    }
  }, [teamId, gameId, libraryForm, validationResult.errors.length, save]);

  const [consoleOpen, setConsoleOpen] = useState(true);
  const [consoleFilter, setConsoleFilter] = useState("");
  const [consoleShowErrors, setConsoleShowErrors] = useState(true);
  const [consoleShowWarnings, setConsoleShowWarnings] = useState(true);

  const filteredIssues = useMemo(() => {
    const items: Array<{
      kind: "error" | "warning";
      message: string;
      nodeId?: string;
      type: string;
    }> = [];
    if (consoleShowErrors) {
      for (const err of validationResult.errors) {
        items.push({
          kind: "error",
          message: err.message,
          nodeId: err.nodeId,
          type: err.type,
        });
      }
    }
    if (consoleShowWarnings) {
      for (const warn of validationResult.warnings) {
        items.push({
          kind: "warning",
          message: warn.message,
          nodeId: warn.nodeId,
          type: warn.type,
        });
      }
    }
    if (!consoleFilter) return items;
    const lc = consoleFilter.toLowerCase();
    return items.filter(
      (it) =>
        it.message.toLowerCase().includes(lc) ||
        it.type.toLowerCase().includes(lc),
    );
  }, [validationResult, consoleFilter, consoleShowErrors, consoleShowWarnings]);

  const goToNode = useCallback(
    (nodeId: string) => {
      selectNode(nodeId);
      if (reactFlowInstance) {
        const rfNode = rfNodes.find((nd) => nd.id === nodeId);
        if (rfNode) {
          reactFlowInstance.setCenter(
            rfNode.position.x + 100,
            rfNode.position.y + 40,
            { zoom: 1, duration: 300 },
          );
        }
      }
    },
    [selectNode, reactFlowInstance, rfNodes],
  );

  if (!open) return null;

  const errorCount = validationResult.errors.length;
  const warningCount = validationResult.warnings.length;

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        zIndex: 1050,
        background: "var(--bg-primary)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 shrink-0"
        style={{
          height: 44,
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-primary)",
          borderTop: "1px solid var(--surface-highlight)",
        }}
      >
        <div className="flex items-center gap-3">
          <Workflow size={18} style={{ color: "var(--color-primary-light)" }} />
          <input
            type="text"
            value={graphName}
            onChange={(e) => setGraphName(e.target.value)}
            className="ws-input"
            style={{
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "var(--font-sans)",
              background: "transparent",
              border: "1px solid transparent",
              boxShadow: "none",
              padding: "2px 6px",
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Validation status */}
          <div className="flex items-center gap-2" style={{ fontSize: 11 }}>
            {errorCount === 0 && warningCount === 0 && (
              <div
                className="flex items-center gap-1"
                style={{ color: "var(--color-success)" }}
              >
                <CheckCircle size={14} />
                <span>Valid</span>
              </div>
            )}
            {errorCount > 0 && (
              <div
                className="flex items-center gap-1"
                style={{ color: "var(--color-error)" }}
              >
                <AlertCircle size={14} />
                <span>
                  {errorCount} error{errorCount !== 1 ? "s" : ""}
                </span>
              </div>
            )}
            {warningCount > 0 && (
              <div
                className="flex items-center gap-1"
                style={{ color: "var(--color-warning)" }}
              >
                <AlertTriangle size={14} />
                <span>
                  {warningCount} warning{warningCount !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>

          <div
            style={{
              width: 1,
              height: 20,
              background: "var(--border-secondary)",
            }}
          />

          {/* Save / Cancel */}
          <button
            onClick={handleCancel}
            className="btn-ghost"
            style={{ padding: "4px 12px", fontSize: 11 }}
          >
            Cancel
          </button>
          <button
            onClick={openLibraryModal}
            className="btn-ghost"
            style={{ padding: "4px 12px", fontSize: 11, gap: 6 }}
            title={
              teamId
                ? "Save this graph to your team's script library"
                : "Open a project to enable saving to the library"
            }
            disabled={!teamId}
          >
            <BookMarked size={13} />
            Save to Library
          </button>
          <button
            onClick={handleSave}
            className="btn-primary"
            style={{ padding: "4px 12px", fontSize: 11, gap: 6 }}
          >
            <Save size={13} />
            Save
          </button>

          <button
            onClick={handleCancel}
            className="flex items-center justify-center rounded"
            style={{
              width: 28,
              height: 28,
              color: "var(--text-tertiary)",
              transition: "all 150ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-hover)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-tertiary)";
            }}
            aria-label="Close script editor"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Body: Palette | Canvas | Inspector */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — Node Palette */}
        <div className="shrink-0" style={{ width: 260 }}>
          <NodePalette onAddNode={addNode} />
        </div>

        {/* Center — React Flow Canvas + Console */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div
            ref={reactFlowWrapper}
            className="flex-1 relative"
            style={{ background: "var(--bg-primary)" }}
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={setReactFlowInstance}
              nodeTypes={allNodeTypes}
              fitView
              deleteKeyCode={null} // We handle delete ourselves
              style={{ background: "var(--bg-primary)" }}
              defaultEdgeOptions={{
                type: "smoothstep",
                animated: true,
                style: { stroke: "var(--border-hover)", strokeWidth: 2 },
              }}
              proOptions={{ hideAttribution: true }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1}
                color="var(--border-secondary)"
              />
              <Controls
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-primary)",
                  borderRadius: 8,
                  boxShadow: "var(--shadow-lg)",
                }}
                showInteractive={false}
              />
              <MiniMap
                nodeColor={(node) => {
                  const data = node.data as Record<string, unknown>;
                  const scriptType = data?.scriptType as string | undefined;
                  if (scriptType?.startsWith("trigger")) return "#28D47A";
                  if (scriptType?.startsWith("condition")) return "#FF7A00";
                  if (scriptType?.startsWith("action")) return "#2D8CFF";
                  if (scriptType?.startsWith("flow")) return "#6D3AFF";
                  return "#7A7A82";
                }}
                maskColor="rgba(0, 0, 0, 0.7)"
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-primary)",
                  borderRadius: 8,
                }}
                pannable
                zoomable
              />
            </ReactFlow>

            {/* Empty state — template picker */}
            {rfNodes.length === 0 && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center"
                style={{ pointerEvents: "auto", zIndex: 5 }}
              >
                <Workflow
                  size={40}
                  style={{ color: "var(--text-muted)", marginBottom: 8 }}
                />
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: 4,
                  }}
                >
                  Start from a template or drag nodes from the palette
                </p>
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    marginBottom: 20,
                  }}
                >
                  Templates provide pre-wired graphs for common game logic
                  patterns
                </p>

                {/* Template grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 10,
                    maxWidth: 660,
                    width: "100%",
                    padding: "0 24px",
                    maxHeight: "50vh",
                    overflowY: "auto",
                  }}
                >
                  {SCRIPT_TEMPLATES.map((tmpl) => {
                    const IconComp = TEMPLATE_ICON_MAP[tmpl.icon] ?? FileCode;
                    const catColor =
                      CATEGORY_COLORS[tmpl.category] ?? "#7A7A82";
                    return (
                      <button
                        key={tmpl.id}
                        onClick={() => loadGraph(tmpl.create())}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          gap: 6,
                          padding: "12px 14px",
                          borderRadius: 8,
                          background: "var(--bg-secondary)",
                          border: "1px solid var(--border-primary)",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "all 150ms",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = catColor;
                          e.currentTarget.style.background =
                            "var(--bg-tertiary)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor =
                            "var(--border-primary)";
                          e.currentTarget.style.background =
                            "var(--bg-secondary)";
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                          }}
                        >
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              background: `${catColor}20`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <IconComp size={14} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "var(--text-primary)",
                              }}
                            >
                              {tmpl.label}
                            </div>
                            <div
                              style={{
                                fontSize: 9,
                                fontWeight: 600,
                                textTransform: "uppercase tracking-[0.12em]",
                                letterSpacing: "0.05em",
                                color: catColor,
                              }}
                            >
                              {tmpl.category}
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--text-tertiary)",
                            lineHeight: 1.4,
                          }}
                        >
                          {tmpl.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Bottom — Console / Problems panel */}
          <div
            style={{
              borderTop: "1px solid var(--border-primary)",
              background: "var(--bg-secondary)",
              flexShrink: 0,
            }}
          >
            {/* Console header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 8px",
              }}
            >
              <button
                onClick={() => setConsoleOpen((p) => !p)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "2px 6px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textTransform: "uppercase tracking-[0.12em]",
                  letterSpacing: "0.04em",
                }}
              >
                <Terminal size={12} />
                <span>Problems</span>
                {consoleOpen ? (
                  <ChevronDown size={10} />
                ) : (
                  <ChevronUp size={10} />
                )}
              </button>

              {/* Error / Warning toggle badges */}
              <button
                onClick={() => setConsoleShowErrors((p) => !p)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  color: consoleShowErrors ? "#F5F5F5" : "var(--text-muted)",
                  background: consoleShowErrors
                    ? "var(--color-error)"
                    : "transparent",
                  border: consoleShowErrors
                    ? "none"
                    : "1px solid var(--border-secondary)",
                  borderRadius: 9,
                  padding: "1px 7px",
                  cursor: "pointer",
                  opacity: errorCount === 0 ? 0.5 : 1,
                  lineHeight: "16px",
                }}
              >
                <AlertCircle size={10} />
                {errorCount}
              </button>
              <button
                onClick={() => setConsoleShowWarnings((p) => !p)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  color: consoleShowWarnings ? "#F5F5F5" : "var(--text-muted)",
                  background: consoleShowWarnings
                    ? "var(--color-warning, #FF7A00)"
                    : "transparent",
                  border: consoleShowWarnings
                    ? "none"
                    : "1px solid var(--border-secondary)",
                  borderRadius: 9,
                  padding: "1px 7px",
                  cursor: "pointer",
                  opacity: warningCount === 0 ? 0.5 : 1,
                  lineHeight: "16px",
                }}
              >
                <AlertTriangle size={10} />
                {warningCount}
              </button>

              {errorCount === 0 && warningCount === 0 && (
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--color-success)",
                    fontWeight: 500,
                    marginLeft: 4,
                  }}
                >
                  No issues
                </span>
              )}

              {/* Filter input */}
              {consoleOpen && (errorCount > 0 || warningCount > 0) && (
                <div
                  style={{
                    marginLeft: "auto",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-secondary)",
                    borderRadius: 4,
                    padding: "2px 6px",
                  }}
                >
                  <Search
                    size={10}
                    style={{ color: "var(--text-muted)", flexShrink: 0 }}
                  />
                  <input
                    type="text"
                    value={consoleFilter}
                    onChange={(ev) => setConsoleFilter(ev.target.value)}
                    placeholder="Filter..."
                    style={{
                      width: 120,
                      fontSize: 10,
                      color: "var(--text-primary)",
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      padding: 0,
                    }}
                  />
                  {consoleFilter && (
                    <button
                      onClick={() => setConsoleFilter("")}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        color: "var(--text-muted)",
                        display: "flex",
                      }}
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Console body — selectable text */}
            {consoleOpen && (errorCount > 0 || warningCount > 0) && (
              <div
                style={{
                  maxHeight: 160,
                  overflowY: "auto",
                  padding: "0 4px 4px",
                  userSelect: "text",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
                }}
              >
                {filteredIssues.length === 0 && consoleFilter && (
                  <div
                    style={{
                      padding: "8px 8px",
                      fontSize: 11,
                      color: "var(--text-muted)",
                      fontStyle: "italic",
                    }}
                  >
                    No issues matching &ldquo;{consoleFilter}&rdquo;
                  </div>
                )}
                {filteredIssues.map((item, i) => (
                  <div
                    key={`${item.kind}-${i}`}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      padding: "3px 8px",
                      fontSize: 11,
                      color: "var(--text-secondary)",
                      borderRadius: 3,
                      lineHeight: 1.5,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--bg-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {item.kind === "error" ? (
                      <AlertCircle
                        size={12}
                        style={{
                          color: "var(--color-error)",
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      />
                    ) : (
                      <AlertTriangle
                        size={12}
                        style={{
                          color: "var(--color-warning, #FF7A00)",
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      />
                    )}
                    <span style={{ flex: 1, cursor: "text" }}>
                      {item.message}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        color: "var(--text-muted)",
                        background: "var(--bg-primary)",
                        borderRadius: 3,
                        padding: "1px 5px",
                        flexShrink: 0,
                        marginTop: 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.type}
                    </span>
                    {item.nodeId && (
                      <button
                        onClick={() => goToNode(item.nodeId!)}
                        title="Go to node"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 2,
                          color: "var(--text-muted)",
                          flexShrink: 0,
                          display: "flex",
                          borderRadius: 3,
                          marginTop: 0,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "var(--text-primary)";
                          e.currentTarget.style.background =
                            "var(--bg-tertiary)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "var(--text-muted)";
                          e.currentTarget.style.background = "none";
                        }}
                      >
                        <Locate size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar — Node Inspector */}
        <div className="shrink-0" style={{ width: 288 }}>
          <NodeInspector
            selectedNode={selectedNode}
            validationResult={validationResult}
            onFieldChange={handleFieldChange}
            entityContext={entityContext}
            onJumpToDialogue={() => onClose()}
          />
        </div>
      </div>

      {/* Success toast for library save */}
      {librarySuccess && (
        <div
          style={{
            position: "absolute",
            bottom: 16,
            right: 16,
            padding: "8px 14px",
            borderRadius: 6,
            background: "var(--color-success-bg, rgba(16,185,129,0.15))",
            border: "1px solid var(--color-success)",
            color: "var(--color-success)",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
            zIndex: 1060,
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <CheckCircle size={14} />
          <span>{librarySuccess}</span>
          <button
            onClick={() => setLibrarySuccess(null)}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              padding: 0,
              marginLeft: 6,
              display: "flex",
            }}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Save to Library modal */}
      {libraryModalOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{
            zIndex: 1070,
            background: "rgba(0,0,0,0.55)",
          }}
          onClick={closeLibraryModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 420,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-primary)",
              borderRadius: 8,
              boxShadow: "var(--shadow-lg)",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              <BookMarked
                size={15}
                style={{ color: "var(--color-primary-light)" }}
              />
              Save to Library
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                Name
              </label>
              <input
                type="text"
                value={libraryForm.name}
                onChange={(e) =>
                  setLibraryForm({ ...libraryForm, name: e.target.value })
                }
                className="ws-input"
                style={{ fontSize: 12, padding: "6px 8px" }}
                maxLength={100}
                autoFocus
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                Description (optional)
              </label>
              <textarea
                value={libraryForm.description}
                onChange={(e) =>
                  setLibraryForm({
                    ...libraryForm,
                    description: e.target.value,
                  })
                }
                className="ws-input"
                style={{
                  fontSize: 12,
                  padding: "6px 8px",
                  minHeight: 60,
                  resize: "vertical",
                }}
                maxLength={500}
              />
            </div>

            <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={libraryForm.isTemplate}
                  onChange={(e) =>
                    setLibraryForm({
                      ...libraryForm,
                      isTemplate: e.target.checked,
                    })
                  }
                />
                Template
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={libraryForm.isPublic}
                  onChange={(e) =>
                    setLibraryForm({
                      ...libraryForm,
                      isPublic: e.target.checked,
                    })
                  }
                />
                Public
              </label>
            </div>

            {libraryError && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--color-error)",
                  background: "var(--color-error-bg, rgba(239,68,68,0.12))",
                  border: "1px solid var(--color-error)",
                  borderRadius: 4,
                  padding: "6px 8px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <AlertCircle size={12} />
                <span>{libraryError}</span>
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 4,
              }}
            >
              <button
                onClick={closeLibraryModal}
                className="btn-ghost"
                style={{ padding: "4px 12px", fontSize: 11 }}
                disabled={librarySaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveToLibrary}
                className="btn-primary"
                style={{ padding: "4px 12px", fontSize: 11, gap: 6 }}
                disabled={librarySaving}
              >
                <Save size={13} />
                {librarySaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
