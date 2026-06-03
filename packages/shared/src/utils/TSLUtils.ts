/**
 * TSLUtils - Three.js Shading Language utility functions
 *
 * Provides bit-packing utilities for efficient GPU data storage
 * and common shader math operations.
 *
 * @module TSLUtils
 */

import type { Texture } from "three";
import {
  Fn,
  vec2,
  float,
  pow,
  floor,
  mod,
  sub,
  clamp,
  max,
  PI2,
  round,
  vec3,
  texture,
  smoothstep,
  EPSILON,
} from "three/tsl";

// Configuration - adjust these based on your world size
const MAP_SIZE = 800; // Hyperia world size
const HALF_MAP_SIZE = MAP_SIZE / 2;

// TSL types - use any for dynamic TSL function signatures
type TSLFn = (...args: any[]) => any;

class TSLUtils {
  // @ts-expect-error TSL Fn with array destructuring params - dynamic typing
  private pow2: TSLFn = Fn(([n = float(0)]) => pow(float(2.0), n));

  /** Pack a value into [offset, bits] using fixed-point (lsb, bias) */
  packF32: TSLFn = Fn(
    // @ts-expect-error TSL Fn with array destructuring params - dynamic typing
    ([
      packed = float(0),
      offset = float(0),
      bits = float(8),
      value = float(0),
      lsb = float(1),
      bias = float(0),
    ]) => {
      const levels = sub(this.pow2(bits), 1.0);
      const qRaw = sub(value, bias).div(max(lsb, 1e-20));
      const q = clamp(round(qRaw), 0.0, levels);

      const base = this.pow2(offset); // 2^offset
      const span = this.pow2(bits); // 2^bits
      const slot = floor(packed.div(base));
      const old = mod(slot, span).mul(base); // old field value * base

      // remove old field, add new field
      return packed.sub(old).add(q.mul(base));
    },
  );

  /** Unpack from [offset, bits] with (lsb, bias) */
  unpackF32: TSLFn = Fn(
    // @ts-expect-error TSL Fn with array destructuring params - dynamic typing
    ([
      packed = float(0),
      offset = float(0),
      bits = float(8),
      lsb = float(1),
      bias = float(0),
    ]) => {
      const base = this.pow2(offset);
      const span = this.pow2(bits);
      const slot = floor(packed.div(base));
      const q = mod(slot, span);
      return q.mul(lsb).add(bias);
    },
  );

  /** Pack [0..1] unit value */
  packUnit: TSLFn = Fn(
    // @ts-expect-error TSL Fn with array destructuring params - dynamic typing
    ([
      packed = float(0),
      offset = float(0),
      bits = float(8),
      x01 = float(0),
    ]) => {
      const lsb = float(1).div(sub(this.pow2(bits), 1.0)); // 1/(2^bits-1)
      return this.packF32(packed, offset, bits, x01, lsb, float(0));
    },
  );

  /** Unpack [0..1] unit value */
  unpackUnit: TSLFn = Fn(
    // @ts-expect-error TSL Fn with array destructuring params - dynamic typing
    ([packed = float(0), offset = float(0), bits = float(8)]) => {
      const lsb = float(1).div(sub(this.pow2(bits), 1.0));
      return this.unpackF32(packed, offset, bits, lsb, float(0));
    },
  );

  /** Pack Boolean/flag (single bit 0/1) */
  packFlag: TSLFn = Fn(
    // @ts-expect-error TSL Fn with array destructuring params - dynamic typing
    ([packed = float(0), offset = float(0), flag01 = float(0)]) =>
      this.packF32(packed, offset, float(1), flag01, float(1), float(0)),
  );

  /** Unpack Boolean/flag */
  // @ts-expect-error TSL Fn with array destructuring params - dynamic typing
  unpackFlag: TSLFn = Fn(([packed = float(0), offset = float(0)]) =>
    this.unpackF32(packed, offset, float(1), float(1), float(0)),
  );

  /** Pack angle in radians [0..2π) */
  packAngle: TSLFn = Fn(
    // @ts-expect-error TSL Fn with array destructuring params - dynamic typing
    ([
      packed = float(0),
      offset = float(0),
      bits = float(9),
      angle = float(0),
    ]) => {
      const levels = sub(this.pow2(bits), 1.0);
      const lsb = PI2.div(levels); // 2π/(2^bits-1)
      // wrap into [0,2π)
      const a = angle.sub(PI2.mul(floor(angle.div(PI2))));
      return this.packF32(packed, offset, bits, a, lsb, float(0));
    },
  );

  /** Unpack angle */
  unpackAngle: TSLFn = Fn(
    // @ts-expect-error TSL Fn with array destructuring params - dynamic typing
    ([packed = float(0), offset = float(0), bits = float(9)]) => {
      const lsb = PI2.div(sub(this.pow2(bits), 1.0));
      return this.unpackF32(packed, offset, bits, lsb, float(0));
    },
  );

  /** Pack signed range [-A..+A] */
  packSigned: TSLFn = Fn(
    // @ts-expect-error TSL Fn with array destructuring params - dynamic typing
    ([
      packed = float(0),
      offset = float(0),
      bits = float(8),
      value = float(0),
      maxAbs = float(1),
    ]) => {
      const levels = sub(this.pow2(bits), 1.0);
      const lsb = maxAbs.mul(2.0).div(levels); // step
      const bias = maxAbs.negate();
      return this.packF32(packed, offset, bits, value, lsb, bias);
    },
  );

  /** Unpack signed range */
  unpackSigned: TSLFn = Fn(
    // @ts-expect-error TSL Fn with array destructuring params - dynamic typing
    ([
      packed = float(0),
      offset = float(0),
      bits = float(8),
      maxAbs = float(1),
    ]) => {
      const lsb = maxAbs.mul(2.0).div(sub(this.pow2(bits), 1.0));
      const bias = maxAbs.negate();
      return this.unpackF32(packed, offset, bits, lsb, bias);
    },
  );

