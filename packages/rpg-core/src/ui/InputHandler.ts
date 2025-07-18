import { World } from '@hyperfy/sdk'
/**
 * Input Handler - Manages mouse and keyboard input for the UI
 * Translates browser events to game events
 */

import type { World } from '../types'
import type { Vector3 as Vector2 } from '../types'

export interface InputState {
  mouse: {
    position: Vector2
    buttons: boolean[]
    wheel: number
  }
  keyboard: {
    keys: Set<string>
    shift: boolean
    ctrl: boolean
    alt: boolean
  }
  touch: {
    touches: TouchPoint[]
  }
}

export interface TouchPoint {
  id: number
  position: Vector2
  startPosition: Vector2
  startTime: number
}

export interface InputEvent {
  type: InputEventType
  playerId: string
  data: any
  timestamp: number
}

export enum InputEventType {
  MOUSE_MOVE = 'mouse_move',
  MOUSE_DOWN = 'mouse_down',
  MOUSE_UP = 'mouse_up',
  MOUSE_WHEEL = 'mouse_wheel',
  KEY_DOWN = 'key_down',
  KEY_UP = 'key_up',
  TOUCH_START = 'touch_start',
  TOUCH_MOVE = 'touch_move',
  TOUCH_END = 'touch_end'
}

export class InputHandler {
  private world: World
  private canvas: HTMLCanvasElement | null = null
  private state: InputState
  private playerId: string
  
  // Input configuration
  private mouseSensitivity: number = 1.0
  private keyBindings: Map<string, string> = new Map()
  private preventDefaultKeys: Set<string> = new Set()
  
  // Drag tracking
  private dragStart: Vector2 | null = null
  private isDragging: boolean = false
  private dragThreshold: number = 5
  
  constructor(world: World, playerId: string) {
    this.world = world
    this.playerId = playerId
    
    this.state = {
      mouse: {
        position: { x: 0, y: 0 },
        buttons: [false, false, false],
        wheel: 0
      },
      keyboard: {
        keys: new Set(),
        shift: false,
        ctrl: false,
        alt: false
      },
      touch: {
        touches: []
      }
    }
    
    this.setupDefaultKeyBindings()
  }

  /**
   * Initialize input handler with canvas
   */
  initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    
    // Mouse events
    canvas.addEventListener('mousemove', this.handleMouseMove.bind(this))
    canvas.addEventListener('mousedown', this.handleMouseDown.bind(this))
    canvas.addEventListener('mouseup', this.handleMouseUp.bind(this))
    canvas.addEventListener('wheel', this.handleMouseWheel.bind(this))
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    
    // Keyboard events
    window.addEventListener('keydown', this.handleKeyDown.bind(this))
    window.addEventListener('keyup', this.handleKeyUp.bind(this))
    
    // Touch events
    canvas.addEventListener('touchstart', this.handleTouchStart.bind(this))
    canvas.addEventListener('touchmove', this.handleTouchMove.bind(this))
    canvas.addEventListener('touchend', this.handleTouchEnd.bind(this))
    
    // Prevent text selection
    canvas.style.userSelect = 'none'
    canvas.style.touchAction = 'none'
    
