import React, { useEffect, useState } from 'react'

import { World } from '@hyperscape/shared'
import type { InventorySlotItem, PlayerEquipmentItems, PlayerStats } from '@hyperscape/shared'
import { EventType } from '@hyperscape/shared'
import { HintProvider } from './Hint'
import { Minimap } from './Minimap'
import { MenuButton } from './shared/MenuButton'
import { GameWindow } from './shared/GameWindow'
import { MinimapCompass } from './shared/MinimapCompass'
import { MinimapStaminaBar } from './shared/MinimapStaminaBar'
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
  const [livekit, setLiveKit] = useState(() => world.livekit!.status)
  const [inventory, setInventory] = useState<InventorySlotItem[]>([])
  const [equipment, setEquipment] = useState<PlayerEquipmentItems | null>(null)
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null)
  const [coins, setCoins] = useState<number>(0)
  const [minimapCollapsed, setMinimapCollapsed] = useState<boolean>(false)
  const [isMobile, setIsMobile] = useState<boolean>(false)
  
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
      const data = raw as { items: InventorySlotItem[]; playerId?: string; coins?: number }
      if (Array.isArray(data.items)) {
        setInventory(data.items)
      }
      if (typeof data.coins === 'number') {
        setCoins(data.coins)
      }
    }
    const onCoins = (raw: unknown) => {
      const data = raw as { playerId: string; coins: number }
      const localId = world.entities.player?.id
      if (!localId || data.playerId === localId) setCoins(typeof data.coins === 'number' ? data.coins : 0)
    }
    world.on(EventType.UI_UPDATE, onUIUpdate)
    world.on(EventType.INVENTORY_UPDATED, onInventory)
    world.on(EventType.INVENTORY_UPDATE_COINS, onCoins)
    // Request initial inventory snapshot once local player exists; hydrate from cached packet if available
    const requestInitial = () => {
      const lp = world.entities.player?.id
      if (lp) {
        // If network already cached an inventory packet, use it immediately
        try {
          const net = (world.network as unknown) as { lastInventoryByPlayerId?: Record<string, { playerId: string; items: InventorySlotItem[]; coins: number; maxSlots: number }> }
          const cached = net?.lastInventoryByPlayerId?.[lp]
          if (cached && Array.isArray(cached.items)) {
            setInventory(cached.items)
            setCoins(cached.coins)
          }
        } catch {}
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
      // Auto-collapse on mobile by default
      if (mobile && !minimapCollapsed) {
        setMinimapCollapsed(true)
      }
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  return (
    <HintProvider>
      <div
        className='sidebar absolute text-base inset-0 pointer-events-none z-[1]'
      >
        
        {/* Minimap - top right */}
        <div 
          className="fixed z-[998] pointer-events-none"
          style={{ 
            right: isMobile ? 8 : 20, 
            top: isMobile ? 8 : 24,
          }}
        >
          {!minimapCollapsed && (
            <div className="border border-white/[0.08] rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] p-2 pb-1.5 transition-all duration-300 overflow-visible pointer-events-auto flex flex-col gap-2 hover:border-white/[0.15]" 
              style={{
                background: 'linear-gradient(180deg, rgba(12,12,20,0.98), rgba(12,12,20,0.92))',
              }}
            >
              <Minimap 
                world={world}
                width={isMobile ? 164 : 204}
                height={isMobile ? 164 : 204}
                zoom={isMobile ? 40 : 50}
                onCompassClick={() => setMinimapCollapsed(true)}
                showStaminaBar={false}
              />
              <MinimapStaminaBar world={world} width={isMobile ? 164 : 204} />
            </div>
          )}
          
          {/* Stamina bar - shows when minimap is collapsed, positioned to left of compass */}
          {minimapCollapsed && (
            <div className="absolute right-12 top-2 pointer-events-auto">
              <MinimapStaminaBar world={world} width={120} />
            </div>
          )}
          
          {/* Compass - always visible in same position */}
          <div 
            className="absolute pointer-events-auto z-20"
            style={{
              left: minimapCollapsed ? undefined : 14,
              right: minimapCollapsed ? 0 : undefined,
              top: minimapCollapsed ? 0 : 14,
            }}
          >
            <MinimapCompass 
              world={world} 
              onClick={() => setMinimapCollapsed(!minimapCollapsed)}
              isCollapsed={minimapCollapsed}
            />
          </div>
        </div>
        
        {/* Left button bar - center left */}
        <div 
          className="fixed top-1/2 -translate-y-1/2 flex flex-col gap-2 z-[999] pointer-events-auto"
          style={{
            left: isMobile ? 8 : 20,
          }}
        >
          <MenuButton
            icon="👤"
            label="Account"
            active={openWindows.has('account')}
            onClick={() => toggleWindow('account')}
          />
          <MenuButton
            icon="⚔️"
            label="Combat"
            active={openWindows.has('combat')}
            onClick={() => toggleWindow('combat')}
          />
          <MenuButton
            icon="🧠"
            label="Skills"
            active={openWindows.has('skills')}
            onClick={() => toggleWindow('skills')}
          />
          <MenuButton
            icon="🎒"
            label="Inventory"
            active={openWindows.has('inventory')}
            onClick={() => toggleWindow('inventory')}
          />
          <MenuButton
            icon="🛡️"
            label="Equipment"
            active={openWindows.has('equipment')}
            onClick={() => toggleWindow('equipment')}
          />
          <MenuButton
            icon="⚙️"
            label="Settings"
            active={openWindows.has('prefs')}
            onClick={() => toggleWindow('prefs')}
          />
          
          {/* Voice/VR controls */}
          <div className="h-4" />
          {livekit.available && world.livekit?.room && (
            <MenuButton
              icon={livekit.audio ? '🎤' : '🔇'}
              label={livekit.audio ? 'Mic On' : 'Mic Off'}
              active={false}
              onClick={() => {
                if (livekit.audio) {
                  world.livekit!.disableAudio()
                } else {
                  world.livekit!.enableAudio()
                }
              }}
            />
          )}
          {world.xr?.supportsVR && (
            <MenuButton
              icon="🥽"
              label="VR"
              active={false}
              onClick={() => world.xr?.enter()}
            />
          )}
        </div>
        
        {/* Draggable windows */}
        {openWindows.has('account') && (
          <GameWindow
            title="Account"
            onClose={() => closeWindow('account')}
            defaultX={window.innerWidth - 360}
            defaultY={100}
          >
            <AccountPanel world={world} />
          </GameWindow>
        )}
        
        {openWindows.has('combat') && (
          <GameWindow
            title="Combat"
            onClose={() => closeWindow('combat')}
            defaultX={window.innerWidth - 360}
            defaultY={100}
          >
            <CombatPanel world={world} stats={playerStats} equipment={equipment} />
          </GameWindow>
        )}
        
        {openWindows.has('skills') && (
          <GameWindow
            title="Skills"
            onClose={() => closeWindow('skills')}
            defaultX={window.innerWidth - 360}
            defaultY={100}
          >
            <SkillsPanel world={world} stats={playerStats} />
          </GameWindow>
        )}
        
        {openWindows.has('inventory') && (
          <GameWindow
            title="Inventory"
            onClose={() => closeWindow('inventory')}
            defaultX={window.innerWidth - 360}
            defaultY={100}
          >
            <InventoryPanel items={inventory} coins={coins} />
          </GameWindow>
        )}
        
        {openWindows.has('equipment') && (
          <GameWindow
            title="Equipment"
            onClose={() => closeWindow('equipment')}
            defaultX={window.innerWidth - 360}
            defaultY={100}
          >
            <EquipmentPanel equipment={equipment} />
          </GameWindow>
        )}
        
        {openWindows.has('prefs') && (
          <GameWindow
            title="Settings"
            onClose={() => closeWindow('prefs')}
            defaultX={window.innerWidth - 400}
            defaultY={100}
          >
            <SettingsPanel world={world} />
          </GameWindow>
        )}
      </div>
    </HintProvider>
  )
}
