/**
 * Hand Placement Detection System
 *
 * Intelligent system for detecting grip points and orientation for weapons
 * and tools based on 3D model geometry and heuristic analysis.
 */

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface Quaternion {
  x: number
  y: number
  z: number
  w: number
}

export interface BoundingBox {
  min: Vector3
  max: Vector3
  center: Vector3
  dimensions: Vector3
}

export interface HandGrip {
  position: Vector3
  rotation: Quaternion
  gripType: 'primary' | 'secondary'
  confidence: number // 0-1
  radius: number // Grip radius
}

export interface WeaponAnalysis {
  weaponType: 'sword' | 'axe' | 'bow' | 'staff' | 'shield' | 'dagger' | 'mace' | 'spear'
  orientation: Quaternion
  grips: HandGrip[]
  attachmentPoint: Vector3 // Where weapon attaches to character
  boundingBox: BoundingBox
  confidence: number
}

export interface GeometryData {
  vertices: Float32Array
  faces: Uint32Array
  normals?: Float32Array
  uvs?: Float32Array
}

export class HandPlacementDetector {
  private weaponHeuristics: Map<string, WeaponHeuristic>

  constructor() {
    this.weaponHeuristics = new Map()
    this.initializeWeaponHeuristics()
  }

  /**
   * Analyze weapon geometry and detect hand placement
   */
  async analyzeWeapon(geometryData: GeometryData, weaponType: string, description?: string): Promise<WeaponAnalysis> {
    console.log(`🔍 Analyzing ${weaponType} for hand placement...`)

    // Calculate bounding box
    const boundingBox = this.calculateBoundingBox(geometryData.vertices)

    // Get weapon-specific heuristic
    const heuristic = this.weaponHeuristics.get(weaponType) || this.weaponHeuristics.get('default')!

    // Detect weapon orientation
    const orientation = this.detectWeaponOrientation(geometryData, boundingBox, heuristic)

    // Find grip points
    const grips = this.findGripPoints(geometryData, boundingBox, heuristic, orientation)

    // Determine attachment point
    const attachmentPoint = this.calculateAttachmentPoint(boundingBox, grips, heuristic)

    // Calculate overall confidence
    const confidence = this.calculateConfidence(grips, boundingBox, heuristic)

    const analysis: WeaponAnalysis = {
      weaponType: weaponType as any,
      orientation,
      grips,
      attachmentPoint,
      boundingBox,
      confidence,
    }

    console.log(`✅ Weapon analysis complete. Confidence: ${(confidence * 100).toFixed(1)}%`)
    console.log(
      `   Grips found: ${grips.length}, Primary at: (${grips[0]?.position.x.toFixed(2)}, ${grips[0]?.position.y.toFixed(2)}, ${grips[0]?.position.z.toFixed(2)})`
    )

    return analysis
  }

