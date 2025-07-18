"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UIRenderer = void 0;
class UIRenderer {
    constructor(world, theme) {
        this.context = null;
        this.imageCache = new Map();
        this.fontLoaded = false;
        this.world = world;
        this.theme = theme;
    }
    /**
     * Initialize renderer with canvas
     */
    async initialize(canvas) {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get 2D context');
        }
        this.context = {
            canvas,
            ctx,
            width: canvas.width,
            height: canvas.height,
            scale: window.devicePixelRatio || 1
        };
        // Load fonts
        await this.loadFonts();
        // Load UI images
        await this.loadImages();
        console.log('[UIRenderer] Initialized');
    }
    /**
     * Load custom fonts
     */
    async loadFonts() {
        try {
            // Load RuneScape-style fonts
            const fonts = [
                new FontFace('RuneScape', 'url(/assets/fonts/runescape.ttf)'),
                new FontFace('RuneScape Bold', 'url(/assets/fonts/runescape-bold.ttf)'),
                new FontFace('RuneScape Chat', 'url(/assets/fonts/runescape-chat.ttf)')
            ];
            await Promise.all(fonts.map(font => font.load()));
            fonts.forEach(font => document.fonts.add(font));
            this.fontLoaded = true;
        }
        catch (error) {
            console.warn('[UIRenderer] Failed to load custom fonts, using fallback', error);
            // Use fallback fonts
            this.theme.fonts = {
                main: 'Arial',
                heading: 'Arial Black',
                chat: 'Courier New'
            };
        }
    }
    /**
     * Load UI images
     */
    async loadImages() {
        const imagePaths = {
            // Skill icons
            'skill_attack': '/assets/icons/skills/attack.png',
            'skill_strength': '/assets/icons/skills/strength.png',
            'skill_defence': '/assets/icons/skills/defence.png',
            'skill_ranged': '/assets/icons/skills/ranged.png',
            'skill_prayer': '/assets/icons/skills/prayer.png',
            'skill_magic': '/assets/icons/skills/magic.png',
            'skill_runecraft': '/assets/icons/skills/runecraft.png',
            'skill_construction': '/assets/icons/skills/construction.png',
            'skill_hitpoints': '/assets/icons/skills/hitpoints.png',
            'skill_agility': '/assets/icons/skills/agility.png',
            'skill_herblore': '/assets/icons/skills/herblore.png',
            'skill_thieving': '/assets/icons/skills/thieving.png',
            'skill_crafting': '/assets/icons/skills/crafting.png',
            'skill_fletching': '/assets/icons/skills/fletching.png',
            'skill_slayer': '/assets/icons/skills/slayer.png',
            'skill_hunter': '/assets/icons/skills/hunter.png',
            'skill_mining': '/assets/icons/skills/mining.png',
            'skill_smithing': '/assets/icons/skills/smithing.png',
            'skill_fishing': '/assets/icons/skills/fishing.png',
            'skill_cooking': '/assets/icons/skills/cooking.png',
            'skill_firemaking': '/assets/icons/skills/firemaking.png',
            'skill_woodcutting': '/assets/icons/skills/woodcutting.png',
            'skill_farming': '/assets/icons/skills/farming.png',
            // UI elements
            'ui_close': '/assets/icons/ui/close.png',
            'ui_minimize': '/assets/icons/ui/minimize.png',
            'ui_settings': '/assets/icons/ui/settings.png',
            'ui_inventory': '/assets/icons/ui/inventory.png',
            'ui_quest': '/assets/icons/ui/quest.png',
            'ui_skills': '/assets/icons/ui/skills.png',
            'ui_prayer': '/assets/icons/ui/prayer.png',
            'ui_magic': '/assets/icons/ui/magic.png',
            'ui_clan': '/assets/icons/ui/clan.png',
            'ui_friends': '/assets/icons/ui/friends.png',
            'ui_logout': '/assets/icons/ui/logout.png',
            // Inventory slot
            'slot_empty': '/assets/icons/ui/slot_empty.png',
            'slot_hover': '/assets/icons/ui/slot_hover.png',
            'slot_selected': '/assets/icons/ui/slot_selected.png'
        };
        // Load images in parallel
        const loadPromises = Object.entries(imagePaths).map(async ([key, path]) => {
            try {
                const img = new Image();
                img.src = path;
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });
                this.imageCache.set(key, img);
            }
            catch (error) {
                console.warn(`[UIRenderer] Failed to load image: ${path}`);
            }
        });
        await Promise.all(loadPromises);
    }
    /**
     * Render all UI elements
     */
    render(elements) {
        if (!this.context)
            return;
        const { ctx } = this.context;
        // Sort elements by layer
        const sortedElements = [...elements].sort((a, b) => a.layer - b.layer);
        // Render each element
        for (const element of sortedElements) {
            if (!element.visible)
                continue;
            this.renderElement(element);
        }
    }
    /**
     * Render individual UI element
     */
    renderElement(element) {
        if (!this.context)
            return;
        const { ctx } = this.context;
        const pos = this.calculatePosition(element.position);
        switch (element.type) {
            case 'panel':
                this.renderPanel(ctx, pos, element.size, element.data);
                break;
            case 'button':
                this.renderButton(ctx, pos, element.size, element.data);
                break;
            case 'text':
                this.renderText(ctx, pos, element.size, element.data);
                break;
            case 'icon':
                this.renderIcon(ctx, pos, element.size, element.data);
                break;
            case 'progress_bar':
                this.renderProgressBar(ctx, pos, element.size, element.data);
                break;
            case 'inventory_slot':
                this.renderInventorySlot(ctx, pos, element.size, element.data);
                break;
            case 'chat_box':
                this.renderChatBox(ctx, pos, element.size, element.data);
                break;
            case 'minimap':
                this.renderMinimap(ctx, pos, element.size, element.data);
                break;
            case 'context_menu':
                this.renderContextMenu(ctx, pos, element.size, element.data);
                break;
        }
        // Render children
        if (element.children) {
            for (const child of element.children) {
                this.renderElement(child);
            }
        }
    }
    /**
     * Calculate absolute position (handle negative values for right/bottom alignment)
     */
    calculatePosition(position) {
        if (!this.context)
            return position;
        const { width, height } = this.context;
        return {
            x: position.x < 0 ? width + position.x : position.x,
            y: position.y < 0 ? height + position.y : position.y
        };
    }
    /**
     * Render panel
     */
    renderPanel(ctx, pos, size, data) {
        // Background
        ctx.fillStyle = data.backgroundColor || this.theme.colors.background;
        ctx.fillRect(pos.x, pos.y, size.x, size.y);
        // Border
        if (data.border !== false) {
            ctx.strokeStyle = data.borderColor || this.theme.colors.border;
            ctx.lineWidth = data.borderWidth || 2;
            ctx.strokeRect(pos.x, pos.y, size.x, size.y);
        }
        // Title bar
        if (data.title) {
            ctx.fillStyle = this.theme.colors.primary;
            ctx.fillRect(pos.x, pos.y, size.x, 30);
            ctx.fillStyle = this.theme.colors.text;
            ctx.font = `16px ${this.theme.fonts.heading}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(data.title, pos.x + size.x / 2, pos.y + 15);
        }
    }
    /**
     * Render button
     */
    renderButton(ctx, pos, size, data) {
        // Background
        const isHovered = data.hovered || false;
        const isPressed = data.pressed || false;
        if (isPressed) {
            ctx.fillStyle = this.theme.colors.active;
        }
        else if (isHovered) {
            ctx.fillStyle = this.theme.colors.hover;
        }
        else {
            ctx.fillStyle = this.theme.colors.secondary;
        }
        ctx.fillRect(pos.x, pos.y, size.x, size.y);
        // Border
        ctx.strokeStyle = this.theme.colors.border;
        ctx.lineWidth = 2;
        ctx.strokeRect(pos.x, pos.y, size.x, size.y);
        // Icon or text
        if (data.icon) {
            const icon = this.imageCache.get(`ui_${data.icon}`);
            if (icon) {
                const iconSize = Math.min(size.x, size.y) - 8;
                ctx.drawImage(icon, pos.x + (size.x - iconSize) / 2, pos.y + (size.y - iconSize) / 2, iconSize, iconSize);
            }
        }
        else if (data.text) {
            ctx.fillStyle = this.theme.colors.text;
            ctx.font = `${this.theme.sizes.text}px ${this.theme.fonts.main}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(data.text, pos.x + size.x / 2, pos.y + size.y / 2);
        }
    }
    /**
     * Render text
     */
    renderText(ctx, pos, size, data) {
        ctx.fillStyle = data.color || this.theme.colors.text;
        ctx.font = `${data.fontSize || this.theme.sizes.text}px ${data.font || this.theme.fonts.main}`;
        ctx.textAlign = data.align || 'left';
        ctx.textBaseline = data.baseline || 'top';
        if (data.editable) {
            // Draw input field background
            ctx.fillStyle = this.theme.colors.background;
            ctx.fillRect(pos.x, pos.y, size.x, size.y);
            ctx.strokeStyle = this.theme.colors.border;
            ctx.lineWidth = 1;
            ctx.strokeRect(pos.x, pos.y, size.x, size.y);
            // Draw text with padding
            ctx.fillStyle = data.color || this.theme.colors.text;
            ctx.fillText(data.text || data.placeholder || '', pos.x + 5, pos.y + size.y / 2);
        }
        else {
            ctx.fillText(data.text || '', pos.x, pos.y);
        }
    }
    /**
     * Render icon
     */
    renderIcon(ctx, pos, size, data) {
        if (data.skill) {
            const icon = this.imageCache.get(`skill_${data.skill}`);
            if (icon) {
                // Draw skill icon
                ctx.drawImage(icon, pos.x, pos.y, this.theme.sizes.iconMedium, this.theme.sizes.iconMedium);
                // Draw level
                ctx.fillStyle = this.theme.colors.text;
                ctx.font = `12px ${this.theme.fonts.main}`;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'bottom';
                ctx.fillText(`${data.level}`, pos.x + size.x - 5, pos.y + size.y - 5);
            }
        }
    }
    /**
     * Render progress bar
     */
    renderProgressBar(ctx, pos, size, data) {
        // Background
        ctx.fillStyle = this.theme.colors.background;
        ctx.fillRect(pos.x, pos.y, size.x, size.y);
        // Progress
        const progress = Math.min(1, Math.max(0, data.current / data.max));
        ctx.fillStyle = data.color || this.theme.colors.primary;
        ctx.fillRect(pos.x, pos.y, size.x * progress, size.y);
        // Border
        ctx.strokeStyle = this.theme.colors.border;
        ctx.lineWidth = 2;
        ctx.strokeRect(pos.x, pos.y, size.x, size.y);
        // Label
        if (data.label) {
            ctx.fillStyle = this.theme.colors.text;
            ctx.font = `${this.theme.sizes.text}px ${this.theme.fonts.main}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${data.label}: ${data.current}/${data.max}`, pos.x + size.x / 2, pos.y + size.y / 2);
        }
    }
    /**
     * Render inventory slot
     */
    renderInventorySlot(ctx, pos, size, data) {
        // Slot background
        const slotImage = data.hovered
            ? this.imageCache.get('slot_hover')
            : data.selected
                ? this.imageCache.get('slot_selected')
                : this.imageCache.get('slot_empty');
        if (slotImage) {
            ctx.drawImage(slotImage, pos.x, pos.y, size.x, size.y);
        }
        else {
            // Fallback to simple rectangle
            ctx.fillStyle = data.hovered ? this.theme.colors.hover : this.theme.colors.background;
            ctx.fillRect(pos.x, pos.y, size.x, size.y);
            ctx.strokeStyle = this.theme.colors.border;
            ctx.lineWidth = 1;
            ctx.strokeRect(pos.x, pos.y, size.x, size.y);
        }
        // Item
        if (data.item) {
            // Draw item icon (placeholder for now)
            ctx.fillStyle = '#888';
            ctx.fillRect(pos.x + 8, pos.y + 8, size.x - 16, size.y - 16);
            // Draw quantity
            if (data.item.quantity > 1) {
                ctx.fillStyle = this.theme.colors.text;
                ctx.font = `10px ${this.theme.fonts.main}`;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'bottom';
                ctx.fillText(`${data.item.quantity}`, pos.x + size.x - 2, pos.y + size.y - 2);
            }
        }
        // Price (for shop slots)
        if (data.showPrice && data.item) {
            ctx.fillStyle = '#ffff00';
            ctx.font = `10px ${this.theme.fonts.main}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`${data.item.price}gp`, pos.x + size.x / 2, pos.y + size.y + 12);
        }
    }
    /**
     * Render chat box
     */
    renderChatBox(ctx, pos, size, data) {
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(pos.x, pos.y, size.x, size.y);
        // Messages
        const messages = data.messages || [];
        const lineHeight = 16;
        const maxLines = Math.floor(size.y / lineHeight);
        const startIndex = Math.max(0, messages.length - maxLines);
        ctx.font = `${this.theme.sizes.text}px ${this.theme.fonts.chat}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        for (let i = 0; i < maxLines && startIndex + i < messages.length; i++) {
            const message = messages[startIndex + i];
            ctx.fillStyle = message.color || this.theme.colors.text;
            const text = message.sender
                ? `${message.sender}: ${message.text}`
                : message.text;
            ctx.fillText(text, pos.x + 5, pos.y + 5 + i * lineHeight);
        }
    }
    /**
     * Render minimap
     */
    renderMinimap(ctx, pos, size, data) {
        // Background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(pos.x, pos.y, size.x, size.y);
        // Border
        ctx.strokeStyle = this.theme.colors.border;
        ctx.lineWidth = 2;
        ctx.strokeRect(pos.x, pos.y, size.x, size.y);
        // Minimap content would be rendered here
        // For now, just show a placeholder
        ctx.fillStyle = '#333';
        ctx.fillRect(pos.x + 10, pos.y + 10, size.x - 20, size.y - 20);
        // Player position (center)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(pos.x + size.x / 2, pos.y + size.y / 2, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    /**
     * Render context menu
     */
    renderContextMenu(ctx, pos, size, data) {
        // Background with shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = this.theme.colors.background;
        ctx.fillRect(pos.x, pos.y, size.x, size.y);
        ctx.shadowColor = 'transparent';
        // Border
        ctx.strokeStyle = this.theme.colors.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(pos.x, pos.y, size.x, size.y);
    }
    /**
     * Update theme
     */
    updateTheme(theme) {
        this.theme = theme;
    }
    /**
     * Resize canvas
     */
    resize(width, height) {
        if (!this.context)
            return;
        this.context.canvas.width = width;
        this.context.canvas.height = height;
        this.context.width = width;
        this.context.height = height;
    }
    /**
     * Clear canvas
     */
    clear() {
        if (!this.context)
            return;
        this.context.ctx.clearRect(0, 0, this.context.width, this.context.height);
    }
}
exports.UIRenderer = UIRenderer;
//# sourceMappingURL=UIRenderer.js.map