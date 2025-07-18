// Remove direct three imports - use THREE namespace instead
import { THREE } from '../../core/extras/three.js'
import { World } from '../../types'
import { System } from '../../core/systems/System'
import { RPGEntity } from '../entities/RPGEntity'
import { Mesh } from '../../core/nodes/Mesh'
import { Group } from '../../core/nodes/Group'
import { VisualTemplate, AnimationState, VisualComponent, VisualSystemConfig } from '../types/visual.types'
import visualTemplatesConfig from '../config/visuals/templates.json'
import testTemplatesConfig from '../config/visuals/test-templates.json'

/**
 * Default configuration
 */
const DEFAULT_CONFIG: VisualSystemConfig = {
  enableShadows: true,
  maxViewDistance: 100,
  lodDistances: [20, 50, 80],
  debug: false,
}

/**
 * System that manages visual representations for all RPG entities
 */
export class VisualRepresentationSystem extends System {
  private config: VisualSystemConfig
  private templates: Map<string, VisualTemplate> = new Map()
  private entityVisuals: Map<string, VisualComponent> = new Map()
  private activeAnimations: Map<string, AnimationState> = new Map()
  private scene: THREE.Scene | null = null
  private sceneRoot: THREE.Group | null = null

  constructor(world: World) {
    super(world)
    this.config = DEFAULT_CONFIG
  }

  /**
   * Initialize the system
   */
  async init(options: any): Promise<void> {
    const visualOptions = options as VisualSystemConfig
    this.config = { ...DEFAULT_CONFIG, ...visualOptions }

    // Load visual templates from configuration
    this.loadTemplates()

    // Get scene reference from world stage
    if (this.world.stage?.scene) {
      this.scene = this.world.stage.scene as unknown as THREE.Scene

      // Create a Three.js group for all visual entities (not a Hyperfy Group)
      this.sceneRoot = new THREE.Group()
      this.sceneRoot.name = 'rpg-visuals'

      // Add root to scene
      if (this.scene && typeof this.scene.add === 'function' && this.sceneRoot) {
        this.scene.add(this.sceneRoot)
      }
    } else {
      console.warn('[VisualRepresentationSystem] No scene available, visuals will not be rendered')
    }

    // Subscribe to world update loop
    if (this.world.events) {
      this.world.events.on('update', this.update.bind(this))
    }

    console.log('[VisualRepresentationSystem] Initialized with config:', this.config)
  }

  /**
   * Load templates from configuration
   */
  private loadTemplates(): void {
    // Check if we're in test mode (for visual testing)
    const isTestMode =
      process.env.NODE_ENV === 'test' || process.env.VISUAL_TEST === 'true' || process.env.BUN_ENV?.includes('test')

    if (isTestMode) {
      // Load test templates for visual validation
      const testCategories = ['quest_entities']
      for (const category of testCategories) {
        const categoryTemplates = (testTemplatesConfig as any)[category]
        if (categoryTemplates) {
          for (const [key, template] of Object.entries(categoryTemplates)) {
            this.templates.set(key, template as VisualTemplate)
          }
        }
      }
      console.log(
        `[VisualRepresentationSystem] Loaded ${this.templates.size} TEST visual templates for visual validation`
      )
    } else {
      // Load normal templates
      const categories = ['items', 'npcs', 'containers', 'resources', 'special']
      for (const category of categories) {
        const categoryTemplates = (visualTemplatesConfig as any)[category]
        if (categoryTemplates) {
          for (const [key, template] of Object.entries(categoryTemplates)) {
            this.templates.set(key, template as VisualTemplate)
          }
        }
      }
      console.log(`[VisualRepresentationSystem] Loaded ${this.templates.size} visual templates`)
    }
  }

  /**
   * Add visual representation for an entity (alias for createVisual)
   */
  addVisual(entity: RPGEntity, templateName?: string): void {
    this.createVisual(entity, templateName)
  }

  /**
   * Create visual representation for an entity
   */
  createVisual(entity: RPGEntity, templateName?: string): void {
    try {
      // Remove existing visual if any
      this.removeVisual(entity.id || entity.data?.id)

      const entityId = entity.id || entity.data?.id
      if (!entityId) {
        console.error('[VisualRepresentationSystem] Entity has no ID')
        return
      }

      // Determine template
      const template = this.getTemplate(entity, templateName)
      if (!template) {
        console.warn(`[VisualRepresentationSystem] No template found for entity ${entityId}`)
        return
      }

      // For Hyperfy entities, modify the existing entity.node instead of creating new objects
      if (entity.node) {
        this.applyVisualToEntityNode(entity, template, templateName)
      } else {
        console.warn(`[VisualRepresentationSystem] Entity ${entityId} has no node for visual modification`)
      }

      // Start idle animation if available
      if (template.animations && template.animations.includes('idle')) {
        this.playAnimation(entityId, 'idle', true)
      }

      // Sync position with entity
      this.syncVisualWithEntity(entityId, entity)

      console.log(
        `[VisualRepresentationSystem] Created visual for ${entityId} using template ${templateName || 'auto-detected'}`
      )
    } catch (error) {
      console.error('[VisualRepresentationSystem] Error creating visual:', error)
    }
  }

