import * as esbuild from "esbuild";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "../");

// Note: Model bounds extraction is handled by turbo task `extract-bounds`
// which runs before this build script with proper caching based on GLB file changes.
// See turbo.json: server#extract-bounds

// Build the server
const serverCtx = await esbuild.context({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  platform: "node",
  format: "esm",
  bundle: true,
  treeShaking: true,
  minify: false,
  sourcemap: true,
  packages: "external",
  external: ["@hyperforge/shared"],
  target: "node22",
  loader: {
    ".ts": "ts",
  },
});

await serverCtx.rebuild();
await serverCtx.dispose();

// Build the agent behavior worker as a separate file (loaded by worker_threads)
const workerCtx = await esbuild.context({
  entryPoints: ["src/eliza/worker/agentBehaviorWorker.ts"],
  outfile: "dist/agentBehaviorWorker.js",
  platform: "node",
  format: "esm",
  bundle: true,
  treeShaking: true,
  minify: false,
  sourcemap: true,
  packages: "external",
  external: ["@hyperforge/shared"],
  target: "node22",
  loader: {
    ".ts": "ts",
  },
});

await workerCtx.rebuild();
await workerCtx.dispose();
console.log("✓ Agent behavior worker built");

const sha256File = (filePath) =>
  createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
const serverBundleSha256 = sha256File(path.join(rootDir, "dist/index.js"));
const behaviorWorkerSha256 = sha256File(
  path.join(rootDir, "dist/agentBehaviorWorker.js"),
);
const dependencyLockSha256 = sha256File(path.join(rootDir, "../../bun.lock"));
const buildId = createHash("sha256")
  .update(
    [
      "hyperia-competitive-build-v1",
      serverBundleSha256,
      behaviorWorkerSha256,
      dependencyLockSha256,
    ].join("\n"),
  )
  .digest("hex");
fs.writeFileSync(
  path.join(rootDir, "dist/competitive-build.json"),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      algorithm: "sha256",
      buildId,
      serverBundleSha256,
      behaviorWorkerSha256,
      dependencyLockSha256,
    },
    null,
    2,
  )}\n`,
);
console.log(`✓ Competitive build manifest generated (${buildId.slice(0, 12)})`);

// Copy PhysX WASM files to assets/web/ for server-side loading
const assetsDir = path.join(rootDir, "world/assets/web");
fs.mkdirSync(assetsDir, { recursive: true });

// Copy from physx-js-webidl package in workspace
const physxWasm = path.join(
  rootDir,
  "../physx-js-webidl/dist/physx-js-webidl.wasm",
);
const physxJs = path.join(
  rootDir,
  "../physx-js-webidl/dist/physx-js-webidl.js",
);

if (fs.existsSync(physxWasm)) {
  fs.copyFileSync(physxWasm, path.join(assetsDir, "physx-js-webidl.wasm"));
  fs.copyFileSync(physxJs, path.join(assetsDir, "physx-js-webidl.js"));
  console.log("✓ PhysX assets copied to world/assets/web/");
} else {
  console.error("❌ PhysX WASM not found at:", physxWasm);
  throw new Error(
    "PhysX WASM files missing - ensure @hyperforge/physx-js-webidl is built first",
  );
}

console.log("✓ Server built successfully");
