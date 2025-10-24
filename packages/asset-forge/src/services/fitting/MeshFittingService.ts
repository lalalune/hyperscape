import {
  ArrowHelper, Bone, Box3, BoxGeometry, BufferAttribute, BufferGeometry, Color, Euler, Group,
  Mesh, Quaternion, Raycaster, Skeleton, SkinnedMesh, Triangle, Vector3
} from 'three'

import { safeDivide } from '../../utils/safe-math'

export interface MeshFittingParameters {
  iterations: number
  stepSize: number // 0-1, how much to move toward target per iteration
  smoothingRadius: number // Radius for gaussian smoothing
  smoothingStrength: number // 0-1, strength of smoothing
  targetOffset: number // Distance to maintain from target surface
  sampleRate?: number // What percentage of vertices to process per iteration (0-1)
  targetBounds?: Box3 // Optional bounding box to constrain fitting region
  preserveFeatures?: boolean // Whether to preserve sharp features during smoothing
  featureAngleThreshold?: number // Angle threshold in degrees for feature detection (default: 30)
  useImprovedShrinkwrap?: boolean // Use improved algorithm that prevents bunching
  preserveOpenings?: boolean // Whether to preserve openings during edge detection
  pushInteriorVertices?: boolean // Whether to push interior vertices out
  
  // Progress callback
  onProgress?: (progress: number, message?: string) => void
  
  // Debug visualization parameters
  showDebugArrows?: boolean
  debugArrowDensity?: number  // Show every Nth vertex (1 = all, 10 = every 10th)
  debugColorMode?: 'direction' | 'magnitude' | 'sidedness'
}

export class MeshFittingService {
  private raycaster: Raycaster = new Raycaster()
//   private tempVertex = new Vector3()
//   private tempTarget = new Vector3()
  private debugArrowGroup: Group | null = null
  private debugData: {
    displacements: Float32Array
    vertices: Float32Array
    sidedness: string[]
  } | null = null
  
  /**
   * Set the debug arrow group for visualization
   */
  setDebugArrowGroup(group: Group | null): void {
    this.debugArrowGroup = group
  }
  
  /**
   * Clear all debug arrows
   */
  clearDebugArrows(): void {
    if (this.debugArrowGroup) {
      this.debugArrowGroup.clear()
    }
    this.debugData = null
  }
  
  /**
   * Create debug arrows showing vertex movements
   */
  private createDebugArrows(
    sourceMesh: Mesh,
    displacements: Float32Array,
    hasDisplacement: boolean[],
    parameters: MeshFittingParameters
  ): void {
    if (!parameters.showDebugArrows || !this.debugArrowGroup) return
    
    const position = (sourceMesh.geometry as BufferGeometry).attributes.position as BufferAttribute
    const vertexCount = position.count
    const density = parameters.debugArrowDensity || 10
    
    // Clear existing arrows
    this.debugArrowGroup.clear()
    
    // Color based on mode
    const getArrowColor = (index: number, displacement: Vector3): Color => {
      if (parameters.debugColorMode === 'magnitude') {
        // Color by magnitude: blue (small) -> green -> yellow -> red (large)
        const mag = displacement.length()
        const normalized = Math.min(mag / 0.1, 1) // Safe: 0.1 is constant
        const r = normalized
        const g = 1 - Math.abs(normalized - 0.5) * 2
        const b = 1 - normalized
        return new Color(r, g, b)
      } else if (parameters.debugColorMode === 'sidedness') {
        // Color by vertex sidedness
        const sidedness = this.debugData?.sidedness[index] || 'unknown'
        switch (sidedness) {
          case 'front': return new Color(0, 1, 0)  // Green
          case 'back': return new Color(1, 0, 0)   // Red
          case 'left': return new Color(0, 0, 1)   // Blue
          case 'right': return new Color(1, 1, 0)  // Yellow
          default: return new Color(0.5, 0.5, 0.5) // Gray
        }
      } else {
        // Default: color by direction
        const worldDisp = displacement.clone()
        const absX = Math.abs(worldDisp.x)
        const absY = Math.abs(worldDisp.y)
        const absZ = Math.abs(worldDisp.z)
        
        if (absZ > absX && absZ > absY) {
          // Moving primarily forward/backward
          return worldDisp.z > 0 ? new Color(1, 0, 0) : new Color(0, 1, 0) // Red = forward, Green = backward
        } else if (absY > absX) {
          // Moving primarily up/down
          return new Color(0, 0, 1) // Blue
        } else {
          // Moving primarily sideways
          return new Color(1, 1, 0) // Yellow
        }
      }
    }
    
    // Create arrows for sampled vertices
    for (let i = 0; i < vertexCount; i += density) {
      if (!hasDisplacement[i]) continue
      
      // Get vertex position in world space
      const vertex = new Vector3(
        position.getX(i),
        position.getY(i),
        position.getZ(i)
      )
      vertex.applyMatrix4(sourceMesh.matrixWorld)
      
      // Get displacement
      const displacement = new Vector3(
        displacements[i * 3],
        displacements[i * 3 + 1],
        displacements[i * 3 + 2]
      )
      
      // Transform displacement to world space
      const worldMatrix = sourceMesh.matrixWorld.clone()
      worldMatrix.setPosition(0, 0, 0) // Remove translation
      displacement.applyMatrix4(worldMatrix)
      
      const magnitude = displacement.length()
      if (magnitude < 0.001) continue // Skip tiny movements
      
      // Create arrow
      const direction = displacement.clone().normalize()
      const origin = vertex
      const length = Math.min(magnitude * 5, 0.1) // Scale up for visibility, cap at 10cm
      const color = getArrowColor(i, displacement)
      
      const arrow = new ArrowHelper(direction, origin, length, color, length * 0.3, length * 0.2)
      this.debugArrowGroup.add(arrow)
    }
    
    console.log(`Created ${this.debugArrowGroup.children.length} debug arrows`)
  }
  
  /**
   * Classify vertices by their sidedness (front/back/left/right)
   */
  private classifyVertices(
    sourceMesh: Mesh
  ): string[] {
    const geometry = sourceMesh.geometry as BufferGeometry
    const position = geometry.attributes.position as BufferAttribute
    const normal = geometry.attributes.normal as BufferAttribute
    const vertexCount = position.count
    
    // Get mesh bounds in local space
    geometry.computeBoundingBox()
    const bounds = geometry.boundingBox!
    const center = bounds.getCenter(new Vector3())
    
    const sidedness: string[] = []
    
    // Analyze mesh to determine primary axes
    // For armor, we typically expect Y=up, but need to determine forward direction
    let forwardAxis = new Vector3(0, 0, 1) // Default assume Z is forward
    let rightAxis = new Vector3(1, 0, 0)   // Default assume X is right
    
    // Simple heuristic: armor is usually deeper (front-to-back) than it is wide
    const size = bounds.getSize(new Vector3())
    if (size.x > size.z * 1.2) {
      // X dimension is larger, so X might be the forward axis
      forwardAxis = new Vector3(1, 0, 0)
      rightAxis = new Vector3(0, 0, 1)
    }
    
    console.log(`Mesh orientation - Forward axis: ${forwardAxis.x ? 'X' : 'Z'}, Size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`)
    
    // Simple classification based on position relative to center
    // This is more reliable than normal-based classification
    for (let i = 0; i < vertexCount; i++) {
      const vertex = new Vector3(
        position.getX(i),
        position.getY(i),
        position.getZ(i)
      )
      
      // Get position relative to center
      const relativePos = vertex.clone().sub(center)
      
      // Project onto forward and right axes
      const forwardDist = relativePos.dot(forwardAxis)
      const rightDist = relativePos.dot(rightAxis)
      const absForward = Math.abs(forwardDist)
      const absRight = Math.abs(rightDist)
      
      // Classify based on which axis dominates
      if (absForward > absRight * 1.5) {
        // Clearly forward or backward
        sidedness[i] = forwardDist > 0 ? 'front' : 'back'
      } else if (absRight > absForward * 1.5) {
        // Clearly left or right - but we want to minimize these
        sidedness[i] = rightDist > 0 ? 'right' : 'left'
      } else {
        // Ambiguous - use normal as tiebreaker
        const vertexNormal = new Vector3(
          normal.getX(i),
          normal.getY(i),
          normal.getZ(i)
        ).normalize()
        
        // Prefer front/back classification
        const normalForward = vertexNormal.dot(forwardAxis)
        if (Math.abs(normalForward) > 0.5) {
          sidedness[i] = normalForward > 0 ? 'front' : 'back'
        } else {
          // Still ambiguous - default to position
          sidedness[i] = forwardDist > 0 ? 'front' : 'back'
        }
      }
    }
    
    // Log classification statistics
    const counts = { front: 0, back: 0, left: 0, right: 0 }
    sidedness.forEach(s => counts[s as keyof typeof counts]++)
    console.log('Vertex classification:', counts)
    
    return sidedness
  }
  
  /**
   * Detect if a mesh has predominantly flat faces (like a cube)
   */
  private detectFlatFaces(mesh: Mesh): boolean {
    const geometry = mesh.geometry as BufferGeometry
    
    // For box geometry, we know it has flat faces
    if (geometry instanceof BoxGeometry) {
      return true
    }
    
    // For other geometries, we could analyze face normals
    // but for now, we'll just check the type
    return false
  }
  
  /**
   * Check if a point is inside a mesh by checking distance to surface
   */
  private isPointInsideMesh(point: Vector3, mesh: Mesh): boolean {
    // For simple shapes like spheres and cubes, we can use a more reliable method
    // Find the nearest surface point
    const nearest = this.findNearestSurfacePoint(point, mesh)
    if (!nearest) return false
    
    // Check if the normal at the nearest point faces away from our point
    const toPoint = point.clone().sub(nearest.point).normalize()
    const dotProduct = toPoint.dot(nearest.normal)
    
    // If dot product is negative, normal faces toward the point (we're inside)
    return dotProduct < 0
  }
  
  /**
   * Check if a point is inside a skinned mesh by raycasting in multiple directions
   * A point is considered inside if most rays hit the mesh from the inside (backfaces)
   */
  private isPointInsideSkinnedMesh(point: Vector3, mesh: SkinnedMesh): boolean {
    // Cast rays in multiple directions
    const directions = [
      new Vector3(1, 0, 0),   // +X
      new Vector3(-1, 0, 0),  // -X
      new Vector3(0, 1, 0),   // +Y
      new Vector3(0, -1, 0),  // -Y
      new Vector3(0, 0, 1),   // +Z
      new Vector3(0, 0, -1),  // -Z
      new Vector3(1, 1, 0).normalize(),   // Diagonals
      new Vector3(1, -1, 0).normalize(),
      new Vector3(1, 0, 1).normalize(),
      new Vector3(1, 0, -1).normalize(),
    ]
    
    let insideCount = 0
    let totalHits = 0
    
    for (const dir of directions) {
      this.raycaster.set(point, dir)
      const intersections = this.raycaster.intersectObject(mesh, false)
      
      if (intersections.length > 0) {
        totalHits++
        // Check if we hit a backface (we're inside)
        const hit = intersections[0]
        if (hit.face) {
          const normalWorld = hit.face.normal.clone()
          normalWorld.transformDirection(mesh.matrixWorld)
          
          // If ray direction and face normal point in same direction, we hit a backface
          if (dir.dot(normalWorld) > 0) {
            insideCount++
          }
        }
      }
    }


    // Consider inside if more than half of the hits are backfaces
    return totalHits > 0 && safeDivide(insideCount, totalHits, 0) > 0.5
  }
  
  /**
   * Push vertices that are inside the mesh back toward their original positions
   */
  private pushInteriorVerticesOut(
    sourceMesh: Mesh,
    targetMesh: Mesh | SkinnedMesh,
    originalPositions: Float32Array,
    blendFactor: number = 1.0
  ): number {
    console.log('🔍 Checking for interior vertices to restore...')
    
    const geometry = sourceMesh.geometry as BufferGeometry
    const position = geometry.attributes.position as BufferAttribute
    const vertexCount = position.count
    
    let pushedCount = 0
    
    // Check each vertex
    for (let i = 0; i < vertexCount; i++) {
      const vertex = new Vector3(
        position.getX(i),
        position.getY(i),
        position.getZ(i)
      )
      
      // Transform to world space
      vertex.applyMatrix4(sourceMesh.matrixWorld)
      
      // Check if inside target mesh
      let isInside = false
      if (targetMesh instanceof SkinnedMesh) {
        isInside = this.isPointInsideSkinnedMesh(vertex, targetMesh)
      } else {
        isInside = this.isPointInsideMesh(vertex, targetMesh)
      }
      
      if (isInside) {
        // Get original position
        const originalX = originalPositions[i * 3]
        const originalY = originalPositions[i * 3 + 1]
        const originalZ = originalPositions[i * 3 + 2]
        
        // Blend back toward original position
        const newX = position.getX(i) + (originalX - position.getX(i)) * blendFactor
        const newY = position.getY(i) + (originalY - position.getY(i)) * blendFactor
        const newZ = position.getZ(i) + (originalZ - position.getZ(i)) * blendFactor
        
        // Apply the restoration
        position.setX(i, newX)
        position.setY(i, newY)
        position.setZ(i, newZ)
        
        pushedCount++
        
        if (pushedCount % 100 === 0) {
          console.log(`Vertex ${i}: Inside mesh, restoring to original position`)
        }
      }
    }
    
    if (pushedCount > 0) {
      console.log(`📤 Restored ${pushedCount} interior vertices to their original positions`)
      position.needsUpdate = true
      geometry.computeVertexNormals()
    }
    
    return pushedCount
  }
  
  /**
   * Detect arm hole vertices that should be locked during fitting
   */
  private detectArmHoles(mesh: Mesh): Set<number> {
    console.log('🔍 Detecting arm holes for vertex locking...')
    
    const lockedVertices = new Set<number>()
    const geometry = mesh.geometry as BufferGeometry
    const position = geometry.attributes.position as BufferAttribute
    const vertexCount = position.count
    
    // Get mesh bounds for relative positioning
    const bounds = new Box3()
    bounds.setFromBufferAttribute(position)
    const size = bounds.getSize(new Vector3())
    const center = bounds.getCenter(new Vector3())
    
    // Build neighbor map to detect edge vertices
    const neighborMap = this.buildNeighborMap(geometry)
    
    // Find vertices that are likely arm holes
    for (let i = 0; i < vertexCount; i++) {
      const vertex = new Vector3(
        position.getX(i),
        position.getY(i),
        position.getZ(i)
      )


      // Calculate relative position (protected against division by zero)
      const relativeY = safeDivide(vertex.y - bounds.min.y, size.y, 0)
      const halfSizeX = size.x / 2 // Safe: constant division
      const relativeX = safeDivide(Math.abs(vertex.x - center.x), halfSizeX, 0)
      
      // Arm holes are typically:
      // - At 60-90% height (shoulder area)
      // - Near the sides (70%+ from center)
      // - Edge vertices (fewer neighbors)
      if (relativeY > 0.6 && relativeY < 0.9 && relativeX > 0.7) {
        const neighbors = neighborMap.get(i)
        
        // Edge vertices have fewer neighbors (typically 3-5 vs 6+ for interior)
        if (neighbors && neighbors.size < 6) {
          lockedVertices.add(i)
        }
      }
    }
    
    console.log(`Detected ${lockedVertices.size} arm hole vertices to lock`)
    return lockedVertices
  }
  
