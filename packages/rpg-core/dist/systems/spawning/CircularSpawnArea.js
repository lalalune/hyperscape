"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircularSpawnArea = void 0;
/**
 * Circular spawn area implementation
 */
class CircularSpawnArea {
    constructor(center, radius, minSpacing = 1, avoidOverlap = true, maxHeight = 0) {
        this.center = center;
        this.radius = radius;
        this.type = 'circle';
        this.minSpacing = minSpacing;
        this.avoidOverlap = avoidOverlap;
        this.maxHeight = maxHeight;
    }
    /**
     * Get a random position within the circular area
     */
    getRandomPosition() {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.sqrt(Math.random()) * this.radius;
        const yOffset = this.maxHeight > 0 ? (Math.random() - 0.5) * this.maxHeight * 2 : 0;
        return {
            x: this.center.x + Math.cos(angle) * distance,
            y: this.center.y + yOffset,
            z: this.center.z + Math.sin(angle) * distance,
        };
    }
    /**
     * Check if position is valid within the area
     */
    isValidPosition(position) {
        const distance = this.distance(position, this.center);
        return distance <= this.radius;
    }
    /**
     * Calculate distance between two positions
     */
    distance(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}
exports.CircularSpawnArea = CircularSpawnArea;
//# sourceMappingURL=CircularSpawnArea.js.map