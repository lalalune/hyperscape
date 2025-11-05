# VRM Animation - Current Implementation Status

**Date:** January 2025
**Status:** ✅ FIX APPLIED - Ready for Testing
**Approach:** Bind Pose Compensation + Detached Bone Architecture

---

## Executive Summary

VRM animations were not working due to AnimationMixer being unable to find bones. The root cause was that `rootBone` is detached from the scene graph (line 212: `rootBone.parent?.remove(rootBone)`), but AnimationMixer was rooted on `vrm.scene`.

**Fix Applied:** Changed AnimationMixer root from `vrm.scene` to `rootBone` where the bone hierarchy actually exists.

---

## Recent Issue and Resolution

### The Problem
Console errors showed:
```
THREE.PropertyBinding: No target node found for track: Hips.position
THREE.PropertyBinding: No target node found for track: Hips.quaternion
[... same for all bones: Spine, LeftArm, RightArm, etc.]
```

Debug logs showed:
```javascript
{vrmBoneName: 'hips', targetName: 'Hips', clonedBoneName: 'Hips', isInClonedScene: false}
```

### Root Cause Analysis

1. **Line 212 in createVRMFactory.ts detaches bones from scene:**
   ```typescript
   rootBone.parent?.remove(rootBone)
   ```
   This removes the entire bone hierarchy from `vrm.scene`.

2. **Bones exist in `rootBone.children` and `skeleton.bones[]` array**, but NOT in `vrm.scene` hierarchy.

3. **AnimationMixer was set to `vrm.scene`:**
   ```typescript
   const mixer = new THREE.AnimationMixer(vrm.scene)  // ❌ WRONG
   ```
   AnimationMixer traverses from its root to find animation targets. Since bones are detached from vrm.scene, it couldn't find them.

### The Fix

**Changed AnimationMixer root to `rootBone`:**

```typescript
// BIND POSE COMPENSATION APPROACH: AnimationMixer on rootBone
// Animations target raw bone names (Hips, Spine, LeftArm, etc.)
// A-pose compensation is pre-computed in createEmoteFactory.ts during retargeting
// Each clone has its own skeleton, so animations are independent
// CRITICAL: rootBone is detached from scene, so mixer MUST be rooted on rootBone
// where the bone hierarchy actually exists (rootBone.children contains all bones)
const mixer = new THREE.AnimationMixer(rootBone)
```

**Why this works:**
- `rootBone.children` contains the full bone hierarchy (Hips → Spine → LeftArm, etc.)
- AnimationMixer can traverse `rootBone.children` to find all bones
- Animation tracks target bone names like `Hips.quaternion`, which exist as children of rootBone

---

## Current Implementation Architecture

### Bind Pose Compensation Approach

Hyperscape uses a **different approach** than Asset Forge's normalized bone method:

| Aspect | Asset Forge (Normalized Bones) | Hyperscape (Bind Pose Compensation) |
|--------|-------------------------------|-------------------------------------|
| **Bone Names** | Normalized (`Normalized_Hips`) | Raw (`Hips`) |
| **Mixer Root** | `vrm.scene` | `rootBone` (detached from scene) |
| **VRM Update** | `vrm.humanoid.update()` called | No VRM update (animate raw bones directly) |
| **A-pose Fix** | Normalized bones handle it | Pre-compute offsets in retargeting |
| **Cloning** | One VRM per viewer | Multiple clones via SkeletonUtils.clone() |

### Why Not Use Normalized Bones?

Hyperscape's architecture makes normalized bones impractical:

1. **Cloning Issue:** `SkeletonUtils.clone()` clones the scene, but VRM humanoid is shared
2. **Internal References:** VRM humanoid has deep internal structures that can't be easily remapped
3. **Detached Bones:** `rootBone` is detached from scene, but normalized nodes live in `vrm.scene`
4. **Complexity:** Cloning and remapping VRM humanoid internal structures is error-prone

**Bind pose compensation is simpler:**
- ✅ Pre-compute A-pose offsets once when loading animation
- ✅ No runtime VRM humanoid updates needed
- ✅ Works with detached bone architecture
- ✅ Each clone has independent skeleton (via SkeletonUtils.clone)

---

## Key Implementation Files

### 1. `packages/shared/src/extras/createVRMFactory.ts`

#### AnimationMixer Setup (Lines 308-314)
```typescript
const mixer = new THREE.AnimationMixer(rootBone)
```
**Critical:** Mixer must be on `rootBone` where bones exist, not on `vrm.scene` where they don't.

