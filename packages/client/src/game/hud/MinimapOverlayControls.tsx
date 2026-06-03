/**
 * MinimapOverlayControls.tsx - Overlay controls for minimap
 *
 * Contains compass, teleport orb, and stamina orb that overlay the minimap.
 * This component is positioned as a sibling to the Minimap and scales linearly
 * with the minimap dimensions.
 */

import React, { useEffect, useState, useRef } from "react";
import { THREE } from "@hyperforge/shared";
import type { ClientWorld } from "../../types";
import { MinimapStaminaOrb } from "./MinimapStaminaBar";
import { MinimapHomeTeleportOrb } from "./MinimapHomeTeleportOrb";

interface MinimapOverlayControlsProps {
  world: ClientWorld;
  width: number;
  height: number;
  /** Optional callback when compass is clicked (defaults to resetting camera to North) */
  onCompassClick?: () => void;
}

/**
 * Overlay controls for the minimap - compass, teleport orb, and stamina orb.
 * Scales linearly with the minimap dimensions.
 */
export function MinimapOverlayControls({
  world,
  width,
  height,
  onCompassClick,
}: MinimapOverlayControlsProps) {
  // Camera yaw for compass rotation
  const [yawDeg, setYawDeg] = useState<number>(0);
  const rafIdRef = useRef<number | null>(null);

  // Fixed control sizes - consistent UI regardless of map dimensions
  // Controls should not scale with map size, just position at corners
  const controlSize = 40;
  const controlPadding = 12;

  // Subscribe to camera updates for compass rotation
  useEffect(() => {
    const updateYaw = () => {
      if (world.camera) {
        const cam = world.camera;
        const forward = new THREE.Vector3();
        cam.getWorldDirection(forward);
        forward.y = 0;
        if (forward.lengthSq() > 1e-6) {
          forward.normalize();
          const yaw = Math.atan2(forward.x, -forward.z);
          const newYawDeg = THREE.MathUtils.radToDeg(yaw);
          setYawDeg((prev) =>
            Math.abs(prev - newYawDeg) > 0.1 ? newYawDeg : prev,
          );
        }
      }
      rafIdRef.current = requestAnimationFrame(updateYaw);
    };

    rafIdRef.current = requestAnimationFrame(updateYaw);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [world]);

  // Handle compass click - reset camera to face North
  const handleCompassClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (onCompassClick) {
      onCompassClick();
      return;
    }

    // Default behavior: reset camera to face North
    const camSys = world.getSystem("client-camera-system") as {
      resetCamera?: () => void;
    } | null;
    camSys?.resetCamera?.();
  };

  return (
    <div
      className="absolute pointer-events-none z-10"
      style={{
        top: 0,
        left: 0,
        width,
        height,
      }}
    >
      {/* Compass control - top left */}
      <div
        title="Click to face North"
        onClick={handleCompassClick}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onWheel={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className="absolute rounded-full border border-white/60 bg-black/60 flex items-center justify-center cursor-pointer pointer-events-auto touch-manipulation"
        style={{
          top: controlPadding,
          left: controlPadding,
          width: controlSize,
          height: controlSize,
        }}
      >
        <div
          className="relative pointer-events-none"
          style={{
            width: controlSize * 0.7,
            height: controlSize * 0.7,
            transform: `rotate(${yawDeg}deg)`,
          }}
        >
          {/* Rotating ring */}
          <div className="absolute inset-0 rounded-full border border-white/50 pointer-events-none" />
          {/* N marker at top of compass (rotates with ring) */}
          <div className="absolute left-1/2 top-0.5 -translate-x-1/2 text-[11px] text-red-500 font-semibold shadow-[0_1px_1px_rgba(0,0,0,0.8)] pointer-events-none">
            N
          </div>
          {/* S/E/W faint labels */}
          <div className="absolute left-1/2 bottom-0.5 -translate-x-1/2 text-[9px] text-white/70 pointer-events-none">
            S
          </div>
          <div className="absolute top-1/2 left-0.5 -translate-y-1/2 text-[9px] text-white/70 pointer-events-none">
            W
          </div>
          <div className="absolute top-1/2 right-0.5 -translate-y-1/2 text-[9px] text-white/70 pointer-events-none">
            E
          </div>
        </div>
      </div>

      {/* Home Teleport Orb - bottom left corner */}
      <div
        className="absolute pointer-events-auto"
        style={{
          bottom: controlPadding,
          left: controlPadding,
        }}
      >
        <MinimapHomeTeleportOrb world={world} size={controlSize} />
      </div>

      {/* Stamina Orb - bottom right corner */}
      <div
        className="absolute pointer-events-auto"
        style={{
          bottom: controlPadding,
          right: controlPadding,
        }}
      >
        <MinimapStaminaOrb world={world} size={controlSize} />
      </div>
    </div>
  );
}
