import THREE from '../extras/three'

import type { MeshData } from '../types/nodes'

import { getTextureBytesFromMaterial } from '../extras/getTextureBytesFromMaterial'
import { getTrianglesFromGeometry } from '../extras/getTrianglesFromGeometry'
import { Node } from './Node'
import { getMountedContext } from './NodeContext'

// OctreeItem interface for stage operations
interface OctreeItem {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  matrix: THREE.Matrix4;
  getEntity: () => unknown;
  node?: unknown;
}

// Handle interface for stage operations
interface StageHandle {
  move?: (matrix: THREE.Matrix4) => void;
  destroy?: () => void;
}

const defaults = {
  type: 'box',
  width: 1,
  height: 1,
  depth: 1,
  radius: 0.5,
  geometry: null,
  material: null,
  linked: true,
  castShadow: true,
  receiveShadow: true,
  visible: true, // DEPRECATED: use Node.active
}

const types = ['box', 'sphere', 'geometry']



const boxes = {}
const getBox = (width, height, depth) => {
  const key = `${width},${height},${depth}`
  if (!boxes[key]) {
    boxes[key] = new THREE.BoxGeometry(width, height, depth)
  }
  return boxes[key]
}

const spheres = {}
const getSphere = radius => {
  const key = radius
  if (!spheres[key]) {
    spheres[key] = new THREE.SphereGeometry(radius, 16, 12)
  }
  return spheres[key]
}

export class Mesh extends Node {
  needsRebuild: boolean = false
  _geometry: THREE.BufferGeometry | null = null
  _type: string = defaults.type
  _visible: boolean = defaults.visible
  handle: StageHandle | null = null
  _material: THREE.Material | null = null
  _linked: boolean = defaults.linked
  _castShadow: boolean = defaults.castShadow
  _receiveShadow: boolean = defaults.receiveShadow
  sItem: OctreeItem | null = null
  _width: number = defaults.width
  _height: number = defaults.height
  _depth: number = defaults.depth
  _radius: number = defaults.radius
  
  constructor(data: MeshData = {}) {
    super(data)
    this.name = 'mesh'

    this.type = data.type ?? defaults.type
    this.width = data.width ?? defaults.width
    this.height = data.height ?? defaults.height
    this.depth = data.depth ?? defaults.depth
    this.radius = data.radius ?? defaults.radius
    this.geometry = (typeof data.geometry === 'string') ? null : (data.geometry ?? null)
    this.material = (typeof data.material === 'string') ? null : (data.material ?? null)
    this.linked = data.linked ?? defaults.linked
    this.castShadow = data.castShadow ?? defaults.castShadow
    this.receiveShadow = data.receiveShadow ?? defaults.receiveShadow
    this.visible = data.visible ?? defaults.visible
  }

  mount() {
    this.needsRebuild = false
    if (!this._geometry) return
    
    const ctx = getMountedContext(this);
    
    let geometry
    if (this._type === 'box') {
      geometry = getBox(this._width, this._height, this._depth)
    } else if (this._type === 'sphere') {
      geometry = getSphere(this._radius)
    } else if (this._type === 'geometry') {
      geometry = this._geometry
    }
    if (this._visible) {
      this.handle = ctx.stage.insert({
        geometry,
        material: this._material!,
        linked: this._linked,
        castShadow: this._castShadow,
        receiveShadow: this._receiveShadow,
        matrix: this.matrixWorld,
        node: this,
      })
    } else {
      this.sItem = {
        matrix: this.matrixWorld,
        geometry,
        material: this._material!,
        getEntity: () => ctx.entity!,
        node: this,
      }
      ctx.stage.octree.insert(this.sItem as never)
    }
  }

  commit(didMove) {
    if (this.needsRebuild) {
      this.unmount()
      this.mount()
      return
    }
    if (didMove) {
      if (this.handle && this.handle.move) {
        this.handle.move(this.matrixWorld)
      }
      if (this.sItem) {
        const ctx = getMountedContext(this);
        ctx.stage.octree.move(this.sItem)
      }
    }
  }

  unmount() {
    if (this.handle && this.handle.destroy) {
      this.handle.destroy()
    }
    if (this.sItem) {
      const ctx = getMountedContext(this);
      ctx.stage.octree.remove(this.sItem)
      this.sItem = null
    }
    this.handle = null
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._type = source._type
    this._width = source._width
    this._height = source._height
    this._depth = source._depth
    this._radius = source._radius
    this._geometry = source._geometry
    this._material = source._material
    this._linked = source._linked
    this._castShadow = source._castShadow
    this._receiveShadow = source._receiveShadow
    this._visible = source._visible
    return this
  }

