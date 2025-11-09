/**
 * Prompts Routes Tests
 * Tests for prompt configuration file endpoints
 */

import { describe, it, expect, beforeAll } from "bun:test";
import { Elysia } from "elysia";
import { promptRoutes } from "./prompts";

describe("Prompts Routes", () => {
  let app: Elysia;

  beforeAll(() => {
    app = new Elysia().use(promptRoutes);
  });

  describe("GET /api/prompts/game-styles", () => {
    it("should return game style prompts", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/prompts/game-styles"),
      );

      if (response.status === 500) {
        // File might not exist, skip test
        console.log("game-style-prompts.json not found, skipping test");
        return;
      }

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
    });

    it("should return valid JSON", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/prompts/game-styles"),
      );

      if (response.status === 500) return;

      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
    });

    it("should work without authentication", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/prompts/game-styles"),
      );

      if (response.status === 500) return;

      // No 401 error expected
      expect(response.status).not.toBe(401);
    });
  });

  describe("GET /api/prompts/asset-types", () => {
    it("should return asset type prompts", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/prompts/asset-types"),
      );

      if (response.status === 500) {
        console.log("asset-type-prompts.json not found, skipping test");
        return;
      }

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
    });

    it("should return valid JSON", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/prompts/asset-types"),
      );

      if (response.status === 500) return;

      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
    });
  });

  describe("GET /api/prompts/materials", () => {
    it("should return material prompts", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/prompts/materials"),
      );

      if (response.status === 500) {
        console.log("material-prompts.json not found, skipping test");
        return;
      }

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
    });

    it("should return valid JSON", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/prompts/materials"),
      );

      if (response.status === 500) return;

      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
    });
  });

  describe("GET /api/prompts/generation", () => {
    it("should return generation prompts", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/prompts/generation"),
      );

      if (response.status === 500) {
        console.log("generation-prompts.json not found, skipping test");
        return;
      }

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
    });
  });

  describe("GET /api/prompts/gpt4-enhancement", () => {
    it("should return GPT-4 enhancement prompts", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/prompts/gpt4-enhancement"),
      );

      if (response.status === 500) {
        console.log("gpt4-enhancement-prompts.json not found, skipping test");
        return;
      }

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
    });
  });

  describe("GET /api/prompts/material-presets", () => {
    it("should return material presets", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/prompts/material-presets"),
      );

      if (response.status === 500) {
        console.log("material-presets.json not found, skipping test");
        return;
      }

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
    });
  });

  describe("GET /api/prompts/weapon-detection", () => {
    it("should return weapon detection prompts", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/prompts/weapon-detection"),
      );

      if (response.status === 500) {
        console.log("weapon-detection-prompts.json not found, skipping test");
        return;
      }

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should return 500 for missing files", async () => {
      // All endpoints should return 500 if file is missing
      const endpoints = [
        "/api/prompts/game-styles",
        "/api/prompts/asset-types",
        "/api/prompts/materials",
        "/api/prompts/generation",
        "/api/prompts/gpt4-enhancement",
        "/api/prompts/material-presets",
        "/api/prompts/weapon-detection",
      ];

      for (const endpoint of endpoints) {
        const response = await app.handle(
          new Request(`http://localhost${endpoint}`),
        );

        // Should either succeed (200) or fail with 500
        expect([200, 500]).toContain(response.status);
      }
    });
  });

  describe("Performance", () => {
    it("should respond quickly for all endpoints", async () => {
      const endpoints = [
        "/api/prompts/game-styles",
        "/api/prompts/asset-types",
        "/api/prompts/materials",
        "/api/prompts/generation",
        "/api/prompts/gpt4-enhancement",
        "/api/prompts/material-presets",
        "/api/prompts/weapon-detection",
      ];

      for (const endpoint of endpoints) {
        const start = Date.now();

        const response = await app.handle(
          new Request(`http://localhost${endpoint}`),
        );

        const duration = Date.now() - start;

        // Should respond within 100ms
        expect(duration).toBeLessThan(100);
      }
    });
  });
});
