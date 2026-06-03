/**
 * Equirectangular Panorama Snapshot Utility (WebGPU)
 *
 * Captures a 360° panoramic view from the player's position and returns
 * it as a base64-encoded JPEG image.
 *
 * Uses WebGPU-compatible:
 * - THREE.CubeRenderTarget for cube map capture
 * - MeshBasicNodeMaterial with TSL for equirectangular projection
 * - Async readRenderTargetPixelsAsync for pixel reading
 */
window.snapshotEquirectangular = async function (playerData) {
  // THREE is already available via import maps in index.html
  const renderer = window.renderer;
  const scene = window.scene;

  const size = 1024;

  // Use CubeRenderTarget (works with WebGPU)
  const cubeRenderTarget = new THREE.CubeRenderTarget(size, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
  });

  const eye = new THREE.Vector3().fromArray(playerData.position);
  eye.y += 2;

  const cubeCamera = new THREE.CubeCamera(0.1, 1000, cubeRenderTarget);
  cubeCamera.position.copy(eye);
  cubeCamera.quaternion.set(...playerData.quaternion);

  // Update cube camera - use renderAsync if available (WebGPU)
  if (renderer.renderAsync) {
    // WebGPU path - need to update each face manually
    const faces = [THREE.CubeReflectionMapping];
    // CubeCamera.update works with both renderers
    cubeCamera.update(renderer, scene);
  } else {
    cubeCamera.update(renderer, scene);
  }

  const rtWidth = 2048;
  const rtHeight = 1024;

  // Use RenderTarget (works with WebGPU)
  const renderTarget = new THREE.RenderTarget(rtWidth, rtHeight, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
  });
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const sceneRTT = new THREE.Scene();

  // TSL-based equirectangular projection material
  // Uses MeshBasicNodeMaterial with cubeTexture sampling
  let material;

  if (THREE.MeshBasicNodeMaterial && THREE.TSL) {
    // WebGPU/TSL path
    const {
      Fn,
      uv,
      uniform,
      float,
      vec3,
      sin,
      cos,
      mul,
      sub,
      PI,
      cubeTexture,
    } = THREE.TSL;

    material = new THREE.MeshBasicNodeMaterial();
    const uEnvMap = uniform(cubeRenderTarget.texture);

    material.colorNode = Fn(() => {
      const uvCoord = uv();
      // Flip U for correct orientation
      const flippedU = sub(float(1.0), uvCoord.x);
      // Convert UV to spherical direction
      const theta = mul(flippedU, mul(float(2.0), PI));
      const phi = mul(uvCoord.y, PI);
      // Spherical to Cartesian
      const dir = vec3(
        mul(sin(theta), sin(phi)),
        cos(phi),
        mul(cos(theta), sin(phi)),
      );
      return cubeTexture(uEnvMap, dir);
    })();
  } else {
    // Fallback: Use a simple material with manual cube sampling
    // This shouldn't happen in WebGPU context, but provides graceful degradation
    console.warn(
      "[snapshotEquirectangular] TSL not available, using basic material",
    );
    material = new THREE.MeshBasicMaterial({
      envMap: cubeRenderTarget.texture,
      side: THREE.DoubleSide,
    });
  }

  const plane = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(plane, material);
  sceneRTT.add(quad);

  renderer.setRenderTarget(renderTarget);

  // Use async render if available (WebGPU)
  if (renderer.renderAsync) {
    await renderer.renderAsync(sceneRTT, camera);
  } else {
    renderer.render(sceneRTT, camera);
  }

  renderer.setRenderTarget(null);

  // Read pixels - use async method for WebGPU
  let pixels;
  if (renderer.readRenderTargetPixelsAsync) {
    pixels = await renderer.readRenderTargetPixelsAsync(
      renderTarget,
      0,
      0,
      rtWidth,
      rtHeight,
    );
    // Convert to Uint8Array if needed (WebGPU might return different type)
    if (!(pixels instanceof Uint8Array)) {
      const uint8Pixels = new Uint8Array(rtWidth * rtHeight * 4);
      if (pixels instanceof Float32Array) {
        for (let i = 0; i < pixels.length; i++) {
          uint8Pixels[i] = Math.min(
            255,
            Math.max(0, Math.round(pixels[i] * 255)),
          );
        }
      } else {
        uint8Pixels.set(pixels);
      }
      pixels = uint8Pixels;
    }
  } else {
    // Fallback to sync method (WebGL)
    pixels = new Uint8Array(rtWidth * rtHeight * 4);
    renderer.readRenderTargetPixels(
      renderTarget,
      0,
      0,
      rtWidth,
      rtHeight,
      pixels,
    );
  }

  // Create canvas and flip Y (WebGL/WebGPU renders upside down)
  const canvas = document.createElement("canvas");
  canvas.width = rtWidth;
  canvas.height = rtHeight;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(rtWidth, rtHeight);

  // Flip Y axis
  for (let y = 0; y < rtHeight; y++) {
    for (let x = 0; x < rtWidth; x++) {
      const srcIdx = ((rtHeight - y - 1) * rtWidth + x) * 4;
      const dstIdx = (y * rtWidth + x) * 4;
      imageData.data[dstIdx] = pixels[srcIdx];
      imageData.data[dstIdx + 1] = pixels[srcIdx + 1];
      imageData.data[dstIdx + 2] = pixels[srcIdx + 2];
      imageData.data[dstIdx + 3] = pixels[srcIdx + 3];
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Cleanup
  cubeRenderTarget.dispose();
  renderTarget.dispose();
  material.dispose();
  plane.dispose();

  return canvas.toDataURL("image/jpeg").split(",")[1];
};
