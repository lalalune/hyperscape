/**
 * Weapon Orientation and Attachment System
 *
 * Advanced system for determining optimal weapon orientation,
 * attachment points, and physics properties for RPG items.
 */

import { Vector3, Quaternion, BoundingBox, WeaponAnalysis } from './HandPlacementDetector'

export interface AttachmentPoint {
  name: string
  position: Vector3
  rotation: Quaternion
  socketType: 'hand' | 'back' | 'belt' | 'holster' | 'quiver' | 'shield_arm'
  priority: number // Higher = preferred attachment
}

export interface PhysicsProperties {
  mass: number
  centerOfMass: Vector3
  inertiaTensor: Vector3
  damping: number
  angularDamping: number
  restitution: number
  friction: number
}

export interface WeaponOrientation {
  restPosition: Quaternion // How weapon is held when idle
  combatPosition: Quaternion // How weapon is held during combat
  sheathedPosition: Quaternion // How weapon is positioned when sheathed
  blockPosition?: Quaternion // For defensive weapons
}

export interface WeaponConfiguration {
  weaponAnalysis: WeaponAnalysis
  attachmentPoints: AttachmentPoint[]
  physicsProperties: PhysicsProperties
  orientation: WeaponOrientation
  animations: WeaponAnimationSet
  metadata: WeaponMetadata
}

export interface WeaponAnimationSet {
  idle: string[]
  attack: string[]
  block?: string[]
  sheath: string[]
  unsheath: string[]
}

export interface WeaponMetadata {
  damage: number
  range: number
  attackSpeed: number
  durability: number
  requirements: {
    strength?: number
    dexterity?: number
    level?: number
  }
  enchantmentSlots: number
  value: number
}

export class WeaponOrientationSystem {
  private weaponConfigurations: Map<string, WeaponTemplate>
  private characterBones: Map<string, Vector3>

  constructor() {
    this.weaponConfigurations = new Map()
    this.characterBones = new Map()
    this.initializeWeaponTemplates()
    this.initializeCharacterBones()
  }

  /**
   * Generate complete weapon configuration from analysis
   */
  async generateWeaponConfiguration(
    weaponAnalysis: WeaponAnalysis,
    itemDescription?: string
  ): Promise<WeaponConfiguration> {
    console.log(`⚙️ Generating weapon configuration for ${weaponAnalysis.weaponType}...`)

    const template =
      this.weaponConfigurations.get(weaponAnalysis.weaponType) || this.weaponConfigurations.get('default')!

    // Generate attachment points
    const attachmentPoints = this.generateAttachmentPoints(weaponAnalysis, template)

    // Calculate physics properties
    const physicsProperties = this.calculatePhysicsProperties(weaponAnalysis, template)

    // Determine optimal orientations
    const orientation = this.calculateWeaponOrientations(weaponAnalysis, template)

    // Generate animation set
    const animations = this.generateAnimationSet(weaponAnalysis.weaponType, template)

    // Calculate metadata
    const metadata = this.calculateWeaponMetadata(weaponAnalysis, itemDescription, template)

    const configuration: WeaponConfiguration = {
      weaponAnalysis,
      attachmentPoints,
      physicsProperties,
      orientation,
      animations,
      metadata,
    }

    console.log('✅ Weapon configuration generated successfully')
    console.log(`   Attachment points: ${attachmentPoints.length}`)
    console.log(`   Physics mass: ${physicsProperties.mass.toFixed(2)}kg`)
    console.log(`   Base damage: ${metadata.damage}`)

    return configuration
  }

