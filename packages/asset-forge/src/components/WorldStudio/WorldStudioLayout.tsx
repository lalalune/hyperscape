/**
 * WorldStudioLayout — UE5-inspired three-panel editor shell with:
 *
 * - Resizable left sidebar (Outliner/Palette/Brush/Procgen based on active tool)
 * - Center viewport with bottom panel (Validation/Console/History)
 * - Tabbed right sidebar (Properties/Manifests/Deployment/Automation)
 * - Resizable dividers between all major panel areas
 * - Panel sizes persisted in localStorage
 */

import {
  Loader2,
  AlertTriangle,
  GripVertical,
  History,
  Settings,
  Rocket,
  Sparkles,
  Wand2,
} from "lucide-react";
import React, { useState, useCallback, useRef, useEffect } from "react";

import { ErrorBoundary } from "../common/ErrorBoundary";
import { useWorldStudio, useStudioProject } from "./WorldStudioContext";
import { useManifestLoader } from "./hooks/useManifestLoader";
import { useWorldStudioShortcuts } from "./hooks/useWorldStudioShortcuts";
import { useProjectLoader } from "./hooks/useProjectLoader";
import { useAutoSave } from "./hooks/useAutoSave";
import { BrushSettingsPanel } from "./panels/BrushSettingsPanel";
import { EntityPalette } from "./panels/EntityPalette";
import { OutlinerPanel } from "./panels/OutlinerPanel";
import { PathToolPanel } from "./panels/PathToolPanel";
import { ProcgenPanel } from "./panels/ProcgenPanel";
import { ZonePaintPanel } from "./panels/ZonePaintPanel";
import { DeploymentPanel } from "./panels/DeploymentPanel";
import { AutomationPanel } from "./panels/AutomationPanel";
import { WorldStudioCompanion } from "./panels/WorldStudioCompanion";
import { HistoryPanel } from "./panels/HistoryPanel";
import { PropertiesPanel } from "./panels/PropertiesPanel";
import { BottomPanel } from "./panels/BottomPanel";
import { MainToolbar, type RightPanelTab } from "./toolbar/MainToolbar";
import { StatusBar } from "./toolbar/StatusBar";
import { ViewportContainer } from "./viewport/ViewportContainer";
import { ToastContainer } from "./layout/ToastNotifications";
import { ScriptEditorPanel } from "../../scripting/panels/ScriptEditorPanel";
import { ScriptEditorProvider } from "./ScriptEditorContext";
import type { ScriptGraph } from "../../scripting/types";

// ---------------------------------------------------------------------------
// Constants & localStorage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = "worldstudio-layout";
const DEFAULT_LEFT_WIDTH = 280;
const DEFAULT_RIGHT_WIDTH = 320;
const MIN_PANEL_WIDTH = 200;
const MAX_PANEL_WIDTH = 500;

interface LayoutPersistence {
  leftWidth: number;
  rightWidth: number;
  leftOpen: boolean;
  rightOpen: boolean;
  rightTab: RightPanelTab;
}

function loadLayout(): LayoutPersistence {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        leftWidth: Math.max(
          MIN_PANEL_WIDTH,
          Math.min(MAX_PANEL_WIDTH, parsed.leftWidth ?? DEFAULT_LEFT_WIDTH),
        ),
        rightWidth: Math.max(
          MIN_PANEL_WIDTH,
          Math.min(MAX_PANEL_WIDTH, parsed.rightWidth ?? DEFAULT_RIGHT_WIDTH),
        ),
        leftOpen: parsed.leftOpen ?? true,
        rightOpen: parsed.rightOpen ?? true,
        rightTab: parsed.rightTab ?? "properties",
      };
    }
  } catch {
    /* ignore */
  }
  return {
    leftWidth: DEFAULT_LEFT_WIDTH,
    rightWidth: DEFAULT_RIGHT_WIDTH,
    leftOpen: true,
    rightOpen: true,
    rightTab: "properties",
  };
}

function saveLayout(layout: LayoutPersistence) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Resizable divider
// ---------------------------------------------------------------------------

