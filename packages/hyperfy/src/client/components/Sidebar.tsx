import { Settings, MenuIcon, MessageSquareIcon } from 'lucide-react'
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { isTouch } from '../utils'
import { cls } from './cls'
import {
  FieldBtn,
  FieldRange,
  FieldSwitch,
  FieldText,
  FieldToggle,
} from './Fields'
import { HintContext, HintProvider } from './Hint'
import { MicIcon, MicOffIcon, VRIcon } from './Icons'
import { useFullscreen } from './useFullscreen'
import { DraggableWindow } from './DraggableWindow'
import { Minimap } from './Minimap'

const mainSectionPanes = ['prefs']


/**
 * frosted
 * 
background: rgba(11, 10, 21, 0.85); 
border: 0.0625rem solid #2a2b39;
backdrop-filter: blur(5px);
 *
 */

export function Sidebar({ world, ui }) {
  const player = world.entities.player
  const [livekit, setLiveKit] = useState(() => world.livekit.status)
  const [settingsPosition, setSettingsPosition] = useState({ x: 0, y: 0 })
  
  useEffect(() => {
    const onLiveKitStatus = status => {
      setLiveKit({ ...status })
    }
    world.livekit.on('status', onLiveKitStatus)
    return () => {
      world.livekit.off('status', onLiveKitStatus)
    }
  }, [])
  
  // Position settings menu at bottom right
  useEffect(() => {
    const updateSettingsPosition = () => {
      const padding = 32 // 2rem in pixels
      setSettingsPosition({
        x: window.innerWidth - 300 - padding, // 300px is approximate menu width
        y: window.innerHeight - 400 - padding  // 400px is approximate menu height
      })
    }
    
    updateSettingsPosition()
    window.addEventListener('resize', updateSettingsPosition)
    
    return () => {
      window.removeEventListener('resize', updateSettingsPosition)
    }
  }, [])
  
  const activePane = ui.active ? ui.pane : null
  return (
    <HintProvider>
      <div
        className='sidebar'
        style={{
          position: 'absolute',
          fontSize: '1rem',
          top: 'calc(2rem + env(safe-area-inset-top))',
          right: 'calc(2rem + env(safe-area-inset-right))',
          bottom: 'calc(2rem + env(safe-area-inset-bottom))',
          left: 'calc(2rem + env(safe-area-inset-left))',
          display: 'flex',
          gap: '0.625rem',
          zIndex: 1,
        }}
      >
        <style>{`
          @media all and (max-width: 1200px) {
            .sidebar {
              top: calc(1rem + env(safe-area-inset-top));
              right: calc(1rem + env(safe-area-inset-right));
              bottom: calc(1rem + env(safe-area-inset-bottom));
              left: calc(1rem + env(safe-area-inset-left));
            }
          }
          .sidebar-sections {
            display: flex;
            flex-direction: column;
            flex-shrink: 0;
            gap: 0.625rem;
          }
          .sidebar-content.hidden {
            opacity: 0;
            pointer-events: none;
          }
          .sidebarpane.hidden {
            opacity: 0;
            pointer-events: none;
          }
          .sidebarpane-content {
            pointer-events: auto;
            max-height: 100%;
            display: flex;
            flex-direction: column;
          }
          .world-head {
            height: 3.125rem;
            padding: 0 1rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            display: flex;
            align-items: center;
          }
          .world-title {
            font-weight: 500;
            font-size: 1rem;
            line-height: 1;
          }
          .world-content {
            flex: 1;
            padding: 0.5rem 0;
            overflow-y: auto;
          }
        `}</style>
        <div className='sidebar-sections'>
          {/* Chat and voice controls - top left */}
          <Section active={false} bottom>
            {isTouch && (
              <Btn
                onClick={() => {
                  world.emit('sidebar-chat-toggle')
                }}
              >
                <MessageSquareIcon size='1.25rem' />
              </Btn>
            )}
            {livekit.available && !livekit.connected && (
              <Btn disabled>
                <MicOffIcon size='1.25rem' />
              </Btn>
            )}
            {livekit.available && livekit.connected && (
              <Btn
                onClick={() => {
                  world.livekit.setMicrophoneEnabled()
                }}
              >
                {livekit.mic ? <MicIcon size='1.25rem' /> : <MicOffIcon size='1.25rem' />}
              </Btn>
            )}
            {world.xr?.supportsVR && (
              <Btn
                onClick={() => {
                  world.xr?.enter()
                }}
              >
                <VRIcon size={20} />
              </Btn>
            )}
          </Section>
        </div>
        
        {/* Minimap - top left */}
        <DraggableWindow
          initialPosition={{ x: 32, y: 120 }} // Below the control buttons
          dragHandle={
            <div style={{ 
              padding: '0.25rem 0.5rem', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              background: 'rgba(11, 10, 21, 0.95)',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '0.75rem',
              fontWeight: '500',
              color: 'rgba(255, 255, 255, 0.8)'
            }}>
              Minimap
            </div>
          }
          style={{
            position: 'fixed',
            zIndex: 998
          }}
        >
          <Minimap 
            world={world} 
            width={200} 
            height={200}
            zoom={50}
            style={{
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0
            }}
          />
        </DraggableWindow>
        
        {/* Settings menu - bottom right, draggable */}
        <DraggableWindow
          initialPosition={settingsPosition}
          onPositionChange={setSettingsPosition}
          dragHandle={
            <div style={{ 
              padding: '0.5rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              marginBottom: '0.5rem'
            }}>
              <Settings size='1rem' />
              <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Settings</span>
            </div>
          }
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            zIndex: 1000
          }}
        >
          <Section active={mainSectionPanes.includes(activePane)} bottom>
            <Btn
              active={activePane === 'prefs'}
              suspended={ui.pane === 'prefs' && !activePane}
              onClick={() => world.ui.togglePane('prefs')}
            >
              <Settings size='1.25rem' />
            </Btn>
          </Section>
        </DraggableWindow>
        {ui.pane === 'prefs' && (
          <DraggableWindow
            initialPosition={{ x: settingsPosition.x, y: settingsPosition.y - 480 }}
            dragHandle={
              <div style={{ 
                padding: '0.75rem 1rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(11, 10, 21, 0.95)',
                borderTopLeftRadius: '1rem',
                borderTopRightRadius: '1rem'
              }}>
                <Settings size='1rem' />
                <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Game Settings</span>
              </div>
            }
            style={{
              position: 'fixed',
              zIndex: 999
            }}
          >
            <Prefs world={world} hidden={!ui.active} />
          </DraggableWindow>
        )}
      </div>
    </HintProvider>
  )
}

