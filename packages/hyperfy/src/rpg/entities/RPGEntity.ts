/**
 * RPGEntity - Server-authoritative entity system replacing RPGApp
 * No sandboxing, no UGC, full server control over all game entities
 */

import * as THREE from '../../core/extras/three';

export interface RPGEntityConfig {
  id: string;
  name: string;
  type: 'player' | 'mob' | 'item' | 'npc' | 'resource' | 'static';
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
  visible?: boolean;
  interactable?: boolean;
  interactionType?: 'attack' | 'pickup' | 'talk' | 'gather' | 'use';
  interactionDistance?: number;
  description?: string;
  model?: string; // GLB/VRM model URL
  properties?: Record<string, any>; // Entity-specific data (stats, inventory, etc.)
}

export interface EntityInteractionData {
  playerId: string;
  entityId: string;
  interactionType: string;
  position: { x: number; y: number; z: number };
  playerPosition: { x: number; y: number; z: number };
}

export interface EntityWorld {
  isServer: boolean;
  isClient: boolean;
  getTime(): number;
  getPlayer(playerId?: string): any;
  getPlayers(): any[];
  emit(event: string, data?: any): void;
  on(event: string, callback: (data?: any) => void): void;
  off(event: string, callback: (data?: any) => void): void;
  stage?: {
    scene?: any;
  };
  loader?: {
    get(type: string, url: string): any;
    load(type: string, url: string): Promise<any>;
  };
  terrain?: any;
}

export abstract class RPGEntity {
  public id: string;
  public name: string;
  public type: string;
  protected config: RPGEntityConfig;
  public mesh: THREE.Object3D | null = null;
  public root: THREE.Object3D; // Main THREE.js group
  public world: EntityWorld;
  public nodes: Map<string, THREE.Object3D> = new Map(); // Child nodes by ID
  public worldNodes: Set<THREE.Object3D> = new Set(); // Nodes added to world
  public listeners: Record<string, Set<(data?: any) => void>> = {}; // Event listeners
  public worldListeners: Map<(data?: any) => void, string> = new Map(); // World event listeners
  protected isInitialized = false;
  protected isDestroyed = false;
  protected lastUpdate = 0;
  
  // Server-side only properties
  public networkDirty = false; // Needs network sync
  public networkVersion = 0; // Version for conflict resolution
  
  // Network interpolation
  protected networkPos?: any;
  protected networkQuat?: any;
  protected networkSca?: any;

  constructor(world: EntityWorld, config: RPGEntityConfig) {
    this.world = world;
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.config = { ...config };
    
    // Create root THREE.js group
    this.root = new THREE.Group();
    this.root.name = this.name;
    (this.root as any).userData = { 
      rpgEntity: this,
      entityId: this.id,
      entityType: this.type
    };
  }

  /**
   * Initialize the entity - called when added to world
   */
  async init(): Promise<void> {
    console.log(`[RPGEntity] Initializing ${this.type}:${this.name} (${this.id})`);
    
    // Load model if specified
    if (this.config.model) {
      await this.loadModel();
    } else {
      // Create visual representation
      await this.createMesh();
    }
    
    // Set initial transform on root
    this.root.position.set(this.config.position.x, this.config.position.y, this.config.position.z);
    
    if (this.config.rotation) {
      this.root.rotation.set(this.config.rotation.x, this.config.rotation.y, this.config.rotation.z);
    }
    
    if (this.config.scale) {
      this.root.scale.set(this.config.scale.x, this.config.scale.y, this.config.scale.z);
    }
    
    this.root.visible = this.config.visible !== false;
    
    // Add mesh to root if it exists
    if (this.mesh) {
      this.root.add(this.mesh);
    }
    
    // Add to world scene
    if (this.world.stage?.scene) {
      this.world.stage.scene.add(this.root);
      console.log(`[RPGEntity] Added ${this.type}:${this.name} to scene`);
    } else {
      console.warn(`[RPGEntity] Unable to add ${this.type}:${this.name} to scene - stage or scene not available`);
    }
    
    // Set up interaction if enabled
    if (this.config.interactable) {
      this.setupInteraction();
    }
    
    // Call lifecycle method
    await this.onInit();
    
    this.isInitialized = true;
    this.markNetworkDirty();
    console.log(`[RPGEntity] ${this.type}:${this.name} initialized successfully`);
  }

