/**
 * Visual Resource Test - Creates a test scenario to visually verify all resource types
 * Spawns one of each resource type in a grid pattern for easy inspection
 */

import { System } from '../../core/systems/System'
import type { World } from '../../types'
import { ResourceType, RESOURCE_DEFINITIONS } from '../../game/src/systems/resources/ResourceDefinitions'
import { THREE } from '../../core/extras/three'

export class VisualResourceTest extends System {
  private testResourcesSpawned: boolean = false
  private visualMeshes: Map<string, any> = new Map()

  constructor(world: World) {
    super(world)
  }

  async initialize(): Promise<void> {
    console.log('[VisualResourceTest] Initializing visual resource test...')

    // Listen for test commands
    this.world.events.on('test:spawn_visual_resources', this.spawnAllResourceTypes.bind(this))
    this.world.events.on('test:clear_visual_resources', this.clearTestResources.bind(this))

    console.log('[VisualResourceTest] Ready for visual testing')
    console.log('[VisualResourceTest] Use "test:spawn_visual_resources" event to start test')
  }

  private spawnAllResourceTypes(): void {
    if (this.testResourcesSpawned) {
      console.log('[VisualResourceTest] Test resources already spawned. Clear first.')
      return
    }

    console.log('[VisualResourceTest] Spawning all resource types for visual verification...')

    const resourceTypes = Object.values(ResourceType)
    const gridSize = Math.ceil(Math.sqrt(resourceTypes.length))
    const spacing = 5 // Distance between resources
    const startX = -((gridSize - 1) * spacing) / 2 // Center the grid
    const startZ = -((gridSize - 1) * spacing) / 2

    let row = 0
    let col = 0

    resourceTypes.forEach((resourceType, index) => {
      const resourceDef = RESOURCE_DEFINITIONS[resourceType]
      if (!resourceDef) {
        return
      }

      const x = startX + col * spacing
      const z = startZ + row * spacing
      const y = 0

      // Create visual representation
      this.createTestResourceVisual(resourceType, resourceDef, { x, y, z }, index)

      // Create info sign
      this.createInfoSign(resourceType, resourceDef, { x, y: 2, z }, index)

      col++
      if (col >= gridSize) {
        col = 0
        row++
      }
    })

    this.testResourcesSpawned = true

    // Create summary sign
    this.createSummarySign(resourceTypes.length, { x: 0, y: 4, z: 0 })

    console.log(`[VisualResourceTest] Spawned ${resourceTypes.length} test resources in ${gridSize}x${gridSize} grid`)
    this.logVisualTestResults()
  }

