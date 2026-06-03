/**
 * @hyperforge/procgen/building
 * Procedural building and town generation for Hyperia
 *
 * NOTE: Viewer components (BuildingViewer, TownViewer, NavigationVisualizer)
 * are NOT exported here to avoid pulling in @hyperforge/shared dependency.
 * Import them separately from "@hyperforge/procgen/building/viewer" if needed.
 */

export * from "./generator";
export * from "./town";
export * from "./materials";
