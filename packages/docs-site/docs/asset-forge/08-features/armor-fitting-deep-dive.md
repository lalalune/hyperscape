# Armor Fitting Deep Dive

## Overview

Armor fitting is the automated process of deforming rigid armor meshes to conform to character body shapes while preserving important features like edges, openings, and surface details. Using advanced mesh deformation algorithms, weight transfer techniques, and bone diagnostics, the Asset Forge armor fitting system transforms generic armor pieces into character-specific fitted equipment.

This deep dive explores the complete armor fitting pipeline from body region detection to final weight assignment.

## Table of Contents

- [System Architecture](#system-architecture)
- [ArmorFittingService Orchestration](#armorfittingservice-orchestration)
- [Body Region Detection](#body-region-detection)
- [MeshFittingService](#meshfittingservice)
- [Shrinkwrap Algorithm](#shrinkwrap-algorithm)
- [Laplacian Smoothing](#laplacian-smoothing)
- [Feature Preservation](#feature-preservation)
- [WeightTransferService](#weighttransferservice)
- [ArmorScaleFixer](#armorscalefixer)
- [BoneDiagnostics](#bonediagnostics)
- [Debug Visualization](#debug-visualization)

## System Architecture

The armor fitting system consists of interconnected services:

```
┌──────────────────────────────────────────┐
│   ArmorFittingService (Orchestrator)     │
└──────────┬───────────────────────────────┘
           │
     ┌─────┼──────┬──────────┬─────────┐
     │     │      │          │         │
     ▼     ▼      ▼          ▼         ▼
┌───────┐ ┌──────┐ ┌────────┐ ┌──────┐ ┌──────┐
│Body   │ │Mesh  │ │Weight  │ │Armor │ │Bone  │
│Region │ │Fitting│ │Transfer│ │Scale │ │Diag  │
│Compute│ │Service│ │Service │ │Fixer │ │nostic│
└───────┘ └──────┘ └────────┘ └──────┘ └──────┘
```

### Component Responsibilities

**ArmorFittingService**
- Orchestrates the entire fitting process
- Computes body regions from skeleton
- Handles initial positioning and scaling
- Manages the fitting pipeline
- Exports final result

**MeshFittingService**
- Implements shrinkwrap algorithm
- Performs iterative vertex movement
- Handles Laplacian smoothing
- Preserves features during deformation
- Detects and preserves openings

**WeightTransferService**
- Transfers weights from body to armor
- Supports three methods: nearest, projected, inpainted
- Smooths and normalizes weights
- Builds vertex neighbor topology

**ArmorScaleFixer**
- Detects scale issues in skeletons
- Bakes scale into bone positions
- Normalizes bone hierarchies
- Prevents export scale problems

**BoneDiagnostics**
- Analyzes skeleton structure
- Validates bone transforms
- Compares skeletons
- Tests GLTF export compatibility

## ArmorFittingService Orchestration

The `ArmorFittingService` coordinates all aspects of armor fitting through a multi-step pipeline.

### High-Level Pipeline

```
1. Compute Body Regions
   └─> Identify torso, arms, legs, head regions from skeleton

2. Initial Position & Scale
   ├─> Align armor to target region
   ├─> Scale to match region size
   └─> Position at region center

3. Mesh Deformation
   ├─> Run shrinkwrap algorithm
   ├─> Preserve features and openings
   └─> Apply smoothing

4. Weight Transfer
   ├─> Transfer weights from body mesh
   ├─> Smooth weight assignments
   └─> Normalize final weights

5. Scale Fixing
   ├─> Check for scale issues
   ├─> Bake transforms if needed
   └─> Validate skeleton

6. Export
   └─> Save fitted armor as GLB
```

### Fitting Configuration

```typescript
export interface FittingConfig {
  method: 'boundingBox' | 'collision' | 'smooth' | 'iterative' | 'hull' | 'shrinkwrap'
  margin?: number                 // Distance from body (cm)
  smoothingIterations?: number    // Smoothing passes
  preserveDetails?: boolean       // Keep surface features

  // Shrinkwrap-specific
  iterations?: number             // Deformation iterations
  stepSize?: number               // Movement per iteration (0-1)
  smoothingRadius?: number        // Smoothing kernel radius
  smoothingStrength?: number      // Smoothing amount (0-1)
  targetOffset?: number           // Offset from surface
  sampleRate?: number             // Vertex sampling rate (0-1)
  preserveFeatures?: boolean      // Edge/corner preservation
  featureAngleThreshold?: number  // Feature detection angle
  useImprovedShrinkwrap?: boolean // Advanced algorithm
  preserveOpenings?: boolean      // Keep arm/neck holes
  pushInteriorVertices?: boolean  // Expand interior verts
}
```

### Example Usage

```typescript
const fittingService = new ArmorFittingService()

// Fit armor to character
const result = await fittingService.fitArmorToBody({
  armorMesh,
  bodyMesh,
  skeleton,
  config: {
    method: 'shrinkwrap',
    iterations: 20,
    stepSize: 0.3,
    smoothingIterations: 3,
    targetOffset: 0.01,        // 1cm from body
    preserveFeatures: true,
    preserveOpenings: true
  }
})

// result contains fitted armor mesh with weights
```

## Body Region Detection

Body regions are computed by analyzing the skeleton and vertex weights to identify distinct anatomical areas.

### Region Patterns

```typescript
const regionPatterns = {
  head: ['head', 'neck'],
  torso: ['spine', 'chest', 'torso', 'body', 'upper'],
  arms: ['arm', 'shoulder', 'elbow', 'wrist', 'hand'],
  hips: ['hip', 'pelvis'],
  legs: ['leg', 'thigh', 'knee', 'ankle', 'foot', 'shin']
}
```

### Region Computation Algorithm

```typescript
computeBodyRegions(
  skinnedMesh: SkinnedMesh,
  skeleton: Skeleton
): Map<string, BodyRegion> {
  const regions = new Map<string, BodyRegion>()
  const geometry = skinnedMesh.geometry
  const position = geometry.attributes.position
  const skinIndex = geometry.attributes.skinIndex
  const skinWeight = geometry.attributes.skinWeight

  // For each region type
  for (const [regionName, patterns] of Object.entries(regionPatterns)) {
    // 1. Find bones matching patterns
    const regionBones: Bone[] = []
    skeleton.bones.forEach(bone => {
      const boneName = bone.name.toLowerCase()
      if (patterns.some(pattern => boneName.includes(pattern))) {
        regionBones.push(bone)
      }
    })

    if (regionBones.length === 0) continue

    // 2. Find vertices influenced by region bones
    const regionVertices: number[] = []
    const weightThreshold = regionName === 'torso' ? 0.3 : 0.5

    for (let i = 0; i < position.count; i++) {
      let totalWeight = 0

      // Check vertex influences
      for (let j = 0; j < 4; j++) {
        const boneIndex = skinIndex.getComponent(i, j)
        const weight = skinWeight.getComponent(i, j)

        if (regionBoneIndices.has(boneIndex)) {
          totalWeight += weight
        }
      }

      if (totalWeight > weightThreshold) {
        regionVertices.push(i)
      }
    }

    // 3. Compute bounding box from vertices
    const boundingBox = new Box3()
    const vertexPositions: Vector3[] = []

    regionVertices.forEach(i => {
      const vertex = new Vector3()
      vertex.fromBufferAttribute(position, i)
      vertex.applyMatrix4(skinnedMesh.matrixWorld)
      vertexPositions.push(vertex)
    })

    if (vertexPositions.length > 10) {
      boundingBox.setFromPoints(vertexPositions)
    } else {
      // Fallback: use bone positions with influence spheres
      const influence = {
        head: 0.15,
        torso: 0.35,
        arms: 0.15,
        legs: 0.25,
        hips: 0.3
      }[regionName] || 0.2

      regionBones.forEach(bone => {
        const bonePos = new Vector3()
        bonePos.setFromMatrixPosition(bone.matrixWorld)
        boundingBox.expandByPoint(bonePos.clone().addScalar(influence))
        boundingBox.expandByPoint(bonePos.clone().addScalar(-influence))
      })
    }

    // 4. Create region
    regions.set(regionName, {
      name: regionName,
      bones: regionBones.map(b => b.name),
      boundingBox,
      vertices: regionVertices,
      center: boundingBox.getCenter(new Vector3())
    })
  }

  return regions
}
```

### Region Bounds Visualization

```
         ┌─────────┐
         │  HEAD   │ Y: 1.5m - 1.8m
         └─────┬───┘
               │
    ┌──────────┼──────────┐
    │                     │
 ┌──┴──┐    ┌─┴─────┐  ┌─┴───┐
 │ ARM │    │ TORSO │  │ ARM │ Y: 0.7m - 1.5m
 └─────┘    └───┬───┘  └─────┘
                │
           ┌────┴────┐
           │  HIPS   │         Y: 0.6m - 0.8m
           └─┬─────┬─┘
             │     │
          ┌──┴┐  ┌─┴──┐
          │LEG│  │ LEG│        Y: 0.0m - 0.6m
          └───┘  └────┘
```

### Influence Radius

Different regions use different influence radii based on typical anatomy:

```typescript
const influenceRadius = {
  head: 0.15,    // 15cm - compact
  torso: 0.35,   // 35cm - largest region
  arms: 0.15,    // 15cm - slender
  legs: 0.25,    // 25cm - medium
  hips: 0.3      // 30cm - medium-large
}
```

## MeshFittingService

The `MeshFittingService` implements the core mesh deformation algorithms that conform armor to body shapes.

### Shrinkwrap Overview

Shrinkwrap is an iterative algorithm that gradually pulls vertices toward a target surface:

```
Initial State:           After Iteration 1:      After Iteration N:

  Armor (loose)          Armor (closer)          Armor (fitted)

    ╔═══╗                  ╔══╗                    ╔═╗
    ║   ║                  ║  ║                    ║║║
    ║ ● ║  ─────>          ║ ●║   ─────>          ║●║
    ║   ║                  ║  ║                    ║║║
    ╚═══╝                  ╚══╝                    ╚═╝

  (● = body)
```

### Vertex Classification

Vertices are classified by their position relative to the armor center:

```typescript
private classifyVertices(sourceMesh: Mesh): string[] {
  const geometry = sourceMesh.geometry
  const position = geometry.attributes.position
  const vertexCount = position.count

  // Get mesh bounds
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox!
  const center = bounds.getCenter(new Vector3())
  const size = bounds.getSize(new Vector3())

  // Determine primary axes
  let forwardAxis = new Vector3(0, 0, 1)  // Default Z forward
  let rightAxis = new Vector3(1, 0, 0)    // Default X right

  // If X is larger than Z, X might be forward
  if (size.x > size.z * 1.2) {
    forwardAxis = new Vector3(1, 0, 0)
    rightAxis = new Vector3(0, 0, 1)
  }

  const sidedness: string[] = []

  // Classify each vertex
  for (let i = 0; i < vertexCount; i++) {
    const vertex = new Vector3(
      position.getX(i),
      position.getY(i),
      position.getZ(i)
    )

    // Position relative to center
    const relativePos = vertex.clone().sub(center)

    // Project onto axes
    const forwardDist = relativePos.dot(forwardAxis)
    const rightDist = relativePos.dot(rightAxis)
    const absForward = Math.abs(forwardDist)
    const absRight = Math.abs(rightDist)

    // Classify
    if (absForward > absRight * 1.5) {
      sidedness[i] = forwardDist > 0 ? 'front' : 'back'
    } else if (absRight > absForward * 1.5) {
      sidedness[i] = rightDist > 0 ? 'right' : 'left'
    } else {
      // Ambiguous - use normal as tiebreaker
      const normal = geometry.attributes.normal
      const vertexNormal = new Vector3(
        normal.getX(i),
        normal.getY(i),
        normal.getZ(i)
      ).normalize()

      const normalForward = vertexNormal.dot(forwardAxis)
      sidedness[i] = Math.abs(normalForward) > 0.5
        ? (normalForward > 0 ? 'front' : 'back')
        : (forwardDist > 0 ? 'front' : 'back')
    }
  }

  return sidedness
}
```

## Shrinkwrap Algorithm

The shrinkwrap algorithm iteratively moves vertices toward the target surface while preserving topology.

### Core Loop

```typescript
fitMeshToTarget(
  sourceMesh: Mesh,
  targetMesh: Mesh,
  parameters: MeshFittingParameters
): void {
  const sourceGeometry = sourceMesh.geometry
  const position = sourceGeometry.attributes.position
  const vertexCount = position.count

  // Detect locked vertices (arm holes, neck openings)
  const lockedVertices = this.detectIntersectingVertices(
    sourceMesh,
    targetMesh,
    skeleton
  )

  // Detect arm holes for preservation
  const armHoleVertices = this.detectArmHoles(sourceMesh)

  // Get target bounds
  const targetBounds = new Box3().setFromObject(targetMesh)
  const targetCenter = targetBounds.getCenter(new Vector3())

  // Classify vertices
  const vertexSidedness = this.classifyVertices(sourceMesh)

  // Iterative fitting
  for (let iter = 0; iter < parameters.iterations; iter++) {
    const displacements = new Float32Array(vertexCount * 3)
    const hasDisplacement = new Array(vertexCount).fill(false)

    // Calculate displacements for each vertex
    for (let i = 0; i < vertexCount; i++) {
      // Skip locked vertices
      if (lockedVertices.has(i) || armHoleVertices.has(i)) continue

      const vertex = new Vector3(
        position.getX(i),
        position.getY(i),
        position.getZ(i)
      )
      vertex.applyMatrix4(sourceMesh.matrixWorld)

      // Find target point on surface
      const targetPoint = this.findNearestSurfacePoint(
        vertex,
        targetMesh,
        vertexSidedness[i]
      )

      if (targetPoint) {
        // Calculate displacement
        const displacement = targetPoint.point.clone()
          .sub(vertex)
          .multiplyScalar(parameters.stepSize)

        // Apply offset from surface
        displacement.add(
          targetPoint.normal.clone()
            .multiplyScalar(parameters.targetOffset)
        )

        // Store displacement
        displacements[i * 3] = displacement.x
        displacements[i * 3 + 1] = displacement.y
        displacements[i * 3 + 2] = displacement.z
        hasDisplacement[i] = true
      }
    }

    // Apply displacements
    this.applyDisplacements(sourceMesh, displacements, hasDisplacement)

    // Apply smoothing
    if (parameters.smoothingIterations > 0) {
      this.applyLaplacianSmoothing(
        sourceGeometry,
        parameters.smoothingRadius,
        parameters.smoothingStrength,
        parameters.smoothingIterations,
        lockedVertices
      )
    }
  }
}
```

### Surface Point Detection

Finding the nearest surface point depends on the target mesh type:

```typescript
private findNearestSurfacePoint(
  point: Vector3,
  targetMesh: Mesh,
  sidedness?: string
): { point: Vector3, normal: Vector3 } | null {
  const targetBounds = new Box3().setFromObject(targetMesh)
  const targetCenter = targetBounds.getCenter(new Vector3())

  // For sphere targets (simple case)
  if (this.isSphere(targetMesh)) {
    const sphereRadius = targetBounds.getSize(new Vector3()).x / 2
    const fromCenter = point.clone().sub(targetCenter)
    const distance = fromCenter.length()

    if (distance > 0.001) {
      const normal = fromCenter.normalize()
      const surfacePoint = targetCenter.clone()
        .add(normal.clone().multiplyScalar(sphereRadius))

      return { point: surfacePoint, normal }
    }
  }

  // For box targets
  if (this.isBox(targetMesh)) {
    const boxMin = targetBounds.min
    const boxMax = targetBounds.max
    const boxCenter = targetBounds.getCenter(new Vector3())

    // Project to nearest face
    const fromCenter = point.clone().sub(boxCenter).normalize()

    const absX = Math.abs(fromCenter.x)
    const absY = Math.abs(fromCenter.y)
    const absZ = Math.abs(fromCenter.z)

    let projectedPoint = new Vector3()
    let faceNormal = new Vector3()

    if (absX >= absY && absX >= absZ) {
      // X face
      projectedPoint.x = fromCenter.x > 0 ? boxMax.x : boxMin.x
      projectedPoint.y = Math.max(boxMin.y, Math.min(boxMax.y, point.y))
      projectedPoint.z = Math.max(boxMin.z, Math.min(boxMax.z, point.z))
      faceNormal.set(fromCenter.x > 0 ? 1 : -1, 0, 0)
    } else if (absY >= absX && absY >= absZ) {
      // Y face
      projectedPoint.x = Math.max(boxMin.x, Math.min(boxMax.x, point.x))
      projectedPoint.y = fromCenter.y > 0 ? boxMax.y : boxMin.y
      projectedPoint.z = Math.max(boxMin.z, Math.min(boxMax.z, point.z))
      faceNormal.set(0, fromCenter.y > 0 ? 1 : -1, 0)
    } else {
      // Z face
      projectedPoint.x = Math.max(boxMin.x, Math.min(boxMax.x, point.x))
      projectedPoint.y = Math.max(boxMin.y, Math.min(boxMax.y, point.y))
      projectedPoint.z = fromCenter.z > 0 ? boxMax.z : boxMin.z
      faceNormal.set(0, 0, fromCenter.z > 0 ? 1 : -1)
    }

    return { point: projectedPoint, normal: faceNormal }
  }

  // For complex meshes - use raycasting
  return this.raycastToSurface(point, targetMesh, sidedness)
}
```

### Directional Raycasting

For armor fitting, raycasting direction is determined by vertex classification:

```typescript
private raycastToSurface(
  vertex: Vector3,
  targetMesh: Mesh,
  sidedness?: string
): { point: Vector3, normal: Vector3 } | null {
  let rayDirection = new Vector3()

  // Use sidedness to determine ray direction
  if (sidedness === 'back') {
    rayDirection.set(0, 0, -1)  // Ray backward
  } else if (sidedness === 'front') {
    rayDirection.set(0, 0, 1)   // Ray forward
  } else if (sidedness === 'left') {
    rayDirection.set(-1, 0, 0)  // Ray left
  } else if (sidedness === 'right') {
    rayDirection.set(1, 0, 0)   // Ray right
  } else {
    // Fallback: ray toward center
    const targetCenter = new Box3().setFromObject(targetMesh).getCenter(new Vector3())
    rayDirection = targetCenter.clone().sub(vertex).normalize()
  }

  // Cast ray
  this.raycaster.set(vertex, rayDirection)
  const intersects = this.raycaster.intersectObject(targetMesh, false)

  if (intersects.length > 0) {
    const intersection = intersects[0]
    return {
      point: intersection.point,
      normal: intersection.face!.normal
    }
  }

  return null
}
```

### Opening Detection

Arm holes and neck openings must be preserved:

```typescript
private detectArmHoles(mesh: Mesh): Set<number> {
  const lockedVertices = new Set<number>()
  const geometry = mesh.geometry
  const position = geometry.attributes.position

  // Get mesh bounds
  const bounds = new Box3().setFromBufferAttribute(position)
  const size = bounds.getSize(new Vector3())
  const center = bounds.getCenter(new Vector3())

  // Build neighbor map
  const neighborMap = this.buildNeighborMap(geometry)

  // Find arm hole vertices
  for (let i = 0; i < position.count; i++) {
    const vertex = new Vector3(
      position.getX(i),
      position.getY(i),
      position.getZ(i)
    )

    // Calculate relative position
    const relativeY = (vertex.y - bounds.min.y) / size.y
    const relativeX = Math.abs(vertex.x - center.x) / (size.x / 2)

    // Arm holes are typically:
    // - At 60-90% height (shoulder area)
    // - Near sides (70%+ from center)
    // - Edge vertices (fewer neighbors)
    if (relativeY > 0.6 && relativeY < 0.9 && relativeX > 0.7) {
      const neighbors = neighborMap.get(i)

      // Edge vertices have fewer neighbors
      if (neighbors && neighbors.size < 6) {
        lockedVertices.add(i)
      }
    }
  }

  return lockedVertices
}
```

## Laplacian Smoothing

Laplacian smoothing reduces mesh roughness while preserving overall shape.

### Smoothing Kernel

```typescript
private applyLaplacianSmoothing(
  geometry: BufferGeometry,
  radius: number,
  strength: number,
  iterations: number,
  lockedVertices: Set<number>
): void {
  const position = geometry.attributes.position
  const vertexCount = position.count

  // Build vertex neighbors
  const neighbors = this.buildNeighborMap(geometry)

  for (let iter = 0; iter < iterations; iter++) {
    const smoothedPositions = new Float32Array(position.array)

    for (let i = 0; i < vertexCount; i++) {
      // Skip locked vertices
      if (lockedVertices.has(i)) continue

      const vertex = new Vector3(
        position.getX(i),
        position.getY(i),
        position.getZ(i)
      )

      // Get neighbors within radius
      const nearbyNeighbors = this.getNeighborsWithinRadius(
        i,
        neighbors,
        position,
        radius
      )

      if (nearbyNeighbors.length === 0) continue

      // Calculate Laplacian (average of neighbors)
      const laplacian = new Vector3()
      nearbyNeighbors.forEach(ni => {
        laplacian.x += position.getX(ni)
        laplacian.y += position.getY(ni)
        laplacian.z += position.getZ(ni)
      })
      laplacian.divideScalar(nearbyNeighbors.length)

      // Move toward Laplacian position
      const smoothed = vertex.clone()
        .lerp(laplacian, strength)

      smoothedPositions[i * 3] = smoothed.x
      smoothedPositions[i * 3 + 1] = smoothed.y
      smoothedPositions[i * 3 + 2] = smoothed.z
    }

    // Update positions
    position.array.set(smoothedPositions)
    position.needsUpdate = true
  }

  geometry.computeVertexNormals()
}
```

### Neighbor Building

```typescript
private buildNeighborMap(
  geometry: BufferGeometry
): Map<number, Set<number>> {
  const neighbors = new Map<number, Set<number>>()
  const index = geometry.index

  if (!index) return neighbors

  // Build from index buffer (triangle list)
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i)
    const b = index.getX(i + 1)
    const c = index.getX(i + 2)

    if (!neighbors.has(a)) neighbors.set(a, new Set())
    if (!neighbors.has(b)) neighbors.set(b, new Set())
    if (!neighbors.has(c)) neighbors.set(c, new Set())

    neighbors.get(a)!.add(b).add(c)
    neighbors.get(b)!.add(a).add(c)
    neighbors.get(c)!.add(a).add(b)
  }

  return neighbors
}
```

## Feature Preservation

Sharp edges and corners can be preserved during smoothing.

### Feature Detection

```typescript
private detectFeatures(
  geometry: BufferGeometry,
  angleThreshold: number
): Set<number> {
  const features = new Set<number>()
  const normal = geometry.attributes.normal
  const neighbors = this.buildNeighborMap(geometry)

  const threshold = Math.cos(angleThreshold * Math.PI / 180)

  for (let i = 0; i < normal.count; i++) {
    const vertexNormal = new Vector3(
      normal.getX(i),
      normal.getY(i),
      normal.getZ(i)
    )

    const viNeighbors = neighbors.get(i)
    if (!viNeighbors) continue

    // Check angle with neighbors
    let isFeature = false
    for (const ni of viNeighbors) {
      const neighborNormal = new Vector3(
        normal.getX(ni),
        normal.getY(ni),
        normal.getZ(ni)
      )

      const dot = vertexNormal.dot(neighborNormal)

      // If angle > threshold, this is a feature edge
      if (dot < threshold) {
        isFeature = true
        break
      }
    }

    if (isFeature) {
      features.add(i)
    }
  }

  return features
}
```

### Feature-Preserving Smoothing

```typescript
// Modified smoothing that locks feature vertices
const featureVertices = parameters.preserveFeatures
  ? this.detectFeatures(geometry, parameters.featureAngleThreshold || 30)
  : new Set<number>()

const allLockedVertices = new Set([
  ...lockedVertices,
  ...featureVertices
])

this.applyLaplacianSmoothing(
  geometry,
  radius,
  strength,
  iterations,
  allLockedVertices  // Lock both openings and features
)
```

## WeightTransferService

The `WeightTransferService` transfers skinning weights from the body mesh to the fitted armor.

### Transfer Methods

**1. Nearest Point Method:**
```typescript
private transferWeightsNearest(
  bodyGeometry: BufferGeometry,
  armorGeometry: BufferGeometry,
  bodyMatrix: Matrix4,
  armorMatrix: Matrix4,
  options: WeightTransferOptions,
  result: WeightTransferResult
): void {
  const bodyPosition = bodyGeometry.attributes.position
  const armorPosition = armorGeometry.attributes.position

  // For each armor vertex
  for (let i = 0; i < armorPosition.count; i++) {
    const armorVertex = new Vector3(
      armorPosition.getX(i),
      armorPosition.getY(i),
      armorPosition.getZ(i)
    )
    armorVertex.applyMatrix4(armorMatrix)

    // Find nearest body vertex
    let minDistance = Infinity
    let nearestIndex = -1

    for (let j = 0; j < bodyPosition.count; j++) {
      const bodyVertex = new Vector3(
        bodyPosition.getX(j),
        bodyPosition.getY(j),
        bodyPosition.getZ(j)
      )
      bodyVertex.applyMatrix4(bodyMatrix)

      const distance = armorVertex.distanceTo(bodyVertex)

      if (distance < minDistance) {
        minDistance = distance
        nearestIndex = j
      }
    }

    // Copy weights from nearest body vertex
    if (nearestIndex !== -1 && minDistance < options.distanceThreshold) {
      for (let k = 0; k < 4; k++) {
        armorSkinIndex.setX(i * 4 + k, bodySkinIndex.getX(nearestIndex * 4 + k))
        armorSkinWeight.setX(i * 4 + k, bodySkinWeight.getX(nearestIndex * 4 + k))
      }

      result.transferredVertices++
    }
  }
}
```

**2. Projected Method:**
```typescript
private transferWeightsProjected(
  bodyGeometry: BufferGeometry,
  armorGeometry: BufferGeometry,
  bodyMatrix: Matrix4,
  armorMatrix: Matrix4,
  options: WeightTransferOptions,
  result: WeightTransferResult
): void {
  const raycaster = new Raycaster()
  const bodyMesh = new Mesh(bodyGeometry)
  bodyMesh.matrixWorld = bodyMatrix

  const armorPosition = armorGeometry.attributes.position
  const armorNormal = armorGeometry.attributes.normal

  for (let i = 0; i < armorPosition.count; i++) {
    const armorVertex = new Vector3(
      armorPosition.getX(i),
      armorPosition.getY(i),
      armorPosition.getZ(i)
    )
    armorVertex.applyMatrix4(armorMatrix)

    const armorNormalVec = new Vector3(
      armorNormal.getX(i),
      armorNormal.getY(i),
      armorNormal.getZ(i)
    )
    armorNormalVec.transformDirection(armorMatrix).normalize()

    // Cast ray inward along normal
    raycaster.set(armorVertex, armorNormalVec.clone().negate())
    const intersects = raycaster.intersectObject(bodyMesh, false)

    if (intersects.length > 0 && intersects[0].distance < options.distanceThreshold) {
      const face = intersects[0].face!
      const faceIndices = [face.a, face.b, face.c]

      // Barycentric interpolation
      const barycoord = intersects[0].uv!
      const weights = [barycoord.x, barycoord.y, 1 - barycoord.x - barycoord.y]

      // Interpolate skin weights
      for (let k = 0; k < 4; k++) {
        let interpolatedIndex = 0
        let interpolatedWeight = 0

        for (let v = 0; v < 3; v++) {
          const vertexIndex = faceIndices[v]
          interpolatedIndex += weights[v] * bodySkinIndex.getX(vertexIndex * 4 + k)
          interpolatedWeight += weights[v] * bodySkinWeight.getX(vertexIndex * 4 + k)
        }

        armorSkinIndex.setX(i * 4 + k, Math.round(interpolatedIndex))
        armorSkinWeight.setX(i * 4 + k, interpolatedWeight)
      }

      result.transferredVertices++
    }
  }
}
```

**3. Inpainted Method:**
```typescript
private transferWeightsInpainted(
  bodyGeometry: BufferGeometry,
  armorGeometry: BufferGeometry,
  bodyMatrix: Matrix4,
  armorMatrix: Matrix4,
  options: WeightTransferOptions,
  result: WeightTransferResult
): void {
  // First pass: transfer reliable weights using projection
  this.transferWeightsProjected(bodyGeometry, armorGeometry, bodyMatrix, armorMatrix, options, result)

  // Build reliable/unreliable sets
  const reliableVertices = new Set<number>()
  const unreliableVertices = new Set<number>()

  const armorSkinWeight = armorGeometry.attributes.skinWeight

  for (let i = 0; i < armorPosition.count; i++) {
    const weight = armorSkinWeight.getX(i * 4)
    if (weight > 0) {
      reliableVertices.add(i)
    } else {
      unreliableVertices.add(i)
    }
  }

  // Inpaint unreliable weights
  const neighbors = this.buildVertexNeighbors(armorGeometry)

  for (let iter = 0; iter < 10; iter++) {
    const toUpdate = new Map<number, number[]>()

    unreliableVertices.forEach(vi => {
      const viNeighbors = neighbors.get(vi) || []
      const reliableNeighbors = viNeighbors.filter(n => reliableVertices.has(n))

      if (reliableNeighbors.length > 0) {
        // Average weights from reliable neighbors
        const avgWeights = new Array(16).fill(0)

        reliableNeighbors.forEach(ni => {
          for (let k = 0; k < 4; k++) {
            avgWeights[k * 2] += armorGeometry.attributes.skinIndex.getX(ni * 4 + k)
            avgWeights[k * 2 + 1] += armorGeometry.attributes.skinWeight.getX(ni * 4 + k)
          }
        })

        // Normalize
        for (let k = 0; k < avgWeights.length; k++) {
          avgWeights[k] /= reliableNeighbors.length
        }

        toUpdate.set(vi, avgWeights)
      }
    })

    // Apply updates
    toUpdate.forEach((weights, vi) => {
      for (let k = 0; k < 4; k++) {
        armorGeometry.attributes.skinIndex.setX(vi * 4 + k, Math.round(weights[k * 2]))
        armorGeometry.attributes.skinWeight.setX(vi * 4 + k, weights[k * 2 + 1])
      }

      unreliableVertices.delete(vi)
      reliableVertices.add(vi)
      result.transferredVertices++
    })

    if (toUpdate.size === 0) break
  }
}
```

### Weight Smoothing

```typescript
private smoothWeights(geometry: BufferGeometry, iterations: number): void {
  const skinWeight = geometry.attributes.skinWeight
  const skinIndex = geometry.attributes.skinIndex
  const neighbors = this.buildVertexNeighbors(geometry)

  for (let iter = 0; iter < iterations; iter++) {
    const newWeights: number[] = []

    for (let i = 0; i < skinWeight.count / 4; i++) {
      const viNeighbors = neighbors.get(i) || []

      // Collect bone influences
      const boneWeights = new Map<number, number>()

      // Current vertex
      for (let k = 0; k < 4; k++) {
        const boneIndex = skinIndex.getX(i * 4 + k)
        const weight = skinWeight.getX(i * 4 + k)
        if (weight > 0) {
          boneWeights.set(boneIndex, (boneWeights.get(boneIndex) || 0) + weight)
        }
      }

      // Neighbors (with reduced influence)
      viNeighbors.forEach(ni => {
        for (let k = 0; k < 4; k++) {
          const boneIndex = skinIndex.getX(ni * 4 + k)
          const weight = skinWeight.getX(ni * 4 + k)
          if (weight > 0) {
            boneWeights.set(boneIndex, (boneWeights.get(boneIndex) || 0) + weight * 0.5)
          }
        }
      })

      // Sort and keep top 4
      const sortedBones = Array.from(boneWeights.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)

      // Normalize
      const totalWeight = sortedBones.reduce((sum, [_, w]) => sum + w, 0)

      for (let k = 0; k < 4; k++) {
        if (k < sortedBones.length) {
          newWeights.push(sortedBones[k][0])
          newWeights.push(sortedBones[k][1] / totalWeight)
        } else {
          newWeights.push(0)
          newWeights.push(0)
        }
      }
    }

    // Apply
    for (let i = 0; i < skinWeight.count; i++) {
      const baseIdx = Math.floor(i / 4) * 8 + (i % 4) * 2
      skinIndex.setX(i, newWeights[baseIdx])
      skinWeight.setX(i, newWeights[baseIdx + 1])
    }
  }

  skinIndex.needsUpdate = true
  skinWeight.needsUpdate = true
}
```

## ArmorScaleFixer

The `ArmorScaleFixer` resolves scale issues that can occur during the fitting process.

### Scale Detection

```typescript
static hasScaleIssues(skeleton: Skeleton): boolean {
  const rootBones = skeleton.bones.filter(b => !b.parent || !(b.parent instanceof Bone))

  for (const root of rootBones) {
    const worldScale = new Vector3()
    root.getWorldScale(worldScale)

    const tolerance = 0.001
    if (Math.abs(worldScale.x - 1) > tolerance ||
        Math.abs(worldScale.y - 1) > tolerance ||
        Math.abs(worldScale.z - 1) > tolerance) {
      return true
    }
  }

  return false
}
```

### Scale Baking

```typescript
static applySkeletonScale(skinnedMesh: SkinnedMesh): SkinnedMesh {
  const skeleton = skinnedMesh.skeleton
  const rootBones = skeleton.bones.filter(b => !b.parent || !(b.parent instanceof Bone))

  // Get world scale
  const worldScale = new Vector3()
  if (rootBones.length > 0) {
    rootBones[0].getWorldScale(worldScale)
  }

  if (Math.abs(worldScale.x - 1) < 0.001) {
    return skinnedMesh  // Already normalized
  }

  // Clone mesh and geometry
  const clonedMesh = skinnedMesh.clone()
  const clonedGeometry = skinnedMesh.geometry.clone()
  clonedMesh.geometry = clonedGeometry

  // Create new bones with baked scale
  const newBones: Bone[] = []
  const boneMap = new Map<Bone, Bone>()

  skeleton.bones.forEach(oldBone => {
    const newBone = new Bone()
    newBone.name = oldBone.name

    // Get world position
    const worldPos = new Vector3()
    oldBone.getWorldPosition(worldPos)

    // Convert to local space relative to parent
    if (oldBone.parent && oldBone.parent instanceof Bone) {
      const parentWorld = new Matrix4()
      oldBone.parent.updateMatrixWorld()
      parentWorld.copy(oldBone.parent.matrixWorld)

      const parentInverse = parentWorld.invert()
      worldPos.applyMatrix4(parentInverse)
    }

    newBone.position.copy(worldPos)
    newBone.quaternion.copy(oldBone.quaternion)
    newBone.scale.set(1, 1, 1)  // Reset to 1

    newBones.push(newBone)
    boneMap.set(oldBone, newBone)
  })

  // Rebuild hierarchy
  skeleton.bones.forEach((oldBone, idx) => {
    const newBone = newBones[idx]
    if (oldBone.parent && oldBone.parent instanceof Bone) {
      const parentNewBone = boneMap.get(oldBone.parent)
      if (parentNewBone) {
        parentNewBone.add(newBone)
      }
    }
  })

  // Scale geometry
  const positions = clonedGeometry.attributes.position
  const scale = worldScale.x

  for (let i = 0; i < positions.count; i++) {
    positions.setXYZ(
      i,
      positions.getX(i) * scale,
      positions.getY(i) * scale,
      positions.getZ(i) * scale
    )
  }
  positions.needsUpdate = true

  // Create new skeleton and bind
  const newSkeleton = new Skeleton(newBones)
  const bindMatrix = skinnedMesh.bindMatrix.clone()
  const scaleMatrix = new Matrix4().makeScale(scale, scale, scale)
  bindMatrix.premultiply(scaleMatrix)

  clonedMesh.bind(newSkeleton, bindMatrix)

  return clonedMesh
}
```

## BoneDiagnostics

The `BoneDiagnostics` utility provides detailed skeleton analysis.

### Skeleton Analysis

```typescript
static analyzeSkeletonForExport(skeleton: Skeleton, name: string): void {
  const bones = skeleton.bones
  const rootBones = bones.filter(b => !b.parent || !(b.parent instanceof Bone))

  // Calculate bone distances
  const distances: number[] = []
  bones.forEach(bone => {
    bone.children.forEach(child => {
      if (child instanceof Bone) {
        distances.push(bone.position.distanceTo(child.position))
      }
    })
  })

  if (distances.length > 0) {
    const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length
    const minDist = Math.min(...distances)
    const maxDist = Math.max(...distances)

    console.log(`Bone Distance Analysis:`)
    console.log(`  Average: ${avgDist.toFixed(3)} units`)
    console.log(`  Min: ${minDist.toFixed(3)} units`)
    console.log(`  Max: ${maxDist.toFixed(3)} units`)

    // Guess units
    if (avgDist > 10) {
      console.log(`  Likely units: CENTIMETERS`)
    } else if (avgDist > 0.1 && avgDist < 1) {
      console.log(`  Likely units: METERS`)
    }
  }

  // Check for scale issues
  const hasNonUniformScale = bones.some(bone => {
    const s = bone.scale
    return Math.abs(s.x - 1) > 0.001 || Math.abs(s.y - 1) > 0.001 || Math.abs(s.z - 1) > 0.001
  })

  if (hasNonUniformScale) {
    console.log(`WARNING: Some bones have non-uniform scale!`)
  }
}
```

## Debug Visualization

The fitting system provides comprehensive debug visualization.

### Debug Arrows

```typescript
private createDebugArrows(
  sourceMesh: Mesh,
  displacements: Float32Array,
  hasDisplacement: boolean[],
  parameters: MeshFittingParameters
): void {
  if (!parameters.showDebugArrows || !this.debugArrowGroup) return

  const position = sourceMesh.geometry.attributes.position
  const density = parameters.debugArrowDensity || 10

  this.debugArrowGroup.clear()

  for (let i = 0; i < position.count; i += density) {
    if (!hasDisplacement[i]) continue

    // Get vertex position
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

    const magnitude = displacement.length()
    if (magnitude < 0.001) continue

    // Color by magnitude
    const normalized = Math.min(magnitude / 0.1, 1)
    const color = new Color(normalized, 1 - normalized, 0)

    // Create arrow
    const direction = displacement.clone().normalize()
    const arrow = new ArrowHelper(direction, vertex, magnitude * 5, color)
    this.debugArrowGroup.add(arrow)
  }
}
```

### Color Modes

```
magnitude: Blue (small) -> Green -> Yellow -> Red (large)
direction: Red (forward), Green (backward), Blue (up/down), Yellow (sideways)
sidedness: Green (front), Red (back), Blue (left), Yellow (right)
```

## Performance Considerations

### Iteration Count

```
Low quality: 5-10 iterations, stepSize 0.5
Medium quality: 15-20 iterations, stepSize 0.3
High quality: 30-50 iterations, stepSize 0.2
```

### Sample Rate

Process a percentage of vertices per iteration:

```typescript
sampleRate: 0.5  // Process 50% of vertices (faster)
sampleRate: 1.0  // Process all vertices (better quality)
```

### Target Mesh Complexity

Simpler target meshes = faster fitting:

```
Sphere: ~100ms per iteration
Box: ~200ms per iteration
Character mesh: ~500ms per iteration
```

## Conclusion

The Asset Forge armor fitting system demonstrates advanced mesh deformation techniques combined with weight transfer and skeleton analysis to achieve production-quality armor fitting. By using shrinkwrap algorithms, Laplacian smoothing, feature preservation, and intelligent weight transfer, the system can adapt generic armor pieces to any character body while maintaining surface detail and preserving important openings.

Key takeaways:

1. **Body region detection** enables targeted fitting
2. **Shrinkwrap** provides controlled, iterative deformation
3. **Laplacian smoothing** maintains surface quality
4. **Feature preservation** keeps edges crisp
5. **Weight transfer** ensures proper animation
6. **Scale fixing** prevents export issues

This architecture forms the foundation for automated equipment fitting in 3D games and virtual worlds.
