/**
 * SkinnedMesh.ts - Animated Mesh Node
 *
 * Mesh with skeletal animation support. Loads GLB animations.
 */

import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

import { Node } from "./Node";
import THREE from "../extras/three/three";

import type { SkinnedMeshData } from "../types/rendering/nodes";
import type { HotReloadable } from "../types";

import { isBoolean } from "lodash-es";

const defaults = {
  object3d: null,
  animations: [],
  castShadow: true,
  receiveShadow: true,
};

const m1 = new THREE.Matrix4();

const defaultStopOpts = { fade: 0.15 };

export class SkinnedMesh extends Node implements HotReloadable {
  _object3d: THREE.Object3D | null;
  _animations: THREE.AnimationClip[];
  clips: Record<string, THREE.AnimationClip> = {};
  actions: Record<string, THREE.AnimationAction> = {};
  bones: Record<string, THREE.Bone> | null = null;
  animNames: string[] = [];
  boneHandles: Record<string, unknown> = {};
  obj: THREE.Object3D<THREE.Object3DEventMap> | null = null;
  _castShadow: boolean = false;
  _receiveShadow: boolean = false;
  needsRebuild: boolean = false;
  mixer: THREE.AnimationMixer | null = null;
  handle: THREE.Object3D | null = null;
  action: THREE.AnimationAction | null = null;
  constructor(data: SkinnedMeshData = {}) {
    super(data);
    this.name = "skinnedmesh";

    this._object3d = data.object3d ?? defaults.object3d;
    this._animations = data.animations ?? defaults.animations;

    this.castShadow = data.castShadow ?? defaults.castShadow;
    this.receiveShadow = data.receiveShadow ?? defaults.receiveShadow;

    this.clips = {};
    this.actions = {};
    this.bones = null;
    this.animNames = [];
    this.boneHandles = {};
  }

  mount() {
    this.clips = {};
    this.actions = {};
    this.bones = null;
    this.animNames = [];

    this.obj = SkeletonUtils.clone(this._object3d!) as THREE.Object3D;
    this.obj!.matrixWorld.copy(this.matrixWorld);
    this.obj!.matrixAutoUpdate = false;
    this.obj!.matrixWorldAutoUpdate = false;
    this.obj!.traverse((n) => {
      if ("isMesh" in n && (n as THREE.Mesh).isMesh) {
        (n as THREE.Mesh).castShadow = this._castShadow;
        (n as THREE.Mesh).receiveShadow = this._receiveShadow;
      }
    });
    this.ctx!.stage.scene.add(this.obj!);
    for (const clip of this._animations) {
      this.clips[clip.name] = clip;
      this.animNames.push(clip.name);
    }
    this.needsRebuild = false;
  }

  commit(didMove: boolean) {
    if (this.needsRebuild) {
      this.unmount();
      this.mount();
    }
    if (didMove) {
      if (this.obj) {
        this.obj.matrixWorld.copy(this.matrixWorld);
      }
    }
  }

  unmount() {
    if (this.obj) {
      if (this.mixer) {
        this.mixer.stopAllAction();
        this.mixer.uncacheRoot(this.obj);
        this.mixer = null;
        this.ctx!.setHot(this, false);
        this.clips = {};
        this.actions = {};
      }
      this.ctx!.stage.scene.remove(this.obj);
      this.obj = null;
      this.bones = null;
      this.animNames = [];
    }
  }

  update(delta: number) {
    this.mixer?.update(delta);
  }

  fixedUpdate(_delta: number) {
    // SkinnedMesh doesn't need fixed update logic
  }

  lateUpdate(_delta: number) {
    // SkinnedMesh doesn't need late update logic
  }

  postLateUpdate(_delta: number) {
    // SkinnedMesh doesn't need post late update logic
  }

  copy(source: SkinnedMesh, recursive: boolean) {
    super.copy(source, recursive);
    this._object3d = source._object3d;
    this._animations = source._animations;
    this._castShadow = source._castShadow;
    this._receiveShadow = source._receiveShadow;
    return this;
  }

  get anims() {
    return this.animNames.slice();
  }

  get castShadow() {
    return this._castShadow;
  }

  set castShadow(value: boolean | undefined) {
    if (value === undefined) value = defaults.castShadow;
    if (!isBoolean(value)) {
      throw new Error("[skinnedmesh] castShadow not a boolean");
    }
    if (this._castShadow === value) return;
    this._castShadow = value;
    if (this.handle) {
      this.needsRebuild = true;
      this.setDirty();
    }
  }

