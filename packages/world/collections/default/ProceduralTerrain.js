// ProceduralTerrain.hyp - Production-ready procedural terrain generation for Hyperfy
// This app generates realistic terrain using multi-octave noise and integrates with the Hyperfy world system

app.configure([
  {
    type: 'number',
    key: 'terrainSize',
    label: 'Terrain Size',
    initial: 100,
    min: 50,
    max: 500,
    step: 10
  },
  {
    type: 'number',
    key: 'segments',
    label: 'Detail Level',
    initial: 32,
    min: 16,
    max: 128,
    step: 4
  },
  {
    type: 'number',
    key: 'heightScale',
    label: 'Height Scale',
    initial: 15,
    min: 1,
    max: 50,
    step: 1
  },
  {
    type: 'number',
    key: 'seed',
    label: 'Random Seed',
    initial: 12345,
    min: 1,
    max: 99999,
    step: 1
  },
  {
    type: 'color',
    key: 'terrainColor',
    label: 'Terrain Color',
    initial: '#4a7c59'
  },
  {
    type: 'boolean',
    key: 'showWireframe',
    label: 'Show Wireframe',
    initial: false
  }
]);

// Seeded random number generator for consistent terrain
function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Multi-octave noise function
function noise(x, z, seed) {
  const seedOffset = seed * 0.0001;
  
  // Multiple octaves for realistic terrain
  const octave1 = Math.sin((x + seedOffset) * 0.1) * Math.cos((z + seedOffset) * 0.1);
  const octave2 = Math.sin((x + seedOffset) * 0.2) * Math.cos((z + seedOffset) * 0.2) * 0.5;
  const octave3 = Math.sin((x + seedOffset) * 0.4) * Math.cos((z + seedOffset) * 0.4) * 0.25;
  const octave4 = Math.sin((x + seedOffset) * 0.8) * Math.cos((z + seedOffset) * 0.8) * 0.125;
  
  return octave1 + octave2 + octave3 + octave4;
}

// Generate terrain on app start
app.on('start', () => {
  console.log('[ProceduralTerrain] Generating terrain...');
  
  try {
    // Create terrain geometry
    const size = props.terrainSize;
    const segments = props.segments;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    
    // Apply height map using noise
    const vertices = geometry.attributes.position.array;
    const heightScale = props.heightScale;
    const seed = props.seed;
    
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i];
      const z = vertices[i + 1];
      const height = noise(x, z, seed) * heightScale;
      vertices[i + 2] = height;
    }
    
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    
    // Create material
    const material = new THREE.MeshStandardMaterial({
      color: props.terrainColor,
      roughness: 0.9,
      metalness: 0.1,
      wireframe: props.showWireframe,
      side: THREE.DoubleSide
    });
    
    // Create mesh
    const terrainMesh = new THREE.Mesh(geometry, material);
    terrainMesh.rotation.x = -Math.PI / 2;
    terrainMesh.position.set(0, 0, 0);
    terrainMesh.name = 'ProceduralTerrain';
    
    // Add to app
    app.add(terrainMesh);
    
    // Add environmental lighting
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.name = 'TerrainLight';
    app.add(directionalLight);
    
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    ambientLight.name = 'TerrainAmbient';
    app.add(ambientLight);
    
    console.log('[ProceduralTerrain] Terrain generated successfully');
    console.log(`[ProceduralTerrain] Size: ${size}, Segments: ${segments}, Height Scale: ${heightScale}`);
    console.log(`[ProceduralTerrain] Vertices: ${geometry.attributes.position.count}`);
    
  } catch (error) {
    console.error('[ProceduralTerrain] Error generating terrain:', error);
  }
});

// Regenerate terrain when properties change
app.on('propsChanged', () => {
  console.log('[ProceduralTerrain] Properties changed, regenerating terrain...');
  
  // Clear existing terrain
  const existingTerrain = app.get('ProceduralTerrain');
  if (existingTerrain) {
    app.remove(existingTerrain);
  }
  
  // Clear existing lights
  const existingLight = app.get('TerrainLight');
  if (existingLight) {
    app.remove(existingLight);
  }
  
  const existingAmbient = app.get('TerrainAmbient');
  if (existingAmbient) {
    app.remove(existingAmbient);
  }
  
  // Regenerate terrain
  app.emit('start');
});

// Export for external use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { noise, seededRandom };
}