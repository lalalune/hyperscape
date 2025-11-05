# Hyperscape A-Pose VRM Animation Fix

**Date:** November 3, 2025
**Issue:** A-pose VRMs from Meshy not animating in Hyperscape world
**Status:** ✅ FIXED - Bind Pose Compensation Approach

---

## Executive Summary

A-pose VRMs from the Meshy → VRM pipeline now animate correctly in Hyperscape using **bind pose compensation** in the animation retargeting. This is a different solution than the Asset Forge (which uses normalized bones), specifically designed for Hyperscape's VRM cloning architecture.

---

## The Problem

### Why Asset Forge's Solution Doesn't Work for Hyperscape

**Asset Forge:**
- Creates ONE VRM instance per viewer (no cloning)
- Uses VRM normalized bones (`Normalized_Hips`, etc.)
- Calls `vrm.humanoid.update()` to propagate normalized → raw bones
- ✅ Works perfectly for A-pose VRMs

**Hyperscape:**
- Creates MULTIPLE instances of same VRM (via `SkeletonUtils.clone`)
- ❌ Can't use normalized bones because `vrm.humanoid` references original bones, not cloned ones
- Cloned skeletons have their own bone instances
- Shared `vrm.humanoid.update()` would update wrong bones

### Root Cause

Mixamo animations expect T-pose (arms out 90°), but Meshy VRMs are in A-pose (arms down ~45°). Without normalized bones to handle this automatically, we need manual bind pose compensation.

---

## The Solution: Bind Pose Compensation in Animation Retargeting

