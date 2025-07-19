// ColoredCubeTest.js - Test with visual markers using large geometric shapes

console.log('🎨 ColoredCubeTest: Creating visually distinct geometric markers...');

try {
  // Create LARGE distinctive shapes at different positions for visual identification

  // PLAYER marker - Large tall blue-ish cube (position -5, 0, 0)
  const playerMarker = app.create('mesh');
  playerMarker.type = 'box';
  playerMarker.width = 3;   // Very wide
  playerMarker.height = 5;  // Very tall 
  playerMarker.depth = 1;   // Thin depth
  playerMarker.position.set(-5, 2.5, 0); // High up so it's visible
  app.add(playerMarker);
  console.log('✅ Created PLAYER marker (tall thin box) at (-5, 2.5, 0)');

  // GOBLIN marker - Wide flat green-ish cube (position 5, 0, 0) 
  const goblinMarker = app.create('mesh');
  goblinMarker.type = 'box';
  goblinMarker.width = 4;   // Very wide
  goblinMarker.height = 1;  // Very flat
  goblinMarker.depth = 4;   // Very deep
  goblinMarker.position.set(5, 0.5, 0);  // Ground level
  app.add(goblinMarker);
  console.log('✅ Created GOBLIN marker (wide flat box) at (5, 0.5, 0)');

  // LOOT marker - Small sphere high up (position 0, 10, 0)
  const lootMarker = app.create('mesh');
  lootMarker.type = 'sphere';
  lootMarker.radius = 1.5;  // Large sphere
  lootMarker.position.set(0, 8, 0);  // High in the sky
  app.add(lootMarker);
  console.log('✅ Created LOOT marker (large sphere) at (0, 8, 0)');

  // Create actions for interaction testing
  const playerAction = app.create('action');
  playerAction.label = 'PLAYER TEST';
  playerAction.distance = 10;
  playerAction.onTrigger = () => console.log('🔵 PLAYER marker clicked');
  playerMarker.add(playerAction);

  const goblinAction = app.create('action');  
  goblinAction.label = 'GOBLIN TEST';
  goblinAction.distance = 10;
  goblinAction.onTrigger = () => console.log('🟢 GOBLIN marker clicked');
  goblinMarker.add(goblinAction);

  const lootAction = app.create('action');
  lootAction.label = 'LOOT TEST'; 
  lootAction.distance = 15;
  lootAction.onTrigger = () => console.log('🟡 LOOT marker clicked');
  lootMarker.add(lootAction);

  // Store test data
  app.state = {
    initialized: true,
    markers: [
      { type: 'PLAYER', shape: 'tall_box', position: { x: -5, y: 2.5, z: 0 } },
      { type: 'GOBLIN', shape: 'flat_box', position: { x: 5, y: 0.5, z: 0 } },
      { type: 'LOOT', shape: 'sphere', position: { x: 0, y: 8, z: 0 } }
    ],
    testType: 'geometric_visual_markers'
  };

  console.log('🎨 ColoredCubeTest: Successfully created 3 geometric visual markers');

} catch (error) {
  console.error('❌ ColoredCubeTest: Failed to create markers:', error);
  app.state = { error: error.message, initialized: false };
}