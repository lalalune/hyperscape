/**
 * Combat Animation System - Handles visual combat animations
 * Creates weapon swings, magic particles, and ranged projectiles
 */

import { System } from '../../../core/systems/System'
import type { World, Entity } from '../../../types'
import { THREE } from '../../../core/extras/three'
import { COMBAT_ANIMATIONS, AnimationDefinition, AnimationFrame, CombatStyle, WeaponType } from './CombatDefinitions'

interface ActiveAnimation {
  id: string
  entityId: string
  animationId: string
  startTime: number
  duration: number
  mesh?: any
  originalTransform?: any
  onComplete?: () => void
}

interface CombatEffect {
  id: string
  type: 'magic_particles' | 'ranged_projectile' | 'hit_splat' | 'death_effect'
  startTime: number
  duration: number
  source: { x: number; y: number; z: number }
  target?: { x: number; y: number; z: number }
  mesh?: any
  particles?: any[]
}

export class CombatAnimationSystem extends System {
  private activeAnimations: Map<string, ActiveAnimation> = new Map()
  private activeEffects: Map<string, CombatEffect> = new Map()
  private animationCounter: number = 0
  private effectCounter: number = 0

  constructor(world: World) {
    super(world)
  }

  async initialize(): Promise<void> {
    console.log('[CombatAnimationSystem] Initializing...')

    // Listen for combat events
    this.world.events.on('combat:attack_started', this.handleAttackStarted.bind(this))
    this.world.events.on('combat:projectile_launched', this.handleProjectileLaunched.bind(this))
    this.world.events.on('combat:magic_cast', this.handleMagicCast.bind(this))
    this.world.events.on('combat:damage_dealt', this.handleDamageDealt.bind(this))
    this.world.events.on('combat:entity_died', this.handleEntityDied.bind(this))

    console.log('[CombatAnimationSystem] Initialized')
  }

  private handleAttackStarted(data: any): void {
    const { attackerId, weaponType, combatStyle } = data

    // Trigger appropriate animation based on combat style
    let animationId = ''
    switch (combatStyle) {
      case CombatStyle.MELEE:
        animationId = 'melee_swing'
        break
      case CombatStyle.RANGED:
        animationId = 'ranged_shoot'
        break
      case CombatStyle.MAGIC:
        animationId = 'magic_cast'
        break
    }

    if (animationId) {
      this.playAnimation(attackerId, animationId)
    }
  }

  private handleProjectileLaunched(data: any): void {
    const { attackerId, targetId, projectileType } = data

    const attacker = this.world.getEntityById(attackerId)
    const target = this.world.getEntityById(targetId)

    if (!attacker || !target) {
      return
    }

    const attackerPos = attacker.getComponent('movement')?.position
    const targetPos = target.getComponent('movement')?.position

    if (!attackerPos || !targetPos) {
      return
    }

    this.createProjectile(attackerPos, targetPos, projectileType || 'arrow')
  }

  private handleMagicCast(data: any): void {
    const { casterId, targetId, spellType } = data

    const caster = this.world.getEntityById(casterId)
    if (!caster) {
      return
    }

    const casterPos = caster.getComponent('movement')?.position
    if (!casterPos) {
      return
    }

    // Create magic particles
    this.createMagicParticles(casterPos, spellType)

    // If there's a target, create spell projectile
    if (targetId) {
      const target = this.world.getEntityById(targetId)
      if (target) {
        const targetPos = target.getComponent('movement')?.position
        if (targetPos) {
          this.createSpellProjectile(casterPos, targetPos, spellType)
        }
      }
    }
  }

  private handleDamageDealt(data: any): void {
    const { targetId, damage, damageType } = data

    const target = this.world.getEntityById(targetId)
    if (!target) {
      return
    }

    const targetPos = target.getComponent('movement')?.position
    if (!targetPos) {
      return
    }

    this.createHitSplat(targetPos, damage, damageType)
  }

  private handleEntityDied(data: any): void {
    const { entityId } = data

    const entity = this.world.getEntityById(entityId)
    if (!entity) {
      return
    }

    const entityPos = entity.getComponent('movement')?.position
    if (!entityPos) {
      return
    }

    this.createDeathEffect(entityPos)
  }

