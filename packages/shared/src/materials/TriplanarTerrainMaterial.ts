import THREE from "../extras/three/three";

export class TriplanarTerrainMaterial extends THREE.ShaderMaterial {
  constructor(
    diffuseAtlas: THREE.Texture,
    normalAtlas: THREE.Texture,
    noiseTexture: THREE.Texture,
    textureScales: number[],
  ) {
    console.log("[TriplanarTerrainMaterial] Creating material");

    super({
      uniforms: {
        uDiffMap: { value: diffuseAtlas },
        uNormalMap: { value: normalAtlas },
        uNoiseTexture: { value: noiseTexture },
        uTextureScales: { value: textureScales },
      },
      vertexShader: `
        attribute ivec4 materials;
        attribute vec4 materialsWeights;
        
        flat varying ivec4 vMaterials;
        varying vec4 vMaterialsWeights;
        varying vec3 vPosition;
        varying vec3 vNormal;
        
        void main() {
          vMaterials = materials;
          vMaterialsWeights = materialsWeights;
          vPosition = position;
          vNormal = normalize(normalMatrix * normal);
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        precision highp int;
        
        uniform sampler2D uDiffMap;
        uniform sampler2D uNormalMap;
        uniform sampler2D uNoiseTexture;
        uniform float uTextureScales[4];
        
        flat varying ivec4 vMaterials;
        varying vec4 vMaterialsWeights;
        varying vec3 vPosition;
        varying vec3 vNormal;
        
        const float TEXTURE_SCALE = 40.0;
        const float TEXTURE_PER_ROW = 2.0;
        const float TEXTURE_SIZE = 0.5;
        
        vec2 getSubTextureOffset(int textureIndex) {
          float ax = mod(float(textureIndex), TEXTURE_PER_ROW);
          float ay = floor(float(textureIndex) / TEXTURE_PER_ROW);
          return vec2(ax, ay) * TEXTURE_SIZE;
        }
        
        vec4 subTexture2D(sampler2D tex, vec2 tileUv, vec2 textureOffset) {
          vec2 subUv = fract(tileUv) * TEXTURE_SIZE + textureOffset;
          return texture2D(tex, subUv);
        }
        
        vec4 textureNoTile(sampler2D tex, int textureIndex, vec2 inputUv) {
          float UV_SCALE = uTextureScales[textureIndex];
          vec2 uv = inputUv * (1.0 / UV_SCALE);
          
          float k = texture2D(uNoiseTexture, 0.0025 * uv).x;
          float l = k * 8.0;
          float f = fract(l);
          
          float ia = floor(l + 0.5);
          float ib = floor(l);
          f = min(f, 1.0 - f) * 2.0;
          
          vec2 offa = fract(sin(vec2(ia * 30.0, ia * 7.0)) * 103.0);
          vec2 offb = fract(sin(vec2(ib * 30.0, ib * 7.0)) * 103.0);
          
          vec2 textureOffset = getSubTextureOffset(textureIndex);
          
          vec4 cola = subTexture2D(tex, uv + offa, textureOffset);
          vec4 colb = subTexture2D(tex, uv + offb, textureOffset);
          
          float sum = (cola.x + cola.y + cola.z) - (colb.x + colb.y + colb.z);
          return mix(cola, colb, smoothstep(0.2, 0.8, f - 0.1 * sum));
        }
        
        vec4 blendMaterials(sampler2D tex, vec2 uv) {
          vec4 samples[4];
          samples[0] = textureNoTile(tex, vMaterials.x, uv);
          samples[1] = textureNoTile(tex, vMaterials.y, uv);
          samples[2] = textureNoTile(tex, vMaterials.z, uv);
          samples[3] = textureNoTile(tex, vMaterials.w, uv);
          
          float weightSum = vMaterialsWeights.x + vMaterialsWeights.y + vMaterialsWeights.z + vMaterialsWeights.w;
          if(weightSum < 0.001) weightSum = 1.0;
          return (samples[0] * vMaterialsWeights.x + samples[1] * vMaterialsWeights.y + 
                  samples[2] * vMaterialsWeights.z + samples[3] * vMaterialsWeights.w) / weightSum;
        }
        
        void main() {
          vec2 textureUv = vPosition.xz * (1.0 / TEXTURE_SCALE);
          vec4 diffMapColor = blendMaterials(uDiffMap, textureUv);
          
          gl_FragColor = vec4(diffMapColor.rgb, 1.0);
        }
      `,
      side: THREE.FrontSide,
      transparent: false,
      depthWrite: true,
      depthTest: true,
    });
  }
}
