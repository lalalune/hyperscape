import { create } from "zustand";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import { ArmorFittingViewerRef } from "../components/ArmorFitting/ArmorFittingViewer";
import {
  FittingConfig,
  BodyRegion,
  CollisionPoint,
} from "../services/fitting/ArmorFittingService";
import { Asset } from "../types";

interface HistoryEntry {
  fittingConfig: FittingConfig;
  timestamp: number;
}

interface ArmorFittingState {
  // Selected items
  selectedAvatar: Asset | null;
  selectedArmor: Asset | null;
  selectedHelmet: Asset | null;
  assetTypeFilter: "avatar" | "armor" | "helmet";

  // Fitting configuration
  fittingConfig: FittingConfig;

  // Helmet fitting parameters
  helmetFittingMethod: "auto" | "manual";
  helmetSizeMultiplier: number;
  helmetFitTightness: number;
  helmetVerticalOffset: number;
  helmetForwardOffset: number;
  helmetRotation: { x: number; y: number; z: number };

  // Additional options
  enableWeightTransfer: boolean;
  equipmentSlot: string;

  // Visualization
  visualizationMode: "none" | "regions" | "collisions" | "weights" | "hull";
  selectedBone: number;
  showWireframe: boolean;

  // Animation
  currentAnimation: "tpose" | "walking" | "running";
  isAnimationPlaying: boolean;

  // Fitting results
  bodyRegions: Map<string, BodyRegion> | null;
  collisions: CollisionPoint[] | null;
  isFitting: boolean;
  fittingProgress: number;
  isArmorFitted: boolean;
  isArmorBound: boolean;
  isHelmetFitted: boolean;
  isHelmetAttached: boolean;

  // UI state
  showDebugger: boolean;

  // Error handling
  lastError: string | null;

  // History for undo/redo
  history: HistoryEntry[];
  historyIndex: number;

  // Loading states for specific operations
  isExporting: boolean;
  isSavingConfig: boolean;
}

interface ArmorFittingActions {
  // Asset selection
  setSelectedAvatar: (avatar: Asset | null) => void;
  setSelectedArmor: (armor: Asset | null) => void;
  setSelectedHelmet: (helmet: Asset | null) => void;
  setAssetTypeFilter: (type: "avatar" | "armor" | "helmet") => void;
  handleAssetSelect: (asset: Asset) => void;

  // Fitting configuration
  setFittingConfig: (config: FittingConfig) => void;
  updateFittingConfig: (updates: Partial<FittingConfig>) => void;

  // Helmet fitting parameters
  setHelmetFittingMethod: (method: "auto" | "manual") => void;
  setHelmetSizeMultiplier: (multiplier: number) => void;
  setHelmetFitTightness: (tightness: number) => void;
  setHelmetVerticalOffset: (offset: number) => void;
  setHelmetForwardOffset: (offset: number) => void;
  setHelmetRotation: (rotation: { x: number; y: number; z: number }) => void;
  updateHelmetRotation: (axis: "x" | "y" | "z", value: number) => void;
  resetHelmetSettings: () => void;

  // Options
  setEnableWeightTransfer: (enabled: boolean) => void;
  setEquipmentSlot: (
    slot: string,
    viewerRef?: React.RefObject<ArmorFittingViewerRef | null>,
  ) => void;

  // Visualization
  setVisualizationMode: (mode: ArmorFittingState["visualizationMode"]) => void;
  setSelectedBone: (bone: number) => void;
  setShowWireframe: (show: boolean) => void;

  // Animation
  setCurrentAnimation: (
    animation: ArmorFittingState["currentAnimation"],
  ) => void;
  setIsAnimationPlaying: (playing: boolean) => void;
  toggleAnimation: () => void;

  // Fitting results
  setBodyRegions: (regions: Map<string, BodyRegion> | null) => void;
  setCollisions: (collisions: CollisionPoint[] | null) => void;
  setIsFitting: (fitting: boolean) => void;
  setFittingProgress: (progress: number) => void;
  setIsHelmetFitted: (fitted: boolean) => void;
  setIsHelmetAttached: (attached: boolean) => void;

  // UI state
  setShowDebugger: (show: boolean) => void;

