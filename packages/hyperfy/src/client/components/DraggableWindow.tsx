import React, { useState, useRef, useEffect } from 'react'

interface DraggableWindowProps {
  children: React.ReactNode
  initialPosition?: { x: number; y: number }
  dragHandle?: React.ReactNode
  onPositionChange?: (position: { x: number; y: number }) => void
  className?: string
  style?: React.CSSProperties
  enabled?: boolean
}

export function DraggableWindow({
  children,
  initialPosition = { x: 0, y: 0 },
  dragHandle,
  onPositionChange,
  className = '',
  style = {},
  enabled = true
}: DraggableWindowProps) {
  const [position, setPosition] = useState(initialPosition)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const windowRef = useRef<HTMLDivElement>(null)
  const dragHandleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!enabled) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      
      const newPosition = {
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      }
      
      // Clamp to viewport bounds
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      }
      
      const windowElement = windowRef.current
      if (windowElement) {
        const rect = windowElement.getBoundingClientRect()
        
        newPosition.x = Math.max(0, Math.min(newPosition.x, viewport.width - rect.width))
        newPosition.y = Math.max(0, Math.min(newPosition.y, viewport.height - rect.height))
      }
      
      setPosition(newPosition)
      onPositionChange?.(newPosition)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset, onPositionChange, enabled])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!enabled) return
    
    e.preventDefault()
    
    const windowElement = windowRef.current
    if (windowElement) {
      const rect = windowElement.getBoundingClientRect()
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
      setIsDragging(true)
    }
  }

  const windowStyle: React.CSSProperties = {
    position: 'absolute',
    left: position.x,
    top: position.y,
    userSelect: isDragging ? 'none' : 'auto',
    cursor: isDragging ? 'grabbing' : 'auto',
    ...style
  }

  const dragHandleStyle: React.CSSProperties = {
    cursor: enabled ? 'grab' : 'auto',
    userSelect: 'none'
  }

  return (
    <div
      ref={windowRef}
      className={`draggable-window ${className}`}
      style={windowStyle}
    >
      {dragHandle ? (
        <div
          ref={dragHandleRef}
          className="drag-handle"
          style={dragHandleStyle}
          onMouseDown={handleMouseDown}
        >
          {dragHandle}
        </div>
      ) : (
        <div
          ref={dragHandleRef}
          className="drag-handle-overlay"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3rem',
            zIndex: 1,
            ...dragHandleStyle
          }}
          onMouseDown={handleMouseDown}
        />
      )}
      {children}
    </div>
  )
}