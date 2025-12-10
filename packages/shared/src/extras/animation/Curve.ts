/**
 * Curve.ts - Hermite Curve Animation System
 *
 * Implements cubic Hermite curve interpolation for smooth animation curves.
 * Used for particles, custom animations, and procedural motion paths.
 *
 * **What is a Hermite Curve?**
 * A smooth curve defined by keyframes with tangent handles for controlling curvature.
 * Similar to animation curves in Unity, Blender, or After Effects.
 *
 * **Components:**
 * - Keyframes: Points on the curve with time and value
 * - Tangents: Control curve shape between keyframes (in/out tangents)
 * - Evaluation: Get interpolated value at any time
 *
 * **Use Cases:**
 * - Particle property curves (size over lifetime, alpha fade, etc.)
 * - Custom easing functions
 * - Procedural animation paths
 * - Parameter tweening with custom curves
 *
 * **Usage:**
 * ```ts
 * const curve = new Curve();
 * curve.add({ time: 0, value: 0, inTangent: 0, outTangent: 1 });
 * curve.add({ time: 0.5, value: 1, inTangent: 1, outTangent: -1 });
 * curve.add({ time: 1, value: 0, inTangent: -1, outTangent: 0 });
 *
 * const value = curve.evaluate(0.25); // Get value at 25% through curve
 * ```
 *
 * **Referenced by:** Particle system, animation utilities, procedural systems
 */

import { clamp } from "../../utils";

/** Global keyframe ID counter */
let ids = 0;

/**
 * Curve - Hermite Spline Curve for Animation
 *
 * Provides smooth interpolation between keyframes using cubic Hermite splines.
 */
export class Curve {
  keyframes: Keyframe[];
  data?: string;
  firstKeyframe!: Keyframe;
  lastKeyframe!: Keyframe;

  constructor() {
    this.keyframes = [];
  }

  deserialize(data: string) {
    if (!data) return this;
    this.data = data;
    this.keyframes = data.split("|").map((kData) => {
      return new Keyframe().deserialize(kData);
    });
    this.sort();
    return this;
  }

  serialize() {
    return this.keyframes
      .map((keyframe) => {
        return keyframe.serialize();
      })
      .join("|");
  }

  add(opts: {
    time: number;
    value: number;
    inTangent: number;
    outTangent: number;
  }) {
    const keyframe = new Keyframe().set(opts);
    const foundIndex = this.keyframes.findIndex(
      (k) => k.time === keyframe.time,
    );
    // if (foundIndex === 0) return console.warn('cant replace first keyframe')
    // if (foundIndex === this.keyframes.length -1) return console.warn('cant replace end keyframe') // prettier-ignore
    if (foundIndex === -1) {
      this.keyframes.push(keyframe);
    } else {
      this.keyframes[foundIndex] = keyframe;
    }
    this.sort();
    return this;
  }

  remove(keyframeId: number) {
    const idx = this.keyframes.findIndex(
      (keyframe) => keyframe.id === keyframeId,
    );
    if (idx !== -1) this.keyframes.splice(idx, 1);
  }

  removeAtTime(time: number) {
    const idx = this.keyframes.findIndex((keyframe) => keyframe.time === time);
    if (idx !== -1) this.keyframes.splice(idx, 1);
  }

  evaluate(time: number) {
    if (time <= this.keyframes[0].time) {
      return this.keyframes[0].value;
    }

    if (time >= this.keyframes[this.keyframes.length - 1].time) {
      return this.keyframes[this.keyframes.length - 1].value;
    }

    for (let i = 0; i < this.keyframes.length - 1; i++) {
      // prettier-ignore
      if (time >= this.keyframes[i].time && time <= this.keyframes[i + 1].time) { 
        const t = (time - this.keyframes[i].time) / (this.keyframes[i + 1].time - this.keyframes[i].time) // prettier-ignore
        const p0 = this.keyframes[i].value;
        const p1 = this.keyframes[i + 1].value;
        const m0 = this.keyframes[i].outTangent * (this.keyframes[i + 1].time - this.keyframes[i].time) // prettier-ignore
        const m1 = this.keyframes[i + 1].inTangent * (this.keyframes[i + 1].time - this.keyframes[i].time) // prettier-ignore
        const t2 = t * t;
        const t3 = t2 * t;

        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;

        return h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1;
      }
    }
    return 0;
  }

