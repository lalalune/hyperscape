import { logger } from "@elizaos/core";
import { isNumber, isString } from "lodash-es";
import { THREE, System } from "@hyperscape/shared";
// CSM import removed - not available in current hyperscape version
import { PlaywrightManager } from "../managers/playwright-manager";
import { resolveUrl } from "../utils";
import type { World } from "@hyperscape/shared";

// Helper to check if renderer is WebGLRenderer
function isWebGLRenderer(renderer: THREE.Renderer | THREE.WebGLRenderer): renderer is THREE.WebGLRenderer {
  return renderer instanceof THREE.WebGLRenderer;
}

// Mock CSM interface since it's not available
interface CSM {
  lightDirection: THREE.Vector3;
  lights: THREE.DirectionalLight[];
  update(): void;
  updateCascades(cascades: number): void;
  updateShadowMapSize(size: number): void;
  updateFrustums(): void;
}

interface SkyNode extends THREE.Object3D {
  sky?: {
    texture?: THREE.Texture;
    [key: string]: THREE.Texture | string | number | boolean | undefined;
  };
  [key: string]: Record<string, unknown> | string | number | boolean | undefined;
}

interface SkyHandle {
  node: SkyNode;
  destroy: () => void;
}

interface EnvironmentConfig {
  bg?: string;
  hdr?: string;
  sunDirection?: THREE.Vector3;
  sunIntensity?: number;
  sunColor?: string | number;
  fogNear?: number;
  fogFar?: number;
  fogColor?: string;
  model?: string;
}

export class EnvironmentSystem extends System {
  declare world: World;
  model: THREE.Object3D | null = null;
  skys: SkyHandle[] = [];
  sky: THREE.Mesh | null = null;
  skyN = 0;
  base!: EnvironmentConfig;
  skyInfo: {
    texture?: THREE.Texture;
    bgUrl?: string;
    hdrUrl?: string;
    sunDirection?: THREE.Vector3;
    sunIntensity?: number;
    sunColor?: string | number;
    fogNear?: number;
    fogFar?: number;
    fogColor?: string;
  } | null = null;
  bgUrl: string | null = null;
  hdrUrl: string | null = null;
  csm!: CSM;

  constructor(world: World) {
    super(world);
  }

  start() {
    this.setSkyboxToBlack();
    this.base = {
      model: "asset://base-environment.glb",
      bg: "asset://day2-2k.jpg",
      hdr: "asset://day2.hdr",
      sunDirection: new THREE.Vector3(-1, -2, -2).normalize(),
      sunIntensity: 1,
      sunColor: 0xffffff,
      fogNear: undefined,
      fogFar: undefined,
      fogColor: undefined,
    };
    this.buildCSM();
    this.updateSky();

    if (this.world.settings?.on) {
      this.world.settings.on("change", this.onSettingsChange);
    }
    // this.world.prefs.on('change', this.onPrefsChange)
    // this.world.graphics.on('resize', this.onViewportResize)
  }

  private setSkyboxToBlack() {
    if (this.world.stage) {
      this.world.stage.environment = null;
      // Set background via renderer if available (WebGL only)
      if (
        this.world.graphics?.renderer &&
        isWebGLRenderer(this.world.graphics.renderer)
      ) {
        this.world.graphics.renderer.setClearColor(0x000000);
      }
      logger.info("[Environment] Skybox set to black.");
    }
  }

  /**
   * Load a skybox from a URL or use the default based on index
   * @param skyboxUrlOrIndex - URL string or index number for default skyboxes (0-5)
   */
  async loadSkybox(skyboxUrlOrIndex?: string | number) {
    if (skyboxUrlOrIndex === undefined || skyboxUrlOrIndex === null) {
      // Load default skybox
      logger.info("[Environment] Loading default black skybox");
      this.setSkyboxToBlack();
      return;
    }

    if (typeof skyboxUrlOrIndex === "number") {
      // Load indexed skybox
      const index = skyboxUrlOrIndex;
      await this.loadIndexedSkybox(index);
    } else {
      // Load from URL
      await this.loadSkyboxFromUrl(skyboxUrlOrIndex);
    }
  }

