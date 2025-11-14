import THREE from "../extras/three";

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
        ? (window as any).__CDN_URL || "http://localhost:8088"
        : "http://localhost:8088";

    console.log("[TextureAtlasManager] Using CDN URL:", cdnUrl);

    this.materials = [
      {
        name: "grass",
        diffuse: `${cdnUrl}/terrain/textures/stylized_grass/stylized_grass_d.png`,
        normal: `${cdnUrl}/terrain/textures/stylized_grass/stylized_grass_n.png`,
        scale: 0.1,
      },
      {
        name: "dirt",
        diffuse: `${cdnUrl}/terrain/textures/dirt_ground/dirt_ground_d.png`,
        normal: `${cdnUrl}/terrain/textures/dirt_ground/dirt_ground_n.png`,
        scale: 0.1,
      },
      {
        name: "rock",
        diffuse: `${cdnUrl}/terrain/textures/stylized_stone/stylized_stone_d.png`,
        normal: `${cdnUrl}/terrain/textures/stylized_stone/stylized_stone_n.png`,
        scale: 6.0,
      },
      {
        name: "snow",
        diffuse: `${cdnUrl}/terrain/textures/stylized_snow/stylized_snow_d.png`,
        normal: `${cdnUrl}/terrain/textures/stylized_snow/stylized_snow_n.png`,
        scale: 6.0,
      },
    ];

    this.atlas = await this.buildAtlas(this.materials.map((m) => m.diffuse));
    this.normalAtlas = await this.buildAtlas(
      this.materials.map((m) => m.normal),
    );
  }

  private async buildAtlas(textureUrls: string[]): Promise<THREE.Texture> {
    console.log("[TextureAtlasManager] Loading textures:", textureUrls);
    const images = await Promise.all(
      textureUrls.map(async (url) => {
        try {
          console.log("[TextureAtlasManager] Loading:", url);
          const texture = await this.textureLoader.loadAsync(url);
          console.log("[TextureAtlasManager] Loaded successfully:", url);
          return texture;
        } catch (error) {
          console.error("[TextureAtlasManager] Failed to load:", url, error);
          throw error;
        }
      }),
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
}