  // Error handling
  setLastError: (error: string | null) => void;
  clearError: () => void;

  // History management
  saveToHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Complex actions
  performFitting: (
    viewerRef: React.RefObject<ArmorFittingViewerRef | null>,
  ) => Promise<void>;
  bindArmorToSkeleton: (
    viewerRef: React.RefObject<ArmorFittingViewerRef | null>,
  ) => Promise<void>;
  resetFitting: () => void;
  performHelmetFitting: (
    viewerRef: React.RefObject<ArmorFittingViewerRef | null>,
  ) => Promise<void>;
  attachHelmetToHead: (
    viewerRef: React.RefObject<ArmorFittingViewerRef | null>,
  ) => Promise<void>;
  detachHelmetFromHead: (
    viewerRef: React.RefObject<ArmorFittingViewerRef | null>,
  ) => Promise<void>;
  exportFittedArmor: (
    viewerRef: React.RefObject<ArmorFittingViewerRef | null>,
  ) => Promise<void>;
  exportEquippedAvatar: (
    viewerRef: React.RefObject<ArmorFittingViewerRef | null>,
  ) => Promise<void>;
  resetScene: (
    viewerRef: React.RefObject<ArmorFittingViewerRef | null>,
  ) => void;
  saveConfiguration: () => Promise<void>;
  loadConfiguration: (file: File) => Promise<void>;

  // Reset everything
  resetAll: () => void;
}

// Selectors for commonly used derived state
interface ArmorFittingSelectors {
  isReadyToFit: () => boolean;
  hasUnsavedChanges: () => boolean;
  fittingMethod: () => FittingConfig["method"];
  currentProgress: () => string;
}

type ArmorFittingStore = ArmorFittingState &
  ArmorFittingActions &
  ArmorFittingSelectors;

const initialState: ArmorFittingState = {
  // Selected items
  selectedAvatar: null,
  selectedArmor: null,
  selectedHelmet: null,
  assetTypeFilter: "avatar",

  // Fitting configuration - matches MeshFittingParameters from debugger
  fittingConfig: {
    method: "shrinkwrap" as const, // Only using shrinkwrap
    iterations: 8,
    stepSize: 0.15,
    smoothingRadius: 0.2,
    smoothingStrength: 0.3,
    targetOffset: 0.05,
    sampleRate: 1.0,
    preserveFeatures: true,
    featureAngleThreshold: 45,
    useImprovedShrinkwrap: false,
    preserveOpenings: true,
    pushInteriorVertices: true,
  },

  // Helmet fitting parameters
  helmetFittingMethod: "auto",
  helmetSizeMultiplier: 1.0,
  helmetFitTightness: 1.0,
  helmetVerticalOffset: 0,
  helmetForwardOffset: 0,
  helmetRotation: { x: 0, y: 0, z: 0 },

  // Additional options
  enableWeightTransfer: false,
  equipmentSlot: "Spine2",

  // Visualization
  visualizationMode: "none",
  selectedBone: 0,
  showWireframe: false,

  // Animation
  currentAnimation: "tpose",
  isAnimationPlaying: false,

  // Fitting results
  bodyRegions: null,
  collisions: null,
  isFitting: false,
  fittingProgress: 0,
  isArmorFitted: false,
  isArmorBound: false,
  isHelmetFitted: false,
  isHelmetAttached: false,

  // UI state
  showDebugger: false,

  // Error handling
  lastError: null,

  // History
  history: [],
  historyIndex: -1,

  // Loading states
  isExporting: false,
  isSavingConfig: false,
};

