//@ts-nocheck
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import puppeteer from 'puppeteer';
import { IAgentRuntime, ModelType } from '@elizaos/core';
import { HyperfyService } from '../service.js';
import * as THREE from 'three';
import { resolveUrl } from '../utils.js';
import { getModuleDirectory } from '../utils.js';

export class PuppeteerManager {
  private static instance: PuppeteerManager | null = null;

  private runtime: IAgentRuntime;
  private browser: puppeteer.Browser;
  private page: puppeteer.Page;
  private initPromise: Promise<void> | null = null;
  private readonly STRIP_SLOTS = [
    'map',
    'aoMap',
    'alphaMap',
    'bumpMap',
    'normalMap',
    'metalnessMap',
    'roughnessMap',
    'emissiveMap',
    'lightMap',
  ] as const;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.init();

    if (!PuppeteerManager.instance) {
      PuppeteerManager.instance = this;
    } else {
      throw new Error('PuppeteerManager has already been instantiated.');
    }
  }

  public static getInstance(): PuppeteerManager {
    if (!this.instance) {
      throw new Error(
        'PuppeteerManager not yet initialized. Call new PuppeteerManager(runtime) first.'
      );
    }
    return this.instance;
  }

  private async init() {
    // Only initialize once
    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          this.browser = await puppeteer.launch({
            // headless: false,
            defaultViewport: null,
            slowMo: 50,
          });

          this.page = await this.browser.newPage();
          const moduleDirPath = getModuleDirectory();
          const filePath = `${moduleDirPath}/puppeteer/index.html`;

          await this.page.goto(`file://${filePath}`, { waitUntil: 'load' });

          await this.injectScripts([
            `${moduleDirPath}/scripts/createVRMFactory.js`,
            `${moduleDirPath}/scripts/snapshotEquirectangular.js`,
            `${moduleDirPath}/scripts/snapshotFacingDirection.js`,
            `${moduleDirPath}/scripts/snapshotViewToTarget.js`,
          ]);

          await this.page.waitForFunction(
            () =>
              window.THREE !== undefined &&
              window.scene !== undefined &&
              window.camera !== undefined
          );
        } catch (error) {
          console.warn('[PuppeteerManager] Failed to initialize Puppeteer:', error);
          console.warn('[PuppeteerManager] Screenshot functionality will be disabled');
          // Don't throw - allow the plugin to work without Puppeteer
        }
      })();
    }
    return this.initPromise;
  }

  private async injectScripts(scriptPaths: string[]) {
    for (const relativePath of scriptPaths) {
      const absPath = path.resolve(relativePath);
      const content = await fsPromises.readFile(absPath, 'utf8');
      await this.page.addScriptTag({ content });
    }
  }

  public async snapshotFacingDirection(
    direction: 'front' | 'back' | 'left' | 'right'
  ): Promise<string> {
    await this.init();

    if (!this.browser || !this.page) {
      console.warn('[PuppeteerManager] Puppeteer not available, skipping screenshot');
      return '';
    }

    const service = this.getService();
    const world = service.getWorld();
    const player = world.entities.player;

    if (!player) {
      throw new Error('Player entity not yet available');
    }

    await world.controls.rotateTo(direction, 500);
    world.controls.stopRotation();

    await this.rehydrateSceneAssets();

    const playerData = {
      position: player.base.position.toArray() as [number, number, number],
      quaternion: [
        player.base.quaternion.x,
        player.base.quaternion.y,
        player.base.quaternion.z,
        player.base.quaternion.w,
      ] as const,
    };

    const base64 = await this.page.evaluate(async (playerData) => {
      return await window.snapshotFacingDirection(playerData);
    }, playerData);

    const filePath = path.resolve(`scene_facing_${direction}.jpeg`);
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));

    return `data:image/jpeg;base64,${base64}`;
  }

  public async snapshotViewToTarget(targetPosition: [number, number, number]): Promise<string> {
    await this.init();

    const service = this.getService();
    const world = service.getWorld();
    const player = world.entities.player;

    if (!player) {
      throw new Error('Player entity not yet available');
    }

    await this.rehydrateSceneAssets();

    const playerData = {
      position: player.base.position.toArray() as [number, number, number],
    };

    const base64 = await this.page.evaluate(
      async (playerData, targetPosition) => {
        return await window.snapshotViewToTarget(playerData, targetPosition);
      },
      playerData,
      targetPosition
    );

    const filePath = path.resolve('scene_view_to_target.jpeg');
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));

    return `data:image/jpeg;base64,${base64}`;
  }

  public async snapshotEquirectangular(): Promise<string> {
    await this.init();

    const service = this.getService();
    const world = service.getWorld();
    const player = world.entities.player;

    if (!player) {
      throw new Error('Player entity not yet available');
    }

    await this.rehydrateSceneAssets();

    const playerData = {
      position: player.base.position.toArray(),
      quaternion: [
        player.base.quaternion.x,
        player.base.quaternion.y,
        player.base.quaternion.z,
        player.base.quaternion.w,
      ] as const,
    };

    const base64 = await this.page.evaluate(async (playerData) => {
      return await window.snapshotEquirectangular(playerData);
    }, playerData);

    const buffer = Buffer.from(base64, 'base64');
    const filePath = path.resolve('scene_equirectangular.jpeg');
    fs.writeFileSync(filePath, buffer);

    return `data:image/jpeg;base64,${base64}`;
  }

  async loadGlbBytes(url: string): Promise<number[]> {
    await this.init();
    const STRIP_SLOTS = this.STRIP_SLOTS;

    return this.page.evaluate(
      async (url, STRIP_SLOTS) => {
        const loader = new window.GLTFLoader();
        const gltf = await loader.loadAsync(url);

        if (!window.texturesMap) {
          window.texturesMap = new Map();
        }

        gltf.scene.traverse((obj) => {
          if (!obj.isMesh || !obj.material) {
            return;
          }

          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];

          mats.forEach((mat) => {
            if (!mat.userData.materialId) {
              mat.userData.materialId = window.crypto.randomUUID();
            }
            const id = mat.userData.materialId;

            STRIP_SLOTS.forEach((slot) => {
              const tex = mat[slot];
              if (tex && tex.isTexture) {
                window.texturesMap.set(`${id}:${slot}`, tex);
                mat[slot] = null;
              }
            });

            mat.needsUpdate = true;
          });
        });

        const exporter = new window.GLTFExporter();
        const buffer = await new Promise<ArrayBuffer>((done) =>
          exporter.parse(gltf.scene, done, { binary: true, embedImages: true })
        );

        return [...new Uint8Array(buffer)];
      },
      url,
      STRIP_SLOTS
    );
  }

  async loadVRMBytes(url: string): Promise<number[]> {
    await this.init();

    return this.page.evaluate(async (url) => {
      const loader = window.VRMLoader;
      const gltf = await loader.loadAsync(url);
      const factory = window.createVRMFactory(gltf, (m) => m);

      window.renderer.render(window.scene, window.camera);

      if (!window.avatarMap) {
        window.avatarMap = new Map();
      }
      window.avatarMap.set(url, factory); // Store a deep clone of the avatar

      const exporter = new window.GLTFExporter();
      const buffer = await new Promise<ArrayBuffer>((done) =>
        exporter.parse(gltf.scene, done, { binary: true, embedImages: true })
      );

      return [...new Uint8Array(buffer)];
    }, url);
  }

  async registerTexture(url: string, slot: string): Promise<string> {
    await this.init();

    return this.page.evaluate(
      async (url, slot) => {
        if (!window.texturesMap) {
          window.texturesMap = new Map();
        }

        const loader = window.TextureLoader;
        const texture = await new Promise<THREE.Texture>((resolve, reject) => {
          loader.load(
            url,
            (tex) => resolve(tex),
            undefined,
            (err) => reject(err)
          );
        });

        const uuid = window.crypto.randomUUID();
        window.texturesMap.set(`${uuid}:${slot}`, texture);

        return uuid;
      },
      url,
      slot
    );
  }

  public async loadEnvironmentHDR(url: string): Promise<void> {
    await this.init();
    const service = this.getService();
    const world = service.getWorld();

    url = await resolveUrl(url, world);

    await this.page.evaluate(async (url) => {
      const loader = new window.RGBELoader();
      const hdrTexture = await new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      });

      window.environment = hdrTexture;
      window.scene.environment = hdrTexture;
      window.scene.background = hdrTexture;

      window.renderer.render(window.scene, window.camera);
    }, url);
  }

  private async rehydrateSceneAssets() {
    const service = this.getService();
    const world = service.getWorld();
    const sceneJson = world.stage.scene.toJSON();

    const agentId = world.entities.player.data.id;
    const players = await Promise.all(
      Array.from(world.entities.players.entries())
        .filter(([_, value]) => value.data.id !== agentId)
        .map(async ([key, value]) => {
          const avatarUrl = await resolveUrl(value.avatarUrl, world);
          return {
            id: key,
            avatarUrl,
            position: value.base.position.toArray(),
            scale: value.base.scale.toArray(),
            quaternion: [
              value.base.quaternion.x,
              value.base.quaternion.y,
              value.base.quaternion.z,
              value.base.quaternion.w,
            ],
          };
        })
    );

    const STRIP_SLOTS = this.STRIP_SLOTS;
    await this.page.evaluate(
      async (sceneJson, STRIP_SLOTS, players) => {
        const THREE = window.THREE;
        const loader = new window.THREE.ObjectLoader();
        const loadedScene = loader.parse(sceneJson);

        // Rehydrate materials
        loadedScene.traverse((obj) => {
          if (!obj.isMesh || !obj.material) {
            return;
          }

          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];

          mats.forEach((mat) => {
            const id = mat.userData.materialId;
            if (!id) {
              return;
            }

            STRIP_SLOTS.forEach((slot) => {
              const key = `${id}:${slot}`;
              const tex = window.texturesMap?.get(key);
              if (tex && tex.isTexture) {
                mat[slot] = tex;
              }
            });

            mat.needsUpdate = true;
          });
        });

        // Rehydrate player avatars
        if (window.activeVRMInstances) {
          for (const inst of window.activeVRMInstances) {
            try {
              inst.destroy();
            } catch (e) {
              console.warn('[AgentLoader] Failed to destroy instance:', e);
            }
          }
        }
        window.activeVRMInstances = [];

        players.forEach((player) => {
          if (!player.avatarUrl) {
            return;
          }
          const factory = window.avatarMap?.get(player.avatarUrl);
          if (!factory) {
            return;
          }

          const vrmHooks = {
            camera: window.camera,
            scene: loadedScene,
            octree: null,
            setupMaterial: () => {},
            loader: window.VRMLoader,
          };
          const instance = factory.create(new THREE.Matrix4(), vrmHooks, (m) => m);

          const position = new THREE.Vector3(...player.position);
          const rotation = new THREE.Quaternion(...player.quaternion);
          const scale = new THREE.Vector3(...player.scale);

          const matrix = new THREE.Matrix4();
          matrix.compose(position, rotation, scale);
          instance.move(matrix);

          window.activeVRMInstances.push(instance);
        });

        // Rehydrate environment
        if (window.environment) {
          loadedScene.environment = window.environment;
          loadedScene.background = window.environment;
        }

        window.scene = loadedScene;
        window.renderer.render(window.scene, window.camera);
      },
      sceneJson,
      STRIP_SLOTS,
      players
    );
  }

  private getService() {
    return this.runtime.getService<HyperfyService>(HyperfyService.serviceName);
  }
}
