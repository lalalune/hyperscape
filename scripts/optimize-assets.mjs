#!/usr/bin/env node
/**
 * Asset Optimization Script for Hyperia
 * 
 * Optimizes all assets in the assets folder:
 * - Converts PNG textures to KTX2 format (GPU-compressed)
 * - Resizes textures (diffuse: max 2048px, others: max 1024px)
 * - Optimizes GLTF/GLB meshes with meshopt compression
 * - Compresses textures embedded in GLB files to KTX2
 * - Decimates meshes to max 50k faces
 * - Handles VRM files (GLTF-based avatars)
 * 
 * Usage: node scripts/optimize-assets.mjs [options]
 * 
 * Options:
 *   --dry-run       Show what would be done without making changes
 *   --textures      Only process textures
 *   --models        Only process models (GLB/VRM)
 *   --verbose       Show detailed output
 *   --input <dir>   Process specific directory (default: assets)
 *   --output <dir>  Output to specific directory (default: assets-optimized)
 *   --in-place      Overwrite original files (DANGEROUS!)
 *   --skip-ktx2     Skip KTX2 conversion (just resize and copy)
 *   --atlas         Merge materials via texture atlasing (max 2 materials: opaque + transparent)
 *   --simplify      Apply mesh simplification (decimation)
 *   --simplify-ratio <n>  Simplification ratio (default: 0.5 = 50% of original)
 * 
 * Requirements:
 *   - Node.js 18+ or Bun 1.0+
 *   - For standalone texture KTX2 conversion:
 *     Install toktx from KTX-Software:
 *       macOS: Download from https://github.com/KhronosGroup/KTX-Software/releases
 *              Extract and add to PATH, or copy toktx to /usr/local/bin
 *       Linux: apt install ktx-tools OR download from GitHub
 *       Windows: Download from GitHub releases
 * 
 *   Without toktx, standalone textures will remain as resized PNG.
 *   GLB embedded textures will still be compressed to KTX2 via gltf-transform.
 */

import { execSync, spawn } from 'child_process';
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, copyFileSync, unlinkSync, rmSync } from 'fs';
import { basename, dirname, extname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');
const ASSETS_DIR = resolve(ROOT_DIR, 'assets');
const OUTPUT_DIR = resolve(ROOT_DIR, 'assets-optimized');

// Configuration
const CONFIG = {
  textures: {
    diffuseMaxSize: 2048,
    otherMaxSize: 1024,
    // Suffixes that identify diffuse textures
    diffuseSuffixes: ['_d', '_diffuse', '_color', '_albedo', '_basecolor', '_base'],
    // Suffixes for other texture types
    otherSuffixes: ['_n', '_normal', '_r', '_roughness', '_m', '_metallic', '_ao', '_e', '_emissive', '_o', '_dp', '_specular'],
    // Formats to process
    formats: ['.png', '.jpg', '.jpeg', '.webp'],
  },
  models: {
    maxFaces: 50000,
    meshoptLevel: 'medium', // 'low', 'medium', 'high'
    // Simplification error tolerance (higher = more aggressive)
    simplifyError: 0.01,
  },
  // File patterns to process
  patterns: {
    textures: ['.png', '.jpg', '.jpeg', '.webp'],
    models: ['.glb', '.gltf'],
    vrm: ['.vrm'],
  },
  // Directories to skip
  skipDirs: ['node_modules', '.git', 'cache', 'concept-art', '.temp'],
  // Files to skip (patterns)
  skipFiles: ['concept-art.png', 'sprite-metadata.json'],
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  texturesOnly: args.includes('--textures'),
  modelsOnly: args.includes('--models'),
  verbose: args.includes('--verbose'),
  inputDir: args.includes('--input') ? resolve(args[args.indexOf('--input') + 1]) : ASSETS_DIR,
  outputDir: args.includes('--output') ? resolve(args[args.indexOf('--output') + 1]) : OUTPUT_DIR,
  inPlace: args.includes('--in-place'),
  skipKtx2: args.includes('--skip-ktx2'),
  atlas: args.includes('--atlas'), // Enable material atlasing (merge to 2 materials max)
  simplify: args.includes('--simplify'), // Aggressive mesh simplification
  simplifyRatio: args.includes('--simplify-ratio') 
    ? parseFloat(args[args.indexOf('--simplify-ratio') + 1]) 
    : 0.5, // Default 50% reduction
};

// If in-place, output to same as input
if (options.inPlace) {
  options.outputDir = options.inputDir;
}

// Stats tracking
const stats = {
  texturesProcessed: 0,
  texturesSkipped: 0,
  texturesSavedBytes: 0,
  modelsProcessed: 0,
  modelsSkipped: 0,
  modelsSavedBytes: 0,
  facesReduced: 0,
  errors: [],
  startTime: Date.now(),
};

// Tool availability
const tools = {
  toktx: false,
  gltfTransform: false,
  sharp: false,
};

// Logging utilities
function log(message, level = 'info') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const prefix = {
    info: '\x1b[36mℹ\x1b[0m',
    warn: '\x1b[33m⚠\x1b[0m',
    error: '\x1b[31m✗\x1b[0m',
    success: '\x1b[32m✓\x1b[0m',
    debug: '\x1b[90m·\x1b[0m',
  }[level] || 'ℹ';
  
  if (level === 'debug' && !options.verbose) return;
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function logProgress(current, total, item) {
  const percent = Math.round((current / total) * 100);
  const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));
  const shortItem = item.length > 45 ? '...' + item.slice(-42) : item.padEnd(45);
  process.stdout.write(`\r  [${bar}] ${String(percent).padStart(3)}% (${current}/${total}) ${shortItem}`);
}

