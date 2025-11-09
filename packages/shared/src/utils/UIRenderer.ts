/**
 * UI Renderer Utility
 *
 * Centralizes UI rendering logic for health bars, name tags, and other
 * canvas-based UI elements to eliminate duplicate rendering code.
 */

/// <reference lib="dom" />
import THREE from "../extras/three";

export interface BarOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  percentage?: number;
}

export interface NameTagOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  fontFamily?: string;
  textColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
  padding?: number;
}

export class UIRenderer {
  /**
   * Check if a canvas context is valid and has all required methods
   */
  // Removed type guard - assume context is valid CanvasRenderingContext2D

  /**
   * Create and render a health bar on a canvas
   */
  static createHealthBar(
    currentHealth: number,
    maxHealth: number,
    options: BarOptions = {},
  ): HTMLCanvasElement {
    const {
      width = 50, // Reduced 2x (was 100)
      height = 3, // Reduced 4x (was 12)
      backgroundColor = "rgba(0, 0, 0, 0.8)",
      fillColor = "#4CAF50",
      borderColor = "#ffffff",
      borderWidth = 1,
    } = options;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d")!;

    this.renderHealthBar(context, currentHealth, maxHealth, {
      width,
      height,
      backgroundColor,
      fillColor,
      borderColor,
      borderWidth,
      percentage: Math.max(0, Math.min(1, currentHealth / maxHealth)),
    });

    return canvas;
  }

  /**
   * Update an existing health bar canvas
   */
  static updateHealthBar(
    canvas: HTMLCanvasElement,
    currentHealth: number,
    maxHealth: number,
    options: BarOptions = {},
  ): void {
    const context = canvas.getContext("2d")!;

    const {
      width = canvas.width,
      height = canvas.height,
      backgroundColor = "rgba(0, 0, 0, 0.8)",
      fillColor = "#4CAF50",
      borderColor = "#ffffff",
      borderWidth = 1,
    } = options;

    this.renderHealthBar(context, currentHealth, maxHealth, {
      width,
      height,
      backgroundColor,
      fillColor,
      borderColor,
      borderWidth,
      percentage: Math.max(0, Math.min(1, currentHealth / maxHealth)),
    });
  }

  /**
   * Internal method to render health bar on context
   */
  private static renderHealthBar(
    context: CanvasRenderingContext2D,
    currentHealth: number,
    maxHealth: number,
    options: Required<BarOptions>,
  ): void {
    const {
      width,
      height,
      backgroundColor,
      fillColor,
      borderColor,
      borderWidth,
      percentage,
    } = options;
    const healthPercent = percentage;

    // Not clearing explicitly; we redraw the full background each time below

    // Draw background
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, width, height);

    // Draw health fill
    const fillWidth = (width - borderWidth * 2) * healthPercent;
    context.fillStyle = fillColor;
    context.fillRect(
      borderWidth,
      borderWidth,
      fillWidth,
      height - borderWidth * 2,
    );

