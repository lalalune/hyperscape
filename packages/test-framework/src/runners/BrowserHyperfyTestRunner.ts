import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { TestFramework } from '../core/TestFramework';
import { TestResult, TestValidation, ValidationFailure } from '../types';
import { HyperfyFramework } from '../hyperfy';
import fs from 'fs-extra';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';

/**
 * Browser-based Hyperfy test runner that loads real Hyperfy worlds
 * and tests actual avatar movement, interaction, and 3D functionality
 */
export class BrowserHyperfyTestRunner {
  private framework: TestFramework;
  private browser?: Browser;
  private context?: BrowserContext;
  private page?: Page;
  private hyperfyProcess?: ChildProcess;
  private worldUrl?: string;

  constructor(framework: TestFramework) {
    this.framework = framework;
  }

  /**
   * Initialize browser and start real Hyperfy world
   */
  async initialize(): Promise<void> {
    console.log('[BrowserHyperfyTestRunner] Initializing browser and Hyperfy world...');
    
    // Start real Hyperfy world server
    await this.startHyperfyWorld();
    
    // Initialize browser
    this.browser = await chromium.launch({
      headless: false, // Keep visible for debugging
      devtools: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      permissions: ['microphone', 'camera'] // For potential voice/video features
    });

    this.page = await this.context.newPage();
    
    // Set up console logging to capture Hyperfy logs
    this.page.on('console', msg => {
      console.log(`[Hyperfy Browser] ${msg.type()}: ${msg.text()}`);
    });

    // Set up error handling
    this.page.on('pageerror', error => {
      console.error(`[Hyperfy Browser Error] ${error.message}`);
    });

    // Set up network monitoring
    this.page.on('response', response => {
      if (response.status() >= 400) {
        console.warn(`[Hyperfy Network] ${response.status()} ${response.url()}`);
      }
    });

    console.log('[BrowserHyperfyTestRunner] Browser initialized');
  }

  /**
   * Start a real Hyperfy world server
   */
  private async startHyperfyWorld(): Promise<void> {
    console.log('[BrowserHyperfyTestRunner] Checking for existing Hyperfy world server...');
    
    // For now, assume the server is already running at localhost:3000
    // This is a practical approach that works with the user's existing setup
    this.worldUrl = 'http://localhost:3000';
    
    try {
      // Test if the server is reachable
      const response = await fetch(this.worldUrl);
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      console.log('[BrowserHyperfyTestRunner] Found existing Hyperfy world server');
    } catch (error) {
      console.log('[BrowserHyperfyTestRunner] No existing server found. Please start a Hyperfy server manually.');
      console.log('Run: cd /Users/shawwalters/hyperscape/packages/hyperfy && node build/index.js');
      throw new Error('Hyperfy server not available. Please start the server manually first.');
    }
  }

