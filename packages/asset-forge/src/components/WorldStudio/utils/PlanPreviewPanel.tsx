/**
 * Project Plan right-rail panel.
 *
 * Phase 1.2 sixteenth carve from DesignWithAIDialog — the
 * largest single-cut yet. Three tightly-coupled React components:
 *
 *   - `PlanPreviewPanel` — top-level panel showing the project
 *     plan as it accumulates. Each slot is *active*: when set,
 *     ✓ + summary + remove. When empty, a click sends a "fill
 *     this slot" prompt to the agent — the panel literally is
 *     the next-step menu. Primary slots render up top; secondary
 *     slots collapse under "World Detail" until any are filled.
 *
 *   - `PlanSlot` — generic per-slot row (icon + title + summary
 *     + remove + child content + empty-state CTA).
 *
 *   - `SecondarySlotEntryList` — inline entry list for expanded
 *     secondary slots, capped at MAX_INLINE_ENTRIES with a
 *     "+N more" tail when over-cap.
 *
 * The panel's per-slot CTAs are wired to props (onAskFor,
 * onRemove*) so the dialog can route them into its agent-send +
 * removal-action plumbing.
 *
 * Phase B1'.7 of `PLAN_PROJECT_AS_DATA.md`.
 */

import {
  ArrowRight,
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  Layout,
  Loader2,
  Map as MapIcon,
  Palette,
  ScrollText,
  Sparkles,
  Swords,
  Trash2,
  Users,
} from "lucide-react";
import React, { useEffect, useState } from "react";

import type { OnboardingPlan } from "./onboardingPlan";
import {
  PLAN_SLOTS,
  countSetSlots,
  isSlotSet,
  type PlanSlotKey,
} from "./planSlots";
import { terrainSummary } from "./planSummary";
import {
  collectSecondarySlotEntries,
  getEmptyPrompt,
  secondarySlotCount,
  secondarySlotSummary,
} from "./secondarySlotSummaries";
import { isContentPackId } from "./contentPackConstants";

export interface PlanPreviewPanelProps {
  plan: OnboardingPlan;
  canBuild: boolean;
  isCreating: boolean;
  /** True while an agent turn is running — disable next-action chips. */
  isPending: boolean;
  onBuild: () => void;
  /** Empty-slot click — sends `prompt` to the agent. */
  onAskFor: (prompt: string) => void;
  onRemoveTerrain: () => void;
  onRemovePlugins: () => void;
  onRemoveNpc: (index: number) => void;
  onRemoveMobSpawn: (index: number) => void;
  onRemoveQuest: (index: number) => void;
  onRemoveAsset: (index: number) => void;
  onRemoveUiPack: () => void;
}