  applyStats(stats) {
    if (this._geometry && !stats.geometries.has(this._geometry.uuid)) {
      stats.geometries.add(this._geometry.uuid)
      stats.triangles += getTrianglesFromGeometry(this._geometry)
    }
    if (this._material && !stats.materials.has(this._material.uuid)) {
      stats.materials.add(this._material.uuid)
      stats.textureBytes += getTextureBytesFromMaterial(this._material)
    }
  }

  get type() {
    return this._type
  }

  set type(value) {
    if (value === undefined) value = defaults.type
    if (!isType(value)) {
      throw new Error('[mesh] type invalid')
    }
    if (this._type === value) return
    this._type = value
    if (this.handle) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get width() {
    return this._width
  }

  set width(value) {
    if (value === undefined) value = defaults.width

    if (this._width === value) return
    this._width = value
    if (this.handle && this._type === 'box') {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get height() {
    return this._height
  }

  set height(value) {
    if (value === undefined) value = defaults.height

    if (this._height === value) return
    this._height = value
    if (this.handle && this._type === 'box') {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get depth() {
    return this._depth
  }

  set depth(value) {
    if (value === undefined) value = defaults.depth

    if (this._depth === value) return
    this._depth = value
    if (this.handle && this._type === 'box') {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  setSize(width, height, depth) {
    this.width = width
    this.height = height
    this.depth = depth
  }

  get radius() {
    return this._radius
  }

  set radius(value) {
    if (value === undefined) value = defaults.radius

    if (this._radius === value) return
    this._radius = value
    if (this.handle && this._type === 'sphere') {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get geometry() {
    return this._geometry
  }

  set geometry(value: THREE.BufferGeometry | null) {
    this._geometry = value
    this.needsRebuild = true
    this.setDirty()
  }

  get material() {
    return this._material
  }

  set material(value) {
    if (value === undefined) value = defaults.material
    if (value && !value.isMaterial) {
      throw new Error('[mesh] material invalid')
    }
    if (this._material === value) return
    this._material = value
    this.needsRebuild = true
    this.setDirty()
  }

  get linked() {
    return this._linked
  }

  set linked(value) {
    if (value === undefined) value = defaults.linked

    if (this._linked === value) return
    this._linked = value
    this.needsRebuild = true
    this.setDirty()
  }

  get castShadow() {
    return this._castShadow
  }

  set castShadow(value) {
    if (value === undefined) value = defaults.castShadow

    if (this._castShadow === value) return
    this._castShadow = value
    if (this.handle) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get receiveShadow() {
    return this._receiveShadow
  }

  set receiveShadow(value) {
    if (value === undefined) value = defaults.receiveShadow

    if (this._receiveShadow === value) return
    this._receiveShadow = value
    if (this.handle) {
      this.needsRebuild = true
      this.setDirty()
    }
  }

  get visible() {
    return this._visible
  }

  set visible(value) {
    if (value === undefined) value = defaults.visible

    if (this._visible === value) return
    this._visible = value
    this.needsRebuild = true
    this.setDirty()
  }

  getProxy() {
    if (!this.proxy) {
      const self = this
      let proxy = {
        get type() {
          return self.type
        },
        set type(value) {
          self.type = value
        },
        get width() {
          return self.width
        },
        set width(value) {
          self.width = value
        },
        get height() {
          return self.height
        },
        set height(value) {
          self.height = value
        },
        get depth() {
          return self.depth
        },
        set depth(value) {
          self.depth = value
        },
        setSize(width, height, depth) {
          self.setSize(width, height, depth)
        },
        get radius() {
          return self.radius
        },
        set radius(value) {
          self.radius = value
        },
        get geometry() {
          return self.geometry
        },
        set geometry(value) {
          self.geometry = value
        },
        get material() {
          return self.material
        },
        set material(value) {
          throw new Error('[mesh] set material not supported')
          // if (!value) throw new Error('[mesh] material cannot be unset')
          // self.ctx._allowMaterial = true
          // self.material = value._ref
          // self.ctx._allowMaterial = false
          // self.needsRebuild = true
          // self.setDirty()
        },
        get linked() {
          return self.linked
        },
        set linked(value) {
          self.linked = value
        },
        get castShadow() {
          return self.castShadow
        },
        set castShadow(value) {
          self.castShadow = value
        },
        get receiveShadow() {
          return self.receiveShadow
        },
        set receiveShadow(value) {
          self.receiveShadow = value
        },
        get visible() {
          return self.visible
        },
        set visible(value) {
          self.visible = value
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}

function isType(value) {
  return types.includes(value)
}