  private createTestResourceVisual(
    resourceType: ResourceType,
    resourceDef: any,
    position: { x: number; y: number; z: number },
    index: number
  ): void {
    // Create the main resource cube
    const geometry = new THREE.BoxGeometry(resourceDef.visual.scale, resourceDef.visual.scale, resourceDef.visual.scale)

    const material = new THREE.MeshStandardMaterial({
      color: resourceDef.visual.color,
      metalness: resourceDef.visual.metalness || 0,
      roughness: resourceDef.visual.roughness || 0.5,
      emissive: resourceDef.visual.emissive || '#000000',
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(position.x, position.y + resourceDef.visual.scale / 2, position.z)

    mesh.userData = {
      isTestResource: true,
      resourceType,
      resourceName: resourceDef.name,
      index,
    }

    // Add to visual system
    const visualSystem = this.world.systems.find(s => s.constructor.name === 'VisualRepresentationSystem')
    if (visualSystem && (visualSystem as any).addMesh) {
      ;(visualSystem as any).addMesh(mesh)
    }

    this.visualMeshes.set(`resource_${index}`, mesh)

    // Add floating text label
    this.createFloatingLabel(
      resourceDef.name,
      {
        x: position.x,
        y: position.y + resourceDef.visual.scale + 1,
        z: position.z,
      },
      index
    )
  }

  private createFloatingLabel(text: string, position: { x: number; y: number; z: number }, index: number): void {
    // Create text geometry (simplified - in real implementation would use TextGeometry)
    const labelGeometry = new THREE.PlaneGeometry(2, 0.5)
    const labelMaterial = new THREE.MeshBasicMaterial({
      color: '#FFFFFF',
      transparent: true,
      opacity: 0.8,
    })

    const labelMesh = new THREE.Mesh(labelGeometry, labelMaterial)
    labelMesh.position.set(position.x, position.y, position.z)
    labelMesh.userData = {
      isTestLabel: true,
      text,
      index,
    }

    const visualSystem = this.world.systems.find(s => s.constructor.name === 'VisualRepresentationSystem')
    if (visualSystem && (visualSystem as any).addMesh) {
      ;(visualSystem as any).addMesh(labelMesh)
    }

    this.visualMeshes.set(`label_${index}`, labelMesh)
  }

  private createInfoSign(
    resourceType: ResourceType,
    resourceDef: any,
    position: { x: number; y: number; z: number },
    index: number
  ): void {
    // Create info panel showing resource properties
    const infoGeometry = new THREE.PlaneGeometry(1, 1.5)
    const infoMaterial = new THREE.MeshBasicMaterial({
      color: '#333333',
      transparent: true,
      opacity: 0.7,
    })

    const infoMesh = new THREE.Mesh(infoGeometry, infoMaterial)
    infoMesh.position.set(position.x, position.y, position.z)
    infoMesh.userData = {
      isTestInfo: true,
      resourceType,
      resourceData: {
        name: resourceDef.name,
        level: resourceDef.levelRequired,
        skill: resourceDef.skill,
        xp: resourceDef.drops[0]?.xp || 0,
        color: resourceDef.visual.color,
        rarity: resourceDef.rarity,
      },
      index,
    }

    const visualSystem = this.world.systems.find(s => s.constructor.name === 'VisualRepresentationSystem')
    if (visualSystem && (visualSystem as any).addMesh) {
      ;(visualSystem as any).addMesh(infoMesh)
    }

    this.visualMeshes.set(`info_${index}`, infoMesh)
  }

  private createSummarySign(totalResources: number, position: { x: number; y: number; z: number }): void {
    const summaryGeometry = new THREE.PlaneGeometry(4, 2)
    const summaryMaterial = new THREE.MeshBasicMaterial({
      color: '#FFD700',
      transparent: true,
      opacity: 0.9,
    })

    const summaryMesh = new THREE.Mesh(summaryGeometry, summaryMaterial)
    summaryMesh.position.set(position.x, position.y, position.z)
    summaryMesh.userData = {
      isTestSummary: true,
      totalResources,
      instructions: [
        'VISUAL RESOURCE TEST',
        `${totalResources} resource types displayed`,
        'Verify each has distinct appearance',
        'Check colors, sizes, and materials',
        'Trees: Browns/Greens',
        'Rocks: Metallic/Stone colors',
        'Fishing: Blue water colors',
      ],
    }

    const visualSystem = this.world.systems.find(s => s.constructor.name === 'VisualRepresentationSystem')
    if (visualSystem && (visualSystem as any).addMesh) {
      ;(visualSystem as any).addMesh(summaryMesh)
    }

    this.visualMeshes.set('summary', summaryMesh)
  }

  private clearTestResources(): void {
    if (!this.testResourcesSpawned) {
      console.log('[VisualResourceTest] No test resources to clear')
      return
    }

    console.log('[VisualResourceTest] Clearing test resources...')

    const visualSystem = this.world.systems.find(s => s.constructor.name === 'VisualRepresentationSystem')

    for (const [id, mesh] of this.visualMeshes) {
      if (visualSystem && (visualSystem as any).removeMesh) {
        ;(visualSystem as any).removeMesh(mesh)
      }
    }

    this.visualMeshes.clear()
    this.testResourcesSpawned = false

    console.log('[VisualResourceTest] Test resources cleared')
  }

  private logVisualTestResults(): void {
    console.log('\n=== VISUAL RESOURCE TEST RESULTS ===')
    console.log('Resource types and their visual properties:')
    console.log('')

    // Group by category for better readability
    const categories: {
      'Trees (Woodcutting)': Array<{
        name: string
        level: number
        color: string
        scale: number
        emissive: string
        metallic: string
        rarity: string
      }>
      'Rocks (Mining)': Array<{
        name: string
        level: number
        color: string
        scale: number
        emissive: string
        metallic: string
        rarity: string
      }>
      'Fishing Spots': Array<{
        name: string
        level: number
        color: string
        scale: number
        emissive: string
        metallic: string
        rarity: string
      }>
    } = {
      'Trees (Woodcutting)': [],
      'Rocks (Mining)': [],
      'Fishing Spots': [],
    }

    for (const [resourceType, resourceDef] of Object.entries(RESOURCE_DEFINITIONS)) {
      const info = {
        name: resourceDef.name,
        level: resourceDef.levelRequired,
        color: resourceDef.visual.color,
        scale: resourceDef.visual.scale,
        emissive: resourceDef.visual.emissive ? '✨' : '',
        metallic: (resourceDef.visual.metalness || 0) > 0 ? '⚡' : '',
        rarity: resourceDef.rarity,
      }

      if (resourceType.startsWith('tree_')) {
        categories['Trees (Woodcutting)'].push(info)
      } else if (resourceType.startsWith('rock_')) {
        categories['Rocks (Mining)'].push(info)
      } else if (resourceType.startsWith('fishing_')) {
        categories['Fishing Spots'].push(info)
      }
    }

    for (const [category, resources] of Object.entries(categories)) {
      console.log(`${category}:`)
      resources.forEach(resource => {
        console.log(
          `  ${resource.name} (Lvl ${resource.level}): ${resource.color} ${resource.emissive}${resource.metallic} [${resource.rarity}]`
        )
      })
      console.log('')
    }

    console.log('Visual Verification Checklist:')
    console.log('✓ Each resource type has a unique color')
    console.log('✓ Higher level resources are more visually impressive')
    console.log('✓ Rare resources have special effects (glow, metallic)')
    console.log('✓ Resources match their thematic category')
    console.log('✓ Size variations create visual hierarchy')
    console.log('')
    console.log('IMPORTANT: Manually verify these in the 3D world!')
    console.log('=====================================\n')
  }

  public runColorDistinctionTest(): void {
    console.log('\n=== COLOR DISTINCTION TEST ===')

    const colors: string[] = []
    const duplicates: string[] = []

    for (const [resourceType, resourceDef] of Object.entries(RESOURCE_DEFINITIONS)) {
      const color = resourceDef.visual.color.toLowerCase()

      if (colors.includes(color)) {
        duplicates.push(`${resourceDef.name} (${color})`)
      } else {
        colors.push(color)
      }
    }

    console.log(`Total unique colors: ${colors.length}`)
    console.log(`Total resources: ${Object.keys(RESOURCE_DEFINITIONS).length}`)

    if (duplicates.length > 0) {
      console.log('⚠️  Duplicate colors found:')
      duplicates.forEach(dup => console.log(`  - ${dup}`))
    } else {
      console.log('✅ All resources have unique colors')
    }

    // Test color contrast
    this.testColorContrast(colors)

    console.log('===============================\n')
  }

  private testColorContrast(colors: string[]): void {
    console.log('\nColor Contrast Analysis:')

    const tooSimilar: string[] = []

    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const similarity = this.calculateColorSimilarity(colors[i], colors[j])
        if (similarity > 0.8) {
          // Very similar colors
          tooSimilar.push(`${colors[i]} ↔ ${colors[j]} (${Math.round(similarity * 100)}% similar)`)
        }
      }
    }

    if (tooSimilar.length > 0) {
      console.log('⚠️  Colors that might be too similar:')
      tooSimilar.forEach(pair => console.log(`  - ${pair}`))
    } else {
      console.log('✅ All colors have sufficient contrast')
    }
  }

