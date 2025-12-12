import * as THREE from "three";

/**
 * Bone mapping for different naming conventions
 */
export const BONE_MAPPING: Record<string, string[]> = {
  Hand_R: [
    "Hand_R",
    "mixamorig:RightHand",
    "RightHand",
    "hand_r",
    "Bip01_R_Hand",
  ],
  Hand_L: [
    "Hand_L",
    "mixamorig:LeftHand",
    "LeftHand",
    "hand_l",
    "Bip01_L_Hand",
  ],
  Head: ["Head", "mixamorig:Head", "head", "Bip01_Head"],
  Spine2: [
    "Spine2",
    "Spine02",
    "mixamorig:Spine2",
    "spine2",
    "Bip01_Spine2",
    "Chest",
    "chest",
  ],
  Hips: ["Hips", "mixamorig:Hips", "hips", "Bip01_Pelvis"],
};

/**
 * Default weapon offsets for different types
 */
export const WEAPON_OFFSETS: Record<
  string,
  {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
  }
> = {
  sword: {
    position: { x: 0.076, y: 0.077, z: 0.028 },
    rotation: { x: 92, y: 0, z: 0 },
  },
  "2h-sword": {
    position: { x: 0.076, y: 0.077, z: 0.028 },
    rotation: { x: 92, y: 0, z: 0 },
  },
  mace: {
    position: { x: 0.076, y: 0.077, z: 0.028 },
    rotation: { x: 92, y: 0, z: 0 },
  },
  bow: {
    position: { x: 0.05, y: 0.1, z: 0 },
    rotation: { x: 0, y: 90, z: 0 },
  },
  crossbow: {
    position: { x: 0.076, y: 0.05, z: 0.05 },
    rotation: { x: 0, y: 0, z: 0 },
  },
  shield: {
    position: { x: 0.05, y: 0.05, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  },
  default: {
    position: { x: 0.045, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  },
};

/**
 * Calculate avatar height from model
 */
export function calculateAvatarHeight(avatar: THREE.Object3D): number {
  // Update world matrices first
  avatar.updateMatrixWorld(true);

  // Find all SkinnedMesh objects and calculate combined bounds
  let minY = Infinity;
  let maxY = -Infinity;
  let foundMesh = false;

  avatar.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh) {
      foundMesh = true;

      // Get world space bounding box
      const box = new THREE.Box3();
      box.setFromObject(child);

      minY = Math.min(minY, box.min.y);
      maxY = Math.max(maxY, box.max.y);
    }
  });

  if (!foundMesh) {
    // Fallback to overall bounding box
    const box = new THREE.Box3().setFromObject(avatar);
    minY = box.min.y;
    maxY = box.max.y;
  }

  const height = maxY - minY;

  // Sanity check - if height seems wrong, use default
  if (height < 0.1 || height > 10) {
    console.warn(
      `⚠️ Calculated height seems incorrect (${height.toFixed(2)}m), using default 1.8m`,
    );
    return 1.8;
  }

  return height;
}

/**
 * Calculate appropriate weapon scale based on avatar size
 */
export function calculateWeaponScale(
  weapon: THREE.Object3D,
  avatar: THREE.Object3D,
  weaponType: string,
  avatarHeight: number,
): number {
  // Update matrices before measuring
  weapon.updateMatrixWorld(true);

  // Measure the entire weapon object
  const weaponBox = new THREE.Box3().setFromObject(weapon);
  const weaponSize = new THREE.Vector3();
  weaponBox.getSize(weaponSize);
  const weaponLength = Math.max(weaponSize.x, weaponSize.y, weaponSize.z);

  // Special handling for armor - don't auto-scale
  if (weaponType === "armor") {
    return 1.0;
  }

  // Different weapon types should have different proportions relative to character height
  let targetProportion = 0.65; // Default: weapon is 65% of character height

  if (weaponType === "dagger" || weaponType === "knife") {
    targetProportion = 0.25; // Daggers are about 25% of character height
  } else if (weaponType === "sword" || weaponType === "axe") {
    // Swords scale based on creature size
    if (avatarHeight < 1.2) {
      targetProportion = 0.72; // Smaller creatures use proportionally larger weapons
    } else if (avatarHeight > 2.5) {
      targetProportion = 0.55; // Larger creatures use proportionally smaller weapons
    } else {
      targetProportion = 0.65; // Medium creatures use standard proportion
    }
  } else if (weaponType === "spear" || weaponType === "staff") {
    targetProportion = 1.1; // Spears/staves are taller than character
  } else if (weaponType === "bow") {
    targetProportion = 0.8; // Bows are about 80% of character height
  }

  const targetWeaponLength = avatarHeight * targetProportion;
  const scaleFactor = targetWeaponLength / weaponLength;

  return scaleFactor;
}

