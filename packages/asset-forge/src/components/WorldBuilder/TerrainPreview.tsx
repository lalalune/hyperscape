/**
 * TerrainPreview - Real-time terrain visualization using @hyperforge/procgen
 *
 * Uses WebGPU renderer for TSL/node materials compatibility.
 */

import { TerrainGen, BuildingGen } from "@hyperforge/procgen";
import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
} from "react";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MeshStandardNodeMaterial, MeshBasicNodeMaterial } from "three/webgpu";

import {
  THREE,
  createWebGPURenderer,
  type AssetForgeRenderer,
} from "@/utils/webgpu-renderer";

export interface TerrainPreviewConfig {
  seed: number;
  worldSize: number; // In tiles (e.g., 10 = 10x10 tiles)
  tileSize: number;
  tileResolution: number;
  maxHeight: number;
  waterThreshold: number;
  preset?: string;

  // Noise configuration
  noiseScale: number;
  noiseOctaves: number;
  noisePersistence: number;
  noiseLacunarity: number;

  // Island configuration
  islandEnabled: boolean;
  islandFalloffStart: number;
  islandFalloffEnd: number;
  coastlineNoiseScale: number;
  coastlineNoiseAmount: number;

  // Biome configuration
  biomeNoiseScale: number;
  biomeBlendRadius: number;

  // Visualization options
  showWater: boolean;
  showBiomeColors: boolean;
  showGrid: boolean;
  showTowns: boolean;
  showVegetation: boolean;
  showGrass: boolean;
  wireframe: boolean;

  // Time of day (0-24, affects lighting)
  timeOfDay: number;

  // Grass settings
  grassDensity: number;
  grassHeight: number;
}

const DEFAULT_CONFIG: TerrainPreviewConfig = {
  seed: 12345,
  worldSize: 10,
  tileSize: 100,
  tileResolution: 32,
  maxHeight: 30,
  waterThreshold: 5.4,
  preset: "small-island",

  noiseScale: 0.005,
  noiseOctaves: 4,
  noisePersistence: 0.5,
  noiseLacunarity: 2.0,

  islandEnabled: true,
  islandFalloffStart: 0.4,
  islandFalloffEnd: 0.9,
  coastlineNoiseScale: 0.02,
  coastlineNoiseAmount: 0.1,

  biomeNoiseScale: 0.003,
  biomeBlendRadius: 200,

  showWater: true,
  showBiomeColors: true,
  showGrid: false,
  showTowns: true,
  showVegetation: false,
  showGrass: false,
  wireframe: false,

  // Time of day (0-24, 12 = noon)
  timeOfDay: 12,

  // Grass settings
  grassDensity: 5,
  grassHeight: 0.4,
};

interface TerrainPreviewProps {
  config: Partial<TerrainPreviewConfig>;
  className?: string;
}

const BIOME_COLORS: Record<string, THREE.Color> = {
  plains: new THREE.Color(0x7cba5f),
  forest: new THREE.Color(0x3a6b35),
  valley: new THREE.Color(0x5a8a4f),
  desert: new THREE.Color(0xc4a35a),
  tundra: new THREE.Color(0xb8c8c8),
  swamp: new THREE.Color(0x4a5a3a),
  mountains: new THREE.Color(0x8a8a8a),
  lakes: new THREE.Color(0x4a7ab8),
};

const TOWN_SIZE_COLORS: Record<string, number> = {
  town: 0xff0000,
  village: 0xff8800,
  hamlet: 0xffff00,
};

/**
 * Calculate lighting based on time of day (0-24 hours)
 * Returns { sunIntensity, ambientIntensity, sunColor, skyColor }
 */
