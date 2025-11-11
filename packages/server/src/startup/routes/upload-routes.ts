/**
 * Upload Routes Module - File upload handling
 *
 * Handles file uploads from clients including validation, hashing,
 * and storage in the assets directory.
 *
 * Endpoints:
 * - POST /api/upload - Upload a file (multipart/form-data)
 * - GET /api/upload-check - Check if a file exists
 *
 * Features:
 * - Content-based hashing (same file = same hash)
 * - Automatic deduplication
 * - Extension validation
 * - Configurable storage directory
 *
 * Usage:
 * ```typescript
 * import { registerUploadRoutes } from './routes/upload-routes';
 * registerUploadRoutes(fastify, config);
 * ```
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import fs from "fs-extra";
import path from "path";
import { hashFile } from "../../utils.js";
import type { ServerConfig } from "../config.js";

/**
 * Register upload endpoints
 *
 * Sets up endpoints for file uploads and existence checks.
 * Files are hashed and stored in the assets directory with
 * content-based filenames for automatic deduplication.
 *
 * @param fastify - Fastify server instance
 * @param config - Server configuration
 */
export function registerUploadRoutes(
  fastify: FastifyInstance,
  config: ServerConfig,
): void {
  // File upload endpoint
  fastify.post("/api/upload", async (req, _reply) => {
    const file = await req.file();
    if (!file) {
      throw new Error("No file uploaded");
    }

    const ext = file.filename.split(".").pop()?.toLowerCase();
    if (!ext) {
      throw new Error("Invalid filename");
    }

    // Create temp buffer to store contents
    const chunks: Buffer[] = [];
    for await (const chunk of file.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Hash from buffer
    const hash = await hashFile(buffer);
    const filename = `${hash}.${ext}`;

    // Save to fs
    const filePath = path.join(config.assetsDir, filename);
    const exists = await fs.pathExists(filePath);
    if (!exists) {
      await fs.writeFile(filePath, buffer);
    }

    return { filename, exists };
  });

  // Check if file exists
  fastify.get("/api/upload-check", async (req: FastifyRequest, _reply) => {
    const filename = (req.query as { filename: string }).filename;
    const filePath = path.join(config.assetsDir, filename);
    const exists = await fs.pathExists(filePath);
    return { exists };
  });
}