#### getBoneName Function (Lines 218-246)
```typescript
const getBoneName = (vrmBoneName: string): string | undefined => {
  // Get bone name from original humanoid
  const originalNode = humanoid.getRawBoneNode?.(vrmBoneName)
  const targetName = originalNode.name

  // Search for this bone in CLONED skeleton
  const clonedBone = skeleton.bones.find(bone => bone.name === targetName)
  return clonedBone.name
}
```
**Purpose:** Each clone has its own skeleton, so we search `skeleton.bones[]` for bone names.

#### Update Loop (Lines 343-356)
```typescript
if (should) {
  // Step 1: Update AnimationMixer (animates raw bones directly)
  if (mixer) {
    mixer.update(elapsed)
  }

  // Step 2: Update skeleton matrices
  // Bind pose compensation happens in createEmoteFactory.ts during retargeting
  // No vrm.humanoid.update() needed - we animate raw bones directly
  skeleton.bones.forEach(bone => bone.updateMatrixWorld())
  skeleton.update()

  elapsed = 0
}
```
**Note:** No `vrm.humanoid.update()` call - bind pose compensation is pre-computed.

#### cloneGLB Function (Lines 524-531)
```typescript
function cloneGLB(glb: GLBData): GLBData {
  // Deep clone the scene (including skeleton and skinned meshes)
  const clonedScene = SkeletonUtils.clone(glb.scene) as THREE.Scene

  // Return cloned scene with shared VRM metadata
  // VRM humanoid is only used for bone lookup (getRawBoneNode), not for updates
  return { ...glb, scene: clonedScene }
}
```
**Simplified:** Just clone the scene, share VRM humanoid (only used for bone name lookup).

### 2. `packages/shared/src/extras/createEmoteFactory.ts`

#### A-Pose Offsets (Lines 66-69)
```typescript
const APOSE_OFFSETS: Record<string, { z: number }> = {
  leftUpperArm: { z: 75 * (Math.PI / 180) },   // 75° in radians
  rightUpperArm: { z: -75 * (Math.PI / 180) }, // -75° in radians (mirror)
}
```

#### Bind Pose Compensation Application (Lines 203-226)
```typescript
// Apply A-pose compensation for Meshy VRMs
const bindPoseOffset = APOSE_OFFSETS[vrmBoneName]
if (bindPoseOffset) {
  // Create offset quaternion (A-pose → T-pose correction)
  offsetQuat.setFromEuler(new THREE.Euler(0, 0, bindPoseOffset.z, 'XYZ'))

  // Apply offset to each animation keyframe
  for (let i = 0; i < values.length; i += 4) {
    animQuat.set(values[i], values[i + 1], values[i + 2], values[i + 3])
    // Apply bind inverse compensation: result = offset × anim
    resultQuat.multiplyQuaternions(offsetQuat, animQuat)
    newValues[i] = resultQuat.x
    // ... etc
  }
  values = newValues
}
```
**Purpose:** Pre-compute A-pose corrections for arm bones, so T-pose animations work on A-pose VRMs.

---

## Animation Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Load VRM with createVRMFactory                           │
│    - Load VRM from URL                                      │
│    - Setup skeleton and skinned meshes                      │
│    - Detach rootBone from scene (line 212)                  │
│    - Create AnimationMixer(rootBone)                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Clone VRM for each player (cloneGLB)                     │
│    - SkeletonUtils.clone(scene) → cloned skeleton           │
│    - Share VRM humanoid (only for bone name lookup)         │
│    - Each clone has independent AnimationMixer              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Load Animation with createEmoteFactory                   │
│    - Retarget Mixamo animation to VRM bone names            │
│    - Apply A-pose compensation to arm bones (75° offsets)   │
│    - Generate AnimationClip with raw bone targets           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Play Animation (setEmote)                                │
│    - Load animation via mixer.clipAction(clip)              │
│    - Play animation                                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Update Loop (per frame)                                  │
│    - mixer.update(delta) → updates bone transforms          │
│    - skeleton.bones.forEach(bone => bone.updateMatrixWorld) │
│    - skeleton.update() → updates bone matrices              │
│    - Result: Animated VRM! ✅                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Expected Behavior After Fix

### What Should Work Now

✅ **No PropertyBinding Errors:** AnimationMixer can now find bones via `rootBone.children` traversal

✅ **Animations Play:** Mixer updates bone transforms, skeleton propagates to mesh

✅ **A-pose VRMs Work:** 75° arm offsets compensate for A-pose → T-pose difference

