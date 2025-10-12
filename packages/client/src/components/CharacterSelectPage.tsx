import { readPacket, writePacket } from '@hyperscape/shared';
import React from 'react';

type Character = { id: string; name: string }

export function CharacterSelectPage({
  wsUrl,
  onPlay,
  onLogout,
}: {
  wsUrl: string
  onPlay: (selectedCharacterId: string | null) => void
  onLogout: () => void
}) {
  const [characters, setCharacters] = React.useState<Character[]>([])
  const [selectedCharacterId, setSelectedCharacterId] = React.useState<string | null>(null)
  const [newCharacterName, setNewCharacterName] = React.useState('')
  const [wsReady, setWsReady] = React.useState(false)
  const [view, setView] = React.useState<'select' | 'confirm'>('select')
  const [showCreate, setShowCreate] = React.useState(false)
  const preWsRef = React.useRef<WebSocket | null>(null)
  const pendingActionRef = React.useRef<null | { type: 'create'; name: string }>(null)
  const [authDeps, setAuthDeps] = React.useState<{ token: string; privyUserId: string }>({
    token: (typeof localStorage !== 'undefined' ? localStorage.getItem('privy_auth_token') || '' : ''),
    privyUserId: (typeof localStorage !== 'undefined' ? localStorage.getItem('privy_user_id') || '' : ''),
  })

  // Watch for Privy auth being written to localStorage before opening WS
  React.useEffect(() => {
    const onStorage = (e: Event) => {
      const storageEvent = e as { key?: string | null }
      if (!storageEvent.key) return
      if (storageEvent.key === 'privy_auth_token' || storageEvent.key === 'privy_user_id') {
        const token = localStorage.getItem('privy_auth_token') || ''
        const privyUserId = localStorage.getItem('privy_user_id') || ''
        setAuthDeps({ token, privyUserId })
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Fallback polling: in the same tab, StorageEvent does not fire. Poll until Privy fills values
  React.useEffect(() => {
    if (authDeps.token && authDeps.privyUserId) return
    let attempts = 0
    const id = window.setInterval(() => {
      const token = localStorage.getItem('privy_auth_token') || ''
      const privyUserId = localStorage.getItem('privy_user_id') || ''
      if (token && privyUserId) {
        setAuthDeps({ token, privyUserId })
        window.clearInterval(id)
      } else if (++attempts > 50) {
        window.clearInterval(id)
      }
    }, 200)
    return () => window.clearInterval(id)
  }, [authDeps.token, authDeps.privyUserId])

  React.useEffect(() => {
    // Wait until Privy auth values are present
    const token = authDeps.token
    const privyUserId = authDeps.privyUserId
    if (!token || !privyUserId) {
      try { console.log('[CharacterSelect] Waiting for Privy auth…', { hasToken: !!token, hasPrivyUserId: !!privyUserId }) } catch {}
      setWsReady(false)
      return
    }
    let url = `${wsUrl}?authToken=${encodeURIComponent(token)}`
    if (privyUserId) url += `&privyUserId=${encodeURIComponent(privyUserId)}`
    try { console.log('[CharacterSelect] Opening pre-world WS:', url) } catch {}
    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'
    preWsRef.current = ws
    setWsReady(false)
    ws.addEventListener('open', () => {
      setWsReady(true)
      try { console.log('[CharacterSelect] WS open; requesting character list') } catch {}
      // Request character list from server
      try {
        const packet = writePacket('characterListRequest', {})
        console.log('[CharacterSelect] Sending characterListRequest packet, size:', packet.byteLength)
        ws.send(packet)
        console.log('[CharacterSelect] characterListRequest sent successfully')
      } catch (err) {
        console.error('[CharacterSelect] Failed to request character list:', err)
      }
      // Flush any pending create
      const pending = pendingActionRef.current
      if (pending && pending.type === 'create') {
        try { ws.send(writePacket('characterCreate', { name: pending.name })) } catch {}
        pendingActionRef.current = null
      }
    })
    ws.addEventListener('message', (e) => {
      try {
        const result = readPacket(e.data)
        if (!result) return
        const [method, data] = result as [string, unknown]
        try { console.log('[CharacterSelect] WS message:', method, data) } catch {}
        if (method === 'onSnapshot') {
          // Extract characters from snapshot
          const snap = data as { characters?: Character[] }
          if (snap.characters && Array.isArray(snap.characters)) {
            try { console.log('[CharacterSelect] Characters in snapshot:', snap.characters.length) } catch {}
            setCharacters(snap.characters)
          }
        } else if (method === 'onCharacterList') {
          const list = ((data?.characters as Character[]) || [])
          try { console.log('[CharacterSelect] onCharacterList received:', list.length) } catch {}
          setCharacters(list)
        } else if (method === 'onCharacterCreated') {
          const c = data as Character
          try { console.log('[CharacterSelect] onCharacterCreated:', c) } catch {}
          setCharacters(prev => [...prev, c])
          // Immediately select newly created character and go to confirm view
          setSelectedCharacterId(c.id)
          setView('confirm')
          try {
            const ws = preWsRef.current
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(writePacket('characterSelected', { characterId: c.id }))
            }
          } catch {}
        } else if (method === 'onCharacterSelected') {
          const payload = data as { characterId: string | null }
          try { console.log('[CharacterSelect] onCharacterSelected:', payload) } catch {}
          setSelectedCharacterId(payload.characterId || null)
          if (payload.characterId) setView('confirm')
        } else if (method === 'onEntityEvent') {
          // Fallback: some servers broadcast list via world event
          const evt = data as { id?: string; version?: number; name?: string; data?: unknown }
          if (evt?.name === 'character:list') {
            const list = (evt.data as { characters?: Character[] })?.characters || []
            try { console.log('[CharacterSelect] onEntityEvent character:list:', list.length) } catch {}
            setCharacters(list)
          }
        }
      } catch {}
    })
    return () => {
      try { ws.close() } catch {}
      if (preWsRef.current === ws) preWsRef.current = null
    }
  }, [wsUrl, authDeps.token, authDeps.privyUserId])

  const selectCharacter = React.useCallback((id: string) => {
    try { console.log('[CharacterSelect] selecting character:', id) } catch {}
    setSelectedCharacterId(id)
    setView('confirm')
    const ws = preWsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(writePacket('characterSelected', { characterId: id }))
  }, [])

  const createCharacter = React.useCallback(() => {
    const name = newCharacterName.trim().slice(0, 20)
    if (!name || name.length < 3) {
      console.warn('[CharacterSelect] Name must be 3-20 characters')
      return
    }
    const ws = preWsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('[CharacterSelect] WebSocket not ready, queueing create request')
      pendingActionRef.current = { type: 'create', name }
      return
    }
    try {
      console.log('[CharacterSelect] Sending characterCreate:', name)
      ws.send(writePacket('characterCreate', { name }))
      setNewCharacterName('')
      setShowCreate(false)
    } catch (err) {
      console.error('[CharacterSelect] Failed to create character:', err)
    }
  }, [newCharacterName])

  const enterWorld = React.useCallback(() => {
    try { console.log('[CharacterSelect] Enter world with selected:', selectedCharacterId) } catch {}
    onPlay(selectedCharacterId)
  }, [selectedCharacterId, onPlay])

  const GoldRule = ({ className = '', thick = false }: { className?: string; thick?: boolean }) => (
    <div className={`${thick ? 'h-[2px]' : 'h-px'} w-full bg-gradient-to-r from-transparent via-yellow-400 to-transparent ${className}`} />
  )

  return (
    <div className='absolute inset-0 overflow-hidden'>
      <div className='absolute inset-0' style={{ backgroundImage: "url('/stock_background.png')", backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <div className='absolute inset-0 bg-black/80' />
      <div className='absolute inset-0 flex items-center justify-center text-white'>
        <div className='w-full max-w-2xl mx-auto p-6'>
          <div className='relative'>
            <div className='mx-auto mt-0 mb-8 w-full max-w-2xl flex items-center justify-center'>
              <img src='/hyperscape_wordmark.png' alt='Hyperscape' className='h-28 md:h-36 object-contain' />
            </div>
          </div>

        {view === 'select' && (
          <div className='mt-8'>
            <div className='space-y-3'>
              {characters.map(c => (
                <div
                  key={c.id}
                  className='relative w-full overflow-hidden h-24'
                >
                  <div className='flex items-center justify-between h-full p-4 pr-5'>
                    <img src='/stock_character.png' alt='' className='w-24 h-24 rounded-sm object-cover' />
                    <div className='text-yellow-400 text-2xl'>›</div>
                  </div>
                  {/* Gold lines and centered name that extend across the middle. Clickable area is only between the lines. */}
                  <div className='absolute' style={{ left: '112px', right: '16px', top: '50%', transform: 'translateY(-50%)' }}>
                    <GoldRule thick className='pointer-events-none' />
                    <button
                      onClick={() => selectCharacter(c.id)}
                      className='w-full px-4 py-2 text-center bg-black/40 hover:bg-black/50 focus:outline-none focus:ring-1 ring-yellow-400/60 rounded-sm'
                    >
                      <span className='font-semibold text-yellow-300 text-xl'>{c.name}</span>
                    </button>
                    <GoldRule thick className='pointer-events-none' />
                  </div>
                </div>
              ))}
              {characters.length === 0 && (
                <div className='text-sm opacity-70'>No characters yet.</div>
              )}
              {!showCreate && (
                <div className='relative w-full overflow-hidden h-24'>
                  <div className='flex items-center h-full p-4 pr-5'>
                    <img src='/stock_character.png' alt='' className='w-24 h-24 rounded-sm object-cover ml-auto' />
                  </div>
                  <div className='absolute' style={{ left: '16px', right: '112px', top: '50%', transform: 'translateY(-50%)' }}>
                    <GoldRule thick className='pointer-events-none' />
                    <button
                      onClick={() => setShowCreate(true)}
                      className='w-full px-4 py-2 text-left bg-black/40 hover:bg-black/50 focus:outline-none focus:ring-1 ring-yellow-400/60 rounded-sm'
                    >
                      <span className='font-semibold text-xl'>Create New</span>
                    </button>
                    <GoldRule thick className='pointer-events-none' />
                  </div>
                </div>
              )}
              {showCreate && (
                <form
                  className='w-full rounded bg-white/5'
                  onSubmit={(e) => { e.preventDefault(); createCharacter() }}
                >
                  <GoldRule thick />
                  <div className='flex items-center gap-4 p-4 h-20'>
                    <div className='flex-1'>
                      <input
                        className='w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-white outline-none'
                        placeholder='Name (3–20 chars)'
                        value={newCharacterName}
                        onChange={(e)=>setNewCharacterName(e.target.value)}
                        maxLength={20}
                      />
                    </div>
                    <img src='/stock_character.png' alt='' className='w-16 h-16 rounded-sm object-cover' />
                    
                    <button
                      type='submit'
                      className={`ml-2 px-4 py-2 rounded ${wsReady && newCharacterName.trim().length>=3 ? 'bg-emerald-600' : 'bg-white/20 cursor-not-allowed'}`}
                      disabled={!wsReady || newCharacterName.trim().length<3}
                    >Create</button>
                  </div>
                  <GoldRule thick />
                </form>
              )}
            </div>
            {!wsReady && <div className='text-xs opacity-60 mt-3'>Connecting…</div>}
            <div className='mt-10 flex justify-center'>
              <button
                className='w-full max-w-sm px-6 py-3 rounded text-white text-lg bg-white/10 hover:bg-white/15 border border-white/20'
                onClick={onLogout}
              >
                Sign out
              </button>
            </div>
          </div>
        )}

        {view === 'confirm' && (
          <div className='mt-6'>
            <div className='rounded bg-white/5 overflow-hidden'>
              <div className='relative'>
                <div className='w-full overflow-hidden' style={{height: '68vh'}}> 
                  <img src='/stock_character.png' alt='' className='w-full h-full object-cover' />
                </div>
                <div className='absolute inset-x-0 bottom-0'>
                  <GoldRule />
                  <div className='flex items-center justify-between px-5 py-3 bg-black/50 backdrop-blur'>
                    <div className='font-semibold text-xl text-yellow-300'>
                      {characters.find(c => c.id === selectedCharacterId)?.name || 'Unnamed'}
                    </div>
                    <div className='flex items-center gap-2'>
                      <div className='text-yellow-400 text-xl'>✓</div>
                    </div>
                  </div>
                  <GoldRule />
                </div>
              </div>
            </div>
            <div className='mt-6'>
              <GoldRule thick className='mb-4' />
              <button
                className={`w-full px-4 py-3 rounded text-black font-semibold ${selectedCharacterId? 'bg-yellow-300 hover:bg-yellow-200':'bg-white/20 text-white cursor-not-allowed'}`}
                disabled={!selectedCharacterId}
                onClick={enterWorld}
              >
                Enter World
              </button>
              <GoldRule thick className='mt-4' />
              <div className='mt-3 flex justify-center'>
                <button className='text-xs px-3 py-1 bg-white/10 rounded' onClick={() => setView('select')}>Back to Select</button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}


