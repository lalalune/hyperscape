import { World } from '@hyperfy/sdk';
import type { UIElement, UITheme } from './UISystem';
export interface RenderContext {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    scale: number;
}
export declare class UIRenderer {
    private world;
    private context;
    private theme;
    private imageCache;
    private fontLoaded;
    constructor(world: World, theme: UITheme);
    /**
     * Initialize renderer with canvas
     */
    initialize(canvas: HTMLCanvasElement): Promise<void>;
    /**
     * Load custom fonts
     */
    private loadFonts;
    /**
     * Load UI images
     */
    private loadImages;
    /**
     * Render all UI elements
     */
    render(elements: UIElement[]): void;
    /**
     * Render individual UI element
     */
    private renderElement;
    /**
     * Calculate absolute position (handle negative values for right/bottom alignment)
     */
    private calculatePosition;
    /**
     * Render panel
     */
    private renderPanel;
    /**
     * Render button
     */
    private renderButton;
    /**
     * Render text
     */
    private renderText;
    /**
     * Render icon
     */
    private renderIcon;
    /**
     * Render progress bar
     */
    private renderProgressBar;
    /**
     * Render inventory slot
     */
    private renderInventorySlot;
    /**
     * Render chat box
     */
    private renderChatBox;
    /**
     * Render minimap
     */
    private renderMinimap;
    /**
     * Render context menu
     */
    private renderContextMenu;
    /**
     * Update theme
     */
    updateTheme(theme: UITheme): void;
    /**
     * Resize canvas
     */
    resize(width: number, height: number): void;
    /**
     * Clear canvas
     */
    clear(): void;
}
//# sourceMappingURL=UIRenderer.d.ts.map