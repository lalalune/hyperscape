import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { readFileSync } from 'fs';
import * as THREE from 'three';

const loader = new GLTFLoader();

const buffer = readFileSync('./packages/asset-forge/public/rigs/rig-human.glb');
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

loader.parse(arrayBuffer, '', (gltf) => {
  console.log('\n=== HUMAN RIG ANALYSIS ===\n');

  // Find skeleton
  let skeleton = null;
  gltf.scene.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh && child.skeleton) {
      skeleton = child.skeleton;
      console.log('Found SkinnedMesh:', child.name);
      console.log('Skeleton bones:', skeleton.bones.length);
      console.log('\nFirst 5 bone rotations (checking if in T-pose):');

      skeleton.bones.slice(0, 5).forEach((bone) => {
        const euler = new THREE.Euler().setFromQuaternion(bone.quaternion);
        console.log('  ' + bone.name + ':');
        console.log('    Position: [' + bone.position.x.toFixed(3) + ', ' + bone.position.y.toFixed(3) + ', ' + bone.position.z.toFixed(3) + ']');
        console.log('    Rotation (deg): [' + THREE.MathUtils.radToDeg(euler.x).toFixed(1) + ', ' + THREE.MathUtils.radToDeg(euler.y).toFixed(1) + ', ' + THREE.MathUtils.radToDeg(euler.z).toFixed(1) + ']');
      });

      // Check if there are animations
      if (gltf.animations.length > 0) {
        console.log('\n⚠️  RIG HAS ' + gltf.animations.length + ' ANIMATIONS!');
        gltf.animations.forEach((anim) => {
          console.log('  - ' + anim.name + ' (' + anim.duration.toFixed(2) + 's)');
        });
      } else {
        console.log('\n✓ Rig has no animations (static T-pose)');
      }
    }
  });
}, (error) => {
  console.error('Error:', error);
});
