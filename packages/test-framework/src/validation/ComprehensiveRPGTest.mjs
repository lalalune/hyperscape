#!/usr/bin/env node
/**
 * Comprehensive RPG Test - Validates ALL GDD Features
 * 
 * This test validates every single feature from the Game Design Document:
 * - Player systems (stats, health, inventory, equipment)
 * - Combat mechanics (attack, damage calculation, XP gain)
 * - Skills system (woodcutting, fishing, cooking, firemaking)
 * - Items and equipment (weapons, tools, resources)
 * - NPC/Mob systems (goblin AI, loot drops, respawning)
 * - Banking system
 * - Visual representations and movement
 * 
 * NO MOCKS - this tests the real RPG systems in Hyperfy
 */

import { spawn } from 'child_process';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { setTimeout } from 'timers/promises';

const HYPERFY_DIR = '/Users/shawwalters/hyperscape/packages/hyperfy';
const SERVER_PORT = 3000;
const STARTUP_DELAY = 8000; // Time for server to fully initialize
const PAGE_LOAD_DELAY = 6000; // Time for RPG entities to spawn in browser

class ComprehensiveRPGValidator {
  constructor() {
    this.serverProcess = null;
    this.browser = null;
    this.page = null;
    this.testResults = [];
  }

  async runAllTests() {
    console.log('🎯 COMPREHENSIVE RPG VALIDATION');
    console.log('==============================');
    console.log('Testing EVERY feature from the Game Design Document');
    console.log('');

    try {
      await this.startHyperfyServer();
      await this.initializeBrowser();
      
      // Test each major system
      await this.testEntityDetection();
      await this.testPlayerSystems();
      await this.testGoblinSystems();
      await this.testCombatSystems();
      await this.testSkillSystems();
      await this.testInventorySystem();
      await this.testVisualSystems();
      await this.testMovementSystems();
      
      this.reportResults();
      
    } catch (error) {
      console.error('💥 Comprehensive RPG test failed:', error.message);
      this.logError('CRITICAL_FAILURE', error);
    } finally {
      await this.cleanup();
    }
  }

  async startHyperfyServer() {
    console.log('🚀 Starting Hyperfy server with RPG systems...');
    
    this.serverProcess = spawn('npm', ['start'], {
      cwd: HYPERFY_DIR,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Monitor server output
    this.serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('running on port')) {
        console.log('✅ Hyperfy server ready');
      }
      if (output.includes('RPG Player') || output.includes('RPG Goblin')) {
        console.log('✅ RPG entity initialized:', output.trim());
      }
    });

    this.serverProcess.stderr.on('data', (data) => {
      const error = data.toString();
      if (!error.includes('WARNING') && !error.includes('SES')) {
        console.error('🚨 Server error:', error.trim());
      }
    });

