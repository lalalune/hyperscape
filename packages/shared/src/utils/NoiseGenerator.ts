/**
 * Advanced Noise Generation for Procedural Terrain
 * 
 * Implements multiple noise algorithms for realistic terrain generation:
 * - Perlin Noise: Smooth, organic noise for base terrain
 * - Simplex Noise: Perlin with better characteristics
 * - Ridge Noise: For mountain ridges and sharp features
 * - Turbulence: For chaotic terrain details
 * - Fractal Noise: Multi-octave noise for complex terrain
 */

export class NoiseGenerator {
    private permutation: number[] = [];
    private p: number[] = [];
    
    constructor(seed: number = 12345) {
        this.initializePermutation(seed);
    }
    
    private initializePermutation(seed: number): void {
        // Initialize permutation table with seed
        const perm = Array.from({ length: 256 }, (_, i) => i);
        
        // Shuffle using seeded random
        let random = seed;
        for (let i = perm.length - 1; i > 0; i--) {
            random = (random * 1664525 + 1013904223) % 4294967296;
            const j = Math.floor((random / 4294967296) * (i + 1));
            [perm[i], perm[j]] = [perm[j], perm[i]];
        }
        
        this.permutation = perm;
        this.p = [...perm, ...perm]; // Duplicate for overflow
    }
    
    /**
     * 2D Perlin Noise - Classic algorithm for smooth, organic terrain
     */
    perlin2D(x: number, y: number): number {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        
        x -= Math.floor(x);
        y -= Math.floor(y);
        
        const u = this.fade(x);
        const v = this.fade(y);
        
        const A = this.p[X] + Y;
        const AA = this.p[A];
        const AB = this.p[A + 1];
        const B = this.p[X + 1] + Y;
        const BA = this.p[B];
        const BB = this.p[B + 1];
        
        const result = this.lerp(v,
            this.lerp(u, this.grad2D(this.p[AA], x, y), this.grad2D(this.p[BA], x - 1, y)),
            this.lerp(u, this.grad2D(this.p[AB], x, y - 1), this.grad2D(this.p[BB], x - 1, y - 1))
        );
        
        // Clamp to ensure we stay within [-1, 1]
        return Math.max(-1, Math.min(1, result));
    }
    
