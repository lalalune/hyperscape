/**
 * In-memory bridge stubs for PIE (Play-In-Editor).
 *
 * Implements every server-side bridge interface declared in
 * `packages/shared/src/systems/server/network/interfaces.ts` with a minimal,
 * side-effect-free in-memory variant. Used by `PIEServerSession` to stand
 * up a real `ServerNetwork` inside World Studio without a database,
 * uWebSockets.js transport, or Eliza runtime.
 *
 * Design:
 * - Every stub is permissive: repository reads return empty collections,
 *   writes no-op, "has X" queries return false.
 * - Stubs are plain classes (not `SystemBase`). `PIEServerSession` wraps
 *   them in `SystemBase` adapters before registering on a World.
 * - No external dependencies beyond the interfaces they implement — the
 *   PIE bundle must remain free of drizzle, pg, uWS, jose, @elizaos/core.
 *
 * Part of PLAN_SERVERNETWORK_MIGRATION.md Step 9.
 */

import type {
  IBankRepository,
  ICharacterRepository,
  IInventoryRepository,
  IFriendRepository,
  IDatabaseSystem,
  IAgentManager,
  IAgentRuntimeLookup,
  IStreamingAccessTokens,
  IAuthService,
  IPacketHandlerRegistry,
  IBroadcastManager,
  IEventBridge,
  IConnectionHandler,
  IDuelStakeTransfer,
  IServerNetworkManagerFactory,
  ISocketPubSubAdapter,
  PacketHandler,
  CharacterSummary,
  InventoryRow,
  PlayerDataRow,
  EquipmentSlotRow,
  FriendRow,
  FriendRequestRow,
  IgnoreRow,
  DuelStakeItem,
  ConnectionHandlerFactoryArgs,
  BankItem,
  BankTab,
} from "../../systems/server/network/interfaces";
import type { ServerSocket } from "../../systems/server/network/server-types";
import type { SpatialIndex } from "../../systems/server/network/SpatialIndex";
import type {
  NodeWebSocket,
  ConnectionParams,
} from "../../systems/server/network/server-types";
import { Socket } from "../../platform/shared/Socket";
import type { NetworkWithSocket } from "../../types/network/networking";
import { uuid } from "../../utils/IdGenerator";

// ---------------------------------------------------------------------------
// REPOSITORIES — empty, permissive readers
// ---------------------------------------------------------------------------

export class PIEInMemoryBankRepository implements IBankRepository {
  async getPlayerBank(_playerId: string): Promise<BankItem[]> {
    return [];
  }
  async getPlayerTabs(_playerId: string): Promise<BankTab[]> {
    return [];
  }
  async getAlwaysSetPlaceholder(_playerId: string): Promise<boolean> {
    return false;
  }
}

export class PIEInMemoryCharacterRepository implements ICharacterRepository {
  private readonly characters = new Map<string, CharacterSummary[]>();

  async getCharactersAsync(accountId: string): Promise<CharacterSummary[]> {
    return this.characters.get(accountId) ?? [];
  }

  async createCharacter(
    accountId: string,
    id: string,
    name: string,
    avatar?: string,
    wallet?: string,
    isAgent?: boolean,
  ): Promise<boolean> {
    const list = this.characters.get(accountId) ?? [];
    list.push({
      id,
      name,
      avatar: avatar ?? null,
      wallet: wallet ?? null,
      isAgent: isAgent ?? false,
    });
    this.characters.set(accountId, list);
    return true;
  }

  async updateCharacterName(
    characterId: string,
    name: string,
  ): Promise<boolean> {
    for (const list of this.characters.values()) {
      const match = list.find((c) => c.id === characterId);
      if (match) {
        match.name = name;
        return true;
      }
    }
    return false;
  }
}

export class PIEInMemoryInventoryRepository implements IInventoryRepository {
  async getPlayerInventoryAsync(_playerId: string): Promise<InventoryRow[]> {
    return [];
  }
}

