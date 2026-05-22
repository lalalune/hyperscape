import {
  Layers,
  Package,
  Paintbrush,
  Crown,
  FlaskConical,
  ChevronRight,
} from "lucide-react";
import React, { useState, useCallback, useRef, useEffect } from "react";

import { ArmorPreviewTab } from "@/components/ArmorPipeline/ArmorPreviewTab";
import { ShellGeneratorTab } from "@/components/ArmorPipeline/ShellGeneratorTab";
import { TextureGeneratorTab } from "@/components/ArmorPipeline/TextureGeneratorTab";
import { TierGeneratorTab } from "@/components/ArmorPipeline/TierGeneratorTab";
import { TripoGeneratorTab } from "@/components/ArmorPipeline/TripoGeneratorTab";
import { ShellExtractionService } from "@/services/armor-pipeline/ShellExtractionService";
import type {
  ShellMesh,
  ShellExtractionResult,
  ShellExtractionProgress,
} from "@/services/armor-pipeline/types";
import { ALL_SLOTS, ALL_BULKS } from "@/services/armor-pipeline/constants";

/** A textured armor piece ready for rigging */
export interface ArmorKitPiece {
  shell: ShellMesh;
  texturedUrl: string;
}

type PipelineTab = "shells" | "textures" | "tiers" | "preview" | "tripo";

interface TabDef {
  id: PipelineTab;
  label: string;
  icon: typeof Layers;
  description: string;
  group: "pipeline" | "experimental";
}

const TABS: TabDef[] = [
  {
    id: "shells",
    label: "Extract",
    icon: Layers,
    description: "Extract body-fitting shells from VRM avatars",
    group: "pipeline",
  },
  {
    id: "textures",
    label: "Texture",
    icon: Paintbrush,
    description: "Apply materials and AI textures to armor shells",
    group: "pipeline",
  },
  {
    id: "tiers",
    label: "Tiers",
    icon: Crown,
    description: "Batch-generate bronze → dragon tier variants",
    group: "pipeline",
  },
  {
    id: "preview",
    label: "Rig & Preview",
    icon: Package,
    description: "Re-rig textured armor and preview on animated avatar",
    group: "pipeline",
  },
  {
    id: "tripo",
    label: "Tripo Lab",
    icon: FlaskConical,
    description: "Experimental: Tripo AI texturing & 3D attachments",
    group: "experimental",
  },
];

