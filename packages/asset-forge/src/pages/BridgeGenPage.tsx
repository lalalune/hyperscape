/**
 * BridgeGenPage
 * Procedural bridge generator for HyperForge
 *
 * Features:
 * - Parametric parabolic arch deck surface
 * - Wood fence posts, rails, X-bracing, stringers, and joists
 * - Stone support pillars (base + shaft + capital)
 * - Bridge presets (short, standard, wide, long, flat, arched)
 * - Water plane and ground environment
 * - GLB export
 *
 * Geometry generation matches the in-game BridgeSystem mesh builder.
 */

import { BrickWall, RefreshCw, Download, Settings2, Gauge } from "lucide-react";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { MeshStandardNodeMaterial } from "three/webgpu";

import { notify } from "@/utils/notify";
import {
  THREE,
  createWebGPURenderer,
  type HyperForgeRenderer,
} from "@/utils/webgpu-renderer";

// ============================================================================
// BRIDGE CONSTANTS (from BridgeSystem.ts)
// ============================================================================

const FENCE_POST_SPACING = 2.0;
const FENCE_POST_SIZE = 0.2;
const FENCE_HEIGHT = 1.5;
const FENCE_CAP_OVERHANG = 0.06;
const FENCE_CAP_HEIGHT = 0.06;
const FENCE_RAIL_HEIGHTS = [0.3, 0.75, 1.2];
const FENCE_RAIL_HEIGHT = 0.08;
const FENCE_RAIL_DEPTH = 0.08;
const PILLAR_SPACING = 4.5;
const PILLAR_SIZE = 0.45;
const PILLAR_BASE_SIZE = 0.6;
const PILLAR_BASE_HEIGHT = 0.15;
const PILLAR_CAP_SIZE = 0.55;
const PILLAR_CAP_HEIGHT = 0.1;
const STRINGER_WIDTH = 0.18;
const STRINGER_HEIGHT = 0.22;
const JOIST_SPACING = 1.0;
const JOIST_WIDTH = 0.12;
const JOIST_HEIGHT = 0.16;
const XBRACE_SIZE = 0.05;

// ============================================================================
// PRESETS
// ============================================================================

const BRIDGE_PRESETS: Record<
  string,
  { label: string; length: number; width: number; archHeight: number }
> = {
  short: { label: "Short Bridge", length: 20, width: 4, archHeight: 0.8 },
  standard: {
    label: "Standard Bridge",
    length: 40,
    width: 4.5,
    archHeight: 1.2,
  },
  wide: { label: "Wide Bridge", length: 40, width: 6, archHeight: 1.0 },
  long: { label: "Long Bridge", length: 60, width: 4, archHeight: 1.5 },
  flat: { label: "Flat Crossing", length: 30, width: 5, archHeight: 0.2 },
  arched: { label: "High Arch", length: 40, width: 4, archHeight: 2.5 },
};

// ============================================================================
// GEOMETRY HELPERS
// ============================================================================

/**
 * Build an oriented box between two 3D points.
 * Used for rails, stringers, joists, and X-braces.
 */
