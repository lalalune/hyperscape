# VRM Loading in Hyperscape World - Complete Implementation Analysis

## Overview
VRM avatars are loaded and rendered in the Hyperscape game world through a multi-layer system involving the ClientLoader, Avatar nodes, VRMFactory, and player entity integration.

---

## 1. VRM LOADING PIPELINE

### Entry Point: ClientLoader.load('avatar', url)
**File**: `/ic-projects/hyperscape-project/hyperscape2/packages/shared/src/systems/ClientLoader.ts`

The ClientLoader is responsible for all client-side asset loading:

```typescript
// Lines 286-335: Avatar loading in ClientLoader
if (type === 'avatar') {
  const buffer = await file.arrayBuffer();
  const glb = await this.gltfLoader.parseAsync(buffer, '');
  
  const factoryBase = createVRMFactory(glb as GLBData, this.world.setupMaterial);
  const factory = {
    ...factoryBase,
    uid: file.name || `avatar_${Date.now()}`
  } as unknown as AvatarFactory;
  
  const hooks = this.vrmHooks;  // Camera, scene, octree, material setup
  const node = createNode('group', { id: '$root' });
  const node2 = createNode('avatar', { id: 'avatar', factory, hooks });
  node.add(node2);
  
  const avatar: LoadedAvatar = {
    uid: file.name || `avatar_${Date.now()}`,
    factory: factory,
    toNodes(customHooks) {
      const nodeMap = new Map<string, INode>();
      const clone = node.clone(true);
      if (customHooks) {
        const clonedAvatar = clone.get('avatar');
        if (clonedAvatar) {
          Object.assign(clonedAvatar, { hooks: customHooks });
        }
      }
      nodeMap.set('root', nodeToINode(clone));
      const clonedAvatarForMap = clone.get('avatar');
      if (clonedAvatarForMap) {
        nodeMap.set('avatar', nodeToINode(clonedAvatarForMap));
      }
      return nodeMap;
    },
    getStats() {
      const stats = node.getStats(true);
      stats.fileBytes = file.size;
      return stats;
    },
  };
  this.results.set(key, avatar);
  return avatar;
}
```

**Key Points**:
- Uses `@pixiv/three-vrm` VRMLoaderPlugin registered with GLTFLoader
- Creates a factory once per VRM model (shared across instances)
- Creates Avatar node and Group wrapper
- Suppresses VRM duplicate expression warnings
- Returns LoadedAvatar interface with factory and nodes

---

## 2. AVATAR NODE: VRM INSTANCE MANAGEMENT

**File**: `/ic-projects/hyperscape-project/hyperscape2/packages/shared/src/nodes/Avatar.ts`

The Avatar node is responsible for mounting and managing VRM instances:

```typescript
// Lines 45-100: Avatar.mount() - Creates VRM instance
async mount() {
  this.needsRebuild = false;
  if (this._src && this.ctx?.loader) {
    const n = ++this.n;
    let avatar = this.ctx.loader.get('avatar', this._src);
    if (!avatar) avatar = await this.ctx.loader.load('avatar', this._src);
    if (this.n !== n) return;
    
    const avatarData = avatar as { factory?: VRMAvatarFactory; hooks?: AvatarHooks };
    this.factory = avatarData?.factory ?? null;
    if (!this.hooks) {
      this.hooks = avatarData?.hooks ?? null;
    }
  }
  
  if (this.factory) {
    if (!this.instance) {
      const _vrmHooks = this.hooks as unknown as { 
        scene?: unknown; 
        octree?: unknown; 
        [key: string]: unknown 
      };
      
      // CRITICAL: Update matrix before passing to factory
      this.updateTransform();
      const worldPos = v1;
      worldPos.setFromMatrixPosition(this.matrixWorld);
      
      // Factory has typed create(matrix, hooks, node)
      this.instance = this.factory.create(this.matrixWorld, this.hooks ?? undefined, this);
      this.instance?.setEmote(this._emote);
      
      if (this._disableRateCheck && this.instance) {
        this.instance.disableRateCheck();
        this._disableRateCheck = false;
      }
      
      // Register as hot if instance implements HotReloadable
      const maybeHot = this.instance as Partial<HotReloadable>;
      if (this.ctx && maybeHot.update && maybeHot.fixedUpdate && maybeHot.postLateUpdate) {
        this.ctx.setHot(maybeHot as HotReloadable, true);
      }
      
      const instanceWithRaw = this.instance as unknown as { raw?: { scene?: THREE.Object3D } };
      if (instanceWithRaw?.raw?.scene && this.ctx?.stage?.scene) {
        const avatarScene = instanceWithRaw.raw.scene;
        if (!avatarScene.parent) {
          console.warn('[Avatar] Avatar scene has no parent! Manually adding to world.stage.scene');
          this.ctx.stage.scene.add(avatarScene);
        }
      }
      
      this._onLoad?.();
    } else {
      // Just update the existing instance
      this.instance?.move(this.matrixWorld);
    }
  }
}
```

