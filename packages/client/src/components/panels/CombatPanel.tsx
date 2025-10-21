import React, { useEffect, useState } from 'react'
import { PlayerMigration, WeaponType, EventType } from '@hyperscape/shared'
import type { ClientWorld, PlayerStats, PlayerEquipmentItems } from '../../types'

interface CombatPanelProps {
  world: ClientWorld
  stats: PlayerStats | null
  equipment: PlayerEquipmentItems | null
}

export function CombatPanel({ world, stats, equipment }: CombatPanelProps) {
  const [style, setStyle] = useState<string>('accurate')
  const [cooldown, setCooldown] = useState<number>(0)
  const combatLevel = stats?.combatLevel || (stats?.skills ? PlayerMigration.calculateCombatLevel(stats.skills) : 1)

  useEffect(() => {
    const playerId = world.entities?.player?.id
    if (!playerId) return
    
    const actions = world.getSystem('actions') as { actionMethods?: { 
      getAttackStyleInfo?: (id: string, cb: (info: { style: string; cooldown?: number }) => void) => void 
      changeAttackStyle?: (id: string, style: string) => void
    }} | null
    
    actions?.actionMethods?.getAttackStyleInfo?.(playerId, (info: { style: string; cooldown?: number }) => {
      if (info) {
        setStyle(info.style)
        setCooldown(info.cooldown || 0)
      }
    })
    const onUpdate = (data: unknown) => {
      const d = data as { playerId: string; currentStyle: { id: string } }
      if (d.playerId !== playerId) return
      setStyle(d.currentStyle.id)
    }
    const onChanged = (data: unknown) => {
      const d = data as { playerId: string; currentStyle: { id: string } }
      if (d.playerId !== playerId) return
      setStyle(d.currentStyle.id)
    }
    world.on(EventType.UI_ATTACK_STYLE_UPDATE, onUpdate, undefined)
    world.on(EventType.UI_ATTACK_STYLE_CHANGED, onChanged, undefined)
    return () => {
      world.off(EventType.UI_ATTACK_STYLE_UPDATE, onUpdate, undefined, undefined)
      world.off(EventType.UI_ATTACK_STYLE_CHANGED, onChanged, undefined, undefined)
    }
  }, [world])

  const changeStyle = (next: string) => {
    const playerId = world.entities?.player?.id
    if (!playerId) return
    
    const actions = world.getSystem('actions') as { actionMethods?: { 
      changeAttackStyle?: (id: string, style: string) => void
    }} | null
    
    actions?.actionMethods?.changeAttackStyle?.(playerId, next)
  }

  // Determine if ranged weapon equipped; if so, limit to ranged/defense like RS
  const isRanged = !!(equipment?.arrows || (equipment?.weapon && (equipment.weapon.weaponType === WeaponType.BOW || equipment.weapon.weaponType === WeaponType.CROSSBOW)))
  const styles: Array<{ id: string; label: string }> = isRanged
    ? [
        { id: 'accurate', label: 'Ranged' },
        { id: 'defensive', label: 'Defensive' },
      ]
    : [
        { id: 'accurate', label: 'Accurate' },
        { id: 'aggressive', label: 'Aggressive' },
        { id: 'defensive', label: 'Defensive' },
      ]

  return (
    <div className="flex flex-col gap-2">
      <div
        className="bg-black/35 border rounded-md p-2 flex items-center justify-between"
        style={{ borderColor: 'rgba(242, 208, 138, 0.3)', color: '#f2d08a' }}
      >
        <div className="font-semibold">Combat level</div>
        <div>{combatLevel}</div>
      </div>
      <div className="font-semibold mt-1" style={{ color: '#f2d08a' }}>Attack style</div>
      <div className="grid grid-cols-2 gap-1.5">
        {styles.map(s => (
          <button
            key={s.id}
            onClick={() => changeStyle(s.id)}
            disabled={cooldown > 0}
            className="rounded-md py-2 px-2.5 cursor-pointer"
            style={{
              backgroundColor: style === s.id ? 'rgba(242, 208, 138, 0.15)' : 'rgba(0, 0, 0, 0.35)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: style === s.id ? 'rgba(242, 208, 138, 0.7)' : 'rgba(242, 208, 138, 0.3)',
              color: style === s.id ? '#f2d08a' : '#d1d5db',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      {cooldown > 0 && (
        <div className="text-xs" style={{ color: 'rgba(242, 208, 138, 0.6)' }}>
          Style change available in {Math.ceil(cooldown / 1000)}s
        </div>
      )}
    </div>
  )
}


