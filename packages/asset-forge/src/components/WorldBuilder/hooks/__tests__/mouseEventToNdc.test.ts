/**
 * Phase 1.1 tenth carve — locks in the DOM mouse → NDC
 * conversion. The Y-flip is the easy-to-get-wrong piece;
 * other carves rely on this output feeding directly into
 * Three.js raycasters via `setFromCamera`.
 */

import { describe, expect, it } from "vitest";
import {
  mouseEventToNdc,
  type NdcContainer,
  type NdcContainerRect,
} from "../mouseEventToNdc";

function makeContainer(rect: NdcContainerRect): NdcContainer {
  return { getBoundingClientRect: () => rect };
}

describe("mouseEventToNdc", () => {
  it("center of container maps to (0, 0)", () => {
    const container = makeContainer({
      left: 0,
      top: 0,
      width: 200,
      height: 100,
    });
    const out = { x: -1, y: -1 };
    mouseEventToNdc({ clientX: 100, clientY: 50 }, container, out);
    expect(out.x).toBeCloseTo(0);
    expect(out.y).toBeCloseTo(0);
  });

  it("left-top corner maps to (-1, +1) — Y is flipped", () => {
    const container = makeContainer({
      left: 0,
      top: 0,
      width: 200,
      height: 100,
    });
    const out = { x: 0, y: 0 };
    mouseEventToNdc({ clientX: 0, clientY: 0 }, container, out);
    expect(out.x).toBeCloseTo(-1);
    expect(out.y).toBeCloseTo(1);
  });

  it("right-bottom corner maps to (+1, -1)", () => {
    const container = makeContainer({
      left: 0,
      top: 0,
      width: 200,
      height: 100,
    });
    const out = { x: 0, y: 0 };
    mouseEventToNdc({ clientX: 200, clientY: 100 }, container, out);
    expect(out.x).toBeCloseTo(1);
    expect(out.y).toBeCloseTo(-1);
  });

  it("offsets the container's left/top — only RELATIVE position matters", () => {
    const container = makeContainer({
      left: 50,
      top: 25,
      width: 200,
      height: 100,
    });
    const out = { x: 0, y: 0 };
    // Click at clientX=150, clientY=75 → relative (100, 50) → center → (0, 0)
    mouseEventToNdc({ clientX: 150, clientY: 75 }, container, out);
    expect(out.x).toBeCloseTo(0);
    expect(out.y).toBeCloseTo(0);
  });

  it("writes in place — does not allocate a new object", () => {
    const container = makeContainer({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    });
    const out = { x: 99, y: 99 };
    const result = mouseEventToNdc({ clientX: 0, clientY: 0 }, container, out);
    expect(result).toBe(out); // Same reference
  });

  it("intermediate point — quarter-width / quarter-height", () => {
    const container = makeContainer({
      left: 0,
      top: 0,
      width: 400,
      height: 200,
    });
    const out = { x: 0, y: 0 };
    // (100, 50) is at 1/4 width, 1/4 height
    // NDC: x = 0.25*2 - 1 = -0.5; y = -(0.25*2 - 1) = +0.5
    mouseEventToNdc({ clientX: 100, clientY: 50 }, container, out);
    expect(out.x).toBeCloseTo(-0.5);
    expect(out.y).toBeCloseTo(0.5);
  });
});