**Key Features**:
- Loads avatar from ClientLoader or uses cached version
- Creates VRM instance via factory.create()
- Updates world transform before creation
- Manually adds avatar scene to world if needed
- Supports hot reloading with HotReloadable interface
- Handles emote playback and animation updates

---

## 3. VRM FACTORY: Core VRM Instance Creation

**File**: `/ic-projects/hyperscape-project/hyperscape2/packages/shared/src/extras/createVRMFactory.ts`

The factory creates and manages VRM instances with the following flow:

### Factory Creation (setupVRMScene)
```typescript
// Lines 82-213: createVRMFactory()
export function createVRMFactory(glb: GLBData, setupMaterial?: (material: THREE.Material) => void) {
  // Disable auto matrix updates for performance
  glb.scene.matrixAutoUpdate = false;
  glb.scene.matrixWorldAutoUpdate = false;
  
  // Remove expressions, humanoid rig, secondary elements
  const expressions = glb.scene.children.filter(n => n.type === 'VRMExpression');
  for (const node of expressions) node.removeFromParent();
  
  const vrmHumanoidRigs = glb.scene.children.filter(n => n.name === 'VRMHumanoidRig');
  for (const node of vrmHumanoidRigs) node.removeFromParent();
  
  const secondaries = glb.scene.children.filter(n => n.name === 'secondary');
  for (const node of secondaries) node.removeFromParent();
  
  // Enable shadows
  glb.scene.traverse(obj => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  
  // Calculate root to hips distance for animation retargeting
  const humanoid = glb.userData?.vrm?.humanoid;
  const bones = humanoid?._rawHumanBones?.humanBones || {};
  const hipsPosition = v1.setFromMatrixPosition(bones.hips?.node?.matrixWorld || new THREE.Matrix4());
  const rootPosition = v2.set(0, 0, 0);
  const rootToHips = hipsPosition.y - rootPosition.y;
  
  // Get VRM version for animation compatibility
  const vrmData = glb.userData?.vrm;
  const version = vrmData?.meta?.metaVersion;
  
  // Convert to detached bind mode for performance
  const skinnedMeshes: THREE.SkinnedMesh[] = [];
  glb.scene.traverse(node => {
    if (node instanceof THREE.SkinnedMesh) {
      const skinnedMesh = node;
      skinnedMesh.bindMode = THREE.DetachedBindMode;
      skinnedMesh.bindMatrix.copy(skinnedMesh.matrixWorld);
      skinnedMesh.bindMatrixInverse.copy(skinnedMesh.bindMatrix).invert();
      
      // CRITICAL: Must recalculate inverse matrices after changing bindMode
      if (skinnedMesh.skeleton) {
        skinnedMesh.skeleton.calculateInverses();
      }
      skinnedMeshes.push(skinnedMesh);
    }
    
    if (node instanceof THREE.Mesh) {
      const mesh = node;
      mesh.geometry.computeBoundsTree();
      
      // Fix CSM shadow banding
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => {
          (mat as THREE.Material & { shadowSide: THREE.Side }).shadowSide = THREE.BackSide;
        });
      } else {
        (mesh.material as THREE.Material & { shadowSide: THREE.Side }).shadowSide = THREE.BackSide;
      }
      
      // CSM material setup
      if (setupMaterial) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(mat => setupMaterial!(mat));
        } else {
          setupMaterial(mesh.material);
        }
      }
    }
  });
  
  const skeleton = skinnedMeshes[0].skeleton;
  
  // Pose arms down - prevent T-pose issues
  const normBones = humanoid?._normalizedHumanBones?.humanBones || {};
  const leftArm = normBones.leftUpperArm?.node;
  if (leftArm) {
    leftArm.rotation.z = 75 * DEG2RAD;
  }
  const rightArm = normBones.rightUpperArm?.node;
  if (rightArm) {
    rightArm.rotation.z = -75 * DEG2RAD;
  }
  if (humanoid?.update) {
    humanoid.update(0);
  }
  skeleton.update();
  
  // Calculate avatar height for collision
  let height = 0.5; // minimum
  for (const mesh of skinnedMeshes) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    height = Math.max(height, mesh.geometry.boundingBox!.max.y);
  }
  
  // Calculate head to height for animation retargeting
  const headPos = normBones.head?.node?.getWorldPosition(v1) || v1.set(0,0,0);
  const headToHeight = height - headPos.y;
  
  return {
    create,  // See below
    applyStats(stats: { geometries: Set<string>; materials: Set<string>; triangles: number; textureBytes: number }) {
      // Accumulate geometry and texture statistics
      glb.scene.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry && !stats.geometries.has(obj.geometry.uuid)) {
            stats.geometries.add(obj.geometry.uuid);
            stats.triangles += getTrianglesFromGeometry(obj.geometry);
          }
          if (obj.material) {
            const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
            materials.forEach(mat => {
              if (!stats.materials.has(mat.uuid)) {
                stats.materials.add(mat.uuid);
                stats.textureBytes += getTextureBytesFromMaterial(mat);
              }
            });
          }
        }
      });
    },
  };
}
```

