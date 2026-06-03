#!/usr/bin/env node
import { parseArgs } from "node:util";

const PRESETS = {
  "rendering-test": { bots: 100, behavior: "idle", duration: 120, label: "RENDERING TEST (100 idle)" },
  "ccu-test": { bots: 1000, behavior: "wander", duration: 300, label: "CCU TEST (1000 wander)" },
};

async function loadShared() {
  try {
    const shared = await import("@hyperforge/shared");
    if (typeof shared.BotPoolManager === "function") {
      return shared;
    }
  } catch {
    // Fall through to source-path fallback below.
  }

  try {
    const botPoolUrl = new URL(
      "../packages/shared/src/testing/BotPoolManager.ts",
      import.meta.url,
    );
    const { BotPoolManager } = await import(botPoolUrl.href);
    return { BotPoolManager };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to load BotPoolManager: ${message}`);
    console.error("Run: bun run build:shared");
    process.exit(1);
  }
}

const opts = parseArgs({
  options: {
    help: { type: "boolean", short: "h" },
    bots: { type: "string", short: "b", default: "10" },
    behavior: { type: "string", default: "wander" },
    duration: { type: "string", short: "d", default: "60" },
    "ramp-delay": { type: "string", default: "50" },
    "update-interval": { type: "string", default: "3000" },
    "connect-timeout": { type: "string", default: "15000" },
    url: { type: "string", default: "ws://localhost:5555/ws" },
    "rendering-test": { type: "boolean" },
    "ccu-test": { type: "boolean" },
    verbose: { type: "boolean", short: "v" },
  },
  strict: true,
}).values;

if (opts.help) {
  console.log(`
Load Test: bun scripts/load-test.mjs [options]

Options:
  -b, --bots <n>       Number of bots (default: 10)
  --behavior <type>    idle, wander, explore, sprint (default: wander)
  -d, --duration <s>   Duration in seconds (default: 60)
  --ramp-delay <ms>    Delay between connections (default: 50)
  --connect-timeout <ms> Connection timeout (default: 15000)
  --url <ws>           Server URL (default: ws://localhost:5555/ws)
  -v, --verbose        Show errors

Presets:
  --rendering-test     100 idle bots
  --ccu-test           1000 wandering bots
`);
  process.exit(0);
}

const fmt = (ms) => { const s = Math.floor(ms / 1000); return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`; };

function progress(c, t, e) {
  if (t === 0) return;
  const w = 40, p = Math.floor((c / t) * w);
  process.stdout.write(`\r[${"█".repeat(p)}${"░".repeat(w - p)}] ${Math.floor((c / t) * 100)}% (${c}/${t}, ${e} err)`);
}

function summary(m) {
  const rate = m.totalBots > 0 ? ((m.connectedBots / m.totalBots) * 100).toFixed(1) : "0";
  console.log(`
${"=".repeat(50)}
RESULTS: ${m.connectedBots}/${m.totalBots} connected (${rate}%)
Duration: ${fmt(m.poolRuntime)} | Msg/s: ${m.messagesPerSecond.toFixed(2)} | Errors: ${m.totalErrors}
${"=".repeat(50)}`);
}

async function run() {
  const { BotPoolManager } = await loadShared();

  const preset = PRESETS[opts["rendering-test"] ? "rendering-test" : opts["ccu-test"] ? "ccu-test" : null];
  if (preset) console.log(`Running ${preset.label}`);

  const botCount = preset?.bots ?? parseInt(opts.bots, 10);
  const behavior = preset?.behavior ?? opts.behavior;
  const duration = preset?.duration ?? parseInt(opts.duration, 10);

  if (!["idle", "wander", "explore", "sprint"].includes(behavior)) {
    console.error(`Invalid behavior: ${behavior}`);
    process.exit(1);
  }

  console.log(`\nServer: ${opts.url} | Bots: ${botCount} | Behavior: ${behavior} | Duration: ${duration}s\n`);

  const pool = new BotPoolManager({
    wsUrl: opts.url,
    botCount,
    behavior,
    rampUpDelayMs: parseInt(opts["ramp-delay"], 10),
    updateInterval: parseInt(opts["update-interval"], 10),
    connectTimeoutMs: parseInt(opts["connect-timeout"], 10),
    onProgress: progress,
    onBotError: opts.verbose ? (n, e) => console.error(`\n${n}: ${e.message}`) : () => {},
  });

  let done = false;
  const shutdown = async () => {
    if (done) return;
    done = true;
    console.log("\n");
    summary(pool.getAggregatedMetrics());
    await pool.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await pool.start();
  console.log("\n\nRunning... Ctrl+C to stop\n");

  const interval = setInterval(() => {
    if (done) return;
    const m = pool.getAggregatedMetrics();
    console.log(`[${fmt(m.poolRuntime)}] ${m.connectedBots}/${m.totalBots} | ${m.messagesPerSecond.toFixed(1)} msg/s | ${m.totalErrors} err`);
  }, 10000);

  await new Promise((r) => setTimeout(r, duration * 1000));
  clearInterval(interval);
  await shutdown();
}

run().catch((e) => { console.error(e); process.exit(1); });
