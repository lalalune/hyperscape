/**
 * Health Routes Tests
 * Tests for health check endpoint
 */

import { describe, it, expect, beforeAll } from "bun:test";
import { Elysia } from "elysia";
import { healthRoutes } from "./health";

describe("Health Routes", () => {
  let app: Elysia;

  beforeAll(() => {
    app = new Elysia().use(healthRoutes);
  });

  describe("GET /api/health", () => {
    it("should return healthy status with timestamp", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/health"),
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.status).toBe("healthy");
      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe("string");

      // Validate timestamp is valid ISO string
      const timestamp = new Date(data.timestamp);
      expect(timestamp.toString()).not.toBe("Invalid Date");
    });

    it("should report service availability based on environment variables", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/health"),
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.services).toBeDefined();
      expect(typeof data.services.meshy).toBe("boolean");
      expect(typeof data.services.openai).toBe("boolean");

      // Verify against actual environment
      expect(data.services.meshy).toBe(!!process.env.MESHY_API_KEY);
      expect(data.services.openai).toBe(!!process.env.OPENAI_API_KEY);
    });

    it("should work without authentication", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/health"),
      );

      expect(response.status).toBe(200);
      // No 401 error expected
    });

    it("should return correct content type", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/health"),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
    });

    it("should return status within 100ms", async () => {
      const start = Date.now();

      const response = await app.handle(
        new Request("http://localhost/api/health"),
      );

      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(100);
    });
  });
});
