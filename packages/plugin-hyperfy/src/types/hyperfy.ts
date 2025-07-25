/**
 * Hyperfy type declarations for the plugin
 */

export interface HyperfyWorld {
  url: string;
  port?: number;
  maxGames?: number;
  testMode?: boolean;
  connectedAgents: Map<string, any>;
  activeGames: Map<string, any>;
  
  start(): Promise<void>;
  stop(): Promise<void>;
  disconnectAgent(agentId: string): void;
  on(event: string, callback: Function): void;
  off(event: string, callback: Function): void;
}

// Re-export Entity and Player types with the properties the plugin expects
export interface Entity {
  id: string;
  type: string;
  name?: string;
  data?: any;
  root?: any; // THREE.Object3D
  blueprint?: any;
  base?: any; // THREE.Object3D
  isApp?: boolean;
  isPlayer?: boolean;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number; w: number };
  scale?: { x: number; y: number; z: number };
  modify?: (changes: any) => void;
  destroy?: (broadcast?: boolean) => void;
}

export interface Player extends Entity {
  isPlayer: true;
  data: any & {
    name: string;
    roles?: string[];
  };
  connection?: any;
  input?: any;
  stats?: any;
  avatar?: any;
  setName?: (name: string) => void;
  spawn?: (position: any) => void;
  respawn?: () => void;
  damage?: (amount: number, source?: Entity) => void;
  heal?: (amount: number) => void;
} 