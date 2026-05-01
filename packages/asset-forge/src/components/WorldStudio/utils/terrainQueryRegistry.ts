/**
 * terrainQueryRegistry — singleton bridge for "I need to query
 * the live terrain mesh from outside the viewport tree".
 *
 * Background: the viewport's `sceneRefs.getTerrainHeight(x, z)`
 * is the authoritative source for terrain height (it samples the
 * actual generated heightmap). But sceneRefs is local to
 * ViewportContainer's ref — sibling components like the
 * placement dispatcher can't reach it via React.
 *
 * Rather than pump it through five layers of context providers,
 * we use a module-level singleton registered by the viewport
 * when its scene becomes ready, read by anyone who needs it.
 *
 * Single-user editor → single registration is fine. If multiple
 * viewports ever coexist, last-registered wins; that's actually
 * the right behavior (the active viewport owns the query
 * surface).
 *
 * Returns `null` when no viewport has registered yet (project
 * not loaded, or scene not ready). Callers should treat null as
 * "skip the snap" rather than throwing.
 */

type GetTerrainHeightFn = (x: number, z: number) => number;
type GetWaterLevelFn = () => number;

interface TerrainQuerier {
  getTerrainHeight: GetTerrainHeightFn;
  getWaterLevel: GetWaterLevelFn;
}

let activeQuerier: TerrainQuerier | null = null;

/**
 * Register the active terrain querier. Called by ViewportContainer
 * when its sceneRefs becomes ready. Returns a disposer the caller
 * runs in its cleanup phase.
 */
export function registerTerrainQuerier(querier: TerrainQuerier): () => void {
  activeQuerier = querier;
  return () => {
    if (activeQuerier === querier) {
      activeQuerier = null;
    }
  };
}

/**
 * Sample terrain height at scene-space (x, z). Returns null when
 * no querier is registered yet.
 */
export function getTerrainHeightAt(x: number, z: number): number | null {
  if (!activeQuerier) return null;
  return activeQuerier.getTerrainHeight(x, z);
}

/**
 * Returns the world's water level (terrain below this y is
 * ocean). Null when no project is loaded.
 */
export function getWaterLevel(): number | null {
  if (!activeQuerier) return null;
  return activeQuerier.getWaterLevel();
}

/**
 * Test-only: clear the registered querier between tests.
 */
export function _resetTerrainQueryRegistry(): void {
  activeQuerier = null;
}
