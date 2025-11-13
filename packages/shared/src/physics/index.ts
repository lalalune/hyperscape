/**
 * PhysX integration
 */

export {
  loadPhysX,
  waitForPhysX,
  getPhysX,
  isPhysXReady,
} from "./PhysXManager";

export * from "./Layers";

// Server-specific PhysX manager is not exported from this barrel
// Import directly: import { ... } from './PhysXManager.server'
