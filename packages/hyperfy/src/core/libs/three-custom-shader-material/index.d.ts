export { B as default };
declare class B extends T.Material {
    constructor({ baseMaterial: n, vertexShader: S, fragmentShader: h, uniforms: m, patchMap: I, cacheKey: f, ...r }: {
        [x: string]: any;
        baseMaterial: any;
        vertexShader: any;
        fragmentShader: any;
        uniforms: any;
        patchMap: any;
        cacheKey: any;
    });
    uniforms: any;
    vertexShader: any;
    fragmentShader: any;
    update({ fragmentShader: n, vertexShader: S, uniforms: h, cacheKey: m, patchMap: I }: {
        fragmentShader: any;
        vertexShader: any;
        uniforms: any;
        cacheKey: any;
        patchMap: any;
    }): void;
}
import * as T from 'three';
