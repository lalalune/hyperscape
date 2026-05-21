/**
 * VegetationGenPage
 * Combined page for procedural grass AND flower generation
 *
 * Features:
 * - Uses the EXACT same grass shaders as the game engine (from @hyperforge/procgen)
 * - GPU-instanced grass with 100k+ blades
 * - Procedural flowers with wind animation
 * - Real-time wind and day/night controls
 * - Biome presets
 * - Performance statistics
 *
 * This page shares code with the game engine to ensure visual consistency.
 */

import { GrassGen, FlowerGen } from "@hyperforge/procgen";
import {
  Leaf,
  Flower2,
  RefreshCw,
  Wind,
  Gauge,
  Sun,
  Moon,
  Palette,
  Download,
  Layers,
  Eye,
  EyeOff,
} from "lucide-react";
import React, { useRef, useEffect, useState, useCallback } from "react";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MeshStandardNodeMaterial } from "three/webgpu";

import { notify } from "@/utils/notify";
import {
  THREE,
  createWebGPURenderer,
  type AssetForgeRenderer,
} from "@/utils/webgpu-renderer";

// ============================================================================
// CONFIGURATION
// ============================================================================

interface VegetationConfig {
  // Grass
  grassEnabled: boolean;
  grassDensity: number; // blades per side (squared)
  grassTileSize: number;
  grassBladeHeight: number;
  grassBladeWidth: number;
  // Flowers
  flowersEnabled: boolean;
  flowerDensity: number;
  flowerTileSize: number;
  flowerMinScale: number;
  flowerMaxScale: number;
  // Wind
  windStrength: number;
  windSpeed: number;
  windGustSpeed: number;
  // Colors
  grassBaseColor: string;
  grassTipColor: string;
  // Day/Night
  dayNightMix: number;
}

const DEFAULT_CONFIG: VegetationConfig = {
  grassEnabled: true,
  grassDensity: 256, // 256x256 = 65k blades for preview
  grassTileSize: 40,
  grassBladeHeight: 0.5,
  grassBladeWidth: 0.04,
  flowersEnabled: true,
  flowerDensity: 32, // 32x32 = 1024 flowers
  flowerTileSize: 40,
  flowerMinScale: 0.15,
  flowerMaxScale: 0.25,
  windStrength: 0.05,
  windSpeed: 0.25,
  windGustSpeed: 0.1,
  // Colors from terrain shader
  grassBaseColor: "#426b1e", // rgb(0.26, 0.42, 0.12)
  grassTipColor: "#4a871f", // rgb(0.29, 0.53, 0.14)
  dayNightMix: 1.0,
};

const BIOME_PRESETS: Record<string, Partial<VegetationConfig>> = {
  plains: {
    grassDensity: 320,
    grassBladeHeight: 0.45,
    windStrength: 0.08,
    flowerDensity: 40,
    grassBaseColor: "#1FA862",
    grassTipColor: "#619e38",
  },
  forest: {
    grassDensity: 200,
    grassBladeHeight: 0.35,
    windStrength: 0.03,
    flowerDensity: 24,
    grassBaseColor: "#386b1a",
    grassTipColor: "#1FA862",
  },
  meadow: {
    grassDensity: 280,
    grassBladeHeight: 0.5,
    windStrength: 0.06,
    flowerDensity: 60, // Lots of flowers
    grassBaseColor: "#4a8c26",
    grassTipColor: "#5ea838",
  },
  savanna: {
    grassDensity: 180,
    grassBladeHeight: 0.7,
    windStrength: 0.12,
    flowerDensity: 16,
    grassBaseColor: "#6b8c3b",
    grassTipColor: "#8ca852",
  },
  swamp: {
    grassDensity: 220,
    grassBladeHeight: 0.55,
    windStrength: 0.02,
    flowerDensity: 20,
    grassBaseColor: "#386b1a",
    grassTipColor: "#4d7a26",
  },
  night: {
    grassDensity: 256,
    dayNightMix: 0.0,
    windStrength: 0.02,
  },
};

// ============================================================================
// GRASS SYSTEM - Game-accurate implementation
// ============================================================================

