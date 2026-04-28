/**
 * Browser Capture Script
 *
 * This script is injected into the browser via Playwright to capture
 * the Three.js canvas and stream it via WebSocket to the RTMP bridge.
 *
 * The script uses MediaRecorder API to encode the canvas as WebM/VP9
 * and sends chunks to the server in real-time.
 */

/**
 * Browser-side capture script (as string for Playwright injection)
 */
export const CAPTURE_SCRIPT = `
(function() {
  // Guard: If capture is already active, do NOT re-inject.
  // The watchdog re-injects this script when it thinks capture is down,
  // but re-injecting overwrites window.__captureControl__ with a NEW
  // (broken) instance while the old one keeps streaming silently.
  if (window.__captureControl__) {
    try {
      const s = window.__captureControl__.getStatus();
      if (s && s.recording && s.wsConnected) {
        console.log('[Capture] Already active, skipping re-injection');
        return;
      }
    } catch(e) {}
  }

  const BRIDGE_URL = window.__RTMP_BRIDGE_URL__ || 'ws://localhost:8765';
  const TARGET_FPS = window.__TARGET_FPS__ || 30;
  const VIDEO_BITRATE = window.__VIDEO_BITRATE__ || 6000000; // 6 Mbps
  const ATTACH_SILENT_AUDIO = window.__CAPTURE_ATTACH_AUDIO__ === true;

  console.log('[Capture] Starting canvas capture...');
  console.log('[Capture] Bridge URL:', BRIDGE_URL);

  // Find the Three.js canvas
  const canvas = document.querySelector('canvas');
  if (!canvas) {
    console.error('[Capture] No canvas element found!');
    return;
  }

  console.log('[Capture] Found canvas:', canvas.width, 'x', canvas.height);

  // Capture stream from canvas
  let stream = null;
  let audioCtx = null;
  let oscillator = null;

  function setupStream() {
    if (stream) return true;

    try {
      stream = canvas.captureStream(TARGET_FPS);
      console.log('[Capture] Created capture stream at', TARGET_FPS, 'fps');
    } catch (err) {
      console.error('[Capture] Failed to capture canvas stream:', err);
      return false;
    }

    // The bridge owns audio timing. Only attach browser-side silent audio when
    // explicitly requested for debugging or compatibility testing.
    if (ATTACH_SILENT_AUDIO) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 0; // Silent
        oscillator.connect(gainNode);
        const dest = audioCtx.createMediaStreamDestination();
        gainNode.connect(dest);
        oscillator.start();

        // Add silent audio track to stream
        const audioTrack = dest.stream.getAudioTracks()[0];
        if (audioTrack) {
          stream.addTrack(audioTrack);
          console.log('[Capture] Added silent audio track');
        }
      } catch (err) {
        console.warn('[Capture] Could not add audio track:', err);
      }
    }
    return true;
  }

  // Determine best codec
  // Prefer H.264 if available to heavily reduce browser CPU encoding load
  let mimeType = 'video/webm;codecs=h264';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    // Fallback to VP8 for broader real-time stability
    mimeType = 'video/webm;codecs=vp8';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
    }
  }
  console.log('[Capture] Using MIME type:', mimeType);

  // Connect to RTMP bridge
  let ws;
  let recorder;
  let requestDataTimer = null;
  let captureHealthTimer = null;
  let forceFrameTimer = null;
  let fpsTimer = null;
  let reconnectTimer = null;
  let stopped = false;
  let chunkCount = 0;
  let bytesSent = 0;
  let lastChunkAt = 0;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;

  // Track effective capture FPS (chunks delivered per second).
  // NOTE: requestAnimationFrame is heavily throttled in headless Chromium (~1fps),
  // so we instead measure the actual MediaRecorder chunk delivery rate which
  // reflects real stream throughput.
  let captureFps = 0;
  let chunksThisSecond = 0;

  function startFpsTimer() {
    if (fpsTimer) return;
    fpsTimer = setInterval(() => {
      captureFps = chunksThisSecond;
      chunksThisSecond = 0;
    }, 1000);
  }

  function stopFpsTimer() {
    if (!fpsTimer) return;
    clearInterval(fpsTimer);
    fpsTimer = null;
    captureFps = 0;
    chunksThisSecond = 0;
  }

  function connect() {
    console.log('[Capture] Connecting to bridge...');

    ws = new WebSocket(BRIDGE_URL);

    ws.onopen = () => {
      console.log('[Capture] Connected to RTMP bridge');
      reconnectAttempts = 0;
      startRecording();
    };

    ws.onclose = (event) => {
      console.log('[Capture] WebSocket closed:', event.code, event.reason);
      stopRecording();

      if (!stopped && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log('[Capture] Reconnecting in 3s... (attempt ' + reconnectAttempts + ')');
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
        }
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, 3000);
      } else if (!stopped) {
        console.error('[Capture] Max reconnection attempts reached');
      }
    };

    ws.onerror = (err) => {
      console.error('[Capture] WebSocket error:', err);
    };
  }

  function startRecording() {
    if (!setupStream()) {
      console.error('[Capture] Cannot start recording, stream setup failed');
      return;
    }

    if (recorder && recorder.state !== 'inactive') {
      console.warn('[Capture] Recorder already active');
      return;
    }

    try {
      recorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: VIDEO_BITRATE
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0 && ws && ws.readyState === WebSocket.OPEN) {
          // Drop chunks if WebSocket is buffering too much to prevent OOM
          if (ws.bufferedAmount > 2 * 1024 * 1024) { // 2MB
             console.warn('[Capture] Dropping chunk due to backpressure. Buffered:', ws.bufferedAmount);
             return;
          }
          ws.send(event.data);
          chunkCount++;
          chunksThisSecond++;
          bytesSent += event.data.size;
          lastChunkAt = Date.now();
          if (chunkCount <= 3 || chunkCount % 30 === 0) {
            console.log('[Capture] Sent chunk #' + chunkCount + ':', event.data.size, 'bytes');
          }
        }
      };

      recorder.onerror = (err) => {
        console.error('[Capture] MediaRecorder error:', err);
      };

      recorder.onstop = () => {
        console.log('[Capture] MediaRecorder stopped');
        if (requestDataTimer) {
          clearInterval(requestDataTimer);
          requestDataTimer = null;
        }
        if (captureHealthTimer) {
          clearInterval(captureHealthTimer);
          captureHealthTimer = null;
        }
        if (forceFrameTimer) {
          clearInterval(forceFrameTimer);
          forceFrameTimer = null;
        }
        stopFpsTimer();
      };

      // Start recording with 100ms chunks for tight frame delivery to FFmpeg.
      recorder.start(100);
      // Some Chromium builds buffer indefinitely unless requestData() is nudged.
      requestDataTimer = setInterval(() => {
        if (recorder && recorder.state === 'recording') {
          try {
            recorder.requestData();
          } catch (err) {
            console.warn('[Capture] requestData failed:', err);
          }
        }
      }, 100);
      lastChunkAt = Date.now();
      captureHealthTimer = setInterval(() => {
        if (!recorder || recorder.state !== 'recording') {
          return;
        }
        const idleMs = Date.now() - lastChunkAt;
        if (idleMs > 4000) {
          console.warn('[Capture] No chunk for ' + idleMs + 'ms, nudging recorder');
          try {
            recorder.requestData();
          } catch (err) {
            console.warn('[Capture] requestData nudge failed:', err);
          }
        }
      }, 2000);
      // Some Chromium/GPU combos only emit MediaRecorder chunks when canvas
      // pixels change. Force frame requests to keep RTMP outputs alive.
      const videoTrack = stream?.getVideoTracks?.()[0];
      if (videoTrack && typeof videoTrack.requestFrame === 'function') {
        const frameIntervalMs = Math.max(15, Math.floor(1000 / TARGET_FPS));
        forceFrameTimer = setInterval(() => {
          try {
            videoTrack.requestFrame();
          } catch {}
        }, frameIntervalMs);
      }
      startFpsTimer();
      console.log('[Capture] Recording started');

      // Expose status for debugging
      window.__captureStatus__ = {
        recording: true,
        startTime: Date.now(),
        getStats: () => ({
          recording: recorder ? recorder.state === 'recording' : false,
          wsConnected: ws && ws.readyState === WebSocket.OPEN,
          uptime: Date.now() - window.__captureStatus__.startTime,
          chunkCount,
          bytesSent,
          lastChunkAt: lastChunkAt > 0 ? lastChunkAt : null,
          lastChunkAgeMs: lastChunkAt > 0 ? Date.now() - lastChunkAt : null,
          lastChunkMs: lastChunkAt > 0 ? Date.now() - lastChunkAt : null,
          wsBufferedAmount: ws?.bufferedAmount || 0,
          captureFps
        })
      };
    } catch (err) {
      console.error('[Capture] Failed to start recording:', err);
    }
  }

  function stopRecording() {
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      recorder = null;
    }
    
    // CRITICAL: Stop all hardware tracks tied to the MediaStream to avoid memory/GPU leak.
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }

    if (oscillator) {
      oscillator.stop();
      oscillator.disconnect();
      oscillator = null;
    }

    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close().catch(err => console.warn('[Capture] audioCtx close error:', err));
      audioCtx = null;
    }

    if (requestDataTimer) {
      clearInterval(requestDataTimer);
      requestDataTimer = null;
    }
    if (captureHealthTimer) {
      clearInterval(captureHealthTimer);
      captureHealthTimer = null;
    }
    if (forceFrameTimer) {
      clearInterval(forceFrameTimer);
      forceFrameTimer = null;
    }
    stopFpsTimer();
    if (window.__captureStatus__) {
      window.__captureStatus__.recording = false;
    }
  }

  // Expose control functions globally
  window.__captureControl__ = {
    start: connect,
    stop: () => {
      stopped = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      stopRecording();
      if (ws) {
        ws.close();
        ws = null;
      }
    },
    getStatus: () => window.__captureStatus__?.getStats?.() || { recording: false }
  };

  // Auto-start
  connect();

  console.log('[Capture] Capture script loaded. Control via window.__captureControl__');
})();
`;

/**
 * Generate capture script with custom configuration
 */
export function generateCaptureScript(options: {
  bridgeUrl?: string;
  fps?: number;
  bitrate?: number;
  attachSilentAudio?: boolean;
}): string {
  const {
    bridgeUrl = "ws://localhost:8765",
    fps = 30,
    bitrate = 6000000,
    attachSilentAudio = false,
  } = options;

  return `
    window.__RTMP_BRIDGE_URL__ = '${bridgeUrl}';
    window.__TARGET_FPS__ = ${fps};
    window.__VIDEO_BITRATE__ = ${bitrate};
    window.__CAPTURE_ATTACH_AUDIO__ = ${attachSilentAudio ? "true" : "false"};
    ${CAPTURE_SCRIPT}
  `;
}
