#!/usr/bin/env node
/**
 * Vertex Color Optimization Script for Hyperia
 * 
 * Optimizes GLB models for vertex-color-only rendering:
 * 1. STRIP: Remove textures from models that already have vertex colors
 * 2. BAKE: Bake texture colors into vertex colors (requires texture sampling)
 * 
 * This improves GPU performance by eliminating texture sampling overhead.
 * 
 * Usage: node scripts/vertex-color-optimize.mjs [options]
 * 
 * Options:
 *   --strip          Strip textures from models with vertex colors
 *   --analyze        Analyze models and report status (no changes)
 *   --verbose        Show detailed output
 *   --dry-run        Show what would be done without making changes
 *   --backup         Create .backup files before modifying
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, statSync, copyFileSync } from 'fs';
import { basename, dirname, extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');
const ASSETS_DIR = resolve(ROOT_DIR, 'assets');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  strip: args.includes('--strip'),
  analyze: args.includes('--analyze'),
  verbose: args.includes('--verbose'),
  dryRun: args.includes('--dry-run'),
  backup: args.includes('--backup'),
};

// If no action specified, default to analyze
if (!options.strip && !options.analyze) {
  options.analyze = true;
}

// Logging utilities
function log(message, level = 'info') {
  const prefix = {
    info: '\x1b[36mℹ\x1b[0m',
    warn: '\x1b[33m⚠\x1b[0m',
    error: '\x1b[31m✗\x1b[0m',
    success: '\x1b[32m✓\x1b[0m',
    debug: '\x1b[90m·\x1b[0m',
  }[level] || 'ℹ';
  
  if (level === 'debug' && !options.verbose) return;
  console.log(`${prefix} ${message}`);
}

// Find all GLB files recursively
function findGLBFiles(dir, results = []) {
  if (!existsSync(dir)) return results;
  
  const entries = readdirSync(dir, { withFileTypes: true });
  const skipDirs = ['node_modules', '.git', 'cache', '.temp', 'emotes', 'avatars', 'audio', 'web'];
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (!skipDirs.includes(entry.name)) {
        findGLBFiles(fullPath, results);
      }
    } else if (entry.isFile() && entry.name.endsWith('.glb')) {
      results.push(fullPath);
    }
  }
  
  return results;
}

/**
 * Analyze a GLB file for vertex colors and textures
 * Uses binary parsing for accurate detection
 */