  public playAnimation(entityId: string, animationId: string, onComplete?: () => void): string {
    const entity = this.world.getEntityById(entityId)
    if (!entity) {
      return ''
    }

    const animationDef = COMBAT_ANIMATIONS[animationId]
    if (!animationDef) {
      return ''
    }

    // Get entity's visual mesh - create a placeholder if none exists
    let mesh = this.getEntityMesh(entityId)
    if (!mesh) {
      // Create a simple placeholder mesh for testing
      mesh = {
        position: { x: 0, y: 0, z: 0, clone: () => ({ x: 0, y: 0, z: 0 }) },
        rotation: { x: 0, y: 0, z: 0, clone: () => ({ x: 0, y: 0, z: 0 }) },
        scale: { x: 1, y: 1, z: 1, clone: () => ({ x: 1, y: 1, z: 1 }) },
      }
    }

    const activeAnimationId = `anim_${this.animationCounter++}`

    // Store original transform
    const originalTransform = {
      position: mesh.position.clone(),
      rotation: mesh.rotation.clone(),
      scale: mesh.scale.clone(),
    }

    const activeAnimation: ActiveAnimation = {
      id: activeAnimationId,
      entityId,
      animationId,
      startTime: Date.now(),
      duration: animationDef.duration,
      mesh,
      originalTransform,
      onComplete,
    }

    this.activeAnimations.set(activeAnimationId, activeAnimation)

    this.world.events.emit('combat:animation_started', {
      entityId,
      animationId,
      duration: animationDef.duration,
    })

    return activeAnimationId
  }

  private createProjectile(
    startPos: { x: number; y: number; z: number },
    endPos: { x: number; y: number; z: number },
    projectileType: string
  ): void {
    const effectId = `proj_${this.effectCounter++}`

    // Check if THREE is available (not in test environment)
    if (typeof THREE === 'undefined') {
      // In test environment, create a placeholder
      const effect: CombatEffect = {
        id: effectId,
        type: 'ranged_projectile',
        startTime: Date.now(),
        duration: 1000,
        source: startPos,
        target: endPos,
      }
      this.activeEffects.set(effectId, effect)
      return
    }

    // Create projectile mesh
    let geometry, material

    switch (projectileType) {
      case 'arrow':
        geometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8)
        material = new THREE.MeshBasicMaterial({ color: '#8B4513' })
        break
      case 'bolt':
        geometry = new THREE.CylinderGeometry(0.08, 0.08, 0.8, 6)
        material = new THREE.MeshBasicMaterial({ color: '#696969' })
        break
      default:
        geometry = new THREE.SphereGeometry(0.1, 8, 8)
        material = new THREE.MeshBasicMaterial({ color: '#FFFF00' })
    }

    const projectile = new THREE.Mesh(geometry, material)
    projectile.position.set(startPos.x, startPos.y + 1, startPos.z)

    // Calculate direction and rotation
    const direction = new THREE.Vector3(endPos.x - startPos.x, endPos.y - startPos.y, endPos.z - startPos.z).normalize()

    // Point projectile towards target
    projectile.lookAt(endPos.x, endPos.y, endPos.z)

    // Add to visual system
    const visualSystem = this.world.systems.find(s => s.constructor.name === 'VisualRepresentationSystem')
    if (visualSystem && (visualSystem as any).addMesh) {
      ;(visualSystem as any).addMesh(projectile)
    }

    const effect: CombatEffect = {
      id: effectId,
      type: 'ranged_projectile',
      startTime: Date.now(),
      duration: 1000, // 1 second flight time
      source: startPos,
      target: endPos,
      mesh: projectile,
    }

