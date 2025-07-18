import type { Euler, Quaternion } from 'three';
import { THREE } from './three';

export function bindRotations(quaternion: Quaternion, euler: Euler) {
  ;(euler as any)._onChange(() => {
    ;(quaternion as any).setFromEuler(euler, false);
  })
  ;(quaternion as any)._onChange(() => {
    ;(euler as any).setFromQuaternion(quaternion, undefined, false);
  });
}
