import React, { useEffect, useState, useRef, useCallback } from "react";
import { THREE } from "@hyperscape/shared";
import type { ClientWorld } from "../types";

interface MinimapCompassProps {
  world: ClientWorld;
  onClick: () => void;
  isCollapsed: boolean;
}

const _forwardVec = new THREE.Vector3();

const stopEvent = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

export function MinimapCompass({
  world,
  onClick,
  isCollapsed,
}: MinimapCompassProps) {
  const [yawDeg, setYawDeg] = useState<number>(0);
  const lastYawRef = useRef<number>(0);

  useEffect(() => {
    let rafId: number | null = null;
    const loop = () => {
      if (world.camera) {
        world.camera.getWorldDirection(_forwardVec);
        _forwardVec.y = 0;
        if (_forwardVec.lengthSq() > 1e-6) {
          _forwardVec.normalize();
          const yaw = Math.atan2(_forwardVec.x, -_forwardVec.z);
          const newYawDeg = THREE.MathUtils.radToDeg(yaw);
          if (Math.abs(newYawDeg - lastYawRef.current) > 0.1) {
            lastYawRef.current = newYawDeg;
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

  const handleClick = useCallback((e: React.MouseEvent) => {
    stopEvent(e);
    onClick();
  }, [onClick]);

  return (
    <div
      onClick={handleClick}
      onMouseDown={stopEvent}
      onContextMenu={stopEvent}
      className="w-10 h-10 rounded-full border-2 border-white/30 bg-black/80 flex items-center justify-center cursor-pointer relative shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
      title={isCollapsed ? "Show minimap" : "Hide minimap"}
    >
      <div
        className="relative w-7 h-7 pointer-events-none"
        style={{ transform: `rotate(${yawDeg}deg)` }}
      >
        <div className="absolute inset-0 rounded-full border border-white/50 pointer-events-none" />
        <div className="absolute left-1/2 top-0.5 -translate-x-1/2 text-[11px] text-red-500 font-semibold shadow-[0_1px_1px_rgba(0,0,0,0.8)] pointer-events-none">
          N
        </div>
      </div>
    </div>
  );
}
