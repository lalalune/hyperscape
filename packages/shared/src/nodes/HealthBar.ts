/**
 * HealthBar.ts - Entity Health Bar Node
 *
 * Frontend handle to the HealthBars system for rendering health bars above entities.
 * Similar architecture to Nametag node but ONLY handles health bars.
 *
 * Usage:
 * ```typescript
 * // Create health bar
 * const healthBar = createNode('healthbar', {
 *   entityId: 'mob-123',
 *   health: 50,
 *   maxHealth: 100,
 *   visible: false  // Hidden by default, shown during combat
 * });
 *
 * // Mount to HealthBars system
 * healthBar.ctx = world;
 * healthBar.mount();
 *
 * // Update position in update loop
 * healthBar.handle.move(matrix);
 *
 * // Show during combat
 * healthBar.handle.show(5000);  // Auto-hide after 5 seconds
 *
 * // Update health
 * healthBar.health = 30;
 * ```
 */

import type {
  HealthBars as HealthBarsSystem,
  HealthBarHandle,
} from "../systems/client/HealthBars";
import { Node } from "./Node";
import THREE from "../extras/three/three";

interface HealthBarData {
  entityId?: string;
  health?: number;
  maxHealth?: number;
  visible?: boolean;
  active?: boolean;
  [key: string]: unknown; // Index signature for NodeData compatibility
}

const defaults = {
  health: 100,
  maxHealth: 100,
  visible: false,
};

/**
 * HealthBar Node - Frontend handle for the HealthBars system
 *
 * Provides a clean API for entities to manage their health bars.
 * The actual rendering is handled by the HealthBars system (atlas + instanced mesh).
 */
export class HealthBar extends Node {
  handle: HealthBarHandle | null = null;

  private _entityId: string = "";
  private _health: number = defaults.health;
  private _maxHealth: number = defaults.maxHealth;
  private _visible: boolean = defaults.visible;

  constructor(data: HealthBarData = {}) {
    super(data);
    this.name = "healthbar";

    this._entityId = data.entityId || "";
    this._health = data.health ?? defaults.health;
    this._maxHealth = data.maxHealth ?? defaults.maxHealth;
    this._visible = data.visible ?? defaults.visible;
  }

  mount() {
    // Prevent multiple mounts - if we already have a handle, destroy it first
    if (this.handle) {
      this.handle.destroy();
      this.handle = null;
    }

    // Find HealthBars system
    const healthbars = this.ctx?.systems.find(
      (s) =>
        (s as { systemName?: string }).systemName === "healthbars" ||
        s.constructor.name === "HealthBars",
    ) as HealthBarsSystem | undefined;

    if (healthbars) {
      this.handle = healthbars.add(
        this._entityId,
        this._health,
        this._maxHealth,
      );
      if (this.handle) {
        this.handle.move(this.matrixWorld);
        // Apply initial visibility
        if (this._visible) {
          this.handle.show();
        }
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

  copy(source: HealthBar, recursive: boolean) {
    super.copy(source, recursive);
    this._entityId = source._entityId;
    this._health = source._health;
    this._maxHealth = source._maxHealth;
    this._visible = source._visible;
    return this;
  }

  // Entity ID (readonly after mount)
  get entityId(): string {
    return this._entityId;
  }

  // Health property
  get health(): number {
    return this._health;
  }

  set health(value: number) {
    const newValue = Math.max(0, Math.min(this._maxHealth, value));
    if (this._health === newValue) return;
    this._health = newValue;
    this.handle?.setHealth(this._health, this._maxHealth);
  }

  // Max health property
  get maxHealth(): number {
    return this._maxHealth;
  }

  set maxHealth(value: number) {
    const newValue = Math.max(1, value);
    if (this._maxHealth === newValue) return;
    this._maxHealth = newValue;
    this.handle?.setHealth(this._health, this._maxHealth);
  }

  // Visibility property
  get visible(): boolean {
    return this._visible;
  }

  set visible(value: boolean) {
    if (this._visible === value) return;
    this._visible = value;
    if (this.handle) {
      if (value) {
        this.handle.show();
      } else {
        this.handle.hide();
      }
    }
  }

  /**
   * Show health bar (optionally with auto-hide timeout)
   * @param timeoutMs - Auto-hide after this many milliseconds (omit for permanent show)
   */
  show(timeoutMs?: number) {
    this._visible = true;
    this.handle?.show(timeoutMs);
  }

  /**
   * Hide health bar immediately
   */
  hide() {
    this._visible = false;
    this.handle?.hide();
  }

  getProxy() {
    const self = this;
    if (!this.proxy) {
      let proxy = {
        get entityId() {
          return self.entityId;
        },
        get health() {
          return self.health;
        },
        set health(value: number) {
          self.health = value;
        },
        get maxHealth() {
          return self.maxHealth;
        },
        set maxHealth(value: number) {
          self.maxHealth = value;
        },
        get visible() {
          return self.visible;
        },
        set visible(value: boolean) {
          self.visible = value;
        },
        show: (timeoutMs?: number) => self.show(timeoutMs),
        hide: () => self.hide(),
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
