import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface ThreeSceneConfig {
  backgroundColor?: number;
  enableShadows?: boolean;
  enableGrid?: boolean;
  cameraPosition?: [number, number, number];
  cameraTarget?: [number, number, number];
}

export interface ThreeSceneRefs {
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  renderer: THREE.WebGLRenderer | null;
  orbitControls: OrbitControls | null;
}

export function useThreeScene(
  containerRef: React.RefObject<HTMLDivElement>,
  config: ThreeSceneConfig = {},
) {
  const [isInitialized, setIsInitialized] = useState(false);
  const refs = useRef<ThreeSceneRefs>({
    scene: null,
    camera: null,
    renderer: null,
    orbitControls: null,
  });

  // Animation frame reference
  const frameIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const containerEl = containerRef.current;
    if (!containerEl) return;

    const {
      backgroundColor = 0x1a1a1a,
      enableShadows = true,
      enableGrid = true,
      cameraPosition = [1.5, 1.2, 1.5],
      cameraTarget = [0, 0.8, 0],
    } = config;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    refs.current.scene = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      containerEl.clientWidth / containerEl.clientHeight,
      0.1,
      1000,
    );
    camera.position.set(...cameraPosition);
    camera.lookAt(...cameraTarget);
    refs.current.camera = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(containerEl.clientWidth, containerEl.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;

    if (enableShadows) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    containerEl.appendChild(renderer.domElement);
    refs.current.renderer = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = enableShadows;
    if (enableShadows) {
      directionalLight.shadow.camera.near = 0.1;
      directionalLight.shadow.camera.far = 50;
      directionalLight.shadow.camera.left = -10;
      directionalLight.shadow.camera.right = 10;
      directionalLight.shadow.camera.top = 10;
      directionalLight.shadow.camera.bottom = -10;
    }
    scene.add(directionalLight);

    // Orbit controls
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.target.set(...cameraTarget);
    orbitControls.update();
    refs.current.orbitControls = orbitControls;

    // Optional grid
    if (enableGrid) {
      const gridHelper = new THREE.GridHelper(10, 10);
      scene.add(gridHelper);

      // Ground plane
      const groundGeometry = new THREE.PlaneGeometry(20, 20);
      const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x444444,
        roughness: 0.8,
        metalness: 0.2,
      });
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = 0;
      ground.receiveShadow = true;
      scene.add(ground);
    }

    setIsInitialized(true);

    // Animation loop
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);
      orbitControls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerEl) return;
      camera.aspect = containerEl.clientWidth / containerEl.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerEl.clientWidth, containerEl.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
      renderer.dispose();
      containerEl?.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]); // Only run once on mount

  return {
    isInitialized,
    scene: refs.current.scene,
    camera: refs.current.camera,
    renderer: refs.current.renderer,
    orbitControls: refs.current.orbitControls,
  };
}
