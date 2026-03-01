/**
 * TreeProcgenVisualStrategy — procedural tree instancing via ProcgenTreeCache.
 *
 * Uses addTreeInstance for batched rendering. Falls back to an individual
 * mesh clone if instancing fails.
 */

import THREE from "../../../extras/three/three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  getTreeMeshClone,
  getTreeLOD1Clone,
  addTreeInstance,
  removeTreeInstance,
  setProcgenTreeWorld,
} from "../../../systems/shared/world/ProcgenTreeCache";
import type {
  ResourceVisualContext,
  ResourceVisualStrategy,
} from "./ResourceVisualStrategy";

function createCollisionProxy(ctx: ResourceVisualContext, scale: number): void {
  const height = 8 * scale;
  const radius = 1 * scale;
  const geometry = new THREE.CylinderGeometry(radius, radius, height, 6);
  const material = new MeshBasicNodeMaterial();
  material.visible = false;

  const proxy = new THREE.Mesh(geometry, material);
  proxy.position.y = height / 2;
  proxy.name = `TreeProxy_${ctx.id}`;
  proxy.userData = {
    type: "resource",
    entityId: ctx.id,
    name: ctx.config.name,
    interactable: true,
    resourceType: ctx.config.resourceType,
    procgenPreset: ctx.config.procgenPreset,
  };
  proxy.layers.set(1);

  ctx.node.add(proxy);
  ctx.setMesh(proxy);
}

export class TreeProcgenVisualStrategy implements ResourceVisualStrategy {
  private useInstanced = false;
  private instancedLOD = 0;
  private instancedScale = 1.0;
  private instancedRotation = 0;

  async createVisual(ctx: ResourceVisualContext): Promise<void> {
    const presetName = ctx.config.procgenPreset;
    if (!presetName) return;

    setProcgenTreeWorld(ctx.world);

    const baseScale = ctx.config.modelScale ?? 1.0;
    const scaleHash = ctx.hashString(ctx.id + "_scale");
    const scaleVariation = 0.85 + (scaleHash % 300) / 1000;
    const finalScale = baseScale * scaleVariation;

    const rotHash = ctx.hashString(
      `${ctx.id}_${ctx.position.x.toFixed(1)}_${ctx.position.z.toFixed(1)}`,
    );
    const rotation = ((rotHash % 1000) / 1000) * Math.PI * 2;

    const worldPos = new THREE.Vector3();
    ctx.node.getWorldPosition(worldPos);

    const success = await addTreeInstance(
      presetName,
      ctx.id,
      worldPos,
      rotation,
      finalScale,
      0,
    );

    if (success) {
      this.useInstanced = true;
      this.instancedLOD = 0;
      this.instancedScale = finalScale;
      this.instancedRotation = rotation;
      createCollisionProxy(ctx, finalScale);
      return;
    }

    await this.createFallbackMesh(ctx);
  }

  async onDepleted(ctx: ResourceVisualContext): Promise<boolean> {
    if (this.useInstanced && ctx.config.procgenPreset) {
      removeTreeInstance(ctx.config.procgenPreset, ctx.id, this.instancedLOD);
    }
    const mesh = ctx.getMesh();
    if (mesh) mesh.visible = false;
    return false;
  }

  async onRespawn(ctx: ResourceVisualContext): Promise<void> {
    if (this.useInstanced && ctx.config.procgenPreset) {
      const worldPos = new THREE.Vector3();
      ctx.node.getWorldPosition(worldPos);
      await addTreeInstance(
        ctx.config.procgenPreset,
        ctx.id,
        worldPos,
        this.instancedRotation,
        this.instancedScale,
        0,
      );
    }
    const mesh = ctx.getMesh();
    if (mesh) mesh.visible = true;
  }

  update(): void {
    // LOD handled by ProcgenTreeInstancer globally
  }

  destroy(ctx: ResourceVisualContext): void {
    if (this.useInstanced && ctx.config.procgenPreset) {
      removeTreeInstance(ctx.config.procgenPreset, ctx.id, this.instancedLOD);
      this.useInstanced = false;
    }
  }

  // ---- fallback ----

  private async createFallbackMesh(
    ctx: ResourceVisualContext,
  ): Promise<boolean> {
    const presetName = ctx.config.procgenPreset;
    if (!presetName) return false;

    const treeGroup = await getTreeMeshClone(presetName, ctx.id);
    if (!treeGroup) return false;

    const mesh = treeGroup;
    mesh.name = `Resource_tree_procgen_${presetName}`;
    mesh.visible = !ctx.config.depleted;

    const baseScale = ctx.config.modelScale ?? 1.0;
    const scaleHash = ctx.hashString(ctx.id + "_scale");
    const finalScale = baseScale * (0.85 + (scaleHash % 300) / 1000);
    mesh.scale.setScalar(finalScale);

    const rotHash = ctx.hashString(
      `${ctx.id}_${ctx.position.x.toFixed(1)}_${ctx.position.z.toFixed(1)}`,
    );
    mesh.rotation.y = ((rotHash % 1000) / 1000) * Math.PI * 2;

    mesh.layers.set(1);
    mesh.traverse((child) => {
      child.layers.set(1);
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    mesh.userData = {
      type: "resource",
      entityId: ctx.id,
      name: ctx.config.name,
      interactable: true,
      resourceType: ctx.config.resourceType,
      depleted: ctx.config.depleted,
      procgenPreset: presetName,
    };

    const bbox = new THREE.Box3().setFromObject(mesh);
    mesh.position.set(0, -bbox.min.y, 0);

    ctx.setMesh(mesh);
    ctx.node.add(mesh);
    return true;
  }
}
