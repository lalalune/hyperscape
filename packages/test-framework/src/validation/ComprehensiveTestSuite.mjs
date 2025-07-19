// ComprehensiveTestSuite.mjs - Multiple test scenarios with proper port management

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

class ComprehensiveTestSuite {
  constructor() {
    this.testResults = [];
  }

  async killExistingServers() {
    console.log('🧹 Cleaning up any existing servers...');
    try {
      const { spawn } = await import('child_process');
      const killProcess = spawn('pkill', ['-f', 'node build/index.js']);
      await new Promise(resolve => {
        killProcess.on('close', () => resolve());
        setTimeout(resolve, 2000); // Timeout after 2 seconds
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      // Ignore errors - just cleanup
    }
  }

  async runGeometricTest() {
    console.log('\n🎯 TEST 1: Geometric Shape Detection');
    console.log('='.repeat(50));
    
    let serverProcess = null;
    let browser = null;
    
    try {
      // Start server
      console.log('🚀 Starting server for geometric test...');
      serverProcess = spawn('npm', ['start', '--', '--headless'], {
        cwd: '/Users/shawwalters/hyperscape/packages/hyperfy',
        env: { ...process.env }
      });

      const serverReady = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Server timeout')), 15000);
        
        serverProcess.stdout.on('data', (data) => {
          if (data.toString().includes('running on port')) {
            clearTimeout(timeout);
            resolve(true);
          }
        });
        
        serverProcess.on('close', (code) => {
          clearTimeout(timeout);
          if (code !== 0) reject(new Error(`Server exited with code ${code}`));
        });
      });

      if (!serverReady) throw new Error('Server failed to start');
      
      // Wait for full initialization
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Start browser
      console.log('🌐 Starting browser...');
      browser = await chromium.launch({ headless: false });
      const page = await browser.newPage();
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      // Navigate and test
      console.log('🏠 Navigating to world...');
      await page.goto('http://localhost:3001', { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
      
      await page.waitForTimeout(8000);
      
      // Take screenshot
      const screenshotDir = join(__dirname, '../../../screenshots');
      await fs.mkdir(screenshotDir, { recursive: true });
      const screenshotPath = join(screenshotDir, `test-geometric-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      
      // Analyze
      const results = await this.analyzeGeometricShapes(screenshotPath);
      
      const success = results.detectedStructures.length >= 2;
      this.testResults.push({
        test: 'Geometric Shape Detection',
        success,
        screenshot: screenshotPath,
        structures: results.detectedStructures,
        details: `Detected ${results.detectedStructures.length} geometric structures`
      });
      
      console.log(`${success ? '✅' : '❌'} Geometric test: ${results.detectedStructures.length} structures detected`);
      
    } catch (error) {
      console.error('❌ Geometric test failed:', error.message);
      this.testResults.push({
        test: 'Geometric Shape Detection',
        success: false,
        error: error.message
      });
    } finally {
      if (browser) await browser.close();
      if (serverProcess) {
        serverProcess.kill('SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  async runBasicRenderingTest() {
    console.log('\n🎨 TEST 2: Basic World Rendering');
    console.log('='.repeat(50));
    
    let serverProcess = null;
    let browser = null;
    
    try {
      await this.killExistingServers();
      
      // Start server
      console.log('🚀 Starting server for rendering test...');
      serverProcess = spawn('npm', ['start', '--', '--headless'], {
        cwd: '/Users/shawwalters/hyperscape/packages/hyperfy',
        env: { ...process.env }
      });

      const serverReady = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Server timeout')), 15000);
        
        serverProcess.stdout.on('data', (data) => {
          if (data.toString().includes('running on port')) {
            clearTimeout(timeout);
            resolve(true);
          }
        });
      });

      if (!serverReady) throw new Error('Server failed to start');
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Start browser
      console.log('🌐 Starting browser...');
      browser = await chromium.launch({ headless: false });
      const page = await browser.newPage();
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      // Navigate
      console.log('🏠 Navigating to world...');
      await page.goto('http://localhost:3001', { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
      
      await page.waitForTimeout(6000);
      
      // Take screenshot
      const screenshotPath = join(__dirname, '../../../screenshots', `test-rendering-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      
      // Analyze image for basic rendering
      const results = await this.analyzeBasicRendering(screenshotPath);
      
      const success = results.hasContent && !results.isBlank;
      this.testResults.push({
        test: 'Basic World Rendering',
        success,
        screenshot: screenshotPath,
        details: `Content detected: ${results.hasContent}, Blank: ${results.isBlank}`
      });
      
      console.log(`${success ? '✅' : '❌'} Rendering test: Content=${results.hasContent}, Colors=${results.colorCount}`);
      
    } catch (error) {
      console.error('❌ Rendering test failed:', error.message);
      this.testResults.push({
        test: 'Basic World Rendering',
        success: false,
        error: error.message
      });
    } finally {
      if (browser) await browser.close();
      if (serverProcess) {
        serverProcess.kill('SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  async analyzeGeometricShapes(imagePath) {
    const image = sharp(imagePath);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    
    const width = info.width;
    const height = info.height;
    
    const detectedStructures = [];
    
    // Detect tall structures (left side)
    let tallPixels = 0;
    const leftX = Math.floor(width * 0.25);
    for (let y = 0; y < height; y++) {
      for (let x = leftX - 50; x < leftX + 50; x++) {
        if (x >= 0 && x < width) {
          const pixelIndex = (y * width + x) * 3;
          const r = data[pixelIndex];
          const g = data[pixelIndex + 1]; 
          const b = data[pixelIndex + 2];
          if (r < 200 || g < 200 || b < 200) tallPixels++;
        }
      }
    }
    
    // Detect wide structures (right side)
    let widePixels = 0;
    const rightX = Math.floor(width * 0.75);
    const groundY = Math.floor(height * 0.7);
    for (let y = groundY; y < height; y++) {
      for (let x = rightX - 100; x < rightX + 100; x++) {
        if (x >= 0 && x < width) {
          const pixelIndex = (y * width + x) * 3;
          const r = data[pixelIndex];
          const g = data[pixelIndex + 1]; 
          const b = data[pixelIndex + 2];
          if (r < 200 || g < 200 || b < 200) widePixels++;
        }
      }
    }
    
    // Detect elevated structures (center top)
    let elevatedPixels = 0;
    const centerX = Math.floor(width * 0.5);
    const upperY = Math.floor(height * 0.3);
    for (let y = 0; y < upperY; y++) {
      for (let x = centerX - 50; x < centerX + 50; x++) {
        if (x >= 0 && x < width) {
          const pixelIndex = (y * width + x) * 3;
          const r = data[pixelIndex];
          const g = data[pixelIndex + 1]; 
          const b = data[pixelIndex + 2];
          if (r < 200 || g < 200 || b < 200) elevatedPixels++;
        }
      }
    }
    
    if (tallPixels > 100) {
      detectedStructures.push({
        type: 'TALL_STRUCTURE',
        pixelCount: tallPixels,
        confidence: Math.min(tallPixels / 1000, 1.0)
      });
    }
    
    if (widePixels > 200) {
      detectedStructures.push({
        type: 'WIDE_STRUCTURE', 
        pixelCount: widePixels,
        confidence: Math.min(widePixels / 2000, 1.0)
      });
    }
    
    if (elevatedPixels > 50) {
      detectedStructures.push({
        type: 'ELEVATED_STRUCTURE',
        pixelCount: elevatedPixels,
        confidence: Math.min(elevatedPixels / 500, 1.0)
      });
    }
    
    return { detectedStructures };
  }

  async analyzeBasicRendering(imagePath) {
    const image = sharp(imagePath);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    
    const colorCounts = {};
    const totalPixels = info.width * info.height;
    
    // Sample pixels to check for content
    for (let i = 0; i < data.length; i += 12) {
      const r = data[i];
      const g = data[i + 1]; 
      const b = data[i + 2];
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
      colorCounts[hex] = (colorCounts[hex] || 0) + 1;
    }
    
    const colorCount = Object.keys(colorCounts).length;
    const hasContent = colorCount > 10; // More than just background
    
    // Check if image is mostly blank (single color)
    const sortedColors = Object.entries(colorCounts).sort(([,a], [,b]) => b - a);
    const dominantColorPercentage = sortedColors[0] ? (sortedColors[0][1] / (totalPixels/4) * 100) : 0;
    const isBlank = dominantColorPercentage > 90;
    
    return { hasContent, isBlank, colorCount, dominantColorPercentage };
  }

  async runAllTests() {
    console.log('🧪 COMPREHENSIVE HYPERFY VISUAL TEST SUITE');
    console.log('='.repeat(60));
    
    await this.killExistingServers();
    
    // Run tests in sequence
    await this.runGeometricTest();
    await new Promise(resolve => setTimeout(resolve, 3000)); // Pause between tests
    
    await this.runBasicRenderingTest();
    
    // Generate final report
    const passed = this.testResults.filter(r => r.success).length;
    const total = this.testResults.length;
    const successRate = total > 0 ? (passed / total * 100).toFixed(1) : '0';
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 FINAL TEST SUITE RESULTS');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${total - passed}`);
    console.log(`Success Rate: ${successRate}%`);
    console.log('');
    
    for (const result of this.testResults) {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.test}`);
      if (result.details) console.log(`      ${result.details}`);
      if (result.error) console.log(`      Error: ${result.error}`);
      if (result.screenshot) console.log(`      Screenshot: ${result.screenshot}`);
    }
    
    // Save report
    const report = {
      timestamp: new Date().toISOString(),
      totalTests: total,
      passedTests: passed,
      failedTests: total - passed,
      successRate: successRate + '%',
      results: this.testResults
    };
    
    const reportPath = join(__dirname, '../../../test-results', 'comprehensive-test-report.json');
    await fs.mkdir(join(__dirname, '../../../test-results'), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📄 Report saved: ${reportPath}`);
    console.log('='.repeat(60));
    
    return passed === total;
  }
}

// Run test suite
const suite = new ComprehensiveTestSuite();
suite.runAllTests()
  .then((success) => {
    console.log(success ? '\n🎉 ALL TESTS PASSED!' : '\n⚠️ Some tests failed');
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });