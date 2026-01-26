import { GAME_WS_URL, CDN_URL } from "@/lib/api-config";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  THREE,
  createClientWorld,
  EventType,
  System,
} from "@hyperscape/shared";
import { World } from "@hyperscape/shared";
import { CoreUI } from "../game/CoreUI";

export { System };

interface GameClientProps {
  wsUrl?: string;
  onSetup?: (world: InstanceType<typeof World>, config: unknown) => void;
}

export function GameClient({ wsUrl, onSetup }: GameClientProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const uiRef = useRef<HTMLDivElement>(null);

  // Detect HMR and force full page reload instead of hot reload
  useEffect(() => {
    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        window.location.reload();
      });
    }
  }, []);

  // Create world immediately so network can connect and deliver characterList
  const world = useMemo(() => {
    const w = createClientWorld();

    // Expose world for browser debugging
    (window as { world: InstanceType<typeof World> }).world = w;

    // Install simple debug commands
    const debugWindow = window as typeof window & {
      debug?: {
        seeHighEntities: () => void;
        seeGround: () => void;
        mobs: () => Array<{
          name: string;
          position: number[];
          hasMesh: boolean;
          meshVisible: boolean;
        }>;
      };
    };
    debugWindow.debug = {
      // Teleport camera to see mobs at Y=40+
      seeHighEntities: () => {
        if (w.camera) {
          w.camera.position.set(10, 50, 10);
          w.camera.lookAt(0, 40, 0);
        }
      },
      // Teleport to ground level
      seeGround: () => {
        if (w.camera) {
          w.camera.position.set(10, 5, 10);
          w.camera.lookAt(0, 0, 0);
        }
      },
      // List all mobs with positions
      mobs: () => {
        type EntityWithNode = {
          type: string;
          name: string;
          node: { position: { toArray: () => number[] } };
          mesh?: { visible: boolean };
        };
        type EntityManagerType = {
          getAllEntities?: () => Map<string, EntityWithNode>;
        };

        const entityManager = w.getSystem(
          "entity-manager",
        ) as EntityManagerType | null;
        const mobs: Array<{
          name: string;
          position: number[];
          hasMesh: boolean;
          meshVisible: boolean;
        }> = [];

        if (entityManager?.getAllEntities) {
          for (const [_id, entity] of entityManager.getAllEntities()) {
            if (entity.type === "mob") {
              mobs.push({
                name: entity.name,
                position: entity.node.position.toArray(),
                hasMesh: !!entity.mesh,
                meshVisible: entity.mesh?.visible ?? false,
              });
            }
          }
        }
        console.table(mobs);
        return mobs;
      },
    };

    return w;
  }, []);
  const defaultUI = { visible: true, active: false, app: null, pane: null };
  const [ui, setUI] = useState(defaultUI);
  useEffect(() => {
    const handleUI = (data: unknown) => {
      setUI(
        data as { visible: boolean; active: boolean; app: null; pane: null },
      );
    };
    world.on(EventType.UI_UPDATE, handleUI, undefined);
    return () => {
      world.off(EventType.UI_UPDATE, handleUI, undefined, undefined);
    };
  }, [world]);

  // Handle window resize to update Three.js canvas
  useEffect(() => {
    const handleResize = () => {
      const viewport = viewportRef.current;
      const graphics = world.getSystem("graphics") as {
        resize?: (width: number, height: number) => void;
      } | null;
      if (viewport && graphics?.resize) {
        const width = viewport.offsetWidth;
        const height = viewport.offsetHeight;
        graphics.resize(width, height);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [world]);

  // Handle WebGL context loss/restoration
  // This can happen when GPU resources are exhausted or driver issues occur
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    // Find the canvas element (created by Three.js renderer)
    const canvas = viewport.querySelector("canvas");
    if (!canvas) return;

    const handleContextLost = (event: Event) => {
      event.preventDefault(); // Allows context to be restored
      console.warn(
        "[GameClient] WebGL context lost - GPU resources exhausted or driver issue",
      );
      // The Three.js renderer will attempt to restore automatically
      // User will see frozen frame until restored
    };

    const handleContextRestored = () => {
      console.info("[GameClient] WebGL context restored - resuming rendering");
      // Three.js handles re-initialization automatically
      // Force a resize to ensure proper viewport dimensions
      const graphics = world.getSystem("graphics") as {
        resize?: (width: number, height: number) => void;
      } | null;
      if (graphics?.resize) {
        graphics.resize(viewport.offsetWidth, viewport.offsetHeight);
      }
    };

    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);

    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
    };
  }, [world]);

  useEffect(() => {
    let cleanedUp = false;

    const init = async () => {
      const viewport = viewportRef.current;
      const ui = uiRef.current;

      if (!viewport || !ui) {
        return;
      }

      const baseEnvironment = {
        model: "asset://world/base-environment.glb",
        bg: "asset://world/day2-2k.jpg",
        hdr: "asset://world/day2.hdr",
        sunDirection: new THREE.Vector3(-1, -2, -2).normalize(),
        sunIntensity: 1,
        sunColor: 0xffffff,
        fogNear: null,
        fogFar: null,
        fogColor: null,
      };

      // Direct connection - no Vite proxy
      // Default to game server on 5555, CDN on 8080
      const finalWsUrl = wsUrl || import.meta.env.PUBLIC_WS_URL || GAME_WS_URL;

      // Always use absolute CDN URL for all assets
      const assetsUrl = `${CDN_URL}/`;

      // Make CDN URL available globally for PhysX loading
      (window as Window & { __CDN_URL?: string }).__CDN_URL = CDN_URL;

      const config = {
        viewport,
        ui,
        wsUrl: finalWsUrl,
        baseEnvironment,
        assetsUrl, // This will be overridden by server snapshot
      };

      // Call onSetup if provided
      if (onSetup) {
        onSetup(world, config);
      }

      // Ensure RPG systems are registered before initializing the world
      await world.systemsLoadedPromise;

      await world.init(config);
    };

    init();

    // Cleanup function
    return () => {
      if (!cleanedUp) {
        cleanedUp = true;
        // Destroy the world to cleanup WebSocket and resources
        world.destroy();
      }
    };
  }, [world, wsUrl, onSetup]);

  return (
    <div className="App absolute top-0 left-0 right-0 h-screen">
      <style>{`
        .App__viewport {
          position: fixed;
          overflow: hidden;
          width: 100%;
          height: 100%;
          inset: 0;
        }
        .App__ui {
          position: absolute;
          inset: 0;
          pointer-events: none;
          user-select: none;
          display: ${ui.visible ? "block" : "block"};
          overflow: hidden;
          z-index: 10;
        }
      `}</style>
      <div
        id="game-canvas"
        className="App__viewport"
        ref={viewportRef}
        data-component="viewport"
        aria-label="Game Canvas"
        role="application"
      >
        <div className="App__ui" ref={uiRef} data-component="ui">
          <CoreUI world={world} />
        </div>
      </div>
    </div>
  );
}
