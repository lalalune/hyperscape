/**
 * NewWorldDialog — Modal for creating a new world project.
 *
 * Phase B1'.1 of `PLAN_PROJECT_AS_DATA.md`. Three-mode picker:
 *
 *   - **Design with AI** (HERO) — opens the conversational
 *     onboarding flow (B1'.2 — `DesignWithAIDialog`). The agent
 *     asks 2–4 clarifying questions, proposes a plan, and on
 *     confirmation fires `PROPOSE_*` actions in sequence to
 *     populate the project's terrain + plugins + content.
 *
 *   - **Start blank** — empty flat-ish terrain (no towns, no
 *     vegetation, no plugins). Designer/agent fills it later.
 *
 *   - **Start from template** — clone a saved template (Hyperia
 *     today; future contributed templates). Reveals a sub-picker.
 *
 * Substrate (Project schema, plugin set resolution, agent action
 * surface) is shipped in B0'.A–B0'.J. This dialog is the user-
 * facing surface that captures the platform's identity.
 */

import { AlertTriangle, Globe, Loader2, Sparkles, Wand2 } from "lucide-react";
import React, { useEffect, useState, useCallback } from "react";

import { Modal, ModalHeader, ModalBody, ModalFooter } from "../common/Modal";
import { BLANK_CREATION_CONFIG } from "../WorldBuilder/types";
import { generateWorldFromConfig } from "../WorldBuilder/worldGeneration";
import { serializeWorld } from "../WorldBuilder/utils/worldPersistence";
import {
  createWorldProject,
  forkProjectPack,
  listProjectPacks,
  type ProjectPack,
} from "../../utils/worldProjectApi";
import { DesignWithAIDialog } from "./DesignWithAIDialog";

interface NewWorldDialogProps {
  teamId: string;
  gameId: string;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}

/**
 * Top-level mode the user picks. The first two are terminal —
 * they create a project directly. "Template" reveals a sub-picker
 * for the specific template id.
 */
type CreationMode = "ai" | "blank" | "template";

