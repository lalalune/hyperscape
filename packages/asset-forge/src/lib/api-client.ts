/**
 * Type-Safe API Client using Elysia's Eden Treaty
 *
 * This client provides end-to-end type safety for all API calls.
 * It automatically infers request/response types from the Elysia server,
 * eliminating the need for manual type definitions or runtime validation.
 *
 * Benefits:
 * - Full TypeScript autocomplete for all routes and methods
 * - Compile-time type checking for request bodies and query parameters
 * - Automatic response type inference
 * - No manual type definitions needed
 * - Runtime errors caught at compile time
 */

import { treaty } from "@elysiajs/eden";
import type { App } from "../../server/api-elysia";

// Get API port from environment or use default
const API_PORT = import.meta.env.VITE_API_PORT || 3004;
const API_BASE_URL =
  import.meta.env.VITE_API_URL || `http://localhost:${API_PORT}`;

/**
 * Get authentication headers (currently no auth)
 */
function getAuthHeaders(): Record<string, string> {
  return {};
}

/**
 * Type-safe API client for asset-forge backend
 *
 * Usage examples:
 *
 * ```typescript
 * // Health check
 * const { data, error } = await api.api.health.get()
 * if (data) {
 *   console.log('Status:', data.status)
 *   console.log('Services:', data.services)
 * }
 *
 * // List all assets
 * const { data: assets } = await api.api.assets.get()
 *
 * // Get single asset model
 * const { data: model } = await api.api.assets({ id: 'sword-001' }).model.get()
 *
 * // Delete an asset
 * const { data } = await api.api.assets({ id: 'sword-001' }).delete({
 *   query: { includeVariants: 'true' }
 * })
 *
 * // Update asset metadata
 * const { data: updated } = await api.api.assets({ id: 'sword-001' }).patch({
 *   name: 'Updated Sword',
 *   tier: 3
 * })
 *
 * // Start retexture job
 * const { data: result } = await api.api.retexture.post({
 *   baseAssetId: 'sword-001',
 *   materialPreset: 'steel',
 *   outputName: 'steel-sword'
 * })
 *
 * // Start generation pipeline
 * const { data: pipeline } = await api.api.generation.pipeline.post({
 *   name: 'Iron Sword',
 *   type: 'weapon',
 *   subtype: 'sword',
 *   tier: 1
 * })
 *
 * // Check pipeline status
 * const { data: status } = await api.api.generation.pipeline({ pipelineId: '123' }).get()
 *
 * // Get material presets
 * const { data: presets } = await api['api']['material-presets'].get()
 *
 * // Save sprites for an asset
 * const { data: result } = await api.api.assets({ id: 'sword-001' }).sprites.post({
 *   sprites: [
 *     { angle: 0, imageData: 'data:image/png;base64,...' },
 *     { angle: 45, imageData: 'data:image/png;base64,...' }
 *   ],
 *   config: { resolution: 512, angles: 8 }
 * })
 *
 * // Upload VRM file
 * const formData = new FormData()
 * formData.append('file', file)
 * formData.append('assetId', 'character-001')
 * const { data } = await api.api.assets['upload-vrm'].post(formData)
 *
 * // Weapon handle detection
 * const { data: gripData } = await api.api['weapon-handle-detect'].post({
 *   image: 'data:image/png;base64,...',
 *   angle: 'side',
 *   promptHint: 'medieval sword'
 * })
 *
 * // Weapon orientation detection
 * const { data: orientation } = await api.api['weapon-orientation-detect'].post({
 *   image: 'data:image/png;base64,...'
 * })
 * ```
 */
export const api = treaty<App>(API_BASE_URL, {
  // Dynamic headers - auth token updated on every request
  fetch: {
    credentials: "include",
    headers: () => getAuthHeaders(),
  },
});

/**
 * Type-safe fetch wrapper for non-Eden endpoints
 * Use this if you need to make requests outside the Eden Treaty client
 */
export const apiFetch = async <T = unknown>(
  endpoint: string,
  options?: RequestInit,
): Promise<{ data: T | null; error: string | null }> => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return { data: null, error: `HTTP ${response.status}: ${error}` };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// Export types for convenience
export type { App } from "../../server/api-elysia";
