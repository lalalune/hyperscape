/**
 * setupWildernessOverlay — Hyperia PVP-zone visual construction.
 *
 * Phase 1.1 fifth carve from `TileBasedTerrain.tsx`. Follows the
 * `setupTerrainLighting` pattern (carve 4): a pure utility
 * function called inline from the parent's main setup useEffect,
 * not a hook with its own lifecycle. The wilderness overlay is
 * one-shot setup tied to the scene-construction effect — there's
 * no separate toggle prop to react to.
 *
 * The overlay is a Hyperia-specific gameplay visual: a
 * translucent red border-band marking the northern 30% of the
 * world as the PVP zone, plus a floating skull sprite at the
 * zone centroid. Non-Hyperia projects (arctic survival, tropical
 * sandbox, etc.) shouldn't see this — the parent gates the call
 * on `hyperiaContentEnabledRef.current` so the overlay never
 * enters the scene for those projects.
 *
 * Responsibility split:
 *   - This file owns: geometry construction (4 walls + outline +
 *     skull sprite), material/texture creation, scene-add, and
 *     `disposeWildernessOverlay` (walks the owned subtree
 *     disposing every geometry + material + texture).
 *   - Parent owns: deciding whether to call this at all (gated
 *     on Hyperia content), storing the returned ref for the
 *     animation loop, animating the skull sprite (bob + pulse
 *     per frame).
 */

import { MeshBasicNodeMaterial, LineBasicNodeMaterial } from "three/webgpu";

import { THREE } from "@/utils/webgpu-renderer";

/**
 * The owned scene-graph node — a THREE.Group with the skull
 * sprite attached as a side-channel property the parent reads
 * each frame to animate it.
 */
export type WildernessOverlay = THREE.Group & {
  skullSprite?: THREE.Sprite;
};

/**
 * Builds the wilderness zone visual and adds it to the scene.
 *
 * Construction:
 *   - 4 translucent red border walls (north/south/east/west of
 *     the wilderness rectangle, parented to a group)
 *   - 1 closed line tracing the top edge of the wilderness box
 *   - 1 floating skull sprite (canvas-textured 💀 emoji, with a
 *     red glow) centered over the zone
 *
 * The skull sprite is parented to the group (not directly to the
 * scene) so `disposeWildernessOverlay` reaches it via traversal.
 * Its reference is also parked on the group as `skullSprite` for
 * the parent's animation loop to read each frame.
 *
 * Wilderness occupies the northern `wildernessStartPercent` of
 * the world (hardcoded 0.3 — i.e. the most-northern 30%). With a
 * centered origin, that means Z values from `0` to
 * `worldCenter - worldSizeMeters * 0.3` are inside the zone.
 */
