# @hyperforge/decimation

A TypeScript implementation of seam-aware mesh decimation based on the SIGGRAPH Asia 2017 paper [Seamless: Seam erasure and seam-aware decoupling of shape from mesh resolution](https://cragl.cs.gmu.edu/seamless/).

This library simplifies 3D meshes while preserving UV seam boundaries, allowing the same texture to be used across all decimation levels without visible artifacts along seams.

## Features

- **Seam-aware decimation**: Preserves UV boundaries during mesh simplification
- **Quadric Error Metrics**: Uses 5D QEM (position + UV) for optimal vertex placement
- **Configurable strictness**: Three levels of seam preservation (0, 1, 2)
- **No external dependencies**: Pure TypeScript implementation
- **Type-safe**: Full TypeScript types with no `any`

## Installation

```bash
bun add @hyperforge/decimation
# or
npm install @hyperforge/decimation
```

## Usage

```typescript
import { decimate, MeshData } from '@hyperforge/decimation';

// Create mesh data
const mesh = new MeshData(
  vertices,      // Vec3[] - vertex positions
  faces,         // [number, number, number][] - face vertex indices
  texCoords,     // Vec2[] - texture coordinates
  faceTexCoords  // [number, number, number][] - face texture coordinate indices
);

// Decimate to 50% of original vertices
const result = decimate(mesh, {
  targetPercent: 50,  // or use targetVertices: 1000
  strictness: 2       // 0, 1, or 2 (default: 2)
});

console.log(`Reduced from ${result.originalVertices} to ${result.finalVertices} vertices`);
console.log(`Performed ${result.collapses} edge collapses`);

// Access the simplified mesh
const simplified = result.mesh;
```

## Strictness Levels

- **Level 0**: No UV shape preservation, but UV parameters are still part of the metrics
- **Level 1**: UV shape is preserved
- **Level 2**: Full seam-aware decimation with length ratio criteria (default)

## API

### `decimate(mesh, options)`

Decimates a mesh while preserving UV seams.

**Parameters:**
- `mesh: MeshData` - Input mesh with vertices, faces, and UV coordinates
- `options: DecimationOptions` - Optional configuration
  - `targetVertices?: number` - Target number of vertices
  - `targetPercent?: number` - Target percentage of vertices to keep (default: 50)
  - `strictness?: 0 | 1 | 2` - Seam preservation level (default: 2)

**Returns:** `DecimationResult` with simplified mesh and statistics

### `MeshData`

Mesh data container class.

```typescript
const mesh = new MeshData(
  V: Vec3[],                        // Vertex positions
  F: [number, number, number][],    // Face indices
  TC: Vec2[],                       // Texture coordinates
  FT: [number, number, number][]    // Face texture indices
);
```

## Algorithm Overview

The decimation process:

1. **Build edge connectivity**: Creates half-edge data structure for efficient mesh traversal
2. **Identify seam edges**: Detects UV discontinuities between adjacent faces
3. **Compute quadric metrics**: Calculates 5D (position + UV) error metrics per vertex
4. **Priority queue**: Orders edges by collapse cost
5. **Iterative collapse**: Collapses lowest-cost edges while:
   - Preserving seam boundaries
   - Checking link condition (topological validity)
   - Preventing UV foldover

## Development

```bash
# Install dependencies
bun install

# Run tests
bun run test

# Build
bun run build

# Type check
bun run typecheck
```

## Credits

Based on the original C++ implementation from [SeamAwareDecimater](https://github.com/songrun/SeamAwareDecimater) and the research paper:

> Songrun Liu, Zachary Ferguson, Alec Jacobson, Yotam Gingold. "Seamless: Seam erasure and seam-aware decoupling of shape from mesh resolution." SIGGRAPH Asia 2017.

## License

MIT