export class PIEInMemoryFriendRepository implements IFriendRepository {
  async getFriendsAsync(_playerId: string): Promise<FriendRow[]> {
    return [];
  }
  async addFriendAsync(_playerId: string, _friendId: string): Promise<void> {}
  async removeFriendAsync(
    _playerId: string,
    _friendId: string,
  ): Promise<void> {}
  async areFriendsAsync(_a: string, _b: string): Promise<boolean> {
    return false;
  }
  async getFriendCountAsync(_playerId: string): Promise<number> {
    return 0;
  }
  async getFriendIdsAsync(_playerId: string): Promise<string[]> {
    return [];
  }
  async getPendingRequestsAsync(
    _playerId: string,
  ): Promise<FriendRequestRow[]> {
    return [];
  }
  async createRequestAsync(_from: string, _to: string): Promise<string> {
    return "pie-noop-request";
  }
  async acceptRequestAsync(
    _requestId: string,
    _playerId: string,
  ): Promise<boolean> {
    return false;
  }
  async declineRequestAsync(
    _requestId: string,
    _playerId: string,
  ): Promise<boolean> {
    return false;
  }
  async getRequestAsync(_requestId: string): Promise<FriendRequestRow | null> {
    return null;
  }
  async hasRequestAsync(_from: string, _to: string): Promise<boolean> {
    return false;
  }
  async getIgnoreListAsync(_playerId: string): Promise<IgnoreRow[]> {
    return [];
  }
  async addToIgnoreAsync(_playerId: string, _targetId: string): Promise<void> {}
  async removeFromIgnoreAsync(
    _playerId: string,
    _targetId: string,
  ): Promise<void> {}
  async getIgnoreCountAsync(_playerId: string): Promise<number> {
    return 0;
  }
  async isIgnoredByAsync(_sender: string, _receiver: string): Promise<boolean> {
    return false;
  }
  async findPlayerByNameAsync(
    _name: string,
  ): Promise<{ id: string; name: string } | null> {
    return null;
  }
}

// ---------------------------------------------------------------------------
// DATABASE SYSTEM
// ---------------------------------------------------------------------------

export class PIEInMemoryDatabaseSystem implements IDatabaseSystem {
  private readonly bankRepo = new PIEInMemoryBankRepository();
  private readonly charRepo = new PIEInMemoryCharacterRepository();
  private readonly invRepo = new PIEInMemoryInventoryRepository();
  private readonly friendRepo = new PIEInMemoryFriendRepository();

  getCharacterRepository(): ICharacterRepository {
    return this.charRepo;
  }
  getBankRepository(): IBankRepository {
    return this.bankRepo;
  }
  getInventoryRepository(): IInventoryRepository {
    return this.invRepo;
  }
  getFriendRepository(): IFriendRepository {
    return this.friendRepo;
  }

  async getPlayerAsync(_playerId: string): Promise<PlayerDataRow | null> {
    return null;
  }
  async getPlayerInventoryAsync(_playerId: string): Promise<InventoryRow[]> {
    return [];
  }
  async getPlayerEquipmentAsync(
    _playerId: string,
  ): Promise<EquipmentSlotRow[]> {
    return [];
  }

  async getCharactersAsync(accountId: string): Promise<CharacterSummary[]> {
    return this.charRepo.getCharactersAsync(accountId);
  }
  async createCharacter(
    accountId: string,
    id: string,
    name: string,
    avatar?: string,
    wallet?: string,
    isAgent?: boolean,
  ): Promise<boolean> {
    return this.charRepo.createCharacter(
      accountId,
      id,
      name,
      avatar,
      wallet,
      isAgent,
    );
  }

  getDb(): unknown | null {
    return createPIEStubSystemDatabase();
  }

  // Session methods — PIE has no persistence, so these are no-ops.
  // Without them, PersistenceSystem.onPlayerEnter (subscribed to
  // PLAYER_JOINED) crashes with "createPlayerSessionAsync is not a
  // function" as soon as PIE fires the event from `_spawnRealPlayer`.
  // Returning a fake session id keeps the subscriber's await chain
  // valid; everything downstream of persistence treats PIE as
  // ephemeral so the id is never read.
  async createPlayerSessionAsync(
    _sessionData: unknown,
    sessionId?: string,
  ): Promise<string> {
    return sessionId ?? `pie-session-${uuid()}`;
  }
  async getActivePlayerSessionsAsync(): Promise<unknown[]> {
    return [];
  }
  async endPlayerSessionAsync(
    _sessionId: string,
    _reason?: string,
  ): Promise<void> {
    // No-op.
  }
}

/**
 * Minimal `SystemDatabase`-shaped stub for PIE.
 *
 * Satisfies `isDatabaseInstance` (it's a function) and the Knex-like query
 * builder protocol with no-op behavior:
 *   - every query chain resolves to `[]`
 *   - `first()` resolves to `undefined`
 *   - `insert/update/delete` resolve to `0`
 *
 * ServerNetwork's `InitializationManager.hydrateEntities()` and
 * `loadSettings()` both wrap their queries in try/catch and treat empty
 * results as "nothing to load", so PIE boots cleanly with no entities and
 * default settings.
 */
