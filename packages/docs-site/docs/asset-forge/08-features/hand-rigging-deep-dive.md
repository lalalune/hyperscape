# Hand Rigging Deep Dive

## Overview

Hand rigging is the automated process of adding detailed finger bones and skinning weights to 3D character models. Using MediaPipe Hands for pose detection and TensorFlow.js for inference, the Asset Forge hand rigging system can automatically detect hand poses in T-pose models and generate complete finger skeletons with proper weight painting.

This deep dive explores the entire pipeline from orthographic rendering to bone creation and weight assignment.

## Table of Contents

- [System Architecture](#system-architecture)
- [Pipeline Overview](#pipeline-overview)
- [OrthographicHandRenderer](#orthographichandrenderer)
- [HandPoseDetectionService](#handposedetectionservice)
- [MediaPipe Landmarks](#mediapipe-landmarks)
- [HandSegmentationService](#handsegmentationservice)
- [Bone Creation](#bone-creation)
- [Weight Assignment](#weight-assignment)
- [SimpleHandRiggingService](#simplehandriggingservice)
- [GLB Export](#glb-export)

## System Architecture

The hand rigging system consists of five interconnected services:

```
┌─────────────────────────────────────────┐
│     HandRiggingService (Orchestrator)   │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┼─────────┬────────┐
        │         │         │        │
        ▼         ▼         ▼        ▼
┌──────────┐ ┌────────┐ ┌──────┐ ┌────────┐
│Orthograph│ │HandPose│ │Hand  │ │Weight  │
│icHand    │ │Detection│ │Segment│ │Transfer│
│Renderer  │ │Service │ │ation │ │        │
└──────────┘ └────────┘ └──────┘ └────────┘
     │            │         │         │
     └────────────┴─────────┴─────────┘
                  │
                  ▼
         ┌─────────────────┐
         │   GLTFExporter  │
         └─────────────────┘
```

### Component Responsibilities

**HandRiggingService**
- Orchestrates the entire rigging pipeline
- Finds wrist bones in the source model
- Manages multiple capture attempts
- Handles both left and right hands
- Exports the final rigged model

**OrthographicHandRenderer**
- Renders orthographic views of hands
- Implements multi-angle capture
- Handles proper lighting setup
- Creates clean images for detection

**HandPoseDetectionService**
- Integrates TensorFlow.js and MediaPipe
- Detects 21 hand landmarks
- Provides 3D world coordinates
- Validates detection quality

**HandSegmentationService**
- Creates Voronoi finger masks
- Performs morphological operations
- Maps 2D masks to 3D vertices
- Resolves mask overlaps

**WeightTransferService** (not shown in detail here)
- Handles weight painting algorithms
- Supports multiple transfer methods
- Smooths and normalizes weights

## Pipeline Overview

The complete hand rigging pipeline follows these steps:

```
1. Find Wrist Bones
   └─> Locate left/right wrist bones in skeleton

2. Capture Hand Views
   ├─> Render orthographic view from palm side
   ├─> Apply optimal lighting
   └─> Try multiple backgrounds if needed

3. Detect Hand Pose
   ├─> Run MediaPipe hand detection
   ├─> Extract 21 landmarks (2D + 3D)
   └─> Validate detection confidence

4. Segment Fingers
   ├─> Create Voronoi regions for each finger
   ├─> Apply morphological cleanup
   └─> Generate finger masks

5. Create Bones
   ├─> Calculate bone positions from landmarks
   ├─> Build hierarchical bone structure
   └─> Add to existing skeleton

6. Assign Weights
   ├─> Project vertices to 2D
   ├─> Match vertices to finger segments
   ├─> Calculate distance-based weights
   └─> Smooth and normalize

7. Export GLB
   └─> Save complete rigged model
```

### Processing Time

Typical processing times on modern hardware:

- Wrist detection: < 100ms
- Hand capture: ~200ms per attempt
- Pose detection: 500-1500ms (GPU dependent)
- Segmentation: 100-300ms
- Bone creation: < 50ms
- Weight assignment: 200-500ms per 1000 vertices
- Export: 500-1500ms

**Total: 2-5 seconds per hand**

## OrthographicHandRenderer

The `OrthographicHandRenderer` creates clean, well-lit orthographic views of hands for optimal pose detection.

### Why Orthographic?

Orthographic projection is essential for hand detection because:

1. **No perspective distortion**: All fingers at same scale
2. **Parallel lines preserved**: Easier landmark detection
3. **Consistent measurements**: Distance calculations accurate
4. **Better for AI**: Training data uses orthographic views

### Camera Setup

```typescript
constructor() {
  const frustumSize = 1
  const aspect = 1

  this.camera = new OrthographicCamera(
    frustumSize * aspect / -2,  // left
    frustumSize * aspect / 2,   // right
    frustumSize / 2,            // top
    frustumSize / -2,           // bottom
    0.1,                        // near
    10                          // far
  )
}
```

### Lighting Configuration

Multiple lights ensure even illumination from all angles:

```typescript
// Ambient base illumination
const ambientLight = new AmbientLight(0xffffff, 0.9)

// Primary directional light (from above-front)
const directionalLight1 = new DirectionalLight(0xffffff, 0.7)
directionalLight1.position.set(1, 1, 1)

// Secondary light (from back-side)
const directionalLight2 = new DirectionalLight(0xffffff, 0.5)
directionalLight2.position.set(-1, 0.5, -1)

// Fill light (from below)
const directionalLight3 = new DirectionalLight(0xffffff, 0.3)
directionalLight3.position.set(0, -1, 0)
```

This three-point lighting setup eliminates shadows that could confuse the pose detector.

### Finding Wrist Bones

The renderer must first locate wrist bones in the skeleton:

```typescript
findWristBones(model: Object3D): WristBoneInfo[] {
  const wristBones: WristBoneInfo[] = []

  // Common wrist bone naming patterns
  const wristNames = [
    'hand_l', 'hand_r',
    'Hand_L', 'Hand_R',
    'leftHand', 'rightHand',
    'LeftHand', 'RightHand',
    'mixamorig:LeftHand', 'mixamorig:RightHand',
    'Bip01_L_Hand', 'Bip01_R_Hand',
    'wrist_l', 'wrist_r'
  ]

  model.traverse((child) => {
    if (child instanceof Bone) {
      const lowerName = child.name.toLowerCase()

      // Check for wrist pattern
      const isWrist = wristNames.some(name =>
        child.name === name || lowerName.includes('hand') || lowerName.includes('wrist')
      )

      if (isWrist) {
        // Determine left/right
        const isLeft = lowerName.includes('left') || lowerName.includes('_l')
        const isRight = lowerName.includes('right') || lowerName.includes('_r')

        if (isLeft || isRight) {
          wristBones.push({
            bone: child,
            position: getWorldPosition(child),
            normal: getHandNormal(child),
            side: isLeft ? 'left' : 'right'
          })
        }
      }
    }
  })

  return wristBones
}
```

### Hand Capture Algorithm

```typescript
async captureHand(
  model: Object3D,
  wristInfo: WristBoneInfo,
  options: CaptureOptions
): Promise<HandCaptureResult> {
  // 1. Clone model to avoid affecting source
  const modelClone = model.clone(true)

  // 2. Simplify materials for better detection
  modelClone.traverse((child) => {
    if (child instanceof Mesh || child instanceof SkinnedMesh) {
      child.material = new MeshBasicMaterial({
        color: 0xffa080,  // Skin color
        side: DoubleSide
      })
    }
  })

  // 3. Calculate camera position
  const cameraPos = this.calculateCameraPosition(
    wristInfo.position,
    wristInfo.normal,
    1.0  // distance
  )

  this.camera.position.copy(cameraPos)

  // 4. Look at hand center (slightly forward from wrist)
  const lookAtPoint = wristInfo.position.clone()
  lookAtPoint.add(wristInfo.normal.clone().multiplyScalar(0.08))
  this.camera.lookAt(lookAtPoint)

  // 5. Frame hand in view
  const handBounds = this.estimateHandBounds(wristInfo.position, wristInfo.normal)
  this.updateCameraFrustum(handBounds, options.padding || 0.2)

  // 6. Render
  this.renderer.render(this.scene, this.camera)

  // 7. Extract image data
  const canvas = this.renderer.domElement
  const imageData = extractImageData(canvas)

  return {
    canvas,
    imageData,
    cameraMatrix: this.camera.matrixWorld.clone(),
    projectionMatrix: this.camera.projectionMatrix.clone(),
    worldBounds: handBounds,
    wristPosition: wristInfo.position,
    handNormal: wristInfo.normal,
    side: wristInfo.side
  }
}
```

### Camera Positioning

The camera must be positioned to capture the palm side of the hand:

```typescript
private calculateCameraPosition(
  wristPos: Vector3,
  wristNormal: Vector3,
  distance: number
): Vector3 {
  const cameraPos = wristPos.clone()

  // Invert normal to view from palm side
  const adjustedNormal = wristNormal.clone().multiplyScalar(-1)

  // Add slight upward angle to see fingers better
  adjustedNormal.add(new Vector3(0, 0.5, 0)).normalize()

  cameraPos.addScaledVector(adjustedNormal, distance)

  return cameraPos
}
```

### Hand Bounds Estimation

```typescript
private estimateHandBounds(
  wristPos: Vector3,
  wristNormal: Vector3
): { min: Vector3, max: Vector3 } {
  // Typical hand proportions
  const handLength = 0.3  // 30cm wrist to fingertip
  const handWidth = 0.15  // 15cm palm width

  // Create basis vectors
  const forward = wristNormal.clone().normalize()
  const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize()
  const up = new Vector3().crossVectors(right, forward).normalize()

  // Center bounds on hand (not wrist)
  const center = wristPos.clone().addScaledVector(forward, handLength * 0.6)

  // Build bounding box
  const points = []
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      for (const z of [-1, 1]) {
        const point = center.clone()
        point.addScaledVector(right, (handWidth / 2) * x)
        point.addScaledVector(up, (handWidth / 2) * y)
        point.addScaledVector(forward, (handLength / 2) * z)
        points.push(point)
      }
    }
  }

  const bounds = new Box3().setFromPoints(points)
  return { min: bounds.min, max: bounds.max }
}
```

### Multi-Attempt Strategy

If the first capture attempt fails to detect a hand, the renderer tries different backgrounds:

```typescript
const captureAttempts = [
  { backgroundColor: '#ffffff', padding: 0.5 },  // White
  { backgroundColor: '#000000', padding: 0.7 },  // Black
  { backgroundColor: '#808080', padding: 1.0 },  // Gray
  { backgroundColor: '#ffeecc', padding: 0.6 },  // Skin-like
  { backgroundColor: '#0066cc', padding: 0.8 }   // Blue (contrast)
]

for (const attempt of captureAttempts) {
  const capture = await this.captureHand(model, wristInfo, attempt)
  const detection = await handDetector.detectHands(capture.canvas)

  if (detection.hands.length > 0) {
    return capture  // Success!
  }
}
```

## HandPoseDetectionService

The `HandPoseDetectionService` wraps TensorFlow.js and MediaPipe Hands to provide hand landmark detection.

### Initialization

```typescript
async initialize(): Promise<void> {
  // 1. Wait for TensorFlow.js backend
  await tf.ready()
  console.log('TensorFlow.js backend:', tf.getBackend())

  // 2. Create MediaPipe Hands detector
  const model = handPoseDetection.SupportedModels.MediaPipeHands
  const detectorConfig = {
    runtime: 'mediapipe',
    solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
    modelType: 'full',  // More accurate than 'lite'
    maxHands: 2
  }

  this.detector = await handPoseDetection.createDetector(model, detectorConfig)
  this.isInitialized = true
}
```

### Detection Pipeline

```typescript
async detectHands(
  imageData: ImageData | HTMLCanvasElement
): Promise<HandDetectionResult> {
  // 1. Convert to canvas if needed
  let input: HTMLCanvasElement
  if (imageData instanceof ImageData) {
    const canvas = document.createElement('canvas')
    canvas.width = imageData.width
    canvas.height = imageData.height
    const ctx = canvas.getContext('2d')!
    ctx.putImageData(imageData, 0, 0)
    input = canvas
  } else {
    input = imageData
  }

  // 2. Run MediaPipe detection
  const hands = await this.detector.estimateHands(input)

  // 3. Convert to our format
  const result: HandDetectionResult = {
    hands: hands.map(hand => ({
      landmarks: hand.keypoints.map(kp => ({
        x: kp.x,
        y: kp.y,
        z: kp.z || 0
      })),
      worldLandmarks: hand.keypoints3D ? hand.keypoints3D.map(kp => ({
        x: kp.x,
        y: kp.y,
        z: kp.z || 0
      })) : undefined,
      handedness: hand.handedness,  // 'Left' or 'Right'
      confidence: hand.score || 0
    })),
    imageWidth: input.width,
    imageHeight: input.height
  }

  return result
}
```

## MediaPipe Landmarks

MediaPipe Hands detects 21 landmarks per hand, forming a complete hand skeleton.

### Landmark Indices

```
 0: WRIST

Thumb:
 1: THUMB_CMC (Carpometacarpal)
 2: THUMB_MCP (Metacarpophalangeal)
 3: THUMB_IP  (Interphalangeal)
 4: THUMB_TIP

Index finger:
 5: INDEX_MCP
 6: INDEX_PIP (Proximal interphalangeal)
 7: INDEX_DIP (Distal interphalangeal)
 8: INDEX_TIP

Middle finger:
 9: MIDDLE_MCP
10: MIDDLE_PIP
11: MIDDLE_DIP
12: MIDDLE_TIP

Ring finger:
13: RING_MCP
14: RING_PIP
15: RING_DIP
16: RING_TIP

Pinky:
17: PINKY_MCP
18: PINKY_PIP
19: PINKY_DIP
20: PINKY_TIP
```

### Visual Diagram

```
           ┌──── 20 (Pinky Tip)
           │
       ┌───19 (Pinky DIP)
       │
   ┌───18 (Pinky PIP)
   │
───17 (Pinky MCP)

       ┌──── 16 (Ring Tip)
       │
   ┌───15 (Ring DIP)
   │
───14─13 (Ring PIP, MCP)

       ┌──── 12 (Middle Tip)
       │
   ┌───11 (Middle DIP)
   │
───10─9 (Middle PIP, MCP)

       ┌──── 8 (Index Tip)
       │
   ┌───7 (Index DIP)
   │
───6─5 (Index PIP, MCP)

   ┌───┬─── 4 (Thumb Tip)
   │   3 (Thumb IP)
   │
   2 (Thumb MCP)
   │
   1 (Thumb CMC)
   │
   0 (WRIST)
```

### 3D World Coordinates

MediaPipe provides two sets of coordinates:

**2D Landmarks** (`keypoints`):
- Normalized screen coordinates (0-1 range)
- X: 0 (left) to 1 (right)
- Y: 0 (top) to 1 (bottom)
- Z: Relative depth (arbitrary units)

**3D World Landmarks** (`keypoints3D`):
- Real-world metric coordinates
- Origin at wrist
- Units: meters
- Hand-relative coordinate system

### Coordinate Conversion

```typescript
convertTo3DCoordinates(
  landmarks2D: Point2D[],
  cameraMatrix: Matrix4,
  projectionMatrix: Matrix4,
  depthEstimates?: number[]
): Point3D[] {
  const landmarks3D: Point3D[] = []

  // Create inverse matrices for unprojection
  const invProjection = projectionMatrix.clone().invert()
  const invCamera = cameraMatrix.clone().invert()

  landmarks2D.forEach((point2D, i) => {
    // 1. Convert to Normalized Device Coordinates
    const ndcX = (point2D.x * 2) - 1
    const ndcY = 1 - (point2D.y * 2)  // Flip Y

    // 2. Estimate depth
    const depth = depthEstimates?.[i] || 0.5

    // 3. Unproject to world space
    const clipSpace = new Vector4(ndcX, ndcY, depth, 1)
    clipSpace.applyMatrix4(invProjection)
    clipSpace.divideScalar(clipSpace.w)
    clipSpace.applyMatrix4(invCamera)

    landmarks3D.push({
      x: clipSpace.x,
      y: clipSpace.y,
      z: clipSpace.z
    })
  })

  return landmarks3D
}
```

### Depth Estimation

When 3D world landmarks aren't available, depths are estimated based on hand anatomy:

```typescript
private estimateLandmarkDepths(hand: HandLandmarks): number[] {
  const depths: number[] = []

  // Wrist at base depth
  depths[0] = 0

  // Thumb (extends forward)
  depths[1] = 0.02   // CMC
  depths[2] = 0.04   // MCP
  depths[3] = 0.06   // IP
  depths[4] = 0.08   // Tip

  // Fingers (gradually forward)
  for (let finger = 0; finger < 4; finger++) {
    const base = 5 + finger * 4
    depths[base] = 0.01     // MCP
    depths[base + 1] = 0.03 // PIP
    depths[base + 2] = 0.05 // DIP
    depths[base + 3] = 0.07 // Tip
  }

  return depths
}
```

### Detection Validation

```typescript
validateHandDetection(hand: HandLandmarks): { isValid: boolean, issues: string[] } {
  const issues: string[] = []

  // Check confidence threshold
  if (hand.confidence < 0.7) {
    issues.push(`Low confidence: ${(hand.confidence * 100).toFixed(1)}%`)
  }

  // Check landmark count
  if (hand.landmarks.length !== 21) {
    issues.push(`Missing landmarks: ${hand.landmarks.length}/21`)
  }

  // Check hand size in image
  const bounds = this.getHandBounds(hand.landmarks)
  const width = bounds.max.x - bounds.min.x
  const height = bounds.max.y - bounds.min.y

  if (width < 0.05 || height < 0.05) {
    issues.push('Hand too small in image')
  }

  // Check proportions
  const aspectRatio = width / height
  if (aspectRatio < 0.5 || aspectRatio > 2.0) {
    issues.push(`Unusual proportions: ${aspectRatio.toFixed(2)}`)
  }

  return {
    isValid: issues.length === 0,
    issues
  }
}
```

## HandSegmentationService

The `HandSegmentationService` converts detected landmarks into per-finger masks using Voronoi segmentation.

### Voronoi Segmentation

Voronoi segmentation assigns each pixel to the nearest finger based on landmark distances:

```typescript
segmentFingers(
  handLandmarks: HandLandmarks,
  imageWidth: number,
  imageHeight: number
): FingerSegmentation {
  // 1. Get finger seed points
  const fingerSeeds = this.getFingerSeeds(handLandmarks.landmarks)

  // 2. Initialize masks
  const masks: Record<string, PixelMask> = {
    thumb: createMask(imageWidth, imageHeight),
    index: createMask(imageWidth, imageHeight),
    middle: createMask(imageWidth, imageHeight),
    ring: createMask(imageWidth, imageHeight),
    pinky: createMask(imageWidth, imageHeight),
    palm: createMask(imageWidth, imageHeight)
  }

  // 3. Assign each pixel to nearest finger
  for (let y = 0; y < imageHeight; y++) {
    for (let x = 0; x < imageWidth; x++) {
      const pixel = { x, y }
      const nearestFinger = this.findNearestFinger(pixel, fingerSeeds, handLandmarks.landmarks[0])

      if (nearestFinger) {
        const idx = y * imageWidth + x
        masks[nearestFinger].data[idx] = 255
      }
    }
  }

  // 4. Clean up masks
  Object.keys(masks).forEach(finger => {
    masks[finger].data = this.cleanupMask(masks[finger].data, imageWidth, imageHeight)
  })

  return masks as FingerSegmentation
}
```

### Finger Seeds

Seeds are the landmark points that define each finger:

```typescript
private getFingerSeeds(landmarks: Point3D[]): Record<string, Point2D[]> {
  return {
    thumb: [
      { x: landmarks[1].x, y: landmarks[1].y },  // CMC
      { x: landmarks[2].x, y: landmarks[2].y },  // MCP
      { x: landmarks[3].x, y: landmarks[3].y },  // IP
      { x: landmarks[4].x, y: landmarks[4].y }   // Tip
    ],
    index: [
      { x: landmarks[5].x, y: landmarks[5].y },  // MCP
      { x: landmarks[6].x, y: landmarks[6].y },  // PIP
      { x: landmarks[7].x, y: landmarks[7].y },  // DIP
      { x: landmarks[8].x, y: landmarks[8].y }   // Tip
    ],
    // ... similar for middle, ring, pinky
    palm: [
      { x: landmarks[0].x, y: landmarks[0].y },   // Wrist
      { x: landmarks[1].x, y: landmarks[1].y },   // Thumb CMC
      { x: landmarks[5].x, y: landmarks[5].y },   // Index MCP
      { x: landmarks[9].x, y: landmarks[9].y },   // Middle MCP
      { x: landmarks[13].x, y: landmarks[13].y }, // Ring MCP
      { x: landmarks[17].x, y: landmarks[17].y }  // Pinky MCP
    ]
  }
}
```

### Morphological Operations

Masks are cleaned using erosion, dilation, and hole filling:

```typescript
private cleanupMask(mask: Uint8Array, width: number, height: number): Uint8Array {
  // 1. Erode (remove small protrusions)
  let result = this.erode(mask, width, height, 2)

  // 2. Dilate (restore size)
  result = this.dilate(result, width, height, 3)

  // 3. Fill holes
  result = this.fillHoles(result, width, height, 10)

  return result
}
```

**Erosion** (shrink boundaries):
```typescript
private erode(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const result = new Uint8Array(mask.length)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x

      // Check if all neighbors within radius are set
      let allSet = true
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx
          const ny = y + dy

          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            if (mask[ny * width + nx] === 0) {
              allSet = false
              break
            }
          }
        }
        if (!allSet) break
      }

      result[idx] = allSet ? 255 : 0
    }
  }

  return result
}
```

### Vertex Segmentation

2D finger masks are projected onto 3D vertices:

```typescript
segmentMeshVertices(
  mesh: SkinnedMesh,
  fingerSegmentation: FingerSegmentation,
  handCapture: HandCaptureResult
): VertexSegmentation {
  const geometry = mesh.geometry
  const positions = geometry.attributes.position

  const vertexSegments: VertexSegmentation = {
    thumb: [], index: [], middle: [], ring: [], pinky: [], palm: []
  }

  // Build view-projection matrix
  const viewProjectionMatrix = new Matrix4()
  viewProjectionMatrix.multiplyMatrices(
    handCapture.projectionMatrix,
    handCapture.cameraMatrix
  )

  // Project each vertex to screen space
  for (let i = 0; i < positions.count; i++) {
    // 1. Get vertex in world space
    const vertex = new Vector3(
      positions.getX(i),
      positions.getY(i),
      positions.getZ(i)
    )
    vertex.applyMatrix4(mesh.matrixWorld)

    // 2. Project to NDC
    const projected = new Vector4(vertex.x, vertex.y, vertex.z, 1.0)
    projected.applyMatrix4(viewProjectionMatrix)

    const ndcX = projected.x / projected.w
    const ndcY = projected.y / projected.w

    // 3. Convert to pixel coordinates
    const pixelX = Math.floor((ndcX + 1) * 0.5 * fingerSegmentation.palm.width)
    const pixelY = Math.floor((1 - ndcY) * 0.5 * fingerSegmentation.palm.height)

    // 4. Check which finger mask contains this pixel
    if (pixelX >= 0 && pixelX < fingerSegmentation.palm.width &&
        pixelY >= 0 && pixelY < fingerSegmentation.palm.height) {

      const pixelIdx = pixelY * fingerSegmentation.palm.width + pixelX

      if (fingerSegmentation.thumb.data[pixelIdx] === 255) {
        vertexSegments.thumb.push(i)
      } else if (fingerSegmentation.index.data[pixelIdx] === 255) {
        vertexSegments.index.push(i)
      }
      // ... check other fingers
    }
  }

  return vertexSegments
}
```

## Bone Creation

Bones are created from the detected landmarks and added to the skeleton hierarchy.

### Bone Hierarchy

Each finger gets 3-4 bones:

```
Wrist (existing bone)
 ├─> Thumb_CMC
 │    └─> Thumb_MCP
 │         └─> Thumb_IP
 │              └─> Thumb_Tip
 ├─> Index_MCP
 │    └─> Index_PIP
 │         └─> Index_DIP
 │              └─> Index_Tip
 ├─> Middle_MCP
 │    └─> Middle_PIP
 │         └─> Middle_DIP
 │              └─> Middle_Tip
 ├─> Ring_MCP
 │    └─> Ring_PIP
 │         └─> Ring_DIP
 │              └─> Ring_Tip
 └─> Pinky_MCP
      └─> Pinky_PIP
           └─> Pinky_DIP
                └─> Pinky_Tip

Total: 17 bones per hand
```

### Bone Creation Algorithm

```typescript
private createHandBones(
  wristBone: Bone,
  landmarks3D: Point3D[],
  side: 'left' | 'right'
): HandBoneStructure {
  const boneNames = HAND_BONE_NAMES[side]
  const bones: HandBoneStructure = {
    wrist: wristBone,
    fingers: {
      thumb: [],
      index: [],
      middle: [],
      ring: [],
      pinky: []
    }
  }

  // Get bone positions from landmarks
  const bonePositions = this.calculateBonePositions(landmarks3D, side)

  // Create bones for each finger
  const fingers = ['thumb', 'index', 'middle', 'ring', 'pinky']

  fingers.forEach(finger => {
    const positions = bonePositions[finger]
    const names = boneNames[finger]

    let parentBone = wristBone

    // Create bone chain
    for (let i = 1; i < positions.length; i++) {
      const bone = new Bone()
      bone.name = names[i - 1]

      // Calculate local position (relative to parent)
      const parentWorldPos = new Vector3()
      parentBone.getWorldPosition(parentWorldPos)

      const boneWorldPos = new Vector3(
        positions[i].x,
        positions[i].y,
        positions[i].z
      )

      const localPos = boneWorldPos.sub(parentWorldPos)
      bone.position.copy(localPos)

      // Add to hierarchy
      parentBone.add(bone)
      bones.fingers[finger].push(bone)

      parentBone = bone
    }
  })

  return bones
}
```

### Position Calculation

```typescript
private calculateBonePositions(
  landmarks3D: Point3D[],
  side: 'left' | 'right'
): Record<string, Point3D[]> {
  const bones: Record<string, Point3D[]> = {}

  bones.thumb = [
    landmarks3D[0],  // Wrist (start)
    landmarks3D[1],  // CMC
    landmarks3D[2],  // MCP
    landmarks3D[3],  // IP
    landmarks3D[4]   // Tip
  ]

  bones.index = [
    landmarks3D[0],  // Wrist (start)
    landmarks3D[5],  // MCP
    landmarks3D[6],  // PIP
    landmarks3D[7],  // DIP
    landmarks3D[8]   // Tip
  ]

  // ... similar for middle, ring, pinky

  return bones
}
```

### Adding to Skeleton

```typescript
// Find the skeleton
let skeleton: Skeleton | null = null
const findSkeletonInScene = (obj: Object3D): Skeleton | null => {
  if (obj instanceof SkinnedMesh && obj.skeleton) {
    if (obj.skeleton.bones.includes(wristBone)) {
      return obj.skeleton
    }
  }

  for (const child of obj.children) {
    const found = findSkeletonInScene(child)
    if (found) return found
  }

  return null
}

skeleton = findSkeletonInScene(model)

if (skeleton) {
  // Add all new bones to skeleton
  Object.values(bones.fingers).forEach(fingerBones => {
    fingerBones.forEach(bone => {
      if (!skeleton.bones.includes(bone)) {
        skeleton.bones.push(bone)
      }
    })
  })

  skeleton.update()
}
```

## Weight Assignment

Weights determine how much each bone influences each vertex.

### Distance-Based Weighting

```typescript
private calculateFingerWeights(
  vertexIdx: number,
  fingerBones: Bone[],
  geometry: BufferGeometry,
  skeleton: Skeleton
): Array<{ boneIndex: number, weight: number }> {
  const position = geometry.attributes.position
  const vertex = new Vector3(
    position.getX(vertexIdx),
    position.getY(vertexIdx),
    position.getZ(vertexIdx)
  )

  const weights: Array<{ boneIndex: number, weight: number }> = []

  fingerBones.forEach(bone => {
    const boneIndex = skeleton.bones.indexOf(bone)
    if (boneIndex === -1) return

    // Get bone world position
    const bonePos = new Vector3()
    bone.getWorldPosition(bonePos)

    // Calculate distance-based weight
    const distance = vertex.distanceTo(bonePos)
    const weight = 1 / (1 + distance * distance * 10)  // Falloff function

    if (weight > 0.01) {
      weights.push({ boneIndex, weight })
    }
  })

  // Normalize weights
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0)
  if (totalWeight > 0) {
    weights.forEach(w => w.weight /= totalWeight)
  }

  return weights
}
```

### Weight Smoothing

```typescript
private smoothWeights(
  geometry: BufferGeometry,
  iterations: number
): void {
  const skinWeight = geometry.attributes.skinWeight
  const skinIndex = geometry.attributes.skinIndex

  // Build vertex neighbors
  const neighbors = this.buildVertexNeighbors(geometry)

  for (let iter = 0; iter < iterations; iter++) {
    const newWeights: number[] = []

    for (let i = 0; i < skinWeight.count / 4; i++) {
      const viNeighbors = neighbors.get(i) || []

      // Collect bone influences from neighbors
      const boneWeights = new Map<number, number>()

      // Add current vertex weights
      for (let k = 0; k < 4; k++) {
        const boneIndex = skinIndex.getX(i * 4 + k)
        const weight = skinWeight.getX(i * 4 + k)
        if (weight > 0) {
          boneWeights.set(boneIndex, (boneWeights.get(boneIndex) || 0) + weight)
        }
      }

      // Add neighbor weights (with reduced influence)
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

      // Normalize and store
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

    // Apply new weights
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

## SimpleHandRiggingService

For cases where MediaPipe detection fails, the `SimpleHandRiggingService` provides a procedural fallback.

### Procedural Bone Generation

```typescript
class SimpleHandRiggingService {
  generateProceduralHand(
    wristBone: Bone,
    side: 'left' | 'right'
  ): HandBoneStructure {
    // Standard finger lengths (in meters)
    const fingerLengths = {
      thumb: [0.04, 0.03, 0.025],      // CMC, MCP, IP
      index: [0.045, 0.03, 0.02],      // MCP, PIP, DIP
      middle: [0.05, 0.035, 0.025],    // MCP, PIP, DIP
      ring: [0.048, 0.032, 0.022],     // MCP, PIP, DIP
      pinky: [0.04, 0.025, 0.018]      // MCP, PIP, DIP
    }

    // Create bones at standard positions
    const bones = this.createBonesFromLengths(wristBone, fingerLengths, side)

    return bones
  }
}
```

## GLB Export

The final rigged model is exported to GLB format:

```typescript
private async exportModel(model: Object3D): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    this.exporter.parse(
      model,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(result)
        } else {
          reject(new Error('Expected ArrayBuffer from exporter'))
        }
      },
      (error) => reject(error),
      {
        binary: true,           // GLB format
        embedImages: true,      // Include textures
        maxTextureSize: 4096    // Reasonable limit
      }
    )
  })
}
```

## Performance Optimization

### GPU Acceleration

TensorFlow.js automatically uses WebGPU backend for GPU acceleration:

```typescript
// Verify GPU backend
console.log('Backend:', tf.getBackend())  // Should be 'webgpu'

// Force GPU if needed
await tf.setBackend('webgpu')
```

### Capture Resolution

Lower resolution = faster detection, but less accurate:

```
512x512:  ~500ms detection, good accuracy
256x256:  ~200ms detection, acceptable accuracy
128x128:  ~100ms detection, poor accuracy

Recommended: 512x512 for production
```

### Parallel Processing

Process both hands simultaneously:

```typescript
const [leftResult, rightResult] = await Promise.all([
  this.processHand(model, leftWristInfo, options),
  this.processHand(model, rightWristInfo, options)
])
```

## Conclusion

The Asset Forge hand rigging system demonstrates how modern AI (MediaPipe Hands) can be integrated into a 3D asset pipeline to automate complex tasks like finger bone creation and weight painting. By combining orthographic rendering, TensorFlow.js inference, Voronoi segmentation, and procedural bone generation, the system achieves production-quality hand rigging in just a few seconds.

Key takeaways:

1. **Orthographic views** work better than perspective for AI detection
2. **Multi-attempt strategies** improve success rates
3. **Voronoi segmentation** cleanly separates finger regions
4. **Distance-based weighting** provides natural deformation
5. **Fallback systems** ensure robustness

This architecture can be extended to other auto-rigging tasks like facial rigging, foot bones, or even full-body IK chains.
