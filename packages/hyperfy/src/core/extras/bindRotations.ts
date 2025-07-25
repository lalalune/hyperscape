import * as THREE from './three.js'

export function bindRotations(quaternion: THREE.Quaternion, euler: THREE.Euler) {
  euler._onChange(() => {
    quaternion.setFromEuler(euler, false)
  })
  quaternion._onChange(() => {
    euler.setFromQuaternion(quaternion, undefined, false)
  })
}
