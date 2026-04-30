/**
 * AssetPackBrowserPanel — Phase AP9.3 + pack-creation surface
 * for the bottom dock.
 *
 * Two inner sub-tabs:
 *
 *   - **Marketplace** — public packs (visibility="public") fetched
 *     via the no-auth `/api/asset-packs/marketplace` browse query.
 *     Per-pack Install button merges the manifestId into the
 *     project's `assetPacks`.
 *
 *   - **My Team** — packs owned by the caller's active team
 *     (visibility ∈ {team, private}, team_id = current team)
 *     fetched via the auth-scoped `/api/asset-packs?teamId=…`.
 *     Each row shows visibility status + Publish/Unpublish
 *     controls when the user has owner role.
 *
 * Plus a top-level "Create Pack" button + modal that POSTs to
 * `/api/asset-packs` and refreshes the My Team tab.
 *
 * Distinct from `ContentBrowser` (browses entities ALREADY in the
 * scene) and `EntityPalette` (drag-to-place templates from
 * installed packs). This panel is for *acquiring* packs, not
 * *using* them.
 */

import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Car,
  ExternalLink,
  FilePlus,
  Gem,
  Ghost,
  Globe,
  Hammer,
  Image as ImageIcon,
  Library,
  Link2,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Sword,
  TreePine,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import { useWorldStudio } from "../WorldStudioContext";
// Note: useWorldStudio is consumed only by the project-bound
// wrapper at the bottom of this file. The core panel itself is
// hook-free with respect to studio state so it can mount on the
// top-level Asset Packs page (outside WorldStudioProvider).
import {
  addAssetPackEntry,
  createAssetPack,
  listAssetPacks,
  listMarketplaceAssetPacks,
  publishAssetPack,
  setProjectAssetPacks,
  unpublishAssetPack,
  type AssetPackEntryInput,
  type AssetPackResponse,
} from "../../../utils/assetPackApi";
import { AssetService, type Asset } from "../../../services/api/AssetService";
import { Link } from "react-router-dom";
import { ROUTES } from "../../../constants";
import { getAssetConceptArtUrl } from "../../../utils/api";
import { ModelThumbnail } from "../../shared/ModelThumbnail";

type SubTab = "marketplace" | "team";

type FetchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; packs: AssetPackResponse[] }
  | { kind: "error"; message: string };

type RowOpState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done" }
  | { kind: "error"; message: string };

interface PackManifestSummary {
  description: string;
  packVersion: string;
  assetCount: number;
  tags: string[];
  author?: string;
}

/**
 * Map the raw `visibility` enum to a user-facing label. The DB
 * stores tech-shaped values ("team", "public", "private") but
 * users shouldn't have to learn those — they map cleanly to
 * common product concepts.
 */
function visibilityLabel(v: string): {
  label: string;
  tone: "draft" | "team" | "published";
} {
  switch (v) {
    case "public":
      return { label: "Published", tone: "published" };
    case "team":
      return { label: "Team only", tone: "team" };
    case "private":
      return { label: "Draft", tone: "draft" };
    default:
      return { label: v, tone: "team" };
  }
}

