/**
 * Semantic bone name mappings for common skeleton formats
 *
 * These mappings translate bone names between different rigging conventions,
 * enabling weight transfer and retargeting between skeletons with different
 * naming schemes but similar anatomical structure.
 */

/**
 * Meshy → Mixamo Bone Mapping
 *
 * Maps Meshy's 24-bone humanoid skeleton to Mixamo's 67-bone skeleton.
 * Only maps to the primary structural bones, ignoring Mixamo's extra detail bones
 * (fingers, face, spine subdivisions, etc.)
 */
export const MESHY_TO_MIXAMO: Record<string, string> = {
  // ========================================
  // CORE / TORSO
  // ========================================
  Hips: "DEF-hips",

  // Meshy typically has 1-3 spine bones, map to Mixamo's 3 spine bones
  Spine: "DEF-spine001", // Lower spine
  Spine01: "DEF-spine002", // Middle spine (chest area)
  Spine02: "DEF-spine003", // Upper spine

  // ========================================
  // HEAD / NECK
  // ========================================
  Neck: "DEF-neck",
  Head: "DEF-head",

  // ========================================
  // LEFT ARM
  // ========================================
  LeftShoulder: "DEF-shoulderL",
  LeftArm: "DEF-upper_armL",
  LeftForeArm: "DEF-forearmL",
  LeftHand: "DEF-handL",

  // ========================================
  // RIGHT ARM
  // ========================================
  RightShoulder: "DEF-shoulderR",
  RightArm: "DEF-upper_armR",
  RightForeArm: "DEF-forearmR",
  RightHand: "DEF-handR",

  // ========================================
  // LEFT LEG
  // ========================================
  LeftUpLeg: "DEF-thighL", // UpLeg = Thigh
  LeftLeg: "DEF-shinL", // Leg = Shin
  LeftFoot: "DEF-footL",
  LeftToeBase: "DEF-toeL",

  // ========================================
  // RIGHT LEG
  // ========================================
  RightUpLeg: "DEF-thighR",
  RightLeg: "DEF-shinR",
  RightFoot: "DEF-footR",
  RightToeBase: "DEF-toeR",
};

/**
 * Reverse mapping: Mixamo → Meshy
 * Useful for debugging or bidirectional workflows
 */
export const MIXAMO_TO_MESHY: Record<string, string> = Object.fromEntries(
  Object.entries(MESHY_TO_MIXAMO).map(([k, v]) => [v, k]),
);

/**
 * Alternative Meshy bone name variations
 * Some Meshy exports use slightly different naming conventions
 */
export const MESHY_VARIATIONS: Record<string, string[]> = {
  Hips: ["Hips", "hips", "Hip", "hip", "pelvis", "Pelvis"],
  Spine: ["Spine", "spine"],
  Spine01: ["Spine01", "spine01", "Spine1", "spine1"],
  Spine02: ["Spine02", "spine02", "Spine2", "spine2"],
  Neck: ["Neck", "neck"],
  Head: ["Head", "head"],

  LeftShoulder: ["LeftShoulder", "shoulder.L", "shoulder_L", "L_Shoulder"],
  LeftArm: [
    "LeftArm",
    "LeftUpperArm",
    "upper_arm.L",
    "upperarm_L",
    "L_UpperArm",
  ],
  LeftForeArm: [
    "LeftForeArm",
    "LeftLowerArm",
    "forearm.L",
    "forearm_L",
    "L_ForeArm",
  ],
  LeftHand: ["LeftHand", "hand.L", "hand_L", "L_Hand"],

  RightShoulder: ["RightShoulder", "shoulder.R", "shoulder_R", "R_Shoulder"],
  RightArm: [
    "RightArm",
    "RightUpperArm",
    "upper_arm.R",
    "upperarm_R",
    "R_UpperArm",
  ],
  RightForeArm: [
    "RightForeArm",
    "RightLowerArm",
    "forearm.R",
    "forearm_R",
    "R_ForeArm",
  ],
  RightHand: ["RightHand", "hand.R", "hand_R", "R_Hand"],

  LeftUpLeg: [
    "LeftUpLeg",
    "LeftThigh",
    "thigh.L",
    "thigh_L",
    "L_UpLeg",
    "L_Thigh",
  ],
  LeftLeg: ["LeftLeg", "LeftShin", "shin.L", "shin_L", "L_Leg", "L_Shin"],
  LeftFoot: ["LeftFoot", "foot.L", "foot_L", "L_Foot"],
  LeftToeBase: ["LeftToeBase", "LeftToe", "toe.L", "toe_L", "L_Toe"],

  RightUpLeg: [
    "RightUpLeg",
    "RightThigh",
    "thigh.R",
    "thigh_R",
    "R_UpLeg",
    "R_Thigh",
  ],
  RightLeg: ["RightLeg", "RightShin", "shin.R", "shin_R", "R_Leg", "R_Shin"],
  RightFoot: ["RightFoot", "foot.R", "foot_R", "R_Foot"],
  RightToeBase: ["RightToeBase", "RightToe", "toe.R", "toe_R", "R_Toe"],
};

/**
 * Mixamo bone name variations
 * Mixamo exports can have different prefixes or formats
 */
