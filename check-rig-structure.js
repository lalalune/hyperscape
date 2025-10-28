import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { readFileSync } from 'fs';
import * as THREE from 'three';

const loader = new GLTFLoader();

const buffer = readFileSync('./packages/asset-forge/public/rigs/rig-human.glb');
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

loader.parse(arrayBuffer, '', (gltf) => {
  console.log('\n=== HUMAN RIG STRUCTURE ===\n');
  console.log('Animations:', gltf.animations.length);

  let boneCount = 0;
  let meshCount = 0;

  gltf.scene.traverse((child) => {
    if (child instanceof THREE.Bone) {
      boneCount++;
      if (boneCount <= 5) {
        const euler = new THREE.Euler().setFromQuaternion(child.quaternion);
        console.log('Bone: ' + child.name);
        console.log('  Pos: [' + child.position.toArray().map(v => v.toFixed(3)).join(', ') + ']');
        console.log('  Rot: [' + [euler.x, euler.y, euler.z].map(v => THREE.MathUtils.radToDeg(v).toFixed(1)).join(', ') + '] deg');
      }
    }
    if (child instanceof THREE.SkinnedMesh) {
      meshCount++;
      console.log('SkinnedMesh: ' + child.name);
    }
    if (child instanceof THREE.Mesh) {
      console.log('Mesh: ' + child.name);
    }
  });

  console.log('\nTotal bones: ' + boneCount);
  console.log('Total meshes: ' + meshCount);
}, (error) => {
  console.error('Error:', error);
});
