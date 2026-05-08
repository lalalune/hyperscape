/**
 * setupTerrainLighting — game-parity scene lighting (hemisphere
 * + ambient + directional sun) construction.
 *
 * Phase 1.1 fourth carve from `TileBasedTerrain.tsx`. Unlike the
 * sky / fog / shadow extractions (which became hooks owning
 * effects), lighting is one-shot setup inside the main scene
 * effect — no separate lifecycle, no toggleable prop. So it
 * lives as a pure utility function the parent calls inline.
 *
 * The returned lights are added to the scene by this function;
 * the parent stores the refs and the animation loop reads them
 * for day-cycle interpolation (sun direction + intensity, hemi
 * sky/ground colors, ambient intensity all driven by
 * `updateSceneLighting` which the parent invokes per-frame).
 *
 * Shadow camera frustum + bias values match the game's
 * `HEMISPHERE_LIGHT` / `AMBIENT_LIGHT` / `SUN_LIGHT` constants
 * (shared package). Map size reduced from the game's 4096 to
 * 2048 — editor perf, since the editor frequently re-renders
 * the scene during gizmo drags.
 */

import { HEMISPHERE_LIGHT, AMBIENT_LIGHT, SUN_LIGHT } from "@hyperforge/shared";

import { THREE } from "@/utils/webgpu-renderer";

export interface TerrainLighting {
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  ambient: THREE.AmbientLight;
}

export interface SetupTerrainLightingOptions {
  /** Whether the scene is the World Studio (vs. standalone preview). */
  isStudioMode: boolean;
  /** Whether shadows are enabled (only consulted in studio mode). */
  enableShadows: boolean;
}

/**
 * Construct + add to scene + return the three lights.
 *
 * Sun position uses `SUN_LIGHT.DEFAULT_DIRECTION × 2000m` to put
 * the directional light far above the world; shadow camera
 * frustum is ±200m which covers the typical editor camera radius.
 *
 * Shadows: in non-studio (standalone preview / live game) the
 * sun always casts shadows. In studio mode shadows respect the
 * `enableShadows` toggle so users can disable them for perf
 * during heavy editing.
 */
export function setupTerrainLighting(
  scene: THREE.Scene,
  opts: SetupTerrainLightingOptions,
): TerrainLighting {
  // Game-parity: hemisphere + ambient + directional sun. Matches
  // shared `Environment.ts` initial values; the per-frame day-
  // cycle update interpolates them.
  const hemi = new THREE.HemisphereLight(
    HEMISPHERE_LIGHT.INITIAL_SKY_COLOR,
    HEMISPHERE_LIGHT.INITIAL_GROUND_COLOR,
    HEMISPHERE_LIGHT.INITIAL_INTENSITY,
  );
  hemi.name = "StudioHemisphereLight";
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(
    AMBIENT_LIGHT.INITIAL_COLOR,
    AMBIENT_LIGHT.INITIAL_INTENSITY,
  );
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(
    0xffffff,
    SUN_LIGHT.DAY_INTENSITY_MULTIPLIER,
  );
  sun.position.set(
    SUN_LIGHT.DEFAULT_DIRECTION[0] * 2000,
    SUN_LIGHT.DEFAULT_DIRECTION[1] * 2000,
    SUN_LIGHT.DEFAULT_DIRECTION[2] * 2000,
  );

  // Shadow camera + bias — matches the game's "med" shadow preset
  // values. Frustum ±200m covers typical editor camera radius;
  // 2048-map is half the game's 4096 (editor frequently re-renders
  // during gizmo drags so we trade resolution for frame budget).
  sun.castShadow = !opts.isStudioMode || opts.enableShadows;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 400;
  sun.shadow.camera.left = -200;
  sun.shadow.camera.right = 200;
  sun.shadow.camera.top = 200;
  sun.shadow.camera.bottom = -200;
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = 0.0002;
  sun.shadow.normalBias = 0.01;

  scene.add(sun);
  // sun.target is added separately so shadow-follow updates
  // (sun.target.position = camera.position in the animation loop)
  // affect the shadow frustum.
  scene.add(sun.target);

  return { sun, hemi, ambient };
}
