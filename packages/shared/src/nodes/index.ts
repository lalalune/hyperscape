/**
 * nodes/index.ts - Hyperscape Node System Exports
 *
 * Central export point for all Node types in Hyperscape's custom scene graph system.
 *
 * **What are Nodes?**
 * Nodes are Hyperscape's alternative to raw THREE.Object3D instances.
 * They provide lifecycle hooks, physics integration, and automatic state management.
 *
 * **Available Node Types:**
 * - Node: Base class (abstract)
 * - Group: Container node
 * - Mesh: Renderable geometry
 * - SkinnedMesh: Animated character mesh
 * - LOD: Level-of-detail container
 * - Avatar: VRM character model
 * - Action: Executable player action
 * - Anchor: Spatial anchor for XR
 * - Nametag: Player/NPC name label
 * - Particles: Particle effect emitter
 * - UI, UIView, UIText: 3D UI elements
 * - RigidBody: Physics-enabled object
 * - Collider: Collision shape
 *
 * **Lowercase Aliases:**
 * All nodes are also exported with lowercase names for factory function compatibility:
 * createNode('mesh', data) uses the lowercase export 'mesh' → Mesh class
 *
 * **Referenced by:** createNode(), glbToNodes(), Entity system, Client loaders
 */

// Export classes with original names
export { Node } from "./Node";
export { Group } from "./Group";
export { Mesh } from "./Mesh";
export { SkinnedMesh } from "./SkinnedMesh";
export { LOD } from "./LOD";
export { Avatar } from "./Avatar";
export { Action } from "./Action";
export { Anchor } from "./Anchor";
export { Nametag } from "./Nametag";
export { Particles } from "./Particles";
export { UI } from "./UI";
export { UIView } from "./UIView";
export { UIText } from "./UIText";
export { RigidBody } from "./RigidBody";
export { Collider } from "./Collider";

// Also export lowercase aliases for backwards compatibility
export { Group as group } from "./Group";
export { Mesh as mesh } from "./Mesh";
export { SkinnedMesh as skinnedmesh } from "./SkinnedMesh";
export { LOD as lod } from "./LOD";
export { Avatar as avatar } from "./Avatar";
export { Action as action } from "./Action";
export { Anchor as anchor } from "./Anchor";
export { Nametag as nametag } from "./Nametag";
export { Particles as particles } from "./Particles";
export { UI as ui } from "./UI";
export { UIView as uiview } from "./UIView";
export { UIText as uitext } from "./UIText";
export { RigidBody as rigidbody } from "./RigidBody";
export { Collider as collider } from "./Collider";