function getTimeOfDayLighting(timeOfDay: number): {
  sunIntensity: number;
  ambientIntensity: number;
  sunColor: THREE.Color;
  skyColor: THREE.Color;
  sunPosition: THREE.Vector3;
} {
  // Normalize time to 0-1 where 0=midnight, 0.5=noon
  const normalizedTime = timeOfDay / 24;

  // Sun angle (sunrise at 6, noon at 12, sunset at 18)
  const sunAngle = (normalizedTime - 0.25) * Math.PI * 2;
  const sunHeight = Math.sin(sunAngle);
  const sunHorizontal = Math.cos(sunAngle);

  // Day intensity (0 at night, 1 at noon)
  const dayIntensity = Math.max(0, sunHeight);

  // Lighting intensities
  const sunIntensity = dayIntensity * 1.2;
  const ambientIntensity = 0.2 + dayIntensity * 0.3;

  // Sun color (warm at sunrise/sunset, white at noon)
  const horizonFactor = 1 - Math.abs(sunHeight);
  const sunColor = new THREE.Color().setRGB(
    1.0,
    0.9 + horizonFactor * 0.1 * (sunHeight > 0 ? -0.3 : 0),
    0.8 + horizonFactor * (sunHeight > 0 ? -0.4 : 0),
  );

  // Sky color based on time
  let skyColor: THREE.Color;
  if (dayIntensity > 0.1) {
    // Day - blue sky
    skyColor = new THREE.Color().setHSL(0.58, 0.6, 0.5 + dayIntensity * 0.3);
  } else {
    // Night - dark blue
    skyColor = new THREE.Color(0x0a0a20);
  }

  // Sun position
  const sunPosition = new THREE.Vector3(
    sunHorizontal * 200,
    Math.max(sunHeight * 200, 10),
    100,
  );

  return { sunIntensity, ambientIntensity, sunColor, skyColor, sunPosition };
}

/**
 * Create simple grass blade geometry
 */
function createGrassGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array([
    -0.02, 0, 0, 0.02, 0, 0, -0.01, 0.5, 0, 0.01, 0.5, 0, 0, 1, 0,
  ]);
  const indices = new Uint16Array([0, 1, 2, 1, 3, 2, 2, 3, 4]);

  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();

  return geometry;
}

/** Dispose a Three.js mesh and its resources */
function disposeMesh(mesh: THREE.Mesh | null, scene: THREE.Scene): void {
  if (!mesh) return;
  scene.remove(mesh);
  mesh.geometry.dispose();
  const mat = mesh.material;
  if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
  else mat.dispose();
}

