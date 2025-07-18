/**
 * Hardpoint Detection Service for Weapons
 * 
 * Automatically detects and assigns hardpoints (grip positions, attachment points)
 * for AI-generated weapon models with heuristic analysis and visualization.
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
  size: Vector3
}

export interface GeometryAnalysis {
  boundingBox: BoundingBox
  vertexCount: number
  triangleCount: number
  surfaceArea: number
  volume: number
  massCenter: Vector3
  principalAxes: {
    primary: Vector3
    secondary: Vector3
    tertiary: Vector3
  }
}

export interface HardpointCandidate {
  position: Vector3
  rotation: Quaternion
  confidence: number
  type: 'primary_grip' | 'secondary_grip' | 'attachment' | 'projectile_origin' | 'impact_point'
  reasoning: string[]
  geometricFeatures: {
    localRadius: number
    surfaceCurvature: number
    symmetry: number
    accessibility: number
  }
}

export interface DetectedHardpoints {
  weaponType: string
  primaryGrip: HardpointCandidate
  secondaryGrip?: HardpointCandidate
  attachmentPoints: HardpointCandidate[]
  projectileOrigin?: HardpointCandidate
  impactPoint?: HardpointCandidate
  specialPoints: Record<string, HardpointCandidate>
  confidence: number
  analysisMetadata: {
    geometryAnalysis: GeometryAnalysis
    detectionMethod: string
    processingTime: number
    visualizationData: VisualizationData
  }
}

export interface VisualizationData {
  hardpointMarkers: Array<{
    position: Vector3
    type: string
    confidence: number
    color: string
    size: number
  }>
  orientationVectors: Array<{
    origin: Vector3
    direction: Vector3
    type: 'grip_direction' | 'attack_direction' | 'balance_axis'
    color: string
  }>
  geometryHighlights: Array<{
    vertices: number[]
    type: 'handle_area' | 'blade_area' | 'guard_area' | 'pommel_area'
    color: string
    opacity: number
  }>
  confidenceHeatmap: {
    vertices: Vector3[]
    confidenceValues: number[]
    colorMap: 'red_to_green' | 'blue_to_red'
  }
}

export interface HardpointAccuracyMetrics {
  overallScore: number
  gripAccuracy: number
  orientationAccuracy: number
  functionalityScore: number
  ergonomicsScore: number
  detailedMetrics: {
    gripPositionError: number // Distance from ideal position
    gripOrientationError: number // Angle difference from ideal
    balancePointAccuracy: number
    functionalAlignmentScore: number
  }
}

export class HardpointDetectionService {
  private confidenceThreshold: number = 0.7
  private visualizationEnabled: boolean = true

  constructor(config: { confidenceThreshold?: number; visualizationEnabled?: boolean } = {}) {
    this.confidenceThreshold = config.confidenceThreshold || 0.7
    this.visualizationEnabled = config.visualizationEnabled !== false
  }

  /**
   * Detect hardpoints for a weapon model
   */
  async detectWeaponHardpoints(
    geometry: any,
    weaponType: string,
    orientationHints?: any
  ): Promise<DetectedHardpoints> {
    console.log(`🔍 Detecting hardpoints for ${weaponType}`)
    const startTime = Date.now()

    // Analyze geometry properties
    const geometryAnalysis = this.analyzeGeometry(geometry)

    // Detect hardpoints based on weapon type
    const hardpoints = await this.detectByWeaponType(geometry, weaponType, geometryAnalysis, orientationHints)

    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(hardpoints)

    // Generate visualization data
    const visualizationData = this.generateVisualizationData(hardpoints, geometryAnalysis)

    const processingTime = Date.now() - startTime

    const result: DetectedHardpoints = {
      weaponType,
      primaryGrip: hardpoints.primaryGrip,
      secondaryGrip: hardpoints.secondaryGrip,
      attachmentPoints: hardpoints.attachmentPoints,
      projectileOrigin: hardpoints.projectileOrigin,
      impactPoint: hardpoints.impactPoint,
      specialPoints: {},
      confidence,
      analysisMetadata: {
        geometryAnalysis,
        detectionMethod: `${weaponType}_heuristic`,
        processingTime,
        visualizationData
      }
    }

    console.log(`✅ Hardpoint detection complete (${processingTime}ms) - Confidence: ${(confidence * 100).toFixed(1)}%`)
    return result
  }

  /**
   * Analyze geometry properties for hardpoint detection
   */
  private analyzeGeometry(geometry: any): GeometryAnalysis {
    const vertices = this.extractVertices(geometry)
    const boundingBox = this.calculateBoundingBox(vertices)
    const massCenter = this.calculateMassCenter(vertices)
    const principalAxes = this.calculatePrincipalAxes(vertices, massCenter)

    return {
      boundingBox,
      vertexCount: vertices.length,
      triangleCount: Math.floor(vertices.length / 3),
      surfaceArea: this.calculateSurfaceArea(geometry),
      volume: this.calculateVolume(geometry),
      massCenter,
      principalAxes
    }
  }

  /**
   * Detect hardpoints based on weapon type
   */
  private async detectByWeaponType(
    geometry: any,
    weaponType: string,
    analysis: GeometryAnalysis,
    orientationHints?: any
  ): Promise<{
    primaryGrip: HardpointCandidate
    secondaryGrip?: HardpointCandidate
    attachmentPoints: HardpointCandidate[]
    projectileOrigin?: HardpointCandidate
    impactPoint?: HardpointCandidate
  }> {
    switch (weaponType) {
      case 'sword':
        return this.detectSwordHardpoints(geometry, analysis)
      case 'axe':
        return this.detectAxeHardpoints(geometry, analysis)
      case 'bow':
        return this.detectBowHardpoints(geometry, analysis)
      case 'crossbow':
        return this.detectCrossbowHardpoints(geometry, analysis)
      case 'dagger':
        return this.detectDaggerHardpoints(geometry, analysis)
      case 'staff':
        return this.detectStaffHardpoints(geometry, analysis)
      case 'shield':
        return this.detectShieldHardpoints(geometry, analysis)
      case 'mace':
        return this.detectMaceHardpoints(geometry, analysis)
      default:
        return this.detectGenericWeaponHardpoints(geometry, analysis)
    }
  }

  /**
   * Detect sword hardpoints
   */
  private detectSwordHardpoints(geometry: any, analysis: GeometryAnalysis): {
    primaryGrip: HardpointCandidate
    secondaryGrip?: HardpointCandidate
    attachmentPoints: HardpointCandidate[]
    impactPoint: HardpointCandidate
  } {
    const { boundingBox, massCenter, principalAxes } = analysis

    // For swords, the handle is typically at the bottom, blade extends upward
    const handleLength = boundingBox.size.y * 0.2 // Assume handle is 20% of total length
    const bladeLength = boundingBox.size.y * 0.8

    // Primary grip: center of handle area
    const primaryGripY = boundingBox.min.y + handleLength * 0.5
    const primaryGrip: HardpointCandidate = {
      position: {
        x: massCenter.x,
        y: primaryGripY,
        z: massCenter.z
      },
      rotation: this.calculateGripRotation(principalAxes.primary),
      confidence: 0.85,
      type: 'primary_grip',
      reasoning: [
        'Located in lower 20% of weapon (handle area)',
        'Positioned at geometric center of handle',
        'Aligned with weapon\'s primary axis'
      ],
      geometricFeatures: {
        localRadius: this.calculateLocalRadius(geometry, { x: massCenter.x, y: primaryGripY, z: massCenter.z }),
        surfaceCurvature: 0.2,
        symmetry: 0.9,
        accessibility: 0.95
      }
    }

    // Impact point: tip of blade
    const impactPoint: HardpointCandidate = {
      position: {
        x: massCenter.x,
        y: boundingBox.max.y,
        z: massCenter.z
      },
      rotation: this.calculateImpactRotation(principalAxes.primary),
      confidence: 0.9,
      type: 'impact_point',
      reasoning: [
        'Located at highest point (blade tip)',
        'Primary impact surface for stabbing',
        'Aligned with weapon axis'
      ],
      geometricFeatures: {
        localRadius: 0.01,
        surfaceCurvature: 0.8,
        symmetry: 1.0,
        accessibility: 1.0
      }
    }

    // Attachment points: crossguard area
    const crossguardY = boundingBox.min.y + handleLength
    const attachmentPoints: HardpointCandidate[] = [
      {
        position: { x: massCenter.x - boundingBox.size.x * 0.3, y: crossguardY, z: massCenter.z },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        confidence: 0.7,
        type: 'attachment',
        reasoning: ['Left crossguard attachment point'],
        geometricFeatures: { localRadius: 0.05, surfaceCurvature: 0.3, symmetry: 0.8, accessibility: 0.8 }
      },
      {
        position: { x: massCenter.x + boundingBox.size.x * 0.3, y: crossguardY, z: massCenter.z },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        confidence: 0.7,
        type: 'attachment',
        reasoning: ['Right crossguard attachment point'],
        geometricFeatures: { localRadius: 0.05, surfaceCurvature: 0.3, symmetry: 0.8, accessibility: 0.8 }
      }
    ]

    return {
      primaryGrip,
      attachmentPoints,
      impactPoint
    }
  }

  /**
   * Detect bow hardpoints
   */
  private detectBowHardpoints(geometry: any, analysis: GeometryAnalysis): {
    primaryGrip: HardpointCandidate
    attachmentPoints: HardpointCandidate[]
    projectileOrigin: HardpointCandidate
  } {
    const { boundingBox, massCenter } = analysis

    // Primary grip: center of bow (riser)
    const primaryGrip: HardpointCandidate = {
      position: massCenter,
      rotation: this.calculateBowGripRotation(),
      confidence: 0.8,
      type: 'primary_grip',
      reasoning: [
        'Located at geometric center (riser area)',
        'Optimal balance point for bow',
        'Standard archery grip position'
      ],
      geometricFeatures: {
        localRadius: 0.03,
        surfaceCurvature: 0.1,
        symmetry: 1.0,
        accessibility: 0.9
      }
    }

    // Projectile origin: arrow rest (left side of bow)
    const projectileOrigin: HardpointCandidate = {
      position: {
        x: massCenter.x - boundingBox.size.x * 0.1, // Slightly left of center
        y: massCenter.y,
        z: massCenter.z
      },
      rotation: this.calculateProjectileRotation('leftward'),
      confidence: 0.85,
      type: 'projectile_origin',
      reasoning: [
        'Arrow rest position on left side',
        'Optimal arrow trajectory angle',
        'Standard archery configuration'
      ],
      geometricFeatures: {
        localRadius: 0.01,
        surfaceCurvature: 0.2,
        symmetry: 0.7,
        accessibility: 0.9
      }
    }

    // Attachment points: string nocking points
    const attachmentPoints: HardpointCandidate[] = [
      {
        position: { x: massCenter.x, y: boundingBox.max.y, z: massCenter.z },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        confidence: 0.75,
        type: 'attachment',
        reasoning: ['Upper string nocking point'],
        geometricFeatures: { localRadius: 0.02, surfaceCurvature: 0.4, symmetry: 1.0, accessibility: 0.8 }
      },
      {
        position: { x: massCenter.x, y: boundingBox.min.y, z: massCenter.z },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        confidence: 0.75,
        type: 'attachment',
        reasoning: ['Lower string nocking point'],
        geometricFeatures: { localRadius: 0.02, surfaceCurvature: 0.4, symmetry: 1.0, accessibility: 0.8 }
      }
    ]

    return {
      primaryGrip,
      attachmentPoints,
      projectileOrigin
    }
  }

  /**
   * Detect crossbow hardpoints
   */
  private detectCrossbowHardpoints(geometry: any, analysis: GeometryAnalysis): {
    primaryGrip: HardpointCandidate
    secondaryGrip: HardpointCandidate
    attachmentPoints: HardpointCandidate[]
    projectileOrigin: HardpointCandidate
  } {
    const { boundingBox, massCenter } = analysis

    // Primary grip: pistol grip area (assuming horizontal orientation)
    const primaryGrip: HardpointCandidate = {
      position: {
        x: massCenter.x + boundingBox.size.x * 0.2, // Toward the back (stock)
        y: massCenter.y,
        z: massCenter.z - boundingBox.size.z * 0.1 // Below center line
      },
      rotation: this.calculateCrossbowGripRotation(),
      confidence: 0.8,
      type: 'primary_grip',
      reasoning: [
        'Located in stock/grip area',
        'Ergonomic trigger access',
        'Standard crossbow grip position'
      ],
      geometricFeatures: {
        localRadius: 0.04,
        surfaceCurvature: 0.3,
        symmetry: 0.9,
        accessibility: 0.95
      }
    }

    // Secondary grip: fore-end
    const secondaryGrip: HardpointCandidate = {
      position: {
        x: massCenter.x - boundingBox.size.x * 0.3, // Forward position
        y: massCenter.y,
        z: massCenter.z - boundingBox.size.z * 0.05
      },
      rotation: this.calculateCrossbowForendRotation(),
      confidence: 0.75,
      type: 'secondary_grip',
      reasoning: [
        'Fore-end support position',
        'Stabilization grip',
        'Forward weight support'
      ],
      geometricFeatures: {
        localRadius: 0.03,
        surfaceCurvature: 0.2,
        symmetry: 0.8,
        accessibility: 0.85
      }
    }

    // Projectile origin: bolt rail/channel
    const projectileOrigin: HardpointCandidate = {
      position: {
        x: massCenter.x - boundingBox.size.x * 0.4, // Front of weapon
        y: massCenter.y,
        z: massCenter.z + boundingBox.size.z * 0.02 // Slightly above center
      },
      rotation: this.calculateProjectileRotation('leftward'),
      confidence: 0.9,
      type: 'projectile_origin',
      reasoning: [
        'Bolt channel exit point',
        'Optimal trajectory alignment',
        'Standard crossbow configuration'
      ],
      geometricFeatures: {
        localRadius: 0.008,
        surfaceCurvature: 0.1,
        symmetry: 1.0,
        accessibility: 1.0
      }
    }

    // Attachment points
    const attachmentPoints: HardpointCandidate[] = [
      {
        position: { x: massCenter.x, y: massCenter.y + boundingBox.size.y * 0.3, z: massCenter.z },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        confidence: 0.7,
        type: 'attachment',
        reasoning: ['Scope/sight mount'],
        geometricFeatures: { localRadius: 0.02, surfaceCurvature: 0.1, symmetry: 1.0, accessibility: 0.9 }
      }
    ]

    return {
      primaryGrip,
      secondaryGrip,
      attachmentPoints,
      projectileOrigin
    }
  }

  /**
   * Detect shield hardpoints
   */
  private detectShieldHardpoints(geometry: any, analysis: GeometryAnalysis): {
    primaryGrip: HardpointCandidate
    attachmentPoints: HardpointCandidate[]
  } {
    const { boundingBox, massCenter } = analysis

    // Primary grip: center back of shield
    const primaryGrip: HardpointCandidate = {
      position: {
        x: massCenter.x,
        y: massCenter.y,
        z: boundingBox.min.z + boundingBox.size.z * 0.1 // Slightly forward from back face
      },
      rotation: this.calculateShieldGripRotation(),
      confidence: 0.85,
      type: 'primary_grip',
      reasoning: [
        'Central grip position for balance',
        'Ergonomic arm placement',
        'Standard shield configuration'
      ],
      geometricFeatures: {
        localRadius: 0.05,
        surfaceCurvature: 0.2,
        symmetry: 1.0,
        accessibility: 0.9
      }
    }

    // Attachment points: arm strap positions
    const attachmentPoints: HardpointCandidate[] = [
      {
        position: {
          x: massCenter.x,
          y: massCenter.y + boundingBox.size.y * 0.2,
          z: boundingBox.min.z
        },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        confidence: 0.8,
        type: 'attachment',
        reasoning: ['Upper arm strap attachment'],
        geometricFeatures: { localRadius: 0.02, surfaceCurvature: 0.3, symmetry: 1.0, accessibility: 0.8 }
      },
      {
        position: {
          x: massCenter.x,
          y: massCenter.y - boundingBox.size.y * 0.2,
          z: boundingBox.min.z
        },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        confidence: 0.8,
        type: 'attachment',
        reasoning: ['Lower arm strap attachment'],
        geometricFeatures: { localRadius: 0.02, surfaceCurvature: 0.3, symmetry: 1.0, accessibility: 0.8 }
      }
    ]

    return {
      primaryGrip,
      attachmentPoints
    }
  }

  /**
   * Generic weapon hardpoint detection
   */
  private detectGenericWeaponHardpoints(geometry: any, analysis: GeometryAnalysis): {
    primaryGrip: HardpointCandidate
    attachmentPoints: HardpointCandidate[]
  } {
    const { boundingBox, massCenter } = analysis

    const primaryGrip: HardpointCandidate = {
      position: massCenter,
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      confidence: 0.5,
      type: 'primary_grip',
      reasoning: ['Generic center grip position'],
      geometricFeatures: {
        localRadius: 0.03,
        surfaceCurvature: 0.2,
        symmetry: 0.8,
        accessibility: 0.8
      }
    }

    return {
      primaryGrip,
      attachmentPoints: []
    }
  }

  /**
   * Detect dagger hardpoints
   */
  private detectDaggerHardpoints(geometry: any, analysis: GeometryAnalysis): {
    primaryGrip: HardpointCandidate
    attachmentPoints: HardpointCandidate[]
    impactPoint: HardpointCandidate
  } {
    const { boundingBox, massCenter } = analysis

    // Primary grip: lower portion of dagger, centered on handle
    const primaryGrip: HardpointCandidate = {
      position: {
        x: massCenter.x,
        y: boundingBox.min.y + boundingBox.size.y * 0.25, // 25% up from bottom
        z: massCenter.z
      },
      rotation: this.calculateGripRotation(analysis.principalAxes.primary),
      confidence: 0.9,
      type: 'primary_grip',
      reasoning: [
        'Center handle grip for precise control',
        'Ergonomic positioning for thrusting attacks',
        'Balanced grip point for dagger combat'
      ],
      geometricFeatures: {
        localRadius: this.calculateLocalRadius(geometry, {
          x: massCenter.x,
          y: boundingBox.min.y + boundingBox.size.y * 0.25,
          z: massCenter.z
        }),
        surfaceCurvature: 0.3,
        symmetry: 0.95,
        accessibility: 0.95
      }
    }

    // Impact point: tip of dagger blade
    const impactPoint: HardpointCandidate = {
      position: {
        x: massCenter.x,
        y: boundingBox.max.y, // Top of bounding box
        z: massCenter.z
      },
      rotation: this.calculateImpactRotation(analysis.principalAxes.primary),
      confidence: 0.95,
      type: 'impact_point',
      reasoning: [
        'Sharp tip optimized for piercing',
        'Primary attack point for thrust attacks',
        'Maximum reach for combat effectiveness'
      ],
      geometricFeatures: {
        localRadius: 0.005, // Very sharp point
        surfaceCurvature: 0.8,
        symmetry: 1.0,
        accessibility: 1.0
      }
    }

    return {
      primaryGrip,
      attachmentPoints: [],
      impactPoint
    }
  }

  /**
   * Detect axe hardpoints
   */
  private detectAxeHardpoints(geometry: any, analysis: GeometryAnalysis): {
    primaryGrip: HardpointCandidate
    attachmentPoints: HardpointCandidate[]
    impactPoint: HardpointCandidate
  } {
    const { boundingBox, massCenter } = analysis

    // Primary grip: handle, lower portion
    const primaryGrip: HardpointCandidate = {
      position: {
        x: massCenter.x,
        y: boundingBox.min.y + boundingBox.size.y * 0.3, // 30% up for two-handed grip
        z: massCenter.z
      },
      rotation: this.calculateGripRotation(analysis.principalAxes.primary),
      confidence: 0.85,
      type: 'primary_grip',
      reasoning: [
        'Two-handed grip position for power',
        'Balanced control for chopping motions',
        'Ergonomic handle placement'
      ],
      geometricFeatures: {
        localRadius: this.calculateLocalRadius(geometry, {
          x: massCenter.x,
          y: boundingBox.min.y + boundingBox.size.y * 0.3,
          z: massCenter.z
        }),
        surfaceCurvature: 0.2,
        symmetry: 0.9,
        accessibility: 0.9
      }
    }

    // Impact point: axe blade edge
    const impactPoint: HardpointCandidate = {
      position: {
        x: boundingBox.max.x, // Assume blade extends in X direction
        y: boundingBox.min.y + boundingBox.size.y * 0.7, // Upper portion where head is
        z: massCenter.z
      },
      rotation: this.calculateImpactRotation({ x: 1, y: 0, z: 0 }), // Blade edge direction
      confidence: 0.8,
      type: 'impact_point',
      reasoning: [
        'Sharp edge for chopping attacks',
        'Maximum impact force delivery',
        'Primary cutting surface'
      ],
      geometricFeatures: {
        localRadius: 0.01, // Sharp edge
        surfaceCurvature: 0.6,
        symmetry: 0.8,
        accessibility: 0.9
      }
    }

    return {
      primaryGrip,
      attachmentPoints: [], // No attachment points for axes
      impactPoint
    }
  }

  /**
   * Detect staff hardpoints
   */
  private detectStaffHardpoints(geometry: any, analysis: GeometryAnalysis): {
    primaryGrip: HardpointCandidate
    secondaryGrip?: HardpointCandidate
    attachmentPoints: HardpointCandidate[]
  } {
    const { boundingBox, massCenter } = analysis

    // Primary grip: center of staff for balance
    const primaryGrip: HardpointCandidate = {
      position: massCenter,
      rotation: this.calculateGripRotation(analysis.principalAxes.primary),
      confidence: 0.8,
      type: 'primary_grip',
      reasoning: [
        'Center balance point for staff combat',
        'Optimal rotation control',
        'Traditional staff grip position'
      ],
      geometricFeatures: {
        localRadius: this.calculateLocalRadius(geometry, massCenter),
        surfaceCurvature: 0.1,
        symmetry: 1.0,
        accessibility: 0.95
      }
    }

    // Secondary grip: offset position for two-handed technique
    const secondaryGrip: HardpointCandidate = {
      position: {
        x: massCenter.x,
        y: massCenter.y + boundingBox.size.y * 0.25, // 25% offset from center
        z: massCenter.z
      },
      rotation: this.calculateGripRotation(analysis.principalAxes.primary),
      confidence: 0.75,
      type: 'secondary_grip',
      reasoning: [
        'Secondary hand position for control',
        'Allows for varied staff techniques',
        'Improves leverage and precision'
      ],
      geometricFeatures: {
        localRadius: this.calculateLocalRadius(geometry, {
          x: massCenter.x,
          y: massCenter.y + boundingBox.size.y * 0.25,
          z: massCenter.z
        }),
        surfaceCurvature: 0.1,
        symmetry: 1.0,
        accessibility: 0.9
      }
    }

    // Attachment points for staff ornaments/crystals
    const attachmentPoints: HardpointCandidate[] = [
      {
        position: { x: massCenter.x, y: boundingBox.max.y, z: massCenter.z },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        confidence: 0.7,
        type: 'attachment',
        reasoning: ['Top staff ornament/crystal mount'],
        geometricFeatures: { localRadius: 0.03, surfaceCurvature: 0.2, symmetry: 1.0, accessibility: 0.9 }
      }
    ]

    return {
      primaryGrip,
      secondaryGrip,
      attachmentPoints
    }
  }

  /**
   * Detect mace hardpoints
   */
  private detectMaceHardpoints(geometry: any, analysis: GeometryAnalysis): {
    primaryGrip: HardpointCandidate
    attachmentPoints: HardpointCandidate[]
    impactPoint: HardpointCandidate
  } {
    const { boundingBox, massCenter } = analysis

    // Primary grip: handle, towards bottom
    const primaryGrip: HardpointCandidate = {
      position: {
        x: massCenter.x,
        y: boundingBox.min.y + boundingBox.size.y * 0.35, // 35% up from bottom
        z: massCenter.z
      },
      rotation: this.calculateGripRotation(analysis.principalAxes.primary),
      confidence: 0.85,
      type: 'primary_grip',
      reasoning: [
        'Handle grip for crushing blows',
        'Balanced for impact delivery',
        'Traditional mace grip position'
      ],
      geometricFeatures: {
        localRadius: this.calculateLocalRadius(geometry, {
          x: massCenter.x,
          y: boundingBox.min.y + boundingBox.size.y * 0.35,
          z: massCenter.z
        }),
        surfaceCurvature: 0.2,
        symmetry: 0.9,
        accessibility: 0.9
      }
    }

    // Impact point: mace head center
    const impactPoint: HardpointCandidate = {
      position: {
        x: massCenter.x,
        y: boundingBox.max.y, // Top where mace head is
        z: massCenter.z
      },
      rotation: this.calculateImpactRotation(analysis.principalAxes.primary),
      confidence: 0.9,
      type: 'impact_point',
      reasoning: [
        'Heavy head for maximum impact',
        'Concentrated mass for crushing',
        'Primary striking surface'
      ],
      geometricFeatures: {
        localRadius: 0.03, // Blunt impact surface
        surfaceCurvature: 0.4,
        symmetry: 0.95,
        accessibility: 1.0
      }
    }

    return {
      primaryGrip,
      attachmentPoints: [], // No attachment points for maces
      impactPoint
    }
  }

  /**
   * Calculate accuracy metrics for detected hardpoints
   */
  calculateAccuracyMetrics(
    detectedHardpoints: DetectedHardpoints,
    expectedHardpoints?: Partial<DetectedHardpoints>
  ): HardpointAccuracyMetrics {
    if (!expectedHardpoints) {
      // If no expected hardpoints provided, use heuristic scoring
      return this.calculateHeuristicAccuracy(detectedHardpoints)
    }

    let gripAccuracy = 1.0
    let orientationAccuracy = 1.0
    let functionalityScore = 1.0
    let ergonomicsScore = 1.0

    // Compare primary grip position
    if (expectedHardpoints.primaryGrip) {
      const gripError = this.calculateDistance(
        detectedHardpoints.primaryGrip.position,
        expectedHardpoints.primaryGrip.position
      )
      gripAccuracy = Math.max(0, 1 - gripError)
    }

    // Calculate orientation accuracy
    if (expectedHardpoints.primaryGrip) {
      const orientationError = this.calculateQuaternionDistance(
        detectedHardpoints.primaryGrip.rotation,
        expectedHardpoints.primaryGrip.rotation
      )
      orientationAccuracy = Math.max(0, 1 - orientationError / Math.PI)
    }

    // Functionality scoring based on weapon type
    functionalityScore = this.calculateFunctionalityScore(detectedHardpoints)

    // Ergonomics scoring
    ergonomicsScore = this.calculateErgonomicsScore(detectedHardpoints)

    const overallScore = (gripAccuracy + orientationAccuracy + functionalityScore + ergonomicsScore) / 4

    return {
      overallScore,
      gripAccuracy,
      orientationAccuracy,
      functionalityScore,
      ergonomicsScore,
      detailedMetrics: {
        gripPositionError: expectedHardpoints.primaryGrip ?
          this.calculateDistance(detectedHardpoints.primaryGrip.position, expectedHardpoints.primaryGrip.position) : 0,
        gripOrientationError: expectedHardpoints.primaryGrip ?
          this.calculateQuaternionDistance(detectedHardpoints.primaryGrip.rotation, expectedHardpoints.primaryGrip.rotation) : 0,
        balancePointAccuracy: 0.8, // Placeholder
        functionalAlignmentScore: functionalityScore
      }
    }
  }

  /**
   * Generate visualization data for detected hardpoints
   */
  private generateVisualizationData(
    hardpoints: any,
    analysis: GeometryAnalysis
  ): VisualizationData {
    const markers: any[] = []
    const orientationVectors: any[] = []
    const geometryHighlights: any[] = []

    // Add hardpoint markers
    if (hardpoints.primaryGrip) {
      markers.push({
        position: hardpoints.primaryGrip.position,
        type: 'primary_grip',
        confidence: hardpoints.primaryGrip.confidence,
        color: '#00FF00',
        size: 0.05
      })

      // Add grip direction vector
      orientationVectors.push({
        origin: hardpoints.primaryGrip.position,
        direction: this.quaternionToDirection(hardpoints.primaryGrip.rotation),
        type: 'grip_direction',
        color: '#00AA00'
      })
    }

    if (hardpoints.secondaryGrip) {
      markers.push({
        position: hardpoints.secondaryGrip.position,
        type: 'secondary_grip',
        confidence: hardpoints.secondaryGrip.confidence,
        color: '#0000FF',
        size: 0.04
      })
    }

    if (hardpoints.projectileOrigin) {
      markers.push({
        position: hardpoints.projectileOrigin.position,
        type: 'projectile_origin',
        confidence: hardpoints.projectileOrigin.confidence,
        color: '#FF0000',
        size: 0.03
      })

      // Add projectile direction vector
      orientationVectors.push({
        origin: hardpoints.projectileOrigin.position,
        direction: this.quaternionToDirection(hardpoints.projectileOrigin.rotation),
        type: 'attack_direction',
        color: '#AA0000'
      })
    }

    if (hardpoints.impactPoint) {
      markers.push({
        position: hardpoints.impactPoint.position,
        type: 'impact_point',
        confidence: hardpoints.impactPoint.confidence,
        color: '#FFFF00',
        size: 0.02
      })
    }

    // Add attachment point markers
    if (hardpoints.attachmentPoints) {
      hardpoints.attachmentPoints.forEach((point: any, index: number) => {
        markers.push({
          position: point.position,
          type: 'attachment',
          confidence: point.confidence,
          color: '#FF00FF',
          size: 0.025
        })
      })
    }

    // Generate confidence heatmap
    const confidenceHeatmap = this.generateConfidenceHeatmap(analysis)

    return {
      hardpointMarkers: markers,
      orientationVectors,
      geometryHighlights,
      confidenceHeatmap
    }
  }

  /**
   * Utility methods
   */
  private extractVertices(geometry: any): Vector3[] {
    // Extract vertices from geometry - implementation depends on geometry format
    return geometry.vertices || []
  }

  private calculateBoundingBox(vertices: Vector3[]): BoundingBox {
    if (vertices.length === 0) {
      return {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
        center: { x: 0, y: 0, z: 0 },
        size: { x: 0, y: 0, z: 0 }
      }
    }

    const min = { x: Infinity, y: Infinity, z: Infinity }
    const max = { x: -Infinity, y: -Infinity, z: -Infinity }

    for (const vertex of vertices) {
      min.x = Math.min(min.x, vertex.x)
      min.y = Math.min(min.y, vertex.y)
      min.z = Math.min(min.z, vertex.z)
      max.x = Math.max(max.x, vertex.x)
      max.y = Math.max(max.y, vertex.y)
      max.z = Math.max(max.z, vertex.z)
    }

    const center = {
      x: (min.x + max.x) / 2,
      y: (min.y + max.y) / 2,
      z: (min.z + max.z) / 2
    }

    const size = {
      x: max.x - min.x,
      y: max.y - min.y,
      z: max.z - min.z
    }

    return { min, max, center, size }
  }

  private calculateMassCenter(vertices: Vector3[]): Vector3 {
    if (vertices.length === 0) return { x: 0, y: 0, z: 0 }

    const sum = vertices.reduce(
      (acc, vertex) => ({
        x: acc.x + vertex.x,
        y: acc.y + vertex.y,
        z: acc.z + vertex.z
      }),
      { x: 0, y: 0, z: 0 }
    )

    return {
      x: sum.x / vertices.length,
      y: sum.y / vertices.length,
      z: sum.z / vertices.length
    }
  }

  private calculatePrincipalAxes(vertices: Vector3[], center: Vector3): {
    primary: Vector3
    secondary: Vector3
    tertiary: Vector3
  } {
    // Simplified principal component analysis
    // In practice, you'd calculate the covariance matrix and find eigenvectors
    return {
      primary: { x: 0, y: 1, z: 0 }, // Vertical axis (typical for weapons)
      secondary: { x: 1, y: 0, z: 0 }, // Horizontal axis
      tertiary: { x: 0, y: 0, z: 1 } // Depth axis
    }
  }

  private calculateSurfaceArea(geometry: any): number {
    // Calculate actual surface area from triangles
    const vertices = this.extractVertices(geometry)
    const faces = geometry.faces || geometry.triangles || []

    let totalArea = 0

    for (const face of faces) {
      if (face.length >= 3) {
        const v1 = vertices[face[0]] || { x: 0, y: 0, z: 0 }
        const v2 = vertices[face[1]] || { x: 0, y: 0, z: 0 }
        const v3 = vertices[face[2]] || { x: 0, y: 0, z: 0 }

        // Calculate triangle area using cross product
        const edge1 = {
          x: v2.x - v1.x,
          y: v2.y - v1.y,
          z: v2.z - v1.z
        }
        const edge2 = {
          x: v3.x - v1.x,
          y: v3.y - v1.y,
          z: v3.z - v1.z
        }

        // Cross product
        const cross = {
          x: edge1.y * edge2.z - edge1.z * edge2.y,
          y: edge1.z * edge2.x - edge1.x * edge2.z,
          z: edge1.x * edge2.y - edge1.y * edge2.x
        }

        // Magnitude of cross product / 2 = triangle area
        const area = Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z) / 2
        totalArea += area
      }
    }

    return totalArea || 1.0 // Fallback to prevent division by zero
  }

  private calculateVolume(geometry: any): number {
    // Calculate volume using divergence theorem (for closed meshes)
    const vertices = this.extractVertices(geometry)
    const faces = geometry.faces || geometry.triangles || []

    let volume = 0

    for (const face of faces) {
      if (face.length >= 3) {
        const v1 = vertices[face[0]] || { x: 0, y: 0, z: 0 }
        const v2 = vertices[face[1]] || { x: 0, y: 0, z: 0 }
        const v3 = vertices[face[2]] || { x: 0, y: 0, z: 0 }

        // Calculate signed volume contribution of this triangle
        const contribution = (v1.x * (v2.y * v3.z - v3.y * v2.z)) / 6
        volume += contribution
      }
    }

    return Math.abs(volume) || 0.1 // Fallback to prevent zero volume
  }

  private calculateLocalRadius(geometry: any, position: Vector3): number {
    // Calculate local thickness/radius at a position by finding nearby vertices
    const vertices = this.extractVertices(geometry)
    const searchRadius = 0.1 // Search within 10cm

    let nearbyVertices: Vector3[] = []

    for (const vertex of vertices) {
      const distance = this.calculateDistance(position, vertex)
      if (distance <= searchRadius) {
        nearbyVertices.push(vertex)
      }
    }

    if (nearbyVertices.length < 2) {
      return 0.03 // Default radius if insufficient data
    }

    // Calculate average distance from position to nearby vertices
    let totalDistance = 0
    for (const vertex of nearbyVertices) {
      totalDistance += this.calculateDistance(position, vertex)
    }

    const averageRadius = totalDistance / nearbyVertices.length

    // Clamp to reasonable values for weapon grips
    return Math.max(0.01, Math.min(0.1, averageRadius))
  }

  private calculateGripRotation(primaryAxis: Vector3): Quaternion {
    // Convert primary axis to grip rotation quaternion
    // Standard grip orientation: Y-axis is primary, Z-axis points out from grip
    const normalized = this.normalizeVector(primaryAxis)

    // Create rotation that aligns Y-axis with primary axis
    const defaultUp = { x: 0, y: 1, z: 0 }
    const dot = normalized.y // dot product with default up

    if (Math.abs(dot) > 0.99999) {
      // Already aligned or opposite
      return dot > 0 ? { x: 0, y: 0, z: 0, w: 1 } : { x: 1, y: 0, z: 0, w: 0 }
    }

    // Cross product for rotation axis
    const axis = {
      x: defaultUp.y * normalized.z - defaultUp.z * normalized.y,
      y: defaultUp.z * normalized.x - defaultUp.x * normalized.z,
      z: defaultUp.x * normalized.y - defaultUp.y * normalized.x
    }

    const angle = Math.acos(Math.abs(dot))
    const halfAngle = angle / 2
    const sinHalf = Math.sin(halfAngle)

    const axisLength = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z)
    if (axisLength < 0.0001) {
      return { x: 0, y: 0, z: 0, w: 1 }
    }

    return {
      x: (axis.x / axisLength) * sinHalf,
      y: (axis.y / axisLength) * sinHalf,
      z: (axis.z / axisLength) * sinHalf,
      w: Math.cos(halfAngle)
    }
  }

  private calculateImpactRotation(primaryAxis: Vector3): Quaternion {
    // Impact points should face forward (along weapon's attack direction)
    // For most weapons, this aligns with primary axis
    const normalized = this.normalizeVector(primaryAxis)

    // Create rotation that points Z-axis in attack direction
    const defaultForward = { x: 0, y: 0, z: 1 }
    const attackDirection = normalized

    const dot = attackDirection.z // dot product with default forward

    if (Math.abs(dot) > 0.99999) {
      return dot > 0 ? { x: 0, y: 0, z: 0, w: 1 } : { x: 0, y: 1, z: 0, w: 0 }
    }

    const axis = {
      x: defaultForward.y * attackDirection.z - defaultForward.z * attackDirection.y,
      y: defaultForward.z * attackDirection.x - defaultForward.x * attackDirection.z,
      z: defaultForward.x * attackDirection.y - defaultForward.y * attackDirection.x
    }

    const angle = Math.acos(Math.abs(dot))
    const halfAngle = angle / 2
    const sinHalf = Math.sin(halfAngle)

    const axisLength = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z)
    if (axisLength < 0.0001) {
      return { x: 0, y: 0, z: 0, w: 1 }
    }

    return {
      x: (axis.x / axisLength) * sinHalf,
      y: (axis.y / axisLength) * sinHalf,
      z: (axis.z / axisLength) * sinHalf,
      w: Math.cos(halfAngle)
    }
  }

  private calculateBowGripRotation(): Quaternion {
    // Bow grip: handle oriented vertically, string facing left (-X direction)
    // Z-axis points along bow length, Y-axis points up, X-axis points toward string
    // Standard bow orientation: vertical with string on left side

    // 90 degree rotation around Y-axis to orient string toward -X
    const halfAngle = Math.PI / 4 // 45 degrees in radians, half of 90

    return {
      x: 0,
      y: Math.sin(halfAngle), // Rotation around Y-axis
      z: 0,
      w: Math.cos(halfAngle)
    }
  }

  private calculateProjectileRotation(direction: string): Quaternion {
    // Projectile origin rotation based on firing direction
    switch (direction.toLowerCase()) {
      case 'forward':
      case 'ahead':
        // Z-axis forward (default)
        return { x: 0, y: 0, z: 0, w: 1 }

      case 'left':
        // 90 degree rotation around Y-axis to point left (-X)
        return { x: 0, y: Math.sin(Math.PI / 4), z: 0, w: Math.cos(Math.PI / 4) }

      case 'right':
        // -90 degree rotation around Y-axis to point right (+X)
        return { x: 0, y: -Math.sin(Math.PI / 4), z: 0, w: Math.cos(Math.PI / 4) }

      case 'up':
        // 90 degree rotation around X-axis to point up (+Y)
        return { x: Math.sin(Math.PI / 4), y: 0, z: 0, w: Math.cos(Math.PI / 4) }

      case 'down':
        // -90 degree rotation around X-axis to point down (-Y)
        return { x: -Math.sin(Math.PI / 4), y: 0, z: 0, w: Math.cos(Math.PI / 4) }

      default:
        // Default forward direction
        return { x: 0, y: 0, z: 0, w: 1 }
    }
  }

  private calculateCrossbowGripRotation(): Quaternion {
    // Crossbow grip: pistol-style grip, angled downward for ergonomics
    // 15 degree downward tilt for comfortable wrist position
    const tiltAngle = -15 * (Math.PI / 180) // -15 degrees in radians
    const halfAngle = tiltAngle / 2

    return {
      x: Math.sin(halfAngle), // Rotation around X-axis for downward tilt
      y: 0,
      z: 0,
      w: Math.cos(halfAngle)
    }
  }

  private calculateCrossbowForendRotation(): Quaternion {
    // Crossbow forend: horizontal grip underneath, parallel to bolt channel
    // Slight upward angle for supporting hand comfort
    const supportAngle = 10 * (Math.PI / 180) // 10 degrees upward in radians
    const halfAngle = supportAngle / 2

    return {
      x: Math.sin(halfAngle), // Rotation around X-axis for upward tilt
      y: 0,
      z: 0,
      w: Math.cos(halfAngle)
    }
  }

  private calculateShieldGripRotation(): Quaternion {
    // Shield grip: arm extends through center, slight forward angle for defense
    // 20 degree forward tilt to angle shield face toward incoming attacks
    const defenseAngle = 20 * (Math.PI / 180) // 20 degrees forward in radians
    const halfAngle = defenseAngle / 2

    return {
      x: -Math.sin(halfAngle), // Negative rotation around X-axis for forward tilt
      y: 0,
      z: 0,
      w: Math.cos(halfAngle)
    }
  }

  private calculateOverallConfidence(hardpoints: any): number {
    let totalConfidence = 0
    let count = 0

    if (hardpoints.primaryGrip) {
      totalConfidence += hardpoints.primaryGrip.confidence
      count++
    }

    if (hardpoints.secondaryGrip) {
      totalConfidence += hardpoints.secondaryGrip.confidence
      count++
    }

    if (hardpoints.projectileOrigin) {
      totalConfidence += hardpoints.projectileOrigin.confidence
      count++
    }

    if (hardpoints.impactPoint) {
      totalConfidence += hardpoints.impactPoint.confidence
      count++
    }

    if (hardpoints.attachmentPoints) {
      for (const point of hardpoints.attachmentPoints) {
        totalConfidence += point.confidence
        count++
      }
    }

    return count > 0 ? totalConfidence / count : 0
  }

  private calculateDistance(a: Vector3, b: Vector3): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)
  }

  private normalizeVector(v: Vector3): Vector3 {
    const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
    if (length < 0.0001) {
      return { x: 0, y: 1, z: 0 } // Default to up vector if zero length
    }

    return {
      x: v.x / length,
      y: v.y / length,
      z: v.z / length
    }
  }

  private calculateQuaternionDistance(a: Quaternion, b: Quaternion): number {
    // Calculate angular distance between quaternions
    const dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w
    return Math.acos(Math.abs(dot))
  }

  private calculateHeuristicAccuracy(hardpoints: DetectedHardpoints): HardpointAccuracyMetrics {
    const confidence = hardpoints.confidence

    return {
      overallScore: confidence,
      gripAccuracy: confidence,
      orientationAccuracy: confidence * 0.9,
      functionalityScore: confidence * 0.95,
      ergonomicsScore: confidence * 0.85,
      detailedMetrics: {
        gripPositionError: (1 - confidence) * 0.1,
        gripOrientationError: (1 - confidence) * 0.2,
        balancePointAccuracy: confidence * 0.9,
        functionalAlignmentScore: confidence * 0.95
      }
    }
  }

  private calculateFunctionalityScore(hardpoints: DetectedHardpoints): number {
    // Score based on weapon-specific functional requirements
    let score = 0.8

    switch (hardpoints.weaponType) {
      case 'bow':
      case 'crossbow':
        score = hardpoints.projectileOrigin ? 0.9 : 0.5
        break
      case 'sword':
      case 'dagger':
        score = hardpoints.impactPoint ? 0.9 : 0.6
        break
      case 'shield':
        score = hardpoints.attachmentPoints.length >= 2 ? 0.9 : 0.6
        break
    }

    return score
  }

  private calculateErgonomicsScore(hardpoints: DetectedHardpoints): number {
    // Score based on ergonomic factors
    const grip = hardpoints.primaryGrip
    if (!grip) return 0.5

    let score = 0.7

    // Good grip accessibility
    if (grip.geometricFeatures.accessibility > 0.8) score += 0.1

    // Appropriate grip radius
    if (grip.geometricFeatures.localRadius > 0.02 && grip.geometricFeatures.localRadius < 0.06) {
      score += 0.1
    }

    // High symmetry suggests good design
    if (grip.geometricFeatures.symmetry > 0.8) score += 0.1

    return Math.min(1.0, score)
  }

  private quaternionToDirection(q: Quaternion): Vector3 {
    // Convert quaternion to direction vector (forward direction in local space)
    // Rotate the default forward vector (0, 0, 1) by the quaternion

    // Quaternion rotation formula: v' = q * v * q^-1
    // For unit quaternion, q^-1 = conjugate(q) = (-x, -y, -z, w)
    const defaultForward = { x: 0, y: 0, z: 1 }

    // Simplified rotation of (0, 0, 1) by quaternion
    const result = {
      x: 2 * (q.x * q.z + q.w * q.y),
      y: 2 * (q.y * q.z - q.w * q.x),
      z: 1 - 2 * (q.x * q.x + q.y * q.y)
    }

    return this.normalizeVector(result)
  }

  private generateConfidenceHeatmap(analysis: GeometryAnalysis): {
    vertices: Vector3[]
    confidenceValues: number[]
    colorMap: 'red_to_green' | 'blue_to_red'
  } {
    // Generate confidence values for each vertex
    const vertices: Vector3[] = []
    const confidenceValues: number[] = []

    // Placeholder implementation
    for (let i = 0; i < 100; i++) {
      vertices.push({ x: Math.random(), y: Math.random(), z: Math.random() })
      confidenceValues.push(Math.random())
    }

    return {
      vertices,
      confidenceValues,
      colorMap: 'red_to_green'
    }
  }
}