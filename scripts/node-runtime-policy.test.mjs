import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertHyperiaNodeVersion,
  HYPERIA_NODE_TYPES_VERSION,
  HYPERIA_NODE_VERSION,
} from "./node-runtime-policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("accepts only the exact pinned Node runtime", () => {
  assert.equal(assertHyperiaNodeVersion("v22.23.2"), HYPERIA_NODE_VERSION);
  assert.equal(assertHyperiaNodeVersion("22.23.2"), HYPERIA_NODE_VERSION);

  for (const version of [
    "v22.23.1",
    "v22.24.0",
    "v24.19.0",
    "v25.2.1",
    "v26.0.0",
    "not-a-version",
    "",
  ]) {
    assert.throws(
      () => assertHyperiaNodeVersion(version),
      new RegExp(`requires Node\\.js ${HYPERIA_NODE_VERSION} exactly`),
    );
  }
});

test("keeps local, manifest, container, and server-start pins synchronized", () => {
  assert.equal(read(".node-version").trim(), HYPERIA_NODE_VERSION);
  assert.equal(read(".nvmrc").trim(), HYPERIA_NODE_VERSION);

  const rootManifest = JSON.parse(read("package.json"));
  const serverManifest = JSON.parse(read("packages/server/package.json"));
  assert.equal(rootManifest.engines.node, HYPERIA_NODE_VERSION);
  assert.equal(serverManifest.engines.node, HYPERIA_NODE_VERSION);
  assert.equal(
    rootManifest.overrides["@types/node"],
    HYPERIA_NODE_TYPES_VERSION,
  );
  assert.equal(
    rootManifest.scripts.preinstall,
    "node scripts/node-runtime-policy.mjs",
  );
  assert.match(
    serverManifest.scripts.prestart,
    /^node \.\.\/\.\.\/scripts\/node-runtime-policy\.mjs && /,
  );
  assert.equal(
    serverManifest.scripts.start,
    "node --import ./scripts/register-hooks.mjs ../../scripts/start-hyperia-server.mjs",
  );

  const dockerfile = read("Dockerfile.server");
  assert.match(
    dockerfile,
    new RegExp(
      `FROM node:${HYPERIA_NODE_VERSION}-bookworm-slim AS node-build-tools`,
    ),
  );
  assert.match(
    dockerfile,
    new RegExp(`FROM node:${HYPERIA_NODE_VERSION}-trixie-slim AS runtime`),
  );
  assert.match(
    dockerfile,
    /CMD \["node", "--import", "\/app\/packages\/server\/scripts\/register-hooks\.mjs", "\/app\/scripts\/start-hyperia-server\.mjs"\]/,
  );

  for (const relativePath of [
    "package.json",
    "packages/asset-forge/package.json",
    "packages/client/package.json",
    "packages/decimation/package.json",
    "packages/duel-oracle-evm/package.json",
    "packages/procgen/package.json",
    "packages/server/package.json",
    "packages/shared/package.json",
    "packages/vast-keeper/package.json",
    "packages/web3/package.json",
    "packages/website/package.json",
  ]) {
    const manifest = JSON.parse(read(relativePath));
    assert.equal(
      manifest.devDependencies["@types/node"],
      HYPERIA_NODE_TYPES_VERSION,
      `${relativePath} must use the Node 22 type line`,
    );
  }
});

test("makes every Bun workflow select the repository Node pin", () => {
  const workflowsDirectory = path.join(root, ".github", "workflows");
  const workflowNames = fs
    .readdirSync(workflowsDirectory)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"));

  for (const name of workflowNames) {
    const source = fs.readFileSync(path.join(workflowsDirectory, name), "utf8");
    if (source.includes("oven-sh/setup-bun")) {
      let bunSetupIndex = source.indexOf("oven-sh/setup-bun");
      while (bunSetupIndex >= 0) {
        const precedingSteps = source.slice(
          Math.max(0, bunSetupIndex - 500),
          bunSetupIndex,
        );
        assert.match(
          precedingSteps,
          /uses: actions\/setup-node@v6[\s\S]*?node-version-file: \.node-version/,
          `${name} must install the pinned Node runtime before every Bun setup`,
        );
        bunSetupIndex = source.indexOf("oven-sh/setup-bun", bunSetupIndex + 1);
      }
    }

    if (source.includes("actions/setup-node")) {
      assert.doesNotMatch(
        source,
        /^\s+node-version:\s/m,
        `${name} must not carry a second inline Node pin`,
      );
      assert.match(
        source,
        /node-version-file: \.node-version/,
        `${name} must use .node-version`,
      );
    }
  }
});

test("checks the runtime before the duel launcher mutates or builds anything", () => {
  const launcher = read("scripts/duel-stack.mjs");
  const mainBody = launcher.slice(launcher.indexOf("async function main()"));
  const runtimeCheck = mainBody.indexOf(
    "assertSupportedUwsNodeVersion(nodeVersion)",
  );
  const firstOutputMutation = mainBody.indexOf(
    "prepareHlsOutput(hlsOutputPath)",
  );

  assert.ok(runtimeCheck >= 0, "launcher runtime check must exist");
  assert.ok(firstOutputMutation >= 0, "launcher output preparation must exist");
  assert.ok(
    runtimeCheck < firstOutputMutation,
    "runtime check must happen before output preparation",
  );
});
