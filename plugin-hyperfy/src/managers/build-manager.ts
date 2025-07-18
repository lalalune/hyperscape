import type { IAgentRuntime } from '@elizaos/core';
import { HyperfyService } from '../service.js';
import { resolveUrl } from '../utils.js';
import type { HyperfyWorld, HyperfyEntity } from '../types/hyperfy.js';

export class BuildManager {
  private runtime: IAgentRuntime;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
  }

  async translate(entityId: string, position: [number, number, number]) {
    const service = this.getService();
    if (!service) {
      return;
    }
    const world = service.getWorld();
    if (!world) {
      return;
    }
    const entity = world.entities.items.get(entityId);
    if (entity && entity.root) {
      const controls = world.controls;
      if (controls) {
        await controls.goto(entity.root.position.x, entity.root.position.z);
      }
      entity.root.position.fromArray(position);
      this.entityUpdate(entity);
    }
  }

  async rotate(entityId: string, quaternion: [number, number, number, number]) {
    const service = this.getService();
    if (!service) {
      return;
    }
    const world = service.getWorld();
    if (!world) {
      return;
    }
    const entity = world.entities.items.get(entityId);
    if (entity && entity.root) {
      const controls = world.controls;
      if (controls) {
        await controls.goto(entity.root.position.x, entity.root.position.z);
      }
      entity.root.quaternion.fromArray(quaternion);
      this.entityUpdate(entity);
    }
  }

  async scale(entityId: string, scale: [number, number, number]) {
    const service = this.getService();
    if (!service) {
      return;
    }
    const world = service.getWorld();
    if (!world) {
      return;
    }
    const entity = world.entities.items.get(entityId);
    if (entity && entity.root) {
      const controls = world.controls;
      if (controls) {
        await controls.goto(entity.root.position.x, entity.root.position.z);
      }
      entity.root.scale.fromArray(scale);
      this.entityUpdate(entity);
    }
  }

  async duplicate(entityId: string) {
    const service = this.getService();
    if (!service) {
      return;
    }
    const world = service.getWorld();
    if (!world) {
      return;
    }
    const entity = world.entities.items.get(entityId);
    if (!entity) {
      console.warn(`Entity ${entityId} not found for duplication`);
      return Promise.resolve();
    }

    const controls = world.controls;
    if (controls && entity.root) {
      await controls.goto(entity.root.position.x, entity.root.position.z);
    }

    if (entity.isApp && entity.blueprint) {
      let blueprintId = entity.data.blueprint;
      // if unique, we also duplicate the blueprint
      if (entity.blueprint.unique) {
        const blueprint = {
          id: this.generateId(),
          version: 0,
          name: entity.blueprint.name,
          image: entity.blueprint.image,
          author: entity.blueprint.author,
          url: entity.blueprint.url,
          desc: entity.blueprint.desc,
          model: entity.blueprint.model,
          script: entity.blueprint.script,
          props: entity.blueprint.props ? JSON.parse(JSON.stringify(entity.blueprint.props)) : {},
          preload: entity.blueprint.preload,
          public: entity.blueprint.public,
          locked: entity.blueprint.locked,
          frozen: entity.blueprint.frozen,
          unique: entity.blueprint.unique,
          disabled: entity.blueprint.disabled,
        };
        (world.blueprints as any).add(blueprint, true);
        blueprintId = blueprint.id;
      }

      if (entity.root) {
        const data = {
          id: this.generateId(),
          type: 'app',
          blueprint: blueprintId,
          position: entity.root.position.toArray(),
          quaternion: entity.root.quaternion.toArray(),
          scale: entity.root.scale.toArray(),
          mover: null,
          uploader: null,
          pinned: false,
          state: {},
        };
        (world.entities as any).add(data, true);
      }
    }
  }

  async delete(entityId: string) {
    const service = this.getService();
    if (!service) {
      return;
    }
    const world = service.getWorld();
    if (!world) {
      return;
    }
    const entity = world.entities.items.get(entityId);
    if (entity?.isApp && !entity.data.pinned) {
      const controls = world.controls;
      if (controls && entity.root) {
        await controls.goto(entity.root.position.x, entity.root.position.z);
      }
      if (entity.destroy) {
        entity.destroy(true);
      }
      this.entityUpdate(entity);
    }
  }

  async importEntity(url: string, position?: any, quaternion?: any) {
    const service = this.getService();
    if (!service) {
      return;
    }
    const world = service.getWorld();
    if (!world) {
      return;
    }

    const resolvedUrlurl = await resolveUrl(url, world);
    if (!resolvedUrlurl) {
      console.error(`Failed to resolve URL: ${url}`);
      return Promise.resolve();
    }

    let file;

    try {
      const resp = await fetch(resolvedUrlurl);
      const blob = await resp.blob();
      const fileName = url.split('/').pop() || 'unknown';
      file = new File([blob], fileName, {
        type: resp.headers.get('content-type') || 'application/octet-stream',
      });

      if (!file) {
        return Promise.resolve();
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      const maxSize = world.network.maxUploadSize * 1024 * 1024;

      if (file.size > maxSize) {
        console.error(`File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`);
        return Promise.resolve();
      }
      const validVec3 = (v: any): v is [number, number, number] =>
        Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number');

      const validQuat = (q: any): q is [number, number, number, number] =>
        Array.isArray(q) && q.length === 4 && q.every((n) => typeof n === 'number');

      position = validVec3(position) ? position : [0, 0, 0];
      quaternion = validQuat(quaternion) ? quaternion : [0, 0, 0, 1];

      const controls = world.controls;
      if (controls) {
        await controls.goto(position[0], position[2]);
      }

      const transform = {
        position,
        quaternion,
      };
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'hyp') {
        this.addApp(file, transform);
      }
      if (ext === 'glb' || ext === 'vrm') {
        this.addModel(file, transform);
      }
    } catch (error) {
      console.error(`Failed to import entity from ${url}:`, error);
      return Promise.resolve();
    }
  }

  async addApp(file: File, transform: any) {
    const service = this.getService();
    if (!service) {
      return;
    }
    const world = service.getWorld();
    if (!world) {
      return;
    }

    const info = await this.importApp(file);

    const blueprint = {
      id: this.generateId(),
      version: 0,
      name: info.blueprint.name,
      image: info.blueprint.image,
      author: info.blueprint.author,
      url: info.blueprint.url,
      desc: info.blueprint.desc,
      model: info.blueprint.model,
      script: info.blueprint.script,
      props: info.blueprint.props,
      preload: info.blueprint.preload,
      public: info.blueprint.public,
      locked: info.blueprint.locked,
      frozen: info.blueprint.frozen,
      unique: info.blueprint.unique,
      disabled: info.blueprint.disabled,
    };
    (world.blueprints as any).add(blueprint, true);
    const data = {
      id: this.generateId(),
      type: 'app',
      blueprint: blueprint.id,
      position: transform.position,
      quaternion: transform.quaternion,
      scale: [1, 1, 1],
      mover: null,
      uploader: world.network.id,
      pinned: false,
      state: {},
    };
    const app = (world.entities as any).add(data, true);
    const promises = info.assets.map((asset: any) => {
      return world.network.upload(asset.file);
    });
    try {
      await Promise.all(promises);
      app?.onUploaded?.();
    } catch (err) {
      console.error('failed to upload .hyp assets');
      console.error(err);
      app?.destroy?.();
    }
  }

  async addModel(file: File, transform: any) {
    const service = this.getService();
    if (!service) {
      return;
    }
    const world = service.getWorld();
    if (!world || !world.assetsUrl) {
      return;
    }

    const hash = await this.hashFile(file);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'glb';
    const filename = `${hash}.${ext}`;

    const baseUrl = world.assetsUrl.replace(/\/$/, '');
    const url = `${baseUrl}/${filename}`;
    const uploadPromise = world.network.upload(file);
    const timeoutPromise = new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error('Upload timed out')), 30000)
    );

    await Promise.race([uploadPromise, timeoutPromise]);

    const blueprint = {
      id: this.generateId(),
      version: 0,
      name: file.name.split('.')[0],
      image: null,
      author: null,
      url: null,
      desc: null,
      model: url,
      script: null,
      props: {},
      preload: false,
      public: false,
      locked: false,
      unique: false,
      disabled: false,
    };

    (world.blueprints as any).add(blueprint, true);
    const data = {
      id: this.generateId(),
      type: 'app',
      blueprint: blueprint.id,
      position: transform.position,
      quaternion: transform.quaternion,
      scale: [1, 1, 1],
      mover: null,
      uploader: world.network.id,
      pinned: false,
      state: {},
    };
    const app = (world.entities as any).add(data, true);
    app?.onUploaded?.();
  }

  entityUpdate(entity: HyperfyEntity) {
    const service = this.getService();
    if (!service) {
      return;
    }
    const world = service.getWorld();
    if (!world || !entity.root) {
      return;
    }

    world.network.send('entityModified', {
      id: entity.data.id,
      position: entity.root.position.toArray(),
      quaternion: entity.root.quaternion.toArray(),
      scale: entity.root.scale.toArray(),
    });
  }

  private getService() {
    return this.runtime.getService<HyperfyService>(HyperfyService.serviceName);
  }

  private generateId(): string {
    return `entity-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private async importApp(file: File): Promise<any> {
    // Basic implementation for importing apps
    const name = file.name.replace('.hyp', '');
    return {
      blueprint: {
        name,
        image: null,
        author: null,
        url: null,
        desc: `Imported ${name} app`,
        model: null,
        script: null,
        props: {},
        preload: false,
        public: false,
        locked: false,
        frozen: false,
        unique: false,
        disabled: false,
      },
      assets: [],
    };
  }

  private async hashFile(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }
}