// Check if required tools are installed
async function checkDependencies() {
  log('Checking dependencies...', 'info');
  
  // Check toktx
  try {
    execSync('toktx --version', { stdio: 'pipe' });
    tools.toktx = true;
    log('toktx: available', 'success');
  } catch {
    tools.toktx = false;
    log('toktx: not found (KTX2 conversion will be skipped)', 'warn');
    log('  Install with: brew install ktx-software (macOS)', 'debug');
  }
  
  // Check gltf-transform
  try {
    // Use the locally installed CLI via node
    execSync('node ./node_modules/@gltf-transform/cli/bin/cli.js --version', { stdio: 'pipe', cwd: ROOT_DIR });
    tools.gltfTransform = true;
    log('gltf-transform: available', 'success');
  } catch {
    tools.gltfTransform = false;
    log('gltf-transform: not found', 'error');
  }
  
  // Check sharp
  try {
    await import('sharp');
    tools.sharp = true;
    log('sharp: available', 'success');
  } catch {
    tools.sharp = false;
    log('sharp: not found', 'error');
  }
  
  return tools;
}

// Install missing npm dependencies
async function installDependencies() {
  log('Installing required npm packages...', 'info');
  try {
    execSync('bun install', { cwd: ROOT_DIR, stdio: 'inherit' });
    log('Dependencies installed', 'success');
  } catch (error) {
    log(`Failed to install dependencies: ${error.message}`, 'error');
    throw error;
  }
}

// Find all files matching patterns recursively
function findFiles(dir, patterns, results = []) {
  if (!existsSync(dir)) return results;
  
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (!CONFIG.skipDirs.includes(entry.name)) {
        findFiles(fullPath, patterns, results);
      }
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      const shouldSkip = CONFIG.skipFiles.some(pattern => entry.name.includes(pattern));
      if (patterns.includes(ext) && !shouldSkip) {
        results.push(fullPath);
      }
    }
  }
  
  return results;
}

// Determine texture type based on filename
function getTextureType(filename) {
  const name = basename(filename, extname(filename)).toLowerCase();
  
  for (const suffix of CONFIG.textures.diffuseSuffixes) {
    if (name.endsWith(suffix)) return 'diffuse';
  }
  
  for (const suffix of CONFIG.textures.otherSuffixes) {
    if (name.endsWith(suffix)) return 'other';
  }
  
  // If no suffix match, check if it's in a specific folder
  if (filename.includes('diffuse') || filename.includes('color')) return 'diffuse';
  
  // Default to diffuse for max quality
  return 'diffuse';
}

