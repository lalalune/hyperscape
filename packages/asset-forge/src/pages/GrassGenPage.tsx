/**
 * GrassGenPage
 * Page for procedural grass generation with wind animation preview
 *
 * Features:
 * - Real-time grass rendering with TSL (Three Shading Language) wind shaders
 * - Native WebGPU rendering for optimal performance
 * - Wind animation controls
 * - Biome density presets
 * - Performance statistics
 * - Export grass configuration
 *
 * This preview page uses the shared grass generation from @hyperscape/procgen,
 * ensuring consistency with the game engine.
 */

import { GrassGen } from "@hyperscape/procgen";
import {
  Leaf,
  RefreshCw,
  Settings2,
  Wind,
  Gauge,
  Sun,
  Moon,
  Palette,
  Download,
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

interface GrassUIConfig {
  bladeHeight: number;
  bladeWidth: number;
  bladeSegments: number;
  density: number;
  patchSize: number;
  windSpeed: number;
  windStrength: number;
  gustSpeed: number;
  flutterIntensity: number;
  baseColor: string;
  tipColor: string;
  dryColorMix: number;
}

const DEFAULT_UI_CONFIG: GrassUIConfig = {
  bladeHeight: 0.4,
  bladeWidth: 0.04,
  bladeSegments: 4,
  density: 8,
  patchSize: 20,
  windSpeed: 1.2,
  windStrength: 1.0,
  gustSpeed: 0.4,
  flutterIntensity: 0.15,
  // Colors matched to TerrainShader.ts grassGreen (0.3, 0.55, 0.15)
  baseColor: "#4d8c26", // rgb(77, 140, 38) ≈ (0.3, 0.55, 0.15)
  tipColor: "#619e38", // Slightly lighter tip (0.38, 0.62, 0.22)
  dryColorMix: 0.2,
};

// Map UI biome presets to procgen GrassConfig
const BIOME_UI_PRESETS: Record<string, Partial<GrassUIConfig>> = {
  plains: {
    density: 10,
    bladeHeight: 0.45,
    windStrength: 1.2,
    baseColor: "#4d8c26",
    tipColor: "#619e38",
    dryColorMix: 0.15,
  },
  forest: {
    density: 5,
    bladeHeight: 0.35,
    windStrength: 0.6,
    baseColor: "#386b1a",
    tipColor: "#4d8c26",
    dryColorMix: 0.1,
  },
  hills: {
    density: 7,
    bladeHeight: 0.38,
    windStrength: 1.5,
    baseColor: "#4d8c26",
    tipColor: "#619e38",
    dryColorMix: 0.25,
  },
  swamp: {
    density: 6,
    bladeHeight: 0.55,
    windStrength: 0.4,
    baseColor: "#386b1a",
    tipColor: "#4d8c26",
    dryColorMix: 0.05,
  },
  savanna: {
    density: 4,
    bladeHeight: 0.7,
    windStrength: 1.8,
    baseColor: "#6b8c3b",
    tipColor: "#8ca852",
    dryColorMix: 0.4,
  },
};

/**
 * Convert hex color to RGB object
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { r: 0.3, g: 0.5, b: 0.15 };
  }
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  };
}

/**
 * Convert UI config to procgen GrassConfig
 */
function uiConfigToProcgenConfig(
  uiConfig: GrassUIConfig,
): Partial<GrassGen.GrassConfig> {
  const baseColor = hexToRgb(uiConfig.baseColor);
  const tipColor = hexToRgb(uiConfig.tipColor);

  return {
    blade: {
      height: uiConfig.bladeHeight,
      width: uiConfig.bladeWidth,
      segments: uiConfig.bladeSegments,
      tipTaper: 0.3,
    },
    wind: {
      strength: uiConfig.windStrength,
      speed: uiConfig.windSpeed,
      gustSpeed: uiConfig.gustSpeed,
      flutterIntensity: uiConfig.flutterIntensity,
      direction: { x: 1, z: 0.3 },
    },
    color: {
      baseColor,
      tipColor,
      darkColor: { r: 0.22, g: 0.42, b: 0.1 },
      dryColorMix: uiConfig.dryColorMix,
      aoStrength: 0.5,
    },
    density: uiConfig.density,
    patchSize: uiConfig.patchSize,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export const GrassGenPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<PreviewRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const grassFieldRef = useRef<GrassGen.GrassFieldResult | null>(null);
  const animationRef = useRef<number>(0);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const generateGrassRef = useRef<(() => void) | null>(null);

  const [config, setConfig] = useState<GrassUIConfig>(DEFAULT_UI_CONFIG);
  const [selectedBiome, setSelectedBiome] = useState<string>("plains");
  const [stats, setStats] = useState<{
    instances: number;
    fps: number;
    triangles: number;
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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x3d5a2c, 0.4);
    scene.add(hemiLight);

    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshStandardMaterial();
    groundMaterial.color = new THREE.Color(isDarkMode ? 0x2d4a1c : 0x3d5a2c);
    groundMaterial.roughness = 1;
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid helper
    const gridHelper = new THREE.GridHelper(50, 50, 0x444444, 0x333333);
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

      // Generate initial grass
      generateGrassRef.current?.();

      // Animation loop
      let frameCount = 0;
      let fpsAccumulator = 0;

      const animate = () => {
        if (!mounted) return;
        animationRef.current = requestAnimationFrame(animate);

        const delta = clockRef.current.getDelta();

        // Update grass animation using procgen's update function
        if (grassFieldRef.current) {
          grassFieldRef.current.update(delta);
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

      // Dispose grass field
      if (grassFieldRef.current) {
        grassFieldRef.current.dispose();
        grassFieldRef.current = null;
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

  // Generate grass using procgen's GrassGenerator
  const generateGrass = useCallback(() => {
    if (!sceneRef.current) return;

    setIsGenerating(true);

    // Remove existing grass
    if (grassFieldRef.current) {
      sceneRef.current.remove(grassFieldRef.current.lod0Mesh);
      grassFieldRef.current.dispose();
      grassFieldRef.current = null;
    }

    try {
      // Convert UI config to procgen config and generate
      const procgenConfig = uiConfigToProcgenConfig(config);
      const field = GrassGen.GrassGenerator.generateField({
        config: procgenConfig,
        seed: Date.now(),
      });

      const fallbackMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(config.baseColor),
        roughness: 0.9,
        side: THREE.DoubleSide,
      });
      if (Array.isArray(field.lod0Mesh.material)) {
        field.lod0Mesh.material.forEach((material) => material.dispose());
      } else {
        field.lod0Mesh.material.dispose();
      }
      field.lod0Mesh.material = fallbackMaterial;

      sceneRef.current.add(field.lod0Mesh);
      grassFieldRef.current = field;

      const triangles = field.lod0Count * config.bladeSegments * 2;
      setStats({
        instances: field.lod0Count,
        fps: 0,
        triangles,
      });

      notify.success(
        `Generated ${field.lod0Count.toLocaleString()} grass blades`,
      );
    } catch (error) {
      console.error("Failed to generate grass:", error);
      notify.error("Failed to generate grass");
    }

    setIsGenerating(false);
  }, [config]);

  // Keep ref updated for initialization
  useEffect(() => {
    generateGrassRef.current = generateGrass;
  }, [generateGrass]);

  // Apply biome preset
  const applyBiomePreset = (biomeName: string) => {
    const preset = BIOME_UI_PRESETS[biomeName];
    if (preset) {
      setConfig((prev) => ({ ...prev, ...preset }));
      setSelectedBiome(biomeName);
    }
  };

  // Update config handler
  const updateConfig = <K extends keyof GrassUIConfig>(
    key: K,
    value: GrassUIConfig[K],
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
    a.download = `grass-config-${selectedBiome}.json`;
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
            <Leaf className="text-green-500" size={24} />
            <h1 className="text-lg font-semibold text-text-primary">
              Grass Generator
            </h1>
          </div>

          {/* Info Box */}
          <div className="bg-bg-tertiary rounded-md p-3 text-xs text-text-secondary">
            <p>
              <strong>WebGL Preview:</strong> Uses shared @hyperscape/procgen
              grass generation for consistency with the game engine.
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

          {/* Grass Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
              <Settings2 size={14} />
              Grass Settings
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-tertiary">
                  Blade Height: {config.bladeHeight.toFixed(2)}m
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={config.bladeHeight}
                  onChange={(e) =>
                    updateConfig("bladeHeight", parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs text-text-tertiary">
                  Density: {config.density} per m²
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="1"
                  value={config.density}
                  onChange={(e) =>
                    updateConfig("density", parseInt(e.target.value))
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs text-text-tertiary">
                  Patch Size: {config.patchSize}m
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={config.patchSize}
                  onChange={(e) =>
                    updateConfig("patchSize", parseInt(e.target.value))
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
                  Wind Strength: {config.windStrength.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={config.windStrength}
                  onChange={(e) =>
                    updateConfig("windStrength", parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs text-text-tertiary">
                  Wind Speed: {config.windSpeed.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={config.windSpeed}
                  onChange={(e) =>
                    updateConfig("windSpeed", parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs text-text-tertiary">
                  Flutter Intensity: {config.flutterIntensity.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="0.5"
                  step="0.05"
                  value={config.flutterIntensity}
                  onChange={(e) =>
                    updateConfig("flutterIntensity", parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Color Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
              <Palette size={14} />
              Colors
            </h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-xs text-text-tertiary w-20">Base</label>
                <input
                  type="color"
                  value={config.baseColor}
                  onChange={(e) => updateConfig("baseColor", e.target.value)}
                  className="w-10 h-8 rounded cursor-pointer"
                />
                <span className="text-xs text-text-tertiary">
                  {config.baseColor}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs text-text-tertiary w-20">Tip</label>
                <input
                  type="color"
                  value={config.tipColor}
                  onChange={(e) => updateConfig("tipColor", e.target.value)}
                  className="w-10 h-8 rounded cursor-pointer"
                />
                <span className="text-xs text-text-tertiary">
                  {config.tipColor}
                </span>
              </div>

              <div>
                <label className="text-xs text-text-tertiary">
                  Dry Color Mix: {(config.dryColorMix * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={config.dryColorMix}
                  onChange={(e) =>
                    updateConfig("dryColorMix", parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={generateGrass}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw
              size={18}
              className={isGenerating ? "animate-spin" : ""}
            />
            {isGenerating ? "Generating..." : "Regenerate Grass"}
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
                  <span className="text-text-tertiary">Instances:</span>
                  <span className="text-text-primary ml-2">
                    {stats.instances.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-text-tertiary">Triangles:</span>
                  <span className="text-text-primary ml-2">
                    {stats.triangles.toLocaleString()}
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
