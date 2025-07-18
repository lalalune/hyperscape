import { test, expect } from '@playwright/test'

test.describe('RPG Asset Generation Viewer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should load the main viewer page', async ({ page }) => {
    await expect(page).toHaveTitle(/AI Creation Viewer/)
    await expect(page.locator('h2')).toContainText('Generate Asset')
  })

  test('should have all required form fields', async ({ page }) => {
    await expect(page.locator('#name')).toBeVisible()
    await expect(page.locator('#description')).toBeVisible()
    await expect(page.locator('#type')).toBeVisible()
    await expect(page.locator('#style')).toBeVisible()
  })

  test('should show subtype field when weapon is selected', async ({ page }) => {
    await page.selectOption('#type', 'weapon')
    await expect(page.locator('#subtypeGroup')).toBeVisible()
    await expect(page.locator('#subtype')).toBeVisible()
  })

  test('should show subtype field when armor is selected', async ({ page }) => {
    await page.selectOption('#type', 'armor')
    await expect(page.locator('#subtypeGroup')).toBeVisible()
    await expect(page.locator('#subtype')).toBeVisible()
  })

  test('should hide subtype field for other types', async ({ page }) => {
    await page.selectOption('#type', 'building')
    await expect(page.locator('#subtypeGroup')).not.toBeVisible()
  })

  test('should have functional generate button', async ({ page }) => {
    const generateBtn = page.locator('#generateBtn')
    await expect(generateBtn).toBeVisible()
    await expect(generateBtn).toBeEnabled()
  })

  test('should validate required fields', async ({ page }) => {
    const generateBtn = page.locator('#generateBtn')
    await generateBtn.click()
    
    // Should show HTML5 validation for required fields
    await expect(page.locator('#name:invalid')).toBeVisible()
    await expect(page.locator('#description:invalid')).toBeVisible()
  })

  test('should show status when generation starts', async ({ page }) => {
    await page.fill('#name', 'Test Sword')
    await page.fill('#description', 'A test sword for validation')
    await page.selectOption('#type', 'weapon')
    await page.selectOption('#subtype', 'sword')
    
    // Mock the API response to avoid actual generation
    await page.route('/api/generate', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-123',
          request: {
            name: 'Test Sword',
            description: 'A test sword for validation',
            type: 'weapon',
            subtype: 'sword'
          },
          stages: [
            { stage: 'image', status: 'completed', timestamp: new Date() },
            { stage: 'model', status: 'completed', timestamp: new Date() }
          ],
          finalAsset: {
            modelUrl: '/test-model.glb',
            metadata: {}
          }
        })
      })
    })
    
    await page.locator('#generateBtn').click()
    
    // Should show generation status
    await expect(page.locator('#status')).toBeVisible()
    await expect(page.locator('#statusMessage')).toContainText('Initializing')
  })

  test('should handle API errors gracefully', async ({ page }) => {
    await page.fill('#name', 'Test Sword')
    await page.fill('#description', 'A test sword for validation')
    
    // Mock API error
    await page.route('/api/generate', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'API key not configured'
        })
      })
    })
    
    await page.locator('#generateBtn').click()
    
    // Should show error message
    await expect(page.locator('#error')).toBeVisible()
    await expect(page.locator('#error')).toContainText('API key not configured')
  })
})

