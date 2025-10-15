/**
 * PlayerRemote - Remote Player Entity
 * 
 * Represents other players in the multiplayer world. Displays their avatars,
 * nametags, and animations based on network state updates from the server.
 * 
 * **Key Features**:
 * 
 * **Network Interpolation**:
 * - Smoothly interpolates position and rotation between network updates
 * - Uses LerpVector3 and LerpQuaternion for smooth movement
 * - Handles teleportation (instant position changes)
 * - Velocity calculation for animation blending
 * 
 * **Visual Representation**:
 * - VRM avatar rendering
 * - Nametag with player name
 * - Chat bubbles for messages
 * - Health bar (if in combat)
 * - Capsule collider visualization (debug mode)
 * 
 * **Animation System**:
 * - Idle animation when stationary
 * - Walk/run animations based on velocity
 * - Emote playback (wave, dance, etc.)
 * - Smooth transitions between animations
 * 
 * **Chat Bubbles**:
 * - Text bubbles appear above player when they chat
 * - Auto-dismiss after timeout
 * - Wraps long messages
 * - 3D UI that faces the camera
 * 
 * **Network State**:
 * - Receives position/rotation updates from server (8Hz typical)
 * - Interpolates between updates for smooth 60fps rendering
 * - Handles player effects (sitting, emotes, etc.)
 * - Synchronizes avatar changes
 * 
 * **Lifecycle**:
 * 1. Constructed when another player joins
 * 2. spawn() creates visual representation
 * 3. update() interpolates position and updates animations
 * 4. destroy() cleans up avatar and UI
 * 
 * **Runs on**: Client only (browser)
 * **Referenced by**: Entities system (when entityAdded packet received)
 * 
 * @public
 */

import type { EntityData, HotReloadable, NetworkData, LoadedAvatar } from '../types/index'
import { Emotes } from '../extras/playerEmotes'
import type { World } from '../World'
import { createNode } from '../extras/createNode'
import { LerpQuaternion } from '../extras/LerpQuaternion'
import { LerpVector3 } from '../extras/LerpVector3'
import THREE from '../extras/three'
import { Entity } from './Entity'
import { Avatar, Nametag, Group, Mesh, UI, UIView, UIText } from '../nodes'
import { EventType } from '../types/events'
import type { PlayerEffect, VRMHooks } from '../types/physics'

interface AvatarWithInstance {
  instance: {
    destroy: () => void
    move: (matrix: THREE.Matrix4) => void
    update: (delta: number) => void
    disableRateCheck?: () => void
  } | null
  getHeadToHeight?: () => number
  setEmote?: (emote: string) => void
  getBoneTransform?: (boneName: string) => THREE.Matrix4 | null
  deactivate?: () => void
  emote?: string | null
}

let capsuleGeometry: THREE.CapsuleGeometry
{
  const radius = 0.3
  const inner = 1.2
  const height = radius + inner + radius
  capsuleGeometry = new THREE.CapsuleGeometry(radius, inner) // matches PlayerLocal capsule size
  capsuleGeometry.translate(0, height / 2, 0)
}

export class PlayerRemote extends Entity implements HotReloadable {
  isPlayer: boolean;
  // Explicit non-local flag for tests
  isLocal: boolean = false;
  base!: Group;
  body!: Mesh;
  collider!: Mesh;
  aura!: Group;
  nametag!: Nametag;
  bubble!: UI;
  bubbleBox!: UIView;
  bubbleText!: UIText;
  avatarUrl?: string;
  avatar?: Avatar;
  lerpPosition: LerpVector3;
  lerpQuaternion: LerpQuaternion;
  teleport: number = 0;
  speaking?: boolean;
  onEffectEnd?: () => void;
  chatTimer?: NodeJS.Timeout;
  destroyed: boolean = false;
  private lastEmote?: string;
  private prevPosition: THREE.Vector3 = new THREE.Vector3();
  public velocity = new THREE.Vector3();
  public enableInterpolation: boolean = false; // Disabled - ensure basic movement works first
  private _tempMatrix1 = new THREE.Matrix4();
  private _tempVector3_1 = new THREE.Vector3();
  
  constructor(world: World, data: EntityData, local?: boolean) {
    super(world, data, local)
    this.isPlayer = true
    this.lerpPosition = new LerpVector3(new THREE.Vector3(), 0)
    this.lerpQuaternion = new LerpQuaternion(new THREE.Quaternion(), 0)
    this.init()
  }

  /**
   * Override initializeVisuals to skip UIRenderer-based UI elements
   * PlayerRemote uses its own Nametag node system instead
   */
  protected initializeVisuals(): void {
    // Skip UIRenderer - we use Nametag nodes instead
    // Do not call super.initializeVisuals()
  }

