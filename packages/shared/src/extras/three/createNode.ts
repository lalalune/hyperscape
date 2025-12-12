/**
 * createNode.ts - Node Factory Function
 *
 * Factory function for dynamically creating Node instances by name.
 * Nodes are Hyperscape's custom scene graph objects (not to be confused with DOM nodes).
 *
 * Node Types Available:
 * - 'group': Container node (like THREE.Group)
 * - 'mesh': Renderable mesh node
 * - 'skinnedmesh': Animated skinned mesh
 * - 'rigidbody': Physics-enabled object
 * - 'collider': Collision shape
 * - 'avatar': VRM character model
 * - 'nametag': Player/NPC name label
 * - 'ui': 2D UI overlay in 3D space
 * - 'uiview': UI container element
 * - 'uitext': Text label element
 * - 'particles': Particle emitter
 * - 'action': Executable player action
 * - 'lod': Level-of-detail container
 * - 'anchor': Spatial anchor for XR
 *
 * Why Nodes Instead of THREE.Object3D:
 * - Lifecycle hooks (mount, unmount, commit)
 * - Automatic matrix updates and dirty tracking
 * - Integration with physics and UI systems
 * - Serialization support for networking
 *
 * Usage Example:
 * ```ts
 * import { createNode } from './extras/createNode';
 *
 * const group = createNode('group', { id: 'myGroup' });
 * const mesh = createNode('mesh', {
 *   id: 'myMesh',
 *   geometry: new THREE.BoxGeometry(1, 1, 1),
 *   material: new THREE.MeshStandardMaterial()
 * });
 * group.add(mesh);
 * ```
 *
 * Referenced by: GLB loading, avatar system, UI system, entity creation
 */

import { NodeData } from "../../types/index";
import * as Nodes from "../../nodes";

/**
 * Create a Node instance by name.
 *
 * @param name - Node type name (e.g., 'mesh', 'group', 'avatar')
 * @param data - Initial node data (position, properties, etc.)
 * @returns New node instance
 * @throws Logs error if node type not found (but still returns a node)
 */
export function createNode(name: string, data?: NodeData): Nodes.Node {
  const NodeConstructor = (Nodes as Record<string, typeof Nodes.Node>)[name];
  if (!NodeConstructor) console.error("unknown node:", name);
  const node = new NodeConstructor(data);
  return node;
}