function Section({ active, top = false, bottom = false, children }: { active: boolean; top?: boolean; bottom?: boolean; children: any }) {
  return (
    <div
      className={cls('sidebar-section', { active, top, bottom })}
      style={{
        background: 'rgba(11, 10, 21, 0.85)',
        border: '0.0625rem solid #2a2b39',
        backdropFilter: 'blur(5px)',
        borderRadius: '1rem',
        padding: '0.6875rem 0',
        pointerEvents: 'auto' as any,
        position: 'relative' as any,
      }}
    >
      {children}
    </div>
  )
}

function Btn({ disabled = false, suspended = false, active = false, children, ...props }: { disabled?: boolean; suspended?: boolean; active?: boolean; children: any; [key: string]: any }) {
  return (
    <div
      className={cls('sidebar-btn', { disabled, suspended, active })}
      style={{
        width: '2.75rem',
        height: '1.875rem',
        display: 'flex',
        alignItems: 'center' as any,
        justifyContent: 'center' as any,
        color: 'rgba(255, 255, 255, 0.8)',
        position: 'relative' as any,
      }}
      {...props}
    >
      <style>{`
        .sidebar-btn-dot {
          display: none;
          position: absolute;
          top: 0.8rem;
          right: 0.2rem;
          width: 0.3rem;
          height: 0.3rem;
          border-radius: 0.15rem;
          background: white;
        }
        .sidebar-btn:hover {
          cursor: pointer;
          color: white;
        }
        .sidebar-btn.active {
          color: white;
        }
        .sidebar-btn.active .sidebar-btn-dot {
          display: block;
        }
        .sidebar-btn.suspended .sidebar-btn-dot {
          display: block;
          background: #ba6540;
        }
        .sidebar-btn.disabled {
          color: #5d6077;
        }
      `}</style>
      {children}
      <div className='sidebar-btn-dot' />
    </div>
  )
}

