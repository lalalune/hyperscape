import { System } from '../../core/systems/System';
import * as THREE from '../../core/extras/three';

export interface RPGFire {
  id: string;
  position: { x: number; y: number; z: number };
  playerId: string; // Who lit the fire
  createdAt: number;
  duration: number; // How long fire lasts in milliseconds
  isActive: boolean;
  mesh?: THREE.Object3D;
}

export interface RPGProcessingAction {
  playerId: string;
  actionType: 'firemaking' | 'cooking';
  primaryItem: { id: number; slot: number }; // Item being used (tinderbox/raw fish)
  targetItem?: { id: number; slot: number }; // Target item (logs/fire)
  targetFire?: string; // Fire ID for cooking
  startTime: number;
  duration: number;
  xpReward: number;
  skillRequired: string;
}

/**
 * RPG Processing System
 * Implements firemaking and cooking per GDD specifications:
 * 
 * FIREMAKING:
 * - Use tinderbox on logs in inventory
 * - Creates fire object in world at player position
 * - Grants firemaking XP
 * - Fire lasts for limited time
 * 
 * COOKING:
 * - Use raw fish on fire object
 * - Converts raw fish to cooked fish
 * - Grants cooking XP
 * - Can burn food at low levels
 */
export class RPGProcessingSystem extends System {
  private activeFires = new Map<string, RPGFire>();
  private activeProcessing = new Map<string, RPGProcessingAction>();
  private fireCleanupTimers = new Map<string, NodeJS.Timeout>();

  // Processing constants per GDD
  private readonly FIRE_DURATION = 120000; // 2 minutes
  private readonly FIREMAKING_TIME = 3000; // 3 seconds to light fire
  private readonly COOKING_TIME = 2000; // 2 seconds to cook fish
  private readonly MAX_FIRES_PER_PLAYER = 3;

  // XP rewards per GDD
  private readonly XP_REWARDS = {
    firemaking: {
      normal_logs: 40
    },
    cooking: {
      raw_fish: 30,
      burnt_fish: 0 // No XP for burning food
    }
  };

