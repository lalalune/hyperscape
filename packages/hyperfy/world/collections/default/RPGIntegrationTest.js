/**
 * RPG Integration Test App
 * 
 * This app creates colored cube proxies for visual testing of RPG systems.
 * It spawns test entities (player, goblin, items) with specific colors
 * that can be detected through screenshot analysis.
 */

// Entity colors for visual testing
const ENTITY_COLORS = {
  PLAYER: 0xFF0000,      // Red
  GOBLIN: 0x00FF00,      // Green
  ITEM: 0x0000FF,        // Blue
  TREE: 0x228B22,        // Forest Green
  BANK: 0xFF00FF,        // Magenta
  STORE: 0xFFD700,       // Gold
  CORPSE: 0x800080       // Purple
};

// Initialize test entities
const testPlayer = app.create('group');
testPlayer.position.set(0, 1, 0);

// Player cube (red)
const playerGeometry = new THREE.BoxGeometry(1, 2, 1);
const playerMaterial = new THREE.MeshBasicMaterial({ 
  color: ENTITY_COLORS.PLAYER,
  emissive: ENTITY_COLORS.PLAYER,
  emissiveIntensity: 1
});
const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
playerMesh.name = 'TestPlayerCube';
testPlayer.add(playerMesh);

// Add player data
testPlayer.userData = {
  type: 'player',
  health: 100,
  maxHealth: 100,
  inventory: [{ type: 'bronze_sword', quantity: 1 }],
  skills: {
    attack: 1,
    strength: 1,
    defense: 1,
    constitution: 10
  }
};

app.add(testPlayer);

// Goblin cube (green)
const goblin = app.create('group');
goblin.position.set(5, 0.8, 5);

const goblinGeometry = new THREE.BoxGeometry(0.8, 1.6, 0.8);
const goblinMaterial = new THREE.MeshBasicMaterial({ 
  color: ENTITY_COLORS.GOBLIN,
  emissive: ENTITY_COLORS.GOBLIN,
  emissiveIntensity: 1
});
const goblinMesh = new THREE.Mesh(goblinGeometry, goblinMaterial);
goblinMesh.name = 'TestGoblinCube';
goblin.add(goblinMesh);

goblin.userData = {
  type: 'mob',
  mobType: 'goblin',
  health: 50,
  maxHealth: 50,
  level: 1,
  drops: ['coins', 'bronze_sword']
};

app.add(goblin);

// Tree resource (forest green)
const tree = app.create('group');
tree.position.set(-5, 1.5, 0);

const treeGeometry = new THREE.CylinderGeometry(0.5, 0.7, 3);
const treeMaterial = new THREE.MeshBasicMaterial({ 
  color: ENTITY_COLORS.TREE,
  emissive: ENTITY_COLORS.TREE,
  emissiveIntensity: 1
});
const treeMesh = new THREE.Mesh(treeGeometry, treeMaterial);
treeMesh.name = 'TestTreeCube';
tree.add(treeMesh);

tree.userData = {
  type: 'resource',
  resourceType: 'tree',
  health: 3
};

app.add(tree);

// Bank cube (magenta)
const bank = app.create('group');
bank.position.set(0, 1.5, -10);

const bankGeometry = new THREE.BoxGeometry(3, 3, 3);
const bankMaterial = new THREE.MeshBasicMaterial({ 
  color: ENTITY_COLORS.BANK,
  emissive: ENTITY_COLORS.BANK,
  emissiveIntensity: 1
});
const bankMesh = new THREE.Mesh(bankGeometry, bankMaterial);
bankMesh.name = 'TestBankCube';
bank.add(bankMesh);

bank.userData = {
  type: 'bank',
  townId: 'test_town'
};

app.add(bank);

// Store cube (gold)
const store = app.create('group');
store.position.set(0, 1.5, 10);

const storeGeometry = new THREE.BoxGeometry(3, 3, 3);
const storeMaterial = new THREE.MeshBasicMaterial({ 
  color: ENTITY_COLORS.STORE,
  emissive: ENTITY_COLORS.STORE,
  emissiveIntensity: 1
});
const storeMesh = new THREE.Mesh(storeGeometry, storeMaterial);
storeMesh.name = 'TestStoreCube';
store.add(storeMesh);

store.userData = {
  type: 'store',
  inventory: [
    { type: 'bronze_hatchet', price: 50 },
    { type: 'fishing_rod', price: 30 },
    { type: 'arrows', price: 2 }
  ]
};

app.add(store);

// Test helpers for integration testing
if (world.isClient) {
  window.rpgTestHelpers = {
    entities: {
      player: testPlayer,
      goblin: goblin,
      tree: tree,
      bank: bank,
      store: store
    },
    
    // Spawn item cube
    spawnItem: (x, z, itemType = 'coins') => {
      const item = app.create('group');
      item.position.set(x, 0.25, z);
      
      const itemGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const itemMaterial = new THREE.MeshBasicMaterial({ 
        color: ENTITY_COLORS.ITEM,
        emissive: ENTITY_COLORS.ITEM,
        emissiveIntensity: 1
      });
      const itemMesh = new THREE.Mesh(itemGeometry, itemMaterial);
      itemMesh.name = `TestItem_${itemType}_${Date.now()}`;
      item.add(itemMesh);
      
      item.userData = {
        type: 'item',
        itemType: itemType,
        quantity: itemType === 'coins' ? 50 : 1
      };
      
      app.add(item);
      return item;
    },
    
    // Simulate combat
    simulateCombat: (attacker, target) => {
      const damage = Math.floor(Math.random() * 10) + 5;
      target.userData.health -= damage;
      
      console.log(`[RPG Test] ${attacker.name} dealt ${damage} damage to ${target.name}`);
      
      if (target.userData.health <= 0) {
        // Remove target and spawn loot
        app.remove(target);
        const loot = window.rpgTestHelpers.spawnItem(
          target.position.x,
          target.position.z,
          'coins'
        );
        return { killed: true, damage, loot };
      }
      
      return { killed: false, damage };
    },
    
    // Get entity status
    getStatus: () => {
      return {
        player: {
          health: testPlayer.userData.health,
          position: testPlayer.position.toArray(),
          inventory: testPlayer.userData.inventory
        },
        goblin: goblin.parent ? {
          health: goblin.userData.health,
          position: goblin.position.toArray()
        } : null,
        sceneObjects: app.children.length
      };
    }
  };
  
  console.log('[RPG Integration Test] Test entities initialized');
}

// Server-side mob behavior
if (world.isServer) {
  let updateTimer = 0;
  
  app.on('update', (dt) => {
    updateTimer += dt;
    
    // Simple AI: make goblin move slightly
    if (updateTimer > 2000 && goblin.parent) {
      goblin.position.x += Math.sin(Date.now() * 0.001) * 0.01;
      goblin.position.z += Math.cos(Date.now() * 0.001) * 0.01;
      updateTimer = 0;
    }
  });
}

// Export for testing
app.testEntities = {
  player: testPlayer,
  goblin: goblin,
  tree: tree,
  bank: bank,
  store: store
};