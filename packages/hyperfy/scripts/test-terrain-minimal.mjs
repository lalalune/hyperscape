#!/usr/bin/env node

/**
 * Minimal Terrain Rendering Test
 * Tests if we can render basic terrain geometry to screen
 */

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

class MinimalTerrainTest {
    constructor() {
        this.browser = null;
        this.page = null;
        this.server = null;
    }

    async startServer() {
        console.log('🚀 Starting Hyperfy server...');
        
        this.server = spawn('node', ['src/server/index.ts'], {
            stdio: 'pipe',
            env: { ...process.env, NODE_ENV: 'test' }
        });

        // Wait for server to be ready
        await new Promise((resolve) => {
            const checkServer = () => {
                fetch('http://localhost:3333')
                    .then(() => resolve())
                    .catch(() => setTimeout(checkServer, 100));
            };
            checkServer();
        });

        console.log('✅ Server started');
    }

    async startBrowser() {
        console.log('🌐 Starting browser...');
        
        this.browser = await chromium.launch({ 
            headless: false,
            args: ['--disable-web-security', '--allow-running-insecure-content']
        });
        
        this.page = await this.browser.newPage();
        
        // Log browser console
        this.page.on('console', msg => {
            const text = msg.text();
            if (text.includes('UnifiedTerrain') || text.includes('mesh') || text.includes('THREE')) {
                console.log(`[Browser] ${text}`);
            }
        });

        this.page.on('pageerror', error => {
            console.error(`[Browser Error] ${error.message}`);
        });

        console.log('✅ Browser started');
    }

    async testTerrainRendering() {
        console.log('🧪 Testing terrain rendering...');

        // Navigate to the page
        await this.page.goto('http://localhost:3333');
        
        // Wait for world to initialize
        await this.page.waitForFunction(() => window.world !== undefined, { timeout: 10000 });
        
        console.log('🌍 World initialized');

        // Wait a bit for terrain to generate
        await this.page.waitForTimeout(3000);

        // Get terrain info
        const terrainInfo = await this.page.evaluate(() => {
            const scene = window.world?.stage?.scene;
            if (!scene) return { error: 'No scene' };

            const sceneChildren = scene.children.length;
            const meshes = scene.children.filter(child => child.type === 'Mesh');
            const lights = scene.children.filter(child => child.isLight);
            
            // Look for terrain specifically
            const terrainObjects = [];
            scene.traverse(obj => {
                if (obj.name && obj.name.includes('Terrain')) {
                    terrainObjects.push({
                        name: obj.name,
                        type: obj.type,
                        visible: obj.visible,
                        position: obj.position.toArray(),
                        hasGeometry: !!(obj.geometry),
                        hasMaterial: !!(obj.material),
                        vertexCount: obj.geometry?.attributes?.position?.count
                    });
                }
            });

            return {
                sceneChildren,
                meshCount: meshes.length,
                lightCount: lights.length,
                terrainObjects,
                camera: {
                    position: window.world.camera.position.toArray(),
                    rotation: window.world.camera.rotation.toArray()
                }
            };
        });

        console.log('🔍 Terrain analysis:', terrainInfo);

        // Take screenshot
        const timestamp = Date.now();
        const screenshotPath = `test-results/minimal-terrain-${timestamp}.png`;
        await this.page.screenshot({ 
            path: screenshotPath,
            fullPage: true 
        });
        
        console.log(`📸 Screenshot saved: ${screenshotPath}`);

        // Analyze if there's any visible content
        const hasVisibleContent = await this.page.evaluate(() => {
            const canvas = document.querySelector('canvas');
            if (!canvas) return false;

            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Check if any pixels are not black (rgba 0,0,0,255)
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] !== 0 || data[i + 1] !== 0 || data[i + 2] !== 0) {
                    return true;
                }
            }
            return false;
        });

        console.log(`👁️ Has visible content: ${hasVisibleContent}`);

        return {
            terrainInfo,
            hasVisibleContent,
            screenshot: screenshotPath
        };
    }

    async cleanup() {
        console.log('🧹 Cleaning up...');
        
        if (this.page) await this.page.close();
        if (this.browser) await this.browser.close();
        if (this.server) {
            this.server.kill();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('✅ Cleanup complete');
    }

    async run() {
        try {
            await this.startServer();
            await this.startBrowser();
            const result = await this.testTerrainRendering();
            
            console.log('\n📊 Test Results:');
            console.log('================');
            console.log(`Terrain objects found: ${result.terrainInfo.terrainObjects?.length || 0}`);
            console.log(`Scene meshes: ${result.terrainInfo.meshCount}`);
            console.log(`Scene lights: ${result.terrainInfo.lightCount}`);
            console.log(`Has visible content: ${result.hasVisibleContent}`);
            console.log(`Screenshot: ${result.screenshot}`);
            
            if (result.hasVisibleContent) {
                console.log('✅ SUCCESS: Content is visible!');
                return true;
            } else {
                console.log('❌ FAILURE: No visible content');
                return false;
            }
            
        } catch (error) {
            console.error('❌ Test failed:', error);
            return false;
        } finally {
            await this.cleanup();
        }
    }
}

// Run the test
const test = new MinimalTerrainTest();
const success = await test.run();
process.exit(success ? 0 : 1);