export function NewWorldDialog({
  teamId,
  gameId,
  onClose,
  onCreated,
}: NewWorldDialogProps) {
  const [mode, setMode] = useState<CreationMode>("ai");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * When the user picks "Design with AI" and clicks the CTA, the
   * conversational dialog (B1'.2) takes over. We render it as a
   * separate sibling overlay; this dialog stays mounted but
   * visually hidden behind it so the user can fall back if they
   * change their mind.
   */
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  // Project packs loaded for the "Start from template"
  // sub-picker. Replaces the prior `listProjectTemplates`
  // (hardcoded TS list) with `/api/project-packs` — the
  // unified DB-backed catalog populated by the server's
  // built-in bootstrap (`server/builtins/project-packs.ts`)
  // plus marketplace + team uploads.
  const [packs, setPacks] = useState<ProjectPack[]>([]);
  const [packsLoading, setPacksLoading] = useState(true);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listProjectPacks()
      .then((list) => {
        if (cancelled) return;
        setPacks(list);
        if (list[0]) setSelectedPackId(list[0].manifestId);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.warn("[NewWorldDialog] project pack fetch failed:", err);
      })
      .finally(() => {
        if (!cancelled) setPacksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = useCallback(async () => {
    // B1'.2: "Design with AI" mode opens the conversational
    // onboarding dialog. Project creation happens INSIDE that
    // dialog after the agent emits a plan; this handler just
    // routes to the dialog and exits.
    if (mode === "ai") {
      setError(null);
      setAiDialogOpen(true);
      return;
    }

    if (!name.trim()) return;
    if (mode === "template" && !selectedPackId) return;

    setIsCreating(true);
    setError(null);

    try {
      // After the early-return at the top of this handler,
      // `mode` is narrowed to `"blank" | "template"`. AI mode is
      // handled by `DesignWithAIDialog`.
      if (mode === "template") {
        // Project pack fork — the AAA "create from template"
        // path. One POST → fully-configured project with
        // plugins + content packs + initial config baked in.
        // The fork backend reads the manifest's pluginIds /
        // contentPackIds / initialConfig / initialWorldContent
        // and writes them onto the new world_projects row;
        // procgen runs on first open.
        const result = await forkProjectPack({
          projectPackId: selectedPackId!,
          teamId,
          gameId,
          name: name.trim(),
          description: description.trim() || null,
        });
        onCreated(result.projectId);
        return;
      }

      // Blank mode — no pack, no template; just create an
      // empty project. Procgen runs on first open with the
      // engine baseline (one neutral default biome from
      // GAME_BIOME_DEFINITIONS, no plugins, no content packs).
      const worldData = await new Promise<ReturnType<typeof serializeWorld>>(
        (resolve, reject) => {
          setTimeout(() => {
            try {
              const config = {
                ...BLANK_CREATION_CONFIG,
                seed: Math.floor(Math.random() * 2147483647),
              };
              const world = generateWorldFromConfig(config);
              resolve(serializeWorld(world));
            } catch (err) {
              reject(err);
            }
          }, 50);
        },
      );

      const project = await createWorldProject({
        teamId,
        gameId,
        name: name.trim(),
        description: description.trim() || undefined,
        templateId: "blank",
        worldData,
      });
      onCreated(project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create world");
      setIsCreating(false);
    }
  }, [name, description, teamId, gameId, onCreated, mode, selectedPackId]);

  const canCreate =
    !isCreating &&
    // AI mode doesn't require a name here — the conversational
    // dialog derives the project name from the conversation.
    (mode === "ai" || !!name.trim()) &&
    !(mode === "template" && (!selectedPackId || packsLoading));

  // When the AI dialog is open, render it as a sibling overlay
  // *instead* of the picker modal — the picker stays mounted in
  // React tree (so cancelling the AI dialog returns to it) but
  // the modal is hidden behind the AI overlay's backdrop.
  if (aiDialogOpen) {
    return (
      <DesignWithAIDialog
        teamId={teamId}
        gameId={gameId}
        onClose={() => setAiDialogOpen(false)}
        onCreated={(projectId) => {
          setAiDialogOpen(false);
          onCreated(projectId);
        }}
      />
    );
  }

  return (
    <Modal open onClose={onClose} size="lg">
      <ModalHeader onClose={onClose}>New World</ModalHeader>
      <ModalBody>
        <div className="space-y-5">
          {/* ── Mode picker ────────────────────────────────── */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
              How would you like to start?
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {/* Hero card — Design with AI. Spans wider/taller. */}
              <ModeCard
                title="Design with AI"
                description="Tell the AI what kind of world you want. It asks a few questions, then builds the terrain, picks plugins, and places content for you."
                icon={Sparkles}
                isHero
                selected={mode === "ai"}
                onSelect={() => setMode("ai")}
                disabled={isCreating}
                badge="Recommended"
              />
              <ModeCard
                title="Start blank"
                description="Empty flat terrain. No plugins, no content. Build manually or chat with AI later."
                icon={Globe}
                selected={mode === "blank"}
                onSelect={() => setMode("blank")}
                disabled={isCreating}
              />
              <ModeCard
                title="Start from template"
                description="Clone a saved template. Hyperia (the reference RPG) is included as a sample to study or fork."
                icon={Wand2}
                selected={mode === "template"}
                onSelect={() => setMode("template")}
                disabled={isCreating}
              />
            </div>
          </div>

          {/* ── Template sub-picker (visible only in template mode) ── */}
          {mode === "template" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">
                Project Pack
              </label>
              {packsLoading ? (
                <div className="flex items-center gap-2 p-3 bg-bg-tertiary rounded text-xs text-text-secondary">
                  <Loader2 size={14} className="animate-spin text-primary" />
                  <span>Loading project packs…</span>
                </div>
              ) : packs.length === 0 ? (
                <div className="p-3 bg-bg-tertiary rounded text-xs text-text-tertiary">
                  No project packs available. Server bootstrap may still be
                  running — refresh in a moment.
                </div>
              ) : (
                <div className="space-y-1.5" role="radiogroup">
                  {packs.map((p) => (
                    <ProjectPackOption
                      key={p.manifestId}
                      pack={p}
                      selected={selectedPackId === p.manifestId}
                      onSelect={() => setSelectedPackId(p.manifestId)}
                      disabled={isCreating}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── AI flow notice ─────────────────────────────── */}
          {mode === "ai" && (
            <div className="p-3 bg-primary/10 border border-primary/30 rounded text-xs text-text-secondary">
              <strong className="text-primary">Next:</strong> click{" "}
              <em>Start with AI</em> below — a chat will open where the AI asks
              about the world you want, drafts a plan, and creates the project
              from your answers.
            </div>
          )}

          {/* ── Name + description ───────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary focus:outline-none focus:border-primary/50 placeholder:text-text-tertiary"
              placeholder="My World"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canCreate) handleCreate();
              }}
              autoFocus
              disabled={isCreating}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">
              Description
            </label>
            <textarea
              className="w-full px-3 py-2 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary focus:outline-none focus:border-primary/50 placeholder:text-text-tertiary resize-none"
              placeholder="A brief description of your world..."
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isCreating}
            />
          </div>

          {isCreating && (
            <div className="flex items-center gap-2 p-3 bg-bg-tertiary rounded text-xs text-text-secondary">
              <Loader2 size={14} className="animate-spin text-primary" />
              <span>Generating terrain and creating world...</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <div className="flex items-center gap-2 w-full">
          <button
            className="flex-1 px-3 py-2 text-xs font-medium rounded bg-bg-tertiary border border-border-primary text-text-primary hover:bg-bg-secondary transition-colors"
            onClick={onClose}
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleCreate}
            disabled={!canCreate}
          >
            {isCreating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Creating...
              </>
            ) : mode === "ai" ? (
              <>
                <Sparkles size={14} />
                Start with AI
              </>
            ) : (
              <>
                <Globe size={14} />
                Create World
              </>
            )}
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
}

// ────────────────────────── ModeCard ──────────────────────────

interface ModeCardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
  /** Flagship card — gets richer styling. */
  isHero?: boolean;
  badge?: string;
}

function ModeCard({
  title,
  description,
  icon: Icon,
  selected,
  onSelect,
  disabled,
  isHero,
  badge,
}: ModeCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      disabled={disabled}
      className={`relative text-left p-3 rounded border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
        selected
          ? isHero
            ? "border-primary bg-primary/15 ring-1 ring-primary"
            : "border-primary bg-primary/10"
          : isHero
            ? "border-primary/30 bg-bg-tertiary hover:border-primary/60 hover:bg-bg-secondary"
            : "border-border-primary bg-bg-tertiary hover:bg-bg-secondary"
      }`}
    >
      {badge && (
        <div className="absolute top-1.5 right-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/20 text-primary uppercase tracking-wider">
          {badge}
        </div>
      )}
      <div className="flex items-start gap-2.5">
        <div
          className={`mt-0.5 flex-shrink-0 ${
            selected ? "text-primary" : "text-text-secondary"
          }`}
        >
          <Icon size={isHero ? 20 : 16} />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className={`text-sm font-semibold ${isHero ? "text-text-primary" : "text-text-primary"}`}
          >
            {title}
          </div>
          <div className="text-xs text-text-secondary mt-1 leading-relaxed">
            {description}
          </div>
        </div>
      </div>
    </button>
  );
}

// ────────────────────────── ProjectPackOption ─────────────────────

interface ProjectPackOptionProps {
  pack: ProjectPack;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
}

function ProjectPackOption({
  pack,
  selected,
  onSelect,
  disabled,
}: ProjectPackOptionProps) {
  const pluginCount = pack.manifest.pluginIds.length;
  const contentPackCount = pack.manifest.contentPackIds.length;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      disabled={disabled}
      className={`w-full text-left p-3 rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        selected
          ? "border-primary bg-primary/10"
          : "border-border-primary bg-bg-tertiary hover:bg-bg-secondary"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 ${
            selected ? "border-primary" : "border-border-primary"
          }`}
        >
          {selected && (
            <div className="w-2 h-2 rounded-full bg-primary m-0.5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text-primary">
            {pack.manifest.name}
          </div>
          {pack.manifest.description && (
            <div className="text-xs text-text-secondary mt-0.5">
              {pack.manifest.description}
            </div>
          )}
          <div className="text-[11px] text-text-tertiary mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
            {pluginCount > 0 && (
              <span>
                {pluginCount} plugin{pluginCount === 1 ? "" : "s"}
              </span>
            )}
            {contentPackCount > 0 && (
              <span>
                {contentPackCount} content pack
                {contentPackCount === 1 ? "" : "s"}
              </span>
            )}
            {pluginCount === 0 && contentPackCount === 0 && (
              <span>Empty starter — procgen terrain only</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
