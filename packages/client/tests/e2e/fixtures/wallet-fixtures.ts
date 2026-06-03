/**
 * Headless Wallet Fixtures for Hyperia E2E Tests
 *
 * Provides headless wallet injection for both EVM (MetaMask) and Solana (Phantom).
 * Uses `headless-web3-provider` for EVM and a custom Phantom mock for Solana.
 *
 * Providers are injected via addInitScript (BEFORE page load) so that
 * Privy's wallet detection (EIP-6963 for EVM, window.phantom for Solana)
 * picks them up during React initialization.
 *
 * No browser extensions. No cache. Fully headless. CI-friendly.
 *
 * Adapted from otc-agent E2E fixtures for the Hyperia auth flow.
 */

import { createRequire } from "node:module";
import { test as base, type Page } from "@playwright/test";
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";

const require = createRequire(import.meta.url);
const { injectHeadlessWeb3Provider, Web3RequestKind } =
  require("headless-web3-provider") as typeof import("headless-web3-provider");

// Re-export Web3RequestKind for tests
export { Web3RequestKind };

// =============================================================================
// DEFAULT TEST KEYS
// =============================================================================

/**
 * Anvil default Account #0 private key.
 * Used for test wallet connections. Only for local/test environments.
 */
const ANVIL_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

/**
 * Anvil Account #1 private key (secondary test wallet).
 */
const ANVIL_SECONDARY_PRIVATE_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

/**
 * Default RPC URL for local Anvil / test EVM chain.
 */
const EVM_RPC_URL = process.env.TEST_EVM_RPC_URL ?? "http://127.0.0.1:8545";

/**
 * Chain ID for local Anvil (31337 by default).
 */
const EVM_CHAIN_ID = Number(process.env.TEST_CHAIN_ID ?? 31337);

// =============================================================================
// TYPES
// =============================================================================

export type HeadlessWeb3Wallet = Awaited<
  ReturnType<typeof injectHeadlessWeb3Provider>
>;

export interface PhantomMockHandle {
  publicKey: string;
  secretKeyArray: number[];
}

type PageFixtureArgs = { page: Page };
type UseFixture<T> = (value: T) => Promise<void>;

type Eip1193Request = {
  method: string;
  params?: unknown[];
};

// =============================================================================
// EVM: MetaMask masquerade for Privy detection
// =============================================================================

/**
 * After headless-web3-provider injects window.ethereum, re-announce it
 * via EIP-6963 as "MetaMask" so Privy's detected_ethereum_wallets picks it up.
 * Also sets isMetaMask=true for legacy detection fallback.
 */
async function patchProviderAsMetaMask(page: Page): Promise<void> {
  await page.addInitScript(() => {
    function patch() {
      const eth = (window as unknown as Record<string, unknown>).ethereum;
      if (!eth || typeof eth !== "object") return;

      // Legacy detection: Privy checks isMetaMask as fallback
      (eth as Record<string, unknown>).isMetaMask = true;

      // EIP-6963: Re-announce as MetaMask so Privy shows it in the wallet list
      const detail = Object.freeze({
        info: {
          icon: "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%3E%3Crect%20fill%3D%22%23f6851b%22%20width%3D%2224%22%20height%3D%2224%22%20rx%3D%224%22%2F%3E%3C%2Fsvg%3E",
          name: "MetaMask",
          rdns: "io.metamask",
          uuid: "e2e-headless-metamask-0000-0000-0000",
        },
        provider: eth,
      });

      const announce = new CustomEvent("eip6963:announceProvider", { detail });
      window.dispatchEvent(announce);
      window.addEventListener("eip6963:requestProvider", () => {
        window.dispatchEvent(announce);
      });
    }

    // headless-web3-provider's addInitScript runs first and sets window.ethereum,
    // then dispatches "ethereum#initialized". Listen for that, then patch.
    patch();
    window.addEventListener("ethereum#initialized", patch);
  });
}

/**
 * Privy sends SIWE payloads to `personal_sign` as a hex-encoded message.
 *
 * `headless-web3-provider` signs string payloads as UTF-8 by default, which
 * produces an invalid SIWE signature for hex messages. Normalize payloads so
 * E2E wallet signatures match real wallet behavior.
 */
