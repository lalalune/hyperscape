import THREE from '../extras/three'

import { System } from './System'
import type { World, AudioGroupGains } from '../types'

const up = new THREE.Vector3(0, 1, 0)
const v1 = new THREE.Vector3()

export class ClientAudio extends System {
  ctx: AudioContext;
  masterGain: GainNode;
  groupGains: AudioGroupGains;
  audioListener: AudioListener;
  lastDelta: number;
  queue: Array<() => void>;
  unlocked: boolean;

  constructor(world: World) {
    super(world)
    this.ctx = new AudioContext() // new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain()
    this.masterGain.connect(this.ctx.destination)
    this.groupGains = {
      music: this.ctx.createGain(),
      sfx: this.ctx.createGain(),
      voice: this.ctx.createGain(),
    }
    this.groupGains.music.gain.value = world.prefs?.music || 0.5
    this.groupGains.sfx.gain.value = world.prefs?.sfx || 0.5
    this.groupGains.voice.gain.value = world.prefs?.voice || 0.5
    this.groupGains.music.connect(this.masterGain)
    this.groupGains.sfx.connect(this.masterGain)
    this.groupGains.voice.connect(this.masterGain)
    this.audioListener = this.ctx.listener
    this.audioListener.positionX.value = 0
    this.audioListener.positionY.value = 0
    this.audioListener.positionZ.value = 0
    this.audioListener.forwardX.value = 0
    this.audioListener.forwardY.value = 0
    this.audioListener.forwardZ.value = -1
    this.audioListener.upX.value = 0
    this.audioListener.upY.value = 1
    this.audioListener.upZ.value = 0
    this.lastDelta = 0

    this.queue = []
    this.unlocked = this.ctx.state !== 'suspended'
    if (!this.unlocked) {
      this.setupUnlockListener()
    }
  }

  ready(fn: () => void) {
    if (this.unlocked) return fn()
    this.queue.push(fn)
  }

  setupUnlockListener() {
    const complete = () => {
      this.unlocked = true
      document.removeEventListener('click', unlock)
      document.removeEventListener('touchstart', unlock)
      document.removeEventListener('keydown', unlock)
      while (this.queue.length) {
        const fn = this.queue.pop()
        if (fn) fn()
      }
    }
    const unlock = async () => {
      await this.ctx.resume();
      if (this.ctx.state !== 'running') throw new Error('Audio still suspended');
      const video = document.createElement('video');
      video.playsInline = true;
      video.muted = true;
      video.src = '/tiny.mp4';
      await video.play();
      video.pause();
      video.remove();
      complete();
    };
    document.addEventListener('click', unlock)
    document.addEventListener('touchstart', unlock)
    document.addEventListener('keydown', unlock)
  }

  async init() {
    this.world.prefs!.on('change', this.onPrefsChange);
  }

  start() {
    // ...
  }

  lateUpdate(delta: number) {
    const target = this.world.rig
    const dir = v1.set(0, 0, -1).applyQuaternion(target.quaternion)
    const endTime = this.ctx.currentTime + delta * 2
    this.audioListener.positionX.linearRampToValueAtTime(target.position.x, endTime)
    this.audioListener.positionY.linearRampToValueAtTime(target.position.y, endTime)
    this.audioListener.positionZ.linearRampToValueAtTime(target.position.z, endTime)
    this.audioListener.forwardX.linearRampToValueAtTime(dir.x, endTime)
    this.audioListener.forwardY.linearRampToValueAtTime(dir.y, endTime)
    this.audioListener.forwardZ.linearRampToValueAtTime(dir.z, endTime)
    this.audioListener.upX.linearRampToValueAtTime(up.x, endTime)
    this.audioListener.upY.linearRampToValueAtTime(up.y, endTime)
    this.audioListener.upZ.linearRampToValueAtTime(up.z, endTime)
    this.lastDelta = delta * 2
  }

  onPrefsChange = (changes: { music?: { value: number }; sfx?: { value: number }; voice?: { value: number } }) => {
    if (changes.music) {
      this.groupGains.music.gain.value = changes.music.value
    }
    if (changes.sfx) {
      this.groupGains.sfx.gain.value = changes.sfx.value
    }
    if (changes.voice) {
      this.groupGains.voice.gain.value = changes.voice.value
    }
  }

  destroy() {
    this.groupGains.music.disconnect()
    this.groupGains.sfx.disconnect()
    this.groupGains.voice.disconnect()
    this.masterGain.disconnect()
    this.ctx.close()
    this.queue = []
  }
}
