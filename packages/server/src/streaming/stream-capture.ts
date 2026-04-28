/**
 * Stream Capture - RTMPBridge initialization for RTMP fanout streaming.
 *
 * Starts the RTMPBridge WebSocket server that receives video frames
 * from the browser's MediaRecorder capture script running in the
 * StreamingMode client page (?page=stream).
 *
 * Pipeline:
 *   Browser (StreamingMode) → canvas.captureStream() → MediaRecorder
 *   → WebSocket (port 8765) → RTMPBridge → FFmpeg → RTMP destinations
 *   (YouTube/Twitch/Kick/etc.).
 */

import { getRTMPBridge, peekRTMPBridge } from "./rtmp-bridge.js";

const RTMP_BRIDGE_PORT = parseInt(process.env.RTMP_BRIDGE_PORT || "8765", 10);

/**
 * Initialize the stream capture pipeline.
 *
 * Starts the RTMPBridge WebSocket server so that the browser's capture
 * script (injected in StreamingMode) can connect and send video frames.
 */
export function initStreamCapture(): boolean {
  const enabled = process.env.STREAMING_CAPTURE_ENABLED !== "false";
  if (!enabled) {
    console.log("[StreamCapture] Disabled via STREAMING_CAPTURE_ENABLED=false");
    return false;
  }

  const bridge = getRTMPBridge();
  bridge.start(RTMP_BRIDGE_PORT);
  console.log(
    `[StreamCapture] RTMPBridge WebSocket server started on port ${RTMP_BRIDGE_PORT}`,
  );
  console.log(
    `[StreamCapture] Waiting for browser capture client to connect...`,
  );
  console.log(
    `[StreamCapture] Open ?page=stream in a browser to start capturing`,
  );

  return true;
}

// Re-export getStreamCapture for shutdown and status compatibility
export function getStreamCapture(): {
  isRunning(): boolean;
  stop(): Promise<void>;
  getStats(): {
    running: boolean;
    bridgeActive: boolean;
    ffmpegRunning: boolean;
    clientConnected: boolean;
    bytesReceived: number;
    uptime: number;
    destinations: number;
    restartAttempts: number;
    lastCrash: number;
    healthy: boolean;
    droppedFrames: number;
    backpressured: boolean;
    spectators: number;
    encoderFps?: number | null;
    processMemory: {
      rssBytes: number;
      heapTotalBytes: number;
      heapUsedBytes: number;
      externalBytes: number;
      arrayBuffersBytes: number;
    };
  };
} {
  const bridge = peekRTMPBridge();
  if (!bridge) {
    return {
      isRunning: () => false,
      stop: async () => {},
      getStats: () => ({
        running: false,
        bridgeActive: false,
        ffmpegRunning: false,
        clientConnected: false,
        bytesReceived: 0,
        uptime: 0,
        destinations: 0,
        restartAttempts: 0,
        lastCrash: 0,
        healthy: false,
        droppedFrames: 0,
        backpressured: false,
        spectators: 0,
        encoderFps: null,
        processMemory: {
          rssBytes: 0,
          heapTotalBytes: 0,
          heapUsedBytes: 0,
          externalBytes: 0,
          arrayBuffersBytes: 0,
        },
      }),
    };
  }

  return {
    isRunning: () => bridge.getStatus().active,
    stop: async () => bridge.stop(),
    getStats: () => {
      const status = bridge.getStatus();
      const stats = bridge.getStats();
      return {
        running: status.active,
        bridgeActive: status.active,
        ffmpegRunning: status.ffmpegRunning,
        clientConnected: status.clientConnected,
        ...stats,
      };
    },
  };
}
