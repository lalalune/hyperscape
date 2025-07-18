/**
 * UI System - Manages all user interface elements for human players
 * Provides HUD, inventory, chat, and other game interfaces
 */

import { System } from "../types/hyperfy"
import type { World } from '../types'
import type { Vector3 as Vector2 } from '../types'

export interface UIElement {
  id: string
  type: UIElementType
  position: Vector2
  size: Vector2
  visible: boolean
  interactive: boolean
  layer: number
  children?: UIElement[]
  data?: any
}

export enum UIElementType {
  PANEL = 'panel',
  BUTTON = 'button',
  TEXT = 'text',
  ICON = 'icon',
  PROGRESS_BAR = 'progress_bar',
  INVENTORY_SLOT = 'inventory_slot',
  CHAT_BOX = 'chat_box',
  MINIMAP = 'minimap',
  CONTEXT_MENU = 'context_menu'
}

export interface UIComponent {
  type: 'ui'
  elements: Map<string, UIElement>
  activeInterface?: string
  hoveredElement?: string
  focusedElement?: string
}

export interface UITheme {
  colors: {
    primary: string
    secondary: string
    background: string
    text: string
    border: string
    hover: string
    active: string
    disabled: string
  }
  fonts: {
    main: string
    heading: string
    chat: string
  }
  sizes: {
    text: number
    iconSmall: number
    iconMedium: number
    iconLarge: number
    borderRadius: number
    padding: number
  }
}

export class UISystem extends System {
  private interfaces: Map<string, UIInterface> = new Map()
  private theme: UITheme
  private elementIdCounter: number = 0
  
  // UI state
  private activeInterfaces: Set<string> = new Set()
  private draggedElement: UIElement | null = null
  private tooltipElement: UIElement | null = null
  
  constructor(world: World) {
    super(world)
    this.theme = this.getDefaultTheme()
  }

  async initialize(): Promise<void> {
    console.log('[UISystem] Initializing...')
    
    // Create default interfaces
    this.createHUD()
    this.createInventoryInterface()
    this.createChatInterface()
    this.createBankInterface()
    this.createShopInterface()
    this.createQuestInterface()
    this.createSkillsInterface()
    this.createContextMenu()
    this.createSettingsInterface()
    
    // Listen for events
    this.world.events.on('player:connect', this.handlePlayerConnect.bind(this))
    this.world.events.on('player:disconnect', this.handlePlayerDisconnect.bind(this))
    this.world.events.on('ui:click', this.handleClick.bind(this))
    this.world.events.on('ui:hover', this.handleHover.bind(this))
    this.world.events.on('ui:drag', this.handleDrag.bind(this))
    
    console.log('[UISystem] Initialized with game interfaces')
  }

  /**
   * Get default theme
   */
  private getDefaultTheme(): UITheme {
    return {
      colors: {
        primary: '#4a3c28',
        secondary: '#8b7355',
        background: '#2c2416',
        text: '#f4e4bc',
        border: '#6b5d54',
        hover: '#5a4a3a',
        active: '#7a6a5a',
        disabled: '#3a3026'
      },
      fonts: {
        main: 'RuneScape',
        heading: 'RuneScape Bold',
        chat: 'RuneScape Chat'
      },
      sizes: {
        text: 14,
        iconSmall: 24,
        iconMedium: 32,
        iconLarge: 48,
        borderRadius: 4,
        padding: 8
      }
    }
  }

