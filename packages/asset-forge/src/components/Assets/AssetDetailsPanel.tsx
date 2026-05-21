import {
  X,
  Package,
  Hash,
  Tag,
  Calendar,
  Layers,
  Palette,
  Box,
  FileCode,
  ChevronRight,
  Copy,
  Check,
  Sparkles,
  AlertCircle,
  Download,
  Share2,
  Code,
  Boxes,
  Play,
  RefreshCw,
  Settings2,
} from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";

import { getTierColor } from "../../constants";
import { Asset, LODBundle, LODLevel } from "../../types";

interface AssetDetailsPanelProps {
  asset: Asset;
  isOpen: boolean;
  onClose: () => void;
  modelInfo?: {
    vertices: number;
    faces: number;
    materials: number;
    fileSize?: number;
  } | null;
}

// LOD Tab component
const LODTab: React.FC<{
  asset: Asset;
  modelInfo?: {
    vertices: number;
    faces: number;
    materials: number;
    fileSize?: number;
  } | null;
}> = ({ asset, modelInfo }) => {
  const [lodBundle, setLodBundle] = useState<LODBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [baking, setBaking] = useState(false);
  const [bakingLevel, setBakingLevel] = useState<LODLevel | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<number>(0);

  // Fetch LOD bundle for this asset
  const fetchBundle = useCallback(async () => {
    try {
      const response = await fetch(`/api/lod/bundle/${asset.id}`);
      if (response.ok) {
        const data = await response.json();
        setLodBundle(data);
      } else {
        // No bundle exists yet
        setLodBundle(null);
      }
    } catch (err) {
      console.error("Failed to fetch LOD bundle:", err);
      setLodBundle(null);
    }
  }, [asset.id]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchBundle().finally(() => setLoading(false));
  }, [asset.id, fetchBundle]);

  // Poll for job completion when baking
  useEffect(() => {
    if (!activeJobId) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/lod/jobs/${activeJobId}`);
        if (response.ok) {
          const job = await response.json();
          setJobProgress(job.progress || 0);

          if (job.status === "completed") {
            // Job finished - refresh bundle and stop polling
            setBaking(false);
            setBakingLevel(null);
            setActiveJobId(null);
            setJobProgress(0);
            await fetchBundle();
          } else if (job.status === "failed") {
            // Job failed
            setBaking(false);
            setBakingLevel(null);
            setActiveJobId(null);
            setJobProgress(0);
            setError(job.error || "Bake job failed");
          }
        }
      } catch (err) {
        console.error("Failed to poll job status:", err);
      }
    }, 1000); // Poll every second

    return () => clearInterval(pollInterval);
  }, [activeJobId, fetchBundle]);

  const handleBakeLOD = useCallback(
    async (level: LODLevel) => {
      setBaking(true);
      setBakingLevel(level);
      setError(null);
      setJobProgress(0);

      try {
        const response = await fetch("/api/lod/bake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assetPaths: [`assets/vegetation/${asset.id}/${asset.id}.glb`],
            levels: [level],
          }),
        });
        if (response.ok) {
          const data = await response.json();
          console.log("Bake job started:", data.jobId);
          setActiveJobId(data.jobId);
        } else {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Unknown error" }));
          setError(errorData.error || `HTTP ${response.status}`);
          setBaking(false);
          setBakingLevel(null);
        }
      } catch (err) {
        console.error("Failed to start bake job:", err);
        setError(
          err instanceof Error ? err.message : "Failed to start bake job",
        );
        setBaking(false);
        setBakingLevel(null);
      }
    },
    [asset.id],
  );

  const getLODStatusColor = (level: LODLevel): string => {
    if (!lodBundle) return "text-text-tertiary";
    const variant = lodBundle.variants.find((v) => v.level === level);
    if (variant) return "text-success";
    if (lodBundle.metadata.missingLevels.includes(level)) return "text-warning";
    return "text-text-tertiary";
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="p-5 flex items-center justify-center">
        <RefreshCw className="animate-spin text-text-muted" size={24} />
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 p-2 bg-error bg-opacity-10 border border-error border-opacity-30 rounded-lg text-error text-xs">
          <AlertCircle size={14} />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto hover:opacity-70"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Baking progress */}
      {baking && activeJobId && (
        <div className="p-2 bg-primary bg-opacity-10 rounded-lg">
          <div className="flex items-center justify-between text-xs text-primary mb-1">
            <span>Baking {bakingLevel}...</span>
            <span>{Math.round(jobProgress)}%</span>
          </div>
          <div className="w-full h-1 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${jobProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* LOD Overview */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-text-primary flex items-center gap-2">
          <Boxes size={14} className="text-primary" />
          LOD Variants
        </h3>

        {/* LOD0 - Original */}
        <div className="flex items-center justify-between p-2 bg-bg-secondary rounded-lg">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${getLODStatusColor("lod0")}`}
              style={{ backgroundColor: "var(--color-success)" }}
            />
            <span className="text-xs font-medium text-text-primary">LOD0</span>
            <span className="text-[0.625rem] text-text-tertiary">Original</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span>{modelInfo?.vertices?.toLocaleString() || "—"} verts</span>
            <span>
              {modelInfo?.fileSize ? formatSize(modelInfo.fileSize) : "—"}
            </span>
          </div>
        </div>

        {/* LOD1 */}
        <div className="flex items-center justify-between p-2 bg-bg-secondary rounded-lg">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full`}
              style={{
                backgroundColor: lodBundle?.variants.find(
                  (v) => v.level === "lod1",
                )
                  ? "var(--color-success)"
                  : "var(--color-warning)",
              }}
            />
            <span className="text-xs font-medium text-text-primary">LOD1</span>
            <span className="text-[0.625rem] text-text-tertiary">~30%</span>
          </div>
          <div className="flex items-center gap-2">
            {lodBundle?.variants.find((v) => v.level === "lod1") ? (
              <span className="text-xs text-text-secondary">
                {lodBundle.variants
                  .find((v) => v.level === "lod1")
                  ?.vertices.toLocaleString() || "—"}{" "}
                verts
              </span>
            ) : (
              <button
                onClick={() => handleBakeLOD("lod1")}
                disabled={baking}
                className="flex items-center gap-1 px-2 py-1 text-[0.625rem] bg-primary bg-opacity-20 text-primary rounded hover:bg-opacity-30 transition-colors disabled:opacity-50 ease-out"
              >
                {baking && bakingLevel === "lod1" ? (
                  <RefreshCw className="animate-spin" size={10} />
                ) : (
                  <Play size={10} />
                )}
                Bake
              </button>
            )}
          </div>
        </div>

        {/* LOD2 */}
        <div className="flex items-center justify-between p-2 bg-bg-secondary rounded-lg">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full`}
              style={{
                backgroundColor: lodBundle?.variants.find(
                  (v) => v.level === "lod2",
                )
                  ? "var(--color-success)"
                  : "var(--color-warning)",
              }}
            />
            <span className="text-xs font-medium text-text-primary">LOD2</span>
            <span className="text-[0.625rem] text-text-tertiary">~10%</span>
          </div>
          <div className="flex items-center gap-2">
            {lodBundle?.variants.find((v) => v.level === "lod2") ? (
              <span className="text-xs text-text-secondary">
                {lodBundle.variants
                  .find((v) => v.level === "lod2")
                  ?.vertices.toLocaleString() || "—"}{" "}
                verts
              </span>
            ) : (
              <button
                onClick={() => handleBakeLOD("lod2")}
                disabled={baking}
                className="flex items-center gap-1 px-2 py-1 text-[0.625rem] bg-primary bg-opacity-20 text-primary rounded hover:bg-opacity-30 transition-colors disabled:opacity-50 ease-out"
              >
                {baking && bakingLevel === "lod2" ? (
                  <RefreshCw className="animate-spin" size={10} />
                ) : (
                  <Play size={10} />
                )}
                Bake
              </button>
            )}
          </div>
        </div>

        {/* Imposter - Not yet implemented */}
        <div className="flex items-center justify-between p-2 bg-bg-secondary rounded-lg opacity-60">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full`}
              style={{ backgroundColor: "var(--color-text-muted)" }}
            />
            <span className="text-xs font-medium text-text-primary">
              Imposter
            </span>
            <span className="text-[0.625rem] text-text-tertiary">
              Billboard
            </span>
          </div>
          <div className="flex items-center gap-2">
            {lodBundle?.variants.find((v) => v.level === "imposter") ? (
              <span className="text-xs text-text-secondary">256×256</span>
            ) : (
              <span className="text-[0.625rem] text-text-muted italic">
                Coming soon
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bundle Status */}
      {lodBundle && (
        <div className="pt-3 border-t border-border-primary">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[0.625rem] text-text-tertiary uppercase tracking-[0.12em]">
              Bundle Status
            </span>
            <span
              className={`text-[0.625rem] font-medium ${
                lodBundle.metadata.isComplete ? "text-success" : "text-warning"
              }`}
            >
              {lodBundle.metadata.isComplete
                ? "Complete"
                : `${lodBundle.metadata.missingLevels.length} missing`}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[0.625rem] text-text-tertiary uppercase tracking-[0.12em]">
              Total Size
            </span>
            <span className="text-xs text-text-secondary">
              {formatSize(lodBundle.metadata.totalSize)}
            </span>
          </div>
        </div>
      )}

      {/* Bake All Button */}
      <button
        onClick={async () => {
          // Bake both LOD1 and LOD2 in one job
          setBaking(true);
          setBakingLevel("lod1");
          setError(null);
          setJobProgress(0);

          try {
            const response = await fetch("/api/lod/bake", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                assetPaths: [`assets/vegetation/${asset.id}/${asset.id}.glb`],
                levels: ["lod1", "lod2"],
              }),
            });
            if (response.ok) {
              const data = await response.json();
              setActiveJobId(data.jobId);
            } else {
              const errorData = await response
                .json()
                .catch(() => ({ error: "Unknown error" }));
              setError(errorData.error || `HTTP ${response.status}`);
              setBaking(false);
              setBakingLevel(null);
            }
          } catch (err) {
            console.error("Failed to start bake job:", err);
            setError(
              err instanceof Error ? err.message : "Failed to start bake job",
            );
            setBaking(false);
            setBakingLevel(null);
          }
        }}
        disabled={baking}
        className="w-full px-3 py-2 bg-primary bg-opacity-10 hover:bg-opacity-20 text-primary rounded-lg transition-colors flex items-center justify-center gap-2 text-xs font-medium disabled:opacity-50 ease-out"
      >
        {baking ? (
          <>
            <RefreshCw className="animate-spin" size={14} />
            Baking {bakingLevel}...
          </>
        ) : (
          <>
            <Play size={14} />
            Bake All LODs
          </>
        )}
      </button>

      {/* Settings Link */}
      <button className="w-full px-5 py-4 bg-bg-secondary hover:bg-bg-tertiary text-text-primary rounded-lg transition-colors flex items-center justify-between group text-xs font-medium border border-border-primary ease-out">
        <div className="flex items-center gap-2">
          <Settings2 size={14} />
          <span>LOD Settings</span>
        </div>
        <ChevronRight
          size={14}
          className="group-hover:translate-x-1 transition-transform ease-out"
        />
      </button>
    </div>
  );
};

const AssetDetailsPanel: React.FC<AssetDetailsPanelProps> = ({
  asset,
  isOpen,
  onClose,
  modelInfo,
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "info" | "metadata" | "lod" | "actions"
  >("info");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return "Unknown";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div
      className={`absolute top-0 right-0 h-full w-80 bg-bg-primary bg-opacity-95 shadow-2xl transform transition-all duration-300 ease-out z-20 ${
        isOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      }`}
    >
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="relative p-5 pb-4 border-b border-border-primary bg-gradient-to-r from-bg-secondary to-bg-tertiary">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-bg-hover transition-colors ease-out"
            aria-label="Close details panel"
          >
            <X size={18} className="text-text-secondary" />
          </button>

          {/* Asset info */}
          <div className="pr-8">
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  asset.hasModel
                    ? "bg-primary bg-opacity-20 text-primary"
                    : "bg-bg-primary text-text-secondary"
                }`}
              >
                <Package size={20} />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-text-primary leading-tight">
                  {asset.name}
                </h2>
                <p className="text-xs text-text-secondary capitalize">
                  {asset.type}
                </p>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {asset.metadata.tier && (
                <div
                  className="px-2 py-1 rounded-full text-[0.625rem] font-medium flex items-center gap-1"
                  style={{
                    backgroundColor: `${getTierColor(asset.metadata.tier)}20`,
                    color: getTierColor(asset.metadata.tier),
                    border: `1px solid ${getTierColor(asset.metadata.tier)}40`,
                  }}
                >
                  <Layers size={10} />
                  {asset.metadata.tier}
                </div>
              )}
              {asset.metadata.isPlaceholder && (
                <div className="px-2 py-1 bg-warning bg-opacity-20 text-warning rounded-full text-[0.625rem] font-medium border border-warning border-opacity-40 flex items-center gap-1">
                  <AlertCircle size={10} />
                  Placeholder
                </div>
              )}
              {asset.hasModel && (
                <div className="px-2 py-1 bg-success bg-opacity-20 text-success rounded-full text-[0.625rem] font-medium border border-success border-opacity-40 flex items-center gap-1">
                  <Sparkles size={10} />
                  3D Model
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border-primary">
          <button
            onClick={() => setActiveTab("info")}
            className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors relative ${
              activeTab === "info"
                ? "text-primary"
                : "text-text-tertiary hover:text-text-secondary"
            } ease-out`}
          >
            Info
            {activeTab === "info" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("metadata")}
            className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors relative ${
              activeTab === "metadata"
                ? "text-primary"
                : "text-text-tertiary hover:text-text-secondary"
            } ease-out`}
          >
            Meta
            {activeTab === "metadata" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("lod")}
            className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors relative ${
              activeTab === "lod"
                ? "text-primary"
                : "text-text-tertiary hover:text-text-secondary"
            } ease-out`}
          >
            LOD
            {activeTab === "lod" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("actions")}
            className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors relative ${
              activeTab === "actions"
                ? "text-primary"
                : "text-text-tertiary hover:text-text-secondary"
            } ease-out`}
          >
            Actions
            {activeTab === "actions" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Information Tab */}
          {activeTab === "info" && (
            <div className="p-5 space-y-4">
              {/* Basic Info */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 group">
                  <Hash className="text-text-muted mt-0.5" size={14} />
                  <div className="flex-1">
                    <p className="text-[0.625rem] text-text-tertiary uppercase tracking-[0.12em]">
                      Asset ID
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-text-secondary font-mono">
                        {asset.id}
                      </p>
                      <button
                        onClick={() => copyToClipboard(asset.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity ease-out"
                      >
                        {copiedId ? (
                          <Check size={12} className="text-success" />
                        ) : (
                          <Copy
                            size={12}
                            className="text-text-muted hover:text-text-primary"
                          />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Package className="text-text-muted mt-0.5" size={14} />
                  <div className="flex-1">
                    <p className="text-[0.625rem] text-text-tertiary uppercase tracking-[0.12em]">
                      Type
                    </p>
                    <p className="text-xs text-text-secondary capitalize">
                      {asset.type}
                    </p>
                  </div>
                </div>

                {asset.metadata.subtype && (
                  <div className="flex items-start gap-3">
                    <Tag className="text-text-muted mt-0.5" size={14} />
                    <div className="flex-1">
                      <p className="text-[0.625rem] text-text-tertiary uppercase tracking-[0.12em]">
                        Subtype
                      </p>
                      <p className="text-xs text-text-secondary capitalize">
                        {asset.metadata.subtype}
                      </p>
                    </div>
                  </div>
                )}

                {asset.metadata.generatedAt && (
                  <div className="flex items-start gap-3">
                    <Calendar className="text-text-muted mt-0.5" size={14} />
                    <div className="flex-1">
                      <p className="text-[0.625rem] text-text-tertiary uppercase tracking-[0.12em]">
                        Created
                      </p>
                      <p className="text-xs text-text-secondary">
                        {new Date(
                          asset.metadata.generatedAt,
                        ).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Model Info */}
              {asset.hasModel && (
                <div className="pt-3 border-t border-border-primary">
                  <h3 className="text-xs font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <Box size={14} className="text-primary" />
                    Model Information
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-text-tertiary text-[0.625rem]">
                        Polygons
                      </p>
                      <p className="text-text-secondary font-medium">
                        {modelInfo?.faces
                          ? modelInfo.faces.toLocaleString()
                          : "Loading..."}
                      </p>
                    </div>
                    <div>
                      <p className="text-text-tertiary text-[0.625rem]">
                        File Size
                      </p>
                      <p className="text-text-secondary font-medium">
                        {modelInfo?.fileSize
                          ? formatFileSize(modelInfo.fileSize)
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-text-tertiary text-[0.625rem]">
                        Format
                      </p>
                      <p className="text-text-secondary font-medium uppercase tracking-[0.12em]">
                        {asset.metadata.format || "GLB"}
                      </p>
                    </div>
                    <div>
                      <p className="text-text-tertiary text-[0.625rem]">
                        Vertices
                      </p>
                      <p className="text-text-secondary font-medium">
                        {modelInfo?.vertices
                          ? modelInfo.vertices.toLocaleString()
                          : "Loading..."}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Metadata Tab */}
          {activeTab === "metadata" && (
            <div className="p-5">
              {Object.keys(asset.metadata).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(asset.metadata)
                    .filter(
                      ([key]) =>
                        ![
                          "tier",
                          "subtype",
                          "isPlaceholder",
                          "generatedAt",
                          "polygon_count",
                          "file_size",
                          "format",
                          "lod_count",
                        ].includes(key),
                    )
                    .map(([key, value]) => (
                      <div
                        key={key}
                        className="py-2 border-b border-border-primary last:border-0"
                      >
                        <p className="text-[0.625rem] text-text-tertiary uppercase tracking-[0.12em] mb-1">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </p>
                        <p className="text-xs text-text-secondary font-medium">
                          {typeof value === "boolean"
                            ? value
                              ? "Yes"
                              : "No"
                            : String(value)}
                        </p>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileCode
                    size={32}
                    className="text-text-muted mx-auto mb-2 opacity-50"
                  />
                  <p className="text-xs text-text-tertiary">
                    No additional metadata
                  </p>
                </div>
              )}
            </div>
          )}

          {/* LOD Tab */}
          {activeTab === "lod" && (
            <LODTab asset={asset} modelInfo={modelInfo} />
          )}

          {/* Actions Tab */}
          {activeTab === "actions" && (
            <div className="p-5 space-y-3">
              <button className="w-full px-3 py-2 bg-primary bg-opacity-10 hover:bg-opacity-20 text-primary rounded-lg transition-colors flex items-center justify-between group text-xs font-medium ease-out">
                <div className="flex items-center gap-2">
                  <Palette size={14} />
                  <span>Create Variants</span>
                </div>
                <ChevronRight
                  size={14}
                  className="group-hover:translate-x-1 transition-transform ease-out"
                />
              </button>

              <button className="w-full px-5 py-4 bg-bg-secondary hover:bg-bg-tertiary text-text-primary rounded-lg transition-colors flex items-center justify-between group text-xs font-medium border border-border-primary ease-out">
                <div className="flex items-center gap-2">
                  <Download size={14} />
                  <span>Download Model</span>
                </div>
                <ChevronRight
                  size={14}
                  className="group-hover:translate-x-1 transition-transform ease-out"
                />
              </button>

              <button className="w-full px-5 py-4 bg-bg-secondary hover:bg-bg-tertiary text-text-primary rounded-lg transition-colors flex items-center justify-between group text-xs font-medium border border-border-primary ease-out">
                <div className="flex items-center gap-2">
                  <Code size={14} />
                  <span>View in Editor</span>
                </div>
                <ChevronRight
                  size={14}
                  className="group-hover:translate-x-1 transition-transform ease-out"
                />
              </button>

              <button className="w-full px-5 py-4 bg-bg-secondary hover:bg-bg-tertiary text-text-primary rounded-lg transition-colors flex items-center justify-between group text-xs font-medium border border-border-primary ease-out">
                <div className="flex items-center gap-2">
                  <Share2 size={14} />
                  <span>Share Asset</span>
                </div>
                <ChevronRight
                  size={14}
                  className="group-hover:translate-x-1 transition-transform ease-out"
                />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssetDetailsPanel;
