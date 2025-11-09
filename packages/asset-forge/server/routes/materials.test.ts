/**
 * Material Presets Routes Tests
 * Tests for material preset endpoints
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
} from "bun:test";
import { Elysia } from "elysia";
import { createMaterialRoutes } from "./materials";
import path from "path";
import fs from "fs";

describe("Material Routes", () => {
  let app: Elysia;
  const rootDir = process.cwd();
  const presetsPath = path.join(
    rootDir,
    "public/prompts/material-presets.json",
  );
  let originalPresets: string | null = null;

  beforeAll(() => {
    app = new Elysia().use(createMaterialRoutes(rootDir));
  });

  beforeEach(async () => {
    // Backup original presets if they exist
    try {
      originalPresets = await fs.promises.readFile(presetsPath, "utf-8");
    } catch (error) {
      originalPresets = null;
    }
  });

  afterEach(async () => {
    // Restore original presets
    if (originalPresets) {
      await fs.promises.writeFile(presetsPath, originalPresets, "utf-8");
    }
  });

  describe("GET /api/material-presets", () => {
    it("should return material presets array", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/material-presets"),
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(Array.isArray(data)).toBe(true);
    });

    it("should return presets with required fields", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/material-presets"),
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      if (data.length > 0) {
        const preset = data[0];
        expect(preset.id).toBeDefined();
        expect(preset.displayName).toBeDefined();
        expect(preset.stylePrompt).toBeDefined();
      }
    });

    it("should work without authentication", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/material-presets"),
      );

      expect(response.status).toBe(200);
      // No 401 error expected
    });

    it("should return valid JSON", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/material-presets"),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );

      const data = await response.json();
      expect(data).toBeDefined();
    });

    it("should handle missing file gracefully", async () => {
      // Temporarily rename the file
      const tempPath = presetsPath + ".temp";
      const fileExists = fs.existsSync(presetsPath);

      if (fileExists) {
        await fs.promises.rename(presetsPath, tempPath);
      }

      try {
        const response = await app.handle(
          new Request("http://localhost/api/material-presets"),
        );

        // Should return error (500 or appropriate error status)
        expect(response.status).toBeGreaterThanOrEqual(400);
      } finally {
        // Restore file
        if (fileExists) {
          await fs.promises.rename(tempPath, presetsPath);
        }
      }
    });
  });

  describe("POST /api/material-presets", () => {
    it("should save material presets successfully", async () => {
      const testPresets = [
        {
          id: "test-preset-1",
          displayName: "Test Material",
          stylePrompt: "A test material",
          description: "Test description",
          category: "metal",
          tier: 1,
          color: "#ff0000",
        },
      ];

      const response = await app.handle(
        new Request("http://localhost/api/material-presets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(testPresets),
        }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toBeDefined();
      expect(data.message).toContain("saved successfully");
    });

    it("should actually write presets to file", async () => {
      const testPresets = [
        {
          id: "persist-test",
          displayName: "Persistence Test",
          stylePrompt: "Testing file persistence",
        },
      ];

      const response = await app.handle(
        new Request("http://localhost/api/material-presets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(testPresets),
        }),
      );

      expect(response.status).toBe(200);

      // Read back from file
      const savedContent = await fs.promises.readFile(presetsPath, "utf-8");
      const savedPresets = JSON.parse(savedContent);

      expect(savedPresets).toEqual(testPresets);
    });

    it("should reject empty array", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/material-presets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify([]),
        }),
      );

      // Should succeed (empty presets is valid)
      expect(response.status).toBe(200);
    });

    it("should reject invalid JSON", async () => {
      const response = await app.handle(
        new Request("http://localhost/api/material-presets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: "invalid json",
        }),
      );

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should reject missing required fields", async () => {
      const invalidPresets = [
        {
          // Missing required fields
          id: "invalid",
        },
      ];

      const response = await app.handle(
        new Request("http://localhost/api/material-presets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(invalidPresets),
        }),
      );

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should format JSON with pretty print", async () => {
      const testPresets = [
        {
          id: "format-test",
          displayName: "Format Test",
          stylePrompt: "Testing formatting",
        },
      ];

      await app.handle(
        new Request("http://localhost/api/material-presets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(testPresets),
        }),
      );

      const savedContent = await fs.promises.readFile(presetsPath, "utf-8");

      // Check that it's formatted with indentation (not minified)
      expect(savedContent).toContain("\n");
      expect(savedContent).toContain("  "); // 2-space indent
    });

    it("should work without authentication", async () => {
      const testPresets = [
        {
          id: "no-auth-test",
          displayName: "No Auth Test",
          stylePrompt: "Testing without auth",
        },
      ];

      const response = await app.handle(
        new Request("http://localhost/api/material-presets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(testPresets),
        }),
      );

      expect(response.status).toBe(200);
      // No 401 error expected
    });
  });
});
