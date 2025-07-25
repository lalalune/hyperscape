import { useEffect, useState } from 'react'
import { cls } from '../utils'

interface PlayerStats {
  health: number
  maxHealth: number
  stamina: number
  maxStamina: number
  level: number
  xp: number
  maxXp: number
  coins: number
  combatStyle: 'attack' | 'strength' | 'defense' | 'range'
  skills: {
    attack: number
    strength: number
    defense: number
    constitution: number
    range: number
    woodcutting: number
    fishing: number
    firemaking: number
    cooking: number
  }
}

interface InventoryItem {
  id: string
  name: string
  quantity: number
  type: string
  stackable: boolean
}

interface EquipmentSlots {
  weapon: InventoryItem | null
  shield: InventoryItem | null
  helmet: InventoryItem | null
  body: InventoryItem | null
  legs: InventoryItem | null
  arrows: InventoryItem | null
}

interface DamageNumber {
  id: string
  amount: number
  type: 'damage' | 'heal' | 'xp' | 'miss'
  x: number
  y: number
  timestamp: number
}

export function RPGInterface({ world }: { world: any }) {
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [equipment, setEquipment] = useState<EquipmentSlots>({
    weapon: null,
    shield: null,
    helmet: null,
    body: null,
    legs: null,
    arrows: null,
  })
  const [showInventory, setShowInventory] = useState(false)
  const [showEquipment, setShowEquipment] = useState(false)
  const [showBank, setShowBank] = useState(false)
  const [showStore, setShowStore] = useState(false)
  const [bankData, setBankData] = useState<any>(null)
  const [storeData, setStoreData] = useState<any>(null)
  const [contextMenu, setContextMenu] = useState<any>(null)
  const [damageNumbers, setDamageNumbers] = useState<DamageNumber[]>([])

  useEffect(() => {
    const localPlayer = world.getPlayer()
    if (!localPlayer) return

    // Handle UI updates
    const handleUIUpdate = (update: any) => {
      if (update.playerId !== localPlayer.id) return

      switch (update.component) {
        case 'player':
        case 'health':
          setPlayerStats(update.data)
          break
        case 'inventory':
          setInventory(update.data.items || [])
          break
        case 'equipment':
          setEquipment(update.data.equipment || {})
          break
      }
    }

    // Handle specific events
    const handleStatsUpdate = (data: any) => {
      if (data.playerId !== localPlayer.id) return
      setPlayerStats(prev => ({ ...prev, ...data }))
    }

    const handleInventoryUpdate = (data: any) => {
      if (data.playerId !== localPlayer.id) return
      setInventory(data.items || [])
    }

    const handleEquipmentUpdate = (data: any) => {
      if (data.playerId !== localPlayer.id) return
      setEquipment(data.equipment || {})
    }

    const handleBankOpen = (data: any) => {
      if (data.playerId !== localPlayer.id) return
      setBankData(data)
      setShowBank(true)
    }

    const handleBankClose = (data: any) => {
      if (data.playerId !== localPlayer.id) return
      setShowBank(false)
      setBankData(null)
    }

    const handleStoreOpen = (data: any) => {
      if (data.playerId !== localPlayer.id) return
      setStoreData(data)
      setShowStore(true)
    }

    const handleStoreClose = (data: any) => {
      if (data.playerId !== localPlayer.id) return
      setShowStore(false)
      setStoreData(null)
    }

    const handleContextMenu = (data: any) => {
      if (data.playerId !== localPlayer.id) return
      setContextMenu(data)
    }

    const handleCombatEvent = (data: any) => {
      // Add damage numbers for combat events
      if (data.damage !== undefined || data.type) {
        const newDamageNumber: DamageNumber = {
          id: `${Date.now()}-${Math.random()}`,
          amount: data.damage || data.amount || 0,
          type: data.type || (data.damage > 0 ? 'damage' : 'heal'),
          x: (data.x || Math.random() * window.innerWidth * 0.5) + window.innerWidth * 0.25,
          y: (data.y || Math.random() * window.innerHeight * 0.5) + window.innerHeight * 0.25,
          timestamp: Date.now(),
        }
        
        setDamageNumbers(prev => [...prev, newDamageNumber])
        
        // Remove damage number after animation
        setTimeout(() => {
          setDamageNumbers(prev => prev.filter(num => num.id !== newDamageNumber.id))
        }, 2000)
      }
    }

    // Subscribe to events
    world.on('rpg:ui:update', handleUIUpdate)
    world.on('rpg:stats:update', handleStatsUpdate)
    world.on('rpg:inventory:update', handleInventoryUpdate)
    world.on('rpg:equipment:update', handleEquipmentUpdate)
    world.on('rpg:bank:interface:open', handleBankOpen)
    world.on('rpg:bank:interface:close', handleBankClose)
    world.on('rpg:bank:interface:update', handleBankOpen)
    world.on('rpg:store:interface:open', handleStoreOpen)
    world.on('rpg:store:interface:close', handleStoreClose)
    world.on('rpg:store:interface:update', handleStoreOpen)
    world.on('rpg:ui:context_menu', handleContextMenu)
    world.on('rpg:combat:damage', handleCombatEvent)
    world.on('rpg:combat:heal', handleCombatEvent)
    world.on('rpg:combat:xp', handleCombatEvent)
    world.on('rpg:combat:miss', handleCombatEvent)

    // Keyboard shortcuts
    const control = world.controls.bind({ priority: 100 })
    control.keyI.onPress = () => setShowInventory(!showInventory)
    control.keyE.onPress = () => setShowEquipment(!showEquipment)

    // Request initial data
    world.emit('rpg:ui:request', { playerId: localPlayer.id })

    return () => {
      world.off('rpg:ui:update', handleUIUpdate)
      world.off('rpg:stats:update', handleStatsUpdate)
      world.off('rpg:inventory:update', handleInventoryUpdate)
      world.off('rpg:equipment:update', handleEquipmentUpdate)
      world.off('rpg:bank:interface:open', handleBankOpen)
      world.off('rpg:bank:interface:close', handleBankClose)
      world.off('rpg:bank:interface:update', handleBankOpen)
      world.off('rpg:store:interface:open', handleStoreOpen)
      world.off('rpg:store:interface:close', handleStoreClose)
      world.off('rpg:store:interface:update', handleStoreOpen)
      world.off('rpg:ui:context_menu', handleContextMenu)
      world.off('rpg:combat:damage', handleCombatEvent)
      world.off('rpg:combat:heal', handleCombatEvent)
      world.off('rpg:combat:xp', handleCombatEvent)
      world.off('rpg:combat:miss', handleCombatEvent)
      control.release()
    }
  }, [world])

  // Update player health from player object directly
  useEffect(() => {
    const interval = setInterval(() => {
      const player = world.getPlayer()
      if (player && player.health !== undefined) {
        setPlayerStats(prev => {
          if (!prev) {
            return {
              health: Math.floor(player.health),
              maxHealth: 100,
              stamina: 100,
              maxStamina: 100,
              level: 1,
              xp: 0,
              maxXp: 83,
              coins: 0,
              combatStyle: 'attack' as const,
              skills: {
                attack: 1,
                strength: 1,
                defense: 1,
                constitution: 1,
                range: 1,
                woodcutting: 1,
                fishing: 1,
                firemaking: 1,
                cooking: 1
              }
            }
          }
          return {
            ...prev,
            health: Math.floor(player.health),
            maxHealth: prev.maxHealth || 100,
            stamina: prev.stamina || 100,
            maxStamina: prev.maxStamina || 100,
          }
        })
      }
    }, 100)

    return () => clearInterval(interval)
  }, [world])

  return (
    <>
      {playerStats && <RPGHud stats={playerStats} />}
      {showInventory && (
        <RPGInventory
          items={inventory}
          onClose={() => setShowInventory(false)}
          world={world}
        />
      )}
      {showEquipment && (
        <RPGEquipment
          equipment={equipment}
          stats={playerStats}
          onClose={() => setShowEquipment(false)}
          world={world}
        />
      )}
      {showBank && bankData && (
        <RPGBank
          data={bankData}
          onClose={() => {
            setShowBank(false)
            world.emit('rpg:bank:close', {
              playerId: world.getPlayer()?.id,
              bankId: bankData.bankId,
            })
          }}
          world={world}
        />
      )}
      {showStore && storeData && (
        <RPGStore
          data={storeData}
          onClose={() => {
            setShowStore(false)
            world.emit('rpg:store:close', {
              playerId: world.getPlayer()?.id,
              storeId: storeData.storeId,
            })
          }}
          world={world}
        />
      )}
      {contextMenu && (
        <RPGContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          world={world}
        />
      )}
      <RPGButtonPanel
        onInventoryClick={() => setShowInventory(!showInventory)}
        onEquipmentClick={() => setShowEquipment(!showEquipment)}
        showInventory={showInventory}
        showEquipment={showEquipment}
      />
      <RPGDamageNumbers damageNumbers={damageNumbers} />
    </>
  )
}

