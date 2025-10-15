window.snapshotEquirectangular = async function (playerData) {
  // THREE is already available via import maps in index.html
  const renderer = window.renderer;
  const scene = window.scene;

  const size = 1024;

  const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(size, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
  });

  const eye = new THREE.Vector3().fromArray(playerData.position);
  eye.y += 2;

  const cubeCamera = new THREE.CubeCamera(0.1, 1000, cubeRenderTarget);
  cubeCamera.position.copy(eye);
  cubeCamera.quaternion.set(...playerData.quaternion);
  cubeCamera.update(renderer, scene);

  const rtWidth = 2048;
  const rtHeight = 1024;

  const renderTarget = new THREE.WebGLRenderTarget(rtWidth, rtHeight);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const sceneRTT = new THREE.Scene();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      envMap: { value: cubeRenderTarget.texture },
      resolution: { value: new THREE.Vector2(rtWidth, rtHeight) },
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
    fragmentShader: `
        precision mediump float;
        uniform samplerCube envMap;
        varying vec2 vUv;
  
        const float PI = 3.14159265359;
  
        void main() {
          vec2 uv = vUv;
          uv.x = 1.0 - uv.x;
          float theta = uv.x * 2.0 * PI;
          float phi = uv.y * PI;
          vec3 dir = vec3(
            sin(theta) * sin(phi),
            cos(phi),
            cos(theta) * sin(phi)
          );
          gl_FragColor = textureCube(envMap, dir);
        }
      `,
  });

  const plane = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(plane, material);
  sceneRTT.add(quad);

  renderer.setRenderTarget(renderTarget);
  renderer.render(sceneRTT, camera);
  renderer.setRenderTarget(null);

  const pixels = new Uint8Array(rtWidth * rtHeight * 4);
  renderer.readRenderTargetPixels(
    renderTarget,
    0,
    0,
    rtWidth,
    rtHeight,
    pixels,
  );

  const canvas = document.createElement("canvas");
  canvas.width = rtWidth;
  canvas.height = rtHeight;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(rtWidth, rtHeight);
  imageData.data.set(pixels);
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL("image/jpeg").split(",")[1];
};
