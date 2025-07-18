/**
 * Advanced Weapon Placement and Orientation Tests
 * Tests realistic weapon placement, hand positioning, and attachment systems
 */

import { HandPlacementDetector, GeometryData, Vector3, Quaternion, WeaponAnalysis } from '../HandPlacementDetector'
import { WeaponOrientationSystem, WeaponConfiguration, AttachmentPoint } from '../WeaponOrientationSystem'

describe('Advanced Weapon Placement Tests', () => {
  let handDetector: HandPlacementDetector
  let weaponSystem: WeaponOrientationSystem

  beforeEach(() => {
    handDetector = new HandPlacementDetector()
    weaponSystem = new WeaponOrientationSystem()
  })

  describe('Realistic Weapon Geometries', () => {
    it('should handle realistic sword proportions and placement', async () => {
      // Realistic longsword geometry (1.2m total length, 15cm handle)
      const realisticSwordGeometry: GeometryData = {
        vertices: new Float32Array([
          // Blade (95cm long, 5cm wide, 3mm thick)
          -0.025,
          -0.6,
          -0.0015, // Blade tip
          0.025,
          -0.6,
          0.0015,
          -0.025,
          0.35,
          -0.0015, // Blade base
          0.025,
          0.35,
          0.0015,

          // Crossguard (20cm wide, 2cm thick)
          -0.1,
          0.35,
          -0.01, // Guard left
          0.1,
          0.35,
          0.01, // Guard right
          -0.1,
          0.37,
          -0.01,
          0.1,
          0.37,
          0.01,

          // Handle (15cm long, 3cm diameter)
          -0.015,
          0.37,
          -0.015, // Handle bottom
          0.015,
          0.37,
          0.015,
          -0.015,
          0.52,
          -0.015, // Handle top
          0.015,
          0.52,
          0.015,

          // Pommel (5cm diameter)
          -0.025,
          0.52,
          -0.025, // Pommel
          0.025,
          0.52,
          0.025,
          -0.025,
          0.55,
          -0.025,
          0.025,
          0.55,
          0.025,
        ]),
        faces: new Uint32Array([
          // Simplified face indices
          0,
          1,
          2,
          1,
          3,
          2, // Blade
          4,
          5,
          6,
          5,
          7,
          6, // Guard
          8,
          9,
          10,
          9,
          11,
          10, // Handle
          12,
          13,
          14,
          13,
          15,
          14, // Pommel
        ]),
      }

      const analysis = await handDetector.analyzeWeapon(realisticSwordGeometry, 'sword', 'realistic medieval longsword')

      // Verify realistic proportions increase confidence
      expect(analysis.confidence).toBeGreaterThan(0.85)
      expect(analysis.grips).toHaveLength(1)

      const primaryGrip = analysis.grips[0]

      // Grip should be positioned on the handle area (negative Y due to coordinate system)
      expect(primaryGrip.position.y).toBeLessThan(-0.25)
      expect(primaryGrip.position.y).toBeGreaterThan(-0.55)

      // Grip confidence should be high for well-defined handle
      expect(primaryGrip.confidence).toBeGreaterThan(0.85)

      console.log('Realistic sword analysis:')
      console.log(`  Confidence: ${(analysis.confidence * 100).toFixed(1)}%`)
      console.log(
        `  Grip position: (${primaryGrip.position.x.toFixed(3)}, ${primaryGrip.position.y.toFixed(3)}, ${primaryGrip.position.z.toFixed(3)})`
      )
      console.log(`  Grip confidence: ${(primaryGrip.confidence * 100).toFixed(1)}%`)
    })

    it('should handle complex bow geometry with string placement', async () => {
      // Realistic recurve bow geometry
      const bowGeometry: GeometryData = {
        vertices: new Float32Array([
          // Bow limbs (curved shape approximated)
          -0.03,
          -0.8,
          0, // Lower limb tip
          -0.02,
          -0.4,
          0, // Lower limb middle
          -0.025,
          0,
          0, // Handle center
          -0.02,
          0.4,
          0, // Upper limb middle
          -0.03,
          0.8,
          0, // Upper limb tip

          // Right side of bow
          0.03,
          -0.8,
          0,
          0.02,
          -0.4,
          0,
          0.025,
          0,
          0,
          0.02,
          0.4,
          0,
          0.03,
          0.8,
          0,

          // Handle area (thicker section)
          -0.04,
          -0.1,
          -0.01,
          0.04,
          -0.1,
          0.01,
          -0.04,
          0.1,
          -0.01,
          0.04,
          0.1,
          0.01,
        ]),
        faces: new Uint32Array([
          // Simplified bow faces
          0, 1, 5, 1, 6, 5, 1, 2, 6, 2, 7, 6, 2, 3, 7, 3, 8, 7, 3, 4, 8, 4, 9, 8, 10, 11, 12, 11, 13, 12,
        ]),
      }

      const analysis = await handDetector.analyzeWeapon(bowGeometry, 'bow', 'recurve hunting bow')

      expect(analysis.weaponType).toBe('bow')
      expect(analysis.grips).toHaveLength(2) // Bow hand and string hand

      const bowHand = analysis.grips.find(g => g.gripType === 'primary')
      const stringHand = analysis.grips.find(g => g.gripType === 'secondary')

      expect(bowHand).toBeDefined()
      expect(stringHand).toBeDefined()

      // Bow hand should be at center handle
      expect(Math.abs(bowHand!.position.y)).toBeLessThan(0.15)

      // String hand should be offset for drawing
      expect(stringHand!.position.y).toBeGreaterThan(bowHand!.position.y)

      console.log('Bow analysis:')
      console.log(
        `  Bow hand: (${bowHand!.position.x.toFixed(3)}, ${bowHand!.position.y.toFixed(3)}, ${bowHand!.position.z.toFixed(3)})`
      )
      console.log(
        `  String hand: (${stringHand!.position.x.toFixed(3)}, ${stringHand!.position.y.toFixed(3)}, ${stringHand!.position.z.toFixed(3)})`
      )
    })

    it('should analyze great axe with appropriate two-handed placement', async () => {
      // Large two-handed battle axe
      const greatAxeGeometry: GeometryData = {
        vertices: new Float32Array([
          // Axe head (heavy, offset)
          -0.15,
          0.6,
          -0.05, // Blade left
          0.15,
          0.6,
          0.05, // Blade right
          -0.15,
          0.8,
          -0.05, // Blade top left
          0.15,
          0.8,
          0.05, // Blade top right
          -0.05,
          0.6,
          -0.05, // Blade root left
          0.05,
          0.6,
          0.05, // Blade root right

          // Long handle (1.5m)
          -0.025,
          -0.9,
          -0.025, // Handle bottom
          0.025,
          -0.9,
          0.025,
          -0.025,
          0.6,
          -0.025, // Handle top
          0.025,
          0.6,
          0.025,
        ]),
        faces: new Uint32Array([
          0,
          1,
          2,
          1,
          3,
          2, // Blade
          4,
          5,
          0,
          5,
          1,
          0, // Blade attachment
          6,
          7,
          8,
          7,
          9,
          8, // Handle
        ]),
      }

      const analysis = await handDetector.analyzeWeapon(greatAxeGeometry, 'axe', 'two-handed battle axe')

      expect(analysis.weaponType).toBe('axe')
      expect(analysis.grips).toHaveLength(1) // Regular axe heuristic is one-handed

      // But if we update it to be two-handed...
      handDetector.updateWeaponHeuristic('axe', {
        twoHanded: true,
        primaryGripOffset: { x: 0, y: -0.6, z: 0 }, // Lower on handle
        secondaryGripOffset: { x: 0, y: -0.2, z: 0 }, // Higher on handle
        attachmentOffset: { x: 0, y: -0.3, z: 0 },
        defaultOrientation: { x: 0, y: 0, z: 0 },
        primaryGripConfidence: 0.9,
        secondaryGripConfidence: 0.85,
        gripRadius: 0.035,
      })

      const twoHandedAnalysis = await handDetector.analyzeWeapon(greatAxeGeometry, 'axe', 'two-handed battle axe')

      expect(twoHandedAnalysis.grips).toHaveLength(2)

      const primaryGrip = twoHandedAnalysis.grips.find(g => g.gripType === 'primary')
      const secondaryGrip = twoHandedAnalysis.grips.find(g => g.gripType === 'secondary')

      // Primary grip should be lower on handle
      expect(primaryGrip!.position.y).toBeLessThan(secondaryGrip!.position.y)

      console.log('Two-handed axe grips:')
      console.log(
        `  Primary: (${primaryGrip!.position.x.toFixed(3)}, ${primaryGrip!.position.y.toFixed(3)}, ${primaryGrip!.position.z.toFixed(3)})`
      )
      console.log(
        `  Secondary: (${secondaryGrip!.position.x.toFixed(3)}, ${secondaryGrip!.position.y.toFixed(3)}, ${secondaryGrip!.position.z.toFixed(3)})`
      )
    })
  })

  describe('Attachment Point Systems', () => {
    it('should generate realistic attachment points for different weapon types', async () => {
      const mockGeometry: GeometryData = {
        vertices: new Float32Array([-0.05, -1, -0.05, 0.05, -1, 0.05, -0.05, 1, -0.05, 0.05, 1, 0.05]),
        faces: new Uint32Array([0, 1, 2, 1, 3, 2]),
      }

      // Test sword attachments
      const swordAnalysis = await handDetector.analyzeWeapon(mockGeometry, 'sword')
      const swordConfig = await weaponSystem.generateWeaponConfiguration(swordAnalysis)

      const swordAttachments = swordConfig.attachmentPoints
      expect(swordAttachments.length).toBeGreaterThanOrEqual(2) // Primary grip + sheathed

      const primaryAttachment = swordAttachments.find(p => p.name === 'primary_grip')
      const sheathedAttachment = swordAttachments.find(p => p.name.includes('sheathed'))

      expect(primaryAttachment).toBeDefined()
      expect(primaryAttachment!.socketType).toBe('hand')
      expect(primaryAttachment!.priority).toBe(100)

      expect(sheathedAttachment).toBeDefined()
      expect(['belt', 'back'].includes(sheathedAttachment!.socketType)).toBe(true)

      console.log(`Sword attachments: ${swordAttachments.length}`)
      swordAttachments.forEach(attachment => {
        console.log(`  ${attachment.name}: ${attachment.socketType} (priority: ${attachment.priority})`)
      })

      // Test staff attachments (should have back sheathing)
      const staffAnalysis = await handDetector.analyzeWeapon(mockGeometry, 'staff')
      const staffConfig = await weaponSystem.generateWeaponConfiguration(staffAnalysis)

      const staffAttachments = staffConfig.attachmentPoints
      expect(staffAttachments.length).toBeGreaterThanOrEqual(3) // Primary + secondary + sheathed

      const backAttachment = staffAttachments.find(p => p.socketType === 'back')
      expect(backAttachment).toBeDefined()

      console.log(`Staff attachments: ${staffAttachments.length}`)
    })

    it('should calculate proper sheathed positions relative to character bones', async () => {
      const swordGeometry: GeometryData = {
        vertices: new Float32Array([-0.02, -0.6, -0.01, 0.02, -0.6, 0.01, -0.02, 0.6, -0.01, 0.02, 0.6, 0.01]),
        faces: new Uint32Array([0, 1, 2, 1, 3, 2]),
      }

      const analysis = await handDetector.analyzeWeapon(swordGeometry, 'sword')
      const config = await weaponSystem.generateWeaponConfiguration(analysis)

      const sheathedAttachment = config.attachmentPoints.find(p => p.name.includes('sheathed'))
      expect(sheathedAttachment).toBeDefined()

      // Check that sheathed position is reasonable relative to character
      // Hip bone is at { x: -0.15, y: 0.9, z: 0 } for left hip
      if (sheathedAttachment!.socketType === 'belt') {
        expect(Math.abs(sheathedAttachment!.position.x)).toBeGreaterThan(0.1) // Offset from center
        expect(sheathedAttachment!.position.y).toBeGreaterThan(0.8) // Around hip level
      }

      console.log(
        `Sheathed position: (${sheathedAttachment!.position.x.toFixed(3)}, ${sheathedAttachment!.position.y.toFixed(3)}, ${sheathedAttachment!.position.z.toFixed(3)})`
      )
      console.log(`Socket type: ${sheathedAttachment!.socketType}`)
    })
  })

  describe('Weapon Orientation and Physics', () => {
    it('should generate realistic weapon orientations for different combat states', async () => {
      const swordGeometry: GeometryData = {
        vertices: new Float32Array([-0.02, -0.8, -0.01, 0.02, -0.8, 0.01, -0.02, 0.8, -0.01, 0.02, 0.8, 0.01]),
        faces: new Uint32Array([0, 1, 2, 1, 3, 2]),
      }

      const analysis = await handDetector.analyzeWeapon(swordGeometry, 'sword')
      const config = await weaponSystem.generateWeaponConfiguration(analysis)

      const { orientation } = config

      // All orientations should be valid quaternions
      ;[orientation.restPosition, orientation.combatPosition, orientation.sheathedPosition].forEach(quat => {
        expect(quat).toBeDefined()
        expect(typeof quat.x).toBe('number')
        expect(typeof quat.y).toBe('number')
        expect(typeof quat.z).toBe('number')
        expect(typeof quat.w).toBe('number')

        // Quaternion should be approximately normalized
        const magnitude = Math.sqrt(quat.x * quat.x + quat.y * quat.y + quat.z * quat.z + quat.w * quat.w)
        expect(magnitude).toBeCloseTo(1.0, 1)
      })

      // Block position should exist for swords
      expect(orientation.blockPosition).toBeDefined()

      console.log('Weapon orientations:')
      console.log(
        `  Rest: (${orientation.restPosition.x.toFixed(3)}, ${orientation.restPosition.y.toFixed(3)}, ${orientation.restPosition.z.toFixed(3)}, ${orientation.restPosition.w.toFixed(3)})`
      )
      console.log(
        `  Combat: (${orientation.combatPosition.x.toFixed(3)}, ${orientation.combatPosition.y.toFixed(3)}, ${orientation.combatPosition.z.toFixed(3)}, ${orientation.combatPosition.w.toFixed(3)})`
      )
    })

    it('should calculate realistic physics properties for different weapon sizes', async () => {
      // Test small dagger
      const daggerGeometry: GeometryData = {
        vertices: new Float32Array([-0.01, -0.2, -0.005, 0.01, -0.2, 0.005, -0.01, 0.2, -0.005, 0.01, 0.2, 0.005]),
        faces: new Uint32Array([0, 1, 2, 1, 3, 2]),
      }

      // Test large sword
      const largeSwordGeometry: GeometryData = {
        vertices: new Float32Array([-0.05, -1.2, -0.02, 0.05, -1.2, 0.02, -0.05, 1.2, -0.02, 0.05, 1.2, 0.02]),
        faces: new Uint32Array([0, 1, 2, 1, 3, 2]),
      }

      const daggerAnalysis = await handDetector.analyzeWeapon(daggerGeometry, 'dagger')
      const largeSwordAnalysis = await handDetector.analyzeWeapon(largeSwordGeometry, 'sword')

      const daggerConfig = await weaponSystem.generateWeaponConfiguration(daggerAnalysis)
      const largeSwordConfig = await weaponSystem.generateWeaponConfiguration(largeSwordAnalysis)

      // Large sword should have more mass
      expect(largeSwordConfig.physicsProperties.mass).toBeGreaterThan(daggerConfig.physicsProperties.mass)

      // Large sword should have higher damage
      expect(largeSwordConfig.metadata.damage).toBeGreaterThan(daggerConfig.metadata.damage)

      // Large sword should have higher inertia
      expect(largeSwordConfig.physicsProperties.inertiaTensor.x).toBeGreaterThan(
        daggerConfig.physicsProperties.inertiaTensor.x
      )

      console.log('Physics comparison:')
      console.log(
        `  Dagger mass: ${daggerConfig.physicsProperties.mass.toFixed(3)}kg, damage: ${daggerConfig.metadata.damage}`
      )
      console.log(
        `  Large sword mass: ${largeSwordConfig.physicsProperties.mass.toFixed(3)}kg, damage: ${largeSwordConfig.metadata.damage}`
      )
    })

    it('should generate appropriate animation sets for weapon types', async () => {
      const mockGeometry: GeometryData = {
        vertices: new Float32Array([0, 0, 0, 1, 1, 1]),
        faces: new Uint32Array([0, 1, 2]),
      }

      const weaponTypes = ['sword', 'axe', 'bow', 'staff']

      for (const weaponType of weaponTypes) {
        const analysis = await handDetector.analyzeWeapon(mockGeometry, weaponType)
        const config = await weaponSystem.generateWeaponConfiguration(analysis)

        const { animations } = config

        // All weapons should have basic animations
        expect(animations.idle).toBeDefined()
        expect(animations.attack).toBeDefined()
        expect(animations.sheath).toBeDefined()
        expect(animations.unsheath).toBeDefined()

        // Check weapon-specific animations
        expect(animations.idle[0]).toBe(`${weaponType}_idle_${weaponType}`)
        expect(animations.attack.length).toBeGreaterThan(0)

        if (weaponType === 'sword' || weaponType === 'axe') {
          expect(animations.block).toBeDefined()
        }

        console.log(`${weaponType} animations:`)
        console.log(`  Idle: ${animations.idle.join(', ')}`)
        console.log(`  Attack: ${animations.attack.join(', ')}`)
        if (animations.block) {
          console.log(`  Block: ${animations.block.join(', ')}`)
        }
      }
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty geometry gracefully', async () => {
      const emptyGeometry: GeometryData = {
        vertices: new Float32Array([]),
        faces: new Uint32Array([]),
      }

      const analysis = await handDetector.analyzeWeapon(emptyGeometry, 'sword')

      // Should still provide basic analysis with low confidence
      expect(analysis.weaponType).toBe('sword')
      expect(analysis.grips).toHaveLength(1) // Uses heuristic
      expect(analysis.confidence).toBe(0) // Should be 0 for empty geometry
    })

    it('should handle unknown weapon types', async () => {
      const mockGeometry: GeometryData = {
        vertices: new Float32Array([0, 0, 0, 1, 1, 1]),
        faces: new Uint32Array([0, 1, 2]),
      }

      const analysis = await handDetector.analyzeWeapon(mockGeometry, 'lightsaber')
      expect(analysis.weaponType).toBe('lightsaber')
      expect(analysis.grips).toHaveLength(1) // Uses default heuristic

      const config = await weaponSystem.generateWeaponConfiguration(analysis)
      expect(config).toBeDefined()
      expect(config.metadata.damage).toBeGreaterThan(0) // Uses default template
    })

    it('should maintain consistency across batch operations', async () => {
      const identicalGeometry: GeometryData = {
        vertices: new Float32Array([-0.02, -0.6, -0.01, 0.02, -0.6, 0.01, -0.02, 0.6, -0.01, 0.02, 0.6, 0.01]),
        faces: new Uint32Array([0, 1, 2, 1, 3, 2]),
      }

      // Analyze same geometry multiple times
      const batchData = Array(3).fill({
        geometryData: identicalGeometry,
        weaponType: 'sword',
        description: 'identical test sword',
      })

      const results = await handDetector.batchAnalyze(batchData)

      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i].confidence).toBeCloseTo(results[0].confidence, 6)
        expect(results[i].grips[0].position.x).toBeCloseTo(results[0].grips[0].position.x, 6)
        expect(results[i].grips[0].position.y).toBeCloseTo(results[0].grips[0].position.y, 6)
        expect(results[i].grips[0].position.z).toBeCloseTo(results[0].grips[0].position.z, 6)
      }

      console.log('✅ Batch consistency verified')
    })
  })

  describe('Real-world Weapon Scenarios', () => {
    it('should handle asymmetric weapon design (katana)', async () => {
      // Katana with curved blade and specific grip placement
      const katanaGeometry: GeometryData = {
        vertices: new Float32Array([
          // Curved blade approximation
          -0.015,
          -0.7,
          0, // Tip
          0.015,
          -0.7,
          0,
          -0.02,
          -0.3,
          0.01, // Curve start
          0.02,
          -0.3,
          0.01,
          -0.025,
          0.3,
          0.02, // Handle start
          0.025,
          0.3,
          0.02,

          // Tsuka (handle) - longer than European sword
          -0.015,
          0.3,
          0, // Handle start
          0.015,
          0.3,
          0,
          -0.015,
          0.6,
          0, // Handle end
          0.015,
          0.6,
          0,
        ]),
        faces: new Uint32Array([
          0,
          1,
          2,
          1,
          3,
          2, // Blade
          2,
          3,
          4,
          3,
          5,
          4, // Guard area
          6,
          7,
          8,
          7,
          9,
          8, // Handle
        ]),
      }

      const analysis = await handDetector.analyzeWeapon(katanaGeometry, 'sword', 'curved katana')

      expect(analysis.confidence).toBeGreaterThan(0.8)

      // Grip should be positioned in the handle area
      const grip = analysis.grips[0]
      expect(grip.position.y).toBeLessThan(-0.25)
      expect(grip.position.y).toBeGreaterThan(-0.65)

      console.log(
        `Katana grip position: (${grip.position.x.toFixed(3)}, ${grip.position.y.toFixed(3)}, ${grip.position.z.toFixed(3)})`
      )
    })

    it('should handle polearm weapons with extended reach', async () => {
      // Spear/halberd with very long handle
      const polearmGeometry: GeometryData = {
        vertices: new Float32Array([
          // Spear tip
          -0.02, 1.8, -0.01, 0.02, 1.8, 0.01, -0.03, 1.6, -0.015, 0.03, 1.6, 0.015,

          // Long shaft
          -0.025, 1.6, -0.025, 0.025, 1.6, 0.025, -0.025, -1.5, -0.025, 0.025, -1.5, 0.025,
        ]),
        faces: new Uint32Array([
          0,
          1,
          2,
          1,
          3,
          2, // Tip
          4,
          5,
          6,
          5,
          7,
          6, // Shaft
        ]),
      }

      const analysis = await handDetector.analyzeWeapon(polearmGeometry, 'spear', 'long polearm spear')

      expect(analysis.weaponType).toBe('spear')
      expect(analysis.grips).toHaveLength(2) // Two-handed weapon

      const primaryGrip = analysis.grips.find(g => g.gripType === 'primary')
      const secondaryGrip = analysis.grips.find(g => g.gripType === 'secondary')

      // Grips should be spread apart on the long handle
      const gripDistance = Math.abs(primaryGrip!.position.y - secondaryGrip!.position.y)
      expect(gripDistance).toBeGreaterThan(0.2) // At least 20cm apart

      console.log(`Polearm grip separation: ${(gripDistance * 100).toFixed(1)}cm`)
    })
  })
})
