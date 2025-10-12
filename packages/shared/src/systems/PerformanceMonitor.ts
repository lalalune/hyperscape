/**
 * Performance Monitor System
 * Tracks performance metrics across all systems
 * Reports timing data to MetricsCollector for test reporting
 */

import type { World } from '../types/index';
import { MetricsCollector } from '../utils/MetricsCollector';
import { SystemBase } from './SystemBase';

export class PerformanceMonitor extends SystemBase {
  private metricsCollector: MetricsCollector;
  private renderFrameCount = 0;
  private physicsFrameCount = 0;
  private lastMemoryCheck = 0;
  private memoryCheckInterval = 1000; // Check memory every second
  
  constructor(world: World) {
    super(world, {
      name: 'performance-monitor',
      dependencies: {
        required: [],
        optional: []
      },
      autoCleanup: true
    });
    this.metricsCollector = MetricsCollector.getInstance();
  }
  
  async init(): Promise<void> {
  }
  
  preUpdate(): void {
    // Start render timing
    this.metricsCollector.startRenderTiming();
  }
  
  update(_dt: number): void {
    // Count render frames
    this.renderFrameCount++;
    
    // Check memory periodically
    const now = Date.now();
    if (now - this.lastMemoryCheck > this.memoryCheckInterval) {
      this.checkMemoryUsage();
      this.lastMemoryCheck = now;
    }
  }
  
  postUpdate(): void {
    // End render timing
    this.metricsCollector.endRenderTiming();
  }
  
  preFixedUpdate(): void {
    // Start physics timing
    this.metricsCollector.startPhysicsTiming();
  }
  
  fixedUpdate(_dt: number): void {
    // Count physics frames
    this.physicsFrameCount++;
  }
  
  postFixedUpdate(): void {
    // End physics timing
    this.metricsCollector.endPhysicsTiming();
  }
  
  private checkMemoryUsage(): void {
    const now = Date.now();
    if (now - this.lastMemoryCheck > this.memoryCheckInterval) {
      this.lastMemoryCheck = now;
      if (typeof performance !== 'undefined' && 'memory' in performance) {
        const memoryPerf = performance as { memory?: { usedJSHeapSize: number } };
        if (memoryPerf.memory && memoryPerf.memory.usedJSHeapSize) {
          this.metricsCollector.reportMemoryUsage(memoryPerf.memory.usedJSHeapSize);
        }
      }
    }
  }

  destroy(): void {
    this.metricsCollector.reset();
  }
}