### Instance Creation (create function)
```typescript
// Lines 215-470: create() - Instantiate a VRM
function create(matrix: THREE.Matrix4, hooks: VRMHooks, node?: { ctx?: { entity?: unknown } }) {
  // Clone the skeleton for this instance
  const vrm = cloneGLB(glb);
  const _tvrm = vrm.userData?.vrm;
  const skinnedMeshes = getSkinnedMeshes(vrm.scene as THREE.Scene);
  const skeleton = skinnedMeshes[0].skeleton;
  const rootBone = skeleton.bones[0];
  
  // Remove root bone and update matrices
  rootBone.parent?.remove(rootBone);
  rootBone.updateMatrixWorld(true);
  
  // Set scene matrix
  vrm.scene.matrix.copy(matrix);
  vrm.scene.matrixWorld.copy(matrix);
  vrm.scene.matrixAutoUpdate = false;
  vrm.scene.matrixWorldAutoUpdate = false;
  
  // CRITICAL: Add skeleton helper to visualize bones
  const skeletonHelper = new THREE.SkeletonHelper(vrm.scene);
  skeletonHelper.visible = true;
  
  // Add to scene
  if (hooks?.scene) {
    hooks.scene.add(vrm.scene);
    hooks.scene.add(skeletonHelper);
  } else if (alternateScene) {
    console.warn('[VRMFactory] WARNING: No scene in hooks, using alternate scene from node.ctx.stage.scene');
    alternateScene.add(vrm.scene);
  } else {
    console.error('[VRMFactory] ERROR: No scene available, VRM will not be visible!');
  }
  
  // Create animation mixer
  const mixer = new THREE.AnimationMixer(skinnedMeshes[0]);
  
  // Setup update function with LOD distance-based rate limiting
  const update = delta => {
    elapsed += delta;
    
    if (rateCheck) {
      // Periodically calculate update rate based on distance to camera
      rateCheckedAt += delta;
      if (rateCheckedAt >= DIST_CHECK_RATE) {
        const vrmPos = v1.setFromMatrixPosition(vrm.scene.matrix);
        const camPos = v2.setFromMatrixPosition((hooks.camera as THREE.Camera).matrixWorld);
        const distance = vrmPos.distanceTo(camPos);
        const clampedDistance = Math.max(distance - DIST_MIN, 0);
        const normalizedDistance = Math.min(clampedDistance / (DIST_MAX - DIST_MIN), 1);
        rate = DIST_MAX_RATE + normalizedDistance * (DIST_MIN_RATE - DIST_MAX_RATE);
        rateCheckedAt = 0;
      }
      should = elapsed >= rate;
    }
    
    if (should) {
      if (mixer) {
        mixer.update(elapsed);
      }
      skeleton.bones.forEach(bone => bone.updateMatrixWorld());
      skeleton.update();
      skeleton.update = THREE.Skeleton.prototype.update;
      elapsed = 0;
    } else {
      skeleton.update = noop;
    }
  };
  
  // Return instance interface
  return {
    raw: vrm,                     // Raw VRM scene
    height,                        // Total avatar height
    headToHeight,                  // Head to top height
    setEmote,                      // Play animation
    setFirstPerson,                // Hide head
    update: wrappedUpdate,         // Update skeleton
    getBoneTransform,              // Get bone position
    move(_matrix: THREE.Matrix4) {
      matrix.copy(_matrix);
      vrm.scene.matrix.copy(_matrix);
      vrm.scene.matrixWorld.copy(_matrix);
      vrm.scene.updateMatrixWorld(true);
      if (hooks?.octree && hooks.octree.move) {
        hooks.octree.move(sItem);
      }
    },
    disableRateCheck() {
      rateCheck = false;
    },
    destroy() {
      if (hooks?.scene) {
        hooks.scene.remove(vrm.scene);
      }
      if (hooks?.octree && hooks.octree.remove) {
        hooks.octree.remove(sItem);
      }
    },
  };
}
```

