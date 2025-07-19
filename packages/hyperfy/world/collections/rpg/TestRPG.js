
// Test RPG App for Hyperfy
import { initializeHyperfyRPG, addItemToPlayer, grantXPToPlayer } from './bundle.js';

// App configuration
app.configure([
  {
    type: 'text',
    key: 'testMode',
    label: 'Test Mode',
    initial: 'RPG Integration Test'
  },
  {
    type: 'boolean',
    key: 'enableCombat',
    label: 'Enable Combat',
    initial: true
  }
]);

// Initialize RPG when app starts
app.on('init', () => {
  console.log('🎮 Initializing RPG Test App...');
  
  try {
    const initialized = initializeHyperfyRPG(app, world);
    
    if (initialized) {
      console.log('✅ RPG System initialized successfully!');
      
      // Create test world elements
      createTestWorld();
      
      // Mark as ready for testing
      app.send('rpg:testReady', {
        message: 'RPG system ready for testing',
        timestamp: Date.now()
      });
    } else {
      console.error('❌ RPG initialization failed');
    }
  } catch (error) {
    console.error('💥 RPG initialization error:', error);
  }
});

function createTestWorld() {
  console.log('🏗️ Creating test world elements...');
  
  // Create spawn area
  const spawnArea = app.create('group');
  spawnArea.position.set(0, 0, 0);
  
  // Create bank (visual indicator)
  const bank = app.create('mesh');
  bank.position.set(5, 0, 0);
  bank.scale.set(1, 2, 1);
  if (bank.material) {
    bank.material.color = 'gold';
  }
  
  // Create test goblin
  const goblin = app.create('mesh');
  goblin.position.set(10, 0, 10);
  goblin.scale.set(1, 1, 1);
  if (goblin.material) {
    goblin.material.color = 'green';
  }
  
  // Create action for goblin
  const attackAction = app.create('action');
  attackAction.label = 'Attack Test Goblin';
  attackAction.distance = 3;
  attackAction.onTrigger = (player) => {
    console.log('🗡️ Player attacking goblin:', player.id);
    app.trigger('playerAction', {
      playerId: player.id,
      action: 'attack',
      target: 'test-goblin-1'
    });
  };
  
  goblin.add(attackAction);
  
  // Create tree for woodcutting
  const tree = app.create('mesh');
  tree.position.set(-10, 0, 5);
  tree.scale.set(1, 3, 1);
  if (tree.material) {
    tree.material.color = 'darkgreen';
  }
  
  const chopAction = app.create('action');
  chopAction.label = 'Chop Tree';
  chopAction.distance = 3;
  chopAction.onTrigger = (player) => {
    console.log('🪓 Player chopping tree:', player.id);
    addItemToPlayer(player.id, 80, 1); // Add logs
    grantXPToPlayer(player.id, 'woodcutting', 25);
    app.send('rpg:message', {
      playerId: player.id,
      message: 'You chopped some logs and gained woodcutting XP!'
    });
  };
  
  tree.add(chopAction);
  
  console.log('✅ Test world elements created');
}

// Handle player join
app.on('playerJoin', (data) => {
  console.log('👋 Test player joined:', data.player.id);
  
  setTimeout(() => {
    console.log('🎁 Giving test player starting items...');
    
    // Give starting items
    addItemToPlayer(data.player.id, 1, 1);     // Bronze sword
    addItemToPlayer(data.player.id, 995, 100); // 100 coins
    addItemToPlayer(data.player.id, 70, 1);    // Hatchet
    
    // Grant some starting XP
    grantXPToPlayer(data.player.id, 'attack', 100);
    
    app.send('rpg:welcomeMessage', {
      playerId: data.player.id,
      message: 'Welcome to the RPG test world! You have a bronze sword, 100 coins, and a hatchet. Attack the green goblin or chop the tree!'
    });
  }, 1000);
});

console.log('📜 RPG Test App loaded');
