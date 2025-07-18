/**
 * Meshy AI Service
 * Handles 3D model generation, remeshing, and texturing
 */
import { ModelGenerationResult, RemeshResult } from '../types';
export interface MeshyConfig {
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
}
export declare class MeshyService {
    private config;
    private baseUrl;
    constructor(config: MeshyConfig);
    /**
     * Generate 3D model from image
     */
    imageToModel(imageUrl: string, options?: {
        targetPolycount?: number;
        style?: string;
    }): Promise<ModelGenerationResult>;
    /**
     * Remesh an existing model
     */
    remeshModel(modelUrl: string, targetPolycount: number): Promise<RemeshResult>;
    /**
     * Download model to local directory
     */
    downloadModel(modelUrl: string, outputDir: string, filename: string): Promise<string>;
    /**
     * Start image-to-3D task
     */
    private startImageTo3D;
    /**
     * Wait for task completion
     */
    private waitForCompletion;
    /**
     * Get task status
     */
    private getTaskStatus;
    /**
     * Extract texture URLs from Meshy response
     */
    private extractTextureUrls;
}
//# sourceMappingURL=MeshyService.d.ts.map