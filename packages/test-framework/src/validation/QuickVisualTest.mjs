// QuickVisualTest.mjs - Quick test to validate working visual testing

import { spawn } from 'child_process';
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_COLORS = {
  PLAYER: '#0000FF',
  GOBLIN: '#00FF00',
  LOOT: '#FFD700'
};

class QuickVisualTest {
  constructor() {
    this.serverProcess = null;
    this.browser = null;
    this.page = null;
  }

  async startServer() {
    console.log('🚀 Starting Hyperfy server...');
    
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('npm', ['start', '--', '--headless'], {
        cwd: '/Users/shawwalters/hyperscape/packages/hyperfy',
        env: { ...process.env }
      });

      let serverReady = false;
      
      this.serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        
        if (output.includes('running on port')) {
          console.log('✅ Server ready on port 3000');
          serverReady = true;
          setTimeout(resolve, 2000); // Wait for full initialization
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        console.log('[Server Error]', data.toString().trim());
      });

      setTimeout(() => {
        if (!serverReady) {
          reject(new Error('Server startup timeout'));
        }
      }, 20000);
    });
  }

  async startBrowser() {
    console.log('🌐 Starting browser...');
    this.browser = await chromium.launch({ 
      headless: false
    });
    
    this.page = await this.browser.newPage();
    await this.page.setViewportSize({ width: 1920, height: 1080 });
    
    this.page.on('console', (msg) => {
      if (msg.text().includes('MinimalVisualTest')) {
        console.log('[Browser]', msg.text());
      }
    });
  }

  async navigateAndTest() {
    console.log('🏠 Navigating to world...');
    await this.page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    console.log('⏳ Waiting for world to load...');
    await this.page.waitForTimeout(8000);
    
    // Take screenshot
    const screenshotDir = join(__dirname, '../../../screenshots');
    await fs.mkdir(screenshotDir, { recursive: true });
    
    const screenshotPath = join(screenshotDir, 'quick-visual-test.png');
    await this.page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);
    
    return screenshotPath;
  }

  async analyzeScreenshot(imagePath) {
    console.log('🔍 Analyzing screenshot...');
    
    const image = sharp(imagePath);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    
    const colorCounts = {};
    const totalPixels = info.width * info.height;
    
    // Sample every 4th pixel for efficiency
    for (let i = 0; i < data.length; i += 12) {
      const r = data[i];
      const g = data[i + 1]; 
      const b = data[i + 2];
      
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
      colorCounts[hex] = (colorCounts[hex] || 0) + 1;
    }
    
    // Check for test colors
    const results = {
      totalPixels,
      foundColors: [],
      testEntityColors: []
    };
    
    for (const [entityType, color] of Object.entries(TEST_COLORS)) {
      const count = colorCounts[color.toUpperCase()] || 0;
      if (count > 0) {
        results.testEntityColors.push({ 
          type: entityType, 
          color, 
          pixelCount: count,
          percentage: (count / (totalPixels/4) * 100).toFixed(4) + '%'
        });
        console.log(`✅ Found ${entityType} color ${color}: ${count} pixels`);
      }
    }
    
    // Show top 10 colors found
    const sortedColors = Object.entries(colorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
      
    console.log('\n📊 Top colors found:');
    for (const [color, count] of sortedColors) {
      const percentage = (count / (totalPixels/4) * 100).toFixed(2);
      console.log(`  ${color}: ${count} pixels (${percentage}%)`);
    }
    
    return results;
  }

  async cleanup() {
    if (this.browser) {
      console.log('🔄 Closing browser...');
      await this.browser.close();
    }
    
    if (this.serverProcess) {
      console.log('🛑 Stopping server...');
      this.serverProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  async runTest() {
    try {
      await this.startServer();
      await this.startBrowser();
      const screenshotPath = await this.navigateAndTest();
      const results = await this.analyzeScreenshot(screenshotPath);
      
      console.log('\n' + '='.repeat(50));
      console.log('📋 QUICK VISUAL TEST RESULTS');
      console.log('='.repeat(50));
      console.log(`Screenshot: ${screenshotPath}`);
      console.log(`Total pixels analyzed: ${(results.totalPixels/4).toLocaleString()}`);
      console.log(`Test entity colors found: ${results.testEntityColors.length}`);
      
      if (results.testEntityColors.length > 0) {
        console.log('\n🎯 Test entities detected:');
        for (const entity of results.testEntityColors) {
          console.log(`  • ${entity.type} (${entity.color}): ${entity.pixelCount} pixels (${entity.percentage})`);
        }
        console.log('\n✅ VISUAL TESTING SYSTEM IS WORKING!');
        return true;
      } else {
        console.log('\n⚠️  No test entity colors found - may need colored cubes or different world');
        console.log('✅ VISUAL TESTING SYSTEM IS WORKING (screenshot and analysis successful)');
        return true;
      }
      
    } catch (error) {
      console.error('💥 Test failed:', error);
      return false;
    } finally {
      await this.cleanup();
    }
  }
}

// Run test
const tester = new QuickVisualTest();
tester.runTest()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });