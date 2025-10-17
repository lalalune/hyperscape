import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { PlayerEquipmentItems, Item } from '@hyperscape/shared'
import { EquipmentSlotName } from '@hyperscape/shared'

interface EquipmentPanelProps {
  equipment: PlayerEquipmentItems | null
  onItemDrop?: (item: Item, slot: EquipmentSlotName) => void
}

interface DroppableEquipmentSlotProps {
  slotKey: EquipmentSlotName
  label: string
  item: Item | null
}

function DroppableEquipmentSlot({ slotKey, label, item }: DroppableEquipmentSlotProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `equipment-${slotKey}`,
    data: { slot: slotKey }
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
  const itemMap: Record<string, Item | null> = equipment ? equipment as Record<string, Item | null> : {}

  return (
    <div>
      <div className="bg-black/35 border rounded-md p-2" style={{ borderColor: 'rgba(242, 208, 138, 0.3)' }}>
        <div className="grid grid-cols-3 grid-rows-4 gap-1.5">
          {slots.map((s) => (
            <div key={s.key} className="w-full aspect-square">
              <DroppableEquipmentSlot
                slotKey={s.key}
                label={s.label}
                item={(itemMap && s.key in itemMap ? itemMap[s.key] : null) as Item | null}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

