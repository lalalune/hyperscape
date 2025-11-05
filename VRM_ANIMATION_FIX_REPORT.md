# VRM Animation Fix Report - A-Pose Support

**Date:** November 3, 2025
**Issue:** Animations not working on A-pose VRMs from Meshy
**Status:** ✅ RESOLVED

---

## Executive Summary

A-pose VRMs exported from Meshy were not animating correctly in the VRM Test Viewer. After analyzing working implementations from the `three-avatar` and `vrm-mixamo-viewer-waita` repositories, we discovered that our implementation was missing the VRM library's **normalized bone node system**.

### Solution Overview
Switched from using raw bone names + Armature root to using normalized bone names + vrm.scene root + vrm.update() propagation, matching the industry-standard approach used by working VRM animation viewers.

---

## The Problem

### Initial Symptoms
- A-pose VRMs loaded correctly (model visible, bind pose preserved)
- Animation tracks were created successfully
- AnimationMixer was updating
- **BUT: No visible animation occurred**

### Debug Evidence
```javascript
[Frame 60] Hips rotation:
  Before mixer.update(): [0.506, -0.333, 0.562, 0.562]
  After mixer.update(): [0.506, -0.333, 0.562, 0.562]
  Mixer changed rotation: false  ← NO CHANGE!
```

The mixer was running but bones weren't moving.

---

## Root Cause Analysis

### What We Were Doing (INCORRECT ❌)
1. Using raw bone names in animation tracks (`Hips.quaternion`)
2. AnimationMixer root set to `Armature` (parent of bones)
3. NOT calling `vrm.update(deltaTime)`

### Why It Failed
We were bypassing the VRM library's **normalized bone abstraction layer**, which:
- Automatically handles bind pose transformations
- Compensates for differences between T-pose and A-pose
- Provides a consistent animation interface regardless of the VRM's actual bind pose

Without using this system, the Mixamo-side compensation produced near-identity quaternions like `[-0.029, -0.011, -0.015, 0.999]` that essentially did nothing.

---

## The Solution - Three Critical Changes

### Change 1: Use Normalized Bone Names

**File:** `packages/asset-forge/src/services/retargeting/AnimationRetargeting.ts:127-130`

**Before:**
```typescript
const getBoneName = (vrmBoneName: string): string | undefined => {
  const normalizedNode = humanoid?.getNormalizedBoneNode(vrmBoneName as any)
  // Extract the RAW bone from the normalized wrapper
  const rawNode = (normalizedNode as any)?.node || humanoid?.getRawBoneNode(vrmBoneName as any)
  return rawNode?.name  // Returns "Hips", "Spine", etc.
}
```

**After:**
```typescript
const getBoneName = (vrmBoneName: string): string | undefined => {
  const normalizedNode = humanoid?.getNormalizedBoneNode(vrmBoneName as any)
  return normalizedNode?.name  // Returns "Normalized_Hips", "Normalized_Spine", etc.
}
```

**Result:** Animation tracks now target normalized bones:
- `Normalized_Hips.quaternion`
- `Normalized_Spine.quaternion`
- `Normalized_LeftArm.quaternion`
- etc.

---

### Change 2: Set AnimationMixer Root to vrm.scene

**File:** `packages/asset-forge/src/components/VRMTestViewer.tsx:334-335`

**Before:**
```typescript
// Mixer on Armature (where raw bones live)
const armature = skinnedMesh.parent
mixer = new THREE.AnimationMixer(armature)
```

**After:**
```typescript
// Mixer on vrm.scene (where normalized bones live)
mixer = new THREE.AnimationMixer(vrm.scene)
```

**Why:** Normalized bone nodes exist in the VRM scene graph, not in the Armature hierarchy. The mixer needs to be rooted where it can find the `Normalized_*` nodes.

---

### Change 3: Call vrm.update() to Propagate Transforms

**File:** `packages/asset-forge/src/components/VRMTestViewer.tsx:378-382`

**Before:**
```typescript
// Update animation mixer
if (mixer) {
  mixer.update(deltaTime)
}

// DON'T call vrm.update() - it resets animations! (WRONG!)
// if (vrm) {
//   vrm.update(deltaTime)
// }
```

**After:**
```typescript
// Update animation mixer
if (mixer) {
  mixer.update(deltaTime)
}

// Update VRM normalized bones - REQUIRED when using normalized bone animation
// This propagates normalized bone transforms to the actual skeleton bones
if (vrm) {
  vrm.update(deltaTime)
}
```

**Why:** This was the **critical missing piece**. Without `vrm.update()`:
1. AnimationMixer animates `Normalized_Hips` node ✓
2. Quaternion values change on the normalized node ✓
3. **BUT** those changes never propagate to the actual `Hips` bone ✗
4. Visual skeleton remains frozen ✗

With `vrm.update()`:
1. AnimationMixer animates `Normalized_Hips` node ✓
2. `vrm.update()` copies transforms from normalized nodes to raw bones ✓
3. Visual skeleton updates and animates ✓

---

## How It Works - The Complete Flow

### Animation Pipeline with Normalized Bones

```
┌─────────────────────────────────────────────────────────────┐
│ 1. AnimationMixer.update(deltaTime)                         │
│    - Reads tracks: Normalized_Hips.quaternion               │
│    - Updates: Normalized_Hips node quaternion               │
│    - Location: vrm.scene hierarchy (normalized layer)       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. vrm.update(deltaTime)                                    │
│    - Propagates transforms from normalized nodes            │
│    - Target: Raw skeleton bones (Hips, Spine, etc.)        │
│    - Applies bind pose compensation automatically           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. skinnedMesh.skeleton.update()                            │
│    - Updates bone matrices for skinning                     │
│    - Deforms mesh vertices                                  │
│    - Result: Visible animation!                             │
└─────────────────────────────────────────────────────────────┘
```

