import React, { useState, useEffect } from 'react'
import styled from 'styled-components'
import type { 
  RPGBankUpdateEvent, 
  RPGInventoryUpdateEvent,
  RPGBankDepositEvent,
  RPGBankWithdrawEvent,
  RPGBankDepositAllEvent,
  RPGBankWithdrawAllEvent,
  RPGBankRequestEvent
} from '../../types/rpg-events'

interface BankItem {
  id: string
  name: string
  quantity: number
  stackable: boolean
  slotIndex: number
}

interface InventoryItem {
  id: string
  name: string
  quantity: number
  stackable: boolean
  slotIndex: number
}

const BankContainer = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.95);
  border: 3px solid #4A5568;
  border-radius: 10px;
  padding: 20px;
  color: white;
  width: 700px;
  max-height: 85vh;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
`

const BankHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid #4A5568;
`

const BankTitle = styled.h2`
  margin: 0;
  color: #68D391;
  font-size: 24px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  gap: 10px;
  
  &::before {
    content: '🏦';
    font-size: 28px;
  }
`

const CloseButton = styled.button`
  background: #4A5568;
  border: 2px solid #2D3748;
  color: white;
  cursor: pointer;
  border-radius: 5px;
  padding: 5px 10px;
  font-weight: bold;
  
  &:hover {
    background: #5A6578;
  }
`

const BankTabs = styled.div`
  display: flex;
  gap: 2px;
  margin-bottom: 20px;
  border-bottom: 1px solid #4A5568;
`

const BankTab = styled.button<{ active: boolean }>`
  background: ${props => props.active ? '#4A5568' : 'transparent'};
  border: 1px solid #2D3748;
  color: ${props => props.active ? 'white' : '#ccc'};
  cursor: pointer;
  padding: 10px 20px;
  border-radius: 5px 5px 0 0;
  font-size: 14px;
  font-weight: bold;
  
  &:hover {
    background: ${props => props.active ? '#4A5568' : 'rgba(74, 85, 104, 0.3)'};
  }
`

const StorageSection = styled.div`
  display: flex;
  gap: 20px;
  height: 500px;
`

const StoragePanel = styled.div`
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid #4A5568;
  border-radius: 8px;
  padding: 15px;
  overflow-y: auto;
`

const PanelTitle = styled.h3`
  margin: 0 0 15px 0;
  color: #68D391;
  font-size: 16px;
  text-align: center;
  padding-bottom: 10px;
  border-bottom: 1px solid #4A5568;
`

const ItemGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(8, 50px);
  gap: 5px;
  justify-content: center;
`

const ItemSlot = styled.div<{ occupied?: boolean; dragging?: boolean }>`
  width: 50px;
  height: 50px;
  background: ${props => {
    if (props.dragging) return '#68D391'
    return props.occupied ? '#2D3748' : '#1A202C'
  }};
  border: 2px solid ${props => {
    if (props.dragging) return '#38A169'
    return props.occupied ? '#4A5568' : '#2D3748'
  }};
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ${props => props.occupied ? 'pointer' : 'default'};
  position: relative;
  transition: all 0.2s ease;
  font-size: 10px;
  text-align: center;
  padding: 2px;
  
  &:hover {
    border-color: ${props => props.occupied ? '#68D391' : '#4A5568'};
    background: ${props => props.occupied ? '#4A5568' : '#2D3748'};
  }
`

const ItemQuantity = styled.span`
  position: absolute;
  bottom: 2px;
  right: 2px;
  font-size: 10px;
  background: rgba(0, 0, 0, 0.8);
  color: #68D391;
  padding: 1px 3px;
  border-radius: 2px;
  font-weight: bold;
`

const TransferControls = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
  padding: 20px 10px;
  min-width: 120px;
`

const TransferButton = styled.button<{ direction: 'deposit' | 'withdraw' }>`
  background: ${props => props.direction === 'deposit' ? '#4299E1' : '#F56565'};
  border: none;
  color: white;
  cursor: pointer;
  padding: 10px 15px;
  border-radius: 5px;
  font-weight: bold;
  font-size: 12px;
  min-width: 100px;
  transition: background 0.2s ease;
  
  &:hover {
    background: ${props => props.direction === 'deposit' ? '#3182CE' : '#E53E3E'};
  }
  
  &:disabled {
    background: #4A5568;
    cursor: not-allowed;
  }
`

