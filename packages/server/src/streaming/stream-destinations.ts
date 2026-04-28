export type StreamDestinationKind =
  | "custom"
  | "external"
  | "kick"
  | "multiplexer"
  | "pumpfun"
  | "twitch"
  | "x"
  | "youtube";

const DESTINATION_ALIASES: Record<string, StreamDestinationKind> = {
  cloudflare: "external",
  cloudflarelive: "external",
  cloudflarestream: "external",
  custom: "custom",
  external: "external",
  externaldelivery: "external",
  kick: "kick",
  multiplexer: "multiplexer",
  pump: "pumpfun",
  pumpfun: "pumpfun",
  restream: "multiplexer",
  rtmps: "multiplexer",
  twitch: "twitch",
  twitter: "x",
  x: "x",
  xtwitter: "x",
  youtube: "youtube",
};

export function resolveEnabledStreamDestinations(
  rawValue: string | undefined,
): Set<StreamDestinationKind> | null {
  if (!rawValue) return null;

  const normalized = rawValue.trim().toLowerCase();
  if (!normalized || normalized === "all" || normalized === "*") {
    return null;
  }

  const enabled = new Set<StreamDestinationKind>();
  for (const token of normalized.split(",")) {
    const compact = token.replace(/[^a-z]/g, "");
    const destination =
      DESTINATION_ALIASES[token.trim()] || DESTINATION_ALIASES[compact];
    if (destination) {
      enabled.add(destination);
    }
  }

  return enabled;
}

export function isStreamDestinationEnabled(
  enabledDestinations: Set<StreamDestinationKind> | null,
  destination: StreamDestinationKind,
): boolean {
  return enabledDestinations === null || enabledDestinations.has(destination);
}
