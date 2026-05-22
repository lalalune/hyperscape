/**
 * LandmarkGenPage
 * Procedural town landmark generator for HyperForge.
 *
 * Previews the various town decoration/prop meshes generated in-game by
 * ProceduralTownLandmarks.ts. Each landmark type builds simple Three.js
 * geometry (boxes, cylinders, spheres) directly in this page so the viewer
 * stays self-contained.
 *
 * Features:
 * - 8 landmark types (fence post, lamppost, well, bench, barrel, crate,
 *   market stall, signpost)
 * - Single and gallery (4x2 grid) view modes
 * - GLB export
 * - Per-type mesh stats (vertices, triangles, generation time)
 */

import { Landmark, RefreshCw, Download, Gauge, Grid3x3 } from "lucide-react";
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

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type LandmarkType =
  | "fence_post"
  | "lamppost"
  | "well"
  | "bench"
  | "barrel"
  | "crate"
  | "market_stall"
  | "signpost";

interface LandmarkInfo {
  type: LandmarkType;
  label: string;
  height: number;
}

const LANDMARK_TYPES: LandmarkInfo[] = [
  { type: "fence_post", label: "Fence Post", height: 1.2 },
  { type: "lamppost", label: "Lamppost", height: 4.1 },
  { type: "well", label: "Well", height: 3.0 },
  { type: "bench", label: "Bench", height: 0.9 },
  { type: "barrel", label: "Barrel", height: 1.0 },
  { type: "crate", label: "Crate", height: 0.55 },
  { type: "market_stall", label: "Market Stall", height: 2.4 },
  { type: "signpost", label: "Signpost", height: 2.6 },
];

// ---------------------------------------------------------------------------
// Material helpers
// ---------------------------------------------------------------------------

function mat(color: number, roughness = 0.85): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial();
  m.color = new THREE.Color(color);
  m.roughness = roughness;
  return m;
}

// ---------------------------------------------------------------------------
// Landmark mesh builders
// ---------------------------------------------------------------------------

function createFencePost(): THREE.Group {
  const group = new THREE.Group();
  const woodColor = 0x5c4028;

  const post = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 1.2, 0.12),
    mat(woodColor),
  );
  post.position.y = 0.6;
  group.add(post);

  const topRail = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 0.06, 0.08),
    mat(woodColor),
  );
  topRail.position.y = 1.05;
  group.add(topRail);

  const bottomRail = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 0.06, 0.08),
    mat(woodColor),
  );
  bottomRail.position.y = 0.4;
  group.add(bottomRail);

  return group;
}

function createLamppost(): THREE.Group {
  const group = new THREE.Group();
  const metalColor = 0x2e2e38;
  const glassColor = 0xffe680;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.16, 8),
    mat(metalColor, 0.7),
  );
  base.position.y = 0.08;
  group.add(base);

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.1, 2.9, 8),
    mat(metalColor, 0.7),
  );
  post.position.y = 0.16 + 1.45;
  group.add(post);

  const arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.65, 6),
    mat(metalColor, 0.7),
  );
  arm.position.set(0, 3.2, 0.32);
  arm.rotation.x = Math.PI / 2;
  group.add(arm);

  const lantern = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.19, 0.45, 8),
    mat(metalColor, 0.7),
  );
  lantern.position.set(0, 3.2, 0.65);
  group.add(lantern);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 8, 6),
    mat(glassColor, 0.3),
  );
  bulb.position.set(0, 3.2, 0.65);
  group.add(bulb);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.12, 8),
    mat(metalColor, 0.7),
  );
  roof.position.set(0, 3.2 + 0.28, 0.65);
  group.add(roof);

  return group;
}

function createWell(): THREE.Group {
  const group = new THREE.Group();
  const stoneColor = 0x737373;
  const woodColor = 0x5c4028;
  const waterColor = 0x224488;

  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.0, 0.9, 16, 1, true),
    mat(stoneColor),
  );
  wall.position.y = 0.45;
  group.add(wall);

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 16),
    mat(waterColor, 0.3),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.15;
  group.add(water);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(1.0, 0.08, 8, 24),
    mat(stoneColor),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.9;
  group.add(rim);

  for (const side of [-1, 1]) {
    const supportPost = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 1.8, 0.12),
      mat(woodColor),
    );
    supportPost.position.set(side * 0.85, 0.9 + 0.9, 0);
    group.add(supportPost);
  }

  const crossbar = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.1, 0.1),
    mat(woodColor),
  );
  crossbar.position.y = 2.7;
  group.add(crossbar);

  for (const side of [-1, 1]) {
    const roofPanel = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.08, 1.2),
      mat(woodColor),
    );
    roofPanel.position.set(0, 2.85, side * 0.45);
    roofPanel.rotation.x = side * -0.25;
    group.add(roofPanel);
  }

  return group;
}

