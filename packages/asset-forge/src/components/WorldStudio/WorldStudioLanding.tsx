/**
 * Landing page — shown when the user is not authenticated.
 *
 * Gates the entire Asset Forge app behind Privy sign-in.
 * Clicking "Sign In" opens the Privy modal (email, Google, or wallet).
 *
 * Design: FORGE brand-compliant. Solid Obsidian backdrop, restrained
 * architectural surfaces, single earned Gold accent. No grid, no glow,
 * no gradient halos.
 */

import {
  Hammer,
  Mountain,
  TreePine,
  Building2,
  Wand2,
  Layers,
  Sparkles,
  LogIn,
  Loader2,
} from "lucide-react";
import React from "react";

import { useForgeAuth } from "../../auth/ForgeAuthProvider";

const FEATURES = [
  {
    icon: Wand2,
    title: "AI Generation",
    desc: "Create 3D models, textures, and sprites with AI",
  },
  {
    icon: Mountain,
    title: "Procedural Worlds",
    desc: "Terrain, biomes, erosion, and heightmaps",
  },
  {
    icon: Building2,
    title: "World Building",
    desc: "Towns, buildings, NPCs, quests, and roads",
  },
  {
    icon: TreePine,
    title: "Vegetation",
    desc: "Trees, grass, flowers, and foliage scattering",
  },
  {
    icon: Layers,
    title: "Equipment Pipeline",
    desc: "Armor fitting, hand rigging, and retargeting",
  },
  {
    icon: Sparkles,
    title: "Batch Processing",
    desc: "Sprites, LODs, VATs, and manifest management",
  },
];

export function WorldStudioLanding() {
  const auth = useForgeAuth();

  if (!auth.ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-primary">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg-primary relative overflow-hidden">
      {/* Faint horizon — single architectural element, not a grid */}
      <div
        className="absolute inset-x-0 top-1/2 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(212,175,55,0.12), transparent)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-6 max-w-3xl text-center">
        {/* Icon — solid Graphite, thin Gold border, no halo */}
        <div className="mb-8 w-20 h-20 rounded-xl bg-bg-tertiary border border-border-primary flex items-center justify-center">
          <Hammer size={32} className="text-primary" strokeWidth={1.5} />
        </div>

        {/* Title */}
        <h1 className="font-display text-4xl font-medium text-text-primary mb-3 tracking-tight">
          Asset Forge
        </h1>
        <p className="text-sm text-text-tertiary mb-10 max-w-md leading-relaxed">
          AI-powered 3D asset creation, procedural world building, and game
          content pipeline.
        </p>

        {/* Sign In — restrained, no glow, no shine */}
        <button
          className="inline-flex items-center gap-2.5 px-7 py-2.5 text-sm font-medium rounded-md bg-primary text-bg-primary hover:bg-primary-dark transition-colors duration-500 border border-primary ease-out"
          onClick={auth.login}
        >
          <LogIn size={15} strokeWidth={2} />
          Sign In
        </button>

        <p className="text-xs text-text-tertiary mt-3">
          Email, Google, or wallet
        </p>

        {/* Features grid — low-contrast Graphite panels */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-16 w-full max-w-2xl">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex flex-col items-center gap-2 p-5 rounded-md bg-bg-tertiary border border-border-primary"
            >
              <f.icon
                size={16}
                className="text-text-tertiary"
                strokeWidth={1.5}
              />
              <span className="text-xs font-medium text-text-secondary">
                {f.title}
              </span>
              <span className="text-[10px] text-text-tertiary leading-tight">
                {f.desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
