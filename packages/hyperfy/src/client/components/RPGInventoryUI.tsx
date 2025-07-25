import React, { useState, useEffect } from 'react'
import styled from 'styled-components'
import type { 
  RPGInventoryUpdateEvent,
  RPGEquipmentUpdateEvent,
  RPGInventoryEquipEvent
} from '../../types/rpg-events'

interface InventoryItem {
  id: number
  name: string
  quantity: number
  stackable: boolean
  slotIndex?: number
}

interface EquipmentSlots {
  weapon?: InventoryItem
  shield?: InventoryItem
  helmet?: InventoryItem
  body?: InventoryItem
  legs?: InventoryItem
  arrows?: InventoryItem & { count: number }
}

const InventoryContainer = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.9);
  border: 2px solid #444;
  border-radius: 8px;
  padding: 20px;
  color: white;
  min-width: 400px;
  max-width: 600px;
`

const InventoryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 50px);
  gap: 5px;
  margin-top: 20px;
`

const InventorySlot = styled.div<{ occupied?: boolean }>`
  width: 50px;
  height: 50px;
  background: ${props => props.occupied ? '#333' : '#111'};
  border: 1px solid #555;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  
  &:hover {
    border-color: #888;
  }
`

const ItemQuantity = styled.span`
  position: absolute;
  bottom: 2px;
  right: 2px;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.8);
  padding: 2px 4px;
  border-radius: 3px;
`

const EquipmentSection = styled.div`
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
`

const EquipmentSlot = styled.div`
  width: 60px;
  height: 60px;
  background: #222;
  border: 2px solid #666;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  cursor: pointer;
  
  &:hover {
    border-color: #999;
  }
`

const SlotLabel = styled.div`
  font-size: 10px;
  color: #888;
  margin-top: 2px;
`

export const RPGInventoryUI: React.FC<{ 
  isOpen: boolean
  onClose: () => void
  playerId: string
}> = ({ isOpen, onClose, playerId }) => {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [equipment, setEquipment] = useState<EquipmentSlots>({})
  const [draggedItem, setDraggedItem] = useState<InventoryItem | null>(null)

  useEffect(() => {
    if (!isOpen) return

    // Listen for inventory updates
    const handleInventoryUpdate = (event: RPGInventoryUpdateEvent) => {
      if (event.detail.playerId === playerId) {
        setInventory(event.detail.inventory?.items || [])
      }
    }

    const handleEquipmentUpdate = (event: RPGEquipmentUpdateEvent) => {
      if (event.detail.playerId === playerId) {
        setEquipment(event.detail.equipment || {})
      }
    }

    window.addEventListener('rpg:inventory:updated', handleInventoryUpdate)
    window.addEventListener('rpg:equipment:updated', handleEquipmentUpdate)

    return () => {
      window.removeEventListener('rpg:inventory:updated', handleInventoryUpdate)
      window.removeEventListener('rpg:equipment:updated', handleEquipmentUpdate)
    }
  }, [isOpen, playerId])

  if (!isOpen) return null

  const handleDragStart = (item: InventoryItem) => {
    setDraggedItem(item)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
  }

  const handleDrop = (slot: string) => {
    if (!draggedItem) return
    
    // Emit equip event
    window.dispatchEvent(new CustomEvent('rpg:inventory:equip', {
      detail: { playerId, itemId: draggedItem.id, slot }
    }) as RPGInventoryEquipEvent)
  }

  const inventorySlots = Array(28).fill(null)
  inventory.forEach(item => {
    if (item.slotIndex !== undefined && item.slotIndex < 28) {
      inventorySlots[item.slotIndex] = item
    }
  })

  return (
    <InventoryContainer>
      <h2>Inventory</h2>
      <button 
        onClick={onClose}
        style={{ position: 'absolute', top: '10px', right: '10px' }}
      >
        X
      </button>

      <EquipmentSection>
        <div>
          <h3>Equipment</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <EquipmentSlot
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop('weapon')}
            >
              {equipment.weapon?.name || 'Empty'}
              <SlotLabel>Weapon</SlotLabel>
            </EquipmentSlot>
            
            <EquipmentSlot
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop('shield')}
            >
              {equipment.shield?.name || 'Empty'}
              <SlotLabel>Shield</SlotLabel>
            </EquipmentSlot>
            
            <EquipmentSlot
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop('helmet')}
            >
              {equipment.helmet?.name || 'Empty'}
              <SlotLabel>Helmet</SlotLabel>
            </EquipmentSlot>
            
            <EquipmentSlot
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop('body')}
            >
              {equipment.body?.name || 'Empty'}
              <SlotLabel>Body</SlotLabel>
            </EquipmentSlot>
            
            <EquipmentSlot
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop('legs')}
            >
              {equipment.legs?.name || 'Empty'}
              <SlotLabel>Legs</SlotLabel>
            </EquipmentSlot>
            
            <EquipmentSlot
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop('arrows')}
            >
              {equipment.arrows ? `${equipment.arrows.count}` : 'Empty'}
              <SlotLabel>Arrows</SlotLabel>
            </EquipmentSlot>
          </div>
        </div>
      </EquipmentSection>

      <h3>Backpack (28 slots)</h3>
      <InventoryGrid>
        {inventorySlots.map((item, index) => (
          <InventorySlot
            key={index}
            occupied={!!item}
            draggable={!!item}
            onDragStart={() => item && handleDragStart(item)}
            onDragEnd={handleDragEnd}
          >
            {item && (
              <>
                {item.name.substring(0, 3)}
                {item.stackable && item.quantity > 1 && (
                  <ItemQuantity>{item.quantity}</ItemQuantity>
                )}
              </>
            )}
          </InventorySlot>
        ))}
      </InventoryGrid>
    </InventoryContainer>
  )
}