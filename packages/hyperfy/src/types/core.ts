// Core types for Hyperfy
export interface EntityData {
  id: string;
  type: string;
  name?: string;
  position?: [number, number, number];
  quaternion?: [number, number, number, number];
  scale?: [number, number, number];
  components?: any;
  owner?: string;
  [key: string]: any;
}

export interface ComponentData {
  type: string;
  data: any;
}

export interface Control {
  id: string;
  playerId: string;
  enabled: boolean;
  
  // Key controls
  keyA?: any;
  keyB?: any;
  keyC?: any;
  keyD?: any;
  keyE?: any;
  keyF?: any;
  keyG?: any;
  keyH?: any;
  keyI?: any;
  keyJ?: any;
  keyK?: any;
  keyL?: any;
  keyM?: any;
  keyN?: any;
  keyO?: any;
  keyP?: any;
  keyQ?: any;
  keyR?: any;
  keyS?: any;
  keyT?: any;
  keyU?: any;
  keyV?: any;
  keyW?: any;
  keyX?: any;
  keyY?: any;
  keyZ?: any;
  
  // Arrow keys
  arrowUp?: any;
  arrowDown?: any;
  arrowLeft?: any;
  arrowRight?: any;
  
  // Special keys
  space?: any;
  shiftLeft?: any;
  shiftRight?: any;
  
  // Mouse controls
  mouseLeft?: any;
  mouseRight?: any;
  
  // Screen and camera
  screen?: {
    width: number;
    height: number;
  };
  camera?: {
    position: any;
    quaternion: any;
    zoom: number;
    write: boolean;
  };
  
  // Pointer
  pointer?: {
    locked: boolean;
    lock: () => void;
    coords: any;
    position: any;
    delta: any;
  };
  
  // XR controls
  xrLeftStick?: {
    value: { x: number; z: number };
  };
  xrLeftTrigger?: any;
  xrLeftBtn1?: any;
  xrLeftBtn2?: any;
  xrRightStick?: {
    value: { x: number; y: number };
  };
  xrRightTrigger?: any;
  xrRightBtn1?: {
    down: boolean;
    pressed: boolean;
  };
  xrRightBtn2?: any;
  
  // Touch controls
  touchA?: {
    down: boolean;
    pressed: boolean;
  };
  touchB?: any;
  touchStick?: any;
  
  // Scroll
  scrollDelta?: {
    value: number;
  };
}

export interface HotReloadable {
  fixedUpdate?(delta: number): void;
  update?(delta: number): void;
  lateUpdate?(delta: number): void;
  postLateUpdate?(delta: number): void;
}

export interface Layers {
  environment: number;
  player: number;
}

export interface NetworkData {
  type?: string;
  data?: any;
  timestamp?: number;
  reliable?: boolean;
  id?: string;
  p?: any; // position array
  [key: string]: any; // Allow any additional properties
}

export interface Touch {
  id: number;
  x: number;
  y: number;
  pressure: number;
  position?: { x: number; y: number };
  delta?: { x: number; y: number };
}