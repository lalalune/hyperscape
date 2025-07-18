"use strict";
/**
 * Unified AI Creation Service
 * Manages the complete generation pipeline from description to final asset
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AICreationService = void 0;
const events_1 = require("events");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const ImageGenerationService_1 = require("../services/ImageGenerationService");
const MeshyService_1 = require("../services/MeshyService");
const ModelAnalysisService_1 = require("../services/ModelAnalysisService");
const CacheService_1 = require("../services/CacheService");
const helpers_1 = require("../utils/helpers");
class AICreationService extends events_1.EventEmitter {
    imageService;
    meshyService;
    analysisService;
    cacheService;
    config;
    activeGenerations = new Map();
    constructor(config) {
        super();
        this.config = config;
        // Initialize services
        this.imageService = new ImageGenerationService_1.ImageGenerationService(config.openai);
        this.meshyService = new MeshyService_1.MeshyService(config.meshy);
        this.analysisService = new ModelAnalysisService_1.ModelAnalysisService();
        this.cacheService = new CacheService_1.CacheService(config.cache);
    }
    /**
     * Generate a single asset through the complete pipeline
     */
    async generate(request) {
        const result = {
            id: request.id || (0, helpers_1.generateId)(),
            request,
            stages: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.activeGenerations.set(result.id, result);
        try {
            // Stage 1: Generate image from description
            await this.generateImage(result);
            // Stage 2: Generate 3D model from image
            await this.generateModel(result);
            // Stage 3: Remesh model
            await this.remeshModel(result);
            // Stage 4: Analyze model (hardpoints, placement, rigging)
            await this.analyzeModel(result);
            // Stage 5: Finalize asset
            await this.finalizeAsset(result);
            this.emit('complete', result);
            return result;
        }
        catch (error) {
            this.emit('error', { result, error });
            throw error;
        }
        finally {
            this.activeGenerations.delete(result.id);
        }
    }
    /**
     * Batch generate multiple assets
     */
    async batchGenerate(requests) {
        const results = [];
        // Process in parallel with concurrency limit
        const batchSize = 5;
        for (let i = 0; i < requests.length; i += batchSize) {
            const batch = requests.slice(i, i + batchSize);
            const batchResults = await Promise.allSettled(batch.map(req => this.generate(req)));
            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                }
                else {
                    this.emit('batch-error', result.reason);
                }
            }
        }
        return results;
    }
    /**
     * Regenerate a specific stage
     */
    async regenerateStage(resultId, stage) {
        // Load existing result from cache
        const cachedResult = await this.cacheService.get(`result:${resultId}`);
        if (!cachedResult) {
            throw new Error(`Result ${resultId} not found`);
        }
        const result = cachedResult;
        // Clear stages from the specified stage onwards
        const stageIndex = result.stages.findIndex(s => s.stage === stage);
        if (stageIndex >= 0) {
            result.stages = result.stages.slice(0, stageIndex);
        }
        // Regenerate from the specified stage
        switch (stage) {
            case 'image':
                await this.generateImage(result);
                await this.generateModel(result);
                await this.remeshModel(result);
                await this.analyzeModel(result);
                await this.finalizeAsset(result);
                break;
            case 'model':
                await this.generateModel(result);
                await this.remeshModel(result);
                await this.analyzeModel(result);
                await this.finalizeAsset(result);
                break;
            case 'remesh':
                await this.remeshModel(result);
                await this.analyzeModel(result);
                await this.finalizeAsset(result);
                break;
            case 'analysis':
                await this.analyzeModel(result);
                await this.finalizeAsset(result);
                break;
            case 'final':
                await this.finalizeAsset(result);
                break;
        }
        return result;
    }
    /**
     * Get active generations
     */
    getActiveGenerations() {
        return Array.from(this.activeGenerations.values());
    }
    /**
     * Get generation by ID
     */
    async getGeneration(id) {
        // Check active generations first
        if (this.activeGenerations.has(id)) {
            return this.activeGenerations.get(id);
        }
        // Check cache
        return await this.cacheService.get(`result:${id}`);
    }
    // Private methods for each stage
    async generateImage(result) {
        const stage = {
            stage: 'image',
            status: 'processing',
            timestamp: new Date()
        };
        result.stages.push(stage);
        this.emit('stage-start', { result, stage: 'image' });
        try {
            // Check cache first
            const cacheKey = `image:${result.request.description}`;
            const cached = await this.cacheService.get(cacheKey);
            if (cached) {
                result.imageResult = cached;
                stage.status = 'completed';
                stage.output = cached;
            }
            else {
                // Generate new image
                const imageResult = await this.imageService.generateImage(result.request.description, result.request.type, result.request.style);
                result.imageResult = imageResult;
                stage.status = 'completed';
                stage.output = imageResult;
                // Cache the result
                await this.cacheService.set(cacheKey, imageResult);
            }
            result.updatedAt = new Date();
            await this.cacheResult(result);
            this.emit('stage-complete', { result, stage: 'image' });
        }
        catch (error) {
            stage.status = 'failed';
            stage.error = error instanceof Error ? error.message : String(error);
            throw error;
        }
    }
    async generateModel(result) {
        if (!result.imageResult) {
            throw new Error('Image generation required before model generation');
        }
        const stage = {
            stage: 'model',
            status: 'processing',
            timestamp: new Date()
        };
        result.stages.push(stage);
        this.emit('stage-start', { result, stage: 'model' });
        try {
            const modelResult = await this.meshyService.imageToModel(result.imageResult.imageUrl, {
                targetPolycount: 10000,
                style: result.request.style
            });
            result.modelResult = modelResult;
            stage.status = 'completed';
            stage.output = modelResult;
            result.updatedAt = new Date();
            await this.cacheResult(result);
            this.emit('stage-complete', { result, stage: 'model' });
        }
        catch (error) {
            stage.status = 'failed';
            stage.error = error instanceof Error ? error.message : String(error);
            throw error;
        }
    }
    async remeshModel(result) {
        if (!result.modelResult) {
            throw new Error('Model generation required before remeshing');
        }
        const stage = {
            stage: 'remesh',
            status: 'processing',
            timestamp: new Date()
        };
        result.stages.push(stage);
        this.emit('stage-start', { result, stage: 'remesh' });
        try {
            // Determine target polycount based on asset type
            const targetPolycount = this.getTargetPolycount(result.request.type);
            const remeshResult = await this.meshyService.remeshModel(result.modelResult.modelUrl, targetPolycount);
            result.remeshResult = remeshResult;
            stage.status = 'completed';
            stage.output = remeshResult;
            result.updatedAt = new Date();
            await this.cacheResult(result);
            this.emit('stage-complete', { result, stage: 'remesh' });
        }
        catch (error) {
            stage.status = 'failed';
            stage.error = error instanceof Error ? error.message : String(error);
            throw error;
        }
    }
    async analyzeModel(result) {
        const modelUrl = result.remeshResult?.modelUrl || result.modelResult?.modelUrl;
        if (!modelUrl) {
            throw new Error('Model required for analysis');
        }
        const stage = {
            stage: 'analysis',
            status: 'processing',
            timestamp: new Date()
        };
        result.stages.push(stage);
        this.emit('stage-start', { result, stage: 'analysis' });
        try {
            // Analyze based on asset type
            switch (result.request.type) {
                case 'weapon':
                    result.analysisResult = await this.analysisService.analyzeWeapon(modelUrl, result.request.subtype);
                    break;
                case 'armor':
                    result.analysisResult = await this.analysisService.analyzeArmor(modelUrl, result.request.subtype);
                    break;
                case 'character':
                    result.analysisResult = await this.analysisService.analyzeForRigging(modelUrl, result.request.metadata?.creatureType || 'biped');
                    break;
                case 'building':
                    // Determine building type from subtype or description
                    let buildingType = result.request.subtype;
                    if (!buildingType) {
                        // Try to infer from description
                        const desc = result.request.description.toLowerCase();
                        if (desc.includes('bank'))
                            buildingType = 'bank';
                        else if (desc.includes('store') || desc.includes('shop'))
                            buildingType = 'store';
                        else if (desc.includes('house') || desc.includes('home'))
                            buildingType = 'house';
                        else if (desc.includes('temple') || desc.includes('church'))
                            buildingType = 'temple';
                        else if (desc.includes('castle'))
                            buildingType = 'castle';
                        else if (desc.includes('inn') || desc.includes('tavern'))
                            buildingType = 'inn';
                        else
                            buildingType = 'house'; // default
                    }
                    result.analysisResult = await this.analysisService.analyzeBuilding(modelUrl, buildingType);
                    break;
                case 'tool':
                case 'consumable':
                case 'resource':
                case 'decoration':
                case 'misc':
                    // These types might not need specific analysis
                    // Could add basic analysis like size, orientation, etc.
                    console.log(`ℹ️ No specific analysis needed for ${result.request.type}`);
                    break;
            }
            stage.status = 'completed';
            stage.output = result.analysisResult;
            result.updatedAt = new Date();
            await this.cacheResult(result);
            this.emit('stage-complete', { result, stage: 'analysis' });
        }
        catch (error) {
            stage.status = 'failed';
            stage.error = error instanceof Error ? error.message : String(error);
            throw error;
        }
    }
    async finalizeAsset(result) {
        const stage = {
            stage: 'final',
            status: 'processing',
            timestamp: new Date()
        };
        result.stages.push(stage);
        this.emit('stage-start', { result, stage: 'final' });
        try {
            // Save final asset with metadata
            const modelUrl = result.remeshResult?.modelUrl || result.modelResult?.modelUrl;
            if (!modelUrl) {
                throw new Error('No model available for finalization');
            }
            // Create output directory
            const outputDir = path.join(this.config.output.directory, result.id);
            await fs.mkdir(outputDir, { recursive: true });
            // Download and save model
            const modelPath = await this.meshyService.downloadModel(modelUrl, outputDir, `${result.request.name}.${this.config.output.format}`);
            // Save metadata
            const metadata = {
                ...result.request,
                analysisResult: result.analysisResult,
                generatedAt: new Date(),
                modelPath
            };
            await fs.writeFile(path.join(outputDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
            result.finalAsset = {
                modelUrl: modelPath,
                metadata
            };
            stage.status = 'completed';
            stage.output = result.finalAsset;
            result.updatedAt = new Date();
            await this.cacheResult(result);
            this.emit('stage-complete', { result, stage: 'final' });
        }
        catch (error) {
            stage.status = 'failed';
            stage.error = error instanceof Error ? error.message : String(error);
            throw error;
        }
    }
    async cacheResult(result) {
        await this.cacheService.set(`result:${result.id}`, result);
    }
    getTargetPolycount(type) {
        switch (type) {
            case 'weapon':
            case 'tool':
                return 2000;
            case 'armor':
            case 'consumable':
                return 3000;
            case 'decoration':
                return 5000;
            case 'character':
                return 8000;
            case 'building':
                return 10000;
            case 'resource':
                return 1500;
            case 'misc':
                return 2500;
            default:
                return 5000;
        }
    }
}
exports.AICreationService = AICreationService;
//# sourceMappingURL=AICreationService.js.map