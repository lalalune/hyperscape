import * as THREE from 'three';

// Extend three.js types with three-mesh-bvh extensions
declare module 'three' {
  interface BufferGeometry {
    computeBoundsTree(): void;
    disposeBoundsTree(): void;
    boundsTree?: any;
  }
  
  interface Raycaster {
    firstHitOnly?: boolean;
  }
  
  interface InstancedMesh {
    resize(size: number): void;
  }
}

// Re-export enhanced types
export {};
