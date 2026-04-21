import { describe, expect, it } from "vitest";

import {
  isStreamDestinationEnabled,
  resolveEnabledStreamDestinations,
} from "./stream-destinations.js";

describe("stream destination selection", () => {
  it("keeps destinations enabled by default for backwards compatibility", () => {
    const enabledDestinations = resolveEnabledStreamDestinations(undefined);

    expect(isStreamDestinationEnabled(enabledDestinations, "external")).toBe(
      true,
    );
    expect(isStreamDestinationEnabled(enabledDestinations, "twitch")).toBe(
      true,
    );
  });

  it("allows self-HLS-only staging to disable external delivery", () => {
    const enabledDestinations = resolveEnabledStreamDestinations("self_hls");

    expect(isStreamDestinationEnabled(enabledDestinations, "external")).toBe(
      false,
    );
    expect(isStreamDestinationEnabled(enabledDestinations, "twitch")).toBe(
      false,
    );
  });

  it("recognizes Cloudflare as the external delivery destination", () => {
    const enabledDestinations = resolveEnabledStreamDestinations("cloudflare");

    expect(isStreamDestinationEnabled(enabledDestinations, "external")).toBe(
      true,
    );
    expect(isStreamDestinationEnabled(enabledDestinations, "twitch")).toBe(
      false,
    );
  });
});
