/**
 * FogConfig - Central fog settings for the entire app
 *
 * Single source of truth for all fog-related constants.
 * Imported by Environment (scene fog), TerrainShader (terrain fog),
 * and any other system that needs fog parameters.
 *
 * DISTANCE GUIDELINES:
 * - Terrain VIEW_DISTANCE=1 → tiles load ~150m from player (~212m diagonal)
 * - Vegetation fades at FADE_END (shadow-dependent, typically 200-350m)
 * - Camera far plane is 800m
 * - Fog distances must overlap with rendered content to be visible
 */

import * as THREE from "../../../extras/three/three";

export const FOG_NEAR = 50;
export const FOG_FAR = 150;
export const FOG_COLOR_DEFAULT = "#d4c8b8";
export const FOG_COLOR_DAY = new THREE.Color(0xd4c8b8);
export const FOG_COLOR_NIGHT = new THREE.Color(0x2b3445);
