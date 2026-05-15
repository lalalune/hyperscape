/**
 * `useSelectionOutline` — selection outline + label visibility tests.
 *
 * The hook is React-coupled (uses useEffect + useRef), so these
 * tests render it with React Testing Library's `renderHook` and
 * verify scene mutations + ref-write side effects.
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as THREE from "three/webgpu";

import { useSelectionOutline } from "../useSelectionOutline";

function makeSelectable(id: string): THREE.Mesh {
  // Real geometry so the bounding box isn't empty (hook bails on empty).
  const geom = new THREE.BoxGeometry(2, 2, 2);
  const mat = new THREE.MeshBasicMaterial();
  const mesh = new THREE.Mesh(geom, mat);
  mesh.userData.selectableId = id;
  // Attach a label child so we can check visibility toggles.
  const label = new THREE.Object3D();
  label.userData.isLabel = true;
  label.visible = false;
  mesh.add(label);
  return mesh;
}

function makeHostRefs(): {
  sceneRef: { current: THREE.Scene | null };
  selectableObjectsRef: { current: THREE.Object3D[] };
  selectedLabelRef: { current: THREE.Object3D | null };
} {
  return {
    sceneRef: { current: new THREE.Scene() },
    selectableObjectsRef: { current: [] },
    selectedLabelRef: { current: null },
  };
}

describe("useSelectionOutline — no selection", () => {
  it("returns a ref-object that initially holds null", () => {
    const hostRefs = makeHostRefs();
    const { result } = renderHook(() =>
      useSelectionOutline({ selectedId: null, hostRefs }),
    );
    expect(result.current.selectionOutlineRef.current).toBeNull();
  });

  it("leaves the scene empty when selectedId is null", () => {
    const hostRefs = makeHostRefs();
    renderHook(() => useSelectionOutline({ selectedId: null, hostRefs }));
    expect(hostRefs.sceneRef.current!.children).toHaveLength(0);
  });
});

describe("useSelectionOutline — selection creates outline", () => {
  it("adds a wireframe Mesh to the scene matching the selected object's bbox", () => {
    const hostRefs = makeHostRefs();
    const target = makeSelectable("target");
    target.position.set(10, 0, 20);
    hostRefs.sceneRef.current!.add(target);
    hostRefs.selectableObjectsRef.current.push(target);

    renderHook(() => useSelectionOutline({ selectedId: "target", hostRefs }));

    // Scene now has target + 1 outline mesh.
    const outline = hostRefs.sceneRef.current!.children.find(
      (c) => c instanceof THREE.Mesh && c !== target,
    ) as THREE.Mesh | undefined;
    expect(outline).toBeDefined();
    expect(outline!.geometry).toBeInstanceOf(THREE.BoxGeometry);
    // Outline is positioned at the bbox center of `target`.
    expect(outline!.position.x).toBeCloseTo(10);
    expect(outline!.position.z).toBeCloseTo(20);
  });

  it("flips selectedLabelRef.current to the newly-selected object", () => {
    const hostRefs = makeHostRefs();
    const target = makeSelectable("target");
    hostRefs.sceneRef.current!.add(target);
    hostRefs.selectableObjectsRef.current.push(target);

    renderHook(() => useSelectionOutline({ selectedId: "target", hostRefs }));

    expect(hostRefs.selectedLabelRef.current).toBe(target);
  });

  it("shows label children on the selected object (visible = true)", () => {
    const hostRefs = makeHostRefs();
    const target = makeSelectable("target");
    hostRefs.sceneRef.current!.add(target);
    hostRefs.selectableObjectsRef.current.push(target);

    renderHook(() => useSelectionOutline({ selectedId: "target", hostRefs }));

    const label = target.children.find((c) => c.userData.isLabel)!;
    expect(label.visible).toBe(true);
  });

  it("returns the outline Mesh via the returned ref", () => {
    const hostRefs = makeHostRefs();
    const target = makeSelectable("target");
    hostRefs.sceneRef.current!.add(target);
    hostRefs.selectableObjectsRef.current.push(target);

    const { result } = renderHook(() =>
      useSelectionOutline({ selectedId: "target", hostRefs }),
    );

    expect(result.current.selectionOutlineRef.current).toBeInstanceOf(
      THREE.Mesh,
    );
  });
});

describe("useSelectionOutline — selection changes hide prior labels", () => {
  it("hides labels on the previously-selected object when selection clears", () => {
    const hostRefs = makeHostRefs();
    const target = makeSelectable("target");
    hostRefs.sceneRef.current!.add(target);
    hostRefs.selectableObjectsRef.current.push(target);

    const { rerender } = renderHook(
      (props: { selectedId: string | null }) =>
        useSelectionOutline({ selectedId: props.selectedId, hostRefs }),
      { initialProps: { selectedId: "target" as string | null } },
    );

    // Label is visible after initial selection.
    const label = target.children.find((c) => c.userData.isLabel)!;
    expect(label.visible).toBe(true);

    // Clear selection.
    rerender({ selectedId: null });

    // Label is hidden again; selectedLabelRef cleared.
    expect(label.visible).toBe(false);
    expect(hostRefs.selectedLabelRef.current).toBeNull();
  });
});

describe("useSelectionOutline — unknown selectedId", () => {
  it("does nothing when selectedId doesn't match any selectable object", () => {
    const hostRefs = makeHostRefs();
    const target = makeSelectable("target");
    hostRefs.sceneRef.current!.add(target);
    hostRefs.selectableObjectsRef.current.push(target);

    renderHook(() => useSelectionOutline({ selectedId: "missing", hostRefs }));

    // No outline added (scene only has target).
    expect(hostRefs.sceneRef.current!.children).toHaveLength(1);
    expect(hostRefs.sceneRef.current!.children[0]).toBe(target);
  });
});

describe("useSelectionOutline — null scene", () => {
  it("is a no-op when sceneRef.current is null", () => {
    const hostRefs = makeHostRefs();
    hostRefs.sceneRef.current = null;
    const { result } = renderHook(() =>
      useSelectionOutline({ selectedId: "target", hostRefs }),
    );
    expect(result.current.selectionOutlineRef.current).toBeNull();
  });
});
