/**
 * ImageHostingService Tests
 * Tests for image upload and hosting functionality
 */

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { ImageHostingService } from "./ImageHostingService";

describe("ImageHostingService", () => {
  let service: ImageHostingService;
  let originalImgurClientId: string | undefined;

  beforeEach(() => {
    // Save original env var
    originalImgurClientId = process.env.IMGUR_CLIENT_ID;
    service = new ImageHostingService();
  });

  afterEach(() => {
    // Restore original env var
    if (originalImgurClientId) {
      process.env.IMGUR_CLIENT_ID = originalImgurClientId;
    } else {
      delete process.env.IMGUR_CLIENT_ID;
    }
  });

  describe("Constructor", () => {
    it("should initialize with IMGUR_CLIENT_ID from environment", () => {
      process.env.IMGUR_CLIENT_ID = "test-client-id";
      const testService = new ImageHostingService();

      expect((testService as any).imgurClientId).toBe("test-client-id");
    });

    it("should initialize with null when IMGUR_CLIENT_ID not set", () => {
      delete process.env.IMGUR_CLIENT_ID;
      const testService = new ImageHostingService();

      expect((testService as any).imgurClientId).toBe(null);
    });
  });

  describe("uploadImage", () => {
    it("should return HTTP URL directly without uploading", async () => {
      const httpUrl = "https://example.com/image.png";

      const result = await service.uploadImage(httpUrl);

      expect(result).toBe(httpUrl);
    });

    it("should return data URI directly when small enough", async () => {
      const smallDataUri =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const result = await service.uploadImage(smallDataUri);

      expect(result).toBe(smallDataUri);
    });

    it("should throw error for large data URI without hosting service", async () => {
      delete process.env.IMGUR_CLIENT_ID;
      const largeService = new ImageHostingService();

      // Create large data URI (>5MB)
      const largeBase64 = "A".repeat(6000000);
      const largeDataUri = `data:image/png;base64,${largeBase64}`;

      expect(async () => {
        await largeService.uploadImage(largeDataUri);
      }).toThrow("Image too large");
    });

    it("should throw error when no hosting service configured for non-URL", async () => {
      delete process.env.IMGUR_CLIENT_ID;
      const noHostingService = new ImageHostingService();

      expect(async () => {
        await noHostingService.uploadImage("/local/path/image.png");
      }).toThrow("No public image hosting service configured");
    });

    it("should upload to Imgur when configured", async () => {
      process.env.IMGUR_CLIENT_ID = "test-imgur-id";
      const imgurService = new ImageHostingService();

      // Mock fetch for Imgur API
      const originalFetch = global.fetch;
      global.fetch = mock(async (url: any, options: any) => {
        if (url.includes("imgur.com")) {
          return {
            ok: true,
            json: async () => ({
              data: {
                link: "https://i.imgur.com/uploaded.png",
                id: "test-id",
                deletehash: "test-delete-hash",
              },
              success: true,
              status: 200,
            }),
          } as any;
        }
        return originalFetch(url, options);
      }) as any;

      try {
        const dataUri =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

        const result = await imgurService.uploadImage(dataUri);

        expect(result).toBe("https://i.imgur.com/uploaded.png");
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("uploadToImgur", () => {
    beforeEach(() => {
      process.env.IMGUR_CLIENT_ID = "test-client-id";
      service = new ImageHostingService();
    });

    it("should upload base64 image to Imgur", async () => {
      const originalFetch = global.fetch;
      global.fetch = mock(async (url: any, options: any) => {
        expect(url).toBe("https://api.imgur.com/3/image");
        expect(options.method).toBe("POST");
        expect(options.headers["Authorization"]).toBe(
          "Client-ID test-client-id",
        );

        return {
          ok: true,
          json: async () => ({
            data: {
              link: "https://i.imgur.com/abc123.png",
              id: "abc123",
              deletehash: "delete123",
            },
            success: true,
            status: 200,
          }),
        } as any;
      }) as any;

      try {
        const result = await service.uploadToImgur("iVBORw0KGgoAAAANSUhEUg==");

        expect(result).toBe("https://i.imgur.com/abc123.png");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("should extract base64 from data URI", async () => {
      const originalFetch = global.fetch;
      global.fetch = mock(async (url: any, options: any) => {
        const body = JSON.parse(options.body);
        expect(body.image).toBe("iVBORw0KGgoAAAANSUhEUg==");
        expect(body.type).toBe("base64");

        return {
          ok: true,
          json: async () => ({
            data: {
              link: "https://i.imgur.com/extracted.png",
              id: "extracted",
              deletehash: "delete-extracted",
            },
            success: true,
            status: 200,
          }),
        } as any;
      }) as any;

      try {
        const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
        const result = await service.uploadToImgur(dataUri);

        expect(result).toBe("https://i.imgur.com/extracted.png");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("should throw error on Imgur API failure", async () => {
      const originalFetch = global.fetch;
      global.fetch = mock(async () => ({
        ok: false,
        statusText: "Unauthorized",
      })) as any;

      try {
        expect(async () => {
          await service.uploadToImgur("test-data");
        }).toThrow("Imgur upload failed");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("should throw error on network failure", async () => {
      const originalFetch = global.fetch;
      global.fetch = mock(async () => {
        throw new Error("Network error");
      }) as any;

      try {
        expect(async () => {
          await service.uploadToImgur("test-data");
        }).toThrow("Network error");
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("getSetupInstructions", () => {
    it("should return setup instructions string", () => {
      const instructions = ImageHostingService.getSetupInstructions();

      expect(instructions).toContain("ngrok");
      expect(instructions).toContain("Imgur");
      expect(instructions).toContain("IMGUR_CLIENT_ID");
      expect(instructions).toContain("data URI");
    });

    it("should be a static method", () => {
      const instructions = ImageHostingService.getSetupInstructions();
      expect(typeof instructions).toBe("string");
      expect(instructions.length).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle empty string input", async () => {
      expect(async () => {
        await service.uploadImage("");
      }).toThrow();
    });

    it("should return malformed data URI directly when small", async () => {
      delete process.env.IMGUR_CLIENT_ID;
      const noHostingService = new ImageHostingService();

      // Small malformed data URIs are returned as-is (no validation)
      const result = await noHostingService.uploadImage("data:invalid");
      expect(result).toBe("data:invalid");
    });

    it("should handle fetch timeout gracefully", async () => {
      process.env.IMGUR_CLIENT_ID = "test-id";
      const timeoutService = new ImageHostingService();

      const originalFetch = global.fetch;
      global.fetch = mock(async () => {
        throw new Error("Timeout");
      }) as any;

      try {
        expect(async () => {
          await timeoutService.uploadToImgur("test-data");
        }).toThrow("Timeout");
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle workflow: data URI -> check size -> return directly", async () => {
      const smallImage = "data:image/png;base64," + "A".repeat(1000);

      const result = await service.uploadImage(smallImage);

      expect(result).toBe(smallImage);
    });

    it("should handle workflow: HTTP URL -> return directly", async () => {
      const url = "https://cdn.example.com/image.png";

      const result = await service.uploadImage(url);

      expect(result).toBe(url);
    });

    it("should handle workflow: large data URI -> upload to Imgur", async () => {
      process.env.IMGUR_CLIENT_ID = "test-id";
      const uploadService = new ImageHostingService();

      const originalFetch = global.fetch;
      global.fetch = mock(async () => ({
        ok: true,
        json: async () => ({
          data: {
            link: "https://i.imgur.com/large.png",
            id: "large",
            deletehash: "delete-large",
          },
        }),
      })) as any;

      try {
        // Create 6MB data URI
        const largeImage = "data:image/png;base64," + "A".repeat(6000000);

        const result = await uploadService.uploadImage(largeImage);

        expect(result).toBe("https://i.imgur.com/large.png");
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
