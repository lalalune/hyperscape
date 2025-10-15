/**
 * InstancedMeshManager.ts - Instanced Mesh Rendering Optimization
 * 
 * Manages Three.js InstancedMesh for efficiently rendering many copies of the same geometry.
 * Used for rendering large quantities of resources (trees, rocks) with minimal draw calls.
 * 
 * **How Instancing Works:**
 * - Single mesh + geometry can render thousands of instances
 * - Each instance has its own transform (position, rotation, scale)
 * - GPU processes all instances in one draw call (massive performance gain)
 * - Example: 1000 trees = 1 draw call instead of 1000
 * 
 * **Features:**
 * - Dynamic visibility culling based on distance from player
 * - Automatic instance pooling (show closest N instances)
 * - Per-type management (separate pools for trees, rocks, etc.)
 * - Entity ID tracking for interaction systems
 * 
 * **Performance:**
 * - Configurable max visible instances per type (default: 1000)
 * - Configurable cull distance (default: 200m)
 * - Update interval throttling (default: 500ms)
 * - Uses temporary matrices to avoid allocations
 * 
 * **Usage:**
 * ```ts
 * const manager = new InstancedMeshManager(scene, world);
 * 
 * // Register a mesh type
 * manager.registerMesh('tree', treeGeometry, treeMaterial, 500);
 * 
 * // Add instances
 * const id = manager.addInstance('tree', 'tree_1', position);
 * 
 * // Manager automatically handles visibility culling
 * ```
 * 
 * **Referenced by:** TerrainSystem (for resource rendering)
 */

import THREE from '../extras/three';
import type { World } from '../World';

/**
 * InstanceData - Internal tracking for a single instanced mesh type
 */
interface InstanceData {
    /** The Three.js InstancedMesh being managed */
    mesh: THREE.InstancedMesh;
    /** Map from instance ID to matrix array index */
    instanceMap: Map<number, number>;
    /** Reverse map from matrix index to instance ID */
    reverseInstanceMap: Map<number, number>;
    /** Map from matrix index to entity ID (for interactions) */
    entityIdMap: Map<number, string>;
    /** Next available instance ID */
    nextInstanceId: number;
    /** Maximum number of visible instances */
    maxVisibleInstances: number;
    /** All instances (both visible and culled) */
    allInstances: Map<number, {
        entityId: string;
        position: THREE.Vector3;
        rotation?: THREE.Euler;
        scale?: THREE.Vector3;
        matrix: THREE.Matrix4;
        visible: boolean;
        distance: number;
    }>;
}

/**
 * InstancedMeshManager - Efficient Rendering of Many Identical Objects
 * 
 * Provides GPU-accelerated rendering of large quantities of identical geometry
 * with automatic visibility culling and pooling.
 */
export class InstancedMeshManager {
    private scene: THREE.Scene;
    private instancedMeshes = new Map<string, InstanceData>();
    private dummy = new THREE.Object3D();
    private world?: World;
    private lastPlayerPosition = new THREE.Vector3();
    private updateInterval = 500; // Update visibility every 500ms
    private lastUpdateTime = 0;
    private maxInstancesPerType = 1000; // Max visible instances per type
    private cullDistance = 200; // Maximum distance to render instances
    private _tempMatrix = new THREE.Matrix4();
    private _tempVec3 = new THREE.Vector3();

    /**
     * Create a new InstancedMeshManager
     * 
     * @param scene - Three.js scene to add instanced meshes to
     * @param world - Optional world reference for player position tracking
     */
    constructor(scene: THREE.Scene, world?: World) {
        this.scene = scene;
        this.world = world;
    }

    /**
     * Register a mesh type for instanced rendering.
     * 
     * @param type - Unique identifier for this mesh type (e.g., 'oak_tree', 'iron_ore')
     * @param geometry - Shared geometry for all instances
     * @param material - Shared material for all instances
     * @param count - Optional max visible instances (default: maxInstancesPerType)
     */
    registerMesh(type: string, geometry: THREE.BufferGeometry, material: THREE.Material, count?: number): void {
        if (this.instancedMeshes.has(type)) {
            console.warn(`[InstancedMeshManager] Mesh type "${type}" is already registered.`);
            return;
        }

        // Use the provided count or default to maxInstancesPerType
        const visibleCount = Math.min(count || this.maxInstancesPerType, this.maxInstancesPerType);
        const mesh = new THREE.InstancedMesh(geometry, material, visibleCount);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.count = 0; // Start with no visible instances
        this.scene.add(mesh);
        
        this.instancedMeshes.set(type, {
            mesh,
            instanceMap: new Map(),
            reverseInstanceMap: new Map(),
            entityIdMap: new Map(),
            nextInstanceId: 0,
            maxVisibleInstances: visibleCount,
            allInstances: new Map()
        });
    }

