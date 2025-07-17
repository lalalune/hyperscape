import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Advanced noise generation using simplex-like noise
class TerrainNoise {
  constructor() {
    this.permutation = this.generatePermutation();
  }

  generatePermutation() {
    const p = [];
    for (let i = 0; i < 256; i++) p[i] = i;
    
    // Shuffle
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    
    // Double it
    return [...p, ...p];
  }

  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  lerp(a, b, t) {
    return a + t * (b - a);
  }

  grad(hash, x, y) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }

  noise(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    
    x -= Math.floor(x);
    y -= Math.floor(y);
    
    const u = this.fade(x);
    const v = this.fade(y);
    
    const A = this.permutation[X] + Y;
    const B = this.permutation[X + 1] + Y;
    
    return this.lerp(
      this.lerp(
        this.grad(this.permutation[A], x, y),
        this.grad(this.permutation[B], x - 1, y),
        u
      ),
      this.lerp(
        this.grad(this.permutation[A + 1], x, y - 1),
        this.grad(this.permutation[B + 1], x - 1, y - 1),
        u
      ),
      v
    );
  }

  octaveNoise(x, y, octaves, persistence = 0.5, lacunarity = 2.0, scale = 1.0) {
    let total = 0;
  let amplitude = 1;
  let frequency = scale;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
      total += this.noise(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

    return total / maxValue;
  }
}

// Biome configuration with refined parameters for walkability
const biomeConfig = {
  Forest: {
    color: { base: 0x2d5016, variance: 0.2 },
    height: { base: 0.5, variance: 0.8 },  // Reduced for walkability
    roughness: 1.0,
    metalness: 0.0,
    noise: { octaves: 4, persistence: 0.5, lacunarity: 2.2, scale: 0.02 }
  },
  Mountain: {
    color: { base: 0x8b7355, variance: 0.3 },
    height: { base: 2, variance: 5 },  // Increased for steeper mountains
    roughness: 0.9,
    metalness: 0.0,
    noise: { octaves: 6, persistence: 0.6, lacunarity: 2.5, scale: 0.03 }
  },
  Swamp: {
    color: { base: 0x4a5d3a, variance: 0.25 },
    height: { base: 0.1, variance: 0.2 },  // Nearly flat
    roughness: 0.85,
    metalness: 0.0,
    noise: { octaves: 4, persistence: 0.45, lacunarity: 2.3, scale: 0.02 }
  },
  Hills: {
    color: { base: 0x7ba05b, variance: 0.2 },
    height: { base: 1.5, variance: 1.2 },  // Gentle rolling hills
    roughness: 0.65,
    metalness: 0.0,
    noise: { octaves: 4, persistence: 0.5, lacunarity: 2.1, scale: 0.018 }
  },
  Lake: {
    color: { base: 0x1e6ba8, variance: 0.05 },
    height: { base: -0.5, variance: 0.1 },  // Shallow lakes
    roughness: 1.0,
    metalness: 0.0,
    noise: { octaves: 2, persistence: 0.2, lacunarity: 2.0, scale: 0.008 }
  },
  Plains: {
    color: { base: 0x90a955, variance: 0.15 },
    height: { base: 0.2, variance: 0.3 },  // Very flat and walkable
    roughness: 1.0,
    metalness: 0.0,
    noise: { octaves: 3, persistence: 0.35, lacunarity: 2.0, scale: 0.012 }
  }
};

// Height multipliers - adjusted for more dramatic mountains
const heightMultipliers = {
  Peak: 1.5,      // Even higher peaks
  Mountainous: 1.2,  // Higher mountains
  Hills: 0.6,     // Gentle hills
  Plains: 0.3     // Very flat
};

