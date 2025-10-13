import { isBoolean } from 'lodash-es'
import THREE from '../extras/three'
import { SystemBase } from './SystemBase'
import { EventType } from '../types/events'
import { ControlPriorities } from '../extras/ControlPriorities'
import { storage } from '../storage'
import StatsGL from '../libs/stats-gl'
import Panel from '../libs/stats-gl/panel'
import type { 
  World, WorldOptions, ControlBinding, Entity 
} from '../types'

// Pre-allocated temp objects
const _v3_1 = new THREE.Vector3()

// Constants
const PING_RATE = 1 / 2
const TARGET_SVG = `
  <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="15" cy="15" r="13" stroke="#00FF7F" stroke-width="2" opacity="0.9"/>
    <circle cx="15" cy="15" r="3" fill="#00FF7F" opacity="0.9"/>
    <line x1="15" y1="0" x2="15" y2="6" stroke="#00FF7F" stroke-width="2" opacity="0.9"/>
    <line x1="15" y1="24" x2="15" y2="30" stroke="#00FF7F" stroke-width="2" opacity="0.9"/>
    <line x1="0" y1="15" x2="6" y2="15" stroke="#00FF7F" stroke-width="2" opacity="0.9"/>
    <line x1="24" y1="15" x2="30" y2="15" stroke="#00FF7F" stroke-width="2" opacity="0.9"/>
  </svg>
`

// Interfaces
export interface ClientUIState {
  visible: boolean
  active: boolean
  app: Entity | null
  pane: string | null
}

export interface ClientPrefsData {
  ui?: number
  actions?: boolean
  stats?: boolean
  dpr?: number
  shadows?: string
  postprocessing?: boolean
  bloom?: boolean
  music?: number
  sfx?: number
  voice?: number
  chatVisible?: boolean
  v?: number
}

export type PrefsKey = keyof ClientPrefsData
export type PrefsValue = ClientPrefsData[PrefsKey]

/**
 * Unified Client Interface System
 * 
 * Manages UI state, preferences, stats display, and target indicators
 */
export class ClientInterface extends SystemBase {
  // UI State
  state: ClientUIState = {
    visible: true,
    active: false,
    app: null,
    pane: null
  }
  control: ControlBinding | null = null
  
  // Preferences
  ui: number = 1
  actions: boolean = true
  stats: boolean = false
  dpr: number = 1
  shadows: string = 'med'
  postprocessing: boolean = true
  bloom: boolean = true
  music: number = 1
  sfx: number = 1
  voice: number = 1
  chatVisible: boolean = true
  v: number = 0
  changes: Record<string, { prev: PrefsValue; value: PrefsValue }> | null = null
  
  // Stats display
  statsPanel: { 
    dom: HTMLElement; 
    setMode?: (mode: number) => void; 
    addPanel: (panel: { dom: HTMLElement }, index?: number) => { dom: HTMLElement }; 
    begin: () => void; 
    end: () => void; 
    init?: (renderer: unknown, debug: boolean) => void; 
    update?: () => void 
  } | null = null
  statsActive: boolean = false
  lastPingAt: number = 0
  pingHistory: number[] = []
  pingHistorySize: number = 30
  maxPing: number = 0.01
  ping: { dom: HTMLElement; update?: (value: number, max: number, graph: unknown[], index: number) => void; fg?: string } | null = null  // Panel type not strictly typed
  
  // Target indicator
  targetGuide!: HTMLDivElement
  targetVector: THREE.Vector3 | null = null
  targetBounds: DOMRect | null = null
  
  // DOM container
  uiContainer: HTMLElement | null = null
  
  constructor(world: World) {
    super(world, { name: 'client-interface', dependencies: { required: [], optional: [] }, autoCleanup: true })
  }
  
