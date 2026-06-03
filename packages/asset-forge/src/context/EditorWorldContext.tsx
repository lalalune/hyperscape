import {
  createEditorWorld,
  EditorWorld,
  type EditorWorldOptions,
  type EditorCameraSystem,
  type EditorSelectionSystem,
  type EditorGizmoSystem,
  type WorldOptions,
} from "@hyperforge/shared";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
  type RefObject,
} from "react";

/** Status of each editor system after initialization */
interface SystemsStatus {
  camera: boolean;
  selection: boolean;
  gizmo: boolean;
}

interface EditorWorldContextValue {
  world: EditorWorld | null;
  isInitializing: boolean;
  isInitialized: boolean;
  error: Error | null;
  /** Warnings from systems that initialized in degraded mode */
  initWarnings: string[];
  /** Which systems are ready (have renderer access) */
  systemsReady: SystemsStatus;
  reinitialize: (options?: Partial<EditorWorldOptions>) => Promise<void>;
  editorCamera: EditorCameraSystem | null;
  editorSelection: EditorSelectionSystem | null;
  editorGizmo: EditorGizmoSystem | null;
}

const EditorWorldContext = createContext<EditorWorldContextValue | null>(null);

interface EditorWorldProviderProps {
  children: ReactNode;
  viewport: HTMLElement | RefObject<HTMLElement | null>;
  options?: Omit<EditorWorldOptions, "viewport">;
  initOptions?: Partial<WorldOptions>;
  onInitialized?: (world: EditorWorld) => void;
  onDestroyed?: () => void;
  onError?: (error: Error) => void;
}
export function EditorWorldProvider({
  children,
  viewport,
  options = {},
  initOptions = {},
  onInitialized,
  onDestroyed,
  onError,
}: EditorWorldProviderProps): React.ReactElement {
  const [world, setWorld] = useState<EditorWorld | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [initWarnings, setInitWarnings] = useState<string[]>([]);
  const [systemsReady, setSystemsReady] = useState<SystemsStatus>({
    camera: false,
    selection: false,
    gizmo: false,
  });
  const animationFrameRef = useRef<number | null>(null);
  const worldRef = useRef<EditorWorld | null>(null);

  const resolveViewport = useCallback((): HTMLElement | null => {
    return viewport instanceof HTMLElement ? viewport : viewport.current;
  }, [viewport]);

  const initialize = useCallback(
    async (overrideOptions?: Partial<EditorWorldOptions>) => {
      const vp = resolveViewport();
      if (!vp) {
        console.warn("[EditorWorldProvider] Viewport not available");
        return;
      }

      if (worldRef.current) {
        if (animationFrameRef.current !== null)
          cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
        worldRef.current.destroy();
        worldRef.current = null;
        setWorld(null);
        setIsInitialized(false);
      }

      setIsInitializing(true);
      setError(null);
      setInitWarnings([]);
      setSystemsReady({ camera: false, selection: false, gizmo: false });

      const newWorld = createEditorWorld({
        ...options,
        ...overrideOptions,
        viewport: vp,
      });
      worldRef.current = newWorld;
      await newWorld.init({
        assetsUrl: initOptions.assetsUrl ?? "/assets/",
        assetsDir: initOptions.assetsDir ?? "",
        viewport: vp,
        ...initOptions,
      });

      newWorld.editorCamera =
        (newWorld.getSystem("editor-camera") as
          | EditorCameraSystem
          | undefined) ?? null;
      newWorld.editorSelection =
        (newWorld.getSystem("editor-selection") as
          | EditorSelectionSystem
          | undefined) ?? null;
      newWorld.editorGizmo =
        (newWorld.getSystem("editor-gizmo") as EditorGizmoSystem | undefined) ??
        null;

      // Check isReady on each system and collect warnings for degraded systems
      const warnings: string[] = [];
      const ready: SystemsStatus = {
        camera: false,
        selection: false,
        gizmo: false,
      };

      if (newWorld.editorCamera) {
        ready.camera = newWorld.editorCamera.isReady;
        if (!ready.camera)
          warnings.push("Camera controls disabled (no renderer)");
      }
      if (newWorld.editorSelection) {
        ready.selection = newWorld.editorSelection.isReady;
        if (!ready.selection)
          warnings.push("Selection controls disabled (no renderer)");
      }
      if (newWorld.editorGizmo) {
        ready.gizmo = newWorld.editorGizmo.isReady;
        if (!ready.gizmo)
          warnings.push("Transform gizmos disabled (no renderer)");
      }

      setSystemsReady(ready);
      setInitWarnings(warnings);
      setWorld(newWorld);
      setIsInitializing(false);
      setIsInitialized(true);
      onInitialized?.(newWorld);

      const tick = (time: number) => {
        if (worldRef.current) {
          worldRef.current.tick(time);
          animationFrameRef.current = requestAnimationFrame(tick);
        }
      };
      animationFrameRef.current = requestAnimationFrame(tick);
    },
    [resolveViewport, options, initOptions, onInitialized],
  );

  const reinitialize = initialize;

  useEffect(() => {
    if (!resolveViewport()) return;
    initialize().catch((err) => {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      setIsInitializing(false);
      onError?.(e);
    });
    return () => {
      if (animationFrameRef.current !== null)
        cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      if (worldRef.current) {
        worldRef.current.destroy();
        worldRef.current = null;
        onDestroyed?.();
      }
    };
  }, [initialize, resolveViewport, onError, onDestroyed]);

  return (
    <EditorWorldContext.Provider
      value={{
        world,
        isInitializing,
        isInitialized,
        error,
        initWarnings,
        systemsReady,
        reinitialize,
        editorCamera: world?.editorCamera ?? null,
        editorSelection: world?.editorSelection ?? null,
        editorGizmo: world?.editorGizmo ?? null,
      }}
    >
      {children}
    </EditorWorldContext.Provider>
  );
}