// Button Panel Component (Bottom-Right UI)
function RPGButtonPanel({
  onInventoryClick,
  onEquipmentClick,
  showInventory,
  showEquipment,
}: {
  onInventoryClick: () => void
  onEquipmentClick: () => void
  showInventory: boolean
  showEquipment: boolean
}) {
  const buttonStyle = {
    width: '3rem',
    height: '3rem',
    background: 'rgba(11, 10, 21, 0.9)',
    border: '0.0625rem solid #2a2b39',
    borderRadius: '0.375rem',
    color: '#ffffff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
    fontWeight: 'bold',
    backdropFilter: 'blur(5px)',
    transition: 'all 0.2s ease',
  }

  const activeButtonStyle = {
    ...buttonStyle,
    background: 'rgba(59, 130, 246, 0.8)',
    borderColor: '#3b82f6',
    boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)',
  }

  return (
    <div
      className="rpg-button-panel"
      style={{
        position: 'fixed',
        bottom: 'calc(1rem + env(safe-area-inset-bottom))',
        right: 'calc(1rem + env(safe-area-inset-right))',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        pointerEvents: 'auto',
        zIndex: 100,
      }}
    >
      {/* Inventory Button */}
      <button
        onClick={onInventoryClick}
        style={showInventory ? activeButtonStyle : buttonStyle}
        onMouseEnter={(e) => {
          if (!showInventory) {
            e.currentTarget.style.background = 'rgba(11, 10, 21, 0.95)'
            e.currentTarget.style.borderColor = '#3b82f6'
            e.currentTarget.style.transform = 'scale(1.05)'
          }
        }}
        onMouseLeave={(e) => {
          if (!showInventory) {
            e.currentTarget.style.background = 'rgba(11, 10, 21, 0.9)'
            e.currentTarget.style.borderColor = '#2a2b39'
            e.currentTarget.style.transform = 'scale(1)'
          }
        }}
        title="Inventory (I)"
      >
        🎒
      </button>

      {/* Equipment Button */}
      <button
        onClick={onEquipmentClick}
        style={showEquipment ? activeButtonStyle : buttonStyle}
        onMouseEnter={(e) => {
          if (!showEquipment) {
            e.currentTarget.style.background = 'rgba(11, 10, 21, 0.95)'
            e.currentTarget.style.borderColor = '#3b82f6'
            e.currentTarget.style.transform = 'scale(1.05)'
          }
        }}
        onMouseLeave={(e) => {
          if (!showEquipment) {
            e.currentTarget.style.background = 'rgba(11, 10, 21, 0.9)'
            e.currentTarget.style.borderColor = '#2a2b39'
            e.currentTarget.style.transform = 'scale(1)'
          }
        }}
        title="Equipment (E)"
      >
        ⚔️
      </button>

      {/* Skills Button (placeholder for future implementation) */}
      <button
        style={buttonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(11, 10, 21, 0.95)'
          e.currentTarget.style.borderColor = '#3b82f6'
          e.currentTarget.style.transform = 'scale(1.05)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(11, 10, 21, 0.9)'
          e.currentTarget.style.borderColor = '#2a2b39'
          e.currentTarget.style.transform = 'scale(1)'
        }}
        title="Skills (Coming Soon)"
        onClick={() => {
          // Placeholder for skills interface
          console.log('[RPG] Skills interface not yet implemented')
        }}
      >
        📊
      </button>

      {/* Settings Button (placeholder for future implementation) */}
      <button
        style={buttonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(11, 10, 21, 0.95)'
          e.currentTarget.style.borderColor = '#3b82f6'
          e.currentTarget.style.transform = 'scale(1.05)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(11, 10, 21, 0.9)'
          e.currentTarget.style.borderColor = '#2a2b39'
          e.currentTarget.style.transform = 'scale(1)'
        }}
        title="Settings (Coming Soon)"
        onClick={() => {
          // Placeholder for settings interface
          console.log('[RPG] Settings interface not yet implemented')
        }}
      >
        ⚙️
      </button>
    </div>
  )
}