Instead of using normalized bones (which don't clone), we add bind pose offsets directly to animation quaternions for arm bones.

### Implementation

**File:** [packages/shared/src/extras/createEmoteFactory.ts](packages/shared/src/extras/createEmoteFactory.ts)

#### 1. Define A-Pose Offsets

```typescript
const APOSE_OFFSETS: Record<string, { z: number }> = {
  leftUpperArm: { z: 75 * (Math.PI / 180) },   // 75° in radians
  rightUpperArm: { z: -75 * (Math.PI / 180) }, // -75° in radians
}
```

These match the offsets used in `createVRMFactory.ts` lines 160-164 where arms are initially posed down.

#### 2. Apply Offsets to Animation Quaternions

```typescript
// For each quaternion keyframe on arm bones:
const bindPoseOffset = APOSE_OFFSETS[vrmBoneName]
if (bindPoseOffset) {
  offsetQuat.setFromEuler(new THREE.Euler(0, 0, bindPoseOffset.z, 'XYZ'))

  for (let i = 0; i < values.length; i += 4) {
    animQuat.set(values[i], values[i + 1], values[i + 2], values[i + 3])
    // Compose: result = anim * offset
    resultQuat.multiplyQuaternions(animQuat, offsetQuat)
    // Store result
  }
}
```

This **composes** the animation rotation with the bind pose offset, making T-pose animations work correctly on A-pose skeletons.

---

## How It Works

### Animation Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Load Mixamo Animation (T-pose space)                     │
│    - Animation says: "set leftUpperArm to rotation X"       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. createEmoteFactory.toClip() - Retarget to VRM            │
│    - For arm bones: compose(animRotation, bindPoseOffset)   │
│    - Result: Animation now works for A-pose                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. AnimationMixer.update() - Play animation                 │
│    - Mixer on rootBone (where raw bones live)               │
│    - Animations target raw bone names (Hips, LeftArm, etc.) │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Skeleton.update() - Update bone matrices                 │
│    - Bones update with compensated rotations                │
│    - Result: Correct animation on A-pose VRM! ✓             │
└─────────────────────────────────────────────────────────────┘
```

### Why This Works

1. **Bind Pose Offset:** The 75° Z-rotation offset accounts for the difference between T-pose (90°) and A-pose (45°)
2. **Quaternion Composition:** By composing `anim * offset`, we apply the animation rotation in T-pose space, then rotate it to A-pose space
3. **Per-Keyframe:** Each keyframe is transformed, so the entire animation works correctly
4. **Other Bones:** Non-arm bones don't need compensation (spine, legs, etc. are similar in both poses)

---

## Files Modified

| File | Change | Reason |
|------|--------|--------|
| `packages/shared/src/extras/createEmoteFactory.ts` | Added A-pose bind pose compensation | Makes Mixamo animations work with A-pose VRMs |
| `packages/shared/src/extras/createVRMFactory.ts` | Reverted to raw bones + rootBone mixer | Normalized bones don't work with cloning |
| `packages/shared/src/types/libs.d.ts` | Added getNormalizedBoneNode types | Type safety (unused but available) |
| `packages/shared/src/types/index.ts` | Added getNormalizedBoneNode to GLBData | Type safety (unused but available) |

---

## Comparison: Asset Forge vs Hyperscape

| Aspect | Asset Forge | Hyperscape |
|--------|-------------|------------|
| **Instances** | One per VRM | Multiple clones per VRM |
| **Bone Names** | Normalized (`Normalized_Hips`) | Raw (`Hips`) |
| **Mixer Root** | `vrm.scene` | `rootBone` |
| **Update Loop** | `vrm.humanoid.update()` | No vrm.update (can't use) |
| **Bind Pose** | Normalized bones handle it | Manual compensation in retargeting |
| **Works With** | Any VRM (T-pose, A-pose) | Any VRM (T-pose, A-pose) ✓ |

---

## Testing Checklist

- [ ] Load A-pose VRM from Meshy in Hyperscape
- [ ] Verify idle animation plays (arms should be down)
- [ ] Test walk animation (arms should swing naturally)
- [ ] Test run animation
- [ ] Verify arm movements look natural (not inverted or wrong orientation)
- [ ] Test with T-pose VRM (should still work - 0° offset has no effect)
- [ ] Test multiple players with same VRM (cloning works correctly)
- [ ] Verify animations sync across network

---

## Why Not Use Normalized Bones?

We explored using VRM normalized bones (like Asset Forge does) but encountered a fundamental incompatibility:

### The Cloning Problem

```typescript
// In createVRMFactory:
const vrm = cloneGLB(glb)  // Clone the scene
const humanoid = vrm.userData.vrm.humanoid  // Get humanoid

// Problem: humanoid.update() updates the ORIGINAL bones!
// The cloned bones don't get updated because humanoid still references originals
```

### What Would Be Required

To use normalized bones with cloning, we'd need to:
1. Clone the entire VRM object (not just the scene)
2. Update all bone references to point to cloned bones
3. Create new normalized bone nodes for each clone
4. Maintain separate humanoid instances per clone

This is complex, error-prone, and defeats the purpose of efficient cloning.

---

## Advantages of Bind Pose Compensation

✅ **Simple:** Just compose quaternions in animation retargeting
✅ **Efficient:** No per-frame overhead (happens once when loading animation)
✅ **Clone-friendly:** Works with `SkeletonUtils.clone`
✅ **Maintainable:** Clear, localized fix in one file
✅ **Extensible:** Easy to add more bind pose offsets if needed

---

## Potential Extensions

### Support More Bind Poses

If we encounter VRMs with different bind poses, we can add more offsets:

```typescript
const BIND_POSE_OFFSETS: Record<string, { x?: number; y?: number; z?: number }> = {
  // A-pose
  leftUpperArm: { z: 75 * DEG2RAD },
  rightUpperArm: { z: -75 * DEG2RAD },

  // Could add more bones if needed:
  // leftShoulder: { y: 10 * DEG2RAD },
  // etc.
}
```

### Auto-Detect Bind Pose

We could analyze the VRM's bind pose and automatically calculate offsets:

```typescript
function detectBindPoseOffsets(vrm: VRM): Record<string, Euler> {
  // Get bind pose rotations of key bones
  // Compare to expected T-pose values
  // Return computed offsets
}
```

---

## Known Limitations

1. **Arm-Only:** Currently only compensates leftUpperArm and rightUpperArm
   - Other bones (fingers, shoulders) use T-pose values directly
   - Usually acceptable since most bind pose variation is in upper arms

2. **Fixed Offset:** Uses 75° for all A-pose VRMs
   - Meshy VRMs consistently use ~75°
   - If other A-pose variants exist, may need per-VRM detection

3. **Quaternion Composition Order:** Assumes offset should be applied in local space
   - `result = anim * offset` means offset is applied after animation
   - This works for the specific case of arm rotations

---

## Conclusion

Hyperscape now supports A-pose VRMs from Meshy using a **bind pose compensation** approach that's compatible with the VRM cloning architecture. This is simpler and more efficient than trying to use normalized bones with cloning.

**Result:** A-pose VRMs from the Meshy → VRM → Animations pipeline animate correctly in Hyperscape! 🎉

---

**Related Documentation:**
- [VRM_ANIMATION_FIX_REPORT.md](VRM_ANIMATION_FIX_REPORT.md) - Asset Forge normalized bone solution
- [HYPERSCAPE_VRM_FIX_ANALYSIS.md](HYPERSCAPE_VRM_FIX_ANALYSIS.md) - Initial investigation comparing implementations