export const TerrainPreview: React.FC<TerrainPreviewProps> = ({
  config: configOverrides,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<AssetForgeRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const terrainMeshRef = useRef<THREE.Mesh | null>(null);
  const waterMeshRef = useRef<THREE.Mesh | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const townMarkersRef = useRef<THREE.Group | null>(null);
  const grassMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const animationIdRef = useRef<number>(0);

  const [isGenerating, setIsGenerating] = useState(false);

  const config = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...configOverrides }),
    [configOverrides],
  );

  // Initialize Three.js scene with WebGPU
  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 10000);
    camera.position.set(500, 400, 500);
    cameraRef.current = camera;

    // Town markers group (add before renderer is ready)
    const townMarkers = new THREE.Group();
    scene.add(townMarkers);
    townMarkersRef.current = townMarkers;

    // Lighting (add before renderer is ready)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 200, 100);
    scene.add(directionalLight);
    directionalLightRef.current = directionalLight;

    // Async WebGPU initialization
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

      // Controls (after renderer is ready)
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 0, 0);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.maxPolarAngle = Math.PI / 2 - 0.1;
      controlsRef.current = controls;

      // Animation loop
      const animate = () => {
        if (!mounted) return;
        animationIdRef.current = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();
    };

    initRenderer();

    // Handle resize
    const handleResize = () => {
      if (!rendererRef.current) return;
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
      cancelAnimationFrame(animationIdRef.current);
      controlsRef.current?.dispose();
      if (rendererRef.current) {
        if (container.contains(rendererRef.current.domElement)) {
          container.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, []);

  const generateTerrain = useCallback(async () => {
    const scene = sceneRef.current;
    if (!scene) return;

    setIsGenerating(true);

    // Clean up old meshes
    disposeMesh(terrainMeshRef.current, scene);
    disposeMesh(waterMeshRef.current, scene);
    if (gridRef.current) scene.remove(gridRef.current);
    townMarkersRef.current?.clear();

    // Create terrain generator config
    const terrainConfig: Partial<TerrainGen.TerrainConfig> = {
      seed: config.seed,
      worldSize: config.worldSize,
      tileSize: config.tileSize,
      tileResolution: config.tileResolution,
      maxHeight: config.maxHeight,
      waterThreshold: config.waterThreshold,
      noise: {
        continent: {
          scale: config.noiseScale,
          weight: 1.0,
          octaves: config.noiseOctaves,
          persistence: config.noisePersistence,
          lacunarity: config.noiseLacunarity,
        },
        ridge: {
          scale: 0.003,
          weight: 0.3,
          octaves: 3,
        },
        hill: {
          scale: 0.01,
          weight: 0.2,
          octaves: 2,
        },
        erosion: {
          scale: 0.02,
          weight: -0.1,
          octaves: 2,
        },
        detail: {
          scale: 0.05,
          weight: 0.05,
          octaves: 1,
        },
      },
      island: {
        enabled: config.islandEnabled,
        maxWorldSizeTiles: config.worldSize,
        falloffTiles: Math.floor(
          config.worldSize * (1 - config.islandFalloffStart),
        ),
        edgeNoiseScale: config.coastlineNoiseScale,
        edgeNoiseStrength: config.coastlineNoiseAmount,
      },
      biomes: {
        gridSize: 5,
        jitter: 0.4,
        minInfluence: 100,
        maxInfluence: config.biomeBlendRadius,
        gaussianCoeff: 0.00001,
        boundaryNoiseScale: config.biomeNoiseScale,
        boundaryNoiseAmount: 0.2,
      },
    };

    // Create terrain generator
    const generator = new TerrainGen.TerrainGenerator(terrainConfig);

    // Generate heightmap for preview (single large tile)
    const worldSizeMeters = config.worldSize * config.tileSize;
    const halfWorld = worldSizeMeters / 2;
    const previewResolution = Math.min(
      256,
      config.worldSize * config.tileResolution,
    );

    // Create geometry
    const geometry = new THREE.PlaneGeometry(
      worldSizeMeters,
      worldSizeMeters,
      previewResolution - 1,
      previewResolution - 1,
    );
    geometry.rotateX(-Math.PI / 2);

    // Generate heights and colors
    const positions = geometry.attributes.position.array as Float32Array;
    const colors = new Float32Array(positions.length);
    const step = worldSizeMeters / (previewResolution - 1);

    for (let i = 0; i < previewResolution; i++) {
      for (let j = 0; j < previewResolution; j++) {
        const vertexIndex = i * previewResolution + j;
        const worldX = -halfWorld + j * step;
        const worldZ = -halfWorld + i * step;

        // Get height from generator
        const height = generator.getHeightAt(worldX, worldZ);
        positions[vertexIndex * 3 + 1] = height;

        // Get color
        let color: THREE.Color;
        if (config.showBiomeColors) {
          const query = generator.queryPoint(worldX, worldZ);
          color = BIOME_COLORS[query.biome] || BIOME_COLORS.plains;
        } else {
          // Height-based coloring
          const normalizedHeight = height / config.maxHeight;
          color = new THREE.Color().setHSL(
            0.3 - normalizedHeight * 0.3,
            0.7,
            0.5,
          );
        }

        colors[vertexIndex * 3] = color.r;
        colors[vertexIndex * 3 + 1] = color.g;
        colors[vertexIndex * 3 + 2] = color.b;
      }
    }

    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    // Create material
    const material = new MeshStandardNodeMaterial();
    material.vertexColors = true;
    material.flatShading = false;
    material.wireframe = config.wireframe;
    material.side = THREE.DoubleSide;

    // Create mesh
    const terrainMesh = new THREE.Mesh(geometry, material);
    scene.add(terrainMesh);
    terrainMeshRef.current = terrainMesh;

    // Add water plane
    if (config.showWater) {
      const waterGeom = new THREE.PlaneGeometry(
        worldSizeMeters,
        worldSizeMeters,
      );
      waterGeom.rotateX(-Math.PI / 2);
      const waterMat = new MeshStandardNodeMaterial();
      waterMat.color = new THREE.Color(0x4a90d9);
      waterMat.transparent = true;
      waterMat.opacity = 0.6;
      waterMat.side = THREE.DoubleSide;
      const waterMesh = new THREE.Mesh(waterGeom, waterMat);
      waterMesh.position.y = config.waterThreshold;
      scene.add(waterMesh);
      waterMeshRef.current = waterMesh;
    }

    // Add grid
    if (config.showGrid) {
      const grid = new THREE.GridHelper(
        worldSizeMeters,
        config.worldSize,
        0x444444,
        0x888888,
      );
      grid.position.y = 0.1;
      scene.add(grid);
      gridRef.current = grid;
    }

    // Generate and show towns
    if (config.showTowns && townMarkersRef.current) {
      // Use the terrain provider approach
      const townGen = new BuildingGen.TownGenerator({
        seed: config.seed,
        terrain: {
          getHeightAt: (x: number, z: number) => generator.getHeightAt(x, z),
          getBiomeAt: (x: number, z: number) =>
            generator.queryPoint(x, z).biome,
          getWaterThreshold: () => config.waterThreshold,
        },
        config: {
          townCount: 15,
          worldSize: worldSizeMeters,
          minTownSpacing: 400,
          waterThreshold: config.waterThreshold,
        },
      });

      for (const town of townGen.generate().towns) {
        const color = TOWN_SIZE_COLORS[town.size] ?? 0xffff00;
        const { x, y, z } = town.position;

        // Cone marker
        const markerMat = new MeshBasicNodeMaterial();
        markerMat.color = new THREE.Color(color);
        const marker = new THREE.Mesh(
          new THREE.ConeGeometry(10, 30, 8),
          markerMat,
        );
        marker.position.set(x, y + 20, z);
        marker.rotation.x = Math.PI;
        townMarkersRef.current.add(marker);

        // Safe zone ring
        const ringMat = new MeshBasicNodeMaterial();
        ringMat.color = new THREE.Color(color);
        ringMat.side = THREE.DoubleSide;
        ringMat.transparent = true;
        ringMat.opacity = 0.3;
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(
            town.safeZoneRadius - 2,
            town.safeZoneRadius,
            32,
          ),
          ringMat,
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, y + 0.5, z);
        townMarkersRef.current.add(ring);
      }
    }

    // Generate grass
    if (config.showGrass) {
      // Dispose old grass
      if (grassMeshRef.current) {
        scene.remove(grassMeshRef.current);
        grassMeshRef.current.geometry.dispose();
        if (grassMeshRef.current.material instanceof THREE.Material) {
          grassMeshRef.current.material.dispose();
        }
      }

      const grassGeometry = createGrassGeometry();
      const grassMaterial = new MeshStandardNodeMaterial();
      grassMaterial.color = new THREE.Color(0x4d8c26); // Match terrain grass green
      grassMaterial.side = THREE.DoubleSide;

      // Calculate grass count based on density and world size
      const grassPerSqMeter = config.grassDensity;
      const grassArea = worldSizeMeters * worldSizeMeters;
      const grassCount = Math.min(
        Math.floor(grassArea * grassPerSqMeter * 0.01),
        100000,
      );

      const grassMesh = new THREE.InstancedMesh(
        grassGeometry,
        grassMaterial,
        grassCount,
      );
      const dummy = new THREE.Object3D();

      // Seeded random for consistent placement
      let seed = config.seed;
      const random = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };

      let placed = 0;
      for (let i = 0; i < grassCount * 2 && placed < grassCount; i++) {
        const x = (random() - 0.5) * worldSizeMeters;
        const z = (random() - 0.5) * worldSizeMeters;
        const height = generator.getHeightAt(x, z);

        // Only place grass above water and below snow line
        if (
          height > config.waterThreshold + 0.5 &&
          height < config.maxHeight * 0.8
        ) {
          dummy.position.set(x, height, z);
          dummy.rotation.y = random() * Math.PI * 2;
          const scale = config.grassHeight * (0.7 + random() * 0.6);
          dummy.scale.set(scale, scale, scale);
          dummy.updateMatrix();
          grassMesh.setMatrixAt(placed, dummy.matrix);
          placed++;
        }
      }

      grassMesh.count = placed;
      grassMesh.instanceMatrix.needsUpdate = true;
      scene.add(grassMesh);
      grassMeshRef.current = grassMesh;
    }

    // Update camera to fit terrain
    if (cameraRef.current && controlsRef.current) {
      const distance = worldSizeMeters * 0.8;
      cameraRef.current.position.set(
        distance * 0.7,
        distance * 0.5,
        distance * 0.7,
      );
      controlsRef.current.target.set(0, config.maxHeight / 2, 0);
      controlsRef.current.update();
    }

    setIsGenerating(false);
  }, [config]);

  // Regenerate terrain when config changes
  useEffect(() => {
    const timeoutId = setTimeout(generateTerrain, 100);
    return () => clearTimeout(timeoutId);
  }, [generateTerrain]);

  // Update lighting when time of day changes (without regenerating terrain)
  useEffect(() => {
    const lighting = getTimeOfDayLighting(config.timeOfDay);

    if (directionalLightRef.current) {
      directionalLightRef.current.intensity = lighting.sunIntensity;
      directionalLightRef.current.color.copy(lighting.sunColor);
      directionalLightRef.current.position.copy(lighting.sunPosition);
    }

    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = lighting.ambientIntensity;
    }

    if (sceneRef.current) {
      sceneRef.current.background = lighting.skyColor;
    }
  }, [config.timeOfDay]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div ref={containerRef} className="w-full h-full" />
      {isGenerating && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-white text-lg">Generating terrain...</div>
        </div>
      )}
    </div>
  );
};

