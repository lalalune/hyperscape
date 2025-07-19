// SimpleMeshTest.js - Basic mesh creation test to validate geometry fixes

console.log('🔥 SimpleMeshTest: Starting basic mesh test...');

try {
  // Create a simple box mesh using correct API
  const testMesh = app.create('mesh');
  testMesh.type = 'box';  // Use type instead of geometry
  testMesh.width = 1;
  testMesh.height = 1;
  testMesh.depth = 1;
  testMesh.position.set(0, 0.5, 0);
  
  app.add(testMesh);
  
  console.log('✅ SimpleMeshTest: Box mesh created successfully');
  
  // Create a sphere mesh
  const sphereMesh = app.create('mesh');
  sphereMesh.type = 'sphere';  // Use type instead of geometry
  sphereMesh.radius = 0.5;
  sphereMesh.position.set(2, 0.5, 0);
  
  app.add(sphereMesh);
  
  console.log('✅ SimpleMeshTest: Sphere mesh created successfully');
  
  // Store test state
  app.state = {
    initialized: true,
    meshCount: 2,
    testPassed: true
  };
  
} catch (error) {
  console.error('❌ SimpleMeshTest: Failed to create mesh:', error);
  
  app.state = {
    initialized: false,
    error: error.message,
    testPassed: false
  };
}

console.log('🔥 SimpleMeshTest: Test complete, state:', app.state);