import { MessageSquareIcon } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { ControlPriorities, EventType, isTouch } from '@hyperscape/shared'
import type { ClientWorld } from '../types'
import { cls } from './cls'
import { useChatContext } from './ChatContext'

const CHAT_HEADER_FONT = "'Inter', system-ui, sans-serif"
const CHAT_ACCENT_COLOR = '#f7d98c'

// Local type definitions
interface ChatMessage {
  id: string
  from: string
  fromId?: string
  body: string
  createdAt: string
  timestamp?: number
}

interface ControlBinding {
  slash?: { onPress?: () => void | boolean | null }
  enter?: { onPress?: () => void | boolean | null }
  mouseLeft?: { onPress?: () => void | boolean | null }
  pointer?: { locked?: boolean }
  release?: () => void
}

// Extended client world type for Chat component
type ChatWorld = ClientWorld & {
  prefs?: ClientWorld['prefs'] & {
    chatVisible?: boolean
  }
  controls?: {
    bind?: (options: { priority?: number }) => ControlBinding
    pointer?: { locked?: boolean }
  }
  chat: {
    subscribe: (callback: (msgs: ChatMessage[]) => void) => () => void
    send: (message: string) => void
    command: (command: string) => void
  }
  network: {
    id: string
  }
}

export function Chat({ world }: { world: ChatWorld }) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const chatPanelRef = useRef<HTMLDivElement | null>(null)
  const touchStartYRef = useRef<number | null>(null)
  const [msg, setMsg] = useState('')
  const { active, setActive, collapsed, setCollapsed } = useChatContext()
  const [chatVisible, setChatVisible] = useState(() => world.prefs?.chatVisible ?? true)
  const [isMobileLayout, setIsMobileLayout] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false))

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setIsMobileLayout(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const onToggle = () => {
      setActive(!active)
      if (!active) {
        setCollapsed(false)
      }
    }
    world.on(EventType.UI_SIDEBAR_CHAT_TOGGLE, onToggle)
    return () => {
      world.off(EventType.UI_SIDEBAR_CHAT_TOGGLE, onToggle)
    }
  }, [active, setActive, setCollapsed, world])

  useEffect(() => {
    const onPrefsChange = (changes: { chatVisible?: { value: boolean } }) => {
      if (changes.chatVisible !== undefined) {
        setChatVisible(changes.chatVisible.value)
      }
    }
    world.prefs?.on?.('change', onPrefsChange)
    return () => {
      world.prefs?.off?.('change', onPrefsChange)
    }
  }, [world])

  useEffect(() => {
    const control = world.controls?.bind?.({ priority: ControlPriorities.CORE_UI }) as ControlBinding | undefined
    if (!control) return
    if (control.slash) {
      control.slash.onPress = () => {
        if (!active) {
          setActive(true)
          setCollapsed(false)
        }
      }
    }
    if (control.enter) {
      control.enter.onPress = () => {
        if (!active) {
          setActive(true)
          setCollapsed(false)
        }
      }
    }
    if (control.mouseLeft) {
      control.mouseLeft.onPress = () => {
        if (control.pointer?.locked && active) {
          setActive(false)
        }
      }
    }
    return () => control?.release?.()
  }, [active, setActive, setCollapsed, world])

  useEffect(() => {
    if (active && inputRef.current) {
      inputRef.current.focus()
    } else if (inputRef.current) {
      inputRef.current.blur()
    }
  }, [active])

  const send = async (e: React.KeyboardEvent | React.MouseEvent | KeyboardEvent | MouseEvent) => {
    if (world.controls?.pointer?.locked) {
      setTimeout(() => setActive(false), 10)
    }
    if (!msg) {
      e.preventDefault()
      return setActive(false)
    }
    setMsg('')
    if (msg.startsWith('/')) {
      world.chat.command(msg)
      return
    }
    world.chat.send(msg)
    if (isTouch) {
      if (e.target && e.target instanceof HTMLElement) {
        e.target.blur()
      }
      setTimeout(() => setActive(false), 10)
    }
  }

  const panelWidth = isTouch ? 386 : 720
  const panelPadding = isTouch ? '0.85rem' : '1.1rem'
  const dividerGradient =
    'linear-gradient(90deg, rgba(242,208,138,0), rgba(242,208,138,0.4) 14%, rgba(255,215,128,0.95) 50%, rgba(242,208,138,0.4) 86%, rgba(242,208,138,0))'

  const basePanelStyle: React.CSSProperties = {
    background: 'linear-gradient(180deg, rgba(27,29,36,0.95), rgba(16,17,24,0.97))',
    border: '1px solid rgba(87, 97, 118, 0.55)',
    borderRadius: 18,
    padding: panelPadding,
    boxShadow: '0 22px 45px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.07)',
    backdropFilter: 'blur(8px)',
    color: 'rgba(232, 235, 244, 0.92)',
    display: 'flex',
    flexDirection: 'column',
    gap: isTouch ? '0.65rem' : '0.85rem',
    pointerEvents: 'auto',
  }
  const goldLineStyle: React.CSSProperties = {
    width: '100%',
    height: 1,
    background: dividerGradient,
    opacity: 0.95,
  }
  const desktopPanelStyle: React.CSSProperties = {
    ...basePanelStyle,
    width: panelWidth,
    maxWidth: 'min(96vw, 760px)',
  }
  const mobilePanelStyle: React.CSSProperties = {
    ...basePanelStyle,
    width: '100%',
    maxWidth: '100%',
    background: 'rgba(16,17,24,0.93)',
    border: '1px solid rgba(247,217,140,0.22)',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  }

  const chatButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.6rem',
    background: 'linear-gradient(180deg, rgba(33,36,45,0.95), rgba(19,21,29,0.95))',
    border: '1px solid rgba(98, 110, 138, 0.6)',
    borderRadius: 9999,
    padding: isTouch ? '0.55rem 1.2rem' : '0.65rem 1.4rem',
    color: 'rgba(232, 235, 244, 0.9)',
    fontFamily: CHAT_HEADER_FONT,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    fontSize: isTouch ? '0.68rem' : '0.76rem',
    boxShadow: '0 12px 26px rgba(0,0,0,0.55)',
    pointerEvents: 'auto',
  }

  const closeButtonStyle: React.CSSProperties = {
    width: isTouch ? 30 : 36,
    height: isTouch ? 30 : 36,
    borderRadius: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(180deg, rgba(34,37,46,0.95), rgba(19,21,29,0.95))',
    border: '1px solid rgba(108, 120, 148, 0.65)',
    color: 'rgba(232, 235, 244, 0.85)',
    boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
    cursor: 'pointer',
  }

  const inactiveInputStyle: React.CSSProperties = {
    width: '100%',
    padding: isTouch ? '0.55rem 0' : '0.65rem 0',
    borderRadius: 0,
    border: 'none',
    borderBottom: '1px solid rgba(247,217,140,0.55)',
    background: 'transparent',
    color: 'rgba(232, 235, 244, 0.75)',
    fontSize: isTouch ? '0.72rem' : '0.8rem',
    letterSpacing: '0.02em',
    fontFamily: "'Inter', system-ui, sans-serif",
    textAlign: 'left',
  }

  const inputContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    borderBottom: '1px solid rgba(247,217,140,0.55)',
    padding: isTouch ? '0.55rem 0' : '0.65rem 0',
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'rgba(232, 235, 244, 0.96)',
    fontSize: isTouch ? '0.74rem' : '0.86rem',
    letterSpacing: '0.02em',
  }

  const placementStyle: React.CSSProperties = {
    left: `calc(env(safe-area-inset-left) + 24px)`,
    bottom: `calc(env(safe-area-inset-bottom) + 24px)`,
  }

  const tabs = ['Global', 'Local', 'Group'] as const

  const updateMobileOffset = useCallback((newCollapsed?: boolean) => {
    if (typeof document === 'undefined') return
    if (!isMobileLayout) {
      document.documentElement.style.setProperty('--mobile-chat-offset', '0px')
      return
    }
    const isCollapsed = newCollapsed !== undefined ? newCollapsed : collapsed
    if (!isCollapsed && chatPanelRef.current) {
      const height = chatPanelRef.current.offsetHeight
      document.documentElement.style.setProperty('--mobile-chat-offset', `${height + 16}px`)
    } else {
      document.documentElement.style.setProperty('--mobile-chat-offset', '0px')
    }
  }, [collapsed, isMobileLayout])

  useEffect(() => {
    updateMobileOffset()
  }, [updateMobileOffset, active, collapsed])

  useEffect(() => {
    if (!isMobileLayout || typeof ResizeObserver === 'undefined') return
    const node = chatPanelRef.current
    if (!node) return
    const observer = new ResizeObserver(() => updateMobileOffset())
    observer.observe(node)
    return () => observer.disconnect()
  }, [isMobileLayout, updateMobileOffset])

  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        document.documentElement.style.removeProperty('--mobile-chat-offset')
      }
    }
  }, [])

  const renderTabs = (fontSize: string) => (
    <div
      className='flex items-center gap-6'
      style={{
        fontFamily: CHAT_HEADER_FONT,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        fontSize,
      }}
    >
      {tabs.map((tab, index) => (
        <span
          key={tab}
          style={{
            color: index === 0 ? CHAT_ACCENT_COLOR : 'rgba(205, 212, 230, 0.5)',
            position: 'relative',
            paddingBottom: 4,
          }}
        >
          {tab}
          {index === 0 && (
            <span
              style={{
                position: 'absolute',
                left: '50%',
                bottom: 0,
                transform: 'translateX(-50%)',
                width: '80%',
                height: 1,
                borderRadius: 999,
                background: 'linear-gradient(90deg, transparent, rgba(247,217,140,0.85), transparent)',
              }}
            />
          )}
        </span>
      ))}
    </div>
  )

  const renderChatBody = (variant: 'desktop' | 'mobile') => (
    <>
      <div
        className='flex items-center justify-between'
      >
        <span
          style={{
            fontFamily: CHAT_HEADER_FONT,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontSize: variant === 'mobile' ? (isTouch ? '0.82rem' : '0.88rem') : isTouch ? '0.8rem' : '0.95rem',
            color: CHAT_ACCENT_COLOR,
            textShadow: '0 0 18px rgba(247,217,140,0.35)',
          }}
        >
          Chat
        </span>
        <button
          type='button'
          style={closeButtonStyle}
          className='focus:outline-none transition-transform duration-150 hover:scale-[1.05] active:scale-95'
          onClick={() => {
            setCollapsed(true)
            setActive(false)
          }}
          title='Close chat'
        >
          <span style={{ fontSize: isTouch ? '0.85rem' : '0.95rem', lineHeight: 1 }}>✕</span>
        </button>
      </div>
      <div style={goldLineStyle} />
      {renderTabs(variant === 'mobile' ? (isTouch ? '0.64rem' : '0.7rem') : (isTouch ? '0.64rem' : '0.74rem'))}
      <div style={goldLineStyle} />
      <div
        className='relative rounded-lg overflow-hidden bg-[rgba(16,17,24,0.5)]'
        style={{
          boxShadow: 'inset 0 1px 6px rgba(0,0,0,0.4)',
        }}
      >
        <Messages
          world={world}
          active={active}
          variant={variant}
          style={{
            height: variant === 'mobile' ? 150 : isTouch ? 130 : 170,
          }}
        />
      </div>
      <div className='flex flex-col gap-1.5'>
        <div style={goldLineStyle} />
        {!active ? (
          <button
            type='button'
            style={inactiveInputStyle}
            className='text-left text-[rgba(232,235,244,0.7)] transition-colors duration-150 hover:text-[rgba(247,217,140,0.9)] focus:outline-none'
            onClick={() => {
              setActive(true)
              setCollapsed(false)
            }}
          >
            Type in a message...
          </button>
        ) : (
          <label
            style={inputContainerStyle}
            className='cursor-text focus-within:border-b-[rgba(247,217,140,0.75)]'
            onClick={() => inputRef.current?.focus()}
          >
            <input
              ref={inputRef}
              style={inputStyle}
              className='placeholder:text-slate-300/60 selection:bg-slate-200/20 bg-transparent'
              type='text'
              placeholder='Type in a message...'
              value={msg}
              onChange={e => setMsg(e.target.value)}
              onKeyDown={e => {
                if (e.code === 'Escape') {
                  setActive(false)
                }
                if (e.code === 'Enter' || e.key === 'Enter') {
                  send(e)
                }
              }}
              onBlur={_e => {
                if (!isTouch || variant === 'mobile') {
                  setActive(false)
                }
              }}
            />
          </label>
        )}
      </div>
    </>
  )

  if (isMobileLayout) {
    if (collapsed) {
      return (
        <div
          className={cls('mainchat fixed pointer-events-none z-[90]', { hidden: !chatVisible })}
          style={{
            right: `calc(env(safe-area-inset-right) + 16px)`,
            bottom: `calc(env(safe-area-inset-bottom) + 16px)`,
          }}
          onTouchStart={event => {
            touchStartYRef.current = event.touches[0].clientY
          }}
          onTouchEnd={event => {
            if (touchStartYRef.current === null) return
            const delta = event.changedTouches[0].clientY - touchStartYRef.current
            touchStartYRef.current = null
            if (delta < -40) {
              setCollapsed(false)
              setActive(true)
              updateMobileOffset(false)
            }
          }}
        >
          <button
            type='button'
            style={{
              ...chatButtonStyle,
              padding: '0.55rem 1.05rem',
              borderRadius: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
            }}
            className='pointer-events-auto transition-transform duration-150 hover:scale-[1.04] active:scale-95 focus:outline-none'
            onClick={() => {
              setCollapsed(false)
              setActive(true)
            }}
          >
            <MessageSquareIcon size={18} />
            <span>Chat</span>
          </button>
        </div>
      )
    }

    return (
      <div
        className={cls(
          'mainchat fixed inset-x-0 pointer-events-none z-[960]',
          { hidden: !chatVisible }
        )}
        style={{ bottom: 'env(safe-area-inset-bottom)' }}
        onTouchStart={event => {
          touchStartYRef.current = event.touches[0].clientY
        }}
        onTouchEnd={event => {
          if (touchStartYRef.current === null) return
          const delta = event.changedTouches[0].clientY - touchStartYRef.current
          touchStartYRef.current = null
          if (delta > 40) {
            setCollapsed(true)
            setActive(false)
            updateMobileOffset(true)
          }
        }}
      >
        <div className='pointer-events-auto'>
          <div
            ref={chatPanelRef}
            style={mobilePanelStyle}
            className='mx-auto w-full transition-transform duration-300 ease-out translate-y-0 opacity-95'
          >
            {renderChatBody('mobile')}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cls(
        'mainchat fixed pointer-events-none',
        collapsed ? 'z-[35]' : 'z-[960]',
        { hidden: !chatVisible }
      )}
      style={placementStyle}
    >
      {collapsed ? (
        <button
          type='button'
          style={chatButtonStyle}
          className='transition-transform duration-150 hover:scale-[1.03] active:scale-95 focus:outline-none'
          onClick={() => {
            setCollapsed(false)
            setActive(true)
          }}
        >
          <MessageSquareIcon size={isTouch ? 18 : 22} />
          <span>Chat</span>
        </button>
      ) : (
        <div style={desktopPanelStyle} className='chat-panel'>
          {renderChatBody('desktop')}
        </div>
      )}
    </div>
  )
}