function patchSiweSigning(wallet: HeadlessWeb3Wallet): void {
  const walletWithRequest = wallet as unknown as {
    request: (request: Eip1193Request) => Promise<unknown>;
  };

  const originalRequest = walletWithRequest.request.bind(walletWithRequest);

  const isAddress = (value: unknown): value is string =>
    typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
  const isHexBytes = (value: unknown): value is string =>
    typeof value === "string" &&
    /^0x[0-9a-fA-F]*$/.test(value) &&
    value.length % 2 === 0;
  const hexToBytes = (hex: string): Uint8Array => {
    const bytes = new Uint8Array((hex.length - 2) / 2);
    for (let i = 2, j = 0; i < hex.length; i += 2, j++) {
      bytes[j] = Number.parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
  };

  walletWithRequest.request = async (request: Eip1193Request) => {
    if (
      request.method === "personal_sign" &&
      Array.isArray(request.params) &&
      request.params.length >= 2
    ) {
      let [payload, address] = request.params;

      // Some providers call personal_sign(address, payload) - normalize it.
      if (isAddress(payload) && typeof address === "string") {
        [payload, address] = [address, payload];
      }

      // MetaMask signs hex payloads as raw bytes, not UTF-8 hex strings.
      if (isHexBytes(payload)) {
        payload = hexToBytes(payload);
      }

      return originalRequest({
        ...request,
        params: [payload, address],
      });
    }

    return originalRequest(request);
  };
}

// =============================================================================
// SOLANA: Phantom mock injected BEFORE page load
// =============================================================================

/**
 * Inject window.phantom / window.solana via addInitScript so it's present
 * before Privy initializes its wallet detection.
 */
async function injectPhantomBeforeLoad(
  page: Page,
  publicKeyBase58: string,
): Promise<void> {
  await page.addInitScript((pubkey: string) => {
    const mockPublicKey = {
      toBase58: () => pubkey,
      toString: () => pubkey,
      toJSON: () => pubkey,
      toBytes: () => new Uint8Array(32),
      toBuffer: () => new Uint8Array(32),
      equals: (other: { toBase58?: () => string }) =>
        other?.toBase58?.() === pubkey,
    };

    const mock: Record<string, unknown> = {
      isPhantom: true,
      publicKey: mockPublicKey,
      isConnected: false,

      async connect() {
        mock.isConnected = true;
        return { publicKey: mockPublicKey };
      },

      async disconnect() {
        mock.isConnected = false;
      },

      async signMessage(message: Uint8Array) {
        const win = window as unknown as Record<
          string,
          (bytes: number[]) => Promise<number[]>
        >;
        if (typeof win.__phantomSignMessage !== "function") {
          throw new Error(
            "__phantomSignMessage not exposed - signing not available",
          );
        }
        const sigArray = await win.__phantomSignMessage(Array.from(message));
        return { signature: new Uint8Array(sigArray) };
      },

      async signTransaction(tx: Record<string, unknown>) {
        return tx;
      },

      async signAndSendTransaction(tx: Record<string, unknown>) {
        return tx;
      },

      async signAllTransactions(txs: Record<string, unknown>[]) {
        return txs;
      },

      on() {
        /* noop */
      },
      off() {
        /* noop */
      },
      removeAllListeners() {
        /* noop */
      },
    };

    const win = window as unknown as Record<string, unknown>;
    win.solana = mock;
    win.phantom = { solana: mock };
  }, publicKeyBase58);
}

// =============================================================================
// SOLANA TEST KEYPAIR
// =============================================================================

const SOLANA_TEST_KEYPAIR = Keypair.generate();

// =============================================================================
// AUTO-PERMIT CONFIG
// =============================================================================

/**
 * Auto-permit all request types so the headless provider responds immediately.
 * No manual wallet.authorize() needed — auto-approves everything.
 */
const AUTO_PERMIT_ALL = {
  permitted: [
    Web3RequestKind.RequestAccounts,
    Web3RequestKind.Accounts,
    Web3RequestKind.SendTransaction,
    Web3RequestKind.SignMessage,
    Web3RequestKind.SignTypedData,
    Web3RequestKind.SignTypedDataV1,
    Web3RequestKind.SignTypedDataV3,
    Web3RequestKind.SignTypedDataV4,
    Web3RequestKind.SwitchEthereumChain,
    Web3RequestKind.AddEthereumChain,
    Web3RequestKind.RequestPermissions,
  ],
};

// =============================================================================
// PLAYWRIGHT FIXTURES
// =============================================================================

interface EvmFixtures {
  wallet: HeadlessWeb3Wallet;
}

interface SolanaFixtures {
  phantomMock: PhantomMockHandle;
}

interface CombinedFixtures extends EvmFixtures, SolanaFixtures {}

/**
 * Playwright test with EVM headless wallet that masquerades as MetaMask.
 * The headless provider auto-approves all wallet requests.
 */
export const evmTest = base.extend<EvmFixtures>({
  wallet: async (
    { page }: PageFixtureArgs,
    use: UseFixture<HeadlessWeb3Wallet>,
  ) => {
    const wallet = await injectHeadlessWeb3Provider(
      page,
      [ANVIL_PRIVATE_KEY, ANVIL_SECONDARY_PRIVATE_KEY],
      EVM_CHAIN_ID,
      EVM_RPC_URL,
      AUTO_PERMIT_ALL,
    );
    patchSiweSigning(wallet);
    // Patch the provider to announce as MetaMask for Privy
    await patchProviderAsMetaMask(page);
    await use(wallet);
  },
});

/**
 * Playwright test with Solana headless Phantom mock.
 * Exposes a Node.js signing function before page load so Privy
 * can complete the Phantom connection flow.
 */
export const solanaTest = base.extend<SolanaFixtures>({
  phantomMock: async (
    { page }: PageFixtureArgs,
    use: UseFixture<PhantomMockHandle>,
  ) => {
    const pubkey = SOLANA_TEST_KEYPAIR.publicKey.toBase58();

    // Expose Node.js signing function BEFORE page load
    await page.exposeFunction(
      "__phantomSignMessage",
      (msgBytes: number[]): number[] => {
        const sig = nacl.sign.detached(
          new Uint8Array(msgBytes),
          SOLANA_TEST_KEYPAIR.secretKey,
        );
        return Array.from(sig);
      },
    );

    // Inject Phantom mock via addInitScript so it's present when Privy scans
    await injectPhantomBeforeLoad(page, pubkey);

    await use({
      publicKey: pubkey,
      secretKeyArray: Array.from(SOLANA_TEST_KEYPAIR.secretKey),
    });
  },
});

/**
 * Playwright test with both EVM and Solana fixtures available.
 */
export const combinedTest = base.extend<CombinedFixtures>({
  wallet: async (
    { page }: PageFixtureArgs,
    use: UseFixture<HeadlessWeb3Wallet>,
  ) => {
    const wallet = await injectHeadlessWeb3Provider(
      page,
      [ANVIL_PRIVATE_KEY, ANVIL_SECONDARY_PRIVATE_KEY],
      EVM_CHAIN_ID,
      EVM_RPC_URL,
      AUTO_PERMIT_ALL,
    );
    patchSiweSigning(wallet);
    await patchProviderAsMetaMask(page);
    await use(wallet);
  },
  phantomMock: async (
    { page }: PageFixtureArgs,
    use: UseFixture<PhantomMockHandle>,
  ) => {
    const pubkey = SOLANA_TEST_KEYPAIR.publicKey.toBase58();
    await page.exposeFunction(
      "__phantomSignMessage",
      (msgBytes: number[]): number[] => {
        const sig = nacl.sign.detached(
          new Uint8Array(msgBytes),
          SOLANA_TEST_KEYPAIR.secretKey,
        );
        return Array.from(sig);
      },
    );
    await injectPhantomBeforeLoad(page, pubkey);
    await use({
      publicKey: pubkey,
      secretKeyArray: Array.from(SOLANA_TEST_KEYPAIR.secretKey),
    });
  },
});
