# Visual Testing and 3D Verification

Visual testing in Asset Forge verifies that 3D assets render correctly using a combination of Three.js inspection, screenshot analysis, colored cube proxies, and AI-powered image verification with GPT-4o.

## Table of Contents

1. [Visual Testing Overview](#visual-testing-overview)
2. [Three.js Scene Inspection](#threejs-scene-inspection)
3. [Screenshot Analysis](#screenshot-analysis)
4. [Colored Cube Proxies](#colored-cube-proxies)
5. [LLM Verification with GPT-4o](#llm-verification-with-gpt-4o)
6. [Testing Patterns](#testing-patterns)
7. [Performance Testing](#performance-testing)

## Visual Testing Overview

### Why Visual Testing?

Data verification alone isn't enough for 3D applications. A character might have perfect position data (`{ x: 0, y: 1.8, z: 0 }`) but render invisibly due to:
- Missing materials
- Incorrect camera positioning
- Broken shaders
- Culling issues
- Transparent textures

Visual testing catches these issues by verifying actual rendered output.

### Testing Layers

| Layer | What It Tests | Method |
|-------|---------------|--------|
| **Scene Graph** | Object hierarchy and transforms | Three.js API inspection |
| **Pixel Data** | Color and transparency | Canvas getImageData() |
| **Visual Regression** | Appearance changes | Screenshot comparison |
| **Semantic Content** | "Does this look like a sword?" | GPT-4o Vision analysis |

## Three.js Scene Inspection

### Basic Scene Inspection

Direct inspection of Three.js scene structure:

```typescript
import { test, expect } from '@playwright/test'

test('weapon in scene hierarchy', async ({ page }) => {
  await page.goto('/testing/weapon-viewer')

  const sceneData = await page.evaluate(() => {
    const scene = window.scene as THREE.Scene

    // Find weapon in scene
    const weapon = scene.getObjectByName('bronze-sword')

    return {
      weaponExists: !!weapon,
      weaponType: weapon?.type,
      weaponVisible: weapon?.visible,
      weaponPosition: weapon?.position.toArray(),
      childCount: scene.children.length,
      materials: scene.children
        .filter(c => c.type === 'Mesh')
        .map(m => ({
          name: m.name,
          hasMaterial: !!(m as THREE.Mesh).material
        }))
    }
  })

  expect(sceneData.weaponExists).toBe(true)
  expect(sceneData.weaponVisible).toBe(true)
  expect(sceneData.weaponPosition[1]).toBeGreaterThan(0) // Above ground
  expect(sceneData.materials.every(m => m.hasMaterial)).toBe(true)
})
```

### Bone and Rigging Verification

```typescript
test('weapon attached to hand bone', async ({ page }) => {
  const rigData = await page.evaluate(() => {
    const character = window.scene.getObjectByName('character')
    const weapon = window.scene.getObjectByName('weapon')

    // Find right hand bone
    let rightHand: THREE.Bone | null = null
    character.traverse((node) => {
      if (node instanceof THREE.Bone && node.name.includes('Hand_R')) {
        rightHand = node
      }
    })

    // Check if weapon is child of hand or hand group
    const weaponInHand = rightHand?.children.some(child =>
      child === weapon || child.children.includes(weapon)
    )

    return {
      hasRightHand: !!rightHand,
      weaponAttached: weaponInHand,
      handPosition: rightHand?.position.toArray(),
      weaponWorldPosition: weapon?.getWorldPosition(new THREE.Vector3()).toArray()
    }
  })

  expect(rigData.hasRightHand).toBe(true)
  expect(rigData.weaponAttached).toBe(true)
})
```

### Material and Texture Verification

```typescript
test('materials loaded correctly', async ({ page }) => {
  const materialData = await page.evaluate(() => {
    const sword = window.scene.getObjectByName('steel-sword') as THREE.Mesh

    const material = sword.material as THREE.MeshStandardMaterial

    return {
      hasMaterial: !!material,
      materialType: material?.type,
      hasMap: !!material?.map,
      hasNormalMap: !!material?.normalMap,
      color: material?.color.getHex(),
      metalness: material?.metalness,
      roughness: material?.roughness
    }
  })

  expect(materialData.hasMaterial).toBe(true)
  expect(materialData.hasMap).toBe(true)
  expect(materialData.metalness).toBeGreaterThan(0.5) // Metallic for steel
})
```

## Screenshot Analysis

### Basic Screenshot Testing

Capture and analyze rendered output:

```typescript
test('character renders visibly', async ({ page }) => {
  await page.goto('/testing/character-view')
  await page.waitForSelector('#render-complete')

  // Capture screenshot
  const screenshot = await page.screenshot({
    clip: { x: 0, y: 0, width: 800, height: 600 }
  })

  // Analyze pixel data
  const analysis = await analyzeScreenshot(screenshot)

  expect(analysis.totalPixels).toBeGreaterThan(0)
  expect(analysis.nonTransparentPixels).toBeGreaterThan(10000) // Significant content
  expect(analysis.blackPixels).toBeLessThan(analysis.totalPixels * 0.95) // Not mostly black
})

// Helper function
async function analyzeScreenshot(buffer: Buffer) {
  const image = await loadImage(buffer)
  const canvas = createCanvas(image.width, image.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  let nonTransparentPixels = 0
  let blackPixels = 0

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha > 0) nonTransparentPixels++

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (r < 10 && g < 10 && b < 10) blackPixels++
  }

  return {
    totalPixels: data.length / 4,
    nonTransparentPixels,
    blackPixels
  }
}
```

### Visual Regression Testing

Compare screenshots against baseline:

```typescript
test('weapon appearance unchanged', async ({ page }) => {
  await page.goto('/testing/weapon-view/bronze-sword')

  const screenshot = await page.screenshot({
    clip: { x: 200, y: 200, width: 400, height: 400 }
  })

  // Compare with baseline (Playwright built-in)
  expect(screenshot).toMatchSnapshot('bronze-sword-baseline.png', {
    threshold: 0.02, // 2% difference allowed
    maxDiffPixels: 100
  })
})
```

### Color-Based Verification

Test for specific colors in render:

```typescript
test('steel sword has metallic appearance', async ({ page }) => {
  await page.goto('/testing/weapon-view/steel-sword')

  const colorAnalysis = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!
    const ctx = canvas.getContext('2d')!
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // Count silver/gray pixels (steel color)
    let silverPixels = 0
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i]
      const g = imageData.data[i + 1]
      const b = imageData.data[i + 2]

      // Silver is high R, G, B values that are similar
      const avg = (r + g + b) / 3
      const variance = Math.abs(r - avg) + Math.abs(g - avg) + Math.abs(b - avg)

      if (avg > 150 && variance < 30) {
        silverPixels++
      }
    }

    return {
      silverPixels,
      totalPixels: imageData.data.length / 4,
      silverPercentage: (silverPixels / (imageData.data.length / 4)) * 100
    }
  })

  // Steel sword should have >10% silver-colored pixels
  expect(colorAnalysis.silverPercentage).toBeGreaterThan(10)
})
```

## Colored Cube Proxies

### Proxy Color System

For rapid visual verification, Asset Forge uses colored cube proxies:

| Color | Entity Type | Hex Code |
|-------|-------------|----------|
| Red | Players | #FF0000 |
| Green | Goblins | #00FF00 |
| Blue | Items | #0000FF |
| Yellow | Trees | #FFFF00 |
| Purple | Banks | #FF00FF |
| Cyan | Stores | #00FFFF |

### Creating Proxy Scenes

```typescript
// Create test scene with proxies
function createProxyScene() {
  const scene = new THREE.Scene()

  // Player proxy (red cube)
  const playerProxy = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 1),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
  )
  playerProxy.position.set(0, 1, 0)
  playerProxy.name = 'player'
  scene.add(playerProxy)

  // Goblin proxy (green cube)
  const goblinProxy = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.5, 0.8),
    new THREE.MeshBasicMaterial({ color: 0x00ff00 })
  )
  goblinProxy.position.set(3, 0.75, 0)
  goblinProxy.name = 'goblin'
  scene.add(goblinProxy)

  // Item proxy (blue cube)
  const itemProxy = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.3, 0.3),
    new THREE.MeshBasicMaterial({ color: 0x0000ff })
  )
  itemProxy.position.set(1, 0.15, 1)
  itemProxy.name = 'item'
  scene.add(itemProxy)

  return scene
}
```

### Testing with Proxies

```typescript
test('combat positioning with proxies', async ({ page }) => {
  await page.goto('/testing/combat-proxies')

  // Wait for scene ready
  await page.waitForSelector('#scene-ready')

  // Take screenshot
  const screenshot = await page.screenshot()

  // Analyze colors
  const colors = await analyzeColors(screenshot)

  // Verify entities present
  expect(colors.red).toBeGreaterThan(1000) // Player visible
  expect(colors.green).toBeGreaterThan(800) // Goblin visible
  expect(colors.blue).toBeGreaterThan(100) // Item visible

  // Verify spatial relationship
  const positions = await page.evaluate(() => {
    const player = window.scene.getObjectByName('player')
    const goblin = window.scene.getObjectByName('goblin')

    return {
      distance: player.position.distanceTo(goblin.position)
    }
  })

  expect(positions.distance).toBeGreaterThan(2) // Not overlapping
  expect(positions.distance).toBeLessThan(5) // Close enough for combat
})
```

## LLM Verification with GPT-4o

### When to Use LLM Verification

Use GPT-4o Vision for semantic verification that's hard to encode:

- "Does this look like a realistic sword?"
- "Is the character's pose natural?"
- "Are textures applied correctly?"
- "Does the animation flow smoothly?"

### Basic LLM Verification

```typescript
test('weapon appearance validation with GPT-4o', async ({ page }) => {
  await page.goto('/testing/weapon-view/bronze-sword')

  // Capture screenshot
  const screenshot = await page.screenshot()
  const base64 = screenshot.toString('base64')
  const dataUrl = `data:image/png;base64,${base64}`

  // Send to GPT-4o Vision
  const analysis = await analyzeWithGPT4o(dataUrl, `
    Analyze this 3D weapon render. Answer these questions:
    1. Is this clearly a sword? (yes/no)
    2. Does it have a visible blade? (yes/no)
    3. Does it have a handle/grip? (yes/no)
    4. What material does it appear to be made of?
    5. Are there any rendering issues? (yes/no, describe if yes)

    Respond in JSON format.
  `)

  expect(analysis.isSword).toBe(true)
  expect(analysis.hasBlad).toBe(true)
  expect(analysis.hasHandle).toBe(true)
  expect(analysis.material.toLowerCase()).toContain('bronze')
  expect(analysis.renderingIssues).toBe(false)
})

async function analyzeWithGPT4o(imageUrl: string, prompt: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }],
      max_tokens: 500,
      response_format: { type: 'json_object' }
    })
  })

  const data = await response.json()
  return JSON.parse(data.choices[0].message.content)
}
```

### Animation Quality Verification

```typescript
test('walk animation appears natural', async ({ page }) => {
  await page.goto('/testing/animation-view/walk')

  // Capture multiple frames
  const frames: string[] = []
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(125) // 8 FPS capture
    const screenshot = await page.screenshot()
    frames.push(`data:image/png;base64,${screenshot.toString('base64')}`)
  }

  // Analyze animation with GPT-4o
  const analysis = await analyzeAnimationWithGPT4o(frames, `
    Analyze this walk animation sequence (8 frames).
    Evaluate:
    1. Does the character appear to be walking? (yes/no)
    2. Is the movement smooth? (yes/no)
    3. Are the legs moving naturally? (yes/no)
    4. Are there any obvious glitches or artifacts? (yes/no, describe)

    Respond in JSON format.
  `)

  expect(analysis.isWalking).toBe(true)
  expect(analysis.smoothMovement).toBe(true)
  expect(analysis.naturalLegs).toBe(true)
  expect(analysis.hasGlitches).toBe(false)
})
```

## Testing Patterns

### Pattern: Test Full Pipeline

Test complete workflows from generation to rendering:

```typescript
test('full asset pipeline', async ({ page }) => {
  // 1. Generate asset
  const pipelineId = await page.evaluate(async () => {
    return await startPipeline({
      name: 'Test Sword',
      type: 'weapon',
      subtype: 'sword'
    })
  })

  // 2. Wait for completion
  await page.waitForFunction(
    (id) => getPipelineStatus(id) === 'completed',
    pipelineId,
    { timeout: 120000 }
  )

  // 3. Load asset in viewer
  await page.goto(`/asset-viewer/${pipelineId}`)
  await page.waitForSelector('#model-loaded')

  // 4. Verify scene structure
  const sceneCheck = await page.evaluate(() => {
    const model = window.scene.getObjectByName('model')
    return {
      exists: !!model,
      hasMesh: model?.children.some(c => c.type === 'Mesh')
    }
  })
  expect(sceneCheck.exists).toBe(true)
  expect(sceneCheck.hasMesh).toBe(true)

  // 5. Verify visual appearance
  const screenshot = await page.screenshot()
  expect(screenshot).toMatchSnapshot('generated-sword.png')
})
```

### Pattern: Multi-Angle Verification

Test renders from multiple camera angles:

```typescript
test('asset visible from all angles', async ({ page }) => {
  await page.goto('/testing/multi-angle-view')

  const angles = [0, 90, 180, 270]
  const results = []

  for (const angle of angles) {
    // Rotate camera
    await page.evaluate((deg) => {
      window.camera.position.x = Math.sin(deg * Math.PI / 180) * 5
      window.camera.position.z = Math.cos(deg * Math.PI / 180) * 5
      window.camera.lookAt(0, 0, 0)
      window.renderer.render(window.scene, window.camera)
    }, angle)

    // Capture and analyze
    const screenshot = await page.screenshot()
    const analysis = await analyzeScreenshot(screenshot)

    results.push({
      angle,
      visible: analysis.nonTransparentPixels > 5000
    })
  }

  // Verify visible from all angles
  expect(results.every(r => r.visible)).toBe(true)
})
```

## Performance Testing

### Frame Rate Monitoring

```typescript
test('maintains 60 FPS with 100 entities', async ({ page }) => {
  await page.goto('/testing/performance')

  const perfData = await page.evaluate(async () => {
    // Create 100 entities
    for (let i = 0; i < 100; i++) {
      createEntity({ type: 'goblin', position: randomPosition() })
    }

    // Measure FPS over 5 seconds
    const frameTimesconst frameTimes: number[] = []
    const startTime = performance.now()

    while (performance.now() - startTime < 5000) {
      const frameStart = performance.now()
      window.renderer.render(window.scene, window.camera)
      frameTimes.push(performance.now() - frameStart)
      await new Promise(resolve => requestAnimationFrame(resolve))
    }

    const avgFrameTime = frameTimes.reduce((a, b) => a + b) / frameTimes.length
    const fps = 1000 / avgFrameTime

    return { fps, frameCount: frameTimes.length }
  })

  expect(perfData.fps).toBeGreaterThan(55) // Allow some variance
})
```

### Memory Usage

```typescript
test('no memory leaks during generation', async ({ page }) => {
  const memorySnapshots: number[] = []

  for (let i = 0; i < 10; i++) {
    // Trigger generation
    await page.evaluate(() => {
      generateAsset({ type: 'weapon' })
    })

    // Wait for completion
    await page.waitForTimeout(1000)

    // Measure memory
    const memory = await page.evaluate(() =>
      (performance as any).memory?.usedJSHeapSize || 0
    )

    memorySnapshots.push(memory)

    // Cleanup
    await page.evaluate(() => {
      disposeAsset()
    })
  }

  // Check for leaks (memory shouldn't grow significantly)
  const first = memorySnapshots[0]
  const last = memorySnapshots[memorySnapshots.length - 1]
  const growth = (last - first) / first

  expect(growth).toBeLessThan(0.2) // Less than 20% growth
})
```

## Conclusion

Visual testing ensures Asset Forge's 3D assets render correctly in all scenarios. By combining Three.js inspection, screenshot analysis, colored proxies, and AI verification, we achieve comprehensive coverage that catches both data and visual issues.

**Key Takeaways:**
- Test scene structure AND visual output
- Use colored proxies for rapid verification
- Leverage GPT-4o for semantic analysis
- Test from multiple angles and conditions
- Monitor performance during visual tests