function Messages({
  world,
  active,
  variant,
  className,
  style,
}: {
  world: ChatWorld
  active: boolean
  variant: 'desktop' | 'mobile'
  className?: string
  style?: React.CSSProperties
}) {
  const initRef = useRef<boolean>(false)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const spacerRef = useRef<HTMLDivElement | null>(null)
  const [msgs, setMsgs] = useState<unknown[]>([])

  useEffect(() => {
    const unsubscribe = world.chat.subscribe(setMsgs)
    return () => {
      unsubscribe()
    }
  }, [world])

  useEffect(() => {
    setTimeout(() => {
      const didInit = initRef.current
      initRef.current = true
      contentRef.current?.scroll({
        top: 9_999_999,
        behavior: (didInit ? 'instant' : 'smooth') as ScrollBehavior,
      })
    }, 10)
  }, [msgs])

  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    const observer = new MutationObserver(() => {
      if (spacerRef.current && contentRef.current) {
        spacerRef.current.style.height = contentRef.current.offsetHeight + 'px'
      }
      contentRef.current?.scroll({
        top: 9_999_999,
        behavior: 'instant' as ScrollBehavior,
      })
    })
    observer.observe(content, { childList: true })
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={contentRef}
      className={cls(
        'messages noscrollbar relative transition-all duration-150 ease-out flex flex-col items-stretch overflow-y-auto',
        variant === 'desktop'
          ? 'h-full w-full px-4 py-2.5 gap-1'
          : 'w-full px-3.5 py-2 gap-1.25',
        className
      )}
      style={{
        WebkitMaskImage: 'linear-gradient(to top, black calc(100% - 8rem), black 8rem, transparent)',
        maskImage: 'linear-gradient(to top, black calc(100% - 8rem), black 8rem, transparent)',
        pointerEvents: variant === 'mobile' ? (active ? 'auto' : 'none') : 'auto',
        ...style,
      }}
    >
      <div
        className='pointer-events-none absolute inset-x-0 top-0 h-10'
        style={{ background: 'linear-gradient(180deg, rgba(16,17,24,0.92), rgba(16,17,24,0))' }}
      />
      <div className='messages-spacer shrink-0' ref={spacerRef} />
      {msgs.map((msg) => (
        <Message key={(msg as ChatMessage & { id: string }).id} msg={msg as ChatMessage} />
      ))}
    </div>
  )
}