export const ArmorPipelinePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PipelineTab>("shells");

  // ── Shared extraction cache ──────────────────────────────────────────
  // Single extraction result shared across Shell, Texture, and Tier tabs.
  // Avoids re-extracting the same avatar multiple times.
  const [sharedExtraction, setSharedExtraction] =
    useState<ShellExtractionResult | null>(null);
  const [sharedExtractionAvatar, setSharedExtractionAvatar] = useState<
    string | null
  >(null);
  const shellServiceRef = useRef<ShellExtractionService | null>(null);

  const getShellService = useCallback(() => {
    if (!shellServiceRef.current)
      shellServiceRef.current = new ShellExtractionService();
    return shellServiceRef.current;
  }, []);

  /** Shared extraction — any tab can call this. Returns cached if same avatar. */
  const handleExtract = useCallback(
    async (
      avatarUrl: string,
      onProgress?: (p: ShellExtractionProgress) => void,
      customOffsetM?: number,
    ): Promise<ShellExtractionResult> => {
      // Return cached if same avatar AND same custom offset (or no custom)
      const cachedHasCustom =
        sharedExtraction?.shells.has("body_custom") ?? false;
      const wantsCustom = customOffsetM != null && customOffsetM > 0;
      if (
        sharedExtraction &&
        sharedExtractionAvatar === avatarUrl &&
        sharedExtraction.avatarHeight > 0 &&
        (!wantsCustom || cachedHasCustom)
      ) {
        onProgress?.({
          stage: "complete",
          progress: 1,
          message: "Using cached shell extraction.",
        });
        return sharedExtraction;
      }

      const service = getShellService();
      const result = await service.extractShells(
        avatarUrl,
        ALL_SLOTS,
        ALL_BULKS,
        onProgress,
        customOffsetM,
      );

      setSharedExtraction(result);
      setSharedExtractionAvatar(avatarUrl);
      return result;
    },
    [sharedExtraction, sharedExtractionAvatar, getShellService],
  );

  // ── Armor kit ────────────────────────────────────────────────────────
  const [armorKit, setArmorKit] = useState<Map<string, ArmorKitPiece>>(
    new Map(),
  );
  const armorKitRef = useRef(armorKit);
  armorKitRef.current = armorKit;

  const handleAddToKit = useCallback(
    (shell: ShellMesh, texturedGlbUrl: string) => {
      const key = `${shell.slotName}_${shell.bulkClass}`;
      setArmorKit((prev) => {
        const next = new Map(prev);
        // Revoke old blob URL if replacing an existing piece
        const existing = prev.get(key);
        if (existing?.texturedUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(existing.texturedUrl);
        }
        next.set(key, { shell, texturedUrl: texturedGlbUrl });
        return next;
      });
      setActiveTab("preview");
    },
    [],
  );

  // Cleanup blob URLs on unmount — use ref to avoid stale closure
  useEffect(() => {
    return () => {
      armorKitRef.current.forEach((piece) => {
        if (piece.texturedUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(piece.texturedUrl);
        }
      });
    };
  }, []);

  const kitCount = armorKit.size;
  const pipelineTabs = TABS.filter((t) => t.group === "pipeline");
  const experimentalTabs = TABS.filter((t) => t.group === "experimental");

  return (
    <div className="flex flex-col h-[calc(100vh-44px)]">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-bg-secondary border-b border-border-primary">
        {/* Pipeline tabs with step flow */}
        {pipelineTabs.map((tab, i) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const stepNum = i + 1;
          return (
            <React.Fragment key={tab.id}>
              {i > 0 && (
                <ChevronRight
                  size={14}
                  className="text-text-tertiary/30 mx-0.5 flex-shrink-0"
                />
              )}
              <button
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-5 py-4 rounded-md text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary/15 text-primary border border-primary/25"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border border-transparent"
                } ease-out`}
                title={tab.description}
              >
                <span
                  className={`w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${
                    isActive
                      ? "bg-primary/20 text-primary"
                      : "bg-bg-tertiary text-text-tertiary"
                  }`}
                >
                  {stepNum}
                </span>
                <Icon size={16} />
                {tab.label}
                {tab.id === "preview" && kitCount > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 text-[10px] rounded-full bg-primary/20 text-primary">
                    {kitCount}
                  </span>
                )}
              </button>
            </React.Fragment>
          );
        })}

        {/* Separator */}
        <div className="w-px h-6 bg-border-primary mx-1" />

        {/* Experimental tabs */}
        {experimentalTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-4 rounded-md text-sm font-medium transition-all ${
                isActive
                  ? "bg-warning/15 text-warning border border-warning/25"
                  : "text-text-tertiary hover:text-warning/80 hover:bg-bg-tertiary border border-transparent"
              } ease-out`}
              title={tab.description}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-3 text-xs text-text-tertiary px-3">
          {sharedExtraction && (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              {sharedExtraction.shells.size} shells cached
            </span>
          )}
          {kitCount > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              {kitCount} in kit
            </span>
          )}
          {!sharedExtraction && kitCount === 0 && <span>Armor Pipeline</span>}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "shells" && (
          <ShellGeneratorTab
            sharedExtraction={sharedExtraction}
            onExtract={handleExtract}
          />
        )}
        {activeTab === "textures" && (
          <TextureGeneratorTab
            onAddToKit={handleAddToKit}
            sharedExtraction={sharedExtraction}
            onExtract={handleExtract}
          />
        )}
        {activeTab === "tiers" && (
          <TierGeneratorTab
            onAddToKit={handleAddToKit}
            sharedExtraction={sharedExtraction}
            onExtract={handleExtract}
          />
        )}
        {activeTab === "preview" && <ArmorPreviewTab armorKit={armorKit} />}
        {activeTab === "tripo" && (
          <TripoGeneratorTab onAddToKit={handleAddToKit} />
        )}
      </div>
    </div>
  );
};