function createBench(): THREE.Group {
  const group = new THREE.Group();
  const woodColor = 0x5c4028;

  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.06, 0.45),
    mat(woodColor),
  );
  seat.position.y = 0.45;
  group.add(seat);

  const back = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.4, 0.05),
    mat(woodColor),
  );
  back.position.set(0, 0.65, -0.2);
  group.add(back);

  for (const side of [-1, 1]) {
    const support = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.45, 0.45),
      mat(woodColor),
    );
    support.position.set(side * 0.72, 0.225, 0);
    group.add(support);
  }

  return group;
}

function createBarrel(): THREE.Group {
  const group = new THREE.Group();
  const woodColor = 0x6b4a2a;
  const metalColor = 0x555555;

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.28, 1.0, 12),
    mat(woodColor, 0.8),
  );
  body.position.y = 0.5;
  group.add(body);

  for (const y of [0.15, 0.5, 0.85]) {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.27, 0.015, 6, 16),
      mat(metalColor, 0.8),
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    group.add(band);
  }

  const lid = new THREE.Mesh(
    new THREE.CircleGeometry(0.26, 12),
    mat(woodColor, 0.8),
  );
  lid.rotation.x = -Math.PI / 2;
  lid.position.y = 1.0;
  group.add(lid);

  return group;
}

function createCrate(): THREE.Group {
  const group = new THREE.Group();
  const woodColor = 0x7a5c3a;
  const reinforceColor = 0x604830;

  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.55, 0.55),
    mat(woodColor),
  );
  box.position.y = 0.275;
  group.add(box);

  for (const x of [-0.32, 0.32]) {
    for (const z of [-0.24, 0.24]) {
      const corner = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.55, 0.06),
        mat(reinforceColor, 0.8),
      );
      corner.position.set(x, 0.275, z);
      group.add(corner);
    }
  }

  return group;
}

function createMarketStall(): THREE.Group {
  const group = new THREE.Group();
  const woodColor = 0x8c6640;
  const awningColor = 0xcc4444;

  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 0.08, 1.0),
    mat(woodColor, 0.75),
  );
  counter.position.y = 1.0;
  group.add(counter);

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 0.6, 0.04),
    mat(woodColor, 0.75),
  );
  panel.position.set(0, 0.7, 0.5);
  group.add(panel);

  for (const x of [-1.4, 1.4]) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8),
      mat(woodColor, 0.75),
    );
    pole.position.set(x, 1.2, -0.4);
    group.add(pole);
  }

  for (const x of [-1.4, 1.4]) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8),
      mat(woodColor, 0.75),
    );
    pole.position.set(x, 0.8, 0.5);
    group.add(pole);
  }

  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.04, 1.2),
    mat(awningColor, 0.75),
  );
  awning.position.set(0, 2.2, 0.05);
  awning.rotation.x = -0.25;
  group.add(awning);

  for (let i = 0; i < 3; i++) {
    const good = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.2, 0.3),
      mat(0x886644, 0.75),
    );
    good.position.set(-0.6 + i * 0.6, 1.14, -0.1);
    group.add(good);
  }

  return group;
}

function createSignpost(): THREE.Group {
  const group = new THREE.Group();
  const woodColor = 0x664d33;

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.08, 2.5, 8),
    mat(woodColor, 0.8),
  );
  post.position.y = 1.25;
  group.add(post);

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.22, 0.04),
    mat(woodColor, 0.8),
  );
  board.position.set(0.35, 2.2, 0);
  group.add(board);

  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.12, 8),
    mat(woodColor, 0.8),
  );
  cap.position.y = 2.56;
  group.add(cap);

  return group;
}

const LANDMARK_BUILDERS: Record<LandmarkType, () => THREE.Group> = {
  fence_post: createFencePost,
  lamppost: createLamppost,
  well: createWell,
  bench: createBench,
  barrel: createBarrel,
  crate: createCrate,
  market_stall: createMarketStall,
  signpost: createSignpost,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count vertices and triangles inside a Group hierarchy. */
function countGroupStats(group: THREE.Group): {
  vertices: number;
  triangles: number;
} {
  let vertices = 0;
  let triangles = 0;
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const geo = child.geometry as THREE.BufferGeometry;
      vertices += geo.attributes.position?.count ?? 0;
      const idx = geo.index;
      triangles += idx
        ? idx.count / 3
        : (geo.attributes.position?.count ?? 0) / 3;
    }
  });
  return { vertices, triangles: Math.round(triangles) };
}

