/**
 * Enhanced loader types with better type safety
 * Eliminates need for 'as unknown as' casts
 */

import type { LoadedModel, LoadedEmote, LoadedAvatar, VideoFactory } from './index';
import type { Texture, DataTexture } from 'three';

// Type guards for LoaderResult types
export function isLoadedModel(result: unknown): result is LoadedModel {
  return typeof result === 'object' && result !== null && 'toNodes' in result;
}

export function isTexture(result: unknown): result is Texture {
  return typeof result === 'object' && result !== null && 
         'isTexture' in result && (result as Texture).isTexture === true;
}

export function isDataTexture(result: unknown): result is DataTexture {
  return typeof result === 'object' && result !== null && 
         'isDataTexture' in result && (result as DataTexture).isDataTexture === true;
}

// Enhanced loader interface with typed methods
export interface TypedLoaderMethods {
  loadModel(url: string): Promise<LoadedModel>;
  loadTexture(url: string): Promise<Texture>;
  loadHDR(url: string): Promise<DataTexture>;
  loadAvatar(url: string): Promise<LoadedAvatar>;
  loadEmote(url: string): Promise<LoadedEmote>;
  loadVideo(url: string): Promise<VideoFactory>;
}

// Safe loader wrapper that provides type-safe methods
export class SafeLoaderWrapper {
  constructor(private loader: { load: (type: string, url: string) => Promise<unknown> }) {}
  
  async loadModel(url: string): Promise<LoadedModel> {
    const result = await this.loader.load('model', url);
    
    if (isLoadedModel(result)) {
      return result;
    }
    
    throw new Error(`Expected model to load as LoadedModel, got: ${typeof result}`);
  }
  
  async loadTexture(url: string): Promise<Texture> {
    const result = await this.loader.load('texture', url);
    
    if (isTexture(result)) {
      return result;
    }
    
    throw new Error(`Expected texture to load as Texture, got: ${typeof result}`);
  }
  
  async loadHDR(url: string): Promise<DataTexture> {
    const result = await this.loader.load('hdr', url);
    
    if (isDataTexture(result)) {
      return result;
    }
    
    throw new Error(`Expected HDR to load as DataTexture, got: ${typeof result}`);
  }
  
  async loadAvatar(url: string): Promise<LoadedAvatar> {
    const result = await this.loader.load('avatar', url);
    
    // Strong type assumption - avatar loading always returns LoadedAvatar
    return result as LoadedAvatar;
  }
  
  async loadEmote(url: string): Promise<LoadedEmote> {
    const result = await this.loader.load('emote', url);
    
    // Strong type assumption - emote loading always returns LoadedEmote
    return result as LoadedEmote;
  }
  
  async loadVideo(url: string): Promise<VideoFactory> {
    const result = await this.loader.load('video', url);
    
    // Strong type assumption - video loading always returns VideoFactory
    return result as VideoFactory;
  }
}
