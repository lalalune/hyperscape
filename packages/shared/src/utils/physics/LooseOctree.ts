/**
 * LooseOctree.ts - Spatial Partitioning for Fast Raycasting
 *
 * Implements a loose octree for accelerating raycasts against many objects.
 * "Loose" means node bounds overlap by 2x, allowing objects to stay in one node
 * even when they move slightly, reducing expensive node reassignments.
 *
 * **What is an Octree?**
 * A tree structure that recursively divides 3D space into 8 octants (like a 3D binary tree).
 * Objects are stored in the smallest node that can contain them.
 *
 * **Why Loose Octree?**
 * - Objects can move without constantly changing nodes
 * - Each node's bounds are 2x its subdivision size
 * - Reduces tree restructuring on movement
 * - Better for dynamic scenes with moving objects
 *
 * **Performance:**
 * - Raycast: O(log n) instead of O(n) - massive speedup for 1000+ objects
 * - Insert: O(log n) with automatic tree expansion
 * - Update: O(log n) when objects move
 * - Memory: Pools nodes to reduce allocations
 *
 * **Features:**
 * - Automatic expansion when objects outside bounds
 * - Automatic collapse when nodes become empty
 * - Debug visualization helper
 * - Object pooling for nodes and Vector3s
 *
 * **Algorithm:**
 * Based on "Loose Octrees" by Thatcher Ulrich
 * See: https://anteru.net/blog/2008/loose-octrees/
 *
 * **Referenced by:** Stage system for scene raycasting
 */

import { isBoolean } from "lodash-es";
import THREE from "../../extras/three/three";
import type {
  RenderHelperItem,
  ExtendedIntersection,
  ShaderModifier,
  OctreeItem,
} from "../../types/systems/physics";

/** Debug visualization helper for octree nodes */
export interface OctreeHelper {
  init: () => void;
  insert: (node: LooseOctreeNode) => void;
  remove: (node: LooseOctreeNode) => void;
  destroy: () => void;
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();
const _intersects: THREE.Intersection[] = [];
const _mesh = new THREE.Mesh();

const MIN_RADIUS = 0.2;

// Object pools to reduce garbage collection
class Vector3Pool {
  private pool: THREE.Vector3[] = [];
  private inUse = new Set<THREE.Vector3>();

  acquire(x = 0, y = 0, z = 0): THREE.Vector3 {
    let vec = this.pool.pop();
    if (!vec) {
      vec = new THREE.Vector3();
    }
    vec.set(x, y, z);
    this.inUse.add(vec);
    return vec;
  }

  release(vec: THREE.Vector3): void {
    if (this.inUse.has(vec)) {
      this.inUse.delete(vec);
      this.pool.push(vec);
    }
  }

  releaseAll(): void {
    this.inUse.forEach((vec) => {
      this.pool.push(vec);
    });
    this.inUse.clear();
  }
}

const vector3Pool = new Vector3Pool();

// https://anteru.net/blog/2008/loose-octrees/

export interface LooseOctreeOptions {
  scene: THREE.Scene;
  center: THREE.Vector3;
  size: number;
}

export class LooseOctree {
  scene: THREE.Scene;
  root: LooseOctreeNode;
  helper: OctreeHelper | null;
  private nodePool: LooseOctreeNode[] = [];

  constructor({ scene, center, size }: LooseOctreeOptions) {
    this.scene = scene;
    this.root = this.createNode(null, center, size);
    this.helper = null;
  }

  createNode(
    parent: LooseOctreeNode | null,
    center: THREE.Vector3,
    size: number,
  ): LooseOctreeNode {
    let node = this.nodePool.pop();
    if (node) {
      node.reinit(this, parent, center, size);
    } else {
      node = new LooseOctreeNode(this, parent, center, size);
    }
    return node;
  }

  releaseNode(node: LooseOctreeNode): void {
    node.reset();
    this.nodePool.push(node);
  }

  insert(item: OctreeItem) {
    if (!item.sphere) item.sphere = new THREE.Sphere();
    if (!item.geometry.boundingSphere) item.geometry.computeBoundingSphere();
    item.sphere.copy(item.geometry.boundingSphere!).applyMatrix4(item.matrix);
    if (item.sphere.radius < MIN_RADIUS) item.sphere.radius = MIN_RADIUS; // prevent huge subdivisions
    let added = this.root.insert(item);
    if (!added) {
      while (!this.root.canContain(item)) {
        this.expand();
      }
      added = this.root.insert(item);
    }
    return added;
  }

