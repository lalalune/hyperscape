import React, { useRef, useState, useEffect } from 'react'
import { DraggableWindow } from '../DraggableWindow'
import { windowManager } from '../../utils/responsiveWindowManager'

interface GameWindowProps {
  title: string
  onClose: () => void
  defaultX?: number
  defaultY?: number
  windowId?: string
  children: React.ReactNode
}

export function GameWindow({ title, onClose, defaultX, defaultY, windowId = 'default', children }: GameWindowProps) {
  const dragHandleRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(windowManager.isMobile())
  const [isTablet, setIsTablet] = useState(windowManager.isTablet())
  const [showBackdrop, setShowBackdrop] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(windowManager.isMobile())
      setIsTablet(windowManager.isTablet())
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    // Show backdrop on mobile when window opens
    if (isMobile) {
      setShowBackdrop(true)
    }
  }, [isMobile])

  // Calculate responsive position
  const position = windowManager.getWindowPosition(windowId)
  const finalX = defaultX !== undefined ? defaultX : position.x
  const finalY = defaultY !== undefined ? defaultY : position.y

  // Get responsive dimensions
  const dimensions = windowManager.getWindowDimensions()
  const maxWidth = windowManager.getMaxWindowWidth()
  const minWidth = windowManager.getMinWindowWidth()

  // Mobile: bottom sheet style with backdrop
  if (isMobile) {
    return (
      <>
        {/* Mobile backdrop */}
        {showBackdrop && (
          <div
            className="fixed inset-0 bg-black/50 pointer-events-auto z-[999] transition-opacity duration-300"
            onClick={onClose}
            style={{ opacity: showBackdrop ? 1 : 0 }}
          />
        )}

        {/* Mobile bottom sheet */}
        <div
          className="fixed bottom-0 left-0 right-0 bg-[rgba(11,10,21,0.98)] border-t rounded-t-2xl shadow-[0_-10px_30px_rgba(0,0,0,0.5)] pointer-events-auto z-[1000] animate-slideUp"
          style={{
            borderColor: 'rgba(242, 208, 138, 0.4)',
            maxHeight: '85vh',
            bottom: 'calc(var(--mobile-chat-offset, 0px) + env(safe-area-inset-bottom))',
          }}
        >
          <style>{`
            @keyframes slideUp {
              from {
                transform: translateY(100%);
              }
              to {
                transform: translateY(0);
              }
            }
            .animate-slideUp {
              animation: slideUp 0.3s ease-out;
            }
          `}</style>

          {/* Drag handle indicator */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-12 h-1 rounded-full" style={{ backgroundColor: 'rgba(242, 208, 138, 0.3)' }} />
          </div>

          {/* Header */}
          <div
            className="bg-[rgba(11,10,21,0.98)] border-b py-3 px-4 flex items-center justify-between select-none"
            style={{
              borderBottomColor: 'rgba(242, 208, 138, 0.3)',
            }}
          >
            <div className="font-semibold text-base" style={{ color: '#f2d08a' }}>{title}</div>
            <button
              onClick={onClose}
              className="border-none text-white rounded-md w-8 h-8 cursor-pointer flex items-center justify-center text-base font-bold touch-manipulation"
              style={{
                WebkitTapHighlightColor: 'transparent',
                backgroundColor: '#8b4513',
              }}
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
            {children}
          </div>
        </div>
      </>
    )
  }

  // Tablet & Desktop: draggable window
  return (
    <DraggableWindow
      initialPosition={{ x: finalX, y: finalY }}
      dragHandle={
        <div
          ref={dragHandleRef}
          className="bg-[rgba(11,10,21,0.98)] border-b py-2.5 px-3 flex items-center justify-between cursor-grab select-none rounded-t-xl"
          style={{
            borderBottomColor: 'rgba(242, 208, 138, 0.3)',
          }}
        >
          <div className="font-semibold text-sm" style={{ color: '#f2d08a' }}>{title}</div>
          <button
            onClick={onClose}
            className="border-none text-white rounded-md w-6 h-6 cursor-pointer flex items-center justify-center text-sm font-bold touch-manipulation"
            style={{
              WebkitTapHighlightColor: 'transparent',
              backgroundColor: '#8b4513',
            }}
          >
            ✕
          </button>
        </div>
      }
      className="bg-[rgba(11,10,21,0.96)] border rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] pointer-events-auto z-[1000]"
      style={{
        borderColor: 'rgba(242, 208, 138, 0.4)',
        minWidth: minWidth,
        maxWidth: maxWidth,
        width: isTablet ? '90vw' : dimensions.width,
      }}
    >
      <div className="p-3 overflow-y-auto" style={{ maxHeight: dimensions.maxHeight }}>
        {children}
      </div>
    </DraggableWindow>
  )
}

