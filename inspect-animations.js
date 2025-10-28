import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { readFileSync } from 'fs';

const loader = new GLTFLoader();

const buffer = readFileSync('./packages/asset-forge/public/rigs/animations/human-base-animations.glb');
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

loader.parse(arrayBuffer, '', (gltf) => {
  console.log('\n=== HUMAN BASE ANIMATIONS ===');
  console.log(`Total animations: ${gltf.animations.length}\n`);

  gltf.animations.forEach((anim, idx) => {
    console.log(`${idx + 1}. "${anim.name}" - Duration: ${anim.duration.toFixed(2)}s - Tracks: ${anim.tracks.length}`);

    // Show first 3 track names to understand bone naming
    if (idx === 0) {
      console.log('   Sample track names:');
      anim.tracks.slice(0, 5).forEach(track => {
        console.log(`     - ${track.name}`);
      });
    }
  });
}, (error) => {
  console.error('Error loading:', error);
});
