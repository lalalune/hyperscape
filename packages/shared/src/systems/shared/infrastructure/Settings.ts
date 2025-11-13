/**
 * Settings.ts - World Settings System
 *
 * Manages world configuration (title, player limits, visibility, etc.).
 */

import type { Settings as ISettings, World } from "../../../types/index";
import type {
  SettingsChanges,
  SettingsData,
} from "../../../types/core/settings";
import { System } from "..";
import { hasRole } from "../../../utils";

export class Settings extends System implements ISettings {
  title: string | null = null;
  desc: string | null = null;
  image: string | null = null;
  model?: { url: string } | string | null;
  avatar: string | null = null;
  public?: boolean;
  playerLimit: number | null = null;

  private changes: SettingsChanges | null = null;

  constructor(world: World) {
    super(world);
  }

  set(key: string, value: unknown, broadcast = false): void {
    const player = this.world.entities.player as
      | { data?: { roles?: string[] } }
      | undefined;
    if (
      broadcast &&
      !this.world.isServer &&
      player &&
      !hasRole(player.data?.roles, "admin")
    ) {
      (
        this.world.network as { send: (type: string, data: unknown) => void }
      ).send("settingsModified", { key, value });
    }
  }

  deserialize(data: SettingsData): void {
    this.title = data.title ?? null;
    this.desc = data.desc ?? null;
    this.image = data.image ?? null;
    this.model = data.model
      ? typeof data.model === "string"
        ? data.model
        : { url: data.model }
      : undefined;
    this.avatar = data.avatar ?? null;
    this.public = data.public === null ? undefined : data.public;
    this.playerLimit = data.playerLimit ?? null;

    this.emit("change", {
      title: { value: this.title },
      desc: { value: this.desc },
      image: { value: this.image },
      model: { value: this.model },
      avatar: { value: this.avatar },
      public: { value: this.public },
      playerLimit: { value: this.playerLimit },
    });
  }

  serialize(): SettingsData {
    return {
      desc: this.desc,
      title: this.title,
      image: this.image,
      model: typeof this.model === "object" ? this.model?.url : this.model,
      avatar: this.avatar,
      public: this.public === undefined ? null : this.public,
      playerLimit: this.playerLimit,
    };
  }

  override preFixedUpdate(): void {
    if (!this.changes) return;
    this.emit("change", this.changes);
    this.changes = null;
  }

  private modify(key: string, value: unknown): void {
    const currentValue =
      key in this ? (this as Record<string, unknown>)[key] : undefined;
    if (currentValue === value) return;
    const prev = currentValue;
    if (key in this) {
      (this as Record<string, unknown>)[key] = value;
    }

    if (!this.changes) this.changes = {};
    if (!this.changes[key]) this.changes[key] = { prev, value: null };
    this.changes[key].value = value;
  }
}
