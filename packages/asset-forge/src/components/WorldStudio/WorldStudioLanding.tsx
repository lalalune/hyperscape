/**
 * Landing page — shown when the user is not authenticated.
 *
 * Gates the entire HyperForge app behind Privy sign-in.
 * Clicking "Sign In" opens the Privy modal (email, Google, or wallet).
 *
 * Design: FORGE brand-compliant. Solid Obsidian backdrop, restrained
 * architectural surfaces, single earned Gold accent. No grid, no glow,
 * no gradient halos.
 */

import {
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
import { ForgeLogo } from "../shared/ForgeLogo";

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
      <div className="flex flex-col items-center justify-center min-h-screen bg-bg-primary gap-6">
        <ForgeLogo size={56} />
        <Loader2
          size={16}
          className="animate-spin text-text-tertiary"
          strokeWidth={1.5}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg-primary relative overflow-hidden">
      {/* Atmospheric volumetric depth — radial Graphite gradient suggests
         a vast architectural space. Brand: distant rendered atmospheres. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(28,30,34,0.7) 0%, transparent 60%)",
        }}
      />

      {/* Architectural monoliths — vertical Graphite silhouettes suggesting
         distant structures. Two columns flanking the content, asymmetric. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-[18%] w-px"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(28,30,34,0.9) 40%, rgba(28,30,34,0.9) 60%, transparent 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-[22%] w-px"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(28,30,34,0.7) 35%, rgba(28,30,34,0.7) 65%, transparent 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-[8%] w-px"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(28,30,34,0.5) 45%, rgba(28,30,34,0.5) 55%, transparent 100%)",
        }}
      />

      {/* Faint Gold horizon — single architectural element, celestial light */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(212,175,55,0.18), transparent)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-6 max-w-3xl text-center">
        {/* FORGE mark — brand identity, no container chrome.
           Lets the symmetric form carry the moment on its own. */}
        <ForgeLogo size={64} className="mb-8" title="HyperForge" />

        {/* Title */}
        <h1 className="font-display text-4xl font-medium text-text-primary mb-3 tracking-tight">
          HyperForge
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
