/**
 * Avatar-related type definitions
 * 
 * Shared types for avatar system functionality
 */

import THREE from '../extras/three';
import type { HSNode as Node, World } from './index';

// Avatar node interface for AvatarPreview
export interface AvatarNode extends Node {
  activate(ctx?: World | null): void;
  deactivate(): void;
  setEmote(emote: string): void;
  instance?: {
    update?: (deltaTime: number) => void;
    raw?: {
      userData?: {
        vrm?: {
          humanoid?: {
            getRawBone(boneName: string): { node: THREE.Object3D };
          };
        };
      };
      scene?: THREE.Object3D;
    };
  };
}

// Avatar information and stats
export interface AvatarInfo {
  rank: number;
  stats: {
    [key: string]: {
      value: number | number[];
      rank: number;
    };
  };
}

// Avatar bounds specification for ranking
export interface BoundsSpec {
  rank: number;
  fileSize: number;
  triangles: number;
  draws: number;
  bones: number;
  bounds: number[];
}

// Avatar pane component props
export interface AvatarPaneProps {
  world: World;
  info: {
    file: File;
    url: string;
    onEquip: () => void;
    onPlace: () => void;
  };
}