#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Parse GLB binary format and extract glTF JSON
 * GLB format:
 * - 12-byte header: magic (0x46546C67), version, length
 * - Chunks: chunkLength (4 bytes), chunkType (4 bytes), chunkData
 */
function parseGLB(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  // Read header
  const magic = view.getUint32(0, true);
  const version = view.getUint32(4, true);
  const length = view.getUint32(8, true);

  if (magic !== 0x46546C67) {
    throw new Error('Not a valid GLB file (magic number mismatch)');
  }

  console.log(`GLB version: ${version}, length: ${length} bytes`);

  // Read JSON chunk (first chunk)
  let offset = 12;
  const jsonChunkLength = view.getUint32(offset, true);
  const jsonChunkType = view.getUint32(offset + 4, true);

  if (jsonChunkType !== 0x4E4F534A) { // "JSON"
    throw new Error('First chunk is not JSON');
  }

  const jsonData = buffer.slice(offset + 8, offset + 8 + jsonChunkLength);
  const gltf = JSON.parse(jsonData.toString('utf8'));

  console.log(`JSON chunk: ${jsonChunkLength} bytes`);
  console.log('');

  return gltf;
}

/**
 * Find node by name in glTF scene graph
 */
function findNode(gltf, nodeName) {
  return gltf.nodes.findIndex(node => node.name === nodeName);
}

/**
 * Get node transform information
 */
function getNodeTransform(gltf, nodeIndex) {
  if (nodeIndex === -1) {
    return null;
  }

  const node = gltf.nodes[nodeIndex];

  return {
    name: node.name,
    translation: node.translation || [0, 0, 0],
    rotation: node.rotation || [0, 0, 0, 1],
    scale: node.scale || [1, 1, 1],
    matrix: node.matrix || null
  };
}

/**
 * Convert quaternion to Euler angles (in degrees) for easier reading
 */
function quaternionToEuler(q) {
  const [x, y, z, w] = q;

  // Roll (x-axis rotation)
  const sinr_cosp = 2 * (w * x + y * z);
  const cosr_cosp = 1 - 2 * (x * x + y * y);
  const roll = Math.atan2(sinr_cosp, cosr_cosp);

  // Pitch (y-axis rotation)
  const sinp = 2 * (w * y - z * x);
  const pitch = Math.abs(sinp) >= 1
    ? Math.sign(sinp) * Math.PI / 2
    : Math.asin(sinp);

  // Yaw (z-axis rotation)
  const siny_cosp = 2 * (w * z + x * y);
  const cosy_cosp = 1 - 2 * (y * y + z * z);
  const yaw = Math.atan2(siny_cosp, cosy_cosp);

  return {
    x: roll * 180 / Math.PI,
    y: pitch * 180 / Math.PI,
    z: yaw * 180 / Math.PI
  };
}

/**
 * Print node transform information
 */
function printNodeInfo(label, transform) {
  if (!transform) {
    console.log(`${label}: NOT FOUND`);
    return;
  }

  console.log(`${label}:`);
  console.log(`  Name: ${transform.name}`);
  console.log(`  Translation: [${transform.translation.map(v => v.toFixed(6)).join(', ')}]`);
  console.log(`  Rotation (quat): [${transform.rotation.map(v => v.toFixed(6)).join(', ')}]`);

  const euler = quaternionToEuler(transform.rotation);
  console.log(`  Rotation (euler): x=${euler.x.toFixed(2)}°, y=${euler.y.toFixed(2)}°, z=${euler.z.toFixed(2)}°`);

  console.log(`  Scale: [${transform.scale.map(v => v.toFixed(6)).join(', ')}]`);

  if (transform.matrix) {
    console.log(`  Matrix: [${transform.matrix.join(', ')}]`);
  }
  console.log('');
}

/**
 * Compare two transforms
 */
function compareTransforms(name, t1, t2) {
  if (!t1 || !t2) {
    console.log(`Cannot compare ${name}: one or both not found`);
    return;
  }

  console.log(`=== Comparing ${name} ===`);

  // Translation diff
  const translationDiff = t1.translation.map((v, i) => v - t2.translation[i]);
  console.log(`Translation diff: [${translationDiff.map(v => v.toFixed(6)).join(', ')}]`);

  // Rotation diff (quaternion)
  const rotationDiff = t1.rotation.map((v, i) => v - t2.rotation[i]);
  console.log(`Rotation diff (quat): [${rotationDiff.map(v => v.toFixed(6)).join(', ')}]`);

  // Euler angle diff
  const euler1 = quaternionToEuler(t1.rotation);
  const euler2 = quaternionToEuler(t2.rotation);
  const eulerDiff = {
    x: euler1.x - euler2.x,
    y: euler1.y - euler2.y,
    z: euler1.z - euler2.z
  };
  console.log(`Rotation diff (euler): x=${eulerDiff.x.toFixed(2)}°, y=${eulerDiff.y.toFixed(2)}°, z=${eulerDiff.z.toFixed(2)}°`);

  // Scale diff
  const scaleDiff = t1.scale.map((v, i) => v - t2.scale[i]);
  console.log(`Scale diff: [${scaleDiff.map(v => v.toFixed(6)).join(', ')}]`);

  console.log('');
}

