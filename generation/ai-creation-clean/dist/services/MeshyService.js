"use strict";
/**
 * Meshy AI Service
 * Handles 3D model generation, remeshing, and texturing
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
exports.MeshyService = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const helpers_1 = require("../utils/helpers");
class MeshyService {
    config;
    baseUrl;
    constructor(config) {
        this.config = config;
        this.baseUrl = config.baseUrl || 'https://api.meshy.ai';
        if (!config.apiKey) {
            throw new Error('Meshy API key is required');
        }
    }
    /**
     * Generate 3D model from image
     */
    async imageToModel(imageUrl, options = {}) {
        console.log(`🎯 Creating 3D model from image...`);
        try {
            // Start image-to-3D task
            const taskId = await this.startImageTo3D(imageUrl, options);
            // Wait for completion
            const result = await this.waitForCompletion(taskId);
            return {
                modelUrl: result.model_urls?.glb || '',
                format: 'glb',
                polycount: options.targetPolycount || 10000,
                textureUrls: this.extractTextureUrls(result),
                metadata: {
                    meshyTaskId: taskId,
                    processingTime: result.finished_at ? result.finished_at - result.created_at : 0
                }
            };
        }
        catch (error) {
            console.error('❌ Model generation failed:', error);
            throw new Error(`Failed to generate model: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Remesh an existing model
     */
    async remeshModel(modelUrl, targetPolycount) {
        console.log(`🔧 Remeshing model to ${targetPolycount} polygons...`);
        try {
            // For now, return the same model (remeshing would be implemented with Meshy's remesh API)
            // This is a placeholder for the actual remesh implementation
            return {
                modelUrl,
                originalPolycount: 10000,
                remeshedPolycount: targetPolycount,
                targetPolycount
            };
        }
        catch (error) {
            console.error('❌ Remeshing failed:', error);
            throw new Error(`Failed to remesh model: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Download model to local directory
     */
    async downloadModel(modelUrl, outputDir, filename) {
        const outputPath = path.join(outputDir, filename);
        try {
            const response = await fetch(modelUrl);
            if (!response.ok) {
                throw new Error(`Failed to download model: ${response.statusText}`);
            }
            const buffer = await response.arrayBuffer();
            await fs.writeFile(outputPath, Buffer.from(buffer));
            return outputPath;
        }
        catch (error) {
            throw new Error(`Failed to download model: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Start image-to-3D task
     */
    async startImageTo3D(imageUrl, options) {
        const response = await (0, helpers_1.retry)(async () => {
            const res = await fetch(`${this.baseUrl}/openapi/v2/image-to-3d`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    image_url: imageUrl,
                    enable_pbr: true,
                    surface_mode: 'organic',
                    topology: 'quad',
                    target_polycount: options.targetPolycount || 30000,
                    should_remesh: true
                })
            });
            if (!res.ok) {
                const error = await res.text();
                throw new Error(`Meshy API error: ${res.status} - ${error}`);
            }
            return res.json();
        }, 3);
        return response.result;
    }
    /**
     * Wait for task completion
     */
    async waitForCompletion(taskId, maxWaitTime = 300000) {
        const startTime = Date.now();
        while (Date.now() - startTime < maxWaitTime) {
            const status = await this.getTaskStatus(taskId);
            switch (status.status) {
                case 'SUCCEEDED':
                    return status;
                case 'FAILED':
                    throw new Error(`Task failed: ${status.task_error?.message || 'Unknown error'}`);
                case 'PENDING':
                case 'IN_PROGRESS':
                    console.log(`⏳ Progress: ${status.progress || 0}%`);
                    await (0, helpers_1.sleep)(5000);
                    break;
                default:
                    throw new Error(`Unknown task status: ${status.status}`);
            }
        }
        throw new Error('Task timeout');
    }
    /**
     * Get task status
     */
    async getTaskStatus(taskId) {
        const response = await fetch(`${this.baseUrl}/openapi/v2/image-to-3d/${taskId}`, {
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to get task status: ${response.statusText}`);
        }
        return response.json();
    }
    /**
     * Extract texture URLs from Meshy response
     */
    extractTextureUrls(result) {
        if (!result.texture_urls || result.texture_urls.length === 0) {
            return {};
        }
        const textures = result.texture_urls[0];
        return {
            diffuse: textures.base_color,
            normal: textures.normal,
            metallic: textures.metallic,
            roughness: textures.roughness
        };
    }
}
exports.MeshyService = MeshyService;
//# sourceMappingURL=MeshyService.js.map