  /**
   * Generate attachment points for character interaction
   */
  private generateAttachmentPoints(weaponAnalysis: WeaponAnalysis, template: WeaponTemplate): AttachmentPoint[] {
    const points: AttachmentPoint[] = []

    // Primary hand attachment (always present)
    const primaryGrip = weaponAnalysis.grips.find(g => g.gripType === 'primary')
    if (primaryGrip) {
      points.push({
        name: 'primary_grip',
        position: primaryGrip.position,
        rotation: primaryGrip.rotation,
        socketType: 'hand',
        priority: 100,
      })
    }

    // Secondary hand attachment (for two-handed weapons)
    const secondaryGrip = weaponAnalysis.grips.find(g => g.gripType === 'secondary')
    if (secondaryGrip) {
      points.push({
        name: 'secondary_grip',
        position: secondaryGrip.position,
        rotation: secondaryGrip.rotation,
        socketType: 'hand',
        priority: 90,
      })
    }

    // Sheathed attachment points
    template.sheathedAttachments.forEach((attachment, index) => {
      const position = this.calculateSheathedPosition(weaponAnalysis.boundingBox, attachment)
      points.push({
        name: `sheathed_${attachment.socketType}_${index}`,
        position,
        rotation: attachment.rotation,
        socketType: attachment.socketType,
        priority: attachment.priority,
      })
    })

    return points
  }

  /**
   * Calculate physics properties based on weapon analysis
   */
  private calculatePhysicsProperties(weaponAnalysis: WeaponAnalysis, template: WeaponTemplate): PhysicsProperties {
    const { boundingBox } = weaponAnalysis
    const volume = boundingBox.dimensions.x * boundingBox.dimensions.y * boundingBox.dimensions.z

    // Base mass calculation
    const baseMass = volume * template.density
    const mass = Math.max(baseMass, template.minMass)

    // Center of mass (typically towards the handle for weapons)
    const centerOfMass = this.calculateCenterOfMass(weaponAnalysis, template)

    // Inertia tensor (simplified calculation)
    const inertiaTensor = this.calculateInertiaTensor(boundingBox.dimensions, mass)

    return {
      mass,
      centerOfMass,
      inertiaTensor,
      damping: template.damping,
      angularDamping: template.angularDamping,
      restitution: template.restitution,
      friction: template.friction,
    }
  }

  /**
   * Calculate weapon orientations for different states
   */
  private calculateWeaponOrientations(weaponAnalysis: WeaponAnalysis, template: WeaponTemplate): WeaponOrientation {
    const baseOrientation = weaponAnalysis.orientation

    return {
      restPosition: this.applyOrientationOffset(baseOrientation, template.restOffset),
      combatPosition: this.applyOrientationOffset(baseOrientation, template.combatOffset),
      sheathedPosition: this.applyOrientationOffset(baseOrientation, template.sheathedOffset),
      blockPosition: template.blockOffset
        ? this.applyOrientationOffset(baseOrientation, template.blockOffset)
        : undefined,
    }
  }

  /**
   * Generate animation set for weapon type
   */
  private generateAnimationSet(weaponType: string, template: WeaponTemplate): WeaponAnimationSet {
    const baseAnimations = template.animations

    return {
      idle: baseAnimations.idle.map(anim => `${weaponType}_${anim}`),
      attack: baseAnimations.attack.map(anim => `${weaponType}_${anim}`),
      block: baseAnimations.block?.map(anim => `${weaponType}_${anim}`),
      sheath: baseAnimations.sheath.map(anim => `${weaponType}_${anim}`),
      unsheath: baseAnimations.unsheath.map(anim => `${weaponType}_${anim}`),
    }
  }

  /**
   * Calculate weapon metadata and stats
   */
  private calculateWeaponMetadata(
    weaponAnalysis: WeaponAnalysis,
    description: string | undefined,
    template: WeaponTemplate
  ): WeaponMetadata {
    const { boundingBox } = weaponAnalysis

    // Base damage calculation based on weapon size and type
    const sizeMultiplier = Math.max(
      0.5, // Minimum size multiplier to ensure reasonable damage
      Math.sqrt(boundingBox.dimensions.x * boundingBox.dimensions.y * boundingBox.dimensions.z)
    )
    const baseDamage = template.baseDamage * sizeMultiplier

    // Range calculation
    const range = template.baseRange * Math.max(boundingBox.dimensions.x, boundingBox.dimensions.z)

    return {
      damage: Math.round(baseDamage),
      range: Math.round(range * 100) / 100,
      attackSpeed: template.attackSpeed,
      durability: template.durability,
      requirements: { ...template.requirements },
      enchantmentSlots: template.enchantmentSlots,
      value: Math.round(baseDamage * template.valueMultiplier),
    }
  }

