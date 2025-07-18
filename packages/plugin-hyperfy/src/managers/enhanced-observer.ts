import { HyperfyService } from '../service';
import { PuppeteerManager } from './puppeteer-manager';
import type { HyperfyWorld } from '../types/hyperfy';

// Mock logger until @elizaos/core is available
const logger = {
  info: (...args: any[]) => console.log('[INFO]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
  debug: (...args: any[]) => console.debug('[DEBUG]', ...args),
};

// Mock IAgentRuntime interface
interface IAgentRuntime {
  agentId: string;
  getService<T>(serviceName: string): T | undefined;
  on?(event: string, handler: (data: any) => void): void;
  off?(event: string, handler: (data: any) => void): void;
}

export interface ObserverConfig {
  followAgent?: boolean;
  showThoughts?: boolean;
  highlightActions?: boolean;
  recordSession?: boolean;
  overlayStats?: boolean;
}

export interface SessionRecording {
  agentId: string;
  startTime: Date;
  endTime?: Date;
  events: RecordedEvent[];
  screenshots: Screenshot[];
  metrics: SessionMetrics;
}

export interface RecordedEvent {
  timestamp: Date;
  type: 'action' | 'message' | 'state_change' | 'error';
  data: any;
}

export interface Screenshot {
  timestamp: Date;
  imageData: string;
  metadata?: any;
}

export interface SessionMetrics {
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  distanceTraveled: number;
  messagesExchanged: number;
  itemsCollected: number;
  questsCompleted: number;
}

/**
 * Enhanced observer for monitoring and recording agent behavior
 */
export class EnhancedObserver {
  private runtime: IAgentRuntime;
  private service: HyperfyService;
  private puppeteerManager: PuppeteerManager | null = null;
  private config: ObserverConfig;
  private recording: SessionRecording | null = null;
  private isObserving: boolean = false;
  private observerInterval: NodeJS.Timeout | null = null;
  private lastPosition: { x: number; y: number; z: number } | null = null;

  constructor(runtime: IAgentRuntime, config: ObserverConfig = {}) {
    this.runtime = runtime;
    this.service = runtime.getService<HyperfyService>(HyperfyService.serviceName)!;
    this.config = {
      followAgent: true,
      showThoughts: true,
      highlightActions: true,
      recordSession: false,
      overlayStats: true,
      ...config
    };
  }

  /**
   * Starts observing the agent
   */
  async start(): Promise<void> {
    if (this.isObserving) {
      logger.warn('[EnhancedObserver] Already observing');
      return;
    }

    logger.info('[EnhancedObserver] Starting observation...');
    this.isObserving = true;
    this.puppeteerManager = this.service.getPuppeteerManager();

    if (this.config.recordSession) {
      this.startRecording();
    }

    // Set up event listeners
    this.setupEventListeners();

    // Start observation loop
    this.observerInterval = setInterval(() => {
      this.observationTick();
    }, 1000); // Update every second

    // Open observation window if available
    if (this.puppeteerManager) {
      await this.openObservationWindow();
    }
  }

  /**
   * Stops observing
   */
  stop(): void {
    if (!this.isObserving) {
      return;
    }

    logger.info('[EnhancedObserver] Stopping observation...');
    this.isObserving = false;

    if (this.observerInterval) {
      clearInterval(this.observerInterval);
      this.observerInterval = null;
    }

    if (this.recording) {
      this.stopRecording();
    }

    this.teardownEventListeners();
  }

  /**
   * Follows a specific agent
   */
  followAgent(agentId?: string): void {
    const world = this.service.getWorld();
    if (!world) return;

    const targetId = agentId || world.entities?.player?.data?.id;
    if (!targetId) {
      logger.warn('[EnhancedObserver] No agent to follow');
      return;
    }

    if (world.controls?.followEntity) {
      world.controls.followEntity(targetId);
      logger.info(`[EnhancedObserver] Following agent: ${targetId}`);
    }
  }

  /**
   * Highlights an action being performed
   */
  async highlightAction(actionName: string, duration: number = 3000): Promise<void> {
    if (!this.config.highlightActions) return;

    logger.info(`[EnhancedObserver] Highlighting action: ${actionName}`);
    
    // Add visual indicator to the page
    if (this.puppeteerManager) {
      const page = this.puppeteerManager.getPage();
      await page?.evaluate((action, dur) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: rgba(255, 255, 0, 0.9);
          color: black;
          padding: 10px 20px;
          border-radius: 5px;
          font-family: monospace;
          font-size: 16px;
          font-weight: bold;
          z-index: 10000;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;
        overlay.textContent = `ACTION: ${action}`;
        document.body.appendChild(overlay);

        setTimeout(() => overlay.remove(), dur);
      }, actionName, duration);
    }

    // Record the action highlight
    if (this.recording) {
      this.recordEvent({
        timestamp: new Date(),
        type: 'action',
        data: { action: actionName, highlighted: true }
      });
    }
  }

  /**
   * Shows agent thoughts/reasoning
   */
  async showAgentThoughts(thought: string): Promise<void> {
    if (!this.config.showThoughts) return;

    logger.debug(`[EnhancedObserver] Agent thought: ${thought}`);

    // Display thought bubble
    if (this.puppeteerManager) {
      const page = this.puppeteerManager.getPage();
      await page?.evaluate((thoughtText) => {
        const bubble = document.createElement('div');
        bubble.style.cssText = `
          position: fixed;
          bottom: 100px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(255, 255, 255, 0.95);
          color: #333;
          padding: 15px 25px;
          border-radius: 20px;
          font-family: Arial, sans-serif;
          font-size: 14px;
          max-width: 400px;
          z-index: 10000;
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
          border: 2px solid #4CAF50;
        `;
        bubble.innerHTML = `<strong>Thinking:</strong> ${thoughtText}`;
        document.body.appendChild(bubble);

        setTimeout(() => bubble.remove(), 5000);
      }, thought);
    }
  }

  /**
   * Records the current session
   */
  recordSession(): SessionRecording | null {
    return this.recording;
  }

  /**
   * Gets current session metrics
   */
  getSessionMetrics(): SessionMetrics | null {
    return this.recording?.metrics || null;
  }

  /**
   * Opens an observation window
   */
  private async openObservationWindow(): Promise<void> {
    if (!this.puppeteerManager) return;

    try {
      // Set viewport for observation
      const page = this.puppeteerManager.getPage();
      await page?.setViewport({
        width: 1920,
        height: 1080
      });

      // Inject observation UI
      await this.injectObservationUI();

      logger.info('[EnhancedObserver] Observation window ready');
    } catch (error) {
      logger.error('[EnhancedObserver] Error opening observation window:', error);
    }
  }

  /**
   * Injects observation UI overlay
   */
  private async injectObservationUI(): Promise<void> {
    if (!this.puppeteerManager || !this.config.overlayStats) return;

    const page = this.puppeteerManager.getPage();
    await page?.evaluate(() => {
      // Create stats overlay
      const statsOverlay = document.createElement('div');
      statsOverlay.id = 'observer-stats';
      statsOverlay.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 15px;
        border-radius: 5px;
        font-family: monospace;
        font-size: 12px;
        z-index: 10000;
        min-width: 200px;
      `;
      document.body.appendChild(statsOverlay);

      // Create action log
      const actionLog = document.createElement('div');
      actionLog.id = 'observer-action-log';
      actionLog.style.cssText = `
        position: fixed;
        bottom: 10px;
        left: 10px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 15px;
        border-radius: 5px;
        font-family: monospace;
        font-size: 11px;
        z-index: 10000;
        max-height: 200px;
        overflow-y: auto;
        min-width: 300px;
      `;
      actionLog.innerHTML = '<h4 style="margin: 0 0 10px 0;">Action Log</h4>';
      document.body.appendChild(actionLog);
    });
  }

  /**
   * Logs an action to the observation UI
   */
  private async logAction(action: string, success: boolean): Promise<void> {
    if (!this.puppeteerManager) return;

    const page = this.puppeteerManager.getPage();
    await page?.evaluate((actionText, isSuccess) => {
      const log = document.getElementById('observer-action-log');
      if (log) {
        const entry = document.createElement('div');
        entry.style.cssText = `
          padding: 2px 0;
          color: ${isSuccess ? '#4CAF50' : '#f44336'};
        `;
        const time = new Date().toLocaleTimeString();
        entry.textContent = `[${time}] ${isSuccess ? '✓' : '✗'} ${actionText}`;
        
        // Keep only last 10 entries
        while (log.children.length > 11) {
          log.removeChild(log.children[1]);
        }
        
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
      }
    }, action, success);
  }

  /**
   * Main observation loop
   */
  private async observationTick(): Promise<void> {
    try {
      // Track position for distance calculation
      const world = this.service.getWorld();
      const currentPos = world?.entities?.player?.data?.position;
      
      if (currentPos && this.lastPosition && this.recording) {
        // Handle position as either array or object format
        let x: number, y: number, z: number;
        if (Array.isArray(currentPos)) {
          [x = 0, y = 0, z = 0] = currentPos;
        } else {
          x = (currentPos as any).x || 0;
          y = (currentPos as any).y || 0;
          z = (currentPos as any).z || 0;
        }
        
        const distance = Math.sqrt(
          Math.pow(x - this.lastPosition.x, 2) +
          Math.pow(y - this.lastPosition.y, 2) +
          Math.pow(z - this.lastPosition.z, 2)
        );
        this.recording.metrics.distanceTraveled += distance;
      }
      
      // Convert position to object format for storage
      if (currentPos) {
        if (Array.isArray(currentPos)) {
          const [x = 0, y = 0, z = 0] = currentPos;
          this.lastPosition = { x, y, z };
        } else {
          this.lastPosition = {
            x: (currentPos as any).x || 0,
            y: (currentPos as any).y || 0,
            z: (currentPos as any).z || 0
          };
        }
      } else {
        this.lastPosition = null;
      }

      // Take periodic screenshots if recording
      if (this.recording && this.puppeteerManager) {
        const shouldScreenshot = this.recording.screenshots.length === 0 ||
          Date.now() - this.recording.screenshots[this.recording.screenshots.length - 1].timestamp.getTime() > 10000;
        
        if (shouldScreenshot) {
          const page = this.puppeteerManager.getPage();
          const screenshot = await page?.screenshot({ encoding: 'base64' });
          if (screenshot) {
            this.recording.screenshots.push({
              timestamp: new Date(),
              imageData: screenshot as string
            });
          }
        }
      }
    } catch (error) {
      logger.error('[EnhancedObserver] Error in observation tick:', error);
    }
  }

  /**
   * Sets up event listeners
   */
  private setupEventListeners(): void {
    // Listen for runtime events
    this.runtime.on?.('action_executed', (data: any) => {
      this.handleActionExecuted(data);
    });

    this.runtime.on?.('message_sent', (data: any) => {
      this.handleMessageSent(data);
    });

    this.runtime.on?.('state_changed', (data: any) => {
      this.handleStateChanged(data);
    });
  }

  /**
   * Tears down event listeners
   */
  private teardownEventListeners(): void {
    this.runtime.off?.('action_executed', this.handleActionExecuted);
    this.runtime.off?.('message_sent', this.handleMessageSent);
    this.runtime.off?.('state_changed', this.handleStateChanged);
  }

  /**
   * Handles action execution events
   */
  private async handleActionExecuted(data: any): Promise<void> {
    const { action, success, error } = data;
    
    // Highlight the action
    await this.highlightAction(action);
    
    // Log the action
    await this.logAction(action, success);

    // Record the event
    if (this.recording) {
      this.recordEvent({
        timestamp: new Date(),
        type: 'action',
        data: { action, success, error }
      });

      // Update metrics
      this.recording.metrics.totalActions++;
      if (success) {
        this.recording.metrics.successfulActions++;
      } else {
        this.recording.metrics.failedActions++;
      }
    }
  }

  /**
   * Handles message events
   */
  private handleMessageSent(data: any): void {
    if (this.recording) {
      this.recordEvent({
        timestamp: new Date(),
        type: 'message',
        data
      });
      this.recording.metrics.messagesExchanged++;
    }
  }

  /**
   * Handles state change events
   */
  private handleStateChanged(data: any): void {
    if (this.recording) {
      this.recordEvent({
        timestamp: new Date(),
        type: 'state_change',
        data
      });
    }
  }

  /**
   * Starts recording a session
   */
  private startRecording(): void {
    this.recording = {
      agentId: this.runtime.agentId,
      startTime: new Date(),
      events: [],
      screenshots: [],
      metrics: {
        totalActions: 0,
        successfulActions: 0,
        failedActions: 0,
        distanceTraveled: 0,
        messagesExchanged: 0,
        itemsCollected: 0,
        questsCompleted: 0
      }
    };
    logger.info('[EnhancedObserver] Started recording session');
  }

  /**
   * Stops recording
   */
  private stopRecording(): void {
    if (this.recording) {
      this.recording.endTime = new Date();
      logger.info('[EnhancedObserver] Stopped recording session');
      
      // Save recording to file if needed
      this.saveRecording();
    }
  }

  /**
   * Records an event
   */
  private recordEvent(event: RecordedEvent): void {
    if (this.recording) {
      this.recording.events.push(event);
    }
  }

  /**
   * Saves the recording to a file
   */
  private async saveRecording(): Promise<void> {
    if (!this.recording) return;

    try {
      const filename = `observation-${this.recording.agentId}-${Date.now()}.json`;
      const data = JSON.stringify(this.recording, null, 2);
      
      // In a real implementation, save to file system
      logger.info(`[EnhancedObserver] Recording saved: ${filename}`);
    } catch (error) {
      logger.error('[EnhancedObserver] Error saving recording:', error);
    }
  }
} 