  // Burn chances by cooking level (RuneScape-style)
  private readonly BURN_CHANCES = new Map<number, number>([
    [1, 0.8], [5, 0.6], [10, 0.4], [15, 0.2], [20, 0.1], [25, 0.05], [30, 0.0]
  ]);

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGProcessingSystem] Initializing GDD-compliant processing system...');
    
    // Listen for processing events
    this.world.on?.('rpg:processing:firemaking:request', this.startFiremaking.bind(this));
    this.world.on?.('rpg:processing:cooking:request', this.startCooking.bind(this));
    this.world.on?.('rpg:item:use_on_item', this.handleItemOnItem.bind(this));
    this.world.on?.('rpg:item:use_on_fire', this.handleItemOnFire.bind(this));
    this.world.on?.('rpg:player:unregister', this.cleanupPlayerData.bind(this));
    
    console.log('[RPGProcessingSystem] Processing system initialized with firemaking and cooking');
  }

  start(): void {
    console.log('[RPGProcessingSystem] Processing system started');
  }

  // Handle item-on-item interactions (tinderbox on logs)
  private handleItemOnItem(data: { playerId: string; primaryItemId: number; primarySlot: number; targetItemId: number; targetSlot: number }): void {
    const { playerId, primaryItemId, primarySlot, targetItemId, targetSlot } = data;
    
    // Check for tinderbox on logs
    if (primaryItemId === 300 && targetItemId === 200) { // Tinderbox on logs
      this.startFiremaking({
        playerId,
        logsSlot: targetSlot,
        tinderboxSlot: primarySlot
      });
    }
    // Check for logs on tinderbox (reverse order)
    else if (primaryItemId === 200 && targetItemId === 300) { // Logs on tinderbox
      this.startFiremaking({
        playerId,
        logsSlot: primarySlot,
        tinderboxSlot: targetSlot
      });
    }
  }

  // Handle item-on-fire interactions (raw fish on fire)
  private handleItemOnFire(data: { playerId: string; itemId: number; itemSlot: number; fireId: string }): void {
    const { playerId, itemId, itemSlot, fireId } = data;
    
    // Check for raw fish on fire
    if (itemId === 500) { // Raw fish
      this.startCooking({
        playerId,
        fishSlot: itemSlot,
        fireId
      });
    }
  }

  private startFiremaking(data: { playerId: string; logsSlot: number; tinderboxSlot: number }): void {
    const { playerId, logsSlot, tinderboxSlot } = data;
    
    // Check if player is already processing
    if (this.activeProcessing.has(playerId)) {
      this.world.emit?.('rpg:chat:message', {
        playerId,
        text: 'You are already doing something.',
        type: 'error'
      });
      return;
    }

    // Use event-based validation instead of direct access
    this.world.emit?.('rpg:processing:validate_firemaking', {
      playerId,
      logsSlot,
      tinderboxSlot,
      callback: (isValid: boolean, reason?: string) => {
        if (!isValid) {
          this.world.emit?.('rpg:chat:message', {
            playerId,
            text: reason || 'Cannot make fire.',
            type: 'error'
          });
          return;
        }
        this.startFiremakingProcess(playerId, logsSlot, tinderboxSlot, { x: 0, y: 0, z: 0 });
      }
    });
  }

  private startFiremakingProcess(playerId: string, logsSlot: number, tinderboxSlot: number, position: { x: number, y: number, z: number }): void {

    // Check fire limit
    const playerFires = Array.from(this.activeFires.values()).filter(fire => fire.playerId === playerId && fire.isActive);
    if (playerFires.length >= this.MAX_FIRES_PER_PLAYER) {
      this.world.emit?.('rpg:chat:message', {
        playerId,
        text: `You can only have ${this.MAX_FIRES_PER_PLAYER} fires lit at once.`,
        type: 'error'
      });
      return;
    }

    // Get player position
    const player = this.world.getPlayer?.(playerId);
    if (!player) return;

    // Start firemaking process
    const processingAction: RPGProcessingAction = {
      playerId,
      actionType: 'firemaking',
      primaryItem: { id: 300, slot: tinderboxSlot },
      targetItem: { id: 200, slot: logsSlot },
      startTime: Date.now(),
      duration: this.FIREMAKING_TIME,
      xpReward: this.XP_REWARDS.firemaking.normal_logs,
      skillRequired: 'firemaking'
    };

    this.activeProcessing.set(playerId, processingAction);

    // Show processing message
    this.world.emit?.('rpg:chat:message', {
      playerId,
      text: 'You attempt to light the logs...',
      type: 'info'
    });

    // Complete after duration
    setTimeout(() => {
      this.completeFiremaking(playerId, processingAction, {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z
      });
    }, this.FIREMAKING_TIME);
  }

  private completeFiremaking(playerId: string, action: RPGProcessingAction, position: { x: number; y: number; z: number }): void {
    // Remove from active processing
    this.activeProcessing.delete(playerId);

    // Request inventory check via event system
    this.world.emit?.('rpg:inventory:validate_item', {
      playerId,
      slot: action.targetItem!.slot,
      itemId: 200, // logs
      callback: (hasItem: boolean) => {
        if (!hasItem) {
          this.world.emit?.('rpg:chat:message', {
            playerId,
            text: 'You no longer have the logs.',
            type: 'error'
          });
          return;
        }
        this.completeFiremakingProcess(playerId, action, position);
      }
    });
  }

  private completeFiremakingProcess(playerId: string, action: RPGProcessingAction, position: { x: number; y: number; z: number }): void {

    // Remove logs from inventory
    this.world.emit?.('rpg:inventory:remove', {
      playerId,
      itemId: 200,
      quantity: 1,
      slot: action.targetItem!.slot
    });

    // Create fire
    const fireId = `fire_${playerId}_${Date.now()}`;
    const fire: RPGFire = {
      id: fireId,
      position,
      playerId,
      createdAt: Date.now(),
      duration: this.FIRE_DURATION,
      isActive: true
    };

    // Create visual fire mesh
    this.createFireVisual(fire);
    
    this.activeFires.set(fireId, fire);

    // Set fire cleanup timer
    const cleanupTimer = setTimeout(() => {
      this.extinguishFire(fireId);
    }, this.FIRE_DURATION);
    
    this.fireCleanupTimers.set(fireId, cleanupTimer);

    // Grant XP
    this.world.emit?.('rpg:xp:gain', {
      playerId,
      skill: 'firemaking',
      amount: action.xpReward
    });

    // Success message
    this.world.emit?.('rpg:chat:message', {
      playerId,
      text: 'You successfully light the fire.',
      type: 'success'
    });

    console.log(`[RPGProcessingSystem] Player ${playerId} lit fire ${fireId} and gained ${action.xpReward} firemaking XP`);
  }

  private startCooking(data: { playerId: string; fishSlot: number; fireId: string }): void {
    const { playerId, fishSlot, fireId } = data;
    
    // Check if player is already processing
    if (this.activeProcessing.has(playerId)) {
      this.world.emit?.('rpg:chat:message', {
        playerId,
        text: 'You are already doing something.',
        type: 'error'
      });
      return;
    }

    // Check if fire exists and is active
    const fire = this.activeFires.get(fireId);
    if (!fire || !fire.isActive) {
      this.world.emit?.('rpg:chat:message', {
        playerId,
        text: 'That fire is no longer lit.',
        type: 'error'
      });
      return;
    }

    // Use event-based validation for cooking
    this.world.emit?.('rpg:processing:validate_cooking', {
      playerId,
      fishSlot,
      fireId,
      callback: (isValid: boolean, reason?: string) => {
        if (!isValid) {
          this.world.emit?.('rpg:chat:message', {
            playerId,
            text: reason || 'Cannot cook fish.',
            type: 'error'
          });
          return;
        }
        this.startCookingProcess(playerId, fishSlot, fireId);
      }
    });
  }

  private startCookingProcess(playerId: string, fishSlot: number, fireId: string): void {

    // Start cooking process
    const processingAction: RPGProcessingAction = {
      playerId,
      actionType: 'cooking',
      primaryItem: { id: 500, slot: fishSlot },
      targetFire: fireId,
      startTime: Date.now(),
      duration: this.COOKING_TIME,
      xpReward: this.XP_REWARDS.cooking.raw_fish,
      skillRequired: 'cooking'
    };

    this.activeProcessing.set(playerId, processingAction);

    // Show processing message
    this.world.emit?.('rpg:chat:message', {
      playerId,
      text: 'You cook the fish on the fire...',
      type: 'info'
    });

    // Complete after duration
    setTimeout(() => {
      this.completeCooking(playerId, processingAction);
    }, this.COOKING_TIME);
  }

  private completeCooking(playerId: string, action: RPGProcessingAction): void {
    // Remove from active processing
    this.activeProcessing.delete(playerId);

    // Check if fire still exists
    const fire = this.activeFires.get(action.targetFire!);
    if (!fire || !fire.isActive) {
      this.world.emit?.('rpg:chat:message', {
        playerId,
        text: 'The fire went out while you were cooking.',
        type: 'error'
      });
      return;
    }

    // Request inventory check via event system
    this.world.emit?.('rpg:inventory:validate_item', {
      playerId,
      slot: action.primaryItem.slot,
      itemId: 500, // raw fish
      callback: (hasItem: boolean) => {
        if (!hasItem) {
          this.world.emit?.('rpg:chat:message', {
            playerId,
            text: 'You no longer have the raw fish.',
            type: 'error'
          });
          return;
        }
        
        // Use event-based skill check for burn chance
        this.world.emit?.('rpg:skills:get_level', {
          playerId,
          skill: 'cooking',
          callback: (level: number) => {
            const burnChance = this.getBurnChance(level);
            const didBurn = Math.random() < burnChance;
            this.completeCookingWithResult(playerId, action, didBurn);
          }
        });
      }
    });
  }

  private completeCookingWithResult(playerId: string, action: RPGProcessingAction, didBurn: boolean): void {

    // Remove raw fish
    this.world.emit?.('rpg:inventory:remove', {
      playerId,
      itemId: 500,
      quantity: 1,
      slot: action.primaryItem.slot
    });

    // Add result item
    const resultItemId = didBurn ? 502 : 501; // Burnt fish or cooked fish
    const resultItemName = didBurn ? 'Burnt Fish' : 'Cooked Fish';
    
    this.world.emit?.('rpg:inventory:add', {
      playerId,
      item: {
        id: resultItemId,
        name: resultItemName,
        type: 'food',
        quantity: 1,
        stackable: true,
        heal: didBurn ? 0 : 4 // Cooked fish heals 4 HP
      }
    });

    // Grant XP (only if not burnt)
    if (!didBurn) {
      this.world.emit?.('rpg:xp:gain', {
        playerId,
        skill: 'cooking',
        amount: action.xpReward
      });
    }

    // Success/failure message
    const message = didBurn 
      ? 'You accidentally burn the fish.' 
      : 'You successfully cook the fish.';
    const messageType = didBurn ? 'warning' : 'success';
    
    this.world.emit?.('rpg:chat:message', {
      playerId,
      text: message,
      type: messageType
    });

    console.log(`[RPGProcessingSystem] Player ${playerId} cooked fish: ${didBurn ? 'BURNT' : 'SUCCESS'}, XP: ${didBurn ? 0 : action.xpReward}`);
  }

  private getBurnChance(cookingLevel: number): number {
    // Find the appropriate burn chance for the level
    for (const [level, chance] of this.BURN_CHANCES.entries()) {
      if (cookingLevel >= level) {
        continue;
      }
      return this.BURN_CHANCES.get(level - 5) || 0.8; // Return previous level's chance
    }
    return 0.0; // Level 30+ never burns
  }

  private createFireVisual(fire: RPGFire): void {
    try {
      // Create fire mesh - orange glowing cube for now
      const fireGeometry = new THREE.BoxGeometry(0.5, 0.8, 0.5);
      const fireMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xFF4500, // Orange red
        transparent: true,
        opacity: 0.8
      });
      
      const fireMesh = new THREE.Mesh(fireGeometry, fireMaterial);
      fireMesh.position.set(fire.position.x, fire.position.y + 0.4, fire.position.z);
      fireMesh.userData = { 
        type: 'fire',
        fireId: fire.id,
        playerId: fire.playerId
      };
      
      // Add flickering animation
      const animate = () => {
        if (fire.isActive) {
          fireMesh.material.opacity = 0.6 + Math.sin(Date.now() * 0.01) * 0.2;
          requestAnimationFrame(animate);
        }
      };
      animate();
      
      fire.mesh = fireMesh;
      
      // Add to scene
      if (this.world.stage?.scene) {
        this.world.stage.scene.add(fireMesh);
      }
      
      console.log(`[RPGProcessingSystem] Created fire visual at (${fire.position.x}, ${fire.position.y}, ${fire.position.z})`);
    } catch (error) {
      console.error(`[RPGProcessingSystem] Failed to create fire visual:`, error);
    }
  }

  private extinguishFire(fireId: string): void {
    const fire = this.activeFires.get(fireId);
    if (!fire) return;

    fire.isActive = false;

    // Remove visual
    if (fire.mesh && fire.mesh.parent) {
      fire.mesh.parent.remove(fire.mesh);
      if (fire.mesh instanceof THREE.Mesh) {
        if (fire.mesh.geometry) fire.mesh.geometry.dispose();
        if (fire.mesh.material) {
          if (Array.isArray(fire.mesh.material)) {
            fire.mesh.material.forEach(material => material.dispose());
          } else {
            fire.mesh.material.dispose();
          }
        }
      }
    }

    // Clean up
    this.activeFires.delete(fireId);
    const timer = this.fireCleanupTimers.get(fireId);
    if (timer) {
      clearTimeout(timer);
      this.fireCleanupTimers.delete(fireId);
    }

    console.log(`[RPGProcessingSystem] Fire ${fireId} extinguished`);
  }

  private cleanupPlayerData(data: { id: string }): void {
    const playerId = data.id;
    
    // Remove active processing
    this.activeProcessing.delete(playerId);
    
    // Extinguish player's fires
    for (const [fireId, fire] of this.activeFires.entries()) {
      if (fire.playerId === playerId) {
        this.extinguishFire(fireId);
      }
    }
  }

  // Public API
  getActiveFires(): Map<string, RPGFire> {
    return new Map(this.activeFires);
  }

  getFires(): RPGFire[] {
    return Array.from(this.activeFires.values());
  }

  getPlayerFires(playerId: string): RPGFire[] {
    return Array.from(this.activeFires.values()).filter(fire => fire.playerId === playerId && fire.isActive);
  }

  isPlayerProcessing(playerId: string): boolean {
    return this.activeProcessing.has(playerId);
  }

  getFiresInRange(position: { x: number; y: number; z: number }, range: number = 2): RPGFire[] {
    return Array.from(this.activeFires.values()).filter(fire => {
      if (!fire.isActive) return false;
      const distance = Math.sqrt(
        Math.pow(fire.position.x - position.x, 2) +
        Math.pow(fire.position.z - position.z, 2)
      );
      return distance <= range;
    });
  }

  destroy(): void {
    // Clean up all fires
    for (const fireId of this.activeFires.keys()) {
      this.extinguishFire(fireId);
    }
    
    // Clear timers
    for (const timer of this.fireCleanupTimers.values()) {
      clearTimeout(timer);
    }
    
    this.activeProcessing.clear();
    this.fireCleanupTimers.clear();
    
    console.log('[RPGProcessingSystem] System destroyed');
  }

  // Required System lifecycle methods
  update(dt: number): void {
    // Check for expired processing actions
    const now = Date.now();
    for (const [playerId, action] of this.activeProcessing.entries()) {
      if (now - action.startTime > action.duration + 1000) { // 1 second grace period
        console.log(`[RPGProcessingSystem] Processing action timed out for player ${playerId}`);
        this.activeProcessing.delete(playerId);
      }
    }
  }

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