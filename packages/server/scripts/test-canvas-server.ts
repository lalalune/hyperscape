#!/usr/bin/env bun
/**
 * Test Canvas Server
 *
 * Serves a simple animated canvas page for testing the RTMP pipeline
 * without needing the full game server.
 *
 * Usage:
 *   bun scripts/test-canvas-server.ts
 *
 * Then run:
 *   bun scripts/test-rtmp-local.ts
 */

const HTML = `<!DOCTYPE html>
<html>
<head>
  <title>RTMP Test Canvas</title>
  <style>
    body { margin: 0; background: #1a1a2e; display: flex; justify-content: center; align-items: center; height: 100vh; }
    canvas { border: 2px solid #4a4a6e; }
    #status { position: fixed; top: 10px; left: 10px; color: #fff; font-family: monospace; background: rgba(0,0,0,0.5); padding: 10px; border-radius: 5px; }
  </style>
</head>
<body>
  <div id="status">Waiting for capture...</div>
  <canvas id="canvas" width="1280" height="720"></canvas>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const status = document.getElementById('status');

    let frame = 0;
    let startTime = Date.now();

    // Animated scene
    function draw() {
      frame++;
      const time = (Date.now() - startTime) / 1000;

      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#1a1a2e');
      gradient.addColorStop(1, '#16213e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Animated circles
      for (let i = 0; i < 5; i++) {
        const x = canvas.width / 2 + Math.cos(time + i * 1.2) * 200;
        const y = canvas.height / 2 + Math.sin(time + i * 1.2) * 150;
        const radius = 30 + Math.sin(time * 2 + i) * 10;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = \`hsl(\${(i * 72 + time * 30) % 360}, 70%, 60%)\`;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Bouncing box
      const boxX = 100 + Math.abs(Math.sin(time * 0.5)) * (canvas.width - 300);
      const boxY = 100 + Math.abs(Math.sin(time * 0.7)) * (canvas.height - 300);
      ctx.fillStyle = '#e94560';
      ctx.fillRect(boxX, boxY, 100, 100);

      // Title text
      ctx.font = 'bold 48px Arial';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText('HYPERIA RTMP TEST', canvas.width / 2, 80);

      // Frame counter
      ctx.font = '24px monospace';
      ctx.fillStyle = '#0f3460';
      ctx.textAlign = 'left';
      ctx.fillText(\`Frame: \${frame}\`, 20, canvas.height - 60);
      ctx.fillText(\`Time: \${time.toFixed(1)}s\`, 20, canvas.height - 30);

      // FPS indicator
      ctx.fillStyle = '#4ecca3';
      ctx.textAlign = 'right';
      ctx.fillText('30 FPS', canvas.width - 20, canvas.height - 30);

      requestAnimationFrame(draw);
    }

    draw();

    // Update status when capture starts
    window.__captureControl__?.status && setInterval(() => {
      const s = window.__captureStatus__?.getStats?.();
      if (s) {
        status.textContent = s.recording
          ? \`Recording: \${Math.floor(s.uptime/1000)}s | WS: \${s.wsConnected ? 'OK' : 'Disconnected'}\`
          : 'Waiting for capture...';
      }
    }, 1000);
  </script>
</body>
</html>`;

// Simple HTTP server
const server = Bun.serve({
  port: 3333,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/" || url.pathname === "/stream") {
      return new Response(HTML, {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log("Test canvas server running at http://localhost:3333");
console.log("Open in browser to see animated canvas");
console.log("");
console.log("To test RTMP streaming:");
console.log("  1. Keep this server running");
console.log("  2. In another terminal: bun run stream:test");
console.log("  3. View stream: ffplay rtmp://localhost:1935/live/test");
console.log("");
console.log("Press Ctrl+C to stop");
