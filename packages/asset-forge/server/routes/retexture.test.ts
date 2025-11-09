/**
 * Retexture Routes Tests
 * Tests for retexturing and base model regeneration endpoints
 */

import { describe, it, expect, beforeAll } from "bun:test";
import { Elysia } from "elysia";
import { createRetextureRoutes } from "./retexture";

// Mock RetextureService
const mockRetextureService = {
  retexture: async (config: any) => {
    return {
      success: true,
      assetId: `variant-${Date.now()}`,
      url: `/gdd-assets/variant-${Date.now()}/model.glb`,
      message: "Retexture task initiated successfully",
    };
  },
  regenerateBase: async (config: any) => {
    return {
      success: true,
      assetId: `regenerated-${Date.now()}`,
      url: `/gdd-assets/regenerated-${Date.now()}/model.glb`,
      message: "Base model regeneration initiated",
    };
  },
};

describe("Retexture Routes", () => {
  let app: Elysia;
  const testRootDir = "/tmp/asset-forge-test";

  beforeAll(() => {
    app = new Elysia().use(
      createRetextureRoutes(testRootDir, mockRetextureService as any),
    );
  });

  describe("POST /api/retexture", () => {
    it("should initiate retexture task with valid config", async () => {
      const config = {
        baseAssetId: "test-asset-123",
        materialPreset: {
          id: "gold",
          displayName: "Gold",
          stylePrompt: "shiny gold material",
          tier: 3,
        },
        outputName: "Golden Sword",
      };

      const response = await app.handle(
        new Request("http://localhost/api/retexture", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.assetId).toBeDefined();
      expect(data.url).toBeDefined();
      expect(data.message).toBeDefined();
    });

    it("should work without authentication (optional auth)", async () => {
      const config = {
        baseAssetId: "test-asset-public",
        materialPreset: {
          id: "silver",
          displayName: "Silver",
          stylePrompt: "silver metallic finish",
        },
      };

      const response = await app.handle(
        new Request("http://localhost/api/retexture", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        }),
      );

      expect(response.status).toBe(200);
    });

    it("should work with authenticated user", async () => {
      const appWithAuth = new Elysia()
        .derive(() => ({
          user: {
            id: "user-123",
            privyId: "privy-user-123",
            walletAddress: "0xABC",
          },
        }))
        .use(createRetextureRoutes(testRootDir, mockRetextureService as any));

      const config = {
        baseAssetId: "test-asset-auth",
        materialPreset: {
          id: "bronze",
          displayName: "Bronze",
          stylePrompt: "bronze aged metal",
        },
        outputName: "Bronze Blade",
      };

      const response = await appWithAuth.handle(
        new Request("http://localhost/api/retexture", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        }),
      );

      expect(response.status).toBe(200);
    });

    it("should reject missing baseAssetId", async () => {
      const config = {
        materialPreset: {
          id: "gold",
          displayName: "Gold",
          stylePrompt: "gold material",
        },
      };

      const response = await app.handle(
        new Request("http://localhost/api/retexture", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        }),
      );

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should reject missing materialPreset", async () => {
      const config = {
        baseAssetId: "test-asset-123",
        outputName: "Test Output",
      };

      const response = await app.handle(
        new Request("http://localhost/api/retexture", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        }),
      );

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should reject empty baseAssetId", async () => {
      const config = {
        baseAssetId: "",
        materialPreset: {
          id: "gold",
          displayName: "Gold",
          stylePrompt: "gold",
        },
      };

      const response = await app.handle(
        new Request("http://localhost/api/retexture", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        }),
      );

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should validate materialPreset structure", async () => {
      const config = {
        baseAssetId: "test-asset-123",
        materialPreset: {
          id: "gold",
          // Missing displayName and stylePrompt
        },
      };

      const response = await app.handle(
        new Request("http://localhost/api/retexture", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        }),
      );

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should handle all material preset fields", async () => {
      const config = {
        baseAssetId: "test-asset-full",
        materialPreset: {
          id: "mythril",
          name: "mythril-preset",
          displayName: "Mythril",
          stylePrompt: "mythril fantasy metal",
          description: "Legendary blue metal",
          category: "legendary",
          tier: 5,
          color: "#4A90E2",
        },
        outputName: "Mythril Weapon",
      };

      const response = await app.handle(
        new Request("http://localhost/api/retexture", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        }),
      );

      expect(response.status).toBe(200);
    });

    it("should handle malformed JSON", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/retexture", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: "{invalid json",
        }),
      );

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should handle service errors gracefully", async () => {
      const errorService = {
        retexture: async () => {
          throw new Error("Meshy API unavailable");
        },
        regenerateBase: async () => {
          return {
            success: true,
            assetId: "test",
            url: "/test",
            message: "ok",
          };
        },
      };

      const errorApp = new Elysia().use(
        createRetextureRoutes(testRootDir, errorService as any),
      );

      const config = {
        baseAssetId: "test-asset-error",
        materialPreset: {
          id: "gold",
          displayName: "Gold",
          stylePrompt: "gold",
        },
      };

      const response = await errorApp.handle(
        new Request("http://localhost/api/retexture", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        }),
      );

      expect(response.status).toBeGreaterThanOrEqual(500);
    });
  });

  describe("POST /api/regenerate-base/:baseAssetId", () => {
    it("should initiate base model regeneration", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/regenerate-base/test-asset-123", {
          method: "POST",
        }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.assetId).toBeDefined();
      expect(data.url).toBeDefined();
      expect(data.message).toBeDefined();
    });

    it("should work without authentication", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/regenerate-base/public-asset", {
          method: "POST",
        }),
      );

      expect(response.status).toBe(200);
    });

    it("should reject empty baseAssetId", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/regenerate-base/", {
          method: "POST",
        }),
      );

      // Should either be 404 (route not found) or 400 (validation error)
      expect([400, 404]).toContain(response.status);
    });

    it("should handle service errors", async () => {
      const errorService = {
        retexture: async () => {
          return {
            success: true,
            assetId: "test",
            url: "/test",
            message: "ok",
          };
        },
        regenerateBase: async () => {
          throw new Error("Regeneration failed");
        },
      };

      const errorApp = new Elysia().use(
        createRetextureRoutes(testRootDir, errorService as any),
      );

      const response = await errorApp.handle(
        new Request("http://localhost/api/regenerate-base/test-asset-error", {
          method: "POST",
        }),
      );

      expect(response.status).toBeGreaterThanOrEqual(500);
    });

    it("should handle various asset ID formats", async () => {
      const assetIds = [
        "simple-id",
        "uuid-like-00000000-0000-0000-0000-000000000000",
        "with_underscore",
        "with-dashes-123",
      ];

      for (const assetId of assetIds) {
        const response = await app.handle(
          new Request(`http://localhost/api/regenerate-base/${assetId}`, {
            method: "POST",
          }),
        );

        expect(response.status).toBe(200);
      }
    });
  });

  describe("Response Validation", () => {
    it("should return correct response structure for retexture", async () => {
      const config = {
        baseAssetId: "test-validation",
        materialPreset: {
          id: "test",
          displayName: "Test",
          stylePrompt: "test material",
        },
      };

      const response = await app.handle(
        new Request("http://localhost/api/retexture", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty("success");
      expect(data).toHaveProperty("assetId");
      expect(data).toHaveProperty("url");
      expect(data).toHaveProperty("message");
      expect(typeof data.success).toBe("boolean");
      expect(typeof data.assetId).toBe("string");
      expect(typeof data.url).toBe("string");
      expect(typeof data.message).toBe("string");
    });

    it("should return correct response structure for regenerate", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/regenerate-base/test-validation", {
          method: "POST",
        }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty("success");
      expect(data).toHaveProperty("assetId");
      expect(data).toHaveProperty("url");
      expect(data).toHaveProperty("message");
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long baseAssetId", async () => {
      const longId = "a".repeat(1000);

      const response = await app.handle(
        new Request(`http://localhost/api/regenerate-base/${longId}`, {
          method: "POST",
        }),
      );

      // Should handle gracefully (either succeed or reject)
      expect([200, 400, 414]).toContain(response.status);
    });

    it("should handle special characters in baseAssetId", async () => {
      const specialChars = ["test@asset", "test asset", "test/asset"];

      for (const id of specialChars) {
        const encoded = encodeURIComponent(id);
        const response = await app.handle(
          new Request(`http://localhost/api/regenerate-base/${encoded}`, {
            method: "POST",
          }),
        );

        // URL encoding should handle this
        expect([200, 400]).toContain(response.status);
      }
    });

    it("should handle missing Content-Type header", async () => {
      const config = {
        baseAssetId: "test-no-content-type",
        materialPreset: {
          id: "test",
          displayName: "Test",
          stylePrompt: "test",
        },
      };

      const response = await app.handle(
        new Request("http://localhost/api/retexture", {
          method: "POST",
          body: JSON.stringify(config),
        }),
      );

      // Elysia should handle gracefully
      expect([200, 400, 415, 422]).toContain(response.status);
    });

    it("should handle very long stylePrompt", async () => {
      const config = {
        baseAssetId: "test-long-prompt",
        materialPreset: {
          id: "test",
          displayName: "Test",
          stylePrompt: "a".repeat(5000),
        },
      };

      const response = await app.handle(
        new Request("http://localhost/api/retexture", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        }),
      );

      // Should handle or reject based on validation
      expect([200, 400]).toContain(response.status);
    });

    it("should handle numeric tier values", async () => {
      const config = {
        baseAssetId: "test-numeric-tier",
        materialPreset: {
          id: "test",
          displayName: "Test",
          stylePrompt: "test",
          tier: 5,
        },
      };

      const response = await app.handle(
        new Request("http://localhost/api/retexture", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        }),
      );

      expect(response.status).toBe(200);
    });

    it("should handle string tier values", async () => {
      const config = {
        baseAssetId: "test-string-tier",
        materialPreset: {
          id: "test",
          displayName: "Test",
          stylePrompt: "test",
          tier: "legendary",
        },
      };

      const response = await app.handle(
        new Request("http://localhost/api/retexture", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        }),
      );

      expect(response.status).toBe(200);
    });
  });
});
