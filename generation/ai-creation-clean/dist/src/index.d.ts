/**
 * AI Creation System
 * Complete asset generation pipeline for Hyperscape RPG
 */
export { AICreationService } from './core/AICreationService';
export * from './types';
export { ImageGenerationService } from './services/ImageGenerationService';
export { MeshyService } from './services/MeshyService';
export { ModelAnalysisService } from './services/ModelAnalysisService';
export { CacheService } from './services/CacheService';
export * from './utils/helpers';
export declare const defaultConfig: {
    openai: {
        apiKey: string;
        model: string;
    };
    meshy: {
        apiKey: string;
        baseUrl: string;
    };
    cache: {
        enabled: boolean;
        ttl: number;
        maxSize: number;
    };
    output: {
        directory: string;
        format: "glb";
    };
};
//# sourceMappingURL=index.d.ts.map