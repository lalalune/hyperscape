// MinimalVisualTest.js - Absolutely minimal test for visual validation

console.log('🎯 MinimalVisualTest: Starting minimal visual test...');

try {
  // Create a blue cube for PLAYER 
  const playerCube = app.create('mesh');
  playerCube.type = 'box';
  playerCube.width = 1;
  playerCube.height = 1;
  playerCube.depth = 1;
  playerCube.position.set(-2, 0.5, 0);
  app.add(playerCube);
  console.log('✅ Created PLAYER cube (blue) at (-2, 0.5, 0)');

  // Create a green cube for GOBLIN
  const goblinCube = app.create('mesh');
  goblinCube.type = 'box'; 
  goblinCube.width = 0.8;
  goblinCube.height = 0.8;
  goblinCube.depth = 0.8;
  goblinCube.position.set(2, 0.4, 0);
  app.add(goblinCube);
  console.log('✅ Created GOBLIN cube (green) at (2, 0.4, 0)');

  // Store state
  app.state = {
    initialized: true,
    entities: [
      { type: 'PLAYER', position: { x: -2, y: 0.5, z: 0 }, color: 'blue' },
      { type: 'GOBLIN', position: { x: 2, y: 0.4, z: 0 }, color: 'green' }
    ]
  };

  console.log('🎯 MinimalVisualTest: Successfully initialized with 2 entities');

} catch (error) {
  console.error('❌ MinimalVisualTest: Failed to initialize:', error);
  app.state = { error: error.message, initialized: false };
}