  /**
   * Calculate center of mass for weapon
   */
  private calculateCenterOfMass(weaponAnalysis: WeaponAnalysis, template: WeaponTemplate): Vector3 {
    const { boundingBox } = weaponAnalysis
    const primaryGrip = weaponAnalysis.grips.find(g => g.gripType === 'primary')

    if (primaryGrip && template.centerOfMassOffset) {
      return {
        x: primaryGrip.position.x + template.centerOfMassOffset.x,
        y: primaryGrip.position.y + template.centerOfMassOffset.y,
        z: primaryGrip.position.z + template.centerOfMassOffset.z,
      }
    }

    return boundingBox.center
  }

  /**
   * Calculate inertia tensor (simplified)
   */
  private calculateInertiaTensor(dimensions: Vector3, mass: number): Vector3 {
    const { x, y, z } = dimensions

    return {
      x: (mass / 12) * (y * y + z * z),
      y: (mass / 12) * (x * x + z * z),
      z: (mass / 12) * (x * x + y * y),
    }
  }

  /**
   * Apply orientation offset to quaternion
   */
  private applyOrientationOffset(base: Quaternion, offset: Vector3): Quaternion {
    // Convert offset Euler angles to quaternion and multiply
    const offsetQuat = this.eulerToQuaternion(offset)
    return this.multiplyQuaternions(base, offsetQuat)
  }

  /**
   * Convert Euler angles to quaternion
   */
  private eulerToQuaternion(euler: Vector3): Quaternion {
    const { x, y, z } = euler

    const cx = Math.cos(x * 0.5)
    const sx = Math.sin(x * 0.5)
    const cy = Math.cos(y * 0.5)
    const sy = Math.sin(y * 0.5)
    const cz = Math.cos(z * 0.5)
    const sz = Math.sin(z * 0.5)

    return {
      x: sx * cy * cz - cx * sy * sz,
      y: cx * sy * cz + sx * cy * sz,
      z: cx * cy * sz - sx * sy * cz,
      w: cx * cy * cz + sx * sy * sz,
    }
  }

  /**
   * Multiply two quaternions
   */
  private multiplyQuaternions(a: Quaternion, b: Quaternion): Quaternion {
    return {
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y + a.y * b.w + a.z * b.x - a.x * b.z,
      z: a.w * b.z + a.z * b.w + a.x * b.y - a.y * b.x,
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    }
  }

  /**
   * Calculate sheathed position relative to character bones
   */
  private calculateSheathedPosition(boundingBox: BoundingBox, attachment: SheathedAttachment): Vector3 {
    const bonePosition = this.characterBones.get(attachment.boneName) || { x: 0, y: 0, z: 0 }

    return {
      x: bonePosition.x + attachment.offset.x,
      y: bonePosition.y + attachment.offset.y,
      z: bonePosition.z + attachment.offset.z,
    }
  }

