import React, { useState, useEffect } from 'react'
import styled from 'styled-components'

interface StoreItem {
  id: string
  name: string
  description: string
  price: number
  category: 'weapons' | 'armor' | 'tools' | 'food' | 'misc'
  stock?: number
  levelRequirement?: number
}

interface PlayerInventory {
  coins: number
  items: Array<{
    id: string
    name: string
    quantity: number
  }>
}

const StoreContainer = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.95);
  border: 3px solid #8B4513;
  border-radius: 10px;
  padding: 20px;
  color: white;
  width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
`

const StoreHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid #654321;
`

const StoreTitle = styled.h2`
  margin: 0;
  color: #DAA520;
  font-size: 24px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
`

const CloseButton = styled.button`
  background: #8B4513;
  border: 2px solid #654321;
  color: white;
  cursor: pointer;
  border-radius: 5px;
  padding: 5px 10px;
  font-weight: bold;
  
  &:hover {
    background: #A0522D;
  }
`

const PlayerInfo = styled.div`
  background: rgba(218, 165, 32, 0.1);
  border: 1px solid #DAA520;
  border-radius: 5px;
  padding: 10px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const CoinsDisplay = styled.div`
  color: #FFD700;
  font-weight: bold;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 5px;
  
  &::before {
    content: '🪙';
  }
`

const CategoryTabs = styled.div`
  display: flex;
  gap: 5px;
  margin-bottom: 20px;
  border-bottom: 1px solid #654321;
`

const CategoryTab = styled.button<{ active: boolean }>`
  background: ${props => props.active ? '#8B4513' : 'transparent'};
  border: 1px solid #654321;
  color: ${props => props.active ? 'white' : '#ccc'};
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 5px 5px 0 0;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
  
  &:hover {
    background: ${props => props.active ? '#8B4513' : 'rgba(139, 69, 19, 0.3)'};
  }
`

const ItemGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 10px;
  
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #8B4513;
    border-radius: 4px;
  }
`

const ItemCard = styled.div<{ canAfford: boolean; hasLevel: boolean }>`
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid ${props => {
    if (!props.hasLevel) return '#f44336'
    return props.canAfford ? '#654321' : '#666'
  }};
  border-radius: 8px;
  padding: 12px;
  cursor: ${props => props.canAfford && props.hasLevel ? 'pointer' : 'not-allowed'};
  opacity: ${props => props.canAfford && props.hasLevel ? 1 : 0.6};
  transition: all 0.3s ease;
  
  &:hover {
    background: ${props => {
      if (!props.hasLevel) return 'rgba(244, 67, 54, 0.1)'
      return props.canAfford ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)'
    }};
    border-color: ${props => {
      if (!props.hasLevel) return '#f44336'
      return props.canAfford ? '#8B4513' : '#666'
    }};
  }
`

const ItemName = styled.div`
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 5px;
  color: #DAA520;
`

const ItemDescription = styled.div`
  font-size: 12px;
  color: #ccc;
  margin-bottom: 8px;
  line-height: 1.3;
`

const ItemPrice = styled.div`
  color: #FFD700;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 5px;
  
  &::before {
    content: '🪙';
  }
`

const ItemStock = styled.div`
  font-size: 11px;
  color: #888;
  margin-bottom: 5px;
`

const LevelRequirement = styled.div<{ meetsRequirement: boolean }>`
  font-size: 11px;
  color: ${props => props.meetsRequirement ? '#4caf50' : '#f44336'};
  margin-bottom: 8px;
  font-weight: bold;
`

const BuyButton = styled.button<{ canBuy: boolean }>`
  width: 100%;
  background: ${props => props.canBuy ? '#4caf50' : '#666'};
  border: none;
  color: white;
  cursor: ${props => props.canBuy ? 'pointer' : 'not-allowed'};
  padding: 8px;
  border-radius: 4px;
  font-weight: bold;
  font-size: 12px;
  
  &:hover {
    background: ${props => props.canBuy ? '#45a049' : '#666'};
  }
`

const QuantityControls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`

const QuantityButton = styled.button`
  background: #8B4513;
  border: 1px solid #654321;
  color: white;
  cursor: pointer;
  width: 24px;
  height: 24px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  
  &:hover {
    background: #A0522D;
  }
  
  &:disabled {
    background: #444;
    cursor: not-allowed;
  }
`

const QuantityInput = styled.input`
  width: 40px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid #666;
  color: white;
  text-align: center;
  border-radius: 3px;
  padding: 2px;
  font-size: 12px;
