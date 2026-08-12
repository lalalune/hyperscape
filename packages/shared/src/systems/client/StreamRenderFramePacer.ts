const DEFAULT_STREAM_RENDER_FPS = 30;
const MAX_STREAM_RENDER_FPS = 60;

/**
 * Gates the expensive client world/render tick while leaving the browser's
 * animation callback installed. A 30 FPS broadcast does not benefit from a
 * 120 Hz WebGPU render loop, and the excess work can starve co-located server
 * and encoder processes during scene transitions.
 */
export class StreamRenderFramePacer {
  private static readonly SCHEDULER_TOLERANCE_MS = 0.5;
  private readonly intervalMs: number;
  private nextFrameAt: number | null = null;

  constructor(framesPerSecond = DEFAULT_STREAM_RENDER_FPS) {
    const safeFps = Number.isFinite(framesPerSecond)
      ? Math.min(
          MAX_STREAM_RENDER_FPS,
          Math.max(1, Math.round(framesPerSecond)),
        )
      : DEFAULT_STREAM_RENDER_FPS;
    this.intervalMs = 1000 / safeFps;
  }

  shouldRun(now: number): boolean {
    if (this.nextFrameAt === null) {
      this.nextFrameAt = now + this.intervalMs;
      return true;
    }
    if (
      now + StreamRenderFramePacer.SCHEDULER_TOLERANCE_MS <
      this.nextFrameAt
    ) {
      return false;
    }
    if (now - this.nextFrameAt >= this.intervalMs) {
      this.nextFrameAt = now + this.intervalMs;
    } else {
      this.nextFrameAt += this.intervalMs;
    }
    return true;
  }

  reset(): void {
    this.nextFrameAt = null;
  }
}