export function PlanPreviewPanel({
  plan,
  canBuild,
  isCreating,
  isPending,
  onBuild,
  onAskFor,
  onRemoveTerrain,
  onRemovePlugins,
  onRemoveNpc,
  onRemoveMobSpawn,
  onRemoveQuest,
  onRemoveAsset,
  onRemoveUiPack,
}: PlanPreviewPanelProps): React.ReactElement {
  const hasTerrain = plan.terrainConfig !== null;
  const hasPlugins = plan.pluginIds !== null && plan.pluginIds.length > 0;
  const hasUiPack = plan.uiPack !== null;
  const hasNpcs = plan.npcs.length > 0;
  const hasMobSpawns = plan.mobSpawns.length > 0;
  const hasQuests = plan.quests.length > 0;
  const hasAssets = plan.assets.length > 0;
  const hasTheme = isSlotSet(plan, "theme");
  const setCountAll = countSetSlots(plan, "all");
  const setCountPrimary = countSetSlots(plan, "primary");
  const setCountSecondary = countSetSlots(plan, "secondary");
  const primarySlots = PLAN_SLOTS.filter((s) => s.tier === "primary");
  const secondarySlots = PLAN_SLOTS.filter((s) => s.tier === "secondary");
  const totalSlots = PLAN_SLOTS.length;
  const totalPrimary = primarySlots.length;
  const allPrimarySet = setCountPrimary === totalPrimary;
  const [worldDetailOpen, setWorldDetailOpen] = useState(setCountSecondary > 0);
  // Auto-expand when the agent fills a secondary slot so the
  // user sees the work happening.
  useEffect(() => {
    if (setCountSecondary > 0) setWorldDetailOpen(true);
  }, [setCountSecondary]);

  // Theme summary — extract the content pack id from
  // `assetPackIds` and show its short name (arctic, tropical,
  // desert, volcanic, wetland, hyperia).
  const themePackId = (plan.assetPackIds ?? []).find((id) =>
    isContentPackId(id),
  );
  const themeSummary = themePackId
    ? themePackId
        .replace(/^@hyperforge\/content-pack-/, "")
        .replace(/-v\d+$/, "")
    : "No theme picked yet";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="text-[12px] font-semibold text-text-primary">
            Project Plan
          </div>
          <div
            className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
              allPrimarySet
                ? "bg-primary/15 text-primary"
                : "bg-bg-tertiary text-text-tertiary"
            }`}
          >
            {setCountAll}/{totalSlots}
          </div>
        </div>
        <div className="text-[11px] text-text-tertiary mt-1 leading-snug">
          {allPrimarySet
            ? "All core slots set. Generate your world below."
            : "Click an empty slot to ask the agent to fill it."}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto design-ai-scrollbar px-3 py-3 space-y-2">
        <PlanSlot
          icon={<Palette size={14} />}
          title="Theme"
          set={hasTheme}
          summary={hasTheme ? themeSummary : "No theme picked yet"}
          actionLabel="Pick a climate"
          onAction={
            hasTheme ? undefined : () => onAskFor(getEmptyPrompt("theme"))
          }
          actionDisabled={isPending || isCreating}
        />

        <PlanSlot
          icon={<Boxes size={14} />}
          title="Plugins"
          set={hasPlugins}
          summary={
            hasPlugins ? plan.pluginIds!.join(", ") : "No game plugins yet"
          }
          actionLabel="Pick a gameplay style"
          onAction={
            hasPlugins ? undefined : () => onAskFor(getEmptyPrompt("pluginIds"))
          }
          actionDisabled={isPending || isCreating}
          onRemove={hasPlugins ? onRemovePlugins : undefined}
        />

        <PlanSlot
          icon={<MapIcon size={14} />}
          title="Terrain"
          set={hasTerrain}
          summary={
            hasTerrain
              ? terrainSummary(plan.terrainConfig as Record<string, unknown>)
              : "Default flat terrain"
          }
          actionLabel="Shape the terrain"
          onAction={
            hasTerrain
              ? undefined
              : () => onAskFor(getEmptyPrompt("terrainConfig"))
          }
          actionDisabled={isPending || isCreating}
          onRemove={hasTerrain ? onRemoveTerrain : undefined}
        />

        <PlanSlot
          icon={<Users size={14} />}
          title="NPCs"
          set={hasNpcs}
          countBadge={hasNpcs ? plan.npcs.length : undefined}
          summary={hasNpcs ? `${plan.npcs.length} placed` : "No NPCs yet"}
          actionLabel="Add NPCs"
          onAction={
            hasNpcs ? undefined : () => onAskFor(getEmptyPrompt("npcs"))
          }
          actionDisabled={isPending || isCreating}
        >
          {hasNpcs && (
            <div className="mt-2 space-y-1">
              {plan.npcs.map((npc, i) => {
                const npcObj = (npc ?? {}) as Record<string, unknown>;
                const id =
                  typeof npcObj.id === "string" ? npcObj.id : `npc-${i}`;
                const name = typeof npcObj.name === "string" ? npcObj.name : id;
                const type =
                  typeof npcObj.type === "string" ? npcObj.type : "?";
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-bg-primary/60 rounded-md text-[11px] ring-1 ring-white/[0.05] group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-text-primary truncate font-medium">
                        {name}
                      </div>
                      <div className="text-text-tertiary truncate text-[10px]">
                        {type}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveNpc(i)}
                      className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-400 transition-opacity"
                      aria-label={`Remove ${name}`}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                disabled={isPending || isCreating}
                onClick={() => onAskFor("Add another NPC to my world.")}
                className="w-full mt-1 px-2.5 py-1.5 text-[11px] rounded-md bg-bg-primary/40 text-text-tertiary hover:text-primary hover:bg-bg-primary/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              >
                <ArrowRight size={10} />
                Add another
              </button>
            </div>
          )}
        </PlanSlot>

        <PlanSlot
          icon={<Swords size={14} />}
          title="Mob spawns"
          set={hasMobSpawns}
          countBadge={hasMobSpawns ? plan.mobSpawns.length : undefined}
          summary={
            hasMobSpawns
              ? `${plan.mobSpawns.length} placed`
              : "No mob spawns yet"
          }
          actionLabel="Place mobs"
          onAction={
            hasMobSpawns
              ? undefined
              : () => onAskFor(getEmptyPrompt("mobSpawns"))
          }
          actionDisabled={isPending || isCreating}
        >
          {hasMobSpawns && (
            <div className="mt-2 space-y-1">
              {plan.mobSpawns.map((spawn, i) => {
                const s = (spawn ?? {}) as {
                  mobId?: string;
                  position?: { x?: number; y?: number; z?: number };
                  maxCount?: number;
                };
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-bg-primary/60 rounded-md text-[11px] ring-1 ring-white/[0.05] group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-text-primary truncate font-medium">
                        {s.mobId ?? `spawn-${i}`}{" "}
                        <span className="text-text-tertiary font-normal">
                          ×{s.maxCount ?? "?"}
                        </span>
                      </div>
                      <div className="text-text-tertiary truncate text-[10px]">
                        ({s.position?.x ?? "?"}, {s.position?.y ?? "?"},{" "}
                        {s.position?.z ?? "?"})
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveMobSpawn(i)}
                      className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-400 transition-opacity"
                      aria-label={`Remove spawn`}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </PlanSlot>

        <PlanSlot
          icon={<ScrollText size={14} />}
          title="Quests"
          set={hasQuests}
          countBadge={hasQuests ? plan.quests.length : undefined}
          summary={
            hasQuests ? `${plan.quests.length} authored` : "No quests yet"
          }
          actionLabel="Add quests"
          onAction={
            hasQuests ? undefined : () => onAskFor(getEmptyPrompt("quests"))
          }
          actionDisabled={isPending || isCreating}
        >
          {hasQuests && (
            <div className="mt-2 space-y-1">
              {plan.quests.map((quest, i) => {
                const q = (quest ?? {}) as {
                  id?: string;
                  name?: string;
                  difficulty?: string;
                  stages?: unknown[];
                };
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-bg-primary/60 rounded-md text-[11px] ring-1 ring-white/[0.05] group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-text-primary truncate font-medium">
                        {q.name ?? q.id ?? `quest-${i}`}
                      </div>
                      <div className="text-text-tertiary truncate text-[10px]">
                        {q.difficulty ?? "?"} ·{" "}
                        {Array.isArray(q.stages) ? q.stages.length : 0} stages
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveQuest(i)}
                      className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-400 transition-opacity"
                      aria-label={`Remove quest`}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </PlanSlot>

        {hasAssets && (
          <PlanSlot
            icon={<Sparkles size={14} />}
            title="Asset bakes"
            set={true}
            countBadge={plan.assets.length}
            summary={`${plan.assets.length} queued`}
          >
            <div className="mt-2 space-y-1">
              {plan.assets.map((asset, i) => {
                const a = (asset ?? {}) as {
                  name?: string;
                  type?: string;
                  subtype?: string;
                };
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-bg-primary/60 rounded-md text-[11px] ring-1 ring-white/[0.05] group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-text-primary truncate font-medium">
                        {a.name ?? `asset-${i}`}
                      </div>
                      <div className="text-text-tertiary truncate text-[10px]">
                        {a.type ?? "?"} / {a.subtype ?? "?"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveAsset(i)}
                      className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-400 transition-opacity"
                      aria-label={`Remove asset`}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          </PlanSlot>
        )}

        <PlanSlot
          icon={<Layout size={14} />}
          title="HUD"
          set={hasUiPack}
          summary={
            hasUiPack
              ? `${(plan.uiPack as { id?: string })?.id ?? "Custom HUD pack"}`
              : "Default HUD"
          }
          actionLabel="Design the HUD"
          onAction={
            hasUiPack ? undefined : () => onAskFor(getEmptyPrompt("uiPack"))
          }
          actionDisabled={isPending || isCreating}
          onRemove={hasUiPack ? onRemoveUiPack : undefined}
        />

        {/* World Detail — secondary slots collapsed by default,
            auto-expanded once the agent fills any of them. */}
        <button
          type="button"
          onClick={() => setWorldDetailOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 mt-2 rounded-md bg-bg-tertiary/40 hover:bg-bg-tertiary/60 ring-1 ring-white/[0.04] transition-colors"
        >
          <div className="flex items-center gap-2">
            {worldDetailOpen ? (
              <ChevronDown size={12} className="text-text-tertiary" />
            ) : (
              <ChevronRight size={12} className="text-text-tertiary" />
            )}
            <div className="text-[11px] font-semibold text-text-secondary">
              World Detail
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-bg-secondary text-text-tertiary">
              {setCountSecondary}/{secondarySlots.length}
            </span>
          </div>
          <div className="text-[10px] text-text-tertiary">
            roads · pois · audio · mines · water
          </div>
        </button>

        {worldDetailOpen && (
          <div className="space-y-1.5 pt-1">
            {secondarySlots.map((slot) => {
              const set = isSlotSet(plan, slot.key);
              const Icon = slot.Icon;
              const summary = secondarySlotSummary(plan, slot.key);
              return (
                <PlanSlot
                  key={slot.key}
                  icon={<Icon size={14} />}
                  title={slot.short}
                  set={set}
                  summary={summary}
                  countBadge={
                    set ? secondarySlotCount(plan, slot.key) : undefined
                  }
                  actionLabel={`Add ${slot.short.toLowerCase()}`}
                  onAction={set ? undefined : () => onAskFor(slot.emptyPrompt)}
                  actionDisabled={isPending || isCreating}
                >
                  {set && (
                    <SecondarySlotEntryList plan={plan} slotKey={slot.key} />
                  )}
                </PlanSlot>
              );
            })}
          </div>
        )}
      </div>

      {/* Build CTA — gradient when ready, celebratory when all primary set */}
      <div className="px-3 py-3 space-y-2 bg-gradient-to-t from-bg-secondary/40 to-transparent">
        <button
          type="button"
          onClick={onBuild}
          disabled={!canBuild}
          className={`relative w-full flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-semibold rounded-lg transition-all disabled:cursor-not-allowed overflow-hidden group ${
            !canBuild
              ? "bg-bg-tertiary text-text-tertiary ring-1 ring-white/[0.06]"
              : allPrimarySet
                ? "bg-primary text-white ring-1 ring-primary/40"
                : "bg-primary text-white "
          }`}
        >
          {canBuild && !isCreating && (
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          )}
          {allPrimarySet && canBuild && !isCreating && (
            <span className="absolute inset-0 bg-primary/30 rounded-lg opacity-30 pointer-events-none" />
          )}
          {isCreating ? (
            <>
              <Loader2 size={14} className="animate-spin relative z-10" />
              <span className="relative z-10">Generating world…</span>
            </>
          ) : (
            <>
              <Sparkles
                size={14}
                className={`relative z-10 ${allPrimarySet ? "drop-shadow-[0_0_4px_rgba(255,255,255,0.6)]" : ""}`}
              />
              <span className="relative z-10">
                {allPrimarySet ? "Generate your world" : "Generate world"}
              </span>
            </>
          )}
        </button>
        {!canBuild && !isCreating && (
          <div className="text-[10.5px] text-text-tertiary text-center leading-snug">
            {setCountAll === 0
              ? "Tell the agent what you want to build."
              : "Fill at least one slot to enable build."}
          </div>
        )}
        {canBuild && !isCreating && setCountAll < totalSlots && (
          <div className="text-[10.5px] text-text-tertiary text-center leading-snug">
            Building with {setCountAll} of {totalSlots} slots — defaults fill
            the rest.
          </div>
        )}
      </div>
    </div>
  );
}

const MAX_INLINE_ENTRIES = 5;

interface SecondarySlotEntryListProps {
  plan: OnboardingPlan;
  slotKey: PlanSlotKey;
}

/**
 * Inline entry list for a secondary plan slot — shows what
 * actually got placed. Without this, the user sees only count
 * badges ("3 placed") and has to dig into the outliner to see
 * which roads / POIs / mines / water bodies the agent
 * authored.
 *
 * Renders up to MAX_INLINE_ENTRIES entries, with a "+N more"
 * tail when the list is longer. Each row is a single line:
 * primary label and a per-slot secondary detail string —
 * detail extraction lives in `extractEntrySummary` in
 * utils/secondarySlotSummaries.ts.
 */
function SecondarySlotEntryList({
  plan,
  slotKey,
}: SecondarySlotEntryListProps): React.ReactElement | null {
  const entries = collectSecondarySlotEntries(plan, slotKey);
  if (entries.length === 0) return null;
  const visible = entries.slice(0, MAX_INLINE_ENTRIES);
  const overflow = entries.length - visible.length;
  return (
    <div className="mt-2 space-y-1">
      {visible.map((entry, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-bg-primary/60 rounded-md text-[11px] ring-1 ring-white/[0.05]"
        >
          <div className="flex-1 min-w-0">
            <div className="text-text-primary truncate font-medium">
              {entry.primary}
            </div>
            {entry.detail && (
              <div className="text-text-tertiary truncate text-[10px]">
                {entry.detail}
              </div>
            )}
          </div>
        </div>
      ))}
      {overflow > 0 && (
        <div className="text-[10.5px] text-text-tertiary px-2.5 py-1 italic">
          +{overflow} more
        </div>
      )}
    </div>
  );
}

interface PlanSlotProps {
  icon: React.ReactNode;
  title: string;
  set: boolean;
  summary: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  onRemove?: () => void;
  /** Small numeric badge next to the title (e.g. NPC count). */
  countBadge?: number;
  /** Optional child content rendered below the summary (e.g. NPC list). */
  children?: React.ReactNode;
}

/**
 * Generic per-slot row used by the Plan panel for every primary
 * and secondary slot. Set slots show a left edge highlight + ✓
 * (or count badge) + remove button. Empty slots show a muted
 * background + clickable "fill this" CTA.
 */
function PlanSlot({
  icon,
  title,
  set,
  summary,
  actionLabel,
  onAction,
  actionDisabled,
  onRemove,
  countBadge,
  children,
}: PlanSlotProps): React.ReactElement {
  return (
    <div
      className={`relative overflow-hidden rounded-lg ring-1 transition-all group ${
        set
          ? "bg-bg-tertiary/80 ring-white/[0.06] shadow-sm"
          : "bg-bg-tertiary/40 ring-white/[0.04] hover:ring-primary/30 hover:bg-bg-tertiary/60"
      }`}
    >
      {set && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-primary/40" />
      )}
      <div className="px-3 py-2.5 flex items-start gap-2.5">
        <div
          className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
            set
              ? "bg-primary/15 text-primary ring-1 ring-primary/25"
              : "bg-bg-secondary/60 text-text-tertiary"
          }`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <div className="text-[12px] font-semibold text-text-primary">
                {title}
              </div>
              {typeof countBadge === "number" && countBadge > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                  {countBadge}
                </span>
              )}
              {set && !countBadge && (
                <Check
                  size={11}
                  strokeWidth={3}
                  className="text-primary opacity-80"
                />
              )}
            </div>
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-red-400 transition-opacity"
                aria-label={`Remove ${title}`}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
          <div className="text-[11px] text-text-tertiary truncate mt-0.5 leading-snug">
            {summary}
          </div>
          {!set && onAction && actionLabel && (
            <button
              type="button"
              disabled={actionDisabled}
              onClick={onAction}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLabel}
              <ArrowRight size={10} />
            </button>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
