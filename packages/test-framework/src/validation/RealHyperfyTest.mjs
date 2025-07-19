// RealHyperfyTest.mjs - Test the real Hyperfy server with visual validation
import { spawn } from 'child_process';
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// TEST_COLORS constant matching our visual testing system
const TEST_COLORS = {
  PLAYER: '#0000FF',      // Blue
  GOBLIN: '#00FF00',      // Green  
  LOOT: '#FFD700',        // Gold
  BANDIT: '#FFA500',      // Orange
  TREE: '#8B4513',        // Brown
  FISH: '#00FFFF',        // Cyan
  FIRE: '#FF4500',        // Red-orange
  DEAD: '#FF0000'         // Red
};

class RealHyperfyTest {
  constructor() {
    this.serverProcess = null;
    this.browser = null;
    this.page = null;
    this.testResults = [];
  }

  async startServer(worldFile, port = 3001) {
    console.log(`🚀 Starting Hyperfy server with world: ${worldFile}`);
    
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('npm', ['start', '--', 
        `--world=${worldFile}`,
        `--port=${port}`, 
        '--headless'
      ], {
        cwd: '/Users/shawwalters/hyperscape/packages/hyperfy',
        env: { ...process.env }
      });

      let serverReady = false;
      
      this.serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('[Server]', output.trim());
        
        if (output.includes('running on port')) {
          console.log('✅ Server is ready');
          serverReady = true;
          resolve();
        }
        
        if (output.includes('script crashed')) {
          console.log('❌ Script crashed detected');
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        console.log('[Server Error]', data.toString().trim());
      });

      this.serverProcess.on('close', (code) => {
        if (!serverReady && code !== 0) {
          reject(new Error(`Server process exited with code ${code}`));
        }
      });