function analyzeGLB(filepath) {
  try {
    const buffer = readFileSync(filepath);
    
    // GLB header: magic(4) + version(4) + length(4)
    const magic = buffer.readUInt32LE(0);
    if (magic !== 0x46546C67) { // 'glTF'
      return { error: 'Not a valid GLB file' };
    }
    
    // Find JSON chunk
    const jsonChunkLength = buffer.readUInt32LE(12);
    const jsonChunkType = buffer.readUInt32LE(16);
    
    if (jsonChunkType !== 0x4E4F534A) { // 'JSON'
      return { error: 'No JSON chunk found' };
    }
    
    const jsonData = buffer.slice(20, 20 + jsonChunkLength).toString('utf8');
    const gltf = JSON.parse(jsonData);
    
    // Check for vertex colors (COLOR_0 attribute in primitives)
    let hasVertexColors = false;
    if (gltf.meshes) {
      for (const mesh of gltf.meshes) {
        if (mesh.primitives) {
          for (const prim of mesh.primitives) {
            if (prim.attributes && prim.attributes.COLOR_0 !== undefined) {
              hasVertexColors = true;
              break;
            }
          }
        }
        if (hasVertexColors) break;
      }
    }
    
    // Check for textures
    let hasTextures = false;
    let textureCount = 0;
    let embeddedImageCount = 0;
    
    if (gltf.textures && gltf.textures.length > 0) {
      hasTextures = true;
      textureCount = gltf.textures.length;
    }
    
    if (gltf.images) {
      embeddedImageCount = gltf.images.length;
      if (embeddedImageCount > 0) hasTextures = true;
    }
    
    // Check material texture references
    let materialTextureRefs = 0;
    if (gltf.materials) {
      for (const mat of gltf.materials) {
        if (mat.pbrMetallicRoughness) {
          if (mat.pbrMetallicRoughness.baseColorTexture) materialTextureRefs++;
          if (mat.pbrMetallicRoughness.metallicRoughnessTexture) materialTextureRefs++;
        }
        if (mat.normalTexture) materialTextureRefs++;
        if (mat.occlusionTexture) materialTextureRefs++;
        if (mat.emissiveTexture) materialTextureRefs++;
      }
    }
    
    // Calculate binary chunk size (images)
    let binarySize = 0;
    const binaryChunkOffset = 20 + jsonChunkLength;
    if (buffer.length > binaryChunkOffset + 8) {
      binarySize = buffer.readUInt32LE(binaryChunkOffset);
    }
    
    return {
      hasVertexColors,
      hasTextures,
      textureCount,
      embeddedImageCount,
      materialTextureRefs,
      binarySize,
      fileSize: buffer.length,
      gltf, // Return parsed GLTF for modification
      buffer, // Return buffer for rewriting
    };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Strip textures from a GLB file that has vertex colors
 * Removes texture references and embedded images, keeps vertex colors
 */
function stripTextures(filepath, analysis) {
  if (!analysis.gltf || !analysis.buffer) {
    return { success: false, error: 'Invalid analysis data' };
  }
  
  const gltf = JSON.parse(JSON.stringify(analysis.gltf)); // Deep clone
  let modified = false;
  
  // Remove texture references from materials
  if (gltf.materials) {
    for (const mat of gltf.materials) {
      if (mat.pbrMetallicRoughness) {
        if (mat.pbrMetallicRoughness.baseColorTexture) {
          // Keep baseColorFactor if exists, otherwise set to white
          if (!mat.pbrMetallicRoughness.baseColorFactor) {
            mat.pbrMetallicRoughness.baseColorFactor = [1, 1, 1, 1];
          }
          delete mat.pbrMetallicRoughness.baseColorTexture;
          modified = true;
        }
        if (mat.pbrMetallicRoughness.metallicRoughnessTexture) {
          delete mat.pbrMetallicRoughness.metallicRoughnessTexture;
          modified = true;
        }
      }
      if (mat.normalTexture) {
        delete mat.normalTexture;
        modified = true;
      }
      if (mat.occlusionTexture) {
        delete mat.occlusionTexture;
        modified = true;
      }
      if (mat.emissiveTexture) {
        delete mat.emissiveTexture;
        modified = true;
      }
    }
  }
  
  // Remove textures array
  if (gltf.textures && gltf.textures.length > 0) {
    gltf.textures = [];
    modified = true;
  }
  
  // Remove samplers if no textures
  if (gltf.samplers) {
    gltf.samplers = [];
    modified = true;
  }
  
  // Remove images array
  if (gltf.images && gltf.images.length > 0) {
    gltf.images = [];
    modified = true;
  }
  
  if (!modified) {
    return { success: true, modified: false, message: 'No textures to strip' };
  }
  
  // Rebuild GLB without binary image data
  // We need to rebuild buffer views to exclude image data
  
  // Find which buffer views are used by accessors (geometry data)
  const usedBufferViews = new Set();
  if (gltf.accessors) {
    for (const accessor of gltf.accessors) {
      if (accessor.bufferView !== undefined) {
        usedBufferViews.add(accessor.bufferView);
      }
    }
  }
  
  // Also check for sparse accessor indices/values
  if (gltf.accessors) {
    for (const accessor of gltf.accessors) {
      if (accessor.sparse) {
        if (accessor.sparse.indices && accessor.sparse.indices.bufferView !== undefined) {
          usedBufferViews.add(accessor.sparse.indices.bufferView);
        }
        if (accessor.sparse.values && accessor.sparse.values.bufferView !== undefined) {
          usedBufferViews.add(accessor.sparse.values.bufferView);
        }
      }
    }
  }
  
  // Get original binary chunk
  const jsonChunkLength = analysis.buffer.readUInt32LE(12);
  const binaryChunkOffset = 20 + jsonChunkLength;
  let originalBinary = Buffer.alloc(0);
  
  if (analysis.buffer.length > binaryChunkOffset + 8) {
    const binaryLength = analysis.buffer.readUInt32LE(binaryChunkOffset);
    originalBinary = analysis.buffer.slice(binaryChunkOffset + 8, binaryChunkOffset + 8 + binaryLength);
  }
  
  // Build new binary chunk with only geometry data
  const newBufferViews = [];
  const bufferViewMapping = new Map();
  let newBinaryParts = [];
  let currentOffset = 0;
  
  if (gltf.bufferViews) {
    for (let i = 0; i < gltf.bufferViews.length; i++) {
      if (usedBufferViews.has(i)) {
        const view = gltf.bufferViews[i];
        const data = originalBinary.slice(view.byteOffset, view.byteOffset + view.byteLength);
        
        // Align to 4 bytes
        const padding = (4 - (currentOffset % 4)) % 4;
        if (padding > 0) {
          newBinaryParts.push(Buffer.alloc(padding));
          currentOffset += padding;
        }
        
        bufferViewMapping.set(i, newBufferViews.length);
        newBufferViews.push({
          buffer: 0,
          byteOffset: currentOffset,
          byteLength: view.byteLength,
          ...(view.byteStride && { byteStride: view.byteStride }),
          ...(view.target && { target: view.target }),
        });
        
        newBinaryParts.push(data);
        currentOffset += view.byteLength;
      }
    }
  }
  
  // Update accessor buffer view references
  if (gltf.accessors) {
    for (const accessor of gltf.accessors) {
      if (accessor.bufferView !== undefined) {
        accessor.bufferView = bufferViewMapping.get(accessor.bufferView);
      }
      if (accessor.sparse) {
        if (accessor.sparse.indices && accessor.sparse.indices.bufferView !== undefined) {
          accessor.sparse.indices.bufferView = bufferViewMapping.get(accessor.sparse.indices.bufferView);
        }
        if (accessor.sparse.values && accessor.sparse.values.bufferView !== undefined) {
          accessor.sparse.values.bufferView = bufferViewMapping.get(accessor.sparse.values.bufferView);
        }
      }
    }
  }
  
  gltf.bufferViews = newBufferViews;
  
  // Combine binary parts
  const newBinary = Buffer.concat(newBinaryParts);
  
  // Pad binary to 4-byte alignment
  const binaryPadding = (4 - (newBinary.length % 4)) % 4;
  const paddedBinary = binaryPadding > 0 
    ? Buffer.concat([newBinary, Buffer.alloc(binaryPadding)])
    : newBinary;
  
  // Update buffer length
  if (gltf.buffers && gltf.buffers.length > 0) {
    gltf.buffers[0].byteLength = paddedBinary.length;
  }
  
  // Serialize JSON
  const jsonString = JSON.stringify(gltf);
  const jsonBuffer = Buffer.from(jsonString, 'utf8');
  
  // Pad JSON to 4-byte alignment
  const jsonPadding = (4 - (jsonBuffer.length % 4)) % 4;
  const paddedJson = jsonPadding > 0
    ? Buffer.concat([jsonBuffer, Buffer.alloc(jsonPadding, 0x20)]) // Pad with spaces
    : jsonBuffer;
  
  // Build GLB
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546C67, 0); // 'glTF'
  header.writeUInt32LE(2, 4); // version
  header.writeUInt32LE(12 + 8 + paddedJson.length + 8 + paddedBinary.length, 8); // total length
  
  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(paddedJson.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4E4F534A, 4); // 'JSON'
  
  const binaryChunkHeader = Buffer.alloc(8);
  binaryChunkHeader.writeUInt32LE(paddedBinary.length, 0);
  binaryChunkHeader.writeUInt32LE(0x004E4942, 4); // 'BIN\0'
  
  const newGLB = Buffer.concat([
    header,
    jsonChunkHeader,
    paddedJson,
    binaryChunkHeader,
    paddedBinary,
  ]);
  
  return {
    success: true,
    modified: true,
    newBuffer: newGLB,
    originalSize: analysis.buffer.length,
    newSize: newGLB.length,
    savedBytes: analysis.buffer.length - newGLB.length,
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('\n\x1b[36m╔══════════════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[36m║\x1b[0m  \x1b[1mVertex Color Optimization Tool\x1b[0m                              \x1b[36m║\x1b[0m');
  console.log('\x1b[36m║\x1b[0m  Strip textures from models with vertex colors              \x1b[36m║\x1b[0m');
  console.log('\x1b[36m╚══════════════════════════════════════════════════════════════╝\x1b[0m\n');
  
  if (options.dryRun) {
    log('DRY RUN MODE - No files will be modified', 'warn');
  }
  
  // Find all GLB files
  log('Scanning for GLB files...', 'info');
  const glbFiles = findGLBFiles(ASSETS_DIR);
  log(`Found ${glbFiles.length} GLB files`, 'info');
  
  // Categorize files
  const results = {
    vertexColorsOnly: [],      // Already optimized
    canStripTextures: [],      // Has vertex colors AND textures
    needsBaking: [],           // Has textures, no vertex colors
    errors: [],
  };
  
  let totalOriginalSize = 0;
  let totalNewSize = 0;
  let filesModified = 0;
  
  // Analyze all files
  console.log('\n\x1b[1mAnalyzing models...\x1b[0m\n');
  
  for (const filepath of glbFiles) {
    const relativePath = filepath.replace(ASSETS_DIR + '/', '');
    const analysis = analyzeGLB(filepath);
    
    if (analysis.error) {
      results.errors.push({ path: relativePath, error: analysis.error });
      continue;
    }
    
    const info = {
      path: relativePath,
      hasVertexColors: analysis.hasVertexColors,
      hasTextures: analysis.hasTextures,
      textureCount: analysis.textureCount,
      embeddedImages: analysis.embeddedImageCount,
      fileSize: analysis.fileSize,
      analysis,
      filepath,
    };
    
    if (analysis.hasVertexColors && !analysis.hasTextures) {
      results.vertexColorsOnly.push(info);
    } else if (analysis.hasVertexColors && analysis.hasTextures) {
      results.canStripTextures.push(info);
    } else if (!analysis.hasVertexColors && analysis.hasTextures) {
      results.needsBaking.push(info);
    }
  }
  
  // Report analysis results
  console.log('\x1b[32m═══ Analysis Results ═══\x1b[0m\n');
  
  console.log(`\x1b[32m✓ Already optimized (vertex colors only): ${results.vertexColorsOnly.length}\x1b[0m`);
  if (options.verbose && results.vertexColorsOnly.length > 0) {
    results.vertexColorsOnly.forEach(f => console.log(`    ${f.path}`));
  }
  
  console.log(`\x1b[33m⚠ Can strip textures (has both): ${results.canStripTextures.length}\x1b[0m`);
  results.canStripTextures.forEach(f => {
    const size = (f.fileSize / 1024).toFixed(1);
    console.log(`    ${f.path} (${size} KB, ${f.embeddedImages} images)`);
  });
  
  console.log(`\x1b[31m✗ Needs vertex color baking: ${results.needsBaking.length}\x1b[0m`);
  if (options.verbose || results.needsBaking.length <= 20) {
    results.needsBaking.slice(0, 30).forEach(f => {
      const size = (f.fileSize / 1024).toFixed(1);
      console.log(`    ${f.path} (${size} KB, ${f.embeddedImages} images)`);
    });
    if (results.needsBaking.length > 30) {
      console.log(`    ... and ${results.needsBaking.length - 30} more`);
    }
  }
  
  if (results.errors.length > 0) {
    console.log(`\x1b[31m✗ Errors: ${results.errors.length}\x1b[0m`);
    results.errors.forEach(e => console.log(`    ${e.path}: ${e.error}`));
  }
  
  // Strip textures if requested
  if (options.strip && results.canStripTextures.length > 0) {
    console.log('\n\x1b[36m═══ Stripping Textures ═══\x1b[0m\n');
    
    for (const file of results.canStripTextures) {
      if (options.dryRun) {
        log(`Would strip textures from: ${file.path}`, 'info');
        continue;
      }
      
      // Create backup if requested
      if (options.backup) {
        const backupPath = file.filepath + '.backup';
        if (!existsSync(backupPath)) {
          copyFileSync(file.filepath, backupPath);
          log(`Created backup: ${backupPath}`, 'debug');
        }
      }
      
      const result = stripTextures(file.filepath, file.analysis);
      
      if (result.success && result.modified) {
        writeFileSync(file.filepath, result.newBuffer);
        totalOriginalSize += result.originalSize;
        totalNewSize += result.newSize;
        filesModified++;
        
        const savedKB = (result.savedBytes / 1024).toFixed(1);
        const percent = ((result.savedBytes / result.originalSize) * 100).toFixed(0);
        log(`Stripped: ${file.path} (-${savedKB} KB, ${percent}% smaller)`, 'success');
      } else if (result.error) {
        log(`Error stripping ${file.path}: ${result.error}`, 'error');
      }
    }
    
    // Summary
    if (filesModified > 0) {
      const totalSavedKB = ((totalOriginalSize - totalNewSize) / 1024).toFixed(1);
      const totalSavedMB = ((totalOriginalSize - totalNewSize) / (1024 * 1024)).toFixed(2);
      console.log('\n\x1b[32m═══ Summary ═══\x1b[0m');
      console.log(`Files modified: ${filesModified}`);
      console.log(`Total space saved: ${totalSavedKB} KB (${totalSavedMB} MB)`);
    }
  }
  
  // Print instructions for models that need baking
  if (results.needsBaking.length > 0) {
    console.log('\n\x1b[33m═══ Manual Baking Required ═══\x1b[0m');
    console.log('\nThe following models need vertex colors baked from textures.');
    console.log('Use Blender or the vertex-color-baker.html tool:\n');
    console.log('Option 1: Blender');
    console.log('  1. Import GLB');
    console.log('  2. Select mesh, go to Vertex Paint mode');
    console.log('  3. Bake > Bake Texture to Vertex Colors');
    console.log('  4. Delete material textures');
    console.log('  5. Export GLB with "Include > Vertex Colors" enabled\n');
    console.log('Option 2: tools/vertex-color-baker.html');
    console.log('  1. Open in browser');
    console.log('  2. Drag and drop GLB file');
    console.log('  3. Click "Bake Vertex Colors"');
    console.log('  4. Download optimized GLB\n');
    
    // Write list to file for reference
    const listPath = join(ROOT_DIR, 'models-needing-vertex-colors.txt');
    const listContent = results.needsBaking.map(f => f.path).join('\n');
    writeFileSync(listPath, listContent);
    log(`List saved to: models-needing-vertex-colors.txt`, 'info');
  }
  
  console.log('\n\x1b[36mDone!\x1b[0m\n');
}

main().catch(console.error);