function ResizeDivider({
  onDrag,
  direction = "horizontal",
}: {
  onDrag: (delta: number) => void;
  direction?: "horizontal" | "vertical";
}) {
  const dragging = useRef(false);
  const lastPos = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      lastPos.current = direction === "horizontal" ? e.clientX : e.clientY;

      const handleMouseMove = (me: MouseEvent) => {
        if (!dragging.current) return;
        const current = direction === "horizontal" ? me.clientX : me.clientY;
        const delta = current - lastPos.current;
        lastPos.current = current;
        onDrag(delta);
      };

      const handleMouseUp = () => {
        dragging.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor =
        direction === "horizontal" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [onDrag, direction],
  );

  return (
    <div
      className={`ws-divider ${
        direction === "horizontal"
          ? "w-[3px] cursor-col-resize"
          : "h-[3px] cursor-row-resize"
      }`}
      style={{ background: "var(--bg-primary)" }}
      onMouseDown={handleMouseDown}
    />
  );
}

// ---------------------------------------------------------------------------
// Right panel tab bar
// ---------------------------------------------------------------------------

const RIGHT_TABS: {
  id: RightPanelTab;
  label: string;
  icon: typeof Settings;
}[] = [
  // Content Browser lives in the bottom dock (UE5 convention) — not in
  // the right sidebar tabs. Details/Deploy/AI/Companion remain here.
  { id: "properties", label: "Details", icon: Settings },
  { id: "deployment", label: "Deploy", icon: Rocket },
  { id: "automation", label: "AI", icon: Wand2 },
  { id: "companion", label: "Chat", icon: Sparkles },
  { id: "history", label: "History", icon: History },
];

