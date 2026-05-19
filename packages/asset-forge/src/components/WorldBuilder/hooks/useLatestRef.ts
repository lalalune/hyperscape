/**
 * useLatestRef — track the latest value of a prop / callback in a
 * stable ref without re-firing dependent effects.
 *
 * Phase 1.1 sixteenth carve from `TileBasedTerrain.tsx`. The
 * monolith had a 26-line cluster of 12 hand-rolled ref+sync
 * pairs — every handler the component receives as a prop got
 * the same `const xRef = useRef(x); xRef.current = x;` boilerplate
 * so the animation loop / DOM event listeners could read the
 * latest callback identity without listing every handler in
 * their effect deps.
 *
 * Why a ref instead of just calling the latest callback:
 *
 *  - The component subscribes to long-lived DOM events
 *    (mousemove, wheel, contextmenu, pointerlockchange) via
 *    addEventListener — passing the freshest callback as the
 *    listener would force re-attaching on every parent re-render.
 *  - The animation loop runs at 60+ FPS and reads `handlerXRef
 *    .current` once per frame; rebinding listeners would tank
 *    perf.
 *
 * The pattern is a one-line replacement for the boilerplate:
 *
 *     const handleClickRef = useRef(handleClick);
 *     handleClickRef.current = handleClick;
 *
 * becomes:
 *
 *     const handleClickRef = useLatestRef(handleClick);
 *
 * Reusable across the codebase — anywhere a long-lived
 * subscription needs to call the freshest version of a
 * frequently-rebound callback.
 */

import { useRef, type RefObject } from "react";

export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  // Update on every render — keeps `.current` in lock-step with
  // the latest value the parent passed without scheduling an
  // effect. Cheap (one prop read + one assignment per render)
  // and guarantees DOM-event listeners attached via a long-lived
  // setup effect see the freshest callback identity at fire time.
  ref.current = value;
  return ref;
}
