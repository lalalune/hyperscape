/**
 * FireworksEffect - CSS-based fireworks animation for celebrations
 *
 * Creates multiple particle bursts that explode outward from the center.
 * Uses CSS animations for performance (GPU-accelerated transforms).
 *
 * Features:
 * - Multiple burst waves with staggered timing
 * - Particles radiate outward in a circle
 * - Configurable color palette
 * - Sparkle/twinkle effect on particles
 * - Trail effects for first burst
 *
 * Use with AchievementPopup or any celebratory UI.
 *
 * @packageDocumentation
 */

import React, { useMemo, useEffect, memo } from "react";

// === CONFIGURATION ===

/** Default particle colors (celebration palette) */
const DEFAULT_COLORS = [
  "#f2d08a", // Gold (Hyperia primary)
  "#FF6B6B", // Red/coral
  "#4ECDC4", // Teal
  "#45B7D1", // Sky blue
  "#96CEB4", // Mint green
  "#c9a54a", // Rich gold
  "#DDA0DD", // Plum
  "#98D8C8", // Seafoam
];

/** CSS keyframes ID for injection */
const KEYFRAMES_ID = "hs-fireworks-effect-keyframes";

/** Ensure keyframes are injected into document */
function ensureKeyframes(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(KEYFRAMES_ID)) return;

  const style = document.createElement("style");
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes hs-fireworks-explode {
      0% {
        transform: translate(-50%, -50%) scale(0);
        opacity: 1;
      }
      20% {
        opacity: 1;
      }
      100% {
        transform: translate(-50%, -50%) scale(1);
        opacity: 0;
      }
    }

    @keyframes hs-fireworks-sparkle {
      0%, 100% {
        filter: brightness(1);
      }
      50% {
        filter: brightness(1.5);
      }
    }

    @keyframes hs-fireworks-glow {
      0%, 100% {
        box-shadow: 0 0 4px currentColor, 0 0 8px currentColor;
      }
      50% {
        box-shadow: 0 0 8px currentColor, 0 0 16px currentColor, 0 0 24px currentColor;
      }
    }
  `;
  document.head.appendChild(style);
}

// === TYPES ===

export interface FireworksEffectProps {
  /** Number of particles per burst (default: 12) */
  particlesPerBurst?: number;
  /** Number of burst waves (default: 3) */
  burstCount?: number;
  /** Custom color palette (default: gold/teal/coral celebration colors) */
  colors?: string[];
  /** Show trail effects (default: true) */
  showTrails?: boolean;
  /** Base distance particles travel (default: 60) */
  baseDistance?: number;
  /** Animation duration multiplier (default: 1) */
  speed?: number;
}

interface ParticleData {
  id: string;
  angle: number;
  distance: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
}

/**
 * Generate particle data for all bursts
 */
function generateParticles(
  particlesPerBurst: number,
  burstCount: number,
  colors: string[],
  baseDistance: number,
  speed: number,
): ParticleData[] {
  const particles: ParticleData[] = [];

  for (let burst = 0; burst < burstCount; burst++) {
    const burstDelay = burst * 0.15 * speed;
    const distance = baseDistance + burst * 30;

    for (let i = 0; i < particlesPerBurst; i++) {
      const angle = (i * 360) / particlesPerBurst + burst * 15;
      const randomOffset = (Math.random() - 0.5) * 20;
      const delay = burstDelay + Math.random() * 0.1;
      const duration = (0.8 + Math.random() * 0.4) * speed;
      const color = colors[(i + burst) % colors.length];
      const size = 6 + Math.random() * 4 + (burst === 0 ? 2 : 0);

      particles.push({
        id: `burst-${burst}-particle-${i}`,
        angle,
        distance: distance + randomOffset,
        delay,
        duration,
        color,
        size,
      });
    }
  }

  return particles;
}

/**
 * FireworksEffect Component
 *
 * CSS-based fireworks for celebratory UI moments.
 *
 * @example
 * ```tsx
 * // Default celebration fireworks
 * <FireworksEffect />
 *
 * // Custom colors matching achievement theme
 * <FireworksEffect colors={["#a855f7", "#c084fc", "#e879f9"]} />
 *
 * // Larger, slower explosion
 * <FireworksEffect
 *   baseDistance={100}
 *   speed={1.5}
 *   burstCount={5}
 * />
 * ```
 */
export const FireworksEffect = memo(function FireworksEffect({
  particlesPerBurst = 12,
  burstCount = 3,
  colors = DEFAULT_COLORS,
  showTrails = true,
  baseDistance = 60,
  speed = 1,
}: FireworksEffectProps): React.ReactElement {
  // Ensure keyframes are injected
  useEffect(() => {
    ensureKeyframes();
  }, []);

  // Memoize particles so they don't regenerate on re-render
  const particles = useMemo(
    () =>
      generateParticles(
        particlesPerBurst,
        burstCount,
        colors,
        baseDistance,
        speed,
      ),
    [particlesPerBurst, burstCount, colors, baseDistance, speed],
  );

  const containerStyle: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 0,
    height: 0,
    pointerEvents: "none",
    zIndex: -1,
  };

  return (
    <div style={containerStyle}>
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: p.color,
            color: p.color,
            left: Math.cos((p.angle * Math.PI) / 180) * p.distance,
            top: Math.sin((p.angle * Math.PI) / 180) * p.distance,
            transform: "translate(-50%, -50%)",
            animation: `
              hs-fireworks-explode ${p.duration}s ease-out ${p.delay}s forwards,
              hs-fireworks-sparkle 0.3s ease-in-out ${p.delay}s infinite,
              hs-fireworks-glow 0.5s ease-in-out ${p.delay}s infinite
            `,
            opacity: 0,
          }}
        />
      ))}
      {/* Add trails for first burst only (performance) */}
      {showTrails &&
        particles
          .filter((p) => p.id.startsWith("burst-0"))
          .map((p) => (
            <div
              key={`trail-${p.id}`}
              style={{
                position: "absolute",
                width: p.size * 0.6,
                height: p.size * 0.6,
                borderRadius: "50%",
                background: p.color,
                left: Math.cos((p.angle * Math.PI) / 180) * p.distance * 0.5,
                top: Math.sin((p.angle * Math.PI) / 180) * p.distance * 0.5,
                transform: "translate(-50%, -50%)",
                animation: `hs-fireworks-explode ${p.duration * 0.8}s ease-out ${p.delay + 0.05}s forwards`,
                opacity: 0,
                filter: "blur(1px)",
              }}
            />
          ))}
    </div>
  );
});

export default FireworksEffect;