  private async loadIndexedSkybox(index: number) {
    const skyboxConfigs = [
      { url: "bridge2.jpeg" },
      { url: "bluecloud.jpg" },
      { url: "clearsky.jpg" },
      { url: "computer_history_museum.jpg" },
      { url: "grimmnight.jpg" },
      { url: "milkyway.jpg" },
    ];

    const config = skyboxConfigs[index]!;
    const loader = this.world.loader!;

    // Type narrowing for the config
    const urlConfig = config as { url: string };
    const url = `${this.world.assetsUrl}/skybox/${urlConfig.url}`;

    const texture = await loader.load("texture", url);
    this.applyTexture(texture as THREE.Texture);
  }

  private async loadSkyboxFromUrl(url: string) {
    const loader = this.world.loader!;
    const texture = await loader.load("texture", url);
    this.applyTexture(texture as THREE.Texture);
  }

  private applyTexture(texture: THREE.Texture) {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    this.world.stage.environment = texture;
    // Set background via renderer if available (WebGL only)
    if (
      this.world.graphics?.renderer &&
      isWebGLRenderer(this.world.graphics.renderer)
    ) {
      this.world.graphics.renderer.setClearColor(0xffffff);
    }
    logger.info("[Environment] Skybox texture applied successfully");
  }

  /**
   * Reset the skybox to black
   */
  resetSkybox() {
    this.setSkyboxToBlack();
  }

  async updateModel() {
    const settings = this.world.settings as {
      model?: { url?: string } | string;
    };
    // Determine URL based on model type
    let url: string;
    const model = settings?.model;
    if ((model as { url?: string })?.url) {
      url = (model as { url: string }).url;
    } else {
      // If model has charAt property, it's a string, otherwise use base
      url = (model as string).charAt ? (model as string) : this.base.model;
    }
    let glb = this.world.loader?.get("model", url);
    if (!glb) {
      glb = await this.world.loader?.load("model", url);
    }
    if (this.model) {
      (this.model as THREE.Object3D & { deactivate?: () => void }).deactivate();
    }
    this.model = (glb as { toNodes?: () => THREE.Object3D })?.toNodes() || null;
    if (this.model) {
      (
        this.model as THREE.Object3D & {
          activate?: (params: { world: World; label: string }) => void;
        }
      ).activate({ world: this.world, label: "base" });
    }
  }

  addSky(node: SkyNode): SkyHandle {
    const handle: SkyHandle = {
      node,
      destroy: () => {
        const idx = this.skys.indexOf(handle);
        if (idx === -1) {
          return;
        }
        this.skys.splice(idx, 1);
        this.updateSky();
      },
    };
    this.skys.push(handle);
    this.updateSky();
    return handle;
  }

  getSky() {
    return this.sky;
  }

