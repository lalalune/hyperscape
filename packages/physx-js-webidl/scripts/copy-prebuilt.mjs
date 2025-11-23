#!/usr/bin/env bun

import { existsSync, mkdirSync, copyFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const distDir = join(rootDir, "dist");
const sourceDir = join(rootDir, "..", "client", "public");
const typesDir = join(rootDir, "types");

// Files to copy
const files = [
  {
    src: join(sourceDir, "physx-js-webidl.js"),
    dest: join(distDir, "physx-js-webidl.js"),
  },
  {
    src: join(sourceDir, "physx-js-webidl.wasm"),
    dest: join(distDir, "physx-js-webidl.wasm"),
  },
  {
    src: join(typesDir, "physx-js-webidl.d.ts"),
    dest: join(distDir, "physx-js-webidl.d.ts"),
  },
];

// Check if dist files already exist
const allExist = files.every((f) => existsSync(f.dest));
if (allExist) {
  console.log("PhysX already built, skipping...");
  process.exit(0);
}

// Create dist directory
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

// Copy files
let copied = 0;
for (const { src, dest } of files) {
  if (!existsSync(src)) {
    console.error(`ERROR: Prebuilt file not found: ${src}`);
    console.error("Please ensure PhysX prebuilt files are committed to the repository.");
    process.exit(1);
  }

  copyFileSync(src, dest);
  copied++;
}

console.log(`✓ Copied ${copied} prebuilt PhysX files to dist/`);