  /**
   * Calculate bounding box of geometry
   */
  private calculateBoundingBox(vertices: Float32Array): BoundingBox {
    // Handle empty geometry
    if (vertices.length === 0) {
      return {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
        center: { x: 0, y: 0, z: 0 },
        dimensions: { x: 0, y: 0, z: 0 },
      }
    }

    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity

    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i]
      const y = vertices[i + 1]
      const z = vertices[i + 2]

      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      minZ = Math.min(minZ, z)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
      maxZ = Math.max(maxZ, z)
    }

    const min = { x: minX, y: minY, z: minZ }
    const max = { x: maxX, y: maxY, z: maxZ }
    const center = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2,
    }
    const dimensions = {
      x: maxX - minX,
      y: maxY - minY,
      z: maxZ - minZ,
    }

    return { min, max, center, dimensions }
  }

  /**
   * Detect weapon orientation based on geometry analysis
   */
  private detectWeaponOrientation(
    geometryData: GeometryData,
    boundingBox: BoundingBox,
    heuristic: WeaponHeuristic
  ): Quaternion {
    // Find the longest axis - this is typically the weapon's main axis
    const { dimensions } = boundingBox

    let primaryAxis: 'x' | 'y' | 'z' = 'y' // Default to Y-up
    let maxDimension = dimensions.y

    if (dimensions.x > maxDimension) {
      primaryAxis = 'x'
      maxDimension = dimensions.x
    }
    if (dimensions.z > maxDimension) {
      primaryAxis = 'z'
    }

    // Apply weapon-specific orientation logic
    return this.calculateOrientationQuaternion(primaryAxis, heuristic.defaultOrientation)
  }

  /**
   * Find grip points on the weapon
   */
  private findGripPoints(
    geometryData: GeometryData,
    boundingBox: BoundingBox,
    heuristic: WeaponHeuristic,
    orientation: Quaternion
  ): HandGrip[] {
    const grips: HandGrip[] = []

    // Primary grip detection
    const primaryGrip = this.findPrimaryGrip(boundingBox, heuristic)
    if (primaryGrip) {
      grips.push(primaryGrip)
    }

    // Secondary grip detection (for two-handed weapons)
    if (heuristic.twoHanded) {
      const secondaryGrip = this.findSecondaryGrip(boundingBox, heuristic, primaryGrip)
      if (secondaryGrip) {
        grips.push(secondaryGrip)
      }
    }

    return grips
  }

  /**
   * Find primary grip point
   */
  private findPrimaryGrip(boundingBox: BoundingBox, heuristic: WeaponHeuristic): HandGrip | null {
    const { center, dimensions } = boundingBox

    // Apply heuristic-based offset
    const gripPosition: Vector3 = {
      x: center.x + dimensions.x * heuristic.primaryGripOffset.x,
      y: center.y + dimensions.y * heuristic.primaryGripOffset.y,
      z: center.z + dimensions.z * heuristic.primaryGripOffset.z,
    }

    return {
      position: gripPosition,
      rotation: { x: 0, y: 0, z: 0, w: 1 }, // Identity quaternion
      gripType: 'primary',
      confidence: heuristic.primaryGripConfidence,
      radius: heuristic.gripRadius,
    }
  }

  /**
   * Find secondary grip point for two-handed weapons
   */
  private findSecondaryGrip(
    boundingBox: BoundingBox,
    heuristic: WeaponHeuristic,
    primaryGrip: HandGrip | null
  ): HandGrip | null {
    if (!heuristic.twoHanded || !heuristic.secondaryGripOffset || !primaryGrip) {
      return null
    }

    const { center, dimensions } = boundingBox

    const gripPosition: Vector3 = {
      x: center.x + dimensions.x * heuristic.secondaryGripOffset.x,
      y: center.y + dimensions.y * heuristic.secondaryGripOffset.y,
      z: center.z + dimensions.z * heuristic.secondaryGripOffset.z,
    }

    return {
      position: gripPosition,
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      gripType: 'secondary',
      confidence: heuristic.secondaryGripConfidence || 0.7,
      radius: heuristic.gripRadius,
    }
  }

  /**
   * Calculate weapon attachment point to character
   */
  private calculateAttachmentPoint(boundingBox: BoundingBox, grips: HandGrip[], heuristic: WeaponHeuristic): Vector3 {
    const primaryGrip = grips.find(g => g.gripType === 'primary')

    if (primaryGrip) {
      // Attachment point is typically near the primary grip
      return {
        x: primaryGrip.position.x + heuristic.attachmentOffset.x,
        y: primaryGrip.position.y + heuristic.attachmentOffset.y,
        z: primaryGrip.position.z + heuristic.attachmentOffset.z,
      }
    }

    // Fallback to center
    return boundingBox.center
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(grips: HandGrip[], boundingBox: BoundingBox, heuristic: WeaponHeuristic): number {
    if (grips.length === 0) {
      return 0
    }

    const primaryGrip = grips.find(g => g.gripType === 'primary')
    if (!primaryGrip) {
      return 0
    }

    // If geometry is empty (zero dimensions), confidence should be 0
    if (boundingBox.dimensions.x === 0 && boundingBox.dimensions.y === 0 && boundingBox.dimensions.z === 0) {
      return 0
    }

    let confidence = primaryGrip.confidence

    // Boost confidence if we found expected number of grips
    const expectedGrips = heuristic.twoHanded ? 2 : 1
    if (grips.length === expectedGrips) {
      confidence *= 1.2
    }

    // Check if weapon proportions match expectations
    const aspectRatio = this.calculateAspectRatio(boundingBox)
    if (this.isWithinExpectedProportions(aspectRatio, heuristic)) {
      confidence *= 1.1
    }

    return Math.min(confidence, 1.0)
  }

  /**
   * Calculate aspect ratio of bounding box
   */
  private calculateAspectRatio(boundingBox: BoundingBox): { xy: number; xz: number; yz: number } {
    const { dimensions } = boundingBox
    return {
      xy: dimensions.x / dimensions.y,
      xz: dimensions.x / dimensions.z,
      yz: dimensions.y / dimensions.z,
    }
  }

  /**
   * Check if proportions match weapon type expectations
   */
  private isWithinExpectedProportions(
    aspectRatio: { xy: number; xz: number; yz: number },
    heuristic: WeaponHeuristic
  ): boolean {
    // This would contain weapon-specific proportion checks
    // For now, return true as a placeholder
    return true
  }

  /**
   * Calculate orientation quaternion
   */
  private calculateOrientationQuaternion(primaryAxis: 'x' | 'y' | 'z', defaultOrientation: Vector3): Quaternion {
    // Convert Euler angles to quaternion
    const { x, y, z } = defaultOrientation

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
   * Initialize weapon-specific heuristics
   */
  private initializeWeaponHeuristics(): void {
    // Sword heuristics
    this.weaponHeuristics.set('sword', {
      twoHanded: false,
      primaryGripOffset: { x: 0, y: -0.3, z: 0 }, // Near the hilt
      attachmentOffset: { x: 0, y: -0.1, z: 0 },
      defaultOrientation: { x: 0, y: 0, z: 0 },
      primaryGripConfidence: 0.9,
      gripRadius: 0.03,
    })

    // Two-handed sword heuristics
    this.weaponHeuristics.set('greatsword', {
      twoHanded: true,
      primaryGripOffset: { x: 0, y: -0.25, z: 0 },
      secondaryGripOffset: { x: 0, y: -0.35, z: 0 },
      attachmentOffset: { x: 0, y: -0.1, z: 0 },
      defaultOrientation: { x: 0, y: 0, z: 0 },
      primaryGripConfidence: 0.9,
      secondaryGripConfidence: 0.8,
      gripRadius: 0.035,
    })

    // Axe heuristics
    this.weaponHeuristics.set('axe', {
      twoHanded: false,
      primaryGripOffset: { x: 0, y: -0.4, z: 0 }, // Near the end of handle
      attachmentOffset: { x: 0, y: -0.2, z: 0 },
      defaultOrientation: { x: 0, y: 0, z: 0 },
      primaryGripConfidence: 0.85,
      gripRadius: 0.035,
    })

    // Staff heuristics
    this.weaponHeuristics.set('staff', {
      twoHanded: true,
      primaryGripOffset: { x: 0, y: -0.2, z: 0 },
      secondaryGripOffset: { x: 0, y: 0.1, z: 0 },
      attachmentOffset: { x: 0, y: 0, z: 0 },
      defaultOrientation: { x: 0, y: 0, z: 0 },
      primaryGripConfidence: 0.8,
      secondaryGripConfidence: 0.75,
      gripRadius: 0.025,
    })

    // Bow heuristics
    this.weaponHeuristics.set('bow', {
      twoHanded: true,
      primaryGripOffset: { x: 0, y: 0, z: 0 }, // Center grip
      secondaryGripOffset: { x: 0, y: 0.2, z: 0 }, // String hand
      attachmentOffset: { x: 0, y: 0, z: 0 },
      defaultOrientation: { x: 0, y: Math.PI / 2, z: 0 }, // Rotated 90 degrees
      primaryGripConfidence: 0.9,
      secondaryGripConfidence: 0.7,
      gripRadius: 0.02,
    })

    // Shield heuristics
    this.weaponHeuristics.set('shield', {
      twoHanded: false,
      primaryGripOffset: { x: 0, y: 0, z: -0.1 }, // Behind shield surface
      attachmentOffset: { x: 0, y: 0, z: -0.05 },
      defaultOrientation: { x: 0, y: 0, z: 0 },
      primaryGripConfidence: 0.85,
      gripRadius: 0.04,
    })

    // Spear heuristics
    this.weaponHeuristics.set('spear', {
      twoHanded: true,
      primaryGripOffset: { x: 0, y: -0.1, z: 0 },
      secondaryGripOffset: { x: 0, y: -0.3, z: 0 },
      attachmentOffset: { x: 0, y: -0.2, z: 0 },
      defaultOrientation: { x: 0, y: 0, z: 0 },
      primaryGripConfidence: 0.8,
      secondaryGripConfidence: 0.75,
      gripRadius: 0.025,
    })

    // Default heuristics
    this.weaponHeuristics.set('default', {
      twoHanded: false,
      primaryGripOffset: { x: 0, y: -0.3, z: 0 },
      attachmentOffset: { x: 0, y: -0.1, z: 0 },
      defaultOrientation: { x: 0, y: 0, z: 0 },
      primaryGripConfidence: 0.6,
      gripRadius: 0.03,
    })
  }

  /**
   * Get all available weapon types
   */
  getAvailableWeaponTypes(): string[] {
    return Array.from(this.weaponHeuristics.keys()).filter(key => key !== 'default')
  }

  /**
   * Update weapon heuristic
   */
  updateWeaponHeuristic(weaponType: string, heuristic: WeaponHeuristic): void {
    this.weaponHeuristics.set(weaponType, heuristic)
    console.log(`✅ Updated heuristic for weapon type: ${weaponType}`)
  }

  /**
   * Analyze multiple weapons in batch
   */
  async batchAnalyze(
    weaponData: Array<{
      geometryData: GeometryData
      weaponType: string
      description?: string
    }>
  ): Promise<WeaponAnalysis[]> {
    console.log(`🔄 Batch analyzing ${weaponData.length} weapons...`)

    const results: WeaponAnalysis[] = []

    for (const weapon of weaponData) {
      try {
        const analysis = await this.analyzeWeapon(weapon.geometryData, weapon.weaponType, weapon.description)
        results.push(analysis)
      } catch (error) {
        console.error(`❌ Failed to analyze ${weapon.weaponType}:`, error)
        throw error
      }
    }

    console.log(`✅ Batch analysis complete. ${results.length} weapons analyzed.`)
    return results
  }
}

/**
 * Weapon-specific heuristic configuration
 */
export interface WeaponHeuristic {
  twoHanded: boolean
  primaryGripOffset: Vector3 // Relative to bounding box center
  secondaryGripOffset?: Vector3 // For two-handed weapons
  attachmentOffset: Vector3 // Where weapon attaches to character
  defaultOrientation: Vector3 // Euler angles
  primaryGripConfidence: number
  secondaryGripConfidence?: number
  gripRadius: number
}
