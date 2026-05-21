/**
 * EditorLayout
 *
 * The main layout component for editing mode.
 * Three-panel layout: Hierarchy (left) | Viewport (center) | Properties (right)
 */

import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Save,
  Upload,
  Download,
  AlertTriangle,
  Check,
  Database,
  FileJson,
  FolderOpen,
  Navigation,
  MousePointer2,
} from "lucide-react";
import React, { useCallback, useState } from "react";

import { useWorldBuilder } from "../WorldBuilderContext";

import {
  AddNPCDialog,
  AddQuestDialog,
  AddBossDialog,
  AddEventDialog,
  AddLoreDialog,
  AddDifficultyZoneDialog,
  AddCustomPlacementDialog,
} from "./AddEntityDialogs";
import { HierarchyPanel } from "./HierarchyPanel";
import { OverlayDropdown } from "./OverlayControls";
import { PropertiesPanel } from "./PropertiesPanel";

import { Button } from "@/components/common";

// ============== PANEL RESIZE HANDLE ==============

interface ResizeHandleProps {
  onResize: (delta: number) => void;
  position: "left" | "right";
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({ onResize, position }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const startX = e.clientX;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        onResize(position === "left" ? delta : -delta);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [onResize, position],
  );

  return (
    <div
      className={`w-1 cursor-col-resize hover:bg-primary/50 transition-colors ${
        isDragging ? "bg-primary" : "bg-transparent"
      } ease-out`}
      onMouseDown={handleMouseDown}
    />
  );
};

// ============== MAIN COMPONENT ==============

interface EditorLayoutProps {
  /** The viewport component to render in the center */
  viewport: React.ReactNode;
  /** Called when save is requested */
  onSave?: () => Promise<void>;
  /** Called when export is requested */
  onExport?: () => void;
  /** Called when export to game format is requested */
  onExportToGame?: () => void;
  /** Called when export all manifests is requested */
  onExportAllManifests?: () => void;
  /** Called when save to IndexedDB is requested */
  onSaveToIndexedDB?: () => Promise<void>;
  /** Called when import is requested */
  onImport?: (file: File) => void;
  /** Called when import from IndexedDB is requested */
  onImportFromIndexedDB?: () => void;
  /** Called when a layer add button is clicked */
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
  /** Whether fly mode is enabled */
  flyModeEnabled?: boolean;
  /** Called when fly mode is toggled */
  onFlyModeToggle?: (enabled: boolean) => void;
}