  move(item: OctreeItem) {
    if (!item._node) {
      // console.error('octree item move called but there is no _node')
      return;
    }
    // update bounding sphere
    item.sphere!.copy(item.geometry.boundingSphere!).applyMatrix4(item.matrix);

    // Clamp sphere radius to minimum
    if (item.sphere!.radius < MIN_RADIUS) item.sphere!.radius = MIN_RADIUS;

    // if it still fits inside its current node that's cool
    if (item._node?.canContain?.(item)) {
      return;
    }

    // Optimization: try to find a suitable parent/child before full re-insert
    let targetNode: LooseOctreeNode | null = null;
    let currentNode = item._node as LooseOctreeNode;

    // Check parent nodes first
    while (currentNode.parent && !currentNode.parent.canContain(item)) {
      currentNode = currentNode.parent;
    }
    if (currentNode.parent) {
      targetNode = currentNode.parent;
    }

    // if it doesn't fit, re-insert it into its new node
    const prevNode = item._node;
    this.remove(item);

    let added: boolean;
    if (targetNode) {
      added = targetNode.insert(item);
    } else {
      added = this.insert(item);
    }

    if (!added) {
      console.error(
        "octree item moved but was not re-added. did it move outside octree bounds?",
      );
    }
    // check if we can collapse the previous node
    prevNode?.checkCollapse?.();
  }

  remove(item: OctreeItem) {
    item._node?.remove?.(item);
  }

  expand() {
    // when we expand we do it twice so that it expands in both directions.
    // first goes positive, second goes back negative
    let prevRoot;
    let size;
    let center;

    prevRoot = this.root;
    size = prevRoot.size * 2;
    center = vector3Pool.acquire(
      prevRoot.center.x + prevRoot.size,
      prevRoot.center.y + prevRoot.size,
      prevRoot.center.z + prevRoot.size,
    );
    const first = this.createNode(null, center, size);
    first.subdivide();
    first.children[0].destroy();
    first.children[0] = prevRoot;
    prevRoot.parent = first;
    this.root = first;
    this.root.count = prevRoot.count;
    vector3Pool.release(center);

    prevRoot = this.root;
    size = prevRoot.size * 2;
    center = vector3Pool.acquire(
      prevRoot.center.x - prevRoot.size,
      prevRoot.center.y - prevRoot.size,
      prevRoot.center.z - prevRoot.size,
    );
    const second = this.createNode(null, center, size);
    second.subdivide();
    second.children[7].destroy();
    second.children[7] = prevRoot;
    prevRoot.parent = second;
    this.root = second;
    this.root.count = prevRoot.count;
    vector3Pool.release(center);
  }

  raycast(raycaster: THREE.Raycaster, intersects: ExtendedIntersection[] = []) {
    this.root.raycast(raycaster, intersects);
    intersects.sort(sortAscending);
    return intersects;
  }

  // spherecast(sphere, intersects = []) {
  //   // console.time('spherecast')
  //   this.root.spherecast(sphere, intersects)
  //   intersects.sort(sortAscending)
  //   // console.timeEnd('spherecast')
  //   return intersects
  // }

  // prune() {
  //   console.time('prune')
  //   this.pruneCount = 0
  //   this.root.prune()
  //   console.timeEnd('prune')
  // }

  toggleHelper(enabled?: boolean) {
    enabled = isBoolean(enabled) ? enabled : !this.helper;
    if (enabled && !this.helper) {
      this.helper = createHelper(this);
      this.helper.init();
    }
    if (!enabled && this.helper) {
      this.helper.destroy();
      this.helper = null;
    }
  }

  getDepth() {
    return this.root.getDepth();
  }

  getCount() {
    return this.root.getCount();
  }
}

export class LooseOctreeNode {
  children: LooseOctreeNode[];
  octree: LooseOctree;
  parent: LooseOctreeNode | null;
  center: THREE.Vector3;
  size: number;
  inner: THREE.Box3;
  outer: THREE.Box3;
  items: OctreeItem[];
  count: number;
  _helperItem?: RenderHelperItem;

  constructor(
    octree: LooseOctree,
    parent: LooseOctreeNode | null,
    center: THREE.Vector3,
    size: number,
  ) {
    this.octree = octree;
    this.parent = parent;
    this.center = center.clone(); // Clone center to avoid external modifications
    this.size = size;
    this.inner = new THREE.Box3(
      new THREE.Vector3(center.x - size, center.y - size, center.z - size),
      new THREE.Vector3(center.x + size, center.y + size, center.z + size),
    );
    this.outer = new THREE.Box3(
      new THREE.Vector3(center.x - size * 2, center.y - size * 2, center.z - size * 2), // prettier-ignore
      new THREE.Vector3(center.x + size * 2, center.y + size * 2, center.z + size * 2), // prettier-ignore
    );
    this.items = [];
    this.count = 0;
    this.children = [];
    this.mountHelper();
  }

