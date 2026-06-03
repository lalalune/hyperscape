declare module "@hyperforge/web3" {
  export interface ChainWriterStats {
    totalCallsFlushed: number;
    totalFlushes: number;
    failedFlushes: number;
    pending: number;
  }

  export interface ItemIdMap {
    stringToNumeric: Map<string, number>;
    numericToString: Map<number, string>;
    baseItemCount: number;
    totalItemCount: number;
  }

  export class ChainWriter {
    constructor();
    initialize(): Promise<void>;
    getStats(): ChainWriterStats;
    shutdown(): Promise<void>;
  }

  export class ChainWriterBridge {
    constructor(chainWriter: ChainWriter, itemIdMap: Map<string, number>);
    attachToWorld(world: {
      on: (event: string, handler: (payload: object) => void) => void;
    }): void;
    getChainWriter(): ChainWriter;
    shutdown(): Promise<void>;
    registerPlayerWallet(playerId: string, walletAddress: `0x${string}`): void;
  }

  export function buildItemIdMap(manifestsDir: string): Promise<ItemIdMap>;
  export function getManifestsDir(): string;
}
