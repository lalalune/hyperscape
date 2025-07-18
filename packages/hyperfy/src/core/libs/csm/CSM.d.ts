export class CSM {
    constructor(data: any);
    mainFrustum: CSMFrustum;
    frustums: any[];
    breaks: any[];
    lights: any[];
    shaders: Map<any, any>;
    camera: any;
    parent: any;
    cascades: any;
    maxCascades: any;
    maxFar: any;
    mode: any;
    practicalModeLambda: any;
    shadowMapSize: any;
    shadowBias: any;
    shadowNormalBias: any;
    lightDirection: any;
    lightDirectionUp: any;
    lightIntensity: any;
    lightColor: any;
    lightMargin: any;
    fade: any;
    noLastCascadeCutOff: any;
    customSplitsCallback: any;
    createLights(): void;
    initCascades(): void;
    updateShadowBounds(): void;
    updateBreaks(): void;
    update(): void;
    injectInclude(): void;
    setupMaterial(material: any): void;
    updateUniforms(): void;
    getExtendedBreaks(): three.Vector2[];
    updateFrustums(): void;
    updateCascades(cascades: any): void;
    updateShadowMapSize(size: any): void;
    dispose(): void;
}
export namespace CSM {
    export { CSMHelper as Helper };
}
declare class CSMFrustum {
    constructor(data?: {});
    vertices: any;
    setFromProjectionMatrix(projectionMatrix: any, maxFar: any): any;
    split(breaks: any, target: any): void;
    toSpace(cameraMatrix: any, target: any): void;
}
import * as three from 'three';
declare class CSMHelper extends three.Group<three.Object3DEventMap> {
    constructor(csm: any);
    displayFrustum: boolean;
    displayPlanes: boolean;
    displayShadowBounds: boolean;
    cascadeLines: any[];
    cascadePlanes: any[];
    shadowLines: any[];
    csm: any;
    frustumLines: three.LineSegments<three.BufferGeometry<three.NormalBufferAttributes>, three.LineBasicMaterial, three.Object3DEventMap>;
    updateVisibility(): void;
    update(): void;
}
export {};
