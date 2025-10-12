import { SystemBase } from './SystemBase';
import THREE from '../extras/three';
import type { World } from '../World';
import { EventType } from '../types/events';

// Define types for UI elements
interface UIElement {
  mesh?: THREE.Mesh;
  canvas?: HTMLCanvasElement;
  element?: HTMLElement;
  type: string;
}


/**
 * TestUISystem
 * 
 * Creates test UI elements to verify that systems can create and manage UI.
 * This helps debug why systems load but don't show visual content.
 */
export class TestUISystem extends SystemBase {
  private uiElements = new Map<string, UIElement>();
  private uiCounter = 0;
  
  constructor(world: World) {
    super(world, {
      name: 'test-ui',
      dependencies: {
        required: [], // Test UI system can work independently
        optional: [] // Test UI manages its own dependencies
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {    
    // Listen for UI events
    this.subscribe(EventType.UI_CREATE, () => this.createTestUIElements());
    this.subscribe(EventType.TEST_CLEAR_UI, () => this.clearAllUI());

  }

  start(): void {
    // Auto-create test UI elements
    this.createTestUIElements();
  }

  private createTestUIElements(): void {
    
    // Create a status display UI
    this.createStatusUI();
    
    // Create a floating info panel
    this.createInfoPanel();
    
    // Create debug overlay
    this.createDebugOverlay();
  }

  private createStatusUI(): void {
    if (!THREE) {
      this.logger.warn('[TestUISystem] THREE.js not available');
      return;
    }
    
    // Check if we're in a browser environment with canvas support
    if (typeof document === 'undefined' || false) {
      // This is expected on server, no need to warn
      return;
    }
    
    const uiId = `test_ui_status_${this.uiCounter++}`;
    
    // Create a simple UI plane in 3D space
    const geometry = new THREE.PlaneGeometry(3, 1);
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 100;
    
    const context = canvas.getContext('2d');
    if (context) {
      // Draw status UI on canvas
      context.fillStyle = 'rgba(0, 0, 0, 0.8)';
      context.fillRect(0, 0, 300, 100);
      
      context.fillStyle = '#00ff00';
      context.font = '16px Arial';
      context.fillText('Systems Status: ACTIVE', 10, 25);
      context.fillText('Systems Loaded: ✓', 10, 45);
      context.fillText('Dynamic Content: ✓', 10, 65);
      context.fillText('Test UI: ✓', 10, 85);
    } else {
      this.logger.warn('[TestUISystem] Canvas 2D context not available');
      return;
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ 
      map: texture,
      transparent: true
    });
    
    const uiMesh = new THREE.Mesh(geometry, material);
    uiMesh.position.set(0, 3, -2); // Float above and in front
    uiMesh.userData = {
      id: uiId,
      type: 'status_ui'
    };

    this.addToWorld(uiMesh as unknown as THREE.Object3D);

    this.uiElements.set(uiId, {
      mesh: uiMesh,
      canvas: canvas,
      type: 'status'
    });

  }



  private createInfoPanel(): void {
    if (!THREE) return;
    
    // Check if we're in a browser environment with canvas support
    if (typeof document === 'undefined' || false) {
      // This is expected on server, no need to warn
      return;
    }

    const uiId = `test_ui_info_${this.uiCounter++}`;
    
    // Create info panel
    const geometry = new THREE.PlaneGeometry(4, 2);
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 200;
    
    const context = canvas.getContext('2d');
    if (context) {
      // Draw info panel
      context.fillStyle = 'rgba(0, 50, 100, 0.9)';
      context.fillRect(0, 0, 400, 200);
      
      context.strokeStyle = '#00aaff';
      context.lineWidth = 2;
      context.strokeRect(2, 2, 396, 196);
      
      context.fillStyle = '#ffffff';
      context.font = '18px Arial';
      context.fillText('🏰 Dynamic World', 20, 30);
      
      context.font = '14px Arial';
      context.fillStyle = '#cccccc';
      context.fillText('• DefaultWorldSystem: Loaded', 20, 60);
      context.fillText('• TestMobLoader: Active', 20, 80);
      context.fillText('• TestUISystem: Online', 20, 120);
      
      context.fillStyle = '#00ff88';
      context.fillText('All systems operational!', 20, 160);
      
      context.fillStyle = '#ffaa00';
      context.font = '12px Arial';
      context.fillText('Dynamic content loading successful', 20, 180);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ 
      map: texture,
      transparent: true
    });
    
    const uiMesh = new THREE.Mesh(geometry, material);
    uiMesh.position.set(-5, 2, 0); // To the left
    uiMesh.lookAt(0, 2, 10); // Face towards center
    uiMesh.userData = {
      id: uiId,
      type: 'info_panel'
    };

    this.addToWorld(uiMesh as unknown as THREE.Object3D);

    this.uiElements.set(uiId, {
      mesh: uiMesh,
      canvas: canvas,
      type: 'info'
    });

  }

  private createDebugOverlay(): void {
    // Only create debug overlay on client side
    if (typeof document === 'undefined' || !document.body) return;
    
    const uiId = `debug_overlay_${this.uiCounter++}`;
    
    const debugDiv = document.createElement('div');
    debugDiv.id = uiId;
    debugDiv.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.7);
      color: #ffffff;
      padding: 15px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      z-index: 1000;
      pointer-events: none;
      border: 1px solid #333;
      max-width: 300px;
    `;
    
    debugDiv.innerHTML = `
      <div style="color: #00ff00; font-weight: bold; margin-bottom: 5px;">🔧 Debug Console</div>
      <div>Systems Architecture: <span style="color: #00aaff;">Dynamic</span></div>
      <div>Content Loading: <span style="color: #00ff00;">System-Based</span></div>
      <div>App Proxies: <span style="color: #ffaa00;">Disabled</span></div>
      <div>THREE.js Access: <span style="color: #00ff00;">${THREE ? 'Available' : 'Not Available'}</span></div>
      <div style="margin-top: 10px; color: #888;">
        <div>Last Update: ${new Date().toLocaleTimeString()}</div>
        <div>Render Mode: ${THREE ? '3D Canvas' : 'Not Available'}</div>
      </div>
    `;
    
    document.body.appendChild(debugDiv);
    
    this.uiElements.set(uiId, {
      element: debugDiv,
      type: 'debug_overlay'
    });

  }

  private updateStatusUI(): void {
    // Update HTML status UI with current time
    for (const uiData of this.uiElements.values()) {
      if (uiData.type === 'html_status' && uiData.element) {
        const timeElement = uiData.element.querySelector('div:last-child');
        if (timeElement) {
          timeElement.textContent = `⏰ ${new Date().toLocaleTimeString()}`;
        }
      }
    }
  }

  private clearAllUI(): void {
    for (const [_id, uiElement] of this.uiElements.entries()) {
      if (uiElement.mesh) {
        if (uiElement.mesh.parent) {
          uiElement.mesh.parent.remove(uiElement.mesh);
        }
        uiElement.mesh.geometry.dispose();
        (uiElement.mesh.material as THREE.Material).dispose();
      }
      if (uiElement.element && uiElement.element.parentElement) {
        uiElement.element.parentElement.removeChild(uiElement.element);
      }
    }
    this.uiElements.clear();
  }

  createRandomUI(): string | null {
    // Create a random floating text UI
    if (!THREE) return null;
    
    // Check if we're in a browser environment with canvas support
    if (typeof document === 'undefined' || false) {
      // This is expected on server, no need to warn
      return null;
    }

    if (this.uiElements.size >= 50) return null;

    const uiId = `random_ui_${this.uiCounter++}`;
    const messages = [
      'Hello World!',
      'Systems Working!',
      'Dynamic Content!',
      'Active!',
      'Three.js Ready!'
    ];
    
    const geometry = new THREE.PlaneGeometry(2, 0.5);
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = 'rgba(255, 255, 255, 0.9)';
      context.fillRect(0, 0, 200, 50);
      
      context.fillStyle = '#000000';
      context.font = '14px Arial';
      const message = messages[Math.floor(Math.random() * messages.length)];
      context.fillText(message, 10, 30);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ 
      map: texture,
      transparent: true
    });
    
    const uiMesh = new THREE.Mesh(geometry, material);
    uiMesh.position.set(
      (Math.random() - 0.5) * 10,
      Math.random() * 3 + 2,
      (Math.random() - 0.5) * 10
    );
    uiMesh.userData = {
      id: uiId,
      type: 'random_ui'
    };

    this.addToWorld(uiMesh as unknown as THREE.Object3D);

    this.uiElements.set(uiId, {
      mesh: uiMesh,
      canvas: canvas,
      type: 'random'
    });

    return uiId;
  }

  update(): void {
    // Update status UI periodically
    if (Math.floor(Date.now() / 1000) % 5 === 0) {
      this.updateStatusUI();
    }
  }

  // Helper method for adding objects to world
  private addToWorld(object: THREE.Object3D): boolean {
    this.world.stage.scene.add(object);
    return true;
  }



  /**
   * Cleanup when system is destroyed
   */
  destroy(): void {
    // Clear all UI elements
    this.uiElements.clear();
    
    // Reset counter
    this.uiCounter = 0;
    
    this.logger.info('[TestUISystem] Test UI system destroyed and cleaned up');
    
    // Call parent cleanup
    super.destroy();
  }
}