export const useArmorFittingStore = create<ArmorFittingStore>()(
  subscribeWithSelector(
    devtools(
      persist(
        immer((set, get) => ({
          ...initialState,

          // Asset selection
          setSelectedAvatar: (avatar) =>
            set((state) => {
              state.selectedAvatar = avatar;
              state.lastError = null;
            }),
          setSelectedArmor: (armor) =>
            set((state) => {
              state.selectedArmor = armor;
              state.lastError = null;
            }),
          setSelectedHelmet: (helmet) =>
            set((state) => {
              state.selectedHelmet = helmet;
              state.lastError = null;
            }),
          setAssetTypeFilter: (type) =>
            set((state) => {
              state.assetTypeFilter = type;
            }),
          handleAssetSelect: (asset) => {
            const { assetTypeFilter, saveToHistory } = get();
            saveToHistory();
            set((state) => {
              if (assetTypeFilter === "avatar") {
                state.selectedAvatar = asset;
              } else if (assetTypeFilter === "armor") {
                state.selectedArmor = asset;
              } else if (assetTypeFilter === "helmet") {
                state.selectedHelmet = asset;
              }
              state.lastError = null;
            });
          },

          // Fitting configuration
          setFittingConfig: (config) =>
            set((state) => {
              state.fittingConfig = config;
            }),
          updateFittingConfig: (updates) => {
            get().saveToHistory();
            set((state) => {
              Object.assign(state.fittingConfig, updates);
            });
          },

          // Helmet fitting parameters
          setHelmetFittingMethod: (method) =>
            set((state) => {
              state.helmetFittingMethod = method;
            }),
          setHelmetSizeMultiplier: (multiplier) =>
            set((state) => {
              state.helmetSizeMultiplier = multiplier;
            }),
          setHelmetFitTightness: (tightness) =>
            set((state) => {
              state.helmetFitTightness = tightness;
            }),
          setHelmetVerticalOffset: (offset) =>
            set((state) => {
              state.helmetVerticalOffset = offset;
            }),
          setHelmetForwardOffset: (offset) =>
            set((state) => {
              state.helmetForwardOffset = offset;
            }),
          setHelmetRotation: (rotation) =>
            set((state) => {
              state.helmetRotation = rotation;
            }),
          updateHelmetRotation: (axis, value) =>
            set((state) => {
              state.helmetRotation[axis] = value;
            }),
          resetHelmetSettings: () =>
            set((state) => {
              state.helmetFittingMethod = "auto";
              state.helmetSizeMultiplier = 1.0;
              state.helmetFitTightness = 0.85;
              state.helmetVerticalOffset = 0;
              state.helmetForwardOffset = 0;
              state.helmetRotation = { x: 0, y: 0, z: 0 };
            }),

          // Options
          setEnableWeightTransfer: (enabled) =>
            set((state) => {
              state.enableWeightTransfer = enabled;
            }),
          setEquipmentSlot: (slot, viewerRef) => {
            const prevSlot = get().equipmentSlot;
            console.log(
              `=== SWITCHING EQUIPMENT SLOT: ${prevSlot} -> ${slot} ===`,
            );

            // Clear meshes from scene based on what we're leaving
            if (viewerRef?.current && prevSlot !== slot) {
              if (prevSlot === "Head" && slot !== "Head") {
                // Leaving helmet mode - clear helmet mesh
                console.log("Leaving helmet mode - clearing helmet from scene");
                viewerRef.current.clearHelmet();
              } else if (prevSlot === "Spine2" && slot !== "Spine2") {
                // Leaving armor mode - clear armor mesh
                console.log("Leaving armor mode - clearing armor from scene");
                viewerRef.current.clearArmor();
              }
            }

            set((state) => {
              state.equipmentSlot = slot;

              // Reset selection states when changing slots
              if (slot === "Head") {
                // Switched to helmet mode - clear armor selection
                state.selectedArmor = null;
                state.isArmorFitted = false;
                state.isArmorBound = false;
              } else if (slot === "Spine2") {
                // Switched to armor mode - clear helmet selection
                state.selectedHelmet = null;
                state.isHelmetFitted = false;
                state.isHelmetAttached = false;
              }

              // Reset common states
              state.fittingProgress = 0;
              state.isFitting = false;
              state.lastError = null;

              // Reset animation to T-pose
              state.currentAnimation = "tpose";
              state.isAnimationPlaying = false;

              // Reset visual states
              state.showWireframe = false;

              // Update asset type filter to show equipment for the new slot
              // If avatar is selected, show the equipment type for that slot
              // Otherwise stay on avatar selection
              if (state.selectedAvatar) {
                if (slot === "Head") {
                  state.assetTypeFilter = "helmet";
                } else if (slot === "Spine2") {
                  state.assetTypeFilter = "armor";
                }
              }
            });
          },

          // Visualization
          setVisualizationMode: (mode) =>
            set((state) => {
              state.visualizationMode = mode;
            }),
          setSelectedBone: (bone) =>
            set((state) => {
              state.selectedBone = bone;
            }),
          setShowWireframe: (show) =>
            set((state) => {
              state.showWireframe = show;
            }),

          // Animation
          setCurrentAnimation: (animation) =>
            set((state) => {
              state.currentAnimation = animation;
              // Stop animation when switching to T-pose
              if (animation === "tpose") {
                state.isAnimationPlaying = false;
              } else {
                // Start animation when switching to walking/running
                state.isAnimationPlaying = true;
              }
            }),
          setIsAnimationPlaying: (playing) =>
            set((state) => {
              state.isAnimationPlaying = playing;
            }),
          toggleAnimation: () =>
            set((state) => {
              state.isAnimationPlaying = !state.isAnimationPlaying;
            }),

          // Fitting results
          setBodyRegions: (regions) =>
            set((state) => {
              state.bodyRegions = regions;
            }),
          setCollisions: (collisions) =>
            set((state) => {
              state.collisions = collisions;
            }),
          setIsFitting: (fitting) =>
            set((state) => {
              state.isFitting = fitting;
            }),
          setFittingProgress: (progress) =>
            set((state) => {
              state.fittingProgress = progress;
            }),
          setIsHelmetFitted: (fitted) =>
            set((state) => {
              state.isHelmetFitted = fitted;
            }),
          setIsHelmetAttached: (attached) =>
            set((state) => {
              state.isHelmetAttached = attached;
            }),

          // UI state
          setShowDebugger: (show) =>
            set((state) => {
              state.showDebugger = show;
            }),

          // Error handling
          setLastError: (error) =>
            set((state) => {
              state.lastError = error;
            }),
          clearError: () =>
            set((state) => {
              state.lastError = null;
            }),

          // History management
          saveToHistory: () =>
            set((state) => {
              const entry: HistoryEntry = {
                fittingConfig: { ...state.fittingConfig },
                timestamp: Date.now(),
              };

              // Remove any entries after current index
              state.history = state.history.slice(0, state.historyIndex + 1);
              state.history.push(entry);
              state.historyIndex = state.history.length - 1;

              // Keep history size reasonable
              if (state.history.length > 50) {
                state.history = state.history.slice(-50);
                state.historyIndex = state.history.length - 1;
              }
            }),

          undo: () =>
            set((state) => {
              if (state.historyIndex > 0) {
                state.historyIndex--;
                const entry = state.history[state.historyIndex];
                state.fittingConfig = { ...entry.fittingConfig };
              }
            }),

          redo: () =>
            set((state) => {
              if (state.historyIndex < state.history.length - 1) {
                state.historyIndex++;
                const entry = state.history[state.historyIndex];
                state.fittingConfig = { ...entry.fittingConfig };
              }
            }),

          canUndo: () => get().historyIndex > 0,
          canRedo: () => get().historyIndex < get().history.length - 1,

          // Complex actions
          performFitting: async (viewerRef) => {
            const {
              selectedAvatar,
              selectedArmor,
              fittingConfig,
              enableWeightTransfer,
              isFitting,
            } = get();

            if (!viewerRef.current || !selectedAvatar || !selectedArmor) {
              set((state) => {
                state.lastError = "Missing avatar or armor selection";
              });
              return;
            }

            // Ensure we're not already processing
            if (isFitting) {
              console.warn("Already processing a fitting operation");
              return;
            }

            set((state) => {
              state.isFitting = true;
              state.fittingProgress = 0;
              state.lastError = null;
            });

            try {
              // Using shrinkwrap fitting from MeshFittingDebugger
              set((state) => {
                state.fittingProgress = 25;
              });
              console.log(
                "🎯 ArmorFittingLab: Performing shrinkwrap-based armor fitting",
              );

              // Create fitting parameters matching MeshFittingParameters interface
              const shrinkwrapParams = {
                ...fittingConfig,
                iterations: Math.min(fittingConfig.iterations || 8, 10),
                stepSize: fittingConfig.stepSize || 0.1,
                targetOffset: fittingConfig.targetOffset || 0.01,
                sampleRate: fittingConfig.sampleRate || 1.0,
                smoothingRadius: fittingConfig.smoothingRadius || 2,
                smoothingStrength: fittingConfig.smoothingStrength || 0.2,
                preserveFeatures: fittingConfig.preserveFeatures || false,
                featureAngleThreshold:
                  fittingConfig.featureAngleThreshold || 45,
                useImprovedShrinkwrap:
                  fittingConfig.useImprovedShrinkwrap || false,
                preserveOpenings: fittingConfig.preserveOpenings || false,
                pushInteriorVertices:
                  fittingConfig.pushInteriorVertices || false,
              };

              console.log("Shrinkwrap parameters:", shrinkwrapParams);

              // Perform the fitting
              set((state) => {
                state.fittingProgress = 50;
              });
              viewerRef.current.performFitting?.(shrinkwrapParams);

              // Update progress
              await new Promise((resolve) => setTimeout(resolve, 1000));
              set((state) => {
                state.fittingProgress = 80;
              });

              // Weight transfer if enabled
              if (enableWeightTransfer) {
                set((state) => {
                  state.fittingProgress = 90;
                });
                console.log(
                  "🎯 ArmorFittingLab: Transferring vertex weights from avatar to armor",
                );
                viewerRef.current.transferWeights?.();
                await new Promise((resolve) => setTimeout(resolve, 800));
              }

              set((state) => {
                state.fittingProgress = 100;
                // Mark armor as fitted if we're in armor mode
                if (state.equipmentSlot === "Spine2") {
                  state.isArmorFitted = true;
                }
              });

              // Save to history after successful fitting
              get().saveToHistory();
            } catch (error) {
              console.error("Fitting failed:", error);
              set((state) => {
                state.lastError = `Fitting failed: ${(error as Error).message}`;
              });
            } finally {
              setTimeout(() => {
                set((state) => {
                  state.isFitting = false;
                });
              }, 100);
            }
          },

          bindArmorToSkeleton: async (viewerRef) => {
            const { selectedAvatar, selectedArmor, isArmorFitted, isFitting } =
              get();

            if (
              !viewerRef.current ||
              !selectedAvatar ||
              !selectedArmor ||
              !isArmorFitted
            ) {
              set((state) => {
                state.lastError = "Must fit armor before binding to skeleton";
              });
              return;
            }

            // Ensure we're not already processing
            if (isFitting) {
              console.warn("Already processing a binding operation");
              return;
            }

            set((state) => {
              state.isFitting = true;
              state.fittingProgress = 0;
              state.lastError = null;
            });

            try {
              console.log("🎯 ArmorFittingLab: Binding armor to skeleton");

              // Call viewer's transferWeights method
              viewerRef.current.transferWeights();

              set((state) => {
                state.isArmorBound = true;
                state.fittingProgress = 100;
              });

              console.log("✅ ArmorFittingLab: Armor bound to skeleton");
            } catch (error) {
              console.error("Binding failed:", error);
              set((state) => {
                state.lastError = `Binding failed: ${(error as Error).message}`;
              });
            } finally {
              set((state) => {
                state.isFitting = false;
              });
            }
          },

          resetFitting: () => {
            set((state) => {
              state.fittingProgress = 0;
              state.isFitting = false;
              state.bodyRegions = null;
              state.collisions = null;
              state.lastError = null;
              state.isArmorFitted = false;
              state.isArmorBound = false;
              state.isHelmetFitted = false;
              state.isHelmetAttached = false;
              // Reset animation to T-pose
              state.currentAnimation = "tpose";
              state.isAnimationPlaying = false;
            });
          },

          // Helmet fitting actions
          performHelmetFitting: async (viewerRef) => {
            const {
              selectedAvatar,
              selectedHelmet,
              helmetFittingMethod,
              helmetSizeMultiplier,
              helmetFitTightness,
              helmetVerticalOffset,
              helmetForwardOffset,
              helmetRotation,
            } = get();

            if (!viewerRef.current || !selectedAvatar || !selectedHelmet) {
              set((state) => {
                state.lastError = "Missing avatar or helmet selection";
              });
              return;
            }

            set((state) => {
              state.isFitting = true;
              state.lastError = null;
            });

            try {
              await viewerRef.current.performHelmetFitting({
                method: helmetFittingMethod,
                sizeMultiplier: helmetSizeMultiplier,
                fitTightness: helmetFitTightness,
                verticalOffset: helmetVerticalOffset,
                forwardOffset: helmetForwardOffset,
                rotation: {
                  x: (helmetRotation.x * Math.PI) / 180,
                  y: (helmetRotation.y * Math.PI) / 180,
                  z: (helmetRotation.z * Math.PI) / 180,
                },
              });

              set((state) => {
                state.isHelmetFitted = true;
              });
            } catch (error) {
              console.error("Helmet fitting failed:", error);
              set((state) => {
                state.lastError = `Helmet fitting failed: ${(error as Error).message}`;
              });
            } finally {
              set((state) => {
                state.isFitting = false;
              });
            }
          },

          attachHelmetToHead: async (viewerRef) => {
            if (!viewerRef.current) return;

            try {
              viewerRef.current.attachHelmetToHead();
              set((state) => {
                state.isHelmetAttached = true;
              });
            } catch (error) {
              console.error("Helmet attachment failed:", error);
              set((state) => {
                state.lastError = `Helmet attachment failed: ${(error as Error).message}`;
              });
            }
          },

          detachHelmetFromHead: async (viewerRef) => {
            if (!viewerRef.current) return;

            try {
              viewerRef.current.detachHelmetFromHead();
              set((state) => {
                state.isHelmetAttached = false;
              });
            } catch (error) {
              console.error("Helmet detachment failed:", error);
              set((state) => {
                state.lastError = `Helmet detachment failed: ${(error as Error).message}`;
              });
            }
          },

          exportFittedArmor: async (viewerRef) => {
            if (!viewerRef.current) return;

            set((state) => {
              state.isExporting = true;
              state.lastError = null;
            });

            try {
              const arrayBuffer = await viewerRef.current.exportFittedModel();
              const blob = new Blob([arrayBuffer], {
                type: "model/gltf-binary",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `fitted_armor_${Date.now()}.glb`;
              a.click();
              URL.revokeObjectURL(url);
            } catch (error) {
              console.error("Export failed:", error);
              set((state) => {
                state.lastError = `Export failed: ${(error as Error).message}`;
              });
            } finally {
              set((state) => {
                state.isExporting = false;
              });
            }
          },

          exportEquippedAvatar: async (viewerRef) => {
            if (!viewerRef.current) return;

            set((state) => {
              state.isExporting = true;
              state.lastError = null;
            });

            try {
              const arrayBuffer = await viewerRef.current.exportFittedModel();
              const blob = new Blob([arrayBuffer], {
                type: "model/gltf-binary",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `equipped_avatar_${Date.now()}.glb`;
              a.click();
              URL.revokeObjectURL(url);
            } catch (error) {
              console.error("Export failed:", error);
              set((state) => {
                state.lastError = `Export failed: ${(error as Error).message}`;
              });
            } finally {
              set((state) => {
                state.isExporting = false;
              });
            }
          },

          resetScene: (viewerRef) => {
            const { equipmentSlot } = get();

            console.log("=== RESETTING SCENE ===");

            if (!viewerRef?.current) {
              console.error("No viewer ref available for reset");
              return;
            }

            // Reset transforms on meshes
            viewerRef.current.resetTransform();

            // Reset fitting states based on current equipment slot
            set((state) => {
              // Reset common states
              state.fittingProgress = 0;
              state.isFitting = false;
              state.lastError = null;
              state.showWireframe = false;

              // Reset animation to T-pose
              state.currentAnimation = "tpose";
              state.isAnimationPlaying = false;

              // Reset fitting states for current equipment slot
              if (equipmentSlot === "Head") {
                state.isHelmetFitted = false;
                state.isHelmetAttached = false;
                // Reset helmet parameters to defaults
                state.helmetFittingMethod = "auto";
                state.helmetSizeMultiplier = 1.0;
                state.helmetFitTightness = 1.0;
                state.helmetVerticalOffset = 0;
                state.helmetForwardOffset = 0;
                state.helmetRotation = { x: 0, y: 0, z: 0 };
              } else if (equipmentSlot === "Spine2") {
                state.isArmorFitted = false;
                state.isArmorBound = false;
                state.bodyRegions = null;
                state.collisions = null;
                // Reset fitting config to defaults
                state.fittingConfig = {
                  method: "shrinkwrap" as const,
                  iterations: 8,
                  stepSize: 0.15,
                  smoothingRadius: 0.2,
                  smoothingStrength: 0.3,
                  targetOffset: 0.05,
                  sampleRate: 1.0,
                  preserveFeatures: true,
                  featureAngleThreshold: 45,
                  useImprovedShrinkwrap: false,
                  preserveOpenings: true,
                  pushInteriorVertices: true,
                };
              }
            });

            console.log("=== SCENE RESET COMPLETE ===");
          },

          saveConfiguration: async () => {
            const {
              selectedAvatar,
              selectedArmor,
              fittingConfig,
              enableWeightTransfer,
            } = get();

            if (!selectedAvatar || !selectedArmor) {
              set((state) => {
                state.lastError =
                  "Please select both avatar and armor before saving";
              });
              return;
            }

            set((state) => {
              state.isSavingConfig = true;
              state.lastError = null;
            });

            try {
              const config = {
                avatarId: selectedAvatar.id,
                armorId: selectedArmor.id,
                fittingConfig,
                enableWeightTransfer,
                timestamp: new Date().toISOString(),
              };

              const json = JSON.stringify(config, null, 2);
              const blob = new Blob([json], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `armor_fitting_config_${Date.now()}.json`;
              a.click();
              URL.revokeObjectURL(url);
            } catch (error) {
              set((state) => {
                state.lastError = `Failed to save configuration: ${(error as Error).message}`;
              });
            } finally {
              set((state) => {
                state.isSavingConfig = false;
              });
            }
          },

          loadConfiguration: async (file: File) => {
            set((state) => {
              state.lastError = null;
            });

            try {
              const text = await file.text();
              const config = JSON.parse(text);

              set((state) => {
                state.fittingConfig = config.fittingConfig;
                state.enableWeightTransfer = config.enableWeightTransfer;
              });

              // Save to history after loading
              get().saveToHistory();
            } catch (error) {
              set((state) => {
                state.lastError = `Failed to load configuration: ${(error as Error).message}`;
              });
            }
          },

          resetAll: () => {
            set({
              ...initialState,
              history: [],
              historyIndex: -1,
            });
          },

          // Selectors
          isReadyToFit: () => {
            const {
              selectedAvatar,
              selectedArmor,
              selectedHelmet,
              equipmentSlot,
            } = get();
            if (equipmentSlot === "Head") {
              return !!(selectedAvatar && selectedHelmet);
            } else {
              return !!(selectedAvatar && selectedArmor);
            }
          },

          hasUnsavedChanges: () => {
            const { history, historyIndex } = get();
            return historyIndex < history.length - 1 || history.length > 0;
          },

          fittingMethod: () => get().fittingConfig.method,

          currentProgress: () => {
            const progress = get().fittingProgress;
            if (progress === 0) return "Ready";
            if (progress === 100) return "Complete";
            if (progress < 50) return "Positioning...";
            if (progress < 75) return "Fitting...";
            return "Finalizing...";
          },
        })),
        {
          name: "armor-fitting-storage",
          partialize: (state) => ({
            // Only persist these fields
            fittingConfig: state.fittingConfig,
            enableWeightTransfer: state.enableWeightTransfer,
            equipmentSlot: state.equipmentSlot,
            visualizationMode: state.visualizationMode,
            showWireframe: state.showWireframe,
          }),
        },
      ),
      {
        name: "armor-fitting-store",
      },
    ),
  ),
);

// Convenient selectors to use in components
export const useIsReadyToFit = () =>
  useArmorFittingStore((state) => state.isReadyToFit());
export const useHasUnsavedChanges = () =>
  useArmorFittingStore((state) => state.hasUnsavedChanges());
export const useFittingMethod = () =>
  useArmorFittingStore((state) => state.fittingMethod());
export const useCurrentProgress = () =>
  useArmorFittingStore((state) => state.currentProgress());