---

## 4. PLAYER AVATAR INTEGRATION

### PlayerRemote (Other Players)
**File**: `/ic-projects/hyperscape-project/hyperscape2/packages/shared/src/entities/PlayerRemote.ts`

PlayerRemote applies avatars asynchronously:

```typescript
// Lines 193+: PlayerRemote.applyAvatar()
async applyAvatar() {
  const avatarUrl = (this.data.sessionAvatar as string) || (this.data.avatar as string) || 'asset://avatar.vrm';
  if (this.avatarUrl === avatarUrl) return;
  
  // Skip avatar loading on server (no loader system)
  const src = await this.world.loader.load('avatar', avatarUrl) as LoadedAvatar;
  
  // Clean up previous avatar
  if (this.avatar) {
    this.avatar.deactivate();
    const avatarWithInstance = this.avatar as AvatarWithInstance;
    avatarWithInstance.instance!.destroy();
  }
  
  const nodeMap = src.toNodes() as Map<string, HSNode>;
  if (!nodeMap || nodeMap.size === 0) {
    throw new Error(`[PlayerRemote] No root node found in loaded avatar.`);
  }
  
  // The avatar node is a child of the root node or in the map directly
  const rootNode = nodeMap.get('root');
  const avatarNode = nodeMap.get('avatar') || (rootNode as Group).get('avatar');
  const nodeToUse = avatarNode || rootNode;
  
  this.avatar = nodeToUse as Avatar;
  
  // Activate and mount the avatar node
  const avatarWithInstance = nodeToUse as unknown as AvatarWithInstance;
  if (avatarWithInstance.instance && avatarWithInstance.instance.disableRateCheck) {
    avatarWithInstance.instance.disableRateCheck();
  }
  
  const headHeight = this.avatar.getHeadToHeight()!;
  this.avatarUrl = avatarUrl;
  
  // Ensure a default idle emote after mount
  (this.avatar as Avatar).setEmote(Emotes.IDLE);
  
  // Update avatar position to follow player
  if (this.avatar && (this.avatar as AvatarWithInstance).instance) {
    const instance = (this.avatar as AvatarWithInstance).instance;
    // Directly set the avatar scene position
    const avatarScene = instanceWithRaw.raw.scene;
    avatarScene.matrix.copy(worldMatrix);
    avatarScene.matrixWorld.copy(worldMatrix);
  }
}
```

### PlayerLocal (Local Player)
**File**: `/ic-projects/hyperscape-project/hyperscape2/packages/shared/src/entities/PlayerLocal.ts`

PlayerLocal uses similar avatar loading but with local camera and input handling.

---

## 5. ENTITY SYSTEM INTEGRATION

### PlayerEntity (Server Authority)
**File**: `/ic-projects/hyperscape-project/hyperscape2/packages/shared/src/entities/PlayerEntity.ts`

PlayerEntity stores avatar reference and provides player data:

```typescript
// Line 278-283: Avatar reference in PlayerEntity
if (data.avatar !== undefined) {
  this.data.avatar = data.avatar;
}
if (data.sessionAvatar !== undefined) {
  this.data.sessionAvatar = data.sessionAvatar;
}
```

---

## 6. WORLD/SCENE SETUP

The VRM hooks are provided from the World/Stage:

```typescript
// ClientLoader.start() - Lines 88-96
start() {
  this.vrmHooks = {
    camera: this.world.camera,
    scene: this.world.stage.scene,
    octree: this.world.stage.octree,
    setupMaterial: this.world.setupMaterial,
    loader: this.world.loader,
  };
}
```

These hooks are critical for:
- **scene**: Adding the VRM model to the Three.js scene
- **camera**: Distance-based LOD calculations
- **octree**: Spatial queries for collisions
- **setupMaterial**: CSM shadow setup
- **loader**: Loading emote animations

---

## 7. KNOWN ISSUES / BROKEN IMPLEMENTATION

Based on the code analysis, here are the key problematic areas:

