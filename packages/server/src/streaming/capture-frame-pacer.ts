const DEFAULT_CAPTURE_FPS = 30;
const MAX_CAPTURE_FPS = 60;

export function parseCaptureFrameRate(
  rawValue: string | undefined,
  fallback = DEFAULT_CAPTURE_FPS,
): number {
  const parsed = Number.parseInt(rawValue || "", 10);
  const safeFallback = Number.isFinite(fallback)
    ? Math.min(MAX_CAPTURE_FPS, Math.max(1, Math.round(fallback)))
    : DEFAULT_CAPTURE_FPS;
  if (!Number.isFinite(parsed)) return safeFallback;
  return Math.min(MAX_CAPTURE_FPS, Math.max(1, parsed));
}

/**
 * Limits CDP screencast acknowledgements to the configured delivery rate.
 * CDP produces another JPEG as soon as the previous frame is acknowledged, so
 * immediate acknowledgements can make a high-refresh compositor encode and
 * pipe 100+ frames per second even when FFmpeg is configured for 30 FPS.
 */
export class CaptureFramePacer {
  private readonly intervalMs: number;
  private nextFrameAt: number | null = null;

  constructor(framesPerSecond: number) {
    const safeFps = parseCaptureFrameRate(String(framesPerSecond));
    this.intervalMs = 1000 / safeFps;
  }

  getDelayMs(now: number): number {
    if (this.nextFrameAt === null) return 0;
    return Math.max(0, this.nextFrameAt - now);
  }

  markFrameAcknowledged(now: number): void {
    if (
      this.nextFrameAt === null ||
      now - this.nextFrameAt >= this.intervalMs
    ) {
      this.nextFrameAt = now + this.intervalMs;
      return;
    }
    this.nextFrameAt += this.intervalMs;
  }

  reset(): void {
    this.nextFrameAt = null;
  }
}
