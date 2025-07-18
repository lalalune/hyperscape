import { CSM } from '../../../hyperfy/src/core/libs/csm/CSM.js';
import { isNumber, isString } from 'lodash-es';
import type { HyperfySystem } from '../types/hyperfy.js';
import { logger } from '@elizaos/core';
import * as THREE from 'three';
import { PuppeteerManager } from '../managers/puppeteer-manager.js';
import { resolveUrl } from '../utils.js';
import type { HyperfyWorld } from '../types/hyperfy.js';

interface SkyHandle {
  node: any;
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

export class EnvironmentSystem implements HyperfySystem {
  declare world: any;
  model: any = null;
  skys: SkyHandle[] = [];
  sky: THREE.Mesh | null = null;
  skyN = 0;
  base!: EnvironmentConfig;
  skyInfo: any = null;
  bgUrl: string | null = null;
  hdrUrl: string | null = null;
  csm!: CSM;

  constructor(world: any) {
    this.world = world;
  }

  start() {
    this.setSkyboxToBlack();
    this.base = {
      model: 'assets/base-environment.glb',
      bg: 'assets/day2-2k.jpg',
      hdr: 'assets/day2.hdr',
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
      this.world.settings.on('change', this.onSettingsChange);
    }
    // this.world.prefs.on('change', this.onPrefsChange)
    // this.world.graphics.on('resize', this.onViewportResize)
  }

  private setSkyboxToBlack() {
    if (this.world.stage) {
      this.world.stage.environment = null;
      this.world.stage.background = new THREE.Color(0x000000);
      logger.info('[Environment] Skybox set to black.');
    }
  }

  /**
   * Load a skybox from a URL or use the default based on index
   * @param skyboxUrlOrIndex - URL string or index number for default skyboxes (0-5)
   */
  async loadSkybox(skyboxUrlOrIndex?: string | number) {
    try {
      if (skyboxUrlOrIndex === undefined || skyboxUrlOrIndex === null) {
        // Load default skybox
        logger.info('[Environment] Loading default black skybox');
        this.setSkyboxToBlack();
        return;
      }

      if (typeof skyboxUrlOrIndex === 'number') {
        // Load indexed skybox
        const index = skyboxUrlOrIndex;
        if (index >= 0 && index <= 5) {
          await this.loadIndexedSkybox(index);
        } else {
          logger.warn(`[Environment] Invalid skybox index: ${index}. Must be 0-5.`);
          this.setSkyboxToBlack();
        }
      } else {
        // Load from URL
        await this.loadSkyboxFromUrl(skyboxUrlOrIndex);
      }
    } catch (error) {
      logger.error('[Environment] Error loading skybox:', error);
      this.setSkyboxToBlack();
    }
  }

  private async loadIndexedSkybox(index: number) {
    const skyboxConfigs = [
      { url: 'bridge2.jpeg' },
      { url: 'bluecloud.jpg' },
      { url: 'clearsky.jpg' },
      { url: 'computer_history_museum.jpg' },
      { url: 'grimmnight.jpg' },
      { url: 'milkyway.jpg' },
    ];

    const config = skyboxConfigs[index];
    if (!config) {
      logger.warn(`[Environment] No skybox config found for index ${index}`);
      this.setSkyboxToBlack();
      return;
    }

    const loader = this.world.loader;
    if (!loader) {
      logger.error('[Environment] World loader not available');
      this.setSkyboxToBlack();
      return;
    }

    // Type narrowing for the config
    const urlConfig = config as { url: string };
    const url = `${this.world.assetsUrl}/skybox/${urlConfig.url}`;

    try {
      const texture = await loader.load(url);
      if (texture) {
        this.applyTexture(texture);
      } else {
        logger.warn('[Environment] Failed to load texture');
        this.setSkyboxToBlack();
      }
    } catch (error) {
      logger.error('[Environment] Error loading indexed skybox:', error);
      this.setSkyboxToBlack();
    }
  }

