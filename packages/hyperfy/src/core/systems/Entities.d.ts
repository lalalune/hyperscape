import { System } from './System.js';
import type { World, Entities as IEntities, Entity, Player } from '../../types/index.js';
interface EntityData {
    id: string;
    type: string;
    name?: string;
    owner?: string;
    position?: any;
    rotation?: any;
    scale?: any;
    [key: string]: any;
}
/**
 * Entities System
 *
 * - Runs on both the server and client.
 * - Supports inserting entities into the world
 * - Executes entity scripts
 *
 */
export declare class Entities extends System implements IEntities {
  items: Map<string, Entity>;
  players: Map<string, Player>;
  player?: Player;
  apps: Map<string, Entity>;
  private hot;
  private removed;
  constructor(world: World);
  get(id: string): Entity | null;
  getPlayer(entityId: string): Player | null;
  has(entityId: string): boolean;
  set(entityId: string, entity: Entity): void;
  create(name: string, options?: any): Entity;
  add(data: EntityData, local?: boolean): Entity;
  remove(id: string): void;
  destroyEntity(entityId: string): void;
  setHot(entity: Entity, hot: boolean): void;
  fixedUpdate(_delta: number): void;
  update(_delta: number): void;
  lateUpdate(_delta: number): void;
  serialize(): EntityData[];
  deserialize(datas: EntityData[]): Promise<void>;
  destroy(): void;
  getLocalPlayer(): Player | null;
  getAll(): Entity[];
  getAllPlayers(): Player[];
  getRemovedIds(): string[];
}
export {};
