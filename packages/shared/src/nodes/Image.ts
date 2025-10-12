/// <reference lib="dom" />

import THREE from '../extras/three'
import CustomShaderMaterial from '../libs/three-custom-shader-material'
import { Node } from './Node'
import type { LoaderResult } from '../types'
import type { ImageData } from '../types/nodes'

// Type guard to check if a value is a valid image source for a texture
function isImageSource(value: unknown): value is TexImageSource {
  if (typeof window === 'undefined') return false; // Not in a browser environment
  if (!value || typeof value !== 'object') return false;

  return (
    value instanceof HTMLImageElement ||
    value instanceof HTMLCanvasElement ||
    value instanceof HTMLVideoElement ||
    value instanceof ImageBitmap ||
    (typeof OffscreenCanvas !== 'undefined' && value instanceof OffscreenCanvas)
  );
}

// Define proper types for image objects
interface HTMLImageLike {
  width: number;
  height: number;
}

// Type guard to check if LoaderResult is image-like
function isImageLike(obj: LoaderResult): obj is HTMLImageElement {
  return obj && typeof obj === 'object' && 'width' in obj && 'height' in obj && 
         typeof (obj as HTMLImageLike).width === 'number' && typeof (obj as HTMLImageLike).height === 'number';
}

// Function to get width/height from LoaderResult
function getImageDimensions(obj: LoaderResult): { width: number; height: number } | null {
  if (isImageLike(obj)) {
    return { width: obj.width, height: obj.height };
  }
  
  // Handle THREE.Texture and THREE.DataTexture
  if (obj && typeof obj === 'object' && 'image' in obj) {
    const texture = obj as THREE.Texture | THREE.DataTexture;
    if (texture.image && 'width' in texture.image && 'height' in texture.image) {
      return { width: texture.image.width, height: texture.image.height };
    }
  }
  
  return null;
}

// OctreeItem interface for stage operations
interface OctreeItem {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  matrix: THREE.Matrix4;
  getEntity: () => unknown;
  node?: unknown;
}

const fits = ['none', 'cover', 'contain']
const pivots = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]

const defaults = {
  src: null,
  width: null,
  height: 1,
  fit: 'contain',
  color: 'black',
  pivot: 'center',
  lit: false,
  doubleside: false,
  castShadow: false,
  receiveShadow: false,
}



export class Image extends Node {
  n: number = 0
  _src: string | null = null
  _width: number | null = null
  _height: number | null = null
  _fit: string = defaults.fit
  _color: string = defaults.color
  _pivot: string = defaults.pivot
  _lit: boolean = defaults.lit
  _doubleside: boolean = defaults.doubleside
  _castShadow: boolean = defaults.castShadow
  _receiveShadow: boolean = defaults.receiveShadow
  needsRebuild: boolean = false
  mesh: THREE.Mesh | null = null
  texture!: THREE.Texture
  sItem: OctreeItem | null = null
  constructor(data: ImageData = {}) {
    super(data)
    this.name = 'image'

    this.src = data.src ?? defaults.src
    this.width = data.width ?? defaults.width
    this.height = data.height ?? defaults.height
    this.fit = data.fit ?? defaults.fit
    this.color = typeof data.color === 'number' ? `#${data.color.toString(16).padStart(6, '0')}` : (data.color ?? defaults.color)
    this.pivot = data.pivot ?? defaults.pivot
    this.lit = data.lit ?? defaults.lit
    this.doubleside = data.doubleside ?? defaults.doubleside
    this.castShadow = data.castShadow ?? defaults.castShadow
    this.receiveShadow = data.receiveShadow ?? defaults.receiveShadow

    this.n = 0
  }

  copy(source, recursive) {
    super.copy(source, recursive)
    this._src = source._src
    this._width = source._width
    this._height = source._height
    this._fit = source._fit
    this._color = source._color
    this._pivot = source._pivot
    this._lit = source._lit
    this._doubleside = source._doubleside
    this._castShadow = source._castShadow
    this._receiveShadow = source._receiveShadow
    return this
  }

