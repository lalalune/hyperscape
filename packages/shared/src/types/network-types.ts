/**
 * Network-specific type definitions
 */

import type { EntityData, Entity } from './index';
import type { Vector3, Quaternion } from './index';

// Base message type
export interface NetworkMessage<T = unknown> {
  type: string;
  data: T;
  timestamp: number;
  senderId?: string;
  reliable?: boolean;
}

// Specific message data types
export interface EntityAddedData {
  data: EntityData;
}

// Connection and spawn data
export interface ConnectionParams {
  authToken?: string;
  name?: string;
  avatar?: string;
}

export interface SpawnData {
  position: [number, number, number];
  quaternion: [number, number, number, number];
}

// Server statistics
export interface ServerStats {
  currentCPU: number;
  currentMemory: number;
  maxMemory: number;
}

// Database user interface
export interface User {
  id: string;
  name: string;
  avatar: string | null;
  roles: string | string[];
  createdAt: string;
}

// Socket type for server
export interface Socket {
  id: string;
  userId?: string;
  isAlive?: boolean;
  alive: boolean;
  closed: boolean;
  disconnected: boolean;
  send: <T>(name: string, data: T) => void;
  close: () => void;
  player?: Entity;
}

// Chat message interface
export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: number;
  type?: 'chat' | 'system' | 'error';
}

// Network entity interface for multiplayer
export interface NetworkEntity {
  id?: string;
  position?: unknown;
  rotation?: unknown;
  velocity?: unknown;
  serialize?: () => Record<string, unknown>;
}

// Packet system interfaces
export interface PacketInfo {
  id: number;
  name: string;
  method: string;
}

// Socket interfaces
export interface NodeWebSocket extends WebSocket {
  on(event: string, listener: Function): void;
  ping(): void;
  terminate(): void;
}

export interface NetworkWithSocket {
  enqueue(socket: Socket, method: string, data: unknown): void;
  onDisconnect(socket: Socket, code?: number | string): void;
}

export interface SocketOptions {
  id: string;
  ws: NodeWebSocket;
  network: NetworkWithSocket;
  player?: import('./index').Entity;
}

export interface EntityRemovedData {
  entityId: string;
}

export interface EntityModifiedData {
  entityId: string;
  updates: Partial<EntityData>;
}

export interface EntitySnapshotData {
  id: string;
  position: Vector3;
  rotation: Quaternion;
  velocity?: Vector3;
}

export interface WorldSnapshotData {
  entities: EntitySnapshotData[];
  timestamp: number;
}

export interface FullWorldStateData {
  entities: Array<{
    id: string;
    data: EntityData;
  }>;
  timestamp: number;
}

// Type-safe message type map
export interface NetworkMessageMap {
  entityAdded: NetworkMessage<EntityAddedData>;
  entityRemoved: NetworkMessage<EntityRemovedData>;
  entityModified: NetworkMessage<EntityModifiedData>;
  snapshot: NetworkMessage<WorldSnapshotData>;
  spawnModified: NetworkMessage<FullWorldStateData>;
}

// Type helper for message handlers
export type MessageHandler<K extends keyof NetworkMessageMap> = (message: NetworkMessageMap[K]) => void;

// Connection interface
export interface NetworkConnection {
  id: string;
  latency: number;
  connected: boolean;
  
  send<K extends keyof NetworkMessageMap>(message: NetworkMessageMap[K]): void;
  send(message: NetworkMessage): void;
  disconnect(): void;
}