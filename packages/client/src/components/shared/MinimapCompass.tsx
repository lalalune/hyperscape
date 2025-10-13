import React, { useEffect, useState } from 'react'
import type { World } from '@hyperscape/shared'
import { THREE } from '@hyperscape/shared'

interface MinimapCompassProps {
  world: World
  onClick: () => void
  isCollapsed: boolean
}

export function MinimapCompass({ world, onClick, isCollapsed }: MinimapCompassProps) {
  const [yawDeg, setYawDeg] = useState<number>(0)
  
  useEffect(() => {
    let rafId: number | null = null
    const loop = () => {
      if (world.camera) {
        const forward = new THREE.Vector3()
        world.camera.getWorldDirection(forward)
        forward.y = 0
        if (forward.lengthSq() > 1e-6) {
          forward.normalize()
          const yaw = Math.atan2(forward.x, -forward.z)
          setYawDeg(THREE.MathUtils.radToDeg(yaw))
        }
      }
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
    return () => { if (rafId !== null) window.cancelAnimationFrame(rafId) }
  }, [world])
  
  return (
    <div
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      className="w-10 h-10 rounded-full border-2 border-white/30 bg-black/80 flex items-center justify-center cursor-pointer relative shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
      title={isCollapsed ? "Show minimap" : "Hide minimap"}
    >
      <div 
        className="relative w-7 h-7 pointer-events-none"
        style={{ transform: `rotate(${yawDeg}deg)` }}
      >
        <div className="absolute inset-0 rounded-full border border-white/50 pointer-events-none" />
        <div className="absolute left-1/2 top-0.5 -translate-x-1/2 text-[11px] text-red-500 font-semibold shadow-[0_1px_1px_rgba(0,0,0,0.8)] pointer-events-none">N</div>
      </div>
    </div>
  )
}


