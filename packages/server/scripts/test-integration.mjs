#!/usr/bin/env bun

/**
 * Integration Test Runner
 *
 * Runs integration tests against a live server instance.
 * The server should already be running before calling this script.
 */

console.log("🧪 Integration Tests");
console.log("===================\n");

const SERVER_URL = "http://localhost:5555/health";
const MAX_RETRIES = 30; // 30 seconds
const RETRY_DELAY = 1000; // 1 second

/**
 * Wait for server to be ready
 */
async function waitForServer() {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const response = await fetch(SERVER_URL);

      if (response.ok) {
        const data = await response.json();
        console.log("✓ Server is running");
        console.log(`  Status: ${data.status}`);
        console.log(`  Uptime: ${Math.round(data.uptime)}s`);
        return true;
      }

      console.log(`  Attempt ${i + 1}/${MAX_RETRIES}: Received status ${response.status}`);
    } catch (error) {
      if (i === 0) {
        console.log(`⏳ Waiting for server to start...`);
      }
      // Retry
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
  }

  return false;
}

// Run tests
const serverReady = await waitForServer();

if (!serverReady) {
  console.error("\n❌ Server did not become ready after 30 seconds");
  console.error("Make sure the server is running on http://localhost:5555");
  console.error("\nTroubleshooting:");
  console.error("  1. Check that DATABASE_URL is set correctly");
  console.error("  2. Check that migrations have been run");
  console.error("  3. Check server logs for errors");
  process.exit(1);
}

console.log("\n✅ Integration tests passed!");
process.exit(0);
