# Meshy AI Integration for ElizaOS

A comprehensive AI-powered 3D content generation system that integrates Meshy.ai with ElizaOS for automated creation of game assets including items, mobs, buildings, and other 3D models.

## 🚀 Features

### Core Capabilities
- **Intelligent Prompt Augmentation**: Automatically enhances prompts based on item type with specific orientation requirements
- **Hardpoint Detection**: AI-powered detection of weapon grips, attachment points, and projectile origins
- **Batch Generation**: Efficient mass-generation with intelligent caching and queue management
- **Performance Optimization**: Texture atlasing and retexturing for improved rendering performance
- **Comprehensive Visualization**: Interactive 3D viewers and accuracy reports

### Supported Asset Types
- **Weapons**: Swords, axes, bows, crossbows, daggers, staffs, shields, maces
- **Characters/Mobs**: Humanoid NPCs, monsters, animals (with T-pose generation)
- **Consumables**: Food, potions, misc items
- **Buildings**: Structures, decorations, environment assets

### Key Features
- ✅ **Orientation-Specific Generation**: Weapons point correctly, characters in T-pose
- ✅ **Hardpoint Intelligence**: Automatic grip and attachment point detection  
- ✅ **Projectile Direction**: Bows/crossbows configured for left-firing projectiles
- ✅ **Performance Optimization**: Texture atlasing and primitive retexturing
- ✅ **Intelligent Caching**: Avoid regenerating identical models
- ✅ **Batch Processing**: Handle hundreds of items efficiently
- ✅ **Visual Feedback**: Interactive viewers and accuracy reports
- ✅ **Error Recovery**: Retry logic and graceful failure handling

## 📁 Architecture

```
ai-creation/
├── MeshyAIService.ts              # Core Meshy.ai API integration
├── PromptAugmentationService.ts   # Intelligent prompt enhancement
├── HardpointDetectionService.ts   # Weapon attachment point detection
├── RetexturingService.ts          # Performance optimization via atlasing
├── BatchGenerationService.ts     # Mass generation with caching
├── VisualizationService.ts       # Interactive viewers and reports
├── demo-batch-generation.ts      # Complete workflow demonstration
├── __tests__/                    # Comprehensive test suite
└── README.md                     # This documentation
```

## 🛠️ Setup

### Prerequisites
```bash
# Install dependencies
bun install

# Set your Meshy.ai API key
export MESHY_API_KEY="your-meshy-api-key-here"
```

### Basic Usage

```typescript
import { MeshyAIService } from './MeshyAIService'
import { BatchGenerationService } from './BatchGenerationService'

// Initialize services
const meshyService = new MeshyAIService({
  apiKey: process.env.MESHY_API_KEY!
})

const batchService = new BatchGenerationService(meshyService, {
  maxConcurrentTasks: 5,
  enableHardpointDetection: true,
  enableRetexturing: true
})

// Load your items data
const items = JSON.parse(readFileSync('items.json', 'utf-8'))

// Generate all missing models
const results = await batchService.generateMissingOnly(items, 'item')

console.log(`Generated ${results.length} new models`)
```

## 🎯 Prompt Augmentation

The system automatically enhances prompts based on asset type:

### Weapons
```typescript
// Input: "A bronze sword"
// Output: "A bronze sword, vertical orientation with blade pointing up, 
//          side profile view, blade edge facing left, point upward, 
//          hilt at bottom, detailed medieval weapon, realistic materials"
```

### Characters/Mobs  
```typescript
// Input: "A goblin warrior"
// Output: "A goblin warrior, full body character in T-pose, 
//          arms extended horizontally, facing forward toward camera, 
//          orthographic view, humanoid proportions"
```

### Projectile Weapons
```typescript
// Bows: "string facing left, arrow rest visible, projectile direction leftward"
// Crossbows: "bolt channel pointing left, firing direction toward left"
```

## ⚔️ Hardpoint Detection

Automatically detects weapon attachment points with high accuracy:

### Sword Hardpoints
- **Primary Grip**: Center of handle area
- **Impact Point**: Blade tip for stabbing
- **Attachment Points**: Crossguard mounting points