/**
 * List all bones in the file
 */
function listAllBones(gltf) {
  console.log('=== All Bones/Nodes ===');
  gltf.nodes.forEach((node, index) => {
    if (node.name) {
      const hasRotation = node.rotation && node.rotation.some((v, i) => i === 3 ? v !== 1 : v !== 0);
      const rotationStr = hasRotation ? ` [ROT: ${node.rotation.map(v => v.toFixed(4)).join(', ')}]` : '';
      console.log(`  ${index}: ${node.name}${rotationStr}`);
    }
  });
  console.log('');
}

// Main execution
async function main() {
  const file1 = path.join(__dirname, 'packages/asset-forge/gdd-assets/human/human.vrm');
  const file2 = path.join(__dirname, 'assets/avatar1.vrm');

  console.log('=================================================');
  console.log('VRM Node Transform Inspector');
  console.log('=================================================');
  console.log('');

  // Check if files exist
  if (!fs.existsSync(file1)) {
    console.error(`ERROR: File not found: ${file1}`);
    process.exit(1);
  }

  if (!fs.existsSync(file2)) {
    console.error(`ERROR: File not found: ${file2}`);
    process.exit(1);
  }

  // Parse first file (human.vrm)
  console.log('=================================================');
  console.log(`Parsing: ${file1}`);
  console.log('=================================================');
  const buffer1 = fs.readFileSync(file1);
  const gltf1 = parseGLB(buffer1);

  console.log(`Total nodes: ${gltf1.nodes.length}`);
  console.log(`Total meshes: ${gltf1.meshes?.length || 0}`);
  console.log(`Total skins: ${gltf1.skins?.length || 0}`);
  console.log('');

  listAllBones(gltf1);

  // Get specific nodes
  const hipsIndex1 = findNode(gltf1, 'Hips');
  const leftArmIndex1 = findNode(gltf1, 'LeftArm');
  const rightArmIndex1 = findNode(gltf1, 'RightArm');

  const hips1 = getNodeTransform(gltf1, hipsIndex1);
  const leftArm1 = getNodeTransform(gltf1, leftArmIndex1);
  const rightArm1 = getNodeTransform(gltf1, rightArmIndex1);

  printNodeInfo('Hips', hips1);
  printNodeInfo('LeftArm', leftArm1);
  printNodeInfo('RightArm', rightArm1);

  // Parse second file (avatar1.vrm)
  console.log('=================================================');
  console.log(`Parsing: ${file2}`);
  console.log('=================================================');
  const buffer2 = fs.readFileSync(file2);
  const gltf2 = parseGLB(buffer2);

  console.log(`Total nodes: ${gltf2.nodes.length}`);
  console.log(`Total meshes: ${gltf2.meshes?.length || 0}`);
  console.log(`Total skins: ${gltf2.skins?.length || 0}`);
  console.log('');

  listAllBones(gltf2);

  // Get specific nodes (avatar1 uses different naming)
  const hipsIndex2 = findNode(gltf2, 'hips');
  const leftArmIndex2 = findNode(gltf2, 'leftUpperArm');
  const rightArmIndex2 = findNode(gltf2, 'rightUpperArm');

  const hips2 = getNodeTransform(gltf2, hipsIndex2);
  const leftArm2 = getNodeTransform(gltf2, leftArmIndex2);
  const rightArm2 = getNodeTransform(gltf2, rightArmIndex2);

  printNodeInfo('Hips', hips2);
  printNodeInfo('LeftArm', leftArm2);
  printNodeInfo('RightArm', rightArm2);

  // Compare transforms
  console.log('=================================================');
  console.log('COMPARISON (human.vrm - avatar1.vrm)');
  console.log('=================================================');
  console.log('');

  compareTransforms('Hips', hips1, hips2);
  compareTransforms('LeftArm', leftArm1, leftArm2);
  compareTransforms('RightArm', rightArm1, rightArm2);

  console.log('=================================================');
  console.log('Analysis complete!');
  console.log('=================================================');
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
