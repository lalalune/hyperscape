import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  attachEquipmentVisualToVRM,
  Emotes,
  EventType,
  resolveEquipmentVisualData,
  resolveEquipmentVisualUrls,
  removeEquipmentVisual,
  type EquipmentVisualStore,
  THREE,
} from "@hyperforge/shared";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { VRM } from "@pixiv/three-vrm";
import { useThemeStore } from "@/ui";
import { getPanelInsetStyle } from "@/ui/theme/themes";
import { ThreeResourceManager } from "@/lib/ThreeResourceManager";
import { createAvatarPreviewViewport } from "@/game/character/avatarPreviewViewport";
import type { ClientWorld, PlayerEquipmentItems } from "../../../types";

type PortraitMode = "loading" | "live" | "fallback";

interface EquipmentPaperdollPortraitProps {
  world?: ClientWorld;
  equipment?: PlayerEquipmentItems | null;
  className?: string;
  equipmentSignature?: string;
  compact?: boolean;
  layoutVariant?: "default" | "bank";
  isVisible?: boolean;
}

interface PreviewAvatarScene {
  scene?: THREE.Object3D & {
    visible?: boolean;
    userData?: {
      vrm?: VRM;
    };
  };
  userData?: {
    vrm?: VRM;
  };
}

interface PreviewAvatarInstance {
  destroy(): void;
  update(delta: number): void;
  raw: PreviewAvatarScene;
  disableRateCheck?: () => void;
  setEmote?: (emote: string) => void;
  setEmoteAndWait?: (emote: string, timeoutMs?: number) => Promise<void>;
}

interface PreviewAvatarNode {
  instance: PreviewAvatarInstance | null;
  mount?: () => Promise<void>;
  position: THREE.Vector3;
  visible: boolean;
  parent: { matrixWorld: THREE.Matrix4 };
  activate(ctx: ClientWorld): void;
  deactivate?: () => void;
}

interface PlayerWithAvatarUrl {
  getAvatarUrl?: () => string;
  data?: {
    sessionAvatar?: unknown;
    avatar?: unknown;
  };
}

const previewEquipmentParser = new GLTFLoader();
previewEquipmentParser.setMeshoptDecoder(MeshoptDecoder);

const previewEquipmentCache = new Map<string, GLTF>();

const PREVIEW_EQUIPMENT_SLOTS: Array<{
  slot: string;
  item: keyof PlayerEquipmentItems;
}> = [
  { slot: "helmet", item: "helmet" },
  { slot: "body", item: "body" },
  { slot: "legs", item: "legs" },
  { slot: "boots", item: "boots" },
  { slot: "gloves", item: "gloves" },
  { slot: "cape", item: "cape" },
  { slot: "amulet", item: "amulet" },
  { slot: "ring", item: "ring" },
  { slot: "weapon", item: "weapon" },
  { slot: "shield", item: "shield" },
  { slot: "arrows", item: "arrows" },
];

function resolvePlayerAvatarUrl(world?: ClientWorld): string | null {
  const player = (world?.entities?.player ??
    world?.getPlayer?.()) as PlayerWithAvatarUrl | null;

  if (!player) {
    return null;
  }

  if (typeof player.getAvatarUrl === "function") {
    return player.getAvatarUrl();
  }

  const sessionAvatar = player.data?.sessionAvatar;
  if (typeof sessionAvatar === "string" && sessionAvatar.length > 0) {
    return sessionAvatar;
  }

  const avatar = player.data?.avatar;
  if (typeof avatar === "string" && avatar.length > 0) {
    return avatar;
  }

  return null;
}

function getPreviewVRM(instance: PreviewAvatarInstance | null): VRM | null {
  if (!instance?.raw) {
    return null;
  }

  const rawScene = instance.raw.scene;
  const fromUserData = rawScene?.userData?.vrm ?? instance.raw.userData?.vrm;
  if (fromUserData?.scene && fromUserData.humanoid) {
    return fromUserData;
  }

  const rawCandidate = instance.raw as unknown as VRM;
  if (rawCandidate.scene && rawCandidate.humanoid) {
    return rawCandidate;
  }

  return null;
}

function clearPreviewVisuals(visuals: EquipmentVisualStore): void {
  Object.keys(visuals).forEach((slot) => removeEquipmentVisual(visuals, slot));
}

function framePortraitAvatar(
  avatarRoot: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  zoomMultiplier = 1.0,
  fitDistanceMultiplier = 1.0,
  centerBiasX = 0,
  baseStateRef?: React.MutableRefObject<{
    camY: number;
    lookY: number;
    distance: number;
    center: THREE.Vector3;
  } | null>,
) {
  if (baseStateRef?.current) {
    const { camY, lookY, distance, center } = baseStateRef.current;
    const currentDistance =
      (distance * fitDistanceMultiplier) / Math.max(0.1, zoomMultiplier);
    camera.position.set(center.x, camY, -currentDistance);
    camera.lookAt(center.x, lookY, center.z);
    return;
  }

  avatarRoot.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(avatarRoot);
  if (box.isEmpty()) {
    camera.position.set(0, 1.15, 2.7);
    camera.lookAt(0, 1.05, 0);
    return;
  }

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const height = Math.max(size.y, 1.6);
  const width = Math.max(size.x, 0.7);
  center.x += width * centerBiasX;
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const effectiveAspect = Math.max(camera.aspect, 0.25);
  const horizontalFov =
    2 * Math.atan(Math.tan(verticalFov / 2) * effectiveAspect);
  const verticalDistance = (height * 0.5) / Math.tan(verticalFov / 2);
  const horizontalDistance = (width * 0.5) / Math.tan(horizontalFov / 2);

  // Add a little breathing room so narrow portrait panels do not clip shoulders or weapons.
  const distance = Math.max(3.2, verticalDistance, horizontalDistance) * 1.22;

  // Look slightly higher to push the avatar down in the viewport
  const lookY = center.y + height * 0.02;

  // Keep camera vertically offset relatively the same angle
  const camY = lookY + height * 0.6;

  if (baseStateRef) {
    baseStateRef.current = { camY, lookY, distance, center: center.clone() };
  }

  const currentDistance =
    (distance * fitDistanceMultiplier) / Math.max(0.1, zoomMultiplier);

  camera.position.set(center.x, camY, -currentDistance);
  camera.lookAt(center.x, lookY, center.z);
  camera.near = 0.1;
  camera.far = Math.max(12, currentDistance + height * 3);
  camera.updateProjectionMatrix();
}

async function loadPreviewEquipmentVisuals(options: {
  world: ClientWorld;
  equipment: PlayerEquipmentItems | null | undefined;
  vrm: VRM;
  avatarRoot: THREE.Object3D;
  visuals: EquipmentVisualStore;
}): Promise<void> {
  const { world, equipment, vrm, avatarRoot, visuals } = options;
  const assetsUrl = world.assetsUrl?.replace(/\/$/, "") || "";

  for (const entry of PREVIEW_EQUIPMENT_SLOTS) {
    const equippedItem = equipment?.[entry.item];
    if (!equippedItem?.id) {
      continue;
    }

    const itemData = resolveEquipmentVisualData({
      itemId: equippedItem.id,
    });
    const urls = resolveEquipmentVisualUrls({
      assetsUrl,
      itemId: equippedItem.id,
      slot: entry.slot,
      itemData,
    });

    if (!urls) {
      continue;
    }

    let gltf = previewEquipmentCache.get(equippedItem.id);
    if (!gltf) {
      let file: File | undefined;
      let resolvedUrl = urls.primaryUrl;

      try {
        file = world.loader
          ? await world.loader.loadFile(urls.primaryUrl)
          : undefined;
      } catch (error) {
        if (urls.fallbackUrl) {
          file = world.loader
            ? await world.loader.loadFile(urls.fallbackUrl)
            : undefined;
          resolvedUrl = urls.fallbackUrl;
        } else {
          throw error;
        }
      }

      if (!file) {
        continue;
      }

      const buffer = await file.arrayBuffer();
      gltf = (await previewEquipmentParser.parseAsync(
        buffer,
        resolvedUrl,
      )) as GLTF;
      previewEquipmentCache.set(equippedItem.id, gltf);
    }

    const modelRoot = gltf.scene.clone(true);
    attachEquipmentVisualToVRM({
      slot: entry.slot,
      modelRoot,
      visuals,
      vrm,
      avatarRoot,
    });
  }
}

