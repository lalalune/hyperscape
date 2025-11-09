import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";

export function useArmorExport(params: {
  sceneRef: React.RefObject<THREE.Scene | null>;
  equipmentSlot: "Head" | "Spine2" | "Pelvis";
  helmetMeshRef: React.RefObject<THREE.Mesh | null>;
  armorMeshRef: React.RefObject<THREE.Mesh | null>;
}) {
  const { sceneRef, equipmentSlot, helmetMeshRef, armorMeshRef } = params;

  const exportFittedModel = async (): Promise<ArrayBuffer> => {
    const meshToExport =
      equipmentSlot === "Head" ? helmetMeshRef.current : armorMeshRef.current;

    if (!meshToExport || !sceneRef.current) {
      console.error("No mesh to export");
      throw new Error("No mesh to export");
    }

    const exportScene = new THREE.Scene();
    const meshClone = meshToExport.clone();
    exportScene.add(meshClone);

    const exporter = new GLTFExporter();
    return new Promise<ArrayBuffer>((resolve, reject) => {
      exporter.parse(
        exportScene,
        (result: ArrayBuffer | { [key: string]: unknown }) => {
          if (result instanceof ArrayBuffer) {
            resolve(result);
          } else {
            const json = JSON.stringify(result);
            const buffer = new TextEncoder().encode(json);
            resolve(buffer.buffer);
          }
        },
        (error: unknown) => {
          console.error("Export failed:", error);
          reject(error as Error);
        },
        { binary: true },
      );
    });
  };

  return { exportFittedModel };
}
