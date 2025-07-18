/**
 * Image Generation Service
 * Generates images using GPT-4 vision API
 */
import { ImageGenerationResult, AssetType } from '../types';
export interface ImageGenerationConfig {
    apiKey: string;
    model?: string;
    maxRetries?: number;
}
export declare class ImageGenerationService {
    private openai;
    private config;
    constructor(config: ImageGenerationConfig);
    /**
     * Generate an image from description
     */
    generateImage(description: string, assetType: AssetType, style?: string): Promise<ImageGenerationResult>;
    /**
     * Build optimized prompt for asset generation
     */
    private buildPrompt;
}
//# sourceMappingURL=ImageGenerationService.d.ts.map