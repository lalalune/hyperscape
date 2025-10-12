import EventEmitter from 'eventemitter3';

import type { WorldOptions } from '../types/index';

import { World } from '../World';

export interface SystemConstructor {
  new (world: World): System;
}

export interface SystemDependencies {
  required?: string[]; // Systems that must be initialized before this one
  optional?: string[]; // Systems that should be initialized if available
}

/**
 * Base class for all game systems
 * Systems manage specific aspects of the game world (physics, rendering, entities, etc.)
 */
export abstract class System extends EventEmitter {
  world: World;
  protected initialized: boolean = false;
  protected started: boolean = false;

  constructor(world: World) {
    super();
    this.world = world;
  }

  /**
   * Override this to declare system dependencies
   * Called before initialization to determine init order
   */
  getDependencies(): SystemDependencies {
    return {};
  }

  /**
   * Initialize the system with world options
   * Called once when the world is initialized
   * All required dependencies are guaranteed to be initialized before this is called
   */
  async init(_options: WorldOptions): Promise<void> {
    // Override in subclasses if needed
    this.initialized = true;
  }

  /**
   * Start the system
   * Called after ALL systems have been initialized
   */
  start(): void {
    // Override in subclasses if needed
    this.started = true;
  }

  /**
   * Check if system is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if system is started
   */
  isStarted(): boolean {
    return this.started;
  }

  /**
   * Destroy the system and clean up resources
   */
  destroy(): void {
    // Override in subclasses if needed
    this.started = false;
    this.initialized = false;
  }

  // Update cycle methods - override as needed in subclasses

  /**
   * Called at the beginning of each frame
   */
  preTick(): void {
    // Override in subclasses if needed
  }

  /**
   * Called before fixed update steps
   */
  preFixedUpdate(_willFixedStep: boolean): void {
    // Override in subclasses if needed
  }

  /**
   * Fixed timestep update for physics and deterministic logic
   */
  fixedUpdate(_delta: number): void {
    // Override in subclasses if needed
  }

  /**
   * Called after fixed update steps
   */
  postFixedUpdate(_delta: number): void {
    // Override in subclasses if needed
  }

  /**
   * Called before main update with interpolation alpha
   */
  preUpdate(_alpha: number): void {
    // Override in subclasses if needed
  }

  /**
   * Main update loop
   */
  update(_delta: number): void {
    // Override in subclasses if needed
  }

  /**
   * Called after main update
   */
  postUpdate(_delta: number): void {
    // Override in subclasses if needed
  }

  /**
   * Late update for camera and final adjustments
   */
  lateUpdate(_delta: number): void {
    // Override in subclasses if needed
  }

  /**
   * Called after late update
   */
  postLateUpdate(_delta: number): void {
    // Override in subclasses if needed
  }

  /**
   * Commit changes (e.g., render on client)
   */
  commit(): void {
    // Override in subclasses if needed
  }

  /**
   * Called at the end of each frame
   */
  postTick(): void {
    // Override in subclasses if needed
  }
} 