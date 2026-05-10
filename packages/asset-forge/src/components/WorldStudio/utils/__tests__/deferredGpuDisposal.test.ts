/**
 * `deferredGpuDisposal` — deferred GPU lifecycle queue tests.
 *
 * The two shared queues (disposals + additions) prevent WebGPU
 * staging-pool exhaustion on Metal during bulk creation /
 * destruction. Frame-batched processing with burst-mode escalation
 * is the contract this module promises the render loop.
 *
 * The module is single-instance (module-level state). Tests use
 * delta assertions via `getGpuLifecycleStats()` and drain the
 * queues in `afterEach` so successive tests don't interfere.
 */

import * as THREE from "three/webgpu";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelStagedAdditions,
  cancelStagedObject,
  deferredDisposeGroup,
  getGpuLifecycleStats,
  processDeferredDisposalOnly,
  processDeferredFrame,
  queueDisposal,
  stageAddition,
} from "../deferredGpuDisposal";

afterEach(() => {
  // Drain everything between tests so module-level state doesn't
  // bleed across cases. Cap iterations so a stuck-on-hidden-parent
  // entry can't infinite-loop the test runner.
  for (let i = 0; i < 100; i++) {
    if (!processDeferredFrame()) break;
  }
  // Sweep any remaining hidden-parent additions by cancelling against
  // their parent. The test that exercises hidden-parent fall-through
  // leaves an item in the queue intentionally; afterEach must clear it.
  // We do that via processDeferredDisposalOnly + a final cap below.
  while (processDeferredDisposalOnly() > 0) {}
});

function makeDisposable() {
  return { dispose: vi.fn() };
}

describe("queueDisposal + processDeferredDisposalOnly", () => {
  it("queueDisposal increments pendingDisposals", () => {
    const before = getGpuLifecycleStats().pendingDisposals;
    queueDisposal(makeDisposable());
    queueDisposal(makeDisposable());
    expect(getGpuLifecycleStats().pendingDisposals).toBe(before + 2);
  });

  it("processDeferredDisposalOnly drains in batch and calls dispose", () => {
    const items = Array.from({ length: 5 }, () => makeDisposable());
    items.forEach(queueDisposal);
    const before = getGpuLifecycleStats().pendingDisposals;
    expect(before).toBeGreaterThanOrEqual(5);

    const disposed = processDeferredDisposalOnly();
    expect(disposed).toBeGreaterThanOrEqual(5);
    // Every disposable's .dispose() was called.
    items.forEach((d) => expect(d.dispose).toHaveBeenCalledTimes(1));
  });

  it("returns 0 when queue is empty", () => {
    while (processDeferredFrame()) {}
    expect(processDeferredDisposalOnly()).toBe(0);
  });

  it("escalates to burst rate when queue exceeds threshold", () => {
    // Threshold is 50 — push 64 to trigger burst (64/frame rate).
    for (let i = 0; i < 64; i++) queueDisposal(makeDisposable());
    const disposed = processDeferredDisposalOnly();
    // Burst rate disposes up to 64 in one frame; normal would only do 8.
    expect(disposed).toBeGreaterThan(8);
  });

  it("swallows errors thrown by .dispose() (queue keeps draining)", () => {
    const throwing = {
      dispose: vi.fn(() => {
        throw new Error("boom");
      }),
    };
    const ok = makeDisposable();
    queueDisposal(throwing);
    queueDisposal(ok);
    expect(() => processDeferredDisposalOnly()).not.toThrow();
    expect(throwing.dispose).toHaveBeenCalledOnce();
    expect(ok.dispose).toHaveBeenCalledOnce();
  });
});

describe("stageAddition + processDeferredFrame (visible parent path)", () => {
  it("stages addition without immediately parenting", () => {
    const parent = new THREE.Group();
    parent.visible = true;
    const child = new THREE.Object3D();
    stageAddition(child, parent);
    // The child shouldn't be parented yet — it's queued.
    expect(parent.children).not.toContain(child);
    expect(getGpuLifecycleStats().pendingAdditions).toBeGreaterThan(0);
  });

  it("processDeferredFrame parents staged objects to a visible parent", () => {
    const parent = new THREE.Group();
    parent.visible = true;
    const child = new THREE.Object3D();
    stageAddition(child, parent);
    processDeferredFrame();
    expect(parent.children).toContain(child);
  });

  it("invokes onAdd callback after parenting", () => {
    const parent = new THREE.Group();
    parent.visible = true;
    const child = new THREE.Object3D();
    const onAdd = vi.fn();
    stageAddition(child, parent, onAdd);
    processDeferredFrame();
    expect(onAdd).toHaveBeenCalledOnce();
  });
});

