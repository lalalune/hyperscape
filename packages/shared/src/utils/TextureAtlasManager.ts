import THREE from "../extras/three/three";

interface MaterialInfo {
  name: string;
  diffuse: string;
  normal: string;
  scale: number;
}

export class TextureAtlasManager {
  private atlas: THREE.Texture | null = null;
  private normalAtlas: THREE.Texture | null = null;
  private materials: MaterialInfo[] = [];
  private textureLoader = new THREE.TextureLoader();

  async init() {
    // Get CDN URL from window or default to localhost CDN
    const cdnUrl =
      typeof window !== "undefined"
        ? ((window as { __CDN_URL?: string }).__CDN_URL ?? "http://localhost:8080")
        : "http://localhost:8080";

    // Scale values: higher = smaller texture (more tiled), lower = larger texture
    // With TEXTURE_SCALE=40 in shader, a scale of 4.0 gives ~10m per tile repeat
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
        scale: 4.0, // ~10m per repeat
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
        scale: 6.0, // ~6.7m per repeat
      },
    ];

    this.atlas = await this.buildAtlas(this.materials.map((m) => m.diffuse));
    this.normalAtlas = await this.buildAtlas(
      this.materials.map((m) => m.normal),
    );
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
    const atlasWidth = imageWidth * 2;
    const atlasHeight = imageHeight * 2;

    const canvas = document.createElement("canvas");
    canvas.width = atlasWidth;
    canvas.height = atlasHeight;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Failed to get canvas context");
    }

    images.forEach((texture, index) => {
      const x = (index % 2) * imageWidth;
      const y = Math.floor(index / 2) * imageHeight;
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