  reinit(
    octree: LooseOctree,
    parent: LooseOctreeNode | null,
    center: THREE.Vector3,
    size: number,
  ): void {
    this.octree = octree;
    this.parent = parent;
    this.center.copy(center);
    this.size = size;
    this.inner.min.set(center.x - size, center.y - size, center.z - size);
    this.inner.max.set(center.x + size, center.y + size, center.z + size);
    this.outer.min.set(
      center.x - size * 2,
      center.y - size * 2,
      center.z - size * 2,
    );
    this.outer.max.set(
      center.x + size * 2,
      center.y + size * 2,
      center.z + size * 2,
    );
    this.items = [];
    this.count = 0;
    this.children = [];
    this.mountHelper();
  }

  reset(): void {
    this.unmountHelper();
    this.items.length = 0;
    this.children.length = 0;
    this.count = 0;
    this.parent = null;
    this._helperItem = undefined;
  }

  insert(item: OctreeItem) {
    if (!this.canContain(item)) {
      return false;
    }
    if (this.size / 2 < item.sphere!.radius) {
      this.items.push(item);
      item._node = this;
      this.inc(1);
      return true;
    }
    if (!this.children.length) {
      this.subdivide();
    }
    for (const child of this.children) {
      if (child.insert(item)) {
        return true;
      }
    }
    // this should never happen
    console.error("octree insert fail");
    // this.items.push(item)
    // item._node = this
    return false;
  }

  remove(item: OctreeItem) {
    const idx = this.items.indexOf(item);
    this.items.splice(idx, 1);
    item._node = undefined;
    this.dec(1);
  }

  inc(amount: number) {
    let node: LooseOctreeNode | null = this;
    while (node) {
      node.count += amount;
      node = node.parent;
    }
  }

  dec(amount: number) {
    let node: LooseOctreeNode | null = this;
    while (node) {
      node.count -= amount;
      node = node.parent;
    }
  }

  canContain(item: OctreeItem) {
    return (
      this.size >= item.sphere!.radius &&
      this.inner.containsPoint(item.sphere!.center)
    );
  }

  checkCollapse() {
    // a node can collapse if it has children to collapse AND has no items in any descendants
    let match: LooseOctreeNode | undefined;
    let node: LooseOctreeNode | null = this;
    while (node) {
      if (node.count) break;
      if (node.children.length) match = node;
      node = node.parent;
    }
    match?.collapse();
  }

  collapse() {
    for (const child of this.children) {
      child.collapse();
      child.destroy();
      this.octree.releaseNode(child);
    }
    this.children = [];
  }

  subdivide() {
    if (this.children.length) return; // Ensure we don't subdivide twice
    const halfSize = this.size / 2;
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        for (let z = 0; z < 2; z++) {
          const center = vector3Pool.acquire(
            this.center.x + halfSize * (2 * x - 1),
            this.center.y + halfSize * (2 * y - 1),
            this.center.z + halfSize * (2 * z - 1),
          );
          const child = this.octree.createNode(this, center, halfSize);
          this.children.push(child);
          vector3Pool.release(center);
        }
      }
    }
  }

  raycast(raycaster: THREE.Raycaster, intersects: ExtendedIntersection[]) {
    if (!raycaster.ray.intersectsBox(this.outer)) {
      return intersects;
    }
    for (const item of this.items) {
      if (raycaster.ray.intersectsSphere(item.sphere!)) {
        _mesh.geometry = item.geometry;
        _mesh.material = item.material;
        _mesh.matrixWorld = item.matrix;
        _mesh.raycast(raycaster, _intersects);
        for (let i = 0, l = _intersects.length; i < l; i++) {
          const intersect = _intersects[i] as ExtendedIntersection;
          intersect.getEntity = item.getEntity;
          intersect.node = item.node;
          intersects.push(intersect);
        }
        _intersects.length = 0;
      }
    }
    for (const child of this.children) {
      child.raycast(raycaster, intersects);
    }
    return intersects;
  }

  // spherecast(sphere, intersects) {
  //   if (!sphere.intersectsBox(this.outer)) {
  //     return intersects
  //   }
  //   for (const item of this.items) {
  //     if (sphere.intersectsSphere(item.sphere)) {
  //       // just sphere-to-sphere is good enough for now
  //       const centerToCenterDistance = sphere.center.distanceTo(
  //         item.sphere.center
  //       )
  //       const overlapDistance =
  //         item.sphere.radius + sphere.radius - centerToCenterDistance
  //       const distance = Math.max(0, overlapDistance)
  //       const intersect = {
  //         distance: distance,
  //         point: null,
  //         object: null,
  //         getEntity: item.getEntity,
  //       }
  //       intersects.push(intersect)
  //       // _mesh.geometry = item.geometry
  //       // _mesh.material = item.material
  //       // _mesh.matrixWorld = item.matrix
  //       // _mesh.raycast(raycaster, _intersects)
  //       // for (let i = 0, l = _intersects.length; i < l; i++) {
  //       //   const intersect = _intersects[i]
  //       //   intersect.getEntity = item.getEntity
  //       //   intersects.push(intersect)
  //       // }
  //       // _intersects.length = 0
  //     }
  //   }
  //   for (const child of this.children) {
  //     child.spherecast(sphere, intersects)
  //   }
  //   return intersects
  // }

  // prune() {
  //   let empty = true
  //   for (const child of this.children) {
  //     const canPrune = !child.items.length && child.prune()
  //     if (!canPrune) {
  //       empty = false
  //     }
  //   }
  //   if (empty) {
  //     for (const child of this.children) {
  //       this.octree.helper?.remove(child)
  //     }
  //     this.children.length = 0
  //     this.octree.pruneCount++
  //   }
  //   return empty
  // }

  getDepth(): number {
    if (this.children.length === 0) {
      return 1;
    }
    return 1 + Math.max(...this.children.map((child) => child.getDepth()));
  }

  getCount(): number {
    let count = 1;
    for (const child of this.children) {
      count += child.getCount();
    }
    return count;
  }

  mountHelper() {
    this.octree.helper?.insert(this);
  }

  unmountHelper() {
    this.octree.helper?.remove(this);
  }

  destroy() {
    this.unmountHelper();
  }
}

