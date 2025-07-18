import EventEmitter from 'eventemitter3';
import type { World, WorldOptions, System as ISystem } from '../../types/index.js';
/**
 * Base class for all game systems
 * Systems manage specific aspects of the game world (physics, rendering, entities, etc.)
 */
export declare abstract class System extends EventEmitter implements ISystem {
  world: World;
  constructor(world: World);
  /**
     * Initialize the system with world options
     * Called once when the world is initialized
     */
  init(_options: WorldOptions): Promise<void>;
  /**
     * Start the system
     * Called after all systems have been initialized
     */
  start(): void;
  /**
     * Destroy the system and clean up resources
     */
  destroy(): void;
  /**
     * Called at the beginning of each frame
     */
  preTick(): void;
  /**
     * Called before fixed update steps
     */
  preFixedUpdate(_willFixedStep: boolean): void;
  /**
     * Fixed timestep update for physics and deterministic logic
     */
  fixedUpdate(_delta: number): void;
  /**
     * Called after fixed update steps
     */
  postFixedUpdate(_delta: number): void;
  /**
     * Called before main update with interpolation alpha
     */
  preUpdate(_alpha: number): void;
  /**
     * Main update loop
     */
  update(_delta: number): void;
  /**
     * Called after main update
     */
  postUpdate(_delta: number): void;
  /**
     * Late update for camera and final adjustments
     */
  lateUpdate(_delta: number): void;
  /**
     * Called after late update
     */
  postLateUpdate(_delta: number): void;
  /**
     * Commit changes (e.g., render on client)
     */
  commit(): void;
  /**
     * Called at the end of each frame
     */
  postTick(): void;
}
