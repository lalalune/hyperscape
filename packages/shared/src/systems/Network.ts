import { SystemBase } from './SystemBase';
import { EventType } from '../types/events';
import type { World } from '../types';
import type {
  NetworkMessage,
  NetworkConnection,
  EntityAddedData,
  EntityRemovedData,
  WorldSnapshotData,
  FullWorldStateData,
  NetworkEntity
} from '../types/network-types';

export class Network extends SystemBase {
  private connections: Map<string, NetworkConnection> = new Map();
  private messageQueue: NetworkMessage[] = [];
  private outgoingQueue: NetworkMessage[] = [];
  private messageHandlers: Map<string, Set<(message: NetworkMessage<unknown>) => void>> = new Map();
  private isServer: boolean = false;
  private localId: string = 'local';
  private lastSyncTime: number = 0;
  private syncInterval: number = 50; // 20Hz sync rate
  private pendingAcks: Map<string, { type: string; data: unknown; sentTime: number }> = new Map();
  
  constructor(world: World) {
    super(world, { name: 'network', dependencies: { required: [], optional: [] }, autoCleanup: true });
  }
  
  override async init(): Promise<void> {
    // Determine if we're running as server or client
    this.isServer = !!this.world.server;
    
    // Generate local ID
    this.localId = this.generateId();
    
    // Register core message handlers
    this.registerCoreHandlers();
  }
  
  // Send a message
  send<T = unknown>(type: string, data: T, reliable: boolean = false): void {
    const message: NetworkMessage<T> = {
      type,
      data,
      timestamp: Date.now(),
      senderId: this.localId,
      reliable
    };
    
    this.outgoingQueue.push(message);
  }
  
  // Broadcast to all connections
  broadcast<T = unknown>(type: string, data: T, exclude?: string[]): void {
    const message: NetworkMessage<T> = {
      type,
      data,
      timestamp: Date.now(),
      senderId: this.localId,
      reliable: true
    };
    
    for (const [connId, connection] of this.connections) {
      if (!exclude || !exclude.includes(connId)) {
        connection.send(message);
      }
    }
  }
  