  /**
   * Perform iterative fitting of source mesh to target mesh
   */
  fitMeshToTarget(
    sourceMesh: Mesh,
    targetMesh: Mesh,
    parameters: MeshFittingParameters
  ): void {
    console.log('🎯 GenericMeshFittingService: Starting iterative fitting')
    console.log('Source mesh:', sourceMesh)
    console.log('Target mesh:', targetMesh)
    console.log('Parameters:', parameters)
    
    // Warn about performance with SkinnedMesh targets
    if (targetMesh instanceof SkinnedMesh) {
      console.warn('⚠️ Target is a SkinnedMesh - this may be slower than regular meshes')
      console.warn('Consider reducing iterations or sample rate for better performance')
    }
    
    const sourceGeometry = sourceMesh.geometry as BufferGeometry
    const position = sourceGeometry.attributes.position as BufferAttribute
    const vertexCount = position.count
    
    console.log('Source vertex count:', vertexCount)
    
    // Safety check
    if (!position || vertexCount === 0) {
      console.error('Source mesh has no vertices!')
      return
    }
    
    // Store original positions for reference
    const originalPositions = new Float32Array(position.array)
    
    // We'll store positions after initial setup but before shrinkwrap iterations
    let preIterationPositions: Float32Array | null = null
    
    // Detect vertices to lock based on intersection with avatar's neck/arms
    let lockedVertices = new Set<number>()
    let edgeInfluenceRadius = 0.1 // 10cm influence radius by default
    
    // Only detect intersections for armor meshes being fitted to SkinnedMesh avatars
    const isArmorToAvatar = (sourceMesh.userData.isArmor || vertexCount > 1000) && 
                           targetMesh instanceof SkinnedMesh && 
                           parameters.preserveOpenings !== false
    
    if (isArmorToAvatar && targetMesh instanceof SkinnedMesh) {
      console.log('🎯 Detected armor-to-avatar fitting - detecting neck/arm intersections')
      
      const skeleton = targetMesh.skeleton
      if (skeleton) {
        lockedVertices = this.detectIntersectingVertices(sourceMesh, skeleton)
        
        // Calculate influence radius based on mesh size
        const meshSize = new Box3().setFromObject(sourceMesh).getSize(new Vector3())
        edgeInfluenceRadius = Math.min(meshSize.x, meshSize.y, meshSize.z) * 0.15 // 15% of smallest dimension
        console.log(`📏 Intersection influence radius: ${edgeInfluenceRadius.toFixed(3)}`)
    } else {
        console.warn('⚠️ Target SkinnedMesh has no skeleton - cannot detect intersections')
      }
    }
    
    // Get target bounds and center
    const targetBounds = new Box3().setFromObject(targetMesh)
    const targetCenter = new Vector3()
    
    // Use the actual target mesh center, not the constraint bounds
      targetBounds.getCenter(targetCenter)
    
    // Constraint bounds are used to limit where vertices can be pulled to
    const constraintBounds = parameters.targetBounds?.clone()
    if (constraintBounds) {
      const constraintSize = constraintBounds.getSize(new Vector3())
      console.log('🎯 Using constraint bounds to limit fitting region:', constraintBounds.min, 'to', constraintBounds.max)
      console.log('🎯 Constraint bounds size:', constraintSize)
      
      // If constraint bounds are too small, expand them
      if (constraintSize.x < 0.1 || constraintSize.y < 0.1 || constraintSize.z < 0.1) {
        console.warn('⚠️ Constraint bounds are very small, expanding to minimum size')
        const center = constraintBounds.getCenter(new Vector3())
        const minSize = 0.5 // Minimum 50cm in each dimension
        constraintBounds.setFromCenterAndSize(
          center,
          new Vector3(
            Math.max(constraintSize.x, minSize),
            Math.max(constraintSize.y, minSize),
            Math.max(constraintSize.z, minSize)
          )
        )
        console.log('🎯 Expanded constraint bounds to:', constraintBounds.getSize(new Vector3()))
      }
    }
    
    // Update target mesh matrices
    targetMesh.updateMatrixWorld(true)
    sourceMesh.updateMatrixWorld(true)
    
    // Debug transforms
    console.log('🎯 Source mesh position:', sourceMesh.position.x, sourceMesh.position.y, sourceMesh.position.z)
    console.log('🎯 Source mesh scale:', sourceMesh.scale.x, sourceMesh.scale.y, sourceMesh.scale.z)
    console.log('🎯 Target mesh position:', targetMesh.position.x, targetMesh.position.y, targetMesh.position.z)
    console.log('🎯 Target mesh scale:', targetMesh.scale.x, targetMesh.scale.y, targetMesh.scale.z)
    
    // For sphere detection (common case in debugger)
    const targetSize = targetBounds.getSize(new Vector3())
    const isSphere = Math.abs(targetSize.x - targetSize.y) < 0.01 &&
                     Math.abs(targetSize.y - targetSize.z) < 0.01
    const sphereRadius = isSphere ? targetSize.x / 2 : 0 // Safe: constant division
    
    // Check if target is a box geometry
    const isBox = this.detectFlatFaces(targetMesh)
    
    console.log(`Target appears to be ${isSphere ? 'sphere' : (isBox ? 'box' : 'complex mesh')}, radius: ${sphereRadius}`)
    console.log(`Processing ${vertexCount} vertices`)
    console.log(`Target center:`, targetCenter)
    console.log(`Target bounds:`, targetBounds.min, targetBounds.max)
    console.log(`Target is box geometry: ${isBox}`)
    
    // If constraint bounds provided, use them to filter raycasting
    if (constraintBounds) {
      console.log('🎯 Using constraint bounds:', 
        constraintBounds.min.x.toFixed(3), constraintBounds.min.y.toFixed(3), constraintBounds.min.z.toFixed(3),
        'to',
        constraintBounds.max.x.toFixed(3), constraintBounds.max.y.toFixed(3), constraintBounds.max.z.toFixed(3)
      )
    }
    
    // Store positions before iterations (after initial scaling/positioning)
    // These are the positions we'll restore interior vertices to
    preIterationPositions = new Float32Array(position.array)
    console.log('📸 Stored pre-iteration positions for interior vertex restoration')
    
    // Classify vertices by sidedness for debug visualization
    let vertexSidedness: string[] = []
    if (parameters.showDebugArrows && parameters.debugColorMode === 'sidedness') {
      console.log('🎯 Classifying vertices by sidedness...')
      vertexSidedness = this.classifyVertices(sourceMesh)
      this.debugData = {
        displacements: new Float32Array(vertexCount * 3),
        vertices: new Float32Array(position.array),
        sidedness: vertexSidedness
      }
    }
    
    // Also classify for armor fitting even without debug mode
    const isArmorFitting = sourceMesh.userData.originalGeometry && 
                           targetMesh instanceof SkinnedMesh &&
                           vertexCount > 1000
    
    if (isArmorFitting && vertexSidedness.length === 0) {
      console.log('🎯 Classifying armor vertices for directional raycasting...')
      vertexSidedness = this.classifyVertices(sourceMesh)
    }
    
    // Detect arm holes for armor fitting
    let armHoleVertices = new Set<number>()
    if (isArmorFitting) {
      armHoleVertices = this.detectArmHoles(sourceMesh)
    }
    
    // Calculate max deformation limit
    const meshSize = new Box3().setFromObject(sourceMesh).getSize(new Vector3())
    const maxDeformation = meshSize.length() * 0.3 // Max 30% deformation
    console.log(`Max deformation limit: ${maxDeformation.toFixed(3)}m`)
    
    // Get source mesh bounds for shoulder detection
    const sourceBounds = new Box3().setFromObject(sourceMesh)
    
    // Process ALL vertices each iteration for consistent results
    for (let iter = 0; iter < parameters.iterations; iter++) {
      console.log(`\n🎯 Iteration ${iter + 1}/${parameters.iterations}`)
      
      // Report progress
      if (parameters.onProgress) {
        const progress = safeDivide(iter * 100, parameters.iterations, 0)
        parameters.onProgress(progress, `Fitting iteration ${iter + 1} of ${parameters.iterations}`)
      }
      
      let movedVertices = 0
      let maxMovement = 0
      
      // Create arrays to store displacement vectors for each vertex
      const displacements = new Float32Array(vertexCount * 3)
      const hasDisplacement = new Array(vertexCount).fill(false)
      
      // First pass: Calculate desired displacements for all vertices
      for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++) {
        const vertex = new Vector3(
          position.getX(vertexIndex),
          position.getY(vertexIndex),
          position.getZ(vertexIndex)
        )
        
        // Transform to world space
        vertex.applyMatrix4(sourceMesh.matrixWorld)
        
        // Skip arm hole vertices to preserve openings
        if (armHoleVertices.has(vertexIndex)) {
          continue
        }
        
        // Debug first vertex
        if (vertexIndex === 0 && iter === 0) {
          console.log(`First vertex local: ${position.getX(0)}, ${position.getY(0)}, ${position.getZ(0)}`)
          console.log(`First vertex world:`, vertex)
        }
        
        // CRITICAL: Skip vertices that are outside the constraint bounds
        // This prevents armor from being pulled to regions outside its target area
        if (constraintBounds) {
          // For armor fitting, we want to process all vertices but limit the target area
          // Only skip if vertex is WAY outside the bounds (more than 5x the bounds size for armor)
          const boundsSize = constraintBounds.getSize(new Vector3())
          const expandedBounds = constraintBounds.clone()
          expandedBounds.expandByVector(boundsSize.clone().multiplyScalar(4)) // 5x the original size
          
          if (!expandedBounds.containsPoint(vertex)) {
            // Vertex is way outside target region - skip it
            if (vertexIndex % 100 === 0) { // Only log every 100th vertex to reduce spam
              console.log(`Skipping vertex far outside bounds: ${vertex.x}, ${vertex.y}, ${vertex.z}`)
            }
            continue
          }
        }
        
        let targetPoint: Vector3 | null = null
        let targetNormal: Vector3 | null = null
        
        if (isSphere) {
          // For spheres, we can calculate exactly
          const fromCenter = vertex.clone().sub(targetCenter)
          const distance = fromCenter.length()
          
          if (distance > 0.001) {
            // Normal points outward from center
            targetNormal = fromCenter.normalize()
            // Point on sphere surface
            targetPoint = targetCenter.clone().add(
              targetNormal.clone().multiplyScalar(sphereRadius)
            )
          } else {
            // Vertex at center, pick arbitrary direction
            targetNormal = new Vector3(1, 0, 0)
            targetPoint = targetCenter.clone().add(
              targetNormal.clone().multiplyScalar(sphereRadius)
            )
          }
        } else {
          // For complex meshes, try multiple approaches
          let found = false
          
          // Special handling for box geometry
          if (isBox) {
            // For boxes, we need to find the closest point on the outer surface
            // Get the box bounds in world space
            targetMesh.updateMatrixWorld(true)
            const worldBox = new Box3().setFromObject(targetMesh)
            const boxMin = worldBox.min
            const boxMax = worldBox.max
            const boxCenter = worldBox.getCenter(new Vector3())
            
            if (vertexIndex < 5) {
              console.log(`Box world bounds: min:`, boxMin, `max:`, boxMax)
            }
            
            // Improved: Consider the vertex's direction from center to better assign faces
            const fromCenter = vertex.clone().sub(boxCenter).normalize()
            
            // Determine primary face based on dominant direction
            const absX = Math.abs(fromCenter.x)
            const absY = Math.abs(fromCenter.y)
            const absZ = Math.abs(fromCenter.z)
            
            let projectedPoint = new Vector3()
            let faceNormal = new Vector3()
            
            if (absX >= absY && absX >= absZ) {
              // X-dominant: project to X face
              projectedPoint.x = fromCenter.x > 0 ? boxMax.x : boxMin.x
              projectedPoint.y = Math.max(boxMin.y, Math.min(boxMax.y, vertex.y))
              projectedPoint.z = Math.max(boxMin.z, Math.min(boxMax.z, vertex.z))
              faceNormal.set(fromCenter.x > 0 ? 1 : -1, 0, 0)
            } else if (absY >= absX && absY >= absZ) {
              // Y-dominant: project to Y face
              projectedPoint.x = Math.max(boxMin.x, Math.min(boxMax.x, vertex.x))
              projectedPoint.y = fromCenter.y > 0 ? boxMax.y : boxMin.y
              projectedPoint.z = Math.max(boxMin.z, Math.min(boxMax.z, vertex.z))
              faceNormal.set(0, fromCenter.y > 0 ? 1 : -1, 0)
            } else {
              // Z-dominant: project to Z face
              projectedPoint.x = Math.max(boxMin.x, Math.min(boxMax.x, vertex.x))
              projectedPoint.y = Math.max(boxMin.y, Math.min(boxMax.y, vertex.y))
              projectedPoint.z = fromCenter.z > 0 ? boxMax.z : boxMin.z
              faceNormal.set(0, 0, fromCenter.z > 0 ? 1 : -1)
            }
            
            targetPoint = projectedPoint
            targetNormal = faceNormal
            found = true
            
            if (vertexIndex < 5) {
              console.log(`Vertex ${vertexIndex} at`, vertex, '-> box face:', targetPoint, 'normal:', targetNormal)
            }
          }
          
          // Original approach for non-box meshes
          if (!found) {
            // First, determine if we're inside or outside the target mesh
            const isInside = this.isPointInsideMesh(vertex, targetMesh)
            
            // NEW: For armor fitting, use directional awareness
            const isArmorFitting = sourceMesh.userData.originalGeometry && 
                                   targetMesh instanceof SkinnedMesh &&
                                   vertexCount > 1000
            
            if (isArmorFitting && vertexSidedness.length > 0) {
              // Get the vertex sidedness
              const sidedness = vertexSidedness[vertexIndex] || 'unknown'


              // Calculate relative height for various adjustments
              const heightRange = sourceBounds.max.y - sourceBounds.min.y
              const relativeY = safeDivide(vertex.y - sourceBounds.min.y, heightRange, 0)
              
              // Determine ray direction based on vertex classification
              let rayDirection = new Vector3()
              
              // Define directions in LOCAL space (assuming Z+ is forward)
              if (sidedness === 'back') {
                // Back vertices should ray cast backward in local space
                rayDirection.set(0, 0, -1)
                
                // For lower back vertices, angle the ray slightly downward
                if (relativeY < 0.4) { // Lower 40% of armor
                  // Angle 15-30 degrees downward based on how low the vertex is
                  const downAngle = (0.4 - relativeY) * 0.5 // 0 to 0.2 radians
                  rayDirection.y = -Math.sin(downAngle)
                  rayDirection.z = -Math.cos(downAngle)
                  rayDirection.normalize()
                }
              } else if (sidedness === 'front') {
                // Front vertices should ray cast forward in local space
                rayDirection.set(0, 0, 1)
              } else if (sidedness === 'left') {
                // Left vertices should ray cast left in local space
                rayDirection.set(-1, 0, 0)
              } else if (sidedness === 'right') {
                // Right vertices should ray cast right in local space
                rayDirection.set(1, 0, 0)
              } else {
                // Fallback to center-based approach
                rayDirection = targetCenter.clone().sub(vertex).normalize()
              }
              
              // Transform the local direction to world space
              // Only transform the direction vector, not the position
              const worldMatrix = sourceMesh.matrixWorld.clone()
              worldMatrix.setPosition(0, 0, 0) // Remove translation component
              rayDirection.transformDirection(worldMatrix)
              rayDirection.normalize()
              
              // Blend with center direction for smoother results
              const toCenterDir = targetCenter.clone().sub(vertex).normalize()
              
              // Use different blend factors based on vertex type
              let blendFactor = 0.3 // Default 30% center direction
              
              if (sidedness === 'back') {
                // Back vertices need stronger directional movement, but graduated by height
                if (relativeY < 0.3) {
                  // Lower back needs strong backward movement
                  if (relativeY < 0.2) {
                    // Very low (buttocks area) needs almost pure directional movement
                    blendFactor = 0.05 // Only 5% center, 95% backward
                  } else {
                    blendFactor = 0.1 // Only 10% center, 90% backward
                  }
                } else if (relativeY < 0.5) {
                  // Mid back
                  blendFactor = 0.2 // 20% center, 80% backward
                } else {
                  // Upper back - more conservative
                  blendFactor = 0.3 // 30% center, 70% backward
                }
              } else if (sidedness === 'left' || sidedness === 'right') {
                // Side vertices should have minimal sideways movement
                // Check if this is a shoulder region (upper part of armor)
                if (relativeY > 0.6) { // Upper 40% of armor
                  // Shoulder region - use mostly center direction to prevent stretching
                  blendFactor = 0.7 // 70% center to prevent sideways stretch
                }
              }
              
              rayDirection.lerp(toCenterDir, blendFactor)
              rayDirection.normalize()
              
              // Debug logging for first few vertices
              if (vertexIndex < 20 && iter === 0) {
                console.log(`Vertex ${vertexIndex} (${sidedness}): blended ray direction`, rayDirection)
              }
              
              // Cast ray in the appropriate direction
              this.raycaster.set(vertex, rayDirection)
              let intersections = this.raycaster.intersectObject(targetMesh, false)
              
              // If no hit, try a cone of directions around the primary direction
              if (intersections.length === 0) {
                const attempts = [
                  rayDirection.clone().applyAxisAngle(new Vector3(0, 1, 0), 0.2),  // Slight rotation
                  rayDirection.clone().applyAxisAngle(new Vector3(0, 1, 0), -0.2),
                  rayDirection.clone().applyAxisAngle(new Vector3(1, 0, 0), 0.2),
                  rayDirection.clone().applyAxisAngle(new Vector3(1, 0, 0), -0.2),
                  toCenterDir // Fallback to pure center direction
                ]
                
                // For lower back vertices, add more aggressive downward angles
                if (sidedness === 'back' && relativeY < 0.3) {
                  attempts.unshift(
                    rayDirection.clone().applyAxisAngle(new Vector3(1, 0, 0), 0.4),  // More downward
                    rayDirection.clone().applyAxisAngle(new Vector3(1, 0, 0), -0.4)
                  )
                }
                
                for (const attemptDir of attempts) {
                  this.raycaster.set(vertex, attemptDir.normalize())
                  intersections = this.raycaster.intersectObject(targetMesh, false)
                  if (intersections.length > 0) break
                }
              }
              
              if (intersections.length > 0) {
                // Filter by constraint bounds if provided
                if (constraintBounds) {
                  const validIntersections = intersections.filter(hit => 
                    constraintBounds.containsPoint(hit.point)
                  )
                  
                  if (validIntersections.length > 0) {
                    targetPoint = validIntersections[0].point
                    targetNormal = validIntersections[0].face!.normal.clone()
                    targetNormal.transformDirection(targetMesh.matrixWorld)
                    found = true
                  }
                } else {
                  targetPoint = intersections[0].point
                  targetNormal = intersections[0].face!.normal.clone()
                  targetNormal.transformDirection(targetMesh.matrixWorld)
                  found = true
                }
              }
            }
            
            // Approach 1: Cast ray toward center (only if we're outside)
            if (!found && !isInside) {
          // If we have constraint bounds, use the constraint center instead
          const rayTarget = constraintBounds ? 
            new Vector3().lerpVectors(vertex, targetCenter, 0.5) : // Blend between vertex and center
            targetCenter
          const toTarget = rayTarget.clone().sub(vertex).normalize()
          this.raycaster.set(vertex, toTarget)
          let intersections = this.raycaster.intersectObject(targetMesh, false)
          
          if (intersections.length > 0) {
            // If constraint bounds provided, ONLY consider intersections within bounds
            if (constraintBounds) {
              // Filter to only intersections within the constraint bounds
              const validIntersections = intersections.filter(hit => 
                constraintBounds.containsPoint(hit.point)
              )
              
              if (validIntersections.length > 0) {
                // Use the closest valid intersection
                targetPoint = validIntersections[0].point
                targetNormal = validIntersections[0].face!.normal.clone()
                targetNormal.transformDirection(targetMesh.matrixWorld)
                found = true
              }
            } else {
              targetPoint = intersections[0].point
              targetNormal = intersections[0].face!.normal.clone()
              targetNormal.transformDirection(targetMesh.matrixWorld)
              found = true
                }
              }
            }
            
            // Approach 2: If inside, cast ray outward from center through vertex
            if (!found && isInside) {
              const fromCenter = vertex.clone().sub(targetCenter).normalize()
              this.raycaster.set(targetCenter, fromCenter)
              let intersections = this.raycaster.intersectObject(targetMesh, false)
              
              // Find intersection closest to our vertex
              let closestDist = Infinity
              for (const hit of intersections) {
                const dist = hit.point.distanceTo(vertex)
                if (dist < closestDist) {
                  closestDist = dist
                  targetPoint = hit.point
                  targetNormal = hit.face!.normal.clone()
                  targetNormal.transformDirection(targetMesh.matrixWorld)
                  
                  // If we're inside, we want the normal pointing outward
                  // Check if normal points toward center (it should point away)
                  const toCenter = targetCenter.clone().sub(hit.point).normalize()
                  if (targetNormal.dot(toCenter) > 0) {
                    targetNormal.negate()
                  }
                  found = true
                }
              }
            }
            
            // Approach 3: Cast ray from far outside inward
            if (!found) {
              const toCenter = targetCenter.clone().sub(vertex).normalize()
              const farPoint = vertex.clone().sub(toCenter.clone().multiplyScalar(targetSize.length() * 2))
              this.raycaster.set(farPoint, toCenter)
              let intersections = this.raycaster.intersectObject(targetMesh, false)
              
              if (intersections.length > 0) {
                // For a cube or convex shape, we want the FIRST intersection from outside
                // This ensures we get the outer surface
                targetPoint = intersections[0].point
                targetNormal = intersections[0].face!.normal.clone()
                targetNormal.transformDirection(targetMesh.matrixWorld)
                
                // Ensure normal points outward
                const toCenter = targetCenter.clone().sub(targetPoint).normalize()
                if (targetNormal.dot(toCenter) > 0) {
                  targetNormal.negate()
                }
                found = true
              }
            }
          }
          
          // Fallback approaches remain the same...
          if (!found) {
            // Approach 4: Try perpendicular directions
            const directions = [
              new Vector3(0, -1, 0), // Down
              new Vector3(0, 1, 0),  // Up
              new Vector3(1, 0, 0),  // Right
              new Vector3(-1, 0, 0), // Left
              new Vector3(0, 0, 1),  // Forward
              new Vector3(0, 0, -1), // Back
            ]
            
            for (const dir of directions) {
              this.raycaster.set(vertex, dir)
              let intersections = this.raycaster.intersectObject(targetMesh, false)
              if (intersections.length > 0) {
                targetPoint = intersections[0].point
                targetNormal = intersections[0].face!.normal.clone()
                targetNormal.transformDirection(targetMesh.matrixWorld)
                found = true
                break
              }
            }
          }
          
          // Final fallback: use nearest point algorithm if available
          if (!found) {
            const nearest = this.findNearestSurfacePoint(vertex, targetMesh)
            if (nearest) {
              targetPoint = nearest.point
              targetNormal = nearest.normal
            } else {
              // Last resort: project to bounding box
              targetPoint = new Vector3()
              targetPoint.copy(vertex)
              targetPoint.clamp(targetBounds.min, targetBounds.max)
              targetNormal = vertex.clone().sub(targetPoint).normalize()
              if (targetNormal.length() < 0.1) {
                targetNormal = new Vector3(0, 1, 0)
              }
            }
          }
        }
        
        if (!targetPoint || !targetNormal) {
          continue // Skip this vertex if we couldn't find a target
        }
        
        // Calculate desired position with offset
          // For box targets, check if we're inside and adjust accordingly
          let offsetDirection = targetNormal.clone()
          if (isBox) {
            // For boxes, ALWAYS apply positive offset to stay outside
            // The normal should already be pointing outward
            offsetDirection.multiplyScalar(parameters.targetOffset)
          } else {
            offsetDirection.multiplyScalar(parameters.targetOffset)
          }
          
          const desiredPoint = targetPoint.clone().add(offsetDirection)
          
                      // Additional safety check for boxes: ensure desired point is outside bounds
            if (isBox) {
              // Get world bounds for the check
              const worldBox = new Box3().setFromObject(targetMesh)
              const safetyMargin = parameters.targetOffset
              
              // If the desired point is inside the box bounds, push it out
              if (worldBox.containsPoint(desiredPoint)) {
                console.warn(`Vertex ${vertexIndex}: Desired point is inside box! Pushing out...`)
                // Push the point outside based on the normal direction
                if (Math.abs(targetNormal.x) > 0.5) {
                  desiredPoint.x = targetNormal.x > 0 ? worldBox.max.x + safetyMargin : worldBox.min.x - safetyMargin
                } else if (Math.abs(targetNormal.y) > 0.5) {
                  desiredPoint.y = targetNormal.y > 0 ? worldBox.max.y + safetyMargin : worldBox.min.y - safetyMargin
                } else if (Math.abs(targetNormal.z) > 0.5) {
                  desiredPoint.z = targetNormal.z > 0 ? worldBox.max.z + safetyMargin : worldBox.min.z - safetyMargin
                }
              }
            }

        // Calculate displacement in world space
        let finalDesiredPoint = desiredPoint
        const displacement = desiredPoint.clone().sub(vertex)
        const moveDistance = displacement.length()
        
        // Apply special constraints for armor fitting
        if (isArmorFitting && vertexSidedness.length > 0) {
          const sidedness = vertexSidedness[vertexIndex] || 'unknown'
          const heightRange = sourceBounds.max.y - sourceBounds.min.y
          const relativeY = safeDivide(vertex.y - sourceBounds.min.y, heightRange, 0)
          
          // Shoulder region constraints
          if (relativeY > 0.6 && (sidedness === 'left' || sidedness === 'right')) {
            // Limit sideways movement for shoulders
            const maxShoulderMove = 0.015 // 1.5cm max per iteration
            if (moveDistance > maxShoulderMove) {
              displacement.normalize().multiplyScalar(maxShoulderMove)
            }
          } 
          // Back vertices - ensure stronger movement
          else if (sidedness === 'back') {
            // Graduated minimum movement - more for lower back
            let minBackMove = 0.02 // Default 2cm minimum
            
            if (relativeY < 0.4) {
              // Lower back needs more movement (buttocks area)
              minBackMove = 0.04 + (0.4 - relativeY) * 0.05 // 4-6cm based on height
            } else if (relativeY < 0.6) {
              // Mid back
              minBackMove = 0.03 // 3cm
            }
            
            if (moveDistance < minBackMove) {
              // Ensure minimum backward movement
              displacement.normalize().multiplyScalar(minBackMove)
              if (vertexIndex % 50 === 0 && relativeY < 0.4) {
                console.log(`Enforcing min movement for lower back vertex ${vertexIndex}: ${moveDistance.toFixed(3)}m -> ${minBackMove.toFixed(3)}m`)
              }
            }
          }
        }
        
        // If we have constraint bounds, ensure the target point is within them
        if (constraintBounds && targetPoint && !constraintBounds.containsPoint(targetPoint)) {
          // Clamp the target point to the constraint bounds
          targetPoint = new Vector3(
            Math.max(constraintBounds.min.x, Math.min(constraintBounds.max.x, targetPoint.x)),
            Math.max(constraintBounds.min.y, Math.min(constraintBounds.max.y, targetPoint.y)),
            Math.max(constraintBounds.min.z, Math.min(constraintBounds.max.z, targetPoint.z))
          )
          
          // Additional constraint for front vertices
          if (isArmorFitting && vertexSidedness.length > 0) {
            const sidedness = vertexSidedness[vertexIndex] || 'unknown'
            if (sidedness === 'front') {
              // Don't let front vertices go below 20% from feet (original bound)
              const frontMinY = sourceBounds.min.y + (sourceBounds.max.y - sourceBounds.min.y) * 0.2
              if (targetPoint.y < frontMinY) {
                targetPoint.y = frontMinY
              }
            }
          }
          
          // Recalculate displacement to clamped point
          finalDesiredPoint = targetPoint.clone()
          if (targetNormal) {
            // Variable offset based on vertex type and position
            let variableOffset = parameters.targetOffset
            
            if (isArmorFitting && vertexSidedness.length > 0) {
              const sidedness = vertexSidedness[vertexIndex] || 'unknown'
              const heightRange = sourceBounds.max.y - sourceBounds.min.y
              const relativeY = safeDivide(vertex.y - sourceBounds.min.y, heightRange, 0)
              
              if (sidedness === 'back') {
                // Larger offset for back vertices, especially lower back
                if (relativeY < 0.3) {
                  // Lower back needs significant offset for buttocks
                  variableOffset = 0.06 + (0.3 - relativeY) * 0.04 // 6-10cm
                  
                  // Extra offset for very bottom vertices
                  if (relativeY < 0.15) {
                    variableOffset = 0.12 // 12cm for buttocks area
                  }
                  
                  if (vertexIndex % 50 === 0) {
                    console.log(`Lower back vertex ${vertexIndex}: Y=${relativeY.toFixed(2)}, offset=${variableOffset.toFixed(3)}m`)
                  }
                } else if (relativeY < 0.5) {
                  // Mid back
                  variableOffset = 0.04 // 4cm
                } else {
                  // Upper back
                  variableOffset = 0.03 // 3cm
                }
              } else if (sidedness === 'front') {
                // Smaller offset for front to prevent over-extension
                variableOffset = 0.02 // 2cm only
              }
            }
            
            finalDesiredPoint.add(targetNormal.clone().multiplyScalar(variableOffset))
          }
          displacement.copy(finalDesiredPoint.clone().sub(vertex))
        }
        
        // Apply step size
        if (moveDistance > 0.001) {
          let actualMoveDistance = moveDistance * parameters.stepSize
          
          // Apply edge influence for armor meshes
          if (isArmorToAvatar && lockedVertices.size > 0) {
            const edgeInfluence = this.calculateEdgeInfluence(
              vertexIndex, 
              position, 
              lockedVertices, 
              edgeInfluenceRadius
            )
            
            // Skip locked vertices entirely
            if (edgeInfluence === 0) {
              continue // Don't move edge vertices at all
            }
            
            // Reduce movement for vertices near edges
            actualMoveDistance *= edgeInfluence
            
            if (vertexIndex % 100 === 0 && edgeInfluence < 1.0) {
              console.log(`Vertex ${vertexIndex}: Edge influence = ${edgeInfluence.toFixed(3)}`)
            }
          }
          
          // Limit maximum movement per iteration
          const maxMoveDistance = targetSize.length() * 0.1 // Max 10% of target size
          if (actualMoveDistance > maxMoveDistance) {
            actualMoveDistance = maxMoveDistance
          }
          
          displacement.normalize().multiplyScalar(actualMoveDistance)
          
          // Apply deformation limit to prevent excessive mesh distortion
          if (displacement.length() > maxDeformation) {
            displacement.normalize().multiplyScalar(maxDeformation)
            if (vertexIndex % 100 === 0) {
              console.log(`Vertex ${vertexIndex}: Limited deformation from ${actualMoveDistance.toFixed(3)} to ${maxDeformation.toFixed(3)}`)
            }
          }
          
          // Transform displacement to local space
          const worldDisplacement = displacement.clone()
          const inverseRotation = sourceMesh.matrixWorld.clone()
          inverseRotation.setPosition(0, 0, 0) // Remove translation
          const localDisplacement = worldDisplacement.clone().applyMatrix4(inverseRotation.invert())
          
          // Store displacement
          displacements[vertexIndex * 3] = localDisplacement.x
          displacements[vertexIndex * 3 + 1] = localDisplacement.y
          displacements[vertexIndex * 3 + 2] = localDisplacement.z
          hasDisplacement[vertexIndex] = true
          
          movedVertices++
          maxMovement = Math.max(maxMovement, actualMoveDistance)
        }
      }
      
      // Apply smoothing to displacements if enabled
      if (parameters.smoothingStrength > 0 && movedVertices > 0) {
        console.log('   Applying displacement smoothing...')
        
        // Detect if target has flat faces and adjust smoothing accordingly
        const hasFlatFaces = this.detectFlatFaces(targetMesh)
        const adaptiveStrength = hasFlatFaces ? 
          parameters.smoothingStrength * 0.3 : // Much less smoothing for flat-faced targets
          parameters.smoothingStrength
        
        // Create a modified hasDisplacement array that excludes lower back vertices from smoothing
        const smoothingMask = new Array(vertexCount).fill(true)
        if (isArmorFitting && vertexSidedness.length > 0) {
          for (let i = 0; i < vertexCount; i++) {
            const sidedness = vertexSidedness[i]
            if (sidedness === 'back') {
              const vertex = new Vector3(
                position.getX(i),
                position.getY(i),
                position.getZ(i)
              )
              vertex.applyMatrix4(sourceMesh.matrixWorld)
              const relativeY = (vertex.y - sourceBounds.min.y) / (sourceBounds.max.y - sourceBounds.min.y)
              
              // Don't smooth lower back vertices at all
                              if (relativeY < 0.4) {
                  smoothingMask[i] = false
                  // Keep the displacement but don't smooth; explicit no-op to clarify intent
                  if (hasDisplacement[i]) {
                    hasDisplacement[i] = true
                  }
                }
            }
          }
          
          const skippedCount = smoothingMask.filter(mask => !mask).length
          console.log(`   Skipping smoothing for ${skippedCount} lower back vertices`)
        }
        
        this.smoothDisplacements(
          displacements,
          hasDisplacement,
          position.array as Float32Array,
          vertexCount,
          parameters.smoothingRadius,
          adaptiveStrength,
          parameters.preserveFeatures || hasFlatFaces,
          lockedVertices,
          smoothingMask // Pass the mask
        )
      }
      
      // Apply smoothed displacements to update positions
      for (let i = 0; i < vertexCount; i++) {
        if (hasDisplacement[i]) {
          position.setX(i, position.getX(i) + displacements[i * 3])
          position.setY(i, position.getY(i) + displacements[i * 3 + 1])
          position.setZ(i, position.getZ(i) + displacements[i * 3 + 2])
        }
      }
      
      // Update geometry
      position.needsUpdate = true
      sourceGeometry.computeVertexNormals()
      
      // Create debug arrows for this iteration
      if (parameters.showDebugArrows) {
        this.createDebugArrows(sourceMesh, displacements, hasDisplacement, parameters)
      }
      
      console.log(`   Moved: ${movedVertices}/${vertexCount} vertices, max movement: ${maxMovement.toFixed(4)}`)
    }
    
