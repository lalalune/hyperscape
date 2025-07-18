"use strict";
/**
 * Cache Service
 * Handles caching of generation results and intermediate outputs
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
class CacheService {
    cache;
    config;
    currentSize = 0;
    constructor(config) {
        this.config = config;
        this.cache = new node_cache_1.default({
            stdTTL: config.ttl,
            checkperiod: config.checkPeriod || 600,
            useClones: false
        });
        // Monitor cache size
        this.cache.on('set', (key, value) => {
            this.currentSize += this.estimateSize(value);
            this.enforceMaxSize();
        });
        this.cache.on('del', (key, value) => {
            this.currentSize -= this.estimateSize(value);
        });
    }
    /**
     * Get item from cache
     */
    async get(key) {
        if (!this.config.enabled)
            return null;
        try {
            return this.cache.get(key) || null;
        }
        catch (error) {
            console.error(`Cache get error for key ${key}:`, error);
            return null;
        }
    }
    /**
     * Set item in cache
     */
    async set(key, value, ttl) {
        if (!this.config.enabled)
            return;
        try {
            this.cache.set(key, value, ttl || this.config.ttl);
        }
        catch (error) {
            console.error(`Cache set error for key ${key}:`, error);
        }
    }
    /**
     * Delete item from cache
     */
    async delete(key) {
        try {
            this.cache.del(key);
        }
        catch (error) {
            console.error(`Cache delete error for key ${key}:`, error);
        }
    }
    /**
     * Clear all cache
     */
    clear() {
        this.cache.flushAll();
        this.currentSize = 0;
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return {
            keys: this.cache.keys().length,
            hits: this.cache.getStats().hits,
            misses: this.cache.getStats().misses,
            size: this.currentSize,
            maxSize: this.config.maxSize * 1024 * 1024
        };
    }
    /**
     * Check if key exists
     */
    has(key) {
        return this.cache.has(key);
    }
    /**
     * Get all keys matching pattern
     */
    getKeys(pattern) {
        const allKeys = this.cache.keys();
        if (!pattern)
            return allKeys;
        const regex = new RegExp(pattern);
        return allKeys.filter(key => regex.test(key));
    }
    /**
     * Estimate size of value in bytes
     */
    estimateSize(value) {
        if (typeof value === 'string') {
            return value.length * 2; // Unicode chars
        }
        try {
            return JSON.stringify(value).length * 2;
        }
        catch {
            return 1024; // Default 1KB for non-serializable objects
        }
    }
    /**
     * Enforce maximum cache size
     */
    enforceMaxSize() {
        const maxBytes = this.config.maxSize * 1024 * 1024;
        if (this.currentSize <= maxBytes)
            return;
        // Remove oldest entries until size is under limit
        const keys = this.cache.keys();
        const entries = [];
        for (const key of keys) {
            const ttl = this.cache.getTtl(key);
            if (ttl) {
                entries.push({
                    key,
                    created: Date.now() - (this.config.ttl * 1000 - ttl)
                });
            }
        }
        // Sort by creation time (oldest first)
        entries.sort((a, b) => a.created - b.created);
        // Remove oldest entries
        for (const entry of entries) {
            if (this.currentSize <= maxBytes)
                break;
            this.cache.del(entry.key);
        }
    }
}
exports.CacheService = CacheService;
//# sourceMappingURL=CacheService.js.map