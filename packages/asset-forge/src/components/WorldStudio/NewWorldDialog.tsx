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
 *   - **Fork a starter game** — one-click clone of a complete
 *     project pack (plugins + content packs + assets all
 *     installed). Hyperia is the canonical reference; future
 *     packs (themed RPGs, shooters, etc.) auto-appear from the
 *     marketplace + built-in catalog. Internally calls
 *     `forkProjectPack` → `/api/project-packs/fork`. The mode
 *     `key` stays `"template"` for backward compat with state.
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
            <label className="text-xs font-medium text-text-secondary uppercase tracking-[0.12em]">
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
                title="Fork a starter game"
                description="One-click clone of a complete game — plugins + content packs + assets all installed. Hyperia (the reference RPG) is included; pick from any project pack in the catalog."
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
              Name <span className="text-error">*</span>
            </label>
            <input
              type="text"
              className="input"
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
              className="input resize-none"
              placeholder="A brief description of your world…"
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
            <div className="flex items-start gap-2 p-3 bg-error/10 border border-error/30 rounded-md text-xs text-error">
              <AlertTriangle
                size={13}
                strokeWidth={1.5}
                className="flex-shrink-0 mt-0.5"
              />
              <span>{error}</span>
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <div className="flex items-center gap-2 w-full">
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={onClose}
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary flex-1"
            onClick={handleCreate}
            disabled={!canCreate}
          >
            {isCreating ? (
              <>
                <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
                Creating…
              </>
            ) : mode === "ai" ? (
              <>
                <Sparkles size={13} strokeWidth={1.5} />
                Start with AI
              </>
            ) : mode === "template" ? (
              <>
                <Wand2 size={13} strokeWidth={1.5} />
                Fork project pack
              </>
            ) : (
              <>
                <Globe size={13} strokeWidth={1.5} />
                Create world
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
      className={`group relative text-left p-5 rounded-lg border transition-colors duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed ${
        selected
          ? isHero
            ? "border-primary/60 bg-primary/10"
            : "border-primary/40 bg-primary/5"
          : isHero
            ? "border-border-primary bg-bg-tertiary hover:border-primary/40"
            : "border-border-primary bg-bg-tertiary hover:border-primary/40"
      }`}
    >
      {/* Forge Gold left edge on the hero card when selected */}
      {isHero && selected && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-5 bottom-5 w-px bg-primary"
        />
      )}
      {badge && (
        <div className="absolute top-2 right-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/15 text-primary uppercase tracking-[0.14em]">
          {badge}
        </div>
      )}
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex-shrink-0 transition-colors duration-300 ease-out ${
            selected
              ? "text-primary"
              : "text-text-tertiary group-hover:text-primary"
          }`}
        >
          <Icon size={isHero ? 18 : 14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-sm font-medium text-text-primary tracking-tight">
            {title}
          </div>
          <div className="text-xs text-text-tertiary mt-1.5 leading-relaxed">
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
      className={`group w-full text-left p-4 rounded-lg border transition-colors duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed ${
        selected
          ? "border-primary/40 bg-primary/5"
          : "border-border-primary bg-bg-tertiary hover:border-primary/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 w-3.5 h-3.5 rounded-full border flex-shrink-0 transition-colors duration-300 ease-out ${
            selected
              ? "border-primary"
              : "border-border-primary group-hover:border-primary/40"
          }`}
        >
          {selected && (
            <div className="w-1.5 h-1.5 rounded-full bg-primary m-0.5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-sm font-medium text-text-primary tracking-tight">
            {pack.manifest.name}
          </div>
          {pack.manifest.description && (
            <div className="text-xs text-text-tertiary mt-1 leading-relaxed">
              {pack.manifest.description}
            </div>
          )}
          <div className="text-[10px] text-text-tertiary uppercase tracking-[0.12em] mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {pluginCount > 0 && (
              <span>
                <span className="font-mono normal-case tracking-normal tabular-nums">
                  {pluginCount}
                </span>{" "}
                plugin{pluginCount === 1 ? "" : "s"}
              </span>
            )}
            {pluginCount > 0 && contentPackCount > 0 && (
              <span className="text-text-tertiary/40">·</span>
            )}
            {contentPackCount > 0 && (
              <span>
                <span className="font-mono normal-case tracking-normal tabular-nums">
                  {contentPackCount}
                </span>{" "}
                content pack{contentPackCount === 1 ? "" : "s"}
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