      // Timeout after 15 seconds
      setTimeout(() => {
        if (!serverReady) {
          reject(new Error('Server startup timeout'));
        }
      }, 15000);
    });
  }

  async stopServer() {
    if (this.serverProcess) {
      console.log('🛑 Stopping Hyperfy server...');
      this.serverProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });
      
      this.serverProcess = null;
    }
  }

  async startBrowser() {
    console.log('🌐 Starting browser...');
    this.browser = await chromium.launch({ 
      headless: false,  // Keep visible for debugging
      args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
    });
    
    this.page = await this.browser.newPage();
    
    // Set up viewport for consistent screenshots
    await this.page.setViewportSize({ width: 1920, height: 1080 });
    
    // Log browser console for debugging
    this.page.on('console', (msg) => {
      console.log('[Browser]', msg.text());
    });
    
    this.page.on('pageerror', (error) => {
      console.log('[Browser Error]', error.message);
    });
  }

  async stopBrowser() {
    if (this.browser) {
      console.log('🔄 Closing browser...');
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  async navigateToWorld(port = 3001) {
    console.log(`🏠 Navigating to world at localhost:${port}`);
    await this.page.goto(`http://localhost:${port}`, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Wait for world to load
    console.log('⏳ Waiting for world to load...');
    await this.page.waitForTimeout(5000);
  }

  async takeScreenshot(filename) {
    const screenshotPath = join(__dirname, '../../../screenshots', filename);
    await this.page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);
    return screenshotPath;
  }

  async analyzePixels(imagePath, expectedEntities = []) {
    console.log(`🔍 Analyzing pixels in: ${imagePath}`);
    
    const image = sharp(imagePath);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    
    // Count pixels by color
    const colorCounts = {};
    const totalPixels = info.width * info.height;
    
    for (let i = 0; i < data.length; i += 3) {
      const r = data[i];
      const g = data[i + 1]; 
      const b = data[i + 2];
      
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
      colorCounts[hex] = (colorCounts[hex] || 0) + 1;
    }
    
    // Find TEST_COLORS in the image
    const foundEntities = [];
    for (const [entityType, color] of Object.entries(TEST_COLORS)) {
      const count = colorCounts[color.toUpperCase()] || 0;
      if (count > 0) {
        foundEntities.push({ 
          type: entityType, 
          color, 
          pixelCount: count,
          percentage: (count / totalPixels * 100).toFixed(4)
        });
        console.log(`✅ Found ${entityType} (${color}): ${count} pixels (${(count / totalPixels * 100).toFixed(4)}%)`);
      }
    }
    
    // Validate expected entities
    const results = {
      found: foundEntities,
      missing: [],
      unexpected: [],
      totalPixels,
      passed: true
    };
    
    for (const expected of expectedEntities) {
      const found = foundEntities.find(e => e.type === expected.type);
      if (!found) {
        results.missing.push(expected);
        results.passed = false;
        console.log(`❌ Missing expected entity: ${expected.type} (${expected.color})`);
      } else if (expected.minPixels && found.pixelCount < expected.minPixels) {
        console.log(`⚠️ ${expected.type} has fewer pixels than expected: ${found.pixelCount} < ${expected.minPixels}`);
      }
    }
    
    return results;
  }

  async testCombatScenario() {
    console.log('⚔️ Testing Combat Scenario...');
    
    try {
      // Start server with combat test world
      await this.startServer('src/world/collections/default/CombatTestWorld.hyp');
      await this.startBrowser();
      await this.navigateToWorld();
      
      // Take initial screenshot
      const initialScreenshot = await this.takeScreenshot('combat-initial.png');
      
      // Analyze initial state - should show player and goblin
      const initialResults = await this.analyzePixels(initialScreenshot, [
        { type: 'PLAYER', color: TEST_COLORS.PLAYER, minPixels: 100 },
        { type: 'GOBLIN', color: TEST_COLORS.GOBLIN, minPixels: 100 }
      ]);
      
      console.log('📊 Initial state analysis:', initialResults);
      
      // Wait for combat to complete (combat starts after 2 seconds, lasts ~10 seconds)
      console.log('⏳ Waiting for combat sequence to complete...');
      await this.page.waitForTimeout(15000);
      
      // Take final screenshot
      const finalScreenshot = await this.takeScreenshot('combat-final.png');
      
      // Analyze final state - goblin should be dead (red) and loot should appear (gold)
      const finalResults = await this.analyzePixels(finalScreenshot, [
        { type: 'PLAYER', color: TEST_COLORS.PLAYER, minPixels: 100 },
        { type: 'LOOT', color: TEST_COLORS.LOOT, minPixels: 10 }
      ]);
      
      console.log('📊 Final state analysis:', finalResults);
      
      // Evaluate test success
      const success = initialResults.passed && finalResults.passed && 
                     finalResults.found.some(e => e.type === 'LOOT');
      
      this.testResults.push({
        test: 'Combat Scenario',
        success,
        initialState: initialResults,
        finalState: finalResults,
        screenshots: [initialScreenshot, finalScreenshot]
      });
      
      console.log(success ? '✅ Combat test PASSED' : '❌ Combat test FAILED');
      
      return success;
      
    } catch (error) {
      console.error('💥 Combat test error:', error);
      this.testResults.push({
        test: 'Combat Scenario',
        success: false,
        error: error.message
      });
      return false;
    } finally {
      await this.stopBrowser();
      await this.stopServer();
    }
  }

  async testBasicRendering() {
    console.log('🎨 Testing Basic Rendering...');
    
    try {
      await this.startServer('src/world/collections/default/VisualTestWorld.hyp');
      await this.startBrowser();
      await this.navigateToWorld();
      
      const screenshot = await this.takeScreenshot('basic-rendering.png');
      
      const results = await this.analyzePixels(screenshot, [
        { type: 'PLAYER', color: TEST_COLORS.PLAYER, minPixels: 50 },
        { type: 'GOBLIN', color: TEST_COLORS.GOBLIN, minPixels: 50 }
      ]);
      
      console.log('📊 Basic rendering analysis:', results);
      
      const success = results.passed;
      
      this.testResults.push({
        test: 'Basic Rendering',
        success,
        results,
        screenshot
      });
      
      console.log(success ? '✅ Basic rendering test PASSED' : '❌ Basic rendering test FAILED');
      
      return success;
      
    } catch (error) {
      console.error('💥 Basic rendering test error:', error);
      this.testResults.push({
        test: 'Basic Rendering', 
        success: false,
        error: error.message
      });
      return false;
    } finally {
      await this.stopBrowser();
      await this.stopServer();
    }
  }

  async runAllTests() {
    console.log('🧪 Starting comprehensive Hyperfy visual tests...');
    
    // Ensure screenshots directory exists
    await fs.mkdir(join(__dirname, '../../../screenshots'), { recursive: true });
    
    const tests = [
      () => this.testBasicRendering(),
      () => this.testCombatScenario()
    ];
    
    let passCount = 0;
    let totalTests = tests.length;
    
    for (const test of tests) {
      try {
        const passed = await test();
        if (passed) passCount++;
      } catch (error) {
        console.error('🔥 Test suite error:', error);
      }
      
      // Clean break between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Generate final report
    const report = {
      timestamp: new Date().toISOString(),
      totalTests,
      passedTests: passCount,
      failedTests: totalTests - passCount,
      successRate: (passCount / totalTests * 100).toFixed(2) + '%',
      results: this.testResults
    };
    
    const reportPath = join(__dirname, '../../../test-results', 'hyperfy-visual-test-report.json');
    await fs.mkdir(join(__dirname, '../../../test-results'), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n' + '='.repeat(50));
    console.log('📋 FINAL TEST REPORT');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passCount}`);
    console.log(`Failed: ${totalTests - passCount}`);
    console.log(`Success Rate: ${report.successRate}`);
    console.log(`Report saved: ${reportPath}`);
    console.log('='.repeat(50) + '\n');
    
    return report;
  }
}

// Run tests if called directly
if (process.argv[1] === __filename) {
  const tester = new RealHyperfyTest();
  tester.runAllTests()
    .then((report) => {
      process.exit(report.failedTests === 0 ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Test runner failed:', error);
      process.exit(1);
    });
}

export default RealHyperfyTest;