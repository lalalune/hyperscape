/**
 * AOI (Area of Interest) Manager - Spatial partitioning for efficient broadcasts.
 * Reduces O(n²) broadcast to O(n×k) where k is visible entities per player.
 */

interface AOICell {
  entities: Set<string>;
  subscribers: Set<string>;
}

interface PlayerAOIState {
  x: number;
  z: number;
  cellKey: string;
  socketId: string;
  subscribedCells: Set<string>;
}

interface EntityAOIState {
  x: number;
  z: number;
  cellKey: string;
}

export interface AOISubscriptionChanges {
  entered: string[];
  exited: string[];
}

export class AOIManager {
  private cells = new Map<string, AOICell>();
  private players = new Map<string, PlayerAOIState>();
  private entities = new Map<string, EntityAOIState>();
  private socketToPlayer = new Map<string, string>();
  private readonly cellSize: number;
  private readonly viewDistance: number;

  private static readonly EMPTY_SET: ReadonlySet<string> = new Set();

  constructor(cellSize = 50, viewDistance = 2) {
    this.cellSize = cellSize;
    this.viewDistance = viewDistance;
  }

  getCellKey(x: number, z: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellZ = Math.floor(z / this.cellSize);
    return `${cellX},${cellZ}`;
  }

  private getOrCreateCell(key: string): AOICell {
    let cell = this.cells.get(key);
    if (!cell) {
      cell = { entities: new Set(), subscribers: new Set() };
      this.cells.set(key, cell);
    }
    return cell;
  }

  private getSubscribableCells(x: number, z: number): Set<string> {
    const centerCellX = Math.floor(x / this.cellSize);
    const centerCellZ = Math.floor(z / this.cellSize);
    const cells = new Set<string>();
    const vd = this.viewDistance;

    for (let dx = -vd; dx <= vd; dx++) {
      for (let dz = -vd; dz <= vd; dz++) {
        cells.add(`${centerCellX + dx},${centerCellZ + dz}`);
      }
    }

    return cells;
  }

  updateEntityPosition(entityId: string, x: number, z: number): boolean {
    const newCellKey = this.getCellKey(x, z);
    const state = this.entities.get(entityId);

    if (state) {
      if (state.cellKey === newCellKey) {
        state.x = x;
        state.z = z;
        return false;
      }

      const oldCell = this.cells.get(state.cellKey);
      if (oldCell) {
        oldCell.entities.delete(entityId);
      }

      state.x = x;
      state.z = z;
      state.cellKey = newCellKey;
    } else {
      this.entities.set(entityId, { x, z, cellKey: newCellKey });
    }

    this.getOrCreateCell(newCellKey).entities.add(entityId);
    return true;
  }

  removeEntity(entityId: string): void {
    const state = this.entities.get(entityId);
    if (!state) return;

    const cell = this.cells.get(state.cellKey);
    if (cell) {
      cell.entities.delete(entityId);
    }

    this.entities.delete(entityId);
  }

  updatePlayerSubscriptions(
    playerId: string,
    x: number,
    z: number,
    socketId: string,
  ): AOISubscriptionChanges {
    const newSubscribable = this.getSubscribableCells(x, z);
    const state = this.players.get(playerId);

    if (!state) {
      this.players.set(playerId, {
        x,
        z,
        cellKey: this.getCellKey(x, z),
        socketId,
        subscribedCells: newSubscribable,
      });
      this.socketToPlayer.set(socketId, playerId);

      for (const cellKey of newSubscribable) {
        this.getOrCreateCell(cellKey).subscribers.add(socketId);
      }

      return { entered: Array.from(newSubscribable), exited: [] };
    }

    const entered: string[] = [];
    const exited: string[] = [];

    for (const cellKey of newSubscribable) {
      if (!state.subscribedCells.has(cellKey)) {
        entered.push(cellKey);
        state.subscribedCells.add(cellKey);
        this.getOrCreateCell(cellKey).subscribers.add(socketId);
      }
    }

    for (const cellKey of state.subscribedCells) {
      if (!newSubscribable.has(cellKey)) {
        exited.push(cellKey);
        state.subscribedCells.delete(cellKey);
        const cell = this.cells.get(cellKey);
        if (cell) {
          cell.subscribers.delete(socketId);
        }
      }
    }

    state.x = x;
    state.z = z;
    state.cellKey = this.getCellKey(x, z);

    return { entered, exited };
  }

  removePlayer(playerId: string): void {
    const state = this.players.get(playerId);
    if (!state) return;

    for (const cellKey of state.subscribedCells) {
      const cell = this.cells.get(cellKey);
      if (cell) {
        cell.subscribers.delete(state.socketId);
      }
    }

    this.players.delete(playerId);
    this.socketToPlayer.delete(state.socketId);
  }

  getSubscribersForEntity(entityId: string): ReadonlySet<string> {
    const state = this.entities.get(entityId);
    if (!state) return AOIManager.EMPTY_SET;

    const cell = this.cells.get(state.cellKey);
    return cell?.subscribers ?? AOIManager.EMPTY_SET;
  }

  getVisibleEntities(playerId: string): Set<string> {
    const state = this.players.get(playerId);
    if (!state) return new Set();

    const visible = new Set<string>();
    for (const cellKey of state.subscribedCells) {
      const cell = this.cells.get(cellKey);
      if (cell) {
        for (const entityId of cell.entities) {
          visible.add(entityId);
        }
      }
    }
    return visible;
  }

  getEntitiesInCells(cellKeys: string[]): Set<string> {
    const entities = new Set<string>();
    for (const cellKey of cellKeys) {
      const cell = this.cells.get(cellKey);
      if (cell) {
        for (const entityId of cell.entities) {
          entities.add(entityId);
        }
      }
    }
    return entities;
  }

  getDebugInfo(): {
    cellCount: number;
    playerCount: number;
    entityCount: number;
    averageEntitiesPerCell: number;
    averageSubscribersPerCell: number;
  } {
    let totalEntities = 0;
    let totalSubscribers = 0;

    for (const cell of this.cells.values()) {
      totalEntities += cell.entities.size;
      totalSubscribers += cell.subscribers.size;
    }

    const cellCount = this.cells.size;
    return {
      cellCount,
      playerCount: this.players.size,
      entityCount: this.entities.size,
      averageEntitiesPerCell: cellCount > 0 ? totalEntities / cellCount : 0,
      averageSubscribersPerCell:
        cellCount > 0 ? totalSubscribers / cellCount : 0,
    };
  }

  clear(): void {
    this.cells.clear();
    this.players.clear();
    this.entities.clear();
    this.socketToPlayer.clear();
  }

  getPlayerForSocket(socketId: string): string | undefined {
    return this.socketToPlayer.get(socketId);
  }

  canPlayerSeeEntity(playerId: string, entityId: string): boolean {
    const playerState = this.players.get(playerId);
    const entityState = this.entities.get(entityId);
    if (!playerState || !entityState) return false;
    return playerState.subscribedCells.has(entityState.cellKey);
  }
}