function Content({ width = '20rem', hidden, children }) {
  return (
    <div
      className={cls('sidebar-content', { hidden })}
      style={{
        width: width,
        pointerEvents: 'auto',
        background: 'rgba(11, 10, 21, 0.85)',
        border: '0.0625rem solid #2a2b39',
        backdropFilter: 'blur(5px)',
        borderRadius: '1rem',
        display: 'flex',
        alignItems: 'stretch',
      }}
    >
      <div className='sidebar-content-main'>{children}</div>
      <Hint />
    </div>
  )
}

function Pane({ width = '20rem', hidden, children }) {
  return (
    <div
      className={cls('sidebarpane', { hidden })}
      style={{
        width: width,
        maxWidth: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className='sidebarpane-content'>{children}</div>
      <Hint />
    </div>
  )
}

function Hint() {
  const contextValue = useContext(HintContext)
  if (!contextValue) return null
  const { hint } = contextValue
  if (!hint) return null
  return (
    <div
      className='hint'
      style={{
        marginTop: '0.25rem',
        background: 'rgba(11, 10, 21, 0.85)',
        border: '0.0625rem solid #2a2b39',
        backdropFilter: 'blur(5px)',
        borderRadius: '1rem',
        minWidth: '0',
        padding: '1rem',
        fontSize: '0.9375rem',
      }}
    >
      <span>{hint}</span>
    </div>
  )
}

function Group({ label }) {
  return (
    <>
      <div
        style={{
          height: '0.0625rem',
          background: 'rgba(255, 255, 255, 0.05)',
          margin: '0.6rem 0',
        }}
      />
      {label && (
        <div
          style={{
            fontWeight: '500',
            lineHeight: '1',
            padding: '0.75rem 0 0.75rem 1rem',
            marginTop: '-0.6rem',
          }}
        >
          {label}
        </div>
      )}
    </>
  )
}

const shadowOptions = [
  { label: 'None', value: 'none' },
  { label: 'Low', value: 'low' },
  { label: 'Med', value: 'med' },
  { label: 'High', value: 'high' },
]
function Prefs({ world, hidden }) {
  const player = world.entities.player
  const [name, setName] = useState(() => player.data.name)
  const [dpr, setDPR] = useState(world.prefs.dpr)
  const [shadows, setShadows] = useState(world.prefs.shadows)
  const [postprocessing, setPostprocessing] = useState(world.prefs.postprocessing)
  const [bloom, setBloom] = useState(world.prefs.bloom)
  const [music, setMusic] = useState(world.prefs.music)
  const [sfx, setSFX] = useState(world.prefs.sfx)
  const [voice, setVoice] = useState(world.prefs.voice)
  const [ui, setUI] = useState(world.prefs.ui)
  const [canFullscreen, isFullscreen, toggleFullscreen] = useFullscreen(null)
  const [stats, setStats] = useState(world.prefs.stats)
  
  const changeName = name => {
    if (!name) return setName(player.data.name)
    player.setName(name)
  }
  const dprOptions = useMemo(() => {
    const width = world.graphics.width
    const height = world.graphics.height
    const dpr = window.devicePixelRatio
    const options: Array<{label: string; value: number}> = []
    const add = (label: string, dpr: number) => {
      options.push({
        label,
        value: dpr,
      })
    }
    add('0.5x', 0.5)
    add('1x', 1)
    if (dpr >= 2) add('2x', 2)
    if (dpr >= 3) add('3x', dpr)
    return options
  }, [])
  useEffect(() => {
    const onPrefsChange = changes => {
      if (changes.dpr) setDPR(changes.dpr.value)
      if (changes.shadows) setShadows(changes.shadows.value)
      if (changes.postprocessing) setPostprocessing(changes.postprocessing.value)
      if (changes.bloom) setBloom(changes.bloom.value)
      if (changes.music) setMusic(changes.music.value)
      if (changes.sfx) setSFX(changes.sfx.value)
      if (changes.voice) setVoice(changes.voice.value)
      if (changes.ui) setUI(changes.ui.value)
      if (changes.stats) setStats(changes.stats.value)
    }
    world.prefs.on('change', onPrefsChange)
    return () => {
      world.prefs.off('change', onPrefsChange)
    }
  }, [])
  
  return (
    <div
      className='prefs noscrollbar'
      style={{
        width: '20rem',
        maxHeight: '28rem',
        overflowY: 'auto',
        background: 'rgba(11, 10, 21, 0.85)',
        border: '0.0625rem solid #2a2b39',
        backdropFilter: 'blur(5px)',
        borderRadius: '1rem',
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        padding: '0.6rem 0',
      }}
    >
        <FieldText label='Character Name' hint='Change your character name in the game' value={name} onChange={changeName} />
        
        <Group label='Interface & Display' />
        <FieldRange
          label='UI Scale'
          hint='Change the scale of the user interface'
          min={0.5}
          max={1.5}
          step={0.1}
          value={ui}
          onChange={ui => world.prefs.setUI(ui)}
        />
        <FieldToggle
          label='Fullscreen'
          hint='Toggle fullscreen. Not supported in some browsers'
          value={isFullscreen as boolean}
          onChange={value => (toggleFullscreen as (value: any) => void)(value)}
          trueLabel='Enabled'
          falseLabel='Disabled'
        />
        <FieldToggle
          label='Performance Stats'
          hint='Show or hide performance statistics'
          value={world.prefs.stats}
          onChange={stats => world.prefs.setStats(stats)}
          trueLabel='Visible'
          falseLabel='Hidden'
        />
        {!isTouch && (
          <FieldBtn
            label='Hide Interface'
            note='Z'
            hint='Hide the user interface. Press Z to re-enable.'
            onClick={() => world.ui.toggleVisible()}
          />
        )}
        
        <Group label='Visual Quality' />
        <FieldSwitch
          label='Resolution'
          hint='Change your display resolution for better performance or quality'
          options={dprOptions}
          value={dpr}
          onChange={dpr => world.prefs.setDPR(dpr)}
        />
        <FieldSwitch
          label='Shadow Quality'
          hint='Change the quality of shadows cast by objects and characters'
          options={shadowOptions}
          value={shadows}
          onChange={shadows => world.prefs.setShadows(shadows)}
        />
        <FieldToggle
          label='Visual Effects'
          hint='Enable or disable advanced visual effects'
          trueLabel='Enabled'
          falseLabel='Disabled'
          value={postprocessing}
          onChange={postprocessing => world.prefs.setPostprocessing(postprocessing)}
        />
        <FieldToggle
          label='Magical Glow'
          hint='Enable or disable magical bloom effects on bright objects'
          trueLabel='Enabled'
          falseLabel='Disabled'
          value={bloom}
          onChange={bloom => world.prefs.setBloom(bloom)}
        />
        
        <Group label='Audio & Sound' />
        <FieldRange
          label='Music Volume'
          hint='Adjust background music and ambient sounds'
          min={0}
          max={2}
          step={0.05}
          value={music}
          onChange={music => world.prefs.setMusic(music)}
        />
        <FieldRange
          label='Effects Volume'
          hint='Adjust combat, magic, and interaction sound effects'
          min={0}
          max={2}
          step={0.05}
          value={sfx}
          onChange={sfx => world.prefs.setSFX(sfx)}
        />
        <FieldRange
          label='Voice Chat'
          hint='Adjust volume for player voice communication'
          min={0}
          max={2}
          step={0.05}
          value={voice}
          onChange={voice => world.prefs.setVoice(voice)}
        />
    </div>
  )
}