### Bow Hardpoints  
- **Primary Grip**: Bow riser/center section
- **Projectile Origin**: Arrow rest (left side)
- **Attachment Points**: String nocking points

### Crossbow Hardpoints
- **Primary Grip**: Pistol grip/stock
- **Secondary Grip**: Fore-end support
- **Projectile Origin**: Bolt channel exit (left-facing)

```typescript
const hardpoints = await hardpointService.detectWeaponHardpoints(
  geometry, 
  'sword'
)

console.log(`Detected grip at:`, hardpoints.primaryGrip.position)
console.log(`Confidence: ${hardpoints.confidence * 100}%`)
```

## 🎨 Retexturing & Performance

Optimize models for better rendering performance:

```typescript
const retexturingService = new RetexturingService({
  atlasSize: 2048,
  maxTextures: 64,
  compression: 0.8
})

// Batch retexture similar items for shared materials
const result = await retexturingService.batchRetexturePrimitives([
  { geometry: cubeGeometry, textureRequest: woodTexture, id: 'crate1' },
  { geometry: sphereGeometry, textureRequest: metalTexture, id: 'orb1' }
])

// Result: 2 draw calls → 1 draw call via texture atlasing
```

## 📊 Batch Processing

Process large datasets efficiently with intelligent caching:

```typescript
// Generate only missing items (skips cached)
const results = await batchService.generateMissingOnly(allItems, 'item')

// Monitor progress
batchService.onProgress(progress => {
  console.log(`${progress.completed}/${progress.total} completed`)
})

// Handle completion
batchService.onCompletion(results => {
  console.log(`Batch complete: ${results.length} items processed`)
})
```

### Performance Features
- **Smart Caching**: Avoid regenerating identical models
- **Priority Queues**: Process high-priority items first  
- **Concurrent Processing**: Multiple simultaneous generations
- **Retry Logic**: Handle API failures gracefully
- **Progress Tracking**: Real-time status updates

## 🔍 Visualization & Reports

Generate comprehensive visual feedback:

```typescript
const visualizationService = new VisualizationService({
  outputFormat: 'html',
  showHardpointMarkers: true,
  showConfidenceHeatmap: true
})

// Visualize hardpoint accuracy
const weaponViz = await visualizationService.visualizeHardpoints(hardpoints)
// Creates interactive 3D viewer with hardpoint markers

// Generate batch report
const batchReport = await visualizationService.generateBatchReport(results, progress)
// Creates comprehensive HTML report with metrics and charts
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
bun test ai-creation

# Run specific test file
bun test comprehensive-meshy-integration.test.ts

# Run with coverage
bun test --coverage ai-creation
```

### Test Coverage
- ✅ Prompt augmentation for all weapon types
- ✅ Hardpoint detection accuracy
- ✅ Batch generation with caching
- ✅ Retexturing optimization
- ✅ Visualization generation
- ✅ Error handling and recovery
- ✅ Performance benchmarks

## 🚀 Demo Script

Run the complete workflow demonstration:

```bash
# Generate all items and mobs
bun run demo-batch-generation.ts --items --mobs

# Generate only missing items (use cache)
bun run demo-batch-generation.ts --cache-only --items

# Generate only mobs
bun run demo-batch-generation.ts --mobs
```

The demo script will:
1. Load all JSON item/mob data
2. Generate 3D models via Meshy.ai
3. Detect hardpoints for weapons
4. Apply retexturing optimizations
5. Generate interactive visualizations
6. Create comprehensive HTML reports

Output is saved to `./generation-output/` with:
- Individual item visualizations
- Mob generation reports  
- Final comprehensive report
- Raw JSON data

## 📝 Configuration

### MeshyAIService Options
```typescript
{
  apiKey: string,              // Required: Meshy.ai API key
  baseUrl?: string,            // Optional: API base URL
  timeout?: number             // Optional: Request timeout
}
```

