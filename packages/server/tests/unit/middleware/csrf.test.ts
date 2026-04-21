import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { shouldSkipCsrf } from "../../../src/middleware/csrf.js";

function request(headers: Record<string, string | undefined>): FastifyRequest {
  return {
    headers,
    method: "POST",
    url: "/api/state-changing",
  } as FastifyRequest;
}

describe("shouldSkipCsrf", () => {
  it("does not let forged authorization headers bypass CSRF on cookie requests", () => {
    expect(
      shouldSkipCsrf(
        request({
          authorization: "Bearer attacker-controlled",
          cookie: "session=ambient",
        }),
      ),
    ).toBe(false);
  });

  it("allows structured authorization headers for non-cookie API clients", () => {
    expect(
      shouldSkipCsrf(
        request({
          authorization: "Bearer service-token",
        }),
      ),
    ).toBe(true);
  });

  it("does not let forged admin-code headers bypass CSRF on cookie requests", () => {
    expect(
      shouldSkipCsrf(
        request({
          "x-admin-code": "operator-secret",
          cookie: "session=ambient",
        }),
      ),
    ).toBe(false);
  });

  it("does not trust non-TLS production origins", () => {
    expect(
      shouldSkipCsrf(
        request({
          origin: "http://hyperbet.win",
        }),
      ),
    ).toBe(false);
  });

  it("still trusts TLS production origins and local development origins", () => {
    expect(
      shouldSkipCsrf(
        request({
          origin: "https://hyperbet.win",
        }),
      ),
    ).toBe(true);
    expect(
      shouldSkipCsrf(
        request({
          origin: "http://localhost:5173",
        }),
      ),
    ).toBe(true);
  });
});
