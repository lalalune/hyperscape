import { THREE } from "@hyperscape/shared";

declare global {
  interface Window {
    // Three.js globals
    scene: THREE.Scene;
    camera: THREE.Camera;
    renderer: THREE.WebGLRenderer | any; // Support both WebGL and WebGPU
    environment: THREE.Texture;

    // GLTF/VRM loaders
    GLTFLoader: new () => {
      loadAsync(url: string): Promise<{
        scene: THREE.Group;
      }>;
    };
    GLTFExporter: new () => {
      parse(
        scene: THREE.Object3D,
        onDone: (buffer: ArrayBuffer) => void,
        options: { binary: boolean; embedImages: boolean },
      ): void;
    };
    VRMLoader: {
      loadAsync(url: string): Promise<any>;
    };
    HDRLoader: new () => {
      load(
        url: string,
        onLoad: (texture: THREE.Texture) => void,
        onProgress?: (event: ProgressEvent) => void,
        onError?: (event: Error) => void,
      ): void;
    };
    TextureLoader: {
      load(
        url: string,
        onLoad: (texture: THREE.Texture) => void,
        onProgress?: (event: ProgressEvent) => void,
        onError?: (event: Error) => void,
      ): void;
    };

    // Custom functions
    snapshotFacingDirection(playerData: {
      position: [number, number, number];
      rotation: readonly [number, number, number, number];
    }): Promise<string>;

    snapshotViewToTarget(
      playerData: { position: [number, number, number] },
      targetPosition: [number, number, number],
    ): Promise<string>;

    snapshotEquirectangular(playerData: {
      position: [number, number, number];
      quaternion: readonly [number, number, number, number];
    }): Promise<string>;

    createVRMFactory(gltf: any, materialModifier: (mat: any) => any): any;

    // Storage maps
    texturesMap?: Map<string, THREE.Texture>;
    avatarMap?: Map<string, any>;
    activeVRMInstances?: any[];
  }
}

export {};