  /**
   * Create HUD interface
   */
  private createHUD(): void {
    const hud: UIInterface = {
      id: 'hud',
      name: 'HUD',
      elements: new Map(),
      layout: 'fixed',
      visible: true,
      alwaysVisible: true
    }

    // Health bar
    const healthBar = this.createElement({
      type: UIElementType.PROGRESS_BAR,
      position: { x: 10, y: 10 },
      size: { x: 200, y: 30 },
      data: {
        current: 10,
        max: 10,
        color: '#ff0000',
        label: 'Health'
      }
    })
    hud.elements.set(healthBar.id, healthBar)

    // Prayer bar
    const prayerBar = this.createElement({
      type: UIElementType.PROGRESS_BAR,
      position: { x: 10, y: 45 },
      size: { x: 200, y: 30 },
      data: {
        current: 1,
        max: 1,
        color: '#00ff00',
        label: 'Prayer'
      }
    })
    hud.elements.set(prayerBar.id, prayerBar)

    // Run energy
    const runEnergy = this.createElement({
      type: UIElementType.PROGRESS_BAR,
      position: { x: 10, y: 80 },
      size: { x: 200, y: 30 },
      data: {
        current: 100,
        max: 100,
        color: '#ffff00',
        label: 'Run Energy'
      }
    })
    hud.elements.set(runEnergy.id, runEnergy)

    // Minimap
    const minimap = this.createElement({
      type: UIElementType.MINIMAP,
      position: { x: -220, y: 10 }, // Negative x for right alignment
      size: { x: 200, y: 200 },
      data: {
        zoom: 2,
        showPlayers: true,
        showNPCs: true,
        showItems: false
      }
    })
    hud.elements.set(minimap.id, minimap)

    // Combat level
    const combatLevel = this.createElement({
      type: UIElementType.TEXT,
      position: { x: 220, y: 10 },
      size: { x: 100, y: 30 },
      data: {
        text: 'Combat: 3',
        fontSize: 16,
        color: this.theme.colors.text
      }
    })
    hud.elements.set(combatLevel.id, combatLevel)

    this.interfaces.set('hud', hud)
  }

