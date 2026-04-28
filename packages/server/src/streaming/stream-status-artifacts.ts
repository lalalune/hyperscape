import fs from "node:fs";
import path from "node:path";

export type HlsManifestSnapshot = {
  updatedAt: number | null;
  mediaSequence: number | null;
};

const HLS_MANIFEST_CACHE_TTL_MS = 250;

let cachedManifestPath: string | null = null;
let cachedManifestReadAt = 0;
let cachedManifestSnapshot: HlsManifestSnapshot | null = null;

function asNonEmptyString(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function resolveExternalStatusFile(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const explicit = asNonEmptyString(env.RTMP_STATUS_FILE);
  if (explicit) {
    return explicit;
  }

  const hlsOutputPath = asNonEmptyString(env.HLS_OUTPUT_PATH);
  if (!hlsOutputPath) {
    return null;
  }

  return path.join(path.dirname(hlsOutputPath), "rtmp-status.json");
}

export function readLocalHlsManifestSnapshot(
  env: NodeJS.ProcessEnv = process.env,
): HlsManifestSnapshot {
  const hlsOutputPath = asNonEmptyString(env.HLS_OUTPUT_PATH);
  if (!hlsOutputPath) {
    return {
      updatedAt: null,
      mediaSequence: null,
    };
  }

  if (
    cachedManifestPath === hlsOutputPath &&
    cachedManifestSnapshot &&
    Date.now() - cachedManifestReadAt <= HLS_MANIFEST_CACHE_TTL_MS
  ) {
    return cachedManifestSnapshot;
  }

  try {
    const stat = fs.statSync(hlsOutputPath);
    const rawManifest = fs.readFileSync(hlsOutputPath, "utf8");
    const mediaSequenceMatch = rawManifest.match(
      /#EXT-X-MEDIA-SEQUENCE:(\d+)/i,
    );
    const mediaSequence = mediaSequenceMatch
      ? Number.parseInt(mediaSequenceMatch[1] || "", 10)
      : null;

    const snapshot = {
      updatedAt: Number.isFinite(stat.mtimeMs)
        ? Math.round(stat.mtimeMs)
        : null,
      mediaSequence:
        mediaSequence != null && Number.isFinite(mediaSequence)
          ? mediaSequence
          : null,
    };
    cachedManifestPath = hlsOutputPath;
    cachedManifestReadAt = Date.now();
    cachedManifestSnapshot = snapshot;
    return snapshot;
  } catch {
    const snapshot = {
      updatedAt: null,
      mediaSequence: null,
    };
    cachedManifestPath = hlsOutputPath;
    cachedManifestReadAt = Date.now();
    cachedManifestSnapshot = snapshot;
    return snapshot;
  }
}
