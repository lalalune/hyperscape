# Hyperscape VRM Animation Fix Analysis

**Date:** November 3, 2025
**Issue:** VRM avatars from Meshy → VRM → Animations pipeline not animating correctly in Hyperscape world
**Status:** 🔍 ANALYSIS COMPLETE - FIX REQUIRED

---

## Executive Summary

The Asset Forge VRM viewer implementation **works correctly** with A-pose VRMs from Meshy, while the Hyperscape world implementation **does not work**. After deep analysis, I've identified **3 critical differences** between the working and broken implementations.

The Asset Forge was already fixed (see [VRM_ANIMATION_FIX_REPORT.md](VRM_ANIMATION_FIX_REPORT.md)) using the industry-standard normalized bone approach. The Hyperscape world code needs the **same 3 changes** to work correctly.

---

## Root Cause: Missing VRM Normalized Bone System

### The Problem

Hyperscape's VRM implementation bypasses the VRM library's **normalized bone abstraction layer**, which:
- Automatically handles bind pose transformations (T-pose vs A-pose)
- Provides consistent animation interface regardless of bind pose
- Propagates normalized bone transforms to visible skeleton

Without this system, animations fail to display because:
1. Animation tracks target raw bones instead of normalized bones
2. AnimationMixer is rooted on wrong object (SkinnedMesh instead of vrm.scene)
3. Missing `vrm.update()` call means transforms never propagate to visible skeleton

---

## Comparison: Working vs Broken

### ✅ Working Implementation (Asset Forge)

**File:** `packages/asset-forge/src/components/VRMTestViewer.tsx`

#### Change 1: Use Normalized Bone Names (Line 127-130)
```typescript
// AnimationRetargeting.ts
const getBoneName = (vrmBoneName: string): string | undefined => {
  const normalizedNode = humanoid?.getNormalizedBoneNode(vrmBoneName as any)
  return normalizedNode?.name  // Returns "Normalized_Hips", "Normalized_Spine", etc.
}
```

#### Change 2: AnimationMixer on vrm.scene (Line 334-335)
```typescript
// VRMTestViewer.tsx
mixer = new THREE.AnimationMixer(vrm.scene)  // ✓ Correct
```

#### Change 3: Call vrm.update() in Animation Loop (Lines 378-382)
```typescript
// Update animation mixer
if (mixer) {
  mixer.update(deltaTime)
}

// Update VRM normalized bones - REQUIRED!
if (vrm) {
  vrm.update(deltaTime)  // ✓ This propagates to skeleton
}
```

### ❌ Broken Implementation (Hyperscape)

**File:** `packages/shared/src/extras/createVRMFactory.ts`

#### Issue 1: Uses Raw Bone Names (Lines 182-186)
```typescript
const getBoneName = (vrmBoneName: string): string | undefined => {
  if (!humanoid) return undefined
  const node = humanoid.getRawBoneNode?.(vrmBoneName)  // ❌ WRONG - uses raw bones
  return node?.name  // Returns "Hips", "Spine" instead of normalized
}
```

**Result:** Animation tracks target `Hips.quaternion` instead of `Normalized_Hips.quaternion`

#### Issue 2: AnimationMixer on SkinnedMesh (Line 286)
```typescript
// i have no idea how but the mixer only needs one of the skinned meshes
// and if i set it to vrm.scene it no longer works with detached bind mode
const mixer = new THREE.AnimationMixer(skinnedMeshes[0])  // ❌ WRONG
```

**Comment says:** "if i set it to vrm.scene it no longer works with detached bind mode"
**Reality:** It MUST be on vrm.scene when using normalized bones. The comment is based on testing with raw bones.

**Result:** Mixer can't find `Normalized_*` nodes because they live in vrm.scene hierarchy

#### Issue 3: Missing vrm.update() Call (Lines 316-326)
```typescript
const update = delta => {
  // ... LOD logic ...

  if (should) {
    if (mixer) {
      mixer.update(elapsed)  // ✓ This updates normalized bones
    }
    skeleton.bones.forEach(bone => bone.updateMatrixWorld())
    skeleton.update()

    // ❌ MISSING: vrm.update(elapsed) - Never propagates to visible skeleton!
    // tvrm.humanoid.update(elapsed)  // ← Commented out!

    elapsed = 0
  }
}
```

**Result:** Normalized bone transforms never reach the actual skeleton bones. Avatar remains frozen.

---

## The Complete Animation Pipeline

