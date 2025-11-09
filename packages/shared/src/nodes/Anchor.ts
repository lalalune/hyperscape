/**
 * Anchor.ts - Spatial Anchor Node for XR
 *
 * Represents a spatial anchor point in the world.
 * Used for XR (VR/AR) to anchor virtual objects to real-world positions.
 *
 * **Purpose:**
 * - Create persistent anchor points in XR environments
 * - Register anchors with the world's Anchors system
 * - Provide stable reference frames for XR interactions
 *
 * **Lifecycle:**
 * - mount(): Registers anchor with world.anchors system
 * - unmount(): Removes anchor from system
 *
 * **Usage:**
 * ```ts
 * const anchor = createNode('anchor', {
 *   id: 'myAnchor',
 *   position: [0, 1.5, -2]
 * });
 * // Anchor automatically registers on mount
 * ```
 *
 * **Referenced by:** XR system, entity effects, anchored objects
 */

import { Node } from "./Node";
import type { NodeData } from "../types";

/**
 * Anchor Node - XR Spatial Anchor
 *
 * Provides stable reference points for XR experiences.
 */
export class Anchor extends Node {
  anchorId!: string;

  constructor(data: NodeData = {}) {
    super(data);
    this.name = "anchor";
  }

  override copy(source: Anchor, recursive: boolean) {
    super.copy(source, recursive);
    return this;
  }

  override mount() {
    this.anchorId = `${this.ctx!.entity!.id}:${this.id}`;
    this.ctx!.anchors.add(this.anchorId, this.matrixWorld);
  }

  override unmount() {
    this.ctx!.anchors.remove(this.anchorId);
  }

  override getProxy() {
    if (!this.proxy) {
      const self = this;
      let proxy = {
        get anchorId() {
          return self.anchorId;
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