const QuickActionButtons = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 10px;
`

const QuickActionButton = styled.button`
  background: #68D391;
  border: none;
  color: #1A202C;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 3px;
  font-weight: bold;
  font-size: 11px;
  
  &:hover {
    background: #4FD1C7;
  }
`

const SearchBar = styled.input`
  width: calc(100% - 20px);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid #4A5568;
  border-radius: 4px;
  padding: 8px 10px;
  color: white;
  font-size: 12px;
  margin-bottom: 15px;
  
  &:focus {
    outline: none;
    border-color: #68D391;
    background: rgba(255, 255, 255, 0.15);
  }
  
  &::placeholder {
    color: #888;
  }
`

const BankInfo = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding: 10px;
  background: rgba(104, 211, 145, 0.1);
  border: 1px solid #68D391;
  border-radius: 5px;
  font-size: 12px;
`

export const RPGBankUI: React.FC<{ 
  isOpen: boolean
  onClose: () => void
  playerId: string
}> = ({ isOpen, onClose, playerId }) => {
  const [activeTab, setActiveTab] = useState<'main' | 'equipment' | 'resources'>('main')
  const [bankItems, setBankItems] = useState<BankItem[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [selectedItem, setSelectedItem] = useState<{ item: BankItem | InventoryItem, source: 'bank' | 'inventory' } | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [bankCapacity, setBankCapacity] = useState({ used: 0, max: 816 }) // 17x48 slots

  useEffect(() => {
    if (!isOpen) return

    // Listen for bank data updates
    const handleBankUpdate = (event: RPGBankUpdateEvent) => {
      if (event.detail.playerId === playerId) {
        setBankItems(event.detail.bankItems || [])
        setBankCapacity(event.detail.capacity || { used: 0, max: 816 })
      }
    }

    // Listen for inventory updates
    const handleInventoryUpdate = (event: RPGInventoryUpdateEvent) => {
      if (event.detail.playerId === playerId) {
        setInventoryItems(event.detail.items || [])
      }
    }

    // Request bank data
    window.dispatchEvent(new CustomEvent('rpg:bank:request', {
      detail: { playerId }
    }) as RPGBankRequestEvent)

    window.addEventListener('rpg:bank:updated', handleBankUpdate)
    window.addEventListener('rpg:inventory:updated', handleInventoryUpdate)

    return () => {
      window.removeEventListener('rpg:bank:updated', handleBankUpdate)
      window.removeEventListener('rpg:inventory:updated', handleInventoryUpdate)
    }
  }, [isOpen, playerId])

  if (!isOpen) return null

  const filterItems = (items: (BankItem | InventoryItem)[]) => {
    if (!searchTerm) return items
    return items.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }

  const filteredBankItems = filterItems(bankItems)
  const filteredInventoryItems = filterItems(inventoryItems)

  const handleItemClick = (item: BankItem | InventoryItem, source: 'bank' | 'inventory') => {
    setSelectedItem({ item, source })
  }

  const depositItem = () => {
    if (!selectedItem || selectedItem.source !== 'inventory') return

    window.dispatchEvent(new CustomEvent('rpg:bank:deposit', {
      detail: { 
        playerId, 
        itemId: selectedItem.item.id.toString(),
        quantity: selectedItem.item.quantity,
        slotIndex: selectedItem.item.slotIndex || 0
      }
    }) as RPGBankDepositEvent)

    setSelectedItem(null)
  }

  const withdrawItem = () => {
    if (!selectedItem || selectedItem.source !== 'bank') return

    window.dispatchEvent(new CustomEvent('rpg:bank:withdraw', {
      detail: { 
        playerId, 
        itemId: selectedItem.item.id,
        quantity: selectedItem.item.quantity,
        slotIndex: selectedItem.item.slotIndex
      }
    }) as RPGBankWithdrawEvent)

    setSelectedItem(null)
  }

  const depositAll = () => {
    window.dispatchEvent(new CustomEvent('rpg:bank:deposit:all', {
      detail: { playerId }
    }) as RPGBankDepositAllEvent)
  }

  const withdrawAll = () => {
    if (inventoryItems.length >= 28) return // Inventory full

    window.dispatchEvent(new CustomEvent('rpg:bank:withdraw:all', {
      detail: { playerId }
    }) as RPGBankWithdrawAllEvent)
  }

  const renderItemGrid = (items: (BankItem | InventoryItem)[], source: 'bank' | 'inventory', maxSlots: number) => {
    const slots = Array(maxSlots).fill(null)
    
    items.forEach(item => {
      if (item.slotIndex !== undefined && item.slotIndex < maxSlots) {
        slots[item.slotIndex] = item
      }
    })

    return (
      <ItemGrid style={{ 
        gridTemplateColumns: source === 'bank' ? 'repeat(17, 40px)' : 'repeat(7, 50px)',
        maxHeight: source === 'bank' ? '400px' : '200px',
        overflowY: 'auto'
      }}>
        {slots.map((item, index) => (
          <ItemSlot
            key={index}
            occupied={!!item}
            dragging={selectedItem?.item.slotIndex === index && selectedItem.source === source}
            onClick={() => item && handleItemClick(item, source)}
            style={{ 
              width: source === 'bank' ? '40px' : '50px',
              height: source === 'bank' ? '40px' : '50px'
            }}
          >
            {item && (
              <>
                <div style={{ fontSize: source === 'bank' ? '8px' : '10px' }}>
                  {item.name.substring(0, source === 'bank' ? 2 : 3)}
                </div>
                {item.stackable && item.quantity > 1 && (
                  <ItemQuantity>{item.quantity}</ItemQuantity>
                )}
              </>
            )}
          </ItemSlot>
        ))}
      </ItemGrid>
    )
  }

  return (
    <BankContainer>
      <BankHeader>
        <BankTitle>Bank of RuneScape</BankTitle>
        <CloseButton onClick={onClose}>✕</CloseButton>
      </BankHeader>

      <BankInfo>
        <div>
          <strong>Bank Capacity:</strong> {bankCapacity.used} / {bankCapacity.max} items
        </div>
        <div>
          <strong>Selected:</strong> {selectedItem ? 
            `${selectedItem.item.name} (${selectedItem.source})` : 
            'None'
          }
        </div>
      </BankInfo>

      <BankTabs>
        <BankTab active={activeTab === 'main'} onClick={() => setActiveTab('main')}>
          Main Tab
        </BankTab>
        <BankTab active={activeTab === 'equipment'} onClick={() => setActiveTab('equipment')}>
          Equipment
        </BankTab>
        <BankTab active={activeTab === 'resources'} onClick={() => setActiveTab('resources')}>
          Resources
        </BankTab>
      </BankTabs>

      <SearchBar
        placeholder="Search items..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <StorageSection>
        <StoragePanel>
          <PanelTitle>Bank ({filteredBankItems.length} items)</PanelTitle>
          {renderItemGrid(filteredBankItems, 'bank', 816)}
        </StoragePanel>

        <TransferControls>
          <TransferButton
            direction="deposit"
            onClick={depositItem}
            disabled={!selectedItem || selectedItem.source !== 'inventory'}
          >
            Deposit →
          </TransferButton>

          <TransferButton
            direction="withdraw"
            onClick={withdrawItem}
            disabled={!selectedItem || selectedItem.source !== 'bank' || inventoryItems.length >= 28}
          >
            ← Withdraw
          </TransferButton>

          <QuickActionButtons>
            <QuickActionButton onClick={depositAll}>
              Deposit All
            </QuickActionButton>
            <QuickActionButton 
              onClick={withdrawAll}
              disabled={inventoryItems.length >= 28}
            >
              Withdraw All
            </QuickActionButton>
          </QuickActionButtons>

          {selectedItem && (
            <div style={{ 
              marginTop: '15px', 
              padding: '10px', 
              background: 'rgba(255, 255, 255, 0.1)', 
              borderRadius: '5px',
              fontSize: '11px',
              textAlign: 'center'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                {selectedItem.item.name}
              </div>
              <div>Qty: {selectedItem.item.quantity}</div>
              <div>From: {selectedItem.source}</div>
            </div>
          )}
        </TransferControls>

        <StoragePanel>
          <PanelTitle>Inventory ({filteredInventoryItems.length}/28 items)</PanelTitle>
          {renderItemGrid(filteredInventoryItems, 'inventory', 28)}
        </StoragePanel>
      </StorageSection>

      <div style={{ 
        marginTop: '15px', 
        fontSize: '12px', 
        color: '#888',
        textAlign: 'center'
      }}>
        Click items to select • Use transfer buttons or drag and drop
      </div>
    </BankContainer>
  )
}