### How It SHOULD Work (with normalized bones)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. AnimationMixer.update(deltaTime)                         │
│    - Reads tracks: Normalized_Hips.quaternion               │
│    - Updates: Normalized_Hips node quaternion               │
│    - Location: vrm.scene hierarchy (normalized layer)       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. vrm.update(deltaTime) OR vrm.humanoid.update(deltaTime)  │
│    - Propagates transforms from normalized nodes            │
│    - Target: Raw skeleton bones (Hips, Spine, etc.)        │
│    - Applies bind pose compensation automatically           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. skeleton.update()                                        │
│    - Updates bone matrices for skinning                     │
│    - Deforms mesh vertices                                  │
│    - Result: Visible animation! ✓                           │
└─────────────────────────────────────────────────────────────┘
```

### How It's Currently Failing (Hyperscape)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. AnimationMixer.update(deltaTime)                         │
│    - Tries to read tracks: Hips.quaternion                  │
│    - Mixer root: skinnedMeshes[0]                           │
│    - Can't find raw bones in SkinnedMesh hierarchy          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. [MISSING] vrm.update(deltaTime)                          │
│    - Never called!                                          │
│    - Normalized bones never propagate to skeleton           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. skeleton.update()                                        │
│    - Updates matrices but bone transforms never changed     │
│    - Result: No visible animation ✗                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Required Fixes to Hyperscape Code

### Fix 1: Update getBoneName to Use Normalized Bones

**File:** `packages/shared/src/extras/createVRMFactory.ts`
**Lines:** 182-186

**Current (BROKEN):**
```typescript
const getBoneName = (vrmBoneName: string): string | undefined => {
  if (!humanoid) return undefined
  const node = humanoid.getRawBoneNode?.(vrmBoneName)
  return node?.name
}
```

**Required Change:**
```typescript
const getBoneName = (vrmBoneName: string): string | undefined => {
  if (!humanoid) return undefined
  const normalizedNode = humanoid.getNormalizedBoneNode?.(vrmBoneName as any)
  return normalizedNode?.name  // Returns normalized bone node name
}
```

**Why:** Animation tracks must target normalized bones like `Normalized_Hips.quaternion` instead of raw bones.

---

### Fix 2: Change AnimationMixer Root to vrm.scene

**File:** `packages/shared/src/extras/createVRMFactory.ts`
**Line:** 286

**Current (BROKEN):**
```typescript
// i have no idea how but the mixer only needs one of the skinned meshes
// and if i set it to vrm.scene it no longer works with detached bind mode
const mixer = new THREE.AnimationMixer(skinnedMeshes[0])
```

**Required Change:**
```typescript
// AnimationMixer must be on vrm.scene to find normalized bone nodes
// Detached bind mode is independent of mixer root
const mixer = new THREE.AnimationMixer(vrm.scene)
```

**Why:** Normalized bone nodes exist in the vrm.scene hierarchy, not in the SkinnedMesh. The mixer needs to be rooted where it can find `Normalized_*` nodes.

**Note:** The comment about detached bind mode is incorrect. Detached bind mode affects how skeleton matrices are calculated, not where the mixer should be rooted.

---

### Fix 3: Add vrm.update() Call to Animation Loop

**File:** `packages/shared/src/extras/createVRMFactory.ts`
**Lines:** 316-326

**Current (BROKEN):**
```typescript
if (should) {
  if (mixer) {
    mixer.update(elapsed)
  }
  skeleton.bones.forEach(bone => bone.updateMatrixWorld())

  // Update the skeleton after updating bones
  skeleton.update()

  skeleton.update = THREE.Skeleton.prototype.update
  // tvrm.humanoid.update(elapsed)  // ← COMMENTED OUT!
  elapsed = 0
}
```

**Required Change:**
```typescript
if (should) {
  if (mixer) {
    mixer.update(elapsed)
  }

  // CRITICAL: Propagate normalized bone transforms to skeleton
  if (_tvrm?.humanoid) {
    _tvrm.humanoid.update(elapsed)
  }

  skeleton.bones.forEach(bone => bone.updateMatrixWorld())
  skeleton.update()

  skeleton.update = THREE.Skeleton.prototype.update
  elapsed = 0
}
```

**Why:** Without `vrm.humanoid.update()`, the transforms on normalized bones never propagate to the actual skeleton bones. This is the **critical missing piece** that makes animations work.

**Order Matters:** Must call `vrm.humanoid.update()` BEFORE `skeleton.update()` so skeleton has the latest bone transforms.

---

## Additional Considerations

### Detached Bind Mode Compatibility

The current code uses `THREE.DetachedBindMode` for performance (lines 118-124). This is **compatible** with normalized bones:

- Detached bind mode affects how `skeleton.update()` calculates bone matrices
- Normalized bones are a separate abstraction layer that sits on top
- The two systems work together without conflict

The Asset Forge working implementation also manually updates skeleton after vrm.update():

```typescript
// VRMTestViewer.tsx:378-410
if (mixer) {
  mixer.update(deltaTime)
}