function RightPanelTabs({
  activeTab,
  onSetTab,
}: {
  activeTab: RightPanelTab;
  onSetTab: (tab: RightPanelTab) => void;
}) {
  return (
    <div
      className="flex items-center border-b border-border-primary bg-bg-secondary flex-shrink-0"
      style={{ borderTop: "1px solid var(--surface-highlight)" }}
    >
      {RIGHT_TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium transition-all relative ${
            activeTab === id
              ? "text-primary bg-primary/[0.08]"
              : "text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary/50"
          } ease-out`}
          onClick={() => onSetTab(id)}
        >
          <Icon size={12} />
          {label}
          {activeTab === id && (
            <span
              className="absolute bottom-0 left-1 right-1 h-[2px] bg-primary rounded-full"
              style={{ boxShadow: "0 0 6px rgba(99, 102, 241, 0.4)" }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error fallbacks
// ---------------------------------------------------------------------------

function PanelError({ label }: { label: string }) {
  return (
    <div className="p-4 text-sm text-red-400">
      <p className="font-medium mb-1">{label} crashed</p>
      <p className="text-text-tertiary">
        Try switching tools or reloading the page.
      </p>
    </div>
  );
}

function ViewportError() {
  return (
    <div className="flex-1 flex items-center justify-center bg-bg-primary text-red-400">
      <div className="text-center p-6">
        <p className="font-semibold text-lg mb-2">Viewport error</p>
        <p className="text-text-tertiary text-sm">
          The 3D viewport encountered an error. Please reload the page.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main layout
// ---------------------------------------------------------------------------

interface WorldStudioLayoutProps {
  projectId: string;
}

export function WorldStudioLayout({ projectId }: WorldStudioLayoutProps) {
  const { state, dispatch } = useWorldStudio();
  const activeTool = state.tools.activeTool;
  const { currentTeamId, currentGameId } = useStudioProject();

  // Persisted layout state
  const [layout, setLayout] = useState<LayoutPersistence>(loadLayout);

  // Persist on change
  const updateLayout = useCallback((updates: Partial<LayoutPersistence>) => {
    setLayout((prev) => {
      const next = { ...prev, ...updates };
      saveLayout(next);
      return next;
    });
  }, []);

  // Script editor modal state
  const [scriptEditorState, setScriptEditorState] = useState<{
    open: boolean;
    fieldKey: string;
    entityId: string;
    stateKey: string;
    stateRoot: "extendedLayers" | "audioLayers" | "manifestOverrides";
    tracksSource?: boolean;
    initialGraph?: ScriptGraph;
    entityContext?: import("./ScriptEditorContext").ScriptEditorEntityContext;
  }>({
    open: false,
    fieldKey: "",
    entityId: "",
    stateKey: "",
    stateRoot: "extendedLayers",
  });

  const handleOpenScriptEditor = useCallback(
    (
      entityId: string,
      stateKey: string,
      stateRoot: "extendedLayers" | "audioLayers" | "manifestOverrides",
      tracksSource: boolean | undefined,
      fieldKey: string,
      graph: ScriptGraph | undefined,
      entityContext?: import("./ScriptEditorContext").ScriptEditorEntityContext,
    ) => {
      setScriptEditorState({
        open: true,
        fieldKey,
        entityId,
        stateKey,
        stateRoot,
        tracksSource,
        initialGraph: graph,
        entityContext,
      });
    },
    [],
  );

  const handleCloseScriptEditor = useCallback(
    (savedGraph?: ScriptGraph) => {
      if (savedGraph && scriptEditorState.entityId) {
        if (scriptEditorState.stateRoot === "manifestOverrides") {
          // Manifest entities use SET_MANIFEST_OVERRIDE to merge the graph into the override
          dispatch({
            type: "SET_MANIFEST_OVERRIDE",
            overrideType: scriptEditorState.stateKey as
              | "npcOverrides"
              | "mobSpawnOverrides"
              | "resourceOverrides"
              | "stationOverrides"
              | "storeOverrides",
            entityId: scriptEditorState.entityId,
            data: { [scriptEditorState.fieldKey]: savedGraph },
          });
        } else {
          dispatch({
            type: "ENTITY_UPDATE",
            stateKey: scriptEditorState.stateKey,
            stateRoot: scriptEditorState.stateRoot,
            id: scriptEditorState.entityId,
            updates: { [scriptEditorState.fieldKey]: savedGraph },
            trackSource: scriptEditorState.tracksSource,
          });
        }
      }
      setScriptEditorState((prev) => ({ ...prev, open: false }));
    },
    [dispatch, scriptEditorState],
  );

  // Hooks
  useProjectLoader(projectId);
  useAutoSave(projectId, state.persistence.autoSaveEnabled);
  useManifestLoader();
  useWorldStudioShortcuts();

  // Panel toggle callbacks
  const toggleLeft = useCallback(() => {
    updateLayout({ leftOpen: !layout.leftOpen });
  }, [layout.leftOpen, updateLayout]);

  const toggleRight = useCallback(() => {
    updateLayout({ rightOpen: !layout.rightOpen });
  }, [layout.rightOpen, updateLayout]);

  const setRightTab = useCallback(
    (tab: RightPanelTab) => {
      updateLayout({ rightTab: tab, rightOpen: true });
    },
    [updateLayout],
  );

  // Resize callbacks
  const handleLeftResize = useCallback(
    (delta: number) => {
      updateLayout({
        leftWidth: Math.max(
          MIN_PANEL_WIDTH,
          Math.min(MAX_PANEL_WIDTH, layout.leftWidth + delta),
        ),
      });
    },
    [layout.leftWidth, updateLayout],
  );

  const handleRightResize = useCallback(
    (delta: number) => {
      // Right panel grows when dragged left (negative delta)
      updateLayout({
        rightWidth: Math.max(
          MIN_PANEL_WIDTH,
          Math.min(MAX_PANEL_WIDTH, layout.rightWidth - delta),
        ),
      });
    },
    [layout.rightWidth, updateLayout],
  );

  // Loading state
  if (state.persistence.isLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-2.75rem)] bg-bg-primary overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2
              size={32}
              className="animate-spin text-primary mx-auto mb-3"
            />
            <p className="text-sm text-text-secondary">Loading project...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (state.persistence.loadError) {
    return (
      <div className="flex flex-col h-[calc(100vh-2.75rem)] bg-bg-primary overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-6">
            <AlertTriangle size={32} className="text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-400 mb-2">
              {state.persistence.loadError}
            </p>
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Resolve left panel
  const renderLeftPanel = () => {
    switch (activeTool) {
      case "place":
        return <EntityPalette />;
      case "brush":
        return <BrushSettingsPanel />;
      case "zonePaint":
        return <ZonePaintPanel />;
      case "path":
        return <PathToolPanel />;
      case "procgen":
        return <ProcgenPanel />;
      default:
        return <OutlinerPanel />;
    }
  };

  // Resolve right panel content
  const renderRightContent = () => {
    switch (layout.rightTab) {
      case "deployment":
        return <DeploymentPanel />;
      case "automation":
        return <AutomationPanel />;
      case "companion":
        return <WorldStudioCompanion />;
      case "history":
        return <HistoryPanel />;
      default:
        return <PropertiesPanel />;
    }
  };

  return (
    <ScriptEditorProvider onOpen={handleOpenScriptEditor}>
      <div className="flex flex-col h-[calc(100vh-2.75rem)] bg-bg-primary overflow-hidden">
        {/* Top toolbar */}
        <MainToolbar
          leftPanelOpen={layout.leftOpen}
          rightPanelOpen={layout.rightOpen}
          activeRightTab={layout.rightTab}
          onToggleLeft={toggleLeft}
          onToggleRight={toggleRight}
          onSetRightTab={setRightTab}
        />

        {/* Three-panel body */}
        <div className="flex-1 flex overflow-hidden">
          {/* ====== LEFT SIDEBAR ====== */}
          {layout.leftOpen && (
            <>
              <div
                className="flex-shrink-0 bg-bg-secondary overflow-hidden flex flex-col border-r border-border-primary"
                style={{
                  width: layout.leftWidth,
                  borderTop: "1px solid var(--surface-highlight)",
                }}
              >
                <ErrorBoundary fallback={<PanelError label="Left panel" />}>
                  {renderLeftPanel()}
                </ErrorBoundary>
              </div>
              <ResizeDivider onDrag={handleLeftResize} direction="horizontal" />
            </>
          )}

          {/* ====== CENTER: Viewport + Bottom Panel ====== */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Viewport area */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
              <ErrorBoundary fallback={<ViewportError />}>
                <ViewportContainer />
              </ErrorBoundary>
            </div>

            {/* Bottom panel (Validation / Console / History) */}
            <ErrorBoundary fallback={<PanelError label="Bottom panel" />}>
              <BottomPanel />
            </ErrorBoundary>
          </div>

          {/* ====== RIGHT SIDEBAR (Tabbed) ====== */}
          {layout.rightOpen && (
            <>
              <ResizeDivider
                onDrag={handleRightResize}
                direction="horizontal"
              />
              <div
                className="flex-shrink-0 bg-bg-secondary overflow-hidden flex flex-col border-l border-border-primary"
                style={{
                  width: layout.rightWidth,
                  borderTop: "1px solid var(--surface-highlight)",
                }}
              >
                {/* Tab bar */}
                <RightPanelTabs
                  activeTab={layout.rightTab}
                  onSetTab={(tab) => updateLayout({ rightTab: tab })}
                />
                {/* Tab content */}
                <div className="flex-1 overflow-hidden flex flex-col">
                  <ErrorBoundary
                    resetKey={`${layout.rightTab}-${state.builder.editing.selection?.id ?? "none"}`}
                  >
                    {renderRightContent()}
                  </ErrorBoundary>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Status bar */}
        <StatusBar />

        {/* Toast notifications (portal) */}
        <ToastContainer />

        {/* Script editor modal overlay */}
        <ScriptEditorPanel
          open={scriptEditorState.open}
          onClose={handleCloseScriptEditor}
          initialGraph={scriptEditorState.initialGraph}
          entityContext={scriptEditorState.entityContext}
          teamId={currentTeamId}
          gameId={currentGameId}
        />
      </div>
    </ScriptEditorProvider>
  );
}
