/**
 * LOD.ts - Level of Detail Node
 *
 * Container that shows/hides children based on camera distance.
 */

import THREE from "../extras/three";

import type { LODData, LODItem } from "../types/nodes";
import { isBoolean } from "../utils/ValidationUtils";
import { getRef, Node } from "./Node";

const v0 = new THREE.Vector3();
const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();

const defaults = {
  scaleAware: true,
};

export class LOD extends Node {
  lods: LODItem[];
  prevLod: LODItem | null;
  _scaleAware: boolean;
  lod: LODItem | undefined;

  constructor(data: LODData = {}) {
    super(data);
    this.name = "lod";

    this.lods = []; // [...{ node, maxDistance }]
    this.prevLod = null;
    this._scaleAware = defaults.scaleAware;

    if (data.scaleAware !== undefined) {
      this.scaleAware = data.scaleAware;
    }
  }

  insert(node: Node, maxDistance: number) {
    this.lods.push({ node, maxDistance });
    this.lods.sort((a, b) => a.maxDistance - b.maxDistance); // ascending
    node.active = false;
    this.add(node);
  }

  mount() {
    // Register with LODs system if present
    this.ctx?.lods?.register?.(this);
    this.check();
  }

  check() {
    if (this.prevLod) {
      this.prevLod.node.active = false;
      this.prevLod = null;
    }
    const cameraPos = v0.setFromMatrixPosition(this.ctx!.camera.matrixWorld);
    const itemPos = v1.setFromMatrixPosition(this.matrixWorld);
    let distance = cameraPos.distanceTo(itemPos);
    if (this._scaleAware) {
      v2.setFromMatrixScale(this.matrixWorld);
      const avgScale = (v2.x + v2.y + v2.z) / 3;
      distance = distance / avgScale;
    }
    const lod = this.lods.find((lodItem) => distance <= lodItem.maxDistance);
    // if this lod hasnt change, stop here
    if (this.lod === lod) return;
    // if we have a new lod, lets activate it immediately
    if (lod) {
      lod.node.active = true;
    }
    // if we have a pre-existing active lod, queue to remove it next frame
    if (this.lod) {
      this.prevLod = this.lod;
    }
    // track the new lod (if any)
    this.lod = lod;
  }

  unmount() {
    this.ctx?.lods?.unregister?.(this);
  }

  copy(source: LOD, recursive: boolean) {
    super.copy(source, recursive);
    this._scaleAware = source._scaleAware;
    this.lods = source.lods.map((lod: LODItem) => {
      const node = this.children.find((node) => node.id === lod.node.id);
      if (!node) {
        throw new Error(
          `[lod] Could not find node with id ${lod.node.id} during copy`,
        );
      }
      node.active = false;
      const maxDistance = lod.maxDistance;
      return {
        node,
        maxDistance,
      } as LODItem;
    });
    return this;
  }

  get scaleAware() {
    return this._scaleAware;
  }

  set scaleAware(value) {
    if (value === undefined) value = defaults.scaleAware;
    if (!isBoolean(value)) {
      throw new Error("[lod] scaleAware not a boolean");
    }
    if (this._scaleAware === value) return;
    this._scaleAware = value;
  }

  getProxy() {
    if (!this.proxy) {
      const self = this;
      let proxy = {
        get scaleAware() {
          return self.scaleAware;
        },
        set scaleAware(value) {
          self.scaleAware = value;
        },
        insert(pNode: Node, maxDistance: number) {
          const node = getRef(pNode);
          if (!node) {
            throw new Error("[lod] insert received null node from getRef");
          }
          self.insert(node, maxDistance);
          return this;
        },
      };
      proxy = Object.defineProperties(
        proxy,
        Object.getOwnPropertyDescriptors(super.getProxy()),
      ); // inherit Node properties
      this.proxy = proxy;
    }
    return this.proxy;
  }
}
