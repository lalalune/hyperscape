/**
 * Hyperfy Type Definitions
 * ========================
 * Comprehensive type definitions for the Hyperfy plugin
 */

import type { UUID } from '@elizaos/core';
import * as THREE from 'three';

// Entity Types
export interface HyperfyPosition {
  x: number;
  y: number;
  z: number;
}

export interface HyperfyRotation {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface HyperfyScale {
  x: number;
  y: number;
  z: number;
}

export interface HyperfyTransform {
  position: HyperfyPosition;
  rotation: HyperfyRotation;
  scale: HyperfyScale;
}

export interface HyperfyEntityData {
  id: string;
  name: string;
  type?: string;
  blueprintId?: string;
  position?: number[];
  quaternion?: number[];
  scale?: number[];
  metadata?: Record<string, unknown>;
  pinned?: boolean;
  blueprint?: string;
}

export interface HyperfyEntity {
  id: string;
  type?: string;
  components?: HyperfyComponent[];
  data?: any;
  blueprint?: {
    name?: string;
  };
  position?: {
    x: number;
    y: number;
    z: number;
  };
}

export interface HyperfyComponent {
  type: string;
  data: any;
}

export interface HyperfyPlayer extends HyperfyEntity {
  data: HyperfyEntityData & {
    id: string;
    name: string;
    effect?: {
      emote?: string | null;
    };
  };
  moving: boolean;
  setSessionAvatar?: (url: string) => void;
  modify?: (changes: Partial<HyperfyEntityData>) => void;
}

// Blueprint Types
export interface HyperfyBlueprint {
  id: string;
  name: string;
  type?: string;
  description?: string;
  tags?: string[];
  image?: string;
  author?: string;
  url?: string;
  desc?: string;
  model?: string;
  script?: string;
  props?: Record<string, unknown>;
  preload?: boolean;
  public?: boolean;
  locked?: boolean;
  frozen?: boolean;
  disabled?: boolean;
  unique?: boolean;
}

// Chat Types
export interface HyperfyChatMessage {
  id: string;
  entityId: string;
  text: string;
  timestamp: number;
  from?: string;
  metadata?: Record<string, unknown>;
}

export interface HyperfyChat {
  msgs: HyperfyChatMessage[];
  listeners: ((msgs: HyperfyChatMessage[]) => void)[];
  add: (msg: HyperfyChatMessage, broadcast?: boolean) => void;
  subscribe: (callback: (msgs: HyperfyChatMessage[]) => void) => () => void;
}

// Network Types
export interface HyperfyNetwork {
  id: string;
  send: (event: string, data: Record<string, unknown>) => void;
  upload: (file: File) => Promise<void>;
  disconnect: () => Promise<void>;
  maxUploadSize: number;
}

// Control Types
export interface HyperfyControls {
  enabled: boolean;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  grounded: boolean;
  jumpPower: number;
  goto: (x: number, z: number, y?: number) => Promise<void>;
  jump: () => void;
  respawn: () => void;
  setPosition: (x: number, y: number, z: number) => void;
  setQuaternion: (x: number, y: number, z: number, w: number) => void;
  lookAt: (x: number, y: number, z: number) => void;
  stop: () => void;
  stopAllActions?: () => void;
  scrollDelta?: number;
  pointer?: { x: number; y: number };
  camera?: THREE.Camera;
  screen?: { width: number; height: number };
  followEntity?: (entityId: string) => void;
  setKey?: (keyName: string, isDown: boolean) => void;
  keyX?: {
    pressed: boolean;
    released: boolean;
    onPress?: () => void;
    onRelease?: () => void;
  };
}

// Action Types
export interface HyperfyActions {
  enabled?: boolean;
  register?: (action: any) => void;
  unregister?: (action: any) => void;
  trigger?: (actionName: string, ...args: any[]) => void;
  currentNode?: HyperfyEntity;
  nodes?: HyperfyEntity[];
  getNearby?: (radius: number) => any[];
  execute?: (actionName: string, ...args: unknown[]) => void;
}

// Loader Types
export interface HyperfyLoader {
  load: (url: string) => Promise<HyperfyLoadResult>;
}

export interface HyperfyLoadResult {
  gltf?: any; // GLTF object from Three.js
  emoteFactory?: any;
  error?: Error;
}

// Stage Types
export interface HyperfyStage {
  scene: THREE.Scene;
  environment?: THREE.Texture;
  background?: THREE.Color | THREE.Texture;
}

// Settings Types
export interface HyperfySettings {
  on: (event: string, handler: (data: SettingsChangeEvent) => void) => void;
  model: Record<string, unknown>;
}

export interface SettingsChangeEvent {
  key: string;
  value: unknown;
  prev: unknown;
}

// Event Types
export interface HyperfyEvents {
  emit: (event: string, data: Record<string, unknown>) => void;
  on: (event: string, handler: (data: Record<string, unknown>) => void) => void;
  off: (event: string) => void;
}

// World Types
export interface HyperfyWorld {
  entities: {
    player: HyperfyPlayer | null;
    players: Map<string, HyperfyPlayer>;
    items: Map<string, HyperfyEntity>;
    add: (entity: HyperfyEntity) => void;
    remove: (entityId: string) => void;
    getPlayer: (id: string) => HyperfyPlayer | null;
  };
  network: HyperfyNetwork;
  chat: HyperfyChat;
  controls: HyperfyControls | null;
  loader: HyperfyLoader | null;
  stage: HyperfyStage;
  camera: THREE.PerspectiveCamera | null;
  rig: THREE.Object3D | null;
  livekit: any | null; // Optional LiveKit integration
  events: HyperfyEvents;
  blueprints: {
    add: (blueprint: HyperfyBlueprint) => void;
  };
  settings: HyperfySettings;
  systems: HyperfySystem[];
  actions: HyperfyActions;
  assetsUrl?: string;
  init: (config: HyperfyWorldConfig) => Promise<void>;
  destroy: () => void;
  on: (event: string, handler: (data: Record<string, unknown>) => void) => void;
  off: (event: string) => void;
}

export interface HyperfyWorldConfig {
  wsUrl?: string;
  assetsUrl?: string;
  token?: string;
  metadata?: Record<string, unknown>;
}

// System Types
export interface HyperfySystem {
  name?: string;
  world: any; // Allow any world type for compatibility with existing systems
  init?: () => void | Promise<void>;
  tick?: (delta: number) => void;
  destroy?: () => void;
  enabled?: boolean;
}

// Manager Return Types
export interface EmoteUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface BuildOperationResult {
  success: boolean;
  entity?: HyperfyEntity;
  error?: string;
}

export interface NavigationResult {
  success: boolean;
  reachedTarget?: boolean;
  error?: string;
}

// Voice Types
export interface VoiceStreamData {
  audio: Buffer;
  sampleRate: number;
  channels: number;
}

// Puppeteer Screenshot Types
export interface ScreenshotOptions {
  width?: number;
  height?: number;
  format?: 'png' | 'jpeg';
  quality?: number;
}

export interface ScreenshotResult {
  data: string; // base64 encoded image
  width: number;
  height: number;
  format: string;
}

// Export utility type guards
export function isHyperfyEntity(obj: unknown): obj is HyperfyEntity {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'data' in obj &&
    typeof (obj as any).data === 'object' &&
    'id' in (obj as any).data
  );
}

