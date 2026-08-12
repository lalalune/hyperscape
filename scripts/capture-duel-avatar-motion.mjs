#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createServer } from "node:http";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import puppeteer from "puppeteer";

const MOTIONS = Object.freeze([
  {
    id: "idle",
    name: "Idle",
    asset: "emotes/emote-idle.glb",
    sampleRatio: 0.35,
  },
  {
    id: "walk",
    name: "Walk",
    asset: "emotes/emote-walk.glb",
    sampleRatio: 0.45,
  },
  {
    id: "run",
    name: "Run",
    asset: "emotes/emote-run.glb",
    sampleRatio: 0.45,
  },
  {
    id: "unarmed",
    name: "Unarmed attack",
    asset: "emotes/emote-punching.glb",
    sampleRatio: 0.5,
  },
  {
    id: "sword",
    name: "One-handed melee",
    asset: "emotes/emote_sword_swing.glb",
    sampleRatio: 0.45,
  },
  {
    id: "two-hand-idle",
    name: "Two-handed idle",
    asset: "emotes/emote-2h-idle.glb",
    sampleRatio: 0.4,
  },
  {
    id: "two-hand-slash",
    name: "Two-handed melee",
    asset: "emotes/emote-2h-slash.glb",
    sampleRatio: 0.45,
  },
  {
    id: "ranged",
    name: "Ranged attack",
    asset: "emotes/emote-range.glb",
    sampleRatio: 0.55,
  },
  {
    id: "magic",
    name: "Magic attack",
    asset: "emotes/emote-spell-cast.glb",
    sampleRatio: 0.55,
  },
  {
    id: "death",
    name: "Death",
    asset: "emotes/emote-death.glb",
    sampleRatio: 0.9,
  },
  {
    id: "victory",
    name: "Victory",
    asset: "emotes/emote-waving-both-hands.glb",
    sampleRatio: 0.55,
  },
  {
    id: "hit-reaction",
    name: "Hit reaction overlay",
    asset: "emotes/emote-idle.glb",
    sampleRatio: 0,
    hitReaction: {
      intensity: 1,
      side: 1,
      elapsedSeconds: 0.0504,
    },
  },
]);

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function writeAtomic(filePath, contents) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}`;
  try {
    writeFileSync(temporary, contents, { flag: "wx" });
    renameSync(temporary, filePath);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function safePath(root, relativePath) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  if (!resolved.startsWith(`${resolvedRoot}${path.sep}`)) return null;
  return resolved;
}

function parseCliArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (
      argument === "--avatar" ||
      argument === "--equipment" ||
      argument === "--item-id" ||
      argument === "--equipment-slot" ||
      argument === "--avatar-id" ||
      argument === "--grip" ||
      argument === "--output" ||
      argument === "--report"
    ) {
      const value = argv[index + 1];
      if (!value) throw new Error(`${argument} requires a path`);
      options[argument.slice(2)] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function resolveWorkspacePath(workspaceRoot, value, fallback, label) {
  const resolved = path.resolve(workspaceRoot, value ?? fallback);
  if (
    resolved !== workspaceRoot &&
    !resolved.startsWith(`${workspaceRoot}${path.sep}`)
  ) {
    throw new Error(`${label} must remain inside the workspace`);
  }
  return resolved;
}

function html(config) {
  const serialized = JSON.stringify(config).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Hyperia duel-avatar motion audit</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 26px; width: 1600px; background: #080b13; color: #f3f5fb; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      header { margin: 0 0 22px; }
      h1 { margin: 0 0 6px; font-size: 28px; letter-spacing: -0.02em; }
      header p { margin: 0; color: #99a4ba; font-size: 14px; }
      main { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
      article { overflow: hidden; border: 1px solid #28324a; border-radius: 14px; background: #111725; box-shadow: 0 12px 30px #0007; }
      article[data-status="fail"] { border-color: #a94055; }
      canvas { display: block; width: 100%; height: 440px; background: linear-gradient(#1b2740, #0c101a); }
      .meta { min-height: 99px; padding: 13px 15px 15px; border-top: 1px solid #28324a; }
      .name { font-size: 16px; font-weight: 700; }
      .asset { margin-top: 2px; color: #8f9ab0; font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; }
      .stats { margin-top: 10px; color: #67d9a8; font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; }
      article[data-status="fail"] .stats { color: #ff8c8c; }
      pre { white-space: pre-wrap; color: #ff8c8c; }
    </style>
  </head>
  <body>
    <header>
      <h1>Steve canonical-rig motion audit</h1>
      <p>Actual Hyperia retargeting and additive hit feedback · fixed representative poses · source registry unchanged</p>
    </header>
    <main></main>
    <script type="module">
      import { runDuelAvatarMotionAudit } from "/motion-audit.js";
      try {
        window.__motionReport = await runDuelAvatarMotionAudit(${serialized});
        document.body.dataset.ready = "true";
      } catch (error) {
        const output = document.createElement("pre");
        output.textContent = error?.stack ?? String(error);
        document.body.prepend(output);
        document.body.dataset.error = output.textContent;
      }
    </script>
  </body>
</html>`;
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const workspaceRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const assetsRoot = path.join(workspaceRoot, "packages/server/world/assets");
  const avatarPath = resolveWorkspacePath(
    assetsRoot,
    options.avatar,
    "avatars/duel-candidates/duel-steve.vrm",
    "Avatar path",
  );
  if (!existsSync(avatarPath))
    throw new Error(`Avatar is missing: ${avatarPath}`);
  const avatarAsset = path
    .relative(assetsRoot, avatarPath)
    .split(path.sep)
    .join("/");
  let equipment = null;
  if (options.equipment) {
    const equipmentPath = resolveWorkspacePath(
      assetsRoot,
      options.equipment,
      "",
      "Equipment path",
    );
    if (!existsSync(equipmentPath)) {
      throw new Error(`Equipment is missing: ${equipmentPath}`);
    }
    const itemId = options["item-id"];
    const avatarId = options["avatar-id"] ?? "steve";
    const slot = options["equipment-slot"] ?? "weapon";
    const grip = options.grip ?? "one-hand";
    const safeId = /^[a-zA-Z0-9_-]+$/u;
    if (!itemId || !safeId.test(itemId)) {
      throw new Error("--item-id must be a safe competitive item ID");
    }
    if (!safeId.test(avatarId)) {
      throw new Error("--avatar-id must be a safe competitive avatar ID");
    }
    if (slot !== "weapon" && slot !== "shield") {
      throw new Error("--equipment-slot must be weapon or shield");
    }
    if (grip !== "one-hand" && grip !== "two-hand") {
      throw new Error("--grip must be one-hand or two-hand");
    }
    equipment = {
      asset: path.relative(assetsRoot, equipmentPath).split(path.sep).join("/"),
      sha256: sha256(readFileSync(equipmentPath)),
      itemId,
      avatarId,
      slot,
      grip,
    };
  }
  for (const motion of MOTIONS) {
    if (!existsSync(path.join(assetsRoot, motion.asset))) {
      throw new Error(`Motion asset is missing: ${motion.asset}`);
    }
  }
  const outputPath = resolveWorkspacePath(
    workspaceRoot,
    options.output,
    "artifacts/duel-avatar-candidates/steve-motion-contact-sheet.png",
    "Output path",
  );
  const reportPath = resolveWorkspacePath(
    workspaceRoot,
    options.report,
    "artifacts/duel-avatar-candidates/steve-motion-report.json",
    "Report path",
  );
  const browserEntry = path.join(
    workspaceRoot,
    "scripts/duel-avatar-motion-browser.ts",
  );
  const bundleResult = await build({
    entryPoints: [browserEntry],
    absWorkingDir: workspaceRoot,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "chrome120",
    write: false,
    sourcemap: false,
    logLevel: "silent",
  });
  const bundle = bundleResult.outputFiles[0].contents;
  const config = {
    avatarAsset,
    avatarSha256: sha256(readFileSync(avatarPath)),
    motions: MOTIONS,
    equipment,
  };
  const server = createServer((request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname === "/") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(html(config));
        return;
      }
      if (url.pathname === "/motion-audit.js") {
        response.writeHead(200, {
          "content-type": "text/javascript; charset=utf-8",
        });
        response.end(bundle);
        return;
      }
      if (url.pathname === "/favicon.ico") {
        response.writeHead(204).end();
        return;
      }
      if (!url.pathname.startsWith("/asset/")) {
        response.writeHead(404).end();
        return;
      }
      const filePath = safePath(
        assetsRoot,
        decodeURIComponent(url.pathname.slice("/asset/".length)),
      );
      if (!filePath) {
        response.writeHead(403).end();
        return;
      }
      response.writeHead(200, {
        "content-type": "model/gltf-binary",
        "cache-control": "no-store",
      });
      response.end(readFileSync(filePath));
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end(error instanceof Error ? error.message : String(error));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("No local motion-audit server port");
  }

  let browser;
  try {
    const systemChrome =
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    const executablePath =
      process.env.PUPPETEER_EXECUTABLE_PATH ??
      (existsSync(systemChrome) ? systemChrome : undefined);
    browser = await puppeteer.launch({ headless: true, executablePath });
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1200, deviceScaleFactor: 1 });
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    await page.goto(`http://127.0.0.1:${address.port}/`, {
      waitUntil: "networkidle0",
      timeout: 120_000,
    });
    await page.waitForFunction(
      () =>
        document.body.dataset.ready === "true" || document.body.dataset.error,
      { timeout: 120_000 },
    );
    const pageError = await page.evaluate(() => document.body.dataset.error);
    if (pageError) throw new Error(pageError);
    const report = await page.evaluate(() => window.__motionReport);
    report.browserErrors = [...new Set(browserErrors)];
    report.inputs = Object.fromEntries(
      [
        avatarAsset,
        ...MOTIONS.map((motion) => motion.asset),
        ...(equipment ? [equipment.asset] : []),
      ].map((asset) => [
        asset,
        sha256(readFileSync(path.join(assetsRoot, asset))),
      ]),
    );
    if (report.browserErrors.length > 0) {
      report.failures.push(
        ...report.browserErrors.map((error) => `browser: ${error}`),
      );
    }
    const screenshot = await page.screenshot({ fullPage: true, type: "png" });
    writeAtomic(outputPath, screenshot);
    writeAtomic(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    if (report.failures.length > 0) {
      throw new Error(
        `Motion audit failed:\n${report.failures.map((failure) => `- ${failure}`).join("\n")}`,
      );
    }
    console.log(
      `Passed ${report.motions.length} Steve motions; report ${reportPath}; contact sheet ${outputPath}`,
    );
  } finally {
    await browser?.close();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
