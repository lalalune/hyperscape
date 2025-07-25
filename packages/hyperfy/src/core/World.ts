import * as THREE from 'three';
import EventEmitter from 'eventemitter3';
import type { 
  World as IWorld, 
  WorldOptions, 
  System, 
  SystemConstructor, 
  HotReloadable,
  Settings,
  Collections,
  Anchors,
  Events,
  Chat,
  Blueprints,
  Entities,
  Physics,
  Stage,
  Scripts
} from '../types';

import { Settings as SettingsSystem } from './systems/Settings';
import { Collections as CollectionsSystem } from './systems/Collections';
import { Anchors as AnchorsSystem } from './systems/Anchors';
import { Events as EventsSystem } from './systems/Events';
import { Chat as ChatSystem } from './systems/Chat';
import { Blueprints as BlueprintsSystem } from './systems/Blueprints';
import { Entities as EntitiesSystem } from './systems/Entities';
import { Physics as PhysicsSystem } from './systems/Physics';
import { Stage as StageSystem } from './systems/Stage';
import { Scripts as ScriptsSystem } from './systems/Scripts';

export class World extends EventEmitter implements IWorld {
  // Time management
  maxDeltaTime = 1 / 30; // 0.33333
  fixedDeltaTime = 1 / 50; // 0.01666
  frame = 0;
  time = 0;
  accumulator = 0;
  
  // Core properties
  systems: System[] = [];
  networkRate = 1 / 8; // 8Hz
  assetsUrl: string | null = null;
  assetsDir: string | null = null;
  hot = new Set<HotReloadable>();
  
  // Three.js objects
  rig: any; // THREE.Object3D with any event map
  camera: THREE.PerspectiveCamera;
  
  // Systems
  settings!: Settings;
  collections!: Collections;
  anchors!: Anchors;
  events!: Events;
  scripts!: Scripts;
  chat!: Chat;
  blueprints!: Blueprints;
  entities!: Entities;
  physics!: Physics;
  stage!: Stage;
  
  // Optional properties from interface
  ui?: any;
  loader?: any;
  network?: any;
  target?: any;
  db?: any;
  server?: any;
  monitor?: any;
  livekit?: any;
  environment?: any;
  graphics?: any;
  controls: any;
  prefs: any;
  audio: any = null;
  
  // Storage
  storage?: any;

  // Helper properties for common access patterns
  get isServer(): boolean {
    return this.network?.isServer ?? false;
  }

  get isClient(): boolean {
    return this.network?.isClient ?? true;
  }

  constructor() {
    super();

    this.rig = new THREE.Object3D() as any;
    // NOTE: camera near is slightly smaller than spherecast. far is slightly more than skybox.
    // this gives us minimal z-fighting without needing logarithmic depth buffers
    this.camera = new THREE.PerspectiveCamera(70, 0, 0.2, 1200);
    this.rig.add(this.camera);

    // Register core systems
    this.register('settings', SettingsSystem);
    this.register('collections', CollectionsSystem);
    this.register('anchors', AnchorsSystem);
    this.register('events', EventsSystem);
    this.register('scripts', ScriptsSystem);
    this.register('chat', ChatSystem);
    this.register('blueprints', BlueprintsSystem);
    this.register('entities', EntitiesSystem);
    this.register('physics', PhysicsSystem);
    this.register('stage', StageSystem);
  }

  register(key: string, SystemClass: SystemConstructor): System {
    const system = new SystemClass(this);
    this.systems.push(system);
    (this as any)[key] = system;
    return system;
  }

  async init(options: WorldOptions): Promise<void> {
    this.storage = options.storage;
    this.assetsDir = options.assetsDir || null;
    this.assetsUrl = options.assetsUrl || null;
    
    for (const system of this.systems) {
      console.log(`[World] Initializing system: ${system.constructor.name}`);
      if (typeof system.init !== 'function') {
        console.error(`[World] ERROR: System ${system.constructor.name} does not have an init method!`);
        console.error(`[World] System prototype:`, Object.getOwnPropertyNames(Object.getPrototypeOf(system)));
        throw new Error(`System ${system.constructor.name} does not have an init method`);
      }
      await system.init(options);
      console.log(`[World] ✅ System ${system.constructor.name} initialized`);
    }
    
    this.start();
  }

  start(): void {
    for (const system of this.systems) {
      system.start();
    }
  }

  tick = (time: number): void => {
    // begin any stats/performance monitors
    this.preTick();
    
    // update time, delta, frame and accumulator
    time /= 1000;
    let delta = time - this.time;
    if (delta < 0) delta = 0;
    if (delta > this.maxDeltaTime) {
      delta = this.maxDeltaTime;
    }
    
    this.frame++;
    this.time = time;
    this.accumulator += delta;
    
    // prepare physics
    const willFixedStep = this.accumulator >= this.fixedDeltaTime;
    this.preFixedUpdate(willFixedStep);
    
    // run as many fixed updates as we can for this ticks delta
    while (this.accumulator >= this.fixedDeltaTime) {
      // run all fixed updates
      this.fixedUpdate(this.fixedDeltaTime);
      // step physics
      this.postFixedUpdate(this.fixedDeltaTime);
      // decrement accumulator
      this.accumulator -= this.fixedDeltaTime;
    }
    
    // interpolate physics for remaining delta time
    const alpha = this.accumulator / this.fixedDeltaTime;
    this.preUpdate(alpha);
    
    // run all updates
    this.update(delta, alpha);
    
    // run post updates, eg cleaning all node matrices
    this.postUpdate(delta);
    
    // run all late updates
    this.lateUpdate(delta, alpha);
    
    // run post late updates, eg cleaning all node matrices
    this.postLateUpdate(delta);
    
    // commit all changes, eg render on the client
    this.commit();
    
    // end any stats/performance monitors
    this.postTick();
  }

