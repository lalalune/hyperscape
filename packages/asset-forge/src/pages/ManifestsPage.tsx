/**
 * ManifestsPage
 * Visual editor for all game manifest JSON files
 *
 * Features:
 * - List all manifests with metadata
 * - Edit manifests with form-based and JSON editors
 * - Validation and error display
 * - Backup management and restore
 * - LOD and VAT pipeline controls
 */

import {
  FileJson,
  Save,
  RotateCcw,
  History,
  Check,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Code,
  Eye,
  Play,
  Loader2,
  Map,
  Users,
  Sword,
  Trees,
  Music,
  Settings,
  Package,
  Sparkles,
} from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";

import {
  BiomesEditor,
  NPCsEditor,
  WorldAreasEditor,
  QuestsEditor,
} from "@/components/ManifestEditors";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/common";
import { formatBytes, formatDateTime } from "@/utils/formatters";

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3401";

// Manifest categories with icons
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  world: <Map className="w-4 h-4" />,
  entities: <Users className="w-4 h-4" />,
  items: <Sword className="w-4 h-4" />,
  progression: <Sparkles className="w-4 h-4" />,
  audio: <Music className="w-4 h-4" />,
  generated: <Settings className="w-4 h-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  world: "text-success",
  entities: "text-accent-aether",
  items: "text-warning",
  progression: "text-accent-violet",
  audio: "text-accent-violet",
  generated: "text-text-secondary",
};

// Manifest list item from API
interface ManifestListItem {
  name: string;
  filename: string;
  description: string;
  category: string;
  editable: boolean;
  lastModified: string;
  size: number;
}

// Manifest content from API
interface ManifestContent {
  name: string;
  filename: string;
  content: unknown;
  lastModified: string;
  size: number;
}

// Validation error
interface ValidationError {
  path: string;
  message: string;
  value: unknown;
}

// LOD/VAT job status
interface BakeJobStatus {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  totalAssets?: number;
  processedAssets?: number;
  totalModels?: number;
  processedModels?: number;
  currentAsset?: string;
  currentModel?: string;
  error?: string;
}

