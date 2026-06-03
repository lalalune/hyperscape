import crypto from "node:crypto";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { ethers } from "ethers";

const FETCH_TIMEOUT_MS = 15_000;
const HYPERIA_AUTH_MESSAGE_TYPE = "HYPERIA_AUTH";
const PLACEHOLDER_RE =
  /^\[?\s*(REDACTED|PLACEHOLDER|TODO|CHANGEME|EMPTY)\s*]?$/i;
const MANAGED_EVM_ADDRESS_ENV_KEY = "ELIZA_MANAGED_EVM_ADDRESS";
const MANAGED_SOLANA_ADDRESS_ENV_KEY = "ELIZA_MANAGED_SOLANA_ADDRESS";

export interface HyperiaBridgeRuntimeLike {
  agentId?: string;
  character?: {
    name?: string;
    walletAddress?: unknown;
    walletAddresses?: Record<string, unknown>;
    settings?: {
      evmAddress?: unknown;
      solanaAddress?: unknown;
      secrets?: Record<string, unknown>;
    };
    secrets?: Record<string, unknown>;
  } | null;
  getAgent?: (agentId: string) => Promise<unknown>;
  getServiceLoadPromise?: (serviceType: string) => Promise<unknown>;
  getSetting?: (key: string) => unknown;
  hasService?: (serviceType: string) => boolean;
  setSetting?: (key: string, value: string, secret?: boolean) => void;
}

export interface HyperiaLaunchDiagnostic {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
}

export interface HyperiaViewerAuthMessage {
  type: "HYPERIA_AUTH";
  authToken: string;
  agentId?: string;
  characterId?: string;
  followEntity?: string;
}

interface HyperiaWalletCandidate {
  address: string;
  walletType: "evm" | "solana";
}

interface HyperiaWalletAuthResponse {
  success?: boolean;
  authToken?: string;
  characterId?: string;
  accountId?: string;
  error?: string;
}

interface WalletAddresses {
  evmAddress: string | null;
  solanaAddress: string | null;
}

function readRuntimeSetting(
  runtime: HyperiaBridgeRuntimeLike | null | undefined,
  key: string,
): string | null {
  const runtimeValue = runtime?.getSetting?.(key);
  if (typeof runtimeValue === "string" && runtimeValue.trim().length > 0) {
    return runtimeValue.trim();
  }
  const envValue = process.env[key];
  return typeof envValue === "string" && envValue.trim().length > 0
    ? envValue.trim()
    : null;
}

function isEvmAddress(value: string | null | undefined): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

function isLikelySolanaAddress(
  value: string | null | undefined,
): value is string {
  return (
    typeof value === "string" &&
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.trim())
  );
}

function readObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeManagedEvmAddress(): string | null {
  const managedEvmAddress = process.env[MANAGED_EVM_ADDRESS_ENV_KEY];
  if (!managedEvmAddress) {
    return null;
  }
  const trimmed = managedEvmAddress.trim();
  return /^0x[0-9a-fA-F]{40}$/.test(trimmed) ? trimmed : null;
}

function base58Encode(data: Buffer | Uint8Array): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = BigInt(`0x${Buffer.from(data).toString("hex")}`);
  const chars: string[] = [];
  while (num > 0n) {
    chars.unshift(alphabet[Number(num % 58n)]);
    num /= 58n;
  }
  for (const byte of data) {
    if (byte === 0) {
      chars.unshift("1");
      continue;
    }
    break;
  }
  return chars.join("") || "1";
}

function base58Decode(value: string): Buffer {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  if (value.length === 0) {
    return Buffer.alloc(0);
  }
  let num = 0n;
  for (const character of value) {
    const index = alphabet.indexOf(character);
    if (index === -1) {
      throw new Error(`Invalid base58 character: ${character}`);
    }
    num = num * 58n + BigInt(index);
  }
  const hex = num.toString(16).padStart(2, "0");
  const bytes = Buffer.from(hex.length % 2 === 0 ? hex : `0${hex}`, "hex");
  let zeroCount = 0;
  for (const character of value) {
    if (character === "1") {
      zeroCount += 1;
      continue;
    }
    break;
  }
  return zeroCount > 0
    ? Buffer.concat([Buffer.alloc(zeroCount), bytes])
    : bytes;
}

