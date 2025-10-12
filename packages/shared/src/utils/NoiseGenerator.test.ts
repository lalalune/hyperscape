/**
 * Unit tests for NoiseGenerator and TerrainFeatureGenerator
 * Tests procedural noise generation algorithms and terrain features
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { NoiseGenerator, TerrainFeatureGenerator } from './NoiseGenerator'

describe('NoiseGenerator', () => {
  let noiseGenerator: NoiseGenerator

  beforeEach(() => {
    noiseGenerator = new NoiseGenerator(12345)
  })

  describe('constructor', () => {
    it('should initialize with default seed', () => {
      const generator = new NoiseGenerator()
      expect(generator).toBeDefined()
    })

    it('should initialize with custom seed', () => {
      const generator = new NoiseGenerator(54321)
      expect(generator).toBeDefined()
    })

    it('should produce different results for different seeds', () => {
      const gen1 = new NoiseGenerator(1)
      const gen2 = new NoiseGenerator(2)

      // Test multiple coordinates to ensure we find differences
      let foundDifference = false
      for (let i = 0; i < 10 && !foundDifference; i++) {
        const x = i * 0.7 + 0.1
        const y = i * 0.9 + 0.2
        const result1 = gen1.perlin2D(x, y)
        const result2 = gen2.perlin2D(x, y)
        if (result1 !== result2) {
          foundDifference = true
        }
      }

      expect(foundDifference).toBe(true)
    })

    it('should produce consistent results for same seed', () => {
      const gen1 = new NoiseGenerator(12345)
      const gen2 = new NoiseGenerator(12345)

      const result1 = gen1.perlin2D(0.5, 0.5)
      const result2 = gen2.perlin2D(0.5, 0.5)

      expect(result1).toBe(result2)
    })
  })

  describe('perlin2D', () => {
    it('should return values in expected range [-1, 1]', () => {
      const samples: number[] = []
      for (let i = 0; i < 1000; i++) {
        const x = Math.random() * 100
        const y = Math.random() * 100
        const value = noiseGenerator.perlin2D(x, y)
        samples.push(value)
        expect(value).toBeGreaterThanOrEqual(-1)
        expect(value).toBeLessThanOrEqual(1)
      }

      // Check that we get a good range of values
      const min = Math.min(...samples)
      const max = Math.max(...samples)
      expect(max - min).toBeGreaterThan(1) // Should have decent range
    })

    it('should return consistent values for same coordinates', () => {
      const x = 5.5
      const y = 7.3

      const value1 = noiseGenerator.perlin2D(x, y)
      const value2 = noiseGenerator.perlin2D(x, y)

      expect(value1).toBe(value2)
    })

    it('should handle integer coordinates', () => {
      const value = noiseGenerator.perlin2D(5, 10)
      expect(typeof value).toBe('number')
      expect(value).toBeGreaterThanOrEqual(-1)
      expect(value).toBeLessThanOrEqual(1)
    })

    it('should handle negative coordinates', () => {
      const value = noiseGenerator.perlin2D(-5.5, -10.3)
      expect(typeof value).toBe('number')
      expect(value).toBeGreaterThanOrEqual(-1)
      expect(value).toBeLessThanOrEqual(1)
    })

    it('should handle zero coordinates', () => {
      const value = noiseGenerator.perlin2D(0, 0)
      expect(typeof value).toBe('number')
      expect(value).toBeGreaterThanOrEqual(-1)
      expect(value).toBeLessThanOrEqual(1)
    })

    it('should produce smooth variations', () => {
      // Sample nearby points and check they don't vary too wildly
      const step = 0.1
      let maxDifference = 0

      for (let i = 0; i < 100; i++) {
        const x = Math.random() * 10
        const y = Math.random() * 10
        
        const val1 = noiseGenerator.perlin2D(x, y)
        const val2 = noiseGenerator.perlin2D(x + step, y)
        
        maxDifference = Math.max(maxDifference, Math.abs(val1 - val2))
      }

      // Perlin noise should be reasonably smooth
      expect(maxDifference).toBeLessThan(0.5)
    })
  })

  describe('simplex2D', () => {
    it('should return values in reasonable range', () => {
      const samples: number[] = []
      for (let i = 0; i < 1000; i++) {
        const x = Math.random() * 100
        const y = Math.random() * 100
        const value = noiseGenerator.simplex2D(x, y)
        samples.push(value)
        expect(typeof value).toBe('number')
      }

      // Check that we get a good distribution
      const min = Math.min(...samples)
      const max = Math.max(...samples)
      expect(max - min).toBeGreaterThan(1.5) // Simplex should have a reasonable range
    })

    it('should return consistent values for same coordinates', () => {
      const x = 5.5
      const y = 7.3

      const value1 = noiseGenerator.simplex2D(x, y)
      const value2 = noiseGenerator.simplex2D(x, y)

      expect(value1).toBe(value2)
    })

    it('should handle edge cases', () => {
      expect(() => noiseGenerator.simplex2D(0, 0)).not.toThrow()
      expect(() => noiseGenerator.simplex2D(-100, 100)).not.toThrow()
      expect(() => noiseGenerator.simplex2D(1000, -1000)).not.toThrow()
    })

    it('should produce different values than Perlin for same coordinates', () => {
      const x = 5.5
      const y = 7.3

      const perlinValue = noiseGenerator.perlin2D(x, y)
      const simplexValue = noiseGenerator.simplex2D(x, y)

      // They should be different algorithms
      expect(perlinValue).not.toBe(simplexValue)
    })
  })

  describe('ridgeNoise2D', () => {
    it('should return values in [0, 1] range', () => {
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * 100
        const y = Math.random() * 100
        const value = noiseGenerator.ridgeNoise2D(x, y)
        
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    })

    it('should be based on absolute value of Perlin noise', () => {
      const x = 5.5
      const y = 7.3

      const perlinValue = noiseGenerator.perlin2D(x, y)
      const ridgeValue = noiseGenerator.ridgeNoise2D(x, y)

      expect(ridgeValue).toBeCloseTo(1.0 - Math.abs(perlinValue), 10)
    })

    it('should create ridge-like patterns', () => {
      // Ridge noise should have high values where Perlin is near zero
      const x = 5.5
      const y = 7.3

      const ridgeValue = noiseGenerator.ridgeNoise2D(x, y)
      expect(typeof ridgeValue).toBe('number')
    })
  })

  describe('turbulence2D', () => {
    it('should return positive values', () => {
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * 100
        const y = Math.random() * 100
        const value = noiseGenerator.turbulence2D(x, y)
        
        expect(value).toBeGreaterThanOrEqual(0)
      }
    })

    it('should handle different octave counts', () => {
      const x = 5.5
      const y = 7.3

      const turbulence1 = noiseGenerator.turbulence2D(x, y, 1)
      const turbulence4 = noiseGenerator.turbulence2D(x, y, 4)
      const turbulence8 = noiseGenerator.turbulence2D(x, y, 8)

      expect(typeof turbulence1).toBe('number')
      expect(typeof turbulence4).toBe('number')
      expect(typeof turbulence8).toBe('number')
    })

    it('should default to 4 octaves', () => {
      const x = 5.5
      const y = 7.3

      const turbulenceDefault = noiseGenerator.turbulence2D(x, y)
      const turbulence4 = noiseGenerator.turbulence2D(x, y, 4)

      expect(turbulenceDefault).toBe(turbulence4)
    })

    it('should handle zero octaves', () => {
      const value = noiseGenerator.turbulence2D(5, 5, 0)
      expect(value).toBe(0)
    })

    it('should handle negative octaves gracefully', () => {
      const value = noiseGenerator.turbulence2D(5, 5, -1)
      expect(value).toBe(0)
    })
  })

  describe('fractal2D', () => {
    it('should return values in reasonable range', () => {
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * 100
        const y = Math.random() * 100
        const value = noiseGenerator.fractal2D(x, y)
        
        expect(typeof value).toBe('number')
        // Fractal noise should be roughly in [-1, 1] range due to normalization
        expect(value).toBeGreaterThanOrEqual(-2)
        expect(value).toBeLessThanOrEqual(2)
      }
    })

    it('should handle different parameters', () => {
      const x = 5.5
      const y = 7.3

      const default_fractal = noiseGenerator.fractal2D(x, y)
      const custom_fractal = noiseGenerator.fractal2D(x, y, 6, 0.3, 2.5)

      expect(typeof default_fractal).toBe('number')
      expect(typeof custom_fractal).toBe('number')
      expect(default_fractal).not.toBe(custom_fractal)
    })

    it('should use default parameters correctly', () => {
      const x = 5.5
      const y = 7.3

      const defaultFractal = noiseGenerator.fractal2D(x, y)
      const explicitDefault = noiseGenerator.fractal2D(x, y, 4, 0.5, 2.0)

      expect(defaultFractal).toBe(explicitDefault)
    })

    it('should handle edge case parameters', () => {
      const x = 5.5
      const y = 7.3

      expect(() => noiseGenerator.fractal2D(x, y, 0)).not.toThrow()
      expect(() => noiseGenerator.fractal2D(x, y, 1, 0, 1)).not.toThrow()
      expect(() => noiseGenerator.fractal2D(x, y, 1, 1, 0.1)).not.toThrow()
    })

    it('should normalize properly', () => {
      const x = 5.5
      const y = 7.3

      // With 1 octave, should be similar to basic Perlin
      const fractal1 = noiseGenerator.fractal2D(x, y, 1, 0.5, 2.0)
      const perlin = noiseGenerator.perlin2D(x, y)

      expect(fractal1).toBeCloseTo(perlin, 10)
    })
  })

  describe('domainWarp2D', () => {
    it('should return coordinates object', () => {
      const result = noiseGenerator.domainWarp2D(5.5, 7.3)

      expect(result).toHaveProperty('x')
      expect(result).toHaveProperty('y')
      expect(typeof result.x).toBe('number')
      expect(typeof result.y).toBe('number')
    })

    it('should warp coordinates based on noise', () => {
      const x = 5.5
      const y = 7.3

      const result = noiseGenerator.domainWarp2D(x, y)

      // Warped coordinates should be different from input (unless noise is exactly 0)
      expect(result.x).not.toBe(x)
      expect(result.y).not.toBe(y)
    })

    it('should handle custom warp strength', () => {
      const x = 5.5
      const y = 7.3

      const weakWarp = noiseGenerator.domainWarp2D(x, y, 0.01)
      const strongWarp = noiseGenerator.domainWarp2D(x, y, 1.0)

      // Strong warp should deviate more from original coordinates
      const weakDistance = Math.sqrt((weakWarp.x - x) ** 2 + (weakWarp.y - y) ** 2)
      const strongDistance = Math.sqrt((strongWarp.x - x) ** 2 + (strongWarp.y - y) ** 2)

      expect(strongDistance).toBeGreaterThan(weakDistance)
    })

    it('should handle zero warp strength', () => {
      const x = 5.5
      const y = 7.3

      const result = noiseGenerator.domainWarp2D(x, y, 0)

      expect(result.x).toBe(x)
      expect(result.y).toBe(y)
    })

    it('should use default warp strength', () => {
      const x = 5.5
      const y = 7.3

      const defaultWarp = noiseGenerator.domainWarp2D(x, y)
      const explicitDefault = noiseGenerator.domainWarp2D(x, y, 0.1)

      expect(defaultWarp.x).toBe(explicitDefault.x)
      expect(defaultWarp.y).toBe(explicitDefault.y)
    })
  })

  describe('erosionNoise2D', () => {
    it('should return reasonable height values', () => {
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * 100
        const y = Math.random() * 100
        const value = noiseGenerator.erosionNoise2D(x, y)
        
        expect(typeof value).toBe('number')
        // Erosion modifies fractal values, should be in reasonable range
        expect(value).toBeGreaterThan(-2)
        expect(value).toBeLessThan(2)
      }
    })

    it('should handle different iteration counts', () => {
      const x = 5.5
      const y = 7.3

      const erosion1 = noiseGenerator.erosionNoise2D(x, y, 1)
      const erosion3 = noiseGenerator.erosionNoise2D(x, y, 3)
      const erosion10 = noiseGenerator.erosionNoise2D(x, y, 10)

      expect(typeof erosion1).toBe('number')
      expect(typeof erosion3).toBe('number')
      expect(typeof erosion10).toBe('number')

      // Different iterations should produce different results
      expect(erosion1).not.toBe(erosion3)
      expect(erosion3).not.toBe(erosion10)
    })

    it('should use default iterations', () => {
      const x = 5.5
      const y = 7.3

      const defaultErosion = noiseGenerator.erosionNoise2D(x, y)
      const explicitDefault = noiseGenerator.erosionNoise2D(x, y, 3)

      expect(defaultErosion).toBe(explicitDefault)
    })

    it('should handle zero iterations', () => {
      const x = 5.5
      const y = 7.3

      const noErosion = noiseGenerator.erosionNoise2D(x, y, 0)
      const fractalValue = noiseGenerator.fractal2D(x, y, 6)

      expect(noErosion).toBe(fractalValue)
    })
  })

  describe('temperatureMap', () => {
    it('should return values in [0, 1] range', () => {
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * 100
        const y = Math.random() * 100
        const latitude = (Math.random() - 0.5) * 2 // [-1, 1]
        const value = noiseGenerator.temperatureMap(x, y, latitude)
        
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    })

    it('should be affected by latitude', () => {
      const x = 5.5
      const y = 7.3

      const equator = noiseGenerator.temperatureMap(x, y, 0)
      const pole = noiseGenerator.temperatureMap(x, y, 1)

      // Temperature should be higher at equator than at pole
      expect(equator).toBeGreaterThan(pole)
    })

    it('should handle negative latitudes', () => {
      const x = 5.5
      const y = 7.3

      const northPole = noiseGenerator.temperatureMap(x, y, 1)
      const southPole = noiseGenerator.temperatureMap(x, y, -1)

      // Both poles should have similar (low) temperatures
      expect(Math.abs(northPole - southPole)).toBeLessThan(0.1)
    })

    it('should use default latitude', () => {
      const x = 5.5
      const y = 7.3

      const defaultTemp = noiseGenerator.temperatureMap(x, y)
      const explicitDefault = noiseGenerator.temperatureMap(x, y, 0)

      expect(defaultTemp).toBe(explicitDefault)
    })
  })

  describe('moistureMap', () => {
    it('should return values in [0, 1] range', () => {
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * 100
        const y = Math.random() * 100
        const value = noiseGenerator.moistureMap(x, y)
        
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
    })

    it('should return consistent values for same coordinates', () => {
      const x = 5.5
      const y = 7.3

      const value1 = noiseGenerator.moistureMap(x, y)
      const value2 = noiseGenerator.moistureMap(x, y)

      expect(value1).toBe(value2)
    })

    it('should vary across different coordinates', () => {
      const values: number[] = []
      for (let i = 0; i < 10; i++) {
        values.push(noiseGenerator.moistureMap(i, i))
      }

      // Should have some variation
      const uniqueValues = new Set(values)
      expect(uniqueValues.size).toBeGreaterThan(1)
    })
  })

  describe('performance', () => {
    it('should handle many noise samples efficiently', () => {
      const startTime = performance.now()
      
      for (let i = 0; i < 10000; i++) {
        noiseGenerator.perlin2D(i * 0.1, i * 0.1)
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(1000) // Should complete in under 1 second
    })

    it('should handle fractal noise efficiently', () => {
      const startTime = performance.now()
      
      for (let i = 0; i < 1000; i++) {
        noiseGenerator.fractal2D(i * 0.1, i * 0.1, 8)
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(1000) // Should complete in under 1 second
    })
  })

  describe('edge cases', () => {
    it('should handle very large coordinates', () => {
      const largeValue = 1000000

      expect(() => noiseGenerator.perlin2D(largeValue, largeValue)).not.toThrow()
      expect(() => noiseGenerator.simplex2D(largeValue, largeValue)).not.toThrow()
      expect(() => noiseGenerator.fractal2D(largeValue, largeValue)).not.toThrow()
    })

    it('should handle very small coordinates', () => {
      const smallValue = 0.000001

      expect(() => noiseGenerator.perlin2D(smallValue, smallValue)).not.toThrow()
      expect(() => noiseGenerator.simplex2D(smallValue, smallValue)).not.toThrow()
      expect(() => noiseGenerator.fractal2D(smallValue, smallValue)).not.toThrow()
    })

    it('should handle infinite values gracefully', () => {
      // These might throw or return NaN, but shouldn't crash
      expect(() => {
        const result = noiseGenerator.perlin2D(Infinity, 0)
        expect(typeof result).toBe('number')
      }).not.toThrow()
    })

    it('should handle NaN values gracefully', () => {
      expect(() => {
        const result = noiseGenerator.perlin2D(NaN, 0)
        expect(typeof result).toBe('number')
      }).not.toThrow()
    })
  })
})

describe('TerrainFeatureGenerator', () => {
  let generator: TerrainFeatureGenerator
  let mockHeightmap: number[][]

  beforeEach(() => {
    generator = new TerrainFeatureGenerator(54321)
    
    // Create a simple test heightmap with deterministic variation
    // Use a seeded pseudo-random number generator for consistency
    let seed = 12345
    const seededRandom = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    
    mockHeightmap = Array.from({ length: 50 }, (_, y) =>
      Array.from({ length: 50 }, (_, x) => {
        // Simple gradient with some variation
        const centerX = 25
        const centerY = 25
        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2)
        return Math.max(0, 1 - distance / 25) + (seededRandom() - 0.5) * 0.2
      })
    )
  })

  describe('constructor', () => {
    it('should initialize with default seed', () => {
      const gen = new TerrainFeatureGenerator()
      expect(gen).toBeDefined()
    })

    it('should initialize with custom seed', () => {
      const gen = new TerrainFeatureGenerator(12345)
      expect(gen).toBeDefined()
    })
  })

  describe('generateRiverNetwork', () => {
    it('should return rivers and lakes arrays', () => {
      const result = generator.generateRiverNetwork(mockHeightmap, 50, 50)

      expect(result).toHaveProperty('rivers')
      expect(result).toHaveProperty('lakes')
      expect(Array.isArray(result.rivers)).toBe(true)
      expect(Array.isArray(result.lakes)).toBe(true)
    })

    it('should generate valid river data', () => {
      const result = generator.generateRiverNetwork(mockHeightmap, 50, 50)

      result.rivers.forEach(river => {
        expect(river).toHaveProperty('x')
        expect(river).toHaveProperty('y')
        expect(river).toHaveProperty('flow')
        expect(typeof river.x).toBe('number')
        expect(typeof river.y).toBe('number')
        expect(typeof river.flow).toBe('number')
        expect(river.x).toBeGreaterThanOrEqual(0)
        expect(river.x).toBeLessThanOrEqual(1)
        expect(river.y).toBeGreaterThanOrEqual(0)
        expect(river.y).toBeLessThanOrEqual(1)
        expect(river.flow).toBeGreaterThan(0)
      })
    })

    it('should generate valid lake data', () => {
      const result = generator.generateRiverNetwork(mockHeightmap, 50, 50)

      result.lakes.forEach(lake => {
        expect(lake).toHaveProperty('x')
        expect(lake).toHaveProperty('y')
        expect(lake).toHaveProperty('radius')
        expect(typeof lake.x).toBe('number')
        expect(typeof lake.y).toBe('number')
        expect(typeof lake.radius).toBe('number')
        expect(lake.x).toBeGreaterThanOrEqual(0)
        expect(lake.x).toBeLessThanOrEqual(1)
        expect(lake.y).toBeGreaterThanOrEqual(0)
        expect(lake.y).toBeLessThanOrEqual(1)
        expect(lake.radius).toBeGreaterThan(0)
      })
    })

    it('should handle small heightmaps', () => {
      const smallHeightmap = [
        [0.5, 0.3, 0.1],
        [0.7, 0.4, 0.2],
        [0.9, 0.6, 0.3]
      ]

      const result = generator.generateRiverNetwork(smallHeightmap, 3, 3)

      expect(result.rivers).toBeDefined()
      expect(result.lakes).toBeDefined()
    })

    it('should handle flat heightmaps', () => {
      const flatHeightmap = Array.from({ length: 10 }, () =>
        Array.from({ length: 10 }, () => 0.5)
      )

      const result = generator.generateRiverNetwork(flatHeightmap, 10, 10)

      expect(result.rivers).toBeDefined()
      expect(result.lakes).toBeDefined()
    })

    it('should handle heightmaps with extreme values', () => {
      const extremeHeightmap = Array.from({ length: 10 }, (_, y) =>
        Array.from({ length: 10 }, (_, x) => 
          (x + y) % 2 === 0 ? 1.0 : 0.0 // Checkerboard pattern
        )
      )

      const result = generator.generateRiverNetwork(extremeHeightmap, 10, 10)

      expect(result.rivers).toBeDefined()
      expect(result.lakes).toBeDefined()
    })

    it('should place lakes in low-lying areas', () => {
      // Create heightmap with clear low point
      const heightmapWithLake = Array.from({ length: 20 }, (_, y) =>
        Array.from({ length: 20 }, (_, x) => {
          const centerX = 10
          const centerY = 10
          const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2)
          return distance < 3 ? 0.1 : 0.8 // Low center, high edges
        })
      )

      const result = generator.generateRiverNetwork(heightmapWithLake, 20, 20)

      // Should find the low area and place a lake there
      expect(result.lakes.length).toBeGreaterThan(0)
      
      // Lake should be near the center (low point)
      const centralLakes = result.lakes.filter(lake => 
        Math.abs(lake.x - 0.5) < 0.2 && Math.abs(lake.y - 0.5) < 0.2
      )
      expect(centralLakes.length).toBeGreaterThan(0)
    })

    it('should generate reasonable number of features', () => {
      const result = generator.generateRiverNetwork(mockHeightmap, 50, 50)

      // Count unique river paths, not individual river points
      const riverPaths = new Set<string>()
      let currentPath = ''
      
      result.rivers.forEach((point, idx) => {
        // Start a new path when flow resets to 1.0 (new river)
        if (point.flow === 1.0 || idx === 0) {
          if (currentPath) riverPaths.add(currentPath)
          currentPath = `${point.x},${point.y}`
        } else {
          currentPath += `-${point.x},${point.y}`
        }
      })
      if (currentPath) riverPaths.add(currentPath)
      
      // Should generate some features but not too many
      expect(riverPaths.size).toBeLessThan(20) // Reasonable number of river paths
      expect(result.rivers.length).toBeLessThan(1000) // Total river points
      expect(result.lakes.length).toBeLessThan(100)
    })
  })

  describe('edge cases', () => {
    it('should handle empty heightmap', () => {
      const emptyHeightmap: number[][] = []

      expect(() => {
        generator.generateRiverNetwork(emptyHeightmap, 0, 0)
      }).not.toThrow()
    })

    it('should handle single cell heightmap', () => {
      const singleCell = [[0.5]]

      const result = generator.generateRiverNetwork(singleCell, 1, 1)

      expect(result.rivers).toBeDefined()
      expect(result.lakes).toBeDefined()
    })

    it('should handle mismatched dimensions', () => {
      const mismatchedHeightmap = [
        [0.5, 0.3],
        [0.7, 0.4, 0.2] // Different length
      ]

      expect(() => {
        generator.generateRiverNetwork(mismatchedHeightmap, 2, 2)
      }).not.toThrow()
    })

    it('should be deterministic for same seed', () => {
      const gen1 = new TerrainFeatureGenerator(12345)
      const gen2 = new TerrainFeatureGenerator(12345)

      const result1 = gen1.generateRiverNetwork(mockHeightmap, 50, 50)
      const result2 = gen2.generateRiverNetwork(mockHeightmap, 50, 50)

      // Results should be identical for same seed
      expect(result1.lakes.length).toBe(result2.lakes.length)
      expect(result1.rivers.length).toBe(result2.rivers.length)
    })

    it('should produce different results for different seeds', () => {
      const gen1 = new TerrainFeatureGenerator(1)
      const gen2 = new TerrainFeatureGenerator(2)

      const result1 = gen1.generateRiverNetwork(mockHeightmap, 50, 50)
      const result2 = gen2.generateRiverNetwork(mockHeightmap, 50, 50)

      // Results should be different for different seeds
      const same = result1.lakes.length === result2.lakes.length && 
                   result1.rivers.length === result2.rivers.length

      expect(same).toBe(false) // Very unlikely to be identical
    })
  })

  describe('performance', () => {
    it('should handle large heightmaps reasonably efficiently', () => {
      const largeHeightmap = Array.from({ length: 100 }, (_, _y) =>
        Array.from({ length: 100 }, (_, _x) => Math.random())
      )

      const startTime = performance.now()
      const result = generator.generateRiverNetwork(largeHeightmap, 100, 100)
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(5000) // Should complete in under 5 seconds
      expect(result.rivers).toBeDefined()
      expect(result.lakes).toBeDefined()
    })
  })
})