// Check if texture is a normal map
function isNormalMap(filename) {
  const name = basename(filename).toLowerCase();
  return name.includes('_n.') || 
         name.includes('_normal.') || 
         name.includes('_norm.') ||
         name.includes('normal_');
}

// Get output path for a file
function getOutputPath(inputPath, newExt = null) {
  const relativePath = relative(options.inputDir, inputPath);
  let outputPath = join(options.outputDir, relativePath);
  
  if (newExt) {
    outputPath = outputPath.replace(extname(outputPath), newExt);
  }
  
  return outputPath;
}

// Ensure output directory exists
function ensureDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// Get file size in human readable format
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

// Resize image using sharp
async function resizeImage(inputPath, outputPath, maxSize) {
  const sharp = (await import('sharp')).default;
  
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  
  const needsResize = metadata.width > maxSize || metadata.height > maxSize;
  
  if (needsResize) {
    await image
      .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toFile(outputPath);
    return { resized: true, originalWidth: metadata.width, originalHeight: metadata.height };
  } else {
    copyFileSync(inputPath, outputPath);
    return { resized: false, originalWidth: metadata.width, originalHeight: metadata.height };
  }
}

// Convert image to KTX2 using toktx
async function convertToKTX2(inputPath, outputPath, isNormal = false) {
  if (!tools.toktx) {
    throw new Error('toktx not available');
  }
  
  ensureDir(outputPath);
  
  // Use UASTC for normal maps (better quality for direction data)
  // Use ETC1S for diffuse/other (better compression)
  const compressionArgs = isNormal
    ? ['--encode', 'uastc', '--uastc_quality', '2', '--uastc_rdo', '--uastc_rdo_l', '1', '--normal_mode']
    : ['--encode', 'etc1s', '--clevel', '2', '--qlevel', '128'];
  
  const args = [
    '--genmipmap',
    ...compressionArgs,
    '--t2', // Output KTX2
    outputPath,
    inputPath,
  ];
  
  return new Promise((resolve, reject) => {
    const proc = spawn('toktx', args, { stdio: 'pipe' });
    let stderr = '';
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`toktx failed (code ${code}): ${stderr}`));
      }
    });
    
    proc.on('error', (error) => {
      reject(error);
    });
  });
}