/** Dispose every mesh in a group hierarchy. */
function disposeGroup(group: THREE.Group): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (child.material instanceof THREE.Material) {
        child.material.dispose();
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const LandmarkGenPage: React.FC = () => {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<HyperForgeRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const landmarkGroupRef = useRef<THREE.Group | null>(null);

  // State
  const [selectedType, setSelectedType] = useState<LandmarkType>("lamppost");
  const [showAll, setShowAll] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [stats, setStats] = useState<{
    vertices: number;
    triangles: number;
    time: number;
    meshCount: number;
  } | null>(null);

  // ---------- Scene init (runs once) ----------

  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;
    let animationId: number;
    const container = containerRef.current;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2d4a1c);
    sceneRef.current = scene;

    // Camera
    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 200);
    camera.position.set(5, 3, 5);
    cameraRef.current = camera;

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(8, 12, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 50;
    sun.shadow.camera.left = -15;
    sun.shadow.camera.right = 15;
    sun.shadow.camera.top = 15;
    sun.shadow.camera.bottom = -15;
    scene.add(sun);

    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x3a5a40, 0.35);
    scene.add(hemi);

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(30, 30);
    const groundMat = new MeshStandardNodeMaterial();
    groundMat.color = new THREE.Color(0x4a6b3a);
    groundMat.roughness = 0.95;
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid helper
    const grid = new THREE.GridHelper(30, 30, 0x4a6040, 0x3a5030);
    grid.position.y = 0.01;
    scene.add(grid);

    // Async WebGPU renderer init
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
      controls.target.set(0, 1.0, 0);
      controlsRef.current = controls;

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

      if (landmarkGroupRef.current && sceneRef.current) {
        sceneRef.current.remove(landmarkGroupRef.current);
        disposeGroup(landmarkGroupRef.current);
        landmarkGroupRef.current = null;
      }

      ground.geometry.dispose();
      groundMat.dispose();

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

  // ---------- Clear current landmark(s) ----------

  const clearLandmarks = useCallback(() => {
    if (!sceneRef.current || !landmarkGroupRef.current) return;
    sceneRef.current.remove(landmarkGroupRef.current);
    disposeGroup(landmarkGroupRef.current);
    landmarkGroupRef.current = null;
  }, []);

  // ---------- Generate ----------

  const generate = useCallback(() => {
    if (!sceneRef.current) return;

    setIsGenerating(true);
    const startTime = performance.now();

    clearLandmarks();

    const wrapper = new THREE.Group();
    wrapper.name = "landmarks";

    if (showAll) {
      // Gallery: 4 columns x 2 rows
      const cols = 4;
      const spacing = 5;
      LANDMARK_TYPES.forEach((info, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const builder = LANDMARK_BUILDERS[info.type];
        const group = builder();
        group.name = info.type;
        group.position.set(
          (col - (cols - 1) / 2) * spacing,
          0,
          (row - 0.5) * spacing,
        );
        group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        wrapper.add(group);
      });

      // Camera for gallery
      if (cameraRef.current && controlsRef.current) {
        cameraRef.current.position.set(0, 14, 18);
        controlsRef.current.target.set(0, 1.5, 0);
        controlsRef.current.update();
      }
    } else {
      // Single landmark
      const builder = LANDMARK_BUILDERS[selectedType];
      const group = builder();
      group.name = selectedType;
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      wrapper.add(group);

      // Camera adapts to landmark height
      const info = LANDMARK_TYPES.find((t) => t.type === selectedType);
      const targetHeight = info?.height ?? 2;
      const dist = Math.max(targetHeight * 2, 4);
      if (cameraRef.current && controlsRef.current) {
        cameraRef.current.position.set(dist, dist * 0.6, dist);
        controlsRef.current.target.set(0, targetHeight / 2, 0);
        controlsRef.current.update();
      }
    }

    sceneRef.current.add(wrapper);
    landmarkGroupRef.current = wrapper;

    // Compute stats
    const groupStats = countGroupStats(wrapper);
    let meshCount = 0;
    wrapper.traverse((child) => {
      if (child instanceof THREE.Mesh) meshCount++;
    });

    setStats({
      vertices: groupStats.vertices,
      triangles: groupStats.triangles,
      time: Math.round(performance.now() - startTime),
      meshCount,
    });

    setIsGenerating(false);
  }, [selectedType, showAll, clearLandmarks]);

  // ---------- Auto-generate on type / mode change ----------

  useEffect(() => {
    // Only generate once the renderer is ready (slight delay for first mount)
    const timer = setTimeout(() => {
      if (sceneRef.current) generate();
    }, 150);
    return () => clearTimeout(timer);
  }, [generate]);

  // ---------- Export GLB ----------

  const exportToGLB = useCallback(async () => {
    if (!landmarkGroupRef.current) {
      notify.error("Nothing to export");
      return;
    }

    try {
      const exporter = new GLTFExporter();
      const gltf = await exporter.parseAsync(landmarkGroupRef.current, {
        binary: true,
      });
      const blob = new Blob([gltf as ArrayBuffer], {
        type: "model/gltf-binary",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = showAll
        ? "landmarks_gallery.glb"
        : `landmark_${selectedType}.glb`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify.success("Landmark exported successfully");
    } catch (error) {
      console.error("Export error:", error);
      notify.error("Failed to export landmark");
    }
  }, [selectedType, showAll]);

  // ---------- Render ----------

  return (
    <div className="flex h-[calc(100vh-44px)]">
      {/* ---- Sidebar ---- */}
      <div className="w-80 flex-shrink-0 overflow-y-auto border-r border-border-primary bg-bg-secondary p-4 space-y-4">
        {/* Header */}
        <div>
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Landmark size={22} />
            Landmark Generator
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Town landmark props as used in-game. Same geometry as
            ProceduralTownLandmarks.
          </p>
        </div>

        {/* View mode toggle */}
        <div className="bg-bg-tertiary rounded-lg p-1 flex">
          <button
            className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              !showAll
                ? "bg-primary text-white"
                : "text-text-secondary hover:text-text-primary"
            } ease-out`}
            onClick={() => setShowAll(false)}
          >
            <Landmark size={14} />
            Single
          </button>
          <button
            className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              showAll
                ? "bg-primary text-white"
                : "text-text-secondary hover:text-text-primary"
            } ease-out`}
            onClick={() => setShowAll(true)}
          >
            <Grid3x3 size={14} />
            Gallery
          </button>
        </div>

        {/* Type selector (disabled in gallery mode) */}
        <div>
          <label className="block text-sm text-text-secondary mb-2">
            Landmark Type
          </label>
          <div className="space-y-1">
            {LANDMARK_TYPES.map((info) => (
              <button
                key={info.type}
                disabled={showAll}
                onClick={() => setSelectedType(info.type)}
                className={`w-full text-left px-5 py-4 rounded-md text-sm transition-all ${
                  showAll
                    ? "opacity-40 cursor-not-allowed bg-bg-tertiary text-text-secondary"
                    : selectedType === info.type
                      ? "bg-primary/20 text-primary border border-primary/40"
                      : "bg-bg-tertiary text-text-primary hover:bg-bg-tertiary/70 border border-transparent"
                } ease-out`}
              >
                <span className="font-medium">{info.label}</span>
                <span className="text-xs text-text-secondary ml-2">
                  {info.height}m
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-2">
          <button
            onClick={generate}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-all disabled:opacity-50 ease-out"
          >
            <RefreshCw
              size={16}
              className={isGenerating ? "animate-spin" : ""}
            />
            Generate
          </button>

          <button
            onClick={exportToGLB}
            disabled={!landmarkGroupRef.current}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-bg-tertiary text-text-secondary hover:text-text-primary rounded-lg transition-all disabled:opacity-50 ease-out"
          >
            <Download size={16} />
            Export GLB
          </button>
        </div>

        {/* Stats panel */}
        <div className="bg-bg-tertiary rounded-lg p-5 border border-border-primary">
          <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Gauge size={16} />
            Stats
          </h3>
          {stats ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-text-secondary">
                <span>Mode:</span>
                <span className="text-text-primary">
                  {showAll ? "Gallery (all 8)" : "Single"}
                </span>
              </div>
              {!showAll && (
                <div className="flex justify-between text-text-secondary">
                  <span>Type:</span>
                  <span className="text-text-primary">
                    {LANDMARK_TYPES.find((t) => t.type === selectedType)?.label}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-text-secondary">
                <span>Meshes:</span>
                <span className="text-text-primary">{stats.meshCount}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Vertices:</span>
                <span className="text-text-primary">
                  {stats.vertices.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Triangles:</span>
                <span className="text-text-primary">
                  {stats.triangles.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Gen time:</span>
                <span className="text-text-primary">{stats.time}ms</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-secondary italic">
              Generate a landmark to see stats
            </p>
          )}
        </div>

        {/* Landmark reference list */}
        <div className="bg-bg-tertiary rounded-lg p-5 border border-border-primary">
          <h3 className="font-semibold text-text-primary mb-3">Reference</h3>
          <div className="space-y-1.5 text-xs text-text-secondary">
            {LANDMARK_TYPES.map((info) => (
              <div key={info.type} className="flex justify-between">
                <span>{info.label}</span>
                <span className="text-text-primary font-mono">
                  {info.height}m
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Viewport ---- */}
      <div className="flex-1 relative">
        <div ref={containerRef} className="w-full h-full" />

        {/* Loading overlay */}
        {isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
              <span className="text-white text-sm">Generating...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { LandmarkGenPage };
export default LandmarkGenPage;