export const MIXAMO_VARIATIONS: Record<string, string[]> = {
  "DEF-hips": ["DEF-hips", "mixamorig:Hips", "Hips", "hips"],
  "DEF-spine001": ["DEF-spine001", "mixamorig:Spine", "Spine"],
  "DEF-spine002": ["DEF-spine002", "mixamorig:Spine1", "Spine1"],
  "DEF-spine003": ["DEF-spine003", "mixamorig:Spine2", "Spine2"],
  "DEF-neck": ["DEF-neck", "mixamorig:Neck", "Neck"],
  "DEF-head": ["DEF-head", "mixamorig:Head", "Head"],

  "DEF-shoulderL": ["DEF-shoulderL", "mixamorig:LeftShoulder", "LeftShoulder"],
  "DEF-upper_armL": ["DEF-upper_armL", "mixamorig:LeftArm", "LeftArm"],
  "DEF-forearmL": ["DEF-forearmL", "mixamorig:LeftForeArm", "LeftForeArm"],
  "DEF-handL": ["DEF-handL", "mixamorig:LeftHand", "LeftHand"],

  "DEF-shoulderR": [
    "DEF-shoulderR",
    "mixamorig:RightShoulder",
    "RightShoulder",
  ],
  "DEF-upper_armR": ["DEF-upper_armR", "mixamorig:RightArm", "RightArm"],
  "DEF-forearmR": ["DEF-forearmR", "mixamorig:RightForeArm", "RightForeArm"],
  "DEF-handR": ["DEF-handR", "mixamorig:RightHand", "RightHand"],

  "DEF-thighL": ["DEF-thighL", "mixamorig:LeftUpLeg", "LeftUpLeg"],
  "DEF-shinL": ["DEF-shinL", "mixamorig:LeftLeg", "LeftLeg"],
  "DEF-footL": ["DEF-footL", "mixamorig:LeftFoot", "LeftFoot"],
  "DEF-toeL": ["DEF-toeL", "mixamorig:LeftToeBase", "LeftToeBase"],

  "DEF-thighR": ["DEF-thighR", "mixamorig:RightUpLeg", "RightUpLeg"],
  "DEF-shinR": ["DEF-shinR", "mixamorig:RightLeg", "RightLeg"],
  "DEF-footR": ["DEF-footR", "mixamorig:RightFoot", "RightFoot"],
  "DEF-toeR": ["DEF-toeR", "mixamorig:RightToeBase", "RightToeBase"],
};

/**
 * Helper function: Find canonical Meshy bone name from variations
 */
export function findMeshyBoneName(name: string): string | null {
  for (const [canonical, variations] of Object.entries(MESHY_VARIATIONS)) {
    if (variations.includes(name)) {
      return canonical;
    }
  }
  return null;
}

/**
 * Helper function: Find canonical Mixamo bone name from variations
 */
export function findMixamoBoneName(name: string): string | null {
  for (const [canonical, variations] of Object.entries(MIXAMO_VARIATIONS)) {
    if (variations.includes(name)) {
      return canonical;
    }
  }
  return null;
}

/**
 * Create bone mapping with variation support
 * Handles different naming conventions automatically
 */
export function createBoneMapping(
  sourceBoneNames: string[],
  targetBoneNames: string[],
  mappingDict: Record<string, string>,
): Map<string, string> {
  const result = new Map<string, string>();

  console.log("🔗 Creating bone mapping...");
  console.log("  Source bones:", sourceBoneNames.length);
  console.log("  Target bones:", targetBoneNames.length);

  let mappedCount = 0;
  let unmappedCount = 0;

  for (const sourceName of sourceBoneNames) {
    // Try to find canonical name
    const canonical = findMeshyBoneName(sourceName) || sourceName;

    // Look up in mapping dictionary
    const mappedName = mappingDict[canonical];

    if (mappedName) {
      // Check if target actually has this bone (or a variation)
      // mappedName is a Meshy bone name, so use findMeshyBoneName
      const targetCanonical = findMeshyBoneName(mappedName);
      const actualTargetName = targetBoneNames.find(
        (name) =>
          name === mappedName || findMeshyBoneName(name) === targetCanonical,
      );

      if (actualTargetName) {
        result.set(sourceName, actualTargetName);
        mappedCount++;
        console.log(`  ✅ ${sourceName} → ${actualTargetName}`);
      } else {
        unmappedCount++;
        console.log(
          `  ❌ ${sourceName} → ${mappedName} (target bone not found)`,
        );
      }
    } else {
      unmappedCount++;
      console.log(`  ⚠️  ${sourceName} (no mapping defined)`);
    }
  }

  console.log(
    `✅ Mapping complete: ${mappedCount} mapped, ${unmappedCount} unmapped`,
  );
  console.log(
    `   Mapping quality: ${((mappedCount / sourceBoneNames.length) * 100).toFixed(1)}%`,
  );

  return result;
}

/**
 * VRM → Mixamo Bone Mapping (for future use)
 * If you need to support VRM avatars with Mixamo animations
 */
export const VRM_TO_MIXAMO: Record<string, string> = {
  hips: "DEF-hips",
  spine: "DEF-spine002",
  chest: "DEF-spine003",
  neck: "DEF-neck",
  head: "DEF-head",

  leftShoulder: "DEF-shoulderL",
  leftUpperArm: "DEF-upper_armL",
  leftLowerArm: "DEF-forearmL",
  leftHand: "DEF-handL",

  rightShoulder: "DEF-shoulderR",
  rightUpperArm: "DEF-upper_armR",
  rightLowerArm: "DEF-forearmR",
  rightHand: "DEF-handR",

  leftUpperLeg: "DEF-thighL",
  leftLowerLeg: "DEF-shinL",
  leftFoot: "DEF-footL",
  leftToes: "DEF-toeL",

  rightUpperLeg: "DEF-thighR",
  rightLowerLeg: "DEF-shinR",
  rightFoot: "DEF-footR",
  rightToes: "DEF-toeR",
};
