/**
 * Entity Type Definitions
 *
 * Types for entities, players, and entity management in the client.
 */

import { THREE } from "@hyperscape/shared";

// Client-specific entity data
export interface EntityData {
  id: string;
  type: string;
  mover?: string;
  uploader?: string | null;
  pinned?: boolean;
  state?: Record<string, unknown>;
}

export interface Entity {
  id: string;
  data: EntityData;
  isApp?: boolean;
  isPlayer?: boolean;
  root: InstanceType<typeof THREE.Object3D>;
  modify: (changes: Partial<EntityData>) => void;
  destroy: (broadcast?: boolean) => void;
}

export interface PlayerEntity extends Entity {
  isPlayer: true;
  data: EntityData & {
    name: string;
    roles: string[];
  };
  setName: (name: string) => void;
}

export interface EntityManager {
  items: Map<string, Entity>;
  player: PlayerEntity;
  add: (data: EntityData, broadcast?: boolean) => Entity;
}