// Process a single texture file
async function processTexture(inputPath) {
  const textureType = getTextureType(inputPath);
  const maxSize = textureType === 'diffuse' ? CONFIG.textures.diffuseMaxSize : CONFIG.textures.otherMaxSize;
  const isNormal = isNormalMap(inputPath);
  
  // Temp file for resized image
  const tempDir = join(options.outputDir, '.temp');
  if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
  const tempResizedPath = join(tempDir, `resized_${basename(inputPath)}`);
  
  const ktx2OutputPath = getOutputPath(inputPath, '.ktx2');
  const pngOutputPath = getOutputPath(inputPath);
  
  if (options.dryRun) {
    log(`Would process: ${relative(options.inputDir, inputPath)} (${textureType}, max ${maxSize}px)`, 'debug');
    return;
  }
  
  try {
    const inputStats = statSync(inputPath);
    
    // Step 1: Resize the image if needed
    ensureDir(tempResizedPath);
    const resizeResult = await resizeImage(inputPath, tempResizedPath, maxSize);
    
    // Step 2: Convert to KTX2 or keep as PNG
    if (tools.toktx && !options.skipKtx2) {
      try {
        await convertToKTX2(tempResizedPath, ktx2OutputPath, isNormal);
        
        if (existsSync(ktx2OutputPath)) {
          const outputStats = statSync(ktx2OutputPath);
          const saved = inputStats.size - outputStats.size;
          stats.texturesSavedBytes += saved;
          
          log(`✓ ${relative(options.inputDir, inputPath)} → KTX2 ${resizeResult.resized ? `(${resizeResult.originalWidth}→${maxSize}px) ` : ''}[${formatSize(inputStats.size)} → ${formatSize(outputStats.size)}]`, 'debug');
        }
        stats.texturesProcessed++;
      } catch (ktx2Error) {
        // Fallback to PNG
        log(`KTX2 failed for ${basename(inputPath)}: ${ktx2Error.message}`, 'debug');
        ensureDir(pngOutputPath);
        copyFileSync(tempResizedPath, pngOutputPath);
        stats.texturesProcessed++;
      }
    } else {
      // Just copy resized PNG
      ensureDir(pngOutputPath);
      copyFileSync(tempResizedPath, pngOutputPath);
      
      const outputStats = statSync(pngOutputPath);
      const saved = inputStats.size - outputStats.size;
      if (saved > 0) stats.texturesSavedBytes += saved;
      
      log(`✓ ${relative(options.inputDir, inputPath)} → PNG ${resizeResult.resized ? `(${resizeResult.originalWidth}→${maxSize}px)` : '(kept)'}`, 'debug');
      stats.texturesProcessed++;
    }
    
    // Clean up temp file
    if (existsSync(tempResizedPath)) {
      unlinkSync(tempResizedPath);
    }
    
  } catch (error) {
    stats.errors.push({ file: inputPath, error: error.message });
    stats.texturesSkipped++;
    log(`Failed: ${relative(options.inputDir, inputPath)}: ${error.message}`, 'error');
  }
}

// Get the gltf-transform command path
function getGltfTransformCmd() {
  return `node ./node_modules/@gltf-transform/cli/bin/cli.js`;
}

// Get mesh stats from GLB using gltf-transform
async function getModelStats(filePath) {
  try {
    const result = execSync(`${getGltfTransformCmd()} inspect "${filePath}" --format json`, {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
      cwd: ROOT_DIR,
    });
    const info = JSON.parse(result);
    
    let totalVertices = 0;
    let totalIndices = 0;
    
    if (info.meshes?.properties) {
      for (const mesh of info.meshes.properties) {
        totalVertices += mesh.vertices || 0;
        totalIndices += mesh.indices || 0;
      }
    }
    
    // Estimate faces (indices / 3 for triangles, or vertices / 3 if no indices)
    const estimatedFaces = totalIndices > 0 ? Math.floor(totalIndices / 3) : Math.floor(totalVertices / 3);
    
    return { vertices: totalVertices, indices: totalIndices, faces: estimatedFaces };
  } catch {
    return { vertices: -1, indices: -1, faces: -1 };
  }
}

// Run gltf-transform command
function runGltfTransform(cmd, input, output) {
  try {
    execSync(`${getGltfTransformCmd()} ${cmd} "${input}" "${output}"`, {
      stdio: 'pipe',
      cwd: ROOT_DIR,
    });
    return true;
  } catch (error) {
    return false;
  }
}

