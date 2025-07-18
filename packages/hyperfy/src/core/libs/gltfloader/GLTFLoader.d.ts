export class GLTFLoader extends Loader<any, string> {
    constructor(manager: any);
    dracoLoader: any;
    ktx2Loader: any;
    meshoptDecoder: any;
    pluginCallbacks: any[];
    load(url: any, onLoad: any, onProgress: any, onError: any): void;
    setDRACOLoader(dracoLoader: any): this;
    setKTX2Loader(ktx2Loader: any): this;
    setMeshoptDecoder(meshoptDecoder: any): this;
    register(callback: any): this;
    unregister(callback: any): this;
    parse(data: any, path: any, onLoad: any, onError: any): void;
    parseAsync(data: any, path: any): Promise<any>;
}
import { Loader } from 'three';