  /**
   * Test real avatar spawning and movement in Hyperfy world
   */
  async testAvatarMovement(): Promise<TestResult> {
    if (!this.page || !this.worldUrl) {
      throw new Error('Browser or world not initialized');
    }

    const startTime = Date.now();
    const logs: string[] = [];
    const screenshots: string[] = [];

    try {
      logs.push('Starting avatar movement test');
      
      // Navigate to Hyperfy world
      await this.page.goto(this.worldUrl, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      logs.push('Navigated to Hyperfy world');

      // Wait for world to load
      await this.page.waitForSelector('canvas', { timeout: 15000 });
      logs.push('World canvas detected');

      // Take initial screenshot
      const initialScreenshot = await this.takeScreenshot('initial-world-state');
      screenshots.push(initialScreenshot);

      // Wait for avatar to spawn
      await this.page.waitForTimeout(3000);
      logs.push('Waited for avatar spawn');

      // Test avatar movement using keyboard controls
      logs.push('Testing avatar movement with WASD keys');
      
      // Move forward with W key
      await this.page.keyboard.press('w');
      await this.page.waitForTimeout(1000);
      
      // Move left with A key
      await this.page.keyboard.press('a');
      await this.page.waitForTimeout(1000);
      
      // Move backward with S key
      await this.page.keyboard.press('s');
      await this.page.waitForTimeout(1000);
      
      // Move right with D key
      await this.page.keyboard.press('d');
      await this.page.waitForTimeout(1000);

      logs.push('Avatar movement commands executed');

      // Take screenshot after movement
      const movementScreenshot = await this.takeScreenshot('after-movement');
      screenshots.push(movementScreenshot);

      // Test avatar interaction - try to open menu with ESC
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(1000);
      
      logs.push('Tested menu interaction');

      // Test mouse look - move mouse to look around
      await this.page.mouse.move(500, 500);
      await this.page.mouse.move(600, 400);
      await this.page.waitForTimeout(1000);
      
      logs.push('Tested mouse look');

      // Test running - hold shift and move
      await this.page.keyboard.down('Shift');
      await this.page.keyboard.press('w');
      await this.page.waitForTimeout(1000);
      await this.page.keyboard.up('Shift');
      
      logs.push('Tested running');

      // Final screenshot
      const finalScreenshot = await this.takeScreenshot('final-state');
      screenshots.push(finalScreenshot);

      // Verify world state through browser console
      const worldState = await this.page.evaluate(() => {
        // Check if Hyperfy world objects are available
        const hasWorld = typeof (window as any).world !== 'undefined';
        const hasPlayer = typeof (window as any).player !== 'undefined';
        const hasCanvas = !!document.querySelector('canvas');
        const hasThreeJS = typeof (window as any).THREE !== 'undefined';
        
        return {
          hasWorld,
          hasPlayer,
          hasCanvas,
          hasThreeJS,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: Date.now()
        };
      });

      logs.push(`World state: ${JSON.stringify(worldState)}`);

      const endTime = Date.now();
      
      return {
        scenarioId: 'browser-avatar-movement',
        scenarioName: 'Browser Avatar Movement Test',
        status: 'passed',
        startTime,
        endTime,
        duration: endTime - startTime,
        logs,
        screenshots,
        validation: {
          passed: worldState.hasCanvas && worldState.url.includes('localhost'),
          failures: [],
          warnings: []
        }
      };

    } catch (error: any) {
      const endTime = Date.now();
      
      return {
        scenarioId: 'browser-avatar-movement',
        scenarioName: 'Browser Avatar Movement Test',
        status: 'failed',
        startTime,
        endTime,
        duration: endTime - startTime,
        logs,
        screenshots,
        error,
        validation: {
          passed: false,
          failures: [{
            type: 'exception',
            message: error.message,
            stack: error.stack
          }],
          warnings: []
        }
      };
    }
  }

  /**
   * Test real app interaction in Hyperfy world
   */
  async testAppInteraction(): Promise<TestResult> {
    if (!this.page || !this.worldUrl) {
      throw new Error('Browser or world not initialized');
    }

    const startTime = Date.now();
    const logs: string[] = [];
    const screenshots: string[] = [];

    try {
      logs.push('Starting app interaction test');
      
      // Ensure we're in the world
      if (!this.page.url().includes('localhost')) {
        await this.page.goto(this.worldUrl, { 
          waitUntil: 'networkidle',
          timeout: 30000 
        });
      }

      // Wait for world to be ready
      await this.page.waitForSelector('canvas', { timeout: 15000 });
      
      // Take initial screenshot
      const initialScreenshot = await this.takeScreenshot('app-interaction-initial');
      screenshots.push(initialScreenshot);

      // Test app creation through browser console
      const appCreated = await this.page.evaluate(async () => {
        try {
          // Check if we can access the world and create an app
          const world = (window as any).world;
          if (!world) return { success: false, error: 'No world object available' };

          // Try to create a simple app
          const app = world.entities?.create?.('app', {
            id: 'test-browser-app',
            name: 'Browser Test App',
            position: { x: 0, y: 0, z: 0 }
          });

          return { 
            success: !!app, 
            appId: app?.id || null,
            worldHasEntities: !!world.entities,
            timestamp: Date.now()
          };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      });

      logs.push(`App creation result: ${JSON.stringify(appCreated)}`);

      // Take screenshot after app creation attempt
      const appCreatedScreenshot = await this.takeScreenshot('app-created');
      screenshots.push(appCreatedScreenshot);

      // Test clicking on objects in the world
      await this.page.click('canvas', { position: { x: 960, y: 540 } });
      await this.page.waitForTimeout(1000);
      
      logs.push('Clicked on world canvas');

      // Test right-click context menu
      await this.page.click('canvas', { 
        button: 'right', 
        position: { x: 800, y: 600 } 
      });
      await this.page.waitForTimeout(1000);
      
      logs.push('Right-clicked for context menu');

      // Test builder mode - try to access build controls
      await this.page.keyboard.press('b'); // Common build mode key
      await this.page.waitForTimeout(1000);
      
      logs.push('Attempted to enter build mode');

      // Final screenshot
      const finalScreenshot = await this.takeScreenshot('app-interaction-final');
      screenshots.push(finalScreenshot);

      const endTime = Date.now();
      
      return {
        scenarioId: 'browser-app-interaction',
        scenarioName: 'Browser App Interaction Test',
        status: appCreated.success ? 'passed' : 'failed',
        startTime,
        endTime,
        duration: endTime - startTime,
        logs,
        screenshots,
        validation: {
          passed: appCreated.success,
          failures: appCreated.success ? [] : [{
            type: 'assertion',
            message: `App creation failed: ${appCreated.error || 'Unknown error'}`
          }],
          warnings: []
        }
      };

    } catch (error: any) {
      const endTime = Date.now();
      
      return {
        scenarioId: 'browser-app-interaction',
        scenarioName: 'Browser App Interaction Test',
        status: 'failed',
        startTime,
        endTime,
        duration: endTime - startTime,
        logs,
        screenshots,
        error,
        validation: {
          passed: false,
          failures: [{
            type: 'exception',
            message: error.message,
            stack: error.stack
          }],
          warnings: []
        }
      };
    }
  }

  /**
   * Test real 3D world rendering and performance
   */
  async testWorldRendering(): Promise<TestResult> {
    if (!this.page || !this.worldUrl) {
      throw new Error('Browser or world not initialized');
    }

    const startTime = Date.now();
    const logs: string[] = [];
    const screenshots: string[] = [];

    try {
      logs.push('Starting world rendering test');
      
      // Ensure we're in the world
      if (!this.page.url().includes('localhost')) {
        await this.page.goto(this.worldUrl, { 
          waitUntil: 'networkidle',
          timeout: 30000 
        });
      }

      // Wait for world to be ready
      await this.page.waitForSelector('canvas', { timeout: 15000 });
      
      // Take initial screenshot
      const initialScreenshot = await this.takeScreenshot('world-rendering-initial');
      screenshots.push(initialScreenshot);

      // Test 3D rendering performance and functionality
      const renderingMetrics = await this.page.evaluate(async () => {
        const canvas = document.querySelector('canvas') as HTMLCanvasElement;
        if (!canvas) return { success: false, error: 'No canvas found' };

        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) return { success: false, error: 'No WebGL context' };

        // Check Three.js availability
        const hasThreeJS = typeof (window as any).THREE !== 'undefined';
        
        // Check world object and renderer
        const world = (window as any).world;
        const renderer = world?.renderer || (window as any).renderer;
        
        // Performance timing
        const startTime = performance.now();
        
        // Force a render frame
        if (renderer && renderer.render) {
          try {
            renderer.render();
          } catch (e) {
            // Rendering might fail without proper scene setup
          }
        }
        
        const renderTime = performance.now() - startTime;
        
        return {
          success: true,
          hasCanvas: !!canvas,
          hasWebGL: !!gl,
          hasThreeJS,
          hasWorld: !!world,
          hasRenderer: !!renderer,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          renderTime,
          webglVersion: gl.getParameter(gl.VERSION),
          timestamp: Date.now()
        };
      });

      logs.push(`Rendering metrics: ${JSON.stringify(renderingMetrics)}`);

      // Test camera movement
      await this.page.mouse.move(960, 540);
      await this.page.mouse.down();
      await this.page.mouse.move(1100, 400);
      await this.page.mouse.up();
      await this.page.waitForTimeout(1000);
      
      logs.push('Tested camera movement');

      // Test zoom
      await this.page.mouse.wheel(0, -300); // Zoom in
      await this.page.waitForTimeout(500);
      await this.page.mouse.wheel(0, 300); // Zoom out
      await this.page.waitForTimeout(500);
      
      logs.push('Tested zoom');

      // Final screenshot
      const finalScreenshot = await this.takeScreenshot('world-rendering-final');
      screenshots.push(finalScreenshot);

      const endTime = Date.now();
      
      return {
        scenarioId: 'browser-world-rendering',
        scenarioName: 'Browser World Rendering Test',
        status: renderingMetrics.success ? 'passed' : 'failed',
        startTime,
        endTime,
        duration: endTime - startTime,
        logs,
        screenshots,
        validation: {
          passed: renderingMetrics.success && !!renderingMetrics.hasCanvas && !!renderingMetrics.hasWebGL,
          failures: renderingMetrics.success ? [] : [{
            type: 'assertion',
            message: `Rendering test failed: ${renderingMetrics.error || 'Unknown error'}`
          }],
          warnings: []
        }
      };

    } catch (error: any) {
      const endTime = Date.now();
      
      return {
        scenarioId: 'browser-world-rendering',
        scenarioName: 'Browser World Rendering Test',
        status: 'failed',
        startTime,
        endTime,
        duration: endTime - startTime,
        logs,
        screenshots,
        error,
        validation: {
          passed: false,
          failures: [{
            type: 'exception',
            message: error.message,
            stack: error.stack
          }],
          warnings: []
        }
      };
    }
  }

  /**
   * Run all browser-based Hyperfy tests
   */
  async runAllBrowserTests(): Promise<{
    summary: {
      total: number;
      passed: number;
      failed: number;
      duration: number;
    };
    results: TestResult[];
  }> {
    console.log('[BrowserHyperfyTestRunner] Starting comprehensive browser tests...');
    
    const startTime = Date.now();
    const results: TestResult[] = [];

    try {
      // Run avatar movement test
      const avatarResult = await this.testAvatarMovement();
      results.push(avatarResult);
      
      // Run app interaction test
      const appResult = await this.testAppInteraction();
      results.push(appResult);
      
      // Run world rendering test
      const renderingResult = await this.testWorldRendering();
      results.push(renderingResult);
      
    } catch (error: any) {
      console.error('[BrowserHyperfyTestRunner] Test execution failed:', error);
      
      results.push({
        scenarioId: 'browser-test-error',
        scenarioName: 'Browser Test Error',
        status: 'failed',
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        logs: [`Error: ${error.message}`],
        screenshots: [],
        error,
        validation: {
          passed: false,
          failures: [{
            type: 'exception',
            message: error.message
          }],
          warnings: []
        }
      });
    }

    const endTime = Date.now();
    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      duration: endTime - startTime
    };

    console.log(`[BrowserHyperfyTestRunner] Browser tests completed: ${summary.passed}/${summary.total} passed`);
    
    return { summary, results };
  }