/**
 * Create a normalized weapon where grip point is at origin
 */
export function createNormalizedWeapon(
  originalMesh: THREE.Object3D,
  gripPoint: THREE.Vector3,
): THREE.Object3D {
  // Clone the weapon so we don't modify the original
  const normalizedWeapon = originalMesh.clone();

  // Transform grip point if weapon was rotated during detection
  const transformedGrip = new THREE.Vector3();

  // Check weapon dimensions to determine if it was rotated during detection
  const weaponBox = new THREE.Box3().setFromObject(originalMesh);
  const weaponSize = new THREE.Vector3();
  weaponBox.getSize(weaponSize);

  if (weaponSize.z > weaponSize.x && weaponSize.z > weaponSize.y) {
    // Weapon was likely rotated during detection
    transformedGrip.set(
      gripPoint.x, // X unchanged
      gripPoint.z, // Detection Z -> Original Y
      -gripPoint.y, // Detection -Y -> Original Z (negate to flip back)
    );

    // Validate: grip Z should be negative (handle end)
    if (transformedGrip.z > 0) {
      transformedGrip.z = -transformedGrip.z;
    }
  } else {
    // No rotation needed
    transformedGrip.copy(gripPoint);
  }

  // Create a group to hold the transformed weapon
  const weaponGroup = new THREE.Group();
  weaponGroup.name = "NormalizedWeapon";
  weaponGroup.userData.isNormalized = true;

  // Offset the weapon so the grip point is at origin
  normalizedWeapon.position.set(
    -transformedGrip.x,
    -transformedGrip.y,
    -transformedGrip.z,
  );

  // Update matrices
  normalizedWeapon.updateMatrix();
  normalizedWeapon.matrixAutoUpdate = true;

  weaponGroup.add(normalizedWeapon);

  return weaponGroup;
}

/**
 * Find bone in avatar skeleton
 */
export function findBone(
  object: THREE.Object3D,
  boneName: string,
): THREE.Bone | null {
  const possibleNames = BONE_MAPPING[boneName] || [boneName];
  let foundBone: THREE.Bone | null = null;

  // Search through all SkinnedMesh objects and their skeletons
  object.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh && child.skeleton) {
      child.skeleton.bones.forEach((bone) => {
        // Check exact matches first
        if (possibleNames.includes(bone.name)) {
          foundBone = bone;
        }
        // If no exact match, check partial matches
        else if (!foundBone) {
          for (const possibleName of possibleNames) {
            if (
              bone.name.toLowerCase().includes(possibleName.toLowerCase()) ||
              possibleName.toLowerCase().includes(bone.name.toLowerCase())
            ) {
              foundBone = bone;
              break;
            }
          }
        }
      });
    }
  });

  return foundBone;
}

/**
 * Get accumulated world scale of an object
 */
export function getWorldScale(object: THREE.Object3D): THREE.Vector3 {
  const worldScale = new THREE.Vector3();
  object.getWorldScale(worldScale);
  return worldScale;
}

/**
 * Get the bone that equipment is attached to (handling wrapper groups)
 */
export function getAttachedBone(equipment: THREE.Object3D): THREE.Bone | null {
  let parent = equipment.parent;
  while (parent) {
    if (parent instanceof THREE.Bone) {
      return parent;
    }
    parent = parent.parent;
  }
  return null;
}
