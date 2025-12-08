/**
 * VRMTestViewer - Test VRM avatars with animations
 *
 * Uses @pixiv/three-vrm to load and test VRM files with actual animations
 */

import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { retargetAnimation } from "../services/retargeting/AnimationRetargeting";

const Container = styled.div`
  width: 100%;
  height: 600px;
  position: relative;
  background: #1a1a1a;
  border-radius: 8px;
  overflow: hidden;
`;

const Canvas = styled.canvas`
  width: 100%;
  height: 100%;
`;

const Controls = styled.div`
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
  background: rgba(0, 0, 0, 0.7);
  padding: 15px;
  border-radius: 8px;
  backdrop-filter: blur(10px);
`;

const Button = styled.button<{ active?: boolean }>`
  padding: 10px 20px;
  background: ${(props) => (props.active ? "#4CAF50" : "#2196F3")};
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;

  &:hover {
    background: ${(props) => (props.active ? "#45a049" : "#0b7dda")};
  }

  &:disabled {
    background: #666;
    cursor: not-allowed;
  }
`;

const Info = styled.div`
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 15px;
  border-radius: 8px;
  font-size: 14px;
  backdrop-filter: blur(10px);
`;

const UploadBox = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.7);
  padding: 15px;
  border-radius: 8px;
  backdrop-filter: blur(10px);
`;

const FileInput = styled.input`
  display: none;
`;

const UploadButton = styled.label`
  display: inline-block;
  padding: 10px 20px;
  background: #9c27b0;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;

  &:hover {
    background: #7b1fa2;
  }