export function createPIEStubSystemDatabase(): (
  table: string,
) => Record<string, unknown> {
  const makeBuilder = () => {
    const builder: Record<string, unknown> = {};
    const chainable = [
      "where",
      "whereNull",
      "whereIn",
      "whereRaw",
      "orWhere",
      "select",
    ];
    for (const m of chainable) {
      builder[m] = () => builder;
    }
    builder.first = async () => undefined;
    builder.update = async () => 0;
    builder.delete = async () => 0;
    builder.insert = async () => undefined;
    builder.then = <T>(onfulfilled: (v: unknown[]) => T) =>
      Promise.resolve([]).then(onfulfilled);
    builder.catch = <T>(onrejected: (e: unknown) => T) =>
      Promise.resolve([]).catch(onrejected);
    return builder;
  };
  const fn = (_table: string) => makeBuilder();
  return fn;
}

// ---------------------------------------------------------------------------
// AGENT / STREAMING / AUTH — simple singletons
// ---------------------------------------------------------------------------

export class PIENoopAgentManager implements IAgentManager {
  hasAgent(_characterId: string): boolean {
    return false;
  }
}

export class PIENoopAgentRuntimeLookup implements IAgentRuntimeLookup {
  getAgentRuntimeByCharacterId(_characterId: string): unknown | null {
    return null;
  }
}

export class PIENoopStreamingAccessTokens implements IStreamingAccessTokens {
  resolveStreamingViewerAccessToken(): string {
    return "";
  }
}

/**
 * Opaque token auth for PIE — tokens are JSON blobs base64-encoded with no
 * signature. Safe because PIE sockets never leave the editor process. Uses
 * `btoa`/`atob` so it works in both browser (asset-forge) and Node runtimes
 * without a `Buffer` polyfill.
 */
export class PIEOpaqueAuthService implements IAuthService {
  async createJWT(data: Record<string, unknown>): Promise<string> {
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    return `pie.${payload}.local`;
  }