  private calculateColorSimilarity(color1: string, color2: string): number {
    // Simple RGB distance calculation
    const rgb1 = this.hexToRgb(color1)
    const rgb2 = this.hexToRgb(color2)

    if (!rgb1 || !rgb2) {
      return 0
    }

    const rDiff = Math.abs(rgb1.r - rgb2.r)
    const gDiff = Math.abs(rgb1.g - rgb2.g)
    const bDiff = Math.abs(rgb1.b - rgb2.b)

    const maxDiff = 255 * 3 // Maximum possible difference
    const actualDiff = rDiff + gDiff + bDiff

    return 1 - actualDiff / maxDiff // Return similarity (0 = different, 1 = identical)
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null
  }

  public generateVisualTestReport(): any {
    const report = {
      timestamp: new Date().toISOString(),
      totalResources: Object.keys(RESOURCE_DEFINITIONS).length,
      categories: {
        trees: 0,
        rocks: 0,
        fishing: 0,
      },
      colorAnalysis: {
        uniqueColors: 0,
        duplicates: [] as string[],
        lowContrast: [] as string[],
      },
      visualProperties: {
        emissiveResources: [] as string[],
        metallicResources: [] as string[],
        largeResources: [] as string[],
        rareResources: [] as string[],
      },
      recommendations: [] as string[],
    }

    // Analyze categories
    for (const [resourceType, resourceDef] of Object.entries(RESOURCE_DEFINITIONS)) {
      if (resourceType.startsWith('tree_')) {
        report.categories.trees++
      } else if (resourceType.startsWith('rock_')) {
        report.categories.rocks++
      } else if (resourceType.startsWith('fishing_')) {
        report.categories.fishing++
      }

      // Analyze visual properties
      if (resourceDef.visual.emissive) {
        report.visualProperties.emissiveResources.push(resourceDef.name)
      }
      if (resourceDef.visual.metalness && resourceDef.visual.metalness > 0) {
        report.visualProperties.metallicResources.push(resourceDef.name)
      }
      if (resourceDef.visual.scale > 1.5) {
        report.visualProperties.largeResources.push(resourceDef.name)
      }
      if (resourceDef.rarity === 'very_rare') {
        report.visualProperties.rareResources.push(resourceDef.name)
      }
    }

    // Generate recommendations
    if (report.visualProperties.emissiveResources.length < 3) {
      report.recommendations.push('Consider adding more emissive effects to high-level resources')
    }
    if (report.categories.trees < report.categories.rocks) {
      report.recommendations.push('Consider adding more tree varieties for woodcutting progression')
    }

    return report
  }

  update(deltaTime: number): void {
    // Animate test resources slightly for better visibility
    if (this.testResourcesSpawned) {
      const time = Date.now() * 0.001

      for (const [id, mesh] of this.visualMeshes) {
        if (id.startsWith('resource_')) {
          // Gentle floating animation
          const originalY = mesh.userData.originalY || mesh.position.y
          mesh.userData.originalY = originalY
          mesh.position.y = originalY + Math.sin(time + mesh.userData.index) * 0.1

          // Gentle rotation for emissive resources
          if (mesh.material && mesh.material.emissive && mesh.material.emissive !== '#000000') {
            mesh.rotation.y = time * 0.5
          }
        }
      }
    }
  }

  serialize(): any {
    return {
      testResourcesSpawned: this.testResourcesSpawned,
    }
  }

  deserialize(data: any): void {
    this.testResourcesSpawned = data.testResourcesSpawned || false
  }
}
