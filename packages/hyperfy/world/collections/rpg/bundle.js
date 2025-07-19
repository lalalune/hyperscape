// src/rpg-core.js
var XP_TABLE = [
  0,
  83,
  174,
  276,
  388,
  512,
  650,
  801,
  969,
  1154,
  1358,
  1584,
  1833,
  2107,
  2411,
  2746,
  3115,
  3523,
  3973,
  4470,
  5018,
  5624,
  6291,
  7028,
  7842,
  8740,
  9730,
  10824,
  12031,
  13363,
  14833,
  16456,
  18247,
  20224,
  22406,
  24815,
  27473,
  30408,
  33648,
  37224,
  41171,
  45529,
  50339,
  55649,
  61512,
  67983,
  75127,
  83014,
  91721,
  101333,
  111945,
  123660,
  136594,
  150872,
  166636,
  184040,
  203254,
  224466,
  247886,
  273742,
  302288,
  333804,
  368599,
  407015,
  449428,
  496254,
  547953,
  605032,
  668051,
  737627,
  814445,
  899257,
  992895,
  1096278,
  1210421,
  1336443,
  1475581,
  1629200,
  1798808,
  1986068,
  2192818,
  2421087,
  2673114,
  2951373,
  3258594,
  3597792,
  3972294,
  4385776,
  4842295,
  5346332,
  5902831,
  6517253,
  7195629,
  7944614,
  8771558,
  9684577,
  10692629,
  11805606,
  13034431
];
var ITEMS = {
  995: { name: "Coins", stackable: true, type: "currency" },
  1: { name: "Bronze sword", type: "weapon", tier: "bronze", attackLevel: 1 },
  2: { name: "Steel sword", type: "weapon", tier: "steel", attackLevel: 10 },
  3: { name: "Mithril sword", type: "weapon", tier: "mithril", attackLevel: 20 },
  10: { name: "Wood bow", type: "bow", tier: "wood", rangedLevel: 1 },
  11: { name: "Oak bow", type: "bow", tier: "oak", rangedLevel: 10 },
  12: { name: "Willow bow", type: "bow", tier: "willow", rangedLevel: 20 },
  20: { name: "Arrow", stackable: true, type: "ammunition" },
  30: { name: "Bronze helmet", type: "helmet", tier: "bronze", defenseLevel: 1 },
  31: { name: "Steel helmet", type: "helmet", tier: "steel", defenseLevel: 10 },
  32: { name: "Mithril helmet", type: "helmet", tier: "mithril", defenseLevel: 20 },
  40: { name: "Bronze body", type: "body", tier: "bronze", defenseLevel: 1 },
  41: { name: "Steel body", type: "body", tier: "steel", defenseLevel: 10 },
  42: { name: "Mithril body", type: "body", tier: "mithril", defenseLevel: 20 },
  50: { name: "Bronze legs", type: "legs", tier: "bronze", defenseLevel: 1 },
  51: { name: "Steel legs", type: "legs", tier: "steel", defenseLevel: 10 },
  52: { name: "Mithril legs", type: "legs", tier: "mithril", defenseLevel: 20 },
  60: { name: "Bronze shield", type: "shield", tier: "bronze", defenseLevel: 1 },
  61: { name: "Steel shield", type: "shield", tier: "steel", defenseLevel: 10 },
  62: { name: "Mithril shield", type: "shield", tier: "mithril", defenseLevel: 20 },
  70: { name: "Bronze hatchet", type: "tool", skill: "woodcutting" },
  71: { name: "Fishing rod", type: "tool", skill: "fishing" },
  72: { name: "Tinderbox", type: "tool", skill: "firemaking" },
  80: { name: "Logs", stackable: true, type: "resource" },
  81: { name: "Raw fish", stackable: true, type: "resource" },
  82: { name: "Cooked fish", stackable: true, type: "food", heals: 3 }
};
function createPlayerStats() {
  return {
    attack: { level: 1, xp: 0 },
    strength: { level: 1, xp: 0 },
    defense: { level: 1, xp: 0 },
    hitpoints: { level: 10, xp: 0, current: 100, max: 100 },
    ranged: { level: 1, xp: 0 },
    woodcutting: { level: 1, xp: 0 },
    fishing: { level: 1, xp: 0 },
    firemaking: { level: 1, xp: 0 },
    cooking: { level: 1, xp: 0 },
    equipment: {
      weapon: null,
      shield: null,
      helmet: null,
      body: null,
      legs: null,
      arrows: null
    },
    inventory: new Array(28).fill(null),
    position: { x: 0, y: 0, z: 0 },
    inCombat: false,
    target: null,
    lastAction: null
  };
}
function getLevel(xp) {
  if (xp < 0)
    return 1;
  for (let i = XP_TABLE.length - 1;i >= 0; i--) {
    if (xp >= XP_TABLE[i]) {
      return i + 1;
    }
  }
  return 1;
}

