# Migrating to Safe Math Utilities

> **Migration Guide**: Prevent division by zero and NaN propagation with safe math utilities

## Why Migrate?

Safe math utilities prevent runtime crashes and invalid calculations:

- **Division by Zero Protection**: Automatically handles zero denominators
- **NaN Prevention**: Stops NaN propagation throughout calculations
- **Sensible Defaults**: Returns configurable fallback values
- **Automatic Validation**: Checks for finite values
- **Better Error Messages**: Logs warnings when edge cases are hit

## When to Use

Use safe-math for:
- User input calculations (viewport sizes, scales)
- Mesh scale operations (3D model transformations)
- Viewport dimension calculations
- Distance and ratio calculations
- Percentage calculations
- Normalization operations

Continue using regular math for:
- Constants and hardcoded values
- Integer arithmetic where division by zero is impossible
- Simple addition/subtraction

## Migration Steps

### Step 1: Import Safe Math Utilities

Add the import at the top of your file:

```typescript
import { safeDivide, safeScale, safePercentage, safeNormalize } from '@/utils/safe-math'
```

### Step 2: Identify Risky Operations

Look for division operations that could fail:

```typescript
// RISKY - Can crash if denominator is 0
const scale = targetSize / currentSize
const ratio = width / height
const percentage = (completed / total) * 100
const normalized = value / maxValue
```

### Step 3: Replace with Safe Alternatives

Replace risky divisions with safe utilities:

```typescript
// SAFE - Returns default if denominator is 0
const scale = safeDivide(targetSize, currentSize, 1.0)
const ratio = safeDivide(width, height, 1.0)
const percentage = safePercentage(completed, total)
const normalized = safeNormalize(value, maxValue)
```

## Complete Examples

### Before Migration

```typescript
// MeshScalingService.ts - Before
class MeshScalingService {
  scaleMesh(mesh: Mesh, targetHeight: number) {
    // RISKY: mesh.scale.y could be 0
    const scale = targetHeight / mesh.scale.y
    mesh.scale.multiplyScalar(scale)

    // RISKY: boundingBox could have zero dimensions
    const boundingBox = mesh.geometry.boundingBox
    const currentHeight = boundingBox.max.y - boundingBox.min.y
    const adjustedScale = targetHeight / currentHeight

    mesh.scale.set(adjustedScale, adjustedScale, adjustedScale)
  }

  calculateViewportScale(containerWidth: number, containerHeight: number) {
    // RISKY: Container dimensions could be 0 during initialization
    const aspectRatio = containerWidth / containerHeight
    const scale = 1000 / containerWidth

    return { aspectRatio, scale }
  }

  normalizeValue(value: number, maxValue: number) {
    // RISKY: maxValue could be 0
    return value / maxValue
  }
}
```

### After Migration

```typescript
// MeshScalingService.ts - After
import { safeDivide, safeScale, safeNormalize } from '@/utils/safe-math'
import { createLogger } from '@/utils/logger'

const logger = createLogger('MeshScalingService')

class MeshScalingService {
  scaleMesh(mesh: Mesh, targetHeight: number) {
    // SAFE: Returns 1.0 if mesh.scale.y is 0, preventing crashes
    const scale = safeScale(targetHeight, mesh.scale.y, 1.0)
    mesh.scale.multiplyScalar(scale)

    // SAFE: Returns 1.0 if height is 0
    const boundingBox = mesh.geometry.boundingBox
    const currentHeight = boundingBox.max.y - boundingBox.min.y
    const adjustedScale = safeScale(targetHeight, currentHeight, 1.0)

    mesh.scale.set(adjustedScale, adjustedScale, adjustedScale)

    logger.debug('Mesh scaled', { targetHeight, currentHeight, scale: adjustedScale })
  }

  calculateViewportScale(containerWidth: number, containerHeight: number) {
    // SAFE: Returns 1.0 if dimensions are 0 during initialization
    const aspectRatio = safeDivide(containerWidth, containerHeight, 1.0)
    const scale = safeDivide(1000, containerWidth, 1.0)

    logger.debug('Viewport scale calculated', { containerWidth, containerHeight, aspectRatio, scale })

    return { aspectRatio, scale }
  }

  normalizeValue(value: number, maxValue: number) {
    // SAFE: Returns 0 if maxValue is 0, clamps to 0-1 range
    return safeNormalize(value, maxValue)
  }
}
```

## API Reference

### safeDivide()

Safely divide two numbers with zero protection:

```typescript
safeDivide(numerator: number, denominator: number, defaultValue = 0): number
```

**Parameters:**
- `numerator` - The dividend
- `denominator` - The divisor
- `defaultValue` - Value to return if denominator is zero (default: 0)

**Returns:** Result of division or defaultValue if denominator is zero

**Examples:**

```typescript
safeDivide(10, 2)        // Returns 5
safeDivide(10, 0)        // Returns 0 (default)
safeDivide(10, 0, 1.0)   // Returns 1.0 (custom default)
safeDivide(100, 0, null) // Returns null (custom default)
```

### safeScale()

