/**
 * Nametag.ts - Player/NPC Name Label
 *
 * Displays character names and health bars above entities.
 */

import type { Nametags as NametagsSystem } from "../systems/client/Nametags";
import type { NametagData } from "../types/rendering/nodes";
import { Node } from "./Node";
import THREE from "../extras/three/three";

const defaults = {
  label: "...",
  health: 100,
};

// NOTE: this is the frontend nametag node
// just a handle to the nametags system
// not to be confused with the nametag system itself
export class Nametag extends Node {
  handle?: {
    move: (newMatrix: THREE.Matrix4) => void;
    setName: (name: string) => void;
    setHealth: (health: number) => void;
    destroy: () => void;
  } | null;

  _label?: string;
  _health?: number;

  constructor(data: NametagData = {}) {
    super(data);
    this.name = "nametag";

    // Convert label to string if it's a number
    if (data.label !== undefined) {
      this.label =
        data.label !== undefined ? String(data.label) : defaults.label;
    } else {
      this.label = defaults.label;
    }
    this.health = data.health;
  }

  mount() {
    const nametags = this.ctx?.systems.find(
      (s) => s.constructor.name === "Nametags",
    ) as NametagsSystem;
    if (nametags) {
      this.handle = nametags.add({
        name: this._label || "",
        health: this._health || 0,
      });
      if (this.handle) {
        this.handle.move(this.matrixWorld);
      }
    }
  }

  commit(didMove) {
    if (didMove) {
      this.handle?.move(this.matrixWorld);
    }
  }

  unmount() {
    this.handle?.destroy();
    this.handle = null;
  }

  copy(source: Nametag, recursive: boolean) {
    super.copy(source, recursive);
    this._label = source._label;
    return this;
  }

  get label() {
    return this._label;
  }

  set label(value) {
    const newValue = value !== undefined ? String(value) : defaults.label;
    if (this._label === newValue) return;
    this._label = newValue;
    this.handle?.setName(newValue);
  }

  get health() {
    return this._health;
  }

  set health(value) {
    const newValue = value ?? defaults.health;
    if (this._health === newValue) return;
    this._health = newValue;
    this.handle?.setHealth(newValue);
  }

  getProxy() {
    const self = this;
    if (!this.proxy) {
      let proxy = {
        get label() {
          return self.label;
        },
        set label(value) {
          self.label = value;
        },
        get health() {
          return self.health;
        },
        set health(value) {
          self.health = value;
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
