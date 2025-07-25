/// <reference types="vite/client" />

// Global type declarations

// Extend global scope
declare global {
  // Global variables
  const PHYSX: any;
  var env: Record<string, string> | undefined;
  var physx: any;
  var PhysX: any;
  var repairIntrinsics: any;
  
  // Window extensions
  interface Window {
    require?: any;
    monaco?: any;
    env?: Record<string, string>;
    PARTICLES_PATH?: string;
    world?: any;
    app?: any;
  }
  
  // Performance API extensions
  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }
}

// Fix for storage module
declare module '*/storage' {
  export const storage: {
    get(key: string, defaultValue?: any): any;
    set(key: string, value: any): void;
  };
}

export {}; 