// Vegetation configuration for each biome
const vegetationConfig = {
  Forest: {
    density: 0.8,  // 80% chance per cell
    types: [
      { name: 'tree', size: { w: 0.3, h: 1.2, d: 0.3 }, color: 0x0d4f0d, weight: 0.7 },
      { name: 'bush', size: { w: 0.2, h: 0.3, d: 0.2 }, color: 0x2d7a2d, weight: 0.3 }
    ]
  },
  Mountain: {
    density: 0.1,  // Sparse vegetation
    types: [
      { name: 'rock', size: { w: 0.4, h: 0.3, d: 0.4 }, color: 0x666666, weight: 0.8 },
      { name: 'shrub', size: { w: 0.15, h: 0.2, d: 0.15 }, color: 0x4a5d4a, weight: 0.2 }
    ]
  },
  Desert: {
    density: 0.2,
    types: [
      { name: 'cactus', size: { w: 0.1, h: 0.4, d: 0.1 }, color: 0x4a7c4a, weight: 0.5 },
      { name: 'dead_bush', size: { w: 0.2, h: 0.15, d: 0.2 }, color: 0x8b7355, weight: 0.5 }
    ]
  },
  Swamp: {
    density: 0.6,
    types: [
      { name: 'swamp_tree', size: { w: 0.25, h: 0.8, d: 0.25 }, color: 0x2a3a2a, weight: 0.4 },
      { name: 'mushroom', size: { w: 0.1, h: 0.15, d: 0.1 }, color: 0x8b4513, weight: 0.3 },
      { name: 'moss', size: { w: 0.3, h: 0.05, d: 0.3 }, color: 0x4a5d3a, weight: 0.3 }
    ]
  },
  Hills: {
    density: 0.5,
    types: [
      { name: 'tree', size: { w: 0.25, h: 0.8, d: 0.25 }, color: 0x2d5a2d, weight: 0.5 },
      { name: 'grass', size: { w: 0.15, h: 0.2, d: 0.15 }, color: 0x7ba05b, weight: 0.5 }
    ]
  },
  Lake: {
    density: 0.1,
    types: [
      { name: 'lily', size: { w: 0.15, h: 0.02, d: 0.15 }, color: 0x2e7d2e, weight: 1.0 }
    ]
  },
  Plains: {
    density: 0.4,
    types: [
      { name: 'grass', size: { w: 0.1, h: 0.15, d: 0.1 }, color: 0x90a955, weight: 0.8 },
      { name: 'flower', size: { w: 0.05, h: 0.1, d: 0.05 }, color: 0xffff66, weight: 0.2 }
    ]
  }
};

class TerrainGenerator {
  constructor(width, height, cells) {
    this.width = width;
    this.height = height;
    this.cells = cells;
    this.noise = new TerrainNoise();
    this.cellSize = 1; // Size of each cell in world units
  }

  // Cubic interpolation function
  cubic(p0, p1, p2, p3, t) {
    const a0 = p3 - p2 - p0 + p1;
    const a1 = p0 - p1 - a0;
    const a2 = p2 - p0;
    const a3 = p1;
    return a0 * t * t * t + a1 * t * t + a2 * t + a3;
  }

  // Bicubic interpolation for smooth subdivision
  bicubicInterpolate(data, width, height, x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    
    // Get 4x4 grid of samples
    const samples = [];
    for (let j = -1; j <= 2; j++) {
      const row = [];
      for (let i = -1; i <= 2; i++) {
        const sx = Math.min(Math.max(xi + i, 0), width - 1);
        const sy = Math.min(Math.max(yi + j, 0), height - 1);
        row.push(data[sy * width + sx]);
      }
      samples.push(row);
    }
    
    // Interpolate along x for each row
    const xInterpolated = [];
    for (let j = 0; j < 4; j++) {
      xInterpolated.push(this.cubic(samples[j][0], samples[j][1], samples[j][2], samples[j][3], fx));
    }
    
    // Interpolate along y
    return this.cubic(xInterpolated[0], xInterpolated[1], xInterpolated[2], xInterpolated[3], fy);
  }

