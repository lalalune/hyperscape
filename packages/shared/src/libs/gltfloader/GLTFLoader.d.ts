import THREE from "../../extras/three";

export interface GLTF {
  animations: THREE.AnimationClip[];
  scene: THREE.Group;
  scenes: THREE.Group[];
  cameras: THREE.Camera[];
  asset: {
    copyright?: string;
    generator?: string;
    version?: string;
    minVersion?: string;
    extensions?: any;
    extras?: any;
  };
  parser: GLTFParser;
  userData: any;
}

export interface GLTFParser {
  json: any;
  extensions: any;
  plugins: any;
  options: any;
  cache: any;
  associations: Map<any, any>;
  primitiveCache: any;
  meshCache: any;
  cameraCache: any;
  lightCache: any;
  sourceCache: any;
  textureCache: any;
  nodeNamesUsed: any;
  getDependency(type: string, index: number): Promise<any>;
  getDependencies(type: string): Promise<any[]>;
  loadBuffer(bufferIndex: number): Promise<ArrayBuffer>;
  loadBufferView(bufferViewIndex: number): Promise<ArrayBuffer>;
  loadAccessor(
    accessorIndex: number,
  ): Promise<THREE.BufferAttribute | THREE.InterleavedBufferAttribute>;
}

export class GLTFLoader extends THREE.Loader {
  constructor(manager?: THREE.LoadingManager);

  load(
    url: string,
    onLoad: (gltf: GLTF) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: Error) => void,
  ): void;

  loadAsync(
    url: string,
    onProgress?: (event: ProgressEvent) => void,
  ): Promise<GLTF>;

  parse(
    data: ArrayBuffer | string,
    path: string,
    onLoad: (gltf: GLTF) => void,
    onError?: (error: Error) => void,
  ): void;

  parseAsync(data: ArrayBuffer | string, path: string): Promise<GLTF>;

  setDRACOLoader(loader: any): GLTFLoader;
  setKTX2Loader(loader: any): GLTFLoader;
  setMeshoptDecoder(decoder: any): GLTFLoader;
  register(callback: (parser: GLTFParser) => any): GLTFLoader;
  unregister(callback: (parser: GLTFParser) => any): GLTFLoader;
}
