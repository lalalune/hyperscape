/**
 * HealthBars System
 *
 * Renders health bars for all entities (players and mobs) using a single
 * instanced mesh for optimal performance.
 *
 * Similar architecture to Nametags but ONLY handles health bars.
 * This separation ensures clean responsibility:
 * - Nametags: names only
 * - HealthBars: health bars only
 *
 * @see Nametags for the name rendering system
 * @see HealthBarRenderer for the drawing logic
 */

import THREE, { toTHREEVector3 } from "../../extras/three/three";
import CustomShaderMaterial from "../../libs/three-custom-shader-material";
import { SystemBase } from "../shared";
import type { World } from "../../types";
import { EventType } from "../../types/events";
import {
  drawHealthBar,
  clearHealthBar,
  HEALTH_BAR_DIMENSIONS,
  HEALTH_BAR_COLORS,
} from "../../utils/rendering/HealthBarRenderer";

const _v3_1 = new THREE.Vector3();

// Atlas configuration
const SLOT_WIDTH = HEALTH_BAR_DIMENSIONS.WIDTH; // 160px
const SLOT_HEIGHT = HEALTH_BAR_DIMENSIONS.HEIGHT; // 16px
const BORDER_WIDTH = HEALTH_BAR_DIMENSIONS.BORDER_WIDTH; // 2px

const PER_ROW = 16;
const PER_COLUMN = 16;
const MAX_INSTANCES = PER_ROW * PER_COLUMN; // 256 health bars

const defaultQuaternion = new THREE.Quaternion(0, 0, 0, 1);
const defaultScale = toTHREEVector3(new THREE.Vector3(1, 1, 1));

/**
 * Health bar entry for tracking
 */
interface HealthBarEntry {
  idx: number;
  entityId: string;
  health: number;
  maxHealth: number;
  visible: boolean;
  hideTimeout: ReturnType<typeof setTimeout> | null;
  matrix: THREE.Matrix4;
}

/**
 * Handle returned to entities for manipulating their health bar
 */
export interface HealthBarHandle {
  entityId: string;
  /** Update position in world space */
  move: (newMatrix: THREE.Matrix4) => void;
  /** Update health value */
  setHealth: (current: number, max: number) => void;
  /** Show health bar (optionally with auto-hide timeout) */
  show: (timeoutMs?: number) => void;
  /** Hide health bar immediately */
  hide: () => void;
  /** Remove health bar from system */
  destroy: () => void;
}

export class HealthBars extends SystemBase {
  healthBars: HealthBarEntry[];
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  uniforms: {
    uAtlas: { value: THREE.CanvasTexture };
    uXR: { value: number };
    uOrientation: { value: THREE.Quaternion };
  };
  material: CustomShaderMaterial;
  geometry: THREE.PlaneGeometry;
  mesh: THREE.InstancedMesh;

