/**
 * Rendering Types
 * Visual, UI, and rendering-related types
 */

export * from "./nodes";
export * from "./materials";
// Note: particles and ui have type conflicts with nodes (ParticleEmitter, NametagHandle)
// Import them directly when needed: import { ... } from "./types/rendering/particles"
// export * from "./particles";
// export * from "./ui";