    // Final correction pass for armor lower back vertices
    if (isArmorFitting && vertexSidedness.length > 0) {
      console.log('🎯 Applying final lower back correction pass...')
      
      let correctedCount = 0
      const correctionDisplacements = new Float32Array(vertexCount * 3)
      
      for (let i = 0; i < vertexCount; i++) {
        const sidedness = vertexSidedness[i]
        if (sidedness !== 'back') continue
        
        // Get current vertex position
        const vertex = new Vector3(
          position.getX(i),
          position.getY(i),
          position.getZ(i)
        )
        vertex.applyMatrix4(sourceMesh.matrixWorld)
        
        const relativeY = (vertex.y - sourceBounds.min.y) / (sourceBounds.max.y - sourceBounds.min.y)
        
        // Only apply to very low back vertices (bottom 20%)
        if (relativeY < 0.2) {
          // Simple check: cast ray backward and see if we're too close
          const backwardDir = new Vector3(0, 0, -1)
          const worldMatrix = sourceMesh.matrixWorld.clone()
          worldMatrix.setPosition(0, 0, 0)
          backwardDir.transformDirection(worldMatrix)
          
          this.raycaster.set(vertex, backwardDir)
          const intersections = this.raycaster.intersectObject(targetMesh, false)
          
          if (intersections.length > 0) {
            const distance = intersections[0].distance
            // If we're less than 5cm from the body, push out
            if (distance < 0.05) {
              const pushDistance = 0.08 - distance // Push to 8cm away
              const displacement = backwardDir.clone().negate().multiplyScalar(pushDistance)
              
              // Transform to local space
              const inverseRotation = sourceMesh.matrixWorld.clone()
              inverseRotation.setPosition(0, 0, 0)
              const localDisplacement = displacement.clone().applyMatrix4(inverseRotation.invert())
              
              correctionDisplacements[i * 3] = localDisplacement.x
              correctionDisplacements[i * 3 + 1] = localDisplacement.y
              correctionDisplacements[i * 3 + 2] = localDisplacement.z
              
              correctedCount++
            }
          }
        }
      }
      
      // Apply correction displacements
      if (correctedCount > 0) {
        console.log(`   Correcting ${correctedCount} lower back vertices`)
        
        for (let i = 0; i < vertexCount; i++) {
          const dispX = correctionDisplacements[i * 3]
          const dispY = correctionDisplacements[i * 3 + 1]
          const dispZ = correctionDisplacements[i * 3 + 2]
          
          if (dispX !== 0 || dispY !== 0 || dispZ !== 0) {
            position.setX(i, position.getX(i) + dispX)
            position.setY(i, position.getY(i) + dispY)
            position.setZ(i, position.getZ(i) + dispZ)
          }
        }
        
        position.needsUpdate = true
        sourceGeometry.computeVertexNormals()
      }
    }
    