export function useEditorWorldContext(): EditorWorldContextValue {
  const ctx = useContext(EditorWorldContext);
  if (!ctx)
    throw new Error(
      "useEditorWorldContext must be used within EditorWorldProvider",
    );
  return ctx;
}

export function useEditorWorld(): EditorWorld | null {
  return useEditorWorldContext().world;
}

export function useEditorWorldRequired(): EditorWorld {
  const { world } = useEditorWorldContext();
  if (!world) throw new Error("EditorWorld not initialized");
  return world;
}

export function useEditorCamera(): EditorCameraSystem | null {
  return useEditorWorldContext().editorCamera;
}
export function useEditorSelection(): EditorSelectionSystem | null {
  return useEditorWorldContext().editorSelection;
}
export function useEditorGizmo(): EditorGizmoSystem | null {
  return useEditorWorldContext().editorGizmo;
}

export function useWorldSystem<T>(systemKey: string): T | null {
  const world = useEditorWorld();
  return world ? ((world.getSystem(systemKey) as T | undefined) ?? null) : null;
}

export function useTerrain() {
  return useWorldSystem<{
    getHeightAt(x: number, z: number): number;
    getHeightAtPosition(x: number, z: number): number;
    getBiomeAt(x: number, z: number): string;
    isPositionWalkable(
      x: number,
      z: number,
    ): { walkable: boolean; reason?: string };
    generate?(options: Record<string, unknown>): void;
  }>("terrain");
}

export function useVegetation() {
  return useWorldSystem<{
    setEnabled?(enabled: boolean): void;
    update?(delta: number): void;
  }>("vegetation");
}
export function useGrass() {
  return useWorldSystem<{
    setEnabled?(enabled: boolean): void;
    update?(delta: number): void;
  }>("grass");
}
export function useTowns() {
  return useWorldSystem<{
    towns?: Map<string, unknown>;
    getTowns?(): Array<unknown>;
    update?(delta: number): void;
  }>("towns");
}
export function useRoads() {
  return useWorldSystem<{
    roads?: Map<string, unknown>;
    update?(delta: number): void;
  }>("roads");
}
export function useBuildings() {
  return useWorldSystem<{ update?(delta: number): void }>("building-rendering");
}
export function useEnvironment() {
  return useWorldSystem<{
    setTimeOfDay?(hour: number): void;
    update?(delta: number): void;
  }>("environment");
}

export { EditorWorldContext };
