import * as THREE from 'three'
import { GLTFExportResult, GLTFNode } from '../../types/gltf'

/**
 * Diagnostic utilities for understanding bone scaling issues
 */
export class BoneDiagnostics {
  /**
   * Analyze a skeleton and provide detailed diagnostics
   */
  static analyzeSkeletonForExport(skeleton: THREE.Skeleton, name: string = 'Skeleton'): void {
    console.log(`\n=== BONE DIAGNOSTICS: ${name} ===`)
    
    // Calculate various metrics
    const bones = skeleton.bones
    const rootBones = bones.filter(b => !b.parent || !(b.parent instanceof THREE.Bone))
    
    console.log(`Total bones: ${bones.length}`)
    console.log(`Root bones: ${rootBones.length}`)
    
    // Analyze bone distances
    const distances: number[] = []
    bones.forEach(bone => {
      if (bone.children.length > 0) {
        bone.children.forEach(child => {
          if (child instanceof THREE.Bone) {
            const dist = bone.position.distanceTo(child.position)
            distances.push(dist)
          }
        })
      }
    })
    
    if (distances.length > 0) {
      const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length
      const minDist = Math.min(...distances)
      const maxDist = Math.max(...distances)
      
      console.log(`\nBone Distance Analysis:`)
      console.log(`  Average: ${avgDist.toFixed(3)} units`)
      console.log(`  Min: ${minDist.toFixed(3)} units`)
      console.log(`  Max: ${maxDist.toFixed(3)} units`)
      
      // Guess the units
      if (avgDist > 10) {
        console.log(`  Likely units: CENTIMETERS (typical human bone ~10-50cm)`)
      } else if (avgDist > 0.1 && avgDist < 1) {
        console.log(`  Likely units: METERS (typical human bone ~0.1-0.5m)`)
      } else {
        console.log(`  Units unclear - might be custom scale`)
      }
    }
    
    // Analyze world transforms
    console.log(`\nRoot Bone World Transforms:`)
    rootBones.forEach(bone => {
      const worldPos = new THREE.Vector3()
      const worldScale = new THREE.Vector3()
      bone.getWorldPosition(worldPos)
      bone.getWorldScale(worldScale)
      
      console.log(`  ${bone.name}:`)
      console.log(`    World pos: ${worldPos.toArray().map(v => v.toFixed(3))}`)
      console.log(`    World scale: ${worldScale.toArray().map(v => v.toFixed(3))}`)
    })
    
    // Check for scale issues
    const hasNonUniformScale = bones.some(bone => {
      const s = bone.scale
      return Math.abs(s.x - 1) > 0.001 || Math.abs(s.y - 1) > 0.001 || Math.abs(s.z - 1) > 0.001
    })
    
    if (hasNonUniformScale) {
      console.log(`\nWARNING: Some bones have non-uniform scale!`)
      bones.forEach(bone => {
        const s = bone.scale
        if (Math.abs(s.x - 1) > 0.001 || Math.abs(s.y - 1) > 0.001 || Math.abs(s.z - 1) > 0.001) {
          console.log(`  ${bone.name}: scale=${s.toArray()}`)
        }
      })
    }
    
    console.log(`\n=== END DIAGNOSTICS ===\n`)
  }
  
  /**
   * Create a test skeleton with known dimensions
   */
  static createTestSkeleton(scale: 'meters' | 'centimeters' = 'meters'): THREE.Skeleton {
    const scaleFactor = scale === 'meters' ? 1 : 100
    
    // Create a simple 3-bone chain
    const root = new THREE.Bone()
    root.name = 'TestRoot'
    root.position.set(0, 0, 0)
    
    const middle = new THREE.Bone()
    middle.name = 'TestMiddle'
    middle.position.set(0, 0.5 * scaleFactor, 0) // 50cm or 0.5m
    root.add(middle)
    
    const end = new THREE.Bone()
    end.name = 'TestEnd'
    end.position.set(0, 0.3 * scaleFactor, 0) // 30cm or 0.3m
    middle.add(end)
    
    const bones = [root, middle, end]
    const skeleton = new THREE.Skeleton(bones)
    
    console.log(`Created test skeleton in ${scale}:`)
    console.log(`  Root->Middle: ${middle.position.y} units`)
    console.log(`  Middle->End: ${end.position.y} units`)
    
    return skeleton
  }
  
  /**
   * Compare two skeletons to understand scaling differences
   */
  static compareSkeletons(skeleton1: THREE.Skeleton, name1: string, skeleton2: THREE.Skeleton, name2: string): void {
    console.log(`\n=== SKELETON COMPARISON ===`)
    console.log(`Comparing "${name1}" vs "${name2}"`)
    
    // Compare bone counts
    console.log(`\nBone counts:`)
    console.log(`  ${name1}: ${skeleton1.bones.length} bones`)
    console.log(`  ${name2}: ${skeleton2.bones.length} bones`)
    
    // Compare average bone distances
    const getAvgDistance = (skeleton: THREE.Skeleton): number => {
      const distances: number[] = []
      skeleton.bones.forEach(bone => {
        bone.children.forEach(child => {
          if (child instanceof THREE.Bone) {
            distances.push(bone.position.distanceTo(child.position))
          }
        })
      })
      return distances.length > 0 ? distances.reduce((a, b) => a + b, 0) / distances.length : 0
    }
    
    const avg1 = getAvgDistance(skeleton1)
    const avg2 = getAvgDistance(skeleton2)
    
    console.log(`\nAverage bone distances:`)
    console.log(`  ${name1}: ${avg1.toFixed(3)} units`)
    console.log(`  ${name2}: ${avg2.toFixed(3)} units`)
    console.log(`  Ratio: ${(avg1 / avg2).toFixed(3)}`)
    
    console.log(`\n=== END COMPARISON ===\n`)
  }
  
  /**
   * Test how GLTFExporter handles different skeleton configurations
   */
  static async testGLTFExport(skeleton: THREE.Skeleton, geometry: THREE.BufferGeometry): Promise<void> {
    console.log(`\n=== GLTF EXPORT TEST ===`)
    
    const scene = new THREE.Scene()
    const material = new THREE.MeshBasicMaterial()
    
    // Create skinned mesh
    const mesh = new THREE.SkinnedMesh(geometry, material)
    mesh.bind(skeleton)
    
    // Add to scene
    const rootBones = skeleton.bones.filter(b => !b.parent)
    rootBones.forEach(root => scene.add(root))
    scene.add(mesh)
    
    // Export
    const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
    const exporter = new GLTFExporter()
    
    try {
      const gltf = await exporter.parseAsync(scene, { binary: false }) as GLTFExportResult
      
      console.log(`\nGLTF Structure:`)
      console.log(`  Nodes: ${gltf.nodes?.length || 0}`)
      console.log(`  Skins: ${gltf.skins?.length || 0}`)
      
      if (gltf.nodes) {
        console.log(`\nNode transforms:`)
        gltf.nodes.forEach((node: GLTFNode, i: number) => {
          if (node.translation || node.scale) {
            console.log(`  Node ${i} (${node.name || 'unnamed'}):`)
            if (node.translation) console.log(`    Translation: ${node.translation}`)
            if (node.scale) console.log(`    Scale: ${node.scale}`)
          }
        })
      }
    } catch (error) {
      console.error('GLTF export test failed:', error)
    }
    
    console.log(`\n=== END EXPORT TEST ===\n`)
  }
}