import { TestFramework } from '../core/TestFramework';
import { VisualTestConfig, TestResult } from '../types';
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import fs from 'fs-extra';
import path from 'path';
import { HyperfyFramework, World, createServerWorld, WorldConfig } from '../hyperfy';

/**
 * Visual test runner using Playwright for browser automation
 */
export class PlaywrightVisualTestRunner {
  private framework: TestFramework;
  private browser?: Browser;
  private context?: BrowserContext;
  private page?: Page;

  constructor(framework: TestFramework) {
    this.framework = framework;
  }

  /**
   * Initialize the browser for visual testing
   */
  async initialize(config: VisualTestConfig = {}): Promise<void> {
    console.log('[PlaywrightVisualTestRunner] Initializing browser...');
    
    this.browser = await chromium.launch({
      headless: false, // Set to true for CI/CD
      devtools: false,
    });

    this.context = await this.browser.newContext({
      viewport: config.viewport || { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });

    this.page = await this.context.newPage();
    
    // Set up console logging
    this.page.on('console', msg => {
      console.log(`[Browser Console] ${msg.text()}`);
    });

    // Set up error handling
    this.page.on('pageerror', error => {
      console.error(`[Browser Error] ${error.message}`);
    });

    console.log('[PlaywrightVisualTestRunner] Browser initialized');
  }

  /**
   * Run visual tests on a Hyperfy world
   */
  async runWorldTest(worldConfig: any, testConfig: {
    name: string;
    description: string;
    timeout?: number;
    steps: Array<{
      name: string;
      action: 'screenshot' | 'wait' | 'click' | 'type' | 'evaluate';
      selector?: string;
      value?: any;
      timeout?: number;
    }>;
  }): Promise<TestResult> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    const startTime = Date.now();
    const logs: string[] = [];
    const screenshots: string[] = [];

    try {
      logs.push(`Starting visual test: ${testConfig.name}`);

      // Create a test world
      const world = await this.framework.getWorld();
      if (!world) {
        throw new Error('No world available for testing');
      }

      // Start the world server (this would need to be implemented)
      // For now, we'll assume there's a way to get a URL to the running world
      const worldUrl = await this.getWorldUrl(worldConfig);
      
      // Navigate to the world
      await this.page.goto(worldUrl, { 
        waitUntil: 'networkidle',
        timeout: testConfig.timeout || 30000 
      });

      logs.push(`Navigated to world: ${worldUrl}`);

      // Execute test steps
      for (const step of testConfig.steps) {
        logs.push(`Executing step: ${step.name}`);
        
        switch (step.action) {
          case 'screenshot': {
            const screenshotPath = await this.takeScreenshot(step.name);
            screenshots.push(screenshotPath);
            break;
          }
            
          case 'wait':
            await this.page.waitForTimeout(step.value || 1000);
            break;
            
          case 'click':
            if (step.selector) {
              await this.page.click(step.selector, { 
                timeout: step.timeout || 5000 
              });
            }
            break;
            
          case 'type':
            if (step.selector && step.value) {
              await this.page.fill(step.selector, step.value);
            }
            break;
            
          case 'evaluate':
            if (step.value) {
              const result = await this.page.evaluate(step.value);
              logs.push(`Evaluation result: ${JSON.stringify(result)}`);
            }
            break;
        }
      }

      const endTime = Date.now();
      
      return {
        scenarioId: testConfig.name,
        scenarioName: testConfig.name,
        status: 'passed',
        startTime,
        endTime,
        duration: endTime - startTime,
        logs,
        screenshots,
        validation: {
          passed: true,
          failures: [],
          warnings: []
        }
      };

    } catch (error: any) {
      const endTime = Date.now();
      
      return {
        scenarioId: testConfig.name,
        scenarioName: testConfig.name,
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
   * Take a screenshot and save it
   */
  async takeScreenshot(name: string): Promise<string> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}-${timestamp}.png`;
    const screenshotPath = path.join('./test-results/screenshots', filename);
    
    await fs.ensureDir(path.dirname(screenshotPath));
    await this.page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });

    console.log(`[PlaywrightVisualTestRunner] Screenshot saved: ${screenshotPath}`);
    return screenshotPath;
  }

  /**
   * Analyze pixels in a screenshot for specific colors
   */
  async analyzeScreenshotColors(screenshotPath: string, expectedColors: Array<{
    color: string;
    tolerance?: number;
    minPixels?: number;
    description: string;
  }>): Promise<{
    passed: boolean;
    analysis: Array<{
      color: string;
      found: boolean;
      pixelCount: number;
      averagePosition?: { x: number; y: number };
      description: string;
    }>;
  }> {
    if (!fs.existsSync(screenshotPath)) {
      throw new Error(`Screenshot not found: ${screenshotPath}`);
    }

    // Use Playwright's page to analyze pixels in browser context
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    const results = await this.page.evaluate(async ({ screenshotPath, expectedColors }) => {
      // Load image and analyze pixels in browser
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const pixels = imageData.data;
          
          const analysis = expectedColors.map(expected => {
            const targetColor = hexToRgb(expected.color);
            const tolerance = expected.tolerance || 30;
            const minPixels = expected.minPixels || 100;
            
            let matchCount = 0;
            let totalX = 0;
            let totalY = 0;
            
            for (let i = 0; i < pixels.length; i += 4) {
              const r = pixels[i];
              const g = pixels[i + 1];
              const b = pixels[i + 2];
              const a = pixels[i + 3];
              
              if (a > 128) { // Only consider non-transparent pixels
                const distance = Math.sqrt(
                  Math.pow(r - targetColor.r, 2) +
                  Math.pow(g - targetColor.g, 2) +
                  Math.pow(b - targetColor.b, 2)
                );
                
                if (distance <= tolerance) {
                  matchCount++;
                  const pixelIndex = i / 4;
                  const x = pixelIndex % canvas.width;
                  const y = Math.floor(pixelIndex / canvas.width);
                  totalX += x;
                  totalY += y;
                }
              }
            }
            
            const averagePosition = matchCount > 0 ? {
              x: Math.round(totalX / matchCount),
              y: Math.round(totalY / matchCount)
            } : undefined;
            
            return {
              color: expected.color,
              found: matchCount >= minPixels,
              pixelCount: matchCount,
              averagePosition,
              description: expected.description
            };
          });
          
          const passed = analysis.every(result => result.found);
          resolve({ passed, analysis });
        };
        
        img.onerror = () => {
          resolve({
            passed: false,
            analysis: expectedColors.map(expected => ({
              color: expected.color,
              found: false,
              pixelCount: 0,
              description: expected.description + ' (image load failed)'
            }))
          });
        };
        
        img.src = 'file://' + screenshotPath;
      });
      
      function hexToRgb(hex: string) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
      }
    }, { screenshotPath, expectedColors });

    return results as any;
  }

  /**
   * Create a test world with specified configuration
   */
  async createTestWorld(config: {
    id: string;
    entities?: Array<{
      type: 'player' | 'mob' | 'item' | 'terrain';
      id: string;
      position: { x: number; y: number; z: number };
      color?: string; // For visual testing - will be rendered as colored cube
      properties?: any;
    }>;
    camera?: {
      type: 'overhead' | 'first-person' | 'third-person';
      position?: { x: number; y: number; z: number };
      target?: { x: number; y: number; z: number };
    };
  }): Promise<{ world: World; url: string }> {
    // Create a new Hyperfy world using the framework
    const framework = new HyperfyFramework();
    
    const worldConfig: WorldConfig = {
      id: config.id,
      name: `Test World ${config.id}`,
      type: 'server',
      persistence: {
        type: 'memory' // Use memory persistence for test worlds
      },
      assets: {
        baseUrl: '/test-assets'
      }
    };

    const world = await framework.createWorld(worldConfig);

    // Set up overhead camera for visual testing
    if (config.camera?.type === 'overhead') {
      await this.setupOverheadCamera(world, config.camera);
    }

    // Create test entities
    if (config.entities) {
      await this.createTestEntities(world, config.entities);
    }

    // Start the world server (this would need integration with Hyperfy's server)
    const port = 3000 + Math.floor(Math.random() * 1000); // Random port
    const url = `http://localhost:${port}`;
    
    // TODO: Actually start the Hyperfy server here
    // For now, we'll assume it's running
    
    return { world, url };
  }

  /**
   * Set up overhead camera for visual testing
   */
  private async setupOverheadCamera(world: World, cameraConfig: any): Promise<void> {
    // Set camera to overhead orthographic view
    const camera = (world as any).camera;
    if (camera) {
      camera.position.set(
        cameraConfig.position?.x || 0,
        cameraConfig.position?.y || 20,
        cameraConfig.position?.z || 0
      );
      
      camera.lookAt(
        cameraConfig.target?.x || 0,
        cameraConfig.target?.y || 0,
        cameraConfig.target?.z || 0
      );
      
      // Make it orthographic for consistent testing
      if ((camera as any).setOrthographic) {
        (camera as any).setOrthographic(true);
      }
    }
  }

  /**
   * Create test entities as colored cubes for visual verification
   */
  private async createTestEntities(world: World, entities: Array<{
    type: 'player' | 'mob' | 'item' | 'terrain';
    id: string;
    position: { x: number; y: number; z: number };
    color?: string;
    properties?: any;
  }>): Promise<void> {
    for (const entityConfig of entities) {
      // Create entity in the world
      // This would use Hyperfy's entity creation system
      const entity = (world as any).entities?.create?.(entityConfig.type, {
        id: entityConfig.id,
        position: entityConfig.position,
        ...entityConfig.properties
      });

      // Set visual representation as colored cube for testing
      if (entity && entityConfig.color) {
        await this.setEntityVisualProxy(entity, entityConfig.color);
      }
    }
  }

  /**
   * Set entity to render as a colored cube for visual testing
   */
  private async setEntityVisualProxy(entity: any, color: string): Promise<void> {
    // This would set the entity's mesh to a simple colored cube
    // for easy visual detection in tests
    if (entity.setMesh) {
      entity.setMesh('cube', { color });
    }
  }

  /**
   * Get world URL - creates and starts the world
   */
  private async getWorldUrl(worldConfig: any): Promise<string> {
    const { url } = await this.createTestWorld(worldConfig);
    return url;
  }

  /**
   * Cleanup browser resources
   */
  async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close();
    }
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
    
    console.log('[PlaywrightVisualTestRunner] Browser cleanup complete');
  }
}