  /** Pack generic units [min..max] (inclusive) */
  packUnits: TSLFn = Fn(
    // @ts-expect-error TSL Fn with array destructuring params - dynamic typing
    ([
      packed = float(0),
      offset = float(0),
      bits = float(8),
      value = float(0),
      minV = float(0),
      maxV = float(1),
    ]) => {
      const levels = sub(this.pow2(bits), 1.0);
      const lsb = maxV.sub(minV).div(levels);
      return this.packF32(packed, offset, bits, value, lsb, minV);
    },
  );

  /** Unpack generic units [min..max] */
  unpackUnits: TSLFn = Fn(
    // @ts-expect-error TSL Fn with array destructuring params - dynamic typing
    ([
      packed = float(0),
      offset = float(0),
      bits = float(8),
      minV = float(0),
      maxV = float(1),
    ]) => {
      const lsb = maxV.sub(minV).div(sub(this.pow2(bits), 1.0));
      return this.unpackF32(packed, offset, bits, lsb, minV);
    },
  );

  /** Compute UV from world position for terrain texture sampling */
  // @ts-expect-error TSL Fn with array destructuring params - dynamic typing
  computeMapUvByPosition: TSLFn = Fn(([pos = vec2(0)]) => {
    return pos.add(HALF_MAP_SIZE).div(MAP_SIZE);
  });

  /** Compute atlas UV with scale and offset */
  computeAtlasUv: TSLFn = Fn(
    // @ts-expect-error TSL Fn with array destructuring params - dynamic typing
    ([scale = vec2(0), offset = vec2(0), uvCoord = vec2(0)]) => {
      return uvCoord.mul(scale).add(offset);
    },
  );

  /** Blend normals using Reoriented Normal Mapping (RNM) */
  // @ts-expect-error TSL Fn with array destructuring params - dynamic typing
  blendRNM: TSLFn = Fn(([n1 = vec3(0), n2 = vec3(0)]) => {
    const r = vec3(
      n1.z.mul(n2.x).add(n1.x.mul(n2.z)),
      n1.z.mul(n2.y).add(n1.y.mul(n2.z)),
      n1.z.mul(n2.z).sub(n1.x.mul(n2.x).add(n1.y.mul(n2.y))),
    );
    return r.normalize();
  });

  /** Blend normals using UDN (partial derivatives) */
  // @ts-expect-error TSL Fn with array destructuring params - dynamic typing
  blendUDN: TSLFn = Fn(([n1 = vec3(0), n2 = vec3(0)]) => {
    return vec3(n1.xy.add(n2.xy), n1.z.mul(n2.z)).normalize();
  });

  /**
   * Shadow map texture reference - set by consuming systems
   */
  private shadowMapTexture: Texture | null = null;

  /**
   * Set the shadow map texture for baked shadow sampling
   */
  setShadowMapTexture(tex: Texture | null): void {
    this.shadowMapTexture = tex;
  }

  /**
   * Get baked shadow factor from shadow map texture
   *
   * Samples the shadow map at the given world XZ position.
   * Returns 0 for full shadow, 1 for full light.
   *
   * @param worldPosXZ - World XZ position (vec2)
   * @returns Shadow factor (0-1)
   */
  // @ts-expect-error TSL Fn with array destructuring params - dynamic typing
  getBakedShadowFactor: TSLFn = Fn(([worldPosXZ = vec2(0)]) => {
    const mapUv = this.computeMapUvByPosition(worldPosXZ);

    if (this.shadowMapTexture) {
      const shadow = texture(this.shadowMapTexture, mapUv);
      return shadow.r;
    }

    // Fallback: no shadow
    return float(1);
  });

  /**
   * Get player projected shadow factor
   *
   * Computes soft shadow from player capsule projected onto ground
   * along the sun direction.
   *
   * @param worldPos - World position of surface point (vec3)
   * @param playerPos - Player world position (vec3)
   * @param playerRadius - Player collision radius (float)
   * @param sunDir - Sun direction pointing FROM sun TO scene (vec3)
   * @returns Shadow factor (0 = full shadow, 1 = lit)
   */
  getPlayerShadowFactor: TSLFn = Fn(
    // @ts-expect-error TSL Fn with array destructuring params - dynamic typing
    ([
      worldPos = vec3(0),
      playerPos = vec3(0),
      playerRadius = float(0.5),
      sunDir = vec3(0),
    ]) => {
      // sunDir points FROM sun TO scene (e.g., normalized(-1,-1,-1))
      // Find where player center projects onto plane at worldPos.y along sunDir
      // playerPos + sunDir * t = shadowPoint, where shadowPoint.y = worldPos.y
      // t = (worldPos.y - playerPos.y) / sunDir.y
      const t = worldPos.y.sub(playerPos.y).div(sunDir.y.add(EPSILON));

      // Shadow center XZ at grass height
      const shadowX = playerPos.x.add(sunDir.x.mul(t));
      const shadowZ = playerPos.z.add(sunDir.z.mul(t));

      // Squared distance from grass to shadow center (XZ plane)
      const dx = worldPos.x.sub(shadowX);
      const dz = worldPos.z.sub(shadowZ);
      const distSq = dx.mul(dx).add(dz.mul(dz));

      // Soft shadow: 0 = full shadow, 1 = lit
      const rSq = playerRadius.mul(playerRadius);
      return smoothstep(rSq.mul(0.5), rSq.mul(2.0), distSq);
    },
  );
}

export const tslUtils = new TSLUtils();
