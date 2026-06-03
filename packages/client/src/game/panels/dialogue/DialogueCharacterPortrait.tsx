import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Emotes,
  EventType,
  THREE,
  type EntityConfig,
} from "@hyperforge/shared";
import type { VRM } from "@pixiv/three-vrm";
import { useThemeStore } from "@/ui";
import { createAvatarPreviewViewport } from "@/game/character/avatarPreviewViewport";
import { ThreeResourceManager } from "@/lib/ThreeResourceManager";
import type { ClientWorld } from "../../../types";

type PortraitMode = "loading" | "live" | "fallback";

interface DialogueCharacterPortraitProps {
  world: ClientWorld;
  npcEntityId?: string;
  npcName: string;
  className?: string;
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

type EntityWithModelConfig = {
  config?: Pick<EntityConfig, "model">;
};

function getEntityModelUrl(entity: unknown): string | null {
  const candidate = (entity as EntityWithModelConfig | undefined)?.config
    ?.model;
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : null;
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

function frameDialogueAvatar(
  avatarRoot: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  baseStateRef?: React.MutableRefObject<{
    camY: number;
    lookY: number;
    distance: number;
    center: THREE.Vector3;
  } | null>,
) {
  if (baseStateRef?.current) {
    const { camY, lookY, distance, center } = baseStateRef.current;
    camera.position.set(center.x, camY, -distance);
    camera.lookAt(center.x, lookY, center.z);
    return;
  }

  avatarRoot.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(avatarRoot);

  if (box.isEmpty()) {
    camera.position.set(0, 1.58, 1.02);
    camera.lookAt(0, 1.44, 0);
    return;
  }

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const height = Math.max(size.y, 1.6);
  const width = Math.max(size.x, 0.7);
  const lookY = center.y + height * 0.29;
  const camY = lookY + height * 0.035;
  const distance = Math.max(0.86, height * 0.42, width * 0.95);

  if (baseStateRef) {
    baseStateRef.current = { camY, lookY, distance, center: center.clone() };
  }

  camera.position.set(center.x, camY, -distance);
  camera.lookAt(center.x, lookY, center.z);
  camera.near = 0.1;
  camera.far = Math.max(10, distance + height * 2.5);
  camera.updateProjectionMatrix();
}

function PortraitFallback({
  npcName,
  mode,
}: {
  npcName: string;
  mode: PortraitMode;
}) {
  const theme = useThemeStore((s) => s.theme);
  const initials = npcName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full border text-2xl font-bold"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.1), rgba(12,15,22,0.22) 72%)",
            borderColor: `${theme.colors.border.decorative}88`,
            color: theme.colors.accent.primary,
            boxShadow: "0 12px 26px rgba(0,0,0,0.18)",
          }}
        >
          {initials}
        </div>
        <div
          className="text-center text-[11px] uppercase tracking-[0.18em]"
          style={{ color: theme.colors.text.muted }}
        >
          {mode === "loading" ? "Loading portrait" : "Portrait unavailable"}
        </div>
      </div>
    </div>
  );
}

export const DialogueCharacterPortrait = React.memo(
  function DialogueCharacterPortrait({
    world,
    npcEntityId,
    npcName,
    className = "",
  }: DialogueCharacterPortraitProps) {
    const theme = useThemeStore((s) => s.theme);
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const viewportRef = useRef<Awaited<
      ReturnType<typeof createAvatarPreviewViewport>
    > | null>(null);
    const avatarNodeRef = useRef<PreviewAvatarNode | null>(null);
    const avatarSceneRef = useRef<THREE.Object3D | null>(null);
    const baseCameraStateRef = useRef<{
      camY: number;
      lookY: number;
      distance: number;
      center: THREE.Vector3;
    } | null>(null);
    const [rendererReady, setRendererReady] = useState(false);
    const [mode, setMode] = useState<PortraitMode>("loading");
    const [refreshNonce, setRefreshNonce] = useState(0);

    const modelUrl = useMemo(() => {
      if (!npcEntityId) {
        return null;
      }

      return getEntityModelUrl(world.entities.get(npcEntityId));
    }, [npcEntityId, refreshNonce, world.entities]);

    const clearPreviewAvatar = () => {
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
      // The preview viewport should be created once per mounted portrait shell.
      // The effect intentionally closes over refs so renderer state survives prop updates.
      const container = containerRef.current;
      const canvas = canvasRef.current;

      if (!container || !canvas) {
        return;
      }

      let cancelled = false;
      let resizeObserver: ResizeObserver | null = null;

      createAvatarPreviewViewport({
        container,
        canvas,
        cameraPosition: new THREE.Vector3(0, 1.45, 1.95),
        adjustCameraDepth: false,
        fov: 26,
      })
        .then((viewport) => {
          if (cancelled) {
            viewport.dispose();
            return;
          }

          viewportRef.current = viewport;
          viewport.start((delta) => {
            avatarNodeRef.current?.instance?.update(delta);
          });
          setRendererReady(true);

          if (typeof ResizeObserver !== "undefined") {
            resizeObserver = new ResizeObserver(() => viewport.resize());
            resizeObserver.observe(container);
          } else {
            window.addEventListener("resize", viewport.resize);
          }
        })
        .catch((error) => {
          console.error(
            "[DialogueCharacterPortrait] Failed to initialize preview viewport:",
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
        if (viewportRef.current) {
          window.removeEventListener("resize", viewportRef.current.resize);
        }
        clearPreviewAvatar();
        viewportRef.current?.dispose();
        viewportRef.current = null;
        setRendererReady(false);
      };
    }, []);

    useEffect(() => {
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
    }, [world]);

    useEffect(() => {
      if (!world || !rendererReady || !viewportRef.current) {
        return;
      }

      let cancelled = false;

      const buildPortrait = async () => {
        const viewport = viewportRef.current;
        setMode("loading");
        clearPreviewAvatar();

        if (!modelUrl || !modelUrl.endsWith(".vrm")) {
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
            modelUrl,
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
          avatarScene.rotation.y = Math.PI * 0.06;
          vrm.scene.rotation.y = Math.PI * 0.06;

          if (avatarInstance.setEmoteAndWait) {
            await avatarInstance.setEmoteAndWait(Emotes.IDLE, 3000);
          } else {
            avatarInstance.setEmote?.(Emotes.IDLE);
          }

          if (cancelled) {
            return;
          }

          avatarNode.visible = true;
          avatarScene.visible = true;
          viewport.resize();
          frameDialogueAvatar(avatarScene, viewport.camera, baseCameraStateRef);
          setMode("live");
        } catch (error) {
          console.error(
            "[DialogueCharacterPortrait] Failed to build portrait:",
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
    }, [modelUrl, rendererReady, world]);

    return (
      <div
        ref={containerRef}
        className={`relative min-h-[194px] overflow-hidden rounded-xl ${className}`}
        style={{
          background:
            "radial-gradient(circle at 52% 20%, rgba(255,255,255,0.05), transparent 34%), linear-gradient(180deg, rgba(255, 255, 255, 0.025), rgba(9, 12, 18, 0.03) 22%, rgba(9, 12, 18, 0) 100%)",
          border: `1px solid ${theme.colors.border.default}40`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ display: mode === "live" ? "block" : "none" }}
        />

        {mode !== "live" ? (
          <div className="absolute inset-0">
            <PortraitFallback npcName={npcName} mode={mode} />
          </div>
        ) : null}
      </div>
    );
  },
);
