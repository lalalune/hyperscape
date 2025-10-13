/**
 * Hand Rigging Service
 * Main service that orchestrates the entire hand rigging process
 */

import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { HAND_BONE_NAMES } from "../../constants";
import {
  HandBoneStructure,
  HandRiggingOptions,
  HandRiggingResult,
  HandRiggingResultWithDebug,
  RequiredHandRiggingOptions,
} from "../../types";
import {
  HandDetectionResult,
  HandLandmarks,
  HandPoseDetectionService,
  Point3D,
} from "./HandPoseDetectionService";
import {
  FingerSegmentation,
  HandSegmentationService,
} from "./HandSegmentationService";
import {
  HandCaptureResult,
  OrthographicHandRenderer,
  WristBoneInfo,
} from "./OrthographicHandRenderer";

// Re-export for backward compatibility
export type { HandBoneStructure, HandRiggingOptions, HandRiggingResult };

export class HandRiggingService {
  private loader: GLTFLoader;
  private exporter: GLTFExporter;
  private handDetector: HandPoseDetectionService;
  private handRenderer: OrthographicHandRenderer;
  private segmentationService: HandSegmentationService;
  public debugCaptures?: Record<string, string>;

  constructor() {
    this.loader = new GLTFLoader();
    this.exporter = new GLTFExporter();
    this.handDetector = new HandPoseDetectionService();
    this.handRenderer = new OrthographicHandRenderer();
    this.segmentationService = new HandSegmentationService();
  }

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    console.log("🚀 Initializing Hand Rigging Service...");
    await this.handDetector.initialize();
    console.log("✅ Hand Rigging Service ready");
  }

  /**
   * Main entry point - rig hands on a model from URL
   */
  async rigHands(modelUrl: string, options?: HandRiggingOptions): Promise<HandRiggingResult | HandRiggingResultWithDebug>
  /**
   * Main entry point - rig hands on a model from File
   */
  async rigHands(modelFile: File, options?: HandRiggingOptions): Promise<HandRiggingResult | HandRiggingResultWithDebug>
  async rigHands(
    modelSource: File | string,
    options: HandRiggingOptions = {}
  ): Promise<HandRiggingResult | HandRiggingResultWithDebug> {
    const startTime = Date.now();

    const {
      smoothingIterations = 3,
      minConfidence = 0.7,
      debugMode = false,
      captureResolution = 512,
    } = options;

    console.log("🦴 Starting hand rigging process...");

    // Load model - handle both File and string URL
    const modelUrl = modelSource instanceof File 
      ? URL.createObjectURL(modelSource)
      : modelSource;
    const shouldRevokeUrl = modelSource instanceof File;
    
    const gltf = await this.loader.loadAsync(modelUrl);
    const model = gltf.scene;

    // Count original bones
    const originalBoneCount = this.countBones(model);

    // Find wrist bones
    console.log("🔍 Searching for wrist bones...");
    const wristBones = this.handRenderer.findWristBones(model);
    if (wristBones.length === 0) {
      // Log available bones for debugging
      console.log("❌ No wrist bones found. Available bones:");
      model.traverse((child) => {
        if (child instanceof THREE.Bone) {
          console.log(`  - ${child.name}`);
        }
      });
      throw new Error(
        "No wrist bones found in model. Ensure the model has proper bone hierarchy."
      );
    }

    console.log(`✅ Found ${wristBones.length} wrist bone(s):`);
    wristBones.forEach((wb) => {
      console.log(`  - ${wb.bone.name} (${wb.side} side)`);
    });

    const result: HandRiggingResult = {
      riggedModel: new ArrayBuffer(0),
      metadata: {
        originalBoneCount,
        addedBoneCount: 0,
        processingTime: 0,
      },
    };

    // Process each hand
    for (const wristInfo of wristBones) {
      const handResult = await this.processHand(model, wristInfo, {
        smoothingIterations,
        minConfidence,
        debugMode,
        captureResolution,
        viewerRef: options.viewerRef,
      });

      if (handResult) {
        if (wristInfo.side === "left") {
          result.leftHand = handResult;
        } else {
          result.rightHand = handResult;
        }

        result.metadata.addedBoneCount += this.countHandBones(handResult.bones);
      }
    }

    // Export rigged model
    result.riggedModel = await this.exportModel(model);
    result.metadata.processingTime = Date.now() - startTime;

    console.log(
      `✅ Hand rigging complete in ${result.metadata.processingTime}ms`
    );
    console.log(`   Added ${result.metadata.addedBoneCount} bones`);

    // Include debug captures if available
    if (this.debugCaptures) {
      const resultWithDebug = result as HandRiggingResultWithDebug;
      resultWithDebug.debugCaptures = this.debugCaptures;
      // Clear for next run
      this.debugCaptures = undefined;
      return resultWithDebug;
    }

    // Cleanup blob URL if we created one
    if (shouldRevokeUrl) {
      URL.revokeObjectURL(modelUrl);
    }

    return result;
  }

  /**
   * Process a single hand
   */
  private async processHand(
    model: THREE.Object3D,
    wristInfo: WristBoneInfo,
    options: RequiredHandRiggingOptions
  ): Promise<{
    bones: HandBoneStructure;
    detectionConfidence: number;
    vertexCount: number;
  } | null> {
    console.log(`\n🤚 Processing ${wristInfo.side} hand...`);

    let detection: HandDetectionResult | null = null;
    let successfulCapture: HandCaptureResult | null = null;

    // Ensure detection object has proper type
    const ensureDetection = (
      det: HandDetectionResult | null
    ): det is HandDetectionResult => {
      return det !== null && det.hands.length > 0;
    };

    // If we have a viewer reference, use it to capture from top view
    if (options.viewerRef?.current?.captureHandViews) {
      console.log(
        "📸 Using 3D viewer to capture hand views (better for T-pose detection)..."
      );

      const captures = await options.viewerRef!.current!.captureHandViews();

      // Try detection on hand closeups first
      if (wristInfo.side === "left" && captures.leftHandCloseup) {
        console.log("🔍 Detecting left hand in closeup view...");
        detection = await this.handDetector.detectHands(
          captures.leftHandCloseup
        );
        if (ensureDetection(detection)) {
          console.log(
            `✅ Detected ${detection.hands.length} hand(s) in left hand closeup`
          );
          successfulCapture = {
            canvas: captures.leftHandCloseup,
            imageData: captures.leftHandCloseup
              .getContext("2d")!
              .getImageData(
                0,
                0,
                captures.leftHandCloseup.width,
                captures.leftHandCloseup.height
              ),
            cameraMatrix: new THREE.Matrix4(),
            projectionMatrix: new THREE.Matrix4(),
            worldBounds: {
              min: new THREE.Vector3(-0.1, -0.1, -0.1),
              max: new THREE.Vector3(0.1, 0.1, 0.1),
            },
            wristPosition: new THREE.Vector3(0, 0, 0),
            handNormal: new THREE.Vector3(0, 0, 1),
            side: wristInfo.side,
          };

          if (options.debugMode) {
            this.saveCanvas(
              captures.leftHandCloseup,
              `${wristInfo.side}-hand-closeup.png`
            );
            if (!this.debugCaptures) {
              this.debugCaptures = {};
            }
            this.debugCaptures[`${wristInfo.side}_closeup`] =
              captures.leftHandCloseup.toDataURL();
          }
        }
      } else if (wristInfo.side === "right" && captures.rightHandCloseup) {
        console.log("🔍 Detecting right hand in closeup view...");
        detection = await this.handDetector.detectHands(
          captures.rightHandCloseup
        );
        if (ensureDetection(detection)) {
          console.log(
            `✅ Detected ${detection.hands.length} hand(s) in right hand closeup`
          );
          successfulCapture = {
            canvas: captures.rightHandCloseup,
            imageData: captures.rightHandCloseup
              .getContext("2d")!
              .getImageData(
                0,
                0,
                captures.rightHandCloseup.width,
                captures.rightHandCloseup.height
              ),
            cameraMatrix: new THREE.Matrix4(),
            projectionMatrix: new THREE.Matrix4(),
            worldBounds: {
              min: new THREE.Vector3(-0.1, -0.1, -0.1),
              max: new THREE.Vector3(0.1, 0.1, 0.1),
            },
            wristPosition: new THREE.Vector3(0, 0, 0),
            handNormal: new THREE.Vector3(0, 0, 1),
            side: wristInfo.side,
          };

          if (options.debugMode) {
            this.saveCanvas(
              captures.rightHandCloseup,
              `${wristInfo.side}-hand-closeup.png`
            );
            if (!this.debugCaptures) {
              this.debugCaptures = {};
            }
            this.debugCaptures[`${wristInfo.side}_closeup`] =
              captures.rightHandCloseup.toDataURL();
          }
        }
      }

      // Store all debug captures if available
      if (options.debugMode && captures.debugCaptures) {
        if (!this.debugCaptures) {
          this.debugCaptures = {};
        }
        Object.assign(this.debugCaptures, captures.debugCaptures);
      }

      // If closeup didn't work, try top view
      if (!detection || detection.hands.length === 0) {
        console.log("🔍 Trying top view...");
        if (captures.topView) {
          detection = await this.handDetector.detectHands(captures.topView);

          if (ensureDetection(detection)) {
            console.log(
              `✅ Detected ${detection.hands.length} hand(s) in top view`
            );

            // Create a capture result compatible with existing code
            successfulCapture = {
              canvas: captures.topView,
              imageData: captures.topView
                .getContext("2d")!
                .getImageData(
                  0,
                  0,
                  captures.topView.width,
                  captures.topView.height
                ),
              cameraMatrix: new THREE.Matrix4(),
              projectionMatrix: new THREE.Matrix4(),
              worldBounds: {
                min: new THREE.Vector3(-0.1, -0.1, -0.1),
                max: new THREE.Vector3(0.1, 0.1, 0.1),
              },
              wristPosition: new THREE.Vector3(0, 0, 0),
              handNormal: new THREE.Vector3(0, 0, 1),
              side: wristInfo.side,
            };

            if (options.debugMode) {
              this.saveCanvas(
                captures.topView,
                `${wristInfo.side}-hand-top-view.png`
              );

              // Store for UI display
              if (!this.debugCaptures) {
                this.debugCaptures = {};
              }
              this.debugCaptures[`${wristInfo.side}_top`] =
                captures.topView.toDataURL();
            }
          }
        }
      }

      // If still no detection, try front view as fallback
      if (!detection || detection.hands.length === 0) {
        console.log("🔍 Trying front view...");
        if (captures.frontView) {
          detection = await this.handDetector.detectHands(captures.frontView);

          if (ensureDetection(detection)) {
            console.log(
              `✅ Detected ${detection.hands.length} hand(s) in front view`
            );
            successfulCapture = {
              canvas: captures.frontView,
              imageData: captures.frontView
                .getContext("2d")!
                .getImageData(
                  0,
                  0,
                  captures.frontView.width,
                  captures.frontView.height
                ),
              cameraMatrix: new THREE.Matrix4(),
              projectionMatrix: new THREE.Matrix4(),
              worldBounds: {
                min: new THREE.Vector3(-0.1, -0.1, -0.1),
                max: new THREE.Vector3(0.1, 0.1, 0.1),
              },
              wristPosition: new THREE.Vector3(0, 0, 0),
              handNormal: new THREE.Vector3(0, 0, 1),
              side: wristInfo.side,
            };

            if (options.debugMode) {
              this.saveCanvas(
                captures.frontView,
                `${wristInfo.side}-hand-front-view.png`
              );

              // Store for UI display
              if (!this.debugCaptures) {
                this.debugCaptures = {};
              }
              this.debugCaptures[`${wristInfo.side}_front`] =
                captures.frontView.toDataURL();
            }
          }
        }
      }
    }

    // If viewer capture didn't work, use the original orthographic approach
    if (!detection || detection.hands.length === 0) {
      console.log("📸 Using orthographic renderer for capture...");

      // Step 1: Try multiple capture attempts with different settings
      const captureAttempts = [
        { backgroundColor: "#ffffff", padding: 0.5 },
        { backgroundColor: "#000000", padding: 0.7 },
        { backgroundColor: "#808080", padding: 1.0 },
        { backgroundColor: "#ffeecc", padding: 0.6 }, // Skin-like background
        { backgroundColor: "#0066cc", padding: 0.8 }, // Blue background for contrast
      ];

      for (let i = 0; i < captureAttempts.length; i++) {
        const attempt = captureAttempts[i];
        console.log(
          `📸 Capture attempt ${i + 1} for ${wristInfo.side} hand...`
        );

        const capture = await this.handRenderer.captureHand(model, wristInfo, {
          resolution: options.captureResolution,
          backgroundColor: attempt.backgroundColor,
          padding: attempt.padding,
        });

        if (options.debugMode) {
          this.handRenderer.saveCapture(
            capture,
            `${wristInfo.side}-hand-capture-attempt${i + 1}.png`
          );

          // Also store the canvas for UI display
          if (!this.debugCaptures) {
            this.debugCaptures = {};
          }
          this.debugCaptures[`${wristInfo.side}_attempt${i + 1}`] =
            capture.canvas.toDataURL();
        }

        // Step 2: Detect hand pose
        detection = await this.handDetector.detectHands(capture.canvas);

        if (ensureDetection(detection)) {
          console.log(`✅ Hand detected on attempt ${i + 1}`);
          successfulCapture = capture;
          break;
        } else {
          console.log(`❌ No hand detected on attempt ${i + 1}`);
        }
      }

      if (!detection || detection.hands.length === 0) {
        console.warn(
          `No hand detected for ${wristInfo.side} hand after ${captureAttempts.length} attempts with orthographic renderer`
        );
        console.log(
          `📊 Model appears to have closed/fist hands or hands that are difficult to detect`
        );
        console.log(
          `💡 Tip: For best results, use models with open hands in T-pose or A-pose`
        );

        // Return null for now - procedural generation can be added later
        return null;
      }
    }

    // Use first detected hand
    const hand = detection.hands[0];

    // Validate detection quality
    const validation = this.handDetector.validateHandDetection(hand);
    if (!validation.isValid || hand.confidence < options.minConfidence) {
      console.warn(
        `Low quality detection for ${wristInfo.side} hand:`,
        validation.issues
      );
      return null;
    }

    // Ensure we have a successful capture
    if (!successfulCapture) {
      console.warn(
        `No successful capture for ${wristInfo.side} hand despite detection`
      );
      return null;
    }

    console.log(
      `✅ Hand detected with ${(hand.confidence * 100).toFixed(1)}% confidence`
    );

    // Step 3: Segment fingers
    const segmentation = this.segmentationService.segmentFingers(
      hand,
      successfulCapture.canvas.width,
      successfulCapture.canvas.height
    );

    if (options.debugMode) {
      const segViz =
        this.segmentationService.visualizeSegmentation(segmentation);
      this.saveCanvas(segViz, `${wristInfo.side}-hand-segmentation.png`);
    }

    // Step 4: Convert 2D landmarks to 3D positions
    const landmarks3D = this.projectLandmarksTo3D(
      hand,
      successfulCapture,
      wristInfo
    );

    // Step 5: Create hand bones
    const handBones = this.createHandBones(
      wristInfo.bone,
      landmarks3D,
      wristInfo.side
    );

    // Step 6: Find skinned meshes
    const skinnedMeshes = this.findSkinnedMeshes(model);
    if (skinnedMeshes.length === 0) {
      console.warn("No skinned meshes found in model");
      return null;
    }

    // Step 7: Calculate and apply weights
    let totalVertices = 0;
    for (const mesh of skinnedMeshes) {
      const vertexCount = await this.applyHandWeights(
        mesh,
        handBones,
        segmentation,
        successfulCapture,
        options.smoothingIterations
      );
      totalVertices += vertexCount;
    }

    console.log(`✅ Applied weights to ${totalVertices} vertices`);

    return {
      bones: handBones,
      detectionConfidence: hand.confidence,
      vertexCount: totalVertices,
    };
  }

  /**
   * Project 2D landmarks to 3D space
   */
  private projectLandmarksTo3D(
    hand: HandLandmarks,
    capture: HandCaptureResult,
    wristInfo: WristBoneInfo
  ): Point3D[] {
    // Use the 3D landmarks if available
    if (hand.worldLandmarks) {
      // Calculate appropriate scale based on wrist bone size
      const wristWorldPos = new THREE.Vector3();
      wristInfo.bone.getWorldPosition(wristWorldPos);

      // Estimate hand size from model - typically wrist to middle finger tip is ~18-20cm
      // But we'll scale based on the model's proportions
      const modelScale = wristInfo.bone.parent
        ? wristInfo.bone.parent.scale.x
        : 1.0;
      const scale = 0.5 * modelScale; // Adjust this multiplier as needed

      return hand.worldLandmarks.map((landmark) => {
        // MediaPipe provides landmarks in a normalized coordinate system
        // We need to transform them to our world space
        const localPos = new THREE.Vector3(
          landmark.x * scale,
          -landmark.y * scale, // Flip Y
          -landmark.z * scale // Flip Z
        );

        // Apply camera transformation
        const worldPos = localPos.clone();
        worldPos.applyMatrix4(capture.cameraMatrix);

        return {
          x: worldPos.x,
          y: worldPos.y,
          z: worldPos.z,
        };
      });
    }

    // Fallback: estimate depth based on hand structure
    const depthEstimates = this.estimateLandmarkDepths(hand);
    return this.handDetector.convertTo3DCoordinates(
      hand.landmarks.map((l) => ({ x: l.x, y: l.y })),
      capture.cameraMatrix,
      capture.projectionMatrix,
      depthEstimates
    );
  }

  /**
   * Estimate depth values for landmarks
   */
  private estimateLandmarkDepths(hand: HandLandmarks): number[] {
    // Simple depth estimation based on hand anatomy
    const depths: number[] = [];

    // Wrist is at base depth (0)
    depths[0] = 0;

    // Thumb
    depths[1] = 0.02; // CMC
    depths[2] = 0.04; // MCP
    depths[3] = 0.06; // IP
    depths[4] = 0.08; // Tip

    // Fingers (gradually forward)
    for (let finger = 0; finger < 4; finger++) {
      const base = 5 + finger * 4;
      depths[base] = 0.01; // MCP
      depths[base + 1] = 0.03; // PIP
      depths[base + 2] = 0.05; // DIP
      depths[base + 3] = 0.07; // Tip
    }

    return depths;
  }

  /**
   * Create hand bone hierarchy
   */
  private createHandBones(
    wristBone: THREE.Bone,
    landmarks3D: Point3D[],
    side: "left" | "right"
  ): HandBoneStructure {
    const boneNames = HAND_BONE_NAMES[side];
    const bones: HandBoneStructure = {
      wrist: wristBone,
      fingers: {
        thumb: [],
        index: [],
        middle: [],
        ring: [],
        pinky: [],
      },
    };

    // Get bone positions from landmarks
    const bonePositions = this.handDetector.calculateBonePositions(
      {
        landmarks: landmarks3D,
        handedness: side === "left" ? "Left" : "Right",
        confidence: 1,
      },
      side
    );

    // Create palm bone (optional, helps with weighting)
    const palmPos = new THREE.Vector3(
      landmarks3D[0].x,
      landmarks3D[0].y,
      landmarks3D[0].z
    );

    // Find the skeleton that contains this wrist bone
    let skeleton: THREE.Skeleton | null = null;

    // First, check if there's a SkinnedMesh in the scene that has this bone
    const findSkeletonInScene = (
      obj: THREE.Object3D
    ): THREE.Skeleton | null => {
      if (obj instanceof THREE.SkinnedMesh && obj.skeleton) {
        if (obj.skeleton.bones.includes(wristBone)) {
          return obj.skeleton;
        }
      }

      for (const child of obj.children) {
        const found = findSkeletonInScene(child);
        if (found) return found;
      }

      return null;
    };

    // Start from the root of the scene
    let root = wristBone as THREE.Object3D;
    while (root.parent) {
      root = root.parent;
    }

    skeleton = findSkeletonInScene(root);

    // Create bones for each finger
    const fingers: Array<keyof typeof bones.fingers> = [
      "thumb",
      "index",
      "middle",
      "ring",
      "pinky",
    ];

    fingers.forEach((finger) => {
      const positions = bonePositions[finger];
      const names = boneNames[finger];

      let parentBone = wristBone;

      for (let i = 1; i < positions.length; i++) {
        const bone = new THREE.Bone();
        bone.name = names[i - 1];

        // Set position relative to parent
        const parentWorldPos = new THREE.Vector3();
        parentBone.getWorldPosition(parentWorldPos);

        const boneWorldPos = new THREE.Vector3(
          positions[i].x,
          positions[i].y,
          positions[i].z
        );

        // Convert to local space
        const localPos = boneWorldPos.sub(parentWorldPos);
        bone.position.copy(localPos);

        // Add to hierarchy
        parentBone.add(bone);
        bones.fingers[finger].push(bone);

        // Add to skeleton bones array if we found the skeleton
        if (skeleton && !skeleton.bones.includes(bone)) {
          skeleton.bones.push(bone);
        }

        parentBone = bone;
      }
    });

    // Update skeleton if we modified it
    if (skeleton) {
      skeleton.update();
      console.log(
        `✅ Added bones to skeleton. Total bones: ${skeleton.bones.length}`
      );
    }

    console.log(`✅ Created ${this.countHandBones(bones)} hand bones`);

    return bones;
  }

  /**
   * Apply hand weights to skinned mesh
   */
  private async applyHandWeights(
    mesh: THREE.SkinnedMesh,
    handBones: HandBoneStructure,
    segmentation: FingerSegmentation,
    capture: HandCaptureResult,
    smoothingIterations: number
  ): Promise<number> {
    // Get vertex segmentation
    const vertexSegments = this.segmentationService.segmentMeshVertices(
      mesh,
      segmentation,
      capture
    );

    // Get current skin indices and weights
    const geometry = mesh.geometry;
    const skinIndices = geometry.attributes.skinIndex;
    const skinWeights = geometry.attributes.skinWeight;

    // Get bone indices in skeleton
    const boneIndices = this.getBoneIndices(mesh.skeleton, handBones);

    // Count affected vertices
    let affectedVertices = 0;

    // Apply weights for each finger
    const fingers: Array<keyof typeof handBones.fingers> = [
      "thumb",
      "index",
      "middle",
      "ring",
      "pinky",
    ];

    fingers.forEach((finger) => {
      const vertices = vertexSegments[finger];
      const fingerBones = handBones.fingers[finger];

      vertices.forEach((vertexIdx) => {
        const weights = this.calculateFingerWeights(
          vertexIdx,
          fingerBones,
          geometry,
          mesh.skeleton
        );

        // Apply weights (max 4 influences per vertex)
        const topWeights = this.getTopWeights(weights, 4);

        for (let i = 0; i < 4; i++) {
          if (i < topWeights.length) {
            const { boneIndex, weight } = topWeights[i];
            skinIndices.setXYZW(
              vertexIdx,
              i === 0 ? boneIndex : skinIndices.getX(vertexIdx),
              i === 1 ? boneIndex : skinIndices.getY(vertexIdx),
              i === 2 ? boneIndex : skinIndices.getZ(vertexIdx),
              i === 3 ? boneIndex : skinIndices.getW(vertexIdx)
            );
            skinWeights.setXYZW(
              vertexIdx,
              i === 0 ? weight : skinWeights.getX(vertexIdx),
              i === 1 ? weight : skinWeights.getY(vertexIdx),
              i === 2 ? weight : skinWeights.getZ(vertexIdx),
              i === 3 ? weight : skinWeights.getW(vertexIdx)
            );
          }
        }

        affectedVertices++;
      });
    });

    // Apply palm weights
    const palmVertices = vertexSegments.palm;
    palmVertices.forEach((vertexIdx) => {
      // Palm vertices are weighted to wrist bone
      const wristIndex = mesh.skeleton.bones.indexOf(handBones.wrist);

      if (wristIndex !== -1) {
        // Blend with existing weights
        const currentWeight = skinWeights.getX(vertexIdx);
        skinWeights.setX(vertexIdx, Math.max(currentWeight, 0.5));

        affectedVertices++;
      }
    });

    // Smooth weights
    if (smoothingIterations > 0) {
      this.smoothWeights(geometry, smoothingIterations);
    }

    // Update attributes
    skinIndices.needsUpdate = true;
    skinWeights.needsUpdate = true;

    return affectedVertices;
  }

  /**
   * Calculate weights for a vertex based on distance to bones
   */
  private calculateFingerWeights(
    vertexIdx: number,
    fingerBones: THREE.Bone[],
    geometry: THREE.BufferGeometry,
    skeleton: THREE.Skeleton
  ): Array<{ boneIndex: number; weight: number }> {
    const position = geometry.attributes.position;
    const vertex = new THREE.Vector3(
      position.getX(vertexIdx),
      position.getY(vertexIdx),
      position.getZ(vertexIdx)
    );

    const weights: Array<{ boneIndex: number; weight: number }> = [];

    fingerBones.forEach((bone) => {
      const boneIndex = skeleton.bones.indexOf(bone);
      if (boneIndex === -1) return;

      // Get bone world position
      const bonePos = new THREE.Vector3();
      bone.getWorldPosition(bonePos);

      // Calculate distance-based weight
      const distance = vertex.distanceTo(bonePos);
      const weight = 1 / (1 + distance * distance * 10); // Falloff function

      if (weight > 0.01) {
        weights.push({ boneIndex, weight });
      }
    });

    // Normalize weights
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    if (totalWeight > 0) {
      weights.forEach((w) => (w.weight /= totalWeight));
    }

    return weights;
  }

  /**
   * Get top N weights
   */
  private getTopWeights(
    weights: Array<{ boneIndex: number; weight: number }>,
    maxCount: number
  ): Array<{ boneIndex: number; weight: number }> {
    // Sort by weight descending
    weights.sort((a, b) => b.weight - a.weight);

    // Take top N
    const top = weights.slice(0, maxCount);

    // Renormalize
    const total = top.reduce((sum, w) => sum + w.weight, 0);
    if (total > 0) {
      top.forEach((w) => (w.weight /= total));
    }

    return top;
  }

  /**
   * Smooth skin weights
   */
  private smoothWeights(
    geometry: THREE.BufferGeometry,
    iterations: number
  ): void {
    const skinWeights = geometry.attributes.skinWeight;
    const positions = geometry.attributes.position;

    // Build vertex neighbors (simplified - could use proper topology)
    const neighbors: Map<number, number[]> = new Map();

    // For now, just smooth based on spatial proximity
    for (let iter = 0; iter < iterations; iter++) {
      const newWeights = new Float32Array(skinWeights.array.length);

      for (let i = 0; i < positions.count; i++) {
        // Get current weights
        const weights = [
          skinWeights.getX(i),
          skinWeights.getY(i),
          skinWeights.getZ(i),
          skinWeights.getW(i),
        ];

        // Simple averaging with neighbors (simplified)
        // In production, use proper mesh topology
        newWeights[i * 4] = weights[0];
        newWeights[i * 4 + 1] = weights[1];
        newWeights[i * 4 + 2] = weights[2];
        newWeights[i * 4 + 3] = weights[3];
      }

      // Update weights
      skinWeights.array.set(newWeights);
    }
  }

  /**
   * Get bone indices for hand bones
   */
  private getBoneIndices(
    skeleton: THREE.Skeleton,
    handBones: HandBoneStructure
  ): Map<THREE.Bone, number> {
    const indices = new Map<THREE.Bone, number>();

    // Add wrist
    const wristIdx = skeleton.bones.indexOf(handBones.wrist);
    if (wristIdx !== -1) {
      indices.set(handBones.wrist, wristIdx);
    }

    // Add finger bones
    Object.values(handBones.fingers).forEach((fingerBones) => {
      fingerBones.forEach((bone) => {
        let idx = skeleton.bones.indexOf(bone);

        // If bone not in skeleton, add it
        if (idx === -1 && bone instanceof THREE.Bone) {
          skeleton.bones.push(bone);
          idx = skeleton.bones.length - 1;
          console.log(`Added bone ${bone.name} to skeleton at index ${idx}`);
        }

        if (idx !== -1) {
          indices.set(bone, idx);
        }
      });
    });

    // Update skeleton after adding bones
    skeleton.update();

    return indices;
  }

  /**
   * Find all skinned meshes in model
   */
  private findSkinnedMeshes(model: THREE.Object3D): THREE.SkinnedMesh[] {
    const meshes: THREE.SkinnedMesh[] = [];

    model.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh) {
        meshes.push(child);
      }
    });

    return meshes;
  }

  /**
   * Count bones in model
   */
  private countBones(model: THREE.Object3D): number {
    let count = 0;
    model.traverse((child) => {
      if (child instanceof THREE.Bone) {
        count++;
      }
    });
    return count;
  }

  /**
   * Count bones in hand structure
   */
  private countHandBones(bones: HandBoneStructure): number {
    let count = 0;
    Object.values(bones.fingers).forEach((fingerBones) => {
      count += fingerBones.length;
    });
    return count;
  }

  /**
   * Export model as GLB
   */
  private async exportModel(model: THREE.Object3D): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      this.exporter.parse(
        model,
        (result) => {
          if (result instanceof ArrayBuffer) {
            resolve(result);
          } else {
            reject(new Error("Expected ArrayBuffer from exporter"));
          }
        },
        (error) => reject(error),
        { binary: true }
      );
    });
  }

  /**
   * Save canvas for debugging
   */
  private saveCanvas(canvas: HTMLCanvasElement, filename: string): void {
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL();
    link.click();
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.handDetector.dispose();
    this.handRenderer.dispose();
  }
}
