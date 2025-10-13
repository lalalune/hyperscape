import React, { useEffect, useState } from 'react'
import type { World } from '@hyperscape/shared'
import type { PlayerLocal } from '@hyperscape/shared'

interface MinimapStaminaBarProps {
  world: World
  width: number
}

export function MinimapStaminaBar({ world, width }: MinimapStaminaBarProps) {
  const [runMode, setRunMode] = useState<boolean>(true)
  const [stamina, setStamina] = useState<number>(100)
  
  useEffect(() => {
    const update = () => {
      const pl = world.entities.player as unknown as PlayerLocal | undefined
      if (pl) {
        setRunMode(pl.runMode)
        setStamina(pl.stamina)
      }
    }
    const id = setInterval(update, 200)
    update()
    return () => clearInterval(id)
  }, [world])
  
  const toggleRunMode = () => {
    const worldWithPlayer = world as unknown as { entities: { player: PlayerLocal }; network: { send: (method: string, data: { runMode: boolean }) => void } }
    const pl = worldWithPlayer.entities.player
    pl.toggleRunMode()
    setRunMode(pl.runMode === true)
    worldWithPlayer.network.send('moveRequest', { runMode: pl.runMode })
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

