/**
 * Hand Segmentation Service
 * Creates finger masks and segments for proper bone weight assignment
 */

import * as THREE from 'three'
import { Point2D, Point3D, HandLandmarks } from './HandPoseDetectionService'

export interface PixelMask {
  width: number
  height: number
  data: Uint8Array // Binary mask (0 or 255)
  bounds: {
    minX: number
    maxX: number
    minY: number
    maxY: number
  }
}

export interface FingerSegmentation {
  thumb: PixelMask
  index: PixelMask
  middle: PixelMask
  ring: PixelMask
  pinky: PixelMask
  palm: PixelMask
}

export interface VertexSegmentation {
  thumb: number[] // Vertex indices
  index: number[]
  middle: number[]
  ring: number[]
  pinky: number[]
  palm: number[]
}

export class HandSegmentationService {
  // Finger joint connections for drawing boundaries
  private readonly FINGER_CONNECTIONS = {
    thumb: [0, 1, 2, 3, 4],
    index: [0, 5, 6, 7, 8],
    middle: [0, 9, 10, 11, 12],
    ring: [0, 13, 14, 15, 16],
    pinky: [0, 17, 18, 19, 20]
  }
  
  // Voronoi region colors for debugging
  private readonly FINGER_COLORS = {
    thumb: [255, 0, 0],     // Red
    index: [0, 255, 0],     // Green
    middle: [0, 0, 255],    // Blue
    ring: [255, 255, 0],    // Yellow
    pinky: [255, 0, 255],   // Magenta
    palm: [128, 128, 128]   // Gray
  }
  
  /**
   * Segment fingers from hand landmarks using Voronoi regions
   */
  segmentFingers(
    handLandmarks: HandLandmarks,
    imageWidth: number,
    imageHeight: number
  ): FingerSegmentation {
    console.log('🖐️ Segmenting hand into finger regions...')
    
    // Initialize masks
    const masks: Record<string, PixelMask> = {}
    const fingers = ['thumb', 'index', 'middle', 'ring', 'pinky', 'palm']
    
    fingers.forEach(finger => {
      masks[finger] = {
        width: imageWidth,
        height: imageHeight,
        data: new Uint8Array(imageWidth * imageHeight),
        bounds: {
          minX: imageWidth,
          maxX: 0,
          minY: imageHeight,
          maxY: 0
        }
      }
    })
    
    // Get finger tip and base positions
    const fingerSeeds = this.getFingerSeeds(handLandmarks.landmarks)
    
    // Create Voronoi segmentation
    for (let y = 0; y < imageHeight; y++) {
      for (let x = 0; x < imageWidth; x++) {
        const pixel = { x, y }
        const nearestFinger = this.findNearestFinger(pixel, fingerSeeds, handLandmarks.landmarks[0])
        
        if (nearestFinger) {
          const idx = y * imageWidth + x
          masks[nearestFinger].data[idx] = 255
          
          // Update bounds
          masks[nearestFinger].bounds.minX = Math.min(masks[nearestFinger].bounds.minX, x)
          masks[nearestFinger].bounds.maxX = Math.max(masks[nearestFinger].bounds.maxX, x)
          masks[nearestFinger].bounds.minY = Math.min(masks[nearestFinger].bounds.minY, y)
          masks[nearestFinger].bounds.maxY = Math.max(masks[nearestFinger].bounds.maxY, y)
        }
      }
    }
    
    // Apply morphological operations to clean up masks
    fingers.forEach(finger => {
      masks[finger].data = this.cleanupMask(masks[finger].data, imageWidth, imageHeight)
    })
    
    // Ensure no overlap between fingers
    this.resolveOverlaps(masks, imageWidth, imageHeight)
    
    return {
      thumb: masks.thumb,
      index: masks.index,
      middle: masks.middle,
      ring: masks.ring,
      pinky: masks.pinky,
      palm: masks.palm
    }
  }
  
  /**
   * Get seed points for each finger
   */
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
      middle: [
        { x: landmarks[9].x, y: landmarks[9].y },   // MCP
        { x: landmarks[10].x, y: landmarks[10].y }, // PIP
        { x: landmarks[11].x, y: landmarks[11].y }, // DIP
        { x: landmarks[12].x, y: landmarks[12].y }  // Tip
      ],
      ring: [
        { x: landmarks[13].x, y: landmarks[13].y }, // MCP
        { x: landmarks[14].x, y: landmarks[14].y }, // PIP
        { x: landmarks[15].x, y: landmarks[15].y }, // DIP
        { x: landmarks[16].x, y: landmarks[16].y }  // Tip
      ],
      pinky: [
        { x: landmarks[17].x, y: landmarks[17].y }, // MCP
        { x: landmarks[18].x, y: landmarks[18].y }, // PIP
        { x: landmarks[19].x, y: landmarks[19].y }, // DIP
        { x: landmarks[20].x, y: landmarks[20].y }  // Tip
      ],
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
  
