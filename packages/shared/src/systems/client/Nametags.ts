import THREE, { toTHREEVector3 } from "../../extras/three/three";
import CustomShaderMaterial from "../../libs/three-custom-shader-material";
import { SystemBase } from "../shared/infrastructure/SystemBase";
import type { World } from "../../types";
import { EventType } from "../../types/events";

const _v3_1 = new THREE.Vector3();

/**
 * Nametags System
 *
 * Renders player/entity names using a single atlas and instanced mesh for optimal performance.
 *
 * IMPORTANT: This system ONLY handles names. Health bars are handled separately by the HealthBars system.
 * This separation ensures clean responsibility:
 * - Nametags: names only
 * - HealthBars: health bars only
 *
 * @see HealthBars for the health bar rendering system
 */

const RES = 2;
const NAMETAG_WIDTH = 160 * RES;
const NAMETAG_HEIGHT = 20 * RES; // Reduced - no longer need space for health bar
const NAME_FONT_SIZE = 14 * RES;
const NAME_OUTLINE_SIZE = 3 * RES;

const PER_ROW = 8;
const PER_COLUMN = 32;
const MAX_INSTANCES = PER_ROW * PER_COLUMN;

const defaultQuaternion = new THREE.Quaternion(0, 0, 0, 1);
const defaultScale = toTHREEVector3(new THREE.Vector3(1, 1, 1));

/**
 * Nametag entry for tracking
 */
interface NametagEntry {
  idx: number;
  name: string;
  matrix: THREE.Matrix4;
}

/**
 * Handle returned to entities for manipulating their nametag
 */
export interface NametagHandle {
  idx: number;
  name: string;
  matrix: THREE.Matrix4;
  /** Update position in world space */
  move: (newMatrix: THREE.Matrix4) => void;
  /** Update name text */
  setName: (name: string) => void;
  /** Remove nametag from system */
  destroy: () => void;
}

export class Nametags extends SystemBase {
  nametags: NametagEntry[];
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
      name: "nametags",
      dependencies: { required: ["stage"], optional: [] },
      autoCleanup: true,
    });
    this.nametags = [];
    this.canvas = document.createElement("canvas");
    this.canvas.width = NAMETAG_WIDTH * PER_ROW;
    this.canvas.height = NAMETAG_HEIGHT * PER_COLUMN;

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
    this.geometry = new THREE.PlaneGeometry(1, NAMETAG_HEIGHT / NAMETAG_WIDTH);
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
    this.mesh.renderOrder = 9999;
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
   * Add a nametag for an entity
   * @param name - The name to display
   */
  add({ name }: { name: string }): NametagHandle | null {
    const idx = this.nametags.length;
    if (idx >= MAX_INSTANCES) {
      console.error("nametags: reached max");
      return null;
    }

    this.mesh.count++;
    this.mesh.instanceMatrix.needsUpdate = true;

    const row = Math.floor(idx / PER_ROW);
    const col = idx % PER_ROW;
    const coords = this.mesh.geometry.attributes
      .coords as THREE.InstancedBufferAttribute;
    coords.setXY(idx, col / PER_ROW, row / PER_COLUMN);
    coords.needsUpdate = true;

    const matrix = new THREE.Matrix4();
    const position = _v3_1.set(0, 0, 0);
    matrix.compose(position, defaultQuaternion, defaultScale);

    const entry: NametagEntry = {
      idx,
      name,
      matrix,
    };
    this.nametags[idx] = entry;

    // Create handle
    const handle: NametagHandle = {
      idx,
      name,
      matrix,
      move: (newMatrix: THREE.Matrix4) => {
        matrix.elements[12] = newMatrix.elements[12];
        matrix.elements[13] = newMatrix.elements[13];
        matrix.elements[14] = newMatrix.elements[14];
        this.mesh.setMatrixAt(entry.idx, matrix);
        this.mesh.instanceMatrix.needsUpdate = true;
      },
      setName: (newName: string) => {
        if (entry.name === newName) return;
        entry.name = newName;
        handle.name = newName;
        this.draw(entry);
      },
      destroy: () => {
        this.remove(entry);
      },
    };

    this.draw(entry);
    return handle;
  }

  private remove(entry: NametagEntry) {
    if (!this.nametags.includes(entry)) {
      return console.warn("nametags: attempted to remove non-existent nametag");
    }
    const last = this.nametags[this.nametags.length - 1];
    const isLast = entry === last;
    if (isLast) {
      this.nametags.pop();
      this.undraw(entry);
    } else {
      this.undraw(last);
      last.idx = entry.idx;
      this.draw(last);
      const coords = this.mesh.geometry.attributes
        .coords as THREE.InstancedBufferAttribute;
      const row = Math.floor(entry.idx / PER_ROW);
      const col = entry.idx % PER_ROW;
      coords.setXY(entry.idx, col / PER_ROW, row / PER_COLUMN);
      coords.needsUpdate = true;
      this.mesh.setMatrixAt(last.idx, last.matrix);
      this.nametags[last.idx] = last;
      this.nametags.pop();
    }
    this.mesh.count--;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private fitText(text: string, maxWidth: number): string {
    const metrics = this.ctx.measureText(text);
    if (metrics.width <= maxWidth) {
      return text;
    }

    let truncated = text;
    while (truncated.length > 0) {
      truncated = truncated.slice(0, -1);
      const testText = truncated + "...";
      const testMetrics = this.ctx.measureText(testText);
      if (testMetrics.width <= maxWidth) {
        return testText;
      }
    }
    return "...";
  }

  private draw(entry: NametagEntry) {
    const idx = entry.idx;
    const row = Math.floor(idx / PER_ROW);
    const col = idx % PER_ROW;
    const x = col * NAMETAG_WIDTH;
    const y = row * NAMETAG_HEIGHT;

    this.ctx.clearRect(x, y, NAMETAG_WIDTH, NAMETAG_HEIGHT);

    // Draw name only (no health bar - that's handled by HealthBars system)
    this.ctx.font = `800 ${NAME_FONT_SIZE}px Rubik`;
    this.ctx.fillStyle = "white";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.lineWidth = NAME_OUTLINE_SIZE;
    this.ctx.strokeStyle = "rgba(0,0,0,0.5)";
    const text = this.fitText(entry.name, NAMETAG_WIDTH);
    this.ctx.save();
    this.ctx.globalCompositeOperation = "xor";
    this.ctx.globalAlpha = 1;
    this.ctx.strokeText(text, x + NAMETAG_WIDTH / 2, y + NAMETAG_HEIGHT / 2);
    this.ctx.restore();
    this.ctx.fillText(text, x + NAMETAG_WIDTH / 2, y + NAMETAG_HEIGHT / 2);

    this.texture.needsUpdate = true;
  }

  private undraw(entry: NametagEntry) {
    const idx = entry.idx;
    const row = Math.floor(idx / PER_ROW);
    const col = idx % PER_ROW;
    const x = col * NAMETAG_WIDTH;
    const y = row * NAMETAG_HEIGHT;
    this.ctx.clearRect(x, y, NAMETAG_WIDTH, NAMETAG_HEIGHT);
    this.texture.needsUpdate = true;
  }

  private onXRSession = (session: unknown) => {
    this.uniforms.uXR.value = session ? 1 : 0;
  };
}