  get receiveShadow() {
    return this._receiveShadow;
  }

  set receiveShadow(value: boolean | undefined) {
    if (value === undefined) value = defaults.receiveShadow;
    if (!isBoolean(value)) {
      throw new Error("[skinnedmesh] receiveShadow not a boolean");
    }
    if (this._receiveShadow === value) return;
    this._receiveShadow = value;
    if (this.handle) {
      this.needsRebuild = true;
      this.setDirty();
    }
  }

  play({
    name,
    fade = 0.15,
    speed,
    loop = true,
  }: {
    name: string;
    fade?: number;
    speed?: number;
    loop?: boolean;
  }) {
    if (!this.mixer) {
      this.mixer = new THREE.AnimationMixer(this.obj!);
      this.ctx!.setHot(this, true);
    }
    if (
      this.action &&
      (this.action as { _clip?: { name: string } })._clip?.name === name
    ) {
      return;
    }
    if (this.action) {
      this.action.fadeOut(fade);
    }
    this.action = this.actions[name];
    if (!this.action) {
      const clip = this.clips[name];
      if (!clip)
        return console.warn(`[skinnedmesh] animation not found: ${name}`);
      this.action = this.mixer.clipAction(clip);
      this.actions[name] = this.action;
    }
    if (speed !== undefined) this.action.timeScale = speed;
    this.action.clampWhenFinished = !loop;
    this.action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    this.action.reset().fadeIn(fade).play();
  }

  stop(opts = defaultStopOpts) {
    if (!this.action) return;
    this.action.fadeOut(opts.fade);
    this.action = null;
  }

  readBone(name: string): THREE.Bone | null {
    if (!this.obj) return null;
    if (!this.bones) {
      this.bones = {};
      this.obj.traverse((obj) => {
        if ("isBone" in obj && (obj as THREE.Bone).isBone) {
          this.bones![obj.name] = obj as THREE.Bone;
        }
      });
    }
    const bone = this.bones[name];
    if (!bone) {
      console.warn(`[skinnedmesh] bone not found: ${name}`);
      return null;
    }
    return bone;
  }

  getBone(name: string) {
    let handle = this.boneHandles[name];
    if (!handle) {
      const self = this;
      handle = {
        get position() {
          return self.readBone(name)?.position || new THREE.Vector3();
        },
        get quaternion() {
          return self.readBone(name)?.quaternion || new THREE.Quaternion();
        },
        get rotation() {
          return self.readBone(name)?.rotation || new THREE.Euler();
        },
        get scale() {
          return self.readBone(name)?.scale || new THREE.Vector3(1, 1, 1);
        },
        get matrixWorld() {
          const bone = self.readBone(name);
          if (!bone) return new THREE.Matrix4();
          if (self.isDirty) self.clean();
          bone.updateMatrixWorld(true);
          return bone.matrixWorld;
        },
        set matrixWorld(mat) {
          const bone = self.readBone(name);
          if (!bone) return;
          bone.matrixAutoUpdate = false;
          bone.matrixWorldAutoUpdate = false;
          if (mat) bone.matrixWorld.copy(mat);
        },
      };
      this.boneHandles[name] = handle;
    }
    return handle;
  }

  // deprecated: use getBone(name).matrixWorld
  getBoneTransform(name: string): THREE.Matrix4 | null {
    const bone = this.readBone(name);
    if (!bone) return null;
    // combine the skinned mesh's world matrix with the bone's world matrix
    // return m1.multiplyMatrices(this.matrixWorld, bone.matrixWorld)
    bone.updateMatrixWorld(true);
    return m1.copy(bone.matrixWorld);
  }

  getProxy() {
    const self = this;
    if (!this.proxy) {
      let proxy = {
        get anims() {
          return self.anims;
        },
        get castShadow() {
          return self.castShadow;
        },
        set castShadow(value) {
          self.castShadow = value;
        },
        get receiveShadow() {
          return self.receiveShadow;
        },
        set receiveShadow(value) {
          self.receiveShadow = value;
        },
        play(opts) {
          self.play(opts);
        },
        stop(opts) {
          self.stop(opts);
        },
        getBone(name) {
          return self.getBone(name);
        },
        getBoneTransform(name) {
          return self.getBoneTransform(name);
        },
      };
      proxy = Object.defineProperties(
        proxy,
        Object.getOwnPropertyDescriptors(super.getProxy()),
      ); // inherit Node properties
      this.proxy = proxy;
    }
    return this.proxy;
  }
}
