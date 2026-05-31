/**
 * FlowerGenPage
 * Page for procedural flower generation with wind animation preview
 *
 * Features:
 * - Real-time flower rendering with TSL (Three Shading Language) sprites
 * - Native WebGPU rendering for optimal performance
 * - Wind animation controls
 * - Biome density presets
 * - Multiple flower color palettes
 * - Performance statistics
 * - Export flower configuration
 *
 * This preview page uses the shared flower generation from @hyperscape/procgen,
 * ensuring consistency with the game engine.
 */

import { FlowerGen } from "@hyperscape/procgen";
import {
  Flower2,
  RefreshCw,
  Settings2,
  Wind,
  Gauge,
  Sun,
  Moon,
  Palette,
  Download,
  Sparkles,
} from "lucide-react";
import React, { useRef, useEffect, useState, useCallback } from "react";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { notify } from "@/utils/notify";
import {
  THREE,
  createPreviewRenderer,
  type PreviewRenderer,
} from "@/utils/preview-renderer";

// ============================================================================
// LOCAL CONFIG (UI-specific, maps to procgen types)
// ============================================================================

interface FlowerUIConfig {
  minScale: number;
  maxScale: number;
  density: number;
  tileSize: number;
  flowersPerSide: number;
  windIntensity: number;
  color1: string;
  color2: string;
  colorStrength: number;
  proceduralColors: boolean;
}

const DEFAULT_UI_CONFIG: FlowerUIConfig = {
  minScale: 0.15,
  maxScale: 0.25,
  density: 2300,
  tileSize: 50,
  flowersPerSide: 48,
  windIntensity: 0.5,
  // Default tint colors
  color1: "#053654", // Dark blue
  color2: "#ffa300", // Orange
  colorStrength: 0.275,
  proceduralColors: true,
};

// Biome UI presets for flowers
const BIOME_UI_PRESETS: Record<string, Partial<FlowerUIConfig>> = {
  meadow: {
    density: 3000,
    flowersPerSide: 55,
    colorStrength: 0.4,
    proceduralColors: true,
  },
  alpine: {
    density: 1500,
    flowersPerSide: 39,
    minScale: 0.1,
    maxScale: 0.18,
    color1: "#e6e6f2",
    color2: "#ccb3e6",
    proceduralColors: true,
  },
  tropical: {
    density: 2500,
    flowersPerSide: 50,
    minScale: 0.2,
    maxScale: 0.35,
    colorStrength: 0.5,
    proceduralColors: true,
  },
  desert: {
    density: 500,
    flowersPerSide: 22,
    minScale: 0.08,
    maxScale: 0.15,
    color1: "#ffcc4d",
    color2: "#e64d33",
    proceduralColors: true,
  },
  forest: {
    density: 1000,
    flowersPerSide: 32,
    minScale: 0.1,
    maxScale: 0.2,
    color1: "#994d99",
    color2: "#4d80b3",
    colorStrength: 0.25,
    proceduralColors: true,
  },
};

/**
 * Convert hex color to RGB object
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { r: 0.5, g: 0.5, b: 0.5 };
  }
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  };
}

/**
 * Convert UI config to procgen FlowerConfig
 */
