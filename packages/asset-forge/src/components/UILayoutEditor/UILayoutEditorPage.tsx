/**
 * UILayoutEditorPage — World Studio UI Layout Editor (asset-scoped).
 *
 * Always loads a specific UILayoutManifest asset by URL:
 *   `/ui-layout/:teamId/:layoutId`
 *
 * The library panel at `/ui-layout` is the entry point; individual
 * layouts open here.
 *
 * Four-pane layout:
 *   - Palette (left, widget catalog)
 *   - Preview canvas (center, placeholder bounding boxes)
 *   - Outliner (right, instance list)
 *   - Inspector (below outliner, auto-generated from the selected
 *     widget's Zod propsSchema)
 *
 * Also shows a live validation-issue list derived from
 * `@hyperforge/ui-framework`'s `validateLayout`.
 */

import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Layers,
  Loader2,
  Save,
  Settings2,
  Star,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ROUTES } from "../../constants";
import { getUILayout, updateUILayout } from "../../utils/uiLayoutApi";
import {
  fetchGame,
  setGameActiveUILayout,
  type GameResponse,
} from "../../utils/worldProjectApi";
import { useStudioProject } from "../WorldStudio/WorldStudioContext";
import { CanvasToolbar } from "./CanvasToolbar";
import { LayoutOutliner } from "./LayoutOutliner";
import { LayoutPreview } from "./LayoutPreview";
import { useUILayoutStore } from "./store";
import { ValidationIssues } from "./ValidationIssues";
import { WidgetPalette } from "./WidgetPalette";
import { WidgetPropertyInspector } from "./WidgetPropertyInspector";

type LoadStatus = "idle" | "loading" | "loaded" | "error";
type SaveStatus = "idle" | "saving" | "saved" | "error";

