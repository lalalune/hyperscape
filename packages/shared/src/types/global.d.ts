import THREE from '../extras/three';
import { World } from '../World';

declare global {
  const PHYSX: PhysXModule | undefined
  interface Window {
    THREE?: typeof THREE;
    world?: World;
    preview?: unknown; // AvatarPreview instance
    app?: unknown; // App instance for debugging
    env?: Record<string, string>;
    require?: unknown; // Monaco editor require function
    monaco?: unknown; // Monaco editor instance
    gc?: () => void; // Garbage collection function
    PARTICLES_PATH?: string;
  }
  
  // WebXR ambient typings (augmentations)
  // Add XR entry point on Navigator and minimal XR types used by the app
  interface Navigator {
    xr?: XRSystem;
  }

  type XRSessionMode = 'inline' | 'immersive-vr' | 'immersive-ar'

  interface XRSystem {
    isSessionSupported(mode: XRSessionMode): Promise<boolean>
    requestSession(mode: XRSessionMode, options?: XRSessionInit): Promise<XRSession>
  }

  // Augment XRSession with minimal fields used by our systems
  interface XRSession extends EventTarget {
    updateTargetFrameRate?(rate: number): void
    addEventListener?(type: string, listener: (event?: Event) => void): void
    inputSources?: ReadonlyArray<{
      handedness: 'left' | 'right' | 'none'
      gamepad?: { axes: readonly number[]; buttons: readonly { pressed: boolean }[] }
    }>
    renderState?: {
      baseLayer?: { framebufferWidth?: number; framebufferHeight?: number }
      layers?: Array<{ framebufferWidth?: number; framebufferHeight?: number }>
    }
  }

  // Node.js/Browser timer functions
  function setTimeout(callback: (...args: unknown[]) => void, ms?: number, ...args: unknown[]): NodeJS.Timeout;
  function clearTimeout(timeoutId: NodeJS.Timeout): void;
  function setInterval(callback: (...args: unknown[]) => void, ms?: number, ...args: unknown[]): NodeJS.Timeout;
  function clearInterval(intervalId: NodeJS.Timeout): void;

  interface NodeJS {
    global: unknown;
  }

  // Augment globalThis for non-browser environments
  var env: Record<string, string> | undefined;

  // Vite/import.meta types
  interface ImportMetaEnv {
    readonly PUBLIC_WS_URL?: string;
    readonly VITE_PUBLIC_WS_URL?: string;
    [key: string]: string | undefined;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {}; 