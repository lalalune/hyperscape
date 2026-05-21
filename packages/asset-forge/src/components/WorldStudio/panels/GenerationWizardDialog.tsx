/**
 * GenerationWizardDialog — 3-stage world generation wizard
 *
 * Stages: Towns → Roads & Zones → Population
 * Each stage independently generates and previews content with 3D viewport
 * ghost overlays. Re-roll per stage with cascading invalidation.
 */

import {
  X,
  Wand2,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Check,
  AlertTriangle,
} from "lucide-react";
import React, { useState, useCallback, useReducer, useRef } from "react";

import type { AutoGenConfig, AutoGenResult } from "../types";
import {
  useZoneAutoGen,
  DEFAULT_AUTOGEN_CONFIG,
  mergeStageResults,
  type TownStageResult,
  type RoadZoneStageResult,
  type PopulationStageResult,
} from "../hooks/useZoneAutoGen";
import { useWorldStudio, type WizardPreviewData } from "../WorldStudioContext";
import {
  machineReducer,
  createInitialMachineState,
  WIZARD_STEPS,
} from "../utils/generationStateMachine";

import { StepBar } from "./wizard/WizardStepBar";
import {
  GeneratingView,
  ErrorView,
  CompleteView,
} from "./wizard/WizardStatusViews";
import { StagePlaceholder } from "./wizard/WizardSharedUI";
import { TownStageConfig } from "./wizard/stages/TownStageConfig";
import { RoadZoneStageConfig } from "./wizard/stages/RoadZoneStageConfig";
import { PopulationStageConfig } from "./wizard/stages/PopulationStageConfig";
import { TownPreview } from "./wizard/stages/TownPreview";
import { RoadZonePreview } from "./wizard/stages/RoadZonePreview";
import { PopulationPreview } from "./wizard/stages/PopulationPreview";

// ============== TYPES ==============

export type WizardMode = "full" | "zones-only" | "population-only";

interface GenerationWizardDialogProps {
  open: boolean;
  onClose: () => void;
  mode: WizardMode;
}

// ============== COMPONENT ==============

