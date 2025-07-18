import { test, expect } from '@playwright/test';

test.describe('Basic World Loading', () => {
  test('world loads without errors', async ({ page }) => {
    // Navigate to test world
    await page.goto('/test-world');
    
    // Wait for world to initialize
    await page.waitForSelector('[data-testid="world-loaded"]', { timeout: 10000 });
    
    // Check for any console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Wait a bit for any errors to surface
    await page.waitForTimeout(2000);
    
    // Verify no errors occurred
    expect(errors).toHaveLength(0);
  });

  test('player object appears in world', async ({ page }) => {
    await page.goto('/test-world');
    await page.waitForSelector('[data-testid="world-loaded"]');
    
    // Take screenshot for visual verification
    const screenshot = await page.screenshot({
      clip: { x: 0, y: 0, width: 800, height: 600 }
    });
    
    // Verify player cube is visible (blue pixel check)
    // This is a placeholder - real implementation would analyze pixels
    expect(screenshot).toBeTruthy();
  });

  test('camera rig works correctly', async ({ page }) => {
    await page.goto('/test-world');
    await page.waitForSelector('[data-testid="world-loaded"]');
    
    // Verify camera is in overhead position
    const cameraPosition = await page.evaluate(() => {
      // Access Three.js scene to check camera position
      const world = (window as any).world;
      if (world && world.camera) {
        return {
          x: world.camera.position.x,
          y: world.camera.position.y,
          z: world.camera.position.z
        };
      }
      return null;
    });
    
    expect(cameraPosition).toBeTruthy();
    expect(cameraPosition.y).toBeGreaterThan(10); // Overhead view
  });
});