  /**
   * Apply visual template to entity's existing Three.js node
   */
  private applyVisualToEntityNode(entity: RPGEntity, template: VisualTemplate, templateName?: string): void {
    const entityId = entity.id || entity.data?.id

    // Clear existing children from the node
    while (entity.node.children.length > 0) {
      entity.node.remove(entity.node.children[0])
    }

    // Create Three.js geometry based on template
    let threeGeometry: THREE.BufferGeometry

    switch (template.geometryType) {
      case 'sphere':
        threeGeometry = new THREE.SphereGeometry(template.size.width / 2, 16, 16)
        break
      case 'cylinder':
        threeGeometry = new THREE.CylinderGeometry(
          template.size.width / 2,
          template.size.width / 2,
          template.size.height,
          16
        )
        break
      default:
        // Default to box
        threeGeometry = new THREE.BoxGeometry(template.size.width, template.size.height, template.size.depth)
    }

    // Create material with template color
    const material = new THREE.MeshStandardMaterial({
      color: template.color || 0xff0000, // Default red if no color
      metalness: template.material?.metalness || 0.1,
      roughness: template.material?.roughness || 0.8,
      opacity: template.material?.opacity || 1,
      transparent: (template.material?.opacity || 1) < 1,
    })

    // Add emissive if specified
    if (template.material?.emissive) {
      material.emissive.setHex(template.material.emissive)
    }

    // Create mesh and add to entity node
    const mesh = new THREE.Mesh(threeGeometry, material)
    mesh.name = `${templateName || 'npc'}-mesh`

    // Position the mesh relative to entity
    if (entity.position || entity.data?.position) {
      const pos = entity.position || entity.data.position
      entity.node.position.set(pos.x || 0, pos.y || 0, pos.z || 0)
    }

    entity.node.add(mesh)

    // Store visual info for reference
    const visual: VisualComponent = {
      mesh,
      group: entity.node, // Reference the entity's node
      template,
      visible: true,
      lodLevel: 0,
    }

    this.entityVisuals.set(entityId, visual)

    console.log(`[VisualRepresentationSystem] Applied ${templateName || 'default'} template to entity ${entityId} node`)
  }

  /**
   * Create visual component from template
   */
  private createVisualComponent(template: VisualTemplate, entity: RPGEntity): VisualComponent {
    // Create group node for the entity
    const group = new THREE.Group()
    group.name = `visual-${entity.id || entity.data?.id}`

    // Create Three.js geometry based on template
    let threeGeometry: THREE.BufferGeometry
    let meshType: 'box' | 'sphere' | 'geometry' = 'box'

    switch (template.geometryType) {
      case 'sphere':
        threeGeometry = new THREE.SphereGeometry(template.size.width / 2, 16, 16)
        meshType = 'sphere'
        break
      case 'cylinder':
        // Use cylinder geometry but wrap in box mesh type
        threeGeometry = new THREE.CylinderGeometry(
          template.size.width / 2,
          template.size.width / 2,
          template.size.height,
          16
        )
        meshType = 'geometry'
        break
      case 'cone':
        // Use cone geometry but wrap in box mesh type
        threeGeometry = new THREE.ConeGeometry(template.size.width / 2, template.size.height, 16)
        meshType = 'geometry'
        break
      default:
        threeGeometry = new THREE.BoxGeometry(template.size.width, template.size.height, template.size.depth)
        meshType = 'box'
    }

    // Create material
    const material = this.createMaterial(template)

    // Create Three.js mesh
    const threeMesh = new THREE.Mesh(threeGeometry, material)

    // Configure shadows
    if (this.config.enableShadows) {
      threeMesh.castShadow = true
      threeMesh.receiveShadow = true
    }

    // Create Hyperfy mesh wrapper
    const mesh = new Mesh({
      type: meshType,
      width: template.size.width,
      height: template.size.height,
      depth: template.size.depth,
      radius: meshType === 'sphere' ? template.size.width / 2 : undefined,
      geometry: meshType === 'geometry' ? threeGeometry : undefined,
      material: material as any,
    })

    // Store Three.js mesh reference
    ;(mesh as any)._threeMesh = threeMesh

    // Add Three.js mesh to group
    ;(group as any).add(threeMesh)

    return {
      mesh,
      group,
      template,
      visible: true,
      lodLevel: 0,
    }
  }