// HUD Component
function RPGHud({ stats }: { stats: PlayerStats }) {
  const healthPercent = (stats.health / stats.maxHealth) * 100
  const healthColor = healthPercent > 60 ? '#4ade80' : healthPercent > 30 ? '#fbbf24' : '#ef4444'
  
  const staminaPercent = (stats.stamina / stats.maxStamina) * 100
  const staminaColor = '#3b82f6' // Blue color for stamina
  
  const xpPercent = (stats.xp / stats.maxXp) * 100
  const xpColor = '#8b5cf6' // Purple color for XP
  
  const combatLevelColors = {
    attack: '#ef4444',    // Red
    strength: '#10b981',  // Green  
    defense: '#3b82f6',   // Blue
    range: '#f59e0b'      // Orange
  }

  return (
    <div
      className="rpg-hud"
      style={{
        position: 'absolute',
        top: 'calc(1rem + env(safe-area-inset-top))',
        left: 'calc(1rem + env(safe-area-inset-left))',
        width: '20rem',
        background: 'rgba(11, 10, 21, 0.85)',
        border: '0.0625rem solid #2a2b39',
        borderRadius: '0.5rem',
        padding: '0.75rem',
        pointerEvents: 'none',
        backdropFilter: 'blur(5px)',
      }}
    >
      {/* Top Info */}
      <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Level {stats.level}</div>
          <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Combat Lv. {Math.floor((stats.skills.attack + stats.skills.strength + stats.skills.defense + stats.skills.range) / 4)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#fbbf24', fontWeight: 'bold' }}>{stats.coins.toLocaleString()} gp</div>
          <div style={{ fontSize: '0.875rem', color: combatLevelColors[stats.combatStyle] }}>Style: {stats.combatStyle}</div>
        </div>
      </div>
      
      {/* Health Bar */}
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.875rem', marginBottom: '0.125rem', display: 'flex', justifyContent: 'space-between' }}>
          <span>Health</span>
          <span>{stats.health}/{stats.maxHealth}</span>
        </div>
        <div
          style={{
            width: '100%',
            height: '1rem',
            background: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '0.25rem',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div
            style={{
              width: `${healthPercent}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${healthColor}, ${healthColor}dd)`,
              transition: 'width 0.3s ease-out',
            }}
          />
        </div>
      </div>
      
      {/* Stamina Bar */}
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.875rem', marginBottom: '0.125rem', display: 'flex', justifyContent: 'space-between' }}>
          <span>Stamina</span>
          <span>{stats.stamina}/{stats.maxStamina}</span>
        </div>
        <div
          style={{
            width: '100%',
            height: '1rem',
            background: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '0.25rem',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div
            style={{
              width: `${staminaPercent}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${staminaColor}, ${staminaColor}dd)`,
              transition: 'width 0.3s ease-out',
            }}
          />
        </div>
      </div>
      
      {/* XP Bar */}
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.875rem', marginBottom: '0.125rem', display: 'flex', justifyContent: 'space-between' }}>
          <span>Experience</span>
          <span>{stats.xp}/{stats.maxXp} ({xpPercent.toFixed(1)}%)</span>
        </div>
        <div
          style={{
            width: '100%',
            height: '0.75rem',
            background: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '0.25rem',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div
            style={{
              width: `${xpPercent}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${xpColor}, ${xpColor}dd)`,
              transition: 'width 0.3s ease-out',
            }}
          />
        </div>
      </div>
      
      {/* Quick Skills Display */}
      <div style={{ marginTop: '0.75rem' }}>
        <div style={{ fontSize: '0.875rem', marginBottom: '0.25rem', color: '#9ca3af' }}>Combat Skills</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem', fontSize: '0.8rem' }}>
          <div>ATK: {stats.skills.attack}</div>
          <div>STR: {stats.skills.strength}</div>
          <div>DEF: {stats.skills.defense}</div>
          <div>RNG: {stats.skills.range}</div>
        </div>
      </div>
    </div>
  )
}

// Inventory Component
function RPGInventory({
  items,
  onClose,
  world,
}: {
  items: InventoryItem[]
  onClose: () => void
  world: any
}) {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; slot: number; item: InventoryItem } | null>(null)

  const handleItemClick = (slot: number, item: InventoryItem | null) => {
    if (!item) {
      setSelectedSlot(null)
      return
    }
    setSelectedSlot(slot)
    setContextMenu(null)
  }

  const handleItemRightClick = (e: React.MouseEvent, slot: number, item: InventoryItem | null) => {
    e.preventDefault()
    if (!item) return
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      slot,
      item
    })
  }

  const handleContextMenuAction = (action: string) => {
    if (!contextMenu) return
    
    const localPlayer = world.getPlayer()
    if (!localPlayer) return

    const { slot, item } = contextMenu
    
    switch (action) {
      case 'use':
        world.emit('rpg:inventory:use', {
          playerId: localPlayer.id,
          slot,
          itemId: item.id,
        })
        break
      case 'equip':
        world.emit('rpg:inventory:equip', {
          playerId: localPlayer.id,
          slot,
          itemId: item.id,
        })
        break
      case 'drop':
        world.emit('rpg:inventory:drop', {
          playerId: localPlayer.id,
          slot,
          quantity: 1,
        })
        break
      case 'examine':
        world.emit('rpg:inventory:examine', {
          playerId: localPlayer.id,
          itemId: item.id,
        })
        break
    }
    
    setContextMenu(null)
    setSelectedSlot(null)
  }

  const getItemTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'weapon': return '#ef4444'
      case 'armor': return '#3b82f6'
      case 'consumable': return '#10b981'
      case 'tool': return '#f59e0b'
      case 'resource': return '#8b5cf6'
      default: return '#6b7280'
    }
  }

  const slots = Array(28).fill(null)
  items.forEach((item, index) => {
    if (index < 28) slots[index] = item
  })

  return (
    <>
      <div
        className="rpg-inventory"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '26rem',
          background: 'rgba(11, 10, 21, 0.95)',
          border: '0.0625rem solid #2a2b39',
          borderRadius: '0.5rem',
          padding: '1rem',
          pointerEvents: 'auto',
          backdropFilter: 'blur(5px)',
        }}
        onClick={() => setContextMenu(null)}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Inventory</h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
              {items.length}/28 slots
            </span>
            <button
              onClick={onClose}
              style={{
                background: '#ef4444',
                border: 'none',
                borderRadius: '0.25rem',
                color: 'white',
                padding: '0.25rem 0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Close
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '0.25rem',
            marginBottom: '1rem',
          }}
        >
          {slots.map((item, index) => (
            <div
              key={index}
              onClick={() => handleItemClick(index, item)}
              onContextMenu={(e) => handleItemRightClick(e, index, item)}
              onMouseEnter={() => setHoveredSlot(index)}
              onMouseLeave={() => setHoveredSlot(null)}
              style={{
                width: '3.25rem',
                height: '3.25rem',
                background: selectedSlot === index ? '#3b82f6' : hoveredSlot === index ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.5)',
                border: `0.0625rem solid ${item ? getItemTypeColor(item.type) : '#1f2937'}`,
                borderRadius: '0.25rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: item ? 'pointer' : 'default',
                fontSize: '0.7rem',
                position: 'relative',
                transition: 'all 0.2s ease',
                transform: hoveredSlot === index ? 'scale(1.05)' : 'scale(1)',
              }}
            >
              {item && (
                <>
                  <div style={{ 
                    textAlign: 'center', 
                    lineHeight: '1',
                    fontWeight: 'bold',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)' 
                  }}>
                    {item.name.substring(0, 8)}
                  </div>
                  {item.quantity > 1 && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '0.125rem',
                        right: '0.125rem',
                        color: '#fbbf24',
                        fontWeight: 'bold',
                        fontSize: '0.6rem',
                        background: 'rgba(0, 0, 0, 0.7)',
                        borderRadius: '0.125rem',
                        padding: '0.125rem 0.25rem',
                      }}
                    >
                      {item.quantity}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {selectedSlot !== null && slots[selectedSlot] && (
          <div style={{ 
            padding: '0.75rem', 
            background: 'rgba(0, 0, 0, 0.3)', 
            borderRadius: '0.25rem',
            border: `1px solid ${getItemTypeColor(slots[selectedSlot].type)}` 
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
              {slots[selectedSlot].name}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
              Type: {slots[selectedSlot].type} • Quantity: {slots[selectedSlot].quantity}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleContextMenuAction('use')}
                style={{
                  background: '#10b981',
                  border: 'none',
                  borderRadius: '0.25rem',
                  color: 'white',
                  padding: '0.375rem 0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Use
              </button>
              <button
                onClick={() => handleContextMenuAction('equip')}
                style={{
                  background: '#3b82f6',
                  border: 'none',
                  borderRadius: '0.25rem',
                  color: 'white',
                  padding: '0.375rem 0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Equip
              </button>
              <button
                onClick={() => handleContextMenuAction('drop')}
                style={{
                  background: '#ef4444',
                  border: 'none',
                  borderRadius: '0.25rem',
                  color: 'white',
                  padding: '0.375rem 0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Drop
              </button>
              <button
                onClick={() => handleContextMenuAction('examine')}
                style={{
                  background: '#6b7280',
                  border: 'none',
                  borderRadius: '0.25rem',
                  color: 'white',
                  padding: '0.375rem 0.75rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Examine
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            background: 'rgba(11, 10, 21, 0.95)',
            border: '0.0625rem solid #2a2b39',
            borderRadius: '0.25rem',
            padding: '0.25rem',
            pointerEvents: 'auto',
            backdropFilter: 'blur(5px)',
            minWidth: '8rem',
            zIndex: 1000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {['use', 'equip', 'drop', 'examine'].map((action) => (
            <div
              key={action}
              onClick={() => handleContextMenuAction(action)}
              style={{
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                borderRadius: '0.25rem',
                transition: 'background 0.1s',
                textTransform: 'capitalize',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              {action}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// Equipment Component
function RPGEquipment({
  equipment,
  stats,
  onClose,
  world,
}: {
  equipment: EquipmentSlots
  stats: PlayerStats | null
  onClose: () => void
  world: any
}) {
  const handleUnequip = (slot: string) => {
    const localPlayer = world.getPlayer()
    if (!localPlayer) return

    world.emit('rpg:equipment:unequip', {
      playerId: localPlayer.id,
      slot,
    })
  }

  const equipmentSlots = [
    { key: 'helmet', label: 'Helmet' },
    { key: 'body', label: 'Body' },
    { key: 'legs', label: 'Legs' },
    { key: 'weapon', label: 'Weapon' },
    { key: 'shield', label: 'Shield' },
    { key: 'arrows', label: 'Arrows' },
  ]

  return (
    <div
      className="rpg-equipment"
      style={{
        position: 'absolute',
        top: '50%',
        left: '35%',
        transform: 'translate(-50%, -50%)',
        width: '20rem',
        background: 'rgba(11, 10, 21, 0.95)',
        border: '0.0625rem solid #2a2b39',
        borderRadius: '0.5rem',
        padding: '1rem',
        pointerEvents: 'auto',
        backdropFilter: 'blur(5px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <h3 style={{ margin: 0 }}>Equipment</h3>
        <button
          onClick={onClose}
          style={{
            background: '#ef4444',
            border: 'none',
            borderRadius: '0.25rem',
            color: 'white',
            padding: '0.25rem 0.5rem',
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {equipmentSlots.map(({ key, label }) => {
          const item = equipment[key as keyof EquipmentSlots]
          return (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem',
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '0.25rem',
              }}
            >
              <div style={{ width: '5rem' }}>{label}:</div>
              <div style={{ flex: 1 }}>
                {item ? (
                  <span>
                    {item.name}
                    {key === 'arrows' && item.quantity && ` (${item.quantity})`}
                  </span>
                ) : (
                  <span style={{ color: '#6b7280' }}>(empty)</span>
                )}
              </div>
              {item && (
                <button
                  onClick={() => handleUnequip(key)}
                  style={{
                    background: '#6b7280',
                    border: 'none',
                    borderRadius: '0.25rem',
                    color: 'white',
                    padding: '0.125rem 0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  Unequip
                </button>
              )}
            </div>
          )
        })}
      </div>

      {stats && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.5rem',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '0.25rem',
          }}
        >
          <h4 style={{ margin: '0 0 0.5rem 0' }}>Combat Stats</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem', fontSize: '0.875rem' }}>
            <div>Attack: {stats.skills?.attack || 0}</div>
            <div>Strength: {stats.skills?.strength || 0}</div>
            <div>Defense: {stats.skills?.defense || 0}</div>
            <div>Range: {stats.skills?.range || 0}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// Bank Component
function RPGBank({ data, onClose, world }: { data: any; onClose: () => void; world: any }) {
  const { bankName, items, maxSlots, usedSlots } = data

  const handleWithdraw = (slot: number) => {
    const localPlayer = world.getPlayer()
    if (!localPlayer) return

    world.emit('rpg:bank:withdraw', {
      playerId: localPlayer.id,
      bankId: data.bankId,
      slot,
      quantity: 1,
    })
  }

  const slots = Array(maxSlots).fill(null)
  items.forEach((item: any, index: number) => {
    if (index < maxSlots) slots[index] = item
  })

  return (
    <div
      className="rpg-bank"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '30rem',
        background: 'rgba(11, 10, 21, 0.95)',
        border: '0.0625rem solid #2a2b39',
        borderRadius: '0.5rem',
        padding: '1rem',
        pointerEvents: 'auto',
        backdropFilter: 'blur(5px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <h3 style={{ margin: 0 }}>{bankName}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: '#6b7280' }}>
            {usedSlots}/{maxSlots} slots
          </span>
          <button
            onClick={onClose}
            style={{
              background: '#ef4444',
              border: 'none',
              borderRadius: '0.25rem',
              color: 'white',
              padding: '0.25rem 0.5rem',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gap: '0.25rem',
          maxHeight: '20rem',
          overflowY: 'auto',
        }}
      >
        {slots.map((item, index) => (
          <div
            key={index}
            onClick={() => item && handleWithdraw(index)}
            style={{
              width: '3.5rem',
              height: '3.5rem',
              background: item ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.3)',
              border: `0.0625rem solid ${item ? '#4b5563' : '#1f2937'}`,
              borderRadius: '0.25rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: item ? 'pointer' : 'default',
              fontSize: '0.75rem',
              position: 'relative',
            }}
          >
            {item && (
              <>
                <div>{item.name.substring(0, 8)}</div>
                {item.quantity > 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '0.125rem',
                      right: '0.125rem',
                      color: '#fbbf24',
                      fontWeight: 'bold',
                    }}
                  >
                    {item.quantity}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Store Component
function RPGStore({ data, onClose, world }: { data: any; onClose: () => void; world: any }) {
  const { storeName, npcName, items } = data
  const [playerCoins, setPlayerCoins] = useState(0)

  useEffect(() => {
    const handleCoinsUpdate = (data: any) => {
      const localPlayer = world.getPlayer()
      if (data.playerId === localPlayer?.id) {
        setPlayerCoins(data.coins)
      }
    }

    world.on('rpg:store:player_coins', handleCoinsUpdate)
    return () => world.off('rpg:store:player_coins', handleCoinsUpdate)
  }, [world])

  const handleBuy = (itemId: string) => {
    const localPlayer = world.getPlayer()
    if (!localPlayer) return

    world.emit('rpg:store:buy', {
      playerId: localPlayer.id,
      storeId: data.storeId,
      itemId,
      quantity: 1,
    })
  }

  return (
    <div
      className="rpg-store"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '35rem',
        background: 'rgba(11, 10, 21, 0.95)',
        border: '0.0625rem solid #2a2b39',
        borderRadius: '0.5rem',
        padding: '1rem',
        pointerEvents: 'auto',
        backdropFilter: 'blur(5px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>{storeName}</h3>
          {npcName && <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>Shopkeeper: {npcName}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              background: 'rgba(251, 191, 36, 0.2)',
              padding: '0.5rem 1rem',
              borderRadius: '0.25rem',
            }}
          >
            <span style={{ color: '#fbbf24' }}>Coins: {playerCoins} gp</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#ef4444',
              border: 'none',
              borderRadius: '0.25rem',
              color: 'white',
              padding: '0.25rem 0.5rem',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          maxHeight: '20rem',
          overflowY: 'auto',
        }}
      >
        {items.map((item: any) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0.75rem',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '0.25rem',
              gap: '1rem',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold' }}>{item.name}</div>
              {item.description && (
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{item.description}</div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#fbbf24', fontWeight: 'bold' }}>{item.price || item.buyPrice} gp</div>
              {item.quantity !== undefined && (
                <div style={{ fontSize: '0.875rem', color: item.quantity > 0 ? '#4ade80' : '#ef4444' }}>
                  Stock: {item.quantity}
                </div>
              )}
            </div>
            <button
              onClick={() => handleBuy(item.id)}
              disabled={item.quantity === 0}
              style={{
                background: item.quantity === 0 ? '#4b5563' : '#10b981',
                border: 'none',
                borderRadius: '0.25rem',
                color: 'white',
                padding: '0.5rem 1rem',
                cursor: item.quantity === 0 ? 'not-allowed' : 'pointer',
                opacity: item.quantity === 0 ? 0.5 : 1,
              }}
            >
              Buy
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// Context Menu Component
function RPGContextMenu({
  menu,
  onClose,
  world,
}: {
  menu: any
  onClose: () => void
  world: any
}) {
  const { x, y, options } = menu

  const handleOption = (option: any) => {
    const localPlayer = world.getPlayer()
    if (!localPlayer) return

    world.emit('rpg:ui:context_action', {
      playerId: localPlayer.id,
      action: option.action,
      target: menu.target,
    })
    onClose()
  }

  return (
    <div
      className="rpg-context-menu"
      style={{
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        background: 'rgba(11, 10, 21, 0.95)',
        border: '0.0625rem solid #2a2b39',
        borderRadius: '0.25rem',
        padding: '0.25rem',
        pointerEvents: 'auto',
        backdropFilter: 'blur(5px)',
        minWidth: '10rem',
      }}
      onMouseLeave={onClose}
    >
      {options.map((option: any, index: number) => (
        <div
          key={index}
          onClick={() => handleOption(option)}
          style={{
            padding: '0.5rem 0.75rem',
            cursor: 'pointer',
            borderRadius: '0.25rem',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          {option.label}
        </div>
      ))}
    </div>
  )
}

// Damage Numbers Component
function RPGDamageNumbers({ damageNumbers }: { damageNumbers: DamageNumber[] }) {
  return (
    <>
      {damageNumbers.map((damage) => {
        const age = Date.now() - damage.timestamp
        const progress = Math.min(age / 2000, 1) // 2 second animation
        
        const getColor = (type: string) => {
          switch (type) {
            case 'damage': return '#ef4444'
            case 'heal': return '#10b981'
            case 'xp': return '#8b5cf6'
            case 'miss': return '#6b7280'
            default: return '#ffffff'
          }
        }
        
        const getText = (damage: DamageNumber) => {
          if (damage.type === 'miss') return 'MISS'
          if (damage.type === 'xp') return `+${damage.amount} XP`
          if (damage.type === 'heal') return `+${damage.amount}`
          return `-${damage.amount}`
        }
        
        return (
          <div
            key={damage.id}
            style={{
              position: 'fixed',
              left: `${damage.x}px`,
              top: `${damage.y - progress * 100}px`, // Float upward
              color: getColor(damage.type),
              fontSize: damage.type === 'miss' ? '1.2rem' : '1.5rem',
              fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
              opacity: 1 - progress, // Fade out
              transform: `scale(${1 + progress * 0.5})`, // Scale up slightly
              pointerEvents: 'none',
              zIndex: 1000,
              userSelect: 'none',
              transition: 'none',
            }}
          >
            {getText(damage)}
          </div>
        )
      })}
    </>
  )
}