import React, { useState, useEffect } from 'react'
import styled from 'styled-components'
import type { 
  RPGEquipmentUpdateEvent,
  RPGEquipmentUnequipEvent
} from '../../types/rpg-events'

interface EquipmentItem {
  id: number
  name: string
  type: 'weapon' | 'shield' | 'helmet' | 'body' | 'legs' | 'arrows'
  stats?: {
    attack?: number
    defense?: number
    strength?: number
  }
  count?: number // For arrows
}

interface EquipmentSlots {
  weapon?: EquipmentItem
  shield?: EquipmentItem
  helmet?: EquipmentItem
  body?: EquipmentItem
  legs?: EquipmentItem
  arrows?: EquipmentItem
}

const EquipmentContainer = styled.div`
  position: fixed;
  top: 50%;
  right: 20px;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.9);
  border: 2px solid #444;
  border-radius: 8px;
  padding: 20px;
  color: white;
  min-width: 280px;
`

const EquipmentGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 70px);
  grid-template-rows: repeat(3, 70px);
  gap: 10px;
  justify-content: center;
  margin: 20px 0;
`

const EquipmentSlot = styled.div<{ isEmpty?: boolean; gridArea?: string }>`
  width: 70px;
  height: 70px;
  background: ${props => props.isEmpty ? '#111' : '#333'};
  border: 2px solid ${props => props.isEmpty ? '#555' : '#777'};
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  cursor: pointer;
  position: relative;
  grid-area: ${props => props.gridArea};
  
  &:hover {
    border-color: #999;
    background: ${props => props.isEmpty ? '#222' : '#444'};
  }
`

const SlotLabel = styled.div`
  font-size: 10px;
  color: #888;
  text-align: center;
  margin-top: 2px;
  white-space: nowrap;
`

const ItemName = styled.div`
  font-size: 11px;
  text-align: center;
  font-weight: bold;
  color: #fff;
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
`

const ItemStats = styled.div`
  position: absolute;
  bottom: -25px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid #666;
  border-radius: 4px;
  padding: 5px;
  font-size: 10px;
  color: #ccc;
  white-space: nowrap;
  z-index: 1000;
  display: none;
`

const StatsContainer = styled.div`
  margin-top: 15px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
`

const StatRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin: 3px 0;
  font-size: 12px;
`

const ArrowCount = styled.div`
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  border-radius: 3px;
  padding: 2px 4px;
  font-size: 10px;
  font-weight: bold;
`

export const RPGEquipmentUI: React.FC<{ 
  isOpen: boolean
  onClose: () => void
  playerId: string
}> = ({ isOpen, onClose, playerId }) => {
  const [equipment, setEquipment] = useState<EquipmentSlots>({})
  const [totalStats, setTotalStats] = useState({ attack: 0, defense: 0, strength: 0 })

  useEffect(() => {
    if (!isOpen) return

    // Listen for equipment updates
    const handleEquipmentUpdate = (event: RPGEquipmentUpdateEvent) => {
      if (event.detail.playerId === playerId) {
        const newEquipment = event.detail.equipment || {}
        setEquipment(newEquipment)
        
        // Calculate total stats
        let attack = 0, defense = 0, strength = 0
        Object.values(newEquipment).forEach((item) => {
          const equipmentItem = item as EquipmentItem
          if (equipmentItem?.stats) {
            attack += equipmentItem.stats.attack || 0
            defense += equipmentItem.stats.defense || 0
            strength += equipmentItem.stats.strength || 0
          }
        })
        setTotalStats({ attack, defense, strength })
      }
    }

    window.addEventListener('rpg:equipment:updated', handleEquipmentUpdate)

    return () => {
      window.removeEventListener('rpg:equipment:updated', handleEquipmentUpdate)
    }
  }, [isOpen, playerId])

  if (!isOpen) return null

  const handleUnequip = (slot: string) => {
    window.dispatchEvent(new CustomEvent('rpg:equipment:unequip', {
      detail: { playerId, slot }
    }) as RPGEquipmentUnequipEvent)
  }

  const renderSlot = (slotType: keyof EquipmentSlots, label: string, gridArea?: string) => {
    const item = equipment[slotType]
    
    return (
      <EquipmentSlot 
        key={slotType}
        isEmpty={!item}
        gridArea={gridArea}
        onClick={() => item && handleUnequip(slotType)}
        onMouseEnter={(e) => {
          const stats = e.currentTarget.querySelector('.item-stats') as HTMLElement
          if (stats) stats.style.display = 'block'
        }}
        onMouseLeave={(e) => {
          const stats = e.currentTarget.querySelector('.item-stats') as HTMLElement
          if (stats) stats.style.display = 'none'
        }}
      >
        {item ? (
          <>
            <ItemName>{item.name}</ItemName>
            {item.type === 'arrows' && item.count && (
              <ArrowCount>{item.count}</ArrowCount>
            )}
            {item.stats && (
              <ItemStats className="item-stats">
                {item.stats.attack && <div>Attack: +{item.stats.attack}</div>}
                {item.stats.defense && <div>Defense: +{item.stats.defense}</div>}
                {item.stats.strength && <div>Strength: +{item.stats.strength}</div>}
              </ItemStats>
            )}
          </>
        ) : (
          <SlotLabel>{label}</SlotLabel>
        )}
      </EquipmentSlot>
    )
  }

  return (
    <EquipmentContainer>
      <h2 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>Equipment</h2>
      <button 
        onClick={onClose}
        style={{ 
          position: 'absolute', 
          top: '10px', 
          right: '10px',
          background: 'none',
          border: '1px solid #666',
          color: 'white',
          cursor: 'pointer',
          borderRadius: '3px',
          padding: '2px 6px'
        }}
      >
        ×
      </button>

      <EquipmentGrid>
        {renderSlot('helmet', 'Helmet', '2 / 1')}
        {renderSlot('weapon', 'Weapon', '1 / 2')}
        {renderSlot('body', 'Body', '2 / 2')}
        {renderSlot('shield', 'Shield', '3 / 2')}
        {renderSlot('legs', 'Legs', '2 / 3')}
        {renderSlot('arrows', 'Arrows', '3 / 3')}
      </EquipmentGrid>

      <StatsContainer>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Total Stats</h3>
        <StatRow>
          <span>Attack Bonus:</span>
          <span style={{ color: totalStats.attack > 0 ? '#4caf50' : '#888' }}>
            +{totalStats.attack}
          </span>
        </StatRow>
        <StatRow>
          <span>Defense Bonus:</span>
          <span style={{ color: totalStats.defense > 0 ? '#4caf50' : '#888' }}>
            +{totalStats.defense}
          </span>
        </StatRow>
        <StatRow>
          <span>Strength Bonus:</span>
          <span style={{ color: totalStats.strength > 0 ? '#4caf50' : '#888' }}>
            +{totalStats.strength}
          </span>
        </StatRow>
      </StatsContainer>

      <div style={{ marginTop: '15px', fontSize: '12px', color: '#888' }}>
        Click equipped items to unequip them
      </div>
    </EquipmentContainer>
  )
}