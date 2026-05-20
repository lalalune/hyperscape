/**
 * setupStudioWorldWater — studio-mode single world-sized water plane.
 *
 * Phase 1.1 next carve from `TileBasedTerrain.tsx`. In studio
 * mode we render one big water plane (one draw call) instead
 * of per-tile water meshes — way cheaper for the editor where
 * the user spends time staring at the same scene.
 *
 * The plane uses the game's shared Gerstner wave material via
 * `createEditorWaterMaterial` so the editor reflects how the
 * world will look in-game.
 *
 * Pattern mirrors `setupTerrainLighting` / `setupWildernessOverlay`:
 * one-shot setup utility, not a hook. The caller adds the plane
 * to its water container and stores the returned uniforms +
 * textures for animation + disposal.
 */

import * as THREE from "three/webgpu";

import {
  createEditorWaterMaterial,
  type EditorWaterUniforms,
} from "../EditorWaterMaterial";

export interface StudioWorldWater {
  /** The water plane mesh, already added to `container` by this function. */
  mesh: THREE.Mesh;
  /** Animation uniforms (time, etc.) — caller's animation loop pokes these. */
  uniforms: EditorWaterUniforms;
  /** Textures the material owns; caller disposes on unmount. */
  textures: ReturnType<typeof createEditorWaterMaterial>["textures"];
}

export interface StudioWorldWaterOptions {
  /** Number of tiles along one world edge. */
  readonly worldSize: number;
  /** World-units per tile. */
  readonly tileSize: number;
  /** Water surface height (Y coordinate). */
  readonly waterThreshold: number;
}

/**
 * Build a single world-sized water plane and add it to
 * `container`. Returns the mesh + uniforms + textures the
 * caller stores for later animation and disposal.
 */
export function setupStudioWorldWater(
  container: THREE.Object3D,
  { worldSize, tileSize, waterThreshold }: StudioWorldWaterOptions,
): StudioWorldWater {
  const worldSizeMeters = worldSize * tileSize;
  const geometry = new THREE.PlaneGeometry(
    worldSizeMeters,
    worldSizeMeters,
    128,
    128,
  );
  geometry.rotateX(-Math.PI / 2);
  const { material, uniforms, textures } = createEditorWaterMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(worldSizeMeters / 2, waterThreshold, worldSizeMeters / 2);
  container.add(mesh);
  return { mesh, uniforms, textures };
}