if (vrm) {
  vrm.update(deltaTime)  // Propagates normalized → raw bones
}

// Manual skeleton update (like Hyperscape does)
if (skinnedMesh) {
  skinnedMesh.skeleton.bones.forEach(bone => bone.updateMatrixWorld())
  skinnedMesh.skeleton.update()
}
```

This proves normalized bones work fine with manual skeleton updates.

### LOD System Compatibility

The LOD system (distance-based update rate) is **compatible** with normalized bones:

```typescript
// LOD logic determines if (should) update
if (should) {
  mixer.update(elapsed)
  _tvrm.humanoid.update(elapsed)  // ← Just add this line
  skeleton.bones.forEach(bone => bone.updateMatrixWorld())
  skeleton.update()
}
```

No changes needed to LOD logic, just add the missing vrm.update() call.

### Performance Impact

Adding `vrm.humanoid.update()` has **minimal performance impact**:

- It's a simple transform propagation from normalized nodes to raw bones
- Only runs when LOD allows updates (respects existing performance optimizations)
- The Asset Forge uses this in real-time with smooth 60fps playback

---

## Testing Checklist

After applying the 3 fixes, verify:

- [ ] A-pose VRMs from Meshy load and display correctly
- [ ] Idle animation plays on avatar
- [ ] Walk/run animations play smoothly
- [ ] Animation transitions work (idle → walk → idle)
- [ ] Emotes load and play via setEmote()
- [ ] No mesh deformation or visual artifacts
- [ ] Multiple avatars can play different animations simultaneously
- [ ] LOD system still works (far avatars update less frequently)
- [ ] Performance is acceptable (no major FPS drops)

---

## Reference Implementations

### three-avatar Repository
**URL:** https://github.com/VerseEngine/three-avatar

Uses normalized bones with mixer on vrm root:
```typescript
this._mixer = new THREE.AnimationMixer(this._object3D)
this._mixer.update(deltaTime)
vrm.update(deltaTime)  // Propagates to skeleton
```

### Asset Forge (Already Fixed)
**Files:**
- `packages/asset-forge/src/components/VRMTestViewer.tsx` - Working viewer
- `packages/asset-forge/src/services/retargeting/AnimationRetargeting.ts` - Working retargeting

Matches the three-avatar pattern exactly.

---

## Summary of Changes Required

| File | Line | Change | Reason |
|------|------|--------|--------|
| `createVRMFactory.ts` | 182-186 | Use `getNormalizedBoneNode()` instead of `getRawBoneNode()` | Animation tracks must target normalized bones |
| `createVRMFactory.ts` | 286 | Change `new THREE.AnimationMixer(skinnedMeshes[0])` to `new THREE.AnimationMixer(vrm.scene)` | Mixer must be rooted where normalized bones exist |
| `createVRMFactory.ts` | 316-326 | Add `_tvrm.humanoid.update(elapsed)` before skeleton.update() | Propagate normalized transforms to visible skeleton |

**Total Lines Changed:** ~10 lines
**Risk Level:** Low (matches proven working implementation)
**Expected Result:** VRM animations will work exactly like they do in Asset Forge

---

## Key Learnings

### 1. Trust the VRM Library's Abstraction
The `@pixiv/three-vrm` library provides normalized bones specifically to handle different bind poses (T-pose vs A-pose). Using raw bones bypasses this system and causes animations to fail.

### 2. vrm.update() is NOT Optional
The documentation and working examples all call `vrm.update()` in the animation loop. This isn't a "nice to have" - it's **required** when using the normalized bone system.

### 3. Mixer Root Must Match Animation Targets
If animation tracks target `Normalized_Hips.quaternion`, the mixer must be rooted on an object that contains the `Normalized_Hips` node (vrm.scene). If mixer root is `skinnedMeshes[0]`, it can't find the normalized nodes.

---

## Conclusion

The fix is straightforward: apply the **same 3 changes** that were already made to fix the Asset Forge:

1. **Normalized bone names** → Target the abstraction layer
2. **Mixer on vrm.scene** → Find normalized nodes
3. **Call vrm.update()** → Propagate to visible skeleton

These changes work together as a system. All 3 must be present for animations to work.

The Asset Forge proves this approach works perfectly with the Meshy → VRM → Animations pipeline. Hyperscape just needs to use the same pattern.

**Next Step:** Apply the 3 fixes to `createVRMFactory.ts` and test with a VRM from Meshy.
