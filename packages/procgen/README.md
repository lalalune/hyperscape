# @hyperforge/procgen

Procedural tree generation based on the Weber & Penn algorithm - a TypeScript implementation for Three.js WebGPU.

This package now bundles tree, plant, rock, and building generators. Tree APIs are exported from the root module, while additional generators are available under subpaths like `@hyperforge/procgen/plant`, `@hyperforge/procgen/rock`, and `@hyperforge/procgen/building`.

## Overview

This package provides a complete port of the Python `tree-gen` Blender plugin to TypeScript, optimized for Three.js and WebGPU rendering. It implements the parametric tree generation algorithm from the paper "Creation and Rendering of Realistic Trees" by Jason Weber and Joseph Penn.

## Features

- **Full Weber & Penn Algorithm**: Complete implementation of parametric tree generation
- **19 Tree Presets**: Pre-configured parameters for realistic tree species including oak, willow, pine, palm, and more
- **Deterministic Generation**: Seeded random number generator produces identical trees for the same seed
- **Three.js Integration**: Direct generation of Three.js `BufferGeometry` and `Mesh` objects
- **TypeScript Native**: Full type safety with comprehensive type definitions
- **Modular Architecture**: Use individual components or the high-level API
- **10 Leaf Shapes + 3 Blossom Types**: Variety of foliage options

## Installation

```bash
npm install @hyperforge/procgen three
# or
bun add @hyperforge/procgen three
```

## Quick Start

```typescript
import { generateTree, QUAKING_ASPEN } from '@hyperforge/procgen';
import * as THREE from 'three';

// Create a scene
const scene = new THREE.Scene();

// Generate a tree
const result = generateTree(QUAKING_ASPEN, {
  generation: { seed: 12345 }
});

// Add to scene
scene.add(result.group);

// Clean up when done
import { disposeTreeMesh } from '@hyperforge/procgen';
disposeTreeMesh(result);
```

## API

### High-Level API

```typescript
// Generate tree with preset name
const tree1 = generateTree('blackOak', { generation: { seed: 42 } });

// Generate tree with parameters
const tree2 = generateTree(QUAKING_ASPEN, {
  generation: { seed: 42, generateLeaves: true },
  geometry: { radialSegments: 12 }
});

// Generate multiple variations
const variations = generateTreeVariations('silverBirch', 5, 100);

// Use the TreeGenerator class for more control
const generator = new TreeGenerator('quakingAspen');
generator.setOptions({ generation: { seed: 42 } });
const result = generator.generate();
const data = generator.getLastTreeData();
generator.dispose();
```

### Presets

Available tree presets:
- **Deciduous**: `quakingAspen`, `blackOak`, `cambridgeOak`, `apple`, `hillCherry`, `acer`, `silverBirch`, `lombardyPoplar`, `blackTupelo`, `sassafras`
- **Coniferous**: `balsamFir`, `douglasFir`, `europeanLarch`, `smallPine`
- **Tropical**: `palm`, `fanPalm`, `bamboo`
- **Ornamental**: `weepingWillow`, `sphereTree`

### Low-Level API

```typescript
import { Tree, getPreset } from '@hyperforge/procgen';

// Generate just the tree data
const params = getPreset('blackOak');
const tree = new Tree(params, { seed: 42 });
const data = tree.generate();

// Access stem and leaf data
console.log(`Stems: ${data.stems.length}`);
console.log(`Leaves: ${data.leaves.length}`);

// Generate geometry separately
import { generateBranchGeometry, generateLeafGeometry } from '@hyperforge/procgen';
const branchGeometry = generateBranchGeometry(data.stems, data.params);
const leafGeometry = generateLeafGeometry(data.leaves, data.params, data.treeScale);
```

### Custom Parameters

```typescript
import { createTreeParams, TreeShape, LeafShape } from '@hyperforge/procgen';

const myTreeParams = createTreeParams({
  shape: TreeShape.Hemispherical,
  gScale: 15,
  levels: 3,
  ratio: 0.02,
  leafShape: LeafShape.Maple,
  leafScale: 0.2,
  // ... override any parameters
});

const result = generateTree(myTreeParams);
```

## Viewer / Testing Tool

A built-in viewer is included for testing and visualizing trees:

```bash
cd packages/tree-gen
bun run viewer
```

This opens an interactive 3D viewer at `http://localhost:3500` where you can:
- Select different tree presets
- Adjust random seeds
- Toggle leaves/wireframe
- View generation statistics

## Architecture

```
src/
├── core/           # Core generation classes
│   ├── Tree.ts     # Main tree generator
│   ├── Turtle.ts   # 3D turtle graphics
│   ├── Stem.ts     # Branch data structure
│   └── Leaf.ts     # Leaf data structure
├── math/           # Mathematical utilities
│   ├── Random.ts   # Mersenne Twister RNG
│   ├── Bezier.ts   # Bezier curve evaluation
│   └── Vector3.ts  # Vector extensions
├── geometry/       # Mesh generation
│   ├── BranchGeometry.ts
│   └── LeafGeometry.ts
├── params/         # Parameters and presets
│   ├── defaults.ts
│   └── presets.ts
├── rendering/      # Three.js integration
│   ├── TreeMesh.ts
│   └── TreeGenerator.ts
└── types.ts        # Type definitions
```

## Algorithm Overview

The Weber & Penn algorithm generates trees through:

1. **Turtle Graphics**: A 3D "turtle" traverses space, recording its path as branch curves
2. **Recursive Branching**: Starting from the trunk, child branches are recursively generated
3. **Bezier Curves**: Branches are represented as Bezier splines for smooth curves
4. **Shape Functions**: Tree silhouette is controlled by mathematical shape functions
5. **Probabilistic Splitting**: Branches can split probabilistically at segments
6. **Tropism**: Environmental effects (gravity, light) influence growth direction
7. **Pruning Envelope**: Optional spatial bounds limit tree extent

## Performance

- Trees are generated on the main thread
- Large trees (Douglas Fir with 250+ branches) may take 1-5 seconds
- Consider Web Workers for non-blocking generation of complex trees
- Geometry is optimized for Three.js with indexed BufferGeometry

## License

GPL-3.0 (matching the original tree-gen)

## Credits

- Original Python implementation: [tree-gen](https://github.com/ChrisP-Ghub/tree-gen)
- Algorithm: Weber & Penn "Creation and Rendering of Realistic Trees"
- TypeScript port: Hyperia Team
