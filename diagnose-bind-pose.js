/**
 * Diagnostic script to inspect VRM bind pose rotations
 *
 * Usage: node diagnose-bind-pose.js path/to/your.vrm
 */

import { readFileSync } from 'fs';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';
import * as THREE from 'three';

const vrmPath = process.argv[2];

if (!vrmPath) {
  console.error('Usage: node diagnose-bind-pose.js path/to/your.vrm');
  process.exit(1);
}

console.log(`Loading VRM from: ${vrmPath}\n`);

const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));

const vrmData = readFileSync(vrmPath);
const arrayBuffer = vrmData.buffer.slice(vrmData.byteOffset, vrmData.byteOffset + vrmData.byteLength);

loader.parse(arrayBuffer, '', (gltf) => {
  const vrm = gltf.userData.vrm;

  if (!vrm) {
    console.error('No VRM data found!');
    process.exit(1);
  }

  console.log('=== VRM Bind Pose Analysis ===\n');

  const humanoid = vrm.humanoid;
  const rawBones = humanoid._rawHumanBones?.humanBones || {};
  const normBones = humanoid._normalizedHumanBones?.humanBones || {};

  // Check arm bones specifically
  const bonesToCheck = ['leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm'];

  console.log('Raw Bone Rotations (Euler angles in degrees):');
  console.log('='.repeat(60));

  bonesToCheck.forEach(boneName => {
    const boneNode = rawBones[boneName]?.node;
    if (boneNode) {
      const euler = new THREE.Euler().setFromQuaternion(boneNode.quaternion);
      console.log(`${boneName}:`);
      console.log(`  X: ${(euler.x * 180 / Math.PI).toFixed(2)}°`);
      console.log(`  Y: ${(euler.y * 180 / Math.PI).toFixed(2)}°`);
      console.log(`  Z: ${(euler.z * 180 / Math.PI).toFixed(2)}°`);
      console.log(`  Quaternion: [${boneNode.quaternion.x.toFixed(3)}, ${boneNode.quaternion.y.toFixed(3)}, ${boneNode.quaternion.z.toFixed(3)}, ${boneNode.quaternion.w.toFixed(3)}]`);
      console.log();
    }
  });

  console.log('\nNormalized Bone Rotations (Euler angles in degrees):');
  console.log('='.repeat(60));

  bonesToCheck.forEach(boneName => {
    const boneNode = normBones[boneName]?.node;
    if (boneNode) {
      const euler = new THREE.Euler().setFromQuaternion(boneNode.quaternion);
      console.log(`${boneName}:`);
      console.log(`  X: ${(euler.x * 180 / Math.PI).toFixed(2)}°`);
      console.log(`  Y: ${(euler.y * 180 / Math.PI).toFixed(2)}°`);
      console.log(`  Z: ${(euler.z * 180 / Math.PI).toFixed(2)}°`);
      console.log(`  Quaternion: [${boneNode.quaternion.x.toFixed(3)}, ${boneNode.quaternion.y.toFixed(3)}, ${boneNode.quaternion.z.toFixed(3)}, ${boneNode.quaternion.w.toFixed(3)}]`);
      console.log();
    }
  });

  console.log('\n=== Analysis ===');
  console.log('T-pose typically has arms at ~90° from body (Z rotation ~0°)');
  console.log('A-pose typically has arms at ~45° down (Z rotation ~±45-75°)');
  console.log('\nCompare your values above to determine the bind pose type.');

}, (error) => {
  console.error('Error loading VRM:', error);
  process.exit(1);
});
