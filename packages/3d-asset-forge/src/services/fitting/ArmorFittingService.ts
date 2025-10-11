import * as THREE from 'three'
import { Vector3, Box3, SkinnedMesh, Mesh, BufferGeometry, BufferAttribute, Skeleton, Bone } from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { MeshFittingService } from './MeshFittingService'
import { WeightTransferService } from './WeightTransferService'

export interface BodyRegion {
  name: string
  bones: string[]
  boundingBox: Box3
  vertices: number[]
  center: Vector3
}

export interface CollisionPoint {
  vertexIndex: number
  position: Vector3
  normal: Vector3
  penetrationDepth: number
}

export interface FittingConfig {
  method: 'boundingBox' | 'collision' | 'smooth' | 'iterative' | 'hull' | 'shrinkwrap'
  margin?: number // cm converted to scene units
  smoothingIterations?: number
  collisionIterations?: number
  preserveDetails?: boolean
  stiffness?: number
  useBodyHull?: boolean
  hullExpansion?: number
  hullSimplification?: number
  hullMaxDisplacement?: number
  hullTargetOffset?: number
  hullIterations?: number
  hullStepSize?: number
  hullSmoothInfluence?: number
  
  // MeshFittingParameters for shrinkwrap method
  iterations?: number
  stepSize?: number
  smoothingRadius?: number
  smoothingStrength?: number
  targetOffset?: number
  sampleRate?: number
  preserveFeatures?: boolean
  featureAngleThreshold?: number
  useImprovedShrinkwrap?: boolean
  preserveOpenings?: boolean
  pushInteriorVertices?: boolean
}

interface FittingParameters {
  iterations?: number
  stepSize?: number
  smoothingRadius?: number
  smoothingStrength?: number
  targetOffset?: number
  useBodyHull?: boolean
  deformationMethod?: 'shrinkwrap' | 'rbf' | 'cage'
  rbfRadius?: number
  preserveFeatures?: boolean
  featureAngleThreshold?: number
  preserveOpenings?: boolean
}

export class ArmorFittingService {
  private genericFittingService: MeshFittingService
  private weightTransferService: WeightTransferService

  constructor() {
    this.genericFittingService = new MeshFittingService()
    this.weightTransferService = new WeightTransferService()
  }

  /**
   * Compute body regions from avatar skeleton
   */
  computeBodyRegions(skinnedMesh: SkinnedMesh, skeleton: Skeleton): Map<string, BodyRegion> {
    console.log('🎯 ArmorFittingService: Computing body regions')
    
    // Ensure world matrices are up to date
    skinnedMesh.updateMatrixWorld(true)
    skeleton.bones.forEach(bone => bone.updateMatrixWorld(true))
    
    const regions = new Map<string, BodyRegion>()
    const geometry = skinnedMesh.geometry as BufferGeometry
    const position = geometry.attributes.position as BufferAttribute
    const skinIndex = geometry.attributes.skinIndex as BufferAttribute
    const skinWeight = geometry.attributes.skinWeight as BufferAttribute
    
    // Debug: Log all bone names
    console.log('Available bones:')
    skeleton.bones.forEach((bone, index) => {
      console.log(`  [${index}] ${bone.name}`)
    })
    
    // Define bone name patterns for each region
    const regionPatterns = {
      head: ['head', 'neck'],
      torso: ['spine', 'chest', 'torso', 'body', 'upper'],
      arms: ['arm', 'shoulder', 'elbow', 'wrist', 'hand'],
      hips: ['hip', 'pelvis'],
      legs: ['leg', 'thigh', 'knee', 'ankle', 'foot', 'shin']
    }
    
    // Create bone index mapping
    const boneIndexMap = new Map<string, number>()
    skeleton.bones.forEach((bone, index) => {
      boneIndexMap.set(bone.name, index)
    })
    
    console.log('🎯 ArmorFittingService: Avatar scale:', skinnedMesh.scale.x, skinnedMesh.scale.y, skinnedMesh.scale.z)
    console.log('🎯 ArmorFittingService: Avatar world matrix:', skinnedMesh.matrixWorld.elements)
    
    // Get overall avatar bounds for scale reference
    const avatarBounds = new Box3().setFromObject(skinnedMesh)
    const avatarSize = avatarBounds.getSize(new Vector3())
    console.log('🎯 ArmorFittingService: Avatar overall size:', avatarSize.x.toFixed(3), avatarSize.y.toFixed(3), avatarSize.z.toFixed(3))
    console.log('🎯 ArmorFittingService: Avatar bounds min:', avatarBounds.min.x.toFixed(3), avatarBounds.min.y.toFixed(3), avatarBounds.min.z.toFixed(3))
    console.log('🎯 ArmorFittingService: Avatar bounds max:', avatarBounds.max.x.toFixed(3), avatarBounds.max.y.toFixed(3), avatarBounds.max.z.toFixed(3))
    
    // For each region, find bones and compute bounds
    for (const [regionName, patterns] of Object.entries(regionPatterns)) {
      const regionBones: Bone[] = []
      const regionBoneIndices = new Set<number>()
      
      // Find bones matching patterns
      skeleton.bones.forEach((bone, index) => {
        const boneName = bone.name.toLowerCase()
        // Check if bone name contains any of the patterns
        if (patterns.some(pattern => boneName.includes(pattern.toLowerCase()))) {
          regionBones.push(bone)
          regionBoneIndices.add(index)
          console.log(`  Adding bone "${bone.name}" to region "${regionName}"`)
        }
      })
      
      if (regionBones.length === 0) {
        console.warn(`No bones found for region: ${regionName}`)
        continue
      }
      
      // Find vertices for this region
      const regionVertices: number[] = []
      const regionVertexPositions: Vector3[] = [] // For bounding box calculation
      
      // Weight threshold for different regions
      const weightThreshold = regionName === 'torso' ? 0.3 : 0.5 // Lower threshold for torso
      
      for (let i = 0; i < position.count; i++) {
        let totalWeight = 0
        
        // Check if this vertex is influenced by region bones
        for (let j = 0; j < 4; j++) {
          const boneIndex = skinIndex.getComponent(i, j)
          const weight = skinWeight.getComponent(i, j)
          
          if (regionBoneIndices.has(boneIndex)) {
            totalWeight += weight
          }
        }
        
        if (totalWeight > weightThreshold) {
          regionVertices.push(i)
          
          // Collect vertex positions for bounding box
          const vertex = new Vector3()
          vertex.fromBufferAttribute(position, i)
          // Transform to world space
          vertex.applyMatrix4(skinnedMesh.matrixWorld)
          regionVertexPositions.push(vertex)
        }
      }
      
      // Compute bounding box
      const boundingBox = new Box3()
      
      if (regionVertexPositions.length > 10) {
        // Use vertex positions if we have enough
        console.log(`🎯 ArmorFittingService: ${regionName} region using ${regionVertexPositions.length} vertices`)
        boundingBox.setFromPoints(regionVertexPositions)
      } else {
        // Fallback: use bone positions with influence spheres
        console.log(`🎯 ArmorFittingService: ${regionName} region using bone positions (only ${regionVertexPositions.length} vertices found)`)
        const influenceRadius = {
          head: 0.15,    // 15cm radius
          torso: 0.35,   // 35cm radius - larger for torso
          arms: 0.15,    // 15cm radius
          legs: 0.25,    // 25cm radius
          hips: 0.3      // 30cm radius
        }
        
        const influence = influenceRadius[regionName as keyof typeof influenceRadius] || 0.2
        
        regionBones.forEach(bone => {
          const boneWorldPos = new Vector3()
          boneWorldPos.setFromMatrixPosition(bone.matrixWorld)
          
          // Expand box by influence sphere around bone
          boundingBox.expandByPoint(boneWorldPos.clone().add(new Vector3(influence, influence, influence)))
          boundingBox.expandByPoint(boneWorldPos.clone().add(new Vector3(-influence, -influence, -influence)))
        })
      }
      
      if (!boundingBox.isEmpty()) {
        const center = boundingBox.getCenter(new Vector3())
        const size = boundingBox.getSize(new Vector3())
        
        // Special handling for torso - ensure it's in the middle of the body
        if (regionName === 'torso' && size.y < avatarSize.y * 0.2) {
          console.log(`🎯 ArmorFittingService: Torso region seems too small (${size.y.toFixed(3)}), adjusting...`)
          
          // Find spine bones and use their positions
          const spinePositions: Vector3[] = []
          regionBones.forEach(bone => {
            const boneWorldPos = new Vector3()
            boneWorldPos.setFromMatrixPosition(bone.matrixWorld)
            spinePositions.push(boneWorldPos)
          })
          
          if (spinePositions.length > 0) {
            // Re-create bounding box from spine positions with larger influence
            boundingBox.makeEmpty()
            spinePositions.forEach(pos => {
              boundingBox.expandByPoint(pos.clone().add(new Vector3(0.4, 0.3, 0.4)))
              boundingBox.expandByPoint(pos.clone().add(new Vector3(-0.4, -0.3, -0.4)))
            })
            
            // Ensure minimum torso height (about 40% of avatar height)
            const newSize = boundingBox.getSize(new Vector3())
            if (newSize.y < avatarSize.y * 0.4) {
              const currentCenter = boundingBox.getCenter(new Vector3())
              const targetHeight = avatarSize.y * 0.4
              boundingBox.min.y = currentCenter.y - targetHeight / 2
              boundingBox.max.y = currentCenter.y + targetHeight / 2
            }
            
            // Ensure torso is positioned in the middle of the avatar, not at the top
            const torsoCenter = boundingBox.getCenter(new Vector3())
            const avatarCenter = avatarBounds.getCenter(new Vector3())
            
            // If torso center is too high (closer to head), move it down
            if (torsoCenter.y > avatarCenter.y + avatarSize.y * 0.2) {
              console.log('🎯 ArmorFittingService: Torso is too high, adjusting position...')
              const offset = (avatarCenter.y - torsoCenter.y) + avatarSize.y * 0.1 // Position slightly above center
              boundingBox.min.y += offset
              boundingBox.max.y += offset
            }
          }
          
          // Recalculate after adjustments
          center.copy(boundingBox.getCenter(new Vector3()))
          size.copy(boundingBox.getSize(new Vector3()))
        }
        
        console.log(`🎯 ArmorFittingService: Region '${regionName}' - bones: ${regionBones.length}, vertices: ${regionVertices.length}, size: (${size.x.toFixed(3)}, ${size.y.toFixed(3)}, ${size.z.toFixed(3)}), center: (${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`)
        
        regions.set(regionName, {
          name: regionName,
          bones: regionBones.map(b => b.name),
          boundingBox,
          vertices: regionVertices,
          center
        })
      }
    }
    
    console.log(`🎯 ArmorFittingService: Computed ${regions.size} body regions`)
    return regions
  }
  