function buildOrientedRail(
  x0: number,
  z0: number,
  y0: number,
  x1: number,
  z1: number,
  y1: number,
  width: number,
  height: number,
  perpX: number,
  perpZ: number,
): THREE.BufferGeometry {
  const hw = width / 2;
  const hh = height / 2;
  const verts = new Float32Array([
    x0 + perpX * hw,
    y0 - hh,
    z0 + perpZ * hw,
    x0 - perpX * hw,
    y0 - hh,
    z0 - perpZ * hw,
    x0 + perpX * hw,
    y0 + hh,
    z0 + perpZ * hw,
    x0 - perpX * hw,
    y0 + hh,
    z0 - perpZ * hw,
    x1 + perpX * hw,
    y1 - hh,
    z1 + perpZ * hw,
    x1 - perpX * hw,
    y1 - hh,
    z1 - perpZ * hw,
    x1 + perpX * hw,
    y1 + hh,
    z1 + perpZ * hw,
    x1 - perpX * hw,
    y1 + hh,
    z1 - perpZ * hw,
  ]);
  const indices = new Uint16Array([
    2, 6, 3, 3, 6, 7, 0, 1, 4, 1, 5, 4, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5, 0,
    2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6,
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Build the deck surface following a parabolic arch curve.
 */
function buildDeckGeometry(
  bridgeLen: number,
  width: number,
  archHeight: number,
  startY: number,
  endY: number,
): THREE.BufferGeometry {
  const lengthSteps = Math.max(8, Math.ceil(bridgeLen / 0.5));
  const widthSteps = Math.max(4, Math.ceil(width));
  const stride = widthSteps + 1;

  const vertices: number[] = [];
  const norms: number[] = [];
  const indices: number[] = [];

  const deckYAt = (t: number) =>
    startY + (endY - startY) * t + 4 * archHeight * t * (1 - t);

  for (let s = 0; s <= lengthSteps; s++) {
    const t = s / lengthSteps;
    const cx = bridgeLen * t;
    const y = deckYAt(t);
    for (let w = 0; w <= widthSteps; w++) {
      const wt = (w / widthSteps - 0.5) * width;
      vertices.push(cx, y, wt);
      norms.push(0, 1, 0);
    }
  }

  for (let s = 0; s < lengthSteps; s++) {
    for (let w = 0; w < widthSteps; w++) {
      const a = s * stride + w;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(norms, 3));
  geo.setIndex(indices);
  return geo;
}

/**
 * Merge multiple BufferGeometries into one by concatenating position/normal/index.
 */
function mergeGeometries(
  geometries: THREE.BufferGeometry[],
): THREE.BufferGeometry | null {
  if (geometries.length === 0) return null;
  if (geometries.length === 1) return geometries[0];

  let totalVerts = 0;
  let totalIdx = 0;
  for (const g of geometries) {
    totalVerts += g.attributes.position.count;
    totalIdx += g.index ? g.index.count : 0;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const indices: number[] = [];
  let vertexOffset = 0;

  for (const g of geometries) {
    const pos = g.attributes.position;
    const norm = g.attributes.normal;
    const count = pos.count;

    for (let i = 0; i < count * 3; i++) {
      positions[vertexOffset * 3 + i] = (pos.array as Float32Array)[i];
    }

    if (norm) {
      for (let i = 0; i < count * 3; i++) {
        normals[vertexOffset * 3 + i] = (norm.array as Float32Array)[i];
      }
    }

    if (g.index) {
      for (let i = 0; i < g.index.count; i++) {
        indices.push(g.index.array[i] + vertexOffset);
      }
    }

    vertexOffset += count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  merged.setIndex(indices);
  return merged;
}

// ============================================================================
// BRIDGE GENERATION
// ============================================================================

interface BridgeParams {
  length: number;
  width: number;
  archHeight: number;
  deckBaseHeight: number;
  waterLevel: number;
}

interface BridgeResult {
  group: THREE.Group;
  stats: { vertices: number; triangles: number };
}

function generateBridge(params: BridgeParams): BridgeResult {
  const {
    length: bridgeLen,
    width,
    archHeight,
    deckBaseHeight,
    waterLevel,
  } = params;
  const startY = deckBaseHeight;
  const endY = deckBaseHeight;
  const halfWidth = width / 2;
  const dirX = 1;
  const dirZ = 0;
  const perpX = 0;
  const perpZ = 1;

  const woodGeometries: THREE.BufferGeometry[] = [];
  const stoneGeometries: THREE.BufferGeometry[] = [];

  // 1. Deck
  const deckGeo = buildDeckGeometry(bridgeLen, width, archHeight, startY, endY);
  woodGeometries.push(deckGeo);

  // 2. Fence posts + caps (both sides)
  const postCount = Math.max(2, Math.floor(bridgeLen / FENCE_POST_SPACING) + 1);
  for (let p = 0; p < postCount; p++) {
    const t = p / (postCount - 1);
    const cx = bridgeLen * t;
    const arch = 4 * archHeight * t * (1 - t);
    const deckY = startY + (endY - startY) * t + arch;

    for (const side of [-1, 1]) {
      const pz = halfWidth * side;

      const postGeo = new THREE.BoxGeometry(
        FENCE_POST_SIZE,
        FENCE_HEIGHT,
        FENCE_POST_SIZE,
      );
      postGeo.translate(cx, deckY + FENCE_HEIGHT / 2, pz);
      woodGeometries.push(postGeo);

      const capSize = FENCE_POST_SIZE + FENCE_CAP_OVERHANG * 2;
      const capGeo = new THREE.BoxGeometry(capSize, FENCE_CAP_HEIGHT, capSize);
      capGeo.translate(cx, deckY + FENCE_HEIGHT + FENCE_CAP_HEIGHT / 2, pz);
      woodGeometries.push(capGeo);
    }
  }

  // 3. Horizontal rails
  for (let p = 0; p < postCount - 1; p++) {
    const t0 = p / (postCount - 1);
    const t1 = (p + 1) / (postCount - 1);
    const cx0 = bridgeLen * t0;
    const cx1 = bridgeLen * t1;
    const arch0 = 4 * archHeight * t0 * (1 - t0);
    const arch1 = 4 * archHeight * t1 * (1 - t1);
    const deckY0 = startY + arch0;
    const deckY1 = startY + arch1;

    for (const side of [-1, 1]) {
      for (const railH of FENCE_RAIL_HEIGHTS) {
        const rg = buildOrientedRail(
          cx0,
          halfWidth * side,
          deckY0 + railH,
          cx1,
          halfWidth * side,
          deckY1 + railH,
          FENCE_RAIL_DEPTH,
          FENCE_RAIL_HEIGHT,
          perpX,
          perpZ,
        );
        woodGeometries.push(rg);
      }
    }
  }

  // 4. Side stringers
  for (let p = 0; p < postCount - 1; p++) {
    const t0 = p / (postCount - 1);
    const t1 = (p + 1) / (postCount - 1);
    const cx0 = bridgeLen * t0;
    const cx1 = bridgeLen * t1;
    const arch0 = 4 * archHeight * t0 * (1 - t0);
    const arch1 = 4 * archHeight * t1 * (1 - t1);
    const deckY0 = startY + arch0;
    const deckY1 = startY + arch1;

    for (const side of [-1, 1]) {
      const sg = buildOrientedRail(
        cx0,
        halfWidth * side,
        deckY0 - STRINGER_HEIGHT / 2 - 0.03,
        cx1,
        halfWidth * side,
        deckY1 - STRINGER_HEIGHT / 2 - 0.03,
        STRINGER_WIDTH,
        STRINGER_HEIGHT,
        perpX,
        perpZ,
      );
      woodGeometries.push(sg);
    }
  }

  // 5. Cross joists
  const joistCount = Math.max(2, Math.floor(bridgeLen / JOIST_SPACING) + 1);
  for (let j = 0; j < joistCount; j++) {
    const t = j / (joistCount - 1);
    const cx = bridgeLen * t;
    const arch = 4 * archHeight * t * (1 - t);
    const deckY = startY + arch;
    const joistY = deckY - JOIST_HEIGHT / 2 - 0.03;
    const inset = STRINGER_WIDTH / 2;
    const jg = buildOrientedRail(
      cx,
      halfWidth - inset,
      joistY,
      cx,
      -(halfWidth - inset),
      joistY,
      JOIST_WIDTH,
      JOIST_HEIGHT,
      dirX,
      dirZ,
    );
    woodGeometries.push(jg);
  }

  // 6. X-bracing
  for (let p = 0; p < postCount - 1; p++) {
    const t0 = p / (postCount - 1);
    const t1 = (p + 1) / (postCount - 1);
    const cx0 = bridgeLen * t0;
    const cx1 = bridgeLen * t1;
    const arch0 = 4 * archHeight * t0 * (1 - t0);
    const arch1 = 4 * archHeight * t1 * (1 - t1);
    const deckY0 = startY + arch0;
    const deckY1 = startY + arch1;

    for (const side of [-1, 1]) {
      const pz = halfWidth * side;

      const d1 = buildOrientedRail(
        cx0,
        pz,
        deckY0 + FENCE_RAIL_HEIGHTS[0],
        cx1,
        pz,
        deckY1 + FENCE_RAIL_HEIGHTS[2],
        XBRACE_SIZE,
        XBRACE_SIZE,
        perpX,
        perpZ,
      );
      woodGeometries.push(d1);

      const d2 = buildOrientedRail(
        cx0,
        pz,
        deckY0 + FENCE_RAIL_HEIGHTS[2],
        cx1,
        pz,
        deckY1 + FENCE_RAIL_HEIGHTS[0],
        XBRACE_SIZE,
        XBRACE_SIZE,
        perpX,
        perpZ,
      );
      woodGeometries.push(d2);
    }
  }

  // 7. Stone support pillars
  const pillarCount = Math.max(2, Math.floor(bridgeLen / PILLAR_SPACING) + 1);
  for (let p = 0; p < pillarCount; p++) {
    const t = p / (pillarCount - 1);
    const tClamped = 0.1 + t * 0.8;
    const cx = bridgeLen * tClamped;
    const arch = 4 * archHeight * tClamped * (1 - tClamped);
    const deckY = startY + arch;

    const pillarTop = deckY - STRINGER_HEIGHT;
    const pillarBottom = waterLevel - 1.5;
    const pillarHeight = pillarTop - pillarBottom;
    if (pillarHeight < 0.5) continue;

    const baseGeo = new THREE.BoxGeometry(
      PILLAR_BASE_SIZE,
      PILLAR_BASE_HEIGHT,
      PILLAR_BASE_SIZE,
    );
    baseGeo.translate(cx, pillarBottom + PILLAR_BASE_HEIGHT / 2, 0);
    stoneGeometries.push(baseGeo);

    const shaftHeight = pillarHeight - PILLAR_BASE_HEIGHT - PILLAR_CAP_HEIGHT;
    const shaftGeo = new THREE.BoxGeometry(
      PILLAR_SIZE,
      shaftHeight,
      PILLAR_SIZE,
    );
    shaftGeo.translate(
      cx,
      pillarBottom + PILLAR_BASE_HEIGHT + shaftHeight / 2,
      0,
    );
    stoneGeometries.push(shaftGeo);

    const capGeo = new THREE.BoxGeometry(
      PILLAR_CAP_SIZE,
      PILLAR_CAP_HEIGHT,
      PILLAR_CAP_SIZE,
    );
    capGeo.translate(cx, pillarTop - PILLAR_CAP_HEIGHT / 2, 0);
    stoneGeometries.push(capGeo);
  }

  // Merge and create group
  const group = new THREE.Group();
  group.name = "bridge_preview";

  const woodMaterial = new MeshStandardNodeMaterial();
  woodMaterial.color = new THREE.Color(0.42, 0.28, 0.14);
  woodMaterial.roughness = 0.8;

  const stoneMaterial = new MeshStandardNodeMaterial();
  stoneMaterial.color = new THREE.Color(0.52, 0.48, 0.42);
  stoneMaterial.roughness = 0.9;

  if (woodGeometries.length > 0) {
    const merged = mergeGeometries(woodGeometries);
    for (const g of woodGeometries) g.dispose();
    if (merged) {
      const mesh = new THREE.Mesh(merged, woodMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }

  if (stoneGeometries.length > 0) {
    const merged = mergeGeometries(stoneGeometries);
    for (const g of stoneGeometries) g.dispose();
    if (merged) {
      const mesh = new THREE.Mesh(merged, stoneMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }

  // Center the bridge at origin (it was built from 0..length along X)
  group.position.x = -bridgeLen / 2;

  // Compute stats
  let totalVerts = 0;
  let totalTris = 0;
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      totalVerts += child.geometry.attributes.position.count;
      totalTris += (child.geometry.index?.count ?? 0) / 3;
    }
  });

  return { group, stats: { vertices: totalVerts, triangles: totalTris } };
}

// ============================================================================
// COMPONENT
// ============================================================================

export const BridgeGenPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<HyperForgeRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const bridgeGroupRef = useRef<THREE.Group | null>(null);
  const waterMeshRef = useRef<THREE.Mesh | null>(null);
  const groundMeshRef = useRef<THREE.Mesh | null>(null);
  const generateRef = useRef<(() => void) | null>(null);

  // Parameters
  const [preset, setPreset] = useState("standard");
  const [bridgeLength, setBridgeLength] = useState(40);
  const [bridgeWidth, setBridgeWidth] = useState(4.5);
  const [archHeight, setArchHeight] = useState(1.2);
  const [deckBaseHeight, setDeckBaseHeight] = useState(4);
  const [waterLevel, setWaterLevel] = useState(1.5);

  const [isGenerating, setIsGenerating] = useState(false);
  const [stats, setStats] = useState<{
    vertices: number;
    triangles: number;
    time: number;
  } | null>(null);

  // Apply preset
  const applyPreset = useCallback((key: string) => {
    const p = BRIDGE_PRESETS[key];
    if (p) {
      setPreset(key);
      setBridgeLength(p.length);
      setBridgeWidth(p.width);
      setArchHeight(p.archHeight);
    }
  }, []);

  // Generate bridge
  const handleGenerate = useCallback(() => {
    if (!sceneRef.current) return;

    setIsGenerating(true);
    const startTime = performance.now();

    // Remove previous bridge
    if (bridgeGroupRef.current) {
      sceneRef.current.remove(bridgeGroupRef.current);
      bridgeGroupRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
      bridgeGroupRef.current = null;
    }

    try {
      const result = generateBridge({
        length: bridgeLength,
        width: bridgeWidth,
        archHeight,
        deckBaseHeight,
        waterLevel,
      });

      sceneRef.current.add(result.group);
      bridgeGroupRef.current = result.group;

      // Update water plane position
      if (waterMeshRef.current) {
        waterMeshRef.current.position.y = waterLevel;
      }
      if (groundMeshRef.current) {
        groundMeshRef.current.position.y = waterLevel - 3;
      }

      // Position camera to see the full bridge
      if (cameraRef.current && controlsRef.current) {
        const viewDist = bridgeLength * 0.6;
        cameraRef.current.position.set(
          viewDist * 0.3,
          deckBaseHeight + viewDist * 0.3,
          viewDist * 0.5,
        );
        controlsRef.current.target.set(0, deckBaseHeight, 0);
        controlsRef.current.update();
      }

      setStats({
        vertices: result.stats.vertices,
        triangles: result.stats.triangles,
        time: Math.round(performance.now() - startTime),
      });
    } catch (error) {
      console.error("Bridge generation error:", error);
      notify.error("Bridge generation failed");
    }

    setIsGenerating(false);
  }, [bridgeLength, bridgeWidth, archHeight, deckBaseHeight, waterLevel]);

  // Keep generate ref current for init callback
  useEffect(() => {
    generateRef.current = handleGenerate;
  }, [handleGenerate]);

  // Export GLB
  const exportToGLB = useCallback(async () => {
    const group = bridgeGroupRef.current;
    if (!group) {
      notify.error("No bridge to export");
      return;
    }

    try {
      const exporter = new GLTFExporter();
      const gltf = await exporter.parseAsync(group, { binary: true });

      const blob = new Blob([gltf as ArrayBuffer], {
        type: "model/gltf-binary",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bridge_${preset}_${bridgeLength}m.glb`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      notify.success("Bridge exported successfully");
    } catch (error) {
      console.error("Export error:", error);
      notify.error("Failed to export bridge");
    }
  }, [preset, bridgeLength]);

  // Initialize Three.js scene with WebGPU
  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;
    let animationId: number;
    const container = containerRef.current;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a2332);
    sceneRef.current = scene;

    // Camera
    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 500);
    camera.position.set(15, 10, 20);
    cameraRef.current = camera;

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(20, 25, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 100;
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    scene.add(sun);

    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x3d5a2c, 0.3);
    scene.add(hemi);

    const fill = new THREE.DirectionalLight(0x6688cc, 0.3);
    fill.position.set(-10, 8, -10);
    scene.add(fill);

    // Water plane
    const waterGeo = new THREE.PlaneGeometry(200, 200);
    const waterMat = new MeshStandardNodeMaterial();
    waterMat.color = new THREE.Color(0x2255aa);
    waterMat.roughness = 0.3;
    waterMat.opacity = 0.6;
    waterMat.transparent = true;
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 1.5;
    water.receiveShadow = true;
    scene.add(water);
    waterMeshRef.current = water;

    // Ground
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new MeshStandardNodeMaterial();
    groundMat.color = new THREE.Color(0x5a4a3a);
    groundMat.roughness = 0.95;
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.5;
    ground.receiveShadow = true;
    scene.add(ground);
    groundMeshRef.current = ground;

    // Grid helper
    const grid = new THREE.GridHelper(100, 50, 0x444455, 0x333344);
    grid.position.y = 0.02;
    scene.add(grid);

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

      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.target.set(0, 4, 0);
      controls.update();
      controlsRef.current = controls;

      // Generate initial bridge
      generateRef.current?.();

      // Animation loop
      const animate = () => {
        if (!mounted) return;
        animationId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
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
      cancelAnimationFrame(animationId);

      // Dispose bridge
      if (bridgeGroupRef.current) {
        bridgeGroupRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (child.material instanceof THREE.Material) {
              child.material.dispose();
            }
          }
        });
        bridgeGroupRef.current = null;
      }

      // Dispose environment
      water.geometry.dispose();
      waterMat.dispose();
      ground.geometry.dispose();
      groundMat.dispose();

      // Dispose renderer
      if (rendererRef.current) {
        if (
          container &&
          rendererRef.current.domElement.parentNode === container
        ) {
          container.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current.dispose();
        rendererRef.current = null;
      }

      controlsRef.current?.dispose();
    };
  }, []);

  return (
    <div className="flex h-[calc(100vh-44px)]">
      {/* Sidebar Controls */}
      <div className="w-80 bg-bg-secondary border-r border-border-primary overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <BrickWall className="text-amber-500" size={24} />
            <h1 className="text-lg font-semibold text-text-primary">
              Bridge Generator
            </h1>
          </div>

          {/* Info Box */}
          <div className="bg-bg-tertiary rounded-md p-3 text-xs text-text-secondary">
            <p>
              Procedural bridge with wood deck, fence rails, stone pillars. Same
              mesh generation as in-game bridges.
            </p>
          </div>

          {/* Preset Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
              <Settings2 size={14} />
              Preset
            </label>
            <select
              value={preset}
              onChange={(e) => applyPreset(e.target.value)}
              className="w-full bg-bg-tertiary border border-border-primary rounded-md px-5 py-4 text-sm text-text-primary"
            >
              {Object.entries(BRIDGE_PRESETS).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Bridge Parameters */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
              <Settings2 size={14} />
              Bridge Parameters
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-tertiary">
                  Length: {bridgeLength}m
                </label>
                <input
                  type="range"
                  min="10"
                  max="80"
                  step="1"
                  value={bridgeLength}
                  onChange={(e) => setBridgeLength(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs text-text-tertiary">
                  Width: {bridgeWidth.toFixed(1)}m
                </label>
                <input
                  type="range"
                  min="2"
                  max="8"
                  step="0.5"
                  value={bridgeWidth}
                  onChange={(e) => setBridgeWidth(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs text-text-tertiary">
                  Arch Height: {archHeight.toFixed(1)}m
                </label>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="0.1"
                  value={archHeight}
                  onChange={(e) => setArchHeight(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Environment Parameters */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text-secondary">
              Environment
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-tertiary">
                  Deck Base Height: {deckBaseHeight.toFixed(1)}m
                </label>
                <input
                  type="range"
                  min="2"
                  max="8"
                  step="0.5"
                  value={deckBaseHeight}
                  onChange={(e) =>
                    setDeckBaseHeight(parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs text-text-tertiary">
                  Water Level: {waterLevel.toFixed(1)}m
                </label>
                <input
                  type="range"
                  min="0"
                  max="6"
                  step="0.5"
                  value={waterLevel}
                  onChange={(e) => setWaterLevel(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 ease-out"
          >
            <RefreshCw
              size={18}
              className={isGenerating ? "animate-spin" : ""}
            />
            {isGenerating ? "Generating..." : "Generate Bridge"}
          </button>

          {/* Export Button */}
          <button
            onClick={exportToGLB}
            disabled={!bridgeGroupRef.current}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-bg-primary text-text-secondary rounded-md text-sm transition-colors disabled:opacity-50 ease-out"
          >
            <Download size={16} />
            Export GLB
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
                  <span className="text-text-tertiary">Vertices:</span>
                  <span className="text-text-primary ml-2">
                    {stats.vertices.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-text-tertiary">Triangles:</span>
                  <span className="text-text-primary ml-2">
                    {stats.triangles.toLocaleString()}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-text-tertiary">Gen Time:</span>
                  <span className="text-text-primary ml-2">{stats.time}ms</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3D Viewport */}
      <div className="flex-1 relative">
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
};
