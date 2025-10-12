/**
 * Global type declarations for browser APIs and external libraries
 */

// Browser Touch API
declare interface Touch {
  identifier: number;
  target: EventTarget;
  clientX: number;
  clientY: number;
  screenX: number;
  screenY: number;
  pageX: number;
  pageX: number;
  radiusX: number;
  radiusY: number;
  rotationAngle: number;
  force: number;
}

// WebXR API types
declare type XRReferenceSpaceType = 'viewer' | 'local' | 'local-floor' | 'bounded-floor' | 'unbounded';

// Database item row type (for system interfaces)
declare interface ItemRow {
  id: string;
  player_id: string;
  item_id: string;
  quantity: number;
  slot: number;
  equipped: boolean;
}

