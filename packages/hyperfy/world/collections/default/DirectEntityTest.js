// Direct Entity Test - Create entities directly without complex spawning
console.log('🟦 Direct Entity Test: Starting...')

app.configure([])

// Create a bright blue cube that should be absolutely visible
const blueCube = app.create('mesh')
blueCube.type = 'box'
blueCube.scale.set(3, 3, 3)
blueCube.position.set(-5, 1.5, 0)
// Don't set material, use default

app.add(blueCube)

// Create a bright green cube
const greenCube = app.create('mesh')
greenCube.type = 'box'
greenCube.scale.set(2, 2, 2)
greenCube.position.set(5, 1, 0)
// Don't set material, use default

app.add(greenCube)

// Create a red cube for good measure
const redCube = app.create('mesh')
redCube.type = 'box'
redCube.scale.set(1.5, 1.5, 1.5)
redCube.position.set(0, 0.75, 5)
// Don't set material, use default

app.add(redCube)

// Expose to window for testing
if (typeof window !== 'undefined') {
  window.directEntityTest = {
    blueCube,
    greenCube,
    redCube,
    cubeCount: 3
  };
  console.log('🟦 Direct Entity Test: Exposed to window.directEntityTest')
}

console.log('🟦 Direct Entity Test: Created 3 colored cubes (blue, green, red)')
console.log('✅ Direct Entity Test: Complete')