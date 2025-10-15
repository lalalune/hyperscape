import React, { useState, useEffect } from 'react'
import type { World } from '@hyperscape/shared'

export interface ContextMenuAction {
  id: string
  label: string
  icon?: string
  enabled: boolean
  onClick: () => void
}

export interface ContextMenuState {
  visible: boolean
  position: { x: number; y: number }
  target: {
    id: string
    type: 'item' | 'resource' | 'mob' | 'corpse' | 'npc' | 'bank' | 'store' | 'headstone'
    name: string
  } | null
  actions: ContextMenuAction[]
}

interface EntityContextMenuProps {
  world: World
}

export function EntityContextMenu({ world: _world }: EntityContextMenuProps) {
  const [menu, setMenu] = useState<ContextMenuState>({
    visible: false,
    position: { x: 0, y: 0 },
    target: null,
    actions: []
  })

  useEffect(() => {
    // Listen for context menu requests from any system
    const handleContextMenu = (event: Event) => {
      const customEvent = event as CustomEvent<{
        target: {
          id: string
          type: 'item' | 'resource' | 'mob' | 'corpse' | 'npc' | 'bank' | 'store'
          name: string
          position?: { x: number; y: number; z: number }
          [key: string]: unknown
        }
        mousePosition: { x: number; y: number }
        items: Array<{ id: string; label: string; enabled: boolean }>
      }>

      if (!customEvent.detail) return

      const { target, mousePosition, items } = customEvent.detail

      // Convert items to actions with onClick handlers
      const actions: ContextMenuAction[] = items.map(item => ({
        ...item,
        onClick: () => {
          console.log('[EntityContextMenu] Action clicked:', item.id, 'for target:', target.id);
          // Dispatch selection event
          const selectEvent = new CustomEvent('contextmenu:select', {
            detail: {
              actionId: item.id,
              targetId: target.id
            }
          })
          window.dispatchEvent(selectEvent)
          console.log('[EntityContextMenu] Dispatched contextmenu:select event');
          setMenu(prev => ({ ...prev, visible: false }))
        }
      }))

      setMenu({
        visible: true,
        position: mousePosition,
        target: {
          id: target.id,
          type: target.type,
          name: target.name
        },
        actions
      })
    }

    // Listen for close events
    const handleClose = () => {
      setMenu(prev => ({ ...prev, visible: false }))
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      console.log('[EntityContextMenu] Document click (for close), target:', target.className);
      
      // Don't close if clicking inside menu
      if (target.closest('.context-menu')) {
        console.log('[EntityContextMenu] Click inside menu, NOT closing');
        return;
      }
      
      console.log('[EntityContextMenu] Click outside menu, closing');
      setMenu(prev => ({ ...prev, visible: false }))
    }

    window.addEventListener('contextmenu', handleContextMenu as EventListener)
    window.addEventListener('contextmenu:close', handleClose as EventListener)
    // Use click (not mousedown) to let onClick handlers fire first
    document.addEventListener('click', handleClickOutside, false)

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu as EventListener)
      window.removeEventListener('contextmenu:close', handleClose as EventListener)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [])

  if (!menu.visible || !menu.target) return null

  console.log('[EntityContextMenu] Rendering menu with', menu.actions.length, 'actions for', menu.target.type);
  console.log('[EntityContextMenu] Menu position:', menu.position);
  console.log('[EntityContextMenu] Menu actions:', menu.actions.map(a => ({ id: a.id, label: a.label, enabled: a.enabled })));

  return (
    <div
      className="context-menu fixed bg-[rgba(20,20,20,0.95)] border border-[#555] rounded pointer-events-auto z-[99999]"
      style={{
        left: `${menu.position.x}px`,
        top: `${menu.position.y}px`,
        minWidth: '160px',
        pointerEvents: 'auto',
        userSelect: 'none',
        color: '#fff' // White text
      }}
      onClick={(e) => {
        console.log('[EntityContextMenu] Menu container clicked');
        e.stopPropagation();
      }}
      onMouseEnter={() => console.log('[EntityContextMenu] Mouse entered menu')}
      onMouseLeave={() => console.log('[EntityContextMenu] Mouse left menu')}
    >
      {menu.actions.map((action, index) => {
        console.log('[EntityContextMenu] Rendering action', index, ':', action.id, action.label);
        return (
          <div
            key={action.id}
            className={`px-3 py-1.5 text-sm text-white transition-colors ${
              action.enabled
                ? 'cursor-pointer hover:bg-[#2a2a2a] hover:text-white'
                : 'cursor-not-allowed opacity-50'
            }`}
            style={{ 
              pointerEvents: 'auto',
              color: '#fff' // Explicit white text
            }}
            onClick={(e) => {
              console.log('[EntityContextMenu] ✅ Menu item CLICKED:', action.id, 'enabled:', action.enabled);
              e.preventDefault();
              e.stopPropagation();
              if (action.enabled) {
                console.log('[EntityContextMenu] Calling onClick for action:', action.id);
                action.onClick()
              } else {
                console.log('[EntityContextMenu] Action disabled, not calling onClick');
              }
            }}
            onMouseDown={(e) => {
              console.log('[EntityContextMenu] Menu item mousedown:', action.id);
              e.preventDefault();
              e.stopPropagation();
            }}
            onMouseEnter={() => console.log('[EntityContextMenu] Mouse entered action:', action.id)}
          >
            {action.icon && <span className="mr-2">{action.icon}</span>}
            {action.label}
          </div>
        );
      })}
    </div>
  )
}