  /**
   * Create inventory interface
   */
  private createInventoryInterface(): void {
    const inventory: UIInterface = {
      id: 'inventory',
      name: 'Inventory',
      elements: new Map(),
      layout: 'grid',
      visible: false,
      position: { x: -280, y: 220 },
      size: { x: 260, y: 340 }
    }

    // Create inventory slots (7x4 grid)
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 4; col++) {
        const slot = this.createElement({
          type: UIElementType.INVENTORY_SLOT,
          position: { 
            x: 10 + col * 62,
            y: 40 + row * 44
          },
          size: { x: 56, y: 40 },
          data: {
            slotIndex: row * 4 + col,
            item: null
          }
        })
        inventory.elements.set(slot.id, slot)
      }
    }

    // Close button
    const closeBtn = this.createElement({
      type: UIElementType.BUTTON,
      position: { x: 230, y: 5 },
      size: { x: 24, y: 24 },
      data: {
        icon: 'close',
        action: 'toggle_inventory'
      }
    })
    inventory.elements.set(closeBtn.id, closeBtn)

    this.interfaces.set('inventory', inventory)
  }

  /**
   * Create chat interface
   */
  private createChatInterface(): void {
    const chat: UIInterface = {
      id: 'chat',
      name: 'Chat',
      elements: new Map(),
      layout: 'fixed',
      visible: true,
      alwaysVisible: true,
      position: { x: 10, y: -200 }, // Bottom left
      size: { x: 500, y: 180 }
    }

    // Chat box
    const chatBox = this.createElement({
      type: UIElementType.CHAT_BOX,
      position: { x: 0, y: 0 },
      size: { x: 500, y: 150 },
      data: {
        messages: [],
        maxMessages: 100,
        tabs: ['All', 'Game', 'Public', 'Private', 'Clan', 'Trade']
      }
    })
    chat.elements.set(chatBox.id, chatBox)

    // Input field
    const inputField = this.createElement({
      type: UIElementType.TEXT,
      position: { x: 0, y: 155 },
      size: { x: 500, y: 25 },
      interactive: true,
      data: {
        placeholder: 'Press Enter to chat...',
        maxLength: 128,
        editable: true
      }
    })
    chat.elements.set(inputField.id, inputField)

    this.interfaces.set('chat', chat)
  }

  /**
   * Create bank interface
   */
  private createBankInterface(): void {
    const bank: UIInterface = {
      id: 'bank',
      name: 'Bank',
      elements: new Map(),
      layout: 'tabs',
      visible: false,
      position: { x: 100, y: 50 },
      size: { x: 600, y: 400 }
    }

    // Bank tabs
    for (let i = 0; i < 9; i++) {
      const tab = this.createElement({
        type: UIElementType.BUTTON,
        position: { x: 10 + i * 60, y: 10 },
        size: { x: 50, y: 30 },
        data: {
          text: i === 0 ? 'All' : `Tab ${i}`,
          tabIndex: i,
          action: 'switch_bank_tab'
        }
      })
      bank.elements.set(tab.id, tab)
    }

    // Bank slots (8x6 grid per tab)
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 8; col++) {
        const slot = this.createElement({
          type: UIElementType.INVENTORY_SLOT,
          position: { 
            x: 10 + col * 70,
            y: 50 + row * 50
          },
          size: { x: 64, y: 44 },
          data: {
            slotIndex: row * 8 + col,
            item: null,
            isBank: true
          }
        })
        bank.elements.set(slot.id, slot)
      }
    }

    // Close button
    const closeBtn = this.createElement({
      type: UIElementType.BUTTON,
      position: { x: 560, y: 10 },
      size: { x: 30, y: 30 },
      data: {
        icon: 'close',
        action: 'close_bank'
      }
    })
    bank.elements.set(closeBtn.id, closeBtn)

    this.interfaces.set('bank', bank)
  }

  /**
   * Create shop interface
   */
  private createShopInterface(): void {
    const shop: UIInterface = {
      id: 'shop',
      name: 'Shop',
      elements: new Map(),
      layout: 'fixed',
      visible: false,
      position: { x: 150, y: 100 },
      size: { x: 500, y: 350 }
    }

    // Shop title
    const title = this.createElement({
      type: UIElementType.TEXT,
      position: { x: 10, y: 10 },
      size: { x: 480, y: 30 },
      data: {
        text: 'General Store',
        fontSize: 20,
        align: 'center'
      }
    })
    shop.elements.set(title.id, title)

    // Shop items (5x8 grid)
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 5; col++) {
        const slot = this.createElement({
          type: UIElementType.INVENTORY_SLOT,
          position: { 
            x: 10 + col * 95,
            y: 50 + row * 35
          },
          size: { x: 90, y: 30 },
          data: {
            slotIndex: row * 5 + col,
            item: null,
            isShop: true,
            showPrice: true
          }
        })
        shop.elements.set(slot.id, slot)
      }
    }

    // Close button
    const closeBtn = this.createElement({
      type: UIElementType.BUTTON,
      position: { x: 460, y: 10 },
      size: { x: 30, y: 30 },
      data: {
        icon: 'close',
        action: 'close_shop'
      }
    })
    shop.elements.set(closeBtn.id, closeBtn)

    this.interfaces.set('shop', shop)
  }

  /**
   * Create quest interface
   */
  private createQuestInterface(): void {
    const quest: UIInterface = {
      id: 'quest',
      name: 'Quest Journal',
      elements: new Map(),
      layout: 'list',
      visible: false,
      position: { x: 200, y: 50 },
      size: { x: 400, y: 500 }
    }

    // Quest list will be populated dynamically
    const questList = this.createElement({
      type: UIElementType.PANEL,
      position: { x: 10, y: 40 },
      size: { x: 380, y: 450 },
      data: {
        scrollable: true,
        quests: []
      }
    })
    quest.elements.set(questList.id, questList)

    this.interfaces.set('quest', quest)
  }

  /**
   * Create skills interface
   */
  private createSkillsInterface(): void {
    const skills: UIInterface = {
      id: 'skills',
      name: 'Skills',
      elements: new Map(),
      layout: 'grid',
      visible: false,
      position: { x: -280, y: 50 },
      size: { x: 260, y: 400 }
    }

    // Skill icons in 3x8 grid
    const skillNames = [
      'Attack', 'Strength', 'Defence', 'Ranged', 'Prayer', 'Magic',
      'Runecraft', 'Construction', 'Hitpoints', 'Agility', 'Herblore', 'Thieving',
      'Crafting', 'Fletching', 'Slayer', 'Hunter', 'Mining', 'Smithing',
      'Fishing', 'Cooking', 'Firemaking', 'Woodcutting', 'Farming'
    ]

    skillNames.forEach((skill, index) => {
      const row = Math.floor(index / 3)
      const col = index % 3
      
      const skillIcon = this.createElement({
        type: UIElementType.ICON,
        position: { 
          x: 10 + col * 80,
          y: 40 + row * 45
        },
        size: { x: 75, y: 40 },
        data: {
          skill: skill.toLowerCase(),
          level: 1,
          experience: 0,
          showTooltip: true
        }
      })
      skills.elements.set(skillIcon.id, skillIcon)
    })

    this.interfaces.set('skills', skills)
  }

  /**
   * Create context menu
   */
  private createContextMenu(): void {
    const contextMenu: UIInterface = {
      id: 'context_menu',
      name: 'Context Menu',
      elements: new Map(),
      layout: 'vertical',
      visible: false,
      position: { x: 0, y: 0 },
      size: { x: 150, y: 0 } // Height calculated dynamically
    }

    this.interfaces.set('context_menu', contextMenu)
  }

  /**
   * Create settings interface
   */
  private createSettingsInterface(): void {
    const settings: UIInterface = {
      id: 'settings',
      name: 'Settings',
      elements: new Map(),
      layout: 'tabs',
      visible: false,
      position: { x: 150, y: 50 },
      size: { x: 500, y: 400 }
    }

    // Setting categories
    const categories = ['Graphics', 'Audio', 'Controls', 'Gameplay']
    categories.forEach((category, index) => {
      const tab = this.createElement({
        type: UIElementType.BUTTON,
        position: { x: 10 + index * 120, y: 10 },
        size: { x: 110, y: 30 },
        data: {
          text: category,
          action: 'switch_settings_tab'
        }
      })
      settings.elements.set(tab.id, tab)
    })

    this.interfaces.set('settings', settings)
  }

  /**
   * Create UI element
   */
  private createElement(options: Partial<UIElement>): UIElement {
    return {
      id: `ui_element_${this.elementIdCounter++}`,
      type: options.type || UIElementType.PANEL,
      position: options.position || { x: 0, y: 0 },
      size: options.size || { x: 100, y: 100 },
      visible: options.visible !== false,
      interactive: options.interactive !== false,
      layer: options.layer || 0,
      children: options.children || [],
      data: options.data || {}
    }
  }

  /**
   * Handle player connect
   */
  private handlePlayerConnect(data: { playerId: string }): void {
    const player = this.world.entities.get(data.playerId)
    if (!player) return

    // Add UI component
    const uiComponent: UIComponent = {
      type: 'ui',
      elements: new Map(),
      activeInterface: undefined,
      hoveredElement: undefined,
      focusedElement: undefined
    }
    player.addComponent('ui', uiComponent)

    // Show default interfaces
    this.showInterface(data.playerId, 'hud')
    this.showInterface(data.playerId, 'chat')
  }

  /**
   * Handle player disconnect
   */
  private handlePlayerDisconnect(data: { playerId: string }): void {
    // Cleanup UI state for player
  }

  /**
   * Show interface
   */
  public showInterface(playerId: string, interfaceId: string): void {
    const player = this.world.entities.get(playerId)
    if (!player) return

    const uiComponent = player.getComponent('ui') as UIComponent
    if (!uiComponent) return

    const ui = this.interfaces.get(interfaceId)
    if (!ui) return

    // Add to active interfaces
    this.activeInterfaces.add(interfaceId)
    
    // Update player's UI
    uiComponent.activeInterface = interfaceId

    this.world.events.emit('ui:interface_shown', {
      playerId,
      interfaceId
    })
  }

  /**
   * Hide interface
   */
  public hideInterface(playerId: string, interfaceId: string): void {
    const player = this.world.entities.get(playerId)
    if (!player) return

    const uiComponent = player.getComponent('ui') as UIComponent
    if (!uiComponent) return

    // Remove from active interfaces
    this.activeInterfaces.delete(interfaceId)
    
    // Clear if it was the active interface
    if (uiComponent.activeInterface === interfaceId) {
      uiComponent.activeInterface = undefined
    }

    this.world.events.emit('ui:interface_hidden', {
      playerId,
      interfaceId
    })
  }

  /**
   * Toggle interface
   */
  public toggleInterface(playerId: string, interfaceId: string): void {
    if (this.activeInterfaces.has(interfaceId)) {
      this.hideInterface(playerId, interfaceId)
    } else {
      this.showInterface(playerId, interfaceId)
    }
  }

  /**
   * Handle click
   */
  private handleClick(data: { playerId: string; elementId: string; button: number }): void {
    const element = this.findElement(data.elementId)
    if (!element || !element.interactive) return

    // Handle element-specific actions
    if (element.data.action) {
      this.handleAction(data.playerId, element.data.action, element)
    }

    this.world.events.emit('ui:element_clicked', {
      playerId: data.playerId,
      element,
      button: data.button
    })
  }

  /**
   * Handle hover
   */
  private handleHover(data: { playerId: string; elementId: string | null }): void {
    const player = this.world.entities.get(data.playerId)
    if (!player) return

    const uiComponent = player.getComponent('ui') as UIComponent
    if (!uiComponent) return

    uiComponent.hoveredElement = data.elementId || undefined

    if (data.elementId) {
      const element = this.findElement(data.elementId)
      if (element?.data.showTooltip) {
        this.showTooltip(data.playerId, element)
      }
    } else {
      this.hideTooltip(data.playerId)
    }
  }

  /**
   * Handle drag
   */
  private handleDrag(data: { playerId: string; elementId: string; start: Vector2; end: Vector2 }): void {
    const element = this.findElement(data.elementId)
    if (!element || !element.data.draggable) return

    // Handle dragging logic (e.g., moving items between slots)
    this.world.events.emit('ui:element_dragged', {
      playerId: data.playerId,
      element,
      start: data.start,
      end: data.end
    })
  }

  /**
   * Find element by ID
   */
  private findElement(elementId: string): UIElement | null {
    for (const ui of this.interfaces.values()) {
      const element = ui.elements.get(elementId)
      if (element) return element
    }
    return null
  }

  /**
   * Handle UI action
   */
  private handleAction(playerId: string, action: string, element: UIElement): void {
    switch (action) {
      case 'toggle_inventory':
        this.toggleInterface(playerId, 'inventory')
        break
      case 'close_bank':
        this.hideInterface(playerId, 'bank')
        break
      case 'close_shop':
        this.hideInterface(playerId, 'shop')
        break
      case 'switch_bank_tab':
        this.switchBankTab(playerId, element.data.tabIndex)
        break
      case 'switch_settings_tab':
        this.switchSettingsTab(playerId, element.data.text)
        break
      default:
        console.warn(`[UISystem] Unknown action: ${action}`)
    }
  }

  /**
   * Switch bank tab
   */
  private switchBankTab(playerId: string, tabIndex: number): void {
    this.world.events.emit('bank:switch_tab', {
      playerId,
      tabIndex
    })
  }

  /**
   * Switch settings tab
   */
  private switchSettingsTab(playerId: string, category: string): void {
    // Update settings interface to show selected category
  }

  /**
   * Show tooltip
   */
  private showTooltip(playerId: string, element: UIElement): void {
    // Create and show tooltip element
  }

  /**
   * Hide tooltip
   */
  private hideTooltip(playerId: string): void {
    // Hide tooltip element
  }

  /**
   * Update UI element
   */
  public updateElement(elementId: string, updates: Partial<UIElement>): void {
    const element = this.findElement(elementId)
    if (!element) return

    Object.assign(element, updates)
    
    this.world.events.emit('ui:element_updated', {
      elementId,
      updates
    })
  }

  /**
   * Update HUD
   */
  public updateHUD(playerId: string, data: any): void {
    const player = this.world.entities.get(playerId)
    if (!player) return

    // Update health bar
    // Update prayer bar
    // Update run energy
    // Update combat level
  }

  /**
   * Add chat message
   */
  public addChatMessage(message: {
    type: 'game' | 'public' | 'private' | 'clan' | 'trade'
    sender?: string
    text: string
    color?: string
    timestamp?: number
  }): void {
    const chat = this.interfaces.get('chat')
    if (!chat) return

    const chatBox = Array.from(chat.elements.values()).find(e => e.type === UIElementType.CHAT_BOX)
    if (!chatBox) return

    // Add message to chat box
    chatBox.data.messages.push({
      ...message,
      timestamp: message.timestamp || Date.now()
    })

    // Limit messages
    if (chatBox.data.messages.length > chatBox.data.maxMessages) {
      chatBox.data.messages.shift()
    }

    this.world.events.emit('chat:message_added', message)
  }

  /**
   * Show context menu
   */
  public showContextMenu(playerId: string, position: Vector2, options: string[]): void {
    const contextMenu = this.interfaces.get('context_menu')
    if (!contextMenu) return

    // Clear existing options
    contextMenu.elements.clear()

    // Add options
    options.forEach((option, index) => {
      const button = this.createElement({
        type: UIElementType.BUTTON,
        position: { x: 0, y: index * 25 },
        size: { x: 150, y: 25 },
        data: {
          text: option,
          action: `context_${option.toLowerCase().replace(' ', '_')}`
        }
      })
      contextMenu.elements.set(button.id, button)
    })

    // Update position and size
    contextMenu.position = position
    contextMenu.size!.y = options.length * 25
    contextMenu.visible = true

    this.showInterface(playerId, 'context_menu')
  }

  /**
   * Get active interfaces for player
   */
  public getActiveInterfaces(playerId: string): string[] {
    const player = this.world.entities.get(playerId)
    if (!player) return []

    const uiComponent = player.getComponent('ui') as UIComponent
    if (!uiComponent) return []

    return Array.from(this.activeInterfaces)
  }

  /**
   * Serialize UI state
   */
  serialize(): any {
    return {
      interfaces: Object.fromEntries(
        Array.from(this.interfaces.entries()).map(([id, ui]) => [
          id,
          {
            ...ui,
            elements: Object.fromEntries(ui.elements)
          }
        ])
      ),
      activeInterfaces: Array.from(this.activeInterfaces),
      theme: this.theme
    }
  }

  /**
   * Deserialize UI state
   */
  deserialize(data: any): void {
    if (data.interfaces) {
      this.interfaces = new Map(
        Object.entries(data.interfaces).map(([id, ui]: [string, any]) => [
          id,
          {
            ...ui,
            elements: new Map(Object.entries(ui.elements || {}))
          }
        ])
      )
    }
    
    if (data.activeInterfaces) {
      this.activeInterfaces = new Set(data.activeInterfaces)
    }
    
    if (data.theme) {
      this.theme = data.theme
    }
  }

  /**
   * Update loop
   */
  update(_delta: number): void {
    // Update animations
    // Update tooltips
    // Update drag operations
  }
}

interface UIInterface {
  id: string
  name: string
  elements: Map<string, UIElement>
  layout: 'fixed' | 'grid' | 'vertical' | 'horizontal' | 'tabs' | 'list'
  visible: boolean
  alwaysVisible?: boolean
  position?: Vector2
  size?: Vector2
} 