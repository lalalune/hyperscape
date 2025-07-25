import { System } from '../../core/systems/System';
import * as THREE from '../../core/extras/three';

/**
 * TestUISystem
 * 
 * Creates test UI elements to verify that systems can create and manage UI.
 * This helps debug why systems load but don't show visual content.
 */
export class TestUISystem extends System {
  private uiElements = new Map<string, any>();
  private world3D: any;
  private uiCounter = 0;
  
  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[TestUISystem] Initializing test UI system...');
    
    this.world3D = this.world;
    
    // Listen for UI events
    this.world.on?.('rpg:test:create_ui', this.createTestUIElements.bind(this));
    this.world.on?.('rpg:test:clear_ui', this.clearAllUI.bind(this));
    
    console.log('[TestUISystem] Test UI system initialized');
  }

  start(): void {
    console.log('[TestUISystem] Starting test UI creation...');
    
    // Auto-create test UI elements
    this.createTestUIElements();
  }

  private createTestUIElements(): void {
    console.log('[TestUISystem] Creating test UI elements...');
    
    // Create a status display UI
    this.createStatusUI();
    
    // Create a floating info panel
    this.createInfoPanel();
    
    // Create debug overlay
    this.createDebugOverlay();
  }

  private createStatusUI(): void {
    if (!THREE) {
      console.warn('[TestUISystem] THREE.js not available');
      return;
    }
    
    // Check if we're in a browser environment with canvas support
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      console.warn('[TestUISystem] Document API not available (server environment), skipping canvas UI');
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
      context.fillText('RPG Systems Status: ACTIVE', 10, 25);
      context.fillText('Systems Loaded: ✓', 10, 45);
      context.fillText('Dynamic Content: ✓', 10, 65);
      context.fillText('Test UI: ✓', 10, 85);
    } else {
      console.warn('[TestUISystem] Canvas 2D context not available');
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

    this.addToWorld(uiMesh, 'ui_mesh');

    this.uiElements.set(uiId, {
      mesh: uiMesh,
      canvas: canvas,
      type: 'status'
    });

    console.log(`[TestUISystem] Created status UI: ${uiId}`);
  }



  private createInfoPanel(): void {
    if (!THREE) return;
    
    // Check if we're in a browser environment with canvas support
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      console.warn('[TestUISystem] Document API not available (server environment), skipping info panel');
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
      context.fillText('🏰 Dynamic RPG World', 20, 30);
      
      context.font = '14px Arial';
      context.fillStyle = '#cccccc';
      context.fillText('• DefaultWorldSystem: Loaded', 20, 60);
      context.fillText('• TestMobLoader: Active', 20, 80);
      context.fillText('• TestPhysicsCube: Running', 20, 100);
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

    this.addToWorld(uiMesh, 'ui_mesh');

    this.uiElements.set(uiId, {
      mesh: uiMesh,
      canvas: canvas,
      type: 'info'
    });

    console.log(`[TestUISystem] Created info panel: ${uiId}`);
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

    console.log(`[TestUISystem] Created debug overlay: ${uiId}`);
  }

  private updateStatusUI(): void {
    // Update HTML status UI with current time
    for (const [uiId, uiData] of this.uiElements) {
      if (uiData.type === 'html_status' && uiData.element) {
        const timeElement = uiData.element.querySelector('div:last-child');
        if (timeElement) {
          timeElement.textContent = `⏰ ${new Date().toLocaleTimeString()}`;
        }
      }
    }
  }

  private clearAllUI(): void {
    console.log('[TestUISystem] Clearing all test UI elements...');
    
    for (const [uiId, uiData] of this.uiElements) {
      // Remove 3D UI elements
      if (uiData.mesh && this.world3D && this.world3D.remove) {
        this.world3D.remove(uiData.mesh);
      }
      
      // Remove HTML elements
      if (uiData.element && uiData.element.parentNode) {
        uiData.element.parentNode.removeChild(uiData.element);
      }
    }
    
    this.uiElements.clear();
    console.log('[TestUISystem] All test UI elements cleared');
  }

  // Public API
  getUIElements(): Map<string, any> {
    return this.uiElements;
  }

  getUICount(): number {
    return this.uiElements.size;
  }

  createRandomUI(): string | null {
    // Create a random floating text UI
    if (!THREE) return null;
    
    // Check if we're in a browser environment with canvas support
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      console.warn('[TestUISystem] Document API not available (server environment)');
      return null;
    }

    const uiId = `random_ui_${this.uiCounter++}`;
    const messages = [
      'Hello World!',
      'Systems Working!',
      'Dynamic Content!',
      'RPG Active!',
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

    this.addToWorld(uiMesh, 'ui_mesh');

    this.uiElements.set(uiId, {
      mesh: uiMesh,
      canvas: canvas,
      type: 'random'
    });

    return uiId;
  }

  update(dt: number): void {
    // Update status UI periodically
    if (Math.floor(Date.now() / 1000) % 5 === 0) {
      this.updateStatusUI();
    }
  }

  // Helper method for adding objects to world with comprehensive error handling
  private addToWorld(object: any, type: string): boolean {
    console.log(`[TestUISystem] Attempting to add ${type} to world...`);
    
    if (!object) {
      console.error(`[TestUISystem] ❌ Cannot add null ${type} to world`);
      return false;
    }

    // Try multiple Hyperfy world addition methods
    if (this.world3D && typeof this.world3D.stage.scene.add === 'function') {
      try {
        this.world3D.stage.scene.add(object);
        console.log(`[TestUISystem] ✅ Successfully added ${type} to world via world.stage.scene.add()`);
        return true;
      } catch (error) {
        console.error(`[TestUISystem] ❌ Error adding ${type} via world.stage.scene.add():`, error);
      }
    }

    if (this.world3D && typeof this.world3D.attach === 'function') {
      try {
        this.world3D.attach(object);
        console.log(`[TestUISystem] ✅ Successfully added ${type} to world via world.attach()`);
        return true;
      } catch (error) {
        console.error(`[TestUISystem] ❌ Error adding ${type} via world.attach():`, error);
      }
    }

    console.error(`[TestUISystem] ❌ No working method found to add ${type} to world`);
    return false;
  }

  destroy(): void {
    this.clearAllUI();
    console.log('[TestUISystem] System destroyed');
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}