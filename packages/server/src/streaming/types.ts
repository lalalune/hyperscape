import type {
  StreamDeliveryTransport,
  StreamDestinationProvider,
  StreamDestinationRole,
} from "./delivery-config.js";

/**
 * RTMP Streaming Types
 *
 * Type definitions for the multi-platform RTMP streaming system.
 */

/** RTMP destination configuration */
export interface RTMPDestination {
  id?: string;
  name: string;
  role?: StreamDestinationRole;
  provider?: StreamDestinationProvider;
  transport?: StreamDeliveryTransport;
  playbackUrl?: string | null;
  ingestUrl?: string | null;
  url: string;
  key: string;
  enabled: boolean;
}

/** Streaming configuration */
export interface StreamingConfig {
  /** Video bitrate in kbps */
  videoBitrate: number;
  /** Audio bitrate in kbps */
  audioBitrate: number;
  /** Frames per second */
  fps: number;
  /** Video width */
  width: number;
  /** Video height */
  height: number;
  /** FFmpeg preset (ultrafast, veryfast, fast, medium) */
  preset: "ultrafast" | "veryfast" | "fast" | "medium";
  /** Keyframe interval in frames */
  gopSize: number;
  /** Capture mode: 'cdp' uses Page.startScreencast, 'mediarecorder' uses legacy WebSocket path, 'webcodecs' uses hardware VideoEncoder, 'x11_nvenc' uses X11 desktop capture + NVENC encode */
  captureMode: "cdp" | "mediarecorder" | "webcodecs" | "x11_nvenc";
  /** JPEG quality for CDP screencast frames (1-100, default 80) */
  jpegQuality: number;
}

/** Stream status for a single destination */
export interface DestinationStatus {
  id?: string;
  name: string;
  role?: StreamDestinationRole;
  provider?: StreamDestinationProvider;
  transport?: StreamDeliveryTransport;
  playbackUrl?: string | null;
  ingestUrl?: string | null;
  connected: boolean;
  error?: string;
  bytesWritten: number;
  startedAt?: number;
  /**
   * Wallclock ms of the most recent fatal write-error attributed to this
   * destination (slave-muxer failure, av_interleaved_write_frame error,
   * RTMPS session invalidated, etc.). Used to prevent the "FFmpeg
   * is still emitting `frame=` progress so everything must be OK" false
   * positive from flipping `connected` back to `true` while the RTMP
   * destination is actually dark.
   */
  lastWriteErrorAt?: number | null;
}

/** Overall streaming status */
export interface StreamingStatus {
  active: boolean;
  startedAt?: number;
  destinations: DestinationStatus[];
  ffmpegRunning: boolean;
  clientConnected: boolean;
}

/** Default streaming configuration */
export const DEFAULT_STREAMING_CONFIG: StreamingConfig = {
  videoBitrate: 4500,
  audioBitrate: 128,
  fps: 30,
  width: 1280, // Match default capture viewport (720p) to avoid unnecessary upscale
  height: 720,
  preset: "ultrafast", // Use ultrafast for real-time 3D capturing to minimize CPU
  gopSize: 60, // Keyframe every 2 seconds at 30fps — recommended by Twitch/YouTube for stability
  captureMode: "cdp", // CDP screencast is the default (faster, single-encode)
  jpegQuality: 80, // Good balance of quality vs bandwidth for JPEG frames
};
