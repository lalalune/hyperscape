/**
 * WebCodecs Browser Capture Script
 *
 * This script is injected into the browser via Playwright to capture
 * the Three.js canvas using the modern WebCodecs VideoEncoder API.
 *
 * It outputs raw H.264 NAL units (Annex B format) over WebSocket directly
 * to Node, which then pipes them to FFmpeg with stream copy (-c:v copy).
 * This completely bypasses all Node-side and FFmpeg CPU video encoding,
 * allowing 30fps capture at minimal overhead.
 */

export const WEBCODECS_CAPTURE_SCRIPT = `
(function() {
  if (window.__captureControl__) {
    try {
      const s = window.__captureControl__.getStatus();
      if (s && s.recording && s.wsConnected) {
        console.log('[WebCodecs Capture] Already active, skipping re-injection');
        return;
      }
    } catch(e) {}
  }

  const BRIDGE_URL = window.__RTMP_BRIDGE_URL__ || 'ws://localhost:8765';
  const TARGET_FPS = window.__TARGET_FPS__ || 30;
  const VIDEO_BITRATE = window.__VIDEO_BITRATE__ || 6000000; // 6 Mbps
  const TARGET_GOP_FRAMES = window.__TARGET_GOP_FRAMES__ || Math.max(1, TARGET_FPS * 2);

  console.log('[WebCodecs Capture] Starting direct hardware capture...');
  console.log('[WebCodecs Capture] Bridge URL:', BRIDGE_URL);
  console.log('[WebCodecs Capture] Target:', TARGET_FPS, 'fps @', VIDEO_BITRATE, 'bps');

  const canvas = document.querySelector('canvas');
  if (!canvas) {
    console.error('[WebCodecs Capture] No canvas element found!');
    return;
  }

  console.log('[WebCodecs Capture] Found canvas:', canvas.width, 'x', canvas.height);

  let stream = null;
  let ws = null;
  let encoder = null;
  let processor = null;
  let frameReader = null;

  let chunkCount = 0;
  let bytesSent = 0;
  let startTime = 0;
  let lastFrameTime = 0;
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let stopped = false;
  const MAX_RECONNECT_ATTEMPTS = 5;

  let captureFps = 0;
  let frameCountForFps = 0;
  let lastFpsCalcTime = Date.now();

  function connectWebSocket() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
      return;
    }

    console.log('[WebCodecs Capture] Connecting to RTMP bridge...', BRIDGE_URL);
    ws = new WebSocket(BRIDGE_URL);

    // Send binary data directly (NAL units)
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      console.log('[WebCodecs Capture] WebSocket connected');
      reconnectAttempts = 0;
      startEncoding();
    };

    ws.onclose = () => {
      console.log('[WebCodecs Capture] WebSocket closed');
      stopEncoding();

      if (!stopped && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
        console.log('[WebCodecs Capture] Reconnecting in', delay, 'ms... (Attempt', reconnectAttempts, 'of', MAX_RECONNECT_ATTEMPTS, ')');
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
        }
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connectWebSocket();
        }, delay);
      } else if (!stopped) {
        console.error('[WebCodecs Capture] Max reconnection attempts reached');
      }
    };

    ws.onerror = (err) => {
      console.error('[WebCodecs Capture] WebSocket error:', err);
    };
  }

  async function startEncoding() {
    if (encoder && encoder.state !== 'closed') {
       console.warn('[WebCodecs Capture] Encoder already active');
       return;
    }

    if (!stream) {
      try {
        stream = canvas.captureStream(TARGET_FPS);
        console.log('[WebCodecs Capture] Created canvas stream at', TARGET_FPS, 'fps');
      } catch (err) {
        console.error('[WebCodecs Capture] Failed to capture canvas string:', err);
        return;
      }
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
       console.error('[WebCodecs Capture] No video track in stream!');
       return;
    }

    // Initialize VideoEncoder
    encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        // chunk is an EncodedVideoChunk. We need to copy its data to an ArrayBuffer
        const buffer = new ArrayBuffer(chunk.byteLength);
        chunk.copyTo(buffer);

        // Calculate FPS
        chunkCount++;
        frameCountForFps++;
        bytesSent += chunk.byteLength;
        lastFrameTime = Date.now();

        const now = Date.now();
        if (now - lastFpsCalcTime >= 1000) {
            captureFps = frameCountForFps;
            frameCountForFps = 0;
            lastFpsCalcTime = now;
        }

        // Send H.264 NAL unit to bridge
        ws.send(buffer);
      },
      error: (e) => {
        console.error('[WebCodecs Capture] VideoEncoder error:', e);
      }
    });

    const encoderCandidates = [
      {
        codec: 'avc1.64002A', // H.264 High Profile, Level 4.2 (1080p60)
        width: canvas.width,
        height: canvas.height,
        bitrate: VIDEO_BITRATE,
        bitrateMode: 'constant',
        framerate: TARGET_FPS,
        hardwareAcceleration: 'prefer-hardware',
        latencyMode: 'realtime',
        avc: { format: 'annexb' }
      },
      {
        codec: 'avc1.64002A',
        width: canvas.width,
        height: canvas.height,
        bitrate: VIDEO_BITRATE,
        bitrateMode: 'variable',
        framerate: TARGET_FPS,
        hardwareAcceleration: 'prefer-hardware',
        latencyMode: 'realtime',
        avc: { format: 'annexb' }
      },
      {
        codec: 'avc1.640028', // H.264 High Profile, Level 4.0 (1080p30)
        width: canvas.width,
        height: canvas.height,
        bitrate: VIDEO_BITRATE,
        bitrateMode: 'constant',
        framerate: TARGET_FPS,
        hardwareAcceleration: 'prefer-hardware',
        latencyMode: 'realtime',
        avc: { format: 'annexb' }
      },
      {
        codec: 'avc1.640028',
        width: canvas.width,
        height: canvas.height,
        bitrate: VIDEO_BITRATE,
        bitrateMode: 'variable',
        framerate: TARGET_FPS,
        hardwareAcceleration: 'prefer-hardware',
        latencyMode: 'realtime',
        avc: { format: 'annexb' }
      },
      {
        codec: 'avc1.64001F', // H.264 High Profile, Level 3.1
        width: canvas.width,
        height: canvas.height,
        bitrate: VIDEO_BITRATE,
        bitrateMode: 'constant',
        framerate: TARGET_FPS,
        hardwareAcceleration: 'prefer-hardware',
        latencyMode: 'realtime',
        avc: { format: 'annexb' }
      },
      {
        codec: 'avc1.64001F',
        width: canvas.width,
        height: canvas.height,
        bitrate: VIDEO_BITRATE,
        bitrateMode: 'variable',
        framerate: TARGET_FPS,
        hardwareAcceleration: 'prefer-hardware',
        latencyMode: 'realtime',
        avc: { format: 'annexb' }
      },
      {
        codec: 'avc1.42E01F', // H.264 Baseline, Level 3.1
        width: canvas.width,
        height: canvas.height,
        bitrate: VIDEO_BITRATE,
        bitrateMode: 'constant',
        framerate: TARGET_FPS,
        hardwareAcceleration: 'prefer-hardware',
        latencyMode: 'realtime',
        avc: { format: 'annexb' }
      },
      {
        codec: 'avc1.42E01F',
        width: canvas.width,
        height: canvas.height,
        bitrate: VIDEO_BITRATE,
        framerate: TARGET_FPS,
        latencyMode: 'realtime',
        avc: { format: 'annexb' }
      }
    ];

    let configured = false;
    for (const candidate of encoderCandidates) {
      try {
        const support = await VideoEncoder.isConfigSupported(candidate);
        if (!support.supported) {
          continue;
        }
        encoder.configure(support.config);
        console.log('[WebCodecs Capture] Encoder configured:', JSON.stringify(support.config));
        configured = true;
        break;
      } catch (e) {
        console.warn('[WebCodecs Capture] Candidate config failed:', JSON.stringify(candidate), e);
      }
    }
    if (!configured) {
        console.error('[WebCodecs Capture] No supported encoder configuration for target stream quality');
        return;
    }

    startTime = Date.now();

    // The MediaStreamTrackProcessor API pulls raw frames from the canvas stream
    try {
        processor = new MediaStreamTrackProcessor({ track: videoTrack });
        frameReader = processor.readable.getReader();

        const readFrame = async () => {
            if (!encoder || encoder.state === 'closed') return;

            try {
                const { done, value: frame } = await frameReader.read();
                if (done) {
                    console.log('[WebCodecs Capture] Track ended');
                    return;
                }

                // If WebSocket backlog is huge due to network stall, skip encoding to prevent memory leak
                if (ws && ws.bufferedAmount > VIDEO_BITRATE) {
                    frame.close(); // drop frame
                } else if (encoder.encodeQueueSize > 5) {
                    // Encoder is backlogged, drop frame
                    frame.close();
                } else {
                    // Align keyframes to the configured ingest GOP so the live
                    // source does not waste bitrate on overly frequent IDRs.
                    const keyFrame = (chunkCount % TARGET_GOP_FRAMES) === 0;
                    encoder.encode(frame, { keyFrame });
                    frame.close();
                }

                // Loop
                readFrame();
            } catch (e) {
                console.error('[WebCodecs Capture] Frame read error:', e);
            }
        };

        readFrame();
        console.log('[WebCodecs Capture] Hardware encoding loop started');

    } catch(e) {
        console.error('[WebCodecs Capture] Failed to start frame processor:', e);
    }
  }

  function stopEncoding() {
    if (frameReader) {
        frameReader.cancel();
        frameReader = null;
    }
    if (encoder && encoder.state !== 'closed') {
        encoder.close();
    }
    encoder = null;

    // Do not stop the stream to allow fast restarts
  }

  function stop() {
    console.log('[WebCodecs Capture] Stopping stream...');
    stopped = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    stopEncoding();

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }

    if (ws) {
      ws.close();
      ws = null;
    }
  }

  function getStatus() {
    return {
      recording: encoder && encoder.state === 'configured',
      wsConnected: ws && ws.readyState === WebSocket.OPEN,
      chunkCount,
      bytesSent,
      uptime: startTime > 0 ? Date.now() - startTime : 0,
      lastChunkAt: lastFrameTime > 0 ? lastFrameTime : null,
      lastChunkAgeMs: lastFrameTime > 0 ? Date.now() - lastFrameTime : null,
      lastChunkMs: lastFrameTime > 0 ? Date.now() - lastFrameTime : 0,
      captureFps,
      bufferedAmount: ws ? ws.bufferedAmount : 0,
      encodeQueue: encoder ? encoder.encodeQueueSize : 0
    };
  }

  // Expose global control object
  window.__captureControl__ = {
    stop,
    getStatus
  };

  // Start connection
  connectWebSocket();

})();
`;

