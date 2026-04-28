import { describe, expect, it } from "vitest";
import { __hlsCdnSyncTestInternals as internals } from "../../../src/streaming/hls-cdn-sync.js";

describe("hls-cdn-sync SigV4 signing", () => {
  it("builds a deterministic AWS SigV4 PUT signature for HLS playlists", () => {
    const signed = internals.signS3PutRequest({
      endpoint: "https://example.r2.cloudflarestorage.com",
      bucket: "arena",
      key: "live/hls.m3u8",
      body: Buffer.from("#EXTM3U\n"),
      contentType: "application/vnd.apple.mpegurl",
      accessKeyId: "AKIDEXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
      region: "auto",
      now: new Date("2026-04-20T12:34:56.000Z"),
    });

    expect(signed.url).toBe(
      "https://example.r2.cloudflarestorage.com/arena/live/hls.m3u8",
    );
    expect(signed.headers["x-amz-date"]).toBe("20260420T123456Z");
    expect(signed.headers["x-amz-content-sha256"]).toBe(
      "144659b48f342d02b9298907ab32fcf0479ac9c99a0d293c7c2ebf8df313dd12",
    );
    expect(signed.headers.Authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20260420/auto/s3/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=49bcfb5d59481866e4b283957ff232948007487eaa367cb331e93dd0ecd942f5",
    );
    expect(signed.headers["Cache-Control"]).toBe(
      "no-cache, no-store, must-revalidate",
    );
  });

  it("marks immutable cache headers for media segments", () => {
    const signed = internals.signS3PutRequest({
      endpoint: "https://example.r2.cloudflarestorage.com",
      bucket: "arena",
      key: "live/seg-1.ts",
      body: Buffer.from("segment"),
      contentType: "video/mp2t",
      accessKeyId: "AKIDEXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
      region: "auto",
      now: new Date("2026-04-20T12:34:56.000Z"),
    });

    expect(signed.headers["Cache-Control"]).toBe(
      "public, max-age=31536000, immutable",
    );
  });
});