    /**
     * 2D Simplex Noise - Perlin with better characteristics
     */
    simplex2D(x: number, y: number): number {
        const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
        const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
        
        const s = (x + y) * F2;
        const i = Math.floor(x + s);
        const j = Math.floor(y + s);
        
        const t = (i + j) * G2;
        const X0 = i - t;
        const Y0 = j - t;
        const x0 = x - X0;
        const y0 = y - Y0;
        
        let i1, j1;
        if (x0 > y0) {
            i1 = 1; j1 = 0;
        } else {
            i1 = 0; j1 = 1;
        }
        
        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1.0 + 2.0 * G2;
        const y2 = y0 - 1.0 + 2.0 * G2;
        
        const ii = i & 255;
        const jj = j & 255;
        const gi0 = this.p[ii + this.p[jj]] % 12;
        const gi1 = this.p[ii + i1 + this.p[jj + j1]] % 12;
        const gi2 = this.p[ii + 1 + this.p[jj + 1]] % 12;
        
        let n0, n1, n2;
        
        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 < 0) n0 = 0.0;
        else {
            t0 *= t0;
            n0 = t0 * t0 * this.gradSimplex2D(gi0, x0, y0);
        }
        
        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 < 0) n1 = 0.0;
        else {
            t1 *= t1;
            n1 = t1 * t1 * this.gradSimplex2D(gi1, x1, y1);
        }
        
        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 < 0) n2 = 0.0;
        else {
            t2 *= t2;
            n2 = t2 * t2 * this.gradSimplex2D(gi2, x2, y2);
        }
        
        return 70.0 * (n0 + n1 + n2);
    }
    
    /**
     * Ridge Noise - Creates sharp mountain ridges
     */
    ridgeNoise2D(x: number, y: number): number {
        const perlinValue = this.perlin2D(x, y);
        // Ensure perlin value is in valid range before processing
        const clampedPerlin = Math.max(-1, Math.min(1, perlinValue));
        return 1.0 - Math.abs(clampedPerlin);
    }
    
    /**
     * Turbulence - Absolute value of noise for chaotic terrain
     */
    turbulence2D(x: number, y: number, octaves: number = 4): number {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        
        for (let i = 0; i < octaves; i++) {
            value += Math.abs(this.perlin2D(x * frequency, y * frequency)) * amplitude;
            frequency *= 2;
            amplitude *= 0.5;
        }
        
        return value;
    }
    
    /**
     * Fractal Noise - Multi-octave noise for complex terrain
     */
    fractal2D(x: number, y: number, octaves: number = 4, persistence: number = 0.5, lacunarity: number = 2.0): number {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;
        
        for (let i = 0; i < octaves; i++) {
            value += this.perlin2D(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        
        return value / maxValue;
    }
    
    /**
     * Domain Warping - Distorts noise input for more organic results
     */
    domainWarp2D(x: number, y: number, warpStrength: number = 0.1): { x: number, y: number } {
        const warpX = x + warpStrength * this.perlin2D(x + 5.2, y + 1.3);
        const warpY = y + warpStrength * this.perlin2D(x + 7.8, y + 4.6);
        return { x: warpX, y: warpY };
    }
    
    /**
     * Erosion Simulation - Simulates hydraulic erosion effects
     */
    erosionNoise2D(x: number, y: number, iterations: number = 3): number {
        let height = this.fractal2D(x, y, 6);
        
        for (let i = 0; i < iterations; i++) {
            const gradient = this.calculateGradient(x, y);
            const erosionFactor = Math.min(1.0, gradient.magnitude * 2.0);
            height *= (1.0 - erosionFactor * 0.1);
        }
        
        return height;
    }
    
    /**
     * Temperature Map - For biome generation
     */
    temperatureMap(x: number, y: number, latitude: number = 0): number {
        // Base temperature decreases with latitude (distance from equator)
        const latitudeEffect = 1.0 - Math.abs(latitude) * 0.8;
        
        // Add noise variation
        const temperatureNoise = this.fractal2D(x * 0.001, y * 0.001, 3) * 0.3;
        
        return Math.max(0, Math.min(1, latitudeEffect + temperatureNoise));
    }
    
    /**
     * Moisture Map - For biome generation
     */
    moistureMap(x: number, y: number): number {
        return (this.fractal2D(x * 0.002, y * 0.002, 4) + 1) * 0.5;
    }
    
    // Helper functions
    private fade(t: number): number {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    
    private lerp(t: number, a: number, b: number): number {
        return a + t * (b - a);
    }
    
    private grad2D(hash: number, x: number, y: number): number {
        const h = hash & 3;
        const u = h < 2 ? x : y;
        const v = h < 2 ? y : x;
        return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
    }
    
    private gradSimplex2D(hash: number, x: number, y: number): number {
        const grad3 = [
            [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
            [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
            [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
        ];
        return grad3[hash % 12][0] * x + grad3[hash % 12][1] * y;
    }
    
    private calculateGradient(x: number, y: number, delta: number = 0.01): { x: number, y: number, magnitude: number } {
        const heightCenter = this.perlin2D(x, y);
        const heightX = this.perlin2D(x + delta, y);
        const heightY = this.perlin2D(x, y + delta);
        
        const gradX = (heightX - heightCenter) / delta;
        const gradY = (heightY - heightCenter) / delta;
        const magnitude = Math.sqrt(gradX * gradX + gradY * gradY);
        
        return { x: gradX, y: gradY, magnitude };
    }
}

/**
 * Terrain Feature Generator
 * Generates specific terrain features like rivers, lakes, mountain ranges
 */
export class TerrainFeatureGenerator {
    private noise: NoiseGenerator;
    private seed: number;
    private randomSeed: number;
    
    constructor(seed: number = 54321) {
        this.noise = new NoiseGenerator(seed);
        this.seed = seed;
        this.randomSeed = seed; // Separate seed for random() to preserve original
    }
    
    // Seeded pseudo-random number generator for deterministic results
    private random(): number {
        this.randomSeed = (this.randomSeed * 9301 + 49297) % 233280;
        return this.randomSeed / 233280;
    }
    
    /**
     * Generate river network using flow simulation
     */
    generateRiverNetwork(heightmap: number[][], width: number, height: number): {
        rivers: Array<{ x: number, y: number, flow: number }>,
        lakes: Array<{ x: number, y: number, radius: number }>
    } {
        const rivers: Array<{ x: number, y: number, flow: number }> = [];
        const lakes: Array<{ x: number, y: number, radius: number }> = [];
        
        // Find local minima for lake placement
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                if (!heightmap[y] || !heightmap[y][x]) continue;
                
                const currentHeight = heightmap[y][x];
                
                // Check all 8 neighbors for a true local minimum
                const neighbors: number[] = [];
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        if (heightmap[y + dy] && heightmap[y + dy][x + dx] !== undefined) {
                            neighbors.push(heightmap[y + dy][x + dx]);
                        }
                    }
                }
                
                // Lake placement: must be a local minimum
                // and below a lower threshold  
                if (neighbors.length >= 4 && 
                    neighbors.every(h => h >= currentHeight) && 
                    currentHeight < 0.2) {
                    // Check if it's a significant low point
                    const avgNeighborHeight = neighbors.reduce((a, b) => a + b, 0) / neighbors.length;
                    if (avgNeighborHeight - currentHeight > 0.1) {
                        // Additional check to limit lake density
                        const lakeChance = this.random();
                        if (lakeChance < 0.4) { // 40% chance to place a lake
                            lakes.push({
                                x: x / width,
                                y: y / height,
                                radius: 0.02 + this.random() * 0.03
                            });
                        }
                    }
                }
            }
        }
        
        // Generate rivers from high elevations to lakes/ocean
        const numRivers = Math.floor(lakes.length * 0.5) + 2;
        for (let i = 0; i < numRivers; i++) {
            const startX = this.random();
            const startY = this.random();
            const startHeight = this.getHeightAtPosition(heightmap, startX, startY, width, height);
            
            if (startHeight > 0.6) { // Start from high elevations
                const riverPath = this.traceRiverPath(heightmap, startX, startY, width, height);
                rivers.push(...riverPath);
            }
        }
        
        return { rivers, lakes };
    }
    
    private traceRiverPath(heightmap: number[][], startX: number, startY: number, width: number, height: number): Array<{ x: number, y: number, flow: number }> {
        const path: Array<{ x: number, y: number, flow: number }> = [];
        let x = startX;
        let y = startY;
        let flow = 1.0;
        
        for (let step = 0; step < 100; step++) {
            path.push({ x, y, flow });
            
            // Find steepest descent direction
            const directions = [
                { dx: 0.01, dy: 0 }, { dx: -0.01, dy: 0 },
                { dx: 0, dy: 0.01 }, { dx: 0, dy: -0.01 },
                { dx: 0.007, dy: 0.007 }, { dx: -0.007, dy: 0.007 },
                { dx: 0.007, dy: -0.007 }, { dx: -0.007, dy: -0.007 }
            ];
            
            let bestDirection = { dx: 0, dy: 0 };
            let steepestDescent = 0;
            
            const currentHeight = this.getHeightAtPosition(heightmap, x, y, width, height);
            
            for (const dir of directions) {
                const newX = Math.max(0, Math.min(1, x + dir.dx));
                const newY = Math.max(0, Math.min(1, y + dir.dy));
                const newHeight = this.getHeightAtPosition(heightmap, newX, newY, width, height);
                const descent = currentHeight - newHeight;
                
                if (descent > steepestDescent) {
                    steepestDescent = descent;
                    bestDirection = dir;
                }
            }
            
            if (steepestDescent < 0.001) break; // No more descent, river ends
            
            x += bestDirection.dx;
            y += bestDirection.dy;
            flow += 0.1; // River grows as it flows downstream
            
            // Stop if we reach boundaries or very low elevation
            if (x <= 0 || x >= 1 || y <= 0 || y >= 1 || currentHeight < 0.1) break;
        }
        
        return path;
    }
    
    private getHeightAtPosition(heightmap: number[][], x: number, y: number, width: number, height: number): number {
        const pixelX = Math.floor(Math.max(0, Math.min(width - 1, x * (width - 1))));
        const pixelY = Math.floor(Math.max(0, Math.min(height - 1, y * (height - 1))));
        return heightmap[pixelY] && heightmap[pixelY][pixelX] !== undefined ? heightmap[pixelY][pixelX] : 0;
    }
}