  /**
   * Get template for entity
   */
  private getTemplate(entity: RPGEntity, templateName?: string): VisualTemplate | undefined {
    // Use provided template name
    if (templateName && this.templates.has(templateName)) {
      return this.templates.get(templateName)
    }

    // Try to determine from entity type/name
    const entityType = (entity.type || entity.data?.type || '').toLowerCase()
    const entityName = (entity.name || entity.data?.name || '').toLowerCase()

    // Check for direct matches
    for (const [key, template] of this.templates) {
      if (entityType.includes(key) || entityName.includes(key)) {
        return template
      }
    }

    // Check components
    if (entity.getComponent) {
      // Check item component
      const itemComponent = entity.getComponent('item') as any
      if (itemComponent?.itemType) {
        const itemType = itemComponent.itemType.toLowerCase()
        for (const [key, template] of this.templates) {
          if (itemType.includes(key) || key.includes(itemType)) {
            return template
          }
        }
      }

      // Check NPC component
      const npcComponent = entity.getComponent('npc') as any
      if (npcComponent?.name) {
        const npcName = npcComponent.name.toLowerCase()
        for (const [key, template] of this.templates) {
          if (npcName.includes(key) || key.includes(npcName)) {
            return template
          }
        }
      }
    }

    // Return default template
    return this.templates.get('default')
  }

  /**
   * Create material from template
   */
  private createMaterial(template: VisualTemplate): THREE.Material {
    const materialProps: any = {
      color: new THREE.Color(template.color),
      transparent: true,
      opacity: template.material?.opacity ?? 0.9,
    }

    // Use appropriate material type
    if (template.material?.metalness !== undefined || template.material?.roughness !== undefined) {
      // Use standard material for PBR properties
      return new THREE.MeshStandardMaterial({
        ...materialProps,
        metalness: template.material.metalness ?? 0,
        roughness: template.material.roughness ?? 1,
        emissive: template.material?.emissive ? new THREE.Color(template.material.emissive) : undefined,
        emissiveIntensity: (template.material as any)?.emissiveIntensity ?? 0,
      })
    } else {
      // Use basic material for simple visuals
      return new THREE.MeshBasicMaterial(materialProps)
    }
  }