  /**
   * Find nearest finger for a pixel using weighted distance
   */
  private findNearestFinger(
    pixel: Point2D,
    fingerSeeds: Record<string, Point2D[]>,
    wristPos: Point3D
  ): string | null {
    let minDistance = Infinity
    let nearestFinger: string | null = null
    
    // Check if pixel is too far from hand (background)
    const wristDist = this.distance2D(pixel, { x: wristPos.x, y: wristPos.y })
    if (wristDist > 300) { // Threshold in pixels
      return null
    }
    
    // Find nearest finger
    Object.entries(fingerSeeds).forEach(([finger, seeds]) => {
      const dist = this.minDistanceToSeeds(pixel, seeds, finger === 'palm')
      if (dist < minDistance) {
        minDistance = dist
        nearestFinger = finger
      }
    })
    
    return nearestFinger
  }
  
  /**
   * Calculate minimum distance to seed points
   */
  private minDistanceToSeeds(pixel: Point2D, seeds: Point2D[], isPalm: boolean): number {
    let minDist = Infinity
    
    seeds.forEach(seed => {
      const dist = this.distance2D(pixel, seed)
      // Apply weight for palm to make it less "greedy"
      const weightedDist = isPalm ? dist * 1.5 : dist
      minDist = Math.min(minDist, weightedDist)
    })
    
    return minDist
  }
  
  /**
   * 2D Euclidean distance
   */
  private distance2D(p1: Point2D, p2: Point2D): number {
    const dx = p1.x - p2.x
    const dy = p1.y - p2.y
    return Math.sqrt(dx * dx + dy * dy)
  }
  
  /**
   * Clean up mask using morphological operations
   */
  private cleanupMask(mask: Uint8Array, width: number, height: number): Uint8Array {
    // Apply erosion followed by dilation (opening)
    let result = this.erode(mask, width, height, 2)
    result = this.dilate(result, width, height, 3)
    
    // Fill small holes
    result = this.fillHoles(result, width, height, 10)
    
    return result
  }
  