  async init(options: WorldOptions & { ui?: HTMLElement }): Promise<void> {
    this.uiContainer = options.ui || null;
    
    // Load preferences from storage
    const stored = storage.get('prefs');
    if (stored) {
      const parsed = JSON.parse(stored as string) as ClientPrefsData;
      if (parsed.ui !== undefined) this.ui = parsed.ui;
      if (parsed.actions !== undefined) this.actions = parsed.actions;
      if (parsed.stats !== undefined) this.stats = parsed.stats;
      if (parsed.dpr !== undefined) this.dpr = parsed.dpr;
      if (parsed.shadows !== undefined) this.shadows = parsed.shadows;
      if (parsed.postprocessing !== undefined) this.postprocessing = parsed.postprocessing;
      if (parsed.bloom !== undefined) this.bloom = parsed.bloom;
      
      if (parsed.chatVisible !== undefined) this.chatVisible = parsed.chatVisible;
      if (parsed.music !== undefined) this.music = parsed.music;
      if (parsed.sfx !== undefined) this.sfx = parsed.sfx;
      if (parsed.voice !== undefined) this.voice = parsed.voice;
      if (parsed.v !== undefined) this.v = parsed.v;
    }
  }
  
  start() {
    // UI control binding
    if (!this.world.controls) return;
    
    this.control = this.world.controls.bind({ priority: ControlPriorities.CORE_UI });
    
    // Setup key bindings - access via index to work around TypeScript narrowing
    const keyC = this.control.keyC as { onPress: () => void } | undefined;
    if (keyC) {
      keyC.onPress = () => this.toggleVisible();
    }
    const keyEscape = this.control.keyEscape as { onPress: () => void } | undefined;
    if (keyEscape) {
      keyEscape.onPress = () => this.toggleActive(false);
    }
    
    // Setup target guide
    this.targetGuide = document.createElement('div');
    this.targetGuide.style.position = 'absolute';
    this.targetGuide.style.width = '30px';
    this.targetGuide.style.height = '30px';
    this.targetGuide.style.display = 'flex';
    this.targetGuide.style.alignItems = 'center';
    this.targetGuide.style.justifyContent = 'center';
    this.targetGuide.style.transform = 'translate(-50%, -50%)';
    this.targetGuide.style.filter = 'drop-shadow(0px 0px 4px rgba(0, 0, 0, 0.25))';
    this.targetGuide.innerHTML = TARGET_SVG;
    
    // Listen for events
    if (this.world.prefs) {
      this.world.prefs.on('change', this.onPrefsChange);
    }
    this.subscribe(EventType.READY, () => this.onReady());
  }
  
  preFixedUpdate() {
    // Apply preference changes
    if (this.changes) {
      this.emit('change', this.changes)
      this.changes = null
    }
  }
  
  update(delta: number) {
    // Update UI controls
    if (this.control && this.state.visible) {
      const keyB = this.control.keyB as { pressed: boolean } | undefined;
      if (keyB && keyB.pressed) {
        this.toggleActive();
      }
    }
    
    // Update stats ping
    if (this.statsActive) {
      this.lastPingAt += delta;
      if (this.lastPingAt > PING_RATE) {
        const time = performance.now();
        this.world.network.send('ping', time);
        this.lastPingAt = 0;
      }
    }
  }
  
  lateUpdate() {
    // Update target indicator
    if (!this.targetVector) return
    
    _v3_1.copy(this.targetVector)
    _v3_1.project(this.world.camera)
    
    const x = ((_v3_1.x + 1) * (this.targetBounds?.width || 0)) / 2
    const y = ((-_v3_1.y + 1) * (this.targetBounds?.height || 0)) / 2
    
    // Behind camera
    if (_v3_1.z > 1) {
      this.targetGuide.style.display = 'none'
      return
    }
    
    // On screen
    if (_v3_1.x >= -1 && _v3_1.x <= 1 && _v3_1.y >= -1 && _v3_1.y <= 1) {
      this.targetGuide.style.left = `${x}px`
      this.targetGuide.style.top = `${y}px`
      this.targetGuide.style.display = 'block'
    } else {
      // Off screen - pin to edge
      const centerX = (this.targetBounds?.width || 0) / 2
      const centerY = (this.targetBounds?.height || 0) / 2
      
      const pt = this.intersectLineWithRect(
        centerX, centerY, x, y,
        this.targetBounds?.width || 0,
        this.targetBounds?.height || 0,
        10
      )
      
      if (!pt) {
        this.targetGuide.style.display = 'none'
        return
      }
      
      this.targetGuide.style.left = `${pt.x}px`
      this.targetGuide.style.top = `${pt.y}px`
      this.targetGuide.style.display = 'block'
    }
  }
  