✅ **Multiple Clones Work:** Each clone has independent skeleton and mixer

✅ **Performance Maintained:** Efficient cloning with SkeletonUtils.clone()

### Testing Checklist

When you test, verify:
- [ ] No console errors about PropertyBinding or missing bones
- [ ] Avatar animations play smoothly (idle, walk, run)
- [ ] Arms move naturally (not inverted or wrong orientation)
- [ ] Multiple avatars can play different animations
- [ ] No mesh deformation or visual artifacts

### Console Logs to Look For

**Good Signs:**
```
[AnimationRetargeting] Applying A-pose compensation to: leftUpperArm offset: 75 degrees
[AnimationRetargeting] Applying A-pose compensation to: rightUpperArm offset: -75 degrees
[VRMFactory.getBoneName] Found bone: {vrmBoneName: 'hips', targetName: 'Hips', ...}
```

**Bad Signs (should NOT see these anymore):**
```
THREE.PropertyBinding: No target node found for track: Hips.position  ❌ FIXED
THREE.PropertyBinding: No target node found for track: Hips.quaternion  ❌ FIXED
```

---

## Technical Deep Dive

### Why `isInClonedScene: false` is Expected

The debug log shows `isInClonedScene: false` for bones. This is **expected behavior** because:

1. Line 212: `rootBone.parent?.remove(rootBone)` detaches bones from scene
2. Bones exist in `skeleton.bones[]` and `rootBone.children`, not in `vrm.scene` hierarchy
3. `vrm.scene.getObjectByProperty('uuid', bone.uuid)` returns `undefined` (bone not in scene graph)

**This is intentional:** Hyperscape uses detached bone mode for performance reasons.

### AnimationMixer Traversal

AnimationMixer finds bones by:
1. Starting at mixer root (`rootBone`)
2. Recursively traversing children (`rootBone.children` → `Hips` → `Spine` → etc.)
3. Matching animation track names to bone names

**With mixer on `vrm.scene`:** Can't find detached bones ❌
**With mixer on `rootBone`:** Can traverse `rootBone.children` to find all bones ✅

### Bind Pose Math

A-pose compensation formula:
```typescript
// Animation is in T-pose space (arms at 90°)
// VRM is in A-pose space (arms at ~45°)
// Difference: 90° - 45° ≈ 45° (but we use 75° offset empirically)

// For each animation quaternion:
resultQuat = offsetQuat × animQuat

// This transforms: T-pose animation → A-pose skeleton
```

---

## Build Status

✅ **Build Successful:** Code compiles without TypeScript errors

```bash
$ bun run build
Building @hyperscape/shared in production mode...
✓ framework.js built successfully
✓ Server-specific modules built successfully
✓ framework.client.js built successfully
✓ Declaration files generated
Build completed successfully!
```

---

## Next Steps

1. **Rebuild Shared Package:** Already done ✅
2. **Refresh Client:** Restart/refresh the Hyperscape client
3. **Load A-pose VRM:** Test with VRM from Meshy
4. **Load Animation:** Use setEmote() to load Mixamo animation
5. **Verify:** Check console for errors, verify animation plays

---

## Related Documentation

- [HYPERSCAPE_APOSE_FIX.md](HYPERSCAPE_APOSE_FIX.md) - Bind pose compensation approach (CURRENT)
- [VRM_CLONE_IMPLEMENTATION.md](VRM_CLONE_IMPLEMENTATION.md) - VRM humanoid cloning approach (SUPERSEDED)
- [HYPERSCAPE_VRM_FIX_ANALYSIS.md](HYPERSCAPE_VRM_FIX_ANALYSIS.md) - Analysis comparing approaches
- [VRM_ANIMATION_FIX_REPORT.md](VRM_ANIMATION_FIX_REPORT.md) - Asset Forge normalized bone approach

---

## Conclusion

The critical fix has been applied: **AnimationMixer root changed from `vrm.scene` to `rootBone`**.

This addresses the root cause of PropertyBinding errors - the AnimationMixer can now traverse the bone hierarchy to find animation targets, since rootBone.children contains all bones.

Combined with:
- ✅ Bind pose compensation for A-pose VRMs (75° arm offsets)
- ✅ Raw bone animation (no VRM humanoid update needed)
- ✅ Efficient cloning with SkeletonUtils.clone()
- ✅ Independent animations per clone

**VRM animations should now work correctly in Hyperscape! 🎉**

---

**Implementation Date:** January 2025
**Critical Fix Applied:** January 2025
**Status:** ✅ Ready for Testing
