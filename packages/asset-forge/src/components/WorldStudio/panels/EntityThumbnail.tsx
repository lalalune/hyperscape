/**
 * EntityThumbnail — Renders 3D model previews for Entity Palette items
 *
 * Uses a single shared offscreen WebGPU renderer to render each model once,
 * then caches the result as a data URL. Same pattern as UE5's Content Browser:
 * render-once-and-cache, not a live 3D viewport per item.
 *
 * Models are sourced from the GameWorldAssets cache (already loaded by
 * GameWorldEntitySync), so no extra network requests are needed.
 *
 * IMPORTANT: Cached materials from GameWorldAssets are compiled for the main
 * viewport's WebGPU renderer. They CANNOT be reused in a second renderer —
 * WebGPU node materials compile shaders per-device. We clone materials fresh
 * for each thumbnail render and dispose them after.
 */

import * as THREE from "three/webgpu";
import {
  WebGPURenderer,
  MeshStandardNodeMaterial,
  DirectionalLight,
  AmbientLight,
} from "three/webgpu";
import { useEffect, useState, useRef } from "react";

import {
  getNpcModel,
  getStationModel,
  getOreModel,
  getTreeSpeciesInstance,
} from "../../WorldBuilder/GameWorldAssets";

// ============== SHARED RENDERER (singleton) ==============

const THUMB_SIZE = 128;

let _renderer: WebGPURenderer | null = null;
let _initPromise: Promise<WebGPURenderer> | null = null;

/** Serialized render queue — WebGPU renders must not overlap */
let _renderQueue: Promise<void> = Promise.resolve();

async function getSharedRenderer(): Promise<WebGPURenderer> {
  if (_renderer) return _renderer;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const canvas = document.createElement("canvas");
    canvas.width = THUMB_SIZE;
    canvas.height = THUMB_SIZE;

    const renderer = new WebGPURenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    await renderer.init();
    renderer.setSize(THUMB_SIZE, THUMB_SIZE);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x1a1a2e, 1); // Dark blue-gray background

    _renderer = renderer;
    return renderer;
  })();

  return _initPromise;
}

// ============== THUMBNAIL CACHE ==============

const thumbnailCache = new Map<string, string>(); // key → data URL
const pendingRenders = new Map<string, Promise<string | null>>();

function cacheKey(category: string, templateId: string): string {
  return `${category}:${templateId}`;
}

// ============== MODEL → SCENE GROUP ==============

/**
 * Build a temporary model group with CLONED materials for thumbnail rendering.
 * Materials from GameWorldAssets are compiled for the main viewport renderer —
 * they cannot be reused in the offscreen thumbnail renderer.
 */
function buildModelGroup(
  category: string,
  templateId: string,
): { group: THREE.Group; dispose: () => void } | null {
  let modelData: {
    parts: Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }>;
    scale?: number;
    yOffset?: number;
    manifestScale?: number;
  } | null = null;

  if (category === "npcs") {
    modelData = getNpcModel(templateId);
  } else if (category === "stations") {
    modelData = getStationModel(templateId);
  } else if (category === "resources-mining") {
    modelData = getOreModel(templateId);
  } else if (category === "resources-woodcutting") {
    const tree = getTreeSpeciesInstance(templateId);
    if (tree) {
      modelData = { parts: tree.parts, scale: tree.manifestScale, yOffset: 0 };
    }
  } else if (category === "mob-spawns") {
    modelData = getNpcModel(templateId);
  }

  if (!modelData || modelData.parts.length === 0) return null;

  const group = new THREE.Group();
  const scale =
    modelData.scale ??
    (modelData as { manifestScale?: number }).manifestScale ??
    1;

  const clonedMaterials: THREE.Material[] = [];

  for (const part of modelData.parts) {
    // Clone the material so it compiles fresh for the thumbnail renderer.
    // A clone preserves all properties (color, textures, maps) but creates
    // a new instance that hasn't been compiled for any renderer yet.
    const mat = part.material.clone();
    clonedMaterials.push(mat);
    const mesh = new THREE.Mesh(part.geometry, mat);
    group.add(mesh);
  }

  group.scale.setScalar(scale);
  if (modelData.yOffset) group.position.y = modelData.yOffset;

  return {
    group,
    dispose: () => {
      for (const mat of clonedMaterials) {
        try {
          mat.dispose();
        } catch {
          /* WebGPU cleanup race */
        }
      }
    },
  };
}

// ============== RENDER THUMBNAIL ==============

/**
 * Render a single thumbnail. Serialized via _renderQueue to avoid
 * overlapping WebGPU render calls on the shared renderer.
 */
async function renderThumbnail(
  category: string,
  templateId: string,
): Promise<string | null> {
  const key = cacheKey(category, templateId);

  // Check cache
  const cached = thumbnailCache.get(key);
  if (cached) return cached;

  // Deduplicate concurrent renders for the same model
  const pending = pendingRenders.get(key);
  if (pending) return pending;

  const promise = new Promise<string | null>((resolve) => {
    // Chain onto the render queue so renders don't overlap
    _renderQueue = _renderQueue.then(async () => {
      try {
        const result = await doRender(category, templateId, key);
        resolve(result);
      } catch {
        resolve(null);
      }
    });
  });

  pendingRenders.set(key, promise);
  return promise;
}