  constructor(world: World) {
    super(world, {
      name: "healthbars",
      dependencies: { required: ["stage"], optional: [] },
      autoCleanup: true,
    });
    this.healthBars = [];
    this.canvas = document.createElement("canvas");
    this.canvas.width = SLOT_WIDTH * PER_ROW;
    this.canvas.height = SLOT_HEIGHT * PER_COLUMN;

    this.ctx = this.canvas.getContext("2d")!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.flipY = false;
    this.texture.needsUpdate = true;
    this.uniforms = {
      uAtlas: { value: this.texture },
      uXR: { value: 0 },
      uOrientation: { value: this.world.camera.quaternion },
    };
    this.material = new CustomShaderMaterial({
      baseMaterial: THREE.MeshBasicMaterial,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: this.uniforms,
      vertexShader: `
        attribute vec2 coords;
        uniform float uXR;
        uniform vec4 uOrientation;
        varying vec2 vUv;

        vec3 applyQuaternion(vec3 pos, vec4 quat) {
          vec3 qv = vec3(quat.x, quat.y, quat.z);
          vec3 t = 2.0 * cross(qv, pos);
          return pos + quat.w * t + cross(qv, t);
        }

        vec4 lookAtQuaternion(vec3 instancePos) {
          vec3 up = vec3(0.0, 1.0, 0.0);
          vec3 forward = normalize(cameraPosition - instancePos);

          if(length(forward) < 0.001) {
            return vec4(0.0, 0.0, 0.0, 1.0);
          }

          vec3 right = normalize(cross(up, forward));
          up = cross(forward, right);

          float m00 = right.x;
          float m01 = right.y;
          float m02 = right.z;
          float m10 = up.x;
          float m11 = up.y;
          float m12 = up.z;
          float m20 = forward.x;
          float m21 = forward.y;
          float m22 = forward.z;

          float trace = m00 + m11 + m22;
          vec4 quat;

          if(trace > 0.0) {
            float s = 0.5 / sqrt(trace + 1.0);
            quat = vec4(
              (m12 - m21) * s,
              (m20 - m02) * s,
              (m01 - m10) * s,
              0.25 / s
            );
          } else if(m00 > m11 && m00 > m22) {
            float s = 2.0 * sqrt(1.0 + m00 - m11 - m22);
            quat = vec4(
              0.25 * s,
              (m01 + m10) / s,
              (m20 + m02) / s,
              (m12 - m21) / s
            );
          } else if(m11 > m22) {
            float s = 2.0 * sqrt(1.0 + m11 - m00 - m22);
            quat = vec4(
              (m01 + m10) / s,
              0.25 * s,
              (m12 + m21) / s,
              (m20 - m02) / s
            );
          } else {
            float s = 2.0 * sqrt(1.0 + m22 - m00 - m11);
            quat = vec4(
              (m20 + m02) / s,
              (m12 + m21) / s,
              0.25 * s,
              (m01 - m10) / s
            );
          }

          return normalize(quat);
        }

        void main() {
          vec3 newPosition = position;
          if (uXR > 0.5) {
            vec3 instancePos = vec3(
              instanceMatrix[3][0],
              instanceMatrix[3][1],
              instanceMatrix[3][2]
            );
            vec4 lookAtQuat = lookAtQuaternion(instancePos);
            newPosition = applyQuaternion(newPosition, lookAtQuat);
          } else {
            newPosition = applyQuaternion(newPosition, uOrientation);
          }
          csm_Position = newPosition;

          vec2 atlasUV = uv;
          atlasUV.y = 1.0 - atlasUV.y;
          atlasUV /= vec2(${PER_ROW}, ${PER_COLUMN});
          atlasUV += coords;
          vUv = atlasUV;
        }
      `,
      fragmentShader: `
        uniform sampler2D uAtlas;
        varying vec2 vUv;

        void main() {
          vec4 texColor = texture2D(uAtlas, vUv);
          csm_FragColor = texColor;
        }
      `,
    } as ConstructorParameters<typeof CustomShaderMaterial>[0]);

    // Health bar size must match player health bars (drawn inside Nametags)
    // Player nametag: PlaneGeometry(1, 60/320) = 1.0 × 0.1875 world units
    // Health bar inside: 160px / 320px = 50% width = 0.5 world units
    // Height: 16px / 60px * 0.1875 = 0.05 world units
    const worldWidth = 0.5; // Match player health bar width
    const worldHeight = 0.05; // Match player health bar height (10:1 aspect)
    this.geometry = new THREE.PlaneGeometry(worldWidth, worldHeight);
    this.geometry.setAttribute(
      "coords",
      new THREE.InstancedBufferAttribute(
        new Float32Array(MAX_INSTANCES * 2),
        2,
      ),
    );
    this.mesh = new THREE.InstancedMesh(
      this.geometry,
      this.material,
      MAX_INSTANCES,
    );
    this.mesh.renderOrder = 9998; // Just below nametags (9999)
    this.mesh.matrixAutoUpdate = false;
    this.mesh.matrixWorldAutoUpdate = false;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  start() {
    this.world.stage.scene.add(this.mesh);
    this.subscribe(EventType.XR_SESSION, (session: XRSession | null) =>
      this.onXRSession(session as unknown),
    );
  }

  /**
   * Add a health bar for an entity
   */
  add(
    entityId: string,
    initialHealth = 100,
    maxHealth = 100,
  ): HealthBarHandle | null {
    const idx = this.healthBars.length;
    if (idx >= MAX_INSTANCES) {
      console.error("healthbars: reached max");
      return null;
    }

    // Increment instance count
    this.mesh.count++;
    this.mesh.instanceMatrix.needsUpdate = true;

    // Set atlas coordinates
    const row = Math.floor(idx / PER_ROW);
    const col = idx % PER_ROW;
    const coords = this.mesh.geometry.attributes
      .coords as THREE.InstancedBufferAttribute;
    coords.setXY(idx, col / PER_ROW, row / PER_COLUMN);
    coords.needsUpdate = true;

    // Create entry
    const matrix = new THREE.Matrix4();
    const position = _v3_1.set(0, 0, 0);
    matrix.compose(position, defaultQuaternion, defaultScale);

    const entry: HealthBarEntry = {
      idx,
      entityId,
      health: initialHealth,
      maxHealth,
      visible: false, // Start hidden
      hideTimeout: null,
      matrix,
    };
    this.healthBars[idx] = entry;

    // Clear the slot initially (hidden)
    this.undraw(entry);

    // Create handle
    const handle: HealthBarHandle = {
      entityId,
      move: (newMatrix: THREE.Matrix4) => {
        matrix.elements[12] = newMatrix.elements[12];
        matrix.elements[13] = newMatrix.elements[13];
        matrix.elements[14] = newMatrix.elements[14];
        this.mesh.setMatrixAt(entry.idx, matrix);
        this.mesh.instanceMatrix.needsUpdate = true;
      },
      setHealth: (current: number, max: number) => {
        if (entry.health === current && entry.maxHealth === max) return;
        entry.health = current;
        entry.maxHealth = max;
        if (entry.visible) {
          this.draw(entry);
        }
      },
      show: (timeoutMs?: number) => {
        // Clear any existing timeout
        if (entry.hideTimeout) {
          clearTimeout(entry.hideTimeout);
          entry.hideTimeout = null;
        }
        entry.visible = true;
        this.draw(entry);

        // Set auto-hide timeout if specified
        if (timeoutMs !== undefined && timeoutMs > 0) {
          entry.hideTimeout = setTimeout(() => {
            entry.visible = false;
            this.undraw(entry);
            entry.hideTimeout = null;
          }, timeoutMs);
        }
      },
      hide: () => {
        if (entry.hideTimeout) {
          clearTimeout(entry.hideTimeout);
          entry.hideTimeout = null;
        }
        entry.visible = false;
        this.undraw(entry);
      },
      destroy: () => {
        this.remove(entry);
      },
    };

    return handle;
  }

  /**
   * Remove a health bar entry
   */
  private remove(entry: HealthBarEntry) {
    if (!this.healthBars.includes(entry)) {
      return console.warn("healthbars: attempted to remove non-existent entry");
    }

    // Clear timeout
    if (entry.hideTimeout) {
      clearTimeout(entry.hideTimeout);
    }

    const last = this.healthBars[this.healthBars.length - 1];
    const isLast = entry === last;

    if (isLast) {
      this.healthBars.pop();
      this.undraw(entry);
    } else {
      // Swap with last
      this.undraw(last);
      last.idx = entry.idx;
      if (last.visible) {
        this.draw(last);
      }
      // Update coords for swapped instance
      const coords = this.mesh.geometry.attributes
        .coords as THREE.InstancedBufferAttribute;
      const row = Math.floor(entry.idx / PER_ROW);
      const col = entry.idx % PER_ROW;
      coords.setXY(entry.idx, col / PER_ROW, row / PER_COLUMN);
      coords.needsUpdate = true;
      // Update matrix and references
      this.mesh.setMatrixAt(last.idx, last.matrix);
      this.healthBars[last.idx] = last;
      this.healthBars.pop();
    }

    this.mesh.count--;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Draw health bar to atlas
   */
  private draw(entry: HealthBarEntry) {
    const idx = entry.idx;
    const row = Math.floor(idx / PER_ROW);
    const col = idx % PER_ROW;
    const x = col * SLOT_WIDTH;
    const y = row * SLOT_HEIGHT;

    // Clear slot
    this.ctx.clearRect(x, y, SLOT_WIDTH, SLOT_HEIGHT);

    // Draw health bar
    const healthPercent =
      entry.maxHealth > 0 ? entry.health / entry.maxHealth : 0;
    drawHealthBar(this.ctx, x, y, SLOT_WIDTH, SLOT_HEIGHT, healthPercent, {
      borderWidth: BORDER_WIDTH,
    });

    this.texture.needsUpdate = true;
  }

  /**
   * Clear health bar from atlas (hide)
   */
  private undraw(entry: HealthBarEntry) {
    const idx = entry.idx;
    const row = Math.floor(idx / PER_ROW);
    const col = idx % PER_ROW;
    const x = col * SLOT_WIDTH;
    const y = row * SLOT_HEIGHT;

    this.ctx.clearRect(x, y, SLOT_WIDTH, SLOT_HEIGHT);
    this.texture.needsUpdate = true;
  }

  private onXRSession = (session: unknown) => {
    this.uniforms.uXR.value = session ? 1 : 0;
  };

  /**
   * Find health bar by entity ID
   */
  getByEntityId(entityId: string): HealthBarEntry | undefined {
    return this.healthBars.find((e) => e.entityId === entityId);
  }
}