function decodeSolanaPrivateKey(key: string): Buffer {
  if (PLACEHOLDER_RE.test(key)) {
    throw new Error("placeholder value");
  }
  if (key.startsWith("[") && key.endsWith("]") && /^\[\s*\d/.test(key)) {
    const parsed = JSON.parse(key) as unknown;
    if (
      !Array.isArray(parsed) ||
      !parsed.every((value) => typeof value === "number")
    ) {
      throw new Error("Invalid Solana key array");
    }
    return Buffer.from(parsed);
  }
  return base58Decode(key);
}

function deriveEvmAddress(privateKeyHex: string): string {
  const cleaned = privateKeyHex.startsWith("0x")
    ? privateKeyHex.slice(2)
    : privateKeyHex;
  const publicKey = secp256k1.getPublicKey(Buffer.from(cleaned, "hex"), false);
  const publicKeyBytes = publicKey.subarray(1);
  const hash = ethers.keccak256(publicKeyBytes);
  return ethers.getAddress(`0x${hash.slice(26)}`);
}

function deriveSolanaAddress(privateKeyString: string): string {
  const secretBytes = decodeSolanaPrivateKey(privateKeyString);
  if (secretBytes.length === 64) {
    return base58Encode(secretBytes.subarray(32));
  }
  if (secretBytes.length === 32) {
    const keyObject = crypto.createPrivateKey({
      key: Buffer.concat([
        Buffer.from("302e020100300506032b657004220420", "hex"),
        secretBytes,
      ]),
      format: "der",
      type: "pkcs8",
    });
    const publicKeyDer = crypto
      .createPublicKey(keyObject)
      .export({ type: "spki", format: "der" }) as Buffer;
    return base58Encode(publicKeyDer.subarray(12, 44));
  }
  throw new Error(`Invalid Solana secret key length: ${secretBytes.length}`);
}

function generateWalletKeys(): {
  evmAddress: string;
  evmPrivateKey: string;
  solanaAddress: string;
  solanaPrivateKey: string;
} {
  const evmPrivateKey = `0x${crypto.randomBytes(32).toString("hex")}`;
  const evmAddress = deriveEvmAddress(evmPrivateKey);

  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const privateKeyDer = privateKey.export({ type: "pkcs8", format: "der" });
  const publicKeyDer = publicKey.export({ type: "spki", format: "der" });
  const seed = (privateKeyDer as Buffer).subarray(16, 48);
  const publicKeyRaw = (publicKeyDer as Buffer).subarray(12, 44);
  const solanaPrivateKey = base58Encode(Buffer.concat([seed, publicKeyRaw]));
  const solanaAddress = base58Encode(publicKeyRaw);

  return {
    evmAddress,
    evmPrivateKey,
    solanaAddress,
    solanaPrivateKey,
  };
}

function extractWalletCandidateFromRecord(
  record: unknown,
): HyperiaWalletCandidate | null {
  const objectRecord = readObject(record);
  if (!objectRecord) {
    return null;
  }

  const directWalletAddresses = readObject(objectRecord.walletAddresses);
  const characterRecord = readObject(objectRecord.character);
  const characterSettings = readObject(characterRecord?.settings);
  const characterWalletAddresses = readObject(characterRecord?.walletAddresses);
  const characterSecrets = readObject(characterSettings?.secrets);

  const evmCandidates = [
    directWalletAddresses?.evm,
    objectRecord.walletAddress,
    characterWalletAddresses?.evm,
    characterRecord?.walletAddress,
    characterSettings?.evmAddress,
    characterSecrets?.EVM_PUBLIC_KEY,
  ];
  for (const candidate of evmCandidates) {
    if (typeof candidate === "string" && isEvmAddress(candidate)) {
      return {
        address: candidate.trim(),
        walletType: "evm",
      };
    }
  }

  const solanaCandidates = [
    directWalletAddresses?.solana,
    characterWalletAddresses?.solana,
    characterSettings?.solanaAddress,
    characterSecrets?.SOLANA_PUBLIC_KEY,
  ];
  for (const candidate of solanaCandidates) {
    if (typeof candidate === "string" && isLikelySolanaAddress(candidate)) {
      return {
        address: candidate.trim(),
        walletType: "solana",
      };
    }
  }

  return null;
}

async function resolveRuntimeWalletCandidate(
  runtime: HyperiaBridgeRuntimeLike | null,
): Promise<HyperiaWalletCandidate | null> {
  if (!runtime) {
    return null;
  }

  if (
    typeof runtime.getAgent === "function" &&
    typeof runtime.agentId === "string" &&
    runtime.agentId.trim().length > 0
  ) {
    const agentRecord = await runtime.getAgent(runtime.agentId);
    const candidate = extractWalletCandidateFromRecord(agentRecord);
    if (candidate) {
      return candidate;
    }
  }

  const characterCandidate = extractWalletCandidateFromRecord({
    character: runtime.character ?? null,
  });
  if (characterCandidate) {
    return {
      ...characterCandidate,
    };
  }

  const managedEvmAddress = readRuntimeSetting(
    runtime,
    MANAGED_EVM_ADDRESS_ENV_KEY,
  );
  if (isEvmAddress(managedEvmAddress)) {
    return {
      address: managedEvmAddress.trim(),
      walletType: "evm",
    };
  }

  const managedSolanaAddress = readRuntimeSetting(
    runtime,
    MANAGED_SOLANA_ADDRESS_ENV_KEY,
  );
  if (isLikelySolanaAddress(managedSolanaAddress)) {
    return {
      address: managedSolanaAddress.trim(),
      walletType: "solana",
    };
  }

  return null;
}

function readWalletAddressesFromEnv(): WalletAddresses {
  let evmAddress: string | null = null;
  let solanaAddress: string | null = null;

  const evmPrivateKey = process.env.EVM_PRIVATE_KEY;
  if (evmPrivateKey && !PLACEHOLDER_RE.test(evmPrivateKey)) {
    try {
      evmAddress = deriveEvmAddress(evmPrivateKey);
    } catch {
      evmAddress = null;
    }
  }

  const solanaPrivateKey = process.env.SOLANA_PRIVATE_KEY;
  if (solanaPrivateKey && !PLACEHOLDER_RE.test(solanaPrivateKey)) {
    try {
      solanaAddress = deriveSolanaAddress(solanaPrivateKey);
    } catch {
      solanaAddress = null;
    }
  }

  if (!evmAddress) {
    evmAddress = normalizeManagedEvmAddress();
  }

  if (!solanaAddress) {
    const managedSolanaAddress = process.env[MANAGED_SOLANA_ADDRESS_ENV_KEY];
    if (managedSolanaAddress) {
      const trimmed = managedSolanaAddress.trim();
      try {
        if (base58Decode(trimmed).length === 32) {
          solanaAddress = trimmed;
        }
      } catch {
        solanaAddress = null;
      }
    }
  }

  return { evmAddress, solanaAddress };
}

async function getWalletAddressesWithSteward(): Promise<
  WalletAddresses & {
    stewardEvmAddress?: string | null;
    stewardSolanaAddress?: string | null;
  }
> {
  const base = readWalletAddressesFromEnv();
  const stewardApiUrl = process.env.STEWARD_API_URL?.trim();
  if (!stewardApiUrl) {
    return base;
  }

  const agentId =
    process.env.STEWARD_AGENT_ID?.trim() ||
    process.env.MILADY_STEWARD_AGENT_ID?.trim() ||
    process.env.ELIZA_STEWARD_AGENT_ID?.trim() ||
    base.evmAddress?.trim() ||
    null;
  if (!agentId) {
    return base;
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const stewardBearerToken = process.env.STEWARD_AGENT_TOKEN?.trim();
  const stewardApiKey = process.env.STEWARD_API_KEY?.trim();
  const stewardTenantId = process.env.STEWARD_TENANT_ID?.trim();
  if (stewardBearerToken) {
    headers.Authorization = `Bearer ${stewardBearerToken}`;
  } else if (stewardApiKey) {
    headers["X-Steward-Key"] = stewardApiKey;
  }
  if (stewardTenantId) {
    headers["X-Steward-Tenant"] = stewardTenantId;
  }

  try {
    const response = await fetch(
      `${stewardApiUrl.replace(/\/+$/, "")}/agents/${encodeURIComponent(agentId)}`,
      {
        headers,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      return base;
    }

    const payload = (await response.json()) as {
      ok?: boolean;
      data?: {
        walletAddress?: string;
        walletAddresses?: { evm?: string; solana?: string };
      };
    };
    const agent = payload.data ?? (payload as unknown as typeof payload.data);
    const stewardEvm =
      agent?.walletAddresses?.evm?.trim() ||
      agent?.walletAddress?.trim() ||
      null;
    const stewardSolana = agent?.walletAddresses?.solana?.trim() || null;

    return {
      evmAddress: base.evmAddress ?? stewardEvm,
      solanaAddress: base.solanaAddress ?? stewardSolana,
      stewardEvmAddress: stewardEvm,
      stewardSolanaAddress: stewardSolana,
    };
  } catch {
    return base;
  }
}

async function resolveHyperiaWalletCandidate(
  runtime: HyperiaBridgeRuntimeLike | null,
): Promise<HyperiaWalletCandidate | null> {
  const runtimeWallet = await resolveRuntimeWalletCandidate(runtime);
  if (runtimeWallet) {
    return runtimeWallet;
  }

  const walletAddresses = await getWalletAddressesWithSteward();
  if (isEvmAddress(walletAddresses.evmAddress)) {
    return {
      address: walletAddresses.evmAddress.trim(),
      walletType: "evm",
    };
  }
  if (isLikelySolanaAddress(walletAddresses.solanaAddress)) {
    return {
      address: walletAddresses.solanaAddress.trim(),
      walletType: "solana",
    };
  }

  return null;
}

function persistRuntimeSecret(
  runtime: HyperiaBridgeRuntimeLike | null,
  key: string,
  value: string,
): void {
  process.env[key] = value;
  runtime?.setSetting?.(key, value, true);
  const character = runtime?.character;
  if (!character) {
    return;
  }

  if (!character.settings) {
    character.settings = {};
  }
  if (!character.settings.secrets) {
    character.settings.secrets = {};
  }
  character.settings.secrets[key] = value;
  if (!character.secrets) {
    character.secrets = {};
  }
  character.secrets[key] = value;
}

function provisionRuntimeWalletCandidate(
  runtime: HyperiaBridgeRuntimeLike,
): HyperiaWalletCandidate {
  const walletKeys = generateWalletKeys();
  persistRuntimeSecret(runtime, "EVM_PRIVATE_KEY", walletKeys.evmPrivateKey);
  persistRuntimeSecret(
    runtime,
    "SOLANA_PRIVATE_KEY",
    walletKeys.solanaPrivateKey,
  );

  return {
    address: walletKeys.evmAddress,
    walletType: "evm",
  };
}

function persistHyperiaCredential(
  runtime: HyperiaBridgeRuntimeLike | null,
  key: "HYPERIA_AUTH_TOKEN" | "HYPERIA_CHARACTER_ID" | "HYPERIA_ACCOUNT_ID",
  value: string,
  secret = false,
): void {
  process.env[key] = value;
  runtime?.setSetting?.(key, value, secret);
  const character = runtime?.character;
  if (!character) {
    return;
  }

  if (!character.settings) {
    character.settings = {};
  }
  if (!character.settings.secrets) {
    character.settings.secrets = {};
  }
  character.settings.secrets[key] = value;
  if (!character.secrets) {
    character.secrets = {};
  }
  character.secrets[key] = value;
}

function resolveHyperiaApiBaseUrl(
  runtime: HyperiaBridgeRuntimeLike | null,
): string {
  const runtimeUrl = readRuntimeSetting(runtime, "HYPERIA_API_URL");
  if (runtimeUrl) {
    return runtimeUrl.replace(/\/+$/, "");
  }
  return process.env.NODE_ENV === "production"
    ? "https://hyperia.gg"
    : "http://localhost:5555";
}

async function authenticateHyperiaWallet(
  runtime: HyperiaBridgeRuntimeLike,
  wallet: HyperiaWalletCandidate,
): Promise<{
  authToken: string;
  characterId: string;
  accountId?: string;
}> {
  const response = await fetch(
    new URL("/api/agents/wallet-auth", resolveHyperiaApiBaseUrl(runtime)),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        walletAddress: wallet.address,
        walletType: wallet.walletType,
        agentName: runtime.character?.name || "Agent",
        agentId: runtime.agentId,
      }),
      signal: AbortSignal.timeout(1_500),
    },
  );

  const text = await response.text();
  const data =
    text.trim().length > 0
      ? (JSON.parse(text) as HyperiaWalletAuthResponse)
      : null;

  if (!response.ok) {
    const detail =
      data && typeof data.error === "string" && data.error.trim().length > 0
        ? data.error.trim()
        : text.trim();
    throw new Error(
      detail.length > 0
        ? `Hyperia wallet auth failed (${response.status}): ${detail}`
        : `Hyperia wallet auth failed with status ${response.status}`,
    );
  }

  if (!data?.success || !data.authToken || !data.characterId) {
    throw new Error("Hyperia wallet auth returned an invalid response.");
  }

  return {
    authToken: data.authToken,
    characterId: data.characterId,
    ...(data.accountId ? { accountId: data.accountId } : {}),
  };
}

