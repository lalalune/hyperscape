/**
 * Particle Manager
 * GPU-instanced particle systems managed by the central ParticleManager.
 */

export { ParticleManager } from "./ParticleManager";
export type {
  WaterParticleConfig,
  GlowParticleConfig,
  ParticleConfig,
  ParticleResourceEvent,
} from "./ParticleManager";
export { WaterParticleManager } from "./WaterParticleManager";
export type { FishingSpotVariant } from "./WaterParticleManager";
export { GlowParticleManager } from "./GlowParticleManager";
export type { GlowPreset, GlowConfig } from "./GlowParticleManager";
