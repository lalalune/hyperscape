import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  readLocalHlsManifestSnapshot,
  resolveExternalStatusFile,
} from "../../../src/streaming/stream-status-artifacts.js";

describe("stream-status-artifacts", () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("derives the external status file path from HLS_OUTPUT_PATH when unset", () => {
    expect(
      resolveExternalStatusFile({
        HLS_OUTPUT_PATH: "/tmp/hyperscape/live/stream.m3u8",
      } as NodeJS.ProcessEnv),
    ).toBe("/tmp/hyperscape/live/rtmp-status.json");
  });

  it("reads the local HLS manifest snapshot from disk", () => {
    tempDir = mkdtempSync(join(tmpdir(), "stream-status-artifacts-"));
    const manifestPath = join(tempDir, "stream.m3u8");
    writeFileSync(
      manifestPath,
      [
        "#EXTM3U",
        "#EXT-X-VERSION:6",
        "#EXT-X-MEDIA-SEQUENCE:177",
        "#EXTINF:2.000000,",
        "stream-177.ts",
      ].join("\n"),
    );

    const snapshot = readLocalHlsManifestSnapshot({
      HLS_OUTPUT_PATH: manifestPath,
    } as NodeJS.ProcessEnv);

    expect(snapshot.mediaSequence).toBe(177);
    expect(typeof snapshot.updatedAt).toBe("number");
    expect(snapshot.updatedAt).toBeGreaterThan(0);
    expect(dirname(resolveExternalStatusFile({
      HLS_OUTPUT_PATH: manifestPath,
    } as NodeJS.ProcessEnv) || "")).toBe(tempDir);
  });
});
