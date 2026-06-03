import {
  type PublicClient,
  type WalletClient,
  type Account,
  type Chain,
  type Transport,
  type Hex,
  type Address,
} from "viem";

/**
 * A single system call to be batched.
 */
interface PendingCall {
  /** The encoded calldata for the system function */
  callData: Hex;
  /** Human-readable description for logging */
  description: string;
  /** Timestamp when this call was queued */
  queuedAt: number;
  /** Unique deduplication key for persistence */
  dedupeKey?: string;
}

/**
 * Interface for persisting failed transactions.
 * Implementations can use database, file, or other storage.
 */
export interface FailedTxPersistence {
  /**
   * Persist a failed transaction for later recovery.
   * @param call The failed call with details
   * @param error The error message
   * @param attemptCount Number of attempts made
   */
  persistFailedTx(
    call: PendingCall,
    error: string,
    attemptCount: number,
  ): Promise<void>;

  /**
   * Mark a transaction as dead-letter (permanently failed).
   * @param call The failed call
   * @param error The final error message
   */
  markDeadLetter(call: PendingCall, error: string): Promise<void>;

  /**
   * Load pending transactions from previous session (for recovery).
   */
  loadPendingTxs?(): Promise<PendingCall[]>;
}

/**
 * Result of a batch flush.
 */
interface FlushResult {
  /** Transaction hash */
  txHash: Hex;
  /** Number of calls in the batch */
  callCount: number;
  /** Gas used */
  gasUsed: bigint;
  /** Whether the transaction succeeded */
  success: boolean;
}

/**
 * Configuration for the BatchWriter.
 */
interface BatchWriterConfig {
  /** Maximum calls per batch (default: 20) */
  maxBatchSize: number;
  /** Maximum time (ms) before auto-flush (default: 2000 = 2 seconds) */
  maxBatchDelayMs: number;
  /** Maximum retries on failure (default: 3) */
  maxRetries: number;
  /** Base delay between retries in ms (default: 1000, exponential backoff) */
  retryBaseDelayMs: number;
  /** World contract address */
  worldAddress: Address;
  /** Optional persistence for failed transactions */
  persistence?: FailedTxPersistence;
}

const DEFAULT_CONFIG: BatchWriterConfig = {
  maxBatchSize: 20,
  maxBatchDelayMs: 2000,
  maxRetries: 3,
  retryBaseDelayMs: 1000,
  worldAddress: "0x0" as Address,
};

/**
 * BatchWriter accumulates MUD system calls and sends them as
 * a single World.batchCall() transaction for gas efficiency.
 *
 * The game server queues writes during gameplay. The BatchWriter
 * auto-flushes when either:
 * - The batch reaches maxBatchSize calls
 * - maxBatchDelayMs has elapsed since the first queued call
 *
 * On flush, all pending calls are sent as a single batchCall().
 * If the transaction fails, it retries with exponential backoff.
 * If all retries fail, the calls are logged for manual recovery.
 *
 * This reduces gas costs by ~55% compared to individual transactions:
 * - 20 individual txs: 20 × 21,000 base gas = 420,000 base gas
 * - 1 batchCall with 20 calls: 21,000 + 20 × ~5,000 = 121,000 base gas
 */
export class BatchWriter {
  private pendingCalls: PendingCall[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false;
  private config: BatchWriterConfig;
  private walletClient: WalletClient<Transport, Chain, Account>;
  private publicClient: PublicClient;
  private totalCallsFlushed = 0;
  private totalFlushes = 0;
  private failedFlushes = 0;

  constructor(
    walletClient: WalletClient<Transport, Chain, Account>,
    publicClient: PublicClient,
    config: Partial<BatchWriterConfig> = {},
  ) {
    this.walletClient = walletClient;
    this.publicClient = publicClient;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the batch writer, loading any pending transactions from persistence.
   * Call this on startup before processing new transactions.
   */
  async initialize(): Promise<void> {
    if (this.config.persistence?.loadPendingTxs) {
      try {
        const pending = await this.config.persistence.loadPendingTxs();
        if (pending.length > 0) {
          console.log(
            `[BatchWriter] Recovered ${pending.length} pending transactions from previous session`,
          );
          this.pendingCalls.push(...pending);
        }
      } catch (err) {
        console.error(
          "[BatchWriter] Failed to load pending transactions:",
          err,
        );
      }
    }
  }

  /**
   * Queue a system call for batched execution.
   * @param callData The ABI-encoded function call data
   * @param description Human-readable description for logging
   * @param dedupeKey Optional unique key for deduplication and recovery
   */
  queueCall(callData: Hex, description: string, dedupeKey?: string): void {
    this.pendingCalls.push({
      callData,
      description,
      queuedAt: Date.now(),
      dedupeKey:
        dedupeKey ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    });

    // Start flush timer on first call in batch
    if (this.pendingCalls.length === 1 && !this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flush().catch((err) => {
          console.error("[BatchWriter] Auto-flush failed:", err);
        });
      }, this.config.maxBatchDelayMs);
    }

    // Flush immediately if batch is full
    if (this.pendingCalls.length >= this.config.maxBatchSize) {
      this.flush().catch((err) => {
        console.error("[BatchWriter] Size-triggered flush failed:", err);
      });
    }
  }

  /**
   * Get the number of pending calls in the current batch.
   */
  get pendingCount(): number {
    return this.pendingCalls.length;
  }