export const EditorLayout: React.FC<EditorLayoutProps> = ({
  viewport,
  onSave,
  onExport,
  onExportToGame,
  onExportAllManifests,
  onSaveToIndexedDB,
  onImport,
  onImportFromIndexedDB,
  flyModeEnabled = false,
  onFlyModeToggle,
}) => {
  const { state, actions } = useWorldBuilder();
  const { world, hasUnsavedChanges, saveError } = state.editing;

  // Panel visibility state
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  // Panel width state
  const [leftPanelWidth, setLeftPanelWidth] = useState(280);
  const [rightPanelWidth, setRightPanelWidth] = useState(320);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Dialog visibility state
  const [showAddNPCDialog, setShowAddNPCDialog] = useState(false);
  const [showAddQuestDialog, setShowAddQuestDialog] = useState(false);
  const [showAddBossDialog, setShowAddBossDialog] = useState(false);
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [showAddLoreDialog, setShowAddLoreDialog] = useState(false);
  const [showAddDifficultyZoneDialog, setShowAddDifficultyZoneDialog] =
    useState(false);
  const [showAddCustomPlacementDialog, setShowAddCustomPlacementDialog] =
    useState(false);

  // Handle add layer - opens appropriate dialog
  const handleAddLayer = useCallback(
    (
      layerType:
        | "npc"
        | "quest"
        | "boss"
        | "event"
        | "lore"
        | "difficultyZone"
        | "customPlacement",
    ) => {
      switch (layerType) {
        case "npc":
          setShowAddNPCDialog(true);
          break;
        case "quest":
          setShowAddQuestDialog(true);
          break;
        case "boss":
          setShowAddBossDialog(true);
          break;
        case "event":
          setShowAddEventDialog(true);
          break;
        case "lore":
          setShowAddLoreDialog(true);
          break;
        case "difficultyZone":
          setShowAddDifficultyZoneDialog(true);
          break;
        case "customPlacement":
          setShowAddCustomPlacementDialog(true);
          break;
      }
    },
    [],
  );

  // Handle left panel resize
  const handleLeftResize = useCallback((delta: number) => {
    setLeftPanelWidth((prev) => Math.max(200, Math.min(400, prev + delta)));
  }, []);

  // Handle right panel resize
  const handleRightResize = useCallback((delta: number) => {
    setRightPanelWidth((prev) => Math.max(250, Math.min(450, prev + delta)));
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!onSave) return;

    setIsSaving(true);
    setSaveSuccess(false);

    let saveSucceeded = false;

    await onSave()
      .then(() => {
        saveSucceeded = true;
      })
      .catch((error: Error) => {
        actions.setSaveError(error.message || "Failed to save world");
      })
      .finally(() => {
        setIsSaving(false);
      });

    if (saveSucceeded && !state.editing.saveError) {
      setSaveSuccess(true);
      actions.markSaved();
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  }, [onSave, state.editing.saveError, actions]);

  // Handle import file selection
  const handleImportClick = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.world";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && onImport) {
        onImport(file);
      }
    };
    input.click();
  }, [onImport]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-bg-secondary border-b border-border-primary">
        {/* Left toolbar */}
        <div className="flex items-center gap-2">
          {/* Toggle left panel */}
          <button
            onClick={() => setLeftPanelOpen(!leftPanelOpen)}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors ease-out"
            title={leftPanelOpen ? "Hide hierarchy" : "Show hierarchy"}
          >
            {leftPanelOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeftOpen className="w-4 h-4" />
            )}
          </button>

          {world && (
            <span className="text-sm text-text-primary font-medium">
              {world.name}
            </span>
          )}

          {hasUnsavedChanges && (
            <span className="text-xs text-yellow-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Unsaved
            </span>
          )}

          {saveSuccess && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <Check className="w-3 h-3" />
              Saved
            </span>
          )}
        </div>

        {/* Right toolbar */}
        <div className="flex items-center gap-2">
          {/* Camera mode toggle */}
          {onFlyModeToggle && (
            <div className="flex items-center bg-bg-tertiary rounded-lg p-0.5">
              <button
                onClick={() => onFlyModeToggle(false)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                  !flyModeEnabled
                    ? "bg-primary text-white"
                    : "text-text-secondary hover:text-text-primary"
                } ease-out`}
                title="Selection Mode - Click to select terrain, towns, buildings"
              >
                <MousePointer2 className="w-3 h-3" />
                Select
              </button>
              <button
                onClick={() => onFlyModeToggle(true)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                  flyModeEnabled
                    ? "bg-blue-500 text-white"
                    : "text-text-secondary hover:text-text-primary"
                } ease-out`}
                title="Fly Mode - Click to capture mouse, WASD to move"
              >
                <Navigation className="w-3 h-3" />
                Fly
              </button>
            </div>
          )}

          {/* Overlay controls */}
          {world && <OverlayDropdown />}

          {/* Separator */}
          {world && <div className="w-px h-6 bg-border-primary" />}

          {/* Import */}
          {onImport && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleImportClick}
              className="text-xs"
            >
              <Upload className="w-3 h-3 mr-1" />
              Import
            </Button>
          )}

          {/* Export (WorldBuilder format) */}
          {onExport && world && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onExport}
              className="text-xs"
            >
              <Download className="w-3 h-3 mr-1" />
              Export
            </Button>
          )}

          {/* Export to Game format */}
          {onExportToGame && world && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onExportToGame}
              className="text-xs bg-green-600/20 hover:bg-green-600/30 border-green-600/50"
              title="Export as game manifests (buildings.json + world-config.json)"
            >
              <Download className="w-3 h-3 mr-1" />
              Export to Game
            </Button>
          )}

          {/* Export All Manifests */}
          {onExportAllManifests && world && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onExportAllManifests}
              className="text-xs bg-purple-600/20 hover:bg-purple-600/30 border-purple-600/50"
              title="Export all manifests (npcs, mobs, bosses, quests, zones, etc.)"
            >
              <FileJson className="w-3 h-3 mr-1" />
              Export All
            </Button>
          )}

          {/* Save to IndexedDB */}
          {onSaveToIndexedDB && world && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onSaveToIndexedDB}
              className="text-xs bg-cyan-600/20 hover:bg-cyan-600/30 border-cyan-600/50"
              title="Save world to browser storage (IndexedDB)"
            >
              <Database className="w-3 h-3 mr-1" />
              Save Local
            </Button>
          )}

          {/* Load from IndexedDB */}
          {onImportFromIndexedDB && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onImportFromIndexedDB}
              className="text-xs bg-cyan-600/20 hover:bg-cyan-600/30 border-cyan-600/50"
              title="Load world from browser storage"
            >
              <FolderOpen className="w-3 h-3 mr-1" />
              Load Local
            </Button>
          )}

          {/* Save */}
          {onSave && world && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className="text-xs"
            >
              <Save className="w-3 h-3 mr-1" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          )}

          {/* Toggle right panel */}
          <button
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors ease-out"
            title={rightPanelOpen ? "Hide properties" : "Show properties"}
          >
            {rightPanelOpen ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRightOpen className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Save error banner */}
      {saveError && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-sm text-red-400">{saveError}</span>
          <button
            onClick={() => actions.setSaveError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            ×
          </button>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Hierarchy */}
        {leftPanelOpen && (
          <>
            <div
              className="flex-shrink-0 overflow-hidden"
              style={{ width: leftPanelWidth }}
            >
              <HierarchyPanel onAddLayer={handleAddLayer} />
            </div>
            <ResizeHandle onResize={handleLeftResize} position="left" />
          </>
        )}

        {/* Center - Viewport */}
        <div className="flex-1 overflow-hidden bg-bg-primary">{viewport}</div>

        {/* Right panel - Properties */}
        {rightPanelOpen && (
          <>
            <ResizeHandle onResize={handleRightResize} position="right" />
            <div
              className="flex-shrink-0 overflow-hidden"
              style={{ width: rightPanelWidth }}
            >
              <PropertiesPanel />
            </div>
          </>
        )}
      </div>

      {/* Add Entity Dialogs */}
      <AddNPCDialog
        isOpen={showAddNPCDialog}
        onClose={() => setShowAddNPCDialog(false)}
      />
      <AddQuestDialog
        isOpen={showAddQuestDialog}
        onClose={() => setShowAddQuestDialog(false)}
      />
      <AddBossDialog
        isOpen={showAddBossDialog}
        onClose={() => setShowAddBossDialog(false)}
      />
      <AddEventDialog
        isOpen={showAddEventDialog}
        onClose={() => setShowAddEventDialog(false)}
      />
      <AddLoreDialog
        isOpen={showAddLoreDialog}
        onClose={() => setShowAddLoreDialog(false)}
      />
      <AddDifficultyZoneDialog
        isOpen={showAddDifficultyZoneDialog}
        onClose={() => setShowAddDifficultyZoneDialog(false)}
      />
      <AddCustomPlacementDialog
        isOpen={showAddCustomPlacementDialog}
        onClose={() => setShowAddCustomPlacementDialog(false)}
      />
    </div>
  );
};

export default EditorLayout;
