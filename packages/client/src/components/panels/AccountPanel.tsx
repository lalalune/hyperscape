/**
 * Account Management Panel
 * Shows login status, user info, and account controls
 */

import React, { useEffect, useState } from 'react'
import type { World } from '@hyperscape/shared'
import { privyAuthManager } from '../../PrivyAuthManager'

interface AccountPanelProps {
  world: World
}

export function AccountPanel({ world }: AccountPanelProps) {
  const [authState, setAuthState] = useState(privyAuthManager.getState())
  const [playerName, setPlayerName] = useState('')
  const [isEditingName, setIsEditingName] = useState(false)
  const [tempName, setTempName] = useState('')

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = privyAuthManager.subscribe(setAuthState)
    return unsubscribe
  }, [])

  // Get player name from world
  useEffect(() => {
    const player = world.entities?.player
    if (player?.name) {
      setPlayerName(player.name)
      setTempName(player.name)
    }
  }, [world])

  const handleLogout = async () => {
    // Use global Privy logout
    const windowWithLogout = window as typeof window & { privyLogout: () => void }
    await windowWithLogout.privyLogout()
    
    // Clear auth state
    privyAuthManager.clearAuth()
    
    // Reload page after logout
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }

  const handleNameChange = () => {
    if (tempName && tempName !== playerName) {
      const player = world.entities?.player
      if (player) {
        player.name = tempName
        setPlayerName(tempName)
        setIsEditingName(false)
        
        // Send name update to server
        world.network?.send('chat', {
          type: 'system',
          message: `Changed name to ${tempName}`
        })
      }
    } else {
      setIsEditingName(false)
      setTempName(playerName)
    }
  }

  // Get user info from authState (works with or without Privy)
  const authenticated = authState.isAuthenticated
  const userId = authState.privyUserId
  const walletAddress = (authState.user as { wallet?: { address?: string } })?.wallet?.address
  const farcasterFid = authState.farcasterFid
  const email = (authState.user as { email?: { address?: string } })?.email?.address

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Authentication Status */}
      <div
        className="bg-black/35 border rounded-md p-3"
        style={{ borderColor: 'rgba(242, 208, 138, 0.3)' }}
      >
        <div className="font-semibold mb-2 text-sm" style={{ color: '#f2d08a' }}>Account Status</div>
        <div className="flex items-center justify-between text-sm">
          <span style={{ color: 'rgba(242, 208, 138, 0.7)' }}>Status:</span>
          <span className={authenticated ? 'text-green-400' : 'text-gray-500'}>
            {authenticated ? '✅ Logged In' : '❌ Anonymous'}
          </span>
        </div>
      </div>

      {/* User Info */}
      {authenticated && userId && (
        <div
          className="bg-black/35 border rounded-md p-3"
          style={{ borderColor: 'rgba(242, 208, 138, 0.3)' }}
        >
          <div className="font-semibold mb-2 text-sm" style={{ color: '#f2d08a' }}>Account Info</div>

          {/* Privy User ID */}
          <div className="mb-2 text-xs">
            <div className="mb-1" style={{ color: 'rgba(242, 208, 138, 0.7)' }}>User ID:</div>
            <div className="font-mono break-all" style={{ color: 'rgba(242, 208, 138, 0.9)' }}>
              {userId.substring(0, 20)}...
            </div>
          </div>

          {/* Wallet Address */}
          {walletAddress && (
            <div className="mb-2 text-xs">
              <div className="mb-1" style={{ color: 'rgba(242, 208, 138, 0.7)' }}>Wallet:</div>
              <div className="font-mono" style={{ color: 'rgba(242, 208, 138, 0.9)' }}>
                {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
              </div>
            </div>
          )}

          {/* Email */}
          {email && (
            <div className="mb-2 text-xs">
              <div className="mb-1" style={{ color: 'rgba(242, 208, 138, 0.7)' }}>Email:</div>
              <div style={{ color: 'rgba(242, 208, 138, 0.9)' }}>{email}</div>
            </div>
          )}

          {/* Farcaster FID */}
          {farcasterFid && (
            <div className="mb-2 text-xs">
              <div className="mb-1" style={{ color: 'rgba(242, 208, 138, 0.7)' }}>Farcaster FID:</div>
              <div className="flex items-center gap-1" style={{ color: 'rgba(242, 208, 138, 0.9)' }}>
                🎭 {farcasterFid}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Character Name */}
      <div
        className="bg-black/35 border rounded-md p-3"
        style={{ borderColor: 'rgba(242, 208, 138, 0.3)' }}
      >
        <div className="font-semibold mb-2 text-sm" style={{ color: '#f2d08a' }}>Character Name</div>

        {!isEditingName ? (
          <div className="flex items-center justify-between">
            <span style={{ color: 'rgba(242, 208, 138, 0.9)' }}>{playerName || 'Unknown'}</span>
            <button
              onClick={() => setIsEditingName(true)}
              className="text-xs rounded px-2 py-1 cursor-pointer"
              style={{
                backgroundColor: 'rgba(242, 208, 138, 0.15)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'rgba(242, 208, 138, 0.5)',
                color: '#f2d08a',
              }}
            >
              Edit
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              className="w-full text-sm py-1.5 px-2 bg-white/5 border rounded"
              style={{
                borderColor: 'rgba(242, 208, 138, 0.3)',
                color: '#f2d08a',
              }}
              placeholder="Enter name..."
              maxLength={20}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameChange()
                if (e.key === 'Escape') {
                  setIsEditingName(false)
                  setTempName(playerName)
                }
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleNameChange}
                className="flex-1 text-xs rounded px-2 py-1.5 cursor-pointer"
                style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.25)',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'rgba(34, 197, 94, 0.5)',
                  color: '#22c55e',
                }}
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditingName(false)
                  setTempName(playerName)
                }}
                className="flex-1 text-xs rounded px-2 py-1.5 cursor-pointer"
                style={{
                  backgroundColor: 'rgba(107, 114, 128, 0.25)',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'rgba(107, 114, 128, 0.5)',
                  color: '#9ca3af',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Login Status & Actions */}
      {!authenticated && (
        <div
          className="bg-black/35 border rounded-md p-3"
          style={{ borderColor: 'rgba(242, 208, 138, 0.3)' }}
        >
          <div className="text-sm mb-2" style={{ color: 'rgba(242, 208, 138, 0.7)' }}>
            You're playing as an anonymous user. Your progress won't sync across devices.
          </div>
          <div className="text-xs" style={{ color: 'rgba(242, 208, 138, 0.5)' }}>
            To enable account features, configure Privy authentication in your .env file.
          </div>
        </div>
      )}

      {/* Logout Button */}
      {authenticated && (
        <button
          onClick={handleLogout}
          className="rounded-md py-2 px-3 cursor-pointer text-sm font-medium"
          style={{
            backgroundColor: 'rgba(139, 69, 19, 0.4)',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'rgba(139, 69, 19, 0.6)',
            color: '#f2d08a',
          }}
        >
          Logout
        </button>
      )}

      {/* Account Features */}
      <div
        className="flex-1 bg-black/35 border rounded-md p-3 overflow-y-auto"
        style={{ borderColor: 'rgba(242, 208, 138, 0.3)' }}
      >
        <div className="font-semibold mb-2 text-sm" style={{ color: '#f2d08a' }}>Account Features</div>
        <div className="text-xs space-y-2" style={{ color: 'rgba(242, 208, 138, 0.7)' }}>
          <div className="flex items-start gap-2">
            <span className={authenticated ? 'text-green-400' : 'text-gray-600'}>
              {authenticated ? '✅' : '⭕'}
            </span>
            <span>Cross-device progress sync</span>
          </div>
          <div className="flex items-start gap-2">
            <span className={authenticated ? 'text-green-400' : 'text-gray-600'}>
              {authenticated ? '✅' : '⭕'}
            </span>
            <span>Persistent character data</span>
          </div>
          <div className="flex items-start gap-2">
            <span className={authenticated ? 'text-green-400' : 'text-gray-600'}>
              {authenticated ? '✅' : '⭕'}
            </span>
            <span>Secure account recovery</span>
          </div>
          <div className="flex items-start gap-2">
            <span className={farcasterFid ? 'text-green-400' : 'text-gray-600'}>
              {farcasterFid ? '✅' : '⭕'}
            </span>
            <span>Farcaster integration</span>
          </div>
        </div>
      </div>
    </div>
  )
}

