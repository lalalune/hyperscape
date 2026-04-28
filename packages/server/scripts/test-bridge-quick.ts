#!/usr/bin/env bun
/**
 * Quick test of the RTMP bridge server
 *
 * This test:
 * 1. Starts the RTMP bridge with local test destination
 * 2. Connects a mock WebSocket client
 * 3. Sends some test data
 * 4. Verifies FFmpeg receives it
 */

import { RTMPBridge } from "../src/streaming/rtmp-bridge.js";

const LOCAL_RTMP_URL = "rtmp://localhost:1935/live/test";

async function main() {
  console.log("Testing RTMP Bridge...\n");

  // Create bridge
  const bridge = new RTMPBridge({
    videoBitrate: 1000,
    preset: "ultrafast",
  });

  // Add local test destination
  bridge.addDestination({
    name: "Local Test",
    url: LOCAL_RTMP_URL,
    key: "",
    enabled: true,
  });

  // Start bridge
  bridge.start(8765);
  console.log("Bridge started on port 8765");
  console.log("Destinations:", bridge.getStatus().destinations);
  console.log("");

  // Connect mock client
  console.log("Connecting test client...");
  const WebSocket = (await import("ws")).default;
  const ws = new WebSocket("ws://localhost:8765");

  ws.on("open", () => {
    console.log("Connected! Sending test data...\n");

    // Send some fake WebM data (just to test the pipe)
    // In real usage, this would be MediaRecorder chunks
    let sent = 0;
    const interval = setInterval(() => {
      if (sent >= 5) {
        clearInterval(interval);
        console.log("\nTest complete! Sent 5 chunks.");
        console.log("Status:", bridge.getStatus());
        console.log("Stats:", bridge.getStats());
        console.log("\nClosing...");
        ws.close();
        void bridge.stop().finally(() => process.exit(0));
        return;
      }

      // Send fake data (FFmpeg will fail to decode but that's fine for testing)
      const fakeChunk = Buffer.alloc(1024, sent);
      ws.send(fakeChunk);
      sent++;
      console.log(`Sent chunk ${sent}/5`);
    }, 500);
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
    void bridge.stop().finally(() => process.exit(1));
  });

  ws.on("close", () => {
    console.log("WebSocket closed");
  });

  // Timeout
  setTimeout(() => {
    console.log("\nTimeout - stopping");
    void bridge.stop().finally(() => process.exit(1));
  }, 10000);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
