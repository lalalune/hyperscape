/**
 * Utility helpers
 */
/**
 * Generate a unique ID
 */
export declare function generateId(): string;
/**
 * Sleep for a specified duration
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Retry a function with exponential backoff
 */
export declare function retry<T>(fn: () => Promise<T>, maxRetries?: number, initialDelay?: number): Promise<T>;
/**
 * Format bytes to human readable string
 */
export declare function formatBytes(bytes: number): string;
/**
 * Create a progress bar string
 */
export declare function createProgressBar(current: number, total: number, width?: number): string;
/**
 * Parse asset type from description
 */
export declare function parseAssetType(description: string): string;
/**
 * Parse building type from description
 */
export declare function parseBuildingType(description: string): string;
/**
 * Parse weapon type from description
 */
export declare function parseWeaponType(description: string): string | undefined;
//# sourceMappingURL=helpers.d.ts.map