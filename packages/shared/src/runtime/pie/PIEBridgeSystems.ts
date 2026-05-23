/**
 * PIE world-system adapters.
 *
 * Wraps each `InMemoryStubs.ts` stub in a `SystemBase` subclass so it can
 * be registered on a `World` via `world.register(name, SystemCtor)`. The
 * registration names and interface contracts mirror the server-side
 * bridge systems in `packages/server/src/systems/*BridgeSystem/`, so
 * ServerNetwork (post-Step-6, now living in shared) finds the same
 * `world.getSystem(...)` keys whether it runs in real server or PIE.
 *
 * Each wrapper instantiates its stub once in the constructor and forwards
 * every interface method. `init()` and `start()` are no-ops — PIE bridges
 * have no lifecycle work.
 *
 * Part of PLAN_SERVERNETWORK_MIGRATION.md Step 9.
 */

import { SystemBase } from "../../systems/shared/infrastructure/SystemBase";
import type { World } from "../../core/World";
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
  PacketHandler,
  CharacterSummary,
  InventoryRow,
  PlayerDataRow,
  EquipmentSlotRow,
  DuelStakeItem,
  ConnectionHandlerFactoryArgs,
} from "../../systems/server/network/interfaces";
import type { ServerSocket } from "../../systems/server/network/server-types";
import {
  PIEInMemoryDatabaseSystem,
  PIEPacketHandlerRegistry,
  PIEInMemoryServerNetworkManagerFactory,
  PIEOpaqueAuthService,
  PIENoopAgentManager,
  PIENoopAgentRuntimeLookup,
  PIENoopStreamingAccessTokens,
  PIENoopDuelStakeTransfer,
} from "./InMemoryStubs";

/**
 * Registration name for each PIE bridge. Keep in lockstep with server-side
 * `world.register(...)` call sites so shared code uses the same key to
 * reach either implementation.
 */
export const PIE_BRIDGE_NAMES = {
  database: "database",
  packetHandlers: "packet-handlers",
  serverNetworkFactory: "server-network-factory",
  auth: "auth",
  agentManager: "agent-manager",
  agentRuntimeLookup: "agent-runtime-lookup",
  streamingTokens: "streaming-access-tokens",
  duelStakeTransfer: "duel-stake-transfer",
} as const;

// ---------------------------------------------------------------------------
// DATABASE
// ---------------------------------------------------------------------------

export class PIEDatabaseBridge extends SystemBase implements IDatabaseSystem {
  private readonly impl = new PIEInMemoryDatabaseSystem();