    /**
     * Add a new instance to render.
     * 
     * @param type - Mesh type (must be registered first)
     * @param entityId - Entity ID for interaction tracking
     * @param position - World position
     * @param rotation - Optional rotation
     * @param scale - Optional scale
     * @returns Instance ID or null if type not registered
     */
    addInstance(type: string, entityId: string, position: THREE.Vector3, rotation?: THREE.Euler, scale?: THREE.Vector3): number | null {
        const data = this.instancedMeshes.get(type);
        if (!data) {
            console.error(`[InstancedMeshManager] No mesh registered for type "${type}".`);
            return null;
        }

        const instanceId = data.nextInstanceId++;
        
        // Create the transformation matrix
        this.dummy.position.copy(position);
        if (rotation) this.dummy.rotation.copy(rotation);
        else this.dummy.rotation.set(0,0,0);
        if (scale) this.dummy.scale.copy(scale);
        else this.dummy.scale.set(1,1,1);
        this.dummy.updateMatrix();

        // Store the instance data (always store, even if not immediately visible)
        data.allInstances.set(instanceId, {
            entityId,
            position: position.clone(),
            rotation: rotation?.clone(),
            scale: scale?.clone(),
            matrix: this.dummy.matrix.clone(),
            visible: false,
            distance: Infinity
        });

        // Trigger an immediate visibility update for this type
        this.updateInstanceVisibility(type);

        return instanceId;
    }

    /**
     * Remove an instance from rendering.
     * 
     * @param type - Mesh type
     * @param instanceId - Instance ID returned from addInstance()
     */
    removeInstance(type: string, instanceId: number): void {
        const data = this.instancedMeshes.get(type);
        if (!data) return;

        // Remove from all instances
        data.allInstances.delete(instanceId);

        // If this instance was visible, we need to update visibility
        const indexToRemove = data.instanceMap.get(instanceId);
        if (indexToRemove !== undefined) {
            const lastIndex = data.mesh.count - 1;

            if (indexToRemove !== lastIndex) {
                // Swap with the last element
                const lastMatrix = this._tempMatrix;
                data.mesh.getMatrixAt(lastIndex, lastMatrix);
                data.mesh.setMatrixAt(indexToRemove, lastMatrix);

                // Update the mapping for the swapped instance
                const lastInstanceId = data.reverseInstanceMap.get(lastIndex);
                if(lastInstanceId !== undefined) {
                    data.instanceMap.set(lastInstanceId, indexToRemove);
                    data.reverseInstanceMap.set(indexToRemove, lastInstanceId);
                }
                
                const lastEntityId = data.entityIdMap.get(lastIndex);
                if (lastEntityId) {
                    data.entityIdMap.set(indexToRemove, lastEntityId);
                }
            }
            
            data.mesh.count--;
            data.mesh.instanceMatrix.needsUpdate = true;
            data.instanceMap.delete(instanceId);
            data.reverseInstanceMap.delete(lastIndex);
            data.entityIdMap.delete(lastIndex);

            // Update visibility to potentially show another instance
            this.updateInstanceVisibility(type);
        }
    }

    /**
     * Get entity ID for an instance.
     * 
     * @param type - Mesh type
     * @param instanceIndex - Matrix array index (not instance ID)
     * @returns Entity ID or undefined
     */
    getEntityId(type: string, instanceIndex: number): string | undefined {
        const data = this.instancedMeshes.get(type);
        return data ? data.entityIdMap.get(instanceIndex) : undefined;
    }

    /**
     * Get all registered instanced meshes.
     * @returns Array of InstancedMesh objects
     */
    getMeshes(): THREE.InstancedMesh[] {
        return Array.from(this.instancedMeshes.values()).map(data => data.mesh);
    }