function createGrassSystem(
  config: VegetationConfig,
  scene: THREE.Scene,
): {
  mesh: THREE.InstancedMesh;
  uniforms: ReturnType<typeof GrassGen.createGameGrassUniforms>;
  dispose: () => void;
} {
  const uniforms = GrassGen.createGameGrassUniforms();

  // Update uniforms from config
  uniforms.uWindStrength.value = config.windStrength;
  uniforms.uWindSpeed.value = config.windSpeed;
  uniforms.uDayNightMix.value = config.dayNightMix;

  const baseColor = hexToColor(config.grassBaseColor);
  const tipColor = hexToColor(config.grassTipColor);
  uniforms.uBaseColor.value.copy(baseColor);
  uniforms.uTipColor.value.copy(tipColor);

  // Create grass material using game-accurate shader
  const { material } = GrassGen.createGameGrassMaterial({ uniforms });

  // Create instanced geometry
  const bladeGeometry = new THREE.PlaneGeometry(
    config.grassBladeWidth,
    config.grassBladeHeight,
    1,
    4,
  );

  // Shift origin to bottom
  const positions = bladeGeometry.attributes.position.array as Float32Array;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i + 1] += config.grassBladeHeight / 2;
  }
  bladeGeometry.attributes.position.needsUpdate = true;

  const instanceCount = config.grassDensity * config.grassDensity;
  const mesh = new THREE.InstancedMesh(bladeGeometry, material, instanceCount);
  mesh.frustumCulled = false;
  mesh.name = "GrassPreview";

  // Set up instance matrices (positions will be handled by shader)
  const dummy = new THREE.Object3D();
  for (let i = 0; i < instanceCount; i++) {
    dummy.position.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;

  scene.add(mesh);

  return {
    mesh,
    uniforms,
    dispose: () => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    },
  };
}

// ============================================================================
// FLOWER SYSTEM
// ============================================================================

