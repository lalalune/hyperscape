/**
 * InstancedModelVisualStrategy — GLBResourceInstancer integration for
 * rocks, ores, herbs, and any non-tree resource with a GLB model.
 *
 * Thin wrapper: the instancer owns InstancedMeshes and LOD switching.
 * This strategy just calls addInstance / removeInstance / setDepleted.
 *
 * Falls back to StandardModelVisualStrategy when instancing is unavailable
 * (pool full, model load failure, etc.).
 */

import THREE from "../../../extras/three/three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  addInstance as addResourceInstance,
  removeInstance as removeResourceInstance,
  setDepleted as setResourceDepleted,
  hasDepleted as hasResourceDepleted,
  getHighlightMesh as getResourceHighlightMesh,
  updateGLBResourceInstancer,
} from "../../../systems/shared/world/GLBResourceInstancer";
import type {
  ResourceVisualContext,
  ResourceVisualStrategy,
} from "./ResourceVisualStrategy";
import { StandardModelVisualStrategy } from "./StandardModelVisualStrategy";

function createCollisionProxy(ctx: ResourceVisualContext, scale: number): void {
  const isTree = ctx.config.resourceType === "tree";
  const geometry = isTree
    ? new THREE.CylinderGeometry(0.5 * scale, 0.5 * scale, 2 * scale, 6)
    : new THREE.BoxGeometry(0.8 * scale, 0.8 * scale, 0.8 * scale);

  const material = new MeshBasicNodeMaterial();
  material.visible = false;

  const proxy = new THREE.Mesh(geometry, material);
  if (isTree) proxy.position.y = scale;
  else proxy.position.y = 0.4 * scale;
  proxy.name = `InstancedProxy_${ctx.id}`;
  proxy.userData = {
    type: "resource",
    entityId: ctx.id,
    name: ctx.config.name,
    interactable: true,
    resourceType: ctx.config.resourceType,
    depleted: ctx.config.depleted,
  };
  proxy.layers.set(1);

  ctx.node.add(proxy);
  ctx.setMesh(proxy);
}

export class InstancedModelVisualStrategy implements ResourceVisualStrategy {
  private instanced = false;
  private fallback: StandardModelVisualStrategy | null = null;

  async createVisual(ctx: ResourceVisualContext): Promise<void> {
    const { config, id, position } = ctx;
    if (!config.model) return;

    const baseScale = config.modelScale ?? 1.0;

    const worldPos = new THREE.Vector3();
    ctx.node.getWorldPosition(worldPos);

    const rotHash = ctx.hashString(
      `${id}_${position.x.toFixed(1)}_${position.z.toFixed(1)}`,
    );
    const rotation = ((rotHash % 1000) / 1000) * Math.PI * 2;

    const success = await addResourceInstance(
      config.model,
      id,
      worldPos,
      rotation,
      baseScale,
      config.depletedModelPath ?? null,
      config.depletedModelScale ?? 0.3,
    );

    if (success) {
      this.instanced = true;
      if (config.depleted) {
        setResourceDepleted(id, true);
      }
      createCollisionProxy(ctx, baseScale);
      return;
    }

    this.fallback = new StandardModelVisualStrategy();
    await this.fallback.createVisual(ctx);
  }

  async onDepleted(ctx: ResourceVisualContext): Promise<boolean> {
    if (this.fallback) {
      return this.fallback.onDepleted();
    }

    if (this.instanced) {
      setResourceDepleted(ctx.id, true);
    }
    const proxy = ctx.getMesh();
    if (proxy) {
      proxy.userData.depleted = true;
      proxy.userData.interactable = false;
    }
    return hasResourceDepleted(ctx.id);
  }

  getHighlightMesh(ctx: ResourceVisualContext): THREE.Object3D | null {
    if (this.fallback) return null;
    return getResourceHighlightMesh(ctx.id);
  }

  async onRespawn(ctx: ResourceVisualContext): Promise<void> {
    if (this.fallback) {
      await this.fallback.onRespawn(ctx);
      return;
    }

    if (this.instanced) {
      setResourceDepleted(ctx.id, false);
    }

    const proxy = ctx.getMesh();
    if (proxy) {
      proxy.userData.depleted = false;
      proxy.userData.interactable = true;
    }
  }

  update(ctx: ResourceVisualContext, deltaTime: number): void {
    if (this.fallback) {
      this.fallback.update(ctx);
      return;
    }

    updateGLBResourceInstancer();
  }

  destroy(ctx: ResourceVisualContext): void {
    if (this.fallback) {
      this.fallback.destroy(ctx);
      return;
    }

    if (this.instanced) {
      removeResourceInstance(ctx.id);
      this.instanced = false;
    }

    const proxy = ctx.getMesh();
    if (proxy) {
      const mesh = proxy as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) (mesh.material as THREE.Material).dispose();
      ctx.node.remove(proxy);
      ctx.setMesh(null);
    }
  }
}
