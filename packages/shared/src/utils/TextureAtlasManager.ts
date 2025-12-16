import THREE from "../extras/three/three";

interface MaterialInfo {
  name: string;
  diffuse: string;
  normal: string;
  scale: number;
}

/**
 * Material indices for terrain:
 * 0 = Grass (primary for plains, forest, valley)
 * 1 = Dirt (paths, roads, slopes)
 * 2 = Rock (steep slopes, mountain peaks)
 * 3 = Snow (high altitude, tundra biome)
 * 4 = Sand (desert, beaches)
 * 5 = Cobblestone (roads near towns)
 */
export const TerrainMaterialIndex = {
  GRASS: 0,
  DIRT: 1,
  ROCK: 2,
  SNOW: 3,
  SAND: 4,
  COBBLESTONE: 5,
} as const;

export type TerrainMaterialIndexType = typeof TerrainMaterialIndex[keyof typeof TerrainMaterialIndex];

export class TextureAtlasManager {
  private atlas: THREE.Texture | null = null;
  private normalAtlas: THREE.Texture | null = null;
  private materials: MaterialInfo[] = [];
  private textureLoader = new THREE.TextureLoader();
  
  // Atlas grid configuration: 3 columns x 2 rows = 6 materials
  private readonly ATLAS_COLS = 3;
  private readonly ATLAS_ROWS = 2;

  async init() {
    // Get CDN URL from window or default to localhost CDN
    const cdnUrl =
      typeof window !== "undefined"
        ? ((window as { __CDN_URL?: string }).__CDN_URL ??
          "http://localhost:8080")
        : "http://localhost:8080";

    // Scale values: higher = smaller texture (more tiled), lower = larger texture
    // With TEXTURE_SCALE=40 in shader, a scale of 4.0 gives ~10m per tile repeat
    // 6 materials in 3x2 grid layout
    this.materials = [
      {
        name: "grass",
        diffuse: `${cdnUrl}/terrain/textures/stylized_grass/stylized_grass_d.png`,
        normal: `${cdnUrl}/terrain/textures/stylized_grass/stylized_grass_n.png`,
        scale: 4.0, // ~10m per repeat - good detail for grass
      },
      {
        name: "dirt",
        diffuse: `${cdnUrl}/terrain/textures/dirt_ground/dirt_ground_d.png`,
        normal: `${cdnUrl}/terrain/textures/dirt_ground/dirt_ground_n.png`,
        scale: 4.0, // ~10m per repeat - paths and roads
      },
      {
        name: "rock",
        diffuse: `${cdnUrl}/terrain/textures/stylized_stone/stylized_stone_d.png`,
        normal: `${cdnUrl}/terrain/textures/stylized_stone/stylized_stone_n.png`,
        scale: 6.0, // ~6.7m per repeat - tighter detail for rock
      },
      {
        name: "snow",
        diffuse: `${cdnUrl}/terrain/textures/stylized_snow/stylized_snow_d.png`,
        normal: `${cdnUrl}/terrain/textures/stylized_snow/stylized_snow_n.png`,
        scale: 6.0, // ~6.7m per repeat - high altitude, tundra
      },
      {
        name: "sand",
        diffuse: `${cdnUrl}/terrain/textures/sand/sand_d.png`,
        normal: `${cdnUrl}/terrain/textures/sand/sand_n.png`,
        scale: 5.0, // ~8m per repeat - desert and beaches
      },
      {
        name: "cobblestone",
        // Use stylized stone with different scale for cobblestone roads
        diffuse: `${cdnUrl}/terrain/textures/stylized_stone/stylized_stone_d.png`,
        normal: `${cdnUrl}/terrain/textures/stylized_stone/stylized_stone_n.png`,
        scale: 8.0, // Tighter tiling for cobblestone appearance
      },
    ];

    this.atlas = await this.buildAtlas(this.materials.map((m) => m.diffuse));
    this.normalAtlas = await this.buildAtlas(
      this.materials.map((m) => m.normal),
    );
  }

  /**
   * Get atlas grid dimensions for shader configuration
   */
  public getAtlasGridDimensions(): { cols: number; rows: number } {
    return { cols: this.ATLAS_COLS, rows: this.ATLAS_ROWS };
  }

  private async buildAtlas(textureUrls: string[]): Promise<THREE.Texture> {
    // Load all textures in parallel - fail fast if any texture fails
    const images = await Promise.all(
      textureUrls.map((url) => this.textureLoader.loadAsync(url)),
    );

    if (images.length === 0 || !images[0]) {
      throw new Error("No textures to build atlas from.");
    }

    const imageWidth = images[0].image.width;
    const imageHeight = images[0].image.height;
    // Build 3x2 atlas grid
    const atlasWidth = imageWidth * this.ATLAS_COLS;
    const atlasHeight = imageHeight * this.ATLAS_ROWS;

    const canvas = document.createElement("canvas");
    canvas.width = atlasWidth;
    canvas.height = atlasHeight;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Failed to get canvas context");
    }

    images.forEach((texture, index) => {
      const x = (index % this.ATLAS_COLS) * imageWidth;
      const y = Math.floor(index / this.ATLAS_COLS) * imageHeight;
      context.drawImage(texture.image, x, y);
    });

    const atlasTexture = new THREE.CanvasTexture(canvas);
    atlasTexture.needsUpdate = true;
    return atlasTexture;
  }

  public getAtlas(): THREE.Texture | null {
    return this.atlas;
  }

  public getNormalAtlas(): THREE.Texture | null {
    return this.normalAtlas;
  }

  public getMaterialScales(): number[] {
    return this.materials.map((m) => m.scale);
  }

  /**
   * Dispose of all textures to free GPU memory
   */
  public dispose(): void {
    if (this.atlas) {
      this.atlas.dispose();
      this.atlas = null;
    }
    if (this.normalAtlas) {
      this.normalAtlas.dispose();
      this.normalAtlas = null;
    }
    this.materials = [];
  }
}