function createFlowerSystem(
  config: VegetationConfig,
  scene: THREE.Scene,
): {
  mesh: THREE.InstancedMesh;
  uniforms: FlowerGen.FlowerMaterialUniforms;
  dispose: () => void;
} {
  const patchData = FlowerGen.generateFlowerPatch({
    flowersPerSide: config.flowerDensity,
    tileSize: config.flowerTileSize,
    appearance: {
      minScale: config.flowerMinScale,
      maxScale: config.flowerMaxScale,
      width: 0.5,
      height: 1.0,
    },
    seed: Date.now(),
  });

  const geometry = FlowerGen.createFlowerGeometry();
  const instancedGeometry = FlowerGen.attachFlowerInstanceAttributes(
    geometry,
    patchData,
  );

  const { material, uniforms } = FlowerGen.createFlowerMaterial({
    proceduralColors: true,
  });

  const mesh = new THREE.InstancedMesh(
    instancedGeometry,
    material,
    patchData.count,
  );
  mesh.frustumCulled = false;
  mesh.name = "FlowerPreview";
  mesh.position.y = 0.1; // Slightly above ground

  scene.add(mesh);

  return {
    mesh,
    uniforms,
    dispose: () => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    },
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

function hexToColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

// ============================================================================
// COMPONENT
// ============================================================================

export const VegetationGenPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<AssetForgeRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationRef = useRef<number>(0);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());

  // Systems
  const grassSystemRef = useRef<ReturnType<typeof createGrassSystem> | null>(
    null,
  );
  const flowerSystemRef = useRef<ReturnType<typeof createFlowerSystem> | null>(
    null,
  );
  const generateRef = useRef<(() => void) | null>(null);

  const [config, setConfig] = useState<VegetationConfig>(DEFAULT_CONFIG);
  const [selectedBiome, setSelectedBiome] = useState<string>("plains");
  const [stats, setStats] = useState<{
    grassBlades: number;
    flowers: number;
    fps: number;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Initialize scene with WebGPU
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
    camera.position.set(15, 8, 15);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);

    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x3d5a2c, 0.4);
    scene.add(hemiLight);

    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new MeshStandardNodeMaterial();
    groundMaterial.color = new THREE.Color(isDarkMode ? 0x2d4a1c : 0x3d5a2c);
    groundMaterial.roughness = 1;
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    scene.add(ground);

    // Grid helper
    const gridHelper = new THREE.GridHelper(100, 50, 0x444444, 0x333333);
    gridHelper.position.y = 0.005;
    scene.add(gridHelper);

    // Async WebGPU renderer initialization
    const initRenderer = async () => {
      const renderer = await createWebGPURenderer({
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

      // Generate initial vegetation
      generateRef.current?.();

      // Animation loop
      let frameCount = 0;
      let fpsAccumulator = 0;

      const animate = () => {
        if (!mounted) return;
        animationRef.current = requestAnimationFrame(animate);

        const delta = clockRef.current.getDelta();

        // Update flower animation
        if (flowerSystemRef.current) {
          FlowerGen.updateFlowerTime(
            flowerSystemRef.current.uniforms,
            clockRef.current.getElapsedTime(),
          );
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

      // Dispose systems
      grassSystemRef.current?.dispose();
      flowerSystemRef.current?.dispose();

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

  // Generate vegetation
  const generateVegetation = useCallback(() => {
    if (!sceneRef.current) return;

    setIsGenerating(true);

    // Dispose existing
    grassSystemRef.current?.dispose();
    flowerSystemRef.current?.dispose();
    grassSystemRef.current = null;
    flowerSystemRef.current = null;

    let grassBlades = 0;
    let flowers = 0;

    try {
      // Create grass
      if (config.grassEnabled) {
        grassSystemRef.current = createGrassSystem(config, sceneRef.current);
        grassBlades = config.grassDensity * config.grassDensity;
      }

      // Create flowers
      if (config.flowersEnabled) {
        flowerSystemRef.current = createFlowerSystem(config, sceneRef.current);
        flowers = config.flowerDensity * config.flowerDensity;
      }

      setStats({
        grassBlades,
        flowers,
        fps: 0,
      });

      notify.success(
        `Generated ${grassBlades.toLocaleString()} grass blades and ${flowers.toLocaleString()} flowers`,
      );
    } catch (error) {
      console.error("Failed to generate vegetation:", error);
      notify.error("Failed to generate vegetation");
    }

    setIsGenerating(false);
  }, [config]);

  // Keep ref updated
  useEffect(() => {
    generateRef.current = generateVegetation;
  }, [generateVegetation]);

  // Update uniforms when config changes (without regenerating)
  useEffect(() => {
    if (grassSystemRef.current) {
      const u = grassSystemRef.current.uniforms;
      u.uWindStrength.value = config.windStrength;
      u.uWindSpeed.value = config.windSpeed;
      u.uDayNightMix.value = config.dayNightMix;
      u.uBaseColor.value.set(config.grassBaseColor);
      u.uTipColor.value.set(config.grassTipColor);
    }
  }, [
    config.windStrength,
    config.windSpeed,
    config.dayNightMix,
    config.grassBaseColor,
    config.grassTipColor,
  ]);

  // Apply biome preset
  const applyBiomePreset = (biomeName: string) => {
    const preset = BIOME_PRESETS[biomeName];
    if (preset) {
      setConfig((prev) => ({ ...prev, ...preset }));
      setSelectedBiome(biomeName);
    }
  };

  // Update config
  const updateConfig = <K extends keyof VegetationConfig>(
    key: K,
    value: VegetationConfig[K],
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  // Export config
  const exportConfig = () => {
    const exportData = {
      config,
      biome: selectedBiome,
      timestamp: new Date().toISOString(),
    };
    const configJson = JSON.stringify(exportData, null, 2);
    const blob = new Blob([configJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vegetation-config-${selectedBiome}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success("Configuration exported");
  };

  return (
    <div className="flex h-[calc(100vh-44px)]">
      {/* Sidebar Controls */}
      <div className="w-80 bg-bg-secondary border-r border-border-primary overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Layers className="text-green-500" size={24} />
            <h1 className="text-lg font-semibold text-text-primary">
              Vegetation Generator
            </h1>
          </div>

          {/* Info Box */}
          <div className="bg-bg-tertiary rounded-md p-3 text-xs text-text-secondary">
            <p>
              <strong>Game-Accurate Preview:</strong> Uses the same grass
              shaders as the game engine for visual consistency.
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
              className="w-full bg-bg-tertiary border border-border-primary rounded-md px-5 py-4 text-sm text-text-primary"
            >
              {Object.keys(BIOME_PRESETS).map((biome) => (
                <option key={biome} value={biome}>
                  {biome.charAt(0).toUpperCase() + biome.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Grass Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
                <Leaf size={14} />
                Grass
              </h3>
              <button
                onClick={() =>
                  updateConfig("grassEnabled", !config.grassEnabled)
                }
                className="p-1 hover:bg-bg-tertiary rounded"
              >
                {config.grassEnabled ? (
                  <Eye size={16} className="text-green-500" />
                ) : (
                  <EyeOff size={16} className="text-text-tertiary" />
                )}
              </button>
            </div>

            {config.grassEnabled && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-text-tertiary">
                    Density: {config.grassDensity}² ={" "}
                    {(
                      config.grassDensity * config.grassDensity
                    ).toLocaleString()}{" "}
                    blades
                  </label>
                  <input
                    type="range"
                    min="64"
                    max="512"
                    step="32"
                    value={config.grassDensity}
                    onChange={(e) =>
                      updateConfig("grassDensity", parseInt(e.target.value))
                    }
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-xs text-text-tertiary">
                    Blade Height: {config.grassBladeHeight.toFixed(2)}m
                  </label>
                  <input
                    type="range"
                    min="0.2"
                    max="1.0"
                    step="0.05"
                    value={config.grassBladeHeight}
                    onChange={(e) =>
                      updateConfig(
                        "grassBladeHeight",
                        parseFloat(e.target.value),
                      )
                    }
                    className="w-full"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-xs text-text-tertiary w-20">
                    Base
                  </label>
                  <input
                    type="color"
                    value={config.grassBaseColor}
                    onChange={(e) =>
                      updateConfig("grassBaseColor", e.target.value)
                    }
                    className="w-10 h-8 rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-xs text-text-tertiary w-20">Tip</label>
                  <input
                    type="color"
                    value={config.grassTipColor}
                    onChange={(e) =>
                      updateConfig("grassTipColor", e.target.value)
                    }
                    className="w-10 h-8 rounded cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Flower Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
                <Flower2 size={14} />
                Flowers
              </h3>
              <button
                onClick={() =>
                  updateConfig("flowersEnabled", !config.flowersEnabled)
                }
                className="p-1 hover:bg-bg-tertiary rounded"
              >
                {config.flowersEnabled ? (
                  <Eye size={16} className="text-pink-500" />
                ) : (
                  <EyeOff size={16} className="text-text-tertiary" />
                )}
              </button>
            </div>

            {config.flowersEnabled && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-text-tertiary">
                    Density: {config.flowerDensity}² ={" "}
                    {(
                      config.flowerDensity * config.flowerDensity
                    ).toLocaleString()}{" "}
                    flowers
                  </label>
                  <input
                    type="range"
                    min="8"
                    max="80"
                    step="4"
                    value={config.flowerDensity}
                    onChange={(e) =>
                      updateConfig("flowerDensity", parseInt(e.target.value))
                    }
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-xs text-text-tertiary">
                    Scale: {config.flowerMinScale.toFixed(2)} -{" "}
                    {config.flowerMaxScale.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0.05"
                    max="0.5"
                    step="0.05"
                    value={config.flowerMaxScale}
                    onChange={(e) =>
                      updateConfig("flowerMaxScale", parseFloat(e.target.value))
                    }
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Wind Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
              <Wind size={14} />
              Wind
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-tertiary">
                  Strength: {config.windStrength.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="0.2"
                  step="0.01"
                  value={config.windStrength}
                  onChange={(e) =>
                    updateConfig("windStrength", parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs text-text-tertiary">
                  Speed: {config.windSpeed.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.05"
                  max="0.5"
                  step="0.05"
                  value={config.windSpeed}
                  onChange={(e) =>
                    updateConfig("windSpeed", parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Day/Night */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
              <Sun size={14} />
              Day/Night
            </h3>

            <div>
              <label className="text-xs text-text-tertiary">
                {config.dayNightMix > 0.5 ? "Day" : "Night"}:{" "}
                {(config.dayNightMix * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.dayNightMix}
                onChange={(e) =>
                  updateConfig("dayNightMix", parseFloat(e.target.value))
                }
                className="w-full"
              />
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={generateVegetation}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 ease-out"
          >
            <RefreshCw
              size={18}
              className={isGenerating ? "animate-spin" : ""}
            />
            {isGenerating ? "Generating..." : "Regenerate Vegetation"}
          </button>

          {/* Export Button */}
          <button
            onClick={exportConfig}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-bg-primary text-text-secondary rounded-md text-sm transition-colors ease-out"
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
                  <span className="text-text-tertiary">Grass:</span>
                  <span className="text-text-primary ml-2">
                    {stats.grassBlades.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-text-tertiary">Flowers:</span>
                  <span className="text-text-primary ml-2">
                    {stats.flowers.toLocaleString()}
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
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-bg-primary text-text-secondary rounded-md text-sm transition-colors ease-out"
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
