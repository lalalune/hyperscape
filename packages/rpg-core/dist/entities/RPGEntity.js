"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RPGEntity = void 0;
const Entity_1 = require("../../core/entities/Entity");
/**
 * RPG-specific entity that extends the base Entity class
 * with additional RPG functionality
 */
class RPGEntity extends Entity_1.Entity {
    constructor(world, type, data) {
        // Ensure data has required fields for Entity
        const entityData = {
            id: data.id || `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            name: data.name || type,
            position: data.position ? [data.position.x, data.position.y, data.position.z] : [0, 0, 0],
            quaternion: data.quaternion || [0, 0, 0, 1],
            ...data,
        };
        super(world, entityData);
        this.components = new Map();
    }
    /**
     * Add a component to the entity
     */
    addComponent(type, data) {
        // If data already has a type property, use it directly
        const component = {
            type,
            entity: this,
            data: data || {},
            entityId: this.data.id,
            ...data
        };
        this.components.set(type, component);
        return component;
    }
    /**
     * Get a component by type
     */
    getComponent(type) {
        return this.components.get(type) || null;
    }
    /**
     * Remove a component by type
     */
    removeComponent(type) {
        this.components.delete(type);
    }
    /**
     * Check if entity has a component
     */
    hasComponent(type) {
        return this.components.has(type);
    }
    /**
     * Get all components
     */
    getAllComponents() {
        return Array.from(this.components.values());
    }
    /**
     * Update entity - called every frame
     */
    update(_delta) {
        // Update logic can be implemented here
    }
    /**
     * Fixed update - called at fixed intervals
     */
    fixedUpdate(_delta) {
        // Fixed update logic can be implemented here
    }
    /**
     * Late update - called after all updates
     */
    lateUpdate(_delta) {
        // Late update logic can be implemented here
    }
    /**
     * Serialize entity data
     */
    serialize() {
        const data = super.serialize();
        // Add component data
        const componentData = {};
        this.components.forEach((component, type) => {
            componentData[type] = component;
        });
        return {
            ...data,
            components: componentData,
        };
    }
    destroy(local) {
        // Clean up components
        for (const [type, _] of this.components) {
            this.removeComponent(type);
        }
        // Call parent destroy
        super.destroy(local);
    }
}
exports.RPGEntity = RPGEntity;
//# sourceMappingURL=RPGEntity.js.map