  /**
   * Sync visual position with entity
   */
  private syncVisualWithEntity(entityId: string, entity: RPGEntity): void {
    const visual = this.entityVisuals.get(entityId)
    if (!visual) {
      return
    }

    const position = entity.position || entity.data?.position
    if (position) {
      visual.group.position.set(position.x || 0, position.y || 0, position.z || 0)
    }

    const rotation = entity.rotation || entity.data?.rotation
    if (rotation) {
      visual.group.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0)
    }
  }

  /**
   * Play animation for entity
   */
  playAnimation(entityId: string, animationType: string, loop: boolean = false, duration: number = 1000): void {
    const visual = this.entityVisuals.get(entityId)
    if (!visual) {
      return
    }

    // Cancel current animation
    this.stopAnimation(entityId)

    // Create animation state
    const animationState: AnimationState = {
      entityId,
      animationType,
      startTime: Date.now(),
      duration,
      loop,
      originalPosition: {
        x: visual.group.position.x,
        y: visual.group.position.y,
        z: visual.group.position.z,
      },
      originalRotation: {
        x: visual.group.rotation.x,
        y: visual.group.rotation.y,
        z: visual.group.rotation.z,
      },
    }

    this.activeAnimations.set(entityId, animationState)
  }

  /**
   * Stop animation for entity
   */
  stopAnimation(entityId: string): void {
    const animation = this.activeAnimations.get(entityId)
    if (!animation) {
      return
    }

    const visual = this.entityVisuals.get(entityId)
    if (visual && animation.originalPosition && animation.originalRotation) {
      // Reset to original position/rotation
      visual.group.position.set(
        animation.originalPosition.x,
        animation.originalPosition.y,
        animation.originalPosition.z
      )
      visual.group.rotation.set(
        animation.originalRotation.x,
        animation.originalRotation.y,
        animation.originalRotation.z
      )
    }

    this.activeAnimations.delete(entityId)
  }

  /**
   * Update animations and sync with entities
   */
  update(_delta: number): void {
    const currentTime = Date.now()

    // Update animations
    for (const [entityId, animation] of this.activeAnimations) {
      const visual = this.entityVisuals.get(entityId)
      if (!visual) {
        this.activeAnimations.delete(entityId)
        continue
      }

      const elapsed = currentTime - animation.startTime
      const progress = Math.min(elapsed / animation.duration, 1)

      // Apply animation
      this.applyAnimation(visual, animation, progress)

      // Check if animation is complete
      if (progress >= 1) {
        if (animation.loop) {
          animation.startTime = currentTime
        } else {
          this.stopAnimation(entityId)
        }
      }
    }

    // Sync visuals with entity positions
    for (const [entityId, _visual] of this.entityVisuals) {
      const entity = (this.world.entities as any)?.items?.get(entityId)
      if (entity) {
        this.syncVisualWithEntity(entityId, entity)
      }
    }
  }

  /**
   * Apply animation to visual
   */
  private applyAnimation(visual: VisualComponent, animation: AnimationState, progress: number): void {
    const group = visual.group
    const origPos = animation.originalPosition!
    const origRot = animation.originalRotation!

    switch (animation.animationType) {
      case 'walk':
        group.position.y = origPos.y + Math.sin(progress * Math.PI * 4) * 0.1
        group.position.x = origPos.x + Math.sin(progress * Math.PI * 2) * 0.05
        break

      case 'attack':
      case 'swing_down':
        group.rotation.x = origRot.x - Math.sin(progress * Math.PI) * 0.5
        group.position.y = origPos.y - Math.sin(progress * Math.PI) * 0.2
        break

      case 'die':
        group.rotation.z = origRot.z + (progress * Math.PI) / 2
        group.position.y = origPos.y - progress * 0.5
        this.setOpacity(visual, 1 - progress * 0.5)
        break

      case 'open':
        group.rotation.x = origRot.x - progress * 0.3
        break

      case 'close':
        group.rotation.x = origRot.x + (1 - progress) * 0.3
        break

      case 'pulse':
        const scale = 1 + Math.sin(progress * Math.PI * 2) * 0.2
        group.scale.set(scale, scale, scale)
        break

      case 'rotate':
        group.rotation.y = origRot.y + progress * Math.PI * 2
        break

      case 'bounce':
        group.position.y = origPos.y + Math.abs(Math.sin(progress * Math.PI * 2)) * 0.3
        break

      case 'shimmer':
        const shimmer = 0.7 + Math.sin(progress * Math.PI * 4) * 0.3
        this.setOpacity(visual, shimmer)
        break

      case 'sparkle':
        const sparkleScale = 1 + Math.sin(progress * Math.PI * 8) * 0.1
        group.scale.set(sparkleScale, sparkleScale, sparkleScale)
        group.rotation.y = origRot.y + progress * Math.PI
        break

      case 'idle':
        group.position.y = origPos.y + Math.sin(progress * Math.PI * 2) * 0.05
        break

      case 'sway':
        group.rotation.z = origRot.z + Math.sin(progress * Math.PI * 2) * 0.1
        break

      case 'ripple':
        const rippleScale = 1 + Math.sin(progress * Math.PI * 4) * 0.1
        group.scale.set(rippleScale, 1, rippleScale)
        break

      // Add more animation types as needed
      default:
        break
    }
  }

  /**
   * Set opacity for visual
   */
  private setOpacity(visual: VisualComponent, opacity: number): void {
    const threeMesh = (visual.mesh as any)._threeMesh
    if (threeMesh?.material) {
      threeMesh.material.opacity = Math.max(0, Math.min(1, opacity))
    }
  }

  /**
   * Remove visual representation
   */
  removeVisual(entityId: string): void {
    if (!entityId) {
      return
    }

    this.stopAnimation(entityId)

    const visual = this.entityVisuals.get(entityId)
    if (visual) {
      // Remove from scene
      if (this.sceneRoot && visual.group.parent) {
        this.sceneRoot.remove(visual.group)
      }

      // Dispose of Three.js resources
      const threeMesh = (visual.mesh as any)._threeMesh
      if (threeMesh) {
        if (threeMesh.geometry) {
          threeMesh.geometry.dispose()
        }
        if (threeMesh.material) {
          if (Array.isArray(threeMesh.material)) {
            threeMesh.material.forEach((m: any) => m.dispose())
          } else {
            threeMesh.material.dispose()
          }
        }
      }

      // Deactivate hyperfy nodes
      if (visual.group.deactivate) {
        visual.group.deactivate()
      }

      this.entityVisuals.delete(entityId)
    }
  }

  /**
   * Get visual for entity
   */
  getVisual(entityId: string): VisualComponent | undefined {
    return this.entityVisuals.get(entityId)
  }

  /**
   * Clean up
   */
  override destroy(): void {
    // Unsubscribe from events
    if (this.world.events) {
      this.world.events.off('update', this.update.bind(this))
    }

    // Remove all visuals
    for (const entityId of Array.from(this.entityVisuals.keys())) {
      this.removeVisual(entityId)
    }

    // Remove scene root
    if (this.sceneRoot && this.scene) {
      this.scene.remove(this.sceneRoot)
      // Three.js groups don't have deactivate method - just remove from scene
    }

    this.entityVisuals.clear()
    this.activeAnimations.clear()
    this.templates.clear()

    super.destroy()
  }
}
