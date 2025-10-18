import React, { useEffect, useState } from 'react'

import { World } from '@hyperscape/shared'
import type { InventorySlotItem, PlayerEquipmentItems, PlayerStats } from '@hyperscape/shared'
import { EventType } from '@hyperscape/shared'
import { useChatContext } from './ChatContext'
import { HintProvider } from './Hint'
import { Minimap } from './Minimap'
import { MenuButton } from './shared/MenuButton'
import { GameWindow } from './shared/GameWindow'
import { MinimapCompass } from './shared/MinimapCompass'
import { SkillsPanel } from './panels/SkillsPanel'
import { InventoryPanel } from './panels/InventoryPanel'
import { CombatPanel } from './panels/CombatPanel'
import { EquipmentPanel } from './panels/EquipmentPanel'
import { SettingsPanel } from './panels/SettingsPanel'
import { AccountPanel } from './panels/AccountPanel'

const _mainSectionPanes = ['prefs']


/**
 * frosted
 * 
background: rgba(11, 10, 21, 0.85); 
border: 0.0625rem solid #2a2b39;
backdrop-filter: blur(5px);
 *
 */

interface SidebarProps {
  world: World
  ui: {
    active: boolean
    pane: string | null
  }
}

export function Sidebar({ world, ui: _ui }: SidebarProps) {
  const [_livekit, setLiveKit] = useState(() => world.livekit!.status)
  const [inventory, setInventory] = useState<InventorySlotItem[]>([])
  const [equipment, setEquipment] = useState<PlayerEquipmentItems | null>(null)
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null)
  const [coins, setCoins] = useState<number>(0)
  const [minimapCollapsed, setMinimapCollapsed] = useState<boolean>(false)
  const [isMobile, setIsMobile] = useState<boolean>(false)
  const { collapsed: _chatCollapsed, active: _chatActive } = useChatContext()

  // Track which windows are open
  const [openWindows, setOpenWindows] = useState<Set<string>>(new Set())
  
  const toggleWindow = (windowId: string) => {
    setOpenWindows(prev => {
      const next = new Set(prev)
      if (next.has(windowId)) {
        next.delete(windowId)
      } else {
        next.add(windowId)
      }
      return next
    })
  }
  
  const closeWindow = (windowId: string) => {
    setOpenWindows(prev => {
      const next = new Set(prev)
      next.delete(windowId)
      return next
    })
  }
  
  useEffect(() => {
    const onLiveKitStatus = status => {
      setLiveKit({ ...status })
    }
    world.livekit!.on('status', onLiveKitStatus)
    const onOpenPane = (data: { pane?: string | null }) => {
      if (data?.pane) {
        setOpenWindows(prev => new Set(prev).add(data.pane as string))
      }
    }
    world.on(EventType.UI_OPEN_PANE, onOpenPane)
    const onUIUpdate = (raw: unknown) => {
      const update = raw as { component: string; data: unknown }
      if (update.component === 'player') {
        setPlayerStats(update.data as PlayerStats)
      }
      if (update.component === 'equipment') {
        const data = update.data as { equipment: PlayerEquipmentItems }
        setEquipment(data.equipment)
      }
    }
    const onInventory = (raw: unknown) => {
      const data = raw as { items: InventorySlotItem[]; playerId: string; coins: number }
      setInventory(data.items)
      setCoins(data.coins)
    }
    const onCoins = (raw: unknown) => {
      const data = raw as { playerId: string; coins: number }
      const localId = world.entities.player?.id
      if (!localId || data.playerId === localId) setCoins(data.coins)
    }
    world.on(EventType.UI_UPDATE, onUIUpdate)
    world.on(EventType.INVENTORY_UPDATED, onInventory)
    world.on(EventType.INVENTORY_UPDATE_COINS, onCoins)
    // Request initial inventory snapshot once local player exists; hydrate from cached packet if available
    const requestInitial = () => {
      const lp = world.entities.player?.id
      if (lp) {
        // If network already cached an inventory packet, use it immediately
        const network = world.network as { lastInventoryByPlayerId?: Record<string, { playerId: string; items: InventorySlotItem[]; coins: number; maxSlots: number }> }
        const cached = network.lastInventoryByPlayerId?.[lp]
        if (cached && Array.isArray(cached.items)) {
          setInventory(cached.items)
          setCoins(cached.coins)
        }
        // Ask server for authoritative snapshot in case cache is missing/stale
        world.emit(EventType.INVENTORY_REQUEST, { playerId: lp })
        return true
      }
      return false
    }
    let timeoutId: number | null = null
    if (!requestInitial()) {
      timeoutId = window.setTimeout(() => requestInitial(), 400)
    }
    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId)
      world.livekit!.off('status', onLiveKitStatus)
      world.off(EventType.UI_OPEN_PANE, onOpenPane)
      world.off(EventType.UI_UPDATE, onUIUpdate)
      world.off(EventType.INVENTORY_UPDATED, onInventory)
      world.off(EventType.INVENTORY_UPDATE_COINS, onCoins)
    }
  }, [])

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const menuButtons = [
    { windowId: 'combat', icon: '⚔️', label: 'Combat' },
    { windowId: 'skills', icon: '🧠', label: 'Skills' },
    { windowId: 'inventory', icon: '🎒', label: 'Inventory' },
    { windowId: 'equipment', icon: '🛡️', label: 'Equipment' },
    { windowId: 'prefs', icon: '⚙️', label: 'Settings' },
    { windowId: 'account', icon: '👤', label: 'Account' },
  ] as const

  const minimapOuterSize = isMobile ? 180 : 220
  const minimapInnerSize = isMobile ? 164 : 204
  const minimapZoom = isMobile ? 40 : 50

  const radialOffset = isMobile ? 20 : 28
  const radialRadius = (minimapOuterSize / 2) + radialOffset
  const startAngleDeg = isMobile ? 135 : 130
  const endAngleDeg = isMobile ? 225 : 220
  const radialButtonSize = isMobile ? 'compact' as const : 'small' as const
  const startAngle = (Math.PI / 180) * startAngleDeg
  const endAngle = (Math.PI / 180) * endAngleDeg
  const angleStep = menuButtons.length > 1 ? (endAngle - startAngle) / (menuButtons.length - 1) : 0
  const radialButtons = menuButtons.map((button, index) => {
    const angle = startAngle + angleStep * index
    const offsetX = Math.cos(angle) * radialRadius
    const offsetY = Math.sin(angle) * radialRadius
    return {
      ...button,
      style: {
        left: '50%',
        top: '50%',
        transform: `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px)`,
      } as React.CSSProperties,
    }
  })
  
  return (
    <HintProvider>
      <div
        className='sidebar absolute text-base inset-0 pointer-events-none z-[1]'
      >
        
        {/* Minimap and radial menu */}
        <div 
          className="fixed z-[998] pointer-events-none"
          style={{ 
            right: isMobile ? 8 : 20, 
            top: isMobile ? 8 : 24,
          }}
        >
          <div
            className="relative pointer-events-none transition-all duration-300"
            style={{
              width: minimapCollapsed ? 56 : minimapOuterSize,
              height: minimapCollapsed ? 56 : minimapOuterSize,
            }}
          >
            {!minimapCollapsed && (
              <>
                <div
                  className="absolute inset-0 border border-white/[0.08] rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all duration-300 pointer-events-auto hover:border-white/[0.15] overflow-hidden flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(180deg, rgba(12,12,20,0.98), rgba(12,12,20,0.92))',
                    paddingTop: '6px',
                    paddingRight: isMobile ? '10px' : '10px',
                    paddingBottom: '10px',
                    paddingLeft: '6px',
                  }}
                >
                  <Minimap
                    world={world}
                    width={minimapInnerSize}
                    height={minimapInnerSize}
                    zoom={minimapZoom}
                    onCompassClick={() => setMinimapCollapsed(true)}
                  />
                </div>
                {radialButtons.map((button) => (
                  <div
                    key={button.windowId}
                    className="absolute pointer-events-auto z-[999]"
                    style={button.style}
                  >
                    <MenuButton
                      icon={button.icon}
                      label={button.label}
                      active={openWindows.has(button.windowId)}
                      onClick={() => toggleWindow(button.windowId)}
                      size={radialButtonSize}
                      circular={true}
                    />
                  </div>
                ))}
              </>
            )}
            
            {/* Compass - always visible on outside of ring */}
            <div
              className="absolute pointer-events-auto z-[1000]"
              style={{
                right: minimapCollapsed ? 0 : isMobile ? 4 : 6,
                top: minimapCollapsed ? 0 : isMobile ? 4 : 6,
              }}
            >
              <MinimapCompass
                world={world}
                onClick={() => setMinimapCollapsed(!minimapCollapsed)}
                isCollapsed={minimapCollapsed}
              />
            </div>
          </div>
        </div>
        
        {/* Responsive windows */}
        {openWindows.has('account') && (
          <GameWindow
            title="Account"
            windowId="account"
            onClose={() => closeWindow('account')}
          >
            <AccountPanel world={world} />
          </GameWindow>
        )}

        {openWindows.has('combat') && (
          <GameWindow
            title="Combat"
            windowId="combat"
            onClose={() => closeWindow('combat')}
          >
            <CombatPanel world={world} stats={playerStats} equipment={equipment} />
          </GameWindow>
        )}

        {openWindows.has('skills') && (
          <GameWindow
            title="Skills"
            windowId="skills"
            onClose={() => closeWindow('skills')}
          >
            <SkillsPanel world={world} stats={playerStats} />
          </GameWindow>
        )}

        {openWindows.has('inventory') && (
          <GameWindow
            title="Inventory"
            windowId="inventory"
            onClose={() => closeWindow('inventory')}
          >
            <InventoryPanel items={inventory} coins={coins} world={world} />
          </GameWindow>
        )}

        {openWindows.has('equipment') && (
          <GameWindow
            title="Equipment"
            windowId="equipment"
            onClose={() => closeWindow('equipment')}
          >
            <EquipmentPanel equipment={equipment} />
          </GameWindow>
        )}

        {openWindows.has('prefs') && (
          <GameWindow
            title="Settings"
            windowId="prefs"
            onClose={() => closeWindow('prefs')}
          >
            <SettingsPanel world={world} />
          </GameWindow>
        )}
      </div>
    </HintProvider>
  )
}
