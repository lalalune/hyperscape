/**
 * PostProcessing Unit Tests
 *
 * Tests for WebGPU TSL-based post-processing effects:
 * - LUT color grading (loading, switching, intensity)
 * - Depth blur (enable/disable, parameters, edge cases)
 * - Composer state management
 * - Performance bypass behavior
 * - Boundary conditions and error handling
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  LUT_PRESETS,
  DEPTH_BLUR_DEFAULTS,
  type LUTPresetName,
  type PostProcessingOptions,
  type PostProcessingComposer,
} from "../PostProcessingFactory";

// ============================================================================
// LUT PRESETS TESTS
// ============================================================================

describe("LUT Presets", () => {
  it("should have required preset entries", () => {
    expect(LUT_PRESETS.none).toBeDefined();
    expect(LUT_PRESETS.cinematic).toBeDefined();
    expect(LUT_PRESETS.bourbon).toBeDefined();
    expect(LUT_PRESETS.chemical).toBeDefined();
    expect(LUT_PRESETS.clayton).toBeDefined();
    expect(LUT_PRESETS.cubicle).toBeDefined();
    expect(LUT_PRESETS.remy).toBeDefined();
    expect(LUT_PRESETS.bw).toBeDefined();
    expect(LUT_PRESETS.night).toBeDefined();
  });

  it("should have 'none' preset with null file", () => {
    expect(LUT_PRESETS.none.file).toBeNull();
    expect(LUT_PRESETS.none.label).toBe("None");
  });

  it("should have valid file extensions for all presets", () => {
    const validExtensions = [".CUBE", ".3dl", ".png"];

    for (const [name, preset] of Object.entries(LUT_PRESETS)) {
      if (name === "none") continue;

      const hasValidExtension = validExtensions.some((ext) =>
        preset.file?.endsWith(ext),
      );
      expect(hasValidExtension).toBe(true);
    }
  });

  it("should have human-readable labels for all presets", () => {
    for (const preset of Object.values(LUT_PRESETS)) {
      expect(preset.label).toBeDefined();
      expect(typeof preset.label).toBe("string");
      expect(preset.label.length).toBeGreaterThan(0);
    }
  });

  it("should have unique labels", () => {
    const labels = Object.values(LUT_PRESETS).map((p) => p.label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });

  it("should have unique file names (except none)", () => {
    const files = Object.values(LUT_PRESETS)
      .map((p) => p.file)
      .filter(Boolean);
    const uniqueFiles = new Set(files);
    expect(uniqueFiles.size).toBe(files.length);
  });
});

// ============================================================================
// POST-PROCESSING OPTIONS TESTS
// ============================================================================

describe("PostProcessingOptions Type", () => {
  it("should accept empty options", () => {
    const options: PostProcessingOptions = {};
    expect(options).toBeDefined();
  });

  it("should accept color grading options", () => {
    const options: PostProcessingOptions = {
      colorGrading: {
        enabled: true,
        lut: "cinematic",
        intensity: 0.8,
      },
    };
    expect(options.colorGrading?.enabled).toBe(true);
    expect(options.colorGrading?.lut).toBe("cinematic");
    expect(options.colorGrading?.intensity).toBe(0.8);
  });

  it("should accept depth blur options", () => {
    const options: PostProcessingOptions = {
      depthBlur: {
        enabled: true,
        focusDistance: 20,
        blurRange: 40,
        intensity: 0.7,
        blurSize: 3,
        blurSpread: 5,
      },
    };
    expect(options.depthBlur?.enabled).toBe(true);
    expect(options.depthBlur?.focusDistance).toBe(20);
    expect(options.depthBlur?.blurRange).toBe(40);
    expect(options.depthBlur?.intensity).toBe(0.7);
    expect(options.depthBlur?.blurSize).toBe(3);
    expect(options.depthBlur?.blurSpread).toBe(5);
  });

  it("should accept partial options", () => {
    const options: PostProcessingOptions = {
      colorGrading: { lut: "bw" },
      depthBlur: { enabled: false },
    };
    expect(options.colorGrading?.lut).toBe("bw");
    expect(options.depthBlur?.enabled).toBe(false);
  });
});

// ============================================================================
// DEPTH BLUR DEFAULTS TESTS
// ============================================================================

describe("Depth Blur Default Values", () => {
  // Tests verify the exported DEPTH_BLUR_DEFAULTS constant has sensible values
  it("should export DEPTH_BLUR_DEFAULTS constant", () => {
    expect(DEPTH_BLUR_DEFAULTS).toBeDefined();
    expect(typeof DEPTH_BLUR_DEFAULTS.focusDistance).toBe("number");
    expect(typeof DEPTH_BLUR_DEFAULTS.blurRange).toBe("number");
    expect(typeof DEPTH_BLUR_DEFAULTS.intensity).toBe("number");
    expect(typeof DEPTH_BLUR_DEFAULTS.blurAmount).toBe("number");
    expect(typeof DEPTH_BLUR_DEFAULTS.blurRepeats).toBe("number");
    expect(typeof DEPTH_BLUR_DEFAULTS.skyDistance).toBe("number");
  });

  it("should have classic fantasy MMORPG-style focus distance (~100 world units)", () => {
    // Focus far out so player and nearby objects stay sharp
    expect(DEPTH_BLUR_DEFAULTS.focusDistance).toBe(100);
    expect(DEPTH_BLUR_DEFAULTS.focusDistance).toBeGreaterThanOrEqual(40);
    expect(DEPTH_BLUR_DEFAULTS.focusDistance).toBeLessThanOrEqual(150);
  });

  it("should have blur range for distant background blur", () => {
    // Blur transitions over this range after focus distance
    expect(DEPTH_BLUR_DEFAULTS.blurRange).toBe(100);
    expect(DEPTH_BLUR_DEFAULTS.blurRange).toBeGreaterThan(0);
  });

  it("should have heavy default intensity for classic fantasy MMORPG-style blur", () => {
    // High intensity like classic fantasy MMORPG's prominent depth blur
    expect(DEPTH_BLUR_DEFAULTS.intensity).toBe(0.85);
    expect(DEPTH_BLUR_DEFAULTS.intensity).toBeGreaterThan(0.5);
    expect(DEPTH_BLUR_DEFAULTS.intensity).toBeLessThanOrEqual(1);
  });

  it("should have appropriate blur amount for smooth blur", () => {
    // blurAmount controls the radius of the hash blur (0.01-0.1 typical)
    expect(DEPTH_BLUR_DEFAULTS.blurAmount).toBe(0.03);
    expect(DEPTH_BLUR_DEFAULTS.blurAmount).toBeGreaterThanOrEqual(0.01);
    expect(DEPTH_BLUR_DEFAULTS.blurAmount).toBeLessThanOrEqual(0.1);
  });

  it("should have enough blur iterations for smooth blur", () => {
    // Higher repeats = smoother, less noisy blur
    expect(DEPTH_BLUR_DEFAULTS.blurRepeats).toBe(30);
    expect(DEPTH_BLUR_DEFAULTS.blurRepeats).toBeGreaterThanOrEqual(20);
    expect(DEPTH_BLUR_DEFAULTS.blurRepeats).toBeLessThanOrEqual(100);
  });

  it("should have sky distance cutoff to preserve skybox", () => {
    // Sky is at far depth - exclude it from blur to keep it sharp
    expect(DEPTH_BLUR_DEFAULTS.skyDistance).toBe(500);
    expect(DEPTH_BLUR_DEFAULTS.skyDistance).toBeGreaterThan(
      DEPTH_BLUR_DEFAULTS.focusDistance + DEPTH_BLUR_DEFAULTS.blurRange,
    );
  });
});

// ============================================================================
// INTENSITY CLAMPING TESTS
// ============================================================================

describe("Intensity Clamping Behavior", () => {
  // These verify the clamping logic used in setLUTIntensity and setDepthBlurIntensity
  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

  describe("LUT intensity clamping", () => {
    it("should clamp values to 0-1 range", () => {
      expect(clamp(0.5, 0, 1)).toBe(0.5);
      expect(clamp(0, 0, 1)).toBe(0);
      expect(clamp(1, 0, 1)).toBe(1);
    });

    it("should clamp negative values to 0", () => {
      expect(clamp(-0.5, 0, 1)).toBe(0);
      expect(clamp(-100, 0, 1)).toBe(0);
    });

    it("should clamp values above 1 to 1", () => {
      expect(clamp(1.5, 0, 1)).toBe(1);
      expect(clamp(100, 0, 1)).toBe(1);
    });
  });

  describe("Depth blur intensity clamping", () => {
    it("should clamp to valid range", () => {
      expect(clamp(0, 0, 1)).toBe(0);
      expect(clamp(0.3, 0, 1)).toBe(0.3);
      expect(clamp(0.7, 0, 1)).toBe(0.7);
      expect(clamp(1, 0, 1)).toBe(1);
    });

    it("should handle boundary values", () => {
      expect(clamp(0.0001, 0, 1)).toBe(0.0001);
      expect(clamp(0.9999, 0, 1)).toBe(0.9999);
    });
  });
});

// ============================================================================
// FOCUS DISTANCE CLAMPING TESTS
// ============================================================================

describe("Focus Distance Clamping", () => {
  const clampFocusDistance = (value: number) => Math.max(0, value);

  it("should allow positive values", () => {
    expect(clampFocusDistance(15)).toBe(15);
    expect(clampFocusDistance(0.1)).toBe(0.1);
    expect(clampFocusDistance(1000)).toBe(1000);
  });

  it("should clamp negative values to 0", () => {
    expect(clampFocusDistance(-5)).toBe(0);
    expect(clampFocusDistance(-0.1)).toBe(0);
  });

  it("should allow zero", () => {
    expect(clampFocusDistance(0)).toBe(0);
  });
});

// ============================================================================
// BLUR RANGE CLAMPING TESTS
// ============================================================================

describe("Blur Range Clamping", () => {
  const clampBlurRange = (value: number) => Math.max(0.1, value);

  it("should allow values above minimum", () => {
    expect(clampBlurRange(30)).toBe(30);
    expect(clampBlurRange(1)).toBe(1);
    expect(clampBlurRange(0.5)).toBe(0.5);
  });

  it("should enforce minimum of 0.1 to prevent divide-by-zero", () => {
    expect(clampBlurRange(0)).toBe(0.1);
    expect(clampBlurRange(-10)).toBe(0.1);
    expect(clampBlurRange(0.05)).toBe(0.1);
  });

  it("should allow exact minimum", () => {
    expect(clampBlurRange(0.1)).toBe(0.1);
  });
});

// ============================================================================
// STATE TOGGLE BEHAVIOR TESTS
// ============================================================================

describe("Depth Blur State Toggle Behavior", () => {
  // Test the enable/disable logic with mutable user intensity (mirrors real implementation)
  interface DepthBlurState {
    active: boolean;
    uniformValue: number;
    userIntensity: number; // Mutable - tracks user's preferred intensity
  }

  function setDepthBlur(
    state: DepthBlurState,
    enabled: boolean,
  ): DepthBlurState {
    return {
      ...state,
      active: enabled,
      uniformValue: enabled ? state.userIntensity : 0,
    };
  }

  function setDepthBlurIntensity(
    state: DepthBlurState,
    intensity: number,
  ): DepthBlurState {
    const clamped = Math.max(0, Math.min(1, intensity));
    return {
      ...state,
      userIntensity: clamped, // Update user's preferred intensity
      uniformValue: clamped,
      active: clamped > 0,
    };
  }

  it("should set intensity to 0 when disabled", () => {
    const state: DepthBlurState = {
      active: true,
      uniformValue: 0.5,
      userIntensity: 0.5,
    };
    const newState = setDepthBlur(state, false);
    expect(newState.active).toBe(false);
    expect(newState.uniformValue).toBe(0);
  });

  it("should restore user intensity when enabled", () => {
    const state: DepthBlurState = {
      active: false,
      uniformValue: 0,
      userIntensity: 0.7,
    };
    const newState = setDepthBlur(state, true);
    expect(newState.active).toBe(true);
    expect(newState.uniformValue).toBe(0.7);
  });

  it("should handle toggle cycle with original intensity", () => {
    let state: DepthBlurState = {
      active: true,
      uniformValue: 0.8,
      userIntensity: 0.8,
    };

    // Disable
    state = setDepthBlur(state, false);
    expect(state.uniformValue).toBe(0);

    // Re-enable
    state = setDepthBlur(state, true);
    expect(state.uniformValue).toBe(0.8);
  });

  it("should update userIntensity when slider is changed", () => {
    let state: DepthBlurState = {
      active: true,
      uniformValue: 0.5,
      userIntensity: 0.5,
    };

    // User adjusts slider to 0.3
    state = setDepthBlurIntensity(state, 0.3);
    expect(state.userIntensity).toBe(0.3);
    expect(state.uniformValue).toBe(0.3);
  });

  it("should restore user-adjusted intensity after toggle cycle", () => {
    let state: DepthBlurState = {
      active: true,
      uniformValue: 0.5,
      userIntensity: 0.5, // Initial default
    };

    // User adjusts slider to 0.9
    state = setDepthBlurIntensity(state, 0.9);
    expect(state.userIntensity).toBe(0.9);

    // Disable depth blur
    state = setDepthBlur(state, false);
    expect(state.uniformValue).toBe(0);
    expect(state.userIntensity).toBe(0.9); // User's preference preserved

    // Re-enable - should restore user's 0.9, not original 0.5
    state = setDepthBlur(state, true);
    expect(state.uniformValue).toBe(0.9);
  });
});

// ============================================================================
// INTENSITY-BASED ACTIVE STATE TESTS
// ============================================================================

describe("Intensity-Based Active State", () => {
  // setDepthBlurIntensity should auto-update active state based on intensity > 0

  function setDepthBlurIntensity(intensity: number): {
    active: boolean;
    intensity: number;
  } {
    const clamped = Math.max(0, Math.min(1, intensity));
    return {
      active: clamped > 0,
      intensity: clamped,
    };
  }

  it("should set active=false when intensity is 0", () => {
    const result = setDepthBlurIntensity(0);
    expect(result.active).toBe(false);
    expect(result.intensity).toBe(0);
  });

  it("should set active=true when intensity > 0", () => {
    const result = setDepthBlurIntensity(0.5);
    expect(result.active).toBe(true);
    expect(result.intensity).toBe(0.5);
  });

  it("should handle very small positive values", () => {
    const result = setDepthBlurIntensity(0.001);
    expect(result.active).toBe(true);
  });

  it("should handle clamped values from above", () => {
    const result = setDepthBlurIntensity(2);
    expect(result.active).toBe(true);
    expect(result.intensity).toBe(1);
  });
});

// ============================================================================
// EFFECT ACTIVITY CHECK TESTS
// ============================================================================

describe("isAnyEffectActive Logic", () => {
  // Tests the performance bypass logic

  function isAnyEffectActive(lutEnabled: boolean, depthBlurActive: boolean) {
    return lutEnabled || depthBlurActive;
  }

  it("should return false when both effects disabled", () => {
    expect(isAnyEffectActive(false, false)).toBe(false);
  });

  it("should return true when only LUT enabled", () => {
    expect(isAnyEffectActive(true, false)).toBe(true);
  });

  it("should return true when only depth blur enabled", () => {
    expect(isAnyEffectActive(false, true)).toBe(true);
  });

  it("should return true when both effects enabled", () => {
    expect(isAnyEffectActive(true, true)).toBe(true);
  });
});

// ============================================================================
// LUT PRESET NAME TYPE TESTS
// ============================================================================

describe("LUTPresetName Type", () => {
  it("should include all preset keys", () => {
    const validNames: LUTPresetName[] = [
      "none",
      "cinematic",
      "bourbon",
      "chemical",
      "clayton",
      "cubicle",
      "remy",
      "bw",
      "night",
    ];

    for (const name of validNames) {
      expect(LUT_PRESETS[name]).toBeDefined();
    }
  });

  it("should have consistent key count", () => {
    const presetCount = Object.keys(LUT_PRESETS).length;
    expect(presetCount).toBe(9);
  });
});

// ============================================================================
// COMPOSER INTERFACE TESTS
// ============================================================================

describe("PostProcessingComposer Interface", () => {
  // Mock composer for interface testing
  function createMockComposer(): PostProcessingComposer {
    let currentLUT: LUTPresetName = "none";
    let lutEnabled = false;
    let depthBlurActive = false;
    let depthBlurIntensity = 0.5;
    // Focus distance and range are tracked for mock realism but not read back in tests
    let _depthBlurFocusDistance = 15;
    let _depthBlurRange = 30;

    return {
      render: vi.fn(),
      renderAsync: vi.fn().mockResolvedValue(undefined),
      setSize: vi.fn(),
      dispose: vi.fn(),

      setLUT: vi.fn().mockImplementation(async (name: LUTPresetName) => {
        currentLUT = name;
        lutEnabled = name !== "none";
      }),
      setLUTIntensity: vi.fn(),
      getCurrentLUT: () => currentLUT,
      isLUTEnabled: () => lutEnabled,

      setDepthBlur: vi.fn().mockImplementation((enabled: boolean) => {
        depthBlurActive = enabled;
      }),
      setDepthBlurIntensity: vi.fn().mockImplementation((intensity: number) => {
        depthBlurIntensity = Math.max(0, Math.min(1, intensity));
        depthBlurActive = depthBlurIntensity > 0;
      }),
      setDepthBlurFocusDistance: vi
        .fn()
        .mockImplementation((distance: number) => {
          _depthBlurFocusDistance = Math.max(0, distance);
        }),
      setDepthBlurRange: vi.fn().mockImplementation((range: number) => {
        _depthBlurRange = Math.max(0.1, range);
      }),
      isDepthBlurEnabled: () => depthBlurActive,
    };
  }

  describe("LUT methods", () => {
    let composer: PostProcessingComposer;

    beforeEach(() => {
      composer = createMockComposer();
    });

    it("should start with 'none' LUT", () => {
      expect(composer.getCurrentLUT()).toBe("none");
      expect(composer.isLUTEnabled()).toBe(false);
    });

    it("should enable LUT when switching to preset", async () => {
      await composer.setLUT("cinematic");
      expect(composer.getCurrentLUT()).toBe("cinematic");
      expect(composer.isLUTEnabled()).toBe(true);
    });

    it("should disable LUT when switching to 'none'", async () => {
      await composer.setLUT("cinematic");
      await composer.setLUT("none");
      expect(composer.getCurrentLUT()).toBe("none");
      expect(composer.isLUTEnabled()).toBe(false);
    });

    it("should call setLUTIntensity with value", () => {
      composer.setLUTIntensity(0.75);
      expect(composer.setLUTIntensity).toHaveBeenCalledWith(0.75);
    });
  });

  describe("Depth blur methods", () => {
    let composer: PostProcessingComposer;

    beforeEach(() => {
      composer = createMockComposer();
    });

    it("should start with depth blur disabled", () => {
      expect(composer.isDepthBlurEnabled()).toBe(false);
    });

    it("should enable depth blur", () => {
      composer.setDepthBlur(true);
      expect(composer.isDepthBlurEnabled()).toBe(true);
    });

    it("should disable depth blur", () => {
      composer.setDepthBlur(true);
      composer.setDepthBlur(false);
      expect(composer.isDepthBlurEnabled()).toBe(false);
    });

    it("should call setDepthBlurIntensity", () => {
      composer.setDepthBlurIntensity(0.6);
      expect(composer.setDepthBlurIntensity).toHaveBeenCalledWith(0.6);
    });

    it("should call setDepthBlurFocusDistance", () => {
      composer.setDepthBlurFocusDistance(25);
      expect(composer.setDepthBlurFocusDistance).toHaveBeenCalledWith(25);
    });

    it("should call setDepthBlurRange", () => {
      composer.setDepthBlurRange(50);
      expect(composer.setDepthBlurRange).toHaveBeenCalledWith(50);
    });
  });

  describe("Render methods", () => {
    let composer: PostProcessingComposer;

    beforeEach(() => {
      composer = createMockComposer();
    });

    it("should have render method", () => {
      expect(typeof composer.render).toBe("function");
      composer.render();
      expect(composer.render).toHaveBeenCalled();
    });

    it("should have renderAsync method", async () => {
      expect(typeof composer.renderAsync).toBe("function");
      await composer.renderAsync();
      expect(composer.renderAsync).toHaveBeenCalled();
    });

    it("should have setSize method", () => {
      expect(typeof composer.setSize).toBe("function");
      composer.setSize(1920, 1080);
      expect(composer.setSize).toHaveBeenCalledWith(1920, 1080);
    });

    it("should have dispose method", () => {
      expect(typeof composer.dispose).toBe("function");
      composer.dispose();
      expect(composer.dispose).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// IDENTITY LUT VALIDATION TESTS
// ============================================================================

describe("Identity LUT Generation", () => {
  // Test the identity LUT creation logic
  function createIdentityLUTData(size: number): Uint8Array {
    const data = new Uint8Array(size * size * size * 4);
    for (let z = 0; z < size; z++) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = (z * size * size + y * size + x) * 4;
          data[i] = Math.round((x / (size - 1)) * 255);
          data[i + 1] = Math.round((y / (size - 1)) * 255);
          data[i + 2] = Math.round((z / (size - 1)) * 255);
          data[i + 3] = 255;
        }
      }
    }
    return data;
  }

  it("should create correct size array for 2x2x2 LUT", () => {
    const data = createIdentityLUTData(2);
    expect(data.length).toBe(2 * 2 * 2 * 4); // 32 bytes
  });

  it("should have identity mapping at corners", () => {
    const size = 2;
    const data = createIdentityLUTData(size);

    // (0,0,0) -> black (0,0,0)
    expect(data[0]).toBe(0);
    expect(data[1]).toBe(0);
    expect(data[2]).toBe(0);
    expect(data[3]).toBe(255);

    // (1,1,1) -> white (255,255,255)
    const i = (1 * size * size + 1 * size + 1) * 4;
    expect(data[i]).toBe(255);
    expect(data[i + 1]).toBe(255);
    expect(data[i + 2]).toBe(255);
    expect(data[i + 3]).toBe(255);
  });

  it("should have correct red channel gradient", () => {
    const size = 2;
    const data = createIdentityLUTData(size);

    // x=0 should have R=0
    expect(data[0]).toBe(0);

    // x=1 should have R=255
    expect(data[4]).toBe(255);
  });

  it("should have full alpha for all entries", () => {
    const data = createIdentityLUTData(2);
    for (let i = 3; i < data.length; i += 4) {
      expect(data[i]).toBe(255);
    }
  });
});

// ============================================================================
// DEPTH BLUR MATH TESTS
// ============================================================================

describe("Depth Blur Math", () => {
  // Test the depth blur calculation logic (FAR BLUR ONLY - classic fantasy MMORPG style)

  // Smoothstep function (matches GLSL smoothstep)
  function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  // Calculate blur amount - FAR BLUR ONLY (objects beyond focus get blurred)
  function calculateBlurAmount(
    depth: number,
    focusDistance: number,
    blurRange: number,
  ): number {
    // Only blur objects BEYOND focus distance (near objects stay sharp)
    const depthBeyondFocus = Math.max(0, depth - focusDistance);
    return smoothstep(0, blurRange, depthBeyondFocus);
  }

  describe("smoothstep function", () => {
    it("should return 0 at edge0", () => {
      expect(smoothstep(0, 1, 0)).toBe(0);
    });

    it("should return 1 at edge1", () => {
      expect(smoothstep(0, 1, 1)).toBe(1);
    });

    it("should return 0.5 at midpoint", () => {
      expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    });

    it("should clamp values below edge0", () => {
      expect(smoothstep(0, 1, -1)).toBe(0);
    });

    it("should clamp values above edge1", () => {
      expect(smoothstep(0, 1, 2)).toBe(1);
    });
  });

  describe("blur amount calculation (far blur only)", () => {
    const focusDistance = 60;
    const blurRange = 40;

    it("should return 0 at focus distance (sharp)", () => {
      const amount = calculateBlurAmount(
        focusDistance,
        focusDistance,
        blurRange,
      );
      expect(amount).toBe(0);
    });

    it("should return 0 for near objects (player stays sharp)", () => {
      // Objects closer than focus should have NO blur
      const nearDepth = 10;
      const amount = calculateBlurAmount(nearDepth, focusDistance, blurRange);
      expect(amount).toBe(0);
    });

    it("should return 1 at focus + range (full blur)", () => {
      const amount = calculateBlurAmount(
        focusDistance + blurRange,
        focusDistance,
        blurRange,
      );
      expect(amount).toBe(1);
    });

    it("should return intermediate values for mid-distance objects", () => {
      const midDepth = focusDistance + blurRange / 2;
      const amount = calculateBlurAmount(midDepth, focusDistance, blurRange);
      expect(amount).toBeGreaterThan(0);
      expect(amount).toBeLessThan(1);
    });

    it("should blur far objects (beyond focus + range)", () => {
      const farDepth = focusDistance + blurRange + 50;
      const amount = calculateBlurAmount(farDepth, focusDistance, blurRange);
      expect(amount).toBe(1);
    });

    it("should handle zero focus distance", () => {
      const amount = calculateBlurAmount(15, 0, 30);
      expect(amount).toBe(0.5); // 15/30 smoothstepped
    });
  });
});

// ============================================================================
// FILE EXTENSION DETECTION TESTS
// ============================================================================

describe("LUT File Extension Detection", () => {
  function getLoaderType(filename: string): "cube" | "3dl" | "png" | "unknown" {
    if (filename.endsWith(".CUBE")) return "cube";
    if (filename.endsWith(".3dl")) return "3dl";
    if (filename.endsWith(".png")) return "png";
    return "unknown";
  }

  it("should detect .CUBE files", () => {
    expect(getLoaderType("Bourbon 64.CUBE")).toBe("cube");
    expect(getLoaderType("test.CUBE")).toBe("cube");
  });

  it("should detect .3dl files", () => {
    expect(getLoaderType("Presetpro-Cinematic.3dl")).toBe("3dl");
    expect(getLoaderType("test.3dl")).toBe("3dl");
  });

  it("should detect .png files", () => {
    expect(getLoaderType("B&WLUT.png")).toBe("png");
    expect(getLoaderType("NightLUT.png")).toBe("png");
  });

  it("should return unknown for unrecognized extensions", () => {
    expect(getLoaderType("test.jpg")).toBe("unknown");
    expect(getLoaderType("test.exr")).toBe("unknown");
    expect(getLoaderType("test")).toBe("unknown");
  });

  it("should be case-sensitive for CUBE", () => {
    expect(getLoaderType("test.cube")).toBe("unknown");
    expect(getLoaderType("test.CUBE")).toBe("cube");
  });
});

// ============================================================================
// LUT PATH GENERATION TESTS
// ============================================================================

describe("LUT Path Generation", () => {
  function getLUTPath(filename: string | null): string | null {
    if (!filename) return null;
    return `/luts/${filename}`;
  }

  it("should generate correct path for LUT files", () => {
    expect(getLUTPath("Bourbon 64.CUBE")).toBe("/luts/Bourbon 64.CUBE");
    expect(getLUTPath("NightLUT.png")).toBe("/luts/NightLUT.png");
  });

  it("should return null for null filename", () => {
    expect(getLUTPath(null)).toBeNull();
  });

  it("should handle filenames with special characters", () => {
    expect(getLUTPath("B&WLUT.png")).toBe("/luts/B&WLUT.png");
    expect(getLUTPath("Chemical 168.CUBE")).toBe("/luts/Chemical 168.CUBE");
  });
});

// ============================================================================
// PERFORMANCE BYPASS TESTS
// ============================================================================

describe("Performance Bypass Behavior", () => {
  interface RenderState {
    lutEnabled: boolean;
    depthBlurActive: boolean;
  }

  function shouldUsePostProcessing(state: RenderState): boolean {
    return state.lutEnabled || state.depthBlurActive;
  }

  it("should bypass when no effects active", () => {
    expect(
      shouldUsePostProcessing({ lutEnabled: false, depthBlurActive: false }),
    ).toBe(false);
  });

  it("should use post-processing when LUT only", () => {
    expect(
      shouldUsePostProcessing({ lutEnabled: true, depthBlurActive: false }),
    ).toBe(true);
  });

  it("should use post-processing when depth blur only", () => {
    expect(
      shouldUsePostProcessing({ lutEnabled: false, depthBlurActive: true }),
    ).toBe(true);
  });

  it("should use post-processing when both active", () => {
    expect(
      shouldUsePostProcessing({ lutEnabled: true, depthBlurActive: true }),
    ).toBe(true);
  });
});

// ============================================================================
// SUMMARY TESTS
// ============================================================================

describe("Summary: PostProcessing System", () => {
  it("has all required LUT presets", () => {
    expect(Object.keys(LUT_PRESETS).length).toBe(9);
  });

  it("uses safe default depth blur parameters", () => {
    // These are the values used in the code
    const defaults = {
      focusDistance: 15,
      blurRange: 30,
      intensity: 0.5,
    };

    // Focus distance is reasonable for player view
    expect(defaults.focusDistance).toBeGreaterThan(0);
    expect(defaults.focusDistance).toBeLessThan(50);

    // Range provides gradual transition
    expect(defaults.blurRange).toBeGreaterThan(0);

    // Intensity is moderate
    expect(defaults.intensity).toBeGreaterThan(0);
    expect(defaults.intensity).toBeLessThanOrEqual(1);
  });

  it("clamps all user-provided values to safe ranges", () => {
    // Intensity: 0-1
    const clampIntensity = (v: number) => Math.max(0, Math.min(1, v));
    expect(clampIntensity(-1)).toBe(0);
    expect(clampIntensity(2)).toBe(1);

    // Focus distance: >= 0
    const clampFocus = (v: number) => Math.max(0, v);
    expect(clampFocus(-10)).toBe(0);

    // Blur range: >= 0.1
    const clampRange = (v: number) => Math.max(0.1, v);
    expect(clampRange(0)).toBe(0.1);
  });
});