  /**
   * Load model from URL
   */
  protected async loadModel(): Promise<void> {
    if (!this.config.model) {
      console.warn(`[RPGEntity] No model specified for ${this.type}:${this.name}`);
      return;
    }
    
    if (!this.world.loader) {
      console.warn(`[RPGEntity] No loader available to load model for ${this.type}:${this.name}`);
      return;
    }
    
    const type = this.config.model.endsWith('.vrm') ? 'avatar' : 'model';
    let glb = this.world.loader.get(type, this.config.model);
    if (!glb) {
      glb = await this.world.loader.load(type, this.config.model);
    }
    
    // Add loaded model to root
    const modelClone = glb.scene.clone();
    this.root.add(modelClone);
    
    // Collect child nodes by name
    this.collectNodes(this.root);
  }
  
  /**
   * Collect child nodes by name for easy access
   */
  protected collectNodes(node: THREE.Object3D): void {
    if (node.name && node.name !== this.name) {
      this.nodes.set(node.name, node);
    }
    
    node.children.forEach((child) => {
      this.collectNodes(child);
    });
  }

  /**
   * Create the 3D mesh representation - must be implemented by subclasses
   */
  protected abstract createMesh(): Promise<void>;

  /**
   * Handle interaction - must be implemented by subclasses if interactable
   */
  protected abstract onInteract(data: EntityInteractionData): Promise<void>;
  
  /**
   * Called after initialization - override in subclasses
   */
  protected async onInit(): Promise<void> {
    // Override in subclasses
  }

  /**
   * Set up interaction system
   */
  private setupInteraction(): void {
    const target = this.mesh || this.root;

    // Add interaction metadata
    (target as any).userData = {
      ...((target as any).userData || {}),
      interactable: true,
      interactionType: this.config.interactionType || 'use',
      interactionDistance: this.config.interactionDistance || 2.0,
      description: this.config.description || this.name
    };

    // Register with interaction system
    this.world.emit('interaction:register', {
      entityId: this.id,
      mesh: target,
      type: this.config.interactionType,
      distance: this.config.interactionDistance,
      description: this.config.description
    });
  }

  /**
   * Update entity - called every frame
   * Server-authoritative: only server can modify state
   */
  update(deltaTime: number): void {
    this.lastUpdate = this.world.getTime();
    
    // Server-side logic only
    if (this.world.isServer) {
      this.serverUpdate(deltaTime);
    }
    
    // Client-side rendering updates
    if (this.world.isClient) {
      this.clientUpdate(deltaTime);
    }
  }

  /**
   * Server-side update logic
   */
  protected serverUpdate(deltaTime: number): void {
    // Override in subclasses for server logic
  }

  /**
   * Client-side rendering updates
   */
  protected clientUpdate(deltaTime: number): void {
    // Override in subclasses for client rendering
  }

  /**
   * Fixed update - called at fixed intervals
   */
  fixedUpdate(deltaTime: number): void {
    if (this.world.isServer) {
      this.serverFixedUpdate(deltaTime);
    }
  }

  /**
   * Server-side fixed update
   */
  protected serverFixedUpdate(deltaTime: number): void {
    // Override in subclasses for physics updates
  }

  /**
   * Mark entity as needing network synchronization
   */
  markNetworkDirty(): void {
    if (this.world.isServer) {
      this.networkDirty = true;
      this.networkVersion++;
    }
  }