  async init(): Promise<void> {
    this.base = createNode('group') as Group
    // Position and rotation are now handled by Entity base class
    // Use entity's position/rotation properties instead of data

    this.body = createNode('rigidbody', { type: 'kinematic' }) as Mesh
    this.body.active = (this.data.effect as PlayerEffect)?.anchorId ? false : true
    this.base.add(this.body)
    this.collider = createNode('collider', {
      type: 'geometry',
      convex: true,
      geometry: capsuleGeometry,
      layer: 'player',
    }) as Mesh
    this.body.add(this.collider)

    // this.caps = createNode('mesh', {
    //   type: 'geometry',
    //   geometry: capsuleGeometry,
    //   material: new THREE.MeshStandardMaterial({ color: 'white' }),
    // })
    // this.base.add(this.caps)

    this.aura = createNode('group') as Group
    this.nametag = createNode('nametag', { label: this.data.name || '', health: this.data.health, active: false }) as Nametag
    this.aura?.add(this.nametag)

    this.bubble = createNode('ui', {
      width: 300,
      height: 512,
      pivot: 'bottom-center',
      billboard: 'full',
      scaler: [3, 30],
      justifyContent: 'flex-end',
      alignItems: 'center',
      active: false,
    }) as UI
    this.bubbleBox = createNode('uiview', {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderRadius: 10,
      padding: 10,
    }) as UIView
    this.bubbleText = createNode('uitext', {
      color: 'white',
      fontWeight: 100,
      lineHeight: 1.4,
      fontSize: 16,
    }) as UIText
    this.bubble.add(this.bubbleBox)
    this.bubbleBox.add(this.bubbleText)
    this.aura?.add(this.bubble)

    this.aura?.activate(this.world)
    this.base.activate(this.world)
    
    // Note: Group nodes don't have Three.js representations - their children handle their own scene addition
    // The base node is activated separately and manages its own scene presence
    
    // Base node is used for UI elements (nametag, bubble)

    // Start avatar loading but don't await it - let it complete asynchronously
    this.applyAvatar();

    this.lerpPosition = new LerpVector3(this.position, this.world.networkRate)
    // IMPORTANT: Use the entity's actual quaternion, not the cloned getter
    this.lerpQuaternion = new LerpQuaternion(this.node.quaternion, this.world.networkRate)
    this.teleport = 0

    this.world.setHot(this, true)
    // Initialize previous position for speed-based emote calculation
    this.prevPosition.copy(this.position)
  }

  async applyAvatar() {
    const avatarUrl = (this.data.sessionAvatar as string) || (this.data.avatar as string) || 'asset://avatar.vrm';
    if (this.avatarUrl === avatarUrl) return;
    
    // Skip avatar loading on server (no loader system)
    if (!this.world.loader) {
      return;
    }
    
    const src = await this.world.loader.load('avatar', avatarUrl) as LoadedAvatar;
    
    // Clean up previous avatar
    if (this.avatar) {
      this.avatar.deactivate();
      // If avatar has an instance, destroy it to clean up VRM scene
      const avatarWithInstance = this.avatar as AvatarWithInstance;
      avatarWithInstance.instance!.destroy();
    }
    
    // Note: VRM hooks will be set on the avatar node before mounting
    const nodeMap = src.toNodes();
    
    const rootNode = nodeMap.get('root');
    if (!rootNode) {
      throw new Error(`[PlayerRemote] No root node found in loaded avatar. Available keys: ${Array.from(nodeMap.keys())}`);
    }
    
    // The avatar node is a child of the root node or in the map directly
    const avatarNode = nodeMap.get('avatar') || (rootNode as Group).get('avatar');
    
    // Use the avatar node
    const nodeToUse = avatarNode || rootNode;
    
    this.avatar = nodeToUse as Avatar;
    
    // Set up the avatar node properly - cast to access internal properties
    interface AvatarNodeInternal {
      ctx: World;
      parent: { matrixWorld: THREE.Matrix4 } | null;
      activate: (world: World) => void;
      mount: () => Promise<void>;
      hooks: VRMHooks;
    }
    const nodeObj = nodeToUse as Avatar & AvatarNodeInternal;
    nodeObj.ctx = this.world;
    
    // Use world.stage.scene and manually update position
    const vrmHooks: VRMHooks = {
      scene: this.world.stage.scene,
      octree: this.world.stage.octree as VRMHooks['octree'],
      camera: this.world.camera,
      loader: this.world.loader
    };
    nodeObj.hooks = vrmHooks;
    
    // Set the parent to base's matrix so it follows the remote player
    Object.assign(nodeObj, { parent: { matrixWorld: this.base.matrixWorld } });
    
    // Activate and mount the avatar node
    nodeObj.activate(this.world);
    await nodeObj.mount();
    
    // The avatar instance will be managed by the VRM factory
    // Don't add anything to base - the VRM scene is added to world.stage.scene
    
    // Disable distance-based LOD throttling for smooth animations
    const avatarWithInstance = nodeToUse as unknown as AvatarWithInstance;
    if (avatarWithInstance.instance && avatarWithInstance.instance.disableRateCheck) {
      avatarWithInstance.instance.disableRateCheck();
    }
    
    // Set up positioning
    const headHeight = this.avatar.getHeadToHeight()!;
    this.nametag.position.y = headHeight + 0.2;
    this.bubble.position.y = headHeight + 0.2;
    
    if (!this.bubble.active) {
      this.nametag.active = true;
    }
    this.avatarUrl = avatarUrl;
    
    // Ensure a default idle emote after mount so avatar isn't frozen
    (this.avatar as Avatar).setEmote(Emotes.IDLE);
    this.lastEmote = Emotes.IDLE;
  }