  async updateSky() {
    if (!this.sky) {
      const geometry = new THREE.SphereGeometry(1000, 60, 40);
      const material = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
      this.sky = new THREE.Mesh(geometry, material);
      // Note: computeBoundsTree is not available on standard BufferGeometry
      (this.sky.material as THREE.MeshBasicMaterial).fog = false;
      (this.sky.material as THREE.MeshBasicMaterial).toneMapped = false;
      (this.sky.material as THREE.MeshBasicMaterial).needsUpdate = true;
      this.sky.matrixAutoUpdate = false;
      this.sky.matrixWorldAutoUpdate = false;
      this.sky.visible = false;
      this.world.stage.scene.add(this.sky);
    }

    const base = this.base;
    const node = this.skys[this.skys.length - 1]?.node;
    let bgUrl = node?._bg || base.bg;
    const hdrUrl = node?._hdr || base.hdr;
    const sunDirection =
      (node as SkyNode & { _sunDirection?: THREE.Vector3 })?._sunDirection ||
      base.sunDirection ||
      new THREE.Vector3(-1, -2, -2).normalize();
    const sunIntensity = isNumber(node?._sunIntensity)
      ? node._sunIntensity
      : base.sunIntensity;
    const sunColor = isString(node?._sunColor) ? node._sunColor : base.sunColor;
    const fogNear = isNumber(node?._fogNear) ? node._fogNear : base.fogNear;
    const fogFar = isNumber(node?._fogFar) ? node._fogFar : base.fogFar;
    const fogColor = isString(node?._fogColor) ? node._fogColor : base.fogColor;
    const playwrightManager = PlaywrightManager.getInstance();
    const n = ++this.skyN;
    let bgUUID;
    if (bgUrl) {
      bgUrl = await resolveUrl(bgUrl as string, this.world);
      bgUUID = await playwrightManager.registerTexture(bgUrl as string, "map");
    }
    if (bgUUID) {
      (this.sky.material as THREE.MeshBasicMaterial).userData.materialId =
        bgUUID;
      this.sky.visible = true;
    } else {
      this.sky.visible = false;
    }

    if (hdrUrl) {
      await playwrightManager.loadEnvironmentHDR(hdrUrl as string);
    }
    if (n !== this.skyN) {
      return;
    }

    this.csm.lightDirection = sunDirection;

    for (const light of this.csm.lights) {
      light.intensity = sunIntensity;
      light.color.set(sunColor);
    }

    if (isNumber(fogNear) && isNumber(fogFar) && fogColor) {
      const color = new THREE.Color(fogColor);
      if (this.world.stage.scene) {
        this.world.stage.scene.fog = new THREE.Fog(color, fogNear, fogFar);
      }
    } else {
      if (this.world.stage.scene) {
        this.world.stage.scene.fog = null;
      }
    }

    this.skyInfo = {
      bgUrl: bgUrl as string,
      hdrUrl: hdrUrl as string,
      sunDirection,
      sunIntensity,
      sunColor,
      fogNear,
      fogFar,
      fogColor,
    };
  }

  update(_delta: number) {
    this.csm?.update();
  }

  lateUpdate(_delta: number) {
    if (!this.sky) {
      return;
    }
    this.sky.position.x = this.world.rig.position.x;
    this.sky.position.z = this.world.rig.position.z;
    this.sky.matrixWorld.setPosition(this.sky.position);
  }

  buildCSM() {
    const options = {
      cascades: 3,
      shadowMapSize: 2048,
      castShadow: true,
      lightIntensity: 1,
      shadowBias: 0.000003,
      shadowNormalBias: 0.002,
    };
    if (this.csm) {
      this.csm.updateCascades(options.cascades);
      this.csm.updateShadowMapSize(options.shadowMapSize);
      this.csm.lightDirection =
        this.skyInfo?.sunDirection || new THREE.Vector3(-1, -2, -2).normalize();
      for (const light of this.csm.lights) {
        light.intensity = (this.skyInfo?.sunIntensity as number) || 1.0;
        light.color.set(
          (this.skyInfo?.sunColor as THREE.ColorRepresentation) || 0xffffff,
        );
        light.castShadow = options.castShadow;
      }
    } else {
      // CSM is not available in this environment, using placeholder
      this.csm = {
        updateFrustums: () => {},
        updateCascades: () => {},
        updateShadowMapSize: () => {},
        update: () => {},
        lightDirection: new THREE.Vector3(0, -1, 0).normalize(),
        lights: [],
      } as CSM;
      if (!options.castShadow) {
        for (const light of this.csm.lights) {
          light.castShadow = false;
        }
      }
    }
  }

  onSettingsChange = (changes: Record<string, unknown>) => {
    if (changes.model) {
      this.updateModel();
    }
  };

  onPrefsChange = (changes: Record<string, unknown>) => {
    if (changes.shadows) {
      this.buildCSM();
      this.updateSky();
    }
  };

  onViewportResize = () => {
    this.csm.updateFrustums();
  };
}
