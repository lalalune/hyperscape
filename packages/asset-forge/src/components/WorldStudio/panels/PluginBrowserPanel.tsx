/**
 * PluginBrowserPanel — Phase I5 plugin catalog tab for the bottom dock.
 *
 * Two-tab UI:
 *   - **Browse** — fetches `GET /api/plugins/registry` (newest-first),
 *     supports filter, expand-for-detail, and Install button per row.
 *   - **Installed** — shows locally-installed plugins from the
 *     in-memory `installedPluginsStore`. Supports uninstall.
 *
 * Install flow (Session 3 of PLAN_NEXT_SESSIONS):
 *   1. User clicks Install on a row.
 *   2. UI calls `installPlugin(id, version)` from `pluginApi`.
 *   3. That helper fetches the bundle descriptor + every referenced
 *      file from the content store, sha256-verifies each file, and
 *      returns the verified bytes.
 *   4. Result is recorded in the in-memory installed-plugins store
 *      so the Installed tab updates immediately.
 *
 * Persistence: today the installed set lives in-memory only. When
 * the editor's runtime grows real plugin hot-mount support, the
 * bytes can be written to IndexedDB inside `installedPluginsStore`
 * without changing the public API.
 */

import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  getPublishedPlugin,
  installPlugin,
  type InstalledPlugin,
  listPublishedPlugins,
  type PluginRegistryDetailResponse,
  type PluginRegistryListEntry,
} from "../../../utils/pluginApi";
import {
  isInstalled,
  listInstalledPlugins,
  recordInstalledPlugin,
  subscribeInstalledPlugins,
  uninstallPlugin,
} from "../../../utils/installedPluginsStore";
import { useWorldStudio } from "../WorldStudioContext";

type ListStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; entries: PluginRegistryListEntry[] };

type DetailCache = Record<
  string,
  PluginRegistryDetailResponse | Error | "loading"
>;

function entryKey(entry: PluginRegistryListEntry): string {
  return `${entry.id}@${entry.version}`;
}

function formatPublishedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

type InstallStatus =
  | { kind: "idle" }
  | { kind: "installing"; current: number; total: number }
  | { kind: "error"; message: string }
  | { kind: "done" };

type ActiveTab = "browse" | "installed";