`

export const RPGStoreUI: React.FC<{ 
  isOpen: boolean
  onClose: () => void
  playerId: string
  storeType?: 'general' | 'weapon' | 'armor'
}> = ({ isOpen, onClose, playerId, storeType = 'general' }) => {
  const [storeItems, setStoreItems] = useState<StoreItem[]>([])
  const [playerInventory, setPlayerInventory] = useState<PlayerInventory>({ coins: 0, items: [] })
  const [activeCategory, setActiveCategory] = useState<StoreItem['category']>('weapons')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [playerLevel, setPlayerLevel] = useState(1)

  useEffect(() => {
    if (!isOpen) return

    // Listen for store data
    const handleStoreData = (event: CustomEvent) => {
      if (event.detail.storeType === storeType) {
        setStoreItems(event.detail.items || [])
      }
    }

    // Listen for inventory updates
    const handleInventoryUpdate = (event: CustomEvent) => {
      if (event.detail.playerId === playerId) {
        setPlayerInventory({
          coins: event.detail.coins || 0,
          items: event.detail.items || []
        })
      }
    }

    // Listen for player stats (for level requirements)
    const handleStatsUpdate = (event: CustomEvent) => {
      if (event.detail.playerId === playerId) {
        setPlayerLevel(event.detail.combatLevel || 1)
      }
    }

    // Request store data
    window.dispatchEvent(new CustomEvent('rpg:store:request', {
      detail: { playerId, storeType }
    }))

    window.addEventListener('rpg:store:data' as any, handleStoreData)
    window.addEventListener('rpg:inventory:updated' as any, handleInventoryUpdate)
    window.addEventListener('rpg:player:stats:updated' as any, handleStatsUpdate)

    return () => {
      window.removeEventListener('rpg:store:data' as any, handleStoreData)
      window.removeEventListener('rpg:inventory:updated' as any, handleInventoryUpdate)
      window.removeEventListener('rpg:player:stats:updated' as any, handleStatsUpdate)
    }
  }, [isOpen, playerId, storeType])

  if (!isOpen) return null

  const categories: StoreItem['category'][] = ['weapons', 'armor', 'tools', 'food', 'misc']
  const filteredItems = storeItems.filter(item => item.category === activeCategory)

  const getQuantity = (itemId: string) => quantities[itemId] || 1

  const setQuantity = (itemId: string, quantity: number) => {
    setQuantities(prev => ({ ...prev, [itemId]: Math.max(1, quantity) }))
  }

  const canAffordItem = (item: StoreItem, quantity: number) => {
    return playerInventory.coins >= (item.price * quantity)
  }

  const meetsLevelRequirement = (item: StoreItem) => {
    return !item.levelRequirement || playerLevel >= item.levelRequirement
  }

  const hasStock = (item: StoreItem, quantity: number) => {
    return !item.stock || item.stock >= quantity
  }

  const buyItem = (item: StoreItem) => {
    const quantity = getQuantity(item.id)
    
    if (!canAffordItem(item, quantity) || !meetsLevelRequirement(item) || !hasStock(item, quantity)) {
      return
    }

    window.dispatchEvent(new CustomEvent('rpg:store:buy', {
      detail: { 
        playerId, 
        storeType,
        itemId: item.id, 
        quantity,
        totalCost: item.price * quantity
      }
    }))

    // Reset quantity after purchase
    setQuantity(item.id, 1)
  }

  const getStoreName = () => {
    switch (storeType) {
      case 'weapon': return 'Weapon Shop'
      case 'armor': return 'Armor Shop'
      default: return 'General Store'
    }
  }

  return (
    <StoreContainer>
      <StoreHeader>
        <StoreTitle>{getStoreName()}</StoreTitle>
        <CloseButton onClick={onClose}>✕</CloseButton>
      </StoreHeader>

      <PlayerInfo>
        <div>
          <div style={{ fontSize: '14px', marginBottom: '5px' }}>Welcome, adventurer!</div>
          <div style={{ fontSize: '12px', color: '#ccc' }}>Level {playerLevel}</div>
        </div>
        <CoinsDisplay>{playerInventory.coins} coins</CoinsDisplay>
      </PlayerInfo>

      <CategoryTabs>
        {categories.map(category => (
          <CategoryTab
            key={category}
            active={activeCategory === category}
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </CategoryTab>
        ))}
      </CategoryTabs>

      <ItemGrid>
        {filteredItems.map(item => {
          const quantity = getQuantity(item.id)
          const canAfford = canAffordItem(item, quantity)
          const hasLevel = meetsLevelRequirement(item)
          const inStock = hasStock(item, quantity)
          const canBuy = canAfford && hasLevel && inStock

          return (
            <ItemCard key={item.id} canAfford={canAfford} hasLevel={hasLevel}>
              <ItemName>{item.name}</ItemName>
              <ItemDescription>{item.description}</ItemDescription>
              
              {item.levelRequirement && (
                <LevelRequirement meetsRequirement={hasLevel}>
                  Requires Level {item.levelRequirement}
                </LevelRequirement>
              )}
              
              <ItemPrice>{item.price} coins</ItemPrice>
              
              {item.stock && (
                <ItemStock>Stock: {item.stock}</ItemStock>
              )}

              <QuantityControls>
                <QuantityButton 
                  onClick={() => setQuantity(item.id, quantity - 1)}
                  disabled={quantity <= 1}
                >
                  -
                </QuantityButton>
                
                <QuantityInput
                  type="number"
                  min="1"
                  max={item.stock || 99}
                  value={quantity}
                  onChange={(e) => setQuantity(item.id, parseInt(e.target.value) || 1)}
                />
                
                <QuantityButton 
                  onClick={() => setQuantity(item.id, quantity + 1)}
                  disabled={item.stock ? quantity >= item.stock : false}
                >
                  +
                </QuantityButton>
                
                <div style={{ fontSize: '11px', color: '#888', marginLeft: '8px' }}>
                  Total: {item.price * quantity}
                </div>
              </QuantityControls>

              <BuyButton 
                canBuy={canBuy}
                onClick={() => buyItem(item)}
                disabled={!canBuy}
              >
                {!hasLevel ? 'Level Too Low' : 
                 !canAfford ? 'Not Enough Coins' :
                 !inStock ? 'Out of Stock' :
                 `Buy ${quantity > 1 ? `${quantity}x` : ''}`}
              </BuyButton>
            </ItemCard>
          )
        })}
      </ItemGrid>

      {filteredItems.length === 0 && (
        <div style={{ 
          textAlign: 'center', 
          color: '#888', 
          padding: '40px',
          fontSize: '14px'
        }}>
          No items available in this category
        </div>
      )}
    </StoreContainer>
  )
}