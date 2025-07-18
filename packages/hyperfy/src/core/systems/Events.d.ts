import { System } from './System.js';
import type { World, Events as IEvents } from '../../types/index.js';
/**
 * Events System
 *
 * - Runs on both the server and client.
 * - Used to notify apps of world events like player enter/leave
 *
 */
export declare class Events extends System implements IEvents {
  private eventListeners;
  constructor(world: World);
  emit<T extends string | symbol>(event: T, ...args: any[]): boolean;
  on<T extends string | symbol>(event: T, fn: (...args: any[]) => void, context?: any): this;
  off<T extends string | symbol>(event: T, fn?: (...args: any[]) => void, _context?: any, _once?: boolean): this;
  destroy(): void;
}
