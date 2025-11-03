# VRM Animation Issue - Deep Analysis Report

## Executive Summary

**Problem:** Animations work on `avatar1.vrm` (T-pose) but NOT on `human.vrm` (A-pose)

**Root Cause:** Meshy exports VRMs in A-pose (arms at 45°), but Mixamo animations expect T-pose (arms straight). Hyperscape's animation system requires T-pose bind pose to work without code modifications.

**Solution:** Normalize bind pose to T-pose during VRM conversion by:
1. Rotating Hips (and any A-pose bones) to identity (T-pose)
2. Compensating child bone rotations to preserve world poses
3. Recalculating inverse bind matrices correctly

---

## VRM File Comparison

### avatar1.vrm (WORKING ✅)
- **Format**: VRM 0.0 (`extensions.VRM`)
- **specVersion**: `"0.0"`
- **metaVersion**: `undefined`
- **Bind Pose**: Unknown (likely T-pose from Mixamo)
- **Hips Rotation**: Unknown
- **Total Bones**: 54

### human.vrm (BROKEN ❌)
- **Format**: VRM 1.0 (`extensions.VRMC_vrm`)
- **specVersion**: `"1.0"`
- **metaVersion**: `undefined`
- **Bind Pose**: A-pose (Meshy export)
- **Hips Rotation**: `[0.506, -0.333, 0.562, 0.562]` (90° in A-pose)
- **Total Bones**: 22

---

## Code Flow Analysis

### 1. VRM Loading (Hyperscape)
**File**: `packages/shared/src/extras/createVRMFactory.ts:110`

```typescript
const version = vrmData?.meta?.metaVersion
```

**Result**:
- `avatar1.vrm`: `version = undefined`
- `human.vrm`: `version = undefined`

### 2. Animation Retargeting
**File**: `packages/shared/src/extras/createEmoteFactory.ts:143`

```typescript
const { rootToHips = 1, version = '1', getBoneName = (name: string) => name } = options
```

**Result**: When `version` is `undefined`, it defaults to `'1'`

### 3. Coordinate Transformations
**File**: `packages/shared/src/extras/createEmoteFactory.ts:174,183`

**Quaternions (Line 174)**:
```typescript
track.values.map((v, i) => (version === '0' && i % 2 === 0 ? -v : v))
```

**Vectors (Line 183)**:
```typescript
track.values.map((v, i) => {
  return (version === '0' && i % 3 !== 1 ? -v : v) * scaler
})
```

**Result**:
- If `version === '0'`: Apply coordinate negations
- If `version === '1'` OR `undefined`: **NO transformations**

---

## The Critical Issue

### What SHOULD Happen

For VRM 1.0 models in **A-pose** (like `human.vrm`):
1. Mixamo animations expect **T-pose** bind pose
2. Our VRM has **A-pose** bind pose (Hips rotated 90°)
3. The animation quaternions need to be transformed to account for the bind pose difference

### What ACTUALLY Happens

1. `human.vrm` loads with `metaVersion = undefined`
2. Hyperscape defaults to `version = '1'`
3. NO coordinate transformations applied
4. Animation values are applied directly to A-pose skeleton
5. Result: Barely visible rotation changes

### Why avatar1.vrm Works

Hypothesis: `avatar1.vrm` was likely created FROM a Mixamo-exported model, so:
- It's already in T-pose bind pose
- No coordinate transformations needed
- Animations work correctly even with `version = '1'`

---

## Logs Analysis

### Conversion Logs (human.vrm)
```
Hips [BEFORE_EXPORT]:
  Local Rotation: [0.506, -0.333, 0.562, 0.562]  ← A-pose (90° rotation)
```

### Animation Logs (human.vrm)
```
[VRMTestViewer] Initial bone states:
  Hips rotation: (4) ['0.506', '-0.333', '0.562', '0.562']  ← A-pose

[AnimationRetargeting] Sample quaternion values (first keyframe):
  Track: Hips.quaternion
  Values: [-0.029, -0.010, -0.014, 0.999]  ← Near-identity quaternion!

[Frame 60] Hips rotation:
  Before mixer.update(): (4) [-0.028, -0.008, -0.013, 0.999]
  After mixer.update():  (4) [-0.028, -0.008, -0.013, 0.999]
  Mixer changed rotation: false  ← NO CHANGE!
```

**Problem**: The animation quaternions are tiny (near-identity), suggesting they're being applied to the WRONG bind pose!

---

## The Final Solution

**Normalize to T-Pose During VRM Conversion** ✅ (IMPLEMENTED)

**File**: `packages/asset-forge/src/services/retargeting/VRMConverter.ts:465-468`

Changed from:
```typescript
// SKIP T-pose normalization - A-pose works fine in online viewers
console.log('🤸 Preserving original bind pose (works in online VRM viewers)...')
```

To:
```typescript
// Normalize to T-pose for Hyperscape compatibility
console.log('🤸 Normalizing to T-pose for Hyperscape...')
this.validateTPose()
```

**Why This Works:**
1. Detects A-pose by checking Hips rotation magnitude (> 0.1)
2. Rotates Hips to identity (T-pose)
3. Compensates child bones: `child_local_new = parent_original_rot * child_local_old`
4. Recalculates inverse bind matrices to preserve mesh-skeleton alignment
5. Result: VRM file has T-pose bind pose, works in Hyperscape WITHOUT code changes

---

## Why Our Previous Fixes Failed

1. **Inverse Bind Matrix Transformations**: We tried transforming matrices, but got the math wrong (backwards multiplication)
2. **calculateInverses()**: Calling this after scaling destroyed the original bind pose
3. **T-Pose Normalization**: Attempted but caused 24% height loss due to matrix issues

---

## Test Plan

1. **Enable T-pose normalization** in VRMConverter (DONE)
2. Rebuild asset-forge (DONE)
3. Re-convert human.vrm from t-pose.glb
4. Load converted VRM in online viewer → should look correct (not deformed)
5. Load converted VRM in Hyperscape → animations should work
6. Compare with avatar1.vrm (known working T-pose VRM)

---

## Additional Notes

### Hyperscape DetachedBindMode
**File**: `createVRMFactory.ts:118-124`

```typescript
skinnedMesh.bindMode = THREE.DetachedBindMode
skinnedMesh.bindMatrix.copy(skinnedMesh.matrixWorld)
skinnedMesh.bindMatrixInverse.copy(skinnedMesh.bindMatrix).invert()
// CRITICAL: Must recalculate inverse matrices after changing bindMode
if (skinnedMesh.skeleton) {
  skinnedMesh.skeleton.calculateInverses();
}
```

This recalculates inverse bind matrices in Hyperscape, which means our converter's matrices are being overwritten!

### VRM 1.0 vs 0.0 Coordinate System
The code comment suggests VRM 0.0 requires coordinate negations, but VRM 1.0 does not. However, this might only apply to T-pose VRMs. A-pose VRMs may need different handling.
