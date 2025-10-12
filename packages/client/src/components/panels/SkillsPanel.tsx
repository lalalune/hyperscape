import React, { useState } from 'react'
import type { World } from '@hyperscape/shared'
import type { PlayerStats } from '@hyperscape/shared'

interface SkillsPanelProps {
  world: World
  stats: PlayerStats | null
}

export function SkillsPanel({ world: _world, stats }: SkillsPanelProps) {
  const s = stats?.skills || ({} as NonNullable<PlayerStats['skills']>)
  const items = [
    { key: 'attack', label: 'Attack', icon: '⚔️', level: s?.attack?.level || 1, xp: s?.attack?.xp || 0 },
    { key: 'constitution', label: 'Constitution', icon: '❤️', level: Math.max(10, s?.constitution?.level || 10), xp: s?.constitution?.xp || 0 },
    { key: 'strength', label: 'Strength', icon: '💪', level: s?.strength?.level || 1, xp: s?.strength?.xp || 0 },
    { key: 'defense', label: 'Defense', icon: '🛡️', level: s?.defense?.level || 1, xp: s?.defense?.xp || 0 },
    { key: 'ranged', label: 'Ranged', icon: '🏹', level: s?.ranged?.level || 1, xp: s?.ranged?.xp || 0 },
    { key: 'woodcutting', label: 'Woodcutting', icon: '🪓', level: s?.woodcutting?.level || 1, xp: s?.woodcutting?.xp || 0 },
    { key: 'fishing', label: 'Fishing', icon: '🎣', level: s?.fishing?.level || 1, xp: s?.fishing?.xp || 0 },
    { key: 'firemaking', label: 'Firemaking', icon: '🔥', level: s?.firemaking?.level || 1, xp: s?.firemaking?.xp || 0 },
    { key: 'cooking', label: 'Cooking', icon: '🍳', level: s?.cooking?.level || 1, xp: s?.cooking?.xp || 0 }
  ]
  const totalLevel = items.reduce((sum, it) => sum + (it.level || 1), 0)
  const totalXP = items.reduce((sum, it) => sum + (it.xp || 0), 0)
  const [hover, setHover] = useState<{ label: string; xp: number } | null>(null)
  const [mouse, setMouse] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  return (
    <div className="relative h-full" onMouseMove={(e) => setMouse({ x: e.clientX, y: e.clientY })}>
      <div className="grid grid-cols-3 gap-1.5">
        {items.map((it) => (
          <div key={it.key} 
            className="bg-black/35 border border-white/[0.08] rounded-md py-1.5 px-2 flex items-center justify-center flex-col text-[13px] cursor-default"
            onMouseEnter={() => setHover({ label: it.label, xp: it.xp })}
            onMouseLeave={() => setHover(null)}
          >
            <span className="text-lg">{it.icon}</span>
            <span>{it.level}/{it.level}</span>
          </div>
        ))}
      </div>
      <div
        className="absolute left-2 right-2 bottom-2 text-right text-gray-400 text-xs cursor-default"
        onMouseEnter={() => setHover({ label: 'Total', xp: totalXP })}
        onMouseLeave={() => setHover(null)}
      >
        Total level: {totalLevel}
      </div>
      {hover && (
        (() => {
          const pad = 12
          const tooltipWidth = 160
          const tooltipHeight = 56
          let left = mouse.x + pad
          if (left + tooltipWidth > window.innerWidth - 8) left = mouse.x - tooltipWidth - pad
          if (left < 8) left = 8
          let top = mouse.y + pad
          if (top + tooltipHeight > window.innerHeight - 8) top = mouse.y - tooltipHeight - pad
          if (top < 8) top = 8
          return (
            <div 
              className="fixed bg-[rgba(20,20,28,0.98)] border border-white/15 rounded-md p-1.5 text-white text-xs pointer-events-none z-[200]"
              style={{ left, top, width: tooltipWidth }}
            >
              <div className="font-semibold mb-0.5">
                {hover.label === 'Total' ? 'Total Experience' : hover.label}
              </div>
              <div>{hover.label === 'Total' ? 'Total XP' : 'XP'}: {Math.floor(hover.xp).toLocaleString()}</div>
            </div>
          )
        })()
      )}
    </div>
  )
}