export function UILayoutEditorPage() {
  const { teamId, layoutId } = useParams<{
    teamId: string;
    layoutId: string;
  }>();
  const navigate = useNavigate();

  const layout = useUILayoutStore((s) => s.layout);
  const asset = useUILayoutStore((s) => s.asset);
  const isDirty = useUILayoutStore((s) => s.isDirty);
  const loadAsset = useUILayoutStore((s) => s.loadAsset);
  const markClean = useUILayoutStore((s) => s.markClean);
  const selectInstance = useUILayoutStore((s) => s.selectInstance);
  const removeInstance = useUILayoutStore((s) => s.removeInstance);

  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // "Set as Active" wiring. We only expose the button when the studio
  // project context has a current game — that's the scope the button
  // binds to. The game record's `activeUiLayoutId` is fetched up-front
  // so we can toggle the button's label between "Set as Active" and
  // "Active" without a round trip.
  const { currentGameId } = useStudioProject();
  const [game, setGame] = useState<GameResponse | null>(null);
  const [activateStatus, setActivateStatus] = useState<
    "idle" | "pending" | "done" | "error"
  >("idle");
  const [activateError, setActivateError] = useState<string | null>(null);

  // Load the asset whenever the URL params change. The route pattern
  // guarantees both `teamId` and `layoutId` are present, but we
  // defensively skip the fetch if they're ever undefined.
  useEffect(() => {
    if (!teamId || !layoutId) return;

    let cancelled = false;
    setLoadStatus("loading");
    setLoadError(null);
    getUILayout(teamId, layoutId)
      .then((detail) => {
        if (cancelled) return;
        loadAsset(detail);
        setLoadStatus("loaded");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadStatus("error");
        setLoadError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
    // `loadAsset` is a stable zustand selector — omitting it from the
    // dep list keeps this effect keyed purely on URL params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, layoutId]);

  // Fetch the current game so we can show whether this layout is
  // already active. Silent failure: if the game record can't be
  // fetched (e.g. the editor was opened without a studio project
  // selected), the "Set as Active" button is simply hidden.
  useEffect(() => {
    if (!teamId || !currentGameId) {
      setGame(null);
      return;
    }
    let cancelled = false;
    fetchGame(teamId, currentGameId)
      .then((g) => {
        if (!cancelled) setGame(g);
      })
      .catch(() => {
        if (!cancelled) setGame(null);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId, currentGameId]);

  const isActiveForCurrentGame =
    !!game && !!layoutId && game.activeUiLayoutId === layoutId;

  const handleSetActive = async () => {
    if (!teamId || !currentGameId || !layoutId) return;
    setActivateStatus("pending");
    setActivateError(null);
    try {
      const updated = await setGameActiveUILayout(
        teamId,
        currentGameId,
        layoutId,
      );
      setGame(updated);
      setActivateStatus("done");
      setTimeout(() => setActivateStatus("idle"), 1500);
    } catch (err: unknown) {
      setActivateStatus("error");
      setActivateError(err instanceof Error ? err.message : String(err));
    }
  };

  // Keyboard shortcuts:
  //   - Delete / Backspace → remove selected widget
  //   - Escape             → deselect
  // Ignored while the user is typing in an input / textarea /
  // contentEditable element so we never swallow their keystrokes.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      if (e.key === "Escape") {
        selectInstance(null);
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const id = useUILayoutStore.getState().selectedInstanceId;
        if (id) {
          e.preventDefault();
          removeInstance(id);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectInstance, removeInstance]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(layout, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${layout.id || "ui-layout"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    if (!teamId || !layoutId || !asset) return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const updated = await updateUILayout(teamId, layoutId, {
        manifestData: layout,
      });
      markClean({
        id: updated.id,
        teamId: updated.teamId,
        gameId: updated.gameId,
        name: updated.name,
        slug: updated.slug,
        description: updated.description,
        version: updated.version,
        isTemplate: updated.isTemplate,
        isPublic: updated.isPublic,
        createdBy: updated.createdBy,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      });
      setSaveStatus("saved");
      // Auto-revert status back to idle after a moment so the button
      // doesn't linger in the "Saved" state.
      setTimeout(() => setSaveStatus("idle"), 1500);
    } catch (err: unknown) {
      setSaveStatus("error");
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleBack = () => {
    if (isDirty) {
      const ok = window.confirm(
        "You have unsaved changes. Leave without saving?",
      );
      if (!ok) return;
    }
    navigate(ROUTES.WORLD_STUDIO);
  };

  // Loading-state shell.
  if (loadStatus === "loading") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-bg-primary">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  // Error-state shell. The Back button still works so the user isn't
  // stranded on a broken page.
  if (loadStatus === "error") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-bg-primary">
        <p className="text-sm text-red-400">
          Failed to load UI layout: {loadError}
        </p>
        <button
          onClick={handleBack}
          className="flex items-center gap-1 rounded-md border border-bg-tertiary bg-bg-secondary px-5 py-1.5 text-xs text-text-secondary hover:border-primary/50 hover:text-primary"
        >
          <ArrowLeft size={12} />
          Back to World Studio
        </button>
      </div>
    );
  }

  const headerLabel = asset
    ? `${asset.name}${isDirty ? " •" : ""}`
    : layout.name;

  return (
    <div className="flex h-full w-full flex-col bg-bg-primary">
      <header className="flex items-center justify-between border-b border-bg-tertiary px-4 py-2">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 rounded-md border border-bg-tertiary bg-bg-secondary px-2 py-1 text-xs text-text-secondary hover:border-primary/50 hover:text-primary"
            title="Back to World Studio"
          >
            <ArrowLeft size={12} />
            Back
          </button>
          <div>
            <h1 className="text-sm font-semibold text-text-primary">
              UI Layout Editor
            </h1>
            <p className="text-[10px] text-text-tertiary">
              Asset · {headerLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activateStatus === "error" && (
            <span
              className="text-[11px] text-red-400"
              title={activateError ?? ""}
            >
              Activate failed
            </span>
          )}
          {currentGameId && (
            <button
              onClick={handleSetActive}
              disabled={activateStatus === "pending" || isActiveForCurrentGame}
              title={
                isActiveForCurrentGame
                  ? "This layout is already active for the current game"
                  : "Pin this layout as the active HUD for the current game"
              }
              className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs disabled:cursor-not-allowed ${
                isActiveForCurrentGame
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                  : "border-bg-tertiary bg-bg-secondary text-text-secondary hover:border-primary/50 hover:text-primary"
              }`}
            >
              {activateStatus === "pending" ? (
                <Loader2 size={12} className="animate-spin" />
              ) : isActiveForCurrentGame ? (
                <CheckCircle2 size={12} />
              ) : (
                <Star size={12} />
              )}
              {isActiveForCurrentGame ? "Active" : "Set as Active"}
            </button>
          )}
          {saveStatus === "error" && (
            <span className="text-[11px] text-red-400" title={saveError ?? ""}>
              Save failed
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty || saveStatus === "saving"}
            className="flex items-center gap-1 rounded-md border border-primary/50 bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saveStatus === "saving" ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Save size={12} />
            )}
            {saveStatus === "saved" ? "Saved" : "Save"}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1 rounded-md border border-bg-tertiary bg-bg-secondary px-2 py-1 text-xs text-text-secondary hover:border-primary/50 hover:text-primary"
          >
            <Download size={12} />
            Export JSON
          </button>
        </div>
      </header>

      <div className="grid flex-1 min-h-0 grid-cols-[200px_minmax(0,1fr)_240px]">
        <aside className="overflow-y-auto border-r border-bg-tertiary">
          <WidgetPalette />
        </aside>

        <main className="flex min-h-0 flex-col">
          <CanvasToolbar />
          <div className="flex-1 min-h-0">
            <LayoutPreview />
          </div>
          <footer className="border-t border-bg-tertiary p-3">
            <ValidationIssues />
          </footer>
        </main>

        <RightSidebar />
      </div>
    </div>
  );
}

/**
 * Right sidebar with tabbed panels: Properties and Outliner.
 * Only one tab is visible at a time, so whichever is active
 * gets the full pane height — no wasted vertical space from an
 * empty Outliner pushing Properties below the fold.
 *
 * UX rationale:
 *   - Properties is the default tab because it's what the author
 *     interacts with most once widgets are placed.
 *   - Selecting a widget (in the outliner OR on the canvas) auto-
 *     switches to Properties so edits happen without a manual tab
 *     click — matching Figma/Unity inspector behavior.
 *   - A count badge on the Outliner tab keeps instance count
 *     visible even when the tab isn't active.
 *   - The active tab is persisted to localStorage so the author's
 *     preference survives across sessions.
 */
type RightTab = "properties" | "outliner";

function RightSidebar() {
  const selectedId = useUILayoutStore((s) => s.selectedInstanceId);
  const instanceCount = useUILayoutStore((s) => s.layout.instances.length);

  const [tab, setTab] = useState<RightTab>(() => {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    return saved === "outliner" ? "outliner" : "properties";
  });

  useEffect(() => {
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  }, [tab]);

  // Auto-focus Properties when the author picks a widget (a very
  // strong signal they want to edit it). Only when currently on
  // Outliner — otherwise we'd just be rewriting the same state.
  useEffect(() => {
    if (selectedId && tab === "outliner") setTab("properties");
    // We intentionally don't depend on `tab` here; this should only
    // fire on selection change, not when the user manually flips tabs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden border-l border-bg-tertiary">
      <div
        role="tablist"
        aria-label="Right sidebar"
        className="flex shrink-0 border-b border-bg-tertiary bg-bg-secondary"
      >
        <RightSidebarTab
          active={tab === "properties"}
          onClick={() => setTab("properties")}
          icon={<Settings2 size={12} />}
          label="Properties"
        />
        <RightSidebarTab
          active={tab === "outliner"}
          onClick={() => setTab("outliner")}
          icon={<Layers size={12} />}
          label="Outliner"
          badge={instanceCount}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "properties" ? (
          <WidgetPropertyInspector />
        ) : (
          <LayoutOutliner />
        )}
      </div>
    </aside>
  );
}

function RightSidebarTab({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
        active
          ? "border-primary bg-bg-primary text-text-primary"
          : "border-transparent text-text-tertiary hover:bg-bg-tertiary/40 hover:text-text-secondary"
      } ease-out`}
    >
      {icon}
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className={`ml-0.5 rounded px-1.5 py-px text-[9px] ${
            active
              ? "bg-primary/20 text-primary"
              : "bg-bg-tertiary text-text-tertiary"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

const TAB_STORAGE_KEY = "world-studio.ui-layout.right-tab";
