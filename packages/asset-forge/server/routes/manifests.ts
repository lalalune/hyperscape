/**
 * Manifest Routes
 * API endpoints for reading and writing game manifest JSON files
 *
 * Endpoints:
 * - GET /api/manifests - List all manifests
 * - GET /api/manifests/:name - Get manifest content
 * - PUT /api/manifests/:name - Update manifest content
 * - POST /api/manifests/:name/validate - Validate content without saving
 * - GET /api/manifests/:name/backups - List backups
 * - POST /api/manifests/:name/restore - Restore from backup
 */

import { Elysia, t } from "elysia";
import type { ManifestService } from "../services/ManifestService";
import * as Models from "../models";

export const createManifestRoutes = (manifestService: ManifestService) => {
  return new Elysia({ prefix: "/api/manifests", name: "manifests" }).guard(
    {
      beforeHandle: ({ request }) => {
        console.log(
          `[Manifests] ${request.method} ${new URL(request.url).pathname}`,
        );
      },
    },
    (app) =>
      app
        // List all manifests
        .get(
          "",
          async () => {
            const manifests = await manifestService.listManifests();
            return manifests;
          },
          {
            response: Models.ManifestListResponse,
            detail: {
              tags: ["Manifests"],
              summary: "List all manifests",
              description:
                "Returns a list of all game manifest files with metadata including name, description, category, and modification time.",
            },
          },
        )

        // Get manifest content
        .get(
          "/:name",
          async ({ params: { name }, set }) => {
            const info = manifestService.getManifestInfo(name);
            if (!info) {
              set.status = 404;
              return { error: `Unknown manifest: ${name}` };
            }

            try {
              const manifest = await manifestService.readManifest(name);
              return manifest;
            } catch (error) {
              const message =
                error instanceof Error ? error.message : String(error);
              console.error(`[Manifests] Failed to read ${name}:`, message);
              set.status = 404;
              return { error: message };
            }
          },
          {
            params: t.Object({
              name: t.String({ minLength: 1 }),
            }),
            response: {
              200: Models.ManifestContent,
              404: Models.ErrorResponse,
            },
            detail: {
              tags: ["Manifests"],
              summary: "Get manifest content",
              description: "Returns the full content of a manifest file.",
            },
          },
        )

        // Update manifest content
        .put(
          "/:name",
          async ({ params: { name }, body, set }) => {
            const info = manifestService.getManifestInfo(name);
            if (!info) {
              set.status = 404;
              return { error: `Unknown manifest: ${name}` };
            }

            if (!info.editable) {
              set.status = 403;
              return { error: `Manifest ${name} is not editable` };
            }

            const result = await manifestService.writeManifest(
              name,
              body.content,
            );
            return result;
          },
          {
            params: t.Object({
              name: t.String({ minLength: 1 }),
            }),
            body: Models.ManifestWriteRequest,
            response: {
              200: Models.ManifestWriteResponse,
              400: Models.ErrorResponse,
              403: Models.ErrorResponse,
              404: Models.ErrorResponse,
            },
            detail: {
              tags: ["Manifests"],
              summary: "Update manifest content",
              description:
                "Updates a manifest file with new content. Creates a backup before writing. Validates content against the manifest schema.",
            },
          },
        )

        // Validate manifest content without saving
        .post(
          "/:name/validate",
          async ({ params: { name }, body, set }) => {
            const info = manifestService.getManifestInfo(name);
            if (!info) {
              set.status = 404;
              return { error: `Unknown manifest: ${name}` };
            }

            const result = manifestService.validateManifest(name, body.content);
            return result;
          },
          {
            params: t.Object({
              name: t.String({ minLength: 1 }),
            }),
            body: Models.ManifestWriteRequest,
            response: {
              200: Models.ManifestValidationResult,
              404: Models.ErrorResponse,
            },
            detail: {
              tags: ["Manifests"],
              summary: "Validate manifest content",
              description:
                "Validates manifest content against the schema without saving. Returns validation errors if any.",
            },
          },
        )

        // List backups for a manifest
        .get(
          "/:name/backups",
          async ({ params: { name }, set }) => {
            const info = manifestService.getManifestInfo(name);
            if (!info) {
              set.status = 404;
              return { error: `Unknown manifest: ${name}` };
            }

            const backups = await manifestService.listBackups(name);
            return backups;
          },
          {
            params: t.Object({
              name: t.String({ minLength: 1 }),
            }),
            response: {
              200: Models.ManifestBackupList,
              404: Models.ErrorResponse,
            },
            detail: {
              tags: ["Manifests"],
              summary: "List manifest backups",
              description:
                "Returns a list of backup files for a manifest, sorted by date (most recent first).",
            },
          },
        )

        // Restore from backup
        .post(
          "/:name/restore",
          async ({ params: { name }, body, set }) => {
            const info = manifestService.getManifestInfo(name);
            if (!info) {
              set.status = 404;
              return { error: `Unknown manifest: ${name}` };
            }

            if (!info.editable) {
              set.status = 403;
              return { error: `Manifest ${name} is not editable` };
            }

            const result = await manifestService.restoreFromBackup(
              name,
              body.backupFilename,
            );
            return result;
          },
          {
            params: t.Object({
              name: t.String({ minLength: 1 }),
            }),
            body: Models.ManifestRestoreRequest,
            response: {
              200: Models.ManifestWriteResponse,
              403: Models.ErrorResponse,
              404: Models.ErrorResponse,
            },
            detail: {
              tags: ["Manifests"],
              summary: "Restore from backup",
              description:
                "Restores a manifest from a backup file. Creates a backup of the current state before restoring.",
            },
          },
        ),
  );
};
