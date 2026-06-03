#!/usr/bin/env node
/**
 * Full Model Optimization Script for Hyperia
 * 
 * Optimizes all models to meet triangle limits:
 * - Characters, Mobs, World Objects: 20,000 triangles max
 * - Items, Armor, Weapons: 10,000 triangles max
 * 
 * Also applies:
 * - Draco mesh compression (for non-skinned meshes)
 * - KTX2 texture compression (GPU-compressed)
 * - Meshopt compression (for skinned meshes - Draco doesn't support skins well)
 * 
 * Usage: node scripts/optimize-models-full.mjs [options]
 * 
 * Options:
 *   --dry-run       Show what would be done without making changes
 *   --verbose       Show detailed output
 *   --models-only   Skip VRM avatars (use optimize-avatars.py for those)
 *   --skip-ktx2     Skip KTX2 conversion (keep WebP)
 *   --skip-draco    Skip Draco compression (use meshopt only)
 *   --backup        Create backups before modifying
 */

import { execSync, spawnSync } from 'child_process';
import { existsSync, readdirSync, statSync, copyFileSync, mkdirSync, renameSync, unlinkSync } from 'fs';
import { basename, dirname, extname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');

// Asset directories
const MODEL_DIRS = [
  'packages/server/world/assets/models',
];

const AVATAR_DIR = 'packages/server/world/assets/avatars';

// Triangle limits by category
const TRIANGLE_LIMITS = {
  character: 20000, mob: 20000, npc: 20000, avatar: 20000,
  human: 20000, goblin: 20000, imp: 20000, troll: 20000, thug: 20000,
  tree: 20000, rock: 20000, ore: 20000, furnace: 20000, anvil: 20000,
  altar: 20000, bank: 20000, cooking: 20000, chest: 20000, stump: 20000,
  sword: 10000, bow: 10000, mace: 10000, shield: 10000, armor: 10000,
  chainbody: 10000, helmet: 10000, pickaxe: 10000, hatchet: 10000,
  fishing: 10000, rod: 10000, arrows: 10000, logs: 10000,
  default: 20000,
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  verbose: args.includes('--verbose'),
  modelsOnly: args.includes('--models-only'),
  skipKtx2: args.includes('--skip-ktx2'),
  skipDraco: args.includes('--skip-draco'),
  backup: args.includes('--backup'),
};

// Stats
const stats = {
  processed: 0,
  decimated: 0,
  compressed: 0,
  skipped: 0,
  errors: [],
  totalSaved: 0,
};

function log(msg, level = 'info') {
  const prefix = {
    info: '\x1b[36mℹ\x1b[0m',
    warn: '\x1b[33m⚠\x1b[0m',
    error: '\x1b[31m✗\x1b[0m',
    success: '\x1b[32m✓\x1b[0m',
    debug: '\x1b[90m·\x1b[0m',
  }[level] || 'ℹ';
  
  if (level === 'debug' && !options.verbose) return;
  console.log(`${prefix} ${msg}`);
}

function getGltfTransformCmd() {
  return `node ./node_modules/@gltf-transform/cli/bin/cli.js`;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
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
  
  if (extname(filepath).toLowerCase() === '.vrm') {
    return { category: 'avatar', limit: TRIANGLE_LIMITS.avatar };
  }
  
  return { category: 'default', limit: TRIANGLE_LIMITS.default };
}

function getModelInfo(filepath) {
  try {
    const output = execSync(`${getGltfTransformCmd()} inspect "${filepath}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: ROOT_DIR,
    });
    
    const result = {
      triangles: 0,
      hasSkinnedMesh: false,
      compression: 'none',
      textureFormat: 'unknown',
    };
    
    const meshMatch = output.match(/TRIANGLES\s*│\s*\d+\s*│\s*([\d,]+)\s*│\s*([\d,]+)/);
    if (meshMatch) {
      result.triangles = parseInt(meshMatch[1].replace(/,/g, ''), 10);
    }
    
    result.hasSkinnedMesh = output.includes('JOINTS_0');
    
    if (output.includes('EXT_meshopt_compression')) {
      result.compression = 'meshopt';
    } else if (output.includes('KHR_draco_mesh_compression')) {
      result.compression = 'draco';
    }
    
    if (output.includes('image/ktx2')) {
      result.textureFormat = 'ktx2';
    } else if (output.includes('image/webp')) {
      result.textureFormat = 'webp';
    } else if (output.includes('image/png')) {
      result.textureFormat = 'png';
    }
    
    return result;
  } catch (error) {
    return { error: error.message };
  }
}

function runGltfTransform(args, input, output) {
  const tempOutput = output + '.tmp';
  try {
    execSync(`${getGltfTransformCmd()} ${args} "${input}" "${tempOutput}"`, {
      stdio: 'pipe',
      cwd: ROOT_DIR,
    });
    
    if (existsSync(tempOutput)) {
      if (existsSync(output) && output !== input) {
        // Remove existing output
      }
      renameSync(tempOutput, output);
      return true;
    }
    return false;
  } catch (error) {
    if (existsSync(tempOutput)) {
      try { unlinkSync(tempOutput); } catch {}
    }
    log(`  gltf-transform failed: ${error.message}`, 'debug');
    return false;
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
      if (['.glb', '.gltf'].includes(ext)) {
        // Skip LOD files and raw files for optimization
        if (!entry.name.includes('_lod1') && !entry.name.includes('_lod2')) {
          results.push(fullPath);
        }
      }
    }
  }
  
  return results;
}

async function optimizeModel(filepath) {
  const relativePath = relative(ROOT_DIR, filepath);
  const fileStats = statSync(filepath);
  const originalSize = fileStats.size;
  const { category, limit } = categorizeModel(filepath);
  
  log(`\n📁 ${relativePath}`, 'info');
  
  const info = getModelInfo(filepath);
  if (info.error) {
    log(`  Error inspecting: ${info.error}`, 'error');
    stats.errors.push({ file: relativePath, error: info.error });
    stats.skipped++;
    return;
  }
  
  log(`  Triangles: ${info.triangles.toLocaleString()} (limit: ${limit.toLocaleString()})`, 'debug');
  log(`  Category: ${category}`, 'debug');
  log(`  Skinned: ${info.hasSkinnedMesh}`, 'debug');
  log(`  Current compression: ${info.compression}`, 'debug');
  log(`  Current textures: ${info.textureFormat}`, 'debug');
  
  const needsDecimation = info.triangles > limit;
  const needsDraco = !options.skipDraco && info.compression !== 'draco' && !info.hasSkinnedMesh;
  const needsMeshopt = info.hasSkinnedMesh && info.compression !== 'meshopt';
  const needsKtx2 = !options.skipKtx2 && info.textureFormat !== 'ktx2';
  
  if (!needsDecimation && !needsDraco && !needsMeshopt && !needsKtx2) {
    log(`  ✅ Already optimized`, 'success');
    stats.skipped++;
    return;
  }
  
  if (options.dryRun) {
    log(`  Would optimize:`, 'info');
    if (needsDecimation) {
      const ratio = limit / info.triangles;
      log(`    - Decimate from ${info.triangles.toLocaleString()} to ${limit.toLocaleString()} (ratio: ${(ratio * 100).toFixed(1)}%)`, 'info');
    }
    if (needsDraco) log(`    - Apply Draco compression`, 'info');
    if (needsMeshopt) log(`    - Apply Meshopt compression (skinned mesh)`, 'info');
    if (needsKtx2) log(`    - Convert textures to KTX2`, 'info');
    return;
  }
  
  // Create backup if requested
  if (options.backup) {
    const backupDir = join(dirname(filepath), 'backup');
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }
    const backupPath = join(backupDir, basename(filepath));
    if (!existsSync(backupPath)) {
      copyFileSync(filepath, backupPath);
      log(`  Backed up to ${relative(ROOT_DIR, backupPath)}`, 'debug');
    }
  }
  
  let currentFile = filepath;
  let tempFile = filepath + '.processing';
  
  try {
    // Step 1: Decompression (if needed for decimation with meshopt-compressed files)
    if (needsDecimation && info.compression === 'meshopt') {
      log(`  Decompressing meshopt for decimation...`, 'debug');
      if (runGltfTransform('dedup', currentFile, tempFile)) {
        copyFileSync(tempFile, currentFile);
        if (existsSync(tempFile)) unlinkSync(tempFile);
      }
    }
    
    // Step 2: Decimation (if needed) - use multiple passes for very high poly models
    if (needsDecimation) {
      const ratio = (limit / info.triangles) * 0.95; // Leave 5% margin
      log(`  Simplifying mesh from ${info.triangles.toLocaleString()} to ~${limit.toLocaleString()} triangles...`, 'info');
      
      // For very aggressive decimation (>10x reduction), use weld + multiple passes
      if (info.triangles > limit * 10) {
        log(`    Using aggressive multi-pass decimation...`, 'debug');
        
        // First pass: weld vertices
        const weldTemp = currentFile + '.weld.tmp';
        if (runGltfTransform('weld', currentFile, weldTemp)) {
          copyFileSync(weldTemp, currentFile);
          if (existsSync(weldTemp)) unlinkSync(weldTemp);
        }
        
        // Second pass: aggressive simplify with high error tolerance
        const error = 0.15; // Higher error for extreme decimation
        if (runGltfTransform(`simplify --ratio ${ratio.toFixed(4)} --error ${error}`, currentFile, tempFile)) {
          copyFileSync(tempFile, currentFile);
          if (existsSync(tempFile)) unlinkSync(tempFile);
        }
        
        // Third pass: additional simplify if still over limit
        const midInfo = getModelInfo(currentFile);
        if (midInfo.triangles && midInfo.triangles > limit) {
          const midRatio = (limit / midInfo.triangles) * 0.9;
          if (runGltfTransform(`simplify --ratio ${midRatio.toFixed(4)} --error 0.2`, currentFile, tempFile)) {
            copyFileSync(tempFile, currentFile);
            if (existsSync(tempFile)) unlinkSync(tempFile);
          }
        }
      } else {
        // Standard simplification
        const error = info.triangles > 50000 ? 0.05 : 0.01;
        if (runGltfTransform(`simplify --ratio ${ratio.toFixed(4)} --error ${error}`, currentFile, tempFile)) {
          copyFileSync(tempFile, currentFile);
          if (existsSync(tempFile)) unlinkSync(tempFile);
        }
      }
      
      stats.decimated++;
      const newInfo = getModelInfo(currentFile);
      log(`  New triangle count: ${newInfo.triangles?.toLocaleString() || 'unknown'}`, 'info');
      
      if (newInfo.triangles && newInfo.triangles > limit) {
        log(`  Warning: Could not reach target. Use Blender for more aggressive decimation.`, 'warn');
      }
    }
    
    // Step 3: Mesh compression (apply BEFORE texture changes to avoid losing compression)
    // Note: Draco doesn't work well with skinned meshes, use meshopt instead
    if (!info.hasSkinnedMesh && !options.skipDraco) {
      log(`  Applying Draco compression...`, 'info');
      if (runGltfTransform('draco', currentFile, tempFile)) {
        copyFileSync(tempFile, currentFile);
        if (existsSync(tempFile)) unlinkSync(tempFile);
        stats.compressed++;
      } else {
        log(`  Draco failed, trying meshopt...`, 'debug');
        if (runGltfTransform('meshopt --level medium', currentFile, tempFile)) {
          copyFileSync(tempFile, currentFile);
          if (existsSync(tempFile)) unlinkSync(tempFile);
          stats.compressed++;
        }
      }
    } else if (info.hasSkinnedMesh) {
      log(`  Applying Meshopt compression (skinned mesh)...`, 'info');
      if (runGltfTransform('meshopt --level medium', currentFile, tempFile)) {
        copyFileSync(tempFile, currentFile);
        if (existsSync(tempFile)) unlinkSync(tempFile);
        stats.compressed++;
      }
    }

    // Step 4: Texture compression to KTX2 (if needed)
    // Note: KTX2 requires PNG/JPEG input, not WebP. Convert WebP → PNG first.
    // KTX2 files are larger on disk but much better for GPU (no CPU decompression needed)
    if (needsKtx2) {
      log(`  Converting textures to KTX2 (UASTC)...`, 'info');
      
      // Get fresh info after compression
      const currentInfo = getModelInfo(currentFile);
      
      // First, convert WebP textures to PNG (required for KTX2)
      if (currentInfo.textureFormat === 'webp') {
        log(`    Converting WebP → PNG first...`, 'debug');
        const pngTemp = currentFile + '.png.tmp';
        if (runGltfTransform('png --formats webp', currentFile, pngTemp)) {
          copyFileSync(pngTemp, currentFile);
          if (existsSync(pngTemp)) unlinkSync(pngTemp);
        }
      }
      
      // Now convert to KTX2 using UASTC (higher quality than ETC1S)
      if (runGltfTransform('uastc --level 2 --zstd 18', currentFile, tempFile)) {
        copyFileSync(tempFile, currentFile);
        if (existsSync(tempFile)) unlinkSync(tempFile);
        log(`    KTX2 conversion complete (GPU-ready textures)`, 'debug');
      } else {
        log(`  KTX2 conversion failed - keeping original textures`, 'warn');
      }
    }
    
    // Final cleanup and stats
    const newStats = statSync(currentFile);
    const savedBytes = originalSize - newStats.size;
    stats.totalSaved += savedBytes;
    stats.processed++;
    
    log(`  ✅ Optimized: ${formatSize(originalSize)} → ${formatSize(newStats.size)} (saved ${formatSize(savedBytes)})`, 'success');
    
  } catch (error) {
    stats.errors.push({ file: relativePath, error: error.message });
    log(`  ❌ Error: ${error.message}`, 'error');
  } finally {
    // Cleanup temp files
    if (existsSync(tempFile)) {
      try { unlinkSync(tempFile); } catch {}
    }
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
  log(`Options:`);
  log(`  Dry run: ${options.dryRun}`);
  log(`  Skip KTX2: ${options.skipKtx2}`);
  log(`  Skip Draco: ${options.skipDraco}`);
  log(`  Backup: ${options.backup}`);
  log(``);
  
  // Find all models
  const allModels = [];
  for (const modelDir of MODEL_DIRS) {
    const dir = resolve(ROOT_DIR, modelDir);
    const models = findModels(dir);
    allModels.push(...models);
    log(`Found ${models.length} models in ${modelDir}`);
  }
  
  log(`\nTotal: ${allModels.length} models to process\n`);
  log('═'.repeat(70));
  
  // Process each model
  for (const modelPath of allModels) {
    await optimizeModel(modelPath);
  }
  
  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('\n📊 OPTIMIZATION SUMMARY\n');
  
  console.log(`  Models processed: ${stats.processed}`);
  console.log(`  Models decimated: ${stats.decimated}`);
  console.log(`  Models compressed: ${stats.compressed}`);
  console.log(`  Models skipped: ${stats.skipped}`);
  console.log(`  Total space saved: ${formatSize(stats.totalSaved)}`);
  
  if (stats.errors.length > 0) {
    console.log(`\n  Errors: ${stats.errors.length}`);
    for (const err of stats.errors.slice(0, 5)) {
      console.log(`    - ${err.file}: ${err.error.substring(0, 50)}`);
    }
  }
  
  if (!options.modelsOnly) {
    console.log(`\n📝 VRM AVATARS:`);
    console.log(`  VRM files require special handling to preserve skinned meshes.`);
    console.log(`  Run: blender --background --python scripts/optimize-avatars.py`);
    console.log(`  Or update optimize-avatars.py to target 20k triangles.`);
  }
  
  console.log(`\n✅ Done!\n`);
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
