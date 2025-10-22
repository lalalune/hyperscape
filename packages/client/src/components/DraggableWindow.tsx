import React, { useState, useRef, useEffect, useCallback } from 'react'

interface DraggableWindowProps {
  children: React.ReactNode
  initialPosition?: { x: number; y: number }
  dragHandle?: React.ReactNode
  windowId?: string
  onPositionChange?: (position: { x: number; y: number }) => void
  onFocus?: () => void
  className?: string
  style?: React.CSSProperties
  enabled?: boolean
}

const STORAGE_KEY_PREFIX = 'window_position_'

export function DraggableWindow({
  children,
  initialPosition = { x: 0, y: 0 },
  dragHandle,
  windowId = 'default',
  onPositionChange,
  onFocus,
  className = '',
  style = {},
  enabled = true
}: DraggableWindowProps) {
  // Validate position is on-screen with margins
  const validatePosition = useCallback((pos: { x: number; y: number }, windowElement?: HTMLDivElement | null): { x: number; y: number } => {
    const margins = { left: 0, top: 80, right: 40, bottom: 80 }
    const viewport = { width: window.innerWidth, height: window.innerHeight }

    const validatedPos = { ...pos }

    // Get window dimensions - handle null windowElement during initial render
    let windowWidth = 400  // Default width estimate
    let windowHeight = 500  // Default height estimate
    
    if (windowElement) {
      const rect = windowElement.getBoundingClientRect()
      windowWidth = rect.width || 400
      windowHeight = rect.height || 500
    }

    // Ensure window is within viewport bounds
    validatedPos.x = Math.max(margins.left, Math.min(validatedPos.x, viewport.width - windowWidth - margins.right))
    validatedPos.y = Math.max(margins.top, Math.min(validatedPos.y, viewport.height - windowHeight - margins.bottom))

    return validatedPos
  }, [])

  // Load saved position from localStorage
  const loadSavedPosition = useCallback((): { x: number; y: number } => {
    if (!windowId) return initialPosition

    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${windowId}`)
      if (saved) {
        const parsed = JSON.parse(saved) as { x: number; y: number }
        // Validate the saved position is on-screen
        return validatePosition(parsed || initialPosition)
      }
    } catch (e) {
      console.warn('Failed to load window position:', e)
    }
    return validatePosition(initialPosition)
  }, [windowId, initialPosition, validatePosition])

  const [position, setPosition] = useState<{ x: number; y: number }>(loadSavedPosition)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const windowRef = useRef<HTMLDivElement>(null)
  const dragHandleRef = useRef<HTMLDivElement>(null)

  // Save position to localStorage
  const savePosition = useCallback((newPosition: { x: number; y: number }) => {
    if (!windowId) return

    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${windowId}`, JSON.stringify(newPosition))
    } catch (_e) {
      console.warn('Failed to save window position:', _e)
    }
  }, [windowId])

  // Re-validate position after window is rendered with actual dimensions
  useEffect(() => {
    if (windowRef.current) {
      const validatedPos = validatePosition(position, windowRef.current)
      // Only update if position changed significantly (more than 5px)
      if (Math.abs(validatedPos.x - position.x) > 5 || Math.abs(validatedPos.y - position.y) > 5) {
        setPosition(validatedPos)
        savePosition(validatedPos)
      }
    }
  }, []) // Run once after mount to avoid infinite loop

  // Re-validate on window resize
  useEffect(() => {
    const handleResize = () => {
      if (windowRef.current) {
        const validatedPos = validatePosition(position, windowRef.current)
        setPosition(validatedPos)
        savePosition(validatedPos)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [position, validatePosition, savePosition])

  // Handle dragging
  useEffect(() => {
    if (!enabled || !isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
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
      savePosition(newPosition)
      onPositionChange?.(newPosition)
    }

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (!touch) return

      const newPosition = {
        x: touch.clientX - dragOffset.x,
        y: touch.clientY - dragOffset.y
      }

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
      savePosition(newPosition)
      onPositionChange?.(newPosition)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    const handleTouchEnd = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', handleTouchEnd)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isDragging, dragOffset, position, enabled, onPositionChange, savePosition])

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

  const handleWindowClick = useCallback((_e: React.MouseEvent) => {
    // Bring window to front when clicked
    if (onFocus) {
      onFocus()
    }
  }, [onFocus])

  return (
    <div
      ref={windowRef}
      className={`draggable-window absolute ${isDragging ? 'select-none' : 'select-auto'} ${className}`}
      style={{
        left: position.x,
        top: position.y,
        ...style
      }}
      onClick={handleWindowClick}
    >
      {dragHandle ? (
        <div
          ref={dragHandleRef}
          className={`drag-handle select-none ${enabled ? 'cursor-grab' : 'cursor-auto'} ${isDragging ? 'cursor-grabbing' : ''}`}
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