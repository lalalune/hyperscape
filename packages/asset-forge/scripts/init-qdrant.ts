#!/usr/bin/env bun
/**
 * Initialize Qdrant Collections
 * Run this script to create all required Qdrant collections for asset-forge
 */

import { initializeQdrantCollections } from "../server/db/qdrant";

async function main() {
  console.log("🚀 Initializing Qdrant collections...\n");

  try {
    await initializeQdrantCollections();
    console.log("\n✅ Qdrant initialization complete!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Qdrant initialization failed:", error);
    process.exit(1);
  }
}

main();