export function isHyperfyPlayer(entity: HyperfyEntity): entity is HyperfyPlayer {
  return 'moving' in entity && entity.data.id !== undefined && entity.data.name !== undefined;
}

export function isHyperfyChatMessage(obj: unknown): obj is HyperfyChatMessage {
  return (
    obj !== null && typeof obj === 'object' && 'id' in obj && 'text' in obj && 'timestamp' in obj
  );
}

export interface HyperfyBlueprints {
  items: Map<string, HyperfyBlueprint>;
  get: (id: string) => HyperfyBlueprint | undefined;
  add: (blueprint: HyperfyBlueprint, isOwned?: boolean) => string;
  remove: (id: string) => void;
  clear: () => void;
}

export interface HyperfyEntities {
  items: Map<string, HyperfyEntity>;
  player?: HyperfyEntity;
  players: Map<string, HyperfyPlayer>;
  get: (id: string) => HyperfyEntity | undefined;
  add: (data: HyperfyEntityData, isOwned?: boolean) => HyperfyEntity;
  remove: (id: string) => void;
  clear: () => void;
  update: (id: string, data: Partial<HyperfyEntityData>) => void;
}

/**
 * UGC Content Bundle Interface
 */
export interface UGCContentBundle {
  id: string;
  name: string;
  version: string;
  description: string;
  type: 'rpg' | 'minigame' | 'experience' | 'custom';

  // Features provided by this content
  features?: {
    [key: string]: boolean;
  };

  // Actions provided by this content
  actions?: HyperfyActionDescriptor[];

  // Installation lifecycle
  install: (world: HyperfyWorld, runtime: any) => Promise<UGCContentInstance>;
}

export interface UGCContentInstance {
  id: string;
  contentId: string;

  // Lifecycle
  start?: () => Promise<void>;
  stop?: () => Promise<void>;
  uninstall: () => Promise<void>;

  // State access
  getState?: () => any;

  // Visual verification (for testing)
  visualVerifier?: any;
}

export interface HyperfyActionDescriptor {
  name: string;
  description: string;
  category: 'combat' | 'inventory' | 'skills' | 'quest' | 'social' | 'movement' | 'custom';
  parameters: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
  examples: string[];
  handler?: (params: any) => Promise<any>;
}

/**
 * Game Bundle Interface
 */
export interface Bundle {
  id: string;
  name: string;
  version: string;
  description: string;
  
  // Bundle lifecycle
  init: (world: World) => Promise<void>;
  destroy?: (world: World) => Promise<void>;
}

/**
 * Bundle World Interface (extends HyperfyWorld with bundle-specific methods)
 */
export interface World extends HyperfyWorld {
  createEntity: (options: EntityCreateOptions) => Entity;
  removeEntity: (entity: Entity) => void;
  getEntity: (entityId: string) => Entity | null;
  getPlayer: (playerId: string) => Player | null;
  getPlayerByName: (name: string) => Player | null;
  getPlayers: () => Player[];
  setState: (key: string, value: any) => void;
  getState: (key: string) => any;
  sendToPlayer: (playerId: string, data: any) => void;
  broadcast: (data: any) => void;
}

/**
 * Bundle Player Interface (extends HyperfyPlayer)
 */
export interface Player extends HyperfyPlayer {
  id: string;
  name: string;
  position: HyperfyPosition;
  teleport: (position: number[]) => void;
  setVisible: (visible: boolean) => void;
}

/**
 * Bundle Entity Interface
 */
export interface Entity {
  id: string;
  setColor: (color: string) => void;
  getMetadata: () => any;
}

/**
 * Entity creation options
 */
export interface EntityCreateOptions {
  type: string;
  position: number[];
  scale?: number[];
  color?: string;
  emissive?: string;
  emissiveIntensity?: number;
  metalness?: number;
  roughness?: number;
  rotation?: number[];
  interactive?: boolean;
  metadata?: any;
}
