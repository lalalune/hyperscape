/**
 * Resource Visualization System
 * Creates visible 3D meshes for resources like trees, rocks, etc.
 * This ensures resources are actually visible in the world for interaction
 */

import THREE from '../extras/three';
import { SystemBase } from './SystemBase';
import type { World } from '../types';
import { EventType } from '../types/events';
import type { Position3D } from '../types/base-types';
import { Logger } from '../utils/Logger';

interface VisualResource {
  id: string;
  type: string;
  position: Position3D;
  mesh: THREE.Mesh;
}

export class ResourceVisualizationSystem extends SystemBase {
  private resources = new Map<string, VisualResource>();
  private resourceModels: Record<string, THREE.BufferGeometry> = {};
  private materials: Record<string, THREE.Material> = {};
  private stumps = new Map<string, THREE.Mesh>();
  private detachedTrees = new Map<string, { obj: THREE.Object3D; parent: THREE.Object3D | null }>();
  private detachedNearby = new Map<string, Array<{ obj: THREE.Object3D; parent: THREE.Object3D | null }>>();

  private findObjectByResourceId(id: string): THREE.Object3D | null {
    const scene = this.world.stage?.scene;
    if (!scene) return null;
    let found: THREE.Object3D | null = scene.getObjectByName(`resource_${id}`) || null;
    if (found) return found;
    scene.traverse(obj => {
      if (found) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((obj as any).userData && (obj as any).userData.resourceId === id) {
        found = obj;
      }
    });
    return found;
  }
  
  constructor(world: World) {
    super(world, { 
      name: 'resource-visualization', 
      dependencies: { required: [], optional: ['stage'] },
      autoCleanup: true 
    });
  }

  async init(): Promise<void> {
    // Create basic geometries for different resource types
    this.createResourceModels();
    
    // Listen for resource spawn events
    this.subscribe(EventType.RESOURCE_SPAWN_POINTS_REGISTERED, (data: {
      spawnPoints: Array<{
        position: Position3D;
        type: string;
        subType: string;
        id: string;
      }>;
    }) => {
      data.spawnPoints.forEach(point => {
        this.createResourceMesh(point);
      });
    });

    // Listen for test tree creation
    this.subscribe(EventType.TEST_TREE_CREATE, (data: {
      id: string;
      position: Position3D;
      type: string;
      color?: string;
      size?: { x: number; y: number; z: number };
    }) => {
      this.createTreeMesh(data);
    });

    // Listen for server resource spawn (canonical IDs) and remap/create visuals to server ids
    this.subscribe(EventType.RESOURCE_SPAWNED, (data: {
      id: string;
      type: string;
      position: Position3D;
    }) => {
      const serverId = data.id;
      const pos = data.position;
      const isTree = data.type.includes('tree');
      const isHerb = data.type.includes('herb');
      // If already mapped, just ensure tagging
      if (this.resources.has(serverId)) {
        const vr = this.resources.get(serverId)!;
        if (vr.mesh) {
          vr.mesh.userData.resourceId = serverId;
          vr.mesh.userData.resourceType = data.type;
        }
        return;
      }
      // Find nearest existing visual resource to remap
      let bestId: string | null = null;
      let bestDist = Infinity;
      for (const [rid, vr] of this.resources.entries()) {
        // Only consider visuals of matching type to avoid remapping trees to herbs
        const vrIsTree = vr.type.includes('tree');
        const vrIsHerb = vr.type.includes('herb');
        if ((isTree && !vrIsTree) || (isHerb && !vrIsHerb)) continue;
        const dx = (vr.position.x - (pos.x || 0));
        const dz = (vr.position.z - (pos.z || 0));
        const d2 = dx * dx + dz * dz;
        if (d2 < bestDist) { bestDist = d2; bestId = rid; }
      }
      // If it's close enough (within ~25 units squared ≈ 5m), remap key and tag mesh
      if (bestId && bestDist < 25) {
        const vr = this.resources.get(bestId)!;
        this.resources.delete(bestId);
        this.resources.set(serverId, { id: serverId, type: data.type, position: pos, mesh: vr.mesh });
        if (vr.mesh) {
          vr.mesh.userData.resourceId = serverId;
          vr.mesh.userData.resourceType = data.type;
          vr.mesh.name = `resource_${serverId}`;
        }
        // Also remap stump if it exists
        const stump = this.stumps.get(bestId);
        if (stump) {
          this.stumps.delete(bestId);
          this.stumps.set(serverId, stump);
        }
        Logger.system?.('ResourceVisualizationSystem', `Remapped visual resource ${bestId} -> ${serverId}`);
      } else {
        // Create a new visual if no nearby visual existed
        if (isTree) {
          const mesh = this.createTreeMeshInternal('normal_tree', pos);
          mesh.userData.resourceId = serverId;
          mesh.userData.resourceType = data.type;
          mesh.name = `resource_${serverId}`;
          // Ensure all descendants are tagged for reliable raycasts and lookups
          mesh.traverse((child) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (child as any).userData = (child as any).userData || {};
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (child as any).userData.resourceId = serverId;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (child as any).userData.resourceType = data.type;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (child as any).userData.clickable = true;
          });
          if (this.world.stage?.scene) this.world.stage.scene.add(mesh);
          this.resources.set(serverId, { id: serverId, type: data.type, position: pos, mesh });
        } else if (isHerb) {
          // Herbs have no dedicated visual here; create a tiny stump-like marker
          const stump = this.getOrCreateStump(serverId, pos);
          stump.visible = true;
          this.resources.set(serverId, { id: serverId, type: data.type, position: pos, mesh: stump });
        }
      }
    });