// Optimize GLB/GLTF model
async function optimizeModel(inputPath) {
  const outputPath = getOutputPath(inputPath);
  
  if (options.dryRun) {
    log(`Would optimize: ${relative(options.inputDir, inputPath)}`, 'debug');
    return;
  }
  
  if (!tools.gltfTransform) {
    log(`Skipping ${basename(inputPath)}: gltf-transform not available`, 'warn');
    stats.modelsSkipped++;
    return;
  }
  
  try {
    const inputStats = statSync(inputPath);
    ensureDir(outputPath);
    
    // Get initial stats
    const initialStats = await getModelStats(inputPath);
    
    // Create temp directory for intermediate files
    const tempDir = join(options.outputDir, '.temp');
    if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
    
    const tempFiles = [];
    let currentFile = inputPath;
    let stepNum = 0;
    
    // Optimization pipeline - each step is optional and may be skipped
    const steps = [];
    
    // Mesh deduplication (always safe)
    steps.push({ cmd: 'dedup', desc: 'Deduplicating' });
    
    // Prune unused data first
    steps.push({ cmd: 'prune', desc: 'Pruning unused data' });
    
    // Add simplification if over face limit
    if (initialStats.faces > CONFIG.models.maxFaces) {
      const targetRatio = (CONFIG.models.maxFaces / initialStats.faces) * 0.9; // Leave margin
      const ratio = Math.max(0.1, Math.min(0.95, targetRatio));
      steps.push({ cmd: `simplify --ratio ${ratio.toFixed(3)} --error ${CONFIG.models.simplifyError}`, desc: 'Simplifying mesh' });
    }
    
    // Texture resizing for embedded textures (only resize, don't change format)
    steps.push({ 
      cmd: `resize --width ${CONFIG.textures.diffuseMaxSize} --height ${CONFIG.textures.diffuseMaxSize}`, 
      desc: 'Resizing embedded textures' 
    });
    
    // Texture compression to WebP (lossless, good compression, universal support)
    steps.push({ cmd: 'webp --quality 90', desc: 'Compressing textures to WebP' });
    
    // Material palette merging (when --atlas enabled)
    // Groups similar materials to reduce draw calls
    if (options.atlas) {
      steps.push({ cmd: 'palette', desc: 'Merging similar materials (palette)' });
    }
    
    // Mesh simplification (when --simplify enabled)
    // Reduces polygon count using meshoptimizer's simplify algorithm
    if (options.simplify) {
      const ratio = options.simplifyRatio;
      const error = CONFIG.models.simplifyError;
      steps.push({ 
        cmd: `simplify --ratio ${ratio} --error ${error}`, 
        desc: `Simplifying meshes to ${(ratio * 100).toFixed(0)}%` 
      });
    }
    
    // Mesh optimization with meshopt
    steps.push({ cmd: 'meshopt --level medium', desc: 'Applying meshopt compression' });
    
    // Run pipeline
    for (const step of steps) {
      stepNum++;
      const isLast = stepNum === steps.length;
      const tempOutput = isLast ? outputPath : join(tempDir, `step${stepNum}_${basename(inputPath)}`);
      
      if (!isLast) tempFiles.push(tempOutput);
      
      const success = runGltfTransform(step.cmd, currentFile, tempOutput);
      
      if (success && existsSync(tempOutput)) {
        currentFile = tempOutput;
      } else {
        log(`  ${step.desc} skipped (command not supported or failed)`, 'debug');
        if (isLast && currentFile !== outputPath) {
          copyFileSync(currentFile, outputPath);
        }
      }
    }
    
    // Clean up temp files
    for (const tempFile of tempFiles) {
      if (existsSync(tempFile)) {
        try { unlinkSync(tempFile); } catch { /* ignore */ }
      }
    }
    
    // Calculate results
    if (existsSync(outputPath)) {
      const outputStats = statSync(outputPath);
      const finalModelStats = await getModelStats(outputPath);
      
      const sizeSaved = inputStats.size - outputStats.size;
      const facesReduced = initialStats.faces > 0 && finalModelStats.faces > 0 
        ? initialStats.faces - finalModelStats.faces 
        : 0;
      
      stats.modelsSavedBytes += sizeSaved;
      if (facesReduced > 0) stats.facesReduced += facesReduced;
      
      log(`✓ ${relative(options.inputDir, inputPath)} [${formatSize(inputStats.size)} → ${formatSize(outputStats.size)}] faces: ${initialStats.faces} → ${finalModelStats.faces}`, 'debug');
    }
    
    stats.modelsProcessed++;
    
  } catch (error) {
    stats.errors.push({ file: inputPath, error: error.message });
    stats.modelsSkipped++;
    log(`Failed: ${relative(options.inputDir, inputPath)}: ${error.message}`, 'error');
    
    // Copy original as fallback
    try {
      ensureDir(outputPath);
      copyFileSync(inputPath, outputPath);
    } catch { /* ignore */ }
  }
}