  private preTick(): void {
    for (const system of this.systems) {
      system.preTick();
    }
  }

  private preFixedUpdate(willFixedStep: boolean): void {
    for (const system of this.systems) {
      system.preFixedUpdate(willFixedStep);
    }
  }

  private fixedUpdate(delta: number): void {
    for (const item of Array.from(this.hot)) {
      item.fixedUpdate?.(delta);
    }
    for (const system of this.systems) {
      system.fixedUpdate(delta);
    }
  }

  private postFixedUpdate(delta: number): void {
    for (const system of this.systems) {
      system.postFixedUpdate(delta);
    }
  }

  private preUpdate(alpha: number): void {
    for (const system of this.systems) {
      system.preUpdate(alpha);
    }
  }

  private update(delta: number, _alpha: number): void {
    for (const item of Array.from(this.hot)) {
      item.update?.(delta);
    }
    for (const system of this.systems) {
      try {
        system.update(delta);
      } catch (error) {
        console.error(`[World] Error in system update:`, system.constructor.name, error);
        throw error;
      }
    }
  }

  private postUpdate(delta: number): void {
    for (const system of this.systems) {
      system.postUpdate(delta);
    }
  }

  private lateUpdate(delta: number, _alpha: number): void {
    for (const item of Array.from(this.hot)) {
      item.lateUpdate?.(delta);
    }
    for (const system of this.systems) {
      system.lateUpdate(delta);
    }
  }

  private postLateUpdate(delta: number): void {
    for (const item of Array.from(this.hot)) {
      item.postLateUpdate?.(delta);
    }
    for (const system of this.systems) {
      system.postLateUpdate(delta);
    }
  }

  private commit(): void {
    for (const system of this.systems) {
      system.commit();
    }
  }

  private postTick(): void {
    for (const system of this.systems) {
      system.postTick();
    }
  }

  setupMaterial = (material: THREE.Material): void => {
    // @ts-ignore - CSM is added by environment system
    this.environment?.csm?.setupMaterial(material);
  }

  setHot(item: HotReloadable, hot: boolean): void {
    if (hot) {
      this.hot.add(item);
    } else {
      this.hot.delete(item);
    }
  }

  resolveURL(url: string, allowLocal?: boolean): string {
    if (!url) return url;
    url = url.trim();
    
    if (url.startsWith('blob')) {
      return url;
    }
    
    if (url.startsWith('asset://')) {
      if (this.assetsDir && allowLocal) {
        // Ensure assetsDir has trailing slash for proper URL construction
        const assetsDir = this.assetsDir.endsWith('/') ? this.assetsDir : this.assetsDir + '/';
        return url.replace('asset://', assetsDir);
      } else if (this.assetsUrl) {
        // Ensure assetsUrl has trailing slash for proper URL construction
        const assetsUrl = this.assetsUrl.endsWith('/') ? this.assetsUrl : this.assetsUrl + '/';
        return url.replace('asset://', assetsUrl);
      } else {
        console.error('resolveURL: no assetsUrl or assetsDir defined');
        return url;
      }
    }
    
    if (url.match(/^https?:\/\//i)) {
      return url;
    }
    
    if (url.startsWith('//')) {
      return `https:${url}`;
    }
    
    if (url.startsWith('/')) {
      return url;
    }
    
    return `https://${url}`;
  }

  inject(runtime: any): void {
    // This method is no longer needed as apps property is removed
    // this.apps.inject(runtime);
  }

  // Helper methods for common access patterns
  getPlayer(playerId?: string): any {
    if (playerId) {
      return this.entities?.getPlayer?.(playerId);
    }
    // If no playerId provided, try to get local player
    return this.entities?.getLocalPlayer?.();
  }

  getPlayers(): any[] {
    return this.entities?.getPlayers?.() || [];
  }

  raycast(origin: any, direction: any, maxDistance?: number, layerMask?: number): any {
    return this.physics?.raycast?.(origin, direction, maxDistance, layerMask);
  }

  createLayerMask(...layers: string[]): any {
    // This would need to be implemented in the physics system
    // For now, return a placeholder
    console.warn('createLayerMask not implemented yet');
    return 0;
  }

  queryState(queryName: string, context?: any): any {
    // This would need to be implemented for state queries
    console.warn('queryState not implemented yet');
    return null;
  }

  getAllStateQueries(): string[] {
    // This would need to be implemented for state queries
    console.warn('getAllStateQueries not implemented yet');
    return [];
  }

  async registerPlugin(plugin: any): Promise<void> {
    // Plugin registration would need to be implemented
    console.warn('registerPlugin not implemented yet');
  }

  getTime(): number {
    return this.time;
  }

  destroy(): void {
    for (const system of this.systems) {
      system.destroy();
    }
    
    this.systems = [];
    this.hot.clear();
    this.removeAllListeners();
  }
} 