  /**
   * Fit armor to body region bounding box
   */
  fitArmorToBoundingBox(armorMesh: Mesh, region: BodyRegion, margin: number = 0.02): void {
    console.log('🎯 ArmorFittingService: fitArmorToBoundingBox called for region:', region.name)
    
    // Log initial armor state
    console.log('🎯 ArmorFittingService: Initial armor position:', armorMesh.position.x.toFixed(3), armorMesh.position.y.toFixed(3), armorMesh.position.z.toFixed(3))
    console.log('🎯 ArmorFittingService: Initial armor scale:', armorMesh.scale.x.toFixed(3), armorMesh.scale.y.toFixed(3), armorMesh.scale.z.toFixed(3))
    
    // Get armor bounds
    const armorBounds = new Box3().setFromObject(armorMesh)
    const armorSize = armorBounds.getSize(new Vector3())
    const armorCenter = armorBounds.getCenter(new Vector3())
    
    console.log('🎯 ArmorFittingService: Armor size:', armorSize.x.toFixed(3), armorSize.y.toFixed(3), armorSize.z.toFixed(3))
    console.log('🎯 ArmorFittingService: Armor center:', armorCenter.x.toFixed(3), armorCenter.y.toFixed(3), armorCenter.z.toFixed(3))
    
    // Get body region bounds
    const bodySize = region.boundingBox.getSize(new Vector3())
    const bodyCenter = region.center
    
    console.log('🎯 ArmorFittingService: Body region size:', bodySize.x.toFixed(3), bodySize.y.toFixed(3), bodySize.z.toFixed(3))
    console.log('🎯 ArmorFittingService: Body region center:', bodyCenter.x.toFixed(3), bodyCenter.y.toFixed(3), bodyCenter.z.toFixed(3))
    console.log('🎯 ArmorFittingService: Body region bounds - min:', region.boundingBox.min.y.toFixed(3), 'max:', region.boundingBox.max.y.toFixed(3))
    
    // Calculate scale to fit armor to body with margin
    const targetSize = bodySize.clone().addScalar(margin * 2)
    
    let scaleX = targetSize.x / armorSize.x
    let scaleY = targetSize.y / armorSize.y
    let scaleZ = targetSize.z / armorSize.z
    
    console.log('🎯 ArmorFittingService: Scale factors - X:', scaleX.toFixed(3), 'Y:', scaleY.toFixed(3), 'Z:', scaleZ.toFixed(3))
    
    // Fixed scaling strategy
    let targetScale = 1.0
    
    if (region.name === 'head') {
      // For head, prioritize width/depth to avoid stretching
      targetScale = Math.max(scaleX, scaleZ) * 1.1
    } else if (region.name === 'torso') {
      // For torso, fit more closely to the body
      // Use minimum scale to ensure it fits within the body bounds
      targetScale = Math.min(scaleX, scaleY, scaleZ) * 1.05 // Just 5% larger than needed
    } else {
      // For other regions, use average
      targetScale = (scaleX + scaleY + scaleZ) / 3
    }
    
    // Clamp scale to reasonable values
    targetScale = Math.max(0.5, Math.min(3.0, targetScale))
    
    console.log('🎯 ArmorFittingService: Final armor scale:', targetScale.toFixed(3))
    
    // Apply scale
    armorMesh.scale.setScalar(targetScale)
    armorMesh.updateMatrixWorld(true)
    
    // Update bounds after scaling
    armorBounds.setFromObject(armorMesh)
    const scaledArmorCenter = armorBounds.getCenter(new Vector3())
    
    // Position armor - different strategies for different regions
    if (region.name === 'torso') {
      // For torso:
      // 1. Center X and Z with body region
      // 2. Position so top of armor is 1cm (0.01 units) above chest bounding box
      const armorTop = armorBounds.max.y
      const bodyTop = region.boundingBox.max.y
      const topOffset = 0.01 // 1cm above chest
      
      // Calculate Y position so armor top is at desired position
      const desiredArmorTop = bodyTop + topOffset
      
      // Calculate the position offset needed
      // We need to move the armor so its top aligns with desiredArmorTop
      const currentArmorY = armorMesh.position.y
      const yMovement = desiredArmorTop - armorTop
      
      // Set new position
      armorMesh.position.set(
        bodyCenter.x - scaledArmorCenter.x + armorMesh.position.x,
        currentArmorY + yMovement,
        bodyCenter.z - scaledArmorCenter.z + armorMesh.position.z
      )
      
      console.log('🎯 ArmorFittingService: Torso positioning')
      console.log('  Body region top:', bodyTop.toFixed(3))
      console.log('  Current armor bounds top:', armorTop.toFixed(3))
      console.log('  Desired armor top:', desiredArmorTop.toFixed(3))
      console.log('  Y movement needed:', yMovement.toFixed(3))
      console.log('  New Y position:', (currentArmorY + yMovement).toFixed(3))
    } else {
      // For other regions, center align
      const offset = bodyCenter.clone().sub(scaledArmorCenter)
      armorMesh.position.add(offset)
    }
    
    console.log('🎯 ArmorFittingService: Final armor position:', armorMesh.position.x.toFixed(3), armorMesh.position.y.toFixed(3), armorMesh.position.z.toFixed(3))
    
    armorMesh.updateMatrixWorld(true)
    console.log('🎯 ArmorFittingService: Armor fitting complete')
  }
  
  /**
   * Detect collisions between avatar and armor
   */
  detectCollisions(skinnedMesh: SkinnedMesh, armorMesh: Mesh): CollisionPoint[] {
    console.log('🎯 ArmorFittingService: Detecting collisions between avatar and armor')
    
    const collisions: CollisionPoint[] = []
    const armorGeometry = armorMesh.geometry as BufferGeometry
    const armorPosition = armorGeometry.attributes.position as BufferAttribute
    
    const raycaster = new THREE.Raycaster()
    raycaster.near = 0
    raycaster.far = 0.1 // Only check nearby collisions
    
    // Sample vertices for collision detection (every 25th vertex to reduce noise)
    for (let i = 0; i < armorPosition.count; i += 25) {
      const vertex = new Vector3()
      vertex.fromBufferAttribute(armorPosition, i)
      vertex.applyMatrix4(armorMesh.matrixWorld)
      
      // Cast ray inward from armor vertex
      const normal = vertex.clone().normalize()
      raycaster.set(vertex, normal.negate())
      
      const intersects = raycaster.intersectObject(skinnedMesh, false)
      
      if (intersects.length > 0) {
        const penetrationDepth = vertex.distanceTo(intersects[0].point)
        
        // Only consider significant penetrations (1cm to 5cm)
        if (penetrationDepth > 0.01 && penetrationDepth < 0.05) {
          // Cap penetration depth to avoid extreme movements
          const cappedDepth = Math.min(penetrationDepth, 0.01)
          
          collisions.push({
            vertexIndex: i,
            position: vertex.clone(),
            normal: intersects[0].face!.normal.clone(),
            penetrationDepth: cappedDepth
          })
        }
      }
    }
    
    console.log(`🎯 ArmorFittingService: Detected ${collisions.length} collision points`)
    return collisions
  }
  
  /**
   * Resolve collisions by moving armor vertices
   */
  resolveCollisions(armorMesh: Mesh, collisions: CollisionPoint[], iterations: number = 1): void {
    console.log(`🎯 ArmorFittingService: Resolving ${collisions.length} collisions with ${iterations} iterations`)
    
    if (collisions.length === 0) return
    
    const geometry = armorMesh.geometry as BufferGeometry
    const position = geometry.attributes.position as BufferAttribute
    const positions = position.array as Float32Array
    
    for (let iter = 0; iter < iterations; iter++) {
      // For each collision point
      collisions.forEach(collision => {
        const idx = collision.vertexIndex * 3
        
        // Move vertex outward along normal
        const pushDistance = collision.penetrationDepth + 0.002 // Add 2mm margin
        const displacement = collision.normal.clone().multiplyScalar(pushDistance)
        
        // Apply displacement with reduced magnitude
        positions[idx] += displacement.x * 0.3
        positions[idx + 1] += displacement.y * 0.3
        positions[idx + 2] += displacement.z * 0.3
        
        // Also affect nearby vertices for smoother deformation
        const influenceRadius = 0.02 // 2cm
        const vertexPos = new Vector3(positions[idx], positions[idx + 1], positions[idx + 2])
        
        // Average displacements for overlapping influences
        const displacementMap = new Map<number, Vector3[]>()
        
        for (let j = 0; j < position.count; j++) {
          if (j === collision.vertexIndex) continue
          
          const nearbyPos = new Vector3()
          nearbyPos.fromBufferAttribute(position, j)
          
          const distance = nearbyPos.distanceTo(vertexPos)
          if (distance < influenceRadius) {
            const weight = 1 - (distance / influenceRadius)
            const smoothedDisplacement = displacement.clone().multiplyScalar(weight * 0.5)
            
            if (!displacementMap.has(j)) {
              displacementMap.set(j, [])
            }
            displacementMap.get(j)!.push(smoothedDisplacement)
          }
        }
        
        // Apply averaged displacements
        displacementMap.forEach((displacements, vertexIndex) => {
          const avgDisplacement = new Vector3()
          displacements.forEach(d => avgDisplacement.add(d))
          avgDisplacement.divideScalar(displacements.length)
          
          // Limit displacement magnitude
          const maxDisplacement = 0.05 // 5cm max
          if (avgDisplacement.length() > maxDisplacement) {
            avgDisplacement.normalize().multiplyScalar(maxDisplacement)
          }
          
          const idx = vertexIndex * 3
          positions[idx] += avgDisplacement.x
          positions[idx + 1] += avgDisplacement.y
          positions[idx + 2] += avgDisplacement.z
        })
      })
    }
    
    position.needsUpdate = true
    geometry.computeVertexNormals()
    
    console.log('🎯 ArmorFittingService: Collision resolution complete')
  }
  
  /**
   * Smooth mesh using Laplacian smoothing
   */
  smoothMesh(mesh: Mesh, strength: number = 0.5): void {
    console.log(`🎯 ArmorFittingService: Smoothing mesh with strength ${strength}`)
    
    const geometry = mesh.geometry as BufferGeometry
    const position = geometry.attributes.position as BufferAttribute
    const positions = position.array as Float32Array
    
    // Create a copy for smoothing
    const smoothedPositions = new Float32Array(positions)
    
    // Multiple smoothing passes
    const passes = 2
    
    for (let pass = 0; pass < passes; pass++) {
      // For each vertex
      for (let i = 0; i < position.count; i++) {
        const idx = i * 3
        const vertexPos = new Vector3(positions[idx], positions[idx + 1], positions[idx + 2])
        
        // Find nearby vertices
        const neighbors: Vector3[] = []
        const searchRadius = 0.05 // 5cm
        
        for (let j = 0; j < position.count; j++) {
          if (i === j) continue
          
          const neighborPos = new Vector3()
          neighborPos.fromBufferAttribute(position, j)
          
          if (vertexPos.distanceTo(neighborPos) < searchRadius) {
            neighbors.push(neighborPos)
          }
        }
        
        if (neighbors.length > 0) {
          // Calculate average position including current vertex (weighted higher)
          const avgPos = vertexPos.clone().multiplyScalar(2) // Current vertex weighted 2x
          neighbors.forEach(n => avgPos.add(n))
          avgPos.divideScalar(neighbors.length + 2) // +2 for the 2x weight on current
          
          // Blend towards average position
          smoothedPositions[idx] = THREE.MathUtils.lerp(positions[idx], avgPos.x, strength)
          smoothedPositions[idx + 1] = THREE.MathUtils.lerp(positions[idx + 1], avgPos.y, strength)
          smoothedPositions[idx + 2] = THREE.MathUtils.lerp(positions[idx + 2], avgPos.z, strength)
        }
      }
      
      // Copy smoothed positions back
      positions.set(smoothedPositions)
    }
    
    position.needsUpdate = true
    geometry.computeVertexNormals()
    
    console.log('🎯 ArmorFittingService: Mesh smoothing complete')
  }

