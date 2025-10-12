/**
 * DatabaseSystem - Server-only system
 * 
 * The actual implementation is in the server package.
 * This is a type-only stub for shared imports.
 */

import { SystemBase } from './SystemBase';
import type { World } from '../types/index';

export class DatabaseSystem extends SystemBase {
  constructor(world: World) {
    super(world, { name: 'rpg-database', dependencies: {}, autoCleanup: false });
  }
}
