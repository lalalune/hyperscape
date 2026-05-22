import {
  Sparkles,
  Box,
  Grid3x3,
  FileText,
  Brain,
  Camera,
  Layers,
  Loader2,
  User,
} from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";

import { useGenerationStore } from "../store";
import type { PipelineStage } from "../store";
import { MaterialPreset } from "../types";
import { getAssetModelUrl, getAssetConceptArtUrl } from "../utils/api";
import { buildGenerationConfig } from "../utils/generationConfigBuilder";
import { notify } from "../utils/notify";
import { spriteGeneratorClient } from "../utils/sprite-generator-client";

// Import all Generation components from single location
import {
  AssetDetailsCard,
  PipelineOptionsCard,
  AdvancedPromptsCard,
  MaterialVariantsCard,
  AvatarRiggingOptionsCard,
  GenerationTypeSelector,
  TabNavigation,
  GeneratedAssetsList,
  AssetPreviewCard,
  MaterialVariantsDisplay,
  SpritesDisplay,
  PipelineProgressCard,
  EditMaterialPresetModal,
  DeleteConfirmationModal,
  GenerationTimeline,
  AssetActionsCard,
  NoAssetSelected,
  ReferenceImageCard,
} from "@/components/Generation";
import {
  useGameStylePrompts,
  useAssetTypePrompts,
  useMaterialPromptTemplates,
} from "@/hooks";
import { usePipelineStatus } from "@/hooks";
import { useMaterialPresets } from "@/hooks";
import { Asset, AssetService } from "@/services/api/AssetService";
import { GenerationAPIClient } from "@/services/api/GenerationAPIClient";
import { GenerationPackTargetBanner } from "@/components/GenerationPackTargetBanner";