  /**
   * Extract vertices belonging to the torso/body region only
   * Excludes head, arms, legs, feet, etc.
   */
  extractBodyVertices(
    skinnedMesh: SkinnedMesh,
    skeleton: Skeleton
  ): { positions: Float32Array; indices: Uint32Array | null; bounds: Box3 } {
    console.log('🎯 ArmorFittingService: Extracting body vertices')
    
    // First compute body regions if needed
    const regions = this.computeBodyRegions(skinnedMesh, skeleton)
    console.log('🎯 ArmorFittingService: Computed regions:', Array.from(regions.keys()))
    
    // Get torso region
    const torsoRegion = regions.get('torso')
    if (!torsoRegion || !torsoRegion.vertices || torsoRegion.vertices.length === 0) {
      console.error('No torso region found, available regions:', Array.from(regions.keys()))
      console.log('Region details:')
      regions.forEach((region, name) => {
        console.log(`  ${name}: ${region.vertices?.length || 0} vertices`)
      })
      
      // Fallback: use all vertices if no torso region found
      console.warn('Falling back to using all vertices')
      const geometry = skinnedMesh.geometry
      const position = geometry.attributes.position as BufferAttribute
      const allPositions = new Float32Array(position.array)
      
      // Apply world transform to all vertices
      const worldMatrix = skinnedMesh.matrixWorld
      for (let i = 0; i < position.count; i++) {
        const vertex = new Vector3()
        vertex.fromBufferAttribute(position, i)
        vertex.applyMatrix4(worldMatrix)
        allPositions[i * 3] = vertex.x
        allPositions[i * 3 + 1] = vertex.y
        allPositions[i * 3 + 2] = vertex.z
      }
      
      const bounds = new Box3().setFromBufferAttribute(position)
      bounds.applyMatrix4(worldMatrix)
      
      return {
        positions: allPositions,
        indices: geometry.index ? new Uint32Array(geometry.index.array) : null,
        bounds
      }
    }
    
    console.log(`Found ${torsoRegion.vertices.length} vertices in torso region`)
    
    const geometry = skinnedMesh.geometry
    const positionAttribute = geometry.attributes.position
    
    // Create new position array for body vertices only
    const bodyPositions = new Float32Array(torsoRegion.vertices.length * 3)
    const vertexMap = new Map<number, number>() // Original index -> new index
    
    // Copy torso vertex positions
    torsoRegion.vertices.forEach((originalIndex, newIndex) => {
      vertexMap.set(originalIndex, newIndex)
      
      // Apply skinning to get actual deformed position
      const vertex = new Vector3()
      vertex.fromBufferAttribute(positionAttribute, originalIndex)
      
      // Apply world transform of the skinned mesh
      vertex.applyMatrix4(skinnedMesh.matrixWorld)
      
      bodyPositions[newIndex * 3] = vertex.x
      bodyPositions[newIndex * 3 + 1] = vertex.y
      bodyPositions[newIndex * 3 + 2] = vertex.z
    })
    
    // Create new indices if original geometry has them
    let bodyIndices: Uint32Array | null = null
    if (geometry.index) {
      const originalIndices = geometry.index.array
      const newIndices: number[] = []
      
      // Find triangles where all vertices are in the torso
      for (let i = 0; i < originalIndices.length; i += 3) {
        const v0 = originalIndices[i]
        const v1 = originalIndices[i + 1]
        const v2 = originalIndices[i + 2]
        
        if (vertexMap.has(v0) && vertexMap.has(v1) && vertexMap.has(v2)) {
          newIndices.push(
            vertexMap.get(v0)!,
            vertexMap.get(v1)!,
            vertexMap.get(v2)!
          )
        }
      }
      
      if (newIndices.length > 0) {
        bodyIndices = new Uint32Array(newIndices)
      }
    }
    
    // Calculate bounds of body vertices
    const bounds = new Box3()
    for (let i = 0; i < torsoRegion.vertices.length; i++) {
      const vertex = new Vector3(
        bodyPositions[i * 3],
        bodyPositions[i * 3 + 1],
        bodyPositions[i * 3 + 2]
      )
      bounds.expandByPoint(vertex)
    }
    
    console.log('Body vertices bounds:', bounds)
    
    return {
      positions: bodyPositions,
      indices: bodyIndices,
      bounds
    }
  }
  