### BatchGenerationService Options
```typescript
{
  maxConcurrentTasks: 5,          // Parallel generation limit
  retryAttempts: 3,               // API failure retry count
  cacheMaxSize: 500,              // Cache size in MB
  cacheMaxAge: 604800000,         // Cache TTL (7 days)
  enableHardpointDetection: true, // Auto-detect weapon hardpoints
  enableRetexturing: true,        // Apply performance optimizations
  enableProgressiveGeneration: true // Incremental processing
}
```

### PromptAugmentationService Options
```typescript
{
  includeStyle: true,          // Add style enhancements
  includeOrientation: true,    // Add positioning requirements
  includeMaterials: true,      // Add material descriptions
  includeQuality: true,        // Add quality terms
  artStyle: 'realistic',       // Default art style
  targetPolycount: 'medium'    // Polygon density target
}
```

## 🎯 Asset-Specific Guidelines

### Weapon Generation
- **Swords/Daggers**: Vertical, blade up, edge left
- **Axes/Maces**: Vertical, head up, striking surface visible
- **Bows**: Vertical, string left, arrow rest visible
- **Crossbows**: Horizontal, bolt channel pointing left
- **Shields**: Vertical, face forward, arm straps visible

### Character Generation  
- **All Characters**: T-pose, arms horizontal, facing forward
- **Mobs**: Humanoid proportions, orthographic view
- **NPCs**: Clear silhouette, neutral expression

### Consumable Items
- **Food/Potions**: Isometric 3/4 view, stable base
- **Tools**: Clear functionality, ergonomic design
- **Decorations**: Aesthetic focus, good lighting

## 🔧 Troubleshooting

### Common Issues

**API Key Issues**
```bash
Error: Meshy.ai API key is required
# Solution: Set MESHY_API_KEY environment variable
export MESHY_API_KEY="your-key-here"
```

**Generation Failures**
```bash
Error: Task failed: API timeout
# Solution: Check retryAttempts config and API status
```

**Cache Problems**  
```bash
# Clear cache if experiencing issues
const batchService = new BatchGenerationService(/*...*/)
batchService.clearCache()
```

**Memory Issues**
```bash
# Reduce batch size for large datasets
const config = { maxConcurrentTasks: 2, cacheMaxSize: 100 }
```

### Performance Optimization

1. **Batch Size**: Start with 3-5 concurrent tasks
2. **Cache Management**: Monitor cache size and hit rates
3. **API Limits**: Respect Meshy.ai rate limits
4. **Memory Usage**: Use incremental generation for large datasets

## 📚 API Reference

### Core Services

#### MeshyAIService
- `textTo3D(request, metadata)` - Generate 3D model from text
- `imageTo3D(request, metadata)` - Generate 3D model from image  
- `waitForCompletion(taskId, timeout)` - Poll for task completion
- `getTaskStatus(taskId)` - Check generation status

#### BatchGenerationService
- `generateAllItems(items)` - Process all items
- `generateAllMobs(mobs)` - Process all mobs
- `generateMissingOnly(data, type)` - Incremental generation
- `onProgress(callback)` - Monitor progress
- `getCacheStats()` - Cache metrics

#### HardpointDetectionService
- `detectWeaponHardpoints(geometry, type)` - Find attachment points
- `calculateAccuracyMetrics(hardpoints)` - Accuracy analysis

#### VisualizationService  
- `visualizeHardpoints(hardpoints)` - Interactive 3D viewer
- `generateBatchReport(results, progress)` - Comprehensive report
- `createLiveProgressVisualization(progress)` - Real-time status

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Add comprehensive tests for new functionality
4. Ensure all tests pass (`bun test`)
5. Submit a pull request

### Development Guidelines
- Follow TypeScript best practices
- Add comprehensive type definitions
- Include unit and integration tests
- Document public APIs thoroughly
- Follow existing code style and patterns

## 📄 License

This project is part of the ElizaOS ecosystem and follows the same licensing terms.

## 🙋‍♂️ Support

For issues and questions:
1. Check the troubleshooting section above
2. Review test files for usage examples
3. Run the demo script to see the full workflow
4. Create an issue in the ElizaOS repository

---

**Happy 3D Asset Generation! 🎨⚔️👹**