    // After main iterations, apply surface relaxation for box targets
    if (isBox && parameters.useImprovedShrinkwrap) {
      console.log('🎯 Applying surface relaxation to prevent bunching...')
      this.relaxOnSurface(
        position.array as Float32Array,
          vertexCount,
        sourceMesh,
        targetMesh,
        true, // isBox
        10,   // More iterations for better distribution
        0.5   // Stronger relaxation
      )
      position.needsUpdate = true
      sourceGeometry.computeVertexNormals()
    }
    
    // Push out any vertices that ended up inside the target mesh
    // This prevents armor from collapsing through the body
    if (parameters.pushInteriorVertices && (targetMesh instanceof SkinnedMesh || vertexCount > 1000)) {
      if (preIterationPositions) {
        const pushedCount = this.pushInteriorVerticesOut(
          sourceMesh, 
          targetMesh, 
          preIterationPositions,
          0.8 // 80% restoration - blend between current and pre-iteration position
        )
        
        if (pushedCount > 0) {
          console.log(`✅ Pushed ${pushedCount} interior vertices back to pre-iteration positions`)
          
          // Apply smoothing to the pushed vertices to prevent spikes
          if (parameters.smoothingStrength > 0) {
            console.log('   Smoothing restored vertices...')
            this.smoothDisplacements(
              new Float32Array(vertexCount * 3), // Empty displacements, we just want to smooth existing positions
              Array(vertexCount).fill(true), // All vertices can be smoothed
              position.array as Float32Array,
              vertexCount,
              parameters.smoothingRadius * 0.5, // Smaller radius for local smoothing
              parameters.smoothingStrength * 0.5, // Lighter smoothing
              parameters.preserveFeatures,
              lockedVertices
            )
      position.needsUpdate = true
      sourceGeometry.computeVertexNormals()
          }
        }
      }
    }
    
    // Final step: If we have constraint bounds, clamp all vertices to stay within
    if (parameters.targetBounds) {
      console.log('🎯 GenericMeshFittingService: Final clamping to constraint bounds')
      const positions = position.array as Float32Array
      
      for (let i = 0; i < vertexCount; i++) {
        const vertex = new Vector3(
          positions[i * 3],
          positions[i * 3 + 1],
          positions[i * 3 + 2]
        )
        
        // Transform to world space
        vertex.applyMatrix4(sourceMesh.matrixWorld)
        
        // Clamp to bounds
        const clampedVertex = vertex.clone()
        clampedVertex.clamp(parameters.targetBounds.min, parameters.targetBounds.max)
        
        // If vertex was outside bounds, move it back
        if (!vertex.equals(clampedVertex)) {
          // Transform back to local space
          const inverseMatrix = sourceMesh.matrixWorld.clone().invert()
          clampedVertex.applyMatrix4(inverseMatrix)
          
          positions[i * 3] = clampedVertex.x
          positions[i * 3 + 1] = clampedVertex.y
          positions[i * 3 + 2] = clampedVertex.z
        }
      }
      
      position.needsUpdate = true
    }
    
    // Final validation
    const finalBounds = new Box3().setFromBufferAttribute(position)
    const finalSize = finalBounds.getSize(new Vector3())
    console.log('🎯 GenericMeshFittingService: Final mesh size:', 
      finalSize.x.toFixed(3), finalSize.y.toFixed(3), finalSize.z.toFixed(3))
    
          // Special validation for box targets
      if (isBox) {
        console.log('🎯 Validating box fitting - checking for vertices inside target...')
        let insideCount = 0
        
        // Get world bounds of the target box
        const worldBox = new Box3().setFromObject(targetMesh)
        
        for (let i = 0; i < vertexCount; i++) {
          const vertex = new Vector3(
            position.getX(i),
            position.getY(i),
            position.getZ(i)
          )
          
          // Transform to world space
          vertex.applyMatrix4(sourceMesh.matrixWorld)
          
          if (worldBox.containsPoint(vertex)) {
          insideCount++
          
                      // Fix it by pushing it to the nearest face
            const distances = [
              { axis: 'x', dist: Math.abs(vertex.x - worldBox.min.x), value: worldBox.min.x - parameters.targetOffset, dir: -1 },
              { axis: 'x', dist: Math.abs(vertex.x - worldBox.max.x), value: worldBox.max.x + parameters.targetOffset, dir: 1 },
              { axis: 'y', dist: Math.abs(vertex.y - worldBox.min.y), value: worldBox.min.y - parameters.targetOffset, dir: -1 },
              { axis: 'y', dist: Math.abs(vertex.y - worldBox.max.y), value: worldBox.max.y + parameters.targetOffset, dir: 1 },
              { axis: 'z', dist: Math.abs(vertex.z - worldBox.min.z), value: worldBox.min.z - parameters.targetOffset, dir: -1 },
              { axis: 'z', dist: Math.abs(vertex.z - worldBox.max.z), value: worldBox.max.z + parameters.targetOffset, dir: 1 },
            ]
          
          // Find closest face
          distances.sort((a, b) => a.dist - b.dist)
          const closest = distances[0]
          
          // Push vertex to that face
          if (closest.axis === 'x') vertex.x = closest.value
          else if (closest.axis === 'y') vertex.y = closest.value
          else if (closest.axis === 'z') vertex.z = closest.value
          
          // Transform back to local space
          const inverseMatrix = sourceMesh.matrixWorld.clone().invert()
          vertex.applyMatrix4(inverseMatrix)
          
          position.setX(i, vertex.x)
          position.setY(i, vertex.y)
          position.setZ(i, vertex.z)
        }
      }
      
      if (insideCount > 0) {
        console.warn(`⚠️ Found ${insideCount} vertices inside box - fixed them!`)
        position.needsUpdate = true
      } else {
        console.log('✅ All vertices are outside the box!')
      }
    }
    
    if (finalSize.length() < 0.001) {
      console.error('⚠️ GenericMeshFittingService: Mesh collapsed! Restoring original positions')
      this.resetMesh(sourceMesh, originalPositions)
    }
    
    // Final progress callback
    if (parameters.onProgress) {
      parameters.onProgress(100, 'Fitting complete')
    }
    
