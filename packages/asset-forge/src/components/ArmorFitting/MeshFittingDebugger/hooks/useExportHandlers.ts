import * as THREE from "three";

import { ArmorFittingService } from "../../../../services/fitting/ArmorFittingService";
import { ExportType } from "../types";

interface ExportHandlersProps {
  boundArmorMesh: THREE.SkinnedMesh | null;
  selectedArmor: { name: string } | null;
  setIsProcessing: (value: boolean) => void;
  setError: (value: string) => void;
  setShowExportDropdown: (value: boolean) => void;
}

export function useExportHandlers({
  boundArmorMesh,
  selectedArmor,
  setIsProcessing,
  setError,
  setShowExportDropdown,
}: ExportHandlersProps) {
  const handleExportBoundArmor = async (exportType: ExportType = "full") => {
    if (!boundArmorMesh) {
      console.error("No bound armor mesh to export");
      return;
    }

    try {
      setIsProcessing(true);
      console.log(`Starting ${exportType} export...`);

      let exportData: ArrayBuffer;
      let filename: string;
      const armorName = selectedArmor?.name || "armor";

      switch (exportType) {
        case "minimal": {
          const service = new ArmorFittingService();
          exportData = await service.exportFittedArmor(boundArmorMesh, {
            method: "minimal",
          });
          filename = `${armorName}-minimal.glb`;
          break;
        }

        case "static": {
          const service = new ArmorFittingService();
          exportData = await service.exportFittedArmor(boundArmorMesh, {
            method: "static",
          });
          filename = `${armorName}-static.glb`;
          break;
        }

        case "debug": {
          // Debug export with bone visualization
          const exportScene = new THREE.Scene();
          const mesh = boundArmorMesh.clone();

          // Scale factor for cm to meters
          const CM_TO_METERS = 0.01;

          if (mesh.skeleton) {
            // Create properly scaled skeleton with visualization
            const scaledBones: THREE.Bone[] = [];
            const oldToNew = new Map<THREE.Bone, THREE.Bone>();

            // Clone bones with scaled positions
            mesh.skeleton.bones.forEach((oldBone) => {
              const newBone = new THREE.Bone();
              newBone.name = oldBone.name;

              // Scale position
              const scaledPos = oldBone.position
                .clone()
                .multiplyScalar(CM_TO_METERS);
              newBone.position.copy(scaledPos);
              newBone.quaternion.copy(oldBone.quaternion);
              newBone.scale.set(1, 1, 1);

              newBone.updateMatrix();
              scaledBones.push(newBone);
              oldToNew.set(oldBone, newBone);
            });

            // Rebuild hierarchy
            mesh.skeleton.bones.forEach((oldBone, idx) => {
              const newBone = scaledBones[idx];
              if (oldBone.parent && oldBone.parent instanceof THREE.Bone) {
                const parentNewBone = oldToNew.get(oldBone.parent);
                if (parentNewBone) {
                  parentNewBone.add(newBone);
                }
              }
            });

            // Add visualization
            scaledBones.forEach((bone) => {
              const helper = new THREE.BoxGeometry(0.02, 0.02, 0.02);
              const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
              const box = new THREE.Mesh(helper, material);
              bone.add(box);
            });

            // Create new skeleton
            const scaledSkeleton = new THREE.Skeleton(scaledBones);

            // Clone mesh with scaled geometry
            const scaledGeometry = mesh.geometry.clone();
            const positions = scaledGeometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
              positions.setXYZ(
                i,
                positions.getX(i) * CM_TO_METERS,
                positions.getY(i) * CM_TO_METERS,
                positions.getZ(i) * CM_TO_METERS,
              );
            }
            positions.needsUpdate = true;
            scaledGeometry.computeBoundingBox();
            scaledGeometry.computeBoundingSphere();

            // Create new mesh
            const scaledMesh = new THREE.SkinnedMesh(
              scaledGeometry,
              mesh.material,
            );
            scaledMesh.name = mesh.name;

            // Bind with scaled matrix
            const bindMatrix = mesh.bindMatrix.clone();
            const scaleMatrix = new THREE.Matrix4().makeScale(
              CM_TO_METERS,
              CM_TO_METERS,
              CM_TO_METERS,
            );
            bindMatrix.premultiply(scaleMatrix);

            scaledMesh.bind(scaledSkeleton, bindMatrix);
            scaledSkeleton.calculateInverses();

            // Add to scene
            const rootBones = scaledBones.filter((b) => !b.parent);
            rootBones.forEach((root) => exportScene.add(root));
            rootBones.forEach((root) => root.updateMatrixWorld(true));
            exportScene.add(scaledMesh);
          }

          // Add reference grid (2m in meters)
          const grid = new THREE.GridHelper(2, 20);
          exportScene.add(grid);

          // Export
          const { GLTFExporter } =
            await import("three/examples/jsm/exporters/GLTFExporter.js");
          const exporter = new GLTFExporter();
          const gltf = await exporter.parseAsync(exportScene, {
            binary: true,
            embedImages: true,
          });

          exportData = gltf as ArrayBuffer;
          filename = `${armorName}-debug.glb`;
          break;
        }

        case "scale-fixed": {
          const { ArmorScaleFixer } =
            await import("../../../../services/fitting/ArmorScaleFixer");

          if (ArmorScaleFixer.hasScaleIssues(boundArmorMesh.skeleton)) {
            console.log("Scale issues detected! Applying fix...");
            const fixedMesh =
              ArmorScaleFixer.applySkeletonScale(boundArmorMesh);
            const service = new ArmorFittingService();
            exportData = await service.exportFittedArmor(fixedMesh, {
              method: "full",
            });
            filename = `${armorName}-scale-fixed.glb`;
          } else {
            console.log("No scale issues detected");
            return;
          }
          break;
        }

        case "full":
        default: {
          const service = new ArmorFittingService();
          exportData = await service.exportFittedArmor(boundArmorMesh, {
            method: "full",
          });
          filename = `${armorName}-fitted.glb`;
          break;
        }
      }

      // Create download link
      const blob = new Blob([exportData], { type: "model/gltf-binary" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      console.log(`✅ ${exportType} export completed successfully!`);
    } catch (error) {
      console.error(`Failed to export ${exportType}:`, error);
      setError("Failed to export armor");
    } finally {
      setIsProcessing(false);
      setShowExportDropdown(false);
    }
  };

  return {
    handleExportBoundArmor,
  };
}