  async verifyJWT(token: string): Promise<Record<string, unknown> | null> {
    if (!token.startsWith("pie.") || !token.endsWith(".local")) return null;
    const payload = token.slice(4, -".local".length);
    try {
      return JSON.parse(decodeURIComponent(escape(atob(payload)))) as Record<
        string,
        unknown
      >;
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// PACKET HANDLER REGISTRY — trivial map-backed
// ---------------------------------------------------------------------------

export class PIEPacketHandlerRegistry implements IPacketHandlerRegistry {
  private readonly handlers = new Map<string, PacketHandler>();

  getHandler(packetName: string): PacketHandler | undefined {
    return this.handlers.get(packetName);
  }
  register(packetName: string, handler: PacketHandler): void {
    this.handlers.set(packetName, handler);
  }
  unregister(packetName: string): void {
    this.handlers.delete(packetName);
  }
  listPackets(): string[] {
    return [...this.handlers.keys()];
  }
}

// ---------------------------------------------------------------------------
// BROADCAST / EVENT BRIDGE / CONNECTION — no-op shells
// ---------------------------------------------------------------------------

class PIENoopPubSubAdapter implements ISocketPubSubAdapter {
  subscribe(_topic: string): void {}
  unsubscribe(_topic: string): void {}
}

/**
 * Broadcast stub that walks the socket map directly. Skips spatial topics
 * and pub/sub fast paths — PIE has a single client so fan-out is trivial.
 */
export class PIEInMemoryBroadcastManager implements IBroadcastManager {
  private spatialIndex: SpatialIndex | null = null;
  private readonly adapter = new PIENoopPubSubAdapter();

  constructor(private readonly sockets: Map<string, ServerSocket>) {}

  sendToAll<T>(
    name: string,
    data: T,
    ignoreSocketId?: string,
    _priority?: unknown,
  ): number {
    let count = 0;
    for (const [id, socket] of this.sockets) {
      if (id === ignoreSocketId) continue;
      socket.send(name, data);
      count++;
    }
    return count;
  }

  setSpatialIndex(index: SpatialIndex): void {
    this.spatialIndex = index;
  }

  setUwsApp(_app: unknown): void {
    // PIE has no uWS — ignore.
  }

  sendToPlayer<T>(playerId: string, name: string, data: T): boolean {
    for (const socket of this.sockets.values()) {
      if (socket.player?.id === playerId) {
        socket.send(name, data);
        return true;
      }
    }
    return false;
  }

  getPlayerSocket(playerId: string): ServerSocket | undefined {
    for (const socket of this.sockets.values()) {
      if (socket.player?.id === playerId) return socket;
    }
    return undefined;
  }

  onSocketDisconnected(_socketId: string): void {}

  sendToSocket<T>(socketId: string, name: string, data: T): boolean {
    const socket = this.sockets.get(socketId);
    if (!socket) return false;
    socket.send(name, data);
    return true;
  }

  sendToSpectators<T>(_name: string, _data: T): number {
    return 0;
  }

  sendToNearby<T>(
    name: string,
    data: T,
    _worldX: number,
    _worldZ: number,
    ignoreSocketId?: string,
  ): number {
    // Single-client PIE: degrade to sendToAll.
    return this.sendToAll(name, data, ignoreSocketId);
  }

  drainSendTimeMs(): number {
    return 0;
  }

  drainPubsubStats(): number {
    return 0;
  }

  getAdapter(_socketId: string): ISocketPubSubAdapter | undefined {
    return this.adapter;
  }
}

export class PIENoopEventBridge implements IEventBridge {
  setupEventListeners(): void {}
  destroy(): void {}
}

/**
 * PIE loopback connection handler — minimal replacement for the real
 * `ConnectionHandler` in `packages/server/.../connection-handler.ts`.
 *
 * The production handler runs a full Privy/JWT/character-selection handshake
 * and sends the initial `snapshot` + `resourceSnapshot` packets. PIE has no
 * auth infrastructure (no Privy app, no user DB, no character table) so this
 * handler does the bare minimum needed for a functional loopback:
 *
 *   1. Wrap the incoming `NodeWebSocket` (an `InMemorySocket`) in a real
 *      `Socket` instance so `ServerNetwork.enqueue`/`onDisconnect` work for
 *      packets the client sends later.
 *   2. Stamp the socket with a synthetic `accountId` (from `params.playerId`
 *      if provided, otherwise a fresh uuid) so player-scoped code paths can
 *      find it.
 *   3. Register the socket in the shared `sockets` map so broadcast/targeted
 *      sends reach it.
 *
 * Explicitly does NOT:
 *   - Authenticate (no Privy in PIE)
 *   - Send the initial snapshot (the editor constructs its own world state)
 *   - Create a player entity (editor owns entity spawning)
 *   - Emit `player:joined` (editor drives entity lifecycle)
 */
export class PIELoopbackConnectionHandler implements IConnectionHandler {
  constructor(
    private readonly sockets: Map<string, ServerSocket>,
    private readonly network: NetworkWithSocket,
  ) {}

  setSpatialIndex(_index: SpatialIndex): void {}

  async handleConnection(
    ws: NodeWebSocket,
    params: ConnectionParams,
  ): Promise<void> {
    if (!ws || typeof ws.close !== "function") return;

    // PIE has no user DB — the editor supplies a synthetic identity via
    // `characterId` so tests can round-trip a stable id; fall back to uuid.
    const accountId = params.characterId ?? uuid();
    const socketId = uuid();

    const socket = new Socket({
      id: socketId,
      ws,
      network: this.network,
      player: undefined,
    }) as ServerSocket;
    socket.accountId = accountId;
    socket.createdAt = Date.now();

    this.sockets.set(socket.id, socket);
  }
}

// ---------------------------------------------------------------------------
// DUEL STAKE + FACTORY
// ---------------------------------------------------------------------------

export class PIENoopDuelStakeTransfer implements IDuelStakeTransfer {
  async executeDuelStakeTransferWithRetry(
    _winnerId: string,
    _loserId: string,
    _stakes: DuelStakeItem[],
    _duelId?: string,
  ): Promise<void> {
    // PIE has no persistence; duel stakes are not transferred.
  }
}

export class PIEInMemoryServerNetworkManagerFactory implements IServerNetworkManagerFactory {
  createBroadcastManager(
    sockets: Map<string, ServerSocket>,
  ): IBroadcastManager {
    return new PIEInMemoryBroadcastManager(sockets);
  }

  createEventBridge(
    _world: unknown,
    _broadcastManager: IBroadcastManager,
  ): IEventBridge {
    return new PIENoopEventBridge();
  }

  createConnectionHandler(
    args: ConnectionHandlerFactoryArgs,
  ): IConnectionHandler {
    // `world.network` is the ServerNetwork instance; it implements
    // `enqueue` + `onDisconnect` (the `NetworkWithSocket` surface). The
    // cast is safe at this call site — ServerNetwork constructs the factory
    // via `getManagerFactory()` AFTER its own registration, so `world.network`
    // is guaranteed to exist.
    const network = (args.world as unknown as { network: NetworkWithSocket })
      .network;
    return new PIELoopbackConnectionHandler(args.sockets, network);
  }
}
