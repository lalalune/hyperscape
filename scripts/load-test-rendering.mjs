#!/usr/bin/env node
import { parseArgs } from "node:util";
import { chromium } from "playwright";

async function loadShared() {
  return import("@hyperforge/shared").catch(() => {
    console.error("Run: bun run build:shared");
    process.exit(1);
  });
}

const opts = parseArgs({
  options: {
    help: { type: "boolean", short: "h" },
    bots: { type: "string", short: "b", default: "100" },
    duration: { type: "string", short: "d", default: "60" },
    "ws-url": { type: "string", default: "ws://localhost:5555/ws" },
    "client-url": { type: "string", default: "http://localhost:3000" },
    "sample-interval": { type: "string", default: "1000" },
    headless: { type: "boolean", default: false },
    screenshot: { type: "boolean", default: true },
  },
  strict: true,
}).values;

if (opts.help) {
  console.log(`
FPS Test: bun scripts/load-test-rendering.mjs [options]

Options:
  -b, --bots <n>         Bots to spawn (default: 100)
  -d, --duration <s>     Duration (default: 60)
  --ws-url <url>         Server (default: ws://localhost:5555/ws)
  --client-url <url>     Client (default: http://localhost:3000)
  --sample-interval <ms> FPS sample rate (default: 1000)
  --headless             Headless browser
  --screenshot           Take screenshots (default: true)
`);
  process.exit(0);
}

class FPSMeasurement {
  samples = [];
  start() { this.samples = []; }
  add(fps) { this.samples.push(fps); }
  stats() {
    if (!this.samples.length) return { min: 0, max: 0, avg: 0, median: 0, n: 0 };
    const sorted = [...this.samples].sort((a, b) => a - b);
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: this.samples.reduce((a, b) => a + b, 0) / this.samples.length,
      median: sorted[Math.floor(sorted.length / 2)],
      n: this.samples.length,
    };
  }
}

async function measureFPS(page, duration, interval) {
  await page.evaluate(() => {
    if (window.__fps) return;
    window.__fps = { fps: 0, frames: 0, last: performance.now(), updated: performance.now(),
      tick() {
        this.frames++;
        const now = performance.now();
        if (now - this.last >= 1000) {
          this.fps = Math.round((this.frames * 1000) / (now - this.last));
          this.frames = 0;
          this.last = now;
          this.updated = now;
        }
        requestAnimationFrame(() => this.tick());
      },
      stale() { return performance.now() - this.updated > 2000; }
    };
    window.__fps.tick();
  });

  await new Promise((r) => setTimeout(r, 2000));

  const m = new FPSMeasurement();
  m.start();

  const end = Date.now() + duration * 1000;
  let staleCount = 0;
  while (Date.now() < end) {
    const { fps, stale } = await page.evaluate(() => ({ fps: window.__fps?.fps || 0, stale: window.__fps?.stale?.() ?? true }));
    if (stale && staleCount++ < 3) console.warn("FPS stale");
    m.add(fps);
    console.log(`  FPS: ${fps}${stale ? " (stale)" : ""}`);
    await new Promise((r) => setTimeout(r, interval));
  }

  return m.stats();
}

function grade(avg) {
  if (avg >= 60) return "EXCELLENT";
  if (avg >= 45) return "GOOD";
  if (avg >= 30) return "OK";
  if (avg >= 20) return "POOR";
  return "BAD";
}

async function run() {
  const { BotPoolManager } = await loadShared();

  const botCount = parseInt(opts.bots, 10);
  const duration = parseInt(opts.duration, 10);
  const interval = parseInt(opts["sample-interval"], 10);

  console.log(`\nClient: ${opts["client-url"]} | Server: ${opts["ws-url"]} | Bots: ${botCount} | Duration: ${duration}s\n`);

  console.log("Launching browser...");
  const browser = await chromium.launch({
    headless: opts.headless,
    args: ["--disable-web-security", "--disable-features=VizDisplayCompositor"],
  });

  const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();

  console.log(`Loading ${opts["client-url"]}...`);
  await page.goto(opts["client-url"], { waitUntil: "networkidle" });
  await page.waitForSelector("canvas", { timeout: 120000, state: "attached" });
  await new Promise((r) => setTimeout(r, 5000));

  console.log(`\nSpawning ${botCount} bots...\n`);
  const pool = new BotPoolManager({
    wsUrl: opts["ws-url"],
    botCount,
    behavior: "idle",
    rampUpDelayMs: 20,
    updateInterval: 5000,
    onProgress: (c, t) => process.stdout.write(`\r  ${Math.floor((c / t) * 100)}% (${c}/${t})`),
    onBotError: () => {},
  });

  await pool.start();
  console.log("\n\nMeasuring FPS...\n");

  if (opts.screenshot) {
    await page.screenshot({ path: "load-test-start.png" });
    console.log("Screenshot: load-test-start.png");
  }

  const fps = await measureFPS(page, duration, interval);

  if (opts.screenshot) {
    await page.screenshot({ path: "load-test-end.png" });
    console.log("Screenshot: load-test-end.png");
  }

  const bots = pool.getAggregatedMetrics();

  console.log("\nStopping...");
  await pool.stop();
  await browser.close();

  console.log(`
${"=".repeat(40)}
FPS: min=${fps.min} max=${fps.max} avg=${fps.avg.toFixed(1)} median=${fps.median}
Bots: ${bots.connectedBots}/${bots.totalBots} | Grade: ${grade(fps.avg)}
${"=".repeat(40)}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
