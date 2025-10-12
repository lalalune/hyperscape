import THREE from '../extras/three';
import type { World } from '../World';

interface InstanceData {
    mesh: THREE.InstancedMesh;
    instanceMap: Map<number, number>; // instanceId -> matrix array index
    reverseInstanceMap: Map<number, number>; // matrix array index -> instanceId
    entityIdMap: Map<number, string>; // matrix array index -> entityId
    nextInstanceId: number;
    maxVisibleInstances: number;
    allInstances: Map<number, {
        entityId: string;
        position: THREE.Vector3;
        rotation?: THREE.Euler;
        scale?: THREE.Vector3;
        matrix: THREE.Matrix4;
        visible: boolean;
        distance: number;
    }>; // All instances, visible or not
}

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

    constructor(scene: THREE.Scene, world?: World) {
        this.scene = scene;
        this.world = world;
    }

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

    getEntityId(type: string, instanceIndex: number): string | undefined {
        const data = this.instancedMeshes.get(type);
        return data ? data.entityIdMap.get(instanceIndex) : undefined;
    }

    getMeshes(): THREE.InstancedMesh[] {
        return Array.from(this.instancedMeshes.values()).map(data => data.mesh);
    }

    /**
     * Update visibility of instances based on distance to player
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
     * Update all instance visibility based on current player position
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
     * Set the world reference (for cases where it's not available at construction)
     */
    setWorld(world: World): void {
        this.world = world;
    }

    /**
     * Configure pooling parameters
     * @param config Object containing optional configuration parameters
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
     * Get statistics about instance pooling
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

    dispose(): void {
        for (const data of this.instancedMeshes.values()) {
            this.scene.remove(data.mesh);
            data.mesh.dispose();
        }
        this.instancedMeshes.clear();
    }
}
