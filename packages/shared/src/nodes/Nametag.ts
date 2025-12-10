/**
 * Nametag.ts - Player/NPC Name Label
 *
 * Displays character names above entities.
 *
 * IMPORTANT: Health bars are now handled separately by the HealthBars system.
 * This node ONLY handles name display.
 *
 * @see HealthBar node for health bar display
 * @see HealthBars system for the rendering system
 */

import type {
  Nametags as NametagsSystem,
  NametagHandle,
} from "../systems/client/Nametags";
import type { NametagData } from "../types/rendering/nodes";
import { Node } from "./Node";

const defaults = {
  label: "...",
};

/**
 * Nametag Node - Frontend handle for the Nametags system
 *
 * Provides a clean API for entities to manage their name label.
 * Health bars are handled separately by the HealthBar node/HealthBars system.
 */
export class Nametag extends Node {
  handle: NametagHandle | null = null;

  private _label: string = defaults.label;

  constructor(data: NametagData = {}) {
    super(data);
    this.name = "nametag";

    if (data.label !== undefined) {
      this._label = String(data.label);
    }
  }

  mount() {
    // Prevent multiple mounts - if we already have a handle, destroy it first
    if (this.handle) {
      this.handle.destroy();
      this.handle = null;
    }

    // Find Nametags system
    const nametags = this.ctx?.systems.find(
      (s) =>
        (s as { systemName?: string }).systemName === "nametags" ||
        s.constructor.name === "Nametags",
    ) as NametagsSystem | undefined;

    if (nametags) {
      this.handle = nametags.add({ name: this._label });
      if (this.handle) {
        this.handle.move(this.matrixWorld);
      }
    }
  }

  commit(didMove: boolean) {
    if (didMove && this.handle) {
      this.handle.move(this.matrixWorld);
    }
  }

  unmount() {
    if (this.handle) {
      this.handle.destroy();
      this.handle = null;
    }
  }

  copy(source: Nametag, recursive: boolean) {
    super.copy(source, recursive);
    this._label = source._label;
    return this;
  }

  get label(): string {
    return this._label;
  }

  set label(value: string | undefined) {
    const newValue = value !== undefined ? String(value) : defaults.label;
    if (this._label === newValue) return;
    this._label = newValue;
    this.handle?.setName(newValue);
  }

  getProxy() {
    const self = this;
    if (!this.proxy) {
      let proxy = {
        get label() {
          return self.label;
        },
        set label(value: string) {
          self.label = value;
        },
      };
      proxy = Object.defineProperties(
        proxy,
        Object.getOwnPropertyDescriptors(super.getProxy()),
      );
      this.proxy = proxy;
    }
    return this.proxy;
  }
}
