import { THREE, System } from "@hyperscape/shared";
import { logger } from "@elizaos/core";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PlaywrightManager } from "../managers/playwright-manager";
import { resolveUrl } from "../utils";
import { AgentAvatar } from "./avatar";
import type { World } from "@hyperscape/shared";

// import { VRMLoaderPlugin } from "@pixiv/three-vrm";

interface ModelResult {
  gltf: GLTF;
  toNodes(): THREE.Object3D;
}

interface EmoteResult {
  gltf: GLTF;
  toClip(target: THREE.Object3D): THREE.AnimationClip | null;
}

interface AvatarResult {
  gltf: GLTF;
  factory: undefined;
  toNodes(): THREE.Object3D;
}

type LoadResult = ModelResult | EmoteResult | AvatarResult;

// --- Mock Browser Environment for Loaders ---
// These might need adjustment based on GLTFLoader/VRMLoaderPlugin requirements
if (typeof globalThis !== "undefined") {
  // Mock URL if not globally available or needs specific behavior
  // globalThis.URL = URL; // Usually available in modern Node

  // Mock self if needed by any dependency
  // globalThis.self = globalThis;

  // Mock window minimally
  // @ts-ignore - Mocking for GLTFLoader compatibility
  globalThis.window = globalThis.window || globalThis;

  // Mock document minimally for GLTFLoader
  // @ts-ignore - Mocking for GLTFLoader compatibility
  globalThis.document = globalThis.document || {
    createElementNS: (ns: string, type: string) => {
      if (type === "img") {
        // Basic mock for image elements if texture loading is attempted (though we aim to bypass it)
        return {
          src: "",
          onload: () => {},
          onerror: () => {},
        };
      }
      // Default mock for other elements like canvas
      return { style: {} };
    },
    createElement: (type: string) => {
      if (type === "img") {
        return { src: "", onload: () => {}, onerror: () => {} };
      }
      // Basic canvas mock if needed
      if (type === "canvas") {
        return { getContext: () => null, style: {} };
      }
      return { style: {} }; // Default
    },
    // Add more document mocks if loader errors indicate they are needed
  };

  // Polyfill fetch if using older Node version without native fetch
  // globalThis.fetch = fetch;
}
// --- End Mocks ---

export class AgentLoader extends System {
  declare world: World;
  promises: Map<string, Promise<LoadResult>>;
  results: Map<string, LoadResult>;
  gltfLoader: GLTFLoader;
  dummyScene: THREE.Object3D;
  constructor(world: World) {
    super(world);
    this.promises = new Map();
    this.results = new Map();
    this.gltfLoader = new GLTFLoader();

    // --- Dummy Scene for Hooks ---
    // Create one dummy object to act as the scene target for all avatar loads
    this.dummyScene = new THREE.Object3D();
    this.dummyScene.name = "AgentLoaderDummyScene";
    // -----------------------------

    // --- Attempt to register VRM plugin ---
    // try {
    //     this.gltfLoader.register(parser => new VRMLoaderPlugin(parser, {
    //         autoUpdateHumanBones: false
    //     }));
    //     logger.info("[AgentLoader] VRMLoaderPlugin registered.");
    // } catch (vrmError) {
    //     logger.error("[AgentLoader] Warning: Failed to register VRMLoaderPlugin. VRM-specific features might be unavailable.", vrmError);
    // }
    // ---------------------------------------
  }

  // --- Dummy Preload Methods ---
  preload(type: string, url: string) {
    // No-op for agent
  }
  execPreload() {
    // No-op for agent
    // ClientNetwork calls this after snapshot, so it must exist.
    logger.info("[AgentLoader] execPreload called (No-op).");
  }
  // ---------------------------

  // --- Basic Cache Handling ---
  // ... (has, get methods remain the same) ...
  has(type: string, url: string) {
    const key = `${type}/${url}`;
    return this.results.has(key) || this.promises.has(key);
  }
  get(type: string, url: string) {
    const key = `${type}/${url}`;
    return this.results.get(key);
  }
  // ---------------------------

  async load(type: string, url: string) {
    const key = `${type}/${url}`;
    if (this.promises.has(key)) {
      return this.promises.get(key);
    }

    const resolvedUrl = await resolveUrl(url, this.world);

    if (!resolvedUrl) {
      const error = new Error(`[AgentLoader] Failed to resolve URL: ${url}`);
      logger.error(error.message);
      throw error;
    }

    const promise = fetch(resolvedUrl).then(async (response) => {
      const result = await this.parseGLB(type, key, resolvedUrl);
      return result;
    });

    this.promises.set(key, promise);
    return promise;
  }

  async parseGLB(type: string, key: string, url: string) {
    const playwrightManager = PlaywrightManager.getInstance();
    const bytes =
      type === "avatar"
        ? await playwrightManager.loadVRMBytes(url)
        : await playwrightManager.loadGlbBytes(url);
    const arrayBuffer = Uint8Array.from(bytes).buffer;

    const gltf: GLTF = await new Promise((ok, bad) =>
      this.gltfLoader.parse(arrayBuffer, "", ok, bad),
    );

    let result: LoadResult;

    if (type === "model") {
      // const node = glbToNodes(gltf, this.world); // Not available
      const node = gltf.scene.clone(true); // Use gltf scene directly
      result = {
        gltf,
        toNodes() {
          return node.clone(true);
        },
      };
    } else if (type === "emote") {
      // const factory = createEmoteFactory(gltf, url); // Not available
      const factory = { toClip: (target: THREE.Object3D) => null }; // Mock factory
      result = {
        gltf,
        toClip(target: THREE.Object3D) {
          return factory.toClip(target);
        },
      };
    } else if (type === "avatar") {
      const factory = undefined;
      // const root = createNode('group', { id: '$root' }); // Not available
      const root = new THREE.Group(); // Mock root
      root.add(new AgentAvatar({ id: "avatar", factory }));
      result = {
        gltf,
        factory,
        toNodes() {
          return root.clone(true);
        },
      };
    } else {
      throw new Error(`[AgentLoader] Unsupported GLTF type: ${type}`);
    }

    this.results.set(key, result);
    return result;
  }
}
