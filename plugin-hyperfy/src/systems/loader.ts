import * as THREE from 'three';
// import { createEmoteFactory } from '@elizaos/hyperfy'; // Not available
// import { createNode } from '@elizaos/hyperfy'; // Not available
// import { glbToNodes } from '@elizaos/hyperfy'; // Not available
// import { GLTFLoader, type GLTF } from '@elizaos/hyperfy'; // Not available
import type { HyperfySystem } from '../types/hyperfy.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PuppeteerManager } from '../managers/puppeteer-manager.js';
import { resolveUrl } from '../utils.js';
import { AgentAvatar } from './avatar.js';
import type { HyperfyWorld } from '../types/hyperfy.js';
import { logger } from '@elizaos/core';

// import { VRMLoaderPlugin } from "@pixiv/three-vrm";
// --- Mock Browser Environment for Loaders ---
// These might need adjustment based on GLTFLoader/VRMLoaderPlugin requirements
if (typeof globalThis !== 'undefined') {
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
      if (type === 'img') {
        // Basic mock for image elements if texture loading is attempted (though we aim to bypass it)
        return {
          src: '',
          onload: () => {},
          onerror: () => {},
        };
      }
      // Default mock for other elements like canvas
      return { style: {} };
    },
    createElement: (type: string) => {
      if (type === 'img') {
        return { src: '', onload: () => {}, onerror: () => {} };
      }
      // Basic canvas mock if needed
      if (type === 'canvas') {
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

export class AgentLoader implements HyperfySystem {
  world: any;
  promises: Map<any, any>;
  results: Map<any, any>;
  gltfLoader: GLTFLoader;
  dummyScene: any;
  constructor(world: any) {
    this.world = world;
    this.promises = new Map();
    this.results = new Map();
    this.gltfLoader = new GLTFLoader();

    // --- Dummy Scene for Hooks ---
    // Create one dummy object to act as the scene target for all avatar loads
    this.dummyScene = new THREE.Object3D();
    this.dummyScene.name = 'AgentLoaderDummyScene';
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
    logger.info('[AgentLoader] execPreload called (No-op).');
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

    const promise = fetch(resolvedUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`[AgentLoader] HTTP error ${response.status} for ${resolvedUrl}`);
        }

        if (type === 'model' || type === 'avatar' || type === 'emote') {
          const result = await this.parseGLB(type, key, resolvedUrl);
          return result;
        }

        // TEMP WORKAROUND: Only load scripts that do not create video, UI, or image elements.
        // TODO: Replace this with a proper script validation system.
        if (type === 'script') {
          const code = await response.text();

          const forbiddenTypes = ['video', 'ui', 'image'];
          const isForbidden = forbiddenTypes.some((type) =>
            new RegExp(`app\\.create\\s*\\(\\s*['"]${type}['"]\\s*(,|\\))`).test(code)
          );

          if (isForbidden) {
            logger.warn('[ScriptLoader] Skipping script: disallowed type used\n');
            return;
          }

          const script = this.world.scripts.evaluate(code);
          this.results.set(key, script);
          return script;
        }

        logger.warn(`[AgentLoader] Unsupported type in load(): ${type}`);
        return null;
      })
      .catch((error) => {
        this.promises.delete(key);
        logger.error(`[AgentLoader] Failed to load ${type} from ${resolvedUrl}`, error);
        throw error;
      });

    this.promises.set(key, promise);
    return promise;
  }

  async parseGLB(type: string, key: string, url: string) {
    const puppeteerManager = PuppeteerManager.getInstance();
    const bytes =
      type === 'avatar'
        ? await puppeteerManager.loadVRMBytes(url)
        : await puppeteerManager.loadGlbBytes(url);
    const arrayBuffer = Uint8Array.from(bytes).buffer;

    const gltf: GLTF = await new Promise((ok, bad) =>
      this.gltfLoader.parse(arrayBuffer, '', ok, bad)
    );

    let result: any;

    if (type === 'model') {
      // const node = glbToNodes(gltf, this.world as any); // Not available
      const node = gltf.scene.clone(true); // Use gltf scene directly
      result = {
        gltf,
        toNodes() {
          return node.clone(true);
        },
      };
    } else if (type === 'emote') {
      // const factory = createEmoteFactory(gltf, url); // Not available
      const factory = { toClip: (o: any) => null }; // Mock factory
      result = {
        gltf,
        toClip(o: any) {
          return factory.toClip(o);
        },
      };
    } else if (type === 'avatar') {
      const factory = undefined;
      // const root = createNode('group', { id: '$root' }); // Not available
      const root = new THREE.Group(); // Mock root
      root.add(new AgentAvatar({ id: 'avatar', factory }));
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