async function doRender(
  category: string,
  templateId: string,
  key: string,
): Promise<string | null> {
  const built = buildModelGroup(category, templateId);
  if (!built) return null;

  const { group, dispose } = built;

  const renderer = await getSharedRenderer();

  // Fresh scene per render (avoids stale state from prior renders)
  const scene = new THREE.Scene();

  const dirLight = new DirectionalLight(0xffffff, 3.0);
  dirLight.position.set(3, 5, 4);
  scene.add(dirLight);

  const fillLight = new DirectionalLight(0x8899cc, 1.2);
  fillLight.position.set(-2, 3, -3);
  scene.add(fillLight);

  const ambient = new AmbientLight(0xffffff, 0.8);
  scene.add(ambient);

  scene.add(group);

  // Compute bounding box to frame the model
  const bbox = new THREE.Box3().setFromObject(group);
  const center = bbox.getCenter(new THREE.Vector3());
  const size = bbox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  if (maxDim === 0 || !isFinite(maxDim)) {
    dispose();
    return null;
  }

  // Position camera to frame the model — 3/4 view
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, maxDim * 20);
  const distance = maxDim * 2.2;
  camera.position.set(
    center.x + distance * 0.65,
    center.y + distance * 0.45,
    center.z + distance * 0.65,
  );
  camera.lookAt(center);
  camera.updateProjectionMatrix();

  // Render
  await renderer.renderAsync(scene, camera);

  // Read pixels to data URL
  const dataUrl = renderer.domElement.toDataURL("image/png");

  // Cleanup cloned materials
  dispose();

  // Cache
  thumbnailCache.set(key, dataUrl);
  pendingRenders.delete(key);

  return dataUrl;
}

// ============== FALLBACK (2D) THUMBNAILS ==============

/** Render abstract marker icon for entities without 3D models */
function renderFallbackThumbnail(category: string): string {
  const key = `fallback:${category}`;
  const cached = thumbnailCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = THUMB_SIZE;
  canvas.height = THUMB_SIZE;
  const ctx = canvas.getContext("2d")!;

  // Dark background matching 3D thumbnails
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, THUMB_SIZE, THUMB_SIZE);

  const COLORS: Record<string, string> = {
    npcs: "#a855f7",
    stations: "#FF7A00",
    "mob-spawns": "#E84A4A",
    "resources-mining": "#FF7A00",
    "resources-woodcutting": "#28D47A",
    "resources-fishing": "#06b6d4",
    "spawn-points": "#28D47A",
    teleports: "#6D3AFF",
    pois: "#ec4899",
    "water-bodies": "#06b6d4",
  };
  const color = COLORS[category] ?? "#7A7A82";

  const cx = THUMB_SIZE / 2;
  const cy = THUMB_SIZE / 2;
  const r = THUMB_SIZE * 0.28;

  // Glow
  const gradient = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.4);
  gradient.addColorStop(0, color + "30");
  gradient.addColorStop(1, "transparent");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, THUMB_SIZE, THUMB_SIZE);

  // Shape
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  if (category === "npcs" || category === "mob-spawns") {
    ctx.arc(cx, cy - r * 0.35, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.45, r * 0.5, r * 0.55, 0, Math.PI, 0);
    ctx.fill();
  } else if (category.startsWith("resources-")) {
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.7, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r * 0.7, cy);
    ctx.closePath();
    ctx.fill();
  } else if (category === "stations") {
    const s = r * 0.65;
    ctx.fillRect(cx - s, cy - s, s * 2, s * 2);
  } else if (category === "spawn-points") {
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.6, cy + r * 0.6);
    ctx.lineTo(cx - r * 0.6, cy + r * 0.6);
    ctx.closePath();
    ctx.fill();
  } else if (category === "teleports") {
    ctx.lineWidth = r * 0.25;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const dataUrl = canvas.toDataURL("image/png");
  thumbnailCache.set(key, dataUrl);
  return dataUrl;
}

// ============== REACT COMPONENT ==============

interface EntityThumbnailProps {
  category: string;
  templateId: string;
  className?: string;
}

export function EntityThumbnail({
  category,
  templateId,
  className = "",
}: EntityThumbnailProps) {
  const [src, setSrc] = useState<string | null>(() => {
    return thumbnailCache.get(cacheKey(category, templateId)) ?? null;
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const cached = thumbnailCache.get(cacheKey(category, templateId));
    if (cached) {
      setSrc(cached);
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const attempt = (isRetry = false) => {
      renderThumbnail(category, templateId).then((url) => {
        if (cancelled || !mountedRef.current) return;
        if (url) {
          setSrc(url);
        } else if (!isRetry) {
          // Model might still be loading (VRM files are large) — retry once
          retryTimer = setTimeout(() => {
            if (!cancelled && mountedRef.current) attempt(true);
          }, 3000);
        } else {
          setSrc(renderFallbackThumbnail(category));
        }
      });
    };
    attempt();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [category, templateId]);

  if (!src) {
    return (
      <img
        src={renderFallbackThumbnail(category)}
        alt=""
        className={`${className} object-contain`}
        draggable={false}
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      className={`${className} object-contain`}
      draggable={false}
    />
  );
}
