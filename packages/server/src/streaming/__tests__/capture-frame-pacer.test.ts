import { describe, expect, it } from "vitest";

import {
  CaptureFramePacer,
  parseCaptureFrameRate,
} from "../capture-frame-pacer";

describe("CDP capture frame pacing", () => {
  it("defaults invalid input and clamps unsafe frame rates", () => {
    expect(parseCaptureFrameRate(undefined)).toBe(30);
    expect(parseCaptureFrameRate("invalid")).toBe(30);
    expect(parseCaptureFrameRate("0")).toBe(1);
    expect(parseCaptureFrameRate("240")).toBe(60);
  });

  it("allows the first frame immediately", () => {
    const pacer = new CaptureFramePacer(30);
    expect(pacer.getDelayMs(100)).toBe(0);
  });

  it("holds subsequent acknowledgements to the configured interval", () => {
    const pacer = new CaptureFramePacer(25);
    pacer.markFrameAcknowledged(100);
    expect(pacer.getDelayMs(110)).toBe(30);
    expect(pacer.getDelayMs(140)).toBe(0);
    expect(pacer.getDelayMs(160)).toBe(0);
  });

  it("keeps a stable schedule instead of adding processing time every frame", () => {
    const pacer = new CaptureFramePacer(50);
    pacer.markFrameAcknowledged(100);
    expect(pacer.getDelayMs(105)).toBe(15);
    pacer.markFrameAcknowledged(121);
    expect(pacer.getDelayMs(125)).toBe(15);
  });

  it("resets pacing for a replacement CDP session", () => {
    const pacer = new CaptureFramePacer(30);
    pacer.markFrameAcknowledged(100);
    pacer.reset();
    expect(pacer.getDelayMs(101)).toBe(0);
  });
});