export function PluginBrowserPanel() {
  // AP8 — read project's installed asset packs so we can warn when
  // a plugin's `requiresAssetPacks` declaration is unmet.
  const { state } = useWorldStudio();
  const installedAssetPacks = state.project.assetPacks;

  const [activeTab, setActiveTab] = useState<ActiveTab>("browse");
  const [status, setStatus] = useState<ListStatus>({ kind: "idle" });
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [detailCache, setDetailCache] = useState<DetailCache>({});
  const [installStatus, setInstallStatus] = useState<
    Record<string, InstallStatus>
  >({});
  // Guard against stale state updates when the component re-fetches
  // quickly (e.g. user spams the refresh button).
  const fetchIdRef = useRef(0);

  /**
   * Subscribe to the installed-plugins store so the Installed tab
   * + per-row "Installed" badges update immediately when an install
   * or uninstall happens.
   */
  const installedPlugins = useSyncExternalStore(
    subscribeInstalledPlugins,
    listInstalledPlugins,
    listInstalledPlugins,
  );

  const handleInstall = useCallback(async (entry: PluginRegistryListEntry) => {
    const key = entryKey(entry);
    setInstallStatus((prev) => ({
      ...prev,
      [key]: { kind: "installing", current: 0, total: 0 },
    }));
    try {
      const installed = await installPlugin(
        entry.id,
        entry.version,
        (_file, current, total) => {
          setInstallStatus((prev) => ({
            ...prev,
            [key]: { kind: "installing", current, total },
          }));
        },
      );
      recordInstalledPlugin(installed);
      setInstallStatus((prev) => ({ ...prev, [key]: { kind: "done" } }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setInstallStatus((prev) => ({
        ...prev,
        [key]: { kind: "error", message },
      }));
    }
  }, []);

  const handleUninstall = useCallback((id: string, version: string) => {
    uninstallPlugin(id, version);
    const key = `${id}@${version}`;
    // Reset install status so the Browse tab's button re-shows
    // "Install" instead of "Installed".
    setInstallStatus((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const reload = useCallback(async () => {
    const fetchId = ++fetchIdRef.current;
    setStatus({ kind: "loading" });
    try {
      const entries = await listPublishedPlugins();
      if (fetchId !== fetchIdRef.current) return;
      setStatus({ kind: "ready", entries });
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return;
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", message });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filteredEntries = useMemo(() => {
    if (status.kind !== "ready") return [];
    const needle = filter.trim().toLowerCase();
    if (needle.length === 0) return status.entries;
    return status.entries.filter((e) => {
      const key = entryKey(e);
      if (key.toLowerCase().includes(needle)) return true;
      // Also match against cached manifest fields if we've already
      // fetched them — lets tag searches work for previously-expanded
      // plugins without a broad prefetch.
      const cached = detailCache[key];
      if (cached && cached !== "loading" && !(cached instanceof Error)) {
        const m = cached.bundle.manifest;
        if (m.name.toLowerCase().includes(needle)) return true;
        if (m.description.toLowerCase().includes(needle)) return true;
        for (const tag of m.tags) {
          if (tag.toLowerCase().includes(needle)) return true;
        }
      }
      return false;
    });
  }, [status, filter, detailCache]);

  const toggleExpanded = useCallback(
    async (entry: PluginRegistryListEntry) => {
      const key = entryKey(entry);
      const isOpen = expanded[key] === true;
      setExpanded((prev) => ({ ...prev, [key]: !isOpen }));
      if (isOpen) return;
      if (detailCache[key] !== undefined) return;
      setDetailCache((prev) => ({ ...prev, [key]: "loading" }));
      try {
        const detail = await getPublishedPlugin(entry.id, entry.version);
        setDetailCache((prev) => ({ ...prev, [key]: detail }));
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setDetailCache((prev) => ({ ...prev, [key]: e }));
      }
    },
    [expanded, detailCache],
  );

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Tab strip: Browse / Installed */}
      <div
        className="flex items-center gap-0 px-2 pt-1.5 border-b border-border-primary"
        style={{ background: "var(--bg-secondary)" }}
      >
        <button
          onClick={() => setActiveTab("browse")}
          className={`px-3 py-1 text-[11px] rounded-t border-b-2 transition-colors ${
            activeTab === "browse"
              ? "text-text-primary border-primary"
              : "text-text-tertiary border-transparent hover:text-text-secondary"
          }`}
        >
          Browse
        </button>
        <button
          onClick={() => setActiveTab("installed")}
          className={`px-3 py-1 text-[11px] rounded-t border-b-2 transition-colors ${
            activeTab === "installed"
              ? "text-text-primary border-primary"
              : "text-text-tertiary border-transparent hover:text-text-secondary"
          }`}
        >
          Installed{" "}
          <span className="text-text-tertiary">
            ({installedPlugins.length})
          </span>
        </button>
      </div>

      {activeTab === "installed" ? (
        <InstalledTab
          plugins={installedPlugins}
          installedAssetPacks={installedAssetPacks}
          onUninstall={handleUninstall}
        />
      ) : null}

      {activeTab === "browse" ? (
        <>
          {/* Toolbar: search + refresh + count */}
          <div
            className="flex items-center gap-2 px-2 py-1.5 border-b border-border-primary"
            style={{ background: "var(--bg-secondary)" }}
          >
            <div className="relative flex-1 max-w-sm">
              <Search
                size={12}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
              />
              <input
                type="text"
                placeholder="Filter plugins…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full pl-7 pr-2 py-1 text-[11px] bg-bg-primary border border-border-primary rounded text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary"
              />
            </div>
            <button
              onClick={() => void reload()}
              disabled={status.kind === "loading"}
              className="flex items-center gap-1 px-2 py-1 text-[11px] rounded text-text-secondary hover:text-text-primary hover:bg-bg-tertiary disabled:opacity-50 transition-colors"
              title="Reload registry"
            >
              {status.kind === "loading" ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <RefreshCw size={11} />
              )}
              <span>Reload</span>
            </button>
            <span className="text-[11px] text-text-tertiary ml-auto">
              {status.kind === "ready"
                ? `${filteredEntries.length} / ${status.entries.length}`
                : null}
            </span>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {status.kind === "idle" || status.kind === "loading" ? (
              <div className="flex items-center justify-center py-8 text-text-tertiary text-[11px]">
                <Loader2 size={14} className="animate-spin mr-2" />
                Loading plugin registry…
              </div>
            ) : null}

            {status.kind === "error" ? (
              <div className="flex items-start gap-2 px-3 py-3 text-[11px] text-red-400">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">Failed to load registry</div>
                  <div className="text-text-tertiary mt-0.5">
                    {status.message}
                  </div>
                </div>
              </div>
            ) : null}

            {status.kind === "ready" && status.entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-text-tertiary text-[11px]">
                <Package size={24} className="mb-2 opacity-50" />
                <div>No plugins published yet.</div>
                <div className="mt-1 text-[10px]">
                  Use <code>hyperforge-plugin publish</code> to add one.
                </div>
              </div>
            ) : null}

            {status.kind === "ready" && status.entries.length > 0 ? (
              filteredEntries.length === 0 ? (
                <div className="py-6 text-center text-[11px] text-text-tertiary">
                  No plugins match &ldquo;{filter}&rdquo;.
                </div>
              ) : (
                <ul className="divide-y divide-border-primary">
                  {filteredEntries.map((entry) => {
                    const key = entryKey(entry);
                    const isOpen = expanded[key] === true;
                    const detail = detailCache[key];
                    return (
                      <li key={entry.registryId} className="text-[11px]">
                        <button
                          onClick={() => void toggleExpanded(entry)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-bg-tertiary transition-colors"
                        >
                          {isOpen ? (
                            <ChevronDown
                              size={11}
                              className="text-text-tertiary flex-shrink-0"
                            />
                          ) : (
                            <ChevronRight
                              size={11}
                              className="text-text-tertiary flex-shrink-0"
                            />
                          )}
                          <Package
                            size={11}
                            className="text-text-secondary flex-shrink-0"
                          />
                          <span className="text-text-primary font-medium">
                            {entry.id}
                          </span>
                          <span className="text-text-tertiary">
                            @{entry.version}
                          </span>
                          <span className="text-text-tertiary ml-auto text-[10px]">
                            {formatPublishedAt(entry.publishedAt)}
                          </span>
                        </button>
                        {isOpen ? (
                          <PluginDetailView
                            detail={detail}
                            entry={entry}
                            installStatus={installStatus[key]}
                            installed={isInstalled(entry.id, entry.version)}
                            onInstall={() => void handleInstall(entry)}
                            onUninstall={() =>
                              handleUninstall(entry.id, entry.version)
                            }
                          />
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

interface PluginDetailViewProps {
  detail: PluginRegistryDetailResponse | Error | "loading" | undefined;
  entry: PluginRegistryListEntry;
  installStatus?: InstallStatus;
  installed: boolean;
  onInstall?: () => void;
  onUninstall?: () => void;
}

function PluginDetailView({
  detail,
  entry,
  installStatus,
  installed,
  onInstall,
  onUninstall,
}: PluginDetailViewProps) {
  if (detail === undefined || detail === "loading") {
    return (
      <div className="px-8 py-2 text-text-tertiary text-[11px] flex items-center gap-1.5">
        <Loader2 size={11} className="animate-spin" />
        Loading bundle…
      </div>
    );
  }
  if (detail instanceof Error) {
    return (
      <div className="px-8 py-2 text-red-400 text-[11px] flex items-start gap-1.5">
        <AlertCircle size={11} className="flex-shrink-0 mt-0.5" />
        <span>{detail.message}</span>
      </div>
    );
  }
  const manifest = detail.bundle.manifest;
  const contributions = manifest.contributions;
  const contribRows: Array<[string, string[]]> = [
    ["systems", [...contributions.systems]],
    ["entities", [...contributions.entities]],
    ["widgets", [...contributions.widgets]],
    ["manifestSchemas", [...contributions.manifestSchemas]],
    ["paletteCategories", [...contributions.paletteCategories]],
    ["toolbarTools", [...contributions.toolbarTools]],
    ["commands", [...contributions.commands]],
  ];

  return (
    <div className="px-8 pb-3 pt-1 space-y-2">
      {manifest.description ? (
        <div className="text-text-secondary">{manifest.description}</div>
      ) : null}
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px]">
        <dt className="text-text-tertiary">name</dt>
        <dd className="text-text-primary">{manifest.name}</dd>

        <dt className="text-text-tertiary">author</dt>
        <dd className="text-text-primary">
          {manifest.author.name}
          {manifest.author.email ? (
            <span className="text-text-tertiary">
              {" "}
              &lt;{manifest.author.email}&gt;
            </span>
          ) : null}
        </dd>

        <dt className="text-text-tertiary">license</dt>
        <dd className="text-text-primary">{manifest.license}</dd>

        <dt className="text-text-tertiary">entry</dt>
        <dd className="text-text-primary font-mono">{manifest.entry}</dd>

        <dt className="text-text-tertiary">hyperforgeApi</dt>
        <dd className="text-text-primary font-mono">
          {manifest.hyperforgeApi}
        </dd>

        <dt className="text-text-tertiary">published</dt>
        <dd className="text-text-primary">
          {formatPublishedAt(entry.publishedAt)}
        </dd>

        {manifest.homepage ? (
          <>
            <dt className="text-text-tertiary">homepage</dt>
            <dd className="text-text-primary">
              <a
                href={manifest.homepage}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                {manifest.homepage}
              </a>
            </dd>
          </>
        ) : null}

        {manifest.repository ? (
          <>
            <dt className="text-text-tertiary">repository</dt>
            <dd className="text-text-primary">
              <a
                href={manifest.repository}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                {manifest.repository}
              </a>
            </dd>
          </>
        ) : null}
      </dl>

      {manifest.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {manifest.tags.map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-[1px] text-[10px] rounded bg-bg-tertiary text-text-secondary"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {manifest.dependencies.length > 0 ? (
        <div>
          <div className="text-text-tertiary text-[10px] uppercase tracking-wide mb-0.5">
            dependencies
          </div>
          <ul className="space-y-0.5">
            {manifest.dependencies.map((d) => (
              <li key={d.id} className="font-mono text-text-primary">
                {d.id}{" "}
                <span className="text-text-tertiary">{d.versionRange}</span>
                {d.optional ? (
                  <span className="text-text-tertiary"> (optional)</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <div className="text-text-tertiary text-[10px] uppercase tracking-wide mb-0.5">
          contributions
        </div>
        <ul className="space-y-0.5">
          {contribRows
            .filter(([, items]) => items.length > 0)
            .map(([label, items]) => (
              <li key={label}>
                <span className="text-text-tertiary">{label}:</span>{" "}
                <span className="font-mono text-text-primary">
                  {items.join(", ")}
                </span>
              </li>
            ))}
          {contribRows.every(([, items]) => items.length === 0) ? (
            <li className="text-text-tertiary italic">none declared</li>
          ) : null}
        </ul>
      </div>

      {/* Layer B — entity types this plugin's runtime backs with
          actual gameplay behavior. Mirrors what the AI sees via
          LIST_ENTITY_TYPES so humans inspecting the plugin
          understand what placement vocabulary it provides. */}
      {(() => {
        const entityTypes = (
          contributions as { entityTypes?: ReadonlyArray<unknown> }
        ).entityTypes;
        if (!Array.isArray(entityTypes) || entityTypes.length === 0)
          return null;
        // Group by `kind` so the four placement categories read
        // cleanly side-by-side.
        type Et = {
          kind: string;
          type: string;
          description?: string;
          requiredFields?: ReadonlyArray<string>;
          acceptedAssetTypes?: ReadonlyArray<string>;
        };
        const byKind: Record<string, Et[]> = {};
        for (const raw of entityTypes as Et[]) {
          (byKind[raw.kind] = byKind[raw.kind] ?? []).push(raw);
        }
        return (
          <div>
            <div className="text-text-tertiary text-[10px] uppercase tracking-wide mb-0.5">
              entity types ({entityTypes.length})
            </div>
            <div className="space-y-1.5">
              {(["npc", "mobSpawn", "resource", "station"] as const).map(
                (k) => {
                  const list = byKind[k];
                  if (!list || list.length === 0) return null;
                  return (
                    <div key={k}>
                      <div className="text-[10px] text-text-tertiary capitalize">
                        {k} ({list.length})
                      </div>
                      <ul className="space-y-1 pl-2">
                        {list.map((et) => (
                          <li key={`${et.kind}::${et.type}`}>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-text-primary">
                                {et.type}
                              </span>
                              {et.requiredFields &&
                              et.requiredFields.length > 0 ? (
                                <span className="text-[9px] px-1 py-[1px] rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                  needs {et.requiredFields.join(", ")}
                                </span>
                              ) : null}
                              {et.acceptedAssetTypes &&
                              et.acceptedAssetTypes.length > 0 ? (
                                <span className="text-[9px] px-1 py-[1px] rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                                  asset: {et.acceptedAssetTypes.join("|")}
                                </span>
                              ) : null}
                            </div>
                            {et.description ? (
                              <div className="text-[10px] text-text-tertiary leading-relaxed">
                                {et.description}
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                },
              )}
            </div>
          </div>
        );
      })()}

      {/* Install / Uninstall controls + status */}
      <div className="flex items-center gap-2 pt-2 border-t border-border-primary">
        {installed ? (
          <>
            <span className="flex items-center gap-1 text-[11px] text-green-400">
              <Check size={11} />
              Installed
            </span>
            <button
              onClick={onUninstall}
              className="flex items-center gap-1 px-2 py-1 text-[11px] rounded text-text-secondary hover:text-red-400 hover:bg-bg-tertiary transition-colors"
            >
              <Trash2 size={11} />
              Uninstall
            </button>
          </>
        ) : installStatus?.kind === "installing" ? (
          <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
            <Loader2 size={11} className="animate-spin" />
            Installing
            {installStatus.total > 0
              ? ` (${installStatus.current}/${installStatus.total})`
              : "…"}
          </span>
        ) : installStatus?.kind === "error" ? (
          <span className="flex items-start gap-1 text-[11px] text-red-400">
            <AlertCircle size={11} className="flex-shrink-0 mt-0.5" />
            {installStatus.message}
          </span>
        ) : (
          <button
            onClick={onInstall}
            className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-primary text-white hover:opacity-90 transition-opacity"
          >
            <Download size={11} />
            Install
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Installed-plugins tab body. Reads from the in-memory store and
 * supports per-row uninstall.
 */
interface InstalledTabProps {
  plugins: InstalledPlugin[];
  /** AP8 — installed asset pack ids on the active project. */
  installedAssetPacks: ReadonlyArray<string>;
  onUninstall: (id: string, version: string) => void;
}

/**
 * AP8 — extract the pack ids the plugin's manifest declares as
 * required. Returns empty array when the field is missing (older
 * manifests) or empty.
 */
function readRequiredAssetPacks(plugin: InstalledPlugin): string[] {
  const manifest = plugin.bundle.manifest as
    | { requiresAssetPacks?: ReadonlyArray<string> }
    | undefined;
  const list = manifest?.requiresAssetPacks;
  return Array.isArray(list)
    ? list.filter((x): x is string => typeof x === "string")
    : [];
}

function InstalledTab({
  plugins,
  installedAssetPacks,
  onUninstall,
}: InstalledTabProps) {
  if (plugins.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center justify-center py-10 text-text-tertiary text-[11px]">
          <Package size={24} className="mb-2 opacity-50" />
          <div>No plugins installed yet.</div>
          <div className="mt-1 text-[10px]">
            Switch to the Browse tab and click Install on a plugin.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <ul className="divide-y divide-border-primary">
        {plugins.map((p) => {
          const totalKb = (p.totalSize / 1024).toFixed(1);
          const required = readRequiredAssetPacks(p);
          const unmet = required.filter(
            (id) => !installedAssetPacks.includes(id),
          );
          return (
            <li key={`${p.id}@${p.version}`} className="px-3 py-2 text-[11px]">
              <div className="flex items-center gap-2">
                <Package
                  size={11}
                  className="text-text-secondary flex-shrink-0"
                />
                <span className="text-text-primary font-medium">{p.id}</span>
                <span className="text-text-tertiary">@{p.version}</span>
                <span className="text-text-tertiary ml-auto text-[10px]">
                  {p.files.length} file{p.files.length === 1 ? "" : "s"}{" "}
                  &middot; {totalKb} KB
                </span>
                <button
                  onClick={() => onUninstall(p.id, p.version)}
                  className="flex items-center gap-1 px-1.5 py-0.5 text-[11px] rounded text-text-secondary hover:text-red-400 hover:bg-bg-tertiary transition-colors"
                  title="Uninstall"
                >
                  <Trash2 size={11} />
                </button>
              </div>
              <div className="ml-5 mt-1 text-text-tertiary">
                installed from registry &middot; published{" "}
                {formatPublishedAt(p.publishedAt)}
              </div>
              {unmet.length > 0 && (
                <div
                  className="ml-5 mt-1.5 px-2 py-1 rounded border border-amber-500/30 bg-amber-500/5 text-[10px] text-amber-300/90 space-y-0.5"
                  role="alert"
                >
                  <div className="flex items-center gap-1 font-medium">
                    <AlertTriangle size={10} />
                    Missing asset pack
                    {unmet.length === 1 ? "" : "s"}
                  </div>
                  <div className="text-amber-200/70 leading-relaxed">
                    This plugin needs the following pack
                    {unmet.length === 1 ? "" : "s"} installed on the project:
                  </div>
                  <ul className="font-mono text-amber-200/90">
                    {unmet.map((id) => (
                      <li key={id} className="truncate">
                        &middot; {id}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