export const ManifestsPage: React.FC = () => {
  // State
  const [manifests, setManifests] = useState<ManifestListItem[]>([]);
  const [selectedManifest, setSelectedManifest] = useState<string | null>(null);
  const [manifestContent, setManifestContent] =
    useState<ManifestContent | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    [],
  );
  const [showJsonEditor, setShowJsonEditor] = useState(true);
  const [backups, setBackups] = useState<string[]>([]);
  const [showBackups, setShowBackups] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // LOD/VAT/Imposter baking state
  const [lodJob, setLodJob] = useState<BakeJobStatus | null>(null);
  const [vatJob, setVatJob] = useState<BakeJobStatus | null>(null);
  const [imposterJob, setImposterJob] = useState<BakeJobStatus | null>(null);
  const [activeTab, setActiveTab] = useState<
    "manifests" | "lod" | "vat" | "imposters"
  >("manifests");
  const [imposterAssets, setImposterAssets] = useState<
    Array<{
      assetId: string;
      name: string;
      category: string;
      modelPath: string;
      hasImposter: boolean;
      imposterPath?: string;
      generatedAt?: string;
    }>
  >([]);
  const [imposterStats, setImposterStats] = useState<{
    totalImposters: number;
    byCategory: Record<string, number>;
    totalSize: number;
  } | null>(null);

  // Dynamic available data for editors (fetched from actual manifests)
  const [availableNpcs, setAvailableNpcs] = useState<string[]>([]);
  const [availableMobs, setAvailableMobs] = useState<string[]>([]);
  const [availableItems, setAvailableItems] = useState<string[]>([]);
  const [availableBiomes, setAvailableBiomes] = useState<string[]>([]);
  const [availableVegetationAssets, setAvailableVegetationAssets] = useState<
    Record<string, string[]>
  >({});

  // Fetch manifests list
  const fetchManifests = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/manifests`);
      if (!response.ok) {
        throw new Error(`Failed to fetch manifests: ${response.statusText}`);
      }
      const data = await response.json();
      setManifests(data);
    } catch (error) {
      console.error("Error fetching manifests:", error);
      setNotification({
        type: "error",
        message: `Failed to load manifests: ${(error as Error).message}`,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch manifest content
  const fetchManifestContent = useCallback(async (name: string) => {
    setIsLoading(true);
    setValidationErrors([]);

    try {
      const response = await fetch(`${API_BASE}/api/manifests/${name}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch manifest: ${response.statusText}`);
      }
      const data = await response.json();

      setManifestContent(data);
      setEditedContent(JSON.stringify(data.content, null, 2));
      setIsDirty(false);

      // Fetch backups
      const backupsResponse = await fetch(
        `${API_BASE}/api/manifests/${name}/backups`,
      );
      if (backupsResponse.ok) {
        const backupsData = await backupsResponse.json();
        setBackups(backupsData);
      }
    } catch (error) {
      console.error(`Error fetching manifest ${name}:`, error);
      setNotification({
        type: "error",
        message: `Failed to fetch manifest: ${(error as Error).message}`,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAvailableData = useCallback(async () => {
    try {
      const npcsResponse = await fetch(`${API_BASE}/api/manifests/npcs`);
      if (npcsResponse.ok) {
        const npcsData = await npcsResponse.json();
        if (Array.isArray(npcsData.content)) {
          const npcs: string[] = [];
          const mobs: string[] = [];
          for (const npc of npcsData.content) {
            if (npc.id) {
              (npc.category === "mob" ? mobs : npcs).push(npc.id);
            }
          }
          setAvailableNpcs(npcs);
          setAvailableMobs(mobs);
        }
      }

      const itemsResponse = await fetch(`${API_BASE}/api/manifests/items`);
      if (itemsResponse.ok) {
        const itemsData = await itemsResponse.json();
        if (Array.isArray(itemsData.content)) {
          setAvailableItems(
            itemsData.content
              .map((item: { id?: string }) => item.id)
              .filter(Boolean),
          );
        } else if (typeof itemsData.content === "object") {
          setAvailableItems(Object.keys(itemsData.content));
        }
      }

      const biomesResponse = await fetch(`${API_BASE}/api/manifests/biomes`);
      if (biomesResponse.ok) {
        const biomesData = await biomesResponse.json();
        if (Array.isArray(biomesData.content)) {
          setAvailableBiomes(
            biomesData.content
              .map((b: { id?: string }) => b.id)
              .filter(Boolean),
          );
        }
      }

      const vegAssets: Record<string, string[]> = {
        tree: [],
        bush: [],
        rock: [],
        grass: [],
        flower: [],
        mushroom: [],
        fern: [],
      };

      const bundlesResponse = await fetch(`${API_BASE}/api/lod/bundles`);
      if (bundlesResponse.ok) {
        const bundles = await bundlesResponse.json();
        if (Array.isArray(bundles)) {
          for (const bundle of bundles) {
            const category = bundle.category || "default";
            if (vegAssets[category]) {
              vegAssets[category].push(bundle.assetId);
            }
          }
        }
      }
      setAvailableVegetationAssets(vegAssets);
    } catch (error) {
      console.error("Error fetching available data:", error);
    }
  }, []);

  // Select a manifest
  const selectManifest = useCallback(
    (name: string) => {
      if (isDirty) {
        if (!confirm("You have unsaved changes. Discard them?")) {
          return;
        }
      }
      setSelectedManifest(name);
      fetchManifestContent(name);
    },
    [isDirty, fetchManifestContent],
  );

  // Handle content change
  const handleContentChange = useCallback(
    (value: string) => {
      setEditedContent(value);
      setIsDirty(value !== JSON.stringify(manifestContent?.content, null, 2));

      // Try to validate JSON
      try {
        JSON.parse(value);
        setValidationErrors([]);
      } catch (e) {
        setValidationErrors([
          {
            path: "",
            message: `Invalid JSON: ${(e as Error).message}`,
            value: null,
          },
        ]);
      }
    },
    [manifestContent],
  );

  // Validate content
  const validateContent = useCallback(async () => {
    if (!selectedManifest) return;

    let content: unknown;
    try {
      content = JSON.parse(editedContent);
    } catch {
      return; // Already shown as validation error
    }

    const response = await fetch(
      `${API_BASE}/api/manifests/${selectedManifest}/validate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      },
    );

    const result = await response.json();
    setValidationErrors(result.errors || []);
  }, [selectedManifest, editedContent]);

  // Save content
  const saveContent = useCallback(async () => {
    if (!selectedManifest || validationErrors.length > 0) return;

    let content: unknown;
    try {
      content = JSON.parse(editedContent);
    } catch {
      return;
    }

    setIsSaving(true);

    const response = await fetch(
      `${API_BASE}/api/manifests/${selectedManifest}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      },
    );

    if (response.ok) {
      const result = await response.json();
      setIsDirty(false);
      setNotification({
        type: "success",
        message: "Manifest saved successfully",
      });

      // Refresh content
      await fetchManifestContent(selectedManifest);
      await fetchManifests();

      // Update backups
      if (result.backupPath) {
        const backupsResponse = await fetch(
          `${API_BASE}/api/manifests/${selectedManifest}/backups`,
        );
        const backupsData = await backupsResponse.json();
        setBackups(backupsData);
      }
    } else {
      const error = await response.json();
      setNotification({
        type: "error",
        message: error.error || "Failed to save manifest",
      });
    }

    setIsSaving(false);
  }, [
    selectedManifest,
    editedContent,
    validationErrors,
    fetchManifestContent,
    fetchManifests,
  ]);

  // Restore from backup
  const restoreBackup = useCallback(
    async (backupFilename: string) => {
      if (!selectedManifest) return;

      if (!confirm(`Restore from backup ${backupFilename}?`)) {
        return;
      }

      const response = await fetch(
        `${API_BASE}/api/manifests/${selectedManifest}/restore`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ backupFilename }),
        },
      );

      if (response.ok) {
        setNotification({
          type: "success",
          message: "Backup restored successfully",
        });
        await fetchManifestContent(selectedManifest);
        await fetchManifests();
      } else {
        const error = await response.json();
        setNotification({
          type: "error",
          message: error.error || "Failed to restore backup",
        });
      }

      setShowBackups(false);
    },
    [selectedManifest, fetchManifestContent, fetchManifests],
  );

  // LOD baking
  const startLODBake = useCallback(async (bakeAll: boolean) => {
    try {
      const url = bakeAll
        ? `${API_BASE}/api/lod/bake-all`
        : `${API_BASE}/api/lod/bake`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bakeAll ? undefined : JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`Failed to start LOD bake: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.jobId) {
        setLodJob({
          jobId: data.jobId,
          status: "queued",
          progress: 0,
        });
      }
    } catch (error) {
      console.error("Error starting LOD bake:", error);
      setNotification({
        type: "error",
        message: `Failed to start LOD bake: ${(error as Error).message}`,
      });
    }
  }, []);

  // VAT baking
  const startVATBake = useCallback(async (bakeAll: boolean) => {
    try {
      const url = bakeAll
        ? `${API_BASE}/api/vat/bake-all`
        : `${API_BASE}/api/vat/bake`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bakeAll ? undefined : JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`Failed to start VAT bake: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.jobId) {
        setVatJob({
          jobId: data.jobId,
          status: "queued",
          progress: 0,
        });
      }
    } catch (error) {
      console.error("Error starting VAT bake:", error);
      setNotification({
        type: "error",
        message: `Failed to start VAT bake: ${(error as Error).message}`,
      });
    }
  }, []);

  // Fetch imposter assets
  const fetchImposterAssets = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/lod/imposter/discover`);
      if (response.ok) {
        const data = await response.json();
        setImposterAssets(data);
      }
    } catch (error) {
      console.error("Error fetching imposter assets:", error);
    }
  }, []);

  // Fetch imposter stats
  const fetchImposterStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/lod/imposter/stats`);
      if (response.ok) {
        const data = await response.json();
        setImposterStats(data);
      }
    } catch (error) {
      console.error("Error fetching imposter stats:", error);
    }
  }, []);

  // Imposter baking
  const startImposterBake = useCallback(async (categories?: string[]) => {
    try {
      const response = await fetch(`${API_BASE}/api/lod/imposter/bake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories, force: false }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to start imposter bake: ${response.statusText}`,
        );
      }

      const data = await response.json();
      if (data.jobId) {
        setImposterJob({
          jobId: data.jobId,
          status: "queued",
          progress: 0,
        });
        setNotification({
          type: "success",
          message: `Imposter baking job started`,
        });
      }
    } catch (error) {
      console.error("Error starting imposter bake:", error);
      setNotification({
        type: "error",
        message: `Failed to start imposter bake: ${(error as Error).message}`,
      });
    }
  }, []);

  // Poll LOD job status
  useEffect(() => {
    if (
      !lodJob ||
      lodJob.status === "completed" ||
      lodJob.status === "failed"
    ) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/lod/jobs/${lodJob.jobId}`,
        );
        if (response.ok) {
          const data = await response.json();
          setLodJob(data);
        }
      } catch (error) {
        console.error("Error polling LOD job status:", error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lodJob]);

  // Poll VAT job status
  useEffect(() => {
    if (
      !vatJob ||
      vatJob.status === "completed" ||
      vatJob.status === "failed"
    ) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/vat/jobs/${vatJob.jobId}`,
        );
        if (response.ok) {
          const data = await response.json();
          setVatJob(data);
        }
      } catch (error) {
        console.error("Error polling VAT job status:", error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [vatJob]);

  // Poll imposter job status
  useEffect(() => {
    if (
      !imposterJob ||
      imposterJob.status === "completed" ||
      imposterJob.status === "failed"
    ) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/lod/imposter/jobs/${imposterJob.jobId}`,
        );
        if (response.ok) {
          const data = await response.json();
          setImposterJob(data);
          if (data.status === "completed") {
            fetchImposterAssets();
            fetchImposterStats();
          }
        }
      } catch (error) {
        console.error("Error polling imposter job status:", error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [imposterJob, fetchImposterAssets, fetchImposterStats]);

  // Initial fetch
  useEffect(() => {
    fetchManifests();
    fetchAvailableData();
    fetchImposterAssets();
    fetchImposterStats();
  }, [
    fetchManifests,
    fetchAvailableData,
    fetchImposterAssets,
    fetchImposterStats,
  ]);

  // Clear notification after delay
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Group manifests by category
  const manifestsByCategory = manifests.reduce(
    (acc, manifest) => {
      const cat = manifest.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(manifest);
      return acc;
    },
    {} as Record<string, ManifestListItem[]>,
  );

  return (
    <div className="flex h-full bg-bg-primary">
      {/* Sidebar */}
      <div className="w-80 bg-bg-secondary border-r border-border-primary flex flex-col">
        {/* Tab buttons */}
        <div className="flex border-b border-border-primary">
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "manifests"
                ? "bg-primary bg-opacity-10 text-primary border-b-2 border-primary"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
            } ease-out`}
            onClick={() => setActiveTab("manifests")}
          >
            <FileJson className="w-4 h-4 inline mr-2" />
            Manifests
          </button>
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "lod"
                ? "bg-primary bg-opacity-10 text-primary border-b-2 border-primary"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
            } ease-out`}
            onClick={() => setActiveTab("lod")}
          >
            <Trees className="w-4 h-4 inline mr-2" />
            LOD
          </button>
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "vat"
                ? "bg-primary bg-opacity-10 text-primary border-b-2 border-primary"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
            } ease-out`}
            onClick={() => setActiveTab("vat")}
          >
            <Package className="w-4 h-4 inline mr-2" />
            VAT
          </button>
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "imposters"
                ? "bg-primary bg-opacity-10 text-primary border-b-2 border-primary"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
            } ease-out`}
            onClick={() => setActiveTab("imposters")}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Imposters
          </button>
        </div>

        {/* Manifest list */}
        {activeTab === "manifests" && (
          <div className="flex-1 overflow-y-auto">
            {isLoading && !manifests.length ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              Object.entries(manifestsByCategory).map(([category, items]) => (
                <div key={category} className="border-b border-border-primary">
                  <div className="px-4 py-2 bg-bg-tertiary flex items-center gap-2">
                    <span className={CATEGORY_COLORS[category]}>
                      {CATEGORY_ICONS[category]}
                    </span>
                    <span className="text-xs font-semibold uppercase text-text-secondary tracking-[0.12em]">
                      {category}
                    </span>
                    <span className="text-xs text-text-muted">
                      ({items.length})
                    </span>
                  </div>
                  {items.map((manifest) => (
                    <button
                      key={manifest.name}
                      className={`w-full px-4 py-3 text-left hover:bg-bg-tertiary transition-colors flex items-center gap-3 ${
                        selectedManifest === manifest.name
                          ? "bg-primary bg-opacity-10 border-l-2 border-primary"
                          : ""
                      } ease-out`}
                      onClick={() => selectManifest(manifest.name)}
                    >
                      <FileJson
                        className={`w-4 h-4 ${
                          manifest.editable ? "text-primary" : "text-text-muted"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-text-primary truncate">
                          {manifest.name}
                        </div>
                        <div className="text-xs text-text-muted truncate">
                          {manifest.description}
                        </div>
                      </div>
                      {!manifest.editable && (
                        <span className="text-xs text-text-muted px-2 py-0.5 bg-bg-tertiary rounded">
                          read-only
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-text-muted" />
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {/* LOD tab */}
        {activeTab === "lod" && (
          <div className="flex-1 p-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">LOD Baking</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-text-secondary">
                  Generate LOD1 (low-poly) models for vegetation and resources
                  using Blender decimation.
                </p>
                <Button
                  onClick={() => startLODBake(true)}
                  disabled={lodJob?.status === "running"}
                  className="w-full"
                >
                  {lodJob?.status === "running" ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Baking... ({Math.round(lodJob.progress || 0)}%)
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Bake All LODs
                    </>
                  )}
                </Button>
                {lodJob && (
                  <div className="text-xs text-text-secondary space-y-1">
                    <div>Status: {lodJob.status}</div>
                    {lodJob.currentAsset && (
                      <div className="truncate">
                        Current: {lodJob.currentAsset}
                      </div>
                    )}
                    {lodJob.totalAssets && (
                      <div>
                        Progress: {lodJob.processedAssets || 0} /{" "}
                        {lodJob.totalAssets}
                      </div>
                    )}
                    {lodJob.error && (
                      <div className="text-error">Error: {lodJob.error}</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">LOD Settings</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-text-secondary">
                <p>
                  Distance thresholds and vertex budgets are configured per
                  category in lod-settings.json.
                </p>
                <button
                  className="text-primary hover:underline mt-2"
                  onClick={() => {
                    setActiveTab("manifests");
                    // Note: lod-settings would need to be added as a manifest
                  }}
                >
                  Edit LOD Settings →
                </button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* VAT tab */}
        {activeTab === "vat" && (
          <div className="flex-1 p-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">VAT Baking</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-text-secondary">
                  Generate Vertex Animation Textures for mob animations. Enables
                  GPU-driven animation without CPU skeleton updates.
                </p>
                <Button
                  onClick={() => startVATBake(true)}
                  disabled={vatJob?.status === "running"}
                  className="w-full"
                >
                  {vatJob?.status === "running" ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Baking... ({Math.round(vatJob.progress || 0)}%)
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Bake All VATs
                    </>
                  )}
                </Button>
                {vatJob && (
                  <div className="text-xs text-text-secondary space-y-1">
                    <div>Status: {vatJob.status}</div>
                    {vatJob.currentModel && (
                      <div className="truncate">
                        Current: {vatJob.currentModel}
                      </div>
                    )}
                    {vatJob.totalModels && (
                      <div>
                        Progress: {vatJob.processedModels || 0} /{" "}
                        {vatJob.totalModels}
                      </div>
                    )}
                    {vatJob.error && (
                      <div className="text-error">Error: {vatJob.error}</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Animation Settings</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-text-secondary space-y-2">
                <div>
                  <strong>Default FPS:</strong> 30
                </div>
                <div>
                  <strong>Max Frames per Animation:</strong> 30
                </div>
                <div>
                  <strong>Animations Baked:</strong> idle, walk, attack, death
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Imposters tab */}
        {activeTab === "imposters" && (
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Octahedral Imposter Baking
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-text-secondary">
                  Generate octahedral imposters for mobs, NPCs, and player
                  characters. These are multi-view billboards that replace 3D
                  models at distance.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    onClick={() => startImposterBake(["mob"])}
                    disabled={imposterJob?.status === "running"}
                    variant="secondary"
                    size="sm"
                  >
                    Bake Mobs
                  </Button>
                  <Button
                    onClick={() => startImposterBake(["npc"])}
                    disabled={imposterJob?.status === "running"}
                    variant="secondary"
                    size="sm"
                  >
                    Bake NPCs
                  </Button>
                  <Button
                    onClick={() => startImposterBake(["character"])}
                    disabled={imposterJob?.status === "running"}
                    variant="secondary"
                    size="sm"
                  >
                    Bake Characters
                  </Button>
                </div>
                <Button
                  onClick={() => startImposterBake(undefined)}
                  disabled={imposterJob?.status === "running"}
                  className="w-full"
                >
                  {imposterJob?.status === "running" ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Baking... ({Math.round(imposterJob.progress || 0)}%)
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Bake All Imposters
                    </>
                  )}
                </Button>
                {imposterJob && (
                  <div className="text-xs text-text-secondary space-y-1">
                    <div>Status: {imposterJob.status}</div>
                    {imposterJob.currentAsset && (
                      <div className="truncate">
                        Current: {imposterJob.currentAsset}
                      </div>
                    )}
                    {imposterJob.totalAssets && (
                      <div>
                        Progress: {imposterJob.processedAssets || 0} /{" "}
                        {imposterJob.totalAssets}
                      </div>
                    )}
                    {imposterJob.error && (
                      <div className="text-error">
                        Error: {imposterJob.error}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {imposterStats && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Statistics</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-text-secondary space-y-2">
                  <div>
                    <strong>Total Imposters:</strong>{" "}
                    {imposterStats.totalImposters}
                  </div>
                  <div>
                    <strong>Total Size:</strong>{" "}
                    {formatBytes(imposterStats.totalSize)}
                  </div>
                  {Object.entries(imposterStats.byCategory).map(
                    ([cat, count]) => (
                      <div key={cat}>
                        <strong>{cat}:</strong> {count}
                      </div>
                    ),
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Available Models ({imposterAssets.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-80 overflow-y-auto">
                {imposterAssets.length === 0 ? (
                  <p className="text-xs text-text-muted">No models found.</p>
                ) : (
                  <div className="space-y-2">
                    {imposterAssets.map((asset) => (
                      <div
                        key={asset.assetId}
                        className="flex items-center justify-between p-2 bg-bg-tertiary rounded text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-text-primary truncate">
                            {asset.name}
                          </div>
                          <div className="text-text-muted truncate">
                            {asset.category} • {asset.modelPath}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          {asset.hasImposter ? (
                            <span className="text-success flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              Baked
                            </span>
                          ) : (
                            <span className="text-text-muted">Pending</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Imposter Settings</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-text-secondary space-y-2">
                <div>
                  <strong>Atlas Resolution:</strong> 2048x2048
                </div>
                <div>
                  <strong>Grid Size:</strong> 8x8 views
                </div>
                <div>
                  <strong>Mapping:</strong> Hemisphere (HEMI)
                </div>
                <div>
                  <strong>Animation Frame:</strong> 25% through idle
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Notification */}
        {notification && (
          <div
            className={`px-4 py-2 flex items-center gap-2 ${
              notification.type === "success"
                ? "bg-success bg-opacity-20 text-success"
                : "bg-error bg-opacity-20 text-error"
            }`}
          >
            {notification.type === "success" ? (
              <Check className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {notification.message}
          </div>
        )}

        {/* Toolbar */}
        {selectedManifest && manifestContent && (
          <div className="px-4 py-2 border-b border-border-primary flex items-center gap-2 bg-bg-secondary">
            <div className="flex-1">
              <h2 className="font-display text-lg font-medium tracking-tight text-text-primary">
                {manifestContent.name}.json
              </h2>
              <div className="text-xs text-text-muted flex items-center gap-4">
                <span>{formatBytes(manifestContent.size)}</span>
                <span>
                  Modified: {formatDateTime(manifestContent.lastModified)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* View toggle */}
              <button
                className={`p-2 rounded transition-colors ${
                  showJsonEditor
                    ? "bg-primary bg-opacity-20 text-primary"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
                } ease-out`}
                onClick={() => setShowJsonEditor(true)}
                title="JSON Editor"
              >
                <Code className="w-4 h-4" />
              </button>
              <button
                className={`p-2 rounded transition-colors ${
                  !showJsonEditor
                    ? "bg-primary bg-opacity-20 text-primary"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
                } ease-out`}
                onClick={() => setShowJsonEditor(false)}
                title="Visual Editor"
              >
                <Eye className="w-4 h-4" />
              </button>

              <div className="w-px h-6 bg-border-primary mx-2" />

              {/* Validate */}
              <Button variant="secondary" size="sm" onClick={validateContent}>
                <Check className="w-4 h-4 mr-1" />
                Validate
              </Button>

              {/* Backups */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowBackups(!showBackups)}
              >
                <History className="w-4 h-4 mr-1" />
                Backups ({backups.length})
              </Button>

              {/* Refresh */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fetchManifestContent(selectedManifest)}
                disabled={isLoading}
              >
                <RefreshCw
                  className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                />
              </Button>

              {/* Save */}
              {manifests.find((m) => m.name === selectedManifest)?.editable && (
                <Button
                  onClick={saveContent}
                  disabled={!isDirty || validationErrors.length > 0 || isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-1" />
                  )}
                  Save
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Backups panel */}
        {showBackups && backups.length > 0 && (
          <div className="border-b border-border-primary bg-bg-tertiary p-4">
            <h3 className="text-sm font-medium text-text-primary mb-2">
              Available Backups
            </h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {backups.map((backup) => (
                <button
                  key={backup}
                  className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-bg-secondary rounded flex items-center gap-2"
                  onClick={() => restoreBackup(backup)}
                >
                  <RotateCcw className="w-4 h-4" />
                  {backup}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <div className="border-b border-error border-opacity-30 bg-error bg-opacity-10 p-4">
            <h3 className="text-sm font-medium text-error mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Validation Errors ({validationErrors.length})
            </h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {validationErrors.map((error, i) => (
                <div key={i} className="text-xs text-error">
                  {error.path && (
                    <span className="font-mono">{error.path}: </span>
                  )}
                  {error.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Editor */}
        {selectedManifest && manifestContent ? (
          <div className="flex-1 overflow-hidden">
            {showJsonEditor ? (
              <textarea
                className="w-full h-full p-4 bg-bg-primary text-text-primary font-mono text-sm resize-none focus:outline-none"
                value={editedContent}
                onChange={(e) => handleContentChange(e.target.value)}
                spellCheck={false}
                readOnly={
                  !manifests.find((m) => m.name === selectedManifest)?.editable
                }
              />
            ) : (
              // Visual editors for specific manifests
              <div className="h-full overflow-hidden">
                {selectedManifest === "biomes" &&
                Array.isArray(manifestContent.content) ? (
                  <BiomesEditor
                    biomes={
                      manifestContent.content as Parameters<
                        typeof BiomesEditor
                      >[0]["biomes"]
                    }
                    onChange={(biomes) => {
                      const newContent = JSON.stringify(biomes, null, 2);
                      handleContentChange(newContent);
                    }}
                    availableMobs={availableMobs}
                    availableVegetationAssets={availableVegetationAssets}
                  />
                ) : selectedManifest === "npcs" &&
                  Array.isArray(manifestContent.content) ? (
                  <NPCsEditor
                    npcs={
                      manifestContent.content as Parameters<
                        typeof NPCsEditor
                      >[0]["npcs"]
                    }
                    onChange={(npcs) => {
                      const newContent = JSON.stringify(npcs, null, 2);
                      handleContentChange(newContent);
                    }}
                    availableBiomes={availableBiomes}
                    availableItems={availableItems}
                  />
                ) : selectedManifest === "world-areas" &&
                  typeof manifestContent.content === "object" ? (
                  <WorldAreasEditor
                    data={
                      manifestContent.content as Parameters<
                        typeof WorldAreasEditor
                      >[0]["data"]
                    }
                    onChange={(data) => {
                      const newContent = JSON.stringify(data, null, 2);
                      handleContentChange(newContent);
                    }}
                    availableNpcs={availableNpcs}
                    availableMobs={availableMobs}
                  />
                ) : selectedManifest === "quests" &&
                  typeof manifestContent.content === "object" ? (
                  <QuestsEditor
                    data={
                      manifestContent.content as Parameters<
                        typeof QuestsEditor
                      >[0]["data"]
                    }
                    onChange={(data) => {
                      const newContent = JSON.stringify(data, null, 2);
                      handleContentChange(newContent);
                    }}
                    availableNpcs={availableNpcs}
                    availableMobs={availableMobs}
                    availableItems={availableItems}
                  />
                ) : (
                  // Default JSON preview for manifests without specialized editors
                  <div className="p-4 overflow-y-auto h-full">
                    <pre className="text-sm text-text-secondary whitespace-pre-wrap">
                      {JSON.stringify(manifestContent.content, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-muted">
            <div className="text-center">
              <FileJson className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p>Select a manifest to edit</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
