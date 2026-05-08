/**
 * Convert a DOM mouse event to normalized device coordinates
 * (NDC) within a target container. NDC is the [-1, +1] range
 * Three.js raycasters expect via `Raycaster.setFromCamera`.
 *
 * Phase 1.1 tenth carve from `TileBasedTerrain.tsx` (PLAN_AAA_MASTER_AUDIT
 * debt #2). Two identical 3-line copies of this conversion
 * existed at the click and hover sites; extracted into a single
 * tested helper.
 *
 * Y is FLIPPED: DOM mouse coordinates measure from the top
 * down, NDC measures from the center with +Y up. Bug-prone
 * to redo by hand, hence worth locking in via tests.
 */

/** The minimum DOMRect shape this helper reads. */
export interface NdcContainerRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** The minimum container shape this helper needs — anything
 * with `getBoundingClientRect()`. */
export interface NdcContainer {
  getBoundingClientRect(): NdcContainerRect;
}

/** The minimum mouse event shape this helper reads. */
export interface NdcMouseEvent {
  readonly clientX: number;
  readonly clientY: number;
}

/** Output target. Most callers pass a `THREE.Vector2`, which
 * has `x` and `y` properties — this writes into them in place
 * to avoid allocating per click/hover event. */
export interface NdcWritable {
  x: number;
  y: number;
}

/**
 * Write the NDC of `event` (relative to `container`) into
 * `out`. Returns `out` for fluent chaining. Origin is the
 * container's center; +X right, +Y up.
 */
export function mouseEventToNdc<T extends NdcWritable>(
  event: NdcMouseEvent,
  container: NdcContainer,
  out: T,
): T {
  const rect = container.getBoundingClientRect();
  out.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  out.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  return out;
}