function Message({ msg }: { msg: ChatMessage }) {
  return (
    <div
      className='message text-[0.85rem] leading-[1.45]'
      style={{
        color: 'rgba(232, 235, 244, 0.92)',
        fontFamily: "'Inter', system-ui, sans-serif",
        textShadow: '0 1px 2px rgba(0,0,0,0.75)',
      }}
    >
      {msg.from && (
        <span
          className='message-from mr-2 uppercase tracking-[0.18em]'
          style={{
            fontFamily: CHAT_HEADER_FONT,
            color: CHAT_ACCENT_COLOR,
            fontSize: '0.7rem',
            letterSpacing: '0.2em',
          }}
        >
          [{msg.from}]
        </span>
      )}
      <span className='message-body'>{msg.body}</span>
    </div>
  )
}

function MiniMessages({ world }: { world: ChatWorld }) {
  const [msg, setMsg] = useState<ChatMessage | null>(null)

  useEffect(() => {
    let init = false
    return world.chat.subscribe((msgs: unknown[]) => {
      if (!init) {
        init = true
        return
      }
      const latest = msgs[msgs.length - 1] as ChatMessage
      if (latest.fromId === world.network.id) return
      setMsg(latest)
    })
  }, [world])

  if (!msg) {
    return (
      <div
        className='text-xs italic text-center'
        style={{ color: 'rgba(244, 239, 230, 0.55)' }}
      >
        Tap to open chat
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-1'>
      <div
        className='text-[0.7rem] uppercase tracking-[0.18em]'
        style={{ fontFamily: CHAT_HEADER_FONT, color: CHAT_ACCENT_COLOR }}
      >
        New message
      </div>
      <Message msg={msg} />
    </div>
  )
}
