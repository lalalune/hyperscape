import { MessageSquareIcon } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

import { ControlPriorities, EventType, isTouch, World } from '@hyperscape/shared'
import { cls } from './cls'

// Local type definitions to avoid import issues
interface ChatMessage {
  id: string
  from: string
  fromId?: string
  body: string
  createdAt: string
  timestamp?: number
}

interface ControlBinding {
  slash?: { onPress?: () => void }
  enter?: { onPress?: () => void }
  mouseLeft?: { onPress?: () => void }
  pointer?: { locked?: boolean }
  release?: () => void
}

// Extended World type with client-specific properties
type ExtendedWorld = InstanceType<typeof World> & {
  on: <T extends string | symbol>(event: T, fn: (...args: unknown[]) => void, context?: unknown) => ExtendedWorld
  off: <T extends string | symbol>(event: T, fn?: (...args: unknown[]) => void, context?: unknown, once?: boolean) => ExtendedWorld
  prefs?: {
    chatVisible?: boolean
    on?: (event: string, callback: (changes: { chatVisible?: { value: boolean } }) => void) => void
    off?: (event: string, callback: (changes: { chatVisible?: { value: boolean } }) => void) => void
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

export function Chat({ world }: { world: ExtendedWorld }) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [msg, setMsg] = useState('')
  const [active, setActive] = useState(false)
  const [collapsed, setCollapsed] = useState(true)
  const [chatVisible, setChatVisible] = useState(() => world.prefs?.chatVisible ?? true)
  
  useEffect(() => {
  }, []);
  
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
  }, [active])
  
  useEffect(() => {
    const onPrefsChange = (changes: { chatVisible?: { value: boolean } }) => {
      if (changes.chatVisible !== undefined) {
        setChatVisible(changes.chatVisible.value)
      }
    }
    if (world.prefs?.on) {
      world.prefs.on('change', onPrefsChange)
    }
    return () => {
      if (world.prefs?.off) {
        world.prefs.off('change', onPrefsChange)
      }
    }
  }, [])
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
    return () => {
      if (control?.release) {
        control.release()
      }
    }
  }, [active])
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
    // check for commands
    if (msg.startsWith('/')) {
      world.chat.command(msg)
      return
    }
    // otherwise post it
    world.chat.send(msg)
    if (isTouch) {
      // setActive(false)
      if (e.target && e.target instanceof HTMLElement) {
        e.target.blur()
      }
      setTimeout(() => setActive(false), 10)
    }
  }
  
  return (
    <div
      className={cls('mainchat fixed text-base pointer-events-auto', { active, collapsed, hidden: !chatVisible })}
      style={{
        left: 'env(safe-area-inset-left)',
        bottom: 'env(safe-area-inset-bottom)',
        right: 'env(safe-area-inset-right)',
      }}
    >
      <div
        className='pointer-events-auto h-10 md:h-10 flex items-center justify-between px-4 bg-[rgba(11,10,21,0.9)] backdrop-blur-[5px] cursor-pointer select-none text-white'
        onClick={() => setCollapsed(prev => !prev)}
        title={collapsed ? 'Open chat' : 'Collapse chat'}
      >
        <div className="flex items-center gap-2">
          <MessageSquareIcon size={16} />
          <span>Chat</span>
        </div>
        <div className="opacity-80 text-[0.85rem]">{collapsed ? '▾' : '▴'}</div>
      </div>
      <div className={cls('p-4 bg-[rgba(11,10,21,0.85)] text-white', { hidden: collapsed })}>
        {isTouch && (!active || collapsed) && <MiniMessages world={world} />}
        {(isTouch && active && !collapsed) && <Messages world={world} active={active} />}
        {(!isTouch && !collapsed) && <Messages world={world} active={active} />}
      </div>
      {!active && !collapsed && (
        <div
          className='h-11 md:h-13 px-4 bg-[rgba(11,10,21,0.85)] backdrop-blur-[5px] flex items-center cursor-text'
          onClick={() => {
            setActive(true)
            setCollapsed(false)
          }}
        >
          <input
            readOnly
            value={''}
            placeholder={'Press Enter to chat'}
            className="w-full text-[1.05rem] md:text-[0.95rem] leading-none text-white outline-none bg-transparent border-none"
            onFocus={() => {
              setActive(true)
              setCollapsed(false)
            }}
          />
        </div>
      )}
      <label 
        className={cls('h-11 md:h-13 px-4 bg-[rgba(11,10,21,0.85)] backdrop-blur-[5px] items-center cursor-text', { 'flex': active && !collapsed, 'hidden': !active || collapsed })}
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          className='w-full text-[1.05rem] md:text-[0.95rem] leading-none text-white outline-none bg-transparent border-none focus:outline-none'
          type='text'
          placeholder='Say something...'
          value={msg}
          onChange={e => setMsg(e.target.value)}
          onKeyDown={e => {
            if (e.code === 'Escape') {
              setActive(false)
            }
            // meta quest 3 isn't spec complaint and instead has e.code = '' and e.key = 'Enter'
            // spec says e.code should be a key code and e.key should be the text output of the key eg 'b', 'B', and '\n'
            if (e.code === 'Enter' || e.key === 'Enter') {
              send(e)
            }
          }}
          onBlur={_e => {
            if (!isTouch) {
              setActive(false)
            }
          }}
        />
      </label>
    </div>
  )
}


function MiniMessages({ world }: { world: ExtendedWorld }) {
  const [msg, setMsg] = useState<ChatMessage | null>(null)
  useEffect(() => {
    let init: boolean
    return world.chat.subscribe((msgs: unknown[]) => {
      if (!init) {
        init = true
        return // skip first
      }
      const msg = msgs[msgs.length - 1] as ChatMessage
      if (msg.fromId === world.network.id) return
      setMsg(msg)
    })
  }, [])
  if (!msg) return null
  return (
    <div className='minimessages'>
      <Message msg={msg} />
    </div>
  )
}

function Messages({ world, active }: { world: ExtendedWorld; active: boolean }) {
  const initRef = useRef<boolean>(false)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const spacerRef = useRef<HTMLDivElement | null>(null)
  const [msgs, setMsgs] = useState<unknown[]>([])
  useEffect(() => {
    const unsubscribe = world.chat.subscribe(setMsgs);
    return () => {
      unsubscribe();
    };
  }, [])
  useEffect(() => {
    setTimeout(() => {
      const didInit = initRef.current
      initRef.current = true
      contentRef.current?.scroll({
        top: 9999999,
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
        top: 9999999,
        behavior: 'instant' as ScrollBehavior,
      })
    })
    observer.observe(content, { childList: true })
    return () => {
      observer.disconnect()
    }
  }, [])
  return (
    <div
      ref={contentRef}
      className={cls('messages noscrollbar flex-1 max-h-64 transition-all duration-150 ease-out flex flex-col items-stretch overflow-y-auto', { active })}
      style={{
        WebkitMaskImage: 'linear-gradient(to top, black calc(100% - 10rem), black 10rem, transparent)',
        maskImage: 'linear-gradient(to top, black calc(100% - 10rem), black 10rem, transparent)',
        pointerEvents: active ? 'auto' : 'none',
      }}
    >
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
      className='message py-2 leading-relaxed text-base text-white'
      style={{
        paintOrder: 'stroke fill',
        WebkitTextStroke: '0.25rem rgba(0, 0, 0, 0.2)',
      }}
    >
      {msg.from && <span className='message-from mr-1'>[{msg.from}]</span>}
      <span className='message-body'>{msg.body}</span>
    </div>
  )
}