export async function prepareHyperiaAppLaunch(
  runtime: HyperiaBridgeRuntimeLike | null,
): Promise<HyperiaLaunchDiagnostic[]> {
  if (!runtime) {
    return [];
  }

  const authToken = readRuntimeSetting(runtime, "HYPERIA_AUTH_TOKEN");
  const characterId = readRuntimeSetting(runtime, "HYPERIA_CHARACTER_ID");
  if (authToken && characterId) {
    return [];
  }

  const wallet =
    (await resolveHyperiaWalletCandidate(runtime)) ??
    provisionRuntimeWalletCandidate(runtime);

  try {
    const authResult = await authenticateHyperiaWallet(runtime, wallet);
    persistHyperiaCredential(
      runtime,
      "HYPERIA_AUTH_TOKEN",
      authResult.authToken,
      true,
    );
    persistHyperiaCredential(
      runtime,
      "HYPERIA_CHARACTER_ID",
      authResult.characterId,
    );
    if (authResult.accountId) {
      persistHyperiaCredential(
        runtime,
        "HYPERIA_ACCOUNT_ID",
        authResult.accountId,
      );
    }
    return [];
  } catch (error) {
    return [
      {
        code: "hyperia-auth-provisioning-failed",
        severity: "warning",
        message:
          error instanceof Error
            ? error.message
            : "Hyperia wallet auth failed.",
      },
    ];
  }
}

