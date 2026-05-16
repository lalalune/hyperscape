// @vitest-environment node
/**
 * `securityHeaders` — OWASP security-header constants tests.
 *
 * Pins the canonical header set so a future drift accidentally
 * loosening (e.g. dropping X-Frame-Options or relaxing CSP) is
 * caught by tests. The Elysia plugin itself is exercised by
 * integration tests; this file is the unit-level contract.
 */

import { describe, expect, it } from "vitest";

import { PRODUCTION_HEADERS, SECURITY_HEADERS } from "../securityHeaders";

// ============================================================================
// SECURITY_HEADERS — applied to every response
// ============================================================================

describe("SECURITY_HEADERS — clickjacking / MIME / XSS / referrer", () => {
  it("X-Frame-Options is DENY (blocks framing entirely)", () => {
    expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
  });

  it("X-Content-Type-Options is nosniff (prevents MIME sniffing)", () => {
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("X-XSS-Protection enables filter with block mode", () => {
    expect(SECURITY_HEADERS["X-XSS-Protection"]).toBe("1; mode=block");
  });

  it("Referrer-Policy is strict-origin-when-cross-origin", () => {
    expect(SECURITY_HEADERS["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
  });
});

describe("SECURITY_HEADERS — Permissions-Policy", () => {
  it("disables camera, microphone, geolocation, and payment", () => {
    const policy = SECURITY_HEADERS["Permissions-Policy"];
    expect(policy).toContain("camera=()");
    expect(policy).toContain("microphone=()");
    expect(policy).toContain("geolocation=()");
    expect(policy).toContain("payment=()");
  });
});

describe("SECURITY_HEADERS — Content-Security-Policy", () => {
  it("default-src is 'self' (locks every category not overridden)", () => {
    const csp = SECURITY_HEADERS["Content-Security-Policy"];
    expect(csp).toContain("default-src 'self'");
  });

  it("script-src allows self + unsafe-inline + unsafe-eval (required by Vite/HMR)", () => {
    const csp = SECURITY_HEADERS["Content-Security-Policy"];
    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
  });

  it("style-src allows self + unsafe-inline (styled-components inlines)", () => {
    const csp = SECURITY_HEADERS["Content-Security-Policy"];
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("img-src allows self + data + blob + https (avatars, asset URLs)", () => {
    const csp = SECURITY_HEADERS["Content-Security-Policy"];
    expect(csp).toContain("img-src 'self' data: blob: https:");
  });

  it("connect-src allows self + https + wss (game-server WebSocket)", () => {
    const csp = SECURITY_HEADERS["Content-Security-Policy"];
    expect(csp).toContain("connect-src 'self' https: wss:");
  });

  it("object-src is 'none' (blocks Flash / plugin embeds)", () => {
    const csp = SECURITY_HEADERS["Content-Security-Policy"];
    expect(csp).toContain("object-src 'none'");
  });

  it("base-uri is 'self' (prevents <base> injection redirects)", () => {
    const csp = SECURITY_HEADERS["Content-Security-Policy"];
    expect(csp).toContain("base-uri 'self'");
  });

  it("frame-ancestors is 'none' (modern CSP equivalent of X-Frame-Options)", () => {
    const csp = SECURITY_HEADERS["Content-Security-Policy"];
    expect(csp).toContain("frame-ancestors 'none'");
  });
});

// ============================================================================
// PRODUCTION_HEADERS — HSTS only
// ============================================================================

describe("PRODUCTION_HEADERS — production-only adds", () => {
  it("HSTS is the only production-only header", () => {
    expect(Object.keys(PRODUCTION_HEADERS)).toEqual([
      "Strict-Transport-Security",
    ]);
  });

  it("HSTS max-age is 1 year with includeSubDomains", () => {
    expect(PRODUCTION_HEADERS["Strict-Transport-Security"]).toBe(
      "max-age=31536000; includeSubDomains",
    );
  });

  it("PRODUCTION_HEADERS does NOT overlap with SECURITY_HEADERS (no duplicates)", () => {
    for (const key of Object.keys(PRODUCTION_HEADERS)) {
      expect(SECURITY_HEADERS[key]).toBeUndefined();
    }
  });
});

// ============================================================================
// SECURITY_HEADERS — shape invariants
// ============================================================================

describe("SECURITY_HEADERS — shape invariants", () => {
  it("every header key is a non-empty string", () => {
    for (const key of Object.keys(SECURITY_HEADERS)) {
      expect(key.length).toBeGreaterThan(0);
    }
  });

  it("every header value is a non-empty string", () => {
    for (const value of Object.values(SECURITY_HEADERS)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it("header names use PascalCase-with-dashes (the conventional form)", () => {
    for (const key of Object.keys(SECURITY_HEADERS)) {
      // Each dash-separated part starts with uppercase (e.g. X-Frame-Options).
      const parts = key.split("-");
      for (const part of parts) {
        expect(part[0]).toBe(part[0].toUpperCase());
      }
    }
  });
});
