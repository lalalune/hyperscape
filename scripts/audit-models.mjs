#!/usr/bin/env node
/**
 * Model Audit Script for Hyperia
 * 
 * Audits all models in the assets folder and reports:
 * - Triangle counts vs. limits
 * - Compression status (Draco/Meshopt)
 * - Texture format (KTX2/WebP/PNG)
 * - VRM status and skinned mesh preservation
 * 
 * Triangle Limits:
 * - Characters, Mobs, World Items, Ores: 20,000 triangles
 * - Items, Armor, Weapons: 10,000 triangles
 * 
 * Usage: node scripts/audit-models.mjs [options]
 * 
 * Options:
 *   --verbose       Show all models, not just issues
 *   --json          Output as JSON
 *   --fix           Generate fix commands
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import { basename, dirname, extname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');

// Asset directories
const ASSET_DIRS = [
  'packages/server/world/assets/models',
  'packages/server/world/assets/avatars',
];

// Triangle limits by category
const TRIANGLE_LIMITS = {
  // Characters and mobs - 20k max
  character: 20000,
  mob: 20000,
  npc: 20000,
  avatar: 20000,
  human: 20000,
  goblin: 20000,
  imp: 20000,
  troll: 20000,
  thug: 20000,
  
  // World objects - 20k max
  tree: 20000,
  rock: 20000,
  ore: 20000,
  furnace: 20000,
  anvil: 20000,
  altar: 20000,
  bank: 20000,
  cooking: 20000,
  chest: 20000,
  stump: 20000,
  
  // Items - 10k max
  sword: 10000,
  bow: 10000,
  mace: 10000,
  shield: 10000,
  armor: 10000,
  chainbody: 10000,
  helmet: 10000,
  pickaxe: 10000,
  hatchet: 10000,
  fishing: 10000,
  rod: 10000,
  arrows: 10000,
  logs: 10000,
  
  // Default
  default: 20000,
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  verbose: args.includes('--verbose'),
  json: args.includes('--json'),
  fix: args.includes('--fix'),
};

// Stats
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  issues: [],
  models: [],
};

function log(msg) {
  if (!options.json) {
    console.log(msg);
  }
}

function getGltfTransformCmd() {
  return `node ./node_modules/@gltf-transform/cli/bin/cli.js`;
}

function categorizeModel(filepath) {
  const name = basename(filepath).toLowerCase();
  const dir = dirname(filepath).toLowerCase();
  const fullPath = (dir + '/' + name).toLowerCase();
  
  // Check for specific categories
  for (const [category, limit] of Object.entries(TRIANGLE_LIMITS)) {
    if (category === 'default') continue;
    if (fullPath.includes(category)) {
      return { category, limit };
    }
  }
  
  // VRM files are always avatars
  if (extname(filepath).toLowerCase() === '.vrm') {
    return { category: 'avatar', limit: TRIANGLE_LIMITS.avatar };
  }
  
  return { category: 'default', limit: TRIANGLE_LIMITS.default };
}

function inspectModel(filepath) {
  try {
    const output = execSync(`${getGltfTransformCmd()} inspect "${filepath}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: ROOT_DIR,
    });
    
    // Parse the output to extract key info
    const result = {
      filepath: relative(ROOT_DIR, filepath),
      triangles: 0,
      vertices: 0,
      meshCount: 0,
      hasSkinnedMesh: false,
      compression: 'none',
      textureFormat: 'unknown',
      textures: [],
    };
    
    // Extract triangle count (glPrimitives = triangles for TRIANGLES mode)
    const meshMatch = output.match(/TRIANGLES\s*│\s*\d+\s*│\s*([\d,]+)\s*│\s*([\d,]+)/);
    if (meshMatch) {
      result.triangles = parseInt(meshMatch[1].replace(/,/g, ''), 10);
      result.vertices = parseInt(meshMatch[2].replace(/,/g, ''), 10);
    }
    
    // Check for skinned mesh (JOINTS_0 attribute)
    result.hasSkinnedMesh = output.includes('JOINTS_0');
    
    // Check compression
    if (output.includes('EXT_meshopt_compression')) {
      result.compression = 'meshopt';
    } else if (output.includes('KHR_draco_mesh_compression')) {
      result.compression = 'draco';
    }
    
    // Check texture formats
    if (output.includes('image/ktx2')) {
      result.textureFormat = 'ktx2';
    } else if (output.includes('image/webp')) {
      result.textureFormat = 'webp';
    } else if (output.includes('image/png')) {
      result.textureFormat = 'png';
    } else if (output.includes('image/jpeg')) {
      result.textureFormat = 'jpeg';
    }
    
    // Count meshes
    const meshLines = output.match(/│ TRIANGLES │/g);
    result.meshCount = meshLines ? meshLines.length : 0;
    
    return result;
  } catch (error) {
    return {
      filepath: relative(ROOT_DIR, filepath),
      error: error.message,
    };
  }
}

function findModels(dir, results = []) {
  if (!existsSync(dir)) return results;
  
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (!['node_modules', '.git', 'animations', 'sprites'].includes(entry.name)) {
        findModels(fullPath, results);
      }
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (['.glb', '.gltf', '.vrm'].includes(ext)) {
        // Skip LOD files for base audit
        if (!entry.name.includes('_lod1') && !entry.name.includes('_lod2')) {
          results.push(fullPath);
        }
      }
    }
  }
  
  return results;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

async function main() {
  log('\n╔═══════════════════════════════════════════════════════════════════╗');
  log('║              🔍 HYPERIA MODEL AUDIT                            ║');
  log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  log('Triangle Limits:');
  log('  - Characters, Mobs, World Objects: 20,000 triangles');
  log('  - Items, Armor, Weapons: 10,000 triangles\n');
  
  // Find all models
  const allModels = [];
  for (const assetDir of ASSET_DIRS) {
    const dir = resolve(ROOT_DIR, assetDir);
    const models = findModels(dir);
    allModels.push(...models);
    log(`Found ${models.length} models in ${assetDir}`);
  }
  
  log(`\nTotal: ${allModels.length} models to audit\n`);
  log('═'.repeat(70) + '\n');
  
  // Audit each model
  for (const modelPath of allModels) {
    stats.total++;
    
    const relativePath = relative(ROOT_DIR, modelPath);
    const fileStats = statSync(modelPath);
    const { category, limit } = categorizeModel(modelPath);
    
    process.stdout.write(`Inspecting ${basename(modelPath)}...`);
    
    const info = inspectModel(modelPath);
    
    if (info.error) {
      stats.skipped++;
      console.log(' ⚠️  Error');
      continue;
    }
    
    info.category = category;
    info.limit = limit;
    info.fileSize = fileStats.size;
    info.passed = info.triangles <= limit;
    
    stats.models.push(info);
    
    if (info.passed) {
      stats.passed++;
      if (options.verbose) {
        console.log(` ✅ ${info.triangles.toLocaleString()} tris (limit: ${limit.toLocaleString()})`);
      } else {
        console.log(' ✅');
      }
    } else {
      stats.failed++;
      console.log(` ❌ ${info.triangles.toLocaleString()} tris (limit: ${limit.toLocaleString()}, over by ${(info.triangles - limit).toLocaleString()})`);
      
      stats.issues.push({
        file: relativePath,
        triangles: info.triangles,
        limit,
        overage: info.triangles - limit,
        category,
        hasSkinnedMesh: info.hasSkinnedMesh,
        compression: info.compression,
        textureFormat: info.textureFormat,
      });
    }
  }
  
  // Summary
  log('\n' + '═'.repeat(70));
  log('\n📊 AUDIT SUMMARY\n');
  
  log(`Total Models:  ${stats.total}`);
  log(`  ✅ Passed:   ${stats.passed}`);
  log(`  ❌ Failed:   ${stats.failed}`);
  log(`  ⚠️  Skipped:  ${stats.skipped}`);
  
  // Compression status
  const compressionStats = {
    meshopt: stats.models.filter(m => m.compression === 'meshopt').length,
    draco: stats.models.filter(m => m.compression === 'draco').length,
    none: stats.models.filter(m => m.compression === 'none').length,
  };
  
  log('\nCompression Status:');
  log(`  Meshopt: ${compressionStats.meshopt}`);
  log(`  Draco: ${compressionStats.draco}`);
  log(`  None: ${compressionStats.none}`);
  
  // Texture format status
  const textureStats = {
    ktx2: stats.models.filter(m => m.textureFormat === 'ktx2').length,
    webp: stats.models.filter(m => m.textureFormat === 'webp').length,
    png: stats.models.filter(m => m.textureFormat === 'png').length,
    other: stats.models.filter(m => !['ktx2', 'webp', 'png'].includes(m.textureFormat)).length,
  };
  
  log('\nTexture Format Status:');
  log(`  KTX2: ${textureStats.ktx2}`);
  log(`  WebP: ${textureStats.webp}`);
  log(`  PNG: ${textureStats.png}`);
  log(`  Other: ${textureStats.other}`);
  
  // Skinned mesh status
  const skinnedCount = stats.models.filter(m => m.hasSkinnedMesh).length;
  log(`\nSkinned Meshes: ${skinnedCount}`);
  
  if (stats.issues.length > 0) {
    log('\n' + '═'.repeat(70));
    log('\n❌ MODELS EXCEEDING TRIANGLE LIMITS:\n');
    
    // Sort by overage (worst first)
    stats.issues.sort((a, b) => b.overage - a.overage);
    
    for (const issue of stats.issues) {
      log(`📁 ${issue.file}`);
      log(`   Triangles: ${issue.triangles.toLocaleString()} (limit: ${issue.limit.toLocaleString()}, over by ${issue.overage.toLocaleString()})`);
      log(`   Category: ${issue.category}`);
      log(`   Skinned: ${issue.hasSkinnedMesh ? 'Yes' : 'No'}`);
      log(`   Compression: ${issue.compression}`);
      log(`   Textures: ${issue.textureFormat}`);
      
      if (options.fix) {
        const targetRatio = issue.limit / issue.triangles;
        log(`   Fix: gltf-transform simplify "${issue.file}" --ratio ${targetRatio.toFixed(4)}`);
      }
      
      log('');
    }
  }
  
  // Recommendations
  log('═'.repeat(70));
  log('\n📋 RECOMMENDATIONS:\n');
  
  if (stats.failed > 0) {
    log(`1. Decimate ${stats.failed} models to meet triangle limits`);
    log('   Use: blender --background --python scripts/bake-lod.py');
    log('   Or:  gltf-transform simplify <input> <output> --ratio <target>');
  }
  
  if (compressionStats.draco === 0) {
    log('\n2. Consider Draco compression for smaller file sizes:');
    log('   gltf-transform draco <input> <output>');
    log('   Note: Meshopt is already being used, which is also good.');
  }
  
  if (textureStats.ktx2 === 0 && textureStats.webp > 0) {
    log('\n3. Consider KTX2 textures for GPU-compressed textures:');
    log('   gltf-transform ktx <input> <output>');
    log('   Note: WebP is already being used, which provides good compression.');
  }
  
  log('\n');
  
  // Output JSON if requested
  if (options.json) {
    console.log(JSON.stringify({
      summary: {
        total: stats.total,
        passed: stats.passed,
        failed: stats.failed,
        skipped: stats.skipped,
      },
      compression: compressionStats,
      textures: textureStats,
      skinnedMeshes: skinnedCount,
      issues: stats.issues,
      models: stats.models,
    }, null, 2));
  }
  
  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
