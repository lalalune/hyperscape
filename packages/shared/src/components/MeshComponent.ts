import { Component } from "./Component";
import type { Entity } from "../entities/Entity";
import THREE from "../extras/three/three";

/**
 * Mesh Component
 *
 * Stores mesh data for visual representation of an entity.
 * Manages Three.js Mesh objects and materials.
 */
export class MeshComponent extends Component {
  private mesh?: THREE.Mesh;

  constructor(
    entity: Entity,
    data: {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material;
      geometryType?: string;
      materialType?: string;
      visible?: boolean;
      castShadow?: boolean;
      receiveShadow?: boolean;
      [key: string]: unknown;
    } = {},
  ) {
    super("mesh", entity, {
      visible: true,
      castShadow: true,
      receiveShadow: true,
      ...data,
    });
  }

  get geometry(): THREE.BufferGeometry | undefined {
    return this.get<THREE.BufferGeometry>("geometry");
  }

  set geometry(value: THREE.BufferGeometry | undefined) {
    this.set("geometry", value);
    this.updateMesh();
  }

  get material(): THREE.Material | undefined {
    return this.get<THREE.Material>("material");
  }

  set material(value: THREE.Material | undefined) {
    this.set("material", value);
    this.updateMesh();
  }

  get visible(): boolean {
    return this.get<boolean>("visible") ?? true;
  }

  set visible(value: boolean) {
    this.set("visible", value);
    if (this.mesh) {
      this.mesh.visible = value;
    }
  }

  get castShadow(): boolean {
    return this.get<boolean>("castShadow") ?? true;
  }

  set castShadow(value: boolean) {
    this.set("castShadow", value);
    if (this.mesh) {
      this.mesh.castShadow = value;
    }
  }

  get receiveShadow(): boolean {
    return this.get<boolean>("receiveShadow") ?? true;
  }

  set receiveShadow(value: boolean) {
    this.set("receiveShadow", value);
    if (this.mesh) {
      this.mesh.receiveShadow = value;
    }
  }

  // Get the Three.js mesh object
  getMesh(): THREE.Mesh | undefined {
    return this.mesh;
  }

  // Create basic geometries
  createBoxGeometry(width = 1, height = 1, depth = 1): void {
    this.geometry = new THREE.BoxGeometry(width, height, depth);
  }

  createSphereGeometry(
    radius = 1,
    widthSegments = 32,
    heightSegments = 16,
  ): void {
    this.geometry = new THREE.SphereGeometry(
      radius,
      widthSegments,
      heightSegments,
    );
  }

  createPlaneGeometry(width = 1, height = 1): void {
    this.geometry = new THREE.PlaneGeometry(width, height);
  }

  // Create basic materials
  createBasicMaterial(color = 0xffffff): void {
    this.material = new THREE.MeshBasicMaterial({ color });
  }

  createLambertMaterial(color = 0xffffff): void {
    this.material = new THREE.MeshLambertMaterial({ color });
  }

  createStandardMaterial(color = 0xffffff, metalness = 0, roughness = 1): void {
    this.material = new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness,
    });
  }

  private updateMesh(): void {
    // Remove existing mesh
    if (this.mesh && this.entity.node) {
      this.entity.node.remove(this.mesh);
    }

    // Create new mesh if both geometry and material exist
    const geometry = this.geometry;
    const material = this.material;

    if (geometry && material) {
      this.mesh = new THREE.Mesh(geometry, material);
      this.mesh.visible = this.visible;
      this.mesh.castShadow = this.castShadow;
      this.mesh.receiveShadow = this.receiveShadow;

      // Add to entity node
      if (this.entity.node) {
        this.entity.node.add(this.mesh);
      }
    }
  }

  init(): void {
    this.updateMesh();
  }

  destroy(): void {
    if (this.mesh && this.entity.node) {
      this.entity.node.remove(this.mesh);
    }

    // Dispose of geometry and material
    if (this.geometry) {
      this.geometry.dispose();
    }
    if (this.material) {
      if (Array.isArray(this.material)) {
        this.material.forEach((mat) => mat.dispose());
      } else {
        this.material.dispose();
      }
    }
  }
}
