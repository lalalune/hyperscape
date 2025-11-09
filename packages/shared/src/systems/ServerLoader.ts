import fs from "fs-extra";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
// import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js.js'
import { GLTFLoader } from "../libs/gltfloader/GLTFLoader";
// import { VRMLoaderPlugin } from '@pixiv/three-vrm'

import { createEmoteFactory } from "../extras/createEmoteFactory";
import { createNode } from "../extras/createNode";
import { glbToNodes } from "../extras/glbToNodes";
import type { GLBData, HSNode as INode, World } from "../types";
import { System } from "./System";

/**
 * Node.js Filesystem-Based Asset Loader
 *
 * Platform-specific loader for Node.js server environments:
 * - fs-extra for file system operations
 * - Direct ArrayBuffer/Buffer manipulation
 * - No browser-specific APIs (no DOM, no video, no audio context)
 * - Supports both local files and remote HTTP(S) URLs
 *
 * ## Why Separate from ClientLoader?
 *
 * This loader uses Node.js-specific APIs unavailable in browsers:
 * - `fs.readFile()` for local filesystem access
 * - Node.js Buffer handling
 * - Synchronous file operations where needed
 * - No DOM elements (no Image, HTMLVideoElement, Canvas, AudioContext)
 *
 * The server doesn't need full asset processing because:
 * - No rendering (no textures, materials, or visual output)
 * - No audio playback (no AudioContext or audio decoding)
 * - No video playback (no HTMLVideoElement or HLS)
 * - Models are loaded minimally for metadata only
 *
 * ## Supported Formats (Minimal)
 *
 * - **Models**: .glb (parsed for structure, not rendered)
 * - **Emotes**: .glb animations (for animation data only)
 * - **Avatars**: Stub implementation (VRM not needed server-side)
 * - **HDR**: Skipped (no environment rendering)
 * - **Images**: Skipped (no texture processing)
 * - **Video**: Rejected (no video playback)
 * - **Audio**: Rejected (no audio context)
 *
 * @see ClientLoader for browser-based loading with full media support
 */
export class ServerLoader extends System {
  private promises: Map<string, Promise<unknown>>;
  private results: Map<string, unknown>;
  private hdrLoader: RGBELoader;
  private gltfLoader: GLTFLoader;
  private preloadItems: Array<{ type: string; url: string }>;
  private preloader: Promise<void> | null = null;

  constructor(world: World) {
    super(world);
    this.promises = new Map();
    this.results = new Map();
    this.hdrLoader = new RGBELoader();
    this.gltfLoader = new GLTFLoader();
    this.preloadItems = [];
    // this.gltfLoader.register(parser => new VRMLoaderPlugin(parser))

    // The global polyfills are now applied in server-polyfills.ts before this module loads
  }

  start() {
    // ...
  }

  has(type: string, url: string) {
    const key = `${type}/${url}`;
    return this.promises.has(key);
  }

  get(type: string, url: string) {
    const key = `${type}/${url}`;
    return this.results.get(key);
  }

  preload(type: string, url: string) {
    this.preloadItems.push({ type, url });
  }

  execPreload() {
    const promises = this.preloadItems.map((item) =>
      this.load(item.type, item.url),
    );
    this.preloader = Promise.allSettled(promises).then(() => {
      this.preloader = null;
    });
  }

  async fetchArrayBuffer(url: string) {
    const isRemote = url.startsWith("http://") || url.startsWith("https://");
    if (isRemote) {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      return arrayBuffer;
    } else {
      const buffer = await fs.readFile(url);
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      );
      return arrayBuffer;
    }
  }

  async fetchText(url: string) {
    const isRemote = url.startsWith("http://") || url.startsWith("https://");
    if (isRemote) {
      const response = await fetch(url);
      const text = await response.text();
      return text;
    } else {
      const text = await fs.readFile(url, { encoding: "utf8" });
      return text;
    }
  }

  load(type: string, url: string) {
    const key = `${type}/${url}`;
    if (this.promises.has(key)) {
      return this.promises.get(key);
    }
    url = this.world.resolveURL(url, true);

    let promise;
    if (type === "hdr") {
      // promise = this.hdrLoader.loadAsync(url).then(texture => {
      //   return texture
      // })
    }
    if (type === "image") {
      // ...
    }
    if (type === "texture") {
      // ...
    }
    if (type === "model") {
      promise = this.fetchArrayBuffer(url).then((arrayBuffer) => {
        return new Promise<unknown>((resolve, _reject) => {
          this.gltfLoader.parse(arrayBuffer as ArrayBuffer, "", (glb) => {
            const node = glbToNodes(glb as GLBData, this.world);
            const model = {
              toNodes() {
                const clonedNode = node.clone(true);
                const nodeMap = new Map<string, INode>();
                nodeMap.set("root", clonedNode as INode);
                return nodeMap;
              },
              getStats() {
                const stats = node.getStats(true);
                return stats;
              },
            };
            this.results.set(key, model);
            resolve(model);
          });
        });
      });
    }
    if (type === "emote") {
      promise = this.fetchArrayBuffer(url).then((arrayBuffer) => {
        return new Promise<unknown>((resolve, _reject) => {
          this.gltfLoader.parse(
            arrayBuffer as ArrayBuffer,
            "",
            (glb: unknown) => {
              const factory = createEmoteFactory(glb as GLBData, url);
              const emote = {
                toClip(options) {
                  return factory.toClip(options);
                },
              };
              this.results.set(key, emote);
              resolve(emote);
            },
          );
        });
      });
    }
    if (type === "avatar") {
      promise = new Promise<unknown>((resolve) => {
        // NOTE: we can't load vrms on the server yet but we don't need 'em anyway
        let node: INode;
        const glb = {
          toNodes: () => {
            if (!node) {
              node = createNode("group");
              const node2 = createNode("avatar", {
                id: "avatar",
                factory: null,
              });
              (node as { add: (child: INode) => void }).add(node2);
            }
            const clone = node.clone(true);
            const nodeMap = new Map<string, INode>();
            nodeMap.set("root", clone as INode);
            const avatarNode = (
              clone as { get: (id: string) => INode | undefined }
            ).get("avatar");
            if (avatarNode) {
              nodeMap.set("avatar", avatarNode);
            }
            return nodeMap;
          },
        };
        this.results.set(key, glb);
        resolve(glb);
      });
    }
    if (type === "script") {
      // DISABLED: Script loading from external files
      // Scripts are now part of TypeScript classes created by Systems
      promise = new Promise<unknown>((_resolve, reject) => {
        console.warn(
          `[ServerLoader] ⚠️ Script loading disabled - Attempted to load: ${url}`,
        );
        console.warn(
          `[ServerLoader] Scripts must now be implemented as TypeScript classes`,
        );
        reject(
          new Error(
            "Script loading is disabled. Use TypeScript classes instead.",
          ),
        );
      });
    }
    if (type === "audio") {
      promise = new Promise<unknown>((_resolve, reject) => {
        reject(null);
      });
    }
    if (promise) {
      this.promises.set(key, promise);
    }
    return promise;
  }

  destroy() {
    this.promises.clear();
    this.results.clear();
    this.preloadItems = [];
  }
}
