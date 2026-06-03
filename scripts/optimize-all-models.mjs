#!/usr/bin/env node
/**
 * Model Optimization Script for Hyperia
 * 
 * Optimizes all GLB models using individual gltf-transform commands:
 * - weld → simplify → meshopt (preserves embedded textures)
 * 
 * Triangle Limits:
 * - Characters, Mobs, World Objects: 20,000 triangles
 * - Items, Armor, Weapons: 10,000 triangles
 * 
 * Usage: node scripts/optimize-all-models.mjs [options]
 * 
 * Options:
 *   --dry-run       Show what would be done without making changes
 *   --backup        Create backups before modifying
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, statSync, copyFileSync, mkdirSync, unlinkSync, renameSync } from 'fs';
import { basename, dirname, extname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');

// Asset directory
const MODEL_DIR = 'packages/server/world/assets/models';

// Triangle limits by category
const TRIANGLE_LIMITS = {
  // Characters and mobs - 20k max
  character: 20000, mob: 20000, npc: 20000, avatar: 20000,
  human: 20000, goblin: 20000, imp: 20000, troll: 20000, thug: 20000,
  // World objects - 20k max
  tree: 20000, rock: 20000, ore: 20000, furnace: 20000, anvil: 20000,
  altar: 20000, bank: 20000, cooking: 20000, chest: 20000, stump: 20000,
  grass: 20000, vegetation: 20000,
  // Items - 10k max
  sword: 10000, bow: 10000, mace: 10000, shield: 10000, armor: 10000,
  chainbody: 10000, helmet: 10000, pickaxe: 10000, hatchet: 10000,
  fishing: 10000, rod: 10000, arrows: 10000, logs: 10000,
  // Default
  default: 20000,
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  backup: args.includes('--backup'),
};

// Stats
const stats = {
  processed: 0,
  optimized: 0,
  skipped: 0,
  errors: [],
  totalSavedBytes: 0,
};

function log(msg, level = 'info') {
  const prefix = {
    info: '\x1b[36mℹ\x1b[0m',
    warn: '\x1b[33m⚠\x1b[0m',
    error: '\x1b[31m✗\x1b[0m',
    success: '\x1b[32m✓\x1b[0m',
  }[level] || 'ℹ';
  console.log(`${prefix} ${msg}`);
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

function getGltfTransformCmd() {
  return `node ./node_modules/@gltf-transform/cli/bin/cli.js`;
}

function categorizeModel(filepath) {
  const name = basename(filepath).toLowerCase();
  const dir = dirname(filepath).toLowerCase();
  const fullPath = (dir + '/' + name).toLowerCase();
  
  for (const [category, limit] of Object.entries(TRIANGLE_LIMITS)) {
    if (category === 'default') continue;
    if (fullPath.includes(category)) {
      return { category, limit };
    }
  }
  
  return { category: 'default', limit: TRIANGLE_LIMITS.default };
}

function getModelTriangles(filepath) {
  try {
    const output = execSync(`${getGltfTransformCmd()} inspect "${filepath}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: ROOT_DIR,
    });
    
    const match = output.match(/TRIANGLES\s*│\s*\d+\s*│\s*([\d,]+)/);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''), 10);
    }
    return -1;
  } catch {
    return -1;
  }
}

function findModels(dir, results = []) {
  if (!existsSync(dir)) return results;
  
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (!['node_modules', '.git', 'animations', 'sprites', 'backup'].includes(entry.name)) {
        findModels(fullPath, results);
      }
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (ext === '.glb') {
        // Skip LOD files
        if (!entry.name.includes('_lod1') && !entry.name.includes('_lod2')) {
          results.push(fullPath);
        }
      }
    }
  }
  
  return results;
}

function runCmd(cmd) {
  try {
    execSync(cmd, { stdio: 'pipe', cwd: ROOT_DIR });
    return true;
  } catch {
    return false;
  }
}

async function optimizeModel(filepath) {
  const relativePath = relative(ROOT_DIR, filepath);
  const fileStats = statSync(filepath);
  const originalSize = fileStats.size;
  const { category, limit } = categorizeModel(filepath);
  
  // Get current triangle count
  const triangles = getModelTriangles(filepath);
  if (triangles < 0) {
    log(`${relativePath} - Error reading model`, 'error');
    stats.errors.push({ file: relativePath, error: 'Could not read model' });
    stats.skipped++;
    return;
  }
  
  // Calculate simplification ratio
  const needsSimplify = triangles > limit;
  const simplifyRatio = needsSimplify ? (limit / triangles) * 0.95 : 1.0; // 5% margin
  
  log(`${relativePath}`);
  log(`  ${category}: ${triangles.toLocaleString()} tris (limit: ${limit.toLocaleString()})`);
  
  if (options.dryRun) {
    if (needsSimplify) {
      log(`  Would simplify to ~${Math.floor(triangles * simplifyRatio).toLocaleString()} triangles`);
    }
    log(`  Would apply meshopt compression`);
    return;
  }
  
  // Create backup if requested
  if (options.backup) {
    const backupDir = join(dirname(filepath), 'backup');
    const backupPath = join(backupDir, basename(filepath));
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }
    if (!existsSync(backupPath)) {
      copyFileSync(filepath, backupPath);
    }
  }
  
  // Create temp files
  const temp1 = filepath + '.temp1.glb';
  const temp2 = filepath + '.temp2.glb';
  
  try {
    let currentFile = filepath;
    
    // Step 1: Weld vertices (helps with simplification)
    if (runCmd(`${getGltfTransformCmd()} weld "${currentFile}" "${temp1}"`)) {
      currentFile = temp1;
    }
    
    // Step 2: Simplify if needed
    if (needsSimplify) {
      const error = triangles > 50000 ? 0.1 : 0.05; // Higher error for very high poly
      const target = currentFile === temp1 ? temp2 : temp1;
      if (runCmd(`${getGltfTransformCmd()} simplify "${currentFile}" "${target}" --ratio ${simplifyRatio.toFixed(4)} --error ${error}`)) {
        if (currentFile === temp1) currentFile = temp2;
        else currentFile = temp1;
      }
    }
    
    // Step 3: Meshopt compression
    const finalTemp = currentFile === temp1 ? temp2 : temp1;
    if (runCmd(`${getGltfTransformCmd()} meshopt "${currentFile}" "${finalTemp}" --level medium`)) {
      currentFile = finalTemp;
    }
    
    // Replace original with optimized
    if (existsSync(currentFile) && currentFile !== filepath) {
      unlinkSync(filepath);
      renameSync(currentFile, filepath);
    }
    
    // Cleanup temp files
    if (existsSync(temp1)) try { unlinkSync(temp1); } catch {}
    if (existsSync(temp2)) try { unlinkSync(temp2); } catch {}
    
    // Get new stats
    const newStats = statSync(filepath);
    const newTriangles = getModelTriangles(filepath);
    const savedBytes = originalSize - newStats.size;
    
    stats.totalSavedBytes += savedBytes > 0 ? savedBytes : 0;
    stats.optimized++;
    stats.processed++;
    
    const triangleStr = newTriangles > 0 ? newTriangles.toLocaleString() : '?';
    log(`  ✅ ${formatSize(originalSize)} → ${formatSize(newStats.size)}, ${triangles.toLocaleString()} → ${triangleStr} tris`, 'success');
    
    if (newTriangles > 0 && newTriangles > limit) {
      log(`  ⚠️  Still over limit (${newTriangles.toLocaleString()} > ${limit.toLocaleString()}) - use Blender for more decimation`, 'warn');
    }
    
  } catch (error) {
    stats.errors.push({ file: relativePath, error: error.message });
    log(`  Error: ${error.message}`, 'error');
    stats.processed++;
    
    // Clean up temp files
    if (existsSync(temp1)) try { unlinkSync(temp1); } catch {}
    if (existsSync(temp2)) try { unlinkSync(temp2); } catch {}
  }
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║           🚀 HYPERIA MODEL OPTIMIZATION                        ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  log(`Triangle Limits:`);
  log(`  - Characters, Mobs, World Objects: 20,000 triangles`);
  log(`  - Items, Armor, Weapons: 10,000 triangles`);
  log(``);
  log(`Options: Dry run: ${options.dryRun}, Backup: ${options.backup}`);
  log(``);
  
  // Find all models
  const modelDir = resolve(ROOT_DIR, MODEL_DIR);
  const models = findModels(modelDir);
  log(`Found ${models.length} models to process\n`);
  
  // Process each model
  for (const modelPath of models) {
    await optimizeModel(modelPath);
  }
  
  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('\n📊 OPTIMIZATION SUMMARY\n');
  
  console.log(`  Models processed: ${stats.processed}`);
  console.log(`  Models optimized: ${stats.optimized}`);
  console.log(`  Models skipped: ${stats.skipped}`);
  console.log(`  Total space saved: ${formatSize(stats.totalSavedBytes)}`);
  
  if (stats.errors.length > 0) {
    console.log(`\n  Errors: ${stats.errors.length}`);
    for (const err of stats.errors.slice(0, 5)) {
      console.log(`    - ${err.file}: ${err.error.substring(0, 50)}`);
    }
  }
  
  console.log(`\n✅ Done!\n`);
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
