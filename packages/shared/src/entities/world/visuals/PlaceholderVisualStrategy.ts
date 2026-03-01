/**
 * PlaceholderVisualStrategy — instanced placeholder geometry for resources
 * without a real model (e.g. oak/willow trees with null modelPath).
 *
 * Delegates rendering to PlaceholderInstancer (one InstancedMesh draw call per
 * resource type). Adds an invisible collision proxy on the entity node for
 * raycasting/interaction.
 */

import THREE from "../../../extras/three/three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  addPlaceholderInstance,
  removePlaceholderInstance,
  setPlaceholderVisible,
} from "../../../systems/shared/world/PlaceholderInstancer";
import type {
  ResourceVisualContext,
  ResourceVisualStrategy,
} from "./ResourceVisualStrategy";

function createCollisionProxy(ctx: ResourceVisualContext, scale: number): void {
  const isTree = ctx.config.resourceType === "tree";
  const geometry = isTree
    ? new THREE.CylinderGeometry(0.5 * scale, 0.5 * scale, 2 * scale, 6)
    : new THREE.BoxGeometry(0.8 * scale, 0.8 * scale, 0.8 * scale);

  const material = new MeshBasicNodeMaterial();
  material.visible = false;

  const proxy = new THREE.Mesh(geometry, material);
  if (isTree) proxy.position.y = scale;
  proxy.name = `PlaceholderProxy_${ctx.id}`;
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

export class PlaceholderVisualStrategy implements ResourceVisualStrategy {
  private instanced = false;

  async createVisual(ctx: ResourceVisualContext): Promise<void> {
    const { config } = ctx;
    const scale = config.resourceType === "tree" ? 3 : 1;

    const worldPos = new THREE.Vector3();
    ctx.node.getWorldPosition(worldPos);

    this.instanced = addPlaceholderInstance(
      config.resourceType,
      ctx.id,
      worldPos,
      scale,
    );

    if (this.instanced) {
      if (config.depleted) {
        setPlaceholderVisible(ctx.id, false);
      }
      createCollisionProxy(ctx, scale);
    }
  }

  async onDepleted(ctx: ResourceVisualContext): Promise<boolean> {
    if (this.instanced) {
      setPlaceholderVisible(ctx.id, false);
    }
    const proxy = ctx.getMesh();
    if (proxy) {
      proxy.userData.depleted = true;
      proxy.userData.interactable = false;
    }
    return false;
  }

  async onRespawn(ctx: ResourceVisualContext): Promise<void> {
    if (this.instanced) {
      setPlaceholderVisible(ctx.id, true);
    }
    const proxy = ctx.getMesh();
    if (proxy) {
      proxy.userData.depleted = false;
      proxy.userData.interactable = true;
    }
  }

  update(): void {}

  destroy(ctx: ResourceVisualContext): void {
    if (this.instanced) {
      removePlaceholderInstance(ctx.id);
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
