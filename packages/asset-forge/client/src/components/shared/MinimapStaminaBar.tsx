import React, { useEffect, useState } from 'react'
import type { ClientWorld } from '../../types'

interface MinimapStaminaBarProps {
  world: ClientWorld
  width: number
}

export function MinimapStaminaBar({ world, width }: MinimapStaminaBarProps) {
  const [runMode, setRunMode] = useState<boolean>(true)
  const [stamina, setStamina] = useState<number>(100)
  
  useEffect(() => {
    const update = () => {
      const player = world.entities?.player
      if (player) {
        setRunMode(player.runMode ?? true)
        setStamina(player.stamina ?? 100)
      }
    }
    const id = setInterval(update, 200)
    update()
    return () => clearInterval(id)
  }, [world])
  
  const toggleRunMode = () => {
    const player = world.entities?.player
    player?.toggleRunMode?.()
    setRunMode(player?.runMode === true)
    world.network?.send?.('moveRequest', { runMode: player?.runMode })
  }
  
  return (
    <div
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleRunMode()
      }}
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      className="h-6 rounded-md border-2 border-white/30 bg-black/80 cursor-pointer relative overflow-hidden flex items-center justify-center"
      style={{ width }}
      title={runMode ? 'Running (click to walk)' : 'Walking (click to run)'}
    >
      <div
        className="absolute left-0 top-0 bottom-0 transition-[width] duration-300 ease-out pointer-events-none"
        style={{
          width: `${Math.max(0, Math.min(100, stamina))}%`,
          background: runMode 
            ? 'linear-gradient(90deg, #00ff88, #00cc66)' 
            : 'linear-gradient(90deg, #ffa500, #ff8800)',
        }}
      />
      <div className="relative z-[1] text-white text-[10px] font-semibold pointer-events-none">
        {runMode ? '🏃' : '🚶'} {Math.round(stamina)}%
      </div>
    </div>
  )
}