  getAnchorMatrix() {
    const effect = this.data.effect as PlayerEffect | undefined
    if (effect?.anchorId) {
      return this.world.anchors.get(effect.anchorId)
    }
    return null
  }

  fixedUpdate(_delta: number): void {
    // Implement fixedUpdate as required by HotReloadable interface
    // This method is called at fixed intervals for physics updates
    // Currently no specific implementation needed
  }

  update(delta: number): void {
    const anchor = this.getAnchorMatrix()
    if (!anchor) {
      // Update lerp values
      this.lerpPosition.update(delta)
      this.lerpQuaternion.update(delta)
      
      // FORCE APPLY POSITION - no interpolation bullshit
      if (!this.enableInterpolation) {
        // Get the target position directly from lerp.current and apply it
        const targetPos = this.lerpPosition.current
        if (targetPos) {
          this.node.position.copy(targetPos)
          this.position.copy(targetPos)
          // Position applied directly without interpolation
        }
        
        const targetRot = this.lerpQuaternion.current
        if (targetRot) {
          this.node.quaternion.copy(targetRot)
        }
      } else {
        // Use interpolated values
        this.node.position.copy(this.lerpPosition.value)
        this.position.copy(this.lerpPosition.value)
        this.node.quaternion.copy(this.lerpQuaternion.value)
      }
    }

    // Update node matrices for rendering
    if (this.node) {
      this.node.updateMatrix()
      this.node.updateMatrixWorld(true)
    }
    
    // Update avatar position to follow player
    if (this.avatar && (this.avatar as AvatarWithInstance).instance) {
      const instance = (this.avatar as AvatarWithInstance).instance
      const instanceWithRaw = instance as unknown as { raw?: { scene?: THREE.Object3D } }
      
      // Directly set the avatar scene position
      if (instanceWithRaw?.raw?.scene) {
        const avatarScene = instanceWithRaw.raw.scene
        
        // The VRM scene has matrixAutoUpdate = false, so we need to update matrices manually
        // Create a temporary matrix - consider moving this to a class property for reuse
        const worldMatrix = this._tempMatrix1
        const tempScale = this._tempVector3_1.set(1, 1, 1)
        worldMatrix.compose(
          this.node.position,
          this.node.quaternion,
          tempScale
        )
        
        // Set both matrix and matrixWorld since auto update is disabled
        avatarScene.matrix.copy(worldMatrix)
        avatarScene.matrixWorld.copy(worldMatrix)
        
        // Debug logging disabled to prevent memory pressure
        // Uncomment for debugging remote avatar movement
        // if (Math.random() < 0.001) {  // 0.1% chance
        //   console.log('[PlayerRemote] Moving avatar:', {
        //     id: this.id,
        //     nodePos: this.node.position.toArray(),
        //     avatarMatrixWorld: avatarScene.matrixWorld.elements.slice(12, 15), // Translation part
        //     matrixAutoUpdate: avatarScene.matrixAutoUpdate
        //   })
        // }
      }
      
      // Update avatar animations
      if (instance && instance.update) {
        instance.update(delta)
      }
    }

    // Use server-provided emote state directly - no inference
    // The server/PlayerLocal sends the correct animation state
    if (this.avatar) {
      const serverEmote = this.data.emote as string | undefined
      let desiredUrl: string
      
      if (serverEmote) {
        // Map symbolic emote to asset URL
        if (serverEmote.startsWith('asset://')) {
          desiredUrl = serverEmote
        } else {
          const emoteMap: Record<string, string> = {
            idle: Emotes.IDLE,
            walk: Emotes.WALK,
            run: Emotes.RUN,
            float: Emotes.FLOAT,
            fall: Emotes.FALL,
            flip: Emotes.FLIP,
            talk: Emotes.TALK,
          }
          desiredUrl = emoteMap[serverEmote] || Emotes.IDLE
        }
      } else {
        // Default to idle if no emote data
        desiredUrl = Emotes.IDLE
      }

      // Update animation if changed
      if (desiredUrl !== this.lastEmote) {
        if ('emote' in this.avatar) {
          ;(this.avatar as unknown as { emote: string | null }).emote = desiredUrl
        } else if ('setEmote' in this.avatar) {
          ;(this.avatar as Avatar).setEmote(desiredUrl)
        }
        this.lastEmote = desiredUrl
      }
    }

    // Update prev position at end of frame
    this.prevPosition.copy(this.position)
  }

