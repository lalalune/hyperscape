/**
 * World and System Type Definitions
 *
 * Types for the client world instance, systems, and managers.
 */

import { THREE, World } from "@hyperscape/shared";
import type { Entity } from "./entities";

// Client World type: the actual World instance
export type ClientWorld = InstanceType<typeof World>;

export interface GraphicsSystem {
  width: number;
  height: number;
}

export interface ControlsSystem {
  pointer: {
    locked: boolean;
  };
  actions: Action[];
  bind: (options: { priority: number }) => {
    enter?: { onPress?: () => void };
    mouseLeft?: { onPress?: () => void };
    pointer?: { locked?: boolean };
    release?: () => void;
  };
  action: { onPress: () => void };
  jump: { onPress: () => void };
}

export interface Action {
  id: string;
  type: string;
  label: string;
  btn?: string;
}

export interface TargetSystem {
  show: (position: THREE.Vector3) => void;
  hide: () => void;
}

export interface XRManager {
  supportsVR: boolean;
  enter: () => void;
}

export interface ChatSystem {
  send: (message: string) => void;
  command: (command: string) => void;
  add: (data: unknown, broadcast?: boolean) => void;
  subscribe: (callback: (messages: unknown[]) => void) => () => void;
}

export interface NetworkManager {
  id: string;
  send: (event: string, data?: unknown) => void;
  upload: (file: File) => Promise<void>;
}

export interface LoaderManager {
  get: (type: string, url: string) => unknown;
  insert: (type: string, url: string, file: File) => void;
  loadFile: (url: string) => Promise<File>;
  getFile: (url: string, name?: string) => File | undefined;
}

export interface BuilderManager {
  enabled: boolean;
  toggle: (enabled?: boolean) => void;
  select: (entity: Entity) => void;
  getSpawnTransform: () => { position: number[]; quaternion: number[] };
  control: {
    pointer: {
      lock: () => void;
    };
  };
}

export interface FileInfo {
  type: string;
  name: string;
  url: string;
}

export interface WorldSettings {
  title: string;
  desc: string;
  image?: FileInfo;
  model?: FileInfo;
  avatar?: FileInfo;
  playerLimit: number;
  public: boolean;
  on: (event: "change", handler: (changes: unknown) => void) => void;
  off: (event: "change", handler: (changes: unknown) => void) => void;
  set: (key: string, value: unknown, broadcast?: boolean) => void;
}

export interface WorldPreferences {
  dpr: number;
  shadows: string;
  postprocessing: boolean;
  bloom: boolean;
  music: number;
  sfx: number;
  voice: number;
  ui: number;
  actions: boolean;
  stats: boolean;
  touchAction?: boolean;
  on: (event: string, handler: Function) => void;
  off: (event: string, handler: Function) => void;
  setDPR: (value: number) => void;
  setShadows: (value: string) => void;
  setPostprocessing: (value: boolean) => void;
  setBloom: (value: boolean) => void;
  setMusic: (value: number) => void;
  setSFX: (value: number) => void;
  setVoice: (value: number) => void;
  setUI: (value: number) => void;
  setActions: (value: boolean) => void;
  setStats: (value: boolean) => void;
}