### Issue 1: Duplicate Scene Addition
**File**: `Avatar.ts:86-91`
```typescript
const instanceWithRaw = this.instance as unknown as { raw?: { scene?: THREE.Object3D } };
if (instanceWithRaw?.raw?.scene && this.ctx?.stage?.scene) {
  const avatarScene = instanceWithRaw.raw.scene;
  if (!avatarScene.parent) {
    console.warn('[Avatar] Avatar scene has no parent! Manually adding to world.stage.scene');
    this.ctx.stage.scene.add(avatarScene);
  }
}
```
**Problem**: The scene is already added in `createVRMFactory.ts:237` via `hooks.scene.add(vrm.scene)`, but code defensively adds it again if missing. This suggests the scene may not be properly added in some cases.

### Issue 2: Skeleton Helper Debug Code
**File**: `createVRMFactory.ts:232-238`
```typescript
// CRITICAL DEBUG: Add skeleton helper to visualize bones
const skeletonHelper = new THREE.SkeletonHelper(vrm.scene);
skeletonHelper.visible = true;

if (hooks?.scene) {
  hooks.scene.add(vrm.scene);
  hooks.scene.add(skeletonHelper);  // Debug skeleton visualization
```
**Problem**: Debug skeleton helper is added to scene - this is likely for debugging and should be conditional or removed.

### Issue 3: Animation Retargeting Complexity
**File**: `createVRMFactory.ts:379-399`
The `setEmote()` function handles loading emotes with complex bone mapping:
```typescript
(hooks.loader as LoaderType).load('emote', url).then(emo => {
  const clip = emo.toClip({
    rootToHips,
    version,
    getBoneName,
  })
  const action = mixer.clipAction(clip)
  action.timeScale = speed
  newEmote.action = action
  newEmote.loading = false
  // if its still this emote, play it!
  if (currentEmote === newEmote) {
    action.clampWhenFinished = !loop
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity)
    action.play()
  }
}).catch(err => {
  console.error(`[VRM] Failed to load emote:`, url, err)
})
```
**Problem**: Animation loading and retargeting is async but may fail silently with just console.error(). The animation retargeting (`getBoneName()`, `rootToHips`) depends on VRM metadata that may not exist in some VRM files.

### Issue 4: Missing Error Handling for Hooks
**File**: `createVRMFactory.ts:236-245`
```typescript
if (hooks?.scene) {
  hooks.scene.add(vrm.scene);
  hooks.scene.add(skeletonHelper);
} else if (alternateScene) {
  console.warn('[VRMFactory] WARNING: No scene in hooks, using alternate scene from node.ctx.stage.scene');
  alternateScene.add(vrm.scene);
} else {
  console.error('[VRMFactory] ERROR: No scene available, VRM will not be visible!');
}
```
**Problem**: If no scene is available, the VRM is created but never added to the scene - it becomes invisible but isn't destroyed, wasting memory.

### Issue 5: Distance LOD Calculations
**File**: `createVRMFactory.ts:300-313`
```typescript
const vrmPos = v1.setFromMatrixPosition(vrm.scene.matrix);
const camPos = v2.setFromMatrixPosition((hooks.camera as THREE.Camera).matrixWorld);
const distance = vrmPos.distanceTo(camPos);
```
**Problem**: Using `scene.matrix` (local) instead of `scene.matrixWorld` (world). Should be:
```typescript
const vrmPos = v1.setFromMatrixPosition(vrm.scene.matrixWorld);
```

---

## FILE LOCATIONS SUMMARY

| File | Purpose |
|------|---------|
| `packages/shared/src/systems/ClientLoader.ts` | Loads VRM files, creates factory & avatar nodes |
| `packages/shared/src/nodes/Avatar.ts` | Mounts VRM instances, manages lifecycle |
| `packages/shared/src/extras/createVRMFactory.ts` | Core VRM factory & instance creation |
| `packages/shared/src/entities/PlayerRemote.ts` | Applies avatar to remote players |
| `packages/shared/src/entities/PlayerLocal.ts` | Applies avatar to local player |
| `packages/shared/src/entities/PlayerEntity.ts` | Server-side player data (avatar reference) |
| `packages/shared/src/systems/PlayerSystem.ts` | Player lifecycle management |

---

## ANIMATION SYSTEM

Animations are managed through:
1. **AnimationMixer**: Three.js mixer for the skinned mesh
2. **setEmote()**: Loads emote animations and plays them
3. **Animation Retargeting**: Maps VRM bone names using `getBoneName()` callback
4. **Distance LOD**: Updates skeleton less frequently for far avatars

