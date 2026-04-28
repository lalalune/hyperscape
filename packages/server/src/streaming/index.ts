/**
 * Streaming Module
 *
 * Multi-platform RTMP streaming from Hyperscape.
 *
 * This module provides:
 * - RTMPBridge: WebSocket server that receives video chunks and pipes to FFmpeg
 * - Browser capture scripts for injection via Playwright
 * - Streaming configuration and status management
 *
 * Usage:
 *   import { startRTMPBridge, getRTMPBridge } from './streaming';
 *
 *   // Start the bridge server
 *   const bridge = startRTMPBridge(8765);
 *
 *   // Check status
 *   console.log(bridge.getStatus());
 */

export {
  RTMPBridge,
  getRTMPBridge,
  peekRTMPBridge,
  startRTMPBridge,
} from "./rtmp-bridge.js";
export { CAPTURE_SCRIPT, generateCaptureScript } from "./browser-capture.js";
export {
  WEBCODECS_CAPTURE_SCRIPT,
  generateWebCodecsCaptureScript,
  WEBCODECS_EXPOSED_CAPTURE_SCRIPT,
  generateWebCodecsExposedCaptureScript,
} from "./browser-capture-webcodecs.js";
export type {
  RTMPDestination,
  StreamingConfig,
  StreamingStatus,
  DestinationStatus,
} from "./types.js";
export { DEFAULT_STREAMING_CONFIG } from "./types.js";
export { getStreamCapture, initStreamCapture } from "./stream-capture.js";
export {
  StreamLeakDiagnostics,
  getStreamLeakDiagnostics,
  type AllocRecord,
  type LeakSnapshot,
} from "./stream-leak-diagnostics.js";
export {
  startHlsCdnSync,
  stopHlsCdnSync,
  getHlsStreamUrl,
} from "./hls-cdn-sync.js";