  /**
   * Morphological erosion
   */
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
              const nidx = ny * width + nx
              if (mask[nidx] === 0) {
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
  
  /**
   * Morphological dilation
   */
  private dilate(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
    const result = new Uint8Array(mask.length)
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        
        // Check if any neighbor within radius is set
        let anySet = false
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx
            const ny = y + dy
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nidx = ny * width + nx
              if (mask[nidx] === 255) {
                anySet = true
                break
              }
            }
          }
          if (anySet) break
        }
        
        result[idx] = anySet ? 255 : 0
      }
    }
    
    return result
  }
  
  /**
   * Fill small holes in mask
   */
  private fillHoles(mask: Uint8Array, width: number, height: number, maxSize: number): Uint8Array {
    const result = mask.slice()
    const visited = new Uint8Array(mask.length)
    
    // Find holes using flood fill from edges
    const edgeQueue: Point2D[] = []
    
    // Add edge pixels to queue
    for (let x = 0; x < width; x++) {
      edgeQueue.push({ x, y: 0 })
      edgeQueue.push({ x, y: height - 1 })
    }
    for (let y = 1; y < height - 1; y++) {
      edgeQueue.push({ x: 0, y })
      edgeQueue.push({ x: width - 1, y })
    }
    
    // Flood fill from edges to mark background
    this.floodFill(result, visited, edgeQueue, width, height, 0, 1)
    
    // Fill remaining unvisited zeros (holes)
    for (let i = 0; i < result.length; i++) {
      if (result[i] === 0 && visited[i] === 0) {
        result[i] = 255
      }
    }
    
    return result
  }
  
  /**
   * Flood fill algorithm
   */
  private floodFill(
    mask: Uint8Array,
    visited: Uint8Array,
    startQueue: Point2D[],
    width: number,
    height: number,
    targetValue: number,
    fillValue: number
  ): void {
    const queue = [...startQueue]
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    
    while (queue.length > 0) {
      const { x, y } = queue.shift()!
      const idx = y * width + x
      
      if (x < 0 || x >= width || y < 0 || y >= height) continue
      if (visited[idx] === 1) continue
      if (mask[idx] !== targetValue) continue
      
      visited[idx] = fillValue
      
      dirs.forEach(([dx, dy]) => {
        queue.push({ x: x + dx, y: y + dy })
      })
    }
  }
  
  /**
   * Resolve overlaps between finger masks
   */
  private resolveOverlaps(
    masks: Record<string, PixelMask>,
    width: number,
    height: number
  ): void {
    const fingers = ['thumb', 'index', 'middle', 'ring', 'pinky']
    
    // For each pixel, if multiple fingers claim it, assign to nearest
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        
        const claimants: string[] = []
        fingers.forEach(finger => {
          if (masks[finger].data[idx] === 255) {
            claimants.push(finger)
          }
        })
        
        if (claimants.length > 1) {
          // Multiple fingers claim this pixel - resolve conflict
          // For now, just keep the first one and clear others
          claimants.slice(1).forEach(finger => {
            masks[finger].data[idx] = 0
          })
        }
      }
    }
  }
  
  /**
   * Convert 2D segmentation to 3D vertex assignments
   */
  segmentMeshVertices(
    mesh: THREE.SkinnedMesh,
    fingerSegmentation: FingerSegmentation,
    handCapture: { 
      cameraMatrix: THREE.Matrix4, 
      projectionMatrix: THREE.Matrix4,
      side: 'left' | 'right'
    }
  ): VertexSegmentation {
    console.log('🎯 Mapping 2D segmentation to 3D vertices...')
    
    const geometry = mesh.geometry
    const positions = geometry.attributes.position
    const vertexSegments: VertexSegmentation = {
      thumb: [],
      index: [],
      middle: [],
      ring: [],
      pinky: [],
      palm: []
    }
    
    // Get world matrix for the mesh
    mesh.updateWorldMatrix(true, false)
    
    // Combined view-projection matrix
    const viewProjectionMatrix = new THREE.Matrix4()
    viewProjectionMatrix.multiplyMatrices(handCapture.projectionMatrix, handCapture.cameraMatrix)
    
    // Process each vertex
    for (let i = 0; i < positions.count; i++) {
      // Get vertex position in world space
      const vertex = new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      )
      vertex.applyMatrix4(mesh.matrixWorld)
      
      // Project to screen space
      const projected = new THREE.Vector4(vertex.x, vertex.y, vertex.z, 1.0)
      projected.applyMatrix4(viewProjectionMatrix)
      
      // Convert to normalized device coordinates
      const ndcX = projected.x / projected.w
      const ndcY = projected.y / projected.w
      
      // Convert to pixel coordinates
      const pixelX = Math.floor((ndcX + 1) * 0.5 * fingerSegmentation.palm.width)
      const pixelY = Math.floor((1 - ndcY) * 0.5 * fingerSegmentation.palm.height)
      
      // Check which finger mask contains this pixel
      if (pixelX >= 0 && pixelX < fingerSegmentation.palm.width &&
          pixelY >= 0 && pixelY < fingerSegmentation.palm.height) {
        
        const pixelIdx = pixelY * fingerSegmentation.palm.width + pixelX
        
        // Check each finger mask
        if (fingerSegmentation.thumb.data[pixelIdx] === 255) {
          vertexSegments.thumb.push(i)
        } else if (fingerSegmentation.index.data[pixelIdx] === 255) {
          vertexSegments.index.push(i)
        } else if (fingerSegmentation.middle.data[pixelIdx] === 255) {
          vertexSegments.middle.push(i)
        } else if (fingerSegmentation.ring.data[pixelIdx] === 255) {
          vertexSegments.ring.push(i)
        } else if (fingerSegmentation.pinky.data[pixelIdx] === 255) {
          vertexSegments.pinky.push(i)
        } else if (fingerSegmentation.palm.data[pixelIdx] === 255) {
          vertexSegments.palm.push(i)
        }
      }
    }
    
    // Log statistics
    console.log('📊 Vertex segmentation results:')
    Object.entries(vertexSegments).forEach(([finger, vertices]) => {
      console.log(`  ${finger}: ${vertices.length} vertices`)
    })
    
    return vertexSegments
  }
  
  /**
   * Visualize segmentation as colored image
   */
  visualizeSegmentation(segmentation: FingerSegmentation): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = segmentation.palm.width
    canvas.height = segmentation.palm.height
    
    const ctx = canvas.getContext('2d')!
    const imageData = ctx.createImageData(canvas.width, canvas.height)
    
    // Color each pixel based on finger assignment
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const idx = y * canvas.width + x
        const pixelIdx = idx * 4
        
        let color = [0, 0, 0] // Black background
        
        if (segmentation.thumb.data[idx] === 255) {
          color = this.FINGER_COLORS.thumb
        } else if (segmentation.index.data[idx] === 255) {
          color = this.FINGER_COLORS.index
        } else if (segmentation.middle.data[idx] === 255) {
          color = this.FINGER_COLORS.middle
        } else if (segmentation.ring.data[idx] === 255) {
          color = this.FINGER_COLORS.ring
        } else if (segmentation.pinky.data[idx] === 255) {
          color = this.FINGER_COLORS.pinky
        } else if (segmentation.palm.data[idx] === 255) {
          color = this.FINGER_COLORS.palm
        }
        
        imageData.data[pixelIdx] = color[0]
        imageData.data[pixelIdx + 1] = color[1]
        imageData.data[pixelIdx + 2] = color[2]
        imageData.data[pixelIdx + 3] = 255
      }
    }
    
    ctx.putImageData(imageData, 0, 0)
    return canvas
  }
} 