/**
 * CustomSkeletonHelper - Enhanced SkeletonHelper with clickable joint spheres
 * Based on Mesh2Motion's CustomSkeletonHelper
 */

import * as THREE from 'three'

const _vector = new THREE.Vector3()
const _boneMatrix = new THREE.Matrix4()
const _matrixWorldInv = new THREE.Matrix4()

export class CustomSkeletonHelper extends THREE.LineSegments {
  public isSkeletonHelper: boolean
  public type: string
  public root: THREE.Object3D
  public bones: THREE.Bone[]
  private readonly joint_points: THREE.Points
  private readonly jointTexture = new THREE.TextureLoader().load('/images/skeleton-joint-point.png')

  constructor(rootBone: THREE.Bone, options: { linewidth?: number; color?: number; jointColor?: number } = {}) {
    const bones = CustomSkeletonHelper.getBoneList(rootBone)
    const geometry = new THREE.BufferGeometry()

    const vertices: number[] = []
    const colors: number[] = []
    const color = new THREE.Color(options.color || 0x00ff00)

    for (let i = 0; i < bones.length; i++) {
      const bone = bones[i]
      if (bone.parent && (bone.parent as any).isBone) {
        vertices.push(0, 0, 0)
        vertices.push(0, 0, 0)
        colors.push(color.r, color.g, color.b)
        colors.push(color.r, color.g, color.b)
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      depthTest: false,
      depthWrite: false,
      transparent: true
    })

    super(geometry, material)

    this.isSkeletonHelper = true
    this.type = 'CustomSkeletonHelper'
    this.root = rootBone
    this.bones = bones
    this.matrix = rootBone.matrixWorld
    this.matrixAutoUpdate = false

    // Add points for joints with texture (matching Mesh2Motion)
    const pointsGeometry = new THREE.BufferGeometry()
    const pointsMaterial = new THREE.PointsMaterial({
      size: 20,
      color: options.jointColor || 0xffffff,
      depthTest: false,
      sizeAttenuation: false,
      map: this.jointTexture,
      transparent: true
    })

    const pointPositions = new THREE.Float32BufferAttribute(bones.length * 3, 3)
    pointsGeometry.setAttribute('position', pointPositions)

    this.joint_points = new THREE.Points(pointsGeometry, pointsMaterial)
    this.add(this.joint_points)
  }

  updateMatrixWorld(force?: boolean): void {
    const bones = this.bones
    const pointPositions = this.joint_points.geometry.getAttribute('position')
    const positions = this.geometry.getAttribute('position')

    _matrixWorldInv.copy(this.root.matrixWorld).invert()

    let lineIndex = 0
    for (let i = 0; i < bones.length; i++) {
      const bone = bones[i]
      _boneMatrix.multiplyMatrices(_matrixWorldInv, bone.matrixWorld)
      _vector.setFromMatrixPosition(_boneMatrix)
      pointPositions.setXYZ(i, _vector.x, _vector.y, _vector.z)

      if (bone.parent && (bone.parent as any).isBone) {
        _boneMatrix.multiplyMatrices(_matrixWorldInv, bone.parent.matrixWorld)
        _vector.setFromMatrixPosition(_boneMatrix)
        positions.setXYZ(lineIndex * 2, _vector.x, _vector.y, _vector.z)

        _boneMatrix.multiplyMatrices(_matrixWorldInv, bone.matrixWorld)
        _vector.setFromMatrixPosition(_boneMatrix)
        positions.setXYZ(lineIndex * 2 + 1, _vector.x, _vector.y, _vector.z)
        lineIndex++
      }
    }

    pointPositions.needsUpdate = true
    positions.needsUpdate = true

    this.geometry.computeBoundingBox()
    this.geometry.computeBoundingSphere()

    super.updateMatrixWorld(force)
  }

  setJointsVisible(visible: boolean): void {
    this.joint_points.visible = visible
  }

  dispose(): void {
    this.geometry.dispose()
    if (this.material instanceof THREE.Material) this.material.dispose()
    this.joint_points.geometry.dispose()
    if (this.joint_points.material instanceof THREE.Material) this.joint_points.material.dispose()
  }

  private static getBoneList(object: THREE.Object3D): THREE.Bone[] {
    const boneList: THREE.Bone[] = []

    if (object instanceof THREE.Bone) {
      boneList.push(object)
    }

    for (let i = 0; i < object.children.length; i++) {
      boneList.push(...this.getBoneList(object.children[i]))
    }

    return boneList
  }
}

