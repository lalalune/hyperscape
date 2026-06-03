import React, { useEffect, useRef, useState } from "react";
import { THREE } from "@hyperforge/shared";
import { useThemeStore } from "@/ui";
import { borderRadius, animation } from "../../constants";
import type { ClientWorld } from "../../types";

/** Size presets matching MenuButton */
const SIZE_CONFIG = {
  compact: {
    size: 30,
    innerSize: 18,
    fontSize: 8,
    borderWidth: 2,
    hoverScale: 1.1,
  },
  small: {
    size: 38,
    innerSize: 24,
    fontSize: 10,
    borderWidth: 2,
    hoverScale: 1.1,
  },
  normal: {
    size: 44,
    innerSize: 28,
    fontSize: 11,
    borderWidth: 3,
    hoverScale: 1.1,
  },
} as const;

interface MinimapCompassProps {
  world: ClientWorld;
  onClick: () => void;
  isCollapsed: boolean;
  /** Size variant to match MenuButton sizing */
  size?: "compact" | "small" | "normal";
}

// Pre-allocated temp vector for RAF loop - avoids GC pressure
const _tempForward = new THREE.Vector3();

export function MinimapCompass({
  world,
  onClick,
  isCollapsed,
  size = "normal",
}: MinimapCompassProps) {
  const theme = useThemeStore((s) => s.theme);
  const [yawDeg, setYawDeg] = useState<number>(0);
  const [isHovered, setIsHovered] = useState(false);
  // Ref to track previous yaw to avoid unnecessary state updates
  const prevYawRef = useRef<number>(0);

  const config = SIZE_CONFIG[size];

  useEffect(() => {
    let rafId: number | null = null;
    const loop = () => {
      if (world.camera) {
        // Reuse pre-allocated vector instead of creating new one
        world.camera.getWorldDirection(_tempForward);
        _tempForward.y = 0;
        if (_tempForward.lengthSq() > 1e-6) {
          _tempForward.normalize();
          const yaw = Math.atan2(_tempForward.x, -_tempForward.z);
          const newYawDeg = THREE.MathUtils.radToDeg(yaw);
          // Only update state if yaw changed significantly (> 0.1 degrees)
          if (Math.abs(prevYawRef.current - newYawDeg) > 0.1) {
            prevYawRef.current = newYawDeg;
            setYawDeg(newYawDeg);
          }
        }
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [world]);

  return (
    <div
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{
        width: config.size,
        height: config.size,
        borderRadius: borderRadius.full,
        border: `${config.borderWidth}px solid ${isHovered ? theme.colors.accent.primary : theme.colors.border.decorative}`,
        background: theme.colors.background.primary,
        boxShadow:
          "0 4px 12px rgba(0, 0, 0, 0.6), inset 0 0 4px rgba(0, 0, 0, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        position: "relative",
        flexShrink: 0,
        transition: `all ${animation.duration.base} ${animation.easing.easeOut}`,
        transform: isHovered ? `scale(${config.hoverScale})` : "scale(1)",
      }}
      title={isCollapsed ? "Show minimap" : "Hide minimap"}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        style={{
          position: "relative",
          width: config.innerSize,
          height: config.innerSize,
          pointerEvents: "none",
          transform: `rotate(${yawDeg}deg)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: borderRadius.full,
            border: `1px solid rgba(255, 255, 255, 0.5)`,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 1,
            transform: "translateX(-50%)",
            fontSize: config.fontSize,
            color: theme.colors.state.danger,
            fontWeight: 600,
            textShadow: "0 1px 1px rgba(0, 0, 0, 0.8)",
            pointerEvents: "none",
          }}
        >
          N
        </div>
      </div>
    </div>
  );
}
