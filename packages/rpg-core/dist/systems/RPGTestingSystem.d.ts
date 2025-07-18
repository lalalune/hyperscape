import { World } from '@hyperfy/sdk';
/**
 * RPG Testing System - Hyperfy Native Implementation
 *
 * Integrates RPG test scenarios directly into Hyperfy world system
 * Uses Hyperfy entities, components, and UI for visual validation
 */
import { System } from '../../core/systems/System.js';
import type { Entity, WorldOptions } from '../../types/index.js';
import { Vector3 } from '../types';
export interface TestScenario {
    id: string;
    name: string;
    description: string;
    maxDuration: number;
    timeoutMs: number;
    expectedVisuals: Array<{
        entityId: string;
        color: string;
        position: Vector3;
        visible: boolean;
    }>;
}
export interface TestResult {
    scenarioId: string;
    success: boolean;
    duration: number;
    reason: string;
    visualConfirmations: number;
    dataConfirmations: number;
    logs: string[];
}
export declare class RPGTestingSystem extends System {
    private testEntities;
    private currentScenario;
    private testStartTime;
    private testLogs;
    private testUI;
    private isTestMode;
    private testTimeouts;
    private testAbortControllers;
    constructor(world: World);
    init(options: WorldOptions): Promise<void>;
    start(): void;
    /**
     * Enable test mode - shows UI and enables testing features
     */
    enableTestMode(): void;
    /**
     * Create Hyperfy-native test UI
     */
    private createTestUI;
    /**
     * Create test UI component using Hyperfy UI system
     */
    private createTestUIComponent;
    private createTestButton;
    private createColorLegend;
    /**
     * Spawn test entity using Hyperfy entity system
     */
    spawnTestEntity(id: string, type: 'player' | 'npc' | 'building' | 'item' | 'waypoint' | 'obstacle', position: Vector3, color: string, size?: Vector3): Entity | null;
    private getGeometryForType;
    /**
     * Move entity using Hyperfy physics/movement
     */
    moveTestEntity(entityId: string, targetPosition: Vector3, duration?: number): boolean;
    private calculateSpeed;
    /**
     * Banking test scenario - Hyperfy native with timeout protection
     */
    runBankingTest(): Promise<TestResult>;
    /**
     * Combat test scenario - Hyperfy native with timeout protection
     */
    runCombatTest(): Promise<TestResult>;
    /**
     * Movement test scenario - Hyperfy native with timeout protection
     */
    runMovementTest(): Promise<TestResult>;
    /**
     * Run all test scenarios sequentially with comprehensive timeout handling
     */
    runAllTests(): Promise<TestResult[]>;
    /**
     * Validate that entities are visually present and correct
     */
    private validateEntityVisuals;
    /**
     * Clear all test entities
     */
    clearTestEntities(): void;
    /**
     * Show comprehensive test report
     */
    showTestReport(): void;
    /**
     * Event handlers
     */
    private handleTestStart;
    private handleTestStop;
    private handleTestCleanup;
    /**
     * Utility methods
     */
    private log;
    private delay;
    /**
     * Run test with timeout protection
     */
    private runTestWithTimeout;
    /**
     * Clear test timeout and abort controller
     */
    private clearTestTimeout;
    /**
     * Check if test should be aborted
     */
    private isTestAborted;
    destroy(): void;
}
//# sourceMappingURL=RPGTestingSystem.d.ts.map