    console.log('🎯 GenericMeshFittingService: Fitting complete')
  }
  
  /**
   * Alternative fitting approach using uniform shrinking pressure
   * This maintains better vertex distribution
   */
  fitMeshToTargetUniform(
    sourceMesh: Mesh,
    targetMesh: Mesh,
    parameters: MeshFittingParameters
  ): void {
    console.log('🎯 GenericMeshFittingService: Starting uniform pressure fitting')
    
    const sourceGeometry = sourceMesh.geometry as BufferGeometry
    const position = sourceGeometry.attributes.position as BufferAttribute
    const vertexCount = position.count
    
    // Store original positions for reference
//     const _originalPositions = new Float32Array(position.array)

    // Get centers
    const targetBounds = new Box3().setFromObject(targetMesh)
    const targetCenter = targetBounds.getCenter(new Vector3())
    
    // Check if target is a box
    const isBox = this.detectFlatFaces(targetMesh)
    
    // Update matrices
    targetMesh.updateMatrixWorld(true)
    sourceMesh.updateMatrixWorld(true)
    
    // For each iteration, apply uniform shrinking
    for (let iter = 0; iter < parameters.iterations; iter++) {
      console.log(`\n🎯 Uniform pressure iteration ${iter + 1}/${parameters.iterations}`)
      
      let contactCount = 0
      const displacements = new Float32Array(vertexCount * 3)
      
      for (let i = 0; i < vertexCount; i++) {
        const vertex = new Vector3(
          position.getX(i),
          position.getY(i),
          position.getZ(i)
        )
        
        // Transform to world space
        vertex.applyMatrix4(sourceMesh.matrixWorld)
        
        // Direction toward center (shrinking direction)
        const toCenter = targetCenter.clone().sub(vertex)
        const distance = toCenter.length()
        
        if (distance > 0.001) {
          toCenter.normalize()
          
          // Check if we're in contact with target
          this.raycaster.set(vertex, toCenter)
          const hits = this.raycaster.intersectObject(targetMesh, false)
          
          if (hits.length > 0 && hits[0].distance < parameters.targetOffset * 2) {
            // We're in contact or very close - stop shrinking this vertex
            contactCount++
            displacements[i * 3] = 0
            displacements[i * 3 + 1] = 0
            displacements[i * 3 + 2] = 0
          } else {
            // Apply shrinking displacement
            const shrinkAmount = Math.min(distance * parameters.stepSize, 0.01) // Limit max movement
            const displacement = toCenter.multiplyScalar(shrinkAmount)
            
            // Transform to local space
            const inverseRotation = sourceMesh.matrixWorld.clone()
            inverseRotation.setPosition(0, 0, 0)
            displacement.applyMatrix4(inverseRotation.invert())
            
            displacements[i * 3] = displacement.x
            displacements[i * 3 + 1] = displacement.y
            displacements[i * 3 + 2] = displacement.z
          }
        }
      }
      
      // Apply displacements
      for (let i = 0; i < vertexCount; i++) {
        position.setX(i, position.getX(i) + displacements[i * 3])
        position.setY(i, position.getY(i) + displacements[i * 3 + 1])
        position.setZ(i, position.getZ(i) + displacements[i * 3 + 2])
      }
      
      // Update geometry
      position.needsUpdate = true
      sourceGeometry.computeVertexNormals()
      
      console.log(`   Contact vertices: ${contactCount}/${vertexCount}`)
      
      // If most vertices are in contact, we're done
      if (contactCount > vertexCount * 0.9) {
        console.log('   Most vertices in contact, stopping early')
        break
      }
    }
    
    // Apply surface relaxation if enabled
    if (isBox && parameters.useImprovedShrinkwrap) {
      console.log('🎯 Applying final surface relaxation...')
      this.relaxOnSurface(
        position.array as Float32Array,
        vertexCount,
        sourceMesh,
        targetMesh,
        true,
        15,   // More iterations for final pass
        0.6   // Strong relaxation
      )
      position.needsUpdate = true
      sourceGeometry.computeVertexNormals()
    }
    
    console.log('🎯 GenericMeshFittingService: Uniform pressure fitting complete')
  }
  
  /**
   * Specialized armor fitting that preserves rigid structure
   */
  fitArmorToBody(
    armorMesh: Mesh,
    bodyMesh: Mesh, // Should be a simplified body hull, not SkinnedMesh
    parameters: {
      targetOffset?: number
      iterations?: number
      rigidity?: number // 0-1, how much to preserve original shape
      smoothingPasses?: number
    } = {}
  ): void {
    const {
      targetOffset = 0.02, // 2cm offset from body
      iterations = 10,
      rigidity = 0.7, // Preserve 70% of original shape
      smoothingPasses = 3
    } = parameters
    
    console.log('🎯 Starting specialized armor fitting')
    
    // Get geometries
    const armorGeometry = armorMesh.geometry as BufferGeometry
    const bodyGeometry = bodyMesh.geometry as BufferGeometry
    
    const armorPositions = armorGeometry.attributes.position as BufferAttribute
    const vertexCount = armorPositions.count
    
    // Store original positions for rigidity constraint
    const originalPositions = new Float32Array(armorPositions.array)
    
    // Create neighbor map for structure preservation
    const neighbors = this.buildNeighborMap(armorGeometry)
    
    // Get armor bounds and center
    const armorBounds = new Box3().setFromObject(armorMesh)
    const armorCenter = armorBounds.getCenter(new Vector3())
    
    // Get body bounds and center
    const bodyBounds = new Box3().setFromObject(bodyMesh)
    const bodyCenter = bodyBounds.getCenter(new Vector3())
    
    console.log('Armor center:', armorCenter)
    console.log('Body center:', bodyCenter)
    
    // Pre-compute body triangles for closest point queries
    const bodyPositions = bodyGeometry.attributes.position as BufferAttribute
    const bodyIndices = bodyGeometry.index
    const bodyTriangles: Array<{a: Vector3, b: Vector3, c: Vector3}> = []
    
    if (bodyIndices) {
      for (let i = 0; i < bodyIndices.count; i += 3) {
        const a = new Vector3().fromBufferAttribute(bodyPositions, bodyIndices.getX(i))
        const b = new Vector3().fromBufferAttribute(bodyPositions, bodyIndices.getX(i + 1))
        const c = new Vector3().fromBufferAttribute(bodyPositions, bodyIndices.getX(i + 2))
        bodyTriangles.push({ a, b, c })
      }
    }
    
    // Helper function to find closest point on mesh
    const findClosestPointOnMesh = (point: Vector3): { point: Vector3, normal: Vector3 } => {
      let minDist = Infinity
      let closestPoint = new Vector3()
      let closestNormal = new Vector3()
      
      const localPoint = bodyMesh.worldToLocal(point.clone())
      
      for (const tri of bodyTriangles) {
        // Find closest point on triangle
        const triangle = new Triangle(tri.a, tri.b, tri.c)
        const closest = new Vector3()
        triangle.closestPointToPoint(localPoint, closest)
        
        const dist = closest.distanceTo(localPoint)
        if (dist < minDist) {
          minDist = dist
          closestPoint.copy(closest)
          triangle.getNormal(closestNormal)
        }
      }
      
      // Transform back to world space
      closestPoint.applyMatrix4(bodyMesh.matrixWorld)
      closestNormal.transformDirection(bodyMesh.matrixWorld).normalize()
      
      return { point: closestPoint, normal: closestNormal }
    }
    
    // Main fitting loop
    for (let iter = 0; iter < iterations; iter++) {
      console.log(`\n🎯 Armor Fitting Iteration ${iter + 1}/${iterations}`)
      
      const displacements = new Float32Array(vertexCount * 3)
      
      // Step 1: Calculate target positions on body surface
      for (let i = 0; i < vertexCount; i++) {
        const vertex = new Vector3(
          armorPositions.getX(i),
          armorPositions.getY(i),
          armorPositions.getZ(i)
        )
        
        // Transform to world space
        vertex.applyMatrix4(armorMesh.matrixWorld)
        
        // Find closest point on body surface
        const closestPointInfo = findClosestPointOnMesh(vertex)
        
        if (closestPointInfo) {
          const { point: closestPoint, normal: closestNormal } = closestPointInfo
          
          // Calculate target position with offset
          const targetPos = closestPoint.clone().add(
            closestNormal.clone().multiplyScalar(targetOffset)
          )
          
          // Calculate displacement
          const displacement = targetPos.sub(vertex)
          
          // Apply rigidity constraint - blend with original position
          const originalVertex = new Vector3(
            originalPositions[i * 3],
            originalPositions[i * 3 + 1],
            originalPositions[i * 3 + 2]
          )
          originalVertex.applyMatrix4(armorMesh.matrixWorld)
          
          const rigidDisplacement = originalVertex.sub(vertex)
          displacement.lerp(rigidDisplacement, rigidity)
          
          // Store displacement
          displacements[i * 3] = displacement.x
          displacements[i * 3 + 1] = displacement.y
          displacements[i * 3 + 2] = displacement.z
        }
      }
      
      // Step 2: Smooth displacements to maintain structure
      for (let pass = 0; pass < smoothingPasses; pass++) {
        const smoothedDisplacements = new Float32Array(displacements)
        
        for (let i = 0; i < vertexCount; i++) {
          const neighborIndices = neighbors.get(i) || new Set<number>()
          if (neighborIndices.size === 0) continue
          
          let avgDisplacement = new Vector3(
            displacements[i * 3],
            displacements[i * 3 + 1],
            displacements[i * 3 + 2]
          )
          
          // Average with neighbor displacements
          for (const ni of neighborIndices) {
            avgDisplacement.add(new Vector3(
              displacements[ni * 3],
              displacements[ni * 3 + 1],
              displacements[ni * 3 + 2]
            ))
          }
          
          avgDisplacement.divideScalar(neighborIndices.size + 1)
          
          // Blend with original displacement (preserve features)
          const original = new Vector3(
            displacements[i * 3],
            displacements[i * 3 + 1],
            displacements[i * 3 + 2]
          )
          avgDisplacement.lerp(original, 0.5)
          
          smoothedDisplacements[i * 3] = avgDisplacement.x
          smoothedDisplacements[i * 3 + 1] = avgDisplacement.y
          smoothedDisplacements[i * 3 + 2] = avgDisplacement.z
        }
        
        displacements.set(smoothedDisplacements)
      }
      
      // Step 3: Apply displacements with step size
      const stepSize = 1.0 / (iter + 1) // Decrease step size over iterations
      let maxMovement = 0
      
      for (let i = 0; i < vertexCount; i++) {
        const vertex = new Vector3(
          armorPositions.getX(i),
          armorPositions.getY(i),
          armorPositions.getZ(i)
        )
        
        const displacement = new Vector3(
          displacements[i * 3],
          displacements[i * 3 + 1],
          displacements[i * 3 + 2]
        )
        
        // Apply displacement with step size
        displacement.multiplyScalar(stepSize)
        vertex.add(displacement)
        
        // Update position
        armorPositions.setXYZ(i, vertex.x, vertex.y, vertex.z)
        
        maxMovement = Math.max(maxMovement, displacement.length())
      }
      
      console.log(`   Max movement: ${maxMovement.toFixed(4)}`)
      
      // Mark for update
      armorPositions.needsUpdate = true
      armorGeometry.computeVertexNormals()
      
      // Early exit if converged
      if (maxMovement < 0.001) {
        console.log('✅ Converged early')
        break
      }
    }
    
    console.log('🎯 Armor fitting complete')
  }
  
  /**
   * Detect edge vertices that form openings (neck hole, arm holes)
   * Returns a Set of vertex indices that are on edges
   */
//   private detectEdgeVertices(geometry: BufferGeometry): {
//     edgeVertices: Set<number>,
//     edgeLoops: Array<{name: string, vertices: number[]}>
//   } {
//     console.log('🔍 Detecting edge vertices for openings...')
//
//     const position = geometry.attributes.position as BufferAttribute
//     const index = geometry.index
//
//     if (!index) {
//       console.warn('⚠️ Mesh has no index buffer, edge detection may be incomplete')
//       return { edgeVertices: new Set(), edgeLoops: [] }
//     }
//
//     // Map to track how many faces each edge belongs to
//     const edgeMap = new Map<string, { count: number, vertices: [number, number] }>()
//
//     // Build edge map
//     const indices = index.array
//     for (let i = 0; i < indices.length; i += 3) {
//       const v0 = indices[i]
//       const v1 = indices[i + 1]
//       const v2 = indices[i + 2]
//
//       // Three edges per triangle
//       const edges: [number, number][] = [
//         [Math.min(v0, v1), Math.max(v0, v1)],
//         [Math.min(v1, v2), Math.max(v1, v2)],
//         [Math.min(v2, v0), Math.max(v2, v0)]
//       ]
//
//       for (const [a, b] of edges) {
//         const key = `${a}_${b}`
//         const edge = edgeMap.get(key)
//         if (edge) {
//           edge.count++
//         } else {
//           edgeMap.set(key, { count: 1, vertices: [a, b] })
//         }
//       }
//     }
//
//     // Find boundary edges (edges that belong to only one face)
//     const boundaryEdges: Array<[number, number]> = []
//     const edgeVertices = new Set<number>()
//
//     for (const [_key, edge] of edgeMap) {
//       if (edge.count === 1) {
//         boundaryEdges.push(edge.vertices)
//         edgeVertices.add(edge.vertices[0])
//         edgeVertices.add(edge.vertices[1])
//       }
//     }
//
//     console.log(`Found ${edgeVertices.size} edge vertices forming ${boundaryEdges.length} boundary edges`)
//
//     // Group edge vertices into loops
//     const edgeLoops = this.groupEdgeVerticesIntoLoops(boundaryEdges, position)
//
//     return { edgeVertices, edgeLoops }
//   }

  /**
   * Find the nearest point on a mesh surface to a given point
   */
  private findNearestSurfacePoint(point: Vector3, targetMesh: Mesh): { point: Vector3, normal: Vector3 } | null {
    const geometry = targetMesh.geometry as BufferGeometry
    const position = geometry.attributes.position as BufferAttribute
    const index = geometry.index
    
    let nearestPoint = new Vector3()
    let nearestNormal = new Vector3()
    let nearestDistance = Infinity
    
    // Transform point to mesh local space
    const localPoint = point.clone()
    const inverseMatrix = targetMesh.matrixWorld.clone().invert()
    localPoint.applyMatrix4(inverseMatrix)
    
    // Check each triangle
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const a = new Vector3().fromBufferAttribute(position, index.array[i])
        const b = new Vector3().fromBufferAttribute(position, index.array[i + 1])
        const c = new Vector3().fromBufferAttribute(position, index.array[i + 2])
        
        // Find closest point on triangle
        const closestPoint = new Vector3()
        this.closestPointOnTriangle(localPoint, a, b, c, closestPoint)
        
        const distance = localPoint.distanceTo(closestPoint)
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestPoint = closestPoint
          
          // Calculate normal
          const edge1 = b.clone().sub(a)
          const edge2 = c.clone().sub(a)
          nearestNormal = edge1.cross(edge2).normalize()
        }
      }
    }
    
    if (nearestDistance < Infinity) {
      // Transform back to world space
      nearestPoint.applyMatrix4(targetMesh.matrixWorld)
      nearestNormal.transformDirection(targetMesh.matrixWorld)
      return { point: nearestPoint, normal: nearestNormal }
    }
    
    return null
  }
  
  /**
   * Find closest point on a triangle to a given point
   */
  private closestPointOnTriangle(p: Vector3, a: Vector3, b: Vector3, c: Vector3, result: Vector3): void {
    // Implementation of closest point on triangle algorithm
    const ab = b.clone().sub(a)
    const ac = c.clone().sub(a)
    const ap = p.clone().sub(a)
    
    const d1 = ab.dot(ap)
    const d2 = ac.dot(ap)
    if (d1 <= 0 && d2 <= 0) {
      result.copy(a)
      return
    }
    
    const bp = p.clone().sub(b)
    const d3 = ab.dot(bp)
    const d4 = ac.dot(bp)
    if (d3 >= 0 && d4 <= d3) {
      result.copy(b)
      return
    }
    
    const vc = d1 * d4 - d3 * d2
    if (vc <= 0 && d1 >= 0 && d3 <= 0) {
      const v = d1 / (d1 - d3)
      result.copy(a).addScaledVector(ab, v)
      return
    }
    
    const cp = p.clone().sub(c)
    const d5 = ab.dot(cp)
    const d6 = ac.dot(cp)
    if (d6 >= 0 && d5 <= d6) {
      result.copy(c)
      return
    }
    
    const vb = d5 * d2 - d1 * d6
    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
      const w = d2 / (d2 - d6)
      result.copy(a).addScaledVector(ac, w)
      return
    }
    
    const va = d3 * d6 - d5 * d4
    if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
      const w = (d4 - d3) / ((d4 - d3) + (d5 - d6))
      result.copy(b).addScaledVector(c.clone().sub(b), w)
      return
    }
    
    const denom = 1 / (va + vb + vc)
    const v = vb * denom
    const w = vc * denom
    result.copy(a).addScaledVector(ab, v).addScaledVector(ac, w)
  }
  
  /**
   * Apply smoothing pass to vertex positions
   */