export function setupWildernessOverlay(
  scene: THREE.Scene,
  worldSize: number,
  tileSize: number,
): WildernessOverlay {
  const wildernessStartPercent = 0.3;
  const worldSizeMeters = worldSize * tileSize;
  const worldCenter = worldSizeMeters / 2;
  const wildernessBoundaryZ =
    worldCenter - worldSizeMeters * wildernessStartPercent;
  const wildernessDepth = wildernessBoundaryZ;
  const wildernessWidth = worldSizeMeters;
  const borderHeight = 8.0;
  const borderColor = 0xff0000;

  const wildernessGroup = new THREE.Group() as WildernessOverlay;

  // Border wall material — very transparent so terrain + grass
  // remain readable through it. Shared across all 4 walls.
  const borderWallMaterial = new MeshBasicNodeMaterial();
  borderWallMaterial.color = new THREE.Color(borderColor);
  borderWallMaterial.transparent = true;
  borderWallMaterial.opacity = 0.15;
  borderWallMaterial.side = THREE.DoubleSide;
  borderWallMaterial.depthWrite = false;

  // South wall — the main boundary line players cross.
  const southWallGeom = new THREE.PlaneGeometry(wildernessWidth, borderHeight);
  const southWall = new THREE.Mesh(southWallGeom, borderWallMaterial);
  southWall.position.set(0, borderHeight / 2, wildernessDepth / 2);
  southWall.rotation.y = Math.PI;
  wildernessGroup.add(southWall);

  // East wall.
  const eastWallGeom = new THREE.PlaneGeometry(wildernessDepth, borderHeight);
  const eastWall = new THREE.Mesh(eastWallGeom, borderWallMaterial);
  eastWall.position.set(wildernessWidth / 2, borderHeight / 2, 0);
  eastWall.rotation.y = -Math.PI / 2;
  wildernessGroup.add(eastWall);

  // West wall.
  const westWallGeom = new THREE.PlaneGeometry(wildernessDepth, borderHeight);
  const westWall = new THREE.Mesh(westWallGeom, borderWallMaterial);
  westWall.position.set(-wildernessWidth / 2, borderHeight / 2, 0);
  westWall.rotation.y = Math.PI / 2;
  wildernessGroup.add(westWall);

  // North wall — at z=0, the edge of world space.
  const northWallGeom = new THREE.PlaneGeometry(wildernessWidth, borderHeight);
  const northWall = new THREE.Mesh(northWallGeom, borderWallMaterial);
  northWall.position.set(0, borderHeight / 2, -wildernessDepth / 2);
  wildernessGroup.add(northWall);

  // Top-edge outline — single closed line around the top of the
  // wilderness rectangle.
  const lineMaterial = new LineBasicNodeMaterial();
  lineMaterial.color = new THREE.Color(borderColor);
  const topEdgePoints = [
    new THREE.Vector3(-wildernessWidth / 2, borderHeight, -wildernessDepth / 2),
    new THREE.Vector3(wildernessWidth / 2, borderHeight, -wildernessDepth / 2),
    new THREE.Vector3(wildernessWidth / 2, borderHeight, wildernessDepth / 2),
    new THREE.Vector3(-wildernessWidth / 2, borderHeight, wildernessDepth / 2),
    new THREE.Vector3(-wildernessWidth / 2, borderHeight, -wildernessDepth / 2),
  ];
  const topEdgeGeom = new THREE.BufferGeometry().setFromPoints(topEdgePoints);
  const topEdgeLine = new THREE.Line(topEdgeGeom, lineMaterial);
  wildernessGroup.add(topEdgeLine);

  // Position the whole group at the centered-origin offset,
  // lifted 12m above terrain.
  wildernessGroup.position.set(worldCenter, 12, wildernessDepth / 2);
  scene.add(wildernessGroup);

  // Floating skull sprite — canvas-textured emoji at the zone
  // centroid, with a red glow.
  const skullCanvas = document.createElement("canvas");
  const skullSize = 256;
  skullCanvas.width = skullSize;
  skullCanvas.height = skullSize;
  const skullCtx = skullCanvas.getContext("2d");
  if (skullCtx) {
    skullCtx.clearRect(0, 0, skullSize, skullSize);
    skullCtx.font = `${skullSize * 0.8}px serif`;
    skullCtx.textAlign = "center";
    skullCtx.textBaseline = "middle";
    skullCtx.fillText("💀", skullSize / 2, skullSize / 2);
    skullCtx.shadowColor = "rgba(255, 0, 0, 0.8)";
    skullCtx.shadowBlur = 20;
    skullCtx.fillText("💀", skullSize / 2, skullSize / 2);
  }
  const skullTexture = new THREE.CanvasTexture(skullCanvas);

  const skullMaterial = new THREE.SpriteMaterial({
    map: skullTexture,
    transparent: true,
    depthWrite: false,
  });
  const skullSprite = new THREE.Sprite(skullMaterial);
  const skullSpriteSize = 30.0;
  skullSprite.scale.set(skullSpriteSize, skullSpriteSize, 1);
  skullSprite.position.set(worldCenter, 50, wildernessDepth / 4);
  // Parent the skull to the group (not the scene) so dispose
  // traversal reaches it.
  wildernessGroup.add(skullSprite);

  // Side-channel: park the sprite reference on the group for the
  // parent's animation loop to read each frame.
  wildernessGroup.skullSprite = skullSprite;

  return wildernessGroup;
}

/**
 * Walk the wilderness Group disposing every owned geometry +
 * material + texture, then detach from the parent (scene).
 *
 * SpriteMaterial owns its texture as `.map` — the traversal
 * handles that. Line materials (LineBasicNodeMaterial) are also
 * handled — Three.js's THREE.Line.material is a single Material
 * not an array.
 */
export function disposeWildernessOverlay(group: WildernessOverlay): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
      child.geometry?.dispose();
      if (child.material instanceof THREE.Material) {
        // SpriteMaterial owns the canvas texture as `map`.
        const mat = child.material as THREE.Material & {
          map?: THREE.Texture;
        };
        mat.map?.dispose();
        child.material.dispose();
      }
    }
    if (child instanceof THREE.Line) {
      const lineMat = child.material;
      if (lineMat instanceof THREE.Material) lineMat.dispose();
    }
  });
  group.parent?.remove(group);
}