  constructor(world: World) {
    super(world, {
      name: PIE_BRIDGE_NAMES.database,
      dependencies: { required: [], optional: [] },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {}
  start(): void {}

  getCharacterRepository(): ICharacterRepository {
    return this.impl.getCharacterRepository();
  }
  getBankRepository(): IBankRepository {
    return this.impl.getBankRepository();
  }
  getInventoryRepository(): IInventoryRepository {
    return this.impl.getInventoryRepository();
  }
  getFriendRepository(): IFriendRepository {
    return this.impl.getFriendRepository();
  }
  getPlayerAsync(playerId: string): Promise<PlayerDataRow | null> {
    return this.impl.getPlayerAsync(playerId);
  }
  getPlayerInventoryAsync(playerId: string): Promise<InventoryRow[]> {
    return this.impl.getPlayerInventoryAsync(playerId);
  }
  getPlayerEquipmentAsync(playerId: string): Promise<EquipmentSlotRow[]> {
    return this.impl.getPlayerEquipmentAsync(playerId);
  }
  getCharactersAsync(accountId: string): Promise<CharacterSummary[]> {
    return this.impl.getCharactersAsync(accountId);
  }
  createCharacter(
    accountId: string,
    id: string,
    name: string,
    avatar?: string,
    wallet?: string,
    isAgent?: boolean,
  ): Promise<boolean> {
    return this.impl.createCharacter(
      accountId,
      id,
      name,
      avatar,
      wallet,
      isAgent,
    );
  }
  getDb(): unknown | null {
    return this.impl.getDb();
  }

  // PersistenceSystem subscribes to PLAYER_JOINED / PLAYER_LEFT and
  // calls these on the database bridge. Without delegating them,
  // `_spawnRealPlayer`'s PLAYER_JOINED emit unhandled-rejects with
  // "createPlayerSessionAsync is not a function". The impl returns
  // no-ops since PIE has no persistence.
  createPlayerSessionAsync(
    sessionData: Parameters<
      PIEInMemoryDatabaseSystem["createPlayerSessionAsync"]
    >[0],
    sessionId?: string,
  ): Promise<string> {
    return this.impl.createPlayerSessionAsync(sessionData, sessionId);
  }
  getActivePlayerSessionsAsync(): Promise<unknown[]> {
    return this.impl.getActivePlayerSessionsAsync();
  }
  endPlayerSessionAsync(sessionId: string, reason?: string): Promise<void> {
    return this.impl.endPlayerSessionAsync(sessionId, reason);
  }
}

// ---------------------------------------------------------------------------
// PACKET HANDLERS
// ---------------------------------------------------------------------------

export class PIEPacketHandlerBridge
  extends SystemBase
  implements IPacketHandlerRegistry
{
  private readonly registry = new PIEPacketHandlerRegistry();

  constructor(world: World) {
    super(world, {
      name: PIE_BRIDGE_NAMES.packetHandlers,
      dependencies: { required: [], optional: [] },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {}
  start(): void {}

  getHandler(packetName: string): PacketHandler | undefined {
    return this.registry.getHandler(packetName);
  }
  register(packetName: string, handler: PacketHandler): void {
    this.registry.register(packetName, handler);
  }
  unregister(packetName: string): void {
    this.registry.unregister(packetName);
  }
  listPackets(): string[] {
    return this.registry.listPackets();
  }
}

// ---------------------------------------------------------------------------
// SERVER NETWORK FACTORY
// ---------------------------------------------------------------------------

export class PIEServerNetworkFactoryBridge
  extends SystemBase
  implements IServerNetworkManagerFactory
{
  private readonly factory = new PIEInMemoryServerNetworkManagerFactory();

  constructor(world: World) {
    super(world, {
      name: PIE_BRIDGE_NAMES.serverNetworkFactory,
      dependencies: { required: [], optional: [] },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {}
  start(): void {}

  createBroadcastManager(
    sockets: Map<string, ServerSocket>,
  ): IBroadcastManager {
    return this.factory.createBroadcastManager(sockets);
  }
  createEventBridge(
    world: World,
    broadcastManager: IBroadcastManager,
  ): IEventBridge {
    return this.factory.createEventBridge(world, broadcastManager);
  }
  createConnectionHandler(
    args: ConnectionHandlerFactoryArgs,
  ): IConnectionHandler {
    return this.factory.createConnectionHandler(args);
  }
}

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------

export class PIEAuthBridge extends SystemBase implements IAuthService {
  private readonly impl = new PIEOpaqueAuthService();

  constructor(world: World) {
    super(world, {
      name: PIE_BRIDGE_NAMES.auth,
      dependencies: { required: [], optional: [] },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {}
  start(): void {}

  createJWT(data: Record<string, unknown>): Promise<string> {
    return this.impl.createJWT(data);
  }
  verifyJWT(token: string): Promise<Record<string, unknown> | null> {
    return this.impl.verifyJWT(token);
  }
}

// ---------------------------------------------------------------------------
// AGENT MANAGER / RUNTIME LOOKUP
// ---------------------------------------------------------------------------

export class PIEAgentManagerBridge extends SystemBase implements IAgentManager {
  private readonly impl = new PIENoopAgentManager();

  constructor(world: World) {
    super(world, {
      name: PIE_BRIDGE_NAMES.agentManager,
      dependencies: { required: [], optional: [] },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {}
  start(): void {}

  hasAgent(characterId: string): boolean {
    return this.impl.hasAgent(characterId);
  }
}

export class PIEAgentRuntimeLookupBridge
  extends SystemBase
  implements IAgentRuntimeLookup
{
  private readonly impl = new PIENoopAgentRuntimeLookup();

  constructor(world: World) {
    super(world, {
      name: PIE_BRIDGE_NAMES.agentRuntimeLookup,
      dependencies: { required: [], optional: [] },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {}
  start(): void {}

  getAgentRuntimeByCharacterId(characterId: string): unknown | null {
    return this.impl.getAgentRuntimeByCharacterId(characterId);
  }
}

// ---------------------------------------------------------------------------
// STREAMING ACCESS TOKENS
// ---------------------------------------------------------------------------

export class PIEStreamingAccessTokensBridge
  extends SystemBase
  implements IStreamingAccessTokens
{
  private readonly impl = new PIENoopStreamingAccessTokens();

  constructor(world: World) {
    super(world, {
      name: PIE_BRIDGE_NAMES.streamingTokens,
      dependencies: { required: [], optional: [] },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {}
  start(): void {}

  resolveStreamingViewerAccessToken(): string {
    return this.impl.resolveStreamingViewerAccessToken();
  }
}

// ---------------------------------------------------------------------------
// DUEL STAKE TRANSFER
// ---------------------------------------------------------------------------

export class PIEDuelStakeTransferBridge
  extends SystemBase
  implements IDuelStakeTransfer
{
  private readonly impl = new PIENoopDuelStakeTransfer();

  constructor(world: World) {
    super(world, {
      name: PIE_BRIDGE_NAMES.duelStakeTransfer,
      dependencies: { required: [], optional: [] },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {}
  start(): void {}

  executeDuelStakeTransferWithRetry(
    winnerId: string,
    loserId: string,
    stakes: DuelStakeItem[],
    duelId?: string,
  ): Promise<void> {
    return this.impl.executeDuelStakeTransferWithRetry(
      winnerId,
      loserId,
      stakes,
      duelId,
    );
  }
}

// ---------------------------------------------------------------------------
// BULK REGISTRATION
// ---------------------------------------------------------------------------

/**
 * Register every PIE bridge on a world. Idempotent: if a bridge is already
 * registered under the same name (e.g., real server bridges during tests),
 * the existing registration wins.
 *
 * Call this after `createServerWorld()` and before `world.register("network", ServerNetwork)`.
 */
export function registerPIEBridges(world: World): void {
  const register = (
    name: string,
    Ctor: new (world: World) => SystemBase,
  ): void => {
    // Skip if already present — prefer whatever was registered first so test
    // harnesses that want a real bridge aren't clobbered.
    if (world.getSystem(name)) return;
    world.register(name, Ctor);
  };

  register(PIE_BRIDGE_NAMES.database, PIEDatabaseBridge);
  register(PIE_BRIDGE_NAMES.packetHandlers, PIEPacketHandlerBridge);
  register(
    PIE_BRIDGE_NAMES.serverNetworkFactory,
    PIEServerNetworkFactoryBridge,
  );
  register(PIE_BRIDGE_NAMES.auth, PIEAuthBridge);
  register(PIE_BRIDGE_NAMES.agentManager, PIEAgentManagerBridge);
  register(PIE_BRIDGE_NAMES.agentRuntimeLookup, PIEAgentRuntimeLookupBridge);
  register(PIE_BRIDGE_NAMES.streamingTokens, PIEStreamingAccessTokensBridge);
  register(PIE_BRIDGE_NAMES.duelStakeTransfer, PIEDuelStakeTransferBridge);
}