  // Register message handler
  onMessage(type: string, handler: (message: NetworkMessage<unknown>) => void): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);
  }
  
  // Unregister message handler
  offMessage(type: string, handler: (message: NetworkMessage<unknown>) => void): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }
  
  // Add a connection
  addConnection(connection: NetworkConnection): void {
    this.connections.set(connection.id, connection);
    
    // Send initial state to new connection
    if (this.isServer) {
      this.sendInitialState(connection);
    }
    
      this.emitTypedEvent('network:connection', {
      connectionId: connection.id,
      timestamp: Date.now()
    });
  }
  
  // Remove a connection
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    connection.disconnect();
    this.connections.delete(connectionId);
    
     this.emitTypedEvent('network:disconnection', {
      connectionId,
      timestamp: Date.now()
    });
  }
  
  // Process incoming message
  processMessage(message: NetworkMessage): void {
    // Add to queue for processing
    this.messageQueue.push(message);
  }
  
  // Update
  override update(_delta: number): void {
    // Process incoming messages
    this.processIncomingMessages();
    
    // Process outgoing messages
    this.processOutgoingMessages();
    
    // Periodic sync
    const now = Date.now();
    if (now - this.lastSyncTime >= this.syncInterval) {
      this.performSync();
      this.lastSyncTime = now;
    }
  }
  
  // Process incoming messages
  private processIncomingMessages(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      
      // Call handlers
      const handlers = this.messageHandlers.get(message.type);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(message);
          } catch (error) {
            this.logger.error(`Error handling network message ${message.type}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
      
      // Emit as event
      this.emitTypedEvent(EventType.NETWORK_MESSAGE_RECEIVED, { type: message.type, data: message.data as Record<string, string | number | boolean> });
    }
  }
  
  // Process outgoing messages
  private processOutgoingMessages(): void {
    while (this.outgoingQueue.length > 0) {
      const message = this.outgoingQueue.shift()!;
      
      // Send to all connections
      for (const connection of this.connections.values()) {
        connection.send(message);
      }
    }
  }
  
  // Perform periodic sync
  private performSync(): void {
    if (!this.isServer) return;
    
    // Sync entity states
    if (!this.world.entities.items) return;
    const entities = Array.from(this.world.entities.items.values()) as NetworkEntity[];
    const entityStates = entities.map((entity: NetworkEntity) => ({
      id: entity.id,
      position: entity.position,
      rotation: entity.rotation,
      velocity: entity.velocity
    }));
    
    this.broadcast('snapshot', {
      entities: entityStates,
      timestamp: Date.now()
    });
  }
  
  // Send initial state to new connection
  private sendInitialState(connection: NetworkConnection): void {
    // Send world state
    const worldState = {
      entities: this.world.entities.items ? Array.from(this.world.entities.items.entries()).map(([id, entity]: [string, NetworkEntity]) => ({
        id,
        data: entity.serialize?.() || {}
      })) : [],
      timestamp: Date.now()
    };
    
    connection.send({
      type: 'snapshot',
      data: worldState,
      timestamp: Date.now(),
      senderId: this.localId,
      reliable: true
    });
  }
  
  // Register core message handlers
  private registerCoreHandlers(): void {
    // Entity creation
    this.onMessage('entityAdded', (message) => {
      if (message.senderId === this.localId) return;
      
      const { data } = message.data as EntityAddedData;
      this.world.entities.create(data.type, data);
    });
    
    // Entity destruction
    this.onMessage('entityRemoved', (message) => {
      if (message.senderId === this.localId) return;
      
      const { entityId } = message.data as EntityRemovedData;
      this.world.entities.destroyEntity(entityId);
    });
    
    // Entity updates (adapter for legacy servers):
    // Modern servers send { id, changes }. If older shape { entityId, updates } arrives, adapt it.
    this.onMessage('entityModified', (message) => {
      if (message.senderId === this.localId) return;
      const payload = message.data as unknown as { id?: string; changes?: Record<string, unknown> } & { entityId?: string; updates?: Record<string, unknown> };
      const id = payload.id || payload.entityId;
      const changes = payload.changes || payload.updates || {};
      if (!id) return;
      const entity = this.world.entities.get(id);
      if (entity) {
        (entity as { modify: (updates: unknown) => void }).modify(changes);
      }
    });
    
    // Handle sync messages
    if (!this.isServer) {
      this.onMessage('snapshot', (message) => {
        const { entities } = message.data as WorldSnapshotData;
        
        for (const state of entities) {
          const entity = this.world.entities.get(state.id);
          if (entity && entity.id !== this.world.entities.player?.id) {
            // Interpolate position
            entity.position = state.position;
            entity.rotation = state.rotation;
            if (state.velocity) {
              entity.velocity = state.velocity;
            }
          }
        }
      });
      
      this.onMessage('spawnModified', (message) => {
        const { entities } = message.data as FullWorldStateData;
        
        // Clear existing entities except local player
        if (this.world.entities.items) {
          for (const [id, entity] of Array.from(this.world.entities.items.entries()) as [string, unknown][]) {
            if (entity !== this.world.entities.player) {
              this.world.entities.destroyEntity(id);
            }
          }
        }
        
        // Create entities from state
        for (const { id, data } of entities) {
          if (!this.world.entities.has(id)) {
            this.world.entities.create(data.type, data);
          }
        }
      });
    }
  }
  
  // Generate unique ID
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Get connection by ID
  getConnection(connectionId: string): NetworkConnection | undefined {
    return this.connections.get(connectionId);
  }
  
  // Get all connections
  getConnections(): NetworkConnection[] {
    return Array.from(this.connections.values());
  }
  
  // Check if connected
  isConnected(): boolean {
    return this.connections.size > 0;
  }
  
  // Get local ID
  getLocalId(): string {
    return this.localId;
  }
  
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(_dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
} 