test.describe('RPG Viewer Interface', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rpg-viewer.html')
  })

  test('should load the RPG viewer page', async ({ page }) => {
    await expect(page).toHaveTitle(/Hyperscape RPG Asset Generation Viewer/)
    await expect(page.locator('h1')).toContainText('Hyperscape RPG Asset Generation Viewer')
  })

  test('should have all tabs', async ({ page }) => {
    await expect(page.locator('.tab')).toHaveCount(4)
    await expect(page.locator('.tab').nth(0)).toContainText('Single Generation')
    await expect(page.locator('.tab').nth(1)).toContainText('Batch Generation')
    await expect(page.locator('.tab').nth(2)).toContainText('Validation')
    await expect(page.locator('.tab').nth(3)).toContainText('Review')
  })

  test('should switch between tabs', async ({ page }) => {
    // Single tab should be active by default
    await expect(page.locator('#single')).toBeVisible()
    await expect(page.locator('#batch')).not.toBeVisible()
    
    // Click batch tab
    await page.locator('.tab').nth(1).click()
    await expect(page.locator('#batch')).toBeVisible()
    await expect(page.locator('#single')).not.toBeVisible()
    
    // Click validation tab
    await page.locator('.tab').nth(2).click()
    await expect(page.locator('#validation')).toBeVisible()
    await expect(page.locator('#batch')).not.toBeVisible()
  })

  test('should have batch generation buttons', async ({ page }) => {
    await page.locator('.tab').nth(1).click()
    
    const expectedBatches = [
      'Generate Weapons',
      'Generate Armor', 
      'Generate Monsters',
      'Generate Tools',
      'Generate Resources',
      'Generate Buildings',
      'Generate Complete Set'
    ]
    
    for (const batch of expectedBatches) {
      await expect(page.locator('button').filter({ hasText: batch })).toBeVisible()
    }
  })

  test('should show batch progress', async ({ page }) => {
    await page.locator('.tab').nth(1).click()
    
    await expect(page.locator('.batch-progress')).toBeVisible()
    await expect(page.locator('#batch-progress-fill')).toBeVisible()
    await expect(page.locator('#batch-status')).toBeVisible()
  })

  test('should have validation test controls', async ({ page }) => {
    await page.locator('.tab').nth(2).click()
    
    await expect(page.locator('button').filter({ hasText: 'Run All Tests' })).toBeVisible()
    await expect(page.locator('button').filter({ hasText: 'Validate Latest' })).toBeVisible()
  })

  test('should have review interface', async ({ page }) => {
    await page.locator('.tab').nth(3).click()
    
    await expect(page.locator('#review-asset-id')).toBeVisible()
    await expect(page.locator('button').filter({ hasText: 'Load Review' })).toBeVisible()
  })

  test('should handle batch generation', async ({ page }) => {
    await page.locator('.tab').nth(1).click()
    
    // Mock batch API response
    await page.route('/api/batch/rpg', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: 5,
          results: [
            { id: 'weapon-1', request: { name: 'Bronze Sword' }, stages: [{ stage: 'final', status: 'completed' }] },
            { id: 'weapon-2', request: { name: 'Steel Sword' }, stages: [{ stage: 'final', status: 'completed' }] }
          ]
        })
      })
    })
    
    await page.locator('button').filter({ hasText: 'Generate Weapons' }).click()
    
    // Should show progress
    await expect(page.locator('#batch-status')).toContainText('Batch complete')
  })

  test('should handle validation tests', async ({ page }) => {
    await page.locator('.tab').nth(2).click()
    
    // Mock validation API response
    await page.route('/api/test/validation', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          passed: 3,
          failed: 1,
          results: [
            { scenario: 'Basic Sword Generation', passed: true, score: 95, errors: [], warnings: [] },
            { scenario: 'Basic Helmet Generation', passed: false, score: 60, errors: ['Polycount too high'], warnings: [] }
          ]
        })
      })
    })
    
    await page.locator('button').filter({ hasText: 'Run All Tests' }).click()
    
    // Should show validation results
    await expect(page.locator('#validation-results')).toBeVisible()
    await expect(page.locator('#validation-content')).toContainText('Passed: 3')
    await expect(page.locator('#validation-content')).toContainText('Failed: 1')
  })

  test('should handle review loading', async ({ page }) => {
    await page.locator('.tab').nth(3).click()
    
    // Mock review API response
    await page.route('/api/review/test-123', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          checklist: [
            '□ Model loads correctly in 3D viewer',
            '□ Weapon grip position is correct'
          ],
          questions: [
            'Does this asset look like it belongs in a RuneScape-style RPG?',
            'Would players immediately understand what this item is?'
          ],
          assetType: 'weapon',
          assetName: 'Test Sword'
        })
      })
    })
    
    await page.fill('#review-asset-id', 'test-123')
    await page.locator('button').filter({ hasText: 'Load Review' }).click()
    
    // Should show review content
    await expect(page.locator('#review-content')).toBeVisible()
    await expect(page.locator('#review-checklist-items')).toContainText('Model loads correctly')
    await expect(page.locator('#review-questions')).toContainText('RuneScape-style RPG')
  })
})