  preTick() {
    if (this.statsActive) {
      this.statsPanel?.begin()
    }
  }
  
  postTick() {
    if (this.statsActive) {
      this.statsPanel?.end()
      this.statsPanel?.update?.()
    }
  }
  
  // UI Methods
  toggleVisible(value?: boolean) {
    this.state.visible = isBoolean(value) ? value : !this.state.visible
    if (!this.state.visible && this.state.active) {
      this.state.active = false
    }
    this.broadcast()
  }
  
  toggleActive(value?: boolean) {
    this.state.active = isBoolean(value) ? value : !this.state.active
    this.broadcast()
  }
  
  broadcast() {
    type UIUpdateEvent = 'ui-update'
    this.emitTypedEvent('ui-update' as UIUpdateEvent, { ...this.state })
  }
  
  // Target Methods
  showTarget(vec3: THREE.Vector3) {
    this.targetVector = vec3
    this.uiContainer?.appendChild(this.targetGuide)
    type ElementWithBounds = { getBoundingClientRect: () => DOMRect }
    this.targetBounds = (this.uiContainer as ElementWithBounds | null)?.getBoundingClientRect() || null
  }
  
  hideTarget() {
    if (this.targetVector) {
      this.targetVector = null
      this.uiContainer?.removeChild(this.targetGuide)
    }
  }
  
  // Stats Methods
  toggleStats(value?: boolean) {
    value = isBoolean(value) ? value : !this.statsActive
    if (this.statsActive === value) return
    
    this.statsActive = value
    
    if (this.statsActive) {
      if (!this.statsPanel) {
        const statsGL = new StatsGL({
          logsPerSecond: 20,
          samplesLog: 100,
          samplesGraph: 10,
          precision: 2,
          horizontal: true,
          minimal: false,
          mode: 0,
        })
        this.statsPanel = statsGL as unknown as {
          dom: HTMLElement;
          setMode?: (mode: number) => void;
          addPanel: (panel: { dom: HTMLElement }, index?: number) => { dom: HTMLElement };
          begin: () => void;
          end: () => void;
          init?: (renderer: unknown, debug: boolean) => void;
          update?: () => void;
        }
        if (this.statsPanel && this.statsPanel.init) {
          this.statsPanel.init(this.world.graphics?.renderer, false)
        }
        type PanelConstructor = new (name: string, fg: string, bg: string) => { dom: HTMLElement; update?: (value: number, max: number, graph: unknown[], index: number) => void; fg?: string }
        this.ping = new (Panel as unknown as PanelConstructor)('PING', '#f00', '#200')
        if (this.statsPanel && this.statsPanel.addPanel) {
          this.statsPanel.addPanel(this.ping, 3)
        }
      }
      if (this.uiContainer && this.statsPanel && this.statsPanel.dom) {
        this.uiContainer.appendChild(this.statsPanel.dom)
      }
    } else {
      if (this.statsPanel && this.uiContainer) {
        this.uiContainer.removeChild(this.statsPanel.dom)
      }
    }
  }
  
  onPong(time: number) {
    const rttMs = performance.now() - time
    
    if (this.statsActive && this.ping) {
      this.pingHistory.push(rttMs)
      
      if (this.pingHistory.length > this.pingHistorySize) {
        this.pingHistory.shift()
      }
      
      this.maxPing = Math.max(this.maxPing, rttMs)
      
      let avgPing = 0
      for (let i = 0; i < this.pingHistory.length; i++) {
        avgPing += this.pingHistory[i]
      }
      avgPing /= this.pingHistory.length
      
      const graph: { min?: number; max?: number; avg?: number }[] = []
      for (let i = 0; i < this.pingHistory.length; i++) {
        const ping = this.pingHistory[i]
        graph.push({
          min: ping,
          max: ping,
          avg: ping,
        })
      }
      
      this.ping.update?.(rttMs, this.maxPing, graph, 3)
      
      let color = '#0f0'
      if (avgPing > 100) color = '#f00'
      else if (avgPing > 50) color = '#ff0'
      
      if (this.ping.fg !== undefined) {
        this.ping.fg = color
      }
      const firstChild = this.ping.dom.children[0] as HTMLElement | undefined
      if (firstChild) firstChild.style.color = color
    }
  }
  