export const GenerationPage: React.FC = () => {
  const [apiClient] = useState(() => new GenerationAPIClient());

  // Get all state and actions from the store
  const {
    // UI State
    generationType,
    activeView,
    showAdvancedPrompts,
    showAssetTypeEditor,
    editMaterialPrompts,
    showDeleteConfirm,

    // Material State
    materialPresets,
    isLoadingMaterials,
    editingPreset,

    // Form State
    assetName,
    assetType,
    description,
    gameStyle,
    customStyle,

    // Custom Prompts
    customGamePrompt,
    customAssetTypePrompt,

    // Asset Type Management
    customAssetTypes,
    assetTypePrompts,

    // Pipeline Configuration
    useGPT5Enhancement,
    enableRetexturing,
    enableSprites,
    quality,

    // Avatar Configuration
    enableRigging,
    characterHeight,

    // Reference image state
    referenceImageMode,
    referenceImageSource,
    referenceImageUrl,
    referenceImageDataUrl,

    // Material Configuration
    selectedMaterials,
    customMaterials,
    materialPromptOverrides,

    // Pipeline State
    isGenerating,
    isGeneratingSprites,
    pipelineStages,

    // Results State
    generatedAssets,
    selectedAsset,

    // Actions
    setGenerationType,
    setActiveView,
    setShowAdvancedPrompts,
    setShowAssetTypeEditor,
    setEditMaterialPrompts,
    setShowDeleteConfirm,
    setMaterialPresets,
    setIsLoadingMaterials,
    setEditingPreset,
    setAssetName,
    setAssetType,
    setDescription,
    setGameStyle,
    setCustomStyle,
    setCustomGamePrompt,
    setCustomAssetTypePrompt,
    setCustomAssetTypes,
    setAssetTypePrompts,
    addCustomAssetType,
    setUseGPT5Enhancement,
    setEnableRetexturing,
    setEnableSprites,
    setQuality,
    setEnableRigging,
    setCharacterHeight,
    setReferenceImageMode,
    setReferenceImageSource,
    setReferenceImageUrl,
    setReferenceImageDataUrl,
    setSelectedMaterials,
    setCustomMaterials,
    setMaterialPromptOverrides,
    addCustomMaterial,
    toggleMaterialSelection,
    setIsGenerating,
    setCurrentPipelineId,
    setIsGeneratingSprites,
    setModelLoadError,
    setIsModelLoading,
    setPipelineStages,
    setGeneratedAssets,
    setSelectedAsset,
    resetForm,
    resetPipeline,
    initializePipelineStages,
  } = useGenerationStore();

  // Load prompts
  const {
    prompts: gameStylePrompts,
    loading: gameStyleLoading,
    saveCustomGameStyle,
    deleteCustomGameStyle,
  } = useGameStylePrompts();
  const {
    prompts: loadedAssetTypePrompts,
    loading: _assetTypeLoading,
    saveCustomAssetType,
    deleteCustomAssetType,
    // getAllTypes,
    getTypesByGeneration,
  } = useAssetTypePrompts();
  const { templates: materialPromptTemplates } = useMaterialPromptTemplates();

  // Get custom game styles
  const customGameStyles = useMemo(() => {
    if (!gameStylePrompts) return {};
    return gameStylePrompts.custom || {};
  }, [gameStylePrompts]);

  // Get asset types for the current generation type
  const currentGenerationTypes = useMemo(() => {
    if (!loadedAssetTypePrompts || !generationType) return {};
    return getTypesByGeneration(generationType);
  }, [loadedAssetTypePrompts, generationType, getTypesByGeneration]);

  // Convert current generation types to the format expected by AdvancedPromptsCard
  const currentTypePrompts = useMemo(() => {
    return Object.entries(currentGenerationTypes).reduce(
      (acc, [key, value]) => ({
        ...acc,
        [key]: value.prompt || "",
      }),
      {},
    );
  }, [currentGenerationTypes]);

  // Get current style prompt
  const currentStylePrompt = useMemo(() => {
    if (!gameStylePrompts) return "";
    if (gameStyle === "runescape") {
      return gameStylePrompts.default?.runescape?.base || "";
    } else if (
      gameStyle === "custom" &&
      customStyle &&
      gameStylePrompts.custom?.[customStyle]
    ) {
      return gameStylePrompts.custom[customStyle].base || "";
    }
    return gameStylePrompts.default?.generic?.base || "";
  }, [gameStyle, customStyle, gameStylePrompts]);

  // Get all saved custom types for the current generation type
  const allCustomAssetTypes = useMemo(() => {
    if (!generationType) return [];

    // Define default types for each generation type
    const defaultTypes =
      generationType === "avatar"
        ? ["character", "humanoid", "npc", "creature"]
        : ["weapon", "armor", "tool", "building", "consumable", "resource"];

    // Get saved custom types for current generation type
    const savedCustomTypes = Object.entries(currentGenerationTypes)
      .filter(([key]) => !defaultTypes.includes(key))
      .map(([key, value]) => ({
        name: value.name || key,
        prompt: value.prompt || "",
      }));

    // Add temporary custom types that aren't saved yet
    const tempTypes = customAssetTypes.filter(
      (t) =>
        t.name &&
        !savedCustomTypes.some(
          (saved) => saved.name.toLowerCase() === t.name.toLowerCase(),
        ),
    );

    return [...savedCustomTypes, ...tempTypes];
  }, [currentGenerationTypes, customAssetTypes, generationType]);

  // Load prompts on mount and update store
  useEffect(() => {
    if (!gameStyleLoading && gameStylePrompts) {
      // Set default game prompt from loaded prompts if not already set
      const defaultPrompt =
        gameStylePrompts.default?.generic?.base ||
        "low-poly 3D game asset style";
      if (!customGamePrompt) {
        setCustomGamePrompt(defaultPrompt);
      }
    }
  }, [
    gameStyleLoading,
    gameStylePrompts,
    customGamePrompt,
    setCustomGamePrompt,
  ]);

  // Apply game style specific prompts when game style changes
  useEffect(() => {
    if (!gameStyleLoading && gameStylePrompts && gameStyle) {
      if (gameStyle === "runescape") {
        const runescapePrompt = gameStylePrompts.default?.runescape?.base;
        if (runescapePrompt) {
          setCustomGamePrompt(runescapePrompt);
        }
      } else if (
        gameStyle === "custom" &&
        customStyle &&
        gameStylePrompts.custom?.[customStyle]
      ) {
        const customStylePrompt = gameStylePrompts.custom[customStyle].base;
        if (customStylePrompt) {
          setCustomGamePrompt(customStylePrompt);
        }
      }
    }
  }, [
    gameStyle,
    customStyle,
    gameStyleLoading,
    gameStylePrompts,
    setCustomGamePrompt,
  ]);

  // Set asset type based on generation type
  useEffect(() => {
    if (generationType === "avatar") {
      setAssetType("character");
    } else if (generationType === "item") {
      setAssetType("weapon");
    }
  }, [generationType, setAssetType]);

  // Update pipeline stages based on configuration and generation type
  useEffect(() => {
    // Initialize pipeline stages
    initializePipelineStages();
  }, [
    generationType,
    useGPT5Enhancement,
    enableRetexturing,
    enableSprites,
    enableRigging,
    initializePipelineStages,
  ]);

  // Add icons to stages after they're initialized (without creating an update loop)
  useEffect(() => {
    if (pipelineStages.length === 0) return;

    // Only set icons if any stage is missing one
    const missingIcons = pipelineStages.some((stage) => !stage.icon);
    if (!missingIcons) return;

    const iconFor = (id: string) =>
      id === "text-input" ? (
        <FileText className="w-4 h-4" />
      ) : id === "gpt4-enhancement" ? (
        <Brain className="w-4 h-4" />
      ) : id === "image-generation" ? (
        <Camera className="w-4 h-4" />
      ) : id === "image-to-3d" ? (
        <Box className="w-4 h-4" />
      ) : id === "rigging" ? (
        <User className="w-4 h-4" />
      ) : id === "retexturing" ? (
        <Layers className="w-4 h-4" />
      ) : id === "sprites" ? (
        <Grid3x3 className="w-4 h-4" />
      ) : (
        <Sparkles className="w-4 h-4" />
      );

    const stagesWithIcons = pipelineStages.map((stage) => ({
      ...stage,
      icon: stage.icon ?? iconFor(stage.id),
    }));

    setPipelineStages(stagesWithIcons);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineStages.length]);

  // Handle model loading state when selected asset changes
  useEffect(() => {
    if (selectedAsset?.modelUrl || selectedAsset?.hasModel) {
      setIsModelLoading(false); // Don't show loading state, let ThreeViewer handle it
      setModelLoadError(null);
    }
  }, [selectedAsset, setIsModelLoading, setModelLoadError]);

  // Load material presets from API (run once), and default selections once
  useEffect(() => {
    let didCancel = false;
    const loadMaterialPresets = async () => {
      try {
        setIsLoadingMaterials(true);
        const data = await AssetService.getMaterialPresets();
        if (!Array.isArray(data)) {
          throw new Error("Material presets data is not an array");
        }
        if (didCancel) return;
        setMaterialPresets(data);

        // Set defaults only if nothing selected yet
        if (selectedMaterials.length === 0) {
          const defaults = ["bronze", "steel", "mithril"];
          const available = defaults.filter((id) =>
            data.some((p: MaterialPreset) => p.id === id),
          );
          setSelectedMaterials(available);
        }
      } catch (error) {
        console.error(
          "[MaterialPresets] Failed to load material presets:",
          error,
        );
      } finally {
        if (!didCancel) setIsLoadingMaterials(false);
      }
    };
    loadMaterialPresets();
    return () => {
      didCancel = true;
    };
    // Intentionally run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load existing assets when Results tab is accessed
  useEffect(() => {
    if (activeView === "results" && generatedAssets.length === 0) {
      const loadExistingAssets = async () => {
        try {
          const assets = await AssetService.listAssets();

          // Transform API assets to match the expected format
          const transformedAssets = assets.map((asset: Asset) => ({
            id: asset.id,
            name: asset.name,
            description: asset.description,
            type: asset.type,
            status: "completed",
            hasModel: asset.hasModel,
            modelUrl: asset.hasModel ? getAssetModelUrl(asset.id) : undefined,
            conceptArtUrl: getAssetConceptArtUrl(asset.id),
            variants: Array.isArray((asset as any).metadata?.variants)
              ? ((asset.metadata as any).variants as {
                  name: string;
                  modelUrl: string;
                }[])
              : undefined,
            metadata: asset.metadata || {},
            createdAt:
              asset.generatedAt ||
              asset.metadata?.generatedAt ||
              new Date().toISOString(),
            generatedAt:
              asset.generatedAt ||
              asset.metadata?.generatedAt ||
              new Date().toISOString(),
          }));

          setGeneratedAssets(transformedAssets);

          // Select the first asset if none selected
          if (transformedAssets.length > 0 && !selectedAsset) {
            setSelectedAsset(transformedAssets[0]);
          }
        } catch (error) {
          console.error("Failed to load existing assets:", error);
        }
      };

      loadExistingAssets();
    }
  }, [
    activeView,
    generatedAssets,
    selectedAsset,
    setGeneratedAssets,
    setSelectedAsset,
  ]);

  // Use the pipeline status hook
  usePipelineStatus({ apiClient });

  // Use the material presets hook
  const { handleSaveCustomMaterials, handleUpdatePreset, handleDeletePreset } =
    useMaterialPresets();

  // Handle saving custom asset types
  const handleSaveCustomAssetTypes = async () => {
    if (!generationType) {
      notify.warning("Please select a generation type first");
      return;
    }

    try {
      // Save each custom asset type
      const savePromises = customAssetTypes
        .filter((customType) => customType.name && customType.prompt)
        .map((customType) => {
          const typeId = customType.name.toLowerCase().replace(/\s+/g, "-");
          return saveCustomAssetType(
            typeId,
            {
              name: customType.name,
              prompt: customType.prompt,
              placeholder: customType.prompt,
            },
            generationType,
          );
        });

      // Wait for all saves to complete
      await Promise.all(savePromises);

      // Clear only the temporary custom types after successful save
      setCustomAssetTypes([]);

      // The saved types will automatically appear via allCustomAssetTypes
      notify.success("Custom asset types saved successfully!");
    } catch (error) {
      console.error("Failed to save custom asset types:", error);
      notify.error("Failed to save custom asset types.");
    }
  };

  const handleGenerateSprites = async (assetId: string) => {
    try {
      setIsGeneratingSprites(true);

      const sprites = await spriteGeneratorClient.generateSpritesForAsset(
        assetId,
        {
          angles: 8,
          resolution: 256,
          backgroundColor: "transparent",
        },
      );

      // Update the generated assets with the new sprite URLs
      const updatedAssets = generatedAssets.map((asset) =>
        asset.id === assetId ? { ...asset, sprites, hasSprites: true } : asset,
      );
      setGeneratedAssets(updatedAssets);

      if (selectedAsset?.id === assetId) {
        setSelectedAsset({ ...selectedAsset, sprites, hasSprites: true });
      }
    } catch (error) {
      console.error("Failed to generate sprites:", error);
      notify.error(
        "Failed to generate sprites. Please check the console for details.",
      );
    } finally {
      setIsGeneratingSprites(false);
    }
  };

  const handleStartGeneration = async () => {
    if (!assetName || !description) {
      notify.warning("Please fill in all required fields");
      return;
    }

    setIsGenerating(true);
    setActiveView("progress");
    const updatedPipelineStages = pipelineStages.map((stage) => ({
      ...stage,
      status: (stage.id === "text-input"
        ? "active"
        : stage.id === "gpt5-enhancement" && !useGPT5Enhancement
          ? "skipped"
          : stage.id === "retexturing" && !enableRetexturing
            ? "skipped"
            : stage.id === "sprites" && !enableSprites
              ? "skipped"
              : "idle") as PipelineStage["status"],
    }));
    setPipelineStages(updatedPipelineStages);

    // Get the appropriate asset type prompt
    const currentAssetTypePrompt =
      customAssetTypePrompt ||
      assetTypePrompts[assetType] ||
      customAssetTypes.find((t) => t.name.toLowerCase() === assetType)
        ?.prompt ||
      "";

    // Get the game style configuration
    const gameStyleConfig =
      gameStyle === "runescape"
        ? gameStylePrompts?.default?.runescape
        : gameStyle === "custom" && customStyle
          ? gameStylePrompts?.custom?.[customStyle] ||
            gameStylePrompts?.default?.generic
          : gameStylePrompts?.default?.generic;

    const config = buildGenerationConfig({
      assetName,
      assetType,
      description,
      generationType,
      gameStyle,
      customStyle,
      customGamePrompt: customGamePrompt || gameStyleConfig?.base,
      customAssetTypePrompt: currentAssetTypePrompt,
      useGPT5Enhancement,
      enableRetexturing,
      enableSprites,
      enableRigging,
      characterHeight,
      selectedMaterials,
      materialPresets,
      materialPromptOverrides,
      materialPromptTemplates: materialPromptTemplates.templates,
      gameStyleConfig,
      quality,
    });

    // Attach reference image into config when selected
    console.log("[Frontend Debug] Reference image state:", {
      mode: referenceImageMode,
      source: referenceImageSource,
      hasUrl: !!referenceImageUrl,
      hasDataUrl: !!referenceImageDataUrl,
      urlLength: referenceImageUrl?.length,
      dataUrlLength: referenceImageDataUrl?.length,
    });

    if (referenceImageMode === "custom") {
      const imgUrl =
        referenceImageSource === "url" && referenceImageUrl
          ? referenceImageUrl
          : null;
      const dataUrl =
        referenceImageSource === "upload" && referenceImageDataUrl
          ? referenceImageDataUrl
          : null;
      if (imgUrl || dataUrl) {
        (config as any).referenceImage = {
          source: dataUrl ? "data" : "url",
          url: imgUrl || undefined,
          dataUrl: dataUrl || undefined,
        };
        console.log(
          "[Frontend Debug] Attached reference image to config:",
          (config as any).referenceImage,
        );
      }
    }

    console.log("Starting generation with config:", config);
    console.log("Material variants to generate:", config.materialPresets);

    try {
      const pipelineId = await apiClient.startPipeline(config);
      setCurrentPipelineId(pipelineId);
    } catch (error) {
      console.error("Failed to start generation:", error);
      setIsGenerating(false);
      notify.error("Failed to start generation. Please check the console.");
    }
  };

  React.useEffect(() => {
    // Enable smooth scrolling on the body with hidden scrollbar
    const ensureScrollable = () => {
      document.body.style.overflow = "auto";
      document.documentElement.style.overflow = "auto";
      document.body.classList.add("hide-scrollbar");
      document.documentElement.classList.add("hide-scrollbar");
    };

    // Initial setup
    ensureScrollable();

    // Re-apply on any click to ensure scrolling isn't lost
    const handleClick = () => {
      // Small delay to ensure any other handlers have run first
      setTimeout(ensureScrollable, 0);
    };

    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      document.body.classList.remove("hide-scrollbar");
      document.documentElement.classList.remove("hide-scrollbar");
    };
  }, []);

  // Show generation type selector first
  if (!generationType) {
    return (
      <div className="min-h-full">
        <GenerationTypeSelector onSelectType={setGenerationType} />
      </div>
    );
  }

  return (
    <div className="relative min-h-full bg-bg-primary overflow-y-auto">
      {/* Subtle atmospheric backdrop — radial Graphite at the top */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px]"
        style={{
          background:
            "radial-gradient(ellipse 100% 100% at 50% 0%, rgba(28,30,34,0.7) 0%, transparent 75%)",
        }}
      />
      {/* Forge Gold horizon at hero baseline */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[320px] h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 5%, rgba(212,175,55,0.18) 50%, transparent 95%)",
          animation: "celestial-pulse 8s ease-in-out infinite",
        }}
      />

      {/* Pack-target banner — only renders when launched from the
          Asset Packs page with `?targetPack=…`. Sticks above content. */}
      <GenerationPackTargetBanner />

      {/* Main content */}
      <div className="relative">
        <div className="max-w-[1200px] mx-auto px-6 sm:px-8 lg:px-10 py-12 pb-24">
          {/* Cinematic editorial hero */}
          <header className="mb-12">
            {/* Eyebrow row: identity + status + pipeline switcher */}
            <div className="flex items-center gap-4 mb-7 flex-wrap">
              <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
                00 / Generation
              </span>
              <span className="text-text-tertiary/40">·</span>
              <span className="flex items-center gap-2 text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full bg-primary"
                  style={{
                    animation: "status-pulse 2.4s ease-in-out infinite",
                  }}
                />
                {isGenerating
                  ? "Running"
                  : generationType === "avatar"
                    ? "Avatar pipeline"
                    : "Item pipeline"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setGenerationType(undefined);
                  setActiveView("config");
                  resetForm();
                  resetPipeline();
                }}
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg-tertiary border border-border-primary hover:border-primary/40 text-[11px] text-text-secondary hover:text-primary uppercase tracking-[0.12em] transition-colors duration-300 ease-out"
                title="Switch pipeline"
              >
                ← Switch pipeline
              </button>
            </div>

            {/* Display hero: stacked verb-led title */}
            <h1 className="font-display text-5xl md:text-6xl font-medium text-text-primary tracking-tight leading-[1.02] mb-5">
              Forge an{" "}
              <span className="text-primary">
                {generationType === "avatar" ? "avatar" : "item"}
              </span>
            </h1>
            <p className="text-base text-text-tertiary leading-relaxed max-w-2xl mb-9">
              {generationType === "avatar"
                ? "Generate a humanoid character with mesh, texture, and rigging baked in. The pipeline runs end-to-end from prompt to game-ready asset."
                : "Generate a 3D item with mesh and texture in one pass. Optionally fork material variants and bake sprite renders for inventory UI."}
            </p>

            {/* Tab strip — below the hero, clean horizontal nav */}
            <div className="pt-6 border-t border-border-primary flex items-center justify-between gap-4 flex-wrap">
              <TabNavigation
                activeView={activeView}
                generatedAssetsCount={generatedAssets.length}
                onTabChange={setActiveView}
              />
              {isGenerating && (
                <span className="flex items-center gap-2 text-[11px] text-primary uppercase tracking-[0.12em]">
                  <Loader2
                    size={12}
                    strokeWidth={1.5}
                    className="animate-spin"
                  />
                  Pipeline running
                </span>
              )}
            </div>
          </header>
          {/* ====================================================
              CONFIGURE VIEW — vertical "studio station" composition:
              01 Brief → 02 Pipeline → 03 Reference → 04 Forge
              Each station gets full width to breathe. The Forge CTA
              is anchored at the bottom as the page's earned moment.
              ==================================================== */}
          {activeView === "config" && (
            <div className="animate-fade-in space-y-14">
              {/* ── 01 / BRIEF — what you're making ─────────────── */}
              <section className="space-y-6">
                <header className="flex items-baseline gap-3 pb-4 border-b border-border-primary">
                  <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
                    01
                  </span>
                  <h2 className="font-display text-base font-medium text-text-primary tracking-tight">
                    Brief
                  </h2>
                  <span className="text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
                    What you&apos;re making
                  </span>
                  {assetName && (
                    <span className="ml-auto text-[11px] text-text-tertiary uppercase tracking-[0.12em] font-mono normal-case tracking-normal truncate max-w-xs">
                      {assetName}
                    </span>
                  )}
                </header>

                {/* Asset Details Card */}
                <AssetDetailsCard
                  generationType={generationType}
                  assetName={assetName}
                  assetType={assetType}
                  description={description}
                  gameStyle={gameStyle}
                  customStyle={customStyle}
                  customAssetTypes={allCustomAssetTypes}
                  customGameStyles={customGameStyles}
                  onAssetNameChange={setAssetName}
                  onAssetTypeChange={setAssetType}
                  onDescriptionChange={setDescription}
                  onGameStyleChange={setGameStyle}
                  onCustomStyleChange={setCustomStyle}
                  onBack={() => {
                    setGenerationType(undefined);
                    setActiveView("config");
                    resetForm();
                    resetPipeline();
                  }}
                  onSaveCustomGameStyle={saveCustomGameStyle}
                />

                {/* Advanced Prompts Card */}
                <AdvancedPromptsCard
                  showAdvancedPrompts={showAdvancedPrompts}
                  showAssetTypeEditor={showAssetTypeEditor}
                  generationType={generationType}
                  gameStyle={gameStyle}
                  customStyle={customStyle}
                  customGamePrompt={customGamePrompt}
                  customAssetTypePrompt={customAssetTypePrompt}
                  assetTypePrompts={currentTypePrompts}
                  customAssetTypes={customAssetTypes}
                  currentStylePrompt={currentStylePrompt}
                  gameStylePrompts={gameStylePrompts}
                  loadedPrompts={{
                    avatar:
                      loadedAssetTypePrompts?.avatar?.default?.character
                        ?.placeholder,
                    item: loadedAssetTypePrompts?.item?.default?.weapon
                      ?.placeholder,
                  }}
                  onToggleAdvancedPrompts={() =>
                    setShowAdvancedPrompts(!showAdvancedPrompts)
                  }
                  onToggleAssetTypeEditor={() =>
                    setShowAssetTypeEditor(!showAssetTypeEditor)
                  }
                  onCustomGamePromptChange={setCustomGamePrompt}
                  onCustomAssetTypePromptChange={setCustomAssetTypePrompt}
                  onAssetTypePromptsChange={(updatedPrompts) => {
                    // Merge the updated prompts with the existing store prompts
                    setAssetTypePrompts({
                      ...assetTypePrompts,
                      ...updatedPrompts,
                    });
                  }}
                  onCustomAssetTypesChange={setCustomAssetTypes}
                  onAddCustomAssetType={addCustomAssetType}
                  onSaveCustomAssetTypes={handleSaveCustomAssetTypes}
                  onSaveCustomGameStyle={saveCustomGameStyle}
                  onDeleteCustomGameStyle={deleteCustomGameStyle}
                  onDeleteCustomAssetType={deleteCustomAssetType}
                />
              </section>

              {/* ── 02 / PIPELINE — how it's built ─────────────── */}
              <section className="space-y-6">
                <header className="flex items-baseline gap-3 pb-4 border-b border-border-primary">
                  <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
                    02
                  </span>
                  <h2 className="font-display text-base font-medium text-text-primary tracking-tight">
                    Pipeline
                  </h2>
                  <span className="text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
                    How it&apos;s built
                  </span>
                </header>

                {/* Pipeline + conditional siblings sit side-by-side
                    on wide screens so this station doesn't collapse
                    into a tall mono-column. */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  <div className="lg:col-span-2">
                    {/* Pipeline Options */}
                    <PipelineOptionsCard
                      generationType={generationType}
                      useGPT5Enhancement={useGPT5Enhancement}
                      enableRetexturing={enableRetexturing}
                      enableSprites={enableSprites}
                      enableRigging={enableRigging}
                      quality={quality}
                      onUseGPT5EnhancementChange={setUseGPT5Enhancement}
                      onEnableRetexturingChange={setEnableRetexturing}
                      onEnableSpritesChange={setEnableSprites}
                      onEnableRiggingChange={setEnableRigging}
                      onQualityChange={setQuality}
                    />
                  </div>

                  {/* Right column of station 02 — conditional sub-options */}
                  <div className="space-y-6">
                    {/* Material Variants */}
                    {enableRetexturing && generationType === "item" && (
                      <MaterialVariantsCard
                        gameStyle={gameStyle}
                        isLoadingMaterials={isLoadingMaterials}
                        materialPresets={materialPresets}
                        selectedMaterials={selectedMaterials}
                        customMaterials={customMaterials}
                        materialPromptOverrides={materialPromptOverrides}
                        editMaterialPrompts={editMaterialPrompts}
                        onToggleMaterialSelection={toggleMaterialSelection}
                        onEditMaterialPromptsToggle={() =>
                          setEditMaterialPrompts(!editMaterialPrompts)
                        }
                        onMaterialPromptOverride={(materialId, prompt) => {
                          setMaterialPromptOverrides({
                            ...materialPromptOverrides,
                            [materialId]: prompt,
                          });
                        }}
                        onAddCustomMaterial={addCustomMaterial}
                        onUpdateCustomMaterial={(index, material) => {
                          const updated = [...customMaterials];
                          updated[index] = material;
                          setCustomMaterials(updated);
                        }}
                        onRemoveCustomMaterial={(index) => {
                          setCustomMaterials(
                            customMaterials.filter((_, i) => i !== index),
                          );
                        }}
                        onSaveCustomMaterials={handleSaveCustomMaterials}
                        onEditPreset={setEditingPreset}
                        onDeletePreset={setShowDeleteConfirm}
                      />
                    )}

                    {/* Avatar Rigging Options */}
                    {generationType === "avatar" && enableRigging && (
                      <AvatarRiggingOptionsCard
                        characterHeight={characterHeight}
                        onCharacterHeightChange={setCharacterHeight}
                      />
                    )}
                  </div>
                </div>
              </section>

              {/* ── 03 / REFERENCE — optional style anchor ─────── */}
              <section className="space-y-6">
                <header className="flex items-baseline gap-3 pb-4 border-b border-border-primary">
                  <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
                    03
                  </span>
                  <h2 className="font-display text-base font-medium text-text-primary tracking-tight">
                    Reference
                  </h2>
                  <span className="text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
                    Optional style anchor
                  </span>
                </header>

                <ReferenceImageCard
                  generationType={generationType}
                  mode={referenceImageMode}
                  source={referenceImageSource}
                  url={referenceImageUrl}
                  dataUrl={referenceImageDataUrl}
                  onModeChange={setReferenceImageMode}
                  onSourceChange={setReferenceImageSource}
                  onUrlChange={setReferenceImageUrl}
                  onDataUrlChange={setReferenceImageDataUrl}
                />
              </section>

              {/* ── 04 / FORGE — clean editorial climax ─────────── */}
              <section className="space-y-6">
                <header className="flex items-baseline gap-3 pb-4 border-b border-border-primary">
                  <span className="font-mono text-[11px] text-primary tabular-nums tracking-[0.05em]">
                    04
                  </span>
                  <h2 className="font-display text-base font-medium text-text-primary tracking-tight">
                    Forge
                  </h2>
                  <span className="text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
                    Run the pipeline
                  </span>
                  {(!assetName || !description) && (
                    <span className="ml-auto text-[10px] text-warning uppercase tracking-[0.14em] font-medium">
                      {!assetName && !description
                        ? "Name + description needed"
                        : !assetName
                          ? "Name needed"
                          : "Description needed"}
                    </span>
                  )}
                </header>

                {/* Clean horizontal layout: intent line on the left,
                    Start button anchored right. No card chrome — the
                    section header is the editorial frame. */}
                <div className="flex items-end justify-between gap-8 flex-wrap">
                  <p className="text-sm text-text-tertiary leading-relaxed max-w-2xl flex-1 min-w-0">
                    {(() => {
                      const features: string[] = ["model + texture"];
                      if (useGPT5Enhancement)
                        features.unshift("GPT-5 prompt enhancement");
                      if (
                        generationType === "item" &&
                        enableRetexturing &&
                        selectedMaterials.length > 0
                      )
                        features.push(
                          `${selectedMaterials.length} material variant${selectedMaterials.length === 1 ? "" : "s"}`,
                        );
                      if (generationType === "item" && enableSprites)
                        features.push("sprite renders");
                      if (generationType === "avatar" && enableRigging)
                        features.push("auto-rigging");
                      const target =
                        generationType === "avatar"
                          ? assetType || "character"
                          : assetType || "item";
                      return `Pipeline will run on a ${target} with ${features.join(", ")}.`;
                    })()}
                  </p>
                  <button
                    type="button"
                    onClick={handleStartGeneration}
                    disabled={!assetName || !description || isGenerating}
                    className="btn-primary flex-shrink-0 px-7 py-3"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2
                          size={14}
                          strokeWidth={1.5}
                          className="animate-spin"
                        />
                        Generating…
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} strokeWidth={1.5} />
                        Start generation
                      </>
                    )}
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* ====================================================
              PROGRESS VIEW — pipeline running
              ==================================================== */}
          {activeView === "progress" && (
            <div className="animate-fade-in space-y-8">
              <section className="space-y-6">
                <header className="flex items-baseline gap-3 pb-4 border-b border-border-primary">
                  <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
                    01
                  </span>
                  <h2 className="font-display text-base font-medium text-text-primary tracking-tight">
                    Pipeline
                  </h2>
                  <span className="text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
                    {isGenerating ? "Running" : "Complete"}
                  </span>
                  {assetName && (
                    <span className="ml-auto text-[11px] text-text-tertiary uppercase tracking-[0.12em] font-mono normal-case tracking-normal">
                      {assetName}
                    </span>
                  )}
                </header>
                <PipelineProgressCard
                  pipelineStages={pipelineStages}
                  generationType={generationType}
                  isGenerating={isGenerating}
                  onBackToConfig={() => setActiveView("config")}
                  onBack={() => {
                    setGenerationType(undefined);
                    setActiveView("config");
                    resetForm();
                    resetPipeline();
                  }}
                />
              </section>

              <section className="space-y-6">
                <header className="flex items-baseline gap-3 pb-4 border-b border-border-primary">
                  <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
                    02
                  </span>
                  <h2 className="font-display text-base font-medium text-text-primary tracking-tight">
                    Timeline
                  </h2>
                  <span className="text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
                    Stage history
                  </span>
                </header>
                <GenerationTimeline />
              </section>
            </div>
          )}

          {/* ====================================================
              RESULTS VIEW — forged assets + selected preview
              ==================================================== */}
          {activeView === "results" && (
            <div className="animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                {/* ── 01 / LIBRARY — list of forged assets ──────── */}
                <section className="space-y-5">
                  <header className="flex items-baseline gap-3 pb-4 border-b border-border-primary">
                    <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
                      01
                    </span>
                    <h2 className="font-display text-base font-medium text-text-primary tracking-tight">
                      Library
                    </h2>
                    <span className="ml-auto text-[11px] text-text-tertiary uppercase tracking-[0.12em] font-mono normal-case tracking-normal tabular-nums">
                      {generatedAssets.length}
                    </span>
                  </header>
                  <GeneratedAssetsList
                    generatedAssets={generatedAssets}
                    selectedAsset={selectedAsset}
                    onAssetSelect={setSelectedAsset}
                    onBack={() => {
                      setGenerationType(undefined);
                      setActiveView("config");
                      resetForm();
                      resetPipeline();
                    }}
                  />
                </section>

                {/* ── 02 / DETAIL — preview + variants + actions ── */}
                <section className="lg:col-span-3 space-y-6">
                  <header className="flex items-baseline gap-3 pb-4 border-b border-border-primary">
                    <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
                      02
                    </span>
                    <h2 className="font-display text-base font-medium text-text-primary tracking-tight">
                      {selectedAsset?.name ? "Preview" : "Pick an asset"}
                    </h2>
                    {selectedAsset?.name && (
                      <span className="text-[11px] text-text-tertiary uppercase tracking-[0.12em] font-mono normal-case tracking-normal truncate">
                        {selectedAsset.name}
                      </span>
                    )}
                  </header>
                  {selectedAsset ? (
                    <>
                      <AssetPreviewCard
                        selectedAsset={selectedAsset}
                        generationType={generationType}
                      />

                      {generationType === "item" &&
                        (selectedAsset.variants || true) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {selectedAsset.variants && (
                              <MaterialVariantsDisplay
                                variants={selectedAsset.variants}
                              />
                            )}
                            <SpritesDisplay
                              selectedAsset={selectedAsset}
                              isGeneratingSprites={isGeneratingSprites}
                              onGenerateSprites={handleGenerateSprites}
                            />
                          </div>
                        )}

                      <AssetActionsCard
                        onGenerateNew={() => {
                          setActiveView("config");
                          setAssetName("");
                          setDescription("");
                        }}
                      />
                    </>
                  ) : (
                    <NoAssetSelected />
                  )}
                </section>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Material Preset Modal */}
      {editingPreset && (
        <EditMaterialPresetModal
          editingPreset={editingPreset}
          onClose={() => setEditingPreset(null)}
          onSave={handleUpdatePreset}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <DeleteConfirmationModal
          showDeleteConfirm={showDeleteConfirm}
          materialPresets={materialPresets}
          onClose={() => setShowDeleteConfirm(null)}
          onConfirm={handleDeletePreset}
        />
      )}
    </div>
  );
};

export default GenerationPage;