// Process VRM file (GLTF-based avatar format)
// VRM files have special extensions (VRM0 or VRMC) that gltf-transform doesn't preserve.
// We copy them as-is since standard GLTF tools break VRM metadata.
// Note: VRM optimization requires specialized VRM tools like vrm-optimizer or UniVRM.
async function processVRM(inputPath) {
  const outputPath = getOutputPath(inputPath);
  
  if (options.dryRun) {
    log(`Would copy VRM: ${relative(options.inputDir, inputPath)} (VRM files copied without optimization)`, 'debug');
    return;
  }
  
  try {
    const inputStats = statSync(inputPath);
    ensureDir(outputPath);
    
    // Copy VRM file as-is to preserve VRM extensions
    // Standard gltf-transform commands break VRM metadata
    copyFileSync(inputPath, outputPath);
    
    log(`✓ VRM ${relative(options.inputDir, inputPath)} [${formatSize(inputStats.size)}] (copied - VRM extensions preserved)`, 'debug');
    stats.modelsProcessed++;
    
  } catch (error) {
    stats.errors.push({ file: inputPath, error: error.message });
    stats.modelsSkipped++;
    log(`Failed VRM: ${relative(options.inputDir, inputPath)}: ${error.message}`, 'error');
  }
}

// Copy non-processed files (JSON, metadata, etc.)
async function copyOtherFiles(inputDir, outputDir) {
  if (!existsSync(inputDir)) return;
  
  const entries = readdirSync(inputDir, { withFileTypes: true });
  
  for (const entry of entries) {
    const inputPath = join(inputDir, entry.name);
    const outputPath = join(outputDir, entry.name);
    
    if (entry.isDirectory()) {
      if (!CONFIG.skipDirs.includes(entry.name)) {
        ensureDir(join(outputPath, '.keep'));
        try { unlinkSync(join(outputPath, '.keep')); } catch { /* ignore */ }
        await copyOtherFiles(inputPath, outputPath);
      }
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      // Skip files that were processed or should be excluded
      if (!CONFIG.patterns.textures.includes(ext) && 
          !CONFIG.patterns.models.includes(ext) &&
          !CONFIG.patterns.vrm.includes(ext)) {
        ensureDir(outputPath);
        if (!existsSync(outputPath)) {
          copyFileSync(inputPath, outputPath);
        }
      }
    }
  }
}

// Clean up temp directory
function cleanupTemp() {
  const tempDir = join(options.outputDir, '.temp');
  if (existsSync(tempDir)) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  }
}

