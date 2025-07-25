import React, { useState, useEffect, useRef } from 'react'
import styled from 'styled-components'
import type { 
  RPGChatMessageEvent,
  RPGChatSystemEvent,
  RPGChatCombatEvent,
  RPGChatSendEvent
} from '../../types/rpg-events'

interface ChatMessage {
  id: string
  playerId: string
  playerName: string
  message: string
  type: 'public' | 'system' | 'combat' | 'trade' | 'error'
  timestamp: number
}

const ChatContainer = styled.div<{ isExpanded: boolean }>`
  position: fixed;
  bottom: 20px;
  left: 20px;
  width: ${props => props.isExpanded ? '400px' : '300px'};
  height: ${props => props.isExpanded ? '300px' : '150px'};
  background: rgba(0, 0, 0, 0.85);
  border: 2px solid #444;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  color: white;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  transition: all 0.3s ease;
`

const ChatHeader = styled.div`
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.1);
  border-bottom: 1px solid #555;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
`

const ChatMessages = styled.div<{ isExpanded: boolean }>`
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  max-height: ${props => props.isExpanded ? '220px' : '100px'};
  
  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.5);
  }
`

const ChatMessageComponent = styled.div<{ messageType: ChatMessage['type'] }>`
  margin: 2px 0;
  padding: 2px 0;
  line-height: 1.4;
  color: ${props => {
    switch (props.messageType) {
      case 'system': return '#ffeb3b'
      case 'combat': return '#f44336'
      case 'trade': return '#4caf50'
      case 'error': return '#ff5722'
      default: return '#ffffff'
    }
  }};
  
  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }
`

const PlayerName = styled.span`
  font-weight: bold;
  color: #2196f3;
`

const Timestamp = styled.span`
  color: #666;
  font-size: 10px;
  margin-right: 4px;
`

const ChatInput = styled.div`
  padding: 8px;
  border-top: 1px solid #555;
  display: flex;
  gap: 8px;
`

const MessageInput = styled.input`
  flex: 1;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid #666;
  border-radius: 4px;
  padding: 6px 8px;
  color: white;
  font-size: 12px;
  font-family: inherit;
  
  &:focus {
    outline: none;
    border-color: #2196f3;
    background: rgba(255, 255, 255, 0.15);
  }
  
  &::placeholder {
    color: #888;
  }
`

const SendButton = styled.button`
  background: #2196f3;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  padding: 6px 12px;
  font-size: 12px;
  
  &:hover {
    background: #1976d2;
  }
  
  &:disabled {
    background: #666;
    cursor: not-allowed;
  }
`

const ToggleButton = styled.button`
  background: none;
  border: 1px solid #666;
  color: #ccc;
  cursor: pointer;
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 10px;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`

const ChatTabs = styled.div`
  display: flex;
  gap: 2px;
  margin-right: 8px;
`

const ChatTab = styled.button<{ active: boolean }>`
  background: ${props => props.active ? 'rgba(33, 150, 243, 0.3)' : 'transparent'};
  border: 1px solid ${props => props.active ? '#2196f3' : '#666'};
  color: ${props => props.active ? '#2196f3' : '#ccc'};
  cursor: pointer;
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 10px;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`

