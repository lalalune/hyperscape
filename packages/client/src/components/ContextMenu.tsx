import React, { useEffect, useRef } from 'react'

interface ContextMenuProps {
  visible: boolean
  position: { x: number; y: number }
  actions: Array<{ id: string; label: string; icon?: string; enabled: boolean; onClick: () => void }>
  onClose: () => void
  title?: string
}

export function ContextMenu({ visible, position, actions, onClose, title }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [visible, onClose])

  if (!visible) return null

  return (
    <div 
      ref={menuRef} 
      className="fixed bg-dark-bg border border-dark-border backdrop-blur-md rounded-lg py-2 min-w-[150px] z-[2000] text-sm text-white/90 shadow-lg pointer-events-auto"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {title && (
        <div className="py-2 px-4 border-b border-white/10 mb-1 font-medium text-[0.8125rem] text-white/70">
          {title}
        </div>
      )}
      {actions.map(action => (
        <button
          key={action.id}
          disabled={!action.enabled}
          onClick={(e) => {
            // Prevent bubbling to canvas/document which could trigger movement
            e.stopPropagation()
            if (action.enabled) {
              action.onClick()
              onClose()
            }
          }}
          className={`w-full py-2 px-4 border-none bg-transparent text-sm flex items-center gap-2 transition-colors duration-200 ${
            action.enabled 
              ? 'text-white/90 cursor-pointer hover:bg-white/10' 
              : 'text-white/40 cursor-not-allowed'
          }`}
          onMouseDown={(e) => {
            // Prevent this click from bubbling to the canvas/document and triggering movement
            e.stopPropagation()
          }}
        >
          {action.icon && (
            <span className="text-base">{action.icon}</span>
          )}
          {action.label}
        </button>
      ))}
    </div>
  )
}