export function resolveHyperiaViewerAuthMessage(
  runtime: HyperiaBridgeRuntimeLike | null,
): HyperiaViewerAuthMessage | null {
  const authToken = readRuntimeSetting(runtime, "HYPERIA_AUTH_TOKEN");
  if (!authToken) {
    return null;
  }

  const characterId = readRuntimeSetting(runtime, "HYPERIA_CHARACTER_ID");
  const agentId =
    typeof runtime?.agentId === "string" && runtime.agentId.trim().length > 0
      ? runtime.agentId
      : undefined;

  return {
    type: HYPERIA_AUTH_MESSAGE_TYPE,
    authToken,
    ...(agentId ? { agentId } : {}),
    ...(characterId ? { characterId, followEntity: characterId } : {}),
  };
}

export function isHyperiaRuntimeReady(
  runtime: HyperiaBridgeRuntimeLike | null,
): boolean {
  return Boolean(
    runtime &&
    typeof runtime.hasService === "function" &&
    runtime.hasService("hyperiaService"),
  );
}

export async function ensureHyperiaRuntimeReady(
  runtime: HyperiaBridgeRuntimeLike | null,
): Promise<void> {
  if (!runtime) {
    return;
  }
  if (!isHyperiaRuntimeReady(runtime)) {
    throw new Error("Hyperia service was not registered on the agent runtime.");
  }
  if (typeof runtime.getServiceLoadPromise === "function") {
    await runtime.getServiceLoadPromise("hyperiaService");
  }
}