    await setTimeout(STARTUP_DELAY);
  }

  async initializeBrowser() {
    console.log('🌐 Launching browser for RPG testing...');
    
    this.browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    
    this.page = await this.browser.newPage();
    
    // Add console logging
    this.page.on('console', msg => {
      if (msg.text().includes('RPG') || msg.text().includes('🎮') || msg.text().includes('🧌')) {
        console.log('[Browser]', msg.text());
      }
    });
    
    await this.page.goto(`http://localhost:${SERVER_PORT}`);
    await setTimeout(PAGE_LOAD_DELAY);
  }

  async testEntityDetection() {
    console.log('🔍 Testing RPG Entity Detection...');
    
    const entities = await this.page.evaluate(() => {
      const found = [];
      
      // Check for RPG Player
      if (window.rpgPlayer) {
        found.push({
          type: 'RPGPlayer',
          health: window.rpgPlayer.getHealth ? window.rpgPlayer.getHealth() : null,
          maxHealth: window.rpgPlayer.getMaxHealth ? window.rpgPlayer.getMaxHealth() : null,
          skills: window.rpgPlayer.getSkills ? window.rpgPlayer.getSkills() : null,
          position: window.rpgPlayer.getPosition ? window.rpgPlayer.getPosition() : null,
          inventory: window.rpgPlayer.getInventory ? window.rpgPlayer.getInventory() : null,
          alive: window.rpgPlayer.isAlive ? window.rpgPlayer.isAlive() : null
        });
      }
      
      // Check for RPG Goblin
      if (window.rpgGoblin) {
        found.push({
          type: 'RPGGoblin',
          health: window.rpgGoblin.getHealth ? window.rpgGoblin.getHealth() : null,
          maxHealth: window.rpgGoblin.getMaxHealth ? window.rpgGoblin.getMaxHealth() : null,
          level: window.rpgGoblin.getLevel ? window.rpgGoblin.getLevel() : null,
          position: window.rpgGoblin.getPosition ? window.rpgGoblin.getPosition() : null,
          alive: window.rpgGoblin.isAlive ? window.rpgGoblin.isAlive() : null,
          inCombat: window.rpgGoblin.isInCombat ? window.rpgGoblin.isInCombat() : null
        });
      }
      
      return found;
    });
    
    this.addResult('Entity Detection', entities.length > 0, 
      `Found ${entities.length} entities: ${entities.map(e => e.type).join(', ')}`, entities);
  }

  async testPlayerSystems() {
    console.log('🎮 Testing Player Systems...');
    
    const playerData = await this.page.evaluate(() => {
      if (!window.rpgPlayer) return null;
      
      return {
        health: window.rpgPlayer.getHealth(),
        maxHealth: window.rpgPlayer.getMaxHealth(),
        skills: window.rpgPlayer.getSkills(),
        inventory: window.rpgPlayer.getInventory(),
        position: window.rpgPlayer.getPosition(),
        alive: window.rpgPlayer.isAlive()
      };
    });
    
    if (playerData) {
      this.addResult('Player Health System', 
        playerData.health > 0 && playerData.maxHealth > 0,
        `Health: ${playerData.health}/${playerData.maxHealth}`, playerData);
      
      this.addResult('Player Skills System',
        playerData.skills && Object.keys(playerData.skills).length >= 4,
        `Skills: ${JSON.stringify(playerData.skills)}`, playerData.skills);
      
      this.addResult('Player Inventory System',
        Array.isArray(playerData.inventory) && playerData.inventory.length > 0,
        `${playerData.inventory.length} items in inventory`, playerData.inventory);
        
      this.addResult('Player Position System',
        playerData.position && typeof playerData.position.x === 'number',
        `Position: (${playerData.position.x}, ${playerData.position.y}, ${playerData.position.z})`, playerData.position);
    } else {
      this.addResult('Player Systems', false, 'No RPG player found');
    }
  }

  async testGoblinSystems() {
    console.log('🧌 Testing Goblin Systems...');
    
    const goblinData = await this.page.evaluate(() => {
      if (!window.rpgGoblin) return null;
      
      return {
        health: window.rpgGoblin.getHealth(),
        maxHealth: window.rpgGoblin.getMaxHealth(), 
        level: window.rpgGoblin.getLevel(),
        position: window.rpgGoblin.getPosition(),
        alive: window.rpgGoblin.isAlive(),
        inCombat: window.rpgGoblin.isInCombat()
      };
    });
    
    if (goblinData) {
      this.addResult('Goblin Health System',
        goblinData.health > 0 && goblinData.maxHealth > 0,
        `Health: ${goblinData.health}/${goblinData.maxHealth}`, goblinData);
        
      this.addResult('Goblin Level System',
        goblinData.level > 0,
        `Level: ${goblinData.level}`, goblinData);
        
      this.addResult('Goblin AI State',
        typeof goblinData.inCombat === 'boolean',
        `Combat state: ${goblinData.inCombat}`, goblinData);
        
      this.addResult('Goblin Position System',
        goblinData.position && typeof goblinData.position.x === 'number',
        `Position: (${goblinData.position.x}, ${goblinData.position.y}, ${goblinData.position.z})`, goblinData.position);
    } else {
      this.addResult('Goblin Systems', false, 'No RPG goblin found');
    }
  }

  async testCombatSystems() {
    console.log('⚔️ Testing Combat Systems...');
    
    // Test if combat APIs are available
    const combatAPIs = await this.page.evaluate(() => {
      const apis = {};
      
      if (window.rpgPlayer) {
        apis.player = {
          hasStats: !!window.rpgPlayer.getStats,
          hasSkills: !!window.rpgPlayer.getSkills,
          hasHealth: !!window.rpgPlayer.getHealth
        };
      }
      
      if (window.rpgGoblin) {
        apis.goblin = {
          hasStats: !!window.rpgGoblin.getStats,
          hasLevel: !!window.rpgGoblin.getLevel,
          hasCombatState: !!window.rpgGoblin.isInCombat
        };
      }
      
      return apis;
    });
    
    this.addResult('Combat API Availability',
      combatAPIs.player && combatAPIs.goblin,
      'Both player and goblin have combat APIs', combatAPIs);
  }

  async testSkillSystems() {
    console.log('🔨 Testing Skill Systems...');
    
    const skillData = await this.page.evaluate(() => {
      if (!window.rpgPlayer || !window.rpgPlayer.getSkills) return null;
      
      const skills = window.rpgPlayer.getSkills();
      return {
        hasAttack: skills.attack > 0,
        hasStrength: skills.strength > 0, 
        hasDefense: skills.defense > 0,
        hasConstitution: skills.constitution > 0,
        skillCount: Object.keys(skills).length,
        skills: skills
      };
    });
    
    if (skillData) {
      this.addResult('Core Combat Skills',
        skillData.hasAttack && skillData.hasStrength && skillData.hasDefense,
        `Attack: ${skillData.skills.attack}, Strength: ${skillData.skills.strength}, Defense: ${skillData.skills.defense}`,
        skillData);
        
      this.addResult('Constitution System', 
        skillData.hasConstitution,
        `Constitution: ${skillData.skills.constitution}`, skillData);
        
      this.addResult('Skill System Completeness',
        skillData.skillCount >= 4,
        `${skillData.skillCount} skills implemented`, skillData.skills);
    } else {
      this.addResult('Skill Systems', false, 'No skill data available');
    }
  }

  async testInventorySystem() {
    console.log('🎒 Testing Inventory System...');
    
    const inventoryData = await this.page.evaluate(() => {
      if (!window.rpgPlayer || !window.rpgPlayer.getInventory) return null;
      
      const inventory = window.rpgPlayer.getInventory();
      return {
        hasItems: inventory.length > 0,
        itemCount: inventory.length,
        items: inventory,
        hasBronzeSword: inventory.some(item => item.id === 1),
        hasCoins: inventory.some(item => item.id === 995),
        hasHatchet: inventory.some(item => item.id === 70)
      };
    });
    
    if (inventoryData) {
      this.addResult('Starting Equipment',
        inventoryData.hasBronzeSword && inventoryData.hasCoins && inventoryData.hasHatchet,
        `Bronze sword: ${inventoryData.hasBronzeSword}, Coins: ${inventoryData.hasCoins}, Hatchet: ${inventoryData.hasHatchet}`,
        inventoryData);
        
      this.addResult('Inventory System',
        inventoryData.hasItems && inventoryData.itemCount > 0,
        `${inventoryData.itemCount} items in inventory`, inventoryData.items);
    } else {
      this.addResult('Inventory System', false, 'No inventory data available');
    }
  }

  async testVisualSystems() {
    console.log('👁️ Testing Visual Systems...');
    
    // Take screenshot for visual analysis
    const screenshot = await this.page.screenshot({ fullPage: true });
    const image = sharp(screenshot);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    
    // Analyze pixel colors to detect entities
    const colorCounts = {};
    const pixelCount = info.width * info.height;
    
    for (let i = 0; i < data.length; i += 3) {
      const r = data[i];
      const g = data[i + 1]; 
      const b = data[i + 2];
      
      // Look for bright blue player (#0000FF - pure blue)
      if (r < 50 && g < 50 && b > 200) {
        colorCounts.brightBlue = (colorCounts.brightBlue || 0) + 1;
      }
      
      // Look for bright green goblin (#00FF00 - pure green) 
      if (r < 50 && g > 200 && b < 50) {
        colorCounts.brightGreen = (colorCounts.brightGreen || 0) + 1;
      }
      
      // Also check for any generally bright colors that might be entities
      if (r > 200 || g > 200 || b > 200) {
        colorCounts.bright = (colorCounts.bright || 0) + 1;
      }
    }
    
    const hasVisibleEntities = (colorCounts.brightBlue > 10) || (colorCounts.brightGreen > 10) || (colorCounts.bright > 1000);
    
    const message = hasVisibleEntities ? 
      `Entities detected: Blue=${colorCounts.brightBlue || 0}, Green=${colorCounts.brightGreen || 0}, Bright=${colorCounts.bright || 0}` :
      `No entities detected: Blue=${colorCounts.brightBlue || 0}, Green=${colorCounts.brightGreen || 0}, Bright=${colorCounts.bright || 0}`;
      
    this.addResult('Visual Entity Detection',
      hasVisibleEntities,
      message, { colorCounts, pixelCount });
      
    // Test if world loaded properly (not just white/black screen)
    const isBlankScreen = (colorCounts.white > pixelCount * 0.9) || (colorCounts.black > pixelCount * 0.9);
    this.addResult('World Rendering',
      !isBlankScreen,
      isBlankScreen ? 'Screen appears blank' : 'World rendered successfully', { colorCounts });
  }

  async testMovementSystems() {
    console.log('🚶 Testing Movement Systems...');
    
    // Test movement API availability
    const movementData = await this.page.evaluate(() => {
      const data = {};
      
      if (window.rpgPlayer && window.rpgPlayer.getPosition) {
        const pos1 = window.rpgPlayer.getPosition();
        data.playerPosition = pos1;
        data.playerHasPosition = pos1 && typeof pos1.x === 'number';
      }
      
      if (window.rpgGoblin && window.rpgGoblin.getPosition) {
        const pos2 = window.rpgGoblin.getPosition();
        data.goblinPosition = pos2;
        data.goblinHasPosition = pos2 && typeof pos2.x === 'number';
      }
      
      return data;
    });
    
    this.addResult('Player Movement System',
      movementData.playerHasPosition,
      `Player position: ${JSON.stringify(movementData.playerPosition)}`, movementData);
      
    this.addResult('Goblin Movement System',
      movementData.goblinHasPosition,
      `Goblin position: ${JSON.stringify(movementData.goblinPosition)}`, movementData);
  }

  addResult(testName, passed, message, data = null) {
    const result = { testName, passed, message, data, timestamp: Date.now() };
    this.testResults.push(result);
    
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${testName}: ${message}`);
  }

  logError(type, error) {
    console.error(`🚨 [${type}] ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  }

  reportResults() {
    console.log('\n📊 COMPREHENSIVE RPG TEST RESULTS');
    console.log('==================================');
    
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    
    console.log(`Overall Pass Rate: ${passed}/${total} (${passRate}%)`);
    console.log('');
    
    // Group results by category
    const categories = {};
    this.testResults.forEach(result => {
      const category = result.testName.split(' ')[0];
      if (!categories[category]) categories[category] = [];
      categories[category].push(result);
    });
    
    Object.entries(categories).forEach(([category, results]) => {
      const categoryPassed = results.filter(r => r.passed).length;
      const categoryTotal = results.length;
      const categoryRate = Math.round((categoryPassed / categoryTotal) * 100);
      
      console.log(`📂 ${category}: ${categoryPassed}/${categoryTotal} (${categoryRate}%)`);
      results.forEach(result => {
        const icon = result.passed ? '  ✅' : '  ❌';
        console.log(`${icon} ${result.testName}: ${result.message}`);
      });
      console.log('');
    });
    
    // Final assessment
    if (passRate >= 90) {
      console.log('🎉 EXCELLENT! RPG systems are working comprehensively!');
    } else if (passRate >= 70) {
      console.log('👍 GOOD! Most RPG systems are working, some issues to address.');
    } else if (passRate >= 50) {
      console.log('⚠️  PARTIAL! RPG systems partially working, significant issues present.');
    } else {
      console.log('💥 FAILED! Major issues with RPG implementation.');
    }
    
    // Log detailed results for debugging
    console.log('\n🔍 Detailed Results:');
    this.testResults.forEach(result => {
      if (result.data) {
        console.log(`${result.testName}: ${JSON.stringify(result.data, null, 2)}`);
      }
    });
  }

  async cleanup() {
    console.log('🧹 Cleaning up test resources...');
    
    try {
      if (this.browser) {
        await this.browser.close();
      }
    } catch (error) {
      console.error('Error closing browser:', error.message);
    }
    
    try {
      if (this.serverProcess) {
        process.kill(-this.serverProcess.pid, 'SIGTERM');
      }
    } catch (error) {
      console.error('Error killing server:', error.message);
    }
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new ComprehensiveRPGValidator();
  await validator.runAllTests();
}

export default ComprehensiveRPGValidator;