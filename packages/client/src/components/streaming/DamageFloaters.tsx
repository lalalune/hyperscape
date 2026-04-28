/**
 * DamageFloaters - Floating damage numbers that appear when agents take hits
 *
 * Each floater animates upward and fades out over 1.5 seconds using CSS keyframes.
 * Positioned near the corresponding agent's HP bar (left or right side).
 */

import React, { useEffect, useRef } from "react";
import type { DamageFloaterEntry } from "./StreamingOverlay";

/** Duration of the float-up + fade-out animation (ms). */
const FLOATER_DURATION_MS = 1500;

interface DamageFloatersProps {
  floaters: DamageFloaterEntry[];
  onExpire: (id: string) => void;
}

// Inject the keyframe animation once into the document head
let styleInjected = false;
function ensureStyleInjected(): void {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes dmgFloatUp {
      0% {
        opacity: 1;
        transform: translateY(0) scale(1.2);
      }
      60% {
        opacity: 0.9;
        transform: translateY(-32px) scale(1.05);
      }
      100% {
        opacity: 0;
        transform: translateY(-56px) scale(1.0);
      }
    }
  `;
  document.head.appendChild(style);
}

export function DamageFloaters({ floaters, onExpire }: DamageFloatersProps) {
  useEffect(() => {
    ensureStyleInjected();
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(1200px, calc(100vw - 40px))",
        height: 120,
        pointerEvents: "none",
        zIndex: 60,
      }}
    >
      {floaters.map((floater) => (
        <SingleDamageFloater
          key={floater.id}
          floater={floater}
          onExpire={onExpire}
        />
      ))}
    </div>
  );
}

interface SingleDamageFloaterProps {
  floater: DamageFloaterEntry;
  onExpire: (id: string) => void;
}

function SingleDamageFloater({ floater, onExpire }: SingleDamageFloaterProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onExpire(floater.id);
    }, FLOATER_DURATION_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [floater.id, onExpire]);

  // Position: left side floaters appear ~25% from left, right side ~75% from left
  // Add slight random horizontal jitter so stacked hits don't overlap perfectly
  const jitter = (floater.createdAt % 40) - 20;
  const xPercent = floater.side === "left" ? 18 : 82;

  return (
    <div
      style={{
        position: "absolute",
        top: 48,
        left: `${xPercent}%`,
        transform: `translateX(calc(-50% + ${jitter}px))`,
        color: "#ff0d3c",
        fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
        fontWeight: 900,
        fontFamily: "'Teko', 'Arial Black', sans-serif",
        textShadow:
          "0 0 8px rgba(255,13,60,0.8), 2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
        animation: `dmgFloatUp ${FLOATER_DURATION_MS}ms ease-out forwards`,
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      -{floater.amount}
    </div>
  );
}