  // Preference Methods
  modify(key: PrefsKey, value: PrefsValue) {
    if (!this.changes) this.changes = {}
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prev = (this as any)[key]
    if (prev !== value) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any)[key] = value
      this.changes[key] = { prev, value }
    }
  }
  
  async persist() {
    const data: ClientPrefsData = {
      ui: this.ui,
      actions: this.actions,
      stats: this.stats,
      dpr: this.dpr,
      shadows: this.shadows,
      postprocessing: this.postprocessing,
      bloom: this.bloom,
      
      music: this.music,
      sfx: this.sfx,
      voice: this.voice,
      chatVisible: this.chatVisible,
      v: this.v,
    };
    
    storage.set('prefs', JSON.stringify(data));
  }
  
  // Preference setters
  setUI(value: number) { this.modify('ui', value) }
  setActions(value: boolean) { this.modify('actions', value) }
  setStats(value: boolean) { this.modify('stats', value) }
  setDPR(value: number) { this.modify('dpr', value) }
  setShadows(value: string) { this.modify('shadows', value) }
  setPostprocessing(value: boolean) { this.modify('postprocessing', value) }
  setBloom(value: boolean) { this.modify('bloom', value) }
  setMusic(value: number) { this.modify('music', value) }
  setSFX(value: number) { this.modify('sfx', value) }
  setVoice(value: number) { this.modify('voice', value) }
  setChatVisible(value: boolean) { this.modify('chatVisible', value) }
  
  // Event handlers
  private onReady = () => {
    if (this.stats) {
      this.toggleStats(true)
    }
  }
  
  private onPrefsChange = (changes: { stats?: { value: boolean } }) => {
    if (changes.stats) {
      this.toggleStats(changes.stats.value)
    }
  }
  
  // Helper methods
  private intersectLineWithRect(
    cx: number, cy: number, 
    x: number, y: number, 
    width: number, height: number, 
    padding: number = 0
  ): { x: number; y: number } | null {
    const dx = x - cx
    const dy = y - cy
    
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return null
    
    let t = Infinity
    
    // Left edge
    if (dx < 0) {
      const tLeft = (padding - cx) / dx
      if (tLeft > 0) {
        const yAtLeft = cy + tLeft * dy
        if (yAtLeft >= padding && yAtLeft <= height - padding) {
          t = Math.min(t, tLeft)
        }
      }
    }
    
    // Right edge
    if (dx > 0) {
      const tRight = (width - padding - cx) / dx
      if (tRight > 0) {
        const yAtRight = cy + tRight * dy
        if (yAtRight >= padding && yAtRight <= height - padding) {
          t = Math.min(t, tRight)
        }
      }
    }
    
    // Top edge
    if (dy < 0) {
      const tTop = (padding - cy) / dy
      if (tTop > 0) {
        const xAtTop = cx + tTop * dx
        if (xAtTop >= padding && xAtTop <= width - padding) {
          t = Math.min(t, tTop)
        }
      }
    }
    
    // Bottom edge
    if (dy > 0) {
      const tBottom = (height - padding - cy) / dy
      if (tBottom > 0) {
        const xAtBottom = cx + tBottom * dx
        if (xAtBottom >= padding && xAtBottom <= width - padding) {
          t = Math.min(t, tBottom)
        }
      }
    }
    
    if (t === Infinity) return null
    
    return {
      x: cx + t * dx,
      y: cy + t * dy,
    }
  }
  
  destroy() {
    this.control?.release()
    this.control = null
    this.hideTarget()
    if (this.statsPanel && this.uiContainer) {
      this.uiContainer.removeChild(this.statsPanel.dom)
    }
    this.persist()
  }
}