    // Listen for resource depletion
    this.subscribe(EventType.RESOURCE_DEPLETED, (data: { resourceId: string; position?: Position3D }) => {
      this.hideResource(data.resourceId, data.position);
    });

    // Listen for resource respawn
    this.subscribe(EventType.RESOURCE_RESPAWNED, (data: { resourceId: string; position?: Position3D }) => {
      this.showResource(data.resourceId, data.position);
      // Ensure stump is hidden and tree visible after respawn even if ids remapped
      const stump = this.stumps.get(data.resourceId);
      if (stump) stump.visible = false;
    });

    // Listen for test tree removal
    this.subscribe(EventType.TEST_TREE_REMOVE, (data: { id: string }) => {
      this.removeResource(data.id);
    });
  }

  private createResourceModels(): void {
    // Tree model - cylinder trunk + cone leaves
    const _treeGroup = new THREE.BufferGeometry();
    
    // Simple tree using basic shapes
    const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.7, 4, 8);
    const leavesGeometry = new THREE.ConeGeometry(2, 3, 8);
    
    // Store geometries
    this.resourceModels.tree = trunkGeometry;
    this.resourceModels.leaves = leavesGeometry;
    
    // Rock model - irregular dodecahedron
    this.resourceModels.rock = new THREE.DodecahedronGeometry(1, 0);
    
    // Fishing spot - torus to represent ripples
    this.resourceModels.fishing = new THREE.TorusGeometry(2, 0.2, 4, 16);
    
    // Create materials
    this.materials.trunk = new THREE.MeshLambertMaterial({ 
      color: 0x8B4513 // Brown
    });
    
    this.materials.leaves = new THREE.MeshLambertMaterial({ 
      color: 0x228B22 // Forest green
    });
    
    this.materials.oak_leaves = new THREE.MeshLambertMaterial({ 
      color: 0x9ACD32 // Yellow-green
    });
    
    this.materials.rock = new THREE.MeshLambertMaterial({ 
      color: 0x808080 // Gray
    });
    
    this.materials.water = new THREE.MeshLambertMaterial({ 
      color: 0x4682B4, // Steel blue
      transparent: true,
      opacity: 0.7
    });
  }

  private createResourceMesh(spawnPoint: {
    position: Position3D;
    type: string;
    subType: string;
    id: string;
  }): void {
    let mesh: THREE.Mesh;
    
    if (spawnPoint.type === 'tree' || spawnPoint.subType?.includes('tree')) {
      mesh = this.createTreeMeshInternal(
        spawnPoint.subType || 'normal_tree',
        spawnPoint.position
      );
    } else if (spawnPoint.type === 'rock' || spawnPoint.subType?.includes('rock')) {
      mesh = this.createRockMesh(spawnPoint.position);
    } else if (spawnPoint.type === 'fish' || spawnPoint.subType?.includes('fish')) {
      mesh = this.createFishingSpotMesh(spawnPoint.position);
    } else {
      // Default to tree for unknown types
      mesh = this.createTreeMeshInternal('normal_tree', spawnPoint.position);
    }
    
    mesh.userData.resourceId = spawnPoint.id;
    mesh.userData.resourceType = spawnPoint.subType || spawnPoint.type;
    mesh.userData.clickable = true; // Mark as clickable for interaction
    mesh.name = `resource_${spawnPoint.id}`;

    // Ensure raycasts on any child hit resolve to this resource
    mesh.traverse((obj) => {
      obj.userData.resourceId = spawnPoint.id;
      obj.userData.resourceType = spawnPoint.subType || spawnPoint.type;
      obj.userData.clickable = true;
    });
    
    // Add to scene
    if (this.world.stage?.scene) {
      this.world.stage.scene.add(mesh);
    }
    
    // Store reference
    this.resources.set(spawnPoint.id, {
      id: spawnPoint.id,
      type: spawnPoint.type,
      position: spawnPoint.position,
      mesh
    });
  }

  private createTreeMeshInternal(treeType: string, position: Position3D): THREE.Mesh {
    // Create a group to hold trunk and leaves
    const treeGroup = new THREE.Group();
    
    // Create trunk
    const trunk = new THREE.Mesh(
      this.resourceModels.tree,
      this.materials.trunk
    );
    trunk.position.y = 2; // Half height of trunk
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    trunk.name = 'tree_trunk';
    
    // Create leaves based on tree type
    const leavesMaterial = treeType === 'oak_tree' 
      ? this.materials.oak_leaves 
      : this.materials.leaves;
      
    const leaves = new THREE.Mesh(
      this.resourceModels.leaves,
      leavesMaterial
    );
    leaves.position.y = 5; // Above trunk
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    leaves.name = 'tree_leaves';
    
    treeGroup.add(trunk);
    treeGroup.add(leaves);
    treeGroup.name = 'tree_group';
    
    // Convert group to single mesh for simplicity
    const combinedGeometry = new THREE.BoxGeometry(3, 6, 3); // Simplified bounding box
    const _combinedMesh = new THREE.Mesh(combinedGeometry, this.materials.leaves);
    
    // Actually, let's just use the group directly by wrapping it
    const wrapperMesh = new THREE.Mesh();
    wrapperMesh.add(treeGroup);
    wrapperMesh.name = 'tree_wrapper';
    
    wrapperMesh.position.set(
      position.x,
      position.y || 0,
      position.z
    );
    
    return wrapperMesh;
  }

  private createTreeMesh(data: {
    id: string;
    position: Position3D;
    type: string;
    color?: string;
    size?: { x: number; y: number; z: number };
  }): void {
    // For test trees, create a colored box as specified
    const size = data.size || { x: 2, y: 5, z: 2 }; // Slightly bigger for easier clicking
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const material = new THREE.MeshLambertMaterial({ 
      color: data.color || 0x228B22 
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      data.position.x,
      (data.position.y || 0) + size.y / 2, // Place on ground
      data.position.z
    );
    
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.resourceId = data.id;
    mesh.userData.resourceType = data.type || 'tree';
    mesh.userData.clickable = true; // Mark as clickable for interaction system
    mesh.name = `test_tree_${data.id}`;

    // Safety: tag children as well (box has none, but future-proof)
    mesh.traverse((obj) => {
      obj.userData.resourceId = data.id;
      obj.userData.resourceType = data.type || 'tree';
      obj.userData.clickable = true;
    });
    
    // Add to scene
    if (this.world.stage?.scene) {
      this.world.stage.scene.add(mesh);
    }
    
    // Store reference
    this.resources.set(data.id, {
      id: data.id,
      type: data.type,
      position: data.position,
      mesh
    });
  }

  private createRockMesh(position: Position3D): THREE.Mesh {
    const mesh = new THREE.Mesh(
      this.resourceModels.rock,
      this.materials.rock
    );
    
    mesh.position.set(
      position.x,
      (position.y || 0) + 0.5,
      position.z
    );
    
    // Random rotation for variety
    mesh.rotation.x = Math.random() * Math.PI;
    mesh.rotation.y = Math.random() * Math.PI * 2;
    
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return mesh;
  }

  private createFishingSpotMesh(position: Position3D): THREE.Mesh {
    const mesh = new THREE.Mesh(
      this.resourceModels.fishing,
      this.materials.water
    );
    
    mesh.position.set(
      position.x,
      position.y || 0,
      position.z
    );
    
    mesh.rotation.x = Math.PI / 2; // Lay flat
    
    return mesh;
  }

  private hideResource(resourceId: string, eventPosition?: Position3D): void {
    let resource = this.resources.get(resourceId);
    
    // Fallback 0: find in scene by name or userData.resourceId
    if (!resource) {
      const obj = this.findObjectByResourceId(resourceId) as THREE.Mesh | null;
      if (obj) {
        resource = { 
          id: resourceId, 
          type: 'tree', 
          position: eventPosition || { x: obj.position.x, y: obj.position.y, z: obj.position.z }, 
          mesh: obj 
        };
        this.resources.set(resourceId, resource);
      }
    }
    
    // Fallback: find nearest by provided event position if available
    if (!resource && eventPosition) {
      let bestId: string | null = null;
      let bestDist = Infinity;
      for (const [rid, vr] of this.resources.entries()) {
        const refX = eventPosition.x;
        const refZ = eventPosition.z;
        const dx = (vr.mesh?.position.x || vr.position.x) - refX;
        const dz = (vr.mesh?.position.z || vr.position.z) - refZ;
        const d2 = dx * dx + dz * dz;
        if (d2 < bestDist) { 
          bestDist = d2; 
          bestId = rid; 
        }
      }
      if (bestId) resource = this.resources.get(bestId)!;
    }
    
    let obj = resource?.mesh || this.findObjectByResourceId(resourceId);
    if (!resource || !obj) return;
    
    // Climb to the top-most object that represents this resource to ensure complete hide
    const ascendToResourceRoot = (o: THREE.Object3D): THREE.Object3D => {
      let current: THREE.Object3D = o;
      while (current.parent) {
        const parent = current.parent as THREE.Object3D & { userData?: unknown };
        const parentName = (parent.name || '').toLowerCase();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sameId = !!(parent as any).userData && ((parent as any).userData.resourceId === resourceId);
        const isResourceRootName = parentName === `resource_${resourceId}` || parentName.includes('tree_wrapper') || parentName.includes('tree_group');
        if (sameId || isResourceRootName) {
          current = parent;
          continue;
        }
        break;
      }
      return current;
    };
    
    obj = ascendToResourceRoot(obj);
    const px = (resource.mesh && resource.mesh.position ? resource.mesh.position.x : resource.position.x);
    const pz = (resource.mesh && resource.mesh.position ? resource.mesh.position.z : resource.position.z);
    Logger.system?.('ResourceVisualizationSystem', `Hide resource ${resourceId} at (${Number(px).toFixed(0)}, ${Number(pz).toFixed(0)})`);
    
    // Compute world pos before removal for sibling cleanup
    const worldPos = new THREE.Vector3();
    obj.getWorldPosition(worldPos);
    
    // Remove the tree from its current parent (could be a group/chunk, not the scene)
    const parent = obj.parent || null;
    if (parent) {
      parent.remove(obj);
      this.detachedTrees.set(resourceId, { obj, parent });
      
      // Limited duplicate cleanup: only siblings in the same parent within 3m
      const siblings = [...parent.children];
      for (const sib of siblings) {
        if (sib === obj) continue;
        const name = (sib.name || '').toLowerCase();
        const isTreeName = name.includes('tree');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const typeTag = ((sib as any).userData?.resourceType || '').toLowerCase();
        const looksLikeTree = isTreeName || typeTag === 'tree';
        if (!looksLikeTree) continue;
        
        const sp = new THREE.Vector3();
        (sib as THREE.Object3D).getWorldPosition(sp);
        if (sp.distanceToSquared(worldPos) <= 9) {
          parent.remove(sib);
          this.detachedNearby.set(resourceId, [
            ...(this.detachedNearby.get(resourceId) || []),
            { obj: sib, parent }
          ]);
        }
      }
    } else {
      // No parent to remove from; at least hide it and mark as detached for later reattach
      obj.visible = false;
      this.detachedTrees.set(resourceId, { obj, parent: null });
    }
    
    // Place stump at the tree's world position for tree-type resources
    if (resource.type.includes('tree')) {
      const stump = this.getOrCreateStump(resourceId, { x: worldPos.x, y: worldPos.y, z: worldPos.z });
      stump.visible = true;
    }
  }

  private showResource(resourceId: string, eventPosition?: Position3D): void {
    let resource = this.resources.get(resourceId);
    
    // Fallback 0: find in scene by name or userData.resourceId
    if (!resource) {
      const obj = this.findObjectByResourceId(resourceId) as THREE.Mesh | null;
      if (obj) {
        resource = { 
          id: resourceId, 
          type: 'tree', 
          position: eventPosition || { x: obj.position.x, y: obj.position.y, z: obj.position.z }, 
          mesh: obj 
        };
        this.resources.set(resourceId, resource);
      }
    }
    
    // Fallback: find nearest to provided position if available
    if (!resource && eventPosition) {
      let bestId: string | null = null;
      let bestDist = Infinity;
      for (const [rid, vr] of this.resources.entries()) {
        const refX = eventPosition.x;
        const refZ = eventPosition.z;
        const dx = (vr.mesh?.position.x || vr.position.x) - refX;
        const dz = (vr.mesh?.position.z || vr.position.z) - refZ;
        const d2 = dx * dx + dz * dz;
        if (d2 < bestDist) { 
          bestDist = d2; 
          bestId = rid; 
        }
      }
      if (bestId) resource = this.resources.get(bestId)!;
    }
    
    if (!resource) return;
    
    const stored = this.detachedTrees.get(resourceId);
    const tree = stored?.obj || resource.mesh || this.findObjectByResourceId(resourceId);
    if (!tree) return;
    
    const parent = stored?.parent || this.world.stage?.scene || null;
    if (parent && tree.parent !== parent) {
      parent.add(tree);
    }
    
    Logger.system?.('ResourceVisualizationSystem', `Show resource ${resourceId} at (${(tree.position.x||resource.position.x).toFixed(0)}, ${(tree.position.z||resource.position.z).toFixed(0)})`);
    tree.visible = true;
    
    const stump = this.stumps.get(resourceId);
    if (stump) stump.visible = false;
    
    this.detachedTrees.delete(resourceId);
    
    // Reattach nearby trees that were removed during depletion
    const nearby = this.detachedNearby.get(resourceId);
    if (nearby) {
      for (const { obj: nearbyObj, parent: nearbyParent } of nearby) {
        if (nearbyParent && nearbyObj.parent !== nearbyParent) {
          nearbyParent.add(nearbyObj);
        }
        nearbyObj.visible = true;
      }
      this.detachedNearby.delete(resourceId);
    }
  }

  private getOrCreateStump(resourceId: string, position: Position3D): THREE.Mesh {
    const stump = this.stumps.get(resourceId);
    if (stump) return stump;
    
    // Create a very small, dark brown stump (barely visible) instead of bright green cube
    // This serves as a marker for the system but doesn't clutter the visual experience
    const geo = new THREE.CylinderGeometry(0.2, 0.25, 0.3, 6); // Small cylinder instead of cube
    const stumpMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x3d2817, // Dark brown for realistic stump
      transparent: true,
      opacity: 0.8
    });
    const stumpMesh = new THREE.Mesh(geo, stumpMaterial);
    stumpMesh.position.set(position.x, (position.y || 0) + 0.15, position.z); // Lower to ground
    stumpMesh.castShadow = true;
    stumpMesh.receiveShadow = true;
    stumpMesh.visible = false; // Start invisible, only show when tree is cut
    stumpMesh.name = `stump_${resourceId}`;
    if (this.world.stage?.scene) {
      this.world.stage.scene.add(stumpMesh);
    }
    this.stumps.set(resourceId, stumpMesh);
    return stumpMesh;
  }

  private removeResource(resourceId: string): void {
    const resource = this.resources.get(resourceId);
    if (resource && resource.mesh) {
      if (this.world.stage?.scene) {
        this.world.stage.scene.remove(resource.mesh);
      }
      
      // Dispose of geometry and material
      if (resource.mesh.geometry) {
        resource.mesh.geometry.dispose();
      }
      if (resource.mesh.material) {
        if (Array.isArray(resource.mesh.material)) {
          resource.mesh.material.forEach(mat => mat.dispose());
        } else {
          resource.mesh.material.dispose();
        }
      }
      
      this.resources.delete(resourceId);
    }
  }

  update(_deltaTime: number): void {
    // Could add animation here (e.g., slight sway for trees)
  }

  destroy(): void {
    // Clean up all resources
    for (const [id, _resource] of this.resources) {
      this.removeResource(id);
    }
    
    // Dispose of shared geometries
    for (const geometry of Object.values(this.resourceModels)) {
      geometry.dispose();
    }
    
    // Dispose of shared materials
    for (const material of Object.values(this.materials)) {
      material.dispose();
    }
    
    this.resources.clear();
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(_dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}