  /**
   * Initialize weapon templates with default configurations
   */
  private initializeWeaponTemplates(): void {
    // Sword template
    this.weaponConfigurations.set('sword', {
      density: 7.85, // Steel density kg/m³ (scaled)
      minMass: 1.0,
      baseDamage: 25,
      baseRange: 1.2,
      attackSpeed: 1.0,
      durability: 100,
      enchantmentSlots: 2,
      valueMultiplier: 10,
      requirements: { strength: 10, level: 1 },
      damping: 0.1,
      angularDamping: 0.2,
      restitution: 0.3,
      friction: 0.7,
      centerOfMassOffset: { x: 0, y: -0.1, z: 0 },
      restOffset: { x: 0, y: 0, z: 0 },
      combatOffset: { x: 0.2, y: 0.1, z: 0 },
      sheathedOffset: { x: 0, y: 0, z: Math.PI },
      blockOffset: { x: 0.1, y: 0.2, z: 0 },
      sheathedAttachments: [
        {
          socketType: 'belt',
          boneName: 'hip_left',
          offset: { x: -0.1, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: Math.PI / 4, w: 1 },
          priority: 80,
        },
      ],
      animations: {
        idle: ['idle_sword'],
        attack: ['slash_horizontal', 'slash_vertical', 'thrust'],
        block: ['block_high', 'block_low'],
        sheath: ['sheath_sword'],
        unsheath: ['unsheath_sword'],
      },
    })

    // Axe template
    this.weaponConfigurations.set('axe', {
      density: 6.0,
      minMass: 1.5,
      baseDamage: 35,
      baseRange: 1.0,
      attackSpeed: 0.8,
      durability: 120,
      enchantmentSlots: 1,
      valueMultiplier: 12,
      requirements: { strength: 15, level: 5 },
      damping: 0.15,
      angularDamping: 0.25,
      restitution: 0.2,
      friction: 0.8,
      centerOfMassOffset: { x: 0, y: 0.2, z: 0 },
      restOffset: { x: 0, y: 0, z: 0 },
      combatOffset: { x: 0.3, y: 0.2, z: 0 },
      sheathedOffset: { x: 0, y: 0, z: Math.PI / 2 },
      sheathedAttachments: [
        {
          socketType: 'back',
          boneName: 'spine_upper',
          offset: { x: -0.2, y: 0.1, z: 0 },
          rotation: { x: 0, y: 0, z: Math.PI / 6, w: 1 },
          priority: 75,
        },
      ],
      animations: {
        idle: ['idle_axe'],
        attack: ['chop_overhead', 'chop_side'],
        block: ['block_axe'],
        sheath: ['sheath_axe'],
        unsheath: ['unsheath_axe'],
      },
    })

    // Staff template
    this.weaponConfigurations.set('staff', {
      density: 0.8, // Wood density
      minMass: 0.8,
      baseDamage: 15,
      baseRange: 1.8,
      attackSpeed: 1.2,
      durability: 80,
      enchantmentSlots: 3,
      valueMultiplier: 15,
      requirements: { level: 10 },
      damping: 0.05,
      angularDamping: 0.1,
      restitution: 0.4,
      friction: 0.6,
      centerOfMassOffset: { x: 0, y: 0, z: 0 },
      restOffset: { x: 0, y: 0, z: 0 },
      combatOffset: { x: 0, y: 0.2, z: 0 },
      sheathedOffset: { x: 0, y: 0, z: 0 },
      sheathedAttachments: [
        {
          socketType: 'back',
          boneName: 'spine_upper',
          offset: { x: 0, y: 0, z: -0.1 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          priority: 70,
        },
      ],
      animations: {
        idle: ['idle_staff'],
        attack: ['staff_thrust', 'staff_sweep'],
        sheath: ['sheath_staff'],
        unsheath: ['unsheath_staff'],
      },
    })

    // Bow template
    this.weaponConfigurations.set('bow', {
      density: 0.6, // Wood density
      minMass: 0.5,
      baseDamage: 20,
      baseRange: 2.5,
      attackSpeed: 0.9,
      durability: 90,
      enchantmentSlots: 2,
      valueMultiplier: 12,
      requirements: { dexterity: 12, level: 3 },
      damping: 0.05,
      angularDamping: 0.1,
      restitution: 0.5,
      friction: 0.4,
      centerOfMassOffset: { x: 0, y: 0, z: 0 },
      restOffset: { x: 0, y: 0, z: 0 },
      combatOffset: { x: 0, y: 0.1, z: 0 },
      sheathedOffset: { x: 0, y: 0, z: Math.PI / 2 },
      sheathedAttachments: [
        {
          socketType: 'back',
          boneName: 'shoulder_left',
          offset: { x: -0.1, y: 0, z: -0.05 },
          rotation: { x: 0, y: 0, z: Math.PI / 4, w: 1 },
          priority: 75,
        },
      ],
      animations: {
        idle: ['idle_bow'],
        attack: ['draw_bow', 'shoot_bow'],
        sheath: ['sheath_bow'],
        unsheath: ['unsheath_bow'],
      },
    })

    // Default template
    this.weaponConfigurations.set('default', {
      density: 5.0,
      minMass: 0.5,
      baseDamage: 20,
      baseRange: 1.0,
      attackSpeed: 1.0,
      durability: 100,
      enchantmentSlots: 1,
      valueMultiplier: 8,
      requirements: { level: 1 },
      damping: 0.1,
      angularDamping: 0.2,
      restitution: 0.3,
      friction: 0.7,
      centerOfMassOffset: { x: 0, y: 0, z: 0 },
      restOffset: { x: 0, y: 0, z: 0 },
      combatOffset: { x: 0.1, y: 0.1, z: 0 },
      sheathedOffset: { x: 0, y: 0, z: Math.PI },
      sheathedAttachments: [
        {
          socketType: 'belt',
          boneName: 'hip_right',
          offset: { x: 0.1, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          priority: 60,
        },
      ],
      animations: {
        idle: ['idle_default'],
        attack: ['attack_default'],
        sheath: ['sheath_default'],
        unsheath: ['unsheath_default'],
      },
    })
  }

  /**
   * Initialize character bone positions
   */
  private initializeCharacterBones(): void {
    this.characterBones.set('hip_left', { x: -0.15, y: 0.9, z: 0 })
    this.characterBones.set('hip_right', { x: 0.15, y: 0.9, z: 0 })
    this.characterBones.set('spine_upper', { x: 0, y: 1.4, z: 0 })
    this.characterBones.set('shoulder_left', { x: -0.2, y: 1.5, z: 0 })
    this.characterBones.set('shoulder_right', { x: 0.2, y: 1.5, z: 0 })
    this.characterBones.set('hand_left', { x: -0.3, y: 1.2, z: 0 })
    this.characterBones.set('hand_right', { x: 0.3, y: 1.2, z: 0 })
  }

  /**
   * Get available weapon types
   */
  getAvailableWeaponTypes(): string[] {
    return Array.from(this.weaponConfigurations.keys()).filter(key => key !== 'default')
  }

  /**
   * Batch process multiple weapon configurations
   */
  async batchGenerateConfigurations(analyses: WeaponAnalysis[]): Promise<WeaponConfiguration[]> {
    console.log(`🔄 Batch generating configurations for ${analyses.length} weapons...`)

    const configurations: WeaponConfiguration[] = []

    for (const analysis of analyses) {
      try {
        const config = await this.generateWeaponConfiguration(analysis)
        configurations.push(config)
      } catch (error) {
        console.error(`❌ Failed to generate configuration for ${analysis.weaponType}:`, error)
        throw error
      }
    }

    console.log('✅ Batch configuration generation complete')
    return configurations
  }
}

/**
 * Weapon template interface
 */
export interface WeaponTemplate {
  density: number
  minMass: number
  baseDamage: number
  baseRange: number
  attackSpeed: number
  durability: number
  enchantmentSlots: number
  valueMultiplier: number
  requirements: {
    strength?: number
    dexterity?: number
    level?: number
  }
  damping: number
  angularDamping: number
  restitution: number
  friction: number
  centerOfMassOffset?: Vector3
  restOffset: Vector3
  combatOffset: Vector3
  sheathedOffset: Vector3
  blockOffset?: Vector3
  sheathedAttachments: SheathedAttachment[]
  animations: {
    idle: string[]
    attack: string[]
    block?: string[]
    sheath: string[]
    unsheath: string[]
  }
}

export interface SheathedAttachment {
  socketType: 'hand' | 'back' | 'belt' | 'holster' | 'quiver' | 'shield_arm'
  boneName: string
  offset: Vector3
  rotation: Quaternion
  priority: number
}