export function collectHyperiaLaunchDiagnostics(params: {
  requestedViewerAuth: boolean;
  runtime: HyperiaBridgeRuntimeLike | null;
  sessionFound: boolean;
  viewerAuthMessage: HyperiaViewerAuthMessage | null;
}): HyperiaLaunchDiagnostic[] {
  const diagnostics: HyperiaLaunchDiagnostic[] = [];
  const authToken = readRuntimeSetting(params.runtime, "HYPERIA_AUTH_TOKEN");
  const characterId = readRuntimeSetting(
    params.runtime,
    "HYPERIA_CHARACTER_ID",
  );

  if (params.requestedViewerAuth && !params.viewerAuthMessage) {
    const missing: string[] = [];
    if (!authToken) {
      missing.push("HYPERIA_AUTH_TOKEN");
    }
    if (!characterId) {
      missing.push("HYPERIA_CHARACTER_ID");
    }
    diagnostics.push({
      code: "hyperia-auth-unavailable",
      severity: "error",
      message:
        missing.length > 0
          ? `Hyperia auto-sign-in is unavailable because ${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} not configured for this agent.`
          : "Hyperia auto-sign-in is unavailable for this agent.",
    });
  }

  if (
    params.runtime &&
    !params.sessionFound &&
    !isHyperiaRuntimeReady(params.runtime)
  ) {
    diagnostics.push({
      code: "hyperia-runtime-bridge-inactive",
      severity: "warning",
      message:
        "The Hyperia runtime bridge is not active in this agent, so the host cannot attach to a live in-world session yet.",
    });
  }

  if (params.runtime && !params.sessionFound && characterId) {
    diagnostics.push({
      code: "hyperia-session-not-found",
      severity: "warning",
      message:
        "No live Hyperia session matched this agent. Start or reconnect the Hyperia agent in-world, then launch again.",
    });
  }

  return diagnostics;
}