function uiConfigToProcgenConfig(
  uiConfig: FlowerUIConfig,
): Partial<FlowerGen.FlowerConfig> {
  const color1 = hexToRgb(uiConfig.color1);
  const color2 = hexToRgb(uiConfig.color2);

  return {
    appearance: {
      minScale: uiConfig.minScale,
      maxScale: uiConfig.maxScale,
      width: 0.5,
      height: 1.0,
    },
    color: {
      color1,
      color2,
      colorStrength: uiConfig.colorStrength,
      proceduralColors: uiConfig.proceduralColors,
    },
    density: uiConfig.density,
    tileSize: uiConfig.tileSize,
    flowersPerSide: uiConfig.flowersPerSide,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export const FlowerGenPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PreviewRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const flowerFieldRef = useRef<FlowerGen.FlowerFieldResult | null>(null);
  const animationRef = useRef<number>(0);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const generateFlowersRef = useRef<(() => void) | null>(null);

  const [config, setConfig] = useState<FlowerUIConfig>(DEFAULT_UI_CONFIG);
  const [selectedBiome, setSelectedBiome] = useState<string>("meadow");
  const [stats, setStats] = useState<{
    instances: number;
    fps: number;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Initialize scene with WebGL so the hosted preview works in ordinary browsers.
  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDarkMode ? 0x1a1a2e : 0x87ceeb);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(8, 5, 8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x3d5a2c, 0.4);
    scene.add(hemiLight);

    // Ground plane with grass texture feel
    const groundGeometry = new THREE.PlaneGeometry(60, 60);
    const groundMaterial = new THREE.MeshStandardMaterial();
    groundMaterial.color = new THREE.Color(isDarkMode ? 0x2d4a1c : 0x3d5a2c);
    groundMaterial.roughness = 1;
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid helper
    const gridHelper = new THREE.GridHelper(60, 60, 0x444444, 0x333333);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    const initRenderer = () => {
      const renderer = createPreviewRenderer({
        antialias: true,
        alpha: true,
      });

      if (!mounted) {
        renderer.dispose();
        return;
      }

      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.target.set(0, 0.5, 0);
      controls.update();
      controlsRef.current = controls;

      // Generate initial flowers
      generateFlowersRef.current?.();

      // Animation loop
      let frameCount = 0;
      let fpsAccumulator = 0;

      const animate = () => {
        if (!mounted) return;
        animationRef.current = requestAnimationFrame(animate);

        const delta = clockRef.current.getDelta();

        // Update flower animation using procgen's update function
        if (flowerFieldRef.current) {
          flowerFieldRef.current.update(delta);
        }

        controls.update();
        renderer.render(scene, camera);

        // FPS calculation
        frameCount++;
        fpsAccumulator += delta;
        if (fpsAccumulator >= 1.0) {
          const fps = Math.round(frameCount / fpsAccumulator);
          setStats((prev) => (prev ? { ...prev, fps } : null));
          frameCount = 0;
          fpsAccumulator = 0;
        }
      };

      animate();
    };

    initRenderer();

    // Resize handler
    const handleResize = () => {
      if (!container || !rendererRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      mounted = false;
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationRef.current);

      // Dispose flower field
      if (flowerFieldRef.current) {
        flowerFieldRef.current.dispose();
        flowerFieldRef.current = null;
      }

      // Dispose renderer
      if (rendererRef.current) {
        if (container.contains(rendererRef.current.domElement)) {
          container.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current.dispose();
        rendererRef.current = null;
      }

      controlsRef.current?.dispose();
    };
  }, [isDarkMode]);

  // Generate flowers using procgen's FlowerGenerator
  const generateFlowers = useCallback(() => {
    if (!sceneRef.current) return;

    setIsGenerating(true);

    // Remove existing flowers
    if (flowerFieldRef.current) {
      sceneRef.current.remove(flowerFieldRef.current.mesh);
      flowerFieldRef.current.dispose();
      flowerFieldRef.current = null;
    }

    try {
      // Convert UI config to procgen config and generate
      const procgenConfig = uiConfigToProcgenConfig(config);
      const field = FlowerGen.FlowerGenerator.generateField({
        config: procgenConfig,
        seed: Date.now(),
        materialOptions: {
          proceduralColors: config.proceduralColors,
        },
      });

      const flowerColor = new THREE.Color(config.color2).lerp(
        new THREE.Color(config.color1),
        0.35,
      );
      const fallbackMaterial = new THREE.MeshStandardMaterial({
        color: flowerColor,
        roughness: 0.85,
        side: THREE.DoubleSide,
      });
      if (Array.isArray(field.mesh.material)) {
        field.mesh.material.forEach((material) => material.dispose());
      } else {
        field.mesh.material.dispose();
      }
      field.mesh.material = fallbackMaterial;

      sceneRef.current.add(field.mesh);
      flowerFieldRef.current = field;

      setStats({
        instances: field.count,
        fps: 0,
      });

      notify.success(`Generated ${field.count.toLocaleString()} flowers`);
    } catch (error) {
      console.error("Failed to generate flowers:", error);
      notify.error("Failed to generate flowers");
    }

    setIsGenerating(false);
  }, [config]);

  // Keep ref updated for initialization
  useEffect(() => {
    generateFlowersRef.current = generateFlowers;
  }, [generateFlowers]);

  // Apply biome preset
  const applyBiomePreset = (biomeName: string) => {
    const preset = BIOME_UI_PRESETS[biomeName];
    if (preset) {
      setConfig((prev) => ({ ...prev, ...preset }));
      setSelectedBiome(biomeName);
    }
  };

  // Update config handler
  const updateConfig = <K extends keyof FlowerUIConfig>(
    key: K,
    value: FlowerUIConfig[K],
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  // Export config
  const exportConfig = () => {
    const procgenConfig = uiConfigToProcgenConfig(config);
    const exportData = {
      uiConfig: config,
      procgenConfig,
      biome: selectedBiome,
    };
    const configJson = JSON.stringify(exportData, null, 2);
    const blob = new Blob([configJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flower-config-${selectedBiome}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success("Configuration exported");
  };

  return (
    <div className="flex h-[calc(100vh-60px)]">
      {/* Sidebar Controls */}
      <div className="w-80 bg-bg-secondary border-r border-border-primary overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Flower2 className="text-pink-500" size={24} />
            <h1 className="text-lg font-semibold text-text-primary">
              Flower Generator
            </h1>
          </div>

          {/* Info Box */}
          <div className="bg-bg-tertiary rounded-md p-3 text-xs text-text-secondary">
            <p>
              <strong>WebGL Preview:</strong> Uses shared @hyperscape/procgen
              flower generation for consistency with the game engine.
            </p>
          </div>

          {/* Biome Presets */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
              <Palette size={14} />
              Biome Preset
            </label>
            <select
              value={selectedBiome}
              onChange={(e) => applyBiomePreset(e.target.value)}
              className="w-full bg-bg-tertiary border border-border-primary rounded-md px-3 py-2 text-sm text-text-primary"
            >
              {Object.keys(BIOME_UI_PRESETS).map((biome) => (
                <option key={biome} value={biome}>
                  {biome.charAt(0).toUpperCase() + biome.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Flower Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
              <Settings2 size={14} />
              Flower Settings
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-tertiary">
                  Min Scale: {config.minScale.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.05"
                  max="0.3"
                  step="0.01"
                  value={config.minScale}
                  onChange={(e) =>
                    updateConfig("minScale", parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs text-text-tertiary">
                  Max Scale: {config.maxScale.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="0.5"
                  step="0.01"
                  value={config.maxScale}
                  onChange={(e) =>
                    updateConfig("maxScale", parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs text-text-tertiary">
                  Flowers Per Side: {config.flowersPerSide}
                </label>
                <input
                  type="range"
                  min="10"
                  max="80"
                  step="1"
                  value={config.flowersPerSide}
                  onChange={(e) =>
                    updateConfig("flowersPerSide", parseInt(e.target.value))
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs text-text-tertiary">
                  Tile Size: {config.tileSize}m
                </label>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={config.tileSize}
                  onChange={(e) =>
                    updateConfig("tileSize", parseInt(e.target.value))
                  }
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Wind Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
              <Wind size={14} />
              Wind Animation
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-tertiary">
                  Wind Intensity: {config.windIntensity.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={config.windIntensity}
                  onChange={(e) =>
                    updateConfig("windIntensity", parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Color Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
              <Sparkles size={14} />
              Colors
            </h3>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.proceduralColors}
                  onChange={(e) =>
                    updateConfig("proceduralColors", e.target.checked)
                  }
                  className="w-4 h-4"
                />
                <label className="text-xs text-text-tertiary">
                  Use Procedural Colors (pink, yellow, purple, orange)
                </label>
              </div>

              {!config.proceduralColors && (
                <>
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-text-tertiary w-20">
                      Color 1
                    </label>
                    <input
                      type="color"
                      value={config.color1}
                      onChange={(e) => updateConfig("color1", e.target.value)}
                      className="w-10 h-8 rounded cursor-pointer"
                    />
                    <span className="text-xs text-text-tertiary">
                      {config.color1}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-xs text-text-tertiary w-20">
                      Color 2
                    </label>
                    <input
                      type="color"
                      value={config.color2}
                      onChange={(e) => updateConfig("color2", e.target.value)}
                      className="w-10 h-8 rounded cursor-pointer"
                    />
                    <span className="text-xs text-text-tertiary">
                      {config.color2}
                    </span>
                  </div>
                </>
              )}

              <div>
                <label className="text-xs text-text-tertiary">
                  Color Strength: {(config.colorStrength * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={config.colorStrength}
                  onChange={(e) =>
                    updateConfig("colorStrength", parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={generateFlowers}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-md font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw
              size={18}
              className={isGenerating ? "animate-spin" : ""}
            />
            {isGenerating ? "Generating..." : "Regenerate Flowers"}
          </button>

          {/* Export Button */}
          <button
            onClick={exportConfig}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-bg-primary text-text-secondary rounded-md text-sm transition-colors"
          >
            <Download size={16} />
            Export Configuration
          </button>

          {/* Stats */}
          {stats && (
            <div className="bg-bg-tertiary rounded-md p-3 space-y-2">
              <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
                <Gauge size={14} />
                Statistics
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-text-tertiary">Flowers:</span>
                  <span className="text-text-primary ml-2">
                    {stats.instances.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-text-tertiary">FPS:</span>
                  <span className="text-text-primary ml-2">{stats.fps}</span>
                </div>
              </div>
            </div>
          )}

          {/* Theme Toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-bg-primary text-text-secondary rounded-md text-sm transition-colors"
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            {isDarkMode ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
      </div>

      {/* 3D Viewport */}
      <div className="flex-1 relative">
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
};