export function GenerationWizardDialog({
  open,
  onClose,
  mode,
}: GenerationWizardDialogProps) {
  const {
    generateTownStage,
    generateRoadZoneStage,
    generatePopulationStage,
    apply,
  } = useZoneAutoGen();
  const { state: studioState, actions } = useWorldStudio();
  const manifestsLoaded = studioState.manifests.loaded;
  const [machine, dispatch] = useReducer(
    machineReducer,
    createInitialMachineState(),
  );
  const [config, setConfig] = useState<AutoGenConfig>({
    ...DEFAULT_AUTOGEN_CONFIG,
  });

  // Per-stage config overrides
  const [townCount, setTownCount] = useState(4);
  const [minTownSpacing, setMinTownSpacing] = useState(400);
  const [townSeed, setTownSeed] = useState(DEFAULT_AUTOGEN_CONFIG.seed);
  const [rzSeed, setRzSeed] = useState(DEFAULT_AUTOGEN_CONFIG.seed);

  // Stage results stored locally (also mirrored in machine.stageResults)
  const stageResultsRef = useRef<{
    towns?: TownStageResult;
    roadsZones?: RoadZoneStageResult;
    population?: PopulationStageResult;
  }>({});

  // Read world town config defaults on open
  React.useEffect(() => {
    if (open) {
      dispatch({ type: "RESET" });
      dispatch({ type: "START_CONFIGURE" });
      stageResultsRef.current = {};

      // Initialize from world config if available
      const world = studioState.builder.editing.world;
      if (world?.foundation.config.towns) {
        setTownCount(world.foundation.config.towns.townCount);
        setMinTownSpacing(world.foundation.config.towns.minTownSpacing);
      }
      const seed = world?.foundation.config.seed ?? DEFAULT_AUTOGEN_CONFIG.seed;
      setTownSeed(seed);
      setRzSeed(seed);
      setConfig({ ...DEFAULT_AUTOGEN_CONFIG, seed });

      // For zones-only / population-only, pre-fill town result from existing towns
      if (mode === "zones-only" || mode === "population-only") {
        // Skip to step 1 for zones-only, step 2 for population-only
        // Pre-fill towns from existing foundation
        const existingTownResult = generateTownStage(
          { ...DEFAULT_AUTOGEN_CONFIG, seed },
          { seed },
        );
        if (existingTownResult) {
          stageResultsRef.current.towns = existingTownResult;
          dispatch({
            type: "SET_STAGE_RESULT",
            stepIndex: 0,
            result: existingTownResult,
          });
          // Mark step 0 as complete and jump
          dispatch({ type: "GENERATION_COMPLETE" });
          if (mode === "zones-only") {
            dispatch({ type: "NEXT_STEP" });
          } else {
            // population-only: also need road/zone result
            const rzResult = generateRoadZoneStage(
              { ...DEFAULT_AUTOGEN_CONFIG, seed },
              existingTownResult,
            );
            if (rzResult) {
              stageResultsRef.current.roadsZones = rzResult;
              dispatch({
                type: "SET_STAGE_RESULT",
                stepIndex: 1,
                result: rzResult,
              });
            }
            dispatch({ type: "NEXT_STEP" }); // to step 1
            dispatch({ type: "START_GENERATE" });
            dispatch({ type: "GENERATION_COMPLETE" });
            dispatch({ type: "NEXT_STEP" }); // to step 2
          }
        }
      }
    }
    // Clear preview on close
    return () => {
      actions.clearWizardPreview();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updatePreview = useCallback(() => {
    const offset =
      ((studioState.builder.editing.world?.foundation.config.terrain
        .worldSize ?? 0) *
        (studioState.builder.editing.world?.foundation.config.terrain
          .tileSize ?? 1)) /
      2;

    const preview: WizardPreviewData = {
      towns: stageResultsRef.current.towns,
      roadsZones: stageResultsRef.current.roadsZones,
      population: stageResultsRef.current.population,
      worldCenterOffset: offset,
    };
    actions.setWizardPreview(preview);
  }, [studioState.builder.editing.world, actions]);

  const handleGenerate = useCallback(() => {
    dispatch({ type: "START_GENERATE" });

    requestAnimationFrame(() => {
      try {
        const step = machine.stepIndex;

        if (step === 0) {
          // Town stage
          dispatch({
            type: "GENERATION_PROGRESS",
            progress: 30,
            label: "Scanning land and placing towns...",
          });
          const result = generateTownStage(config, {
            seed: townSeed,
            townCount,
            minTownSpacing,
          });
          if (!result) {
            dispatch({
              type: "FAIL",
              message: "No land found or viewport not ready.",
            });
            return;
          }
          stageResultsRef.current.towns = result;
          dispatch({ type: "SET_STAGE_RESULT", stepIndex: 0, result });
          dispatch({ type: "GENERATION_COMPLETE" });
          updatePreview();
        } else if (step === 1) {
          // Roads + Zones stage
          const townResult = stageResultsRef.current.towns;
          if (!townResult) {
            dispatch({
              type: "FAIL",
              message: "Town stage must be completed first.",
            });
            return;
          }
          dispatch({
            type: "GENERATION_PROGRESS",
            progress: 30,
            label: "Sampling difficulty grid...",
          });
          const result = generateRoadZoneStage(config, townResult, {
            seed: rzSeed,
          });
          if (!result) {
            dispatch({
              type: "FAIL",
              message: "Road/zone generation failed.",
            });
            return;
          }
          stageResultsRef.current.roadsZones = result;
          dispatch({ type: "SET_STAGE_RESULT", stepIndex: 1, result });
          dispatch({ type: "GENERATION_COMPLETE" });
          updatePreview();
        } else if (step === 2) {
          // Population stage
          const townResult = stageResultsRef.current.towns;
          const rzResult = stageResultsRef.current.roadsZones;
          if (!townResult || !rzResult) {
            dispatch({
              type: "FAIL",
              message: "Previous stages must be completed first.",
            });
            return;
          }
          dispatch({
            type: "GENERATION_PROGRESS",
            progress: 30,
            label: "Populating entities...",
          });
          const result = generatePopulationStage(config, townResult, rzResult);
          if (!result) {
            dispatch({
              type: "FAIL",
              message: "Population generation failed.",
            });
            return;
          }
          stageResultsRef.current.population = result;
          dispatch({ type: "SET_STAGE_RESULT", stepIndex: 2, result });
          dispatch({ type: "GENERATION_COMPLETE" });
          updatePreview();
        }
      } catch (err) {
        dispatch({
          type: "FAIL",
          message: err instanceof Error ? err.message : "Generation failed",
        });
      }
    });
  }, [
    machine.stepIndex,
    config,
    townSeed,
    townCount,
    minTownSpacing,
    rzSeed,
    generateTownStage,
    generateRoadZoneStage,
    generatePopulationStage,
    updatePreview,
  ]);

  const handleReroll = useCallback(() => {
    const step = machine.stepIndex;
    // New seed for this stage
    const newSeed = Math.floor(Math.random() * 999999);
    if (step === 0) {
      setTownSeed(newSeed);
    } else if (step === 1) {
      setRzSeed(newSeed);
    } else {
      setConfig((c) => ({ ...c, seed: newSeed }));
    }
    // Clear downstream results
    dispatch({ type: "REGENERATE_STEP", stepIndex: step });
    if (step <= 0) {
      delete stageResultsRef.current.towns;
      delete stageResultsRef.current.roadsZones;
      delete stageResultsRef.current.population;
    } else if (step <= 1) {
      delete stageResultsRef.current.roadsZones;
      delete stageResultsRef.current.population;
    } else {
      delete stageResultsRef.current.population;
    }
    updatePreview();
  }, [machine.stepIndex, updatePreview]);

  const handleApply = useCallback(() => {
    const townResult = stageResultsRef.current.towns;
    const rzResult = stageResultsRef.current.roadsZones;
    const popResult = stageResultsRef.current.population;
    if (!townResult || !rzResult || !popResult) return;

    dispatch({ type: "START_APPLY" });
    try {
      const merged: AutoGenResult = mergeStageResults(
        townResult,
        rzResult,
        popResult,
        config,
        0,
      );
      apply(merged);
      actions.clearWizardPreview();
      dispatch({ type: "APPLY_COMPLETE", batchId: `wizard-${Date.now()}` });
    } catch (err) {
      dispatch({
        type: "FAIL",
        message: err instanceof Error ? err.message : "Apply failed",
      });
    }
  }, [apply, config, actions]);

  const handleClose = useCallback(() => {
    dispatch({ type: "RESET" });
    stageResultsRef.current = {};
    actions.clearWizardPreview();
    onClose();
  }, [onClose, actions]);

  if (!open) return null;

  const currentStep = WIZARD_STEPS[machine.stepIndex];
  const isFirstStep = machine.stepIndex === 0;
  const isLastStep = machine.stepIndex === WIZARD_STEPS.length - 1;
  const isGenerating = machine.current === "generating";
  const isPreviewing = machine.current === "previewing";
  const isComplete = machine.current === "complete";
  const isError = machine.current === "error";
  const allStagesComplete =
    machine.completedSteps.has(0) &&
    machine.completedSteps.has(1) &&
    machine.completedSteps.has(2);

  const modeTitle =
    mode === "zones-only"
      ? "Generate Zones"
      : mode === "population-only"
        ? "Populate World"
        : "Generate World";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-primary border border-border-primary rounded-lg shadow-2xl w-[900px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary flex-shrink-0">
          <div className="flex items-center gap-2">
            <Wand2 size={16} className="text-primary" />
            <span className="text-sm font-semibold text-text-primary">
              {modeTitle}
            </span>
          </div>
          <button
            className="p-1 rounded hover:bg-bg-tertiary text-text-tertiary hover:text-text-primary"
            onClick={handleClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* Step Bar */}
        <div className="px-4 py-2 border-b border-border-primary flex-shrink-0">
          <StepBar
            steps={WIZARD_STEPS}
            currentIndex={machine.stepIndex}
            completedSteps={machine.completedSteps}
            onJump={(idx) => dispatch({ type: "JUMP_TO_STEP", stepIndex: idx })}
          />
        </div>

        {/* Manifest loading warning */}
        {!manifestsLoaded && (
          <div className="mx-4 mt-2 px-3 py-2 rounded bg-amber-500/10 border border-amber-500/30 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
            <span className="text-[11px] text-amber-300">
              Game manifests not loaded yet. Entity population requires manifest
              data.
            </span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isGenerating ? (
            <GeneratingView
              progress={machine.progress}
              label={machine.progressLabel}
              onCancel={() => dispatch({ type: "CANCEL" })}
            />
          ) : isError ? (
            <ErrorView
              message={machine.errorMessage ?? "Unknown error"}
              recoverable={machine.recoverable}
              onRetry={() => dispatch({ type: "RETRY" })}
              onCancel={handleClose}
            />
          ) : isComplete ? (
            <CompleteView
              stageResults={stageResultsRef.current}
              onClose={handleClose}
            />
          ) : (
            <div className="flex min-h-[400px]">
              {/* Left: Config panel */}
              <div className="w-[280px] border-r border-border-primary p-4 overflow-y-auto flex-shrink-0">
                <StageConfigPanel
                  stepIndex={machine.stepIndex}
                  config={config}
                  onConfigChange={setConfig}
                  townCount={townCount}
                  onTownCountChange={setTownCount}
                  minTownSpacing={minTownSpacing}
                  onMinTownSpacingChange={setMinTownSpacing}
                  townSeed={townSeed}
                  onTownSeedChange={setTownSeed}
                  rzSeed={rzSeed}
                  onRzSeedChange={setRzSeed}
                />
              </div>
              {/* Right: Preview/Stats */}
              <div className="flex-1 p-4 overflow-y-auto">
                {isPreviewing ? (
                  <StagePreviewPanel
                    stepIndex={machine.stepIndex}
                    stageResults={stageResultsRef.current}
                  />
                ) : (
                  <StagePlaceholder
                    stepIndex={machine.stepIndex}
                    hasPriorStages={
                      machine.stepIndex === 0 ||
                      (machine.stepIndex === 1 &&
                        machine.completedSteps.has(0)) ||
                      (machine.stepIndex === 2 &&
                        machine.completedSteps.has(0) &&
                        machine.completedSteps.has(1))
                    }
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isComplete && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border-primary flex-shrink-0">
            <div className="flex items-center gap-2">
              {!isFirstStep && !isGenerating && !isError && (
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
                  onClick={() => dispatch({ type: "PREV_STEP" })}
                >
                  <ChevronLeft size={14} /> Back
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Re-roll button */}
              {isPreviewing && (
                <button
                  className="flex items-center gap-1.5 px-5 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border border-border-primary"
                  onClick={handleReroll}
                >
                  <RefreshCw size={12} /> Re-roll
                </button>
              )}
              {/* Generate button */}
              {machine.current === "configuring" && (
                <button
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-primary text-white text-xs font-medium hover:bg-primary/90"
                  onClick={handleGenerate}
                >
                  Generate {currentStep?.name ?? ""} <ChevronRight size={14} />
                </button>
              )}
              {/* Next step button */}
              {isPreviewing && !isLastStep && (
                <button
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-primary text-white text-xs font-medium hover:bg-primary/90"
                  onClick={() => dispatch({ type: "NEXT_STEP" })}
                >
                  Next: {WIZARD_STEPS[machine.stepIndex + 1]?.name ?? ""}{" "}
                  <ChevronRight size={14} />
                </button>
              )}
              {/* Apply button */}
              {isPreviewing && isLastStep && allStagesComplete && (
                <button
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-green-600 text-white text-xs font-medium hover:bg-green-500"
                  onClick={handleApply}
                >
                  <Check size={14} /> Apply to World
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============== STAGE CONFIG ROUTER ==============

function StageConfigPanel({
  stepIndex,
  config,
  onConfigChange,
  townCount,
  onTownCountChange,
  minTownSpacing,
  onMinTownSpacingChange,
  townSeed,
  onTownSeedChange,
  rzSeed,
  onRzSeedChange,
}: {
  stepIndex: number;
  config: AutoGenConfig;
  onConfigChange: (c: AutoGenConfig) => void;
  townCount: number;
  onTownCountChange: (n: number) => void;
  minTownSpacing: number;
  onMinTownSpacingChange: (n: number) => void;
  townSeed: number;
  onTownSeedChange: (n: number) => void;
  rzSeed: number;
  onRzSeedChange: (n: number) => void;
}) {
  if (stepIndex === 0) {
    return (
      <TownStageConfig
        townSeed={townSeed}
        onTownSeedChange={onTownSeedChange}
        townCount={townCount}
        onTownCountChange={onTownCountChange}
        minTownSpacing={minTownSpacing}
        onMinTownSpacingChange={onMinTownSpacingChange}
      />
    );
  }

  if (stepIndex === 1) {
    return (
      <RoadZoneStageConfig
        config={config}
        onConfigChange={onConfigChange}
        rzSeed={rzSeed}
        onRzSeedChange={onRzSeedChange}
      />
    );
  }

  // Step 2: Population
  return (
    <PopulationStageConfig config={config} onConfigChange={onConfigChange} />
  );
}

// ============== STAGE PREVIEW ROUTER ==============

function StagePreviewPanel({
  stepIndex,
  stageResults,
}: {
  stepIndex: number;
  stageResults: {
    towns?: TownStageResult;
    roadsZones?: RoadZoneStageResult;
    population?: PopulationStageResult;
  };
}) {
  if (stepIndex === 0 && stageResults.towns) {
    return <TownPreview data={stageResults.towns} />;
  }
  if (stepIndex === 1 && stageResults.roadsZones) {
    return <RoadZonePreview data={stageResults.roadsZones} />;
  }
  if (stepIndex === 2 && stageResults.population) {
    return (
      <PopulationPreview
        data={stageResults.population}
        zones={stageResults.roadsZones?.zones}
      />
    );
  }
  return null;
}