    // Draw border
    if (borderWidth > 0) {
      context.strokeStyle = borderColor;
      context.lineWidth = borderWidth;
      context.strokeRect(
        borderWidth / 2,
        borderWidth / 2,
        width - borderWidth,
        height - borderWidth,
      );
    }
  }

  /**
   * Create a stamina bar (similar to health bar but different color)
   */
  static createStaminaBar(
    currentStamina: number,
    maxStamina: number,
    options: BarOptions = {},
  ): HTMLCanvasElement {
    const staminaOptions = {
      fillColor: "#2196F3",
      ...options,
    };

    return this.createHealthBar(currentStamina, maxStamina, staminaOptions);
  }

  /**
   * Create a name tag canvas
   */
  static createNameTag(
    name: string,
    options: NameTagOptions = {},
  ): HTMLCanvasElement {
    const {
      width = 160, // Reduced 20% from 200
      height = 20, // Reduced to fix Y-axis stretch (was 30)
      fontSize = 14, // Slightly smaller to fit better (was 16)
      fontFamily = "Arial, sans-serif",
      textColor = "#ffffff",
      backgroundColor = "rgba(0, 0, 0, 0.7)",
      borderRadius = 4,
      padding: _padding = 8,
    } = options;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d")!;

    // Draw background with rounded corners
    this.drawRoundedRect(
      context,
      0,
      0,
      width,
      height,
      borderRadius,
      backgroundColor,
    );

    // Draw text
    context.fillStyle = textColor;
    context.font = `${fontSize}px ${fontFamily}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(name, width / 2, height / 2);

    return canvas;
  }

  /**
   * Create a combined health/name UI element
   */
  static createPlayerUI(
    name: string,
    currentHealth: number,
    maxHealth: number,
    options: { nameTag?: NameTagOptions; healthBar?: BarOptions } = {},
  ): HTMLCanvasElement {
    const nameTagOptions = options.nameTag || {};
    const healthBarOptions = options.healthBar || {};

    const nameTagHeight = nameTagOptions.height || 30;
    const healthBarHeight = healthBarOptions.height || 12;
    const spacing = 4;
    const totalWidth = Math.max(
      nameTagOptions.width || 200,
      healthBarOptions.width || 100,
    );
    const totalHeight = nameTagHeight + healthBarHeight + spacing;

    const canvas = document.createElement("canvas");
    canvas.width = totalWidth;
    canvas.height = totalHeight;

    const context = canvas.getContext("2d")!;

    // Draw name tag
    const nameCanvas = this.createNameTag(name, {
      ...nameTagOptions,
      width: totalWidth,
      height: nameTagHeight,
    });
    context.drawImage(nameCanvas, 0, 0);

    // Draw health bar
    const healthCanvas = this.createHealthBar(currentHealth, maxHealth, {
      ...healthBarOptions,
      width: totalWidth,
      height: healthBarHeight,
    });
    context.drawImage(healthCanvas, 0, nameTagHeight + spacing);

    return canvas;
  }

  /**
   * Create a Three.js sprite from a canvas for 3D UI
   */
  static createSpriteFromCanvas(
    canvas: HTMLCanvasElement,
    scale: number = 1,
  ): THREE.Sprite {
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.1,
    });

    const sprite = new THREE.Sprite(spriteMaterial);

    // Scale sprite to maintain aspect ratio
    const aspect = canvas.width / canvas.height;
    sprite.scale.set(scale * aspect, scale, 1);

    return sprite;
  }

  /**
   * Update a sprite's texture from a canvas
   */
  static updateSpriteTexture(
    sprite: THREE.Sprite,
    _canvas: HTMLCanvasElement,
  ): void {
    if (
      sprite.material instanceof THREE.SpriteMaterial &&
      sprite.material.map
    ) {
      const texture = sprite.material.map as THREE.CanvasTexture;
      texture.needsUpdate = true;
    }
  }

  /**
   * Helper method to draw rounded rectangles
   */
  private static drawRoundedRect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fillStyle: string,
  ): void {
    context.fillStyle = fillStyle;
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(
      x + width,
      y + height,
      x + width - radius,
      y + height,
    );
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
    context.fill();
  }

  /**
   * Create a progress bar for various game systems (XP, crafting, etc.)
   */
  static createProgressBar(
    current: number,
    max: number,
    label: string,
    options: BarOptions & { labelColor?: string } = {},
  ): HTMLCanvasElement {
    const {
      width = 200,
      height = 20,
      backgroundColor = "rgba(0, 0, 0, 0.8)",
      fillColor = "#FF9800",
      borderColor = "#ffffff",
      borderWidth = 1,
      labelColor = "#ffffff",
    } = options;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d")!;

    // Render the bar
    this.renderHealthBar(context, current, max, {
      width,
      height,
      backgroundColor,
      fillColor,
      borderColor,
      borderWidth,
      percentage: current / max,
    });

    // Add label text
    context.fillStyle = labelColor;
    context.font = "12px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, width / 2, height / 2);

    return canvas;
  }
}
