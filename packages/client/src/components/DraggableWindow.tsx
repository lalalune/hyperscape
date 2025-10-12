import React, { useState, useRef, useEffect } from 'react'
import type { DraggableWindowProps } from '@hyperscape/shared'

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

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return
      
      const touch = e.touches[0]
      if (!touch) return
      
      const newPosition = {
        x: touch.clientX - dragOffset.x,
        y: touch.clientY - dragOffset.y
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
    
    const handleTouchEnd = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('touchmove', handleTouchMove)
      document.addEventListener('touchend', handleTouchEnd)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isDragging, dragOffset, onPositionChange, enabled])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!enabled) return
    // Only start dragging on left mouse button to avoid hijacking right-drag camera orbit
    if (e.button !== 0) return

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
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!enabled) return
    
    const touch = e.touches[0]
    if (!touch) return
    
    const windowElement = windowRef.current
    if (windowElement) {
      const rect = windowElement.getBoundingClientRect()
      setDragOffset({
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      })
      setIsDragging(true)
    }
  }

  return (
    <div
      ref={windowRef}
      className={`draggable-window absolute ${isDragging ? 'select-none cursor-grabbing' : 'select-auto cursor-auto'} ${className}`}
      style={{
        left: position.x,
        top: position.y,
        ...style
      }}
    >
      {dragHandle ? (
        <div
          ref={dragHandleRef}
          className={`drag-handle select-none ${enabled ? 'cursor-grab' : 'cursor-auto'}`}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {dragHandle}
        </div>
      ) : (
        <div
          ref={dragHandleRef}
          className={`drag-handle-overlay absolute top-0 left-0 right-0 h-12 z-[1] select-none ${enabled ? 'cursor-grab' : 'cursor-auto'}`}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        />
      )}
      {children}
    </div>
  )
}