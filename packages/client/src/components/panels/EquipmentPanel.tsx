import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { EquipmentSlotName } from '@hyperscape/shared'
import type { PlayerEquipmentItems, Item } from '../../types'

interface EquipmentPanelProps {
  equipment: PlayerEquipmentItems | null
  onItemDrop?: (item: Item, slot: keyof typeof EquipmentSlotName) => void
}

interface DroppableEquipmentSlotProps {
  slotKey: string
  label: string
  item: Item | null
}

function DroppableEquipmentSlot({ slotKey, label, item }: DroppableEquipmentSlotProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `equipment-${String(slotKey)}`,
    data: { slot: String(slotKey) }
  })

  return (
    <div
      ref={setNodeRef}
      className="bg-black/35 border rounded-md flex items-center justify-center text-[11px] relative"
      style={{
        borderColor: isOver ? 'rgba(242, 208, 138, 0.7)' : 'rgba(242, 208, 138, 0.3)',
        backgroundColor: isOver ? 'rgba(242, 208, 138, 0.15)' : 'rgba(0, 0, 0, 0.35)',
        color: 'rgba(242, 208, 138, 0.9)',
      }}
      title={item ? item.name : label}
    >
      <div className="absolute top-1 left-1.5 text-[10px]" style={{ color: 'rgba(242, 208, 138, 0.7)' }}>{label}</div>
      <div className="text-xs">
        {item ? (item.id.substring(0, 3)) : ''}
      </div>
    </div>
  )
}

export function EquipmentPanel({ equipment, onItemDrop: _onItemDrop }: EquipmentPanelProps) {
  const slots = [
    { key: EquipmentSlotName.HELMET, label: 'Helmet' },
    { key: EquipmentSlotName.BODY, label: 'Body' },
    { key: EquipmentSlotName.LEGS, label: 'Legs' },
    { key: EquipmentSlotName.WEAPON, label: 'Weapon' },
    { key: EquipmentSlotName.SHIELD, label: 'Shield' },
    { key: EquipmentSlotName.ARROWS, label: 'Arrows' },
  ]

  // Equipment slots are keyed by EquipmentSlotName enum values
  const itemMap: Record<string, Item | null> = equipment ? {
    helmet: equipment.helmet || null,
    body: equipment.body || null,
    legs: equipment.legs || null,
    weapon: equipment.weapon || null,
    shield: equipment.shield || null,
    arrows: equipment.arrows || null,
  } : {}

  return (
    <div>
      <div className="bg-black/35 border rounded-md p-2" style={{ borderColor: 'rgba(242, 208, 138, 0.3)' }}>
        <div className="grid grid-cols-3 grid-rows-4 gap-1.5">
          {slots.map((s) => (
            <div key={String(s.key)} className="w-full aspect-square">
              <DroppableEquipmentSlot
                slotKey={String(s.key)}
                label={s.label}
                item={(itemMap && Object.prototype.hasOwnProperty.call(itemMap, String(s.key)) ? itemMap[String(s.key)] : null) as Item | null}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