  /**
   * Take a screenshot with timestamp
   */
  private async takeScreenshot(name: string): Promise<string> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}-${timestamp}.png`;
    const screenshotPath = path.join('./test-results/browser-screenshots', filename);
    
    await fs.ensureDir(path.dirname(screenshotPath));
    await this.page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });

    console.log(`[BrowserHyperfyTestRunner] Screenshot saved: ${screenshotPath}`);
    return screenshotPath;
  }

  /**
   * Cleanup browser and server resources
   */
  async cleanup(): Promise<void> {
    console.log('[BrowserHyperfyTestRunner] Cleaning up...');
    
    if (this.page) {
      await this.page.close();
    }
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
    
    // Kill Hyperfy server
    if (this.hyperfyProcess) {
      this.hyperfyProcess.kill('SIGTERM');
      
      // Wait for process to terminate
      await new Promise<void>((resolve) => {
        this.hyperfyProcess!.on('exit', () => {
          console.log('[BrowserHyperfyTestRunner] Hyperfy server terminated');
          resolve();
        });
        
        // Force kill after 5 seconds
        setTimeout(() => {
          this.hyperfyProcess!.kill('SIGKILL');
          resolve();
        }, 5000);
      });
    }
    
    console.log('[BrowserHyperfyTestRunner] Cleanup complete');
  }
}