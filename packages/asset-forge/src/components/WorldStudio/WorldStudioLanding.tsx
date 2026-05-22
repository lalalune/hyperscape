/**
 * WorldStudioLanding — the sign-in page.
 *
 * Mounted at /sign-in. Shown when the user is NOT authenticated.
 * Clicking "Sign in" opens the Privy modal (email / Google / wallet).
 *
 * Composition mirrors the dashboard's brand language:
 *   - Content-aligned atmospheric monoliths
 *   - Editorial section rhythm
 *   - Brand-color split tagline (Ember White + Forge Gold)
 *   - Display-font hero, restrained accent
 *
 * Sections:
 *   00 / HERO        — brand mark + tagline + Sign In CTA
 *   01 / WHAT IT IS  — three capability cards with descriptions
 *   02 / ENGINEERED  — tech stack credits
 *   FOOTER           — minimal copyright + status
 */

import {
  Mountain,
  Layers,
  Sparkles,
  LogIn,
  Loader2,
  ArrowRight,
  Cpu,
  Box,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { useForgeAuth } from "../../auth/ForgeAuthProvider";
import { ForgeLogo } from "../shared/ForgeLogo";
import { AtmosphericScene, SectionHeader, StatusDot } from "../shared/page";

// =============================================================================
// Data
// =============================================================================

interface CapabilityCard {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
}

const CAPABILITIES: CapabilityCard[] = [
  {
    icon: Mountain,
    eyebrow: "World Studio",
    title: "Procedural worldbuilding",
    description:
      "Compose terrain, biomes, structures, quests, and NPCs with AI-assisted authoring. Real-time edits stream to a WebGPU runtime preview.",
    highlights: ["Heightmaps", "Biomes", "Towns", "Quests"],
  },
  {
    icon: Sparkles,
    eyebrow: "Generation",
    title: "AI asset pipeline",
    description:
      "Generate 3D models, textures, sprites, and VFX from natural-language prompts. Backed by GPT-4 and Meshy AI with deterministic post-processing.",
    highlights: ["3D models", "Textures", "Sprites", "VFX"],
  },
  {
    icon: Layers,
    eyebrow: "Pipeline",
    title: "Unified asset library",
    description:
      "Armor fitting, hand rigging, animation retargeting, sprite batching, and asset pack composition — all in one shared workspace.",
    highlights: ["Rigging", "Retargeting", "Packs", "Batching"],
  },
];

const ENGINE_STACK: { label: string; value: string; icon: LucideIcon }[] = [
  { label: "Renderer", value: "WebGPU · TSL", icon: Cpu },
  { label: "3D", value: "Three.js", icon: Box },
  { label: "Physics", value: "PhysX WASM", icon: Zap },
  { label: "Generation", value: "GPT-4 · Meshy", icon: Sparkles },
];

// =============================================================================
// Primitives
// =============================================================================

// =============================================================================
// Capability card
// =============================================================================

function CapabilityCardView({ card }: { card: CapabilityCard }) {
  return (
    <article className="group relative flex flex-col rounded-lg bg-bg-tertiary border border-border-primary hover:border-primary/40 transition-colors duration-500 ease-out overflow-hidden h-full p-7">
      {/* Earned Gold left-edge on hover */}
      <span className="pointer-events-none absolute left-0 top-6 bottom-6 w-px bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out" />

      {/* Subtle atmosphere on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(212,175,55,0.05) 0%, transparent 70%)",
        }}
      />

      <div className="relative mb-6">
        <card.icon
          size={28}
          strokeWidth={1.25}
          className="text-text-secondary group-hover:text-primary transition-colors duration-500 ease-out"
        />
      </div>

      <div className="relative">
        <p className="text-[11px] font-medium text-text-tertiary uppercase tracking-[0.14em] mb-2">
          {card.eyebrow}
        </p>
        <h3 className="font-display text-xl font-medium text-text-primary tracking-tight mb-3">
          {card.title}
        </h3>
        <p className="text-sm text-text-tertiary leading-relaxed mb-5">
          {card.description}
        </p>
      </div>

      <div className="relative mt-auto pt-4 border-t border-border-primary flex flex-wrap gap-1.5">
        {card.highlights.map((h) => (
          <span
            key={h}
            className="text-[10px] font-mono text-text-tertiary tabular-nums px-2 py-0.5 rounded bg-bg-primary/60 border border-border-primary"
          >
            {h}
          </span>
        ))}
      </div>
    </article>
  );
}

// =============================================================================
// Page
// =============================================================================

export function WorldStudioLanding() {
  const auth = useForgeAuth();

  // Auth-loading state — premium boot screen
  if (!auth.ready) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bg-primary gap-6 relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(28,30,34,0.6) 0%, transparent 70%)",
          }}
        />
        <div className="relative flex flex-col items-center gap-6">
          <ForgeLogo size={64} />
          <Loader2
            size={16}
            className="animate-spin text-text-tertiary"
            strokeWidth={1.5}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-bg-primary overflow-hidden">
      <AtmosphericScene
        topEllipseHeight={720}
        horizonY={500}
        secondaryHorizonY={1100}
      />

      <div className="relative max-w-[1200px] mx-auto px-10 py-16">
        {/* ====================================================================
            00 / HERO — brand + tagline + Sign In CTA
            ==================================================================== */}
        <section className="mb-24">
          <div className="flex items-baseline gap-4 mb-6">
            <span className="font-mono text-[11px] text-text-tertiary tabular-nums tracking-[0.05em]">
              00
            </span>
            <span className="font-display text-base font-medium text-text-primary tracking-tight">
              HyperForge
            </span>
            <span className="flex items-center gap-2 text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
              <StatusDot />
              v0.1.0
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-10 items-center mb-12">
            <ForgeLogo size={112} />
            <div className="max-w-2xl">
              <h1 className="font-display text-5xl md:text-6xl font-medium text-text-primary tracking-tight leading-[1.02] mb-5">
                The engine beneath
                <br />
                <span className="text-primary">infinite worlds.</span>
              </h1>
              <p className="text-lg text-text-tertiary leading-relaxed max-w-xl">
                AI-driven authoring, procedural worldbuilding, and a unified
                asset pipeline — all rendered on WebGPU.
              </p>
            </div>
          </div>

          {/* Sign In CTA + auth methods */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <button
              onClick={auth.login}
              className="group inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-md bg-primary text-bg-primary text-base font-medium hover:bg-primary-dark transition-colors duration-500 ease-out"
            >
              <LogIn size={16} strokeWidth={2} />
              Sign in to HyperForge
              <ArrowRight
                size={15}
                strokeWidth={2}
                className="-translate-x-1 group-hover:translate-x-0 transition-transform duration-500 ease-out"
              />
            </button>
            <div className="flex items-center gap-2.5 text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
              <span>Email</span>
              <span className="text-text-tertiary/40">·</span>
              <span>Google</span>
              <span className="text-text-tertiary/40">·</span>
              <span>Wallet</span>
            </div>
          </div>
        </section>

        {/* ====================================================================
            01 / WHAT IT IS — three capability cards
            ==================================================================== */}
        <section className="mb-24">
          <SectionHeader
            number="01"
            title="What you can build"
            meta="Core capabilities"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {CAPABILITIES.map((c) => (
              <CapabilityCardView key={c.title} card={c} />
            ))}
          </div>
        </section>

        {/* ====================================================================
            02 / ENGINEERED — tech stack credentials
            ==================================================================== */}
        <section className="mb-24">
          <SectionHeader number="02" title="Engineered on" meta="The stack" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {ENGINE_STACK.map((s) => (
              <div
                key={s.label}
                className="rounded-lg bg-bg-tertiary border border-border-primary p-6"
              >
                <s.icon
                  size={16}
                  strokeWidth={1.25}
                  className="text-text-tertiary mb-3"
                />
                <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-[0.14em] mb-2">
                  {s.label}
                </p>
                <p className="font-display text-base font-medium text-text-primary tracking-tight">
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ====================================================================
            FOOTER
            ==================================================================== */}
        <footer className="relative pt-12 border-t border-border-primary">
          {/* Cap horizon */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-12 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent 5%, rgba(212,175,55,0.22) 50%, transparent 95%)",
              animation: "celestial-pulse 10s ease-in-out infinite",
            }}
          />
          <div className="flex flex-wrap items-baseline justify-between gap-6">
            <div className="flex items-center gap-3">
              <ForgeLogo size={18} />
              <span className="font-display text-sm font-medium text-text-secondary tracking-tight">
                HyperForge
              </span>
              <span className="text-text-tertiary/40">·</span>
              <span className="text-[11px] text-text-tertiary uppercase tracking-[0.14em]">
                The engine beneath infinite worlds
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-3 text-[11px] text-text-tertiary uppercase tracking-[0.12em]">
              <span className="font-mono normal-case tracking-normal text-text-tertiary/80">
                © {new Date().getFullYear()}
              </span>
              <span>HyperForge</span>
              <span className="text-text-tertiary/40">·</span>
              <span className="flex items-center gap-1.5">
                <StatusDot />
                Operational
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