// src/hyperfy-bridge.js
var hyperfyRPGState = {
  players: new Map,
  npcs: new Map,
  items: new Map,
  initialized: false
};
function initializeHyperfyRPG(app2, world2) {
  console.log("\uD83C\uDFAE Initializing Hyperfy RPG Bridge...");
  try {
    hyperfyRPGState.app = app2;
    hyperfyRPGState.world = world2;
    app2.configure([
      {
        type: "text",
        key: "serverName",
        label: "Server Name",
        initial: "Hyperscape RPG"
      },
      {
        type: "boolean",
        key: "enableCombat",
        label: "Enable Combat",
        initial: true
      },
      {
        type: "boolean",
        key: "enableSkills",
        label: "Enable Skills",
        initial: true
      },
      {
        type: "boolean",
        key: "debugMode",
        label: "Debug Mode",
        initial: false
      }
    ]);
    setupHyperfyEventHandlers(app2, world2);
    initializeRPGSystems();
    hyperfyRPGState.initialized = true;
    console.log("✅ Hyperfy RPG Bridge initialized successfully");
    app2.send("rpg:initialized", {
      timestamp: Date.now(),
      playersOnline: hyperfyRPGState.players.size
    });
    return true;
  } catch (error) {
    console.error("❌ Failed to initialize Hyperfy RPG:", error);
    app2.send("rpg:error", {
      error: error.message,
      phase: "initialization"
    });
    return false;
  }
}
function setupHyperfyEventHandlers(app2, world2) {
  app2.on("playerJoin", (data) => {
    try {
      const playerId = data.player.id;
      console.log(`\uD83D\uDC4B Player joining: ${playerId}`);
      const playerStats = createPlayerStats();
      hyperfyRPGState.players.set(playerId, {
        id: playerId,
        hyperfyPlayer: data.player,
        stats: playerStats,
        position: data.player.position || { x: 0, y: 0, z: 0 },
        inCombat: false,
        target: null,
        lastAction: null
      });
      giveStartingEquipment(playerId);
      app2.send("rpg:playerJoined", {
        playerId,
        stats: playerStats,
        message: "Welcome to Hyperscape RPG!"
      });
      console.log(`✅ RPG data created for player: ${playerId}`);
    } catch (error) {
      console.error("❌ Error handling player join:", error);
      app2.send("rpg:error", {
        error: error.message,
        phase: "playerJoin",
        playerId: data.player?.id
      });
    }
  });
  app2.on("playerLeave", (data) => {
    try {
      const playerId = data.player.id;
      console.log(`\uD83D\uDC4B Player leaving: ${playerId}`);
      const playerData = hyperfyRPGState.players.get(playerId);
      if (playerData) {
        console.log(`\uD83D\uDCBE Saving player data for: ${playerId}`);
      }
      hyperfyRPGState.players.delete(playerId);
      app2.send("rpg:playerLeft", { playerId });
    } catch (error) {
      console.error("❌ Error handling player leave:", error);
    }
  });
  app2.on("playerAction", (data) => {
    try {
      handlePlayerAction(data);
    } catch (error) {
      console.error("❌ Error handling player action:", error);
      app2.send("rpg:error", {
        error: error.message,
        phase: "playerAction",
        action: data.action,
        playerId: data.playerId
      });
    }
  });
  app2.on("update", (deltaTime) => {
    try {
      updateRPGSystems(deltaTime);
    } catch (error) {
      console.error("❌ Error in RPG update:", error);
    }
  });
}
function initializeRPGSystems() {
  console.log("\uD83D\uDD27 Initializing RPG systems...");
  initializeMobs();
  initializeGroundItems();
  console.log("✅ RPG systems initialized");
}
function giveStartingEquipment(playerId) {
  try {
    const player = hyperfyRPGState.players.get(playerId);
    if (!player)
      return;
    addItemToPlayer(playerId, 1, 1);
    addItemToPlayer(playerId, 995, 25);
    console.log(`\uD83C\uDF81 Starting equipment given to ${playerId}`);
  } catch (error) {
    console.error("❌ Error giving starting equipment:", error);
  }
}
function addItemToPlayer(playerId, itemId, quantity = 1) {
  try {
    const player = hyperfyRPGState.players.get(playerId);
    if (!player) {
      console.error(`❌ Player ${playerId} not found`);
      return false;
    }
    const item = ITEMS[itemId];
    if (!item) {
      console.error(`❌ Item ${itemId} not found`);
      return false;
    }
    const inventory = player.stats.inventory;
    if (item.stackable) {
      for (let i = 0;i < inventory.length; i++) {
        if (inventory[i] && inventory[i].itemId === itemId) {
          inventory[i].quantity += quantity;
          console.log(`✅ Added ${item.name} x${quantity} to existing stack for ${playerId}`);
          hyperfyRPGState.app.send("rpg:itemAdded", {
            playerId,
            itemId,
            quantity,
            total: inventory[i].quantity,
            slot: i
          });
          return true;
        }
      }
    }
    for (let i = 0;i < inventory.length; i++) {
      if (!inventory[i]) {
        inventory[i] = { itemId, quantity };
        console.log(`✅ Added ${item.name} x${quantity} to ${playerId} in slot ${i}`);
        hyperfyRPGState.app.send("rpg:itemAdded", {
          playerId,
          itemId,
          quantity,
          slot: i
        });
        return true;
      }
    }
    console.error(`❌ Inventory full for ${playerId}`);
    hyperfyRPGState.app.send("rpg:inventoryFull", { playerId });
    return false;
  } catch (error) {
    console.error("❌ Error adding item to player:", error);
    return false;
  }
}
function grantXPToPlayer(playerId, skill, amount) {
  try {
    const player = hyperfyRPGState.players.get(playerId);
    if (!player) {
      console.error(`❌ Player ${playerId} not found`);
      return false;
    }
    if (!player.stats[skill]) {
      console.error(`❌ Skill ${skill} not found for player ${playerId}`);
      return false;
    }
    const oldLevel = player.stats[skill].level;
    player.stats[skill].xp += amount;
    const newLevel = getLevel(player.stats[skill].xp);
    player.stats[skill].level = newLevel;
    console.log(`\uD83D\uDCC8 ${playerId} gained ${amount} XP in ${skill} (Level ${newLevel})`);
    hyperfyRPGState.app.send("rpg:xpGained", {
      playerId,
      skill,
      amount,
      newXP: player.stats[skill].xp,
      oldLevel,
      newLevel
    });
    if (newLevel > oldLevel) {
      console.log(`\uD83C\uDF89 ${playerId} leveled ${skill} to ${newLevel}!`);
      hyperfyRPGState.app.send("rpg:levelUp", {
        playerId,
        skill,
        newLevel,
        oldLevel
      });
    }
    return true;
  } catch (error) {
    console.error("❌ Error granting XP:", error);
    return false;
  }
}
function handlePlayerAction(data) {
  const { playerId, action, target, position } = data;
  console.log(`\uD83C\uDFAF Player ${playerId} performing action: ${action}`);
  switch (action) {
    case "attack":
      handleAttackAction(playerId, target);
      break;
    case "move":
      handleMoveAction(playerId, position);
      break;
    case "pickup":
      handlePickupAction(playerId, target);
      break;
    case "use":
      handleUseAction(playerId, target);
      break;
    default:
      console.log(`⚠️ Unknown action: ${action}`);
  }
}
function handleAttackAction(playerId, targetId) {
  try {
    const player = hyperfyRPGState.players.get(playerId);
    const target = hyperfyRPGState.npcs.get(targetId);
    if (!player || !target) {
      console.error("❌ Invalid attack: player or target not found");
      return;
    }
    player.inCombat = true;
    player.target = targetId;
    const damage = calculateDamage(player.stats, target);
    console.log(`⚔️ ${playerId} attacks ${targetId} for ${damage} damage`);
    target.hitpoints.current -= damage;
    hyperfyRPGState.app.send("rpg:combat", {
      attackerId: playerId,
      targetId,
      damage,
      targetHealth: target.hitpoints.current
    });
    grantXPToPlayer(playerId, "attack", damage * 4);
    grantXPToPlayer(playerId, "strength", damage * 4);
    grantXPToPlayer(playerId, "hitpoints", damage * 1.33);
    if (target.hitpoints.current <= 0) {
      handleMobDeath(targetId, playerId);
    }
  } catch (error) {
    console.error("❌ Error handling attack:", error);
  }
}
function calculateDamage(attackerStats, target) {
  const attackLevel = attackerStats.attack.level;
  const strengthLevel = attackerStats.strength.level;
  const defenseLevel = target.defense?.level || 1;
  const attackRoll = Math.random() * (attackLevel + 8);
  const defenseRoll = Math.random() * (defenseLevel + 8);
  if (attackRoll <= defenseRoll) {
    return 0;
  }
  const maxHit = Math.floor(0.5 + (strengthLevel + 8) / 10);
  return Math.floor(Math.random() * (maxHit + 1));
}
function handleMobDeath(mobId, killerId) {
  try {
    const mob = hyperfyRPGState.npcs.get(mobId);
    if (!mob)
      return;
    console.log(`\uD83D\uDC80 Mob ${mobId} killed by ${killerId}`);
    dropLoot(mob, killerId);
    grantXPToPlayer(killerId, "attack", mob.level * 10);
    hyperfyRPGState.npcs.delete(mobId);
    hyperfyRPGState.app.send("rpg:mobDeath", {
      mobId,
      killerId,
      mobType: mob.type
    });
  } catch (error) {
    console.error("❌ Error handling mob death:", error);
  }
}
function dropLoot(mob, killerId) {
  const lootTable = {
    goblin: [
      { itemId: 995, quantity: [1, 5], chance: 1 },
      { itemId: 1, quantity: 1, chance: 0.1 }
    ]
  };
  const drops = lootTable[mob.type] || [];
  drops.forEach((drop) => {
    if (Math.random() < drop.chance) {
      const quantity = Array.isArray(drop.quantity) ? Math.floor(Math.random() * (drop.quantity[1] - drop.quantity[0] + 1)) + drop.quantity[0] : drop.quantity;
      addItemToPlayer(killerId, drop.itemId, quantity);
    }
  });
}
function initializeMobs() {
  const goblinId = "test-goblin-1";
  hyperfyRPGState.npcs.set(goblinId, {
    id: goblinId,
    type: "goblin",
    level: 1,
    attack: { level: 1 },
    strength: { level: 1 },
    defense: { level: 1 },
    hitpoints: { current: 20, max: 20 },
    position: { x: 10, y: 0, z: 10 }
  });
  console.log("\uD83D\uDC79 Test goblin created");
}
function initializeGroundItems() {
  console.log("\uD83D\uDC8E Ground items initialized (mock)");
}
function updateRPGSystems(deltaTime) {}
function getPlayerData(playerId) {
  return hyperfyRPGState.players.get(playerId);
}
function isInitialized() {
  return hyperfyRPGState.initialized;
}

