"use strict";
/**
 * AI Creation System
 * Complete asset generation pipeline for Hyperscape RPG
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultConfig = exports.CacheService = exports.ModelAnalysisService = exports.MeshyService = exports.ImageGenerationService = exports.AICreationService = void 0;
// Export core service
var AICreationService_1 = require("./core/AICreationService");
Object.defineProperty(exports, "AICreationService", { enumerable: true, get: function () { return AICreationService_1.AICreationService; } });
// Export types
__exportStar(require("./types"), exports);
// Export individual services for advanced usage
var ImageGenerationService_1 = require("./services/ImageGenerationService");
Object.defineProperty(exports, "ImageGenerationService", { enumerable: true, get: function () { return ImageGenerationService_1.ImageGenerationService; } });
var MeshyService_1 = require("./services/MeshyService");
Object.defineProperty(exports, "MeshyService", { enumerable: true, get: function () { return MeshyService_1.MeshyService; } });
var ModelAnalysisService_1 = require("./services/ModelAnalysisService");
Object.defineProperty(exports, "ModelAnalysisService", { enumerable: true, get: function () { return ModelAnalysisService_1.ModelAnalysisService; } });
var CacheService_1 = require("./services/CacheService");
Object.defineProperty(exports, "CacheService", { enumerable: true, get: function () { return CacheService_1.CacheService; } });
// Export utilities
__exportStar(require("./utils/helpers"), exports);
// Default configuration
exports.defaultConfig = {
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: 'dall-e-3'
    },
    meshy: {
        apiKey: process.env.MESHY_API_KEY || '',
        baseUrl: 'https://api.meshy.ai'
    },
    cache: {
        enabled: true,
        ttl: 3600, // 1 hour
        maxSize: 500 // 500MB
    },
    output: {
        directory: './output',
        format: 'glb'
    }
};
//# sourceMappingURL=index.js.map