export const RPGChatUI: React.FC<{ 
  playerId: string
}> = ({ playerId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'public' | 'system' | 'combat'>('all')
  const [isInputFocused, setIsInputFocused] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Listen for chat messages
    const handleChatMessage = (event: RPGChatMessageEvent) => {
      const { playerId: senderId, playerName, message, type = 'public' } = event.detail
      
      const newMessage: ChatMessage = {
        id: `${Date.now()}_${Math.random()}`,
        playerId: senderId,
        playerName: playerName || `Player ${senderId.substring(0, 8)}`,
        message,
        type,
        timestamp: Date.now()
      }
      
      setMessages(prev => [...prev.slice(-99), newMessage]) // Keep last 100 messages
    }

    // Listen for system messages
    const handleSystemMessage = (event: RPGChatSystemEvent) => {
      const { message, type = 'system' } = event.detail
      
      const newMessage: ChatMessage = {
        id: `${Date.now()}_${Math.random()}`,
        playerId: 'system',
        playerName: 'System',
        message,
        type,
        timestamp: Date.now()
      }
      
      setMessages(prev => [...prev.slice(-99), newMessage])
    }

    // Listen for combat messages
    const handleCombatMessage = (event: RPGChatCombatEvent) => {
      const { message } = event.detail
      
      const newMessage: ChatMessage = {
        id: `${Date.now()}_${Math.random()}`,
        playerId: 'combat',
        playerName: 'Combat',
        message,
        type: 'combat',
        timestamp: Date.now()
      }
      
      setMessages(prev => [...prev.slice(-99), newMessage])
    }

    window.addEventListener('rpg:chat:message', handleChatMessage)
    window.addEventListener('rpg:chat:system', handleSystemMessage)
    window.addEventListener('rpg:chat:combat', handleCombatMessage)

    return () => {
      window.removeEventListener('rpg:chat:message', handleChatMessage)
      window.removeEventListener('rpg:chat:system', handleSystemMessage)
      window.removeEventListener('rpg:chat:combat', handleCombatMessage)
    }
  }, [])

  // Handle global chat key (Enter)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !isInputFocused) {
        event.preventDefault()
        setIsExpanded(true)
        setTimeout(() => inputRef.current?.focus(), 100)
      } else if (event.key === 'Escape' && isInputFocused) {
        inputRef.current?.blur()
        setIsExpanded(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isInputFocused])

  const sendMessage = () => {
    if (!inputValue.trim()) return
    
    window.dispatchEvent(new CustomEvent('rpg:chat:send', {
      detail: { 
        playerId, 
        message: inputValue.trim(),
        type: 'public'
      }
    }) as RPGChatSendEvent)
    
    setInputValue('')
    inputRef.current?.focus()
  }

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      sendMessage()
    }
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour12: false, timeStyle: 'short' })
  }

  const filteredMessages = messages.filter(msg => {
    if (activeTab === 'all') return true
    return msg.type === activeTab
  })

  return (
    <ChatContainer isExpanded={isExpanded}>
      <ChatHeader onClick={() => setIsExpanded(!isExpanded)}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ChatTabs>
            <ChatTab 
              active={activeTab === 'all'} 
              onClick={(e) => { e.stopPropagation(); setActiveTab('all') }}
            >
              All
            </ChatTab>
            <ChatTab 
              active={activeTab === 'public'} 
              onClick={(e) => { e.stopPropagation(); setActiveTab('public') }}
            >
              Public
            </ChatTab>
            <ChatTab 
              active={activeTab === 'system'} 
              onClick={(e) => { e.stopPropagation(); setActiveTab('system') }}
            >
              System
            </ChatTab>
            <ChatTab 
              active={activeTab === 'combat'} 
              onClick={(e) => { e.stopPropagation(); setActiveTab('combat') }}
            >
              Combat
            </ChatTab>
          </ChatTabs>
          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Chat</span>
        </div>
        
        <ToggleButton>
          {isExpanded ? '▼' : '▲'}
        </ToggleButton>
      </ChatHeader>

      <ChatMessages isExpanded={isExpanded}>
        {filteredMessages.map((msg) => (
          <ChatMessageComponent key={msg.id} messageType={msg.type}>
            <Timestamp>{formatTime(msg.timestamp)}</Timestamp>
            {msg.type === 'public' && (
              <PlayerName>{msg.playerName}: </PlayerName>
            )}
            {msg.type !== 'public' && (
              <PlayerName>[{msg.playerName}] </PlayerName>
            )}
            <span>{msg.message}</span>
          </ChatMessageComponent>
        ))}
        <div ref={messagesEndRef} />
      </ChatMessages>

      {isExpanded && (
        <ChatInput>
          <MessageInput
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            placeholder="Type a message... (Enter to send)"
            maxLength={200}
          />
          <SendButton 
            onClick={sendMessage}
            disabled={!inputValue.trim()}
          >
            Send
          </SendButton>
        </ChatInput>
      )}

      {!isExpanded && (
        <div style={{ 
          padding: '4px 8px', 
          fontSize: '10px', 
          color: '#888',
          textAlign: 'center'
        }}>
          Press Enter to chat • Click to expand
        </div>
      )}
    </ChatContainer>
  )
}