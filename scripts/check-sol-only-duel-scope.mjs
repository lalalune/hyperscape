#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const explicitFiles = [
  ".env.example",
  "scripts/duel-stack.mjs",
  "scripts/duel-stack-topology.mjs",
  "scripts/test-duel-stack-hyperbet-backend.mjs",
  "scripts/verify-duel-oracle-local.mjs",
  "scripts/configure-r2-cors.sh",
  "docs/duel-stack.md",
  "docs/duel-arena-oracle-deploy.md",
  "packages/server/.env.example",
  "packages/server/src/database/schema.ts",
  "packages/server/src/startup/http-server.ts",
  "packages/server/src/middleware/csrf.ts",
  "packages/website/.env.example",
  "packages/website/package.json",
  "packages/website/src/app/arena/page.tsx",
  "packages/website/src/app/sitemap.ts",
  "packages/website/src/components/Header.tsx",
  "packages/website/src/components/HeaderMobileMenu.tsx",
  "packages/website/src/lib/links.ts",
];

const recursiveDirectories = [
  "packages/server/src/oracle",
  "packages/client/src/components/streaming",
];

const allowedExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".md"]);

function collectFiles(directory) {
  const absoluteDirectory = path.resolve(rootDir, directory);
  if (!fs.existsSync(absoluteDirectory)) return [];

  const files = [];
  for (const entry of fs.readdirSync(absoluteDirectory, {
    withFileTypes: true,
  })) {
    const relativePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(relativePath));
    } else if (allowedExtensions.has(path.extname(entry.name))) {
      files.push(relativePath);
    }
  }
  return files;
}

const scannedFiles = Array.from(
  new Set([...explicitFiles, ...recursiveDirectories.flatMap(collectFiles)]),
).sort();

const activeBootstrapFiles = new Set([
  ".env.example",
  "docs/duel-stack.md",
  "packages/server/.env.example",
  "scripts/duel-stack.mjs",
  "scripts/duel-stack-topology.mjs",
]);

const forbiddenRules = [
  {
    name: "retired betting-token vocabulary",
    pattern:
      /\b(?:GOLD|USDC)\b|\$GOLD|goldAmount|goldBalance|goldHoldDays|FeeGold|GOLD_(?:MINT|TOKEN)|SOLANA_GOLD|DUEL_SOLANA_GOLD/,
  },
  {
    name: "non-Solana duel-chain vocabulary",
    pattern:
      /\b(?:AVAX|Avalanche|BSC)\b|Base (?:Sepolia|Mainnet)|duel-oracle-evm|hyperbet-bsc|EvmOracle|DUEL_ARENA_ORACLE_EVM/i,
  },
  {
    name: "alternate-chain bootstrap on the active duel path",
    pattern: /\b(?:skip-)?chain-setup\b|\b(?:anvil|mud|forge)\b/i,
    files: activeBootstrapFiles,
  },
];

const violations = [];
for (const relativePath of scannedFiles) {
  const absolutePath = path.resolve(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    violations.push({
      file: relativePath,
      rule: "required launch-scope file is missing",
      line: 0,
      text: "",
    });
    continue;
  }

  const lines = fs.readFileSync(absolutePath, "utf8").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    for (const rule of forbiddenRules) {
      if (rule.files && !rule.files.has(relativePath)) continue;
      if (rule.pattern.test(lines[index])) {
        violations.push({
          file: relativePath,
          rule: rule.name,
          line: index + 1,
          text: lines[index].trim(),
        });
      }
    }
  }
}

const removedBettingPanel = "packages/client/src/game/panels/BettingPanel";
if (fs.existsSync(path.resolve(rootDir, removedBettingPanel))) {
  violations.push({
    file: removedBettingPanel,
    rule: "retired in-game betting panel must remain absent",
    line: 0,
    text: "",
  });
}

const removedWebsiteBettingPaths = [
  "packages/website/src/app/gold",
  "packages/website/src/components/GoldToken",
  "packages/website/src/lib/gold-data.ts",
  "packages/website/public/images/gold-banner.png",
  "packages/website/public/images/gold-cta.png",
  "packages/website/public/images/gold_background.png",
  "packages/website/public/images/token.png",
];
for (const removedPath of removedWebsiteBettingPaths) {
  if (fs.existsSync(path.resolve(rootDir, removedPath))) {
    violations.push({
      file: removedPath,
      rule: "retired website betting-token surface must remain absent",
      line: 0,
      text: "",
    });
  }
}

const websitePackageJson = JSON.parse(
  fs.readFileSync(
    path.resolve(rootDir, "packages/website/package.json"),
    "utf8",
  ),
);
for (const dependencyName of ["@solana/web3.js", "hls.js"]) {
  if (websitePackageJson.dependencies?.[dependencyName]) {
    violations.push({
      file: "packages/website/package.json",
      rule: "website must not ship the retired duplicate betting client",
      line: 0,
      text: dependencyName,
    });
  }
}

const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(rootDir, "package.json"), "utf8"),
);
for (const scriptName of ["duel-oracle:build", "duel-oracle:pack"]) {
  const command = packageJson.scripts?.[scriptName];
  const retiredPackageName = ["duel", "oracle", "evm"].join("-");
  if (
    typeof command !== "string" ||
    !command.includes("duel-oracle-solana") ||
    command.includes(retiredPackageName)
  ) {
    violations.push({
      file: "package.json",
      rule: `${scriptName} must target the Solana oracle package`,
      line: 0,
      text: String(command ?? ""),
    });
  }
}

if (violations.length > 0) {
  console.error(
    JSON.stringify(
      { ok: false, scannedFiles: scannedFiles.length, violations },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log(
  JSON.stringify({
    ok: true,
    scannedFiles: scannedFiles.length,
    asset: "native SOL",
    authoritativeUnit: "lamports",
    retiredBettingPanel: true,
    retiredWebsiteBettingClient: true,
  }),
);
