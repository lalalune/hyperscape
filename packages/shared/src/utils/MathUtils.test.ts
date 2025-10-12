/**
 * Unit tests for MathUtils
 * Tests distance calculations, clamping, and edge cases
 */

import { describe, expect, it, vi } from 'vitest';
import { calculateDistance, calculateDistance2D, clamp } from './MathUtils';
import type { Vector3 } from './MathUtils';

describe('MathUtils', () => {

  describe('calculateDistance', () => {
    it('should calculate distance between two identical points', () => {
      const p1 = { x: 1, y: 2, z: 3 }
      const p2 = { x: 1, y: 2, z: 3 }
      expect(calculateDistance(p1, p2)).toBe(0)
    })

    it('should calculate distance between points on x-axis', () => {
      const p1 = { x: 0, y: 0, z: 0 }
      const p2 = { x: 5, y: 0, z: 0 }
      expect(calculateDistance(p1, p2)).toBe(5)
    })

    it('should calculate distance between points on y-axis', () => {
      const p1 = { x: 0, y: 0, z: 0 }
      const p2 = { x: 0, y: -5, z: 0 }
      expect(calculateDistance(p1, p2)).toBe(5)
    })

    it('should calculate distance between points on z-axis', () => {
      const p1 = { x: 0, y: 0, z: 0 }
      const p2 = { x: 0, y: 0, z: 10 }
      expect(calculateDistance(p1, p2)).toBe(10)
    })

    it('should calculate distance using 3D Pythagorean theorem', () => {
      const p1 = { x: 0, y: 0, z: 0 };
      const p2 = { x: 3, y: 4, z: 0 };
      expect(calculateDistance(p1, p2)).toBe(5);
    });

    it('should calculate distance in 3D space', () => {
      const p1 = { x: 1, y: 2, z: 3 }
      const p2 = { x: 4, y: 6, z: 8 } // dx=3, dy=4, dz=5
      const expectedDistance = Math.sqrt(3*3 + 4*4 + 5*5) // sqrt(9 + 16 + 25) = sqrt(50)
      expect(calculateDistance(p1, p2)).toBeCloseTo(expectedDistance)
    })

    it('should handle negative coordinates', () => {
      const p1 = { x: -1, y: -2, z: -3 }
      const p2 = { x: -4, y: -6, z: -8 }
      const expectedDistance = Math.sqrt(3*3 + 4*4 + 5*5)
      expect(calculateDistance(p1, p2)).toBeCloseTo(expectedDistance)
    })

    it('should handle floating point coordinates', () => {
      const p1 = { x: 0.5, y: 1.5, z: 2.5 }
      const p2 = { x: 2.0, y: 3.5, z: 4.5 } // dx=1.5, dy=2.0, dz=2.0
      const expectedDistance = Math.sqrt(1.5*1.5 + 2.0*2.0 + 2.0*2.0) // sqrt(2.25 + 4 + 4) = sqrt(10.25)
      expect(calculateDistance(p1, p2)).toBeCloseTo(expectedDistance)
    })

    it('should handle very large coordinates', () => {
        const p1 = { x: 1e6, y: 2e6, z: 3e6 };
        const p2 = { x: 4e6, y: 6e6, z: 8e6 };
        const expectedDistance = Math.sqrt(Math.pow(3e6, 2) + Math.pow(4e6, 2) + Math.pow(5e6, 2));
        expect(calculateDistance(p1, p2)).toBeCloseTo(expectedDistance);
    });

    it('should handle very small coordinates', () => {
        const p1 = { x: 1e-6, y: 2e-6, z: 3e-6 };
        const p2 = { x: 4e-6, y: 6e-6, z: 8e-6 };
        const expectedDistance = Math.sqrt(Math.pow(3e-6, 2) + Math.pow(4e-6, 2) + Math.pow(5e-6, 2));
        expect(calculateDistance(p1, p2)).toBeCloseTo(expectedDistance);
    });
  })

  describe('calculateDistance2D', () => {
    it('should calculate 2D distance ignoring y-coordinate', () => {
      const p1 = { x: 0, y: 10, z: 0 };
      const p2 = { x: 3, y: -5, z: 4 };
      expect(calculateDistance2D(p1, p2)).toBe(5);
    });

    it('should calculate distance on xz-plane', () => {
      const p1 = { x: 1, y: 0, z: 1 }
      const p2 = { x: 4, y: 0, z: 5 } // dx=3, dz=4
      expect(calculateDistance2D(p1, p2)).toBe(5)
    })

    it('should return 0 for same x,z coordinates regardless of y', () => {
      const p1 = { x: 2, y: 10, z: 3 }
      const p2 = { x: 2, y: -10, z: 3 }
      expect(calculateDistance2D(p1, p2)).toBe(0)
    })

    it('should handle negative coordinates in 2D', () => {
      const p1 = { x: -1, y: 0, z: -2 }
      const p2 = { x: -4, y: 0, z: -6 } // dx=3, dz=4
      expect(calculateDistance2D(p1, p2)).toBe(5)
    })

    it('should calculate distance along x-axis only', () => {
      const p1 = { x: 5, y: 10, z: 5 };
      const p2 = { x: 10, y: 20, z: 5 };
      expect(calculateDistance2D(p1, p2)).toBe(5);
    });

    it('should calculate distance along z-axis only', () => {
      const p1 = { x: 5, y: 10, z: 5 };
      const p2 = { x: 5, y: 20, z: 10 };
      expect(calculateDistance2D(p1, p2)).toBe(5);
    });

    it('should handle floating point precision', () => {
      const p1 = { x: 0.1, y: 0, z: 0.2 };
      const p2 = { x: 0.3, y: 0, z: 0.4 };
      const expected = Math.sqrt(Math.pow(0.2, 2) + Math.pow(0.2, 2));
      expect(calculateDistance2D(p1, p2)).toBeCloseTo(expected);
    });
  })

  describe('clamp', () => {
    it('should return value when within range', () => {
      expect(clamp(5, 0, 10)).toBe(5)
    })

    it('should return min when value is below range', () => {
      expect(clamp(-5, 0, 10)).toBe(0)
    })

    it('should return max when value is above range', () => {
      expect(clamp(15, 0, 10)).toBe(10)
    })

    it('should return min when value equals min', () => {
      expect(clamp(0, 0, 10)).toBe(0)
    })

    it('should return max when value equals max', () => {
      expect(clamp(10, 0, 10)).toBe(10)
    })

    it('should handle negative ranges', () => {
      expect(clamp(-5, -10, -1)).toBe(-5)
    })

    it('should clamp to negative min', () => {
      expect(clamp(-15, -10, -1)).toBe(-10)
    })

    it('should clamp to negative max', () => {
      expect(clamp(0, -10, -1)).toBe(-1)
    })

    it('should handle floating point values', () => {
      expect(clamp(5.5, 0.5, 10.5)).toBe(5.5)
    })

    it('should clamp floating point to min', () => {
      expect(clamp(0.4, 0.5, 10.5)).toBe(0.5)
    })

    it('should clamp floating point to max', () => {
      expect(clamp(10.6, 0.5, 10.5)).toBe(10.5)
    })

    it('should handle zero range (min equals max)', () => {
      expect(clamp(10, 5, 5)).toBe(5)
      expect(clamp(0, 5, 5)).toBe(5)
    })

    it('should handle very small ranges', () => {
      expect(clamp(1e-6, 0, 1e-5)).toBe(1e-6);
      expect(clamp(1, 1e-9, 1e-8)).toBe(1e-8);
    });

    it('should handle very large values', () => {
        expect(clamp(1e10, 0, 1e9)).toBe(1e9);
        expect(clamp(-1e10, -1e9, 0)).toBe(-1e9);
    });

    it('should clamp very large value to max', () => {
        expect(clamp(Number.MAX_VALUE, 0, 1e100)).toBe(1e100);
    });

    it('should handle reversed min/max gracefully', () => {
      // Standard Math.max(min, Math.min(max, val)) will behave correctly
      expect(clamp(5, 10, 0)).toBe(5)
      expect(clamp(15, 10, 0)).toBe(10)
      expect(clamp(-5, 10, 0)).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should handle calculateDistance with null or undefined points', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const point1 = { x: 1, y: 2, z: 3 };

      // Test with one null point
      expect(calculateDistance(point1, null as unknown as Vector3)).toBe(Infinity);
      
      // Test with one undefined point
      expect(calculateDistance(undefined as unknown as Vector3, point1)).toBe(Infinity);

      // Test with both null
      expect(calculateDistance(null as unknown as Vector3, null as unknown as Vector3)).toBe(Infinity);
    });

    it('should handle very precise floating point calculations', () => {
      const p1 = { x: 0.1 + 0.2, y: 0, z: 0 };
      const p2 = { x: 0.3, y: 0, z: 0 };
      expect(calculateDistance(p1, p2)).toBeCloseTo(0);
    });

    it('should handle infinite values', () => {
      const p1 = { x: Infinity, y: 0, z: 0 };
      const p2 = { x: 0, y: 0, z: 0 };
      expect(calculateDistance(p1, p2)).toBe(Infinity);
    });

    it('should handle NaN values', () => {
      const p1 = { x: NaN, y: 0, z: 0 };
      const p2 = { x: 0, y: 0, z: 0 };
      expect(calculateDistance(p1, p2)).toBeNaN();
    });

    it('should handle clamp with NaN', () => {
      expect(clamp(NaN, 0, 10)).toBeNaN();
      expect(clamp(5, NaN, 10)).toBeNaN();
      expect(clamp(5, 0, NaN)).toBeNaN();
    });

    it('should handle clamp with Infinity', () => {
      expect(clamp(Infinity, 0, 10)).toBe(10);
      expect(clamp(5, -Infinity, Infinity)).toBe(5);
    });

    it('should handle clamp with negative Infinity', () => {
      expect(clamp(-Infinity, 0, 10)).toBe(0);
    });
  });

  describe('performance', () => {
    it('should handle many distance calculations efficiently', () => {
      const points = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: i, z: i }));
      const startTime = performance.now();
      
      for(let i = 0; i < points.length - 1; i++) {
        calculateDistance(points[i], points[i+1]);
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(10); // Should be very fast
    });

    it('should handle many 2D distance calculations efficiently', () => {
      const points = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: i, z: i }));
      const startTime = performance.now();
      
      for(let i = 0; i < points.length - 1; i++) {
        calculateDistance2D(points[i], points[i+1]);
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(10);
    });

    it('should handle many clamp operations efficiently', () => {
      const values = Array.from({ length: 1000 }, (_) => Math.random() * 100);
      const startTime = performance.now();
      
      for(const value of values) {
        clamp(value, 0, 50);
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(10);
    });
  });

  describe('mathematical properties', () => {
    const p1 = { x: 1, y: 2, z: 3 };
    const p2 = { x: 4, y: 5, z: 6 };
    const p3 = { x: 7, y: 8, z: 9 };

    it('should satisfy distance symmetry property', () => {
      expect(calculateDistance(p1, p2)).toBeCloseTo(calculateDistance(p2, p1));
    });

    it('should satisfy triangle inequality', () => {
      const d12 = calculateDistance(p1, p2);
      const d23 = calculateDistance(p2, p3);
      const d13 = calculateDistance(p1, p3);
      expect(d12 + d23).toBeGreaterThanOrEqual(d13);
    });

    it('should satisfy distance non-negativity', () => {
      expect(calculateDistance(p1, p2)).toBeGreaterThanOrEqual(0);
    });

    it('should satisfy clamp idempotency', () => {
      const val = 15;
      const min = 0;
      const max = 10;
      const clamped = clamp(val, min, max);
      expect(clamp(clamped, min, max)).toBe(clamped);
    });

    it('should satisfy clamp ordering', () => {
      const val = 5;
      const min = 0;
      const max = 10;
      expect(clamp(val, min, max)).toBeGreaterThanOrEqual(min);
      expect(clamp(val, min, max)).toBeLessThanOrEqual(max);
    });
  });
});
