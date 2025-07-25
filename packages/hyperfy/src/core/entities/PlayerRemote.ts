import type { EntityData, HotReloadable, NetworkData } from '../../types/core'
import { createNode } from '../extras/createNode'
import { LerpQuaternion } from '../extras/LerpQuaternion'
import { LerpVector3 } from '../extras/LerpVector3'
import * as THREE from '../extras/three'
import { Entity } from './Entity'

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
  base: any;
  body: any;
  collider: any;
  aura: any;
  nametag: any;
  bubble: any;
  bubbleBox: any;
  bubbleText: any;
  avatarUrl?: string;
  avatar?: any;
  lerpPosition: LerpVector3;
  lerpQuaternion: LerpQuaternion;
  teleport: number = 0;
  speaking?: boolean;
  onEffectEnd?: () => void;
  chatTimer?: NodeJS.Timeout;
  destroyed: boolean = false;
  
  constructor(world: any, data: EntityData, local?: boolean) {
    super(world, data, local)
    this.isPlayer = true
    this.lerpPosition = new LerpVector3(new THREE.Vector3() as any, 0)
    this.lerpQuaternion = new LerpQuaternion(new THREE.Quaternion(), 0)
    this.init()
  }

  async init(): Promise<void> {
    this.base = createNode('group')
    this.base.position.fromArray(this.data.position)
    this.base.quaternion.fromArray(this.data.quaternion)

    this.body = createNode('rigidbody', { type: 'kinematic' })
    this.body.active = this.data.effect?.anchorId ? false : true
    this.base.add(this.body)
    this.collider = createNode('collider', {
      type: 'geometry',
      convex: true,
      geometry: capsuleGeometry,
      layer: 'player',
    })
    this.body.add(this.collider)

    // this.caps = createNode('mesh', {
    //   type: 'geometry',
    //   geometry: capsuleGeometry,
    //   material: new THREE.MeshStandardMaterial({ color: 'white' }),
    // })
    // this.base.add(this.caps)

    this.aura = createNode('group')
    this.nametag = createNode('nametag', { label: this.data.name || '', health: this.data.health, active: false })
    this.aura.add(this.nametag)

    this.bubble = createNode('ui', {
      width: 300,
      height: 512,
      pivot: 'bottom-center',
      billboard: 'full',
      scaler: [3, 30],
      justifyContent: 'flex-end',
      alignItems: 'center',
      active: false,
    })
    this.bubbleBox = createNode('uiview', {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderRadius: 10,
      padding: 10,
    })
    this.bubbleText = createNode('uitext', {
      color: 'white',
      fontWeight: 100,
      lineHeight: 1.4,
      fontSize: 16,
    })
    this.bubble.add(this.bubbleBox)
    this.bubbleBox.add(this.bubbleText)
    this.aura.add(this.bubble)

    this.aura.activate({ world: this.world, entity: this })
    this.base.activate({ world: this.world, entity: this })

    this.applyAvatar()

    this.lerpPosition = new LerpVector3(this.base.position, this.world.networkRate)
    this.lerpQuaternion = new LerpQuaternion(this.base.quaternion, this.world.networkRate)
    this.teleport = 0

    this.world.setHot(this, true)
  }

  applyAvatar() {
    const avatarUrl = this.data.sessionAvatar || this.data.avatar || 'asset://avatar.vrm'
    if (this.avatarUrl === avatarUrl) return
    this.world.loader?.load('avatar', avatarUrl).then((src: any) => {
      if (this.avatar) this.avatar.deactivate()
      this.avatar = src.toNodes().get('avatar')
      this.base.add(this.avatar)
      this.nametag.position.y = this.avatar.getHeadToHeight() + 0.2
      this.bubble.position.y = this.avatar.getHeadToHeight() + 0.2
      if (!this.bubble.active) {
        this.nametag.active = true
      }
      this.avatarUrl = avatarUrl
    })
  }

  getAnchorMatrix() {
    if (this.data.effect?.anchorId) {
      return this.world.anchors.get(this.data.effect.anchorId)
    }
    return null
  }

  update(delta: number): void {
    const anchor = this.getAnchorMatrix()
    if (!anchor) {
      this.lerpPosition.update(delta)
      this.lerpQuaternion.update(delta)
    }
    this.avatar?.setEmote(this.data.emote)
  }

  lateUpdate(_delta: number): void {
    const anchor = this.getAnchorMatrix()
    if (anchor) {
      this.lerpPosition.snap()
      this.lerpQuaternion.snap()
      this.base.position.setFromMatrixPosition(anchor)
      this.base.quaternion.setFromRotationMatrix(anchor)
      this.base.clean()
    }
    if (this.avatar) {
      const matrix = this.avatar.getBoneTransform('head')
      if (matrix) this.aura.position.setFromMatrixPosition(matrix)
    }
  }

  setEffect(effect: any, onEnd?: () => void) {
    if (this.data.effect) {
      this.data.effect = undefined
      this.onEffectEnd?.()
      this.onEffectEnd = undefined
    }
    this.data.effect = effect
    this.onEffectEnd = onEnd
    this.body.active = effect?.anchorId ? false : true
  }

  setSpeaking(speaking: boolean) {
    if (this.speaking === speaking) return
    this.speaking = speaking
    const name = this.data.name || ''
    this.nametag.label = speaking ? `» ${name} «` : name
  }

  override modify(data: Partial<NetworkData>) {
    let avatarChanged
    if (data.hasOwnProperty('t')) {
      this.teleport++
    }
    if (data.hasOwnProperty('p')) {
      this.data.position = data.p!
      this.lerpPosition.pushArray(data.p!, this.teleport || null)
    }
    if (data.hasOwnProperty('q')) {
      this.data.quaternion = data.q!
      this.lerpQuaternion.pushArray(data.q!, this.teleport || null)
    }
    if (data.hasOwnProperty('e')) {
      this.data.emote = data.e
    }
    if (data.hasOwnProperty('ef')) {
      this.setEffect(data.ef)
    }
    if (data.hasOwnProperty('name')) {
      this.data.name = data.name
      this.nametag.label = data.name || ''
    }
    if (data.hasOwnProperty('health')) {
      this.data.health = data.health
      this.nametag.health = data.health
      this.world.events.emit('health', { playerId: this.data.id, health: data.health })
    }
    if (data.hasOwnProperty('avatar')) {
      this.data.avatar = data.avatar
      avatarChanged = true
    }
    if (data.hasOwnProperty('sessionAvatar')) {
      this.data.sessionAvatar = data.sessionAvatar
      avatarChanged = true
    }
    if (data.hasOwnProperty('roles')) {
      this.data.roles = data.roles
    }
    if (avatarChanged) {
      this.applyAvatar()
    }
  }

  chat(msg: string) {
    this.nametag.active = false
    this.bubbleText.value = msg
    this.bubble.active = true
    clearTimeout(this.chatTimer)
    this.chatTimer = setTimeout(() => {
      this.bubble.active = false
      this.nametag.active = true
    }, 5000)
  }

  override destroy(local?: boolean) {
    if (this.destroyed) return
    this.destroyed = true

    clearTimeout(this.chatTimer)
    this.base.deactivate()
    this.avatar = null
    this.world.setHot(this, false)
    this.world.events.emit('leave', { playerId: this.data.id })
    this.aura.deactivate()
    this.aura = null

    this.world.entities.remove(this.data.id)
    // if removed locally we need to broadcast to server/clients
    if (local) {
      this.world.network?.send('entityRemoved', this.data.id)
    }
  }
}