Calculate scale factor between target and current values:

```typescript
safeScale(target: number, current: number, defaultScale = 1): number
```

**Parameters:**
- `target` - Target size/value
- `current` - Current size/value
- `defaultScale` - Scale to return if current is zero (default: 1)

**Returns:** Scale factor or defaultScale if current is zero

**Examples:**

```typescript
safeScale(100, 50)      // Returns 2 (scale up by 2x)
safeScale(50, 100)      // Returns 0.5 (scale down by 50%)
safeScale(100, 0)       // Returns 1 (no scale)
safeScale(100, 0, 0.5)  // Returns 0.5 (custom default)
```

**Use Cases:**
- Mesh scaling: `mesh.scale.multiplyScalar(safeScale(targetHeight, currentHeight))`
- Viewport scaling: `const scale = safeScale(desiredSize, currentSize)`
- Proportional resizing: `const newWidth = width * safeScale(newHeight, oldHeight)`

### safePercentage()

Calculate percentage safely:

```typescript
safePercentage(numerator: number, denominator: number): number
```

**Parameters:**
- `numerator` - Part value
- `denominator` - Total value

**Returns:** Percentage (0-100) or 0 if denominator is zero

**Examples:**

```typescript
safePercentage(50, 100)   // Returns 50
safePercentage(75, 150)   // Returns 50
safePercentage(10, 0)     // Returns 0
safePercentage(0, 100)    // Returns 0
```

**Use Cases:**
- Progress: `const progress = safePercentage(completed, total)`
- Completion: `const done = safePercentage(finished, totalTasks)`
- Success rate: `const rate = safePercentage(successful, attempts)`

### safeNormalize()

Normalize value to 0-1 range safely:

```typescript
safeNormalize(value: number, max: number): number
```

**Parameters:**
- `value` - Value to normalize
- `max` - Maximum value in range

**Returns:** Normalized value (0-1) or 0 if max is zero

**Examples:**

```typescript
safeNormalize(50, 100)    // Returns 0.5
safeNormalize(75, 100)    // Returns 0.75
safeNormalize(150, 100)   // Returns 1.0 (clamped)
safeNormalize(50, 0)      // Returns 0
safeNormalize(-10, 100)   // Returns 0 (clamped)
```

**Use Cases:**
- Color values: `const normalized = safeNormalize(colorValue, 255)`
- Shader uniforms: `const u_progress = safeNormalize(currentTime, duration)`
- Volume: `const volume = safeNormalize(sliderValue, maxVolume)`

### safeAverage()

Calculate average of array safely:

```typescript
safeAverage(values: number[]): number
```

**Parameters:**
- `values` - Array of numbers to average

**Returns:** Average value or 0 if array is empty

**Examples:**

```typescript
safeAverage([1, 2, 3, 4, 5])   // Returns 3
safeAverage([10, 20, 30])      // Returns 20
safeAverage([])                // Returns 0
safeAverage([42])              // Returns 42
```

### safeRatio()

Calculate ratio between two values (alias for safeScale):

```typescript
safeRatio(value1: number, value2: number, defaultRatio = 1): number
```

**Examples:**

```typescript
safeRatio(1920, 1080)    // Returns ~1.78 (16:9 aspect ratio)
safeRatio(100, 0)        // Returns 1 (default)
```

## Common Patterns

### Pattern 1: Mesh Scaling

```typescript
// BEFORE
const scale = targetHeight / mesh.scale.y
mesh.scale.multiplyScalar(scale)

// AFTER
const scale = safeScale(targetHeight, mesh.scale.y, 1.0)
mesh.scale.multiplyScalar(scale)
```

### Pattern 2: Aspect Ratio Calculation

```typescript
// BEFORE
const aspectRatio = width / height

// AFTER
const aspectRatio = safeDivide(width, height, 1.0)
```

### Pattern 3: Progress Calculation

```typescript
// BEFORE
const progress = (completed / total) * 100

// AFTER
const progress = safePercentage(completed, total)
```

### Pattern 4: Viewport Scaling

```typescript
// BEFORE
const scale = containerWidth / defaultWidth

// AFTER
const scale = safeScale(containerWidth, defaultWidth, 1.0)
```

### Pattern 5: Normalization

```typescript
// BEFORE
const normalized = Math.max(0, Math.min(1, value / maxValue))

// AFTER
const normalized = safeNormalize(value, maxValue)
```

## Best Practices

### 1. Choose Appropriate Defaults

Select defaults that make sense for your use case:

```typescript
// Scale operations: Default to 1 (no change)
const scale = safeScale(target, current, 1.0)

// Percentages: Default to 0 (nothing completed)
const progress = safePercentage(done, total) // Uses 0 internally

// Ratios: Default to 1 (equal values)
const ratio = safeDivide(width, height, 1.0)

// Counts: Default to 0 (nothing found)
const average = safeAverage(values) // Uses 0 internally
```

### 2. Log When Edge Cases Occur

Safe-math utilities automatically log warnings:

```typescript
// Automatically logs warning if currentSize is 0
const scale = safeScale(targetSize, currentSize, 1.0)
// Log: [SafeMath] Scale calculation with zero current value prevented
```