  lateUpdate(_delta: number): void {
    const anchor = this.getAnchorMatrix()
    if (anchor) {
      this.lerpPosition.snap()
      this.lerpQuaternion.snap()
      this.position.setFromMatrixPosition(anchor)
      this.rotation.setFromRotationMatrix(anchor)
      this.base.clean()
    }
    if (this.avatar) {
      const matrix = this.avatar.getBoneTransform('head')
      if (matrix) this.aura.position.setFromMatrixPosition(matrix)
    }
  }

  postLateUpdate(_delta: number): void {
    // Implement postLateUpdate as required by HotReloadable interface
    // This method is called after all other update methods
    // Currently no specific implementation needed
  }

  setEffect(effect: string, onEnd?: () => void) {
    if (this.data.effect) {
      this.data.effect = undefined
      this.onEffectEnd?.()
      this.onEffectEnd = undefined
    }
    this.data.effect = { emote: effect }
    this.onEffectEnd = onEnd
    // Strong type assumption - effect structure is known
    const hasAnchor = effect && (effect as PlayerEffect).anchorId
    this.body.active = !hasAnchor
  }

  setSpeaking(speaking: boolean) {
    if (this.speaking === speaking) return
    this.speaking = speaking
    const name = this.data.name || ''
    this.nametag.label = speaking ? `» ${name} «` : name
  }

  override modify(data: Partial<NetworkData>) {
    let avatarChanged
    // Strong type assumptions - check properties directly
    if ('t' in data) {
      this.teleport++
    }
    if (data.p !== undefined) {
      // Position is no longer stored in EntityData, apply directly to entity transform
      this.lerpPosition.pushArray(data.p, this.teleport || null)
      // Apply position immediately for responsiveness - assume it's a 3-element array
      const pos = data.p as number[]
      // Update both base and node positions IMMEDIATELY
      this.node.position.set(pos[0], pos[1], pos[2])
      this.position.set(pos[0], pos[1], pos[2])
    }
    if (data.q !== undefined) {
      // Rotation is no longer stored in EntityData, apply directly to entity transform
      this.lerpQuaternion.pushArray(data.q, this.teleport || null)
      // When explicit rotation update arrives, clear any movement-facing override to avoid fighting network
    }
    if (data.e !== undefined) {
      this.data.emote = data.e
    }
    if (data.ef !== undefined) {
      this.setEffect(data.ef as string)
    }
    if (data.name !== undefined) {
      this.data.name = data.name as string
      this.nametag.label = (data.name as string) || ''
    }
    if (data.health !== undefined) {
      this.data.health = data.health as number
      this.nametag.health = data.health as number
      this.world.emit(EventType.PLAYER_HEALTH_UPDATED, { 
        playerId: this.data.id, 
        health: data.health as number,
        maxHealth: (this.data.maxHealth as number) || 100
      })
    }
    if (data.avatar !== undefined) {
      this.data.avatar = data.avatar as string
      avatarChanged = true
    }
    if (data.sessionAvatar !== undefined) {
      this.data.sessionAvatar = data.sessionAvatar as string
      avatarChanged = true
    }
    if (data.roles !== undefined) {
      this.data.roles = data.roles as string[]
    }
    if (data.v !== undefined) {
      // Strong type assumption - v is a 3-element array when provided
      const vel = data.v as number[]
      this.velocity.set(vel[0], vel[1], vel[2]);
    }
    if (avatarChanged) {
      this.applyAvatar();
    }
  }

  chat(msg: string) {
    this.nametag.active = false
    this.bubbleText.value = msg
    this.bubble.active = true
    if (this.chatTimer) clearTimeout(this.chatTimer)
    this.chatTimer = setTimeout(() => {
      this.bubble.active = false
      this.nametag.active = true
    }, 5000)
  }

  override destroy(local?: boolean) {
    if (this.destroyed) return
    this.destroyed = true

    if (this.chatTimer) clearTimeout(this.chatTimer)
    this.base.deactivate()
    this.avatar = undefined
    this.world.setHot(this, false)
    this.world.emit(EventType.PLAYER_LEFT, { playerId: this.data.id })
    this.aura.deactivate()

    this.world.entities.remove(this.data.id)
    // if removed locally we need to broadcast to server/clients
    if (local) {
      this.world.network.send('entityRemoved', this.data.id)
    }
  }

  public toggleInterpolation(enabled: boolean): void {
    this.enableInterpolation = enabled;
  }
}