//   private applySmoothingPass(
//     positions: Float32Array,
//     vertexCount: number,
//     radius: number,
//     strength: number,
// //     worldMatrix: Matrix4,
//     preserveFeatures: boolean = false,
//     featureAngleThreshold: number = 30
//   ): void {
//     // Create a copy for reading original positions
//     const originalPositions = new Float32Array(positions)
//     
//     // If preserving features, we need to compute vertex normals first
//     let vertexNormals: Float32Array | null = null
//     if (preserveFeatures) {
//       vertexNormals = this.computeVertexNormals(originalPositions, vertexCount)
//     }
//     
//     const angleThresholdRad = (featureAngleThreshold * Math.PI) / 180
//     
//     // For each vertex, average with nearby vertices
//     for (let i = 0; i < vertexCount; i++) {
//       const centerX = originalPositions[i * 3]
//       const centerY = originalPositions[i * 3 + 1]
//       const centerZ = originalPositions[i * 3 + 2]
//       
//       let totalWeight = 1.0 // Include self
//       let avgX = centerX
//       let avgY = centerY
//       let avgZ = centerZ
//       
//       // Get normal for current vertex if preserving features
//       let centerNormal: Vector3 | null = null
//       if (preserveFeatures && vertexNormals) {
//         centerNormal = new Vector3(
//           vertexNormals[i * 3],
//           vertexNormals[i * 3 + 1],
//           vertexNormals[i * 3 + 2]
//         )
//       }
//       
//       // Check nearby vertices
//       for (let j = 0; j < vertexCount; j++) {
//         if (i === j) continue
//         
//         const dx = originalPositions[j * 3] - centerX
//         const dy = originalPositions[j * 3 + 1] - centerY
//         const dz = originalPositions[j * 3 + 2] - centerZ
//         const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
//         
//         if (distance < radius && distance > 0) {
//           // Check if we should include this vertex based on feature preservation
//           let includeVertex = true
//           
//           if (preserveFeatures && centerNormal && vertexNormals) {
//             const neighborNormal = new Vector3(
//               vertexNormals[j * 3],
//               vertexNormals[j * 3 + 1],
//               vertexNormals[j * 3 + 2]
//             )
//             
//             // Calculate angle between normals
//             const dotProduct = centerNormal.dot(neighborNormal)
//             const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)))
//             
//             // If angle is too large, these vertices are on different surfaces
//             if (angle > angleThresholdRad) {
//               includeVertex = false
//             }
//           }
//           
//           if (includeVertex) {
//           // Gaussian weight
//           const weight = Math.exp(-(distance * distance) / (2 * radius * radius))
//           
//           avgX += originalPositions[j * 3] * weight
//           avgY += originalPositions[j * 3 + 1] * weight
//           avgZ += originalPositions[j * 3 + 2] * weight
//           totalWeight += weight
//           }
//         }
//       }
//       
//       // Apply smoothed position
//       if (totalWeight > 0) {
//         avgX /= totalWeight
//         avgY /= totalWeight
//         avgZ /= totalWeight
//         
//         // Blend between original and smoothed based on strength
//         positions[i * 3] = centerX * (1 - strength) + avgX * strength
//         positions[i * 3 + 1] = centerY * (1 - strength) + avgY * strength
//         positions[i * 3 + 2] = centerZ * (1 - strength) + avgZ * strength
//       }
//     }
//   }
  
  /**
   * Project vertices back onto the target surface after smoothing
   */
