export type StreamIngestProfile = "default" | "cloudflare_live";
export type StreamIngestTransport = "rtmps" | "srt";

export type StreamIngestSettings = {
  profile: StreamIngestProfile;
  transport: StreamIngestTransport;
  audioSampleRate: number;
  gopFrames: number;
  probeOnly: boolean;
  srtUrl: string | null;
  srtStreamId: string | null;
  srtPassphrase: string | null;
};

function isValidUrl(value: string, allowedProtocols: string[]): boolean {
  try {
    const parsed = new URL(value);
    return allowedProtocols.includes(parsed.protocol);
  } catch {
    return false;
  }
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  minValue: number,
): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minValue, parsed);
}

function asNonEmptyString(value: string | undefined): string | null {
  const trimmed = value?.trim() || "";
  return trimmed.length > 0 ? trimmed : null;
}

function resolveConfiguredRtmpsIngestUrl(env: NodeJS.ProcessEnv): string | null {
  return (
    asNonEmptyString(env.STREAM_EXTERNAL_INGEST_RTMPS_URL) ??
    asNonEmptyString(env.STREAM_INGEST_RTMPS_URL)
  );
}

export function resolveStreamIngestSettings(
  env: NodeJS.ProcessEnv,
): StreamIngestSettings {
  const profile =
    env.STREAM_INGEST_PROFILE?.trim() === "cloudflare_live"
      ? "cloudflare_live"
      : "default";
  const transport =
    env.STREAM_INGEST_TRANSPORT?.trim().toLowerCase() === "srt"
      ? "srt"
      : "rtmps";
  const defaultFps = parsePositiveInt(env.STREAM_FPS, 30, 1);
  const defaultGopFrames =
    profile === "cloudflare_live"
      ? Math.max(2, defaultFps * 2)
      : parsePositiveInt(env.STREAM_GOP_SIZE, defaultFps, 1);
  const gopFrames = parsePositiveInt(
    env.STREAM_GOP_SIZE,
    defaultGopFrames,
    1,
  );
  const audioSampleRate = parsePositiveInt(
    env.STREAM_AUDIO_SAMPLE_RATE,
    profile === "cloudflare_live" ? 48_000 : 44_100,
    8_000,
  );

  return {
    profile,
    transport,
    audioSampleRate,
    gopFrames,
    probeOnly: parseBoolean(env.STREAM_CLOUDFLARE_PROBE_ONLY, false),
    srtUrl: asNonEmptyString(env.STREAM_INGEST_SRT_URL),
    srtStreamId: asNonEmptyString(env.STREAM_INGEST_SRT_STREAM_ID),
    srtPassphrase: asNonEmptyString(env.STREAM_INGEST_SRT_PASSPHRASE),
  };
}

export function validateStreamIngestSettings(
  env: NodeJS.ProcessEnv,
  settings: StreamIngestSettings = resolveStreamIngestSettings(env),
): string[] {
  const issues: string[] = [];
  const deliveryMode = env.STREAM_DELIVERY_MODE?.trim().toLowerCase() ?? "self_hls";
  const externalDeliveryEnabled =
    deliveryMode === "external_hls" || settings.probeOnly === true;

  if (!externalDeliveryEnabled) {
    return issues;
  }

  if (settings.transport === "srt") {
    if (!settings.srtUrl) {
      issues.push("STREAM_INGEST_SRT_URL is required when STREAM_INGEST_TRANSPORT=srt");
    } else if (!isValidUrl(settings.srtUrl, ["srt:"])) {
      issues.push("STREAM_INGEST_SRT_URL must be a valid srt:// URL");
    }

    if (!settings.srtStreamId) {
      issues.push("STREAM_INGEST_SRT_STREAM_ID is required when STREAM_INGEST_TRANSPORT=srt");
    }

    if (!settings.srtPassphrase) {
      issues.push("STREAM_INGEST_SRT_PASSPHRASE is required when STREAM_INGEST_TRANSPORT=srt");
    } else if (settings.srtPassphrase.length < 10) {
      issues.push("STREAM_INGEST_SRT_PASSPHRASE must be at least 10 characters");
    }

    return issues;
  }

  const rtmpsUrl = resolveConfiguredRtmpsIngestUrl(env);
  if (!rtmpsUrl) {
    issues.push(
      "STREAM_INGEST_RTMPS_URL or STREAM_EXTERNAL_INGEST_RTMPS_URL is required when STREAM_INGEST_TRANSPORT=rtmps",
    );
  } else if (!isValidUrl(rtmpsUrl, ["rtmp:", "rtmps:"])) {
    issues.push(
      "STREAM_INGEST_RTMPS_URL or STREAM_EXTERNAL_INGEST_RTMPS_URL must be a valid rtmp:// or rtmps:// URL",
    );
  }

  const streamKey = asNonEmptyString(env.STREAM_INGEST_STREAM_KEY);
  if (!streamKey) {
    issues.push("STREAM_INGEST_STREAM_KEY is required when STREAM_INGEST_TRANSPORT=rtmps");
  }

  return issues;
}

export function assertValidStreamIngestSettings(
  env: NodeJS.ProcessEnv,
  settings?: StreamIngestSettings,
): StreamIngestSettings {
  const resolvedSettings = settings ?? resolveStreamIngestSettings(env);
  const issues = validateStreamIngestSettings(env, resolvedSettings);
  if (issues.length > 0) {
    throw new Error(`Invalid stream ingest configuration: ${issues.join("; ")}`);
  }
  return resolvedSettings;
}