// src/app.js
app.configure([
  {
    type: "text",
    key: "worldName",
    label: "World Name",
    initial: "Hyperscape RPG World"
  },
  {
    type: "boolean",
    key: "enableCombat",
    label: "Enable Combat System",
    initial: true
  },
  {
    type: "boolean",
    key: "enableSkills",
    label: "Enable Skills System",
    initial: true
  },
  {
    type: "boolean",
    key: "enableBanking",
    label: "Enable Banking System",
    initial: true
  },
  {
    type: "number",
    key: "maxPlayers",
    label: "Maximum Players",
    initial: 100,
    min: 1,
    max: 1000
  },
  {
    type: "boolean",
    key: "debugMode",
    label: "Debug Mode",
    initial: false
  }
]);
app.on("init", () => {
  try {
    console.log("\uD83C\uDFAE Hyperscape RPG starting...");
    console.log(`\uD83D\uDCCD World: ${props.worldName}`);
    console.log(`⚔️ Combat: ${props.enableCombat ? "Enabled" : "Disabled"}`);
    console.log(`\uD83D\uDCDA Skills: ${props.enableSkills ? "Enabled" : "Disabled"}`);
    console.log(`\uD83C\uDFE6 Banking: ${props.enableBanking ? "Enabled" : "Disabled"}`);
    console.log(`\uD83D\uDC65 Max Players: ${props.maxPlayers}`);
    console.log(`\uD83D\uDC1B Debug Mode: ${props.debugMode ? "On" : "Off"}`);
    const initialized = initializeHyperfyRPG(app, world);
    if (initialized) {
      console.log("✅ Hyperscape RPG initialized successfully!");
      createWorldElements();
      app.send("rpg:worldReady", {
        worldName: props.worldName,
        systems: {
          combat: props.enableCombat,
          skills: props.enableSkills,
          banking: props.enableBanking
        },
        maxPlayers: props.maxPlayers
      });
    } else {
      console.error("❌ Failed to initialize Hyperscape RPG");
      app.send("rpg:initError", {
        error: "Failed to initialize RPG system"
      });
    }
  } catch (error) {
    console.error("\uD83D\uDCA5 Critical error during RPG initialization:", error);
    app.send("rpg:criticalError", {
      error: error.message,
      stack: error.stack
    });
  }
});
app.on("playerJoin", (data) => {
  try {
    console.log(`\uD83D\uDC4B Player joining: ${data.player.id}`);
    setTimeout(() => {
      createPlayerVisuals(data.player);
      app.send("rpg:welcomePlayer", {
        playerId: data.player.id,
        worldName: props.worldName,
        message: `Welcome to ${props.worldName}! Your adventure begins now.`
      });
    }, 100);
  } catch (error) {
    console.error("❌ Error handling player join:", error);
  }
});
app.on("playerLeave", (data) => {
  try {
    console.log(`\uD83D\uDC4B Player leaving: ${data.player.id}`);
    cleanupPlayerVisuals(data.player);
  } catch (error) {
    console.error("❌ Error handling player leave:", error);
  }
});
app.on("chatMessage", (data) => {
  try {
    const { player, message } = data;
    if (message.startsWith("/rpg")) {
      handleRPGCommand(player, message);
    }
  } catch (error) {
    console.error("❌ Error handling chat message:", error);
  }
});
function createWorldElements() {
  try {
    console.log("\uD83C\uDF0D Creating world elements...");
    const spawnArea = app.create("group");
    spawnArea.position.set(0, 0, 0);
    createStarterTown(spawnArea);
    if (props.enableCombat) {
      createTestGoblin();
    }
    createResourceNodes();
    console.log("✅ World elements created");
  } catch (error) {
    console.error("❌ Error creating world elements:", error);
  }
}
function createStarterTown(parent) {
  try {
    console.log("\uD83C\uDFD8️ Creating starter town...");
    if (props.enableBanking) {
      const bank = app.create("mesh");
      bank.position.set(5, 0, 0);
      bank.material.color = "gold";
      const bankAction = app.create("action");
      bankAction.label = "Bank";
      bankAction.distance = 3;
      bankAction.onTrigger = (player) => {
        handleBankInteraction(player);
      };
      bank.add(bankAction);
      parent.add(bank);
    }
    const store = app.create("mesh");
    store.position.set(-5, 0, 0);
    store.material.color = "brown";
    const storeAction = app.create("action");
    storeAction.label = "General Store";
    storeAction.distance = 3;
    storeAction.onTrigger = (player) => {
      handleStoreInteraction(player);
    };
    store.add(storeAction);
    parent.add(store);
    console.log("✅ Starter town created");
  } catch (error) {
    console.error("❌ Error creating starter town:", error);
  }
}
function createTestGoblin() {
  try {
    console.log("\uD83D\uDC79 Creating test goblin...");
    const goblin = app.create("mesh");
    goblin.position.set(10, 0, 10);
    goblin.material.color = "green";
    const attackAction = app.create("action");
    attackAction.label = "Attack Goblin";
    attackAction.distance = 2;
    attackAction.onTrigger = (player) => {
      handleAttackAction2(player, "test-goblin-1");
    };
    goblin.add(attackAction);
    console.log("✅ Test goblin created");
  } catch (error) {
    console.error("❌ Error creating test goblin:", error);
  }
}
function createResourceNodes() {
  try {
    console.log("\uD83C\uDF33 Creating resource nodes...");
    const tree = app.create("mesh");
    tree.position.set(0, 0, 10);
    tree.material.color = "darkgreen";
    const chopAction = app.create("action");
    chopAction.label = "Chop Tree";
    chopAction.distance = 2;
    chopAction.onTrigger = (player) => {
      handleChopAction(player);
    };
    tree.add(chopAction);
    const fishingSpot = app.create("mesh");
    fishingSpot.position.set(0, 0, -10);
    fishingSpot.material.color = "blue";
    const fishAction = app.create("action");
    fishAction.label = "Fish";
    fishAction.distance = 2;
    fishAction.onTrigger = (player) => {
      handleFishAction(player);
    };
    fishingSpot.add(fishAction);
    console.log("✅ Resource nodes created");
  } catch (error) {
    console.error("❌ Error creating resource nodes:", error);
  }
}
function createPlayerVisuals(player) {
  try {
    console.log(`\uD83C\uDFA8 Creating visuals for player: ${player.id}`);
  } catch (error) {
    console.error("❌ Error creating player visuals:", error);
  }
}
function cleanupPlayerVisuals(player) {
  try {
    console.log(`\uD83E\uDDF9 Cleaning up visuals for player: ${player.id}`);
  } catch (error) {
    console.error("❌ Error cleaning up player visuals:", error);
  }
}
function handleRPGCommand(player, message) {
  try {
    const args = message.split(" ");
    const command = args[1];
    switch (command) {
      case "stats":
        showPlayerStats(player);
        break;
      case "give":
        if (props.debugMode) {
          const itemId = parseInt(args[2]);
          const quantity = parseInt(args[3]) || 1;
          if (itemId) {
            addItemToPlayer(player.id, itemId, quantity);
            app.send("rpg:message", {
              playerId: player.id,
              message: `Given item ${itemId} x${quantity}`
            });
          }
        }
        break;
      case "xp":
        if (props.debugMode) {
          const skill = args[2];
          const amount = parseInt(args[3]) || 100;
          if (skill) {
            grantXPToPlayer(player.id, skill, amount);
            app.send("rpg:message", {
              playerId: player.id,
              message: `Granted ${amount} XP in ${skill}`
            });
          }
        }
        break;
      case "help":
        showRPGHelp(player);
        break;
      default:
        app.send("rpg:message", {
          playerId: player.id,
          message: "Unknown RPG command. Type /rpg help for help."
        });
    }
  } catch (error) {
    console.error("❌ Error handling RPG command:", error);
  }
}
function showPlayerStats(player) {
  try {
    const playerData = getPlayerData(player.id);
    if (!playerData) {
      app.send("rpg:message", {
        playerId: player.id,
        message: "Player data not found."
      });
      return;
    }
    const stats = playerData.stats;
    const message = `
Combat: ATK ${stats.attack.level} STR ${stats.strength.level} DEF ${stats.defense.level} HP ${stats.hitpoints.current}/${stats.hitpoints.max} RNG ${stats.ranged.level}
Skills: WC ${stats.woodcutting.level} FISH ${stats.fishing.level} FM ${stats.firemaking.level} COOK ${stats.cooking.level}
    `.trim();
    app.send("rpg:message", {
      playerId: player.id,
      message
    });
  } catch (error) {
    console.error("❌ Error showing player stats:", error);
  }
}
function showRPGHelp(player) {
  const helpMessage = `
RPG Commands:
/rpg stats - Show your stats
/rpg help - Show this help
${props.debugMode ? `
Debug Commands:
/rpg give <itemId> <quantity> - Give item
/rpg xp <skill> <amount> - Grant XP
` : ""}
  `.trim();
  app.send("rpg:message", {
    playerId: player.id,
    message: helpMessage
  });
}
function handleAttackAction2(player, targetId) {
  if (!props.enableCombat)
    return;
  app.trigger("playerAction", {
    playerId: player.id,
    action: "attack",
    target: targetId
  });
}
function handleChopAction(player) {
  if (!props.enableSkills)
    return;
  const playerData = getPlayerData(player.id);
  if (!playerData)
    return;
  addItemToPlayer(player.id, 80, 1);
  grantXPToPlayer(player.id, "woodcutting", 25);
  app.send("rpg:message", {
    playerId: player.id,
    message: "You chop some logs."
  });
}
function handleFishAction(player) {
  if (!props.enableSkills)
    return;
  addItemToPlayer(player.id, 81, 1);
  grantXPToPlayer(player.id, "fishing", 20);
  app.send("rpg:message", {
    playerId: player.id,
    message: "You catch a fish."
  });
}
function handleBankInteraction(player) {
  if (!props.enableBanking)
    return;
  app.send("rpg:openBank", {
    playerId: player.id
  });
}
function handleStoreInteraction(player) {
  app.send("rpg:openStore", {
    playerId: player.id
  });
}
app.on("update", (deltaTime) => {
  try {
    if (isInitialized()) {}
  } catch (error) {
    console.error("❌ Error in update loop:", error);
  }
});
console.log("\uD83D\uDCDC Hyperscape RPG app script loaded");

//# debugId=51FF254AC580F2EE64756E2164756E21