interface TerrainControlsProps {
  config: TerrainPreviewConfig;
  onChange: (config: TerrainPreviewConfig) => void;
}

export const TerrainControls: React.FC<TerrainControlsProps> = ({
  config,
  onChange,
}) => {
  const updateConfig = useCallback(
    (updates: Partial<TerrainPreviewConfig>) => {
      onChange({ ...config, ...updates });
    },
    [config, onChange],
  );

  const presetIds = TerrainGen.listPresetIds();

  return (
    <div className="space-y-4 p-4 bg-bg-secondary rounded-lg overflow-y-auto max-h-[600px]">
      {/* Preset Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-text-primary">Preset</label>
        <select
          value={config.preset || ""}
          onChange={(e) => {
            if (e.target.value) {
              const presetConfig = TerrainGen.createConfigFromPreset(
                e.target.value,
                { seed: config.seed },
              );
              updateConfig({
                preset: e.target.value,
                worldSize: presetConfig.worldSize,
                maxHeight: presetConfig.maxHeight,
                waterThreshold: presetConfig.waterThreshold,
                noiseScale:
                  presetConfig.noise?.continent?.scale ?? config.noiseScale,
                islandEnabled:
                  presetConfig.island?.enabled ?? config.islandEnabled,
              });
            }
          }}
          className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
        >
          <option value="">Custom</option>
          {presetIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>

      {/* Seed */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-text-primary">Seed</label>
        <div className="flex gap-2">
          <input
            type="number"
            value={config.seed}
            onChange={(e) =>
              updateConfig({ seed: parseInt(e.target.value, 10) || 0 })
            }
            className="flex-1 px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary"
          />
          <button
            onClick={() =>
              updateConfig({ seed: Math.floor(Math.random() * 100000) })
            }
            className="px-3 py-2 bg-primary text-white rounded text-sm hover:bg-primary-dark"
          >
            Random
          </button>
        </div>
      </div>

      {/* World Size */}
      <SliderControl
        label="World Size (tiles)"
        value={config.worldSize}
        min={5}
        max={50}
        step={1}
        onChange={(v) => updateConfig({ worldSize: v })}
      />

      {/* Max Height */}
      <SliderControl
        label="Max Height"
        value={config.maxHeight}
        min={10}
        max={100}
        step={5}
        onChange={(v) => updateConfig({ maxHeight: v })}
      />

      {/* Water Threshold */}
      <SliderControl
        label="Water Level"
        value={config.waterThreshold}
        min={0}
        max={20}
        step={0.5}
        onChange={(v) => updateConfig({ waterThreshold: v })}
      />

      {/* Noise Settings */}
      <div className="border-t border-border-primary pt-4 mt-4">
        <h4 className="text-sm font-medium text-text-primary mb-3">Noise</h4>
        <div className="space-y-3">
          <SliderControl
            label="Scale"
            value={config.noiseScale}
            min={0.001}
            max={0.02}
            step={0.001}
            onChange={(v) => updateConfig({ noiseScale: v })}
          />
          <SliderControl
            label="Octaves"
            value={config.noiseOctaves}
            min={1}
            max={8}
            step={1}
            onChange={(v) => updateConfig({ noiseOctaves: v })}
          />
          <SliderControl
            label="Persistence"
            value={config.noisePersistence}
            min={0.1}
            max={0.9}
            step={0.05}
            onChange={(v) => updateConfig({ noisePersistence: v })}
          />
          <SliderControl
            label="Lacunarity"
            value={config.noiseLacunarity}
            min={1.5}
            max={3}
            step={0.1}
            onChange={(v) => updateConfig({ noiseLacunarity: v })}
          />
        </div>
      </div>

      {/* Island Settings */}
      <div className="border-t border-border-primary pt-4 mt-4">
        <h4 className="text-sm font-medium text-text-primary mb-3">Island</h4>
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.islandEnabled}
              onChange={(e) =>
                updateConfig({ islandEnabled: e.target.checked })
              }
              className="rounded"
            />
            <span className="text-sm text-text-primary">
              Enable Island Mask
            </span>
          </label>
          {config.islandEnabled && (
            <>
              <SliderControl
                label="Falloff Start"
                value={config.islandFalloffStart}
                min={0.1}
                max={0.8}
                step={0.05}
                onChange={(v) => updateConfig({ islandFalloffStart: v })}
              />
              <SliderControl
                label="Falloff End"
                value={config.islandFalloffEnd}
                min={0.5}
                max={1.0}
                step={0.05}
                onChange={(v) => updateConfig({ islandFalloffEnd: v })}
              />
              <SliderControl
                label="Coastline Noise"
                value={config.coastlineNoiseAmount}
                min={0}
                max={0.3}
                step={0.02}
                onChange={(v) => updateConfig({ coastlineNoiseAmount: v })}
              />
            </>
          )}
        </div>
      </div>

      {/* Visualization Options */}
      <div className="border-t border-border-primary pt-4 mt-4">
        <h4 className="text-sm font-medium text-text-primary mb-3">
          Visualization
        </h4>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.showWater}
              onChange={(e) => updateConfig({ showWater: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm text-text-primary">Show Water</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.showBiomeColors}
              onChange={(e) =>
                updateConfig({ showBiomeColors: e.target.checked })
              }
              className="rounded"
            />
            <span className="text-sm text-text-primary">Show Biome Colors</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.showGrid}
              onChange={(e) => updateConfig({ showGrid: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm text-text-primary">Show Grid</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.showTowns}
              onChange={(e) => updateConfig({ showTowns: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm text-text-primary">Show Towns</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.wireframe}
              onChange={(e) => updateConfig({ wireframe: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm text-text-primary">Wireframe</span>
          </label>
        </div>
      </div>
    </div>
  );
};

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

const SliderControl: React.FC<SliderControlProps> = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
}) => {
  const decimals = step < 0.01 ? 3 : step < 1 ? 2 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <label className="text-xs text-text-secondary">{label}</label>
        <span className="text-xs text-text-muted">
          {value.toFixed(decimals)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  );
};

export default TerrainPreview;