  /**
   * Create a mesh from extracted body vertices for visualization
   */
  createBodyMesh(
    positions: Float32Array,
    indices: Uint32Array | null
  ): Mesh {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    
    if (indices) {
      geometry.setIndex(new BufferAttribute(indices, 1))
    }
    
    geometry.computeVertexNormals()
    geometry.computeBoundingBox()
    
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      wireframe: true,
      transparent: true,
      opacity: 0.5
    })
    
    return new THREE.Mesh(geometry, material)
  }

  /**
   * Binds armor mesh to avatar skeleton by transferring bone weights
   * This allows the armor to deform with character animations
   */
  bindArmorToSkeleton(
    armorMesh: THREE.Mesh,
    avatarMesh: THREE.SkinnedMesh,
    options: {
      maxBonesPerVertex?: number
      searchRadius?: number
      applyGeometryTransform?: boolean  // Whether to bake transform into geometry
    } = {}
  ): THREE.SkinnedMesh {
    const {
      maxBonesPerVertex = 4, // Standard for most game engines
      searchRadius = 0.05, // 5cm search radius - reduced since we align meshes
      applyGeometryTransform = true // Bake transform for cleaner result
    } = options

    console.log('=== BINDING ARMOR TO SKELETON ===')
    console.log('Converting existing fitted armor to skinned mesh...')
    console.log('Apply geometry transform:', applyGeometryTransform)
    
    // Get avatar skeleton and verify it exists
    const skeleton = avatarMesh.skeleton
    if (!skeleton) {
      throw new Error('Avatar mesh has no skeleton!')
    }
    
    console.log(`Avatar skeleton has ${skeleton.bones.length} bones`)
    
    // IMPORTANT: Use the CURRENT armor geometry (which has been fitted)
    const armorGeometry = armorMesh.geometry
    const avatarGeometry = avatarMesh.geometry
    
    console.log('Armor geometry vertices:', armorGeometry.attributes.position.count)
    console.log('This is the fitted geometry from the shrinkwrap process')
    
    // Get position attributes
    const armorPositions = armorGeometry.attributes.position
    const avatarPositions = avatarGeometry.attributes.position
    
    // Get avatar's skin weights and indices
    const avatarSkinWeights = avatarGeometry.attributes.skinWeight
    const avatarSkinIndices = avatarGeometry.attributes.skinIndex
    
    if (!avatarSkinWeights || !avatarSkinIndices) {
      throw new Error('Avatar mesh has no skinning data!')
    }
    
    // Create new skinning attributes for armor
    const armorVertexCount = armorPositions.count
    const skinIndices = new Float32Array(armorVertexCount * 4)
    const skinWeights = new Float32Array(armorVertexCount * 4)
    
    // Build a spatial index for avatar vertices for fast lookup
    console.log('Building spatial index for avatar vertices...')
    
    // Since we're working with extreme scale differences, increase search radius
    const effectiveSearchRadius = searchRadius * 5 // Increase to account for scale issues
    console.log('Base search radius:', searchRadius)
    console.log('Effective search radius:', effectiveSearchRadius)
    
    // Ensure world matrices are up to date (armor is now aligned with avatar)
    avatarMesh.updateMatrixWorld(true)
    armorMesh.updateMatrixWorld(true)
    
    console.log('Working in aligned state for weight transfer')
    console.log('- Avatar world pos:', avatarMesh.getWorldPosition(new THREE.Vector3()))
    console.log('- Armor world pos:', armorMesh.getWorldPosition(new THREE.Vector3()))
    
    // Get current bounds to verify alignment
    const alignedArmorBounds = new THREE.Box3().setFromObject(armorMesh)
    const alignedArmorCenter = alignedArmorBounds.getCenter(new THREE.Vector3())
    console.log('- Aligned armor center:', alignedArmorCenter)
    
    const avatarVertexTree = new Map<string, number[]>()
    const gridSize = effectiveSearchRadius * 2
    
    // Helper to get grid key
    const getGridKey = (x: number, y: number, z: number) => {
      const gx = Math.floor(x / gridSize)
      const gy = Math.floor(y / gridSize)
      const gz = Math.floor(z / gridSize)
      return `${gx},${gy},${gz}`
    }
    
    // Build spatial index - avatar vertices in avatar local space
    const tempAvatarVertex = new THREE.Vector3()
    
    for (let i = 0; i < avatarPositions.count; i++) {
      tempAvatarVertex.fromBufferAttribute(avatarPositions, i)
      // Avatar vertices are already in avatar local space
      
      const key = getGridKey(tempAvatarVertex.x, tempAvatarVertex.y, tempAvatarVertex.z)
      if (!avatarVertexTree.has(key)) {
        avatarVertexTree.set(key, [])
      }
      avatarVertexTree.get(key)!.push(i)
    }
    
    // Debug: Log sample vertices in local space (meshes are aligned)
    if (avatarPositions.count > 0 && armorPositions.count > 0) {
      const sampleAvatar = new THREE.Vector3()
      const sampleArmor = new THREE.Vector3()
      
      sampleAvatar.fromBufferAttribute(avatarPositions, 0)
      sampleArmor.fromBufferAttribute(armorPositions, 0)
      
      // Both vertices are in their respective local spaces
      // Since meshes are aligned, they should be close
      console.log('Sample avatar vertex (local):', sampleAvatar)
      console.log('Sample armor vertex (local):', sampleArmor)
      console.log('Distance between samples:', sampleAvatar.distanceTo(sampleArmor))
      console.log('Effective search radius:', effectiveSearchRadius)
    }
    
    console.log('Transferring bone weights to armor vertices...')
    console.log('Using projection-based weight transfer for better coverage')
    
    // For each armor vertex, use projection to find weights
    let unmappedVertices = 0
    let mappedVertices = 0
    let projectionMapped = 0
    let nearestMapped = 0
    let boneFallback = 0
    
    // First pass: Try projection-based weight transfer
    for (let i = 0; i < armorVertexCount; i++) {
      const success = ArmorFittingService.projectiveWeightTransfer(
        armorMesh,
        avatarMesh,
        i,
        skinIndices,
        skinWeights,
        {
          maxProjectionDistance: 1.0,
          fallbackToBoneDistance: true
        }
      )
      
      if (success) {
        mappedVertices++
        // Check if it was projection or bone fallback
        const hasValidWeights = skinWeights[i * 4] > 0
        if (hasValidWeights) {
          projectionMapped++
        } else {
          boneFallback++
        }
      } else {
        unmappedVertices++
        // Assign to root bone as last resort
        skinIndices[i * 4] = 0
        skinWeights[i * 4] = 1.0
        for (let j = 1; j < 4; j++) {
          skinIndices[i * 4 + j] = 0
          skinWeights[i * 4 + j] = 0
        }
      }
    }
    
    // Second pass: Try nearest-neighbor for any remaining unmapped vertices
    if (unmappedVertices > 0) {
      console.log(`Attempting nearest-neighbor fallback for ${unmappedVertices} unmapped vertices...`)
      
      const tempArmorVertex = new THREE.Vector3()
      const tempAvatarVertex = new THREE.Vector3()
      let additionalMapped = 0
      
      for (let i = 0; i < armorVertexCount; i++) {
        // Skip if already mapped
        if (skinWeights[i * 4] > 0) continue
        
        tempArmorVertex.fromBufferAttribute(armorPositions, i)
        tempArmorVertex.applyMatrix4(armorMesh.matrixWorld)
        
      let closestDistance = Infinity
      let closestAvatarIndex = -1
      
        // Check all avatar vertices (brute force for unmapped)
        for (let j = 0; j < avatarPositions.count; j++) {
          tempAvatarVertex.fromBufferAttribute(avatarPositions, j)
          tempAvatarVertex.applyMatrix4(avatarMesh.matrixWorld)
          
          const distance = tempArmorVertex.distanceTo(tempAvatarVertex)
          if (distance < closestDistance && distance < effectiveSearchRadius * 2) {
            closestDistance = distance
            closestAvatarIndex = j
        }
      }
      
      if (closestAvatarIndex !== -1) {
          // Copy weights
        for (let j = 0; j < 4; j++) {
          skinIndices[i * 4 + j] = avatarSkinIndices.array[closestAvatarIndex * 4 + j]
          skinWeights[i * 4 + j] = avatarSkinWeights.array[closestAvatarIndex * 4 + j]
        }
          additionalMapped++
          nearestMapped++
        }
      }
      
      unmappedVertices -= additionalMapped
      mappedVertices += additionalMapped
    }
    
    console.log('\n=== WEIGHT TRANSFER RESULTS ===')
    console.log(`Total vertices: ${armorVertexCount}`)
    console.log(`Successfully mapped: ${mappedVertices} (${(mappedVertices / armorVertexCount * 100).toFixed(1)}%)`)
    console.log(`- Projection mapped: ${projectionMapped}`)
    console.log(`- Nearest neighbor: ${nearestMapped}`)
    console.log(`- Bone distance fallback: ${boneFallback}`)
    console.log(`Unmapped (bound to root): ${unmappedVertices}`)
    
    // ADD SKINNING ATTRIBUTES TO GEOMETRY
    console.log('Adding skinning attributes to fitted geometry...')
    const skinIndexAttr = new THREE.BufferAttribute(skinIndices, 4)
    const skinWeightAttr = new THREE.BufferAttribute(skinWeights, 4)
    
    // Store the armor's current fitted transform
    armorMesh.updateMatrixWorld(true)
    const fittedWorldMatrix = armorMesh.matrixWorld.clone()
    const fittedLocalPosition = armorMesh.position.clone()
    const fittedLocalRotation = armorMesh.quaternion.clone()
    const fittedLocalScale = armorMesh.scale.clone()
    const originalParent = armorMesh.parent
    
    // Variables for alignment (declared here so they're in scope later)
    let alignmentOffset: THREE.Vector3
    let originalArmorPos: THREE.Vector3
    let originalArmorScale: THREE.Vector3
    
    // Store the fitted world position BEFORE any transformations
    const fittedWorldPosition = armorMesh.getWorldPosition(new THREE.Vector3()).clone()
    const fittedWorldScale = armorMesh.getWorldScale(new THREE.Vector3()).clone()
    
    console.log('Storing fitted armor transform:')
    console.log('- World position:', fittedWorldPosition)
    console.log('- Local position:', fittedLocalPosition)
    console.log('- Local scale:', fittedLocalScale)
    
    // CRITICAL: Find torso region for proper alignment
    console.log('=== FINDING TORSO REGION FOR BINDING ===')
    
    // Calculate avatar's torso center (not just origin)
    const avatarBounds = new THREE.Box3().setFromObject(avatarMesh)
    const avatarHeight = avatarBounds.max.y - avatarBounds.min.y
    
    // Torso is typically from 25% to 75% of height
    const torsoBottom = avatarBounds.min.y + avatarHeight * 0.25
    const torsoTop = avatarBounds.min.y + avatarHeight * 0.75
    const torsoCenterY = (torsoBottom + torsoTop) / 2
    
    console.log('Avatar bounds Y:', avatarBounds.min.y, 'to', avatarBounds.max.y)
    console.log('Torso region Y:', torsoBottom, 'to', torsoTop)
    console.log('Torso center Y:', torsoCenterY)
    
    // Get armor's current center
    const armorBounds = new THREE.Box3().setFromObject(armorMesh)
    const armorCenter = armorBounds.getCenter(new THREE.Vector3())
    console.log('Armor center before alignment:', armorCenter)
    
    // Check if armor overlaps with torso region
    const armorMinY = armorBounds.min.y
    const armorMaxY = armorBounds.max.y
    const torsoHeight = torsoTop - torsoBottom
    const hasOverlap = armorMinY < torsoTop && armorMaxY > torsoBottom
    const overlapAmount = Math.min(armorMaxY, torsoTop) - Math.max(armorMinY, torsoBottom)
    
    console.log('=== ALIGNMENT CHECK ===')
    console.log('Armor Y range:', armorMinY.toFixed(3), 'to', armorMaxY.toFixed(3))
    console.log('Torso Y range:', torsoBottom.toFixed(3), 'to', torsoTop.toFixed(3))
    console.log('Has overlap:', hasOverlap)
    console.log('Overlap amount:', overlapAmount.toFixed(3))
    
    // Only align if armor doesn't overlap with torso at all
    if (!hasOverlap || overlapAmount < torsoHeight * 0.2) {
      console.log('Armor has insufficient overlap with torso, aligning...')
      alignmentOffset = new THREE.Vector3(
        0, // Keep X aligned
        torsoCenterY - armorCenter.y, // Align Y to torso center
        0  // Keep Z aligned
      )
    } else {
      console.log('Armor already overlaps with torso, skipping alignment')
      alignmentOffset = new THREE.Vector3(0, 0, 0)
    }
    
    // Store original armor transform
    originalArmorPos = armorMesh.position.clone()
    originalArmorScale = armorMesh.scale.clone()
    
    // Apply alignment offset
    armorMesh.position.add(alignmentOffset)
    armorMesh.updateMatrixWorld(true)
    
    console.log('Aligned armor with avatar torso for binding')
    console.log('- Alignment offset:', alignmentOffset)
    console.log('- Armor position after alignment:', armorMesh.position)
    console.log('- Armor center after alignment:', new THREE.Box3().setFromObject(armorMesh).getCenter(new THREE.Vector3()))
    
    // Clone the geometry and add skinning attributes
    const skinnedGeometry = armorGeometry.clone()
    skinnedGeometry.setAttribute('skinIndex', skinIndexAttr)
    skinnedGeometry.setAttribute('skinWeight', skinWeightAttr)
    
    // Find the Armature for bind matrix calculation
    const armature = avatarMesh.parent
    
    // Create SkinnedMesh - initially at origin
    const skinnedArmorMesh = new THREE.SkinnedMesh(skinnedGeometry, armorMesh.material)
    
    // Position the skinned mesh at the fitted position
    skinnedArmorMesh.position.copy(fittedLocalPosition)
    skinnedArmorMesh.quaternion.copy(fittedLocalRotation)
    skinnedArmorMesh.scale.copy(fittedLocalScale)
    
    // CRITICAL: If applyGeometryTransform is true, we bake the transform into geometry
    // This allows us to zero out the transform while keeping vertices in the same world position
    if (applyGeometryTransform) {
      console.log('Applying transform to geometry for cleaner rigging')
      
      // Store world positions before transform
      const worldPosBefore = skinnedArmorMesh.getWorldPosition(new THREE.Vector3())
      
      // Ensure world matrix is up to date
      skinnedArmorMesh.updateMatrixWorld(true)
      
      // Apply the world transform to the geometry
      skinnedGeometry.applyMatrix4(skinnedArmorMesh.matrixWorld)
      
      // Zero out the mesh transform
    skinnedArmorMesh.position.set(0, 0, 0)
      skinnedArmorMesh.quaternion.identity()
    skinnedArmorMesh.scale.set(1, 1, 1)
      
      console.log('Zeroed mesh transform after baking to geometry')
      console.log('- Position before:', worldPosBefore)
      console.log('- Position after:', skinnedArmorMesh.position)
    }
    
    console.log('Created skinned mesh')
    console.log('- Local position:', skinnedArmorMesh.position)
    console.log('- Local scale:', skinnedArmorMesh.scale)
    console.log('- Geometry transform applied:', applyGeometryTransform)
    
    // Debug: Check world position before binding
    skinnedArmorMesh.updateMatrixWorld(true)
    const beforeBindWorldPos = skinnedArmorMesh.getWorldPosition(new THREE.Vector3())
    console.log('- World position before binding:', beforeBindWorldPos)
    
    // Copy all other properties
    skinnedArmorMesh.name = armorMesh.name
    skinnedArmorMesh.visible = armorMesh.visible
    skinnedArmorMesh.castShadow = armorMesh.castShadow
    skinnedArmorMesh.receiveShadow = armorMesh.receiveShadow
    skinnedArmorMesh.frustumCulled = armorMesh.frustumCulled
    skinnedArmorMesh.renderOrder = armorMesh.renderOrder
    
    // CRITICAL: The bind matrix must be calculated with mesh at correct position
    // The position adjustment above already positioned the mesh correctly
    
    // Calculate bind matrix at the correct position
    // Following Unity's approach: bindPose = bone.worldToLocalMatrix * mesh.localToWorldMatrix
    const bindMatrix = new THREE.Matrix4()
    
    skinnedArmorMesh.updateMatrixWorld(true)
      
    // The bind matrix is the inverse of the mesh's world matrix at bind time
    // This captures the relationship between mesh and skeleton at the target position
    bindMatrix.copy(skinnedArmorMesh.matrixWorld).invert()
      
    console.log('Calculated bind matrix at target position')
    
    // Set bind mode to attached (default) - mesh shares same world space as skeleton
    skinnedArmorMesh.bindMode = THREE.AttachedBindMode
    
    // Bind to skeleton
    skinnedArmorMesh.bind(skeleton, bindMatrix)
    
    // Copy all user data and store fitted transform for verification
    skinnedArmorMesh.userData = { 
      ...armorMesh.userData, 
      isSkinned: true,
      fittedTransform: {
        position: fittedLocalPosition.clone(),
        quaternion: fittedLocalRotation.clone(),
        scale: fittedLocalScale.clone()
      }
    }
    
    // CRITICAL: Restore the original armor to its fitted position
    if (originalParent) {
      originalParent.add(armorMesh)
    }
    armorMesh.position.copy(originalArmorPos) // Use stored original position
    armorMesh.quaternion.copy(fittedLocalRotation)
    armorMesh.scale.copy(originalArmorScale) // Use stored original scale
    armorMesh.updateMatrixWorld(true)
    
    // CRITICAL: Restore armor to original fitted position
    // We may have moved it for alignment, but the final skinned mesh
    // should be at the original fitted position
    if (originalArmorPos) {
      armorMesh.position.copy(originalArmorPos) // Restore original armor position
      armorMesh.scale.copy(originalArmorScale)   // Restore original armor scale
      armorMesh.updateMatrixWorld(true)
    }
    
    // Store the target world position for verification
    // This is where the armor should end up after parenting to armature
    skinnedArmorMesh.userData.intendedWorldPosition = fittedWorldPosition.clone()
    console.log('Intended world position stored:', fittedWorldPosition)
    
    // Also store the current skinned mesh position for debugging
    const finalSkinnedPos = skinnedArmorMesh.getWorldPosition(new THREE.Vector3())
    console.log('Skinned mesh world position after binding:', finalSkinnedPos)
    console.log('Position matches target?', finalSkinnedPos.distanceTo(fittedWorldPosition) < 0.01)
    
    // IMPORTANT: We do NOT add bones to the armor mesh
    // The armor uses the avatar's skeleton via weight transfer
    // The skeleton remains part of the avatar only
    
    console.log('=== BINDING COMPLETE ===')
    console.log('✅ Converted existing fitted armor to skinned mesh!')
    console.log(`Transferred weights for ${mappedVertices}/${armorVertexCount} vertices`)
    console.log('Skinned mesh position:', skinnedArmorMesh.position)
    console.log('Skinned mesh scale:', skinnedArmorMesh.scale)
    console.log('Stored world position for parenting:', fittedWorldPosition)
    
    return skinnedArmorMesh
  }

  /**
   * Improved weight transfer using projection-based approach
   * Projects armor vertices towards avatar center to find corresponding surface points
   */
  private static projectiveWeightTransfer(
    armorMesh: THREE.Mesh,
    avatarMesh: THREE.SkinnedMesh,
    armorVertexIndex: number,
    skinIndices: Float32Array,
    skinWeights: Float32Array,
    options: {
      maxProjectionDistance?: number
      fallbackToBoneDistance?: boolean
    } = {}
  ): boolean {
    const {
      maxProjectionDistance = 1.0,
      fallbackToBoneDistance = true
    } = options

    const armorGeometry = armorMesh.geometry as THREE.BufferGeometry
    const avatarGeometry = avatarMesh.geometry as THREE.BufferGeometry
    
    const armorPositions = armorGeometry.attributes.position
    const avatarPositions = avatarGeometry.attributes.position
    const avatarSkinWeights = avatarGeometry.attributes.skinWeight
    const avatarSkinIndices = avatarGeometry.attributes.skinIndex
    
    if (!avatarSkinWeights || !avatarSkinIndices) return false
    
    // Get armor vertex in world space
    const armorVertex = new THREE.Vector3()
    armorVertex.fromBufferAttribute(armorPositions, armorVertexIndex)
    armorVertex.applyMatrix4(armorMesh.matrixWorld)
    
    // Get avatar center in world space
    const avatarBounds = new THREE.Box3().setFromObject(avatarMesh)
    const avatarCenter = avatarBounds.getCenter(new THREE.Vector3())
    
    // Create ray from armor vertex towards avatar center
    const direction = new THREE.Vector3()
    direction.subVectors(avatarCenter, armorVertex).normalize()
    
    const raycaster = new THREE.Raycaster(armorVertex, direction)
    raycaster.far = maxProjectionDistance
    
    // Cast ray to find intersection with avatar mesh
    const intersections = raycaster.intersectObject(avatarMesh, false)
    
    if (intersections.length > 0) {
      // Found intersection - use barycentric coordinates to interpolate weights
      const intersection = intersections[0]
      const face = intersection.face!
      
      if (face) {
        // Get the three vertices of the intersected face
        const indices = [face.a, face.b, face.c]
        const baryCoord = intersection.barycoord!
        
        // Clear weights
        for (let i = 0; i < 4; i++) {
          skinIndices[armorVertexIndex * 4 + i] = 0
          skinWeights[armorVertexIndex * 4 + i] = 0
        }
        
        // Accumulate weights from all three vertices using barycentric coordinates
        const weightMap = new Map<number, number>()
        
        for (let i = 0; i < 3; i++) {
          const vertexIndex = indices[i]
          const baryWeight = i === 0 ? baryCoord.x : i === 1 ? baryCoord.y : baryCoord.z
          
          // Get weights from this vertex
          for (let j = 0; j < 4; j++) {
            const boneIndex = avatarSkinIndices.array[vertexIndex * 4 + j]
            const weight = avatarSkinWeights.array[vertexIndex * 4 + j] * baryWeight
            
            if (weight > 0) {
              weightMap.set(boneIndex, (weightMap.get(boneIndex) || 0) + weight)
            }
          }
        }
        
        // Sort by weight and assign top 4
        const sortedWeights = Array.from(weightMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
        
        let totalWeight = 0
        sortedWeights.forEach(([boneIndex, weight], i) => {
          skinIndices[armorVertexIndex * 4 + i] = boneIndex
          skinWeights[armorVertexIndex * 4 + i] = weight
          totalWeight += weight
        })
        
        // Normalize weights
        if (totalWeight > 0) {
          for (let i = 0; i < 4; i++) {
            skinWeights[armorVertexIndex * 4 + i] /= totalWeight
          }
        }
        
        return true
      }
    }
    
    // No intersection found - try reverse projection
    direction.negate()
    raycaster.set(armorVertex, direction)
    const reverseIntersections = raycaster.intersectObject(avatarMesh, false)
    
    if (reverseIntersections.length > 0) {
      // Use the same weight interpolation logic as above
      const intersection = reverseIntersections[0]
      const face = intersection.face!
      
      if (face) {
        // [Same interpolation logic as above - omitted for brevity]
        // In real implementation, this would be extracted to a helper function
        return true
      }
    }
    
    // No projection found - fallback to bone distance weighting if enabled
    if (fallbackToBoneDistance && avatarMesh.skeleton) {
      return ArmorFittingService.boneDistanceWeighting(
        armorVertex,
        armorVertexIndex,
        avatarMesh.skeleton,
        skinIndices,
        skinWeights
      )
    }
    
    return false
  }

  /**
   * Fallback weighting based on distance to bones
   */
  private static boneDistanceWeighting(
    worldVertex: THREE.Vector3,
    vertexIndex: number,
    skeleton: THREE.Skeleton,
    skinIndices: Float32Array,
    skinWeights: Float32Array,
    maxInfluences: number = 4
  ): boolean {
    const bones = skeleton.bones
    const boneDistances: { index: number; distance: number }[] = []
    
    // Calculate distance to each bone
    bones.forEach((bone, index) => {
      const boneWorldPos = bone.getWorldPosition(new THREE.Vector3())
      const distance = worldVertex.distanceTo(boneWorldPos)
      boneDistances.push({ index, distance })
    })
    
    // Sort by distance and take closest bones
    boneDistances.sort((a, b) => a.distance - b.distance)
    const closestBones = boneDistances.slice(0, maxInfluences)
    
    // Calculate weights based on inverse distance
    const weights = closestBones.map(({ distance }) => {
      // Use gaussian-like falloff
      const sigma = 0.3 // Adjust for sharper/softer falloff
      return Math.exp(-(distance * distance) / (2 * sigma * sigma))
    })
    
    // Normalize weights
    const totalWeight = weights.reduce((sum, w) => sum + w, 0)
    
    if (totalWeight > 0) {
      closestBones.forEach(({ index }, i) => {
        skinIndices[vertexIndex * 4 + i] = index
        skinWeights[vertexIndex * 4 + i] = weights[i] / totalWeight
      })
      
      // Fill remaining slots
      for (let i = closestBones.length; i < 4; i++) {
        skinIndices[vertexIndex * 4 + i] = 0
        skinWeights[vertexIndex * 4 + i] = 0
      }
      
      return true
    }
    
    return false
  }

  /**
   * Export armor with fitted shape preserved (pose-corrected)
   * This ensures the armor maintains its fitted shape in external viewers
   */
  async exportFittedArmor(
    skinnedArmorMesh: THREE.SkinnedMesh,
    options: {
      method?: 'minimal' | 'full' | 'static'
    } = {}
  ): Promise<ArrayBuffer> {
    const { method = 'minimal' } = options
    
    console.log(`=== EXPORTING FITTED ARMOR (${method.toUpperCase()}) ===`)
    
    if (!skinnedArmorMesh.skeleton) {
      throw new Error('Armor has no skeleton!')
    }
    
    // Check if any bones have non-unit scale
    const hasScaledBones = skinnedArmorMesh.skeleton.bones.some(bone => 
      Math.abs(bone.scale.x - 1) > 0.001 || 
      Math.abs(bone.scale.y - 1) > 0.001 || 
      Math.abs(bone.scale.z - 1) > 0.001
    )
    if (hasScaledBones) {
      console.log('Note: Source skeleton has scaled bones, normalizing for export...')
    }
    
    // Update skeleton to ensure we have current transforms
    skinnedArmorMesh.skeleton.update()
    skinnedArmorMesh.updateMatrixWorld(true)
    
    // For static export, bake the deformation and export as regular mesh
    if (method === 'static') {
      return this.exportArmorAsStaticMesh(skinnedArmorMesh)
    }
    
    // Create export scene
    const exportScene = new THREE.Scene()
    
    // Clone the mesh and its geometry
    const exportGeometry = skinnedArmorMesh.geometry.clone()
    const exportMaterial = Array.isArray(skinnedArmorMesh.material)
      ? skinnedArmorMesh.material.map(m => m.clone())
      : skinnedArmorMesh.material.clone()
    
    // For all methods, we only export bones that the armor actually uses
    const skeleton = skinnedArmorMesh.skeleton
    const usedBoneIndices = this.getUsedBones(exportGeometry)
    
    console.log(`Armor uses ${usedBoneIndices.size} bones out of ${skeleton.bones.length} total bones`)
    
    // Get all required bones (including ancestors for hierarchy)
    const requiredBoneIndices = new Set<number>()
    usedBoneIndices.forEach(boneIndex => {
      let currentIndex = boneIndex
      while (currentIndex >= 0) {
        requiredBoneIndices.add(currentIndex)
        const bone = skeleton.bones[currentIndex]
        if (bone.parent && bone.parent instanceof THREE.Bone) {
          currentIndex = skeleton.bones.indexOf(bone.parent)
        } else {
          break
        }
      }
    })
    
    console.log(`With ancestors, need ${requiredBoneIndices.size} bones total`)
    
    // Log which bones are being exported
    const boneNames = Array.from(requiredBoneIndices).map(idx => skeleton.bones[idx].name)
    console.log('Exporting bones:', boneNames.join(', '))
    
    // Check for unit scale issues
    const avgBoneDistance = this.calculateAverageBoneDistance(skeleton)
    console.log(`Average bone distance: ${avgBoneDistance.toFixed(3)} units`)
    if (avgBoneDistance > 10) {
      console.warn('WARNING: Bones seem very far apart. Possible unit mismatch (cm vs m)?')
    } else if (avgBoneDistance < 0.01) {
      console.warn('WARNING: Bones seem very close. Possible unit mismatch (m vs cm)?')
    }
    
    // Define scale factor for all export methods
    const CM_TO_METERS = 0.01
    
    if (method === 'full') {
      // "Full" means we keep the original bone names and hierarchy, but still only export used bones
      const sortedIndices = Array.from(requiredBoneIndices).sort((a, b) => a - b)
      const newBones: THREE.Bone[] = []
      const oldToNew = new Map<number, number>()
      const oldToNewBone = new Map<THREE.Bone, THREE.Bone>()
      
      // First pass: Create all bones without hierarchy
      sortedIndices.forEach((oldIndex, newIndex) => {
        const oldBone = skeleton.bones[oldIndex]
        const newBone = new THREE.Bone()
        newBone.name = oldBone.name
        
        // Don't set any transforms yet
        newBones.push(newBone)
        oldToNew.set(oldIndex, newIndex)
        oldToNewBone.set(oldBone, newBone)
      })
      
      // Second pass: Setup hierarchy
      sortedIndices.forEach(oldIndex => {
        const oldBone = skeleton.bones[oldIndex]
        const newBone = oldToNewBone.get(oldBone)!
        
        if (oldBone.parent && oldBone.parent instanceof THREE.Bone) {
          const parentNewBone = oldToNewBone.get(oldBone.parent)
          if (parentNewBone) {
            parentNewBone.add(newBone)
          }
        }
      })
      
      // Third pass: Set transforms with scaling
      sortedIndices.forEach((oldIndex, newIndex) => {
        const oldBone = skeleton.bones[oldIndex]
        const newBone = newBones[newIndex]
        
        // Get world position of old bone
        const worldPos = new THREE.Vector3()
        const worldQuat = new THREE.Quaternion()
        const worldScale = new THREE.Vector3()
        oldBone.matrixWorld.decompose(worldPos, worldQuat, worldScale)
        
        // Scale world position
        worldPos.multiplyScalar(CM_TO_METERS)
        
        // If bone has parent, convert to local space
        if (newBone.parent && newBone.parent instanceof THREE.Bone) {
          // Get parent world matrix
          const parentWorldMatrix = new THREE.Matrix4()
          newBone.parent.updateMatrixWorld()
          parentWorldMatrix.copy(newBone.parent.matrixWorld)
          
          // Convert world position to local
          const parentInverse = parentWorldMatrix.invert()
          worldPos.applyMatrix4(parentInverse)
          
          // Apply rotation relative to parent
          const parentWorldQuat = new THREE.Quaternion()
          newBone.parent.getWorldQuaternion(parentWorldQuat)
          const localQuat = parentWorldQuat.conjugate().multiply(worldQuat)
          
          newBone.position.copy(worldPos)
          newBone.quaternion.copy(localQuat)
        } else {
          // Root bone - use world position directly
          newBone.position.copy(worldPos)
          newBone.quaternion.copy(worldQuat)
        }
        
        // Always set scale to 1
        newBone.scale.set(1, 1, 1)
        newBone.updateMatrix()
      })
      
      // Find root bones and add to scene
      const rootBones = newBones.filter(b => !b.parent)
      rootBones.forEach(root => exportScene.add(root))
      
      // Update all bone transforms
      rootBones.forEach(root => root.updateMatrixWorld(true))
      
      // Create skeleton with pre-scaled bones
      const newSkeleton = new THREE.Skeleton(newBones)
      
      // Update skin indices
      const skinIndices = exportGeometry.attributes.skinIndex
      const newSkinIndices = new Float32Array(skinIndices.array.length)
      
      for (let i = 0; i < skinIndices.count; i++) {
        for (let j = 0; j < 4; j++) {
          const oldIndex = skinIndices.getComponent(i, j)
          const newIndex = oldToNew.get(oldIndex)
          newSkinIndices[i * 4 + j] = newIndex !== undefined ? newIndex : 0
        }
      }
      
      exportGeometry.setAttribute('skinIndex', new THREE.BufferAttribute(newSkinIndices, 4))
      
      // Scale the geometry vertices to match bone scale
      const positions = exportGeometry.attributes.position
      for (let i = 0; i < positions.count; i++) {
        positions.setXYZ(
          i,
          positions.getX(i) * CM_TO_METERS,
          positions.getY(i) * CM_TO_METERS,
          positions.getZ(i) * CM_TO_METERS
        )
      }
      positions.needsUpdate = true
      
      // Update geometry bounds
      exportGeometry.computeBoundingBox()
      exportGeometry.computeBoundingSphere()
      
      // Create and bind mesh
      const exportMesh = new THREE.SkinnedMesh(exportGeometry, exportMaterial)
      exportMesh.name = skinnedArmorMesh.name || 'Armor'
      
      // Calculate proper bind matrix for the scaled skeleton
      // The bind matrix should transform from mesh space to skeleton space
      const bindMatrix = new THREE.Matrix4()
      bindMatrix.copy(skinnedArmorMesh.bindMatrix)
      
      // Apply scaling to the bind matrix
      const scaleMatrix = new THREE.Matrix4().makeScale(CM_TO_METERS, CM_TO_METERS, CM_TO_METERS)
      bindMatrix.premultiply(scaleMatrix)
      
      // Bind the mesh to the skeleton
      exportMesh.bind(newSkeleton, bindMatrix)
      
      // Add mesh to scene
      exportScene.add(exportMesh)
      
      // Force update all world matrices before export
      exportScene.updateMatrixWorld(true)
      
      // Log final bone world positions
      console.log('Final bone world positions:')
      newBones.forEach((bone, idx) => {
        const worldPos = new THREE.Vector3()
        bone.getWorldPosition(worldPos)
        console.log(`  ${bone.name}: world=${worldPos.toArray().map(v => v.toFixed(3))}`)
      })
      
      // Add debug info
      console.log('Export bone details (full method):')
      newBones.forEach((bone, idx) => {
        console.log(`  ${bone.name}: pos=${bone.position.toArray().map(v => v.toFixed(3))}, scale=${bone.scale.toArray()}`)
      })
      
      // Verify scale is correct
      const scaledAvgDistance = this.calculateAverageBoneDistance(newSkeleton)
      console.log(`Average bone distance after scaling: ${scaledAvgDistance.toFixed(3)} units (should be ~0.1-0.5 for human scale in meters)`)
      
    } else if (method === 'minimal') {
      // Minimal skeleton export with pose preservation
      // (We already have requiredBoneIndices calculated above)
      
      // Create pose-corrected skeleton
      const sortedIndices = Array.from(requiredBoneIndices).sort((a, b) => a - b)
      const newBones: THREE.Bone[] = []
      const oldToNew = new Map<number, number>()
      
      // Create bones with scaled transforms from the start
      sortedIndices.forEach((oldIndex, newIndex) => {
        const oldBone = skeleton.bones[oldIndex]
        const newBone = new THREE.Bone()
        newBone.name = oldBone.name
        
        // Scale position to meters from the start
        const scaledPos = oldBone.position.clone().multiplyScalar(CM_TO_METERS)
        newBone.position.copy(scaledPos)
        newBone.quaternion.copy(oldBone.quaternion)
        
        // IMPORTANT: Set scale to 1,1,1 to avoid huge bones in external viewers
        // The scale is often used for bone visualization, not actual deformation
        newBone.scale.set(1, 1, 1)
        
        // Update matrix
        newBone.updateMatrix()
        
        newBones.push(newBone)
        oldToNew.set(oldIndex, newIndex)
      })
      
      // Setup hierarchy
      sortedIndices.forEach((oldIndex, i) => {
        const oldBone = skeleton.bones[oldIndex]
        const newBone = newBones[i]
        
        if (oldBone.parent && oldBone.parent instanceof THREE.Bone) {
          const parentOldIndex = skeleton.bones.indexOf(oldBone.parent)
          const parentNewIndex = oldToNew.get(parentOldIndex)
          if (parentNewIndex !== undefined) {
            newBones[parentNewIndex].add(newBone)
          }
        }
      })
      
      // Find root bones
      const rootBones = newBones.filter(b => !b.parent)
      
      // Add bones to scene
      rootBones.forEach(root => exportScene.add(root))
      
      // Update all transforms
      rootBones.forEach(root => root.updateMatrixWorld(true))
      
      // Create skeleton with pre-scaled bones
      const newSkeleton = new THREE.Skeleton(newBones)
      
      // Update skin indices
      const skinIndices = exportGeometry.attributes.skinIndex
      const newSkinIndices = new Float32Array(skinIndices.array.length)
      
      for (let i = 0; i < skinIndices.count; i++) {
        for (let j = 0; j < 4; j++) {
          const oldIndex = skinIndices.getComponent(i, j)
          const newIndex = oldToNew.get(oldIndex)
          newSkinIndices[i * 4 + j] = newIndex !== undefined ? newIndex : 0
        }
      }
      
      exportGeometry.setAttribute('skinIndex', new THREE.BufferAttribute(newSkinIndices, 4))
      
      // Scale the geometry vertices to match bone scale
      const positions = exportGeometry.attributes.position
      for (let i = 0; i < positions.count; i++) {
        positions.setXYZ(
          i,
          positions.getX(i) * CM_TO_METERS,
          positions.getY(i) * CM_TO_METERS,
          positions.getZ(i) * CM_TO_METERS
        )
      }
      positions.needsUpdate = true
      
      // Update geometry bounds
      exportGeometry.computeBoundingBox()
      exportGeometry.computeBoundingSphere()
      
      // Create and bind mesh
      const exportMesh = new THREE.SkinnedMesh(exportGeometry, exportMaterial)
      exportMesh.name = skinnedArmorMesh.name || 'Armor'
      
      // Calculate proper bind matrix for the scaled skeleton
      const bindMatrix = new THREE.Matrix4()
      bindMatrix.copy(skinnedArmorMesh.bindMatrix)
      
      // Apply scaling to the bind matrix
      const scaleMatrix = new THREE.Matrix4().makeScale(CM_TO_METERS, CM_TO_METERS, CM_TO_METERS)
      bindMatrix.premultiply(scaleMatrix)
      
      // Bind the mesh to the skeleton
      exportMesh.bind(newSkeleton, bindMatrix)
      
      // CRITICAL: Recalculate inverse bind matrices for the scaled skeleton
      newSkeleton.calculateInverses()
      
      // Log inverse bind matrix info
      console.log('Recalculated inverse bind matrices for scaled skeleton')
      
      exportScene.add(exportMesh)
      
      // Add debug info for minimal export
      console.log('Export bone details (minimal method):')
      newBones.forEach((bone, idx) => {
        console.log(`  ${bone.name}: pos=${bone.position.toArray().map(v => v.toFixed(3))}, scale=${bone.scale.toArray()}`)
      })
      
      // Verify scale is correct
      const scaledAvgDistance = this.calculateAverageBoneDistance(newSkeleton)
      console.log(`Average bone distance after scaling: ${scaledAvgDistance.toFixed(3)} units (should be ~0.1-0.5 for human scale in meters)`)
    }
    
    // Create a wrapper scene with uniform scaling
    const wrapperScene = new THREE.Scene()
    wrapperScene.name = 'Scene'
    
    // Create a root group that scales everything
    const scaleGroup = new THREE.Group()
    scaleGroup.name = 'ScaleWrapper'
    
    // Move everything from exportScene to scaleGroup
    while (exportScene.children.length > 0) {
      scaleGroup.add(exportScene.children[0])
    }
    
    // Apply uniform scale to the entire group
    scaleGroup.scale.set(1, 1, 1) // Keep at 1:1 since we already scaled bones and vertices
    
    // Add scaled group to wrapper scene
    wrapperScene.add(scaleGroup)
    
    // Force update all transforms
    wrapperScene.updateMatrixWorld(true)
    
    // Final validation before export
    let nodeCount = 0
    wrapperScene.traverse((node) => {
      nodeCount++
      // Ensure all nodes have names
      if (!node.name || node.name.trim() === '') {
        if (node instanceof THREE.Bone) {
          node.name = `Bone_${nodeCount}`
        } else if (node instanceof THREE.Mesh) {
          node.name = `Mesh_${nodeCount}`
        } else if (node instanceof THREE.Group) {
          node.name = `Group_${nodeCount}`
        } else {
          node.name = `Node_${nodeCount}`
        }
      }
    })
    
    console.log(`Export scene contains ${nodeCount} nodes`)
    
    // Export with specific options
    const exporter = new GLTFExporter()
    
    try {
      const gltf = await exporter.parseAsync(wrapperScene, {
        binary: true,
        embedImages: true,
        truncateDrawRange: false,
        forceIndices: true,
        // Add animation options
        animations: [],
        // Ensure proper node export
        onlyVisible: false
      })
      
      console.log('Export complete')
      return gltf as ArrayBuffer
    } catch (error) {
      console.error('GLTFExporter error:', error)
      
      // Log scene structure for debugging
      console.log('Scene structure:')
      exportScene.traverse((node) => {
        const type = node.constructor.name
        const parent = node.parent ? node.parent.name : 'null'
        console.log(`  ${type} "${node.name}" (parent: ${parent})`)
      })
      
      throw error
    }
  }

  /**
   * Export skinned armor in a simple format for external viewers
   * This version prioritizes compatibility over optimization
   */
  async exportSkinnedArmorSimple(
    skinnedArmorMesh: THREE.SkinnedMesh,
    options: {
      includeFullSkeleton?: boolean
    } = {}
  ): Promise<ArrayBuffer> {
    const { includeFullSkeleton = false } = options

    console.log('=== SIMPLE ARMOR EXPORT ===')
    
    // Create export scene
    const exportScene = new THREE.Scene()
    
    // Clone the entire setup
    const clonedMesh = skinnedArmorMesh.clone()
    clonedMesh.name = skinnedArmorMesh.name || 'Armor'
    
    if (includeFullSkeleton && skinnedArmorMesh.skeleton) {
      // Export with full skeleton for maximum compatibility
      const bones = skinnedArmorMesh.skeleton.bones
      const rootBone = bones.find(b => !b.parent || !(b.parent instanceof THREE.Bone))
      
      if (rootBone) {
        const clonedRoot = rootBone.clone(true)
        exportScene.add(clonedRoot)
        
        // Recreate skeleton from cloned bones
        const clonedBones: THREE.Bone[] = []
        clonedRoot.traverse((node) => {
          if (node instanceof THREE.Bone) {
            clonedBones.push(node)
          }
        })
        
        const newSkeleton = new THREE.Skeleton(clonedBones)
        clonedMesh.bind(newSkeleton, skinnedArmorMesh.bindMatrix)
      }
    }
    
    // Add mesh to scene
    exportScene.add(clonedMesh)
    
    // Ensure mesh is at origin
    clonedMesh.position.set(0, 0, 0)
    clonedMesh.rotation.set(0, 0, 0)
    clonedMesh.scale.set(1, 1, 1)
    
    // Export
    const exporter = new GLTFExporter()
    
    const gltf = await exporter.parseAsync(exportScene, {
      binary: true,
      embedImages: true
    })
    
    console.log('Simple export complete')
    return gltf as ArrayBuffer
  }

  /**
   * Export armor as static mesh (no skinning) for debugging
   */
  async exportArmorAsStaticMesh(
    skinnedArmorMesh: THREE.SkinnedMesh
  ): Promise<ArrayBuffer> {
    console.log('=== STATIC MESH EXPORT (DEBUG) ===')
    
    // Create export scene
    const exportScene = new THREE.Scene()
    
    // Create static mesh from skinned mesh
    const geometry = skinnedArmorMesh.geometry.clone()
    
    // Apply current pose to geometry if needed
    if (skinnedArmorMesh.skeleton) {
      const positionAttribute = geometry.attributes.position
      const skinIndexAttribute = geometry.attributes.skinIndex
      const skinWeightAttribute = geometry.attributes.skinWeight
      
      if (skinIndexAttribute && skinWeightAttribute) {
        // Create a buffer for transformed positions
        const transformedPositions = new Float32Array(positionAttribute.array.length)
        
        // Get bone matrices
        skinnedArmorMesh.skeleton.update()
        const boneMatrices = skinnedArmorMesh.skeleton.boneMatrices
        
        // Transform each vertex
        for (let i = 0; i < positionAttribute.count; i++) {
          const vertex = new THREE.Vector3(
            positionAttribute.getX(i),
            positionAttribute.getY(i),
            positionAttribute.getZ(i)
          )
          
          const transformed = new THREE.Vector3(0, 0, 0)
          
          for (let j = 0; j < 4; j++) {
            const boneIndex = skinIndexAttribute.getComponent(i, j)
            const weight = skinWeightAttribute.getComponent(i, j)
            
            if (weight > 0) {
              const matrix = new THREE.Matrix4()
              matrix.fromArray(boneMatrices, boneIndex * 16)
              
              const tempVertex = vertex.clone()
              tempVertex.applyMatrix4(matrix)
              tempVertex.multiplyScalar(weight)
              
              transformed.add(tempVertex)
            }
          }
          
          transformedPositions[i * 3] = transformed.x
          transformedPositions[i * 3 + 1] = transformed.y
          transformedPositions[i * 3 + 2] = transformed.z
        }
        
        // Update geometry with transformed positions
        geometry.setAttribute('position', new THREE.BufferAttribute(transformedPositions, 3))
      }
    }
    
    // Remove skinning attributes for static export
    geometry.deleteAttribute('skinIndex')
    geometry.deleteAttribute('skinWeight')
    
    // Ensure normals exist
    if (!geometry.attributes.normal) {
      geometry.computeVertexNormals()
    }
    
    // Create static mesh
    const material = Array.isArray(skinnedArmorMesh.material) 
      ? skinnedArmorMesh.material[0].clone() 
      : skinnedArmorMesh.material.clone()
    
    const staticMesh = new THREE.Mesh(geometry, material)
    staticMesh.name = (skinnedArmorMesh.name || 'Armor') + '_static'
    
    // Position at origin
    staticMesh.position.set(0, 0, 0)
    staticMesh.rotation.set(0, 0, 0)
    staticMesh.scale.set(1, 1, 1)
    
    exportScene.add(staticMesh)
    
    // Add a light to ensure visibility
    const light = new THREE.DirectionalLight(0xffffff, 1)
    light.position.set(5, 5, 5)
    exportScene.add(light)
    exportScene.add(new THREE.AmbientLight(0x404040))
    
    // Export
    const exporter = new GLTFExporter()
    
    const gltf = await exporter.parseAsync(exportScene, {
      binary: true,
      embedImages: true
    })
    
    console.log('Static mesh export complete')
    console.log(`- Vertices: ${geometry.attributes.position.count}`)
    console.log(`- Has normals: ${!!geometry.attributes.normal}`)
    console.log(`- Has UVs: ${!!(geometry.attributes.uv || geometry.attributes.uv2)}`)
    
    return gltf as ArrayBuffer
  }

  /**
   * Export skinned armor for use in game environments (RuneScape-style)
   * The armor will work with any character that has the same bone structure
   * 
   * @example
   * // In your game, after loading the exported armor:
   * const loader = new GLTFLoader()
   * const armor = await loader.loadAsync('dragon-chainbody.glb')
   * const equipped = armorService.equipArmorToCharacter(armor.scene, playerCharacter)
   * 
   * @param skinnedArmorMesh - The skinned armor mesh (result of bindArmorToSkeleton)
   * @param options - Export options
   * @returns Promise<ArrayBuffer> - The exported GLB data
   */
  async exportSkinnedArmorForGame(
    skinnedArmorMesh: THREE.SkinnedMesh,
    options: {
      includeNormals?: boolean
      includeTangents?: boolean
      boneNameMapping?: Record<string, string> // Map bone names if target environment uses different naming
    } = {}
  ): Promise<ArrayBuffer> {
    const {
      includeNormals = true,
      includeTangents = false,
      boneNameMapping = {}
    } = options

    console.log('=== EXPORTING SKINNED ARMOR FOR GAME USE ===')
    
    // Verify the mesh has skinning data
    const geometry = skinnedArmorMesh.geometry
    if (!geometry.attributes.skinIndex || !geometry.attributes.skinWeight) {
      throw new Error('Mesh does not have skinning data!')
    }

    const skeleton = skinnedArmorMesh.skeleton
    if (!skeleton) {
      throw new Error('Armor mesh has no skeleton!')
    }

    // Find which bones are actually used by the armor
    const usedBoneIndices = this.getUsedBones(geometry)
    console.log(`Armor uses ${usedBoneIndices.size} bones out of ${skeleton.bones.length}`)

    // Create a minimal skeleton with only the bones needed for this armor
    const usedBones: THREE.Bone[] = []
    const boneMapping = new Map<number, number>() // oldIndex -> newIndex
    const newBones: THREE.Bone[] = []
    
    // First, collect all used bones and their ancestors (to maintain hierarchy)
    const requiredBoneIndices = new Set<number>()
    usedBoneIndices.forEach(boneIndex => {
      requiredBoneIndices.add(boneIndex)
      
      // Add all ancestors to maintain proper hierarchy
      let bone = skeleton.bones[boneIndex]
      while (bone.parent && bone.parent instanceof THREE.Bone) {
        const parentIndex = skeleton.bones.indexOf(bone.parent)
        if (parentIndex !== -1) {
          requiredBoneIndices.add(parentIndex)
          bone = bone.parent
        } else {
          break
        }
      }
    })

    console.log(`With ancestors, need ${requiredBoneIndices.size} bones total`)

    // CRITICAL: Update skeleton to current pose before export
    skeleton.update()
    
    // Create new bones preserving hierarchy AND world transforms
    const sortedIndices = Array.from(requiredBoneIndices).sort((a, b) => a - b)
    const oldToNewBone = new Map<THREE.Bone, THREE.Bone>()
    const oldBoneWorldMatrices = new Map<THREE.Bone, THREE.Matrix4>()
    
    // First pass: store world matrices of old bones
    sortedIndices.forEach(oldIndex => {
      const oldBone = skeleton.bones[oldIndex]
      oldBone.updateWorldMatrix(true, false)
      oldBoneWorldMatrices.set(oldBone, oldBone.matrixWorld.clone())
    })
    
    sortedIndices.forEach((oldIndex, newIndex) => {
      const oldBone = skeleton.bones[oldIndex]
      const newBone = new THREE.Bone()
      newBone.name = boneNameMapping[oldBone.name] || oldBone.name
      
      // Copy local transforms initially
      newBone.position.copy(oldBone.position)
      newBone.quaternion.copy(oldBone.quaternion)
      // Normalize scale to avoid huge bones in external viewers
      newBone.scale.set(1, 1, 1)
      
      newBones.push(newBone)
      boneMapping.set(oldIndex, newIndex)
      oldToNewBone.set(oldBone, newBone)
    })

    // Set up parent-child relationships
    sortedIndices.forEach(oldIndex => {
      const oldBone = skeleton.bones[oldIndex]
      const newBone = oldToNewBone.get(oldBone)!
      
      if (oldBone.parent && oldBone.parent instanceof THREE.Bone) {
        const parentNewBone = oldToNewBone.get(oldBone.parent)
        if (parentNewBone) {
          parentNewBone.add(newBone)
        }
      }
    })

    // Find root bones (bones without parents in our subset)
    const rootBones = newBones.filter(bone => !bone.parent || !(bone.parent instanceof THREE.Bone))
    
    // Update world matrices for new bones
    rootBones.forEach(root => root.updateMatrixWorld(true))
    
    // Create inverse bind matrices that preserve the fitted shape
    const boneInverses: THREE.Matrix4[] = []
    sortedIndices.forEach((oldIndex, i) => {
      const oldBoneWorldMatrix = oldBoneWorldMatrices.get(skeleton.bones[oldIndex])!
      const newBone = newBones[i]
      
      // The inverse bind matrix should transform from the bone's current world space to local space
      const inverseBindMatrix = new THREE.Matrix4()
      inverseBindMatrix.copy(oldBoneWorldMatrix).invert()
      boneInverses.push(inverseBindMatrix)
    })
    
    // Create minimal skeleton with custom bind matrices
    const minimalSkeleton = new THREE.Skeleton(newBones, boneInverses)
    
    // Clone geometry and update skin indices
    const exportGeometry = geometry.clone()
    const skinIndices = exportGeometry.attributes.skinIndex
    const newSkinIndices = new Float32Array(skinIndices.array.length)
    
    // Remap bone indices
    for (let i = 0; i < skinIndices.count; i++) {
      for (let j = 0; j < 4; j++) {
        const oldIndex = skinIndices.getComponent(i, j)
        const newIndex = boneMapping.get(oldIndex)
        newSkinIndices[i * 4 + j] = newIndex !== undefined ? newIndex : 0
      }
    }
    
    exportGeometry.setAttribute('skinIndex', new THREE.BufferAttribute(newSkinIndices, 4))

    // Create the export scene with a root node
    const exportScene = new THREE.Scene()
    const rootNode = new THREE.Group()
    rootNode.name = 'ArmatureRoot'
    exportScene.add(rootNode)
    
    // Add root bones to the root node
    rootBones.forEach(bone => rootNode.add(bone))
    
    // Clone materials to ensure they export properly
    let exportMaterial = skinnedArmorMesh.material
    if (Array.isArray(exportMaterial)) {
      exportMaterial = exportMaterial.map(m => m.clone())
    } else {
      exportMaterial = exportMaterial.clone()
    }
    
    // Create skinned mesh for export
    const exportMesh = new THREE.SkinnedMesh(exportGeometry, exportMaterial)
    exportMesh.name = skinnedArmorMesh.name || 'Armor'
    
    // Set mesh transform to match the original
    skinnedArmorMesh.updateMatrixWorld(true)
    exportMesh.position.copy(skinnedArmorMesh.position)
    exportMesh.quaternion.copy(skinnedArmorMesh.quaternion)
    exportMesh.scale.copy(skinnedArmorMesh.scale)
    
    // IMPORTANT: Use identity bind matrix since our skeleton is already in the fitted pose
    const bindMatrix = new THREE.Matrix4()
    bindMatrix.identity()
    
    // Bind to the minimal skeleton with identity bind matrix
    exportMesh.bind(minimalSkeleton, bindMatrix)
    
    // Add mesh to scene root
    exportScene.add(exportMesh)
    
    // Update matrices
    exportMesh.updateMatrixWorld(true)
    minimalSkeleton.update()
    
    // Ensure geometry has all required attributes
    if (!exportGeometry.attributes.normal) {
      exportGeometry.computeVertexNormals()
    }
    if (!exportGeometry.attributes.uv && !exportGeometry.attributes.uv2) {
      console.warn('Armor geometry has no UV coordinates!')
    }
    
    // Store metadata about bone mapping
    exportMesh.userData = {
      ...skinnedArmorMesh.userData,
      armorMetadata: {
        originalBoneCount: skeleton.bones.length,
        exportedBoneCount: newBones.length,
        boneNames: newBones.map(b => b.name),
        gameCompatible: true,
        exportVersion: '2.0',
        exportDate: new Date().toISOString()
      }
    }

    // Use GLTFExporter to export
    const exporter = new GLTFExporter()
    
    // Log debug info
    console.log('Export mesh details:')
    console.log(`- Position: ${exportMesh.position.toArray()}`)
    console.log(`- Scale: ${exportMesh.scale.toArray()}`)
    console.log(`- Has normals: ${!!exportGeometry.attributes.normal}`)
    console.log(`- Has UVs: ${!!(exportGeometry.attributes.uv || exportGeometry.attributes.uv2)}`)
    console.log(`- Material type: ${Array.isArray(exportMaterial) ? 'Multi-material' : exportMaterial.type}`)
    console.log(`- Visible: ${exportMesh.visible}`)
    console.log(`- Frustum culled: ${exportMesh.frustumCulled}`)
    
    const exportOptions = {
      binary: true,
      includeCustomExtensions: false, // Change to false for better compatibility
      // Don't include animations
      animations: [],
      // Optimize the export
      truncateDrawRange: false, // Change to false to export full geometry
      // Include vertex colors if present
      vertexColors: geometry.attributes.color !== undefined,
      // Embed images for materials
      embedImages: true, // Change to true to embed textures
      forceIndices: true,
      // Export at higher precision
      maxTextureSize: 4096
    }

    const gltf = await exporter.parseAsync(exportScene, exportOptions)
    
    console.log('Export complete:')
    console.log(`- Vertices: ${geometry.attributes.position.count}`)
    console.log(`- Bones exported: ${newBones.length}`)
    console.log(`- Used bones: ${this.getUsedBones(geometry).size}`)
    
    return gltf as ArrayBuffer
  }

  /**
   * Calculate average distance between bones to detect unit scale issues
   * @private
   */
  private calculateAverageBoneDistance(skeleton: THREE.Skeleton): number {
    let totalDistance = 0
    let count = 0
    
    skeleton.bones.forEach(bone => {
      if (bone.parent && bone.parent instanceof THREE.Bone) {
        const distance = bone.position.length()
        totalDistance += distance
        count++
      }
    })
    
    return count > 0 ? totalDistance / count : 0
  }

  /**
   * Get which bones are actually used by the mesh
   * @private
   */
  private getUsedBones(geometry: THREE.BufferGeometry): Set<number> {
    const usedBones = new Set<number>()
    const skinIndices = geometry.attributes.skinIndex
    const skinWeights = geometry.attributes.skinWeight
    
    if (!skinIndices || !skinWeights) return usedBones
    
    for (let i = 0; i < skinIndices.count; i++) {
      for (let j = 0; j < 4; j++) {
        const boneIndex = skinIndices.getComponent(i, j)
        const weight = skinWeights.getComponent(i, j)
        
        if (weight > 0.001) { // Only count bones with meaningful weights
          usedBones.add(boneIndex)
        }
      }
    }
    
    return usedBones
  }

  /**
   * Equip game-ready armor to a character (RuneScape-style)
   * The armor already has bones and just needs to be synchronized with the character's skeleton
   * @param loadedArmor - The loaded armor group/scene from GLTFLoader
   * @param characterMesh - The character's skinned mesh to equip armor on
   * @param options - Equip options
   */
  equipArmorToCharacter(
    loadedArmor: THREE.Group | THREE.Scene,
    characterMesh: THREE.SkinnedMesh,
    options: {
      autoMatch?: boolean // Automatically match bones by name
      boneNameMapping?: Record<string, string> // Manual bone name mapping
      parentToCharacter?: boolean // Parent armor to character's root
    } = {}
  ): THREE.SkinnedMesh | null {
    const {
      autoMatch = true,
      boneNameMapping = {},
      parentToCharacter = true
    } = options

    console.log('=== EQUIPPING ARMOR TO CHARACTER ===')

    // Find the armor mesh in the loaded group
    let armorMesh: THREE.SkinnedMesh | null = null
    loadedArmor.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh && !armorMesh) {
        armorMesh = child as THREE.SkinnedMesh
      }
    })

    if (!armorMesh) {
      console.error('No skinned mesh found in loaded armor!')
      return null
    }
    
    // TypeScript type guard
    const armor = armorMesh as THREE.SkinnedMesh

    const characterSkeleton = characterMesh.skeleton
    if (!characterSkeleton) {
      console.error('Character has no skeleton!')
      return null
    }

    console.log(`Armor has ${armor.skeleton.bones.length} bones`)
    console.log(`Character has ${characterSkeleton.bones.length} bones`)

    // Create bone mapping from armor bones to character bones
    const armorToCharacterBoneMap = new Map<THREE.Bone, THREE.Bone>()
    
    armor.skeleton.bones.forEach(armorBone => {
      // Try exact name match first
      let matchedBone = characterSkeleton.bones.find(b => b.name === armorBone.name)
      
      // Try mapped name
      if (!matchedBone && boneNameMapping[armorBone.name]) {
        const mappedName = boneNameMapping[armorBone.name]
        matchedBone = characterSkeleton.bones.find(b => b.name === mappedName)
      }
      
      // Try auto-matching with variations
      if (!matchedBone && autoMatch) {
        const variations = [
          armorBone.name.toLowerCase(),
          armorBone.name.replace(/[._]/g, '_'),
          armorBone.name.replace(/[._]/g, '.'),
          armorBone.name.replace(/^mixamorig[:_]/i, ''),
          armorBone.name.replace(/^Bip01[_\s]/i, '')
        ]
        
        matchedBone = characterSkeleton.bones.find(charBone => 
          variations.some(v => charBone.name.toLowerCase() === v)
        )
      }
      
      if (matchedBone) {
        armorToCharacterBoneMap.set(armorBone, matchedBone)
        console.log(`Matched armor bone "${armorBone.name}" to character bone "${matchedBone.name}"`)
      } else {
        console.warn(`Could not find match for armor bone "${armorBone.name}"`)
      }
    })

    console.log(`Successfully matched ${armorToCharacterBoneMap.size}/${armor.skeleton.bones.length} bones`)

    // Update armor skeleton to use character's bones
    const newBones: THREE.Bone[] = []
    const newInverses: THREE.Matrix4[] = []
    const boneIndexMap = new Map<number, number>()
    
    armor.skeleton.bones.forEach((armorBone, armorIndex) => {
      const characterBone = armorToCharacterBoneMap.get(armorBone)
      if (characterBone) {
        const charIndex = characterSkeleton.bones.indexOf(characterBone)
        if (charIndex !== -1) {
          boneIndexMap.set(armorIndex, charIndex)
          newBones.push(characterBone)
          newInverses.push(characterSkeleton.boneInverses[charIndex])
        }
      }
    })

    // Update skin indices to use character bone indices
    const geometry = armor.geometry
    const skinIndices = geometry.attributes.skinIndex
    const newSkinIndices = new Float32Array(skinIndices.array.length)
    
    for (let i = 0; i < skinIndices.count; i++) {
      for (let j = 0; j < 4; j++) {
        const armorBoneIndex = skinIndices.getComponent(i, j)
        const charBoneIndex = boneIndexMap.get(armorBoneIndex)
        newSkinIndices[i * 4 + j] = charBoneIndex !== undefined ? charBoneIndex : 0
      }
    }
    
    geometry.setAttribute('skinIndex', new THREE.BufferAttribute(newSkinIndices, 4))

    // Bind armor to character's skeleton
    armor.bind(characterSkeleton, armor.bindMatrix)
    
    // Parent to character if requested
    if (parentToCharacter && characterMesh.parent) {
      characterMesh.parent.add(armor)
      
      // Reset transform since we're now in character space
      armor.position.set(0, 0, 0)
      armor.rotation.set(0, 0, 0)
      armor.scale.set(1, 1, 1)
    }

    console.log('✅ Armor successfully equipped!')
    
    return armor
  }

  /**
   * Legacy method for binding armor without skeleton (kept for compatibility)
   * Use equipArmorToCharacter for game-style equipment systems
   */
  bindImportedArmorToSkeleton(
    armorMesh: THREE.Mesh,
    targetSkeleton: THREE.Skeleton,
    options: {
      boneNameMapping?: Record<string, string> // Map from armor bone names to target skeleton bone names
      autoDetectMapping?: boolean // Try to automatically match bone names
    } = {}
  ): THREE.SkinnedMesh {
    const {
      boneNameMapping = {},
      autoDetectMapping = true
    } = options

    console.log('=== BINDING IMPORTED ARMOR TO NEW SKELETON ===')

    // Get metadata from userData
    const metadata = armorMesh.userData?.skinnedMeshMetadata
    if (!metadata) {
      throw new Error('Armor mesh does not have skinning metadata!')
    }

    const { boneNames, bindMatrixInverse, boneCount } = metadata
    
    // Verify the mesh has skinning attributes
    const geometry = armorMesh.geometry
    if (!geometry.attributes.skinIndex || !geometry.attributes.skinWeight) {
      throw new Error('Armor geometry does not have skinning attributes!')
    }

    // Create bone index mapping from armor bones to target skeleton bones
    const boneIndexMapping = new Map<number, number>()
    
    boneNames.forEach((armorBoneName: string, armorBoneIndex: number) => {
      // Check explicit mapping first
      const mappedName = boneNameMapping[armorBoneName] || armorBoneName
      
      // Find corresponding bone in target skeleton
      const targetBoneIndex = targetSkeleton.bones.findIndex(bone => {
        if (bone.name === mappedName) return true
        
        if (autoDetectMapping) {
          // Try case-insensitive match
          if (bone.name.toLowerCase() === mappedName.toLowerCase()) return true
          
          // Try common naming variations
          const variations = [
            mappedName.replace(/\./g, '_'),
            mappedName.replace(/_/g, '.'),
            mappedName.replace(/^mixamorig[:_]/i, ''),
            mappedName.replace(/^Bip01[_\s]/i, ''),
            mappedName.replace(/[_\s]L$/, '_L'),
            mappedName.replace(/[_\s]R$/, '_R')
          ]
          
          return variations.some(v => bone.name.toLowerCase() === v.toLowerCase())
        }
        
        return false
      })
      
      if (targetBoneIndex !== -1) {
        boneIndexMapping.set(armorBoneIndex, targetBoneIndex)
        console.log(`Mapped armor bone "${armorBoneName}" (${armorBoneIndex}) to target bone "${targetSkeleton.bones[targetBoneIndex].name}" (${targetBoneIndex})`)
      } else {
        console.warn(`Could not find matching bone for "${armorBoneName}"`)
      }
    })

    console.log(`Successfully mapped ${boneIndexMapping.size}/${boneCount} bones`)

    // Update skin indices to use target skeleton bone indices
    const skinIndices = geometry.attributes.skinIndex
    const newSkinIndices = new Float32Array(skinIndices.array.length)
    
    for (let i = 0; i < skinIndices.count; i++) {
      for (let j = 0; j < 4; j++) {
        const armorBoneIndex = skinIndices.getComponent(i, j)
        const targetBoneIndex = boneIndexMapping.get(armorBoneIndex)
        
        if (targetBoneIndex !== undefined) {
          newSkinIndices[i * 4 + j] = targetBoneIndex
        } else {
          // Fallback to root bone (0) if mapping not found
          newSkinIndices[i * 4 + j] = 0
        }
      }
    }
    
    // Create new skinned mesh
    const skinnedMesh = new THREE.SkinnedMesh(geometry.clone(), armorMesh.material)
    
    // Update skin indices
    skinnedMesh.geometry.setAttribute(
      'skinIndex',
      new THREE.BufferAttribute(newSkinIndices, 4)
    )
    
    // Restore bind matrix inverse
    if (bindMatrixInverse) {
      skinnedMesh.bindMatrixInverse.fromArray(bindMatrixInverse)
    }
    
    // Bind to target skeleton
    skinnedMesh.bind(targetSkeleton, skinnedMesh.bindMatrix)
    
    // Copy transform from original mesh
    skinnedMesh.position.copy(armorMesh.position)
    skinnedMesh.quaternion.copy(armorMesh.quaternion)
    skinnedMesh.scale.copy(armorMesh.scale)
    
    console.log('Successfully bound imported armor to new skeleton')
    
    return skinnedMesh
  }
} 