export function generateWebCodecsCaptureScript(config: {
  bridgeUrl: string;
  fps: number;
  bitrate: number;
  gopFrames: number;
}): string {
  // Inject configuration variables into the script window object
  const preamble = `
    window.__RTMP_BRIDGE_URL__ = ${JSON.stringify(config.bridgeUrl)};
    window.__TARGET_FPS__ = ${config.fps};
    window.__VIDEO_BITRATE__ = ${config.bitrate};
    window.__TARGET_GOP_FRAMES__ = ${config.gopFrames};
  `;
  return preamble + WEBCODECS_CAPTURE_SCRIPT;
}

/**
 * WebCodecs capture variant that uses Playwright page.exposeFunction() instead
 * of WebSocket to send H.264 NAL units from the browser to Node. This bypasses
 * the Bun/ws WebSocket handshake timeout issue on headless Linux.
 *
 * The browser calls window.__streamNALU(base64) which is a direct IPC channel
 * through Playwright's CDP bindings — no network stack involved.
 */
export const WEBCODECS_EXPOSED_CAPTURE_SCRIPT = `
(function() {
  if (window.__captureControl__) {
    try {
      const s = window.__captureControl__.getStatus();
      if (s && s.recording) {
        console.log('[WebCodecs/Exposed] Already active, skipping re-injection');
        return;
      }
    } catch(e) {}
  }

  const TARGET_FPS = window.__TARGET_FPS__ || 30;
  const VIDEO_BITRATE = window.__VIDEO_BITRATE__ || 6000000;
  const TARGET_GOP_FRAMES = window.__TARGET_GOP_FRAMES__ || Math.max(1, TARGET_FPS * 2);

  if (typeof window.__streamNALU !== 'function') {
    console.error('[WebCodecs/Exposed] window.__streamNALU not exposed — exposeFunction() must be called first');
    return;
  }

  console.log('[WebCodecs/Exposed] Starting direct Playwright bridge capture...');
  console.log('[WebCodecs/Exposed] Target:', TARGET_FPS, 'fps @', VIDEO_BITRATE, 'bps');

  const canvas = document.querySelector('canvas');
  if (!canvas) {
    console.error('[WebCodecs/Exposed] No canvas element found!');
    return;
  }

  console.log('[WebCodecs/Exposed] Found canvas:', canvas.width, 'x', canvas.height);

  let stream = null;
  let encoder = null;
  let processor = null;
  let frameReader = null;

  let chunkCount = 0;
  let bytesSent = 0;
  let startTime = 0;
  let lastFrameTime = 0;
  let stopped = false;

  let captureFps = 0;
  let frameCountForFps = 0;
  let lastFpsCalcTime = Date.now();

  // Batch small NALUs to reduce IPC overhead: accumulate up to ~32KB or 16ms
  let pendingBuffer = null;
  let pendingSize = 0;
  let flushTimer = null;
  const BATCH_THRESHOLD = 32768;
  const BATCH_FLUSH_MS = 16;

  function flushPending() {
    if (pendingBuffer && pendingSize > 0) {
      const toSend = new Uint8Array(pendingBuffer.buffer, 0, pendingSize);
      // Convert to base64 for exposeFunction (binary not supported)
      const base64 = btoa(String.fromCharCode.apply(null, toSend));
      window.__streamNALU(base64).catch(() => {});
    }
    pendingBuffer = null;
    pendingSize = 0;
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  }

  function sendNALU(buffer) {
    const data = new Uint8Array(buffer);
    bytesSent += data.length;
    chunkCount++;
    frameCountForFps++;
    lastFrameTime = Date.now();

    const now = Date.now();
    if (now - lastFpsCalcTime >= 1000) {
      captureFps = frameCountForFps;
      frameCountForFps = 0;
      lastFpsCalcTime = now;
    }

    // For large chunks (keyframes), send immediately
    if (data.length > BATCH_THRESHOLD) {
      flushPending();
      const base64 = btoa(String.fromCharCode.apply(null, data));
      window.__streamNALU(base64).catch(() => {});
      return;
    }

    // Accumulate small chunks
    if (!pendingBuffer || pendingSize + data.length > 65536) {
      flushPending();
      pendingBuffer = new Uint8Array(65536);
      pendingSize = 0;
    }
    pendingBuffer.set(data, pendingSize);
    pendingSize += data.length;

    if (pendingSize >= BATCH_THRESHOLD) {
      flushPending();
    } else if (!flushTimer) {
      flushTimer = setTimeout(flushPending, BATCH_FLUSH_MS);
    }
  }

  async function startEncoding() {
    if (encoder && encoder.state !== 'closed') {
      console.warn('[WebCodecs/Exposed] Encoder already active');
      return;
    }

    if (!stream) {
      try {
        stream = canvas.captureStream(TARGET_FPS);
        console.log('[WebCodecs/Exposed] Created canvas stream at', TARGET_FPS, 'fps');
      } catch (err) {
        console.error('[WebCodecs/Exposed] Failed to capture canvas stream:', err);
        return;
      }
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      console.error('[WebCodecs/Exposed] No video track in stream!');
      return;
    }

    encoder = new VideoEncoder({
      output: (chunk) => {
        if (stopped) return;
        const buffer = new ArrayBuffer(chunk.byteLength);
        chunk.copyTo(buffer);
        sendNALU(buffer);
      },
      error: (e) => {
        console.error('[WebCodecs/Exposed] VideoEncoder error:', e);
      }
    });

    const encoderCandidates = [
      {
        codec: 'avc1.64002A', // H.264 High Profile, Level 4.2 (1080p60)
        width: canvas.width,
        height: canvas.height,
        bitrate: VIDEO_BITRATE,
        bitrateMode: 'constant',
        framerate: TARGET_FPS,
        hardwareAcceleration: 'prefer-hardware',
        latencyMode: 'realtime',
        avc: { format: 'annexb' }
      },
      {
        codec: 'avc1.64002A',
        width: canvas.width,
        height: canvas.height,
        bitrate: VIDEO_BITRATE,
        bitrateMode: 'variable',
        framerate: TARGET_FPS,
        hardwareAcceleration: 'prefer-hardware',
        latencyMode: 'realtime',
        avc: { format: 'annexb' }
      },
      {
        codec: 'avc1.640028', // H.264 High Profile, Level 4.0 (1080p30)
        width: canvas.width,
        height: canvas.height,
        bitrate: VIDEO_BITRATE,
        bitrateMode: 'constant',
        framerate: TARGET_FPS,
        hardwareAcceleration: 'prefer-hardware',
        latencyMode: 'realtime',
        avc: { format: 'annexb' }
      },
      {
        codec: 'avc1.640028',
        width: canvas.width,
        height: canvas.height,
        bitrate: VIDEO_BITRATE,
        bitrateMode: 'variable',
        framerate: TARGET_FPS,
        hardwareAcceleration: 'prefer-hardware',
        latencyMode: 'realtime',
        avc: { format: 'annexb' }
      },
      {
        codec: 'avc1.64001F',
        width: canvas.width,
        height: canvas.height,
        bitrate: VIDEO_BITRATE,
        bitrateMode: 'constant',
        framerate: TARGET_FPS,
        hardwareAcceleration: 'prefer-hardware',
        latencyMode: 'realtime',
        avc: { format: 'annexb' }
      },
      {
        codec: 'avc1.64001F',
        width: canvas.width,
        height: canvas.height,
        bitrate: VIDEO_BITRATE,
        bitrateMode: 'variable',
        framerate: TARGET_FPS,
        hardwareAcceleration: 'prefer-hardware',
        latencyMode: 'realtime',
        avc: { format: 'annexb' }
      },
      {
        codec: 'avc1.42E01F',
        width: canvas.width,
        height: canvas.height,
        bitrate: VIDEO_BITRATE,
        bitrateMode: 'constant',
        framerate: TARGET_FPS,
        hardwareAcceleration: 'prefer-hardware',
        latencyMode: 'realtime',
        avc: { format: 'annexb' }
      },
      {
        codec: 'avc1.42E01F',
        width: canvas.width,
        height: canvas.height,
        bitrate: VIDEO_BITRATE,
        framerate: TARGET_FPS,
        latencyMode: 'realtime',
        avc: { format: 'annexb' }
      }
    ];

    let configured = false;
    for (const candidate of encoderCandidates) {
      try {
        const support = await VideoEncoder.isConfigSupported(candidate);
        if (!support.supported) {
          continue;
        }
        encoder.configure(support.config);
        console.log('[WebCodecs/Exposed] Encoder configured:', JSON.stringify(support.config));
        configured = true;
        break;
      } catch(e) {
        console.warn('[WebCodecs/Exposed] Candidate config failed:', JSON.stringify(candidate), e);
      }
    }
    if (!configured) {
      console.error('[WebCodecs/Exposed] No supported encoder configuration for target stream quality');
      return;
    }

    startTime = Date.now();

    try {
      processor = new MediaStreamTrackProcessor({ track: videoTrack });
      frameReader = processor.readable.getReader();

      const readFrame = async () => {
        if (!encoder || encoder.state === 'closed' || stopped) return;

        try {
          const { done, value: frame } = await frameReader.read();
          if (done) {
            console.log('[WebCodecs/Exposed] Track ended');
            return;
          }

          if (encoder.encodeQueueSize > 5) {
            frame.close();
          } else {
            const keyFrame = (chunkCount % TARGET_GOP_FRAMES) === 0;
            encoder.encode(frame, { keyFrame });
            frame.close();
          }

          readFrame();
        } catch (e) {
          console.error('[WebCodecs/Exposed] Frame read error:', e);
        }
      };

      readFrame();
      console.log('[WebCodecs/Exposed] Hardware encoding loop started');
    } catch(e) {
      console.error('[WebCodecs/Exposed] Failed to start frame processor:', e);
    }
  }

  function stopEncoding() {
    if (frameReader) {
      frameReader.cancel();
      frameReader = null;
    }
    if (encoder && encoder.state !== 'closed') {
      encoder.close();
    }
    encoder = null;
    flushPending();
  }

  function stop() {
    console.log('[WebCodecs/Exposed] Stopping...');
    stopped = true;
    stopEncoding();
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
  }

  function getStatus() {
    return {
      recording: encoder && encoder.state === 'configured',
      wsConnected: true, // Always "connected" since we use exposeFunction
      chunkCount,
      bytesSent,
      uptime: startTime > 0 ? Date.now() - startTime : 0,
      lastChunkAt: lastFrameTime > 0 ? lastFrameTime : null,
      lastChunkAgeMs: lastFrameTime > 0 ? Date.now() - lastFrameTime : null,
      lastChunkMs: lastFrameTime > 0 ? Date.now() - lastFrameTime : 0,
      captureFps,
      encodeQueue: encoder ? encoder.encodeQueueSize : 0
    };
  }

  window.__captureControl__ = { stop, getStatus };

  startEncoding();
})();
`;

export function generateWebCodecsExposedCaptureScript(config: {
  fps: number;
  bitrate: number;
  gopFrames: number;
}): string {
  const preamble = `
    window.__TARGET_FPS__ = ${config.fps};
    window.__VIDEO_BITRATE__ = ${config.bitrate};
    window.__TARGET_GOP_FRAMES__ = ${config.gopFrames};
  `;
  return preamble + WEBCODECS_EXPOSED_CAPTURE_SCRIPT;
}
