/**
 * Group.ts - Container Node (Like THREE.Group)
 *
 * A simple container node for organizing other nodes in a hierarchy.
 * Equivalent to THREE.Group but with Node lifecycle hooks.
 *
 * **Purpose:**
 * - Group related nodes together
 * - Apply transforms to multiple nodes at once
 * - Organize scene hierarchy
 *
 * **Usage:**
 * ```ts
 * const group = createNode('group', { id: 'myGroup' });
 * group.add(meshNode1);
 * group.add(meshNode2);
 * group.position.set(10, 0, 5); // Moves both children
 * ```
 *
 * **Referenced by:** glbToNodes(), avatar system, scene organization
 */

import { Node } from "./Node";
import type { NodeData } from "../types/index";

/**
 * Group Node - Container for organizing other nodes
 */
export class Group extends Node {
  name: "group";

  constructor(data: NodeData = {}) {
    super(data);
    this.name = "group";
  }

  override copy(source: Node, recursive?: boolean): this {
    super.copy(source, recursive);
    return this;
  }

  override getProxy(): ReturnType<Node["getProxy"]> {
    if (!this.proxy) {
      let proxy = {
        // ...
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
