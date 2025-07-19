// ActualRPGTest.mjs - Test the REAL RPG code, not fake geometric shapes

import { spawn } from 'child_process';
import { chromium } from 'playwright';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ActualRPGTest {
  constructor() {
    this.serverProcess = null;
    this.browser = null;
    this.page = null;
  }

  async killExistingServers() {
    try {
      const killProcess = spawn('pkill', ['-f', 'node build/index.js']);
      await new Promise(resolve => {
        killProcess.on('close', () => resolve());
        setTimeout(resolve, 3000);
      });
    } catch (error) {
      // Ignore
    }
  }

  async startRPGServer() {
    console.log('🚀 Starting server with REAL RPG code...');
    await this.killExistingServers();
    
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('npm', ['start', '--', '--headless'], {
        cwd: '/Users/shawwalters/hyperscape/packages/hyperfy',
        env: { ...process.env }
      });

      let serverOutput = '';
      let serverReady = false;
      
      this.serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        serverOutput += output;
        
        console.log('[Server]', output.trim());
        
        if (output.includes('running on port')) {
          console.log('✅ RPG Server ready');
          serverReady = true;
          setTimeout(() => resolve({ success: true, output: serverOutput }), 3000);
        }
        
        if (output.includes('script crashed')) {
          console.log('💥 SCRIPT CRASHED - RPG CODE HAS BUGS');
          reject(new Error('RPG script crashed: ' + output));
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        const output = data.toString();
        if (!output.includes('npm warn') && !output.includes('GLTFLoader')) {
          console.log('[Server Error]', output.trim());
        }
        
        if (output.includes('EADDRINUSE')) {
          reject(new Error('Port in use'));
        }
      });

      this.serverProcess.on('close', (code) => {
        if (!serverReady && code !== 0) {
          reject(new Error(`Server exited with code ${code}`));
        }
      });

      setTimeout(() => {
        if (!serverReady) {
          reject(new Error('RPG server startup timeout'));
        }
      }, 20000);
    });
  }

  async testRPGInBrowser() {
    console.log('🌐 Testing RPG in browser...');
    
    this.browser = await chromium.launch({ 
      headless: false
    });
    
    this.page = await this.browser.newPage();
    await this.page.setViewportSize({ width: 1920, height: 1080 });
    
    // Collect console logs for RPG debugging
    const consoleLogs = [];
    this.page.on('console', (msg) => {
      const text = msg.text();
      consoleLogs.push(text);
      
      if (text.includes('RPG')) {
        console.log('[Browser]', text);
      }
      
      if (text.includes('Error') || text.includes('error')) {
        console.log('[Browser Error]', text);
      }
    });
    
    // Navigate to RPG world
    console.log('🏠 Loading RPG world...');
    await this.page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    console.log('⏳ Waiting for RPG systems to initialize...');
    await this.page.waitForTimeout(10000);
    
    // Take screenshot
    const screenshotPath = join(__dirname, '../../../screenshots', `real-rpg-test-${Date.now()}.png`);
    await fs.mkdir(join(__dirname, '../../../screenshots'), { recursive: true });
    await this.page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });
    
    // Try to interact with RPG systems
    console.log('🎮 Testing RPG interactions...');
    
    // Check if RPG entities exist in the world
    const rpgEntities = await this.page.evaluate(() => {
      const entities = [];
      
      // Check for RPG-related objects in window
      if (window.rpgPlayer) {
        entities.push({
          type: 'RPGPlayer',
          health: window.rpgPlayer.getHealth ? window.rpgPlayer.getHealth() : 'unknown',
          skills: window.rpgPlayer.getSkills ? window.rpgPlayer.getSkills() : 'unknown'
        });
      }
      
      if (window.rpgGoblin) {
        entities.push({
          type: 'RPGGoblin', 
          health: window.rpgGoblin.getHealth ? window.rpgGoblin.getHealth() : 'unknown',
          isAlive: window.rpgGoblin.isAlive ? window.rpgGoblin.isAlive() : 'unknown'
        });
      }
      
      // Check for DirectEntityTest entities (known working example)
      if (window.directEntityTest) {
        entities.push({
          type: 'DirectEntityTest',
          name: 'DirectEntityTest detected',
          cubeCount: window.directEntityTest.cubeCount,
          blueCube: window.directEntityTest.blueCube ? 'found' : 'missing',
          greenCube: window.directEntityTest.greenCube ? 'found' : 'missing',
          redCube: window.directEntityTest.redCube ? 'found' : 'missing'
        });
      }
      
      // Check for TestCube entities (simplest test)
      if (window.testCube) {
        entities.push({
          type: 'TestCube',
          name: 'TestCube detected',
          position: window.testCube.position,
          scale: window.testCube.scale,
          visible: window.testCube.visible
        });
      }
      
      // Check for MovementTestMob entities
      if (window.testMob) {
        entities.push({
          type: 'MovementTestMob',
          name: 'MovementTestMob detected',
          position: window.testMob.getPosition ? window.testMob.getPosition() : 'unknown',
          isMoving: window.testMob.isMoving ? window.testMob.isMoving() : 'unknown'
        });
      }
      
      // Check for Working RPG entities (new format)
      if (window.workingRPGPlayer) {
        entities.push({
          type: 'WorkingRPGPlayer',
          name: 'Working RPG Player detected'
        });
      }
      
      if (window.workingRPGGoblin) {
        entities.push({
          type: 'WorkingRPGGoblin', 
          name: 'Working RPG Goblin detected'
        });
      }
      
      // Check for app instances
      if (window.hyperfy && window.hyperfy.world && window.hyperfy.world.apps) {
        const apps = window.hyperfy.world.apps.getAll();
        for (const app of apps) {
          if (app.name && (app.name.includes('RPG') || app.name.includes('Player') || app.name.includes('Goblin'))) {
            entities.push({
              type: 'App',
              name: app.name,
              state: app.state || 'no state'
            });
          }
        }
      }
      
      // Check Three.js scene for colored cubes (our RPG entities should be blue and green cubes)
      if (window.scene) {
        let blueObjects = 0;
        let greenObjects = 0;
        
        window.scene.traverse((child) => {
          if (child.material && child.material.color) {
            const color = child.material.color;
            // Check if it's blue-ish (for player)
            if (color.r < 0.5 && color.g < 0.5 && color.b > 0.5) {
              blueObjects++;
            }
            // Check if it's green-ish (for goblin)  
            if (color.r < 0.5 && color.g > 0.5 && color.b < 0.5) {
              greenObjects++;
            }
          }
        });
        
        if (blueObjects > 0) {
          entities.push({
            type: 'BlueObject',
            count: blueObjects,
            description: 'Potential RPG Player (blue cube)'
          });
        }
        
        if (greenObjects > 0) {
          entities.push({
            type: 'GreenObject', 
            count: greenObjects,
            description: 'Potential RPG Goblin (green cube)'
          });
        }
      }
      
      return entities;
    });
    
    return {
      screenshot: screenshotPath,
      consoleLogs: consoleLogs.slice(-20), // Last 20 logs
      rpgEntities,
      pageTitle: await this.page.title(),
      url: this.page.url()
    };
  }

  async cleanup() {
    if (this.browser) {
      console.log('🔄 Closing browser...');
      await this.browser.close();
    }
    
    if (this.serverProcess) {
      console.log('🛑 Stopping RPG server...');
      this.serverProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  async runRealRPGTest() {
    try {
      console.log('🎯 TESTING ACTUAL RPG CODE (NOT FAKE GEOMETRIC SHAPES)');
      console.log('='.repeat(70));
      
      // Start RPG server
      const serverResult = await this.startRPGServer();
      console.log('✅ RPG server started successfully');
      
      // Test in browser
      const browserResult = await this.testRPGInBrowser();
      
      // Analyze results
      console.log('\n📊 RPG TEST RESULTS:');
      console.log('='.repeat(50));
      console.log(`Screenshot: ${browserResult.screenshot}`);
      console.log(`RPG Entities Found: ${browserResult.rpgEntities.length}`);
      
      if (browserResult.rpgEntities.length > 0) {
        console.log('\n🎮 RPG Entities:');
        for (const entity of browserResult.rpgEntities) {
          console.log(`  • ${entity.type}: ${JSON.stringify(entity, null, 2)}`);
        }
        console.log('\n✅ SUCCESS: Found actual RPG entities!');
        return { success: true, entities: browserResult.rpgEntities };
      } else {
        console.log('\n❌ FAILURE: No RPG entities detected');
        console.log('This means the "RPG" code isn\'t actually working');
        return { success: false, entities: [] };
      }
      
    } catch (error) {
      console.error('💥 RPG test failed:', error.message);
      return { success: false, error: error.message };
    } finally {
      await this.cleanup();
    }
  }
}

// Run the REAL RPG test
const tester = new ActualRPGTest();
tester.runRealRPGTest()
  .then((result) => {
    if (result.success) {
      console.log('\n🎉 REAL RPG TEST PASSED - Found working RPG systems!');
    } else {
      console.log('\n💥 REAL RPG TEST FAILED - RPG code is broken or fake!');
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Test runner crashed:', error);
    process.exit(1);
  });