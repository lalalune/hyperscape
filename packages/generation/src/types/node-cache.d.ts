declare module 'node-cache' {
  interface NodeCacheOptions {
    stdTTL?: number;
    checkperiod?: number;
    useClones?: boolean;
  }

  class NodeCache {
    constructor(options?: NodeCacheOptions);
    get<T>(key: string): T | undefined;
    set<T>(key: string, value: T, ttl?: number): boolean;
    del(key: string): number;
    keys(): string[];
    has(key: string): boolean;
    getTtl(key: string): number | undefined;
    flushAll(): void;
    on(event: 'set', callback: (key: string, value: any) => void): void;
    on(event: 'del', callback: (key: string, value: any) => void): void;
    on(event: 'expired', callback: (key: string, value: any) => void): void;
    getStats(): {
      hits: number;
      misses: number;
      keys: number;
      ksize: number;
      vsize: number;
    };
  }

  export = NodeCache;
}