  /**
   * Get network synchronization data
   */
  getNetworkData(): any {
    const position = this.getPosition();
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      position,
      rotation: this.config.rotation,
      scale: this.config.scale,
      visible: this.config.visible,
      properties: this.config.properties,
      version: this.networkVersion
    };
  }

  /**
   * Apply network data from server
   */
  applyNetworkData(data: any): void {
    // Only apply if version is newer
    if (data.version <= this.networkVersion) return;
    
    this.networkVersion = data.version;
    
    // Update position
    if (data.position) {
      this.setPosition(data.position.x, data.position.y, data.position.z);
    }
    
    // Update other properties
    if (data.visible !== undefined) {
      this.setVisible(data.visible);
    }
    
    // Update entity properties
    if (data.properties) {
      this.config.properties = { ...data.properties };
    }
  }

  /**
   * Get current position
   */
  getPosition(): { x: number; y: number; z: number } {
    const target = this.root || this.mesh;
    return {
      x: target.position.x,
      y: target.position.y,  
      z: target.position.z
    };
  }

  /**
   * Set position (server-authoritative)
   */
  setPosition(x: number, y: number, z: number): void {
    if (this.world.isClient && !this.world.isServer) {
      // Client cannot directly set position, must request from server
      this.world.emit('entity:move_request', {
        entityId: this.id,
        position: { x, y, z }
      });
      return;
    }
    
    this.config.position = { x, y, z };
    const target = this.root || this.mesh;
    target.position.set(x, y, z);
    
    this.markNetworkDirty();
  }

  /**
   * Get distance to a point
   */
  getDistanceTo(point: { x: number; y: number; z: number }): number {
    const pos = this.getPosition();
    const dx = pos.x - point.x;
    const dy = pos.y - point.y;
    const dz = pos.z - point.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Check if player is in interaction range
   */
  isPlayerInRange(playerPosition: { x: number; y: number; z: number }): boolean {
    const distance = this.getDistanceTo(playerPosition);
    return distance <= (this.config.interactionDistance || 2.0);
  }

  /**
   * Handle interaction from player (server-authoritative)
   */
  async handleInteraction(data: EntityInteractionData): Promise<void> {
    if (!this.world.isServer) {
      // Client must request interaction from server
      this.world.emit('entity:interact_request', data);
      return;
    }
    
    // Check range
    if (!this.isPlayerInRange(data.playerPosition)) {
      console.log(`[RPGEntity] Player ${data.playerId} too far from ${this.name} for interaction`);
      return;
    }
    
    console.log(`[RPGEntity] Player ${data.playerId} interacting with ${this.type}:${this.name}`);
    await this.onInteract(data);
    
    this.markNetworkDirty();
  }

  /**
   * Get property value
   */
  getProperty(key: string, defaultValue?: any): any {
    return this.config.properties?.[key] ?? defaultValue;
  }

  /**
   * Set property value (server-authoritative)
   */
  setProperty(key: string, value: any): void {
    if (!this.world.isServer) {
      this.world.emit('entity:property_request', {
        entityId: this.id,
        key,
        value
      });
      return;
    }
    
    if (!this.config.properties) {
      this.config.properties = {};
    }
    
    this.config.properties[key] = value;
    this.markNetworkDirty();
  }

  /**
   * Event handling
   */
  on(event: string, callback: (data?: any) => void): void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }
    this.listeners[event].add(callback);
  }
  
  off(event: string, callback: (data?: any) => void): void {
    this.listeners[event]?.delete(callback);
  }
  
  emit(event: string, ...args: any[]): void {
    this.listeners[event]?.forEach(callback => callback(...args));
  }

  /**
   * Set visibility
   */
  setVisible(visible: boolean): void {
    this.config.visible = visible;
    const target = this.root || this.mesh;
    target.visible = visible;
    
    this.markNetworkDirty();
  }

  /**
   * Destroy the entity and clean up resources
   */
  destroy(): void {
    console.log(`[RPGEntity] Destroying ${this.type}:${this.name} (${this.id})`);
    
    // Emit destroy event
    this.emit('destroy');
    
    // Unregister from interaction system
    if (this.config.interactable) {
      this.world.emit('interaction:unregister', { entityId: this.id });
    }
    
    // Remove world nodes
    this.worldNodes.forEach(node => {
      if (this.world.stage?.scene) {
        this.world.stage.scene.remove(node);
      }
    });
    this.worldNodes.clear();
    
    // Remove root from scene
    if (this.root && this.world.stage?.scene) {
      this.world.stage.scene.remove(this.root);
    }
    
    // Clean up resources
    if (this.mesh) {
      this.disposeMesh(this.mesh);
      this.mesh = null;
    }
    
    // Dispose of root group
    if (this.root) {
      this.disposeMesh(this.root);
    }
    
    // Clear event listeners
    this.clearEventListeners();
    
    this.isDestroyed = true;
    this.markNetworkDirty();
    console.log(`[RPGEntity] ${this.type}:${this.name} destroyed`);
  }

  /**
   * Clear all event listeners
   */
  private clearEventListeners(): void {
    // Clear local listeners
    this.listeners = {};
    
    // Clear world listeners
    this.worldListeners.forEach((event, callback) => {
      this.world.off(event, callback);
    });
    this.worldListeners.clear();
  }
  
  private disposeMesh(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }

  /**
   * Get entity info for debugging
   */
  getInfo(): any {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      entityType: this.constructor.name,
      position: this.getPosition(),
      visible: this.config.visible,
      interactable: this.config.interactable,
      interactionType: this.config.interactionType,
      properties: this.config.properties,
      initialized: this.isInitialized,
      destroyed: this.isDestroyed,
      networkVersion: this.networkVersion,
      networkDirty: this.networkDirty
    };
  }
}