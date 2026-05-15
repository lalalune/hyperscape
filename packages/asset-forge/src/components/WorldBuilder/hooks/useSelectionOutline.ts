/**
 * `useSelectionOutline` — wireframe-box selection indicator
 * lifecycle for the World Builder viewport.
 *
 * Phase 1.1 sixth carve from TileBasedTerrain.tsx. Cleanly
 * scoped: one useEffect keyed on `selectedId`, owning a single
 * mesh in the scene (UE5-style light-blue wireframe box) and
 * managing label visibility for the previously-selected entity.
 *
 * Two concerns owned by this hook:
 *   1. Label visibility — when selection changes, hide labels
 *      on the previously-selected entity and show labels on the
 *      newly-selected one. `selectedLabelRef` is shared with the
 *      parent (the animation loop reads it each frame for
 *      screen-space label sizing).
 *   2. Outline mesh — create / dispose a `BoxGeometry +
 *      MeshBasicNodeMaterial` wireframe sized to the selected
 *      object's bounding box, padded ~15% of object diagonal
 *      (capped at 2m), rendered on top via `renderOrder = 999`
 *      with `depthTest = false`.
 *
 * Concern owned by parent: maintaining `selectableObjectsRef` —
 * the array of currently-selectable scene objects. The hook
 * reads it at effect-run time to find the object matching
 * `selectedId`.
 */

import { useEffect, useRef, type RefObject } from "react";
import { MeshBasicNodeMaterial } from "three/webgpu";

import { THREE } from "@/utils/webgpu-renderer";

export interface SelectionOutlineHostRefs {
  sceneRef: RefObject<THREE.Scene | null>;
  /** Mutable list of currently-selectable objects in the scene. */
  selectableObjectsRef: RefObject<THREE.Object3D[]>;
  /**
   * Reference to the currently-selected entity (set by this
   * hook, read by the parent's animation loop for label
   * screen-space sizing). The hook writes; the parent reads.
   */
  selectedLabelRef: RefObject<THREE.Object3D | null>;
}

export interface UseSelectionOutlineResult {
  /**
   * The wireframe-box mesh currently visualizing the selection,
   * or null when nothing is selected. Returned for parity with
   * the prior monolith API; current consumers don't read it.
   */
  selectionOutlineRef: RefObject<THREE.Mesh | null>;
}

/** UE5-style light-blue wireframe color. */
const SELECTION_OUTLINE_COLOR = 0x4fc3f7;
/** Padding fraction of the selected object's diagonal. */
const SELECTION_PADDING_FRACTION = 0.15;
/** Maximum padding regardless of object size (meters). */
const SELECTION_PADDING_MAX_M = 2;

function disposeOutline(
  scene: THREE.Scene | null,
  outline: THREE.Mesh | null,
): void {
  if (!outline) return;
  scene?.remove(outline);
  outline.geometry.dispose();
  if (outline.material instanceof THREE.Material) {
    outline.material.dispose();
  }
}

function hideLabelsOn(target: THREE.Object3D | null): void {
  if (!target) return;
  for (const child of target.children) {
    if (child.userData?.isLabel) child.visible = false;
  }
}

function showLabelsOn(target: THREE.Object3D): void {
  for (const child of target.children) {
    if (child.userData?.isLabel) child.visible = true;
  }
}

/**
 * Build the wireframe-box outline mesh sized to the supplied
 * object's bounding box. Returns null if the bounding box is
 * empty (e.g. the object has no renderable geometry yet).
 */
function buildOutlineForObject(
  selectedObject: THREE.Object3D,
): THREE.Mesh | null {
  const box = new THREE.Box3().setFromObject(selectedObject);
  if (box.isEmpty()) return null;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // Padding scales with object size; capped at SELECTION_PADDING_MAX_M.
  const padding = Math.min(
    size.length() * SELECTION_PADDING_FRACTION,
    SELECTION_PADDING_MAX_M,
  );

  const outlineGeometry = new THREE.BoxGeometry(
    size.x + padding,
    size.y + padding,
    size.z + padding,
  );
  const outlineMaterial = new MeshBasicNodeMaterial();
  outlineMaterial.color = new THREE.Color(SELECTION_OUTLINE_COLOR);
  outlineMaterial.wireframe = true;
  outlineMaterial.transparent = true;
  outlineMaterial.opacity = 0.9;
  outlineMaterial.depthTest = false;
  const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
  outline.position.copy(center);
  outline.renderOrder = 999;
  return outline;
}

export function useSelectionOutline(opts: {
  /** Currently-selected entity id. null/undefined → no selection. */
  selectedId: string | null | undefined;
  hostRefs: SelectionOutlineHostRefs;
}): UseSelectionOutlineResult {
  const { selectedId, hostRefs } = opts;
  const selectionOutlineRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    const scene = hostRefs.sceneRef.current;

    // Always hide labels on the previously-selected entity first.
    hideLabelsOn(hostRefs.selectedLabelRef.current);
    hostRefs.selectedLabelRef.current = null;

    // Nothing selected (or scene not ready) → drop any existing outline.
    if (!scene || !selectedId) {
      disposeOutline(scene, selectionOutlineRef.current);
      selectionOutlineRef.current = null;
      return;
    }

    const selectedObject = hostRefs.selectableObjectsRef.current.find(
      (obj) => obj.userData.selectableId === selectedId,
    );
    if (!selectedObject) return;

    showLabelsOn(selectedObject);
    hostRefs.selectedLabelRef.current = selectedObject;

    // Replace any existing outline with one sized to the new selection.
    disposeOutline(scene, selectionOutlineRef.current);
    selectionOutlineRef.current = null;

    const outline = buildOutlineForObject(selectedObject);
    if (!outline) return;

    scene.add(outline);
    selectionOutlineRef.current = outline;

    return () => {
      disposeOutline(scene, selectionOutlineRef.current);
      selectionOutlineRef.current = null;
    };
    // hostRefs is a stable RefObject collection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return { selectionOutlineRef };
}