  createTerrain() {
    const worldWidth = this.width * this.cellSize;
    const worldHeight = this.height * this.cellSize;
    
    // First, generate low-resolution grid (1:1 with cells)
    const lowResHeights = new Float32Array(this.width * this.height);
    const lowResColors = new Float32Array(this.width * this.height * 3);
    const lowResRoughness = new Float32Array(this.width * this.height);
    const lowResMetalness = new Float32Array(this.width * this.height);
    
    // Generate base terrain at cell resolution
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = y * this.width + x;
        const cell = this.cells[y]?.[x];
        
        if (!cell || !cell.metadata) {
          // Default to plains
          lowResHeights[idx] = this.noise.octaveNoise(x * 0.1, y * 0.1, 4, 0.5, 2.0, 1.0) * 2;
          lowResColors[idx * 3] = 0.6;
          lowResColors[idx * 3 + 1] = 0.8;
          lowResColors[idx * 3 + 2] = 0.4;
          lowResRoughness[idx] = 0.6;
          lowResMetalness[idx] = 0.05;
          continue;
        }
        
        const biome = cell.metadata.biome;
        const heightType = cell.metadata.height;
        const config = biomeConfig[biome] || biomeConfig.Plains;
        const heightMult = (heightMultipliers[heightType] || 1.0) * 1.0;  // Full multiplier for proper scaling
        
        // Generate height with noise
        const noiseValue = this.noise.octaveNoise(
          x * config.noise.scale, 
          y * config.noise.scale,
          config.noise.octaves,
          config.noise.persistence,
          config.noise.lacunarity,
          1.0
        );
        
        lowResHeights[idx] = config.height.base * heightMult + (noiseValue * config.height.variance * heightMult);
        
        // Set color
        const baseColor = new THREE.Color(config.color.base);
        const colorVariation = 1 + (noiseValue * config.color.variance);
        baseColor.multiplyScalar(colorVariation);
        
        lowResColors[idx * 3] = baseColor.r;
        lowResColors[idx * 3 + 1] = baseColor.g;
        lowResColors[idx * 3 + 2] = baseColor.b;
        
        lowResRoughness[idx] = config.roughness;
        lowResMetalness[idx] = config.metalness;
      }
    }
    
    // Now create high-resolution geometry with subdivision
    const subdivision = 20;  // Reduced to 20 for performance and memory limits
    const segmentsX = (this.width - 1) * subdivision;
    const segmentsY = (this.height - 1) * subdivision;
    
    const geometry = new THREE.PlaneGeometry(
      worldWidth, 
      worldHeight, 
      segmentsX, 
      segmentsY
    );
    
    const positions = geometry.attributes.position.array;
    const colors = new Float32Array(positions.length);
    const roughness = new Float32Array(positions.length / 3);
    const metalness = new Float32Array(positions.length / 3);
    
    const verticesX = segmentsX + 1;
    const verticesY = segmentsY + 1;
    
    // Pre-extract color channels for efficiency
    const lowResR = new Float32Array(this.width * this.height);
    const lowResG = new Float32Array(this.width * this.height);
    const lowResB = new Float32Array(this.width * this.height);
    
    for (let i = 0; i < this.width * this.height; i++) {
      lowResR[i] = lowResColors[i * 3];
      lowResG[i] = lowResColors[i * 3 + 1];
      lowResB[i] = lowResColors[i * 3 + 2];
    }
    
    // Interpolate the low-res data to high-res using bicubic interpolation
    for (let vy = 0; vy < verticesY; vy++) {
      for (let vx = 0; vx < verticesX; vx++) {
        const vertexIndex = vy * verticesX + vx;
        const arrayIndex = vertexIndex * 3;
        
        // Find position in low-res grid
        const fx = vx / subdivision;
        const fy = vy / subdivision;
        
        // Bicubic interpolation for smooth results
        const height = this.bicubicInterpolate(lowResHeights, this.width, this.height, fx, fy);
        positions[arrayIndex + 2] = height;
        
        // Interpolate colors
        const r = this.bicubicInterpolate(lowResR, this.width, this.height, fx, fy);
        const g = this.bicubicInterpolate(lowResG, this.width, this.height, fx, fy);
        const b = this.bicubicInterpolate(lowResB, this.width, this.height, fx, fy);
        
        colors[arrayIndex] = r;
        colors[arrayIndex + 1] = g;
        colors[arrayIndex + 2] = b;
        
        // Interpolate material properties
        roughness[vertexIndex] = this.bicubicInterpolate(lowResRoughness, this.width, this.height, fx, fy);
        metalness[vertexIndex] = this.bicubicInterpolate(lowResMetalness, this.width, this.height, fx, fy);
      }
    }
    
    // Update geometry
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('roughness', new THREE.BufferAttribute(roughness, 1));
    geometry.setAttribute('metalness', new THREE.BufferAttribute(metalness, 1));
    geometry.computeVertexNormals();
    
    // Rotate to lay flat
    geometry.rotateX(-Math.PI / 2);
    
    return geometry;
  }

  createFoliage(terrainGeometry) {
    const foliageGroup = new THREE.Group();
    foliageGroup.name = 'foliage';
    
    // Use instanced mesh for better performance
    const geometries = {};
    const materials = {};
    const instancedMeshes = {};
    
    // Create geometry and material for each vegetation type
    const allVegTypes = new Set();
    Object.values(vegetationConfig).forEach(config => {
      config.types.forEach(type => {
        const key = `${type.name}_${type.color}`;
        if (!allVegTypes.has(key)) {
          allVegTypes.add(key);
          geometries[key] = new THREE.BoxGeometry(type.size.w, type.size.h, type.size.d);
          materials[key] = new THREE.MeshStandardMaterial({ 
            color: type.color,
            roughness: 1.0,
            metalness: 0.0
          });
        }
      });
    });
    
    // Collect instances for each vegetation type
    const instances = {};
    allVegTypes.forEach(key => {
      instances[key] = [];
    });
    
    // Generate vegetation for each cell
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y]?.[x];
        if (!cell || !cell.metadata) continue;
        
        const biome = cell.metadata.biome;
        const vegConfig = vegetationConfig[biome];
        if (!vegConfig) continue;
        
        // Check density
        if (Math.random() > vegConfig.density) continue;
        
        // Select vegetation type based on weights
        const totalWeight = vegConfig.types.reduce((sum, type) => sum + type.weight, 0);
        let random = Math.random() * totalWeight;
        let selectedType = null;
        
        for (const type of vegConfig.types) {
          random -= type.weight;
          if (random <= 0) {
            selectedType = type;
            break;
          }
        }
        
        if (!selectedType) continue;
        
        // Random position within cell
        const cellX = x + Math.random() * 0.8 + 0.1;
        const cellY = y + Math.random() * 0.8 + 0.1;
        
        // Get terrain height at this position
        const terrainHeight = this.getTerrainHeightAt(terrainGeometry, cellX, cellY);
        
        // Skip if underwater
        if (terrainHeight < 0 && biome !== 'Lake') continue;
        
        const key = `${selectedType.name}_${selectedType.color}`;
        instances[key].push({
          position: new THREE.Vector3(
            (cellX - this.width / 2) * this.cellSize,
            terrainHeight + selectedType.size.h / 2,
            (cellY - this.height / 2) * this.cellSize
          ),
          rotation: new THREE.Euler(0, Math.random() * Math.PI * 2, 0),
          scale: new THREE.Vector3(
            0.8 + Math.random() * 0.4,
            0.8 + Math.random() * 0.4,
            0.8 + Math.random() * 0.4
          )
        });
      }
    }
    
    // Create instanced meshes
    let totalVegetation = 0;
    Object.entries(instances).forEach(([key, instanceList]) => {
      if (instanceList.length === 0) return;
      
      totalVegetation += instanceList.length;
      console.log(`Creating ${instanceList.length} instances of ${key}`);
      
      const mesh = new THREE.InstancedMesh(
        geometries[key],
        materials[key],
        instanceList.length
      );
      
      // Set transforms for each instance
      const matrix = new THREE.Matrix4();
      const quaternion = new THREE.Quaternion();
      
      instanceList.forEach((instance, i) => {
        quaternion.setFromEuler(instance.rotation);
        matrix.compose(instance.position, quaternion, instance.scale);
        mesh.setMatrixAt(i, matrix);
      });
      
      mesh.instanceMatrix.needsUpdate = true;
      
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      foliageGroup.add(mesh);
    });
    
    console.log(`Total vegetation created: ${totalVegetation}`);
    return foliageGroup;
  }
  
  getTerrainHeightAt(geometry, x, y) {
    // Sample the terrain height at a specific position
    const positions = geometry.attributes.position.array;
    const subdivision = 20;  // Must match the subdivision used in createTerrain
    const verticesX = (this.width - 1) * subdivision + 1;
    const verticesY = (this.height - 1) * subdivision + 1;
    
    // Convert world position to vertex indices
    const vx = Math.floor(x * subdivision);
    const vy = Math.floor(y * subdivision);
    
    // Clamp to valid range
    const clampedVx = Math.min(Math.max(vx, 0), verticesX - 1);
    const clampedVy = Math.min(Math.max(vy, 0), verticesY - 1);
    
    const vertexIndex = clampedVy * verticesX + clampedVx;
    // Since the plane is rotated -90 degrees around X, Y in the geometry is actually Z in world
    return positions[vertexIndex * 3 + 1]; // Y is height in the rotated plane
  }

  createMaterial() {
    // Custom shader material that uses vertex attributes
    const material = new THREE.ShaderMaterial({
      uniforms: {
        sunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
        fogColor: { value: new THREE.Color(0x87CEEB) },
        fogNear: { value: 50 },
        fogFar: { value: 200 }
      },
      vertexShader: `
        attribute vec3 color;
        attribute float roughness;
        attribute float metalness;
        
        varying vec3 vColor;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying float vRoughness;
        varying float vMetalness;
        
        void main() {
          vColor = color;
          vNormal = normalMatrix * normal;
          vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          vRoughness = roughness;
          vMetalness = metalness;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 sunDirection;
        uniform vec3 fogColor;
        uniform float fogNear;
        uniform float fogFar;
        
        varying vec3 vColor;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying float vRoughness;
        varying float vMetalness;
        
        void main() {
          vec3 normal = normalize(vNormal);
          
          // Basic lighting
          float NdotL = max(dot(normal, sunDirection), 0.0);
          vec3 diffuse = vColor * (0.3 + 0.7 * NdotL);
          
          // Simple specular
          vec3 viewDir = normalize(-vPosition);
          vec3 halfDir = normalize(sunDirection + viewDir);
          float spec = pow(max(dot(normal, halfDir), 0.0), mix(8.0, 128.0, 1.0 - vRoughness));
          vec3 specular = vec3(spec) * vMetalness * 0.5;
          
          vec3 finalColor = diffuse + specular;
          
          // Fog
          float fogDepth = length(vPosition);
          float fogFactor = smoothstep(fogNear, fogFar, fogDepth);
          finalColor = mix(finalColor, fogColor, fogFactor);
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      side: THREE.DoubleSide,
      wireframe: false
    });
    
    return material;
  }
}

// Initialize the scene
async function init() {
  try {
    // Show loading
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.textContent = 'Loading terrain data...';
    
    // Load data
    const response = await fetch('rpg-grid.json');
    const data = await response.json();
    
    if (loadingEl) loadingEl.textContent = 'Generating terrain...';
    
    // Setup Three.js
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 50, 200);
    
    const camera = new THREE.PerspectiveCamera(
      60, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      500
    );
    
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    document.body.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI * 0.45;
    controls.minDistance = 10;
    controls.maxDistance = 200;
    
    // Generate terrain
    const terrainGen = new TerrainGenerator(data.width, data.height, data.cells);
    const terrainGeometry = terrainGen.createTerrain();
    const terrainMaterial = terrainGen.createMaterial();
    const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
    terrain.castShadow = true;
    terrain.receiveShadow = true;
    scene.add(terrain);
    
    // Generate foliage
    if (loadingEl) loadingEl.textContent = 'Generating foliage...';
    const foliage = terrainGen.createFoliage(terrainGeometry);
    scene.add(foliage);

    // Lighting
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    sunLight.position.set(50, 80, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 200;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0x404060, 0.4);
    scene.add(ambientLight);
    
    const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x545454, 0.3);
    scene.add(hemisphereLight);
    
    // Position camera
    camera.position.set(60, 40, 60);
    camera.lookAt(50, 0, 50);
    controls.target.set(50, 0, 50);
    
    if (loadingEl) loadingEl.style.display = 'none';
    
    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // Handle resize
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
         // Add info display
     const info = document.createElement('div');
     info.style.position = 'absolute';
     info.style.top = '10px';
     info.style.left = '10px';
     info.style.color = 'white';
     info.style.fontFamily = 'monospace';
     info.style.fontSize = '12px';
     info.style.backgroundColor = 'rgba(0,0,0,0.5)';
     info.style.padding = '10px';
     info.innerHTML = `
       Grid: ${data.width}x${data.height}<br>
       Terrain Resolution: ${(data.width - 1) * 20 + 1}x${(data.height - 1) * 20 + 1} vertices<br>
       Controls: Left click + drag to rotate, scroll to zoom<br>
       Regions: ${data.regions.length}<br>
       Foliage: Enabled (biome-specific)
     `;
     document.body.appendChild(info);

  } catch (error) {
    console.error('Error initializing terrain:', error);
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.textContent = 'Error loading terrain';
      loadingEl.style.color = '#ff6b6b';
    }
  }
}

// Start
init();