  async mount() {
    this.build()
  }

  commit(didMove) {
    if (this.needsRebuild) {
      this.build()
      return
    }
    if (didMove) {
      if (this.mesh) {
        this.mesh.matrixWorld.copy(this.matrixWorld)
      }
    }
  }

  unmount() {
    this.unbuild()
  }

  async build() {
    this.needsRebuild = false
    if (this.ctx!.network!.isServer) return
    if (!this._src) return
    const n = ++this.n
    let image = this.ctx!.loader!.get('image', this._src)
    if (!image) image = await this.ctx!.loader!.load('image', this._src)
    if (this.n !== n) return
    this.unbuild()
    
    // Get image dimensions
    const dimensions = getImageDimensions(image)
    if (!dimensions) {
      console.warn('Loaded image does not have width/height properties:', image)
      return
    }
    
    const imgAspect = dimensions.width / dimensions.height
    let width = this._width
    let height = this._height
    if (width === null && height === null) {
      height = 0
      width = 0
    } else if (width !== null && height === null) {
      height = width / imgAspect
    } else if (height !== null && width === null) {
      width = height * imgAspect
    }
    const geoAspect = width! / height!

    if (image instanceof THREE.Texture) {
      this.texture = image
    } else if (isImageSource(image)) {
      this.texture = new THREE.Texture(image)
    } else {
      console.warn('[Image] Loaded resource is not a valid texture source:', image)
      return
    }
    
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.anisotropy = this.ctx!.graphics!.maxAnisotropy
    this.texture.needsUpdate = true
    if (this._width && this._height) {
      applyFit(this.texture, width, height, this._fit)
    }
    const geometry = new THREE.PlaneGeometry(width!, height!)
    applyPivot(geometry, width!, height!, this._pivot)
    const uniforms = {
      uMap: { value: this.texture },
      uImgAspect: { value: imgAspect },
      uGeoAspect: { value: geoAspect },
      uFit: { value: this._fit === 'cover' ? 1 : this._fit === 'contain' ? 2 : 0 }, // 0 = none, 1 = cover, 2 = contain
      uColor: { value: new THREE.Color(this._color) },
      uTransparent: { value: this._color === 'transparent' ? 1.0 : 0.0 },
    }
    const material = new CustomShaderMaterial({
      baseMaterial: this._lit ? THREE.MeshStandardMaterial : THREE.MeshBasicMaterial,
      ...(this._lit ? { roughness: 1, metalness: 0 } : {}),
      side: this._doubleside ? THREE.DoubleSide : THREE.FrontSide,
      transparent: this._color === 'transparent',
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform float uImgAspect;
        uniform float uGeoAspect;
        uniform float uFit; // 0 = none, 1 = cover, 2 = contain
        uniform vec3 uColor; 
        uniform float uTransparent;
        
        varying vec2 vUv;

        vec4 sRGBToLinear(vec4 color) {
          return vec4(pow(color.rgb, vec3(2.2)), color.a);
        }
        
        vec4 LinearToSRGB(vec4 color) {
            return vec4(pow(color.rgb, vec3(1.0 / 2.2)), color.a);
        }
        
        void main() {
          // Calculate aspect ratio relationship between image and geometry
          float aspect = uGeoAspect / uImgAspect;

          vec2 uv = vUv;
          
          // COVER MODE (uFit = 1.0)
          if (abs(uFit - 1.0) < 0.01) {
            // Center the UV coordinates
            uv = uv - 0.5;
            
            if (aspect > 1.0) {
              // Geometry is wider than video:
              // - Fill horizontally (maintain x scale)
              // - Scale vertically to maintain aspect ratio (shrink y)
              uv.y /= aspect;
            } else {
              // Geometry is taller than video:
              // - Fill vertically (maintain y scale)
              // - Scale horizontally to maintain aspect ratio (shrink x)
              uv.x *= aspect;
            }
            
            // Return to 0-1 range
            uv = uv + 0.5;
          }
          // CONTAIN MODE (uFit = 2.0)
          else if (abs(uFit - 2.0) < 0.01) {
            // Center the UV coordinates
            uv = uv - 0.5;
            
            if (aspect > 1.0) {
              // Geometry is wider than video:
              // - Fill vertically (maintain y scale)
              // - Scale horizontally to fit entire video (expand x)
              uv.x *= aspect;
            } else {
              // Geometry is taller than video:
              // - Fill horizontally (maintain x scale)
              // - Scale vertically to fit entire video (expand y)
              uv.y /= aspect;
            }
            
            // Return to 0-1 range
            uv = uv + 0.5;
          }
          
          // pull UV into [0,1] before sampling
          vec2 uvClamped = clamp(uv, 0.0, 1.0);
          vec4 col = texture2D(uMap, uvClamped);

          // outside coloring (for contain mode)
          if (uFit >= 1.5) {
            const float EPS = 0.005;
            // decide "outside" based on the *raw* uv
            bool outside = uv.x < -EPS || uv.x > 1.0 + EPS || uv.y < -EPS || uv.y > 1.0 + EPS;
            if (outside) {
              col = uTransparent > 0.5 ? vec4(0.0, 0.0, 0.0, 0.0) : vec4(uColor, 1.0);
            }
          } 

          csm_DiffuseColor = col;
        }
      `,
    })
    this.ctx!.setupMaterial!(material)
    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.castShadow = this._castShadow
    this.mesh.receiveShadow = this._receiveShadow
    this.mesh.matrixWorld.copy(this.matrixWorld)
    this.mesh.matrixAutoUpdate = false
    this.mesh.matrixWorldAutoUpdate = false
    this.ctx!.stage!.scene!.add(this.mesh)
    this.sItem = {
      geometry,
      material,
      matrix: this.matrixWorld,
      getEntity: () => this.ctx!.entity!,
      node: this,
    }
    this.ctx!.stage!.octree!.insert(this.sItem)
  }

  unbuild() {
    this.n++
    if (this.mesh) {
      this.ctx!.stage!.scene!.remove(this.mesh)
      if (Array.isArray(this.mesh.material)) {
        this.mesh.material.forEach(mat => mat.dispose())
      } else {
        this.mesh.material.dispose()
      }
      this.mesh.geometry.dispose()
      this.mesh = null
    }
    if (this.sItem) {
      this.ctx!.stage!.octree!.remove(this.sItem)
      this.sItem = null
    }
  }

  get src() {
    return this._src
  }

  set src(value: string | null) {
    if (value === undefined) value = defaults.src
    if (value !== null && typeof value !== 'string') {
      throw new Error('[image] src not null or string')
    }
    if (this._src === value) return
    this._src = value
    this.needsRebuild = true
    this.setDirty()
  }

  get width() {
    return this._width
  }

  set width(value: number | null) {
    if (value === undefined) value = defaults.width

    if (this._width === value) return
    this._width = value
    this.needsRebuild = true
    this.setDirty()
  }

  get height() {
    return this._height
  }

  set height(value: number | null) {
    if (value === undefined) value = defaults.height

    if (this._height === value) return
    this._height = value
    this.needsRebuild = true
    this.setDirty()
  }

  get fit() {
    return this._fit
  }

  set fit(value: string) {
    if (!value) value = defaults.fit
    if (!isFit(value)) {
      throw new Error('[image] fit invalid')
    }
    if (this._fit === value) return
    this._fit = value
    this.needsRebuild = true
    this.setDirty()
  }

  get color() {
    return this._color
  }

  set color(value: string | null) {
    if (value === undefined) value = defaults.color
    if (value !== null && typeof value !== 'string') {
      throw new Error('[image] color not null or string')
    }
    const colorValue = value ?? defaults.color
    if (this._color === colorValue) return
    this._color = colorValue
    this.needsRebuild = true
    this.setDirty()
  }

  get pivot() {
    return this._pivot
  }

  set pivot(value: string) {
    if (!value) value = defaults.pivot
    if (!isPivot(value)) {
      throw new Error('[image] pivot invalid')
    }
    if (this._pivot === value) return
    this._pivot = value
    this.needsRebuild = true
    this.setDirty()
  }

  get lit() {
    return this._lit
  }

  set lit(value: boolean) {
    if (value === undefined || value === null) value = defaults.lit

    if (this._lit === value) return
    this._lit = value
    this.needsRebuild = true
    this.setDirty()
  }

  get doubleside() {
    return this._doubleside
  }

  set doubleside(value: boolean) {
    if (value === undefined || value === null) value = defaults.doubleside

    if (this._doubleside === value) return
    this._doubleside = value
    this.needsRebuild = true
    this.setDirty()
  }

  get castShadow() {
    return this._castShadow
  }

  set castShadow(value: boolean) {
    if (value === undefined || value === null) value = defaults.castShadow

    if (this._castShadow === value) return
    this._castShadow = value
    this.needsRebuild = true
    this.setDirty()
  }

  get receiveShadow() {
    return this._receiveShadow
  }

  set receiveShadow(value: boolean) {
    if (value === undefined || value === null) value = defaults.receiveShadow

    if (this._receiveShadow === value) return
    this._receiveShadow = value
    this.needsRebuild = true
    this.setDirty()
  }

  getProxy() {
    if (!this.proxy) {
      const self = this
      let proxy = {
        get src() {
          return self.src
        },
        set src(value) {
          self.src = value
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
        get fit() {
          return self.fit
        },
        set fit(value) {
          self.fit = value
        },
        get color() {
          return self.color
        },
        set color(value) {
          self.color = value
        },
        get pivot() {
          return self.pivot
        },
        set pivot(value) {
          self.pivot = value
        },
        get lit() {
          return self.lit
        },
        set lit(value) {
          self.lit = value
        },
        get doubleside() {
          return self.doubleside
        },
        set doubleside(value) {
          self.doubleside = value
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
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}

function isFit(value) {
  return fits.includes(value)
}

function isPivot(value) {
  return pivots.includes(value)
}

function applyPivot(geometry, width, height, pivot) {
  if (pivot === 'center') return
  let offsetX = 0
  let offsetY = 0
  if (pivot.includes('left')) {
    offsetX = width / 2
  } else if (pivot.includes('right')) {
    offsetX = -width / 2
  }
  if (pivot.includes('top')) {
    offsetY = -height / 2
  } else if (pivot.includes('bottom')) {
    offsetY = height / 2
  }
  if (offsetX !== 0 || offsetY !== 0) {
    geometry.translate(offsetX, offsetY, 0)
  }
}

function applyFit(texture, width, height, fit) {
  if (fit === 'none') return
  // calc aspect ratios
  const containerAspect = width / height
  const imageAspect = texture.image.width / texture.image.height
  // contain: the entire image should be visible inside the container
  // cover: the image should cover the entire container (may crop)
  let scaleX = 1
  let scaleY = 1
  if (fit === 'contain') {
    // if image is wider than container proportionally
    if (imageAspect > containerAspect) {
      // scale Y to maintain aspect ratio
      scaleY = containerAspect / imageAspect
      // center vertically
      texture.offset.y = (1 - scaleY) / 2
    } else {
      // scale X to maintain aspect ratio
      scaleX = imageAspect / containerAspect
      // center horizontally
      texture.offset.x = (1 - scaleX) / 2
    }
  } else if (fit === 'cover') {
    // if image is wider than container proportionally
    if (imageAspect > containerAspect) {
      // scale X to fill container height
      scaleX = containerAspect / imageAspect
      // center horizontally with overflow
      texture.offset.x = (1 - 1 / scaleX) / 2
      scaleX = 1 / scaleX
    } else {
      // scale Y to fill container width
      scaleY = imageAspect / containerAspect
      // center vertically with overflow
      texture.offset.y = (1 - 1 / scaleY) / 2
      scaleY = 1 / scaleY
    }
  }
  texture.repeat.set(scaleX, scaleY)
  texture.needsUpdate = true
}