    this.activeEffects.set(effectId, effect)
  }

  private createMagicParticles(position: { x: number; y: number; z: number }, spellType: string): void {
    const effectId = `magic_${this.effectCounter++}`

    // Check if THREE is available (not in test environment)
    if (typeof THREE === 'undefined') {
      const effect: CombatEffect = {
        id: effectId,
        type: 'magic_particles',
        startTime: Date.now(),
        duration: 2000,
        source: position,
      }
      this.activeEffects.set(effectId, effect)
      return
    }

    // Create particle system
    const particles: any[] = []
    const particleCount = 20

    for (let i = 0; i < particleCount; i++) {
      const geometry = new THREE.SphereGeometry(0.05, 6, 6)
      let material

      // Color based on spell type
      switch (spellType) {
        case 'wind_strike':
          material = new THREE.MeshBasicMaterial({ color: '#87CEEB' })
          break
        case 'fire_strike':
          material = new THREE.MeshBasicMaterial({ color: '#FF4500' })
          break
        case 'earth_strike':
          material = new THREE.MeshBasicMaterial({ color: '#8B4513' })
          break
        default:
          material = new THREE.MeshBasicMaterial({ color: '#9370DB' })
      }

      const particle = new THREE.Mesh(geometry, material)
      particle.position.set(
        position.x + (Math.random() - 0.5) * 2,
        position.y + 1 + Math.random(),
        position.z + (Math.random() - 0.5) * 2
      )

      // Random velocity
      particle.userData.velocity = {
        x: (Math.random() - 0.5) * 0.02,
        y: Math.random() * 0.02,
        z: (Math.random() - 0.5) * 0.02,
      }

      particles.push(particle)

      // Add to visual system
      const visualSystem = this.world.systems.find(s => s.constructor.name === 'VisualRepresentationSystem')
      if (visualSystem && (visualSystem as any).addMesh) {
        ;(visualSystem as any).addMesh(particle)
      }
    }

    const effect: CombatEffect = {
      id: effectId,
      type: 'magic_particles',
      startTime: Date.now(),
      duration: 2000, // 2 seconds
      source: position,
      particles,
    }

    this.activeEffects.set(effectId, effect)
  }

  private createSpellProjectile(
    startPos: { x: number; y: number; z: number },
    endPos: { x: number; y: number; z: number },
    spellType: string
  ): void {
    const effectId = `spell_proj_${this.effectCounter++}`

    // Create spell projectile
    const geometry = new THREE.SphereGeometry(0.2, 12, 12)
    let material

    switch (spellType) {
      case 'wind_strike':
        material = new THREE.MeshBasicMaterial({
          color: '#87CEEB',
          transparent: true,
          opacity: 0.7,
        })
        break
      case 'fire_blast':
        material = new THREE.MeshBasicMaterial({
          color: '#FF4500',
          emissive: '#FF2200',
          transparent: true,
          opacity: 0.8,
        })
        break
      default:
        material = new THREE.MeshBasicMaterial({
          color: '#9370DB',
          transparent: true,
          opacity: 0.7,
        })
    }

    const projectile = new THREE.Mesh(geometry, material)
    projectile.position.set(startPos.x, startPos.y + 1, startPos.z)

    // Add to visual system
    const visualSystem = this.world.systems.find(s => s.constructor.name === 'VisualRepresentationSystem')
    if (visualSystem && (visualSystem as any).addMesh) {
      ;(visualSystem as any).addMesh(projectile)
    }

    const effect: CombatEffect = {
      id: effectId,
      type: 'ranged_projectile', // Reuse projectile logic
      startTime: Date.now(),
      duration: 800, // Faster than arrows
      source: startPos,
      target: endPos,
      mesh: projectile,
    }

    this.activeEffects.set(effectId, effect)
  }

  private createHitSplat(position: { x: number; y: number; z: number }, damage: number, damageType: string): void {
    const effectId = `hitsplat_${this.effectCounter++}`

    // Check if document is available (not in test environment)
    if (typeof document === 'undefined') {
      // In test environment, just create a simple effect placeholder
      const effect: CombatEffect = {
        id: effectId,
        type: 'hit_splat',
        startTime: Date.now(),
        duration: 1500,
        source: position,
      }
      this.activeEffects.set(effectId, effect)
      return
    }

    // Create damage number display
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 64
    const context = canvas.getContext('2d')!

    // Background color based on damage type
    let bgColor = '#FF0000' // Default red
    switch (damageType) {
      case 'magic':
        bgColor = '#0000FF'
        break
      case 'ranged':
        bgColor = '#00AA00'
        break
      case 'poison':
        bgColor = '#AA00AA'
        break
    }

    context.fillStyle = bgColor
    context.fillRect(0, 0, 128, 64)
    context.fillStyle = '#FFFFFF'
    context.font = 'bold 24px Arial'
    context.textAlign = 'center'
    context.fillText(damage.toString(), 64, 40)

    const texture = new THREE.CanvasTexture(canvas)
    const material = new THREE.SpriteMaterial({ map: texture })
    const sprite = new THREE.Sprite(material)

    sprite.position.set(position.x, position.y + 2, position.z)
    sprite.scale.set(2, 1, 1)

    // Add to visual system
    const visualSystem = this.world.systems.find(s => s.constructor.name === 'VisualRepresentationSystem')
    if (visualSystem && (visualSystem as any).addMesh) {
      ;(visualSystem as any).addMesh(sprite)
    }

    const effect: CombatEffect = {
      id: effectId,
      type: 'hit_splat',
      startTime: Date.now(),
      duration: 1500, // 1.5 seconds
      source: position,
      mesh: sprite,
    }

    this.activeEffects.set(effectId, effect)
  }

  private createDeathEffect(position: { x: number; y: number; z: number }): void {
    const effectId = `death_${this.effectCounter++}`

    // Create explosion-like effect
    const particles: any[] = []
    const particleCount = 30

    for (let i = 0; i < particleCount; i++) {
      const geometry = new THREE.SphereGeometry(0.1, 8, 8)
      const material = new THREE.MeshBasicMaterial({
        color: '#FF0000',
        transparent: true,
        opacity: 0.8,
      })

      const particle = new THREE.Mesh(geometry, material)
      particle.position.set(position.x, position.y + 1, position.z)

      // Explosive velocity
      const angle = (i / particleCount) * Math.PI * 2
      particle.userData.velocity = {
        x: Math.cos(angle) * 0.05,
        y: Math.random() * 0.03,
        z: Math.sin(angle) * 0.05,
      }

      particles.push(particle)

      // Add to visual system
      const visualSystem = this.world.systems.find(s => s.constructor.name === 'VisualRepresentationSystem')
      if (visualSystem && (visualSystem as any).addMesh) {
        ;(visualSystem as any).addMesh(particle)
      }
    }

    const effect: CombatEffect = {
      id: effectId,
      type: 'death_effect',
      startTime: Date.now(),
      duration: 3000, // 3 seconds
      source: position,
      particles,
    }

    this.activeEffects.set(effectId, effect)
  }

  private getEntityMesh(entityId: string): any {
    // Get the visual mesh for an entity from the visual system
    const visualSystem = this.world.systems.find(s => s.constructor.name === 'VisualRepresentationSystem')
    if (!visualSystem) {
      return null
    }

    // Try to get mesh from visual system
    return (visualSystem as any).getEntityMesh?.(entityId) || null
  }

  public isAnimationPlaying(entityId: string): boolean {
    for (const [id, animation] of this.activeAnimations) {
      if (animation.entityId === entityId) {
        return true
      }
    }
    return false
  }

  public stopAnimation(entityId: string): void {
    for (const [id, animation] of this.activeAnimations) {
      if (animation.entityId === entityId) {
        // Restore original transform
        if (animation.mesh && animation.originalTransform) {
          animation.mesh.position.copy(animation.originalTransform.position)
          animation.mesh.rotation.copy(animation.originalTransform.rotation)
          animation.mesh.scale.copy(animation.originalTransform.scale)
        }

        this.activeAnimations.delete(id)
        break
      }
    }
  }

  update(deltaTime: number): void {
    const currentTime = Date.now()

    // Update animations
    for (const [id, animation] of this.activeAnimations) {
      const elapsed = currentTime - animation.startTime
      const progress = Math.min(elapsed / animation.duration, 1)

      if (progress >= 1) {
        // Animation complete
        if (animation.mesh && animation.originalTransform) {
          animation.mesh.position.copy(animation.originalTransform.position)
          animation.mesh.rotation.copy(animation.originalTransform.rotation)
          animation.mesh.scale.copy(animation.originalTransform.scale)
        }

        if (animation.onComplete) {
          animation.onComplete()
        }

        this.world.events.emit('combat:animation_completed', {
          entityId: animation.entityId,
          animationId: animation.animationId,
        })

        this.activeAnimations.delete(id)
      } else {
        // Update animation frame
        this.updateAnimationFrame(animation, elapsed)
      }
    }

    // Update effects
    for (const [id, effect] of this.activeEffects) {
      const elapsed = currentTime - effect.startTime
      const progress = Math.min(elapsed / effect.duration, 1)

      if (progress >= 1) {
        // Effect complete - cleanup
        this.cleanupEffect(effect)
        this.activeEffects.delete(id)
      } else {
        // Update effect
        this.updateEffect(effect, elapsed, progress)
      }
    }
  }

  private updateAnimationFrame(animation: ActiveAnimation, elapsed: number): void {
    if (!animation.mesh) {
      return
    }

    const animationDef = COMBAT_ANIMATIONS[animation.animationId]
    if (!animationDef) {
      return
    }

    // Find current frame
    let currentFrame: AnimationFrame | null = null
    let nextFrame: AnimationFrame | null = null

    for (let i = 0; i < animationDef.frames.length; i++) {
      const frame = animationDef.frames[i]
      if (frame.time <= elapsed) {
        currentFrame = frame
        nextFrame = animationDef.frames[i + 1] || null
      } else {
        break
      }
    }

    if (!currentFrame) {
      return
    }

    // Interpolate between frames if there's a next frame
    let t = 0
    if (nextFrame && nextFrame !== currentFrame) {
      t = (elapsed - currentFrame.time) / (nextFrame.time - currentFrame.time)
    }

    // Apply rotation
    if (currentFrame.rotation) {
      const rotation = animation.originalTransform.rotation.clone()
      const frameRotation = new THREE.Euler(
        ((currentFrame.rotation.x || 0) * Math.PI) / 180,
        ((currentFrame.rotation.y || 0) * Math.PI) / 180,
        ((currentFrame.rotation.z || 0) * Math.PI) / 180
      )

      if (nextFrame && nextFrame.rotation && t > 0) {
        const nextRotation = new THREE.Euler(
          ((nextFrame.rotation.x || 0) * Math.PI) / 180,
          ((nextFrame.rotation.y || 0) * Math.PI) / 180,
          ((nextFrame.rotation.z || 0) * Math.PI) / 180
        )

        frameRotation.x += (nextRotation.x - frameRotation.x) * t
        frameRotation.y += (nextRotation.y - frameRotation.y) * t
        frameRotation.z += (nextRotation.z - frameRotation.z) * t
      }

      rotation.x += frameRotation.x
      rotation.y += frameRotation.y
      rotation.z += frameRotation.z
      animation.mesh.rotation.copy(rotation)
    }

    // Apply position
    if (currentFrame.position) {
      const position = animation.originalTransform.position.clone()
      position.x += currentFrame.position.x || 0
      position.y += currentFrame.position.y || 0
      position.z += currentFrame.position.z || 0

      if (nextFrame && nextFrame.position && t > 0) {
        position.x += ((nextFrame.position.x || 0) - (currentFrame.position.x || 0)) * t
        position.y += ((nextFrame.position.y || 0) - (currentFrame.position.y || 0)) * t
        position.z += ((nextFrame.position.z || 0) - (currentFrame.position.z || 0)) * t
      }

      animation.mesh.position.copy(position)
    }

    // Apply scale
    if (currentFrame.scale) {
      const scale = animation.originalTransform.scale.clone()
      scale.x *= currentFrame.scale.x || 1
      scale.y *= currentFrame.scale.y || 1
      scale.z *= currentFrame.scale.z || 1

      if (nextFrame && nextFrame.scale && t > 0) {
        scale.x *= 1 + ((nextFrame.scale.x || 1) - (currentFrame.scale.x || 1)) * t
        scale.y *= 1 + ((nextFrame.scale.y || 1) - (currentFrame.scale.y || 1)) * t
        scale.z *= 1 + ((nextFrame.scale.z || 1) - (currentFrame.scale.z || 1)) * t
      }

      animation.mesh.scale.copy(scale)
    }
  }

  private updateEffect(effect: CombatEffect, elapsed: number, progress: number): void {
    switch (effect.type) {
      case 'ranged_projectile':
        this.updateProjectile(effect, progress)
        break
      case 'magic_particles':
        this.updateMagicParticles(effect, elapsed)
        break
      case 'hit_splat':
        this.updateHitSplat(effect, progress)
        break
      case 'death_effect':
        this.updateDeathEffect(effect, elapsed)
        break
    }
  }

  private updateProjectile(effect: CombatEffect, progress: number): void {
    if (!effect.mesh || !effect.target) {
      return
    }

    const startPos = effect.source
    const endPos = effect.target

    // Linear interpolation with arc
    const x = startPos.x + (endPos.x - startPos.x) * progress
    const z = startPos.z + (endPos.z - startPos.z) * progress
    const y = startPos.y + (endPos.y - startPos.y) * progress + Math.sin(progress * Math.PI) * 2 // Arc trajectory

    effect.mesh.position.set(x, y, z)
  }

  private updateMagicParticles(effect: CombatEffect, elapsed: number): void {
    if (!effect.particles) {
      return
    }

    for (const particle of effect.particles) {
      if (!particle.userData.velocity) {
        continue
      }

      particle.position.x += particle.userData.velocity.x
      particle.position.y += particle.userData.velocity.y
      particle.position.z += particle.userData.velocity.z

      // Apply gravity
      particle.userData.velocity.y -= 0.001

      // Fade out over time
      const fadeProgress = elapsed / effect.duration
      if (particle.material) {
        particle.material.opacity = 1 - fadeProgress
      }
    }
  }

  private updateHitSplat(effect: CombatEffect, progress: number): void {
    if (!effect.mesh) {
      return
    }

    // Float upward and fade out
    const startY = effect.source.y + 2
    effect.mesh.position.y = startY + progress * 2

    if (effect.mesh.material) {
      effect.mesh.material.opacity = 1 - progress
    }
  }

  private updateDeathEffect(effect: CombatEffect, elapsed: number): void {
    if (!effect.particles) {
      return
    }

    for (const particle of effect.particles) {
      if (!particle.userData.velocity) {
        continue
      }

      particle.position.x += particle.userData.velocity.x
      particle.position.y += particle.userData.velocity.y
      particle.position.z += particle.userData.velocity.z

      // Apply gravity and air resistance
      particle.userData.velocity.y -= 0.002
      particle.userData.velocity.x *= 0.98
      particle.userData.velocity.z *= 0.98

      // Fade out
      const fadeProgress = elapsed / effect.duration
      if (particle.material) {
        particle.material.opacity = 1 - fadeProgress
      }
    }
  }

  private cleanupEffect(effect: CombatEffect): void {
    const visualSystem = this.world.systems.find(s => s.constructor.name === 'VisualRepresentationSystem')
    if (!visualSystem) {
      return
    }

    // Remove mesh
    if (effect.mesh && (visualSystem as any).removeMesh) {
      ;(visualSystem as any).removeMesh(effect.mesh)
    }

    // Remove particles
    if (effect.particles) {
      for (const particle of effect.particles) {
        if ((visualSystem as any).removeMesh) {
          ;(visualSystem as any).removeMesh(particle)
        }
      }
    }
  }

  serialize(): any {
    return {
      activeAnimations: Object.fromEntries(this.activeAnimations),
      activeEffects: Object.fromEntries(this.activeEffects),
      animationCounter: this.animationCounter,
      effectCounter: this.effectCounter,
    }
  }

  deserialize(data: any): void {
    if (data.activeAnimations) {
      this.activeAnimations = new Map(Object.entries(data.activeAnimations))
    }
    if (data.activeEffects) {
      this.activeEffects = new Map(Object.entries(data.activeEffects))
    }
    if (data.animationCounter) {
      this.animationCounter = data.animationCounter
    }
    if (data.effectCounter) {
      this.effectCounter = data.effectCounter
    }
  }
}