### The Normalized Bone Abstraction Layer

The VRM library's normalized bones provide:

1. **Automatic Bind Pose Handling:** Whether the VRM is in T-pose or A-pose, the normalized layer presents a consistent T-pose interface
2. **Mixamo Compatibility:** Mixamo animations (which expect T-pose) work directly without additional compensation
3. **Inverse Bind Matrix Management:** The library handles all the complex matrix math internally

---

## Reference Implementations

### three-avatar Repository
**URL:** https://github.com/VerseEngine/three-avatar

**Key Code (src/mixamo.ts:92-109):**
```typescript
export function convertForVrm(
  asset: THREE.Group,
  vrm: THREE_VRM.VRM,
  name: string
) {
  const clip = THREE.AnimationClip.findByName(asset.animations, "mixamo.com").clone();

  clip.tracks.forEach((track) => {
    const mixamoRigName = trackSplitted[0];
    const boneName = mixamoVRMRigMap[mixamoRigName];

    // KEY: Uses normalized bone node names
    const nodeName = vrm.humanoid?.getNormalizedBoneNode(boneName)?.name;

    // Creates tracks targeting normalized nodes
    tracks.push(
      new THREE.QuaternionKeyframeTrack(
        `${nodeName}.${propertyName}`,  // e.g., "Normalized_Hips.quaternion"
        track.times,
        transformedValues
      )
    );
  });

  return new THREE.AnimationClip(name, clip.duration, tracks);
}
```

**And in their animation loop:**
```typescript
// Mixer on vrm root object
this._mixer = new THREE.AnimationMixer(this._object3D);

// Update loop includes vrm.update()
this._mixer.update(deltaTime);
vrm.update(deltaTime);  // Propagates to skeleton
```

---

## Verification

### Before Fix
```
Animation tracks: ["Hips.quaternion", "Spine.quaternion", ...]
Mixer root: Armature
vrm.update() called: NO
Result: No animation (bones frozen)
```

### After Fix
```
Animation tracks: ["Normalized_Hips.quaternion", "Normalized_Spine.quaternion", ...]
Mixer root: vrm.scene
vrm.update() called: YES
Result: Animations work perfectly! ✓
```

### Console Output (Working)
```
[AnimationRetargeting] Retargeting: mixamorigHips -> hips -> Normalized_Hips
[AnimationRetargeting] Retargeting: mixamorigSpine -> spine -> Normalized_Spine
[VRMTestViewer] Created AnimationMixer on vrm.scene
[Frame 60] Animation time: 0.73 / 12.04
[Frame 60] Hips rotation changed: true  ← ANIMATIONS WORKING!
```

---

## Why Previous Attempts Failed

### Attempt 1: Raw Bones + Armature Root
- Problem: Mixamo-side compensation didn't work correctly
- Result: Near-identity quaternions, no visible animation

### Attempt 2: resetNormalizedPose()
- Problem: Reset bind pose to T-pose but broke A-pose VRMs
- Result: Mesh deformation, incorrect skeleton alignment

### Attempt 3: Manual Bind Pose Compensation
- Problem: Complex quaternion math was error-prone
- Result: Incorrect rotations, gimbal lock issues

### Final Solution: Use VRM Library's Built-in System
- Approach: Use normalized bones as intended by @pixiv/three-vrm
- Result: Works perfectly for both T-pose and A-pose VRMs ✓

---

## Files Modified

### 1. AnimationRetargeting.ts
**Lines:** 127-130
**Change:** Return normalized bone node name instead of raw bone name

### 2. VRMTestViewer.tsx
**Lines:** 334-335
**Change:** Create AnimationMixer on `vrm.scene` instead of `armature`

**Lines:** 378-382
**Change:** Call `vrm.update(deltaTime)` after `mixer.update(deltaTime)`

---

## Key Learnings

### 1. Trust the Library's Abstraction
The VRM library provides normalized bones for a reason - they handle the complexity of different bind poses automatically. Trying to bypass this system causes more problems than it solves.

### 2. Reference Working Implementations
Analyzing `three-avatar` and `vrm-mixamo-viewer-waita` was crucial. They both use the same pattern:
- Normalized bone names in tracks
- Mixer on vrm root
- Call `vrm.update()` in animation loop

### 3. The Importance of vrm.update()
This single line was the difference between "animations don't work" and "animations work perfectly". Without it, normalized bone changes never reach the visible skeleton.

---

## Testing Checklist

- [x] A-pose VRMs load correctly
- [x] T-pose VRMs still work (backward compatibility)
- [x] Idle animation plays smoothly
- [x] Walk animation plays smoothly
- [x] Animation transitions work
- [x] Bone rotations update every frame
- [x] No mesh deformation or artifacts
- [x] Works with VRM 1.0 format
- [x] Matches behavior of online VRM viewers

---

## Conclusion

By adopting the industry-standard approach of using VRM normalized bones, we achieved full compatibility with both T-pose and A-pose VRMs. The three changes work together:

1. **Normalized bone names** → Target the abstraction layer
2. **Mixer on vrm.scene** → Find normalized nodes
3. **vrm.update() call** → Propagate to visible skeleton

This solution is simple, maintainable, and leverages the VRM library's built-in bind pose handling instead of trying to reimplement it ourselves.

**Result:** A-pose VRMs from Meshy now animate perfectly, just like they do in online VRM viewers! ✨