  private async loadSkyboxFromUrl(url: string) {
    const loader = this.world.loader;
    if (!loader) {
      logger.error('[Environment] World loader not available');
      this.setSkyboxToBlack();
      return;
    }

    try {
      const texture = await loader.load(url);
      if (texture) {
        this.applyTexture(texture);
      } else {
        logger.warn('[Environment] Failed to load texture from URL');
        this.setSkyboxToBlack();
      }
    } catch (error) {
      logger.error('[Environment] Error loading skybox from URL:', error);
      this.setSkyboxToBlack();
    }
  }

  private applyTexture(texture: any) {
    if (!texture || !this.world.stage) {
      logger.warn('[Environment] Cannot apply texture - texture or stage not available');
      this.setSkyboxToBlack();
      return;
    }

    texture.mapping = THREE.EquirectangularReflectionMapping;
    this.world.stage.environment = texture;
    this.world.stage.background = texture;
    logger.info('[Environment] Skybox texture applied successfully');
  }

  /**
   * Reset the skybox to black
   */
  resetSkybox() {
    this.setSkyboxToBlack();
  }

  async updateModel() {
    const url = this.world.settings.model?.url || this.base.model;
    let glb = this.world.loader.get('model', url);
    if (!glb) {
      glb = await this.world.loader.load('model', url);
    }
    if (this.model) {
      this.model.deactivate();
    }
    this.model = glb.toNodes();
    this.model.activate({ world: this.world, label: 'base' });
  }

  addSky(node: any): SkyHandle {
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
    const sunDirection = node?._sunDirection || base.sunDirection;
    const sunIntensity = isNumber(node?._sunIntensity) ? node._sunIntensity : base.sunIntensity;
    const sunColor = isString(node?._sunColor) ? node._sunColor : base.sunColor;
    const fogNear = isNumber(node?._fogNear) ? node._fogNear : base.fogNear;
    const fogFar = isNumber(node?._fogFar) ? node._fogFar : base.fogFar;
    const fogColor = isString(node?._fogColor) ? node._fogColor : base.fogColor;
    const puppeteerManager = PuppeteerManager.getInstance();
    const n = ++this.skyN;
    let bgUUID;
    if (bgUrl) {
      bgUrl = await resolveUrl(bgUrl, this.world);
      bgUUID = await puppeteerManager.registerTexture(bgUrl, 'map');
    }
    if (bgUUID) {
      (this.sky.material as THREE.MeshBasicMaterial).userData.materialId = bgUUID;
      this.sky.visible = true;
    } else {
      this.sky.visible = false;
    }

    if (hdrUrl) {
      await puppeteerManager.loadEnvironmentHDR(hdrUrl);
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
      this.world.stage.scene.fog = new THREE.Fog(color, fogNear, fogFar);
    } else {
      this.world.stage.scene.fog = null;
    }

    this.skyInfo = {
      bgUrl,
      hdrUrl,
      sunDirection,
      sunIntensity,
      sunColor,
      fogNear,
      fogFar,
      fogColor,
    };
  }

  update(delta: number) {
    this.csm?.update();
  }

  lateUpdate(delta: number) {
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
      this.csm.lightDirection = this.skyInfo?.sunDirection;
      for (const light of this.csm.lights) {
        light.intensity = this.skyInfo?.sunIntensity;
        light.color.set(this.skyInfo?.sunColor);
        light.castShadow = options.castShadow;
      }
    } else {
      this.csm = new CSM({
        mode: 'practical',
        lightDirection: new THREE.Vector3(0, -1, 0).normalize(),
        parent: this.world.stage.scene,
        camera: this.world.camera,
        cascades: options.cascades,
        shadowMapSize: options.shadowMapSize,
        lightIntensity: options.lightIntensity,
      });
      if (!options.castShadow) {
        for (const light of this.csm.lights) {
          light.castShadow = false;
        }
      }
    }
  }

  onSettingsChange = (changes: Record<string, any>) => {
    if (changes.model) {
      this.updateModel();
    }
  };

  onPrefsChange = (changes: Record<string, any>) => {
    if (changes.shadows) {
      this.buildCSM();
      this.updateSky();
    }
  };

  onViewportResize = () => {
    this.csm.updateFrustums();
  };
}