    /**
     * Update which instances are visible based on distance from player.
     * Shows the closest N instances up to maxVisibleInstances.
     */
    private updateInstanceVisibility(type: string): void {
        const data = this.instancedMeshes.get(type);
        if (!data || data.allInstances.size === 0) return;

        const playerPos = this.getPlayerPosition();
        if (!playerPos) return;

        // Calculate distances for all instances and filter by cull distance
        const instancesWithDistance: Array<[number, { entityId: string; position: THREE.Vector3; rotation?: THREE.Euler; scale?: THREE.Vector3; matrix: THREE.Matrix4; visible: boolean; distance: number }]> = [];
        for (const [id, instance] of data.allInstances) {
            instance.distance = instance.position.distanceTo(playerPos);
            // Only consider instances within the cull distance
            if (instance.distance <= this.cullDistance) {
                instancesWithDistance.push([id, instance]);
            }
        }

        // Sort by distance
        instancesWithDistance.sort((a, b) => a[1].distance - b[1].distance);

        // Clear current mappings
        data.instanceMap.clear();
        data.reverseInstanceMap.clear();
        data.entityIdMap.clear();

        // Update visible instances (take the nearest ones up to maxVisibleInstances)
        let visibleCount = 0;
        for (let i = 0; i < instancesWithDistance.length && visibleCount < data.maxVisibleInstances; i++) {
            const [instanceId, instance] = instancesWithDistance[i];
            
            // Set the matrix for this visible instance
            data.mesh.setMatrixAt(visibleCount, instance.matrix);
            
            // Update mappings
            data.instanceMap.set(instanceId, visibleCount);
            data.reverseInstanceMap.set(visibleCount, instanceId);
            data.entityIdMap.set(visibleCount, instance.entityId);
            
            instance.visible = true;
            visibleCount++;
        }

        // Mark remaining instances as not visible
        for (let i = visibleCount; i < instancesWithDistance.length; i++) {
            instancesWithDistance[i][1].visible = false;
        }

        // Update mesh count and mark for update
        data.mesh.count = visibleCount;
        data.mesh.instanceMatrix.needsUpdate = true;
    }

    /**
     * Update visibility for all mesh types.
     * Call this periodically (not every frame) to maintain performance.
     */
    updateAllInstanceVisibility(): void {
        const now = Date.now();
        if (now - this.lastUpdateTime < this.updateInterval) {
            return; // Don't update too frequently
        }
        this.lastUpdateTime = now;

        const playerPos = this.getPlayerPosition();
        if (!playerPos) return;

        // Only update if player has moved significantly
        if (playerPos.distanceTo(this.lastPlayerPosition) > 10) {
            this.lastPlayerPosition.copy(playerPos);
            
            // Update visibility for all types
            for (const type of this.instancedMeshes.keys()) {
                this.updateInstanceVisibility(type);
            }
        }
    }

    /**
     * Get current player position from the world
     */
    private getPlayerPosition(): THREE.Vector3 | null {
        if (!this.world) return null;
        
        const players = this.world.getPlayers();
        if (!players || players.length === 0) return null;
        
        const player = players[0]; // Use first player
        if (player.node?.position) {
            return this._tempVec3.set(
                player.node.position.x,
                player.node.position.y,
                player.node.position.z
            );
        }
        
        return null;
    }

    /**
     * Set world reference for player position tracking.
     * @param world - World instance
     */
    setWorld(world: World): void {
        this.world = world;
    }

    /**
     * Configure pooling and culling parameters.
     * 
     * @param config - Configuration object
     * @param config.maxInstancesPerType - Max visible instances per mesh type
     * @param config.cullDistance - Distance beyond which instances are hidden
     * @param config.updateInterval - Milliseconds between visibility updates
     */
    setPoolingConfig(config: { 
        maxInstancesPerType?: number; 
        cullDistance?: number; 
        updateInterval?: number;
    }): void {
        if (config.maxInstancesPerType !== undefined) {
            this.maxInstancesPerType = config.maxInstancesPerType;
        }
        if (config.cullDistance !== undefined) {
            this.cullDistance = config.cullDistance;
        }
        if (config.updateInterval !== undefined) {
            this.updateInterval = config.updateInterval;
        }
        
        // Force an immediate update after config change
        this.lastUpdateTime = 0;
        this.updateAllInstanceVisibility();
    }

    /**
     * Get statistics for all mesh types.
     * 
     * @returns Object mapping mesh type to { total, visible, maxVisible }
     */
    getPoolingStats(): { [type: string]: { total: number; visible: number; maxVisible: number } } {
        const stats: { [type: string]: { total: number; visible: number; maxVisible: number } } = {};
        
        for (const [type, data] of this.instancedMeshes) {
            stats[type] = {
                total: data.allInstances.size,
                visible: data.mesh.count,
                maxVisible: data.maxVisibleInstances
            };
        }
        
        return stats;
    }

    /**
     * Clean up all resources.
     * Disposes geometries, materials, and removes meshes from scene.
     */
    dispose(): void {
        for (const data of this.instancedMeshes.values()) {
            this.scene.remove(data.mesh);
            data.mesh.dispose();
        }
        this.instancedMeshes.clear();
    }
}