  sort() {
    this.keyframes.sort((a, b) => a.time - b.time);
    this.firstKeyframe = this.keyframes[0];
    this.lastKeyframe = this.keyframes[this.keyframes.length - 1];
  }

  move(
    keyframe: Keyframe,
    time: number,
    value: number,
    boundFirstLast: boolean,
  ) {
    const keyIndex = this.keyframes.indexOf(keyframe);

    if (keyIndex <= 0 || keyIndex >= this.keyframes.length - 1) {
      if (!boundFirstLast) {
        keyframe.value = value;
      }
      return;
    }
    keyframe.value = value;
    keyframe.time = Math.max(0.001, Math.min(time, 0.999));

    this.sort();
  }

  clone() {
    return new Curve().deserialize(this.serialize());
  }
}

/**
 * Keyframe - Single Point on an Animation Curve
 *
 * Defines a control point with time, value, and tangent handles.
 */
export class Keyframe {
  id: number;
  time: number;
  value: number;
  inTangent: number;
  outTangent: number;
  inMagnitude: number;
  outMagnitude: number;

  constructor() {
    this.id = ++ids;
    this.time = 0;
    this.value = 0;
    this.inTangent = 0;
    this.outTangent = 0;
    this.inMagnitude = -0.1;
    this.outMagnitude = 0.1;
  }

  set({
    time,
    value,
    inTangent,
    outTangent,
  }: {
    time: number;
    value: number;
    inTangent: number;
    outTangent: number;
  }) {
    this.time = clamp(time, 0, 1);
    this.value = value || 0;
    this.inTangent = inTangent || 0;
    this.outTangent = outTangent || 0;
    return this;
  }

  deserialize(data: string) {
    const [time, value, inTangent, outTangent] = data.split(",");
    this.time = parseFloat(time) || 0;
    this.value = parseFloat(value) || 0;
    this.inTangent = parseFloat(inTangent) || 0;
    this.outTangent = parseFloat(outTangent) || 0;
    this.id = ++ids;
    this.inMagnitude = -0.1;
    this.outMagnitude = 0.1;
    return this;
  }

  serialize() {
    return [
      numToString(this.time),
      numToString(this.value),
      numToString(this.inTangent),
      numToString(this.outTangent),
    ].join(",");
  }

  getHandles() {
    return { in: this.getInHandle(), out: this.getOutHandle() };
  }

  getInHandle() {
    return {
      x: this.time + this.inMagnitude,
      y: this.value + this.inMagnitude * this.inTangent,
    };
  }

  getOutHandle() {
    return {
      x: this.time + this.outMagnitude,
      y: this.value + this.outMagnitude * this.outTangent,
    };
  }

  setTangentsFromHandles(tangents: {
    in: { x: number; y: number };
    out: { x: number; y: number };
  }) {
    this.setInTangentFromHandle(tangents.in.x, tangents.in.y);
    this.setOutTangentFromHandle(tangents.out.x, tangents.out.y);
  }

  setInTangentFromHandle(x: number, y: number) {
    if (x >= this.time) return;
    this.inMagnitude = x - this.time;
    this.inTangent = (y - this.value) / this.inMagnitude;
  }

  setOutTangentFromHandle(x: number, y: number) {
    if (x <= this.time) return;
    this.outMagnitude = x - this.time;
    this.outTangent = (y - this.value) / this.outMagnitude;
  }
}

function numToString(num: number) {
  if (Number.isInteger(num)) return num.toString();
  return num.toFixed(3);
}