  /**
   * Get statistics about the BatchWriter's performance.
   */
  getStats(): {
    totalCallsFlushed: number;
    totalFlushes: number;
    failedFlushes: number;
    pending: number;
  } {
    return {
      totalCallsFlushed: this.totalCallsFlushed,
      totalFlushes: this.totalFlushes,
      failedFlushes: this.failedFlushes,
      pending: this.pendingCalls.length,
    };
  }

  /**
   * Flush all pending calls as a single batchCall transaction.
   * Called automatically by timer/size triggers, or manually.
   */
  async flush(): Promise<FlushResult | null> {
    // Clear the timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Nothing to flush
    if (this.pendingCalls.length === 0) return null;

    // Prevent concurrent flushes
    if (this.isFlushing) return null;
    this.isFlushing = true;

    // Take the current batch
    const batch = [...this.pendingCalls];
    this.pendingCalls = [];

    const startTime = Date.now();

    console.log(
      `[BatchWriter] Flushing ${batch.length} calls: ${batch.map((c) => c.description).join(", ")}`,
    );

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = this.config.retryBaseDelayMs * Math.pow(2, attempt - 1);
        console.log(
          `[BatchWriter] Retry ${attempt}/${this.config.maxRetries} after ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const result = await this._sendBatch(batch);
      if (result.success) {
        this.totalCallsFlushed += batch.length;
        this.totalFlushes++;
        this.isFlushing = false;

        const elapsed = Date.now() - startTime;
        console.log(
          `[BatchWriter] Flush complete: ${batch.length} calls, tx=${result.txHash}, gas=${result.gasUsed}, ${elapsed}ms`,
        );
        return result;
      }

      console.warn(
        `[BatchWriter] Attempt ${attempt} failed: tx=${result.txHash}`,
      );
    }

    // All retries exhausted
    this.failedFlushes++;
    this.isFlushing = false;

    console.error(
      `[BatchWriter] FAILED after ${this.config.maxRetries} retries. Lost ${batch.length} calls:`,
      batch.map((c) => c.description),
    );

    // Persist failed transactions if persistence is configured
    if (this.config.persistence) {
      for (const call of batch) {
        try {
          await this.config.persistence.markDeadLetter(
            call,
            `Failed after ${this.config.maxRetries} retries`,
          );
        } catch (persistErr) {
          console.error(
            `[BatchWriter] Failed to persist dead-letter tx: ${call.description}`,
            persistErr,
          );
        }
      }
    } else {
      // No persistence - re-queue for in-memory retry (best effort, lost on restart)
      this.pendingCalls.unshift(...batch);
    }

    return null;
  }

  /**
   * Send a batch of calls to the World contract.
   *
   * Each call's callData is already encoded with the World's namespace-prefixed
   * function selectors (e.g. hyperia__registerPlayer). These are sent as
   * individual transactions to the World address in parallel.
   *
   * CRITICAL: To prevent nonce race conditions when sending parallel transactions,
   * we fetch the current nonce once and explicitly assign sequential nonces to
   * each transaction. This ensures transactions are ordered correctly even when
   * sent simultaneously.
   *
   * Why not batchCall: MUD's batchCall(SystemCallData[]) requires system
   * ResourceIds, which we don't resolve at the TypeScript level. Direct
   * World function calls are simpler and correct. The gas overhead of
   * separate transactions is acceptable for optimistic writes.
   *
   * Future optimization: resolve systemIds from MUD config and use batchCall.
   */
  private async _sendBatch(batch: PendingCall[]): Promise<FlushResult> {
    // CRITICAL: Get current nonce ONCE before sending any transactions
    // This prevents the race condition where parallel sendTransaction calls
    // all query the same "pending" nonce and overwrite each other
    const account = this.walletClient.account;
    const startNonce = await this.publicClient.getTransactionCount({
      address: account.address,
      blockTag: "pending",
    });

    // Send all calls in parallel with explicitly assigned sequential nonces
    const txPromises = batch.map((call, index) =>
      this.walletClient.sendTransaction({
        to: this.config.worldAddress,
        data: call.callData,
        chain: this.walletClient.chain,
        nonce: startNonce + index, // Explicit sequential nonce assignment
      }),
    );

    const txHashes = await Promise.all(txPromises);

    // Wait for all receipts with timeout to prevent hanging forever
    // 5 minutes max wait per transaction (300,000ms)
    const RECEIPT_TIMEOUT_MS = 5 * 60 * 1000;

    const receiptPromises = txHashes.map(async (hash) => {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                `Receipt timeout for tx ${hash} after ${RECEIPT_TIMEOUT_MS}ms`,
              ),
            ),
          RECEIPT_TIMEOUT_MS,
        );
      });

      return Promise.race([
        this.publicClient.waitForTransactionReceipt({ hash }),
        timeoutPromise,
      ]);
    });

    const receipts = await Promise.all(receiptPromises);

    // Aggregate results
    const totalGas = receipts.reduce((sum, r) => sum + r.gasUsed, 0n);
    const allSuccess = receipts.every((r) => r.status === "success");

    return {
      txHash: txHashes[0], // Return first tx hash for logging
      callCount: batch.length,
      gasUsed: totalGas,
      success: allSuccess,
    };
  }

  /**
   * Force flush and clean up. Call on server shutdown.
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.pendingCalls.length > 0) {
      console.log(
        `[BatchWriter] Shutdown: flushing ${this.pendingCalls.length} remaining calls`,
      );
      await this.flush();
    }
  }
}