    console.log('[InputHandler] Initialized')
  }

  /**
   * Setup default key bindings
   */
  private setupDefaultKeyBindings(): void {
    // Movement
    this.keyBindings.set('w', 'move_north')
    this.keyBindings.set('s', 'move_south')
    this.keyBindings.set('a', 'move_west')
    this.keyBindings.set('d', 'move_east')
    this.keyBindings.set('ArrowUp', 'camera_up')
    this.keyBindings.set('ArrowDown', 'camera_down')
    this.keyBindings.set('ArrowLeft', 'camera_left')
    this.keyBindings.set('ArrowRight', 'camera_right')
    
    // UI shortcuts
    this.keyBindings.set('i', 'toggle_inventory')
    this.keyBindings.set('Tab', 'toggle_inventory')
    this.keyBindings.set('q', 'toggle_quest')
    this.keyBindings.set('p', 'toggle_prayer')
    this.keyBindings.set('m', 'toggle_magic')
    this.keyBindings.set('k', 'toggle_skills')
    this.keyBindings.set('f', 'toggle_friends')
    this.keyBindings.set('c', 'toggle_clan')
    this.keyBindings.set('Escape', 'close_interface')
    this.keyBindings.set('Enter', 'focus_chat')
    
    // Actions
    this.keyBindings.set(' ', 'interact')
    this.keyBindings.set('Shift', 'modifier_shift')
    this.keyBindings.set('Control', 'modifier_ctrl')
    this.keyBindings.set('Alt', 'modifier_alt')
    
    // F-keys for quick prayers/magic
    for (let i = 1; i <= 12; i++) {
      this.keyBindings.set(`F${i}`, `quick_slot_${i}`)
    }
    
    // Prevent default for game keys
    this.preventDefaultKeys = new Set([
      'Tab', 'Enter', 'Escape', ' ',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`)
    ])
  }

  /**
   * Handle mouse move
   */
  private handleMouseMove(event: MouseEvent): void {
    if (!this.canvas) return
    
    const rect = this.canvas.getBoundingClientRect()
    const x = (event.clientX - rect.left) * this.mouseSensitivity
    const y = (event.clientY - rect.top) * this.mouseSensitivity
    
    const oldPosition = { ...this.state.mouse.position }
    this.state.mouse.position = { x, y }
    
    // Check for drag
    if (this.dragStart && !this.isDragging) {
      const distance = Math.sqrt(
        Math.pow(x - this.dragStart.x, 2) + 
        Math.pow(y - this.dragStart.y, 2)
      )
      
      if (distance > this.dragThreshold) {
        this.isDragging = true
        this.world.events.emit('ui:drag_start', {
          playerId: this.playerId,
          start: this.dragStart,
          current: { x, y }
        })
      }
    }
    
    // Emit events
    this.world.events.emit('input:mouse_move', {
      playerId: this.playerId,
      position: { x, y },
      delta: { x: x - oldPosition.x, y: y - oldPosition.y },
      buttons: this.state.mouse.buttons,
      isDragging: this.isDragging
    })
    
    // Find hovered UI element
    this.updateHoveredElement({ x, y })
  }

  /**
   * Handle mouse down
   */
  private handleMouseDown(event: MouseEvent): void {
    if (!this.canvas) return
    
    const rect = this.canvas.getBoundingClientRect()
    const x = (event.clientX - rect.left) * this.mouseSensitivity
    const y = (event.clientY - rect.top) * this.mouseSensitivity
    
    this.state.mouse.buttons[event.button] = true
    this.dragStart = { x, y }
    
    this.world.events.emit('input:mouse_down', {
      playerId: this.playerId,
      position: { x, y },
      button: event.button,
      shift: event.shiftKey,
      ctrl: event.ctrlKey,
      alt: event.altKey
    })
    
    // Find clicked element
    this.handleElementClick({ x, y }, event.button)
  }

  /**
   * Handle mouse up
   */
  private handleMouseUp(event: MouseEvent): void {
    if (!this.canvas) return
    
    const rect = this.canvas.getBoundingClientRect()
    const x = (event.clientX - rect.left) * this.mouseSensitivity
    const y = (event.clientY - rect.top) * this.mouseSensitivity
    
    this.state.mouse.buttons[event.button] = false
    
    // Handle drag end
    if (this.isDragging && this.dragStart) {
      this.world.events.emit('ui:drag_end', {
        playerId: this.playerId,
        start: this.dragStart,
        end: { x, y }
      })
    }
    
    this.dragStart = null
    this.isDragging = false
    
    this.world.events.emit('input:mouse_up', {
      playerId: this.playerId,
      position: { x, y },
      button: event.button
    })
  }

  /**
   * Handle mouse wheel
   */
  private handleMouseWheel(event: WheelEvent): void {
    event.preventDefault()
    
    const delta = event.deltaY > 0 ? -1 : 1
    this.state.mouse.wheel = delta
    
    this.world.events.emit('input:mouse_wheel', {
      playerId: this.playerId,
      delta,
      position: { ...this.state.mouse.position }
    })
  }

  /**
   * Handle key down
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // Prevent default for game keys
    if (this.preventDefaultKeys.has(event.key)) {
      event.preventDefault()
    }
    
    // Ignore if already pressed
    if (this.state.keyboard.keys.has(event.key)) return
    
    this.state.keyboard.keys.add(event.key)
    this.state.keyboard.shift = event.shiftKey
    this.state.keyboard.ctrl = event.ctrlKey
    this.state.keyboard.alt = event.altKey
    
    // Get action from key binding
    const action = this.keyBindings.get(event.key)
    
    this.world.events.emit('input:key_down', {
      playerId: this.playerId,
      key: event.key,
      action,
      shift: event.shiftKey,
      ctrl: event.ctrlKey,
      alt: event.altKey
    })
    
    // Handle UI shortcuts
    if (action) {
      this.handleKeyAction(action)
    }
  }

  /**
   * Handle key up
   */
  private handleKeyUp(event: KeyboardEvent): void {
    this.state.keyboard.keys.delete(event.key)
    this.state.keyboard.shift = event.shiftKey
    this.state.keyboard.ctrl = event.ctrlKey
    this.state.keyboard.alt = event.altKey
    
    const action = this.keyBindings.get(event.key)
    
    this.world.events.emit('input:key_up', {
      playerId: this.playerId,
      key: event.key,
      action
    })
  }

  /**
   * Handle touch start
   */
  private handleTouchStart(event: TouchEvent): void {
    event.preventDefault()
    
    for (const touch of event.changedTouches) {
      const rect = this.canvas!.getBoundingClientRect()
      const x = touch.clientX - rect.left
      const y = touch.clientY - rect.top
      
      const touchPoint: TouchPoint = {
        id: touch.identifier,
        position: { x, y },
        startPosition: { x, y },
        startTime: Date.now()
      }
      
      this.state.touch.touches.push(touchPoint)
      
      this.world.events.emit('input:touch_start', {
        playerId: this.playerId,
        touchId: touch.identifier,
        position: { x, y },
        touches: this.state.touch.touches.length
      })
      
      // Simulate mouse down for primary touch
      if (this.state.touch.touches.length === 1) {
        this.state.mouse.position = { x, y }
        this.state.mouse.buttons[0] = true
        this.dragStart = { x, y }
        this.handleElementClick({ x, y }, 0)
      }
    }
  }

  /**
   * Handle touch move
   */
  private handleTouchMove(event: TouchEvent): void {
    event.preventDefault()
    
    for (const touch of event.changedTouches) {
      const rect = this.canvas!.getBoundingClientRect()
      const x = touch.clientX - rect.left
      const y = touch.clientY - rect.top
      
      const touchPoint = this.state.touch.touches.find(t => t.id === touch.identifier)
      if (touchPoint) {
        touchPoint.position = { x, y }
        
        // Simulate mouse move for primary touch
        if (this.state.touch.touches[0]?.id === touch.identifier) {
          this.state.mouse.position = { x, y }
          this.updateHoveredElement({ x, y })
        }
      }
    }
    
    this.world.events.emit('input:touch_move', {
      playerId: this.playerId,
      touches: this.state.touch.touches
    })
  }

  /**
   * Handle touch end
   */
  private handleTouchEnd(event: TouchEvent): void {
    event.preventDefault()
    
    for (const touch of event.changedTouches) {
      const index = this.state.touch.touches.findIndex(t => t.id === touch.identifier)
      if (index !== -1) {
        const touchPoint = this.state.touch.touches[index]
        const duration = Date.now() - touchPoint.startTime
        
        // Check for tap vs drag
        const distance = Math.sqrt(
          Math.pow(touchPoint.position.x - touchPoint.startPosition.x, 2) +
          Math.pow(touchPoint.position.y - touchPoint.startPosition.y, 2)
        )
        
        if (distance < this.dragThreshold && duration < 500) {
          // It's a tap
          this.world.events.emit('input:tap', {
            playerId: this.playerId,
            position: touchPoint.position,
            duration
          })
        }
        
        this.state.touch.touches.splice(index, 1)
        
        // Simulate mouse up for primary touch
        if (index === 0) {
          this.state.mouse.buttons[0] = false
          this.dragStart = null
          this.isDragging = false
        }
      }
    }
    
    this.world.events.emit('input:touch_end', {
      playerId: this.playerId,
      remainingTouches: this.state.touch.touches.length
    })
  }

  /**
   * Handle key action
   */
  private handleKeyAction(action: string): void {
    switch (action) {
      case 'toggle_inventory':
        this.world.events.emit('ui:toggle_interface', {
          playerId: this.playerId,
          interface: 'inventory'
        })
        break
      case 'toggle_quest':
        this.world.events.emit('ui:toggle_interface', {
          playerId: this.playerId,
          interface: 'quest'
        })
        break
      case 'toggle_skills':
        this.world.events.emit('ui:toggle_interface', {
          playerId: this.playerId,
          interface: 'skills'
        })
        break
      case 'close_interface':
        this.world.events.emit('ui:close_all', {
          playerId: this.playerId
        })
        break
      case 'focus_chat':
        this.world.events.emit('ui:focus_chat', {
          playerId: this.playerId
        })
        break
      default:
        // Emit generic action event
        this.world.events.emit('input:action', {
          playerId: this.playerId,
          action
        })
    }
  }

  /**
   * Update hovered element
   */
  private updateHoveredElement(position: Vector2): void {
    // This would check against UI elements to find what's hovered
    // For now, just emit the position
    this.world.events.emit('ui:hover', {
      playerId: this.playerId,
      position,
      elementId: null // Would be determined by checking UI elements
    })
  }

  /**
   * Handle element click
   */
  private handleElementClick(position: Vector2, button: number): void {
    // This would check against UI elements to find what was clicked
    // For now, just emit the position
    this.world.events.emit('ui:click', {
      playerId: this.playerId,
      position,
      button,
      elementId: null // Would be determined by checking UI elements
    })
  }

  /**
   * Set key binding
   */
  setKeyBinding(key: string, action: string): void {
    this.keyBindings.set(key, action)
  }

  /**
   * Remove key binding
   */
  removeKeyBinding(key: string): void {
    this.keyBindings.delete(key)
  }

  /**
   * Get current input state
   */
  getState(): InputState {
    return this.state
  }

  /**
   * Is key pressed
   */
  isKeyPressed(key: string): boolean {
    return this.state.keyboard.keys.has(key)
  }

  /**
   * Is mouse button pressed
   */
  isMouseButtonPressed(button: number): boolean {
    return this.state.mouse.buttons[button] || false
  }

  /**
   * Get mouse position
   */
  getMousePosition(): Vector2 {
    return { ...this.state.mouse.position }
  }

  /**
   * Set mouse sensitivity
   */
  setMouseSensitivity(sensitivity: number): void {
    this.mouseSensitivity = Math.max(0.1, Math.min(2.0, sensitivity))
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.canvas) {
      // Remove all event listeners
      this.canvas.removeEventListener('mousemove', this.handleMouseMove.bind(this))
      this.canvas.removeEventListener('mousedown', this.handleMouseDown.bind(this))
      this.canvas.removeEventListener('mouseup', this.handleMouseUp.bind(this))
      this.canvas.removeEventListener('wheel', this.handleMouseWheel.bind(this))
      this.canvas.removeEventListener('touchstart', this.handleTouchStart.bind(this))
      this.canvas.removeEventListener('touchmove', this.handleTouchMove.bind(this))
      this.canvas.removeEventListener('touchend', this.handleTouchEnd.bind(this))
    }
    
    window.removeEventListener('keydown', this.handleKeyDown.bind(this))
    window.removeEventListener('keyup', this.handleKeyUp.bind(this))
  }
} 