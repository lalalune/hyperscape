/**
 * UI System - Manages all user interface elements for human players
 * Provides HUD, inventory, chat, and other game interfaces
 */
import { System } from '@hyperfy/sdk';
import type { World } from '../types';
import type { Vector3 as Vector2 } from '../types';
export interface UIElement {
    id: string;
    type: UIElementType;
    position: Vector2;
    size: Vector2;
    visible: boolean;
    interactive: boolean;
    layer: number;
    children?: UIElement[];
    data?: any;
}
export declare enum UIElementType {
    PANEL = "panel",
    BUTTON = "button",
    TEXT = "text",
    ICON = "icon",
    PROGRESS_BAR = "progress_bar",
    INVENTORY_SLOT = "inventory_slot",
    CHAT_BOX = "chat_box",
    MINIMAP = "minimap",
    CONTEXT_MENU = "context_menu"
}
export interface UIComponent {
    type: 'ui';
    elements: Map<string, UIElement>;
    activeInterface?: string;
    hoveredElement?: string;
    focusedElement?: string;
}
export interface UITheme {
    colors: {
        primary: string;
        secondary: string;
        background: string;
        text: string;
        border: string;
        hover: string;
        active: string;
        disabled: string;
    };
    fonts: {
        main: string;
        heading: string;
        chat: string;
    };
    sizes: {
        text: number;
        iconSmall: number;
        iconMedium: number;
        iconLarge: number;
        borderRadius: number;
        padding: number;
    };
}
export declare class UISystem extends System {
    private interfaces;
    private theme;
    private elementIdCounter;
    private activeInterfaces;
    private draggedElement;
    private tooltipElement;
    constructor(world: World);
    initialize(): Promise<void>;
    /**
     * Get default theme
     */
    private getDefaultTheme;
    /**
     * Create HUD interface
     */
    private createHUD;
    /**
     * Create inventory interface
     */
    private createInventoryInterface;
    /**
     * Create chat interface
     */
    private createChatInterface;
    /**
     * Create bank interface
     */
    private createBankInterface;
    /**
     * Create shop interface
     */
    private createShopInterface;
    /**
     * Create quest interface
     */
    private createQuestInterface;
    /**
     * Create skills interface
     */
    private createSkillsInterface;
    /**
     * Create context menu
     */
    private createContextMenu;
    /**
     * Create settings interface
     */
    private createSettingsInterface;
    /**
     * Create UI element
     */
    private createElement;
    /**
     * Handle player connect
     */
    private handlePlayerConnect;
    /**
     * Handle player disconnect
     */
    private handlePlayerDisconnect;
    /**
     * Show interface
     */
    showInterface(playerId: string, interfaceId: string): void;
    /**
     * Hide interface
     */
    hideInterface(playerId: string, interfaceId: string): void;
    /**
     * Toggle interface
     */
    toggleInterface(playerId: string, interfaceId: string): void;
    /**
     * Handle click
     */
    private handleClick;
    /**
     * Handle hover
     */
    private handleHover;
    /**
     * Handle drag
     */
    private handleDrag;
    /**
     * Find element by ID
     */
    private findElement;
    /**
     * Handle UI action
     */
    private handleAction;
    /**
     * Switch bank tab
     */
    private switchBankTab;
    /**
     * Switch settings tab
     */
    private switchSettingsTab;
    /**
     * Show tooltip
     */
    private showTooltip;
    /**
     * Hide tooltip
     */
    private hideTooltip;
    /**
     * Update UI element
     */
    updateElement(elementId: string, updates: Partial<UIElement>): void;
    /**
     * Update HUD
     */
    updateHUD(playerId: string, data: any): void;
    /**
     * Add chat message
     */
    addChatMessage(message: {
        type: 'game' | 'public' | 'private' | 'clan' | 'trade';
        sender?: string;
        text: string;
        color?: string;
        timestamp?: number;
    }): void;
    /**
     * Show context menu
     */
    showContextMenu(playerId: string, position: Vector2, options: string[]): void;
    /**
     * Get active interfaces for player
     */
    getActiveInterfaces(playerId: string): string[];
    /**
     * Serialize UI state
     */
    serialize(): any;
    /**
     * Deserialize UI state
     */
    deserialize(data: any): void;
    /**
     * Update loop
     */
    update(_delta: number): void;
}
//# sourceMappingURL=UISystem.d.ts.map