// Main execution
async function main() {
  console.log('\n\x1b[36m╔═══════════════════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[36m║           🚀 HYPERIA ASSET OPTIMIZATION SCRIPT 🚀              ║\x1b[0m');
  console.log('\x1b[36m╚═══════════════════════════════════════════════════════════════════╝\x1b[0m\n');
  
  log(`Input:  ${options.inputDir}`);
  log(`Output: ${options.outputDir}`);
  if (options.dryRun) log('DRY RUN MODE - No changes will be made', 'warn');
  if (options.inPlace) log('IN-PLACE MODE - Original files will be modified!', 'warn');
  if (options.skipKtx2) log('KTX2 SKIPPED - Textures will remain as PNG', 'warn');
  if (options.atlas) log('ATLAS MODE - Materials will be merged via palette', 'info');
  
  console.log('');
  
  // Check dependencies
  await checkDependencies();
  
  // Check if we have minimum requirements
  if (!tools.gltfTransform || !tools.sharp) {
    log('\nMissing required dependencies. Installing...', 'warn');
    await installDependencies();
    await checkDependencies();
    
    if (!tools.gltfTransform || !tools.sharp) {
      log('Failed to install required dependencies', 'error');
      process.exit(1);
    }
  }
  
  console.log('');
  
  // Create output directory
  if (!options.dryRun && !existsSync(options.outputDir)) {
    mkdirSync(options.outputDir, { recursive: true });
  }
  
  // Find all files to process
  const textureFiles = !options.modelsOnly ? findFiles(options.inputDir, CONFIG.patterns.textures) : [];
  const modelFiles = !options.texturesOnly ? findFiles(options.inputDir, CONFIG.patterns.models) : [];
  const vrmFiles = !options.texturesOnly ? findFiles(options.inputDir, CONFIG.patterns.vrm) : [];
  
  log(`Found: ${textureFiles.length} textures, ${modelFiles.length} models, ${vrmFiles.length} VRM files\n`);
  
  // Process textures
  if (textureFiles.length > 0 && !options.modelsOnly) {
    log('📷 Processing textures...', 'info');
    for (let i = 0; i < textureFiles.length; i++) {
      logProgress(i + 1, textureFiles.length, relative(options.inputDir, textureFiles[i]));
      await processTexture(textureFiles[i]);
    }
    console.log('\n');
  }
  
  // Process models
  if (modelFiles.length > 0 && !options.texturesOnly) {
    log('🎮 Processing 3D models...', 'info');
    for (let i = 0; i < modelFiles.length; i++) {
      logProgress(i + 1, modelFiles.length, relative(options.inputDir, modelFiles[i]));
      await optimizeModel(modelFiles[i]);
    }
    console.log('\n');
  }
  
  // Process VRM files
  if (vrmFiles.length > 0 && !options.texturesOnly) {
    log('👤 Processing VRM avatars...', 'info');
    for (let i = 0; i < vrmFiles.length; i++) {
      logProgress(i + 1, vrmFiles.length, relative(options.inputDir, vrmFiles[i]));
      await processVRM(vrmFiles[i]);
    }
    console.log('\n');
  }
  
  // Copy other files
  if (!options.dryRun && !options.inPlace) {
    log('📁 Copying other files...', 'info');
    await copyOtherFiles(options.inputDir, options.outputDir);
    console.log('');
  }
  
  // Clean up temp directory
  cleanupTemp();
  
  // Calculate elapsed time
  const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
  
  // Print summary
  console.log('\x1b[36m═══════════════════════════════════════════════════════════════════\x1b[0m');
  console.log('\x1b[36m                       📊 OPTIMIZATION SUMMARY                      \x1b[0m');
  console.log('\x1b[36m═══════════════════════════════════════════════════════════════════\x1b[0m\n');
  
  console.log(`  📷 Textures:`);
  console.log(`     Processed: ${stats.texturesProcessed}`);
  console.log(`     Skipped:   ${stats.texturesSkipped}`);
  console.log(`     Saved:     ${formatSize(stats.texturesSavedBytes)}`);
  
  console.log(`\n  🎮 Models:`);
  console.log(`     Processed: ${stats.modelsProcessed}`);
  console.log(`     Skipped:   ${stats.modelsSkipped}`);
  console.log(`     Saved:     ${formatSize(stats.modelsSavedBytes)}`);
  console.log(`     Faces reduced: ${stats.facesReduced.toLocaleString()}`);
  
  const totalSaved = stats.texturesSavedBytes + stats.modelsSavedBytes;
  console.log(`\n  💾 Total space saved: ${formatSize(totalSaved)}`);
  console.log(`  ⏱️  Time elapsed: ${elapsed}s`);
  
  if (stats.errors.length > 0) {
    console.log(`\n  ⚠️  Errors: ${stats.errors.length}`);
    for (const err of stats.errors.slice(0, 5)) {
      console.log(`     - ${relative(options.inputDir, err.file)}: ${err.error.substring(0, 60)}`);
    }
    if (stats.errors.length > 5) {
      console.log(`     ... and ${stats.errors.length - 5} more errors`);
    }
  }
  
  console.log(`\n  ✅ Optimization complete!`);
  console.log(`  📁 Output: ${options.outputDir}\n`);
}

main().catch((error) => {
  log(`Fatal error: ${error.message}`, 'error');
  console.error(error.stack);
  process.exit(1);
});