### 3. Validate Results

For critical operations, validate results:

```typescript
import { isValidNumber } from '@/utils/safe-math'

const scale = safeScale(targetHeight, currentHeight, 1.0)

if (!isValidNumber(scale, 'mesh scaling')) {
  logger.error('Invalid scale calculated', { targetHeight, currentHeight })
  return
}

mesh.scale.multiplyScalar(scale)
```

### 4. Chain Operations Safely

When chaining calculations, each step is protected:

```typescript
// Each operation is individually protected
const aspectRatio = safeDivide(width, height, 1.0)
const scale = safeScale(targetWidth, width, 1.0)
const adjustedHeight = height * scale
const normalizedScale = safeNormalize(scale, maxScale)
```

## Common Pitfalls

### Pitfall 1: Wrong Default Value

Choose defaults that won't cause downstream errors:

```typescript
// BAD - 0 default could cause issues in multiplication
const scale = safeDivide(targetSize, currentSize, 0)
mesh.scale.multiplyScalar(scale) // Sets scale to 0, mesh disappears!

// GOOD - 1.0 default maintains current size
const scale = safeDivide(targetSize, currentSize, 1.0)
mesh.scale.multiplyScalar(scale) // Mesh stays visible
```

### Pitfall 2: Not Checking EPSILON

Very small numbers (< 1e-10) are treated as zero:

```typescript
import { EPSILON } from '@/utils/safe-math'

const verySmall = 1e-15
safeDivide(10, verySmall, 1.0) // Returns 1.0 (verySmall < EPSILON)

const notThatSmall = 1e-5
safeDivide(10, notThatSmall, 1.0) // Returns 100000 (normal division)
```

### Pitfall 3: Unnecessary Safe Math

Don't use safe-math for operations that can't fail:

```typescript
// UNNECESSARY - Constants can't be zero
const result = safeDivide(100, 10, 1.0) // Overkill

// BETTER - Use normal division
const result = 100 / 10

// USE SAFE MATH - Variable could be zero
const result = safeDivide(userValue, dynamicDenominator, 1.0) // Necessary
```

## Troubleshooting

### Issue: Getting default value unexpectedly

**Cause**: Denominator is exactly zero or very close to zero (< EPSILON)

**Solution**: Check if your values are uninitialized or incorrectly calculated:

```typescript
logger.debug('Division inputs', { numerator, denominator })
const result = safeDivide(numerator, denominator, 1.0)
```

### Issue: NaN still appearing in calculations

**Cause**: Using unsafe math elsewhere in the calculation chain

**Solution**: Use safe-math for all divisions in the chain:

```typescript
// BAD - Unsafe division can produce NaN
const ratio = width / height  // Could be NaN
const scaled = safeDivide(target, ratio, 1.0)  // Still NaN!

// GOOD - All divisions are safe
const ratio = safeDivide(width, height, 1.0)
const scaled = safeDivide(target, ratio, 1.0)
```

### Issue: Mesh disappearing after scaling

**Cause**: Using 0 as default scale

**Solution**: Use 1.0 as default for scale operations:

```typescript
// BAD
const scale = safeDivide(targetHeight, currentHeight, 0)

// GOOD
const scale = safeScale(targetHeight, currentHeight, 1.0)
```

## Migration Checklist

Use this checklist when migrating a file:

- [ ] Import safe-math utilities from '@/utils/safe-math'
- [ ] Identify all division operations (/) in the file
- [ ] Determine if each division could have zero denominator
- [ ] Replace risky divisions with safeDivide() or safeScale()
- [ ] Choose appropriate default values for each operation
- [ ] Replace percentage calculations with safePercentage()
- [ ] Replace normalization with safeNormalize()
- [ ] Test with edge cases (zero, very small numbers)
- [ ] Verify no NaN values propagate
- [ ] Check logs for safe-math warnings during testing
- [ ] Validate that defaults don't cause downstream issues

## Related Documentation

- [Safe Math API Reference](/Users/home/hyperscape-1/packages/asset-forge/src/utils/safe-math.ts)
- [Logger Migration Guide](/Users/home/hyperscape-1/packages/asset-forge/dev-book/11-development/migrations/console-to-logger.md)
- [Code Standards](/Users/home/hyperscape-1/packages/asset-forge/dev-book/11-development/code-standards.md)

## Examples in Codebase

See these files for real-world examples:

- `/Users/home/hyperscape-1/packages/asset-forge/src/services/fitting/MeshFittingService.ts`
- `/Users/home/hyperscape-1/packages/asset-forge/src/services/fitting/ArmorFittingService.ts`
- `/Users/home/hyperscape-1/packages/asset-forge/src/services/processing/AssetNormalizationService.ts`
- `/Users/home/hyperscape-1/packages/asset-forge/src/components/ArmorFitting/MeshFittingDebugger/utils/transformHelpers.ts`

---

**Last Updated**: 2025-10-24
**Migration Priority**: High
**Estimated Time**: 10-15 minutes per file