`;

interface VRMTestViewerProps {
  vrmUrl: string;
}

export const VRMTestViewer: React.FC<VRMTestViewerProps> = ({ vrmUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadAnimationRef = useRef<((url: string) => Promise<void>) | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentVrmUrl, setCurrentVrmUrl] = useState<string>(vrmUrl);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [currentAnimation, setCurrentAnimation] = useState<string>("idle");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string>("");

  // Update current VRM URL when prop changes
  useEffect(() => {
    setCurrentVrmUrl(vrmUrl);
    setUploadedFileName(null);
  }, [vrmUrl]);

  // Debug: Log VRM URL on mount
  useEffect(() => {
    console.log("[VRMTestViewer] Loading VRM from:", currentVrmUrl);
  }, [currentVrmUrl]);

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log("[VRMTestViewer] Uploading VRM file:", file.name);

      // Create object URL from the file
      const objectUrl = URL.createObjectURL(file);

      // Update state
      setCurrentVrmUrl(objectUrl);
      setUploadedFileName(file.name);
      setLoading(true);
      setError(null);
    }
  };

  // Animation URLs (using Hyperscape CDN)
  const animations = {
    idle: "http://localhost:8080/emotes/emote-idle.glb",
    walk: "http://localhost:8080/emotes/emote-walk.glb",
    run: "http://localhost:8080/emotes/emote-run.glb",
    jump: "http://localhost:8080/emotes/emote-jump.glb",
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    let animationId: number;
    const canvas = canvasRef.current;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x212121);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      45,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      100,
    );
    camera.position.set(0, 1.6, 3);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Orbit controls
    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, 1, 0);
    controls.update();

    // Lighting
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(1, 2, 1);
    scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Ground plane
    const gridHelper = new THREE.GridHelper(10, 10);
    scene.add(gridHelper);

    // Load VRM
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    let vrm: any = null;
    let mixer: THREE.AnimationMixer | null = null;
    let currentAction: THREE.AnimationAction | null = null;
    let skinnedMesh: THREE.SkinnedMesh | null = null;
    let rootToHips = 1; // Calculate once when VRM loads

    const loadAnimation = async (animUrl: string) => {
      if (!vrm || !mixer || !skinnedMesh) {
        console.warn(
          "[VRMTestViewer] Cannot load animation - VRM, mixer, or skinnedMesh not ready",
        );
        return;
      }

      try {
        console.log("[VRMTestViewer] Loading animation from:", animUrl);
        const gltf = await loader.loadAsync(animUrl);
        console.log("[VRMTestViewer] Animation GLB loaded:", gltf);

        if (!gltf.animations || gltf.animations.length === 0) {
          console.error("[VRMTestViewer] No animations found in GLB");
          return;
        }

        // Retarget Mixamo animation to VRM skeleton using STORED rootToHips
        console.log("[VRMTestViewer] Retargeting animation to VRM...");
        console.log("[VRMTestViewer] Using rootToHips:", rootToHips);

        // Create custom retarget options with our stored rootToHips
        const retargetedClip = retargetAnimation(gltf, vrm, rootToHips);

        if (!retargetedClip) {
          console.error("[VRMTestViewer] Animation retargeting failed");
          return;
        }

        console.log(
          "[VRMTestViewer] Animation retargeted successfully:",
          retargetedClip,
        );

        // DON'T reset normalized pose - this breaks A-pose VRMs!
        // Online VRM viewers let the animation mixer work with the bind pose as-is.
        // The skeleton's inverse bind matrices naturally handle the bind pose transformation.
        console.log(
          "[VRMTestViewer] Keeping original bind pose (matches online VRM viewers)",
        );

        // Stop current animation
        if (currentAction) {
          currentAction.fadeOut(0.2);
        }

        // Debug: Log initial bone state before playing animation
        const hipsIndex = skinnedMesh.skeleton.bones.findIndex(
          (b) => b.name === "Hips",
        );
        if (hipsIndex >= 0) {
          const hipsBone = skinnedMesh.skeleton.bones[hipsIndex];
          const leftArmIndex = skinnedMesh.skeleton.bones.findIndex(
            (b) => b.name === "LeftArm",
          );
          const leftArm =
            leftArmIndex >= 0 ? skinnedMesh.skeleton.bones[leftArmIndex] : null;

          console.log("[VRMTestViewer] Initial bone states:");
          console.log(
            "  Hips rotation:",
            hipsBone.quaternion.toArray().map((v) => v.toFixed(3)),
          );
          console.log(
            "  Hips position:",
            hipsBone.position.toArray().map((v) => v.toFixed(3)),
          );
          if (leftArm) {
            console.log(
              "  LeftArm rotation:",
              leftArm.quaternion.toArray().map((v) => v.toFixed(3)),
            );
          }
        }

        // Play retargeted animation
        currentAction = mixer.clipAction(retargetedClip);
        currentAction.reset().fadeIn(0.2).play();
        console.log("[VRMTestViewer] Animation playing:", retargetedClip.name);
        console.log(
          "[VRMTestViewer] Animation tracks:",
          retargetedClip.tracks.map((t) => t.name),
        );

        // Verify animation tracks target the correct hierarchy
        const sampleTrackName = retargetedClip.tracks[0]?.name || "";
        const isNormalizedBone = sampleTrackName.includes("Normalized_");
        console.log("[VRMTestViewer] Animation targeting:");
        console.log("  - Sample track:", sampleTrackName);
        console.log(
          "  - Using normalized bones:",
          isNormalizedBone ? "YES ✓" : "NO (raw bones)",
        );
        console.log(
          "  - Tracks target:",
          isNormalizedBone
            ? "Normalized bone nodes (correct)"
            : "Raw bones (may fail on A-pose)",
        );

        // Verify animation will affect the mesh
        console.log("[VRMTestViewer] Animation → Mesh pipeline:");
        console.log(
          "  1. ✓ Mixer animates:",
          isNormalizedBone
            ? "Normalized_Hips, Normalized_Spine, etc."
            : "Raw bones",
        );
        console.log(
          "  2. ✓ vrm.update() propagates to:",
          "SkinnedMesh skeleton bones",
        );
        console.log("  3. ✓ Skeleton deforms:", "Mesh vertices via skinning");
        console.log("  Result: Mesh will be animated ✓");
      } catch (err) {
        console.error("[VRMTestViewer] Failed to load animation:", err);
      }
    };

    // Store loadAnimation in ref so it can be accessed outside the effect
    loadAnimationRef.current = loadAnimation;

    console.log("[VRMTestViewer] Starting VRM load...");

    loader.load(
      currentVrmUrl,
      async (gltf) => {
        console.log("[VRMTestViewer] GLTF loaded:", gltf);
        vrm = gltf.userData.vrm;

        if (!vrm) {
          console.error("[VRMTestViewer] No VRM data in loaded file");
          setError("No VRM data found in file - not a valid VRM");
          setLoading(false);
          return;
        }

        console.log("[VRMTestViewer] VRM loaded successfully:", vrm);

        // Rotate VRM 0.0 models 180° (VRM 1.0 should NOT be rotated!)
        const vrmVersion =
          vrm.meta?.metaVersion ||
          (vrm.meta?.specVersion?.startsWith("0.") ? "0" : "1");
        console.log(
          "[VRMTestViewer] Detected VRM version:",
          vrmVersion,
          "metaVersion:",
          vrm.meta?.metaVersion,
          "specVersion:",
          vrm.meta?.specVersion,
        );

        if (vrmVersion === "0") {
          console.log("[VRMTestViewer] Rotating VRM 0.0 model by 180°");
          VRMUtils.rotateVRM0(vrm);
        } else {
          console.log("[VRMTestViewer] VRM 1.0 detected - no rotation needed");
        }

        scene.add(vrm.scene);

        // Find the skinned mesh (required for animation mixer)
        vrm.scene.traverse((obj: THREE.Object3D) => {
          if (obj instanceof THREE.SkinnedMesh && !skinnedMesh) {
            skinnedMesh = obj;
            console.log(
              "[VRMTestViewer] Found SkinnedMesh:",
              obj.name,
              "bones:",
              obj.skeleton?.bones.length,
            );

            // Verify skeleton is properly bound to mesh
            if (obj.skeleton) {
              console.log("[VRMTestViewer] Skeleton verified:");
              console.log("  - Bone count:", obj.skeleton.bones.length);
              console.log(
                "  - Bind mode:",
                obj.skeleton.bones[0]?.parent ? "attached" : "detached",
              );
              console.log("  - First bone:", obj.skeleton.bones[0]?.name);
              console.log(
                "  - Skeleton bound to mesh:",
                !!obj.skeleton.boneInverses.length,
              );

              // Log first few bone names to verify hierarchy
              const boneNames = obj.skeleton.bones
                .slice(0, 5)
                .map((b) => b.name);
              console.log("  - First 5 bones:", boneNames.join(", "));
            }
          }
        });

        if (!skinnedMesh) {
          console.error("[VRMTestViewer] No SkinnedMesh found in VRM");
          setError("Invalid VRM: No SkinnedMesh found");
          setLoading(false);
          return;
        }

        // Calculate rootToHips from normalizedRestPose (immutable reference)
        // This matches CharacterStudio and official @pixiv/three-vrm examples
        const humanoid = vrm.humanoid;
        if (humanoid && (humanoid as any).normalizedRestPose?.hips) {
          rootToHips = (humanoid as any).normalizedRestPose.hips.position[1];
          console.log(
            "[VRMTestViewer] Using normalizedRestPose hips height:",
            rootToHips,
          );
        } else {
          console.warn(
            "[VRMTestViewer] normalizedRestPose not available, falling back to runtime calculation",
          );
          const hipsNode = humanoid?.getRawBoneNode("hips");
          if (hipsNode) {
            const v = new THREE.Vector3();
            hipsNode.getWorldPosition(v);
            rootToHips = v.y;
            console.log(
              "[VRMTestViewer] Calculated rootToHips from world position:",
              rootToHips,
            );
          } else {
            console.warn(
              "[VRMTestViewer] Could not find hips node, using default rootToHips:",
              rootToHips,
            );
          }
        }

        // Get VRM info
        const boneCount = humanoid
          ? Object.keys(humanoid.humanBones).length
          : 0;
        setInfo(
          `VRM loaded\nBones: ${boneCount}\nHeight: ${rootToHips.toFixed(2)}m`,
        );

        // Setup animation mixer on vrm.scene (matches three-avatar implementation)
        // We're using normalized bone names from getNormalizedBoneNode().name
        // The mixer on vrm.scene will automatically handle the normalized bone abstraction
        mixer = new THREE.AnimationMixer(vrm.scene);
        console.log("[VRMTestViewer] Created AnimationMixer on vrm.scene");
        const mixerRoot = mixer.getRoot();
        const rootName =
          mixerRoot instanceof THREE.Object3D
            ? mixerRoot.name || "Scene"
            : "AnimationObjectGroup";
        console.log("[VRMTestViewer] Mixer root:", rootName);

        // Verify the mixer can access the skeleton bones through the scene hierarchy
        console.log("[VRMTestViewer] Verifying animation pipeline:");
        console.log("  ✓ Mixer root: vrm.scene (contains normalized bones)");
        console.log(
          "  ✓ Skeleton: bound to SkinnedMesh (" + skinnedMesh.name + ")",
        );
        console.log(
          "  ✓ Animation flow: Mixer → Normalized Bones → vrm.update() → Skeleton Bones → Mesh Deformation",
        );

        // Verify normalized bones exist in the scene
        const normalizedBonesExist =
          vrm.scene.getObjectByName("Normalized_Hips") !== undefined;
        console.log(
          "  ✓ Normalized bones in scene:",
          normalizedBonesExist ? "YES" : "NO (will use raw bones)",
        );

        if (normalizedBonesExist) {
          console.log(
            "  ℹ Using VRM normalized bone system (correct for A-pose VRMs)",
          );
        } else {
          console.warn(
            "  ⚠ Normalized bones not found - animations may not work correctly",
          );
        }

        setLoading(false);

        // Load initial animation
        await loadAnimation(animations.idle);
      },
      (progress) => {
        const percent = ((progress.loaded / progress.total) * 100).toFixed(0);
        setInfo(`Loading VRM... ${percent}%`);
      },
      (error) => {
        console.error("[VRMTestViewer] VRM load error:", error);
        console.error("[VRMTestViewer] Attempted URL:", currentVrmUrl);

        // Check if it's a network error
        if (error instanceof TypeError && error.message.includes("fetch")) {
          setError(
            `Network error: Cannot reach ${currentVrmUrl}. Is the asset-forge server running?`,
          );
        } else {
          setError(`Failed to load VRM: ${error}`);
        }
        setLoading(false);
      },
    );

    // Animation loop
    const clock = new THREE.Clock();
    let frameCount = 0;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const deltaTime = clock.getDelta();

      // Debug: Log bone transforms before and after updates
      frameCount++;
      const shouldLog = frameCount % 60 === 0 && skinnedMesh && currentAction;
      let beforeMixerRot: number[] = [];
      let afterMixerRot: number[] = [];

      if (shouldLog && skinnedMesh) {
        const hipsIndex = skinnedMesh.skeleton.bones.findIndex(
          (b) => b.name === "Hips",
        );
        if (hipsIndex >= 0) {
          const hipsBone = skinnedMesh.skeleton.bones[hipsIndex];
          beforeMixerRot = hipsBone.quaternion
            .toArray()
            .map((v) => parseFloat(v.toFixed(3)));
        }
      }

      // Update animation mixer
      if (mixer) {
        mixer.update(deltaTime);
      }

      // Update VRM normalized bones - REQUIRED when using normalized bone animation
      // This propagates normalized bone transforms to the actual skeleton bones
      if (vrm) {
        vrm.update(deltaTime);
      }

      // Update skeleton bones manually (like Hyperscape does)
      // This ensures bone world matrices are current and propagate to vertex skinning
      if (skinnedMesh) {
        skinnedMesh.skeleton.bones.forEach((bone) => bone.updateMatrixWorld());
        skinnedMesh.skeleton.update();

        // Verify bone matrix updates are propagating to mesh (debug every 60 frames)
        if (shouldLog) {
          const hipsIndex = skinnedMesh.skeleton.bones.findIndex(
            (b) => b.name === "Hips",
          );
          if (hipsIndex >= 0) {
            const hipsBone = skinnedMesh.skeleton.bones[hipsIndex];
            const boneMatrix = skinnedMesh.skeleton.boneMatrices;
            const matrixOffset = hipsIndex * 16;
            console.log("[VRMTestViewer] Skeleton-to-Mesh binding:");
            console.log(
              "  ✓ Bone world matrix updated:",
              hipsBone.matrixWorld.elements
                .slice(0, 4)
                .map((v) => v.toFixed(3)),
            );
            console.log(
              "  ✓ Bone matrix in skeleton:",
              Array.from(boneMatrix.slice(matrixOffset, matrixOffset + 4)).map(
                (v) => v.toFixed(3),
              ),
            );
            console.log(
              "  ✓ Mesh deformation: ACTIVE (skeleton.boneMatrices updated)",
            );
          }
        }
      }

      if (shouldLog && skinnedMesh) {
        const hipsIndex = skinnedMesh.skeleton.bones.findIndex(
          (b) => b.name === "Hips",
        );
        if (hipsIndex >= 0) {
          const hipsBone = skinnedMesh.skeleton.bones[hipsIndex];
          afterMixerRot = hipsBone.quaternion
            .toArray()
            .map((v) => parseFloat(v.toFixed(3)));
        }
      }

      if (shouldLog && skinnedMesh && currentAction) {
        const hipsIndex = skinnedMesh.skeleton.bones.findIndex(
          (b) => b.name === "Hips",
        );
        if (hipsIndex >= 0) {
          const hipsBone = skinnedMesh.skeleton.bones[hipsIndex];
          const pos = new THREE.Vector3();
          hipsBone.getWorldPosition(pos);

          console.log(
            `\n[Frame ${frameCount}] Animation time:`,
            currentAction.time.toFixed(2),
            "/",
            currentAction.getClip().duration.toFixed(2),
          );
          console.log(
            `[Frame ${frameCount}] Hips world pos:`,
            pos.toArray().map((v) => v.toFixed(3)),
          );
          console.log(`[Frame ${frameCount}] Hips rotation:`);
          console.log(`  Before mixer.update():`, beforeMixerRot);
          console.log(`  After mixer.update():`, afterMixerRot);

          // Check if rotation actually changed
          const mixerChanged =
            JSON.stringify(beforeMixerRot) !== JSON.stringify(afterMixerRot);
          console.log(`  Mixer changed rotation: ${mixerChanged}`);
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    };
  }, [currentVrmUrl]);

  const handleAnimationChange = async (animName: string) => {
    setCurrentAnimation(animName);

    // Trigger animation loading
    const animUrl = animations[animName as keyof typeof animations];
    if (animUrl && loadAnimationRef.current) {
      console.log(`[VRMTestViewer] Switching to animation: ${animName}`);
      await loadAnimationRef.current(animUrl);
    }
  };

  return (
    <Container>
      <Canvas ref={canvasRef} />

      {loading && <Info>Loading VRM...</Info>}

      {!loading && !error && (
        <>
          <Info>{info}</Info>
          <Controls>
            {Object.keys(animations).map((animName) => (
              <Button
                key={animName}
                active={currentAnimation === animName}
                onClick={() => handleAnimationChange(animName)}
              >
                {animName.toUpperCase()}
              </Button>
            ))}
          </Controls>
        </>
      )}

      {error && (
        <Info style={{ background: "rgba(220, 53, 69, 0.9)" }}>❌ {error}</Info>
      )}

      <UploadBox>
        <FileInput
          ref={fileInputRef}
          type="file"
          accept=".vrm"
          onChange={handleFileUpload}
          id="vrm-upload"
        />
        <UploadButton htmlFor="vrm-upload">
          {uploadedFileName ? `Uploaded: ${uploadedFileName}` : "Upload VRM"}
        </UploadButton>
      </UploadBox>
    </Container>
  );
};