function PortraitFallback({
  compact,
  mode,
}: {
  compact: boolean;
  mode: PortraitMode;
}) {
  const theme = useThemeStore((s) => s.theme);
  const isLoading = mode === "loading";

  return (
    <div
      data-portrait-fallback="true"
      className="absolute inset-0 flex items-center justify-center"
      style={{
        opacity: isLoading ? 0.9 : 1,
        transition: "opacity 160ms ease",
      }}
    >
      <div
        className="relative flex items-center justify-center"
        style={{
          width: compact ? "84%" : "82%",
          height: compact ? "96%" : "97%",
          borderRadius: compact ? 16 : 20,
          ...getPanelInsetStyle(theme, {
            emphasis: "strong",
            radius: compact ? 16 : 20,
          }),
          padding: 0,
          background:
            theme.name === "hyperia"
              ? "radial-gradient(circle at 50% 12%, rgba(190, 165, 123, 0.12), transparent 54%), linear-gradient(180deg, rgba(30, 35, 42, 0.95) 0%, rgba(18, 21, 26, 0.98) 100%)"
              : undefined,
        }}
      >
        <div
          className="absolute inset-x-[10%] bottom-[6%] top-[5%]"
          style={{
            borderRadius: compact ? 16 : 22,
            border: `1px solid ${theme.colors.border.default}55`,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.12) 100%)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -16px 24px rgba(0,0,0,0.18)",
          }}
        />

        {isLoading ? (
          <>
            <div
              className="absolute inset-x-[22%] top-[16%] h-[20%] rounded-full"
              style={{
                background: `radial-gradient(circle at center, ${theme.colors.accent.primary}18 0%, transparent 74%)`,
              }}
            />
            <div
              className="absolute inset-x-[18%] bottom-[12%] top-[24%] rounded-[20px]"
              style={{
                border: `1px dashed ${theme.colors.border.hover}`,
                opacity: 0.5,
              }}
            />
          </>
        ) : (
          <>
            <div
              className="absolute rounded-full"
              style={{
                width: compact ? 34 : 42,
                height: compact ? 34 : 42,
                top: compact ? "8%" : "7%",
                background:
                  "linear-gradient(180deg, rgba(224, 197, 143, 0.95), rgba(154, 118, 71, 0.95))",
                boxShadow: "0 10px 18px rgba(0,0,0,0.22)",
              }}
            />
            <div
              className="absolute rounded-[24px]"
              style={{
                width: compact ? 46 : 56,
                height: compact ? 82 : 106,
                top: compact ? "20%" : "19%",
                background:
                  "linear-gradient(180deg, rgba(72, 105, 63, 0.95), rgba(44, 68, 42, 0.98))",
                boxShadow: "0 12px 20px rgba(0,0,0,0.22)",
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                width: compact ? 14 : 18,
                height: compact ? 72 : 88,
                left: compact ? "25%" : "24%",
                top: compact ? "25%" : "24%",
                transform: "rotate(10deg)",
                background:
                  "linear-gradient(180deg, rgba(210, 171, 130, 0.9), rgba(154, 112, 83, 0.96))",
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                width: compact ? 14 : 18,
                height: compact ? 72 : 88,
                right: compact ? "25%" : "24%",
                top: compact ? "25%" : "24%",
                transform: "rotate(-10deg)",
                background:
                  "linear-gradient(180deg, rgba(210, 171, 130, 0.9), rgba(154, 112, 83, 0.96))",
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                width: compact ? 16 : 20,
                height: compact ? 96 : 118,
                left: compact ? "40%" : "39%",
                bottom: compact ? "8%" : "6%",
                background:
                  "linear-gradient(180deg, rgba(44, 59, 85, 0.95), rgba(24, 34, 52, 0.98))",
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                width: compact ? 16 : 20,
                height: compact ? 96 : 118,
                right: compact ? "40%" : "39%",
                bottom: compact ? "8%" : "6%",
                background:
                  "linear-gradient(180deg, rgba(44, 59, 85, 0.95), rgba(24, 34, 52, 0.98))",
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

export const EquipmentPaperdollPortrait = React.memo(
  function EquipmentPaperdollPortrait({
    world,
    equipment,
    className = "",
    equipmentSignature = "",
    compact = false,
    layoutVariant = "default",
    isVisible = true,
  }: EquipmentPaperdollPortraitProps) {
    const theme = useThemeStore((s) => s.theme);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<Awaited<
      ReturnType<typeof createAvatarPreviewViewport>
    > | null>(null);
    const avatarNodeRef = useRef<PreviewAvatarNode | null>(null);
    const avatarSceneRef = useRef<THREE.Object3D | null>(null);
    const previewVisualsRef = useRef<EquipmentVisualStore>({});
    const [rendererReady, setRendererReady] = useState(false);
    const [mode, setMode] = useState<PortraitMode>("loading");
    const [refreshNonce, setRefreshNonce] = useState(0);

    const isDraggingRef = useRef(false);
    const lastMousePosRef = useRef({ x: 0, y: 0 });
    const targetRotationRef = useRef(Math.PI * 0.08);
    const currentRotationRef = useRef(Math.PI * 0.08);
    const targetZoomRef = useRef(1);
    const currentZoomRef = useRef(1);
    const baseCameraStateRef = useRef<{
      camY: number;
      lookY: number;
      distance: number;
      center: THREE.Vector3;
    } | null>(null);

    const avatarUrl = useMemo(
      () => resolvePlayerAvatarUrl(world),
      [world, refreshNonce],
    );

    const signature = useMemo(
      () =>
        `${avatarUrl ?? "no-avatar"}|${equipmentSignature}|${compact ? "compact" : "full"}|${layoutVariant}`,
      [avatarUrl, compact, equipmentSignature, layoutVariant],
    );
    const fitDistanceMultiplier = layoutVariant === "bank" ? 1 : 1.03;
    const centerBiasX = 0;

    const clearPreviewAvatar = () => {
      clearPreviewVisuals(previewVisualsRef.current);
      previewVisualsRef.current = {};

      const avatarScene = avatarSceneRef.current;
      const avatarNode = avatarNodeRef.current;

      avatarNode?.deactivate?.();

      if (avatarScene) {
        ThreeResourceManager.disposeObject(avatarScene, {
          disposeGeometry: false,
          disposeTextures: false,
          disposeMaterial: true,
          removeFromParent: false,
        });
      }

      avatarSceneRef.current = null;
      avatarNodeRef.current = null;
      baseCameraStateRef.current = null;
    };

    useEffect(() => {
      const container = containerRef.current;
      const canvas = canvasRef.current;

      if (!container || !canvas) {
        return;
      }

      let cancelled = false;
      let resizeObserver: ResizeObserver | null = null;
      let resizeHandler: (() => void) | null = null;

      createAvatarPreviewViewport({
        container,
        canvas,
        cameraPosition: new THREE.Vector3(0, 1.32, 2.95),
        adjustCameraDepth: false,
      })
        .then((viewport) => {
          if (cancelled) {
            viewport.dispose();
            return;
          }

          viewportRef.current = viewport;
          const handleViewportResize = () => {
            viewport.resize();

            if (avatarSceneRef.current) {
              baseCameraStateRef.current = null;
              framePortraitAvatar(
                avatarSceneRef.current,
                viewport.camera,
                currentZoomRef.current,
                fitDistanceMultiplier,
                centerBiasX,
                baseCameraStateRef,
              );
            }
          };
          resizeHandler = handleViewportResize;

          viewport.start((delta) => {
            avatarNodeRef.current?.instance?.update(delta);

            const rDiff =
              targetRotationRef.current - currentRotationRef.current;
            const zDiff = targetZoomRef.current - currentZoomRef.current;

            if (Math.abs(rDiff) > 0.001 || Math.abs(zDiff) > 0.001) {
              currentRotationRef.current += rDiff * Math.min(1.0, delta * 15);
              currentZoomRef.current += zDiff * Math.min(1.0, delta * 15);

              const vrm = getPreviewVRM(
                avatarNodeRef.current?.instance ?? null,
              );
              if (vrm && avatarSceneRef.current) {
                avatarSceneRef.current.rotation.y = currentRotationRef.current;
                vrm.scene.rotation.y = currentRotationRef.current;
                framePortraitAvatar(
                  avatarSceneRef.current,
                  viewport.camera,
                  currentZoomRef.current,
                  fitDistanceMultiplier,
                  centerBiasX,
                  baseCameraStateRef,
                );
              }
            }
          });
          setRendererReady(true);

          if (typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver(handleViewportResize);
            resizeObserver.observe(container);
          } else {
            window.addEventListener("resize", handleViewportResize);
          }
        })
        .catch((error) => {
          console.error(
            "[EquipmentPaperdollPortrait] Failed to initialize preview viewport:",
            error,
          );
          if (!cancelled) {
            setMode("fallback");
            setRendererReady(false);
          }
        });

      return () => {
        cancelled = true;
        resizeObserver?.disconnect();
        if (resizeHandler) {
          window.removeEventListener("resize", resizeHandler);
        }
        clearPreviewAvatar();
        viewportRef.current?.dispose();
        viewportRef.current = null;
        setRendererReady(false);
      };
    }, []);

    useEffect(() => {
      if (!world) {
        setMode("loading");
        return;
      }

      const triggerRefresh = () => setRefreshNonce((current) => current + 1);
      triggerRefresh();

      world.on(EventType.AVATAR_LOAD_COMPLETE, triggerRefresh, undefined);

      return () => {
        world.off(
          EventType.AVATAR_LOAD_COMPLETE,
          triggerRefresh,
          undefined,
          undefined,
        );
      };
    }, [equipmentSignature, world]);

    useEffect(() => {
      if (!world || !rendererReady || !viewportRef.current) {
        return;
      }

      let cancelled = false;

      const buildPortrait = async () => {
        const viewport = viewportRef.current;
        setMode("loading");
        clearPreviewAvatar();

        if (!avatarUrl) {
          setMode("fallback");
          return;
        }

        if (!world.loader || !viewport) {
          setMode("loading");
          return;
        }

        try {
          const loadedAvatar = (await world.loader.load(
            "avatar",
            avatarUrl,
          )) as {
            toNodes: (
              customHooks?: Record<string, unknown>,
            ) => Map<string, unknown>;
          };

          if (cancelled) {
            return;
          }

          const avatarNode = loadedAvatar
            .toNodes({
              scene: viewport.scene,
              loader: world.loader,
            })
            .get("avatar") as PreviewAvatarNode | undefined;

          if (!avatarNode) {
            setMode("fallback");
            return;
          }

          avatarNode.parent = { matrixWorld: new THREE.Matrix4() };
          avatarNode.position.set(0, 0, 0);
          avatarNode.activate(world);
          await avatarNode.mount?.();

          if (cancelled) {
            avatarNode.deactivate?.();
            return;
          }

          const avatarInstance = avatarNode.instance;
          const avatarScene = avatarInstance?.raw?.scene;
          const vrm = getPreviewVRM(avatarInstance ?? null);

          if (!avatarInstance || !avatarScene || !vrm) {
            avatarNode.deactivate?.();
            setMode("fallback");
            return;
          }

          avatarNodeRef.current = avatarNode;
          avatarSceneRef.current = avatarScene;
          avatarInstance.disableRateCheck?.();

          avatarNode.visible = false;
          avatarScene.visible = false;
          avatarScene.rotation.y = currentRotationRef.current;
          vrm.scene.rotation.y = currentRotationRef.current;

          if (avatarInstance.setEmoteAndWait) {
            await avatarInstance.setEmoteAndWait(Emotes.IDLE, 3000);
          } else {
            avatarInstance.setEmote?.(Emotes.IDLE);
          }

          if (cancelled) {
            return;
          }

          await loadPreviewEquipmentVisuals({
            world,
            equipment,
            vrm,
            avatarRoot: avatarScene,
            visuals: previewVisualsRef.current,
          });

          if (cancelled) {
            return;
          }

          avatarNode.visible = true;
          avatarScene.visible = true;
          viewport.resize();
          framePortraitAvatar(
            avatarScene,
            viewport.camera,
            currentZoomRef.current,
            fitDistanceMultiplier,
            centerBiasX,
            baseCameraStateRef,
          );
          setMode("live");
        } catch (error) {
          console.error(
            "[EquipmentPaperdollPortrait] Failed to build preview avatar:",
            error,
          );
          if (!cancelled) {
            setMode("fallback");
          }
        }
      };

      void buildPortrait();

      return () => {
        cancelled = true;
        clearPreviewAvatar();
      };
    }, [avatarUrl, equipment, rendererReady, signature, world]);

    useEffect(() => {
      if (!isVisible || !viewportRef.current || !avatarSceneRef.current) {
        return;
      }

      viewportRef.current.resize();
      baseCameraStateRef.current = null;
      framePortraitAvatar(
        avatarSceneRef.current,
        viewportRef.current.camera,
        currentZoomRef.current,
        fitDistanceMultiplier,
        centerBiasX,
        baseCameraStateRef,
      );
    }, [centerBiasX, fitDistanceMultiplier, isVisible]);

    return (
      <div
        ref={containerRef}
        data-equipment-portrait="true"
        data-portrait-mode={mode}
        className={`relative overflow-visible touch-none select-none ${className}`}
        onPointerDown={(e) => {
          isDraggingRef.current = true;
          lastMousePosRef.current = { x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!isDraggingRef.current) return;
          const deltaX = e.clientX - lastMousePosRef.current.x;
          targetRotationRef.current += deltaX * 0.01;
          lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          isDraggingRef.current = false;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onWheel={(e) => {
          const zoomDelta = e.deltaY > 0 ? 0.1 : -0.1;
          targetZoomRef.current = Math.max(
            0.4,
            Math.min(1.15, targetZoomRef.current + zoomDelta),
          );
        }}
        style={{
          borderRadius: 4,
          ...getPanelInsetStyle(theme, {
            emphasis: "strong",
            radius: 4,
          }),
          padding: 0,
          border: "none",
          background: "transparent",
          boxShadow: "none",
        }}
      >
        <div className="absolute inset-0 pointer-events-none" />

        <canvas
          ref={canvasRef}
          data-equipment-portrait-canvas="true"
          className="absolute inset-0 h-full w-full"
          style={{
            display: mode === "live" ? "block" : "none",
          }}
        />

        {mode !== "live" && <PortraitFallback compact={compact} mode={mode} />}
      </div>
    );
  },
);
