/**
 * @module @hyperforge/web3
 *
 * The Web3 integration package for Hyperia.
 * Provides the ChainWriter service and supporting infrastructure
 * for optimistic on-chain state mirroring.
 */

export { ChainWriter } from "./chain-writer/ChainWriter.js";
export { ChainWriterBridge } from "./chain-writer/ChainWriterBridge.js";
export { BatchWriter } from "./tx/BatchWriter.js";
export {
  resolveChainConfig,
  getChainName,
  type ChainConfig,
} from "./config/chains.js";
export {
  buildItemIdMap,
  getManifestsDir,
  type ItemIdMap,
} from "./mapping/ItemIdMapping.js";
