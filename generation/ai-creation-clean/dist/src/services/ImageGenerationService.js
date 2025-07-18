"use strict";
/**
 * Image Generation Service
 * Generates images using GPT-4 vision API
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageGenerationService = void 0;
const openai_1 = __importDefault(require("openai"));
const helpers_1 = require("../utils/helpers");
class ImageGenerationService {
    openai;
    config;
    constructor(config) {
        this.config = config;
        this.openai = new openai_1.default({
            apiKey: config.apiKey
        });
    }
    /**
     * Generate an image from description
     */
    async generateImage(description, assetType, style) {
        const prompt = this.buildPrompt(description, assetType, style);
        console.log(`🎨 Generating image: ${description}`);
        try {
            const response = await (0, helpers_1.retry)(async () => {
                return await this.openai.images.generate({
                    model: this.config.model || 'dall-e-3',
                    prompt,
                    n: 1,
                    size: '1024x1024',
                    quality: 'standard',
                    response_format: 'url'
                });
            }, this.config.maxRetries || 3);
            if (!response.data || response.data.length === 0) {
                throw new Error('No image generated');
            }
            const imageUrl = response.data[0].url;
            if (!imageUrl) {
                throw new Error('No image URL returned from OpenAI');
            }
            return {
                imageUrl,
                prompt,
                metadata: {
                    model: this.config.model || 'dall-e-3',
                    resolution: '1024x1024',
                    timestamp: new Date()
                }
            };
        }
        catch (error) {
            console.error('❌ Image generation failed:', error);
            throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Build optimized prompt for asset generation
     */
    buildPrompt(description, assetType, style) {
        const styleGuide = style || 'realistic';
        // Base prompt components
        let prompt = `Create a ${assetType} asset: ${description}. `;
        // Add style directives
        switch (styleGuide) {
            case 'realistic':
                prompt += 'Photorealistic rendering with PBR materials. ';
                break;
            case 'cartoon':
                prompt += 'Cartoon style with vibrant colors and simplified forms. ';
                break;
            case 'low-poly':
                prompt += 'Low poly geometric style with flat shading. ';
                break;
            case 'stylized':
                prompt += 'Stylized artistic rendering with unique visual appeal. ';
                break;
        }
        // Add asset-specific guidelines
        switch (assetType) {
            case 'weapon':
                prompt += 'Show the full weapon clearly on a neutral background, oriented horizontally. Include details like grips, blades, and decorative elements. ';
                break;
            case 'armor':
                prompt += 'Display the armor piece on a mannequin or stand, showing all angles and attachment points clearly. ';
                break;
            case 'character':
                prompt += 'Full body character in T-pose, neutral expression, clear anatomy for rigging. ';
                break;
            case 'building':
                // Add building-specific prompts
                if (description.toLowerCase().includes('bank')) {
                    prompt += 'Grand bank building with columns, vault door visible, gold accents, secure appearance. Show full exterior with main entrance. ';
                }
                else if (description.toLowerCase().includes('store') || description.toLowerCase().includes('shop')) {
                    prompt += 'Shop building with display windows, merchant sign, welcoming entrance, market stall elements. Show full exterior with storefront. ';
                }
                else {
                    prompt += '3/4 isometric view of the complete structure, showing architectural details and scale. ';
                }
                break;
            case 'tool':
                prompt += 'Show the tool clearly with handle and working end visible, realistic wear and materials. ';
                break;
            case 'consumable':
                if (description.toLowerCase().includes('potion')) {
                    prompt += 'Glass bottle or vial with colored liquid, cork or stopper, mystical glow effect. ';
                }
                else if (description.toLowerCase().includes('food')) {
                    prompt += 'Appetizing food item with realistic textures and colors. ';
                }
                else {
                    prompt += 'Clear view of the consumable item showing its form and purpose. ';
                }
                break;
            case 'resource':
                prompt += 'Raw material or resource in its natural form, showing texture and material properties clearly. ';
                break;
            case 'misc':
                prompt += 'Clear view of the object showing all important details and features. ';
                break;
            default:
                prompt += 'Clear view of the object on neutral background, showing all important details. ';
        }
        // Add technical requirements
        prompt += 'High quality, centered composition, soft lighting, no harsh shadows, suitable for 3D reconstruction.';
        return prompt;
    }
}
exports.ImageGenerationService = ImageGenerationService;
//# sourceMappingURL=ImageGenerationService.js.map