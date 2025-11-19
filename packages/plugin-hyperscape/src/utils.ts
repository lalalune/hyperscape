import { Readable } from "node:stream";
import { promises as fsPromises } from "fs";
import type { Action, IAgentRuntime, Memory, State } from "@elizaos/core";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";

export async function hashFileBuffer(buffer: Buffer): Promise<string> {
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
  const hashBuf = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hash = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hash;
}

export async function convertToAudioBuffer(
  speechResponse: ReadableStream<Uint8Array> | Readable | Buffer,
): Promise<Buffer> {
  if (Buffer.isBuffer(speechResponse)) {
    return speechResponse;
  }

  if ((speechResponse as ReadableStream<Uint8Array>).getReader) {
    // Handle Web ReadableStream
    const reader = (speechResponse as ReadableStream<Uint8Array>).getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
    }
    reader.releaseLock();
    return Buffer.concat(chunks);
  }

  // Handle Node Readable Stream
  const stream = speechResponse as Readable;
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", (err: Error) => reject(err));
  });
}

export function getModuleDirectory(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return __dirname;
}

const mimeTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".webp": "image/webp",
  ".hdr": "image/vnd.radiance",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".vrm": "model/gltf-binary",
  ".hyp": "application/octet-stream",
};

function getMimeTypeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || "application/octet-stream";
}

export const resolveUrl = async (
  url: string,
  world: { assetsUrl: string },
): Promise<string> => {
  if (url.startsWith("asset://")) {
    const filename = url.substring("asset://".length);
    const baseUrl = world.assetsUrl.replace(/[/\\\\]$/, ""); // Remove trailing slash (either / or \)
    return `${baseUrl}/${filename}`;
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // Try reading as local file first
  const buffer = await fsPromises.readFile(url);
  const mimeType = getMimeTypeFromPath(url);
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
};

/**
 * Fetches and validates actions from the runtime.
 * If `includeList` is provided, filters actions by those names only.
 *
 * @param runtime - The agent runtime
 * @param message - The message memory
 * @param state - The state
 * @param includeList - Optional list of action names to include
 * @returns Array of validated actions
 */
export async function getHyperscapeActions(
  runtime: IAgentRuntime,
  message: Memory,
  state: State,
  includeList?: string[],
): Promise<Action[]> {
  const availableActions = includeList
    ? runtime.actions.filter((action) => includeList.includes(action.name))
    : runtime.actions;

  const validated = await Promise.all(
    availableActions.map(async (action) => {
      const result = await action.validate(runtime, message, state);
      return result ? action : null;
    }),
  );

  return validated.filter(Boolean) as Action[];
}

/**
 * Formats the provided actions into a detailed string listing each action's name and description, separated by commas and newlines.
 * @param actions - An array of `Action` objects to format.
 * @returns A detailed string of actions, including names and descriptions.
 */
export function formatActions(actions: Action[]) {
  return actions
    .sort(() => 0.5 - Math.random())
    .map((action: Action) => `- **${action.name}**: ${action.description}`)
    .join("\n\n");
}

/**
 * Calculate distance between two 3D points
 * @param pos1 - First position {x, y, z}
 * @param pos2 - Second position {x, y, z}
 * @returns Distance between the points
 */
export function calculateDistance3D(
  pos1: { x: number; y: number; z: number },
  pos2: { x: number; y: number; z: number },
): number {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Check if a position is within range of another position
 * @param pos1 - First position
 * @param pos2 - Second position
 * @param range - Maximum distance
 * @returns True if within range
 */
export function isWithinRange(
  pos1: { x: number; y: number; z: number },
  pos2: { x: number; y: number; z: number },
  range: number,
): boolean {
  return calculateDistance3D(pos1, pos2) <= range;
}

/**
 * Generate a random position within a radius
 * @param center - Center position
 * @param radius - Maximum radius
 * @param minHeight - Minimum Y position
 * @param maxHeight - Maximum Y position
 * @returns Random position
 */
export function randomPositionInRadius(
  center: { x: number; y: number; z: number },
  radius: number,
  minHeight: number = 0,
  maxHeight: number = 10,
): { x: number; y: number; z: number } {
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.sqrt(Math.random()) * radius; // Use sqrt for uniform distribution

  return {
    x: center.x + Math.cos(angle) * distance,
    y: center.y + minHeight + Math.random() * (maxHeight - minHeight),
    z: center.z + Math.sin(angle) * distance,
  };
}

/**
 * Parse Hyperscape world URL to extract world ID
 * @param url - Hyperscape world URL
 * @returns World ID
 */
export function parseHyperscapeWorldUrl(url: string): string {
  const urlObj = new URL(url);
  // Handle different Hyperscape URL formats
  // e.g., https://hyperscape.io/world-name or https://custom-domain.com
  const pathParts = urlObj.pathname.split("/").filter(Boolean);

  if (urlObj.hostname.includes("hyperscape.io") && pathParts.length > 0) {
    return pathParts[0];
  }

  // For custom domains, the entire domain might be the world ID
  return urlObj.hostname;
}

/**
 * Format entity data for display
 * @param entity - Entity object from Hyperscape world
 * @returns Formatted string
 */
export function formatEntity(entity: any): string {
  const parts = [`Entity: ${entity.name || "Unnamed"}`];

  if (entity.position) {
    parts.push(
      `Position: (${entity.position.x.toFixed(2)}, ${entity.position.y.toFixed(2)}, ${entity.position.z.toFixed(2)})`,
    );
  }

  if (entity.type) {
    parts.push(`Type: ${entity.type}`);
  }

  if (entity.distance !== undefined) {
    parts.push(`Distance: ${entity.distance.toFixed(2)}m`);
  }

  return parts.join(" | ");
}

/**
 * Check if an entity is interactable based on Hyperscape app system
 * @param entity - Entity to check
 * @returns True if entity has interactive components
 */
export function isInteractableEntity(entity: any): boolean {
  // Check for common interactive components in Hyperscape
  return !!(
    entity.app ||
    entity.grabbable ||
    entity.clickable ||
    entity.trigger ||
    entity.seat ||
    entity.portal
  );
}

/**
 * Generate VRM avatar configuration
 * @param avatarUrl - URL to VRM file
 * @param customization - Optional customization parameters
 * @returns Avatar configuration object
 */
export function generateAvatarConfig(
  avatarUrl: string,
  customization?: {
    scale?: number;
    position?: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number };
  },
): any {
  return {
    url: avatarUrl,
    scale: customization?.scale || 1,
    position: customization?.position || { x: 0, y: 0, z: 0 },
    rotation: customization?.rotation || { x: 0, y: 0, z: 0 },
    vrm: true,
    animations: true,
  };
}

/**
 * Convert Hyperscape physics data to readable format
 * @param physicsData - Physics data from PhysX
 * @returns Human-readable physics information
 */
export function formatPhysicsData(physicsData: any): string {
  const parts: string[] = [];

  if (physicsData.velocity) {
    const speed = Math.sqrt(
      physicsData.velocity.x ** 2 +
        physicsData.velocity.y ** 2 +
        physicsData.velocity.z ** 2,
    );
    parts.push(`Speed: ${speed.toFixed(2)} m/s`);
  }

  if (physicsData.mass !== undefined) {
    parts.push(`Mass: ${physicsData.mass} kg`);
  }

  if (physicsData.grounded !== undefined) {
    parts.push(`Grounded: ${physicsData.grounded ? "Yes" : "No"}`);
  }

  return parts.join(", ");
}
