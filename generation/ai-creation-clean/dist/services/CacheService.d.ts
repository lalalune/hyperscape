/**
 * Cache Service
 * Handles caching of generation results and intermediate outputs
 */
export interface CacheConfig {
    enabled: boolean;
    ttl: number;
    maxSize: number;
    checkPeriod?: number;
}
export declare class CacheService {
    private cache;
    private config;
    private currentSize;
    constructor(config: CacheConfig);
    /**
     * Get item from cache
     */
    get<T>(key: string): Promise<T | null>;
    /**
     * Set item in cache
     */
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
    /**
     * Delete item from cache
     */
    delete(key: string): Promise<void>;
    /**
     * Clear all cache
     */
    clear(): void;
    /**
     * Get cache statistics
     */
    getStats(): {
        keys: number;
        hits: number;
        misses: number;
        size: number;
        maxSize: number;
    };
    /**
     * Check if key exists
     */
    has(key: string): boolean;
    /**
     * Get all keys matching pattern
     */
    getKeys(pattern?: string): string[];
    /**
     * Estimate size of value in bytes
     */
    private estimateSize;
    /**
     * Enforce maximum cache size
     */
    private enforceMaxSize;
}
//# sourceMappingURL=CacheService.d.ts.map