//   private projectVerticesToSurface(
//     positions: Float32Array,
//     vertexCount: number,
//     sourceMesh: Mesh,
//     targetMesh: Mesh,
//     targetOffset: number
//   ): void {
//     for (let i = 0; i < vertexCount; i++) {
//       const vertex = new Vector3(
//         positions[i * 3],
//         positions[i * 3 + 1],
//         positions[i * 3 + 2]
//       )
//       
//       // Transform to world space
//       vertex.applyMatrix4(sourceMesh.matrixWorld)
//       
//       // Find the nearest point on the target surface
//       const nearest = this.findNearestSurfacePoint(vertex, targetMesh)
//       
//       if (nearest) {
//         // Calculate the desired position based on the target offset
//         const desiredPoint = nearest.point.clone().add(
//           nearest.normal.clone().multiplyScalar(targetOffset)
//         )
//         
//         // Calculate movement
//         const movement = desiredPoint.clone().sub(vertex)
//         
//         // Apply the movement to the vertex
//         const newWorldPos = vertex.clone().add(movement)
//         
//         // Transform back to local space
//         const newLocalPos = newWorldPos.clone()
//         const inverseMatrix = sourceMesh.matrixWorld.clone().invert()
//         newLocalPos.applyMatrix4(inverseMatrix)
//         
//         // Update the position in the source geometry
//         positions[i * 3] = newLocalPos.x
//         positions[i * 3 + 1] = newLocalPos.y
//         positions[i * 3 + 2] = newLocalPos.z
//       } else {
//         // Fallback if projection fails (e.g., no intersection found)
//         // This should ideally not happen if findNearestSurfacePoint works correctly
//         console.warn(`Could not project vertex ${i} back to surface. Keeping original position.`)
//       }
//     }
//   }
  
  /**
   * Compute vertex normals from positions
   */
  private computeVertexNormals(positions: Float32Array, vertexCount: number): Float32Array {
    const normals = new Float32Array(vertexCount * 3)
    
    // Initialize all normals to zero
    for (let i = 0; i < normals.length; i++) {
      normals[i] = 0
    }
    
    // For simplicity, we'll compute face normals and average them per vertex
    // This assumes triangulated mesh (every 3 vertices form a triangle)
    for (let i = 0; i < vertexCount; i += 3) {
      if (i + 2 >= vertexCount) break
      
      // Get triangle vertices
      const v0 = new Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
      const v1 = new Vector3(positions[(i + 1) * 3], positions[(i + 1) * 3 + 1], positions[(i + 1) * 3 + 2])
      const v2 = new Vector3(positions[(i + 2) * 3], positions[(i + 2) * 3 + 1], positions[(i + 2) * 3 + 2])
      
      // Compute face normal
      const edge1 = v1.clone().sub(v0)
      const edge2 = v2.clone().sub(v0)
      const faceNormal = edge1.cross(edge2).normalize()
      
      // Add face normal to each vertex
      for (let j = 0; j < 3; j++) {
        const idx = i + j
        normals[idx * 3] += faceNormal.x
        normals[idx * 3 + 1] += faceNormal.y
        normals[idx * 3 + 2] += faceNormal.z
      }
    }
    
    // Normalize all vertex normals
    for (let i = 0; i < vertexCount; i++) {
      const nx = normals[i * 3]
      const ny = normals[i * 3 + 1]
      const nz = normals[i * 3 + 2]
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz)
      
      if (length > 0) {
        normals[i * 3] /= length
        normals[i * 3 + 1] /= length
        normals[i * 3 + 2] /= length
      }
    }
    
    return normals
  }
  
  /**
   * Smooth displacements to reduce spikes and artifacts
   */
  private smoothDisplacements(
    displacements: Float32Array,
    hasDisplacement: boolean[],
    originalPositions: Float32Array,
    vertexCount: number,
    radius: number,
    strength: number,
    preserveFeatures: boolean = false,
    lockedVertices: Set<number> = new Set(),
    smoothingMask?: boolean[]
  ): void {
    // Create a copy for reading original displacements
    const originalDisplacements = new Float32Array(displacements)
    
    // If preserving features, we need to compute vertex normals first
    let vertexNormals: Float32Array | null = null
    if (preserveFeatures) {
      vertexNormals = this.computeVertexNormals(originalPositions, vertexCount)
    }
    
    const angleThresholdRad = (30 * Math.PI) / 180 // Default to 30 degrees
    
    // For each vertex with displacement, smooth with nearby vertices
    for (let i = 0; i < vertexCount; i++) {
      if (!hasDisplacement[i]) continue // Only smooth vertices that have displacement
      
      // Skip edge vertices - they should not be smoothed
      if (lockedVertices.has(i)) {
        continue
      }
      
      // Skip vertices excluded from smoothing by mask
      if (smoothingMask && !smoothingMask[i]) {
        continue
      }
      
      // Get position of current vertex
      const posX = originalPositions[i * 3]
      const posY = originalPositions[i * 3 + 1]
      const posZ = originalPositions[i * 3 + 2]
      
      // Get displacement of current vertex
      const dispX = originalDisplacements[i * 3]
      const dispY = originalDisplacements[i * 3 + 1]
      const dispZ = originalDisplacements[i * 3 + 2]
      
      let totalWeight = 1.0 // Include self
      let avgDispX = dispX
      let avgDispY = dispY
      let avgDispZ = dispZ
      
      // Get normal for current vertex if preserving features
      let centerNormal: Vector3 | null = null
      if (preserveFeatures && vertexNormals) {
        centerNormal = new Vector3(
          vertexNormals[i * 3],
          vertexNormals[i * 3 + 1],
          vertexNormals[i * 3 + 2]
        )
      }
      
      // Check nearby vertices based on position
      for (let j = 0; j < vertexCount; j++) {
        if (i === j || !hasDisplacement[j]) continue
        
        // Skip edge vertices as neighbors - they don't contribute to smoothing
        if (lockedVertices.has(j)) continue
        
        // Calculate distance based on vertex positions
        const dx = originalPositions[j * 3] - posX
        const dy = originalPositions[j * 3 + 1] - posY
        const dz = originalPositions[j * 3 + 2] - posZ
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
        
        if (distance < radius && distance > 0) {
          // Check if we should include this vertex based on feature preservation
          let includeVertex = true
          
          if (preserveFeatures && centerNormal && vertexNormals) {
            const neighborNormal = new Vector3(
              vertexNormals[j * 3],
              vertexNormals[j * 3 + 1],
              vertexNormals[j * 3 + 2]
            )
            
            // Calculate angle between normals
            const dotProduct = centerNormal.dot(neighborNormal)
            const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)))
            
            // If angle is too large, these vertices are on different surfaces
            if (angle > angleThresholdRad) {
              includeVertex = false
            }
          }
          
          if (includeVertex) {
            // Gaussian weight based on spatial distance
            const weight = Math.exp(-(distance * distance) / (2 * radius * radius))
            
            // Accumulate neighbor's displacement weighted by distance
            avgDispX += originalDisplacements[j * 3] * weight
            avgDispY += originalDisplacements[j * 3 + 1] * weight
            avgDispZ += originalDisplacements[j * 3 + 2] * weight
            totalWeight += weight
          }
        }
      }
      
      // Apply smoothed displacement
      if (totalWeight > 0) {
        avgDispX /= totalWeight
        avgDispY /= totalWeight
        avgDispZ /= totalWeight
        
        // Blend between original and smoothed based on strength
        displacements[i * 3] = dispX * (1 - strength) + avgDispX * strength
        displacements[i * 3 + 1] = dispY * (1 - strength) + avgDispY * strength
        displacements[i * 3 + 2] = dispZ * (1 - strength) + avgDispZ * strength
      }
    }
  }
  
  /**
   * Calculate influence weights for vertices based on distance from locked edge vertices
   * Vertices near edges have reduced displacement to create smooth transitions
   */
  private calculateEdgeInfluence(
    vertexIndex: number,
    position: BufferAttribute,
    lockedVertices: Set<number>,
    influenceRadius: number
  ): number {
    if (lockedVertices.has(vertexIndex)) {
      return 0 // Locked vertices have 0 influence (no movement)
    }
    
    const vertex = new Vector3(
      position.getX(vertexIndex),
      position.getY(vertexIndex),
      position.getZ(vertexIndex)
    )
    
    let minDistance = Infinity
    
    // Find distance to nearest locked vertex
    for (const lockedIndex of lockedVertices) {
      const lockedVertex = new Vector3(
        position.getX(lockedIndex),
        position.getY(lockedIndex),
        position.getZ(lockedIndex)
      )
      
      const distance = vertex.distanceTo(lockedVertex)
      minDistance = Math.min(minDistance, distance)
    }
    
    // Calculate influence based on distance
    if (minDistance >= influenceRadius) {
      return 1.0 // Full displacement for vertices far from locked ones
    }
    
    // Smooth falloff using cosine interpolation
    const t = minDistance / influenceRadius
    const influence = 0.5 + 0.5 * Math.cos(Math.PI * (1 - t))
    
    return influence
  }
  
  /**
   * Build a map of vertex neighbors based on mesh connectivity
   */
  private buildNeighborMap(geometry: BufferGeometry): Map<number, Set<number>> {
    const neighbors = new Map<number, Set<number>>()
    const position = geometry.attributes.position as BufferAttribute
    const vertexCount = position.count
    
    // Initialize empty sets
    for (let i = 0; i < vertexCount; i++) {
      neighbors.set(i, new Set())
    }
    
    // If indexed geometry, use indices to find neighbors
    if (geometry.index) {
      const indices = geometry.index.array
      for (let i = 0; i < indices.length; i += 3) {
        const v0 = indices[i]
        const v1 = indices[i + 1]
        const v2 = indices[i + 2]
        
        // Each vertex in a triangle is neighbor to the other two
        neighbors.get(v0)!.add(v1)
        neighbors.get(v0)!.add(v2)
        neighbors.get(v1)!.add(v0)
        neighbors.get(v1)!.add(v2)
        neighbors.get(v2)!.add(v0)
        neighbors.get(v2)!.add(v1)
      }
    } else {
      // Non-indexed geometry - assume sequential triangles
      for (let i = 0; i < vertexCount; i += 3) {
        if (i + 2 < vertexCount) {
          neighbors.get(i)!.add(i + 1)
          neighbors.get(i)!.add(i + 2)
          neighbors.get(i + 1)!.add(i)
          neighbors.get(i + 1)!.add(i + 2)
          neighbors.get(i + 2)!.add(i)
          neighbors.get(i + 2)!.add(i + 1)
        }
      }
    }
    
    return neighbors
  }

  /**
   * Relax vertices on the target surface to maintain better distribution
   * This prevents bunching at edges and corners
   */
  private relaxOnSurface(
    positions: Float32Array,
    vertexCount: number,
    sourceMesh: Mesh,
    targetMesh: Mesh,
    isBox: boolean,
    iterations: number = 3,
    strength: number = 0.5
  ): void {
    const worldBox = isBox ? new Box3().setFromObject(targetMesh) : null
    const geometry = sourceMesh.geometry as BufferGeometry
    
    // Build proper neighbor map from mesh connectivity
    const neighbors = this.buildNeighborMap(geometry)
    
    for (let iter = 0; iter < iterations; iter++) {
      const newPositions = new Float32Array(positions)

      // Relax each vertex
      for (let i = 0; i < vertexCount; i++) {
        const vertex = new Vector3(
          positions[i * 3],
          positions[i * 3 + 1],
          positions[i * 3 + 2]
        )
        
        // Transform to world space
        vertex.applyMatrix4(sourceMesh.matrixWorld)
        
        // Calculate centroid of neighbors
        const neighborSet = neighbors.get(i) || new Set<number>()
        if (neighborSet.size === 0) continue
        
        const centroid = new Vector3(0, 0, 0)
        let count = 0
        
        for (const j of neighborSet) {
          const neighborPos = new Vector3(
            positions[j * 3],
            positions[j * 3 + 1],
            positions[j * 3 + 2]
          )
          neighborPos.applyMatrix4(sourceMesh.matrixWorld)
          centroid.add(neighborPos)
          count++
        }
        
        if (count > 0) {
          centroid.divideScalar(count)
          
          // Move vertex toward centroid
          const relaxedPos = vertex.clone().lerp(centroid, strength)
          
          // Project back onto target surface
          if (isBox && worldBox) {
            // For box, find closest face and project
            const projected = this.projectPointToBoxSurface(relaxedPos, worldBox)
            relaxedPos.copy(projected)
          } else {
            // For other shapes, use ray projection
            const toCenter = targetMesh.position.clone().sub(relaxedPos).normalize()
            this.raycaster.set(relaxedPos, toCenter)
            const hits = this.raycaster.intersectObject(targetMesh, false)
            if (hits.length > 0) {
              relaxedPos.copy(hits[0].point)
            }
          }
          
          // Transform back to local space
          const inverseMatrix = sourceMesh.matrixWorld.clone().invert()
          relaxedPos.applyMatrix4(inverseMatrix)
          
          // Update position
          newPositions[i * 3] = relaxedPos.x
          newPositions[i * 3 + 1] = relaxedPos.y
          newPositions[i * 3 + 2] = relaxedPos.z
        }
      }
      
      // Copy relaxed positions back
      positions.set(newPositions)
    }
  }
  
  /**
   * Project a point onto the surface of a box
   */
  private projectPointToBoxSurface(point: Vector3, box: Box3): Vector3 {
    const center = box.getCenter(new Vector3())
    const size = box.getSize(new Vector3())
    const halfSize = size.multiplyScalar(0.5)
    
    // Find which face is closest
    const relativePos = point.clone().sub(center)
    
    // Calculate distance to each face
    const distances = [
      Math.abs(halfSize.x - Math.abs(relativePos.x)),
      Math.abs(halfSize.y - Math.abs(relativePos.y)),
      Math.abs(halfSize.z - Math.abs(relativePos.z))
    ]
    
    // Find minimum distance axis
    const minIndex = distances.indexOf(Math.min(...distances))
    
    // Project to that face
    const projected = point.clone()
    if (minIndex === 0) {
      // Project to X face
      projected.x = center.x + (relativePos.x > 0 ? halfSize.x : -halfSize.x)
    } else if (minIndex === 1) {
      // Project to Y face
      projected.y = center.y + (relativePos.y > 0 ? halfSize.y : -halfSize.y)
    } else {
      // Project to Z face
      projected.z = center.z + (relativePos.z > 0 ? halfSize.z : -halfSize.z)
    }
    
    return projected
  }
  
  /**
   * Reset mesh to original geometry
   */
  resetMesh(mesh: Mesh, originalPositions: Float32Array): void {
    const positions = mesh.geometry.attributes.position
    positions.array.set(originalPositions)
    positions.needsUpdate = true
    mesh.geometry.computeBoundingBox()
    mesh.geometry.computeBoundingSphere()
  }
  
  /**
   * Detect armor vertices that are intersecting with avatar's neck and arm regions
   * These vertices should be locked during shrinkwrap to preserve openings
   */
  private detectIntersectingVertices(
    armorMesh: Mesh,
    skeleton: Skeleton
  ): Set<number> {
    console.log('🔍 Detecting armor vertices intersecting with neck and arms...')
    
    const lockedVertices = new Set<number>()
    const armorGeometry = armorMesh.geometry as BufferGeometry
    const position = armorGeometry.attributes.position as BufferAttribute
    
    // Find neck and arm bones
    const neckBones: Bone[] = []
    const leftArmBones: Bone[] = []
    const rightArmBones: Bone[] = []
    
    skeleton.bones.forEach(bone => {
      const boneName = bone.name.toLowerCase()
      
      // Neck bones
      if (boneName.includes('neck') || boneName.includes('head')) {
        neckBones.push(bone)
      }
      
      // Arm bones - be specific to avoid confusion with armor
      if (boneName.includes('arm') || boneName.includes('shoulder') || 
          boneName.includes('clavicle') || boneName.includes('upperarm') ||
          boneName.includes('forearm') || boneName.includes('hand')) {
        if (boneName.includes('left') || boneName.includes('l_')) {
          leftArmBones.push(bone)
        } else if (boneName.includes('right') || boneName.includes('r_')) {
          rightArmBones.push(bone)
        }
      }
    })
    
    console.log(`Found ${neckBones.length} neck bones, ${leftArmBones.length} left arm bones, ${rightArmBones.length} right arm bones`)
    
    // Create influence volumes around these bones
    const createBoneVolume = (bones: Bone[], radius: number): Box3 | null => {
      if (bones.length === 0) return null
      
      const box = new Box3()
      bones.forEach(bone => {
        const bonePos = new Vector3()
        bone.getWorldPosition(bonePos)
        
        // Expand box by radius around bone position
        box.expandByPoint(bonePos.clone().add(new Vector3(radius, radius, radius)))
        box.expandByPoint(bonePos.clone().sub(new Vector3(radius, radius, radius)))
      })
      
      return box
    }
    
    // Create volumes with appropriate radii
    const neckVolume = createBoneVolume(neckBones, 0.08) // 8cm radius for neck
    const leftArmVolume = createBoneVolume(leftArmBones, 0.10) // 10cm radius for arms
    const rightArmVolume = createBoneVolume(rightArmBones, 0.10)
    
    // Check each armor vertex
    for (let i = 0; i < position.count; i++) {
      const vertex = new Vector3(
        position.getX(i),
        position.getY(i),
        position.getZ(i)
      )
      
      // Transform to world space
      vertex.applyMatrix4(armorMesh.matrixWorld)
      
      // Check if vertex is within any of the volumes
      let isIntersecting = false
      
      if (neckVolume && neckVolume.containsPoint(vertex)) {
        isIntersecting = true
      } else if (leftArmVolume && leftArmVolume.containsPoint(vertex)) {
        isIntersecting = true
      } else if (rightArmVolume && rightArmVolume.containsPoint(vertex)) {
        isIntersecting = true
      }
      
      if (isIntersecting) {
        lockedVertices.add(i)
      }
    }
    
    console.log(`🔒 Locked ${lockedVertices.size} vertices that intersect with neck/arm regions`)
    
    // Also add vertices that are very close to locked vertices to create smooth transitions
    const additionalLocked = new Set<number>()
    const transitionRadius = 0.05 // 5cm transition zone
    
    for (let i = 0; i < position.count; i++) {
      if (lockedVertices.has(i)) continue
      
      const vertex = new Vector3(
        position.getX(i),
        position.getY(i),
        position.getZ(i)
      )
      
      // Check distance to locked vertices
      let nearLocked = false
      for (const lockedIdx of lockedVertices) {
        const lockedVertex = new Vector3(
          position.getX(lockedIdx),
          position.getY(lockedIdx),
          position.getZ(lockedIdx)
        )
        
        if (vertex.distanceTo(lockedVertex) < transitionRadius) {
          nearLocked = true
          break
        }
      }
      
      if (nearLocked) {
        additionalLocked.add(i)
      }
    }
    
    // Add transition vertices to locked set
    additionalLocked.forEach(idx => lockedVertices.add(idx))
    
    console.log(`🔒 Total locked vertices (including transitions): ${lockedVertices.size}`)
    
    return lockedVertices
  }
  
  /**
   * Helmet Fitting Methods
   */
  
  detectHeadRegion(avatarMesh: SkinnedMesh): {
    headBone: Bone | null
    headBounds: Box3
    headCenter: Vector3
    headOrientation: Quaternion
  } {
    console.log('=== COMPREHENSIVE HEAD DETECTION ===')
    
    // Update matrices first
    avatarMesh.updateMatrixWorld(true)
    
    // Get model bounds
    const modelBounds = new Box3().setFromObject(avatarMesh)
    const modelHeight = modelBounds.max.y - modelBounds.min.y
    const modelTop = modelBounds.max.y
    console.log('Model height:', modelHeight, 'Model Y range:', modelBounds.min.y, 'to', modelBounds.max.y)
    
    // Find head and neck bones
    let headBone: Bone | null = null
    let neckBone: Bone | null = null
    const headBoneNames = ['Head', 'head', 'Bip01_Head', 'mixamorig:Head']
    const neckBoneNames = ['Neck', 'neck', 'Bip01_Neck', 'mixamorig:Neck', 'Spine2', 'spine2']
    
    if (avatarMesh.skeleton && avatarMesh.skeleton.bones) {
      // Find head bone
      for (const boneName of headBoneNames) {
        const bone = avatarMesh.skeleton.bones.find(b => b.name === boneName)
        if (bone) {
          headBone = bone as Bone
          break
        }
      }
      
      // Find neck bone
      for (const boneName of neckBoneNames) {
        const bone = avatarMesh.skeleton.bones.find(b => b.name === boneName)
        if (bone) {
          neckBone = bone as Bone
          break
        }
      }
    }
    
    console.log('Head bone:', headBone ? (headBone as Bone).name : 'not found')
    console.log('Neck bone:', neckBone ? (neckBone as Bone).name : 'not found')
    
    // Get bone positions
    let headBonePos: Vector3 | null = null
    let neckBonePos: Vector3 | null = null
    
    if (headBone) {
      headBonePos = new Vector3()
      ;(headBone as Bone).getWorldPosition(headBonePos)
      console.log('Head bone position:', headBonePos)
    }
    
    if (neckBone) {
      neckBonePos = new Vector3()
      ;(neckBone as Bone).getWorldPosition(neckBonePos)
      console.log('Neck bone position:', neckBonePos)
    }
    
    // Initialize bounds
    const headBounds = new Box3()
    const headCenter = new Vector3()
    const headOrientation = new Quaternion()
    
    // DETECT ALL HEAD VERTICES
    const positions = avatarMesh.geometry.attributes.position
    const vertexCount = positions.count
    const headVertices: Vector3[] = []
    const tempVertex = new Vector3()
    
    // Determine neck/shoulder cutoff Y position
    let neckCutoffY: number
    if (neckBonePos) {
      // Use neck bone position as cutoff
      neckCutoffY = neckBonePos.y
      console.log('Using neck bone for cutoff at Y:', neckCutoffY)
    } else if (headBonePos) {
      // Estimate based on head bone - neck is typically 10-15% of model height below head
      neckCutoffY = headBonePos.y - (modelHeight * 0.12)
      console.log('Estimating neck from head bone at Y:', neckCutoffY)
    } else {
      // No bones - use top 25% of model
      neckCutoffY = modelTop - (modelHeight * 0.25)
      console.log('No bones - using top 25% cutoff at Y:', neckCutoffY)
    }
    
    // COLLECT ALL VERTICES ABOVE NECK/SHOULDER LINE
    console.log('Collecting ALL vertices above Y:', neckCutoffY)
    let verticesCollected = 0
    
    for (let i = 0; i < vertexCount; i++) {
      tempVertex.fromBufferAttribute(positions, i)
      tempVertex.applyMatrix4(avatarMesh.matrixWorld)
      
      // Include ALL vertices above the neck cutoff
      if (tempVertex.y >= neckCutoffY) {
        headVertices.push(tempVertex.clone())
        verticesCollected++
      }
    }
    
    console.log('Found', verticesCollected, 'head vertices above neck/shoulder line')
    
    // Calculate bounding box from ALL head vertices
    if (headVertices.length > 0) {
      headBounds.setFromPoints(headVertices)
      console.log('Raw head bounds from ALL vertices:', headBounds.min, 'to', headBounds.max)
      
      // Ensure bottom is at neck cutoff
      if (headBounds.min.y > neckCutoffY) {
        headBounds.min.y = neckCutoffY
        console.log('Extended bottom to neck cutoff')
      }
    } else {
      // Fallback if no vertices found
      console.warn('No head vertices found! Using estimation')
      const estimatedSize = modelHeight * 0.15
      const estimatedCenterY = modelTop - estimatedSize/2
      
      headBounds.setFromCenterAndSize(
        new Vector3(0, estimatedCenterY, 0),
        new Vector3(estimatedSize, estimatedSize, estimatedSize)
      )
      headBounds.min.y = neckCutoffY
    }
    
    // Get size before expansion
    const preExpandSize = headBounds.getSize(new Vector3())
    console.log('Head size before expansion:', preExpandSize)
    
    // RAISE THE BOTTOM 20% HIGHER OFF SHOULDERS
    const raiseAmount = preExpandSize.y * 0.2  // 20% raise
    headBounds.min.y += raiseAmount
    console.log('Raised bottom by', raiseAmount, 'units (20% of height above shoulders)')
    
    // EXPAND BY 15% ON ALL SIDES - FRONT, BACK, LEFT, RIGHT, TOP, BOTTOM
    const expansionFactor = 0.15 // 15% larger
    
    const expandX = preExpandSize.x * expansionFactor
    const expandY = preExpandSize.y * expansionFactor
    const expandZ = preExpandSize.z * expansionFactor
    
    // Expand equally in all directions
    headBounds.min.x -= expandX
    headBounds.max.x += expandX
    headBounds.min.y -= expandY  // Expand bottom
    headBounds.max.y += expandY  // Expand top
    headBounds.min.z -= expandZ  // Expand back
    headBounds.max.z += expandZ  // Expand front
    
    // Update center
    headCenter.copy(headBounds.getCenter(new Vector3()))
    
    // Get orientation from head bone if available
    if (headBone) {
      (headBone as Bone).getWorldQuaternion(headOrientation)
    }
    
    // Final size and stats
    const finalSize = headBounds.getSize(new Vector3())
    const expansionAmount = {
      x: ((finalSize.x / preExpandSize.x - 1) * 100).toFixed(1),
      y: ((finalSize.y / preExpandSize.y - 1) * 100).toFixed(1),
      z: ((finalSize.z / preExpandSize.z - 1) * 100).toFixed(1)
    }
    
    console.log('=== FINAL HEAD BOUNDS ===')
    console.log('Bounds:', headBounds.min, 'to', headBounds.max)
    console.log('Center:', headCenter)
    console.log('Size:', finalSize)
    console.log('Expansion: +' + expansionAmount.x + '% width, +' + expansionAmount.y + '% height, +' + expansionAmount.z + '% depth')
    console.log('Bottom raised 20% above neck/shoulders')
    console.log('Bottom Y position:', headBounds.min.y, '(was at', neckCutoffY, ')')
    console.log('Percentage of model height:', (finalSize.y / modelHeight * 100).toFixed(1) + '%')
    console.log('========================')
    
    return {
      headBone,
      headBounds,
      headCenter,
      headOrientation
    }
  }
  
  async fitHelmetToHead(
    helmetMesh: Mesh,
    avatarMesh: SkinnedMesh,
    parameters: {
      method?: 'auto' | 'manual'
      sizeMultiplier?: number
      fitTightness?: number // 0.7-1.0, how tight the fit is (default 0.85)
      verticalOffset?: number
      forwardOffset?: number
      rotation?: Euler
      attachToHead?: boolean
      showHeadBounds?: boolean
      showCollisionDebug?: boolean
      onProgress?: (progress: number, message?: string) => void
    } = {}
  ): Promise<{
    finalTransform: {
      position: Vector3
      rotation: Euler
      scale: number
    }
    headInfo: {
      headBone: Bone | null
      headBounds: Box3
      headCenter: Vector3
    }
    collisionInfo: {
      hasCollision: boolean
      penetrationDepth: number
    }
  }> {
    const {
      method = 'auto',
      sizeMultiplier = 1.0,
      fitTightness = 0.85,
      verticalOffset = 0,
      forwardOffset = 0,
      rotation = new Euler(0, 0, 0),
      onProgress
    } = parameters
    
    // Detect head region
    if (onProgress) onProgress(0.1, 'Detecting head region...')
    const headInfo = this.detectHeadRegion(avatarMesh)
    
    if (method === 'auto') {
      // Calculate optimal helmet transform
      if (onProgress) onProgress(0.3, 'Calculating optimal position...')
      
      console.log('Helmet fitting - before transform:')
      console.log('- Helmet scale:', helmetMesh.scale.x, helmetMesh.scale.y, helmetMesh.scale.z)
      console.log('- Head bounds:', headInfo.headBounds)
      
      const optimalTransform = this.calculateOptimalHelmetTransform(
        helmetMesh,
        headInfo,
        sizeMultiplier,
        fitTightness
      )
      
      console.log('Helmet fitting - calculated transform:')
      console.log('- Position:', optimalTransform.position)
      console.log('- Scale:', optimalTransform.scale)
      
      // Apply transform
      helmetMesh.position.copy(optimalTransform.position)
      helmetMesh.rotation.copy(optimalTransform.rotation)
      helmetMesh.scale.setScalar(optimalTransform.scale)
      
      console.log('Helmet fitting - after transform:')
      console.log('- Final helmet scale:', helmetMesh.scale.x)
      
      // Fine-tune position to avoid penetration
      if (onProgress) onProgress(0.6, 'Fine-tuning position...')
      const collisionInfo = this.adjustHelmetForCollisions(
        helmetMesh,
        avatarMesh,
        headInfo
      )
      
      if (onProgress) onProgress(1.0, 'Helmet fitting complete')
      
      return {
        finalTransform: {
          position: helmetMesh.position.clone(),
          rotation: helmetMesh.rotation.clone(),
          scale: helmetMesh.scale.x
        },
        headInfo: {
          headBone: headInfo.headBone,
          headBounds: headInfo.headBounds,
          headCenter: headInfo.headCenter
        },
        collisionInfo
      }
    } else {
      // Manual mode - just apply user-specified transforms
      const helmetBounds = new Box3().setFromObject(helmetMesh)
      const helmetSize = helmetBounds.getSize(new Vector3())
      
      // Position helmet at head center with offsets
      helmetMesh.position.copy(headInfo.headCenter)
      helmetMesh.position.y += verticalOffset + helmetSize.y * 0.5
      helmetMesh.position.z += forwardOffset
      
      // Apply rotation
      helmetMesh.rotation.copy(rotation)
      
      // Apply scale
      helmetMesh.scale.setScalar(sizeMultiplier)
      
      // Check for collisions
      const collisionInfo = this.checkHelmetCollisions(helmetMesh, avatarMesh)
      
      return {
        finalTransform: {
          position: helmetMesh.position.clone(),
          rotation: helmetMesh.rotation.clone(),
          scale: helmetMesh.scale.x
        },
        headInfo: {
          headBone: headInfo.headBone,
          headBounds: headInfo.headBounds,
          headCenter: headInfo.headCenter
        },
        collisionInfo
      }
    }
  }
  
  private calculateOptimalHelmetTransform(
    helmetMesh: Mesh,
    headInfo: ReturnType<typeof this.detectHeadRegion>,
    sizeMultiplier: number,
    fitTightness: number = 0.85
  ): {
    position: Vector3
    rotation: Euler
    scale: number
  } {
    // DEAD SIMPLE APPROACH - HELMET BOUNDS MUST CONTAIN HEAD BOUNDS
    
    // Store original state
//     const _originalMatrix = helmetMesh.matrix.clone()
    const originalPosition = helmetMesh.position.clone()
    const originalScale = helmetMesh.scale.clone()
    const originalRotation = helmetMesh.rotation.clone()
    const parentScale = helmetMesh.parent ? helmetMesh.parent.scale.x : 1
    
    // Temporarily remove from parent to get clean bounds
    const tempParent = helmetMesh.parent
    if (tempParent) {
      tempParent.remove(helmetMesh)
    }
    
    // Reset helmet to get clean bounds
    helmetMesh.position.set(0, 0, 0)
    helmetMesh.scale.set(1, 1, 1) 
    helmetMesh.rotation.set(0, 0, 0)
    helmetMesh.updateMatrixWorld(true)
    
    // Get helmet size at scale 1
    const helmetBounds = new Box3().setFromObject(helmetMesh)
    const helmetSize = helmetBounds.getSize(new Vector3())
    
    // Restore parent
    if (tempParent) {
      tempParent.add(helmetMesh)
    }
    
    // Restore original transform
    helmetMesh.position.copy(originalPosition)
    helmetMesh.scale.copy(originalScale)
    helmetMesh.rotation.copy(originalRotation)
    
    // GET HEAD BOUNDS
    const headBounds = headInfo.headBounds
    const headSize = headBounds.getSize(new Vector3())
    const headCenter = headInfo.headCenter
    
    // HELMET MUST BE OUTSIDE THE BOUNDING BOX
    // The head bounds represent the outer limits of the head
    // The helmet's INNER surface must be at least as big as these bounds
    
    // Calculate scale so helmet's INNER surface wraps around head bounds
    // Assume helmet has ~10% wall thickness (inner is 90% of outer)
    const helmetWallFactor = 0.9 // Inner surface is 90% of outer
    
    // Calculate required scale for helmet's OUTER surface
    // so that its INNER surface contains the head bounds
    const scaleX = headSize.x / (helmetSize.x * helmetWallFactor)
    const scaleY = headSize.y / (helmetSize.y * helmetWallFactor)  
    const scaleZ = headSize.z / (helmetSize.z * helmetWallFactor)
    
    // Use the LARGEST scale to ensure head fits in ALL dimensions
    let baseScale = Math.max(scaleX, scaleY, scaleZ)
    
    // Add small safety margin
    const safetyMargin = 1.02 // 2% extra to ensure no penetration
    baseScale *= safetyMargin
    
    // Apply user adjustments
    let finalScale = baseScale * sizeMultiplier * fitTightness
    
    // Account for parent scale
    if (parentScale > 0) {
      finalScale /= parentScale
    }
    
    // CRITICAL: Helmet must always be OUTSIDE the head bounds
    // This means the helmet's INNER surface must contain the bounds
    const absoluteMinScale = Math.max(
      headSize.x / (helmetSize.x * 0.9) * 1.01,  // Inner must be 1% bigger than bounds
      headSize.y / (helmetSize.y * 0.9) * 1.01,
      headSize.z / (helmetSize.z * 0.9) * 1.01
    )
    
    if (finalScale < absoluteMinScale) {
      console.warn(`Scale ${finalScale} would make helmet smaller than head! Using ${absoluteMinScale}`)
      finalScale = absoluteMinScale
    }
    
    console.log('Base scale (with wall thickness):', baseScale)
    console.log('Absolute minimum scale:', absoluteMinScale)
    console.log('Final scale:', finalScale)
    
    // Calculate what the final helmet size will be
    const finalHelmetSize = helmetSize.clone().multiplyScalar(finalScale)
    
    // Set position to head center
    const position = headCenter.clone()
    
    // No offset needed - the margins ensure proper wrap-around
    
    console.log('=== HELMET FITTING - OVER THE BOUNDING BOX ===')
    console.log('Head bounds (15% expanded, 20% raised):', headBounds.min, 'to', headBounds.max)
    console.log('Head size:', headSize)
    console.log('Helmet original size:', helmetSize)
    console.log('Helmet inner size (90%):', helmetSize.clone().multiplyScalar(helmetWallFactor))
    console.log('')
    console.log('Scale calculation (helmet OVER bounds):')
    console.log('  - Head bounds already include 15% expansion on all sides')
    console.log('  - Bottom raised 20% above neck/shoulders')
    console.log('  - Helmet inner surface must be >= head bounds')
    console.log('  - Scale X:', scaleX.toFixed(3), '= head', headSize.x.toFixed(2), '/ (helmet', helmetSize.x.toFixed(2), '* 0.9)')
    console.log('  - Scale Y:', scaleY.toFixed(3), '= head', headSize.y.toFixed(2), '/ (helmet', helmetSize.y.toFixed(2), '* 0.9)')
    console.log('  - Scale Z:', scaleZ.toFixed(3), '= head', headSize.z.toFixed(2), '/ (helmet', helmetSize.z.toFixed(2), '* 0.9)')
    console.log('  - Max scale required:', Math.max(scaleX, scaleY, scaleZ).toFixed(3))
    console.log('  - Safety margin: 2%')
    console.log('  - Base scale:', baseScale.toFixed(3))
    console.log('  - User multiplier:', sizeMultiplier)
    console.log('  - Final scale:', finalScale.toFixed(3))
    console.log('')
    console.log('Resulting helmet outer size:', finalHelmetSize)
    console.log('Resulting helmet inner size:', finalHelmetSize.clone().multiplyScalar(0.9))
    console.log('  => Helmet scaled to', (finalScale * 100).toFixed(0), '% of original size')
    console.log('Size comparison (bounds vs helmet outer):')
    console.log('  - Head X:', headSize.x.toFixed(3), ' -> Helmet outer X:', finalHelmetSize.x.toFixed(3))
    console.log('  - Head Y:', headSize.y.toFixed(3), ' -> Helmet outer Y:', finalHelmetSize.y.toFixed(3))
    console.log('  - Head Z:', headSize.z.toFixed(3), ' -> Helmet outer Z:', finalHelmetSize.z.toFixed(3))
    console.log('Helmet inner surface vs head bounds:')
    const innerSize = finalHelmetSize.clone().multiplyScalar(0.9)
    console.log('  - Inner is', ((innerSize.x / headSize.x - 1) * 100).toFixed(1), '% larger than head X')
    console.log('  - Inner is', ((innerSize.y / headSize.y - 1) * 100).toFixed(1), '% larger than head Y')
    console.log('  - Inner is', ((innerSize.z / headSize.z - 1) * 100).toFixed(1), '% larger than head Z')
    
    if (finalHelmetSize.x < headSize.x || finalHelmetSize.y < headSize.y || finalHelmetSize.z < headSize.z) {
      console.error('ERROR: Helmet is SMALLER than head in at least one dimension!')
    } else {
      console.log('✓ Helmet is bigger than head in all dimensions')
    }
    
    // VERIFY: Ensure helmet is OUTSIDE the head bounds
    helmetMesh.scale.set(finalScale, finalScale, finalScale)
    helmetMesh.position.copy(position)
    helmetMesh.updateMatrixWorld(true)
    
    const testHelmetBounds = new Box3().setFromObject(helmetMesh)
    
    // Check if helmet's INNER surface contains head bounds
    // Shrink helmet bounds by 10% to get approximate inner surface
    const testInnerBounds = new Box3()
    const testHelmetCenter = testHelmetBounds.getCenter(new Vector3())
    const testHelmetSize = testHelmetBounds.getSize(new Vector3())
    testInnerBounds.setFromCenterAndSize(
      testHelmetCenter,
      testHelmetSize.clone().multiplyScalar(0.9)
    )
    
    const isContained = testInnerBounds.containsBox(headBounds)
    
    // Restore helmet transform
    helmetMesh.position.copy(originalPosition)
    helmetMesh.scale.copy(originalScale)
    helmetMesh.rotation.copy(originalRotation)
    
    console.log('================================')
    console.log('VERIFICATION - HELMET OVER BOUNDING BOX:')
    console.log('  - Head bounds (15% expanded, 20% raised):', headBounds.min, 'to', headBounds.max)
    console.log('  - Helmet outer bounds:', testHelmetBounds.min, 'to', testHelmetBounds.max)
    console.log('  - Helmet inner bounds (90%):', testInnerBounds.min, 'to', testInnerBounds.max)
    console.log('  - Inner surface >= head bounds?', isContained ? '✓ YES - HELMET IS OVER THE BOX' : '❌ NO - HELMET TOO SMALL')
    
    if (!isContained) {
      console.error('WARNING: Helmet inner surface does not contain head bounds!')
      
      // Calculate how much bigger the helmet needs to be
      const innerSize = testHelmetSize.clone().multiplyScalar(0.9)
      const neededScaleX = headSize.x / innerSize.x
      const neededScaleY = headSize.y / innerSize.y
      const neededScaleZ = headSize.z / innerSize.z
      const neededMultiplier = Math.max(neededScaleX, neededScaleY, neededScaleZ) * 1.02
      
      console.log('  - Current helmet scale:', finalScale)
      console.log('  - Needs to be', (neededMultiplier * 100).toFixed(1), '% bigger')
      console.log('  - Suggested scale:', finalScale * neededMultiplier)
    }
    
    console.log('================================')
    console.log('FINAL RESULT:')
    console.log('  - Position:', position)
    console.log('  - Scale:', finalScale)
    console.log('  - Head bounds size:', headSize.x.toFixed(2), 'x', headSize.y.toFixed(2), 'x', headSize.z.toFixed(2))
    console.log('  - Helmet outer size:', finalHelmetSize.x.toFixed(2), 'x', finalHelmetSize.y.toFixed(2), 'x', finalHelmetSize.z.toFixed(2))
    console.log('  - Helmet inner size:', innerSize.x.toFixed(2), 'x', innerSize.y.toFixed(2), 'x', innerSize.z.toFixed(2))
    console.log('  - Clearance (inner - head):')
    console.log('    X:', (innerSize.x - headSize.x).toFixed(3), 'units')
    console.log('    Y:', (innerSize.y - headSize.y).toFixed(3), 'units')
    console.log('    Z:', (innerSize.z - headSize.z).toFixed(3), 'units')
    console.log('================================')
    
    const rotation = new Euler(0, 0, 0)
    
    return { position, rotation, scale: finalScale }
  }
  
  private adjustHelmetForCollisions(
    helmetMesh: Mesh,
    avatarMesh: SkinnedMesh,
    headInfo: ReturnType<typeof this.detectHeadRegion>
  ): {
    hasCollision: boolean
    penetrationDepth: number
  } {
    let hasCollision = false
    let maxPenetration = 0
    
    // Sample points on helmet surface
    const helmetGeometry = helmetMesh.geometry
    const positions = helmetGeometry.attributes.position
    const sampleRate = 0.1 // Sample 10% of vertices
    const sampleCount = Math.floor(positions.count * sampleRate)
    
    for (let i = 0; i < sampleCount; i++) {
      const idx = Math.floor(Math.random() * positions.count)
      const vertex = new Vector3().fromBufferAttribute(positions, idx)
      vertex.applyMatrix4(helmetMesh.matrixWorld)
      
      // Cast ray toward head center
      const direction = headInfo.headCenter.clone().sub(vertex).normalize()
      this.raycaster.set(vertex, direction)
      
      const intersects = this.raycaster.intersectObject(avatarMesh, true)
      if (intersects.length > 0) {
        const penetration = intersects[0].distance
        if (penetration < 0.01) { // Very close or penetrating
          hasCollision = true
          maxPenetration = Math.max(maxPenetration, 0.01 - penetration)
        }
      }
    }
    
    // If collision detected, move helmet up slightly
    if (hasCollision) {
      helmetMesh.position.y += maxPenetration + 0.005 // Add small buffer
    }
    
    return {
      hasCollision,
      penetrationDepth: maxPenetration
    }
  }
  
  private checkHelmetCollisions(
    helmetMesh: Mesh,
    avatarMesh: SkinnedMesh
  ): {
    hasCollision: boolean
    penetrationDepth: number
  } {
    // Similar to adjustHelmetForCollisions but without adjustment
    let hasCollision = false
    let maxPenetration = 0
    
    const helmetBounds = new Box3().setFromObject(helmetMesh)
    const helmetCenter = helmetBounds.getCenter(new Vector3())
    
    // Quick bounds check first
    const avatarBounds = new Box3().setFromObject(avatarMesh)
    if (!helmetBounds.intersectsBox(avatarBounds)) {
      return { hasCollision: false, penetrationDepth: 0 }
    }
    
    // Detailed vertex check
    const positions = helmetMesh.geometry.attributes.position
    const sampleRate = 0.05
    const sampleCount = Math.floor(positions.count * sampleRate)
    
    for (let i = 0; i < sampleCount; i++) {
      const idx = Math.floor(Math.random() * positions.count)
      const vertex = new Vector3().fromBufferAttribute(positions, idx)
      vertex.applyMatrix4(helmetMesh.matrixWorld)
      
      // Check if point is inside avatar mesh
      if (this.isPointInsideMesh(vertex, avatarMesh)) {
        hasCollision = true
        const distance = vertex.distanceTo(helmetCenter)
        maxPenetration = Math.max(maxPenetration, distance * 0.1) // Estimate
      }
    }
    
    return {
      hasCollision,
      penetrationDepth: maxPenetration
    }
  }
}

export default MeshFittingService 