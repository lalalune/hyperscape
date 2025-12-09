/**
 * Resource system types for Hyperscape
 */

export interface ResourceItem {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  isAvailable: boolean;
  levelRequired?: number;
  skillRequired: string;
}

export interface ResourceSystem {
  getResourcesByType?: (type: string) => ResourceItem[];
  getAllResources?: () => ResourceItem[];
  getSystem?: (name: string) => unknown;
}