describe("stageAddition + processDeferredFrame (hidden parent path)", () => {
  it("does NOT parent objects whose parent is hidden", () => {
    const parent = new THREE.Group();
    parent.visible = false;
    const child = new THREE.Object3D();
    stageAddition(child, parent);
    processDeferredFrame();
    expect(parent.children).not.toContain(child);
    // Item stays in queue.
    expect(getGpuLifecycleStats().pendingAdditions).toBeGreaterThan(0);
    // Clean up so subsequent tests aren't blocked by this item.
    cancelStagedAdditions(parent);
  });

  it("falls through to disposal queue when ALL pending additions target hidden parents", () => {
    const parent = new THREE.Group();
    parent.visible = false;
    const child = new THREE.Object3D();
    stageAddition(child, parent);
    const disposable = makeDisposable();
    queueDisposal(disposable);

    processDeferredFrame();
    // Child still queued, but disposal ran (fall-through).
    expect(parent.children).not.toContain(child);
    expect(disposable.dispose).toHaveBeenCalledOnce();
    // Clean up the hidden-parent addition.
    cancelStagedAdditions(parent);
  });
});

describe("cancelStagedAdditions + cancelStagedObject", () => {
  it("cancelStagedAdditions removes ALL items targeting the given parent", () => {
    const parent = new THREE.Group();
    parent.visible = true;
    const childA = new THREE.Object3D();
    const childB = new THREE.Object3D();
    stageAddition(childA, parent);
    stageAddition(childB, parent);
    const beforeCancel = getGpuLifecycleStats().pendingAdditions;
    expect(beforeCancel).toBeGreaterThanOrEqual(2);

    cancelStagedAdditions(parent);
    // Both items removed.
    processDeferredFrame();
    expect(parent.children).not.toContain(childA);
    expect(parent.children).not.toContain(childB);
  });

  it("cancelStagedAdditions leaves items targeting OTHER parents alone", () => {
    const a = new THREE.Group();
    a.visible = true;
    const b = new THREE.Group();
    b.visible = true;
    stageAddition(new THREE.Object3D(), a);
    const childForB = new THREE.Object3D();
    stageAddition(childForB, b);

    cancelStagedAdditions(a);
    processDeferredFrame();
    expect(b.children).toContain(childForB);
  });

  it("cancelStagedObject removes the matching object only", () => {
    const parent = new THREE.Group();
    parent.visible = true;
    const childA = new THREE.Object3D();
    const childB = new THREE.Object3D();
    stageAddition(childA, parent);
    stageAddition(childB, parent);

    cancelStagedObject(childA);
    processDeferredFrame();
    expect(parent.children).not.toContain(childA);
    expect(parent.children).toContain(childB);
  });
});

describe("deferredDisposeGroup", () => {
  it("queues geometry + material from contained meshes", () => {
    const group = new THREE.Group();
    const geom = new THREE.BufferGeometry();
    const mat = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(geom, mat);
    group.add(mesh);
    const before = getGpuLifecycleStats().pendingDisposals;

    deferredDisposeGroup(group);

    // Geometry + material both queued (so +2).
    expect(getGpuLifecycleStats().pendingDisposals).toBe(before + 2);
    // Group is cleared synchronously.
    expect(group.children).toHaveLength(0);
  });

  it("skips shared / cached resources (userData._shared / _cachedModel)", () => {
    const group = new THREE.Group();
    const sharedGeom = new THREE.BufferGeometry();
    sharedGeom.userData._shared = true;
    const cachedMat = new THREE.MeshBasicMaterial();
    cachedMat.userData._cachedModel = true;
    group.add(new THREE.Mesh(sharedGeom, cachedMat));
    const before = getGpuLifecycleStats().pendingDisposals;

    deferredDisposeGroup(group);

    // Neither queued — both flagged shared/cached.
    expect(getGpuLifecycleStats().pendingDisposals).toBe(before);
  });

  it("handles array materials by disposing each", () => {
    const group = new THREE.Group();
    const geom = new THREE.BufferGeometry();
    const mats = [
      new THREE.MeshBasicMaterial(),
      new THREE.MeshBasicMaterial(),
      new THREE.MeshBasicMaterial(),
    ];
    const mesh = new THREE.Mesh(geom, mats);
    group.add(mesh);
    const before = getGpuLifecycleStats().pendingDisposals;

    deferredDisposeGroup(group);

    // Geometry + 3 materials = 4 queued.
    expect(getGpuLifecycleStats().pendingDisposals).toBe(before + 4);
  });
});

describe("getGpuLifecycleStats", () => {
  it("returns a snapshot of queue lengths and totals", () => {
    const stats = getGpuLifecycleStats();
    expect(typeof stats.pendingDisposals).toBe("number");
    expect(typeof stats.pendingAdditions).toBe("number");
    expect(typeof stats.totalDisposed).toBe("number");
    expect(typeof stats.totalAdded).toBe("number");
  });

  it("totalDisposed monotonically increases as disposals run", () => {
    const before = getGpuLifecycleStats().totalDisposed;
    queueDisposal(makeDisposable());
    processDeferredDisposalOnly();
    expect(getGpuLifecycleStats().totalDisposed).toBeGreaterThan(before);
  });
});
