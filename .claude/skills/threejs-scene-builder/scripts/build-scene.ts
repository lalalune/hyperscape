#!/usr/bin/env bun

/**
 * Three.js Scene Builder Helper
 * Quickly scaffold Three.js scenes with common configurations
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(`
Three.js Scene Builder

Usage:
  bun run build-scene.ts <scene-name> [options]

Options:
  --basic            Create basic scene (default)
  --vr               Create VR-ready scene
  --physics          Include physics setup
  --lighting         Advanced lighting setup
  --output <dir>     Output directory (default: ./src/scenes)
  --help, -h         Show this help message

Examples:
  bun run build-scene.ts MyScene
  bun run build-scene.ts GameScene --vr --physics
`);
    process.exit(args.length === 0 ? 1 : 0);
  }

  const sceneName = args[0];
  const outputDir = args[args.indexOf('--output') + 1] || './src/scenes';
  const isVR = args.includes('--vr');
  const hasPhysics = args.includes('--physics');
  const advancedLighting = args.includes('--lighting');

  try {
    await mkdir(outputDir, { recursive: true });

    const sceneTemplate = `import * as THREE from 'three';
${isVR ? "import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';" : ''}
${hasPhysics ? "import * as CANNON from 'cannon-es';" : ''}

export class ${sceneName} {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  ${hasPhysics ? 'world: CANNON.World;' : ''}

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.renderer = new THREE.WebGLRenderer({ antialias: true });

    this.init();
  }

  init() {
    // Renderer setup
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    ${isVR ? 'this.renderer.xr.enabled = true;' : ''}
    document.body.appendChild(this.renderer.domElement);

    ${isVR ? "document.body.appendChild(VRButton.createButton(this.renderer));" : ''}

    ${hasPhysics ? this.getPhysicsSetup() : ''}

    // Lighting
    ${advancedLighting ? this.getAdvancedLighting() : this.getBasicLighting()}

    // Camera position
    this.camera.position.set(0, 2, 5);
    this.camera.lookAt(0, 0, 0);

    // Window resize handler
    window.addEventListener('resize', () => this.onWindowResize());
  }

  ${hasPhysics ? `
  initPhysics() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0);
  }
  ` : ''}

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    ${isVR ? 'this.renderer.setAnimationLoop(() => {' : 'requestAnimationFrame(() => this.animate());'}
      ${hasPhysics ? 'this.world.step(1 / 60);' : ''}
      this.renderer.render(this.scene, this.camera);
    ${isVR ? '});' : ''}
  }

  start() {
    this.animate();
  }
}
`;

    const filepath = join(outputDir, `${sceneName}.ts`);
    await writeFile(filepath, sceneTemplate);

    console.log(`✓ Created scene: ${filepath}`);
    console.log(`
Next steps:
  1. Import and instantiate: import { ${sceneName} } from './scenes/${sceneName}';
  2. Create instance: const scene = new ${sceneName}();
  3. Start rendering: scene.start();
`);
  } catch (error) {
    console.error('Failed to create scene:', error);
    process.exit(1);
  }

  function getBasicLighting(): string {
    return `const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);`;
  }

  function getAdvancedLighting(): string {
    return `// Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    this.scene.add(ambientLight);

    // Main directional light (sun)
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    sunLight.position.set(10, 20, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 50;
    this.scene.add(sunLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-5, 5, -5);
    this.scene.add(fillLight);

    // Hemisphere light for sky/ground gradient
    const hemisphereLight = new THREE.HemisphereLight(0x8888ff, 0x888888, 0.5);
    this.scene.add(hemisphereLight);`;
  }

  function getPhysicsSetup(): string {
    return `this.initPhysics();`;
  }
}

main();