function summarizeManifest(manifest: unknown): PackManifestSummary {
  const m =
    manifest && typeof manifest === "object"
      ? (manifest as Record<string, unknown>)
      : {};
  const description = typeof m.description === "string" ? m.description : "";
  const packVersion =
    typeof m.packVersion === "string" ? m.packVersion : "0.0.0";
  const assetCount = Array.isArray(m.assets) ? m.assets.length : 0;
  const tags = Array.isArray(m.tags)
    ? (m.tags as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  let author: string | undefined;
  const a = m.author;
  if (
    a &&
    typeof a === "object" &&
    typeof (a as Record<string, unknown>).name === "string"
  ) {
    author = (a as { name: string }).name;
  }
  return { description, packVersion, assetCount, tags, author };
}

/**
 * Panel modes:
 *   - `"project"` — runs inside World Studio, project-bound.
 *     Caller (`AssetPackBrowserPanelProjectBound`) supplies
 *     project state + `onInstalled` callback so the panel itself
 *     never touches `useWorldStudio()` (it's also used outside
 *     the WorldStudio provider on the top-level Asset Packs page).
 *   - `"manage"` — runs as a top-level Asset Forge page, team-bound.
 *     Caller supplies `teamId`. No project, install affordance is
 *     hidden. Used by `pages/AssetPacksPage`.
 */
export type AssetPackPanelMode = "project" | "manage";

interface AssetPackBrowserPanelProps {
  mode: AssetPackPanelMode;
  /** Active team. Null = no team scope (manage mode shows nothing useful). */
  teamId: string | null;
  /** Active team name — used to auto-suggest pack manifest ids. */
  teamName?: string | null;
  /** Only used in mode="project". Required to enable Install. */
  projectId?: string | null;
  /** Manifest ids already installed on the active project. */
  installedIds?: ReadonlyArray<string>;
  /**
   * Called after a successful install POST. Receives the merged
   * full pack id list. The project-bound wrapper uses this to
   * mirror state into the studio reducer so the rest of the UI
   * (palette gate, content browser, agent context) refreshes
   * immediately without a project reload.
   */
  onInstalled?: (mergedIds: string[]) => void;
  /**
   * Surface a flash message on mount — used for cross-page
   * celebrations like "✓ Added Iron Sword to Medieval Weapons"
   * after returning from the Generate page.
   */
  initialFlash?: string | null;
  /**
   * Auto-expand a specific pack id on first ready render. Pairs
   * with `initialFlash` so the user lands and immediately sees
   * the pack they just added to with its entries unfolded.
   * Forces the My Team sub-tab so the pack is actually visible.
   */
  autoExpandPackId?: string | null;
}

export function AssetPackBrowserPanel({
  mode,
  teamId,
  teamName = null,
  projectId = null,
  installedIds = [],
  onInstalled,
  initialFlash = null,
  autoExpandPackId = null,
}: AssetPackBrowserPanelProps) {
  const projectMode = mode === "project";

  const [subTab, setSubTab] = useState<SubTab>("marketplace");
  const [marketplaceState, setMarketplaceState] = useState<FetchState>({
    kind: "idle",
  });
  const [teamState, setTeamState] = useState<FetchState>({ kind: "idle" });
  const [filter, setFilter] = useState("");
  const [installState, setInstallState] = useState<Record<string, RowOpState>>(
    {},
  );
  const [publishState, setPublishState] = useState<Record<string, RowOpState>>(
    {},
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [addEntryFor, setAddEntryFor] = useState<AssetPackResponse | null>(
    null,
  );
  // Pack the user is currently viewing in the detail popup.
  const [viewingPack, setViewingPack] = useState<AssetPackResponse | null>(
    null,
  );
  const [confirmPublishFor, setConfirmPublishFor] =
    useState<AssetPackResponse | null>(null);
  // Transient confirmation banner. Set by `notify()`, auto-clears
  // after a short delay. Lightweight in-panel feedback — no global
  // toast system needed for this surface.
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  const notify = useCallback((message: string) => {
    setFlashMessage(message);
  }, []);

  useEffect(() => {
    if (flashMessage === null) return;
    const t = setTimeout(() => setFlashMessage(null), 4000);
    return () => clearTimeout(t);
  }, [flashMessage]);

  /**
   * Cross-page celebration: caller passes `initialFlash` after a
   * successful navigation (e.g. "Added X to Y" landing back from
   * /generate). We fire it once on mount and let the existing
   * 4s timeout clear it. `autoExpandPackId` flips the sub-tab to
   * My Team — used to be paired with an inline expansion, but
   * now the pack detail is a popup, so we just land on the right
   * tab and let the user click to view if they want.
   */
  useEffect(() => {
    if (initialFlash) setFlashMessage(initialFlash);
    if (autoExpandPackId) {
      setSubTab("team");
    }
    // Intentionally one-shot on mount — no deps. Re-mounting the
    // panel with new initialFlash/autoExpand values is supported.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reloadMarketplace = useCallback(async () => {
    setMarketplaceState({ kind: "loading" });
    try {
      const packs = await listMarketplaceAssetPacks();
      setMarketplaceState({ kind: "ready", packs });
    } catch (err) {
      setMarketplaceState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  const reloadTeam = useCallback(async () => {
    if (!teamId) {
      setTeamState({ kind: "ready", packs: [] });
      return;
    }
    setTeamState({ kind: "loading" });
    try {
      // listAssetPacks(teamId) returns public + team's packs;
      // filter to team-owned only for the My Team view so
      // built-ins / public marketplace listings don't double up.
      const all = await listAssetPacks(teamId);
      const teamOwned = all.filter((p) => p.teamId === teamId);
      setTeamState({ kind: "ready", packs: teamOwned });
    } catch (err) {
      setTeamState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [teamId]);

  useEffect(() => {
    if (subTab === "marketplace") void reloadMarketplace();
    else void reloadTeam();
  }, [subTab, reloadMarketplace, reloadTeam]);

  const handleInstall = useCallback(
    async (manifestId: string) => {
      if (!projectMode) return; // No-op in manage mode.
      if (!projectId) {
        setInstallState((p) => ({
          ...p,
          [manifestId]: {
            kind: "error",
            message: "Save the project before installing packs.",
          },
        }));
        return;
      }
      setInstallState((p) => ({
        ...p,
        [manifestId]: { kind: "running" },
      }));
      try {
        const next = new Set(installedIds);
        next.add(manifestId);
        const merged = Array.from(next);
        await setProjectAssetPacks(projectId, merged);
        onInstalled?.(merged);
        setInstallState((p) => ({ ...p, [manifestId]: { kind: "done" } }));
        notify(`Installed ${manifestId} on the project.`);
      } catch (err) {
        setInstallState((p) => ({
          ...p,
          [manifestId]: {
            kind: "error",
            message: err instanceof Error ? err.message : String(err),
          },
        }));
      }
    },
    [projectMode, projectId, installedIds, onInstalled, notify],
  );

  /**
   * Direct executor — does the actual publish/unpublish. Wrapped
   * so we can call it from the row button (for unpublish) AND
   * from the confirm modal (for publish), without duplicating
   * state-update logic.
   */
  const executePublishToggle = useCallback(
    async (pack: AssetPackResponse) => {
      const isPublic = pack.visibility === "public";
      setPublishState((p) => ({
        ...p,
        [pack.manifestId]: { kind: "running" },
      }));
      try {
        if (isPublic) {
          await unpublishAssetPack(pack.manifestId);
          notify(`Unpublished ${pack.manifestId}.`);
        } else {
          await publishAssetPack(pack.manifestId);
          notify(`Published ${pack.manifestId} to the marketplace.`);
        }
        setPublishState((p) => ({
          ...p,
          [pack.manifestId]: { kind: "done" },
        }));
        // Refresh the team list so the visibility badge updates.
        void reloadTeam();
      } catch (err) {
        setPublishState((p) => ({
          ...p,
          [pack.manifestId]: {
            kind: "error",
            message: err instanceof Error ? err.message : String(err),
          },
        }));
      }
    },
    [reloadTeam, notify],
  );

  /**
   * Wrapper that gates Publish behind a confirm dialog. Unpublish
   * is the safer direction (just unlists the pack) so it goes
   * direct.
   */
  const handlePublishToggle = useCallback(
    (pack: AssetPackResponse) => {
      const isPublic = pack.visibility === "public";
      if (isPublic) {
        void executePublishToggle(pack);
      } else {
        setConfirmPublishFor(pack);
      }
    },
    [executePublishToggle],
  );

  const visiblePacks = useMemo(() => {
    const fs = subTab === "marketplace" ? marketplaceState : teamState;
    if (fs.kind !== "ready") return [];
    const q = filter.trim().toLowerCase();
    if (!q) return fs.packs;
    return fs.packs.filter((p) => {
      const summary = summarizeManifest(p.manifest);
      return (
        p.manifestId.toLowerCase().includes(q) ||
        summary.description.toLowerCase().includes(q) ||
        summary.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [subTab, marketplaceState, teamState, filter]);

  const activeFetchState =
    subTab === "marketplace" ? marketplaceState : teamState;

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab strip — pill style */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
          {[
            {
              id: "marketplace" as const,
              label: "Marketplace",
              icon: Globe,
            },
            { id: "team" as const, label: "My Team", icon: Users },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md transition-all ${
                  isActive
                    ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_rgba(99,102,241,0.25)]"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                <Icon size={11} />
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            disabled={!teamId}
            title={
              teamId
                ? "Create a new asset pack"
                : "Save the project to a team to create packs"
            }
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={11} />
            Create Pack
          </button>
          <button
            type="button"
            onClick={() =>
              void (subTab === "marketplace"
                ? reloadMarketplace()
                : reloadTeam())
            }
            disabled={activeFetchState.kind === "loading"}
            className="p-1.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw
              size={12}
              className={
                activeFetchState.kind === "loading" ? "animate-spin" : ""
              }
            />
          </button>
        </div>
      </div>

      {/* Transient success banner */}
      {flashMessage && (
        <div className="px-3 py-2 border-b border-emerald-500/20 bg-emerald-500/10 flex items-center gap-2">
          <Check size={12} className="text-emerald-400 flex-shrink-0" />
          <p className="text-[11px] text-emerald-300 flex-1 truncate">
            {flashMessage}
          </p>
          <button
            type="button"
            onClick={() => setFlashMessage(null)}
            className="text-emerald-300/70 hover:text-emerald-200"
          >
            <X size={11} />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
        <div className="relative flex-1">
          <Search
            size={11}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary/60"
          />
          <input
            type="text"
            placeholder={
              subTab === "marketplace"
                ? "Search marketplace…"
                : "Search your team's packs…"
            }
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-6.5 pr-2 py-1.5 text-xs bg-white/[0.03] border border-transparent rounded text-text-primary placeholder:text-text-tertiary/50 focus:outline-none focus:border-primary/30 focus:bg-white/[0.05] transition-colors"
            style={{ paddingLeft: "1.625rem" }}
          />
        </div>
        {(() => {
          // Quiet stats row — surfaces scope at a glance. Computed
          // from the fetched packs (not filtered) so the user always
          // sees the total even with an active search.
          if (activeFetchState.kind !== "ready") return null;
          const all = activeFetchState.packs;
          const totalAssets = all.reduce(
            (sum, p) => sum + summarizeManifest(p.manifest).assetCount,
            0,
          );
          const published = all.filter((p) => p.visibility === "public").length;
          return (
            <div className="text-[10px] text-text-tertiary whitespace-nowrap flex items-center gap-2">
              <span>
                {all.length} pack{all.length === 1 ? "" : "s"}
              </span>
              <span className="text-text-tertiary/30">·</span>
              <span>
                {totalAssets} asset{totalAssets === 1 ? "" : "s"}
              </span>
              {subTab === "team" && (
                <>
                  <span className="text-text-tertiary/30">·</span>
                  <span
                    className={
                      published > 0
                        ? "text-emerald-400/80"
                        : "text-text-tertiary"
                    }
                  >
                    {published} published
                  </span>
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {activeFetchState.kind === "loading" && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin text-text-tertiary" />
          </div>
        )}

        {activeFetchState.kind === "error" && (
          <div className="px-3 py-4 text-center space-y-2">
            <AlertTriangle size={16} className="mx-auto text-red-400" />
            <p className="text-xs text-red-400">{activeFetchState.message}</p>
            <button
              onClick={() =>
                void (subTab === "marketplace"
                  ? reloadMarketplace()
                  : reloadTeam())
              }
              className="text-xs text-primary hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {activeFetchState.kind === "ready" && visiblePacks.length === 0 && (
          <div className="px-6 py-12 text-center">
            {filter ? (
              <p className="text-xs text-text-tertiary">
                No packs match your search.
              </p>
            ) : subTab === "marketplace" ? (
              <div className="space-y-2">
                <Globe size={20} className="mx-auto text-text-tertiary/60" />
                <p className="text-xs text-text-tertiary">
                  No public packs in the marketplace yet.
                </p>
                <p className="text-[11px] text-text-tertiary/70 max-w-md mx-auto leading-relaxed">
                  Be the first — head to{" "}
                  <span className="text-text-secondary">My Team</span> and
                  publish a pack of your own.
                </p>
              </div>
            ) : teamId ? (
              <div className="space-y-3 max-w-sm mx-auto">
                <Package size={24} className="mx-auto text-primary/70" />
                <h3 className="text-sm font-medium text-text-primary">
                  No packs yet
                </h3>
                <p className="text-[11px] text-text-tertiary leading-relaxed">
                  Asset packs let your team bundle 3D assets — trees, weapons,
                  characters — into reusable libraries. Create one to organize
                  your work and (optionally) publish it to the marketplace.
                </p>
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Plus size={12} />
                  Create your first pack
                </button>
              </div>
            ) : (
              <p className="text-xs text-text-tertiary">
                Save the project to a team to see your packs.
              </p>
            )}
          </div>
        )}

        {activeFetchState.kind === "ready" && visiblePacks.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3 auto-rows-min">
            {visiblePacks.map((pack) => (
              <PackCard
                key={pack.id}
                pack={pack}
                projectMode={projectMode}
                projectId={projectId}
                isMyTeam={subTab === "team"}
                isInstalled={
                  installedIds.includes(pack.manifestId) ||
                  installState[pack.manifestId]?.kind === "done"
                }
                installing={installState[pack.manifestId]?.kind === "running"}
                installError={
                  installState[pack.manifestId]?.kind === "error"
                    ? (
                        installState[pack.manifestId] as {
                          kind: "error";
                          message: string;
                        }
                      ).message
                    : null
                }
                publishing={publishState[pack.manifestId]?.kind === "running"}
                publishError={
                  publishState[pack.manifestId]?.kind === "error"
                    ? (
                        publishState[pack.manifestId] as {
                          kind: "error";
                          message: string;
                        }
                      ).message
                    : null
                }
                onView={() => setViewingPack(pack)}
                onInstall={() => void handleInstall(pack.manifestId)}
                onAddAsset={() => setAddEntryFor(pack)}
                onPublishToggle={() => handlePublishToggle(pack)}
              />
            ))}
          </div>
        )}
      </div>

      {createOpen && teamId && (
        <CreatePackModal
          teamId={teamId}
          teamName={teamName}
          onClose={() => setCreateOpen(false)}
          onCreated={(created) => {
            setCreateOpen(false);
            setSubTab("team");
            void reloadTeam();
            notify(
              `Created ${
                (created.manifest as { name?: string })?.name ??
                created.manifestId
              } — add some assets to start filling it.`,
            );
          }}
        />
      )}

      {addEntryFor && (
        <AddEntryModal
          pack={addEntryFor}
          onClose={() => setAddEntryFor(null)}
          onAdded={() => {
            const packName =
              (addEntryFor.manifest as { name?: string })?.name ??
              addEntryFor.manifestId;
            setAddEntryFor(null);
            void reloadTeam();
            notify(`Added asset to ${packName}.`);
          }}
        />
      )}

      {confirmPublishFor && (
        <PublishConfirmModal
          pack={confirmPublishFor}
          onCancel={() => setConfirmPublishFor(null)}
          onConfirm={async () => {
            const target = confirmPublishFor;
            setConfirmPublishFor(null);
            await executePublishToggle(target);
          }}
        />
      )}

      {viewingPack && (
        <PackDetailModal
          pack={viewingPack}
          projectMode={projectMode}
          projectId={projectId}
          isMyTeam={subTab === "team"}
          isInstalled={
            installedIds.includes(viewingPack.manifestId) ||
            installState[viewingPack.manifestId]?.kind === "done"
          }
          installing={installState[viewingPack.manifestId]?.kind === "running"}
          publishing={publishState[viewingPack.manifestId]?.kind === "running"}
          onClose={() => setViewingPack(null)}
          onInstall={() => {
            void handleInstall(viewingPack.manifestId);
          }}
          onAddAsset={() => {
            // Open Add Asset for this pack; close the detail modal
            // so the two don't stack.
            const target = viewingPack;
            setViewingPack(null);
            setAddEntryFor(target);
          }}
          onPublishToggle={() => {
            const target = viewingPack;
            setViewingPack(null);
            handlePublishToggle(target);
          }}
        />
      )}
    </div>
  );
}

/**
 * Slugify free-form text into a kebab-case identifier safe for
 * pack ids. "Medieval Weapons!" → "medieval-weapons".
 */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Auto-derive the manifest id from team + pack name. The user
 * never has to type this directly; it's surfaced as ghost text.
 *   team "My Team" + pack "Medieval Weapons" →
 *     "@my-team/asset-pack-medieval-weapons-v1"
 *
 * Power users can override via the Advanced section.
 */
function suggestManifestId(teamName: string | null, packName: string): string {
  const teamSlug = slugify(teamName ?? "team") || "team";
  const packSlug = slugify(packName) || "pack";
  return `@${teamSlug}/asset-pack-${packSlug}-v1`;
}

/**
 * Modal: friendly Create Pack form. The user only has to fill in
 * "Pack Name" + "Description". Manifest id, version, and license
 * are auto-filled and tucked under "Advanced" for power users.
 */
interface CreatePackModalProps {
  teamId: string;
  teamName: string | null;
  onClose: () => void;
  onCreated: (pack: AssetPackResponse) => void;
}

function CreatePackModal({
  teamId,
  teamName,
  onClose,
  onCreated,
}: CreatePackModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Manifest id, version, license are auto-derived but editable
  // when the user expands Advanced. We track the dirty state
  // separately so typing in the name keeps the suggestion in sync
  // until the user explicitly edits the field.
  const [manifestIdOverride, setManifestIdOverride] = useState<string | null>(
    null,
  );
  const [packVersion, setPackVersion] = useState("1.0.0");
  const [license, setLicense] = useState("UNLICENSED");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestedId = suggestManifestId(teamName, name);
  const effectiveManifestId =
    manifestIdOverride !== null ? manifestIdOverride : suggestedId;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const created = await createAssetPack({
        manifestId: effectiveManifestId.trim(),
        name: name.trim(),
        description: description.trim(),
        packVersion: packVersion.trim(),
        license: license.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        teamId,
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-4 bg-bg-primary border border-white/[0.08] rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Package size={14} className="text-primary" />
            <h3 className="text-sm font-medium text-text-primary">
              Create Asset Pack
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary"
          >
            <X size={14} />
          </button>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="px-4 py-3 space-y-3"
        >
          <Field label="Pack name">
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Medieval Weapons"
              className="w-full px-2 py-1.5 text-sm bg-white/[0.03] border border-white/[0.08] rounded text-text-primary focus:outline-none focus:border-primary/40"
            />
            {name.trim().length > 0 && (
              <p className="text-[10px] text-text-tertiary/70 mt-1 font-mono truncate">
                id: {effectiveManifestId}
              </p>
            )}
          </Field>

          <Field
            label="What's in this pack?"
            hint="One-line summary shown on the marketplace."
          >
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Swords, shields, bows, and arrows for medieval fantasy worlds."
              className="w-full px-2 py-1.5 text-xs bg-white/[0.03] border border-white/[0.08] rounded text-text-primary resize-none focus:outline-none focus:border-primary/40"
            />
          </Field>

          <Field label="Tags" hint="Comma-separated. Optional.">
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="medieval, fantasy, weapons"
              className="w-full px-2 py-1.5 text-xs bg-white/[0.03] border border-white/[0.08] rounded text-text-primary focus:outline-none focus:border-primary/40"
            />
          </Field>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors"
          >
            {showAdvanced ? "▾" : "▸"} Advanced
          </button>

          {showAdvanced && (
            <div className="space-y-3 pt-1 pl-2 border-l border-white/[0.06]">
              <Field
                label="Pack ID"
                hint="npm-style. Auto-generated from team + pack name. Override only if you need a specific id."
              >
                <input
                  type="text"
                  value={effectiveManifestId}
                  onChange={(e) => setManifestIdOverride(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-white/[0.03] border border-white/[0.08] rounded text-text-primary font-mono focus:outline-none focus:border-primary/40"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Version">
                  <input
                    type="text"
                    required
                    value={packVersion}
                    onChange={(e) => setPackVersion(e.target.value)}
                    placeholder="1.0.0"
                    className="w-full px-2 py-1.5 text-xs bg-white/[0.03] border border-white/[0.08] rounded text-text-primary font-mono focus:outline-none focus:border-primary/40"
                  />
                </Field>
                <Field label="License">
                  <input
                    type="text"
                    value={license}
                    onChange={(e) => setLicense(e.target.value)}
                    placeholder="UNLICENSED"
                    className="w-full px-2 py-1.5 text-xs bg-white/[0.03] border border-white/[0.08] rounded text-text-primary focus:outline-none focus:border-primary/40"
                  />
                </Field>
              </div>
            </div>
          )}

          {error && (
            <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                submitting ||
                !name.trim() ||
                !effectiveManifestId.trim() ||
                !packVersion.trim()
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 size={11} className="animate-spin" />
                  Creating
                </>
              ) : (
                "Create Pack"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AddEntryModalProps {
  pack: AssetPackResponse;
  onClose: () => void;
  onAdded: () => void;
}

const ASSET_TYPES: AssetPackEntryInput["type"][] = [
  "character",
  "creature",
  "prop",
  "weapon",
  "tool",
  "armor",
  "vehicle",
  "misc",
];

/**
 * Where the user pulls an asset from when adding to a pack.
 *   - `"library"` (default) — pick from the team's already-baked
 *     assets. Click a card → form fills automatically. The vast
 *     majority of users should never leave this mode.
 *   - `"generate"` — pop out to the Generate page to bake a new
 *     asset; come back here once it lands in the library.
 *   - `"url"` — paste an external URL or asset:// path. Power-user
 *     escape hatch.
 */
type AddSource = "library" | "generate" | "url";

/**
 * Map an existing baked asset's `type` field (free-form string
 * from the bake metadata, e.g. "character", "weapon", "item") to
 * the eight-value `AssetPackEntryInput["type"]` enum. Anything
 * that doesn't match falls through to "misc".
 */
function inferEntryType(raw: string | undefined): AssetPackEntryInput["type"] {
  const lc = (raw ?? "").toLowerCase();
  if (lc === "character") return "character";
  if (lc === "creature" || lc === "mob" || lc === "enemy") return "creature";
  if (lc === "weapon") return "weapon";
  if (lc === "tool") return "tool";
  if (lc === "armor" || lc === "helmet" || lc === "shield") return "armor";
  if (lc === "vehicle") return "vehicle";
  if (lc === "prop" || lc === "tree" || lc === "rock" || lc === "plant") {
    return "prop";
  }
  return "misc";
}

function AddEntryModal({ pack, onClose, onAdded }: AddEntryModalProps) {
  const [source, setSource] = useState<AddSource>("library");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<AssetPackEntryInput["type"]>("prop");
  const [subtype, setSubtype] = useState("");
  const [modelUrl, setModelUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Entry id auto-derived from name slug; user may override via
  // Advanced. The pack name "Oak Tree" → "oak-tree".
  const [entryIdOverride, setEntryIdOverride] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Library mode state
  const [libraryFilter, setLibraryFilter] = useState("");
  const [libraryState, setLibraryState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ready"; assets: Asset[] }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  // After clicking a card we transition Library mode into "review"
  // — name/type/subtype prefilled but editable, with a clear path
  // to confirm or back out. Keeps the user inside the library
  // workflow instead of dumping them into the long URL form.
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const reloadLibrary = useCallback(async () => {
    setLibraryState({ kind: "loading" });
    try {
      const all = await AssetService.listAssets();
      // Only assets with a model file are useful as pack entries.
      const usable = all.filter((a) => a.hasModel);
      setLibraryState({ kind: "ready", assets: usable });
    } catch (err) {
      setLibraryState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  useEffect(() => {
    if (source === "library" && libraryState.kind === "idle") {
      void reloadLibrary();
    }
  }, [source, libraryState.kind, reloadLibrary]);

  const filteredLibrary = useMemo(() => {
    if (libraryState.kind !== "ready") return [];
    const q = libraryFilter.trim().toLowerCase();
    if (!q) return libraryState.assets;
    return libraryState.assets.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q),
    );
  }, [libraryState, libraryFilter]);

  /** Prefill from a baked asset and stage it for inline review. */
  const pickFromLibrary = useCallback((asset: Asset) => {
    setName(asset.name);
    setDescription(asset.description || "");
    setType(inferEntryType(asset.type));
    setSubtype(asset.type || "misc");
    setModelUrl(`/api/assets/${asset.id}/model`);
    setSelectedAsset(asset);
  }, []);

  /** Drop the staged asset and return to the grid. */
  const clearSelected = useCallback(() => {
    setSelectedAsset(null);
    setName("");
    setDescription("");
    setSubtype("");
    setModelUrl("");
    setType("prop");
    setError(null);
  }, []);

  const suggestedId = slugify(name) || "asset";
  const effectiveEntryId =
    entryIdOverride !== null ? entryIdOverride : suggestedId;

  const packDisplayName =
    (pack.manifest as { name?: string })?.name ?? pack.manifestId;

  /** Submit handler shared by Library-review and From-URL paths. */
  const submitEntry = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const entry: AssetPackEntryInput = {
        id: effectiveEntryId.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        subtype: subtype.trim(),
        modelUrl: modelUrl.trim(),
        thumbnailUrl: thumbnailUrl.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
      };
      await addAssetPackEntry(pack.manifestId, entry);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [
    effectiveEntryId,
    name,
    description,
    type,
    subtype,
    modelUrl,
    thumbnailUrl,
    tagsInput,
    pack.manifestId,
    onAdded,
  ]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await submitEntry();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-4 bg-bg-primary border border-white/[0.08] rounded-lg shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FilePlus size={14} className="text-primary flex-shrink-0" />
            <h3 className="text-sm font-medium text-text-primary truncate">
              Add asset to {packDisplayName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary"
          >
            <X size={14} />
          </button>
        </div>

        {/* Source tab strip — Library is the primary path. */}
        <div className="flex items-center gap-0 px-2 pt-1.5 pb-0 border-b border-white/[0.06] flex-shrink-0">
          {[
            { id: "library" as const, label: "From Library", icon: Library },
            {
              id: "generate" as const,
              label: "Generate New",
              icon: Sparkles,
            },
            { id: "url" as const, label: "From URL", icon: Link2 },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = source === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSource(t.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-t border-b-2 transition-colors ${
                  isActive
                    ? "text-text-primary border-primary bg-white/[0.03]"
                    : "text-text-tertiary border-transparent hover:text-text-secondary"
                }`}
              >
                <Icon size={11} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* From Library — review panel when a card is picked, else asset grid */}
        {source === "library" && selectedAsset && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <button
              type="button"
              onClick={clearSelected}
              className="inline-flex items-center gap-1 text-[11px] text-text-tertiary hover:text-text-secondary transition-colors"
            >
              ← Back to library
            </button>

            <div className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
              <SelectedAssetThumbnail asset={selectedAsset} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {selectedAsset.name}
                </p>
                <p className="text-[11px] text-text-tertiary truncate">
                  {selectedAsset.type}
                  {selectedAsset.modelFormat
                    ? ` · ${selectedAsset.modelFormat.toUpperCase()}`
                    : ""}
                </p>
                <p className="text-[10px] text-text-tertiary/60 font-mono truncate mt-0.5">
                  {selectedAsset.id}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Field label="Asset name in pack">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-white/[0.03] border border-white/[0.08] rounded text-text-primary focus:outline-none focus:border-primary/40"
                />
                {name.trim().length > 0 && (
                  <p className="text-[10px] text-text-tertiary/70 mt-1 font-mono truncate">
                    id: {effectiveEntryId}
                  </p>
                )}
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <select
                    value={type}
                    onChange={(e) =>
                      setType(e.target.value as AssetPackEntryInput["type"])
                    }
                    className="w-full px-2 py-1.5 text-xs bg-white/[0.03] border border-white/[0.08] rounded text-text-primary focus:outline-none focus:border-primary/40"
                  >
                    {ASSET_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Subcategory">
                  <input
                    type="text"
                    required
                    value={subtype}
                    onChange={(e) => setSubtype(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs bg-white/[0.03] border border-white/[0.08] rounded text-text-primary focus:outline-none focus:border-primary/40"
                  />
                </Field>
              </div>

              <Field label="Tags" hint="Comma-separated. Optional.">
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="hero, sword"
                  className="w-full px-2 py-1.5 text-xs bg-white/[0.03] border border-white/[0.08] rounded text-text-primary focus:outline-none focus:border-primary/40"
                />
              </Field>
            </div>

            {error && (
              <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={clearSelected}
                disabled={submitting}
                className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitEntry()}
                disabled={
                  submitting ||
                  !name.trim() ||
                  !subtype.trim() ||
                  !modelUrl.trim()
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 size={11} className="animate-spin" />
                    Adding
                  </>
                ) : (
                  "Add to Pack"
                )}
              </button>
            </div>
          </div>
        )}

        {source === "library" && !selectedAsset && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-2">
              <div className="relative flex-1">
                <Search
                  size={11}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary/60"
                />
                <input
                  type="text"
                  value={libraryFilter}
                  onChange={(e) => setLibraryFilter(e.target.value)}
                  placeholder="Search your team's assets…"
                  className="w-full pl-6.5 pr-2 py-1.5 text-xs bg-white/[0.03] border border-transparent rounded text-text-primary placeholder:text-text-tertiary/50 focus:outline-none focus:border-primary/30 focus:bg-white/[0.05] transition-colors"
                  style={{ paddingLeft: "1.625rem" }}
                />
              </div>
              <button
                type="button"
                onClick={() => void reloadLibrary()}
                disabled={libraryState.kind === "loading"}
                className="p-1.5 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-40"
                title="Refresh"
              >
                <RefreshCw
                  size={12}
                  className={
                    libraryState.kind === "loading" ? "animate-spin" : ""
                  }
                />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {libraryState.kind === "loading" && (
                <div className="flex items-center justify-center py-8">
                  <Loader2
                    size={16}
                    className="animate-spin text-text-tertiary"
                  />
                </div>
              )}
              {libraryState.kind === "error" && (
                <div className="px-3 py-4 text-center space-y-2">
                  <AlertTriangle size={16} className="mx-auto text-red-400" />
                  <p className="text-xs text-red-400">{libraryState.message}</p>
                  <button
                    onClick={() => void reloadLibrary()}
                    className="text-xs text-primary hover:underline"
                  >
                    Retry
                  </button>
                </div>
              )}
              {libraryState.kind === "ready" &&
                filteredLibrary.length === 0 && (
                  <div className="text-center py-8 space-y-2">
                    <ImageIcon
                      size={20}
                      className="mx-auto text-text-tertiary/60"
                    />
                    <p className="text-xs text-text-tertiary">
                      {libraryFilter
                        ? "No assets match your search."
                        : "Your library is empty."}
                    </p>
                    {!libraryFilter && (
                      <p className="text-[10px] text-text-tertiary/70 leading-relaxed max-w-xs mx-auto">
                        Generate assets in the{" "}
                        <Link
                          to={ROUTES.GENERATION}
                          className="text-primary hover:underline"
                          onClick={onClose}
                        >
                          Generate
                        </Link>{" "}
                        page — they'll appear here.
                      </p>
                    )}
                  </div>
                )}
              {libraryState.kind === "ready" && filteredLibrary.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {filteredLibrary.map((asset) => (
                    <LibraryCard
                      key={asset.id}
                      asset={asset}
                      onPick={() => pickFromLibrary(asset)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Generate — launch /generate with this pack as the target.
             The Generation page renders a banner (`GenerationPackTargetBanner`)
             that lets the user add the baked asset back to this pack
             with one click — no manual round-trip required. */}
        {source === "generate" && (
          <div className="flex-1 overflow-y-auto px-6 py-8 text-center space-y-3">
            <Sparkles size={28} className="mx-auto text-primary" />
            <h4 className="text-sm font-medium text-text-primary">
              Generate a new asset with AI
            </h4>
            <p className="text-xs text-text-tertiary leading-relaxed max-w-sm mx-auto">
              Open the Generate page with this pack pre-selected as the target.
              Describe what you want (e.g. "stylized oak tree, weathered bark,
              autumn leaves") and when the bake completes, click{" "}
              <span className="text-text-secondary">Add to Pack</span> in the
              banner to drop it straight into{" "}
              <span className="text-text-secondary">{packDisplayName}</span>.
            </p>
            <Link
              to={`${ROUTES.GENERATION}?targetPack=${encodeURIComponent(
                pack.manifestId,
              )}`}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <ExternalLink size={12} />
              Open Generate for {packDisplayName}
            </Link>
          </div>
        )}

        {/* From URL — manual form (also used after a Library pick) */}
        {source === "url" && (
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
          >
            <Field label="Asset name">
              <input
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Oak Tree"
                className="w-full px-2 py-1.5 text-sm bg-white/[0.03] border border-white/[0.08] rounded text-text-primary focus:outline-none focus:border-primary/40"
              />
              {name.trim().length > 0 && (
                <p className="text-[10px] text-text-tertiary/70 mt-1 font-mono truncate">
                  id: {effectiveEntryId}
                </p>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <select
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as AssetPackEntryInput["type"])
                  }
                  className="w-full px-2 py-1.5 text-xs bg-white/[0.03] border border-white/[0.08] rounded text-text-primary focus:outline-none focus:border-primary/40"
                >
                  {ASSET_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Subcategory" hint="e.g. tree, sword, helmet.">
                <input
                  type="text"
                  required
                  value={subtype}
                  onChange={(e) => setSubtype(e.target.value)}
                  placeholder="tree"
                  className="w-full px-2 py-1.5 text-xs bg-white/[0.03] border border-white/[0.08] rounded text-text-primary focus:outline-none focus:border-primary/40"
                />
              </Field>
            </div>

            <Field
              label="Model file"
              hint="URL to a .glb or .fbx file, or an asset:// path."
            >
              <input
                type="text"
                required
                value={modelUrl}
                onChange={(e) => setModelUrl(e.target.value)}
                placeholder="asset://models/trees/oak/oak_01.glb"
                className="w-full px-2 py-1.5 text-xs bg-white/[0.03] border border-white/[0.08] rounded text-text-primary font-mono focus:outline-none focus:border-primary/40"
              />
            </Field>

            <Field label="Tags" hint="Comma-separated. Optional.">
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="tree, woodcutting"
                className="w-full px-2 py-1.5 text-xs bg-white/[0.03] border border-white/[0.08] rounded text-text-primary focus:outline-none focus:border-primary/40"
              />
            </Field>

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors"
            >
              {showAdvanced ? "▾" : "▸"} Advanced
            </button>

            {showAdvanced && (
              <div className="space-y-3 pt-1 pl-2 border-l border-white/[0.06]">
                <Field
                  label="Asset ID"
                  hint="Pack-scoped, auto-generated from name. Override if you need a specific id."
                >
                  <input
                    type="text"
                    value={effectiveEntryId}
                    onChange={(e) => setEntryIdOverride(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs bg-white/[0.03] border border-white/[0.08] rounded text-text-primary font-mono focus:outline-none focus:border-primary/40"
                  />
                </Field>

                <Field label="Description">
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Oak tree — gather wood here."
                    className="w-full px-2 py-1.5 text-xs bg-white/[0.03] border border-white/[0.08] rounded text-text-primary focus:outline-none focus:border-primary/40"
                  />
                </Field>

                <Field label="Thumbnail URL" hint="Optional preview image.">
                  <input
                    type="text"
                    value={thumbnailUrl}
                    onChange={(e) => setThumbnailUrl(e.target.value)}
                    placeholder="https://…/thumb.png"
                    className="w-full px-2 py-1.5 text-xs bg-white/[0.03] border border-white/[0.08] rounded text-text-primary font-mono focus:outline-none focus:border-primary/40"
                  />
                </Field>
              </div>
            )}

            {error && (
              <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  submitting ||
                  !effectiveEntryId.trim() ||
                  !name.trim() ||
                  !subtype.trim() ||
                  !modelUrl.trim()
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 size={11} className="animate-spin" />
                    Adding
                  </>
                ) : (
                  "Add Asset"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * Confirm publishing a team pack to the public marketplace. We
 * gate publish (not unpublish) because going public is the more
 * consequential direction — once listed, anyone in the world can
 * install it, and the action is observable instantly. Unpublish
 * is reversible / safer and goes direct.
 */
interface PublishConfirmModalProps {
  pack: AssetPackResponse;
  onCancel: () => void;
  onConfirm: () => void;
}

function PublishConfirmModal({
  pack,
  onCancel,
  onConfirm,
}: PublishConfirmModalProps) {
  const summary = summarizeManifest(pack.manifest);
  const packName =
    (pack.manifest as { name?: string })?.name ?? pack.manifestId;
  const empty = summary.assetCount === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md mx-4 bg-bg-primary border border-white/[0.08] rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 min-w-0">
            <Upload size={14} className="text-primary flex-shrink-0" />
            <h3 className="text-sm font-medium text-text-primary truncate">
              Publish to marketplace
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-text-tertiary hover:text-text-primary"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          <div className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
            <Package size={20} className="text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {packName}
              </p>
              <p className="text-[11px] text-text-tertiary truncate">
                v{summary.packVersion} · {summary.assetCount} asset
                {summary.assetCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <p className="text-xs text-text-secondary leading-relaxed">
            Publishing makes this pack <strong>visible to everyone</strong> on
            the marketplace. Anyone using HyperForge will be able to install it
            on their projects.
          </p>

          {empty && (
            <div className="flex items-start gap-2 p-2.5 rounded border border-amber-500/30 bg-amber-500/5 text-[11px] text-amber-200/90">
              <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
              <p className="leading-relaxed">
                This pack has no assets yet. You can still publish, but it'll
                show up empty in the marketplace until you add some.
              </p>
            </div>
          )}

          <p className="text-[11px] text-text-tertiary leading-relaxed">
            You can <span className="text-text-secondary">Unpublish</span> any
            time to remove it from the marketplace.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
          >
            <Upload size={11} />
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Vertical card for a single asset pack — the visual centerpiece
 * of the panel. Renders in a responsive grid (1 col narrow, 2 col
 * medium, 3 col wide) so the page reads as a gallery.
 *
 * Layout:
 *   - Big 16:10 cover at top (concept art of first entry).
 *   - Title row with version + visibility/source badges.
 *   - 2-line clamped description.
 *   - Metadata row (asset count, author, tags).
 *   - Footer with primary actions (Install / Add Asset / Publish).
 *   - Inline expanded entries section below the card body when
 *     the chevron is toggled — pushes the card taller within its
 *     grid cell so adjacent cards aren't displaced.
 *
 * Props are mostly derived in the parent (the panel owns the
 * service mutations and notify state); the card stays presentational.
 */
interface PackCardProps {
  pack: AssetPackResponse;
  projectMode: boolean;
  projectId: string | null;
  isMyTeam: boolean;
  isInstalled: boolean;
  installing: boolean;
  installError: string | null;
  publishing: boolean;
  publishError: string | null;
  /** Click anywhere on the card body opens the detail popup. */
  onView: () => void;
  onInstall: () => void;
  onAddAsset: () => void;
  onPublishToggle: () => void;
}

function PackCard({
  pack,
  projectMode,
  projectId,
  isMyTeam,
  isInstalled,
  installing,
  installError,
  publishing,
  publishError,
  onView,
  onInstall,
  onAddAsset,
  onPublishToggle,
}: PackCardProps) {
  const summary = summarizeManifest(pack.manifest);
  const isPublic = pack.visibility === "public";
  const packName =
    (pack.manifest as { name?: string })?.name ?? pack.manifestId;

  // Single click target for the whole body. Footer button clicks
  // call stopPropagation so they don't accidentally open the modal.
  return (
    <div className="group flex flex-col rounded-lg border border-white/[0.06] bg-white/[0.015] hover:border-primary/30 hover:bg-white/[0.03] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 transition-all duration-200 overflow-hidden">
      <button
        type="button"
        onClick={onView}
        className="text-left flex flex-col flex-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-t-lg"
        title={`View details for ${packName}`}
      >
        {/* Cover image */}
        <PackCoverImage pack={pack} />

        {/* Body */}
        <div className="flex flex-col p-3 gap-2 flex-1">
          <h3 className="text-[13px] font-semibold text-text-primary leading-tight line-clamp-2">
            {packName}
          </h3>

          {/* Badges row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-text-tertiary/80 font-mono">
              v{summary.packVersion}
            </span>
            {pack.source === "built-in" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary/90 border border-primary/20">
                Built-in
              </span>
            )}
            {isMyTeam &&
              (() => {
                const v = visibilityLabel(pack.visibility);
                const cls =
                  v.tone === "published"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : v.tone === "team"
                      ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                      : "bg-white/[0.04] text-text-tertiary border-white/[0.08]";
                return (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded border ${cls}`}
                  >
                    {v.label}
                  </span>
                );
              })()}
          </div>

          {/* Description */}
          <p className="text-[11px] text-text-tertiary leading-relaxed line-clamp-2">
            {summary.description || (
              <span className="italic text-text-tertiary/60">
                No description.
              </span>
            )}
          </p>

          {/* Stats row */}
          <div className="flex items-center gap-2.5 text-[10px] text-text-tertiary/70 mt-auto pt-1">
            <span className="inline-flex items-center gap-1">
              <Package size={9} className="text-text-tertiary/50" />
              {summary.assetCount} asset{summary.assetCount === 1 ? "" : "s"}
            </span>
            {summary.author && (
              <>
                <span className="text-text-tertiary/30">·</span>
                <span className="truncate">{summary.author}</span>
              </>
            )}
          </div>

          {(installError || publishError) && (
            <p className="text-[10px] text-red-400 leading-relaxed">
              {installError ?? publishError}
            </p>
          )}
        </div>
      </button>

      {/* Action footer — outside the click-to-view button so action
          buttons capture their own clicks without bubbling. */}
      {(projectMode || (isMyTeam && !!pack.teamId)) && (
        <div className="border-t border-white/[0.06] bg-black/20 px-3 py-2 flex items-center gap-2 flex-wrap">
          {projectMode &&
            (isInstalled ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded">
                <Check size={10} />
                Installed
              </span>
            ) : (
              <button
                type="button"
                disabled={installing || !projectId}
                onClick={onInstall}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title={
                  !projectId
                    ? "Save the project before installing packs"
                    : `Install ${pack.manifestId}`
                }
              >
                {installing ? (
                  <>
                    <Loader2 size={10} className="animate-spin" />
                    Installing
                  </>
                ) : (
                  <>Install</>
                )}
              </button>
            ))}
          {isMyTeam && !!pack.teamId && (
            <>
              <button
                type="button"
                onClick={onAddAsset}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 transition-colors"
                title="Add an asset to this pack"
              >
                <FilePlus size={10} />
                Add Asset
              </button>
              <button
                type="button"
                disabled={publishing}
                onClick={onPublishToggle}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isPublic
                    ? "bg-white/[0.03] hover:bg-white/[0.06] text-text-secondary border-white/[0.08]"
                    : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                }`}
                title={
                  isPublic
                    ? "Unpublish — make team-only again"
                    : "Publish to the public marketplace"
                }
              >
                {publishing ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <Upload size={10} />
                )}
                {isPublic ? "Unpublish" : "Publish"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Pack detail popup — opens when a card is clicked. Shows a hero
 * cover, full description + metadata, and a thumbnail grid of
 * every entry inside the pack. Action buttons mirror the card
 * footer so users can install / publish / add directly from the
 * detail view.
 *
 * Layout:
 *   - Sticky header with pack name + dismiss
 *   - Hero cover (16:9, larger than the card)
 *   - Body: badges, manifest id, description, stats
 *   - Asset grid: 3-4 columns of entry tiles with concept art
 *   - Sticky footer with primary actions
 */
interface PackDetailModalProps {
  pack: AssetPackResponse;
  projectMode: boolean;
  projectId: string | null;
  isMyTeam: boolean;
  isInstalled: boolean;
  installing: boolean;
  publishing: boolean;
  onClose: () => void;
  onInstall: () => void;
  onAddAsset: () => void;
  onPublishToggle: () => void;
}

function PackDetailModal({
  pack,
  projectMode,
  projectId,
  isMyTeam,
  isInstalled,
  installing,
  publishing,
  onClose,
  onInstall,
  onAddAsset,
  onPublishToggle,
}: PackDetailModalProps) {
  const summary = summarizeManifest(pack.manifest);
  const isPublic = pack.visibility === "public";
  const packName =
    (pack.manifest as { name?: string })?.name ?? pack.manifestId;
  const manifestAssets = ((pack.manifest as { assets?: ReadonlyArray<unknown> })
    ?.assets ?? []) as Array<Record<string, unknown>>;

  const hasFooterActions = projectMode || (isMyTeam && !!pack.teamId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 md:p-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-bg-primary border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Package size={14} className="text-primary flex-shrink-0" />
            <h2 className="text-sm font-semibold text-text-primary truncate">
              {packName}
            </h2>
            <span className="text-[10px] text-text-tertiary/80 font-mono flex-shrink-0">
              v{summary.packVersion}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Hero cover */}
          <PackHeroCover pack={pack} />

          <div className="px-5 py-4 space-y-4">
            {/* Badges + metadata row */}
            <div className="flex items-center gap-2 flex-wrap">
              {pack.source === "built-in" && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary/90 border border-primary/20">
                  Built-in
                </span>
              )}
              {isMyTeam &&
                (() => {
                  const v = visibilityLabel(pack.visibility);
                  const cls =
                    v.tone === "published"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : v.tone === "team"
                        ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                        : "bg-white/[0.04] text-text-tertiary border-white/[0.08]";
                  return (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border ${cls}`}
                    >
                      {v.label}
                    </span>
                  );
                })()}
              {summary.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-text-tertiary border border-white/[0.06]"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Description */}
            {summary.description ? (
              <p className="text-xs text-text-secondary leading-relaxed">
                {summary.description}
              </p>
            ) : (
              <p className="text-xs italic text-text-tertiary/60">
                No description.
              </p>
            )}

            {/* Stats */}
            <div className="flex items-center gap-4 text-[11px] text-text-tertiary">
              <span className="inline-flex items-center gap-1.5">
                <Package size={10} />
                {summary.assetCount} asset
                {summary.assetCount === 1 ? "" : "s"}
              </span>
              {summary.author && (
                <>
                  <span className="text-text-tertiary/30">·</span>
                  <span>by {summary.author}</span>
                </>
              )}
              <span className="text-text-tertiary/30">·</span>
              <span className="font-mono text-text-tertiary/60 truncate">
                {pack.manifestId}
              </span>
            </div>

            {/* Asset grid */}
            <div className="pt-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary mb-2">
                Assets in this pack
              </h3>
              {manifestAssets.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/[0.08] bg-black/10 p-8 text-center space-y-2">
                  <ImageIcon
                    size={20}
                    className="mx-auto text-text-tertiary/50"
                  />
                  <p className="text-xs text-text-tertiary">
                    This pack is empty.
                  </p>
                  {isMyTeam && !!pack.teamId && (
                    <p className="text-[11px] text-text-tertiary/70">
                      Click{" "}
                      <span className="text-text-secondary">Add Asset</span>{" "}
                      below to start filling it.
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {manifestAssets.map((entry, idx) => (
                    <PackEntryTile
                      key={(entry?.id as string) ?? idx}
                      entry={entry}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky footer */}
        {hasFooterActions && (
          <div className="border-t border-white/[0.06] bg-black/20 px-5 py-3 flex items-center gap-2 flex-wrap flex-shrink-0">
            {projectMode &&
              (isInstalled ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded">
                  <Check size={11} />
                  Installed on this project
                </span>
              ) : (
                <button
                  type="button"
                  disabled={installing || !projectId}
                  onClick={onInstall}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {installing ? (
                    <>
                      <Loader2 size={11} className="animate-spin" />
                      Installing
                    </>
                  ) : (
                    "Install on Project"
                  )}
                </button>
              ))}
            {isMyTeam && !!pack.teamId && (
              <>
                <button
                  type="button"
                  onClick={onAddAsset}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 transition-colors"
                >
                  <FilePlus size={11} />
                  Add Asset
                </button>
                <button
                  type="button"
                  disabled={publishing}
                  onClick={onPublishToggle}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isPublic
                      ? "bg-white/[0.03] hover:bg-white/[0.06] text-text-secondary border-white/[0.08]"
                      : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  }`}
                >
                  {publishing ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Upload size={11} />
                  )}
                  {isPublic ? "Unpublish" : "Publish to Marketplace"}
                </button>
              </>
            )}
            <div className="ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-[11px] text-text-secondary hover:text-text-primary transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Hero cover for the detail modal — bigger 16:9 version of
 * PackCoverImage. Same image-with-fallback behavior.
 */
function PackHeroCover({ pack }: { pack: AssetPackResponse }) {
  const assets = ((
    pack.manifest as {
      assets?: Array<{
        modelUrl?: string;
        type?: string;
        subtype?: string;
      }>;
    }
  )?.assets ?? []) as Array<{
    modelUrl?: string;
    type?: string;
    subtype?: string;
  }>;
  const isEmpty = assets.length === 0;

  if (isEmpty) {
    return (
      <div className="aspect-[16/9] bg-gradient-to-br from-white/[0.03] to-black/20 border-b border-white/[0.06] flex flex-col items-center justify-center gap-2">
        <Package size={32} className="text-text-tertiary/40" />
        <span className="text-xs text-text-tertiary/60">
          Empty pack — ready for assets
        </span>
      </div>
    );
  }

  const firstAsset = assets[0] ?? {};
  const style = getTypeStyle(firstAsset.type, firstAsset.subtype);
  const Icon = style.Icon;
  const firstModelUrl =
    typeof firstAsset.modelUrl === "string" ? firstAsset.modelUrl : null;

  return (
    <ModelThumbnail
      modelUrl={firstModelUrl}
      alt=""
      eager
      className={`aspect-[16/9] bg-gradient-to-br ${style.bgGradient} flex items-center justify-center overflow-hidden`}
      fallback={<Icon size={56} className={style.fg} strokeWidth={1.25} />}
    />
  );
}

/**
 * One entry tile inside the detail modal's asset grid. Concept art
 * top, name + type/subtype below. Matches the LibraryCard rhythm
 * so the surface feels consistent.
 */
function PackEntryTile({ entry }: { entry: Record<string, unknown> }) {
  const id = typeof entry?.id === "string" ? entry.id : "";
  const name = typeof entry?.name === "string" ? entry.name : id || "Asset";
  const type = typeof entry?.type === "string" ? entry.type : "";
  const subtype = typeof entry?.subtype === "string" ? entry.subtype : "";
  const modelUrl = typeof entry?.modelUrl === "string" ? entry.modelUrl : "";
  const style = getTypeStyle(type, subtype);
  const Icon = style.Icon;

  return (
    <div className="rounded-lg overflow-hidden border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] transition-colors">
      <ModelThumbnail
        modelUrl={modelUrl}
        alt={name}
        className={`aspect-square bg-gradient-to-br ${style.bgGradient} flex items-center justify-center overflow-hidden`}
        fallback={<Icon size={28} className={style.fg} strokeWidth={1.5} />}
      />
      <div className="px-2 py-1.5">
        <p className="text-[11px] font-medium text-text-primary truncate">
          {name}
        </p>
        {(type || subtype) && (
          <p className="text-[9px] text-text-tertiary/70 truncate">
            {type}
            {type && subtype ? " · " : ""}
            {subtype}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Big 16:10 cover image for the pack card. Same fallback behavior
 * as PackThumbnail (first entry's concept art → Package icon for
 * empty packs / failed loads), but at hero size.
 */
function PackCoverImage({ pack }: { pack: AssetPackResponse }) {
  const assets = ((
    pack.manifest as {
      assets?: Array<{
        modelUrl?: string;
        type?: string;
        subtype?: string;
      }>;
    }
  )?.assets ?? []) as Array<{
    modelUrl?: string;
    type?: string;
    subtype?: string;
  }>;
  const isEmpty = assets.length === 0;

  if (isEmpty) {
    return (
      <div
        className="aspect-[16/10] bg-gradient-to-br from-white/[0.02] to-black/20 border-b border-dashed border-white/[0.08] flex flex-col items-center justify-center gap-1.5"
        aria-label="Empty pack — ready for content"
      >
        <Package size={22} className="text-text-tertiary/40" />
        <span className="text-[10px] text-text-tertiary/60">
          Empty — ready for assets
        </span>
      </div>
    );
  }

  const firstAsset = assets[0] ?? {};
  const style = getTypeStyle(firstAsset.type, firstAsset.subtype);
  const Icon = style.Icon;
  const firstModelUrl =
    typeof firstAsset.modelUrl === "string" ? firstAsset.modelUrl : null;

  return (
    <ModelThumbnail
      modelUrl={firstModelUrl}
      alt=""
      className={`aspect-[16/10] bg-gradient-to-br ${style.bgGradient} flex items-center justify-center overflow-hidden`}
      fallback={<Icon size={42} className={style.fg} strokeWidth={1.25} />}
    />
  );
}

/**
 * Pack-level thumbnail derived from the first entry's concept
 * art. Empty packs get a dashed-border "ready for content"
 * placeholder so the user sees the pack is intentionally blank,
 * not broken.
 *
 * Asset id extraction: pack manifests store `modelUrl` strings
 * shaped like `/api/assets/<assetId>/model` (when added via the
 * Library picker) or arbitrary URLs (when added via "From URL").
 * For the latter we can't derive concept art — we fall back to
 * the icon. This is intentional v1 scope; a future enhancement
 * could let pack authors upload a dedicated cover image.
 */
function extractAssetIdFromModelUrl(modelUrl: string): string | null {
  const m = modelUrl.match(/\/api\/assets\/([^/]+)\/model/);
  return m ? m[1] : null;
}

interface PackThumbnailProps {
  pack: AssetPackResponse;
}

function PackThumbnail({ pack }: PackThumbnailProps) {
  const [imageOk, setImageOk] = useState(true);
  const assets = ((pack.manifest as { assets?: Array<{ modelUrl?: string }> })
    ?.assets ?? []) as Array<{ modelUrl?: string }>;

  const isEmpty = assets.length === 0;
  const firstAssetId = !isEmpty
    ? (assets
        .map((a) => (typeof a?.modelUrl === "string" ? a.modelUrl : null))
        .filter((u): u is string => u !== null)
        .map(extractAssetIdFromModelUrl)
        .find((id): id is string => id !== null) ?? null)
    : null;

  if (isEmpty) {
    return (
      <div className="w-10 h-10 rounded border border-dashed border-white/[0.08] bg-black/10 flex items-center justify-center flex-shrink-0">
        <Package size={14} className="text-text-tertiary/40" />
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded bg-black/40 flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/[0.06]">
      {firstAssetId && imageOk ? (
        <img
          src={getAssetConceptArtUrl(firstAssetId)}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setImageOk(false)}
          loading="lazy"
        />
      ) : (
        <Package size={16} className="text-text-tertiary/60" />
      )}
    </div>
  );
}

/**
 * Larger concept-art thumbnail for the inline review header.
 * Same fallback behavior as LibraryCard.
 */
function SelectedAssetThumbnail({ asset }: { asset: Asset }) {
  const [imageOk, setImageOk] = useState(true);
  const style = getTypeStyle(asset.type, asset.type);
  const Icon = style.Icon;
  return (
    <div
      className={`w-16 h-16 rounded bg-gradient-to-br ${style.bgGradient} flex items-center justify-center flex-shrink-0 overflow-hidden`}
    >
      {imageOk ? (
        <img
          src={getAssetConceptArtUrl(asset.id)}
          alt={asset.name}
          className="w-full h-full object-cover"
          onError={() => setImageOk(false)}
          loading="lazy"
        />
      ) : (
        <Icon size={28} className={style.fg} strokeWidth={1.5} />
      )}
    </div>
  );
}

/**
 * Visual style derived from an entry's type/subtype — used to
 * render rich, distinct fallbacks when no concept-art image is
 * available. Built-in packs (Hyperia) ship asset:// model URLs
 * with no concept art generated, so without this every entry
 * would render an identical gray Package icon.
 *
 * The style is purely cosmetic: an icon, a gradient tint, and a
 * foreground accent. Marketplaces do this routinely — Steam
 * Workshop, Unity, Unreal — to give items visual identity.
 */
interface TypeStyle {
  Icon: LucideIcon;
  /** Tailwind classes for the gradient background. */
  bgGradient: string;
  /** Tailwind class for the icon foreground. */
  fg: string;
}

const DEFAULT_TYPE_STYLE: TypeStyle = {
  Icon: Package,
  bgGradient: "from-white/[0.04] to-black/30",
  fg: "text-text-tertiary/70",
};

/**
 * Match an entry by subtype first (more specific, e.g. "tree"),
 * then by type (the schema enum, e.g. "weapon"). Anything
 * unknown lands on a neutral package fallback.
 */
function getTypeStyle(
  rawType: string | undefined,
  rawSubtype: string | undefined,
): TypeStyle {
  const type = (rawType ?? "").toLowerCase();
  const subtype = (rawSubtype ?? "").toLowerCase();

  // Subtype-keyed (most specific)
  if (subtype === "tree" || subtype === "plant" || subtype === "vegetation") {
    return {
      Icon: TreePine,
      bgGradient: "from-emerald-500/15 to-emerald-900/25",
      fg: "text-emerald-300",
    };
  }
  if (
    subtype === "rock" ||
    subtype === "ore" ||
    subtype === "mineral" ||
    subtype === "stone"
  ) {
    return {
      Icon: Gem,
      bgGradient: "from-slate-400/15 to-slate-700/25",
      fg: "text-slate-200",
    };
  }
  if (subtype === "sword" || subtype === "axe" || subtype === "dagger") {
    return {
      Icon: Sword,
      bgGradient: "from-red-500/15 to-red-900/25",
      fg: "text-red-300",
    };
  }
  if (
    subtype === "shield" ||
    subtype === "helmet" ||
    subtype === "chestplate"
  ) {
    return {
      Icon: Shield,
      bgGradient: "from-amber-500/15 to-amber-900/25",
      fg: "text-amber-300",
    };
  }
  if (subtype === "humanoid" || subtype === "human") {
    return {
      Icon: User,
      bgGradient: "from-sky-500/15 to-sky-900/25",
      fg: "text-sky-300",
    };
  }

  // Type-keyed (broader)
  switch (type) {
    case "character":
      return {
        Icon: User,
        bgGradient: "from-sky-500/15 to-sky-900/25",
        fg: "text-sky-300",
      };
    case "creature":
      return {
        Icon: Ghost,
        bgGradient: "from-purple-500/15 to-purple-900/25",
        fg: "text-purple-300",
      };
    case "weapon":
      return {
        Icon: Sword,
        bgGradient: "from-red-500/15 to-red-900/25",
        fg: "text-red-300",
      };
    case "armor":
      return {
        Icon: Shield,
        bgGradient: "from-amber-500/15 to-amber-900/25",
        fg: "text-amber-300",
      };
    case "tool":
      return {
        Icon: Hammer,
        bgGradient: "from-slate-400/15 to-slate-700/25",
        fg: "text-slate-200",
      };
    case "vehicle":
      return {
        Icon: Car,
        bgGradient: "from-yellow-500/15 to-yellow-900/25",
        fg: "text-yellow-300",
      };
    case "prop":
      return DEFAULT_TYPE_STYLE;
    default:
      return DEFAULT_TYPE_STYLE;
  }
}

/**
 * Library card showing a baked asset's concept art (or a Package
 * icon fallback when the image 404s / errors). The asset gen
 * pipeline writes a `concept-art.png` next to each model; if it
 * isn't there yet (e.g. a still-baking entry), the icon kicks in.
 */
interface LibraryCardProps {
  asset: Asset;
  onPick: () => void;
}

function LibraryCard({ asset, onPick }: LibraryCardProps) {
  const style = getTypeStyle(asset.type, asset.type);
  const Icon = style.Icon;
  // For team-baked assets the asset model URL is /api/assets/<id>/model;
  // ModelThumbnail handles the asset:// proxy or pass-through URL
  // either way. Concept art is no longer used here — the rendered
  // GLB is more accurate than the AI's pre-bake sketch.
  const modelUrl = `/api/assets/${asset.id}/model`;
  return (
    <button
      type="button"
      onClick={onPick}
      className="text-left group rounded-lg overflow-hidden border border-white/[0.06] hover:border-primary/40 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
    >
      <ModelThumbnail
        modelUrl={modelUrl}
        alt={asset.name}
        className={`aspect-square bg-gradient-to-br ${style.bgGradient} flex items-center justify-center overflow-hidden transition-transform group-hover:scale-[1.02]`}
        fallback={<Icon size={28} className={style.fg} strokeWidth={1.5} />}
      />
      <div className="p-1.5">
        <p className="text-[10px] font-medium text-text-primary truncate">
          {asset.name}
        </p>
        <p className="text-[9px] text-text-tertiary/70 truncate">
          {asset.type}
        </p>
      </div>
    </button>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

function Field({ label, hint, children }: FieldProps) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-text-secondary mb-1">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[10px] text-text-tertiary/70 mt-1 leading-relaxed">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * Project-bound wrapper that bridges `useWorldStudio()` into the
 * hook-free `AssetPackBrowserPanel`. Used inside World Studio's
 * BottomPanel where the project context exists.
 *
 * The top-level Asset Packs page mounts the panel directly with
 * `mode="manage"` instead — that path doesn't need this wrapper.
 */
export function AssetPackBrowserPanelProjectBound() {
  const { state, actions } = useWorldStudio();
  return (
    <AssetPackBrowserPanel
      mode="project"
      teamId={state.project.currentTeamId}
      projectId={state.project.currentProjectId}
      installedIds={state.project.assetPacks}
      onInstalled={(merged) => {
        if (!state.project.currentProjectId) return;
        actions.setProject(
          state.project.currentTeamId ?? "",
          state.project.currentGameId ?? "",
          state.project.currentProjectId,
          state.project.projectName ?? "",
          state.project.projectVersion + 1,
          state.project.gameMode,
          state.project.templateId,
          state.project.plugins,
          merged,
        );
      }}
    />
  );
}
