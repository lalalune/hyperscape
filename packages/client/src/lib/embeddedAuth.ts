import type { EmbeddedViewportConfig } from "../types/embeddedConfig";

type ParsedHyperiaAuthMessage = {
  authToken: string;
  sessionToken?: string;
  agentId?: string;
  characterId?: string;
  followEntity?: string;
};

function normalizeString(
  value: unknown,
  maxLength: number,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    return undefined;
  }
  return normalized;
}

function extractOrigin(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function normalizeTrustedOrigin(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized || normalized === "*" || normalized === "null") {
    return null;
  }

  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    if (url.pathname !== "/" || url.search || url.hash) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function resolveTrustedEmbedOrigins(params: {
  currentOrigin: string;
  publicAppUrl?: string | null;
  embedAllowedOrigins?: string | null;
}): string[] {
  const trustedOrigins = new Set<string>();
  const currentOrigin = normalizeTrustedOrigin(params.currentOrigin);
  if (currentOrigin) {
    trustedOrigins.add(currentOrigin);
  }

  const publicAppOrigin = extractOrigin(params.publicAppUrl);
  if (publicAppOrigin) {
    trustedOrigins.add(publicAppOrigin);
  }

  for (const candidate of (params.embedAllowedOrigins || "").split(",")) {
    const normalizedOrigin = normalizeTrustedOrigin(candidate);
    if (normalizedOrigin) {
      trustedOrigins.add(normalizedOrigin);
    }
  }

  return [...trustedOrigins];
}

export function isTrustedEmbedOrigin(
  eventOrigin: string,
  trustedOrigins: readonly string[],
): boolean {
  return trustedOrigins.includes(eventOrigin);
}

export function resolveEmbedReadyTargetOrigin(params: {
  currentOrigin: string;
  trustedOrigins: readonly string[];
  referrer?: string | null;
  allowWildcardFallback?: boolean;
}): string | null {
  const referrerOrigin = extractOrigin(params.referrer);
  if (referrerOrigin && params.trustedOrigins.includes(referrerOrigin)) {
    return referrerOrigin;
  }

  const nonCurrentOrigins = params.trustedOrigins.filter(
    (origin) => origin !== params.currentOrigin,
  );
  if (
    nonCurrentOrigins.length === 0 &&
    params.trustedOrigins.includes(params.currentOrigin)
  ) {
    return params.currentOrigin;
  }
  if (nonCurrentOrigins.length === 1) {
    return nonCurrentOrigins[0] ?? null;
  }

  return params.allowWildcardFallback ? "*" : null;
}

export function parseHyperiaAuthMessage(
  data: unknown,
): ParsedHyperiaAuthMessage | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  if (record.type !== "HYPERIA_AUTH") {
    return null;
  }

  const authToken = normalizeString(record.authToken, 8_192);
  if (!authToken) {
    return null;
  }

  return {
    authToken,
    sessionToken: normalizeString(record.sessionToken, 256),
    agentId: normalizeString(record.agentId, 64),
    characterId: normalizeString(record.characterId, 64),
    followEntity: normalizeString(record.followEntity, 64),
  };
}

export function applyHyperiaAuthMessage(
  config: EmbeddedViewportConfig,
  message: ParsedHyperiaAuthMessage,
): void {
  config.authToken = message.authToken;
  if (message.sessionToken) {
    config.sessionToken = message.sessionToken;
  }
  if (message.agentId) {
    config.agentId = message.agentId;
  }
  if (message.characterId) {
    config.characterId = message.characterId;
    if (!config.followEntity) {
      config.followEntity = message.characterId;
    }
  }
  if (message.followEntity) {
    config.followEntity = message.followEntity;
  }
}
