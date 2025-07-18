/**
 * Unified AI Creation Service
 * Manages the complete generation pipeline from description to final asset
 */
import { EventEmitter } from 'events';
import { GenerationRequest, GenerationResult, GenerationStage, AICreationConfig } from '../types';
export declare class AICreationService extends EventEmitter {
    private imageService;
    private meshyService;
    private analysisService;
    private cacheService;
    private config;
    private activeGenerations;
    constructor(config: AICreationConfig);
    /**
     * Generate a single asset through the complete pipeline
     */
    generate(request: GenerationRequest): Promise<GenerationResult>;
    /**
     * Batch generate multiple assets
     */
    batchGenerate(requests: GenerationRequest[]): Promise<GenerationResult[]>;
    /**
     * Regenerate a specific stage
     */
    regenerateStage(resultId: string, stage: GenerationStage['stage']): Promise<GenerationResult>;
    /**
     * Get active generations
     */
    getActiveGenerations(): GenerationResult[];
    /**
     * Get generation by ID
     */
    getGeneration(id: string): Promise<GenerationResult | null>;
    private generateImage;
    private generateModel;
    private remeshModel;
    private analyzeModel;
    private finalizeAsset;
    private cacheResult;
    private getTargetPolycount;
}
//# sourceMappingURL=AICreationService.d.ts.map