import { THREE, createRenderer, type WebGPURenderer } from "@hyperforge/shared";
import { ThreeResourceManager } from "@/lib/ThreeResourceManager";

export interface AvatarPreviewViewport {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: WebGPURenderer;
  resize: () => void;
  start: (onFrame?: (delta: number) => void) => void;
  stop: () => void;
  dispose: () => void;
}

export async function createAvatarPreviewViewport(options: {
  container: HTMLDivElement;
  canvas: HTMLCanvasElement;
  cameraPosition?: THREE.Vector3;
  fov?: number;
  adjustCameraDepth?: boolean;
}): Promise<AvatarPreviewViewport> {
  const {
    container,
    canvas,
    cameraPosition = new THREE.Vector3(0, 1.4, 3.0),
    fov = 30,
    adjustCameraDepth = true,
  } = options;

  const scene = new THREE.Scene();

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
  keyLight.position.set(1, 1, 1).normalize();
  scene.add(keyLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const camera = new THREE.PerspectiveCamera(
    fov,
    container.clientWidth / Math.max(container.clientHeight, 1),
    0.1,
    20,
  );
  camera.position.copy(cameraPosition);
  camera.layers.enableAll();

  const renderer = await createRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const baseAspect = 16 / 9;
  const baseCameraZ = cameraPosition.z;

  const resize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (width <= 0 || height <= 0) {
      return;
    }

    const aspect = width / height;
    camera.aspect = aspect;

    if (adjustCameraDepth && aspect < baseAspect) {
      const zoomFactor = baseAspect / aspect;
      camera.position.z = baseCameraZ * Math.min(zoomFactor, 1.5);
    } else if (adjustCameraDepth) {
      camera.position.z = baseCameraZ;
    }

    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };

  let lastTime = 0;
  let frameId = 0;
  let frameCallback: ((delta: number) => void) | undefined;

  const renderFrame = () => {
    frameId = window.requestAnimationFrame(renderFrame);
    const time = performance.now();
    const delta = lastTime === 0 ? 0 : (time - lastTime) / 1000;
    lastTime = time;
    frameCallback?.(delta);
    renderer.render(scene, camera);
  };

  const stop = () => {
    if (frameId) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }
  };

  const start = (onFrame?: (delta: number) => void) => {
    frameCallback = onFrame;
    stop();
    lastTime = performance.now();
    renderFrame();
  };

  const dispose = () => {
    stop();
    ThreeResourceManager.disposeObject(keyLight, {
      removeFromParent: true,
    });
    ThreeResourceManager.disposeObject(ambientLight, {
      removeFromParent: true,
    });
    ThreeResourceManager.disposeRenderer(renderer);
    ThreeResourceManager.disposeScene(scene);
  };

  resize();

  return {
    scene,
    camera,
    renderer,
    resize,
    start,
    stop,
    dispose,
  };
}