function sortAscending(a: THREE.Intersection, b: THREE.Intersection) {
  return a.distance - b.distance;
}

function createHelper(octree: LooseOctree) {
  const boxes = new THREE.BoxGeometry(1, 1, 1);
  const edges = new THREE.EdgesGeometry(boxes);
  const geometry = new THREE.InstancedBufferGeometry();
  // Copy attributes from edges geometry
  for (const key in edges.attributes) {
    geometry.setAttribute(key, edges.attributes[key].clone());
  }
  if (edges.index) {
    geometry.setIndex(edges.index.clone());
  }
  // Start with small buffers that can grow as needed
  const initialSize = 100;
  const iMatrix = new THREE.InstancedBufferAttribute(
    new Float32Array(initialSize * 16),
    16,
  );
  iMatrix.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("iMatrix", iMatrix);
  // Remove unused offset and scale attributes
  geometry.instanceCount = 0;
  const material = new THREE.LineBasicMaterial({
    color: "red",
  });
  material.onBeforeCompile = (shader: ShaderModifier) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `
      attribute mat4 iMatrix;
      #include <common>
      `,
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
      #include <begin_vertex>
      transformed = (iMatrix * vec4(position, 1.0)).xyz;
      `,
    );
  };
  const mesh = new THREE.LineSegments(geometry, material);
  mesh.frustumCulled = false;
  const items: RenderHelperItem[] = [];
  let bufferSize = initialSize;

  function growBuffer() {
    const newSize = Math.min(bufferSize * 2, 10000); // Cap at 10k for safety
    const newMatrix = new Float32Array(newSize * 16);
    newMatrix.set(iMatrix.array);
    iMatrix.array = newMatrix;
    iMatrix.needsUpdate = true;
    bufferSize = newSize;
  }

  function insert(node: LooseOctreeNode) {
    const idx = mesh.geometry.instanceCount;

    // Grow buffer if needed
    if (idx >= bufferSize) {
      growBuffer();
    }

    mesh.geometry.instanceCount++;
    const position = _v1.copy(node.center);
    const quaternion = _q1.set(0, 0, 0, 1);
    const scale = _v2.setScalar(node.size * 2);
    // Reuse the shared matrix instead of creating new ones
    _m1.compose(position, quaternion, scale);
    iMatrix.set(_m1.elements, idx * 16);
    iMatrix.needsUpdate = true;
    node._helperItem = { idx, matrix: _m1.clone() }; // Only clone when storing
    items.push(node._helperItem);
  }
  function remove(node: LooseOctreeNode) {
    const item = node._helperItem!;
    const last = items[items.length - 1];
    const isOnly = items.length === 1;
    const isLast = item === last;
    if (isOnly) {
      items.length = 0;
      mesh.geometry.instanceCount = 0;
    } else if (isLast) {
      items.pop();
      mesh.geometry.instanceCount--;
    } else {
      if (!last) {
        throw new Error("wtf");
      }
      iMatrix.set(last.matrix.elements, item.idx * 16);
      last.idx = item.idx;
      items[item.idx] = last;
      items.pop();
      mesh.geometry.instanceCount--;
    }
    iMatrix.needsUpdate = true;
  }
  function traverse(
    node: LooseOctreeNode,
    callback: (node: LooseOctreeNode) => void,
  ) {
    callback(node);
    for (const child of node.children) {
      traverse(child, callback);
    }
  }
  function destroy() {
    octree.scene.remove(mesh);
  }
  function init() {
    traverse(octree.root, (node) => {
      node.mountHelper();
    });
  }
  octree.scene.add(mesh);
  return {
    init,
    insert,
    remove,
    destroy,
  };
}
