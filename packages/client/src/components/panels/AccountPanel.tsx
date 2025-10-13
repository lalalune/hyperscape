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
      <div className="bg-black/35 border border-white/[0.08] rounded-md p-3">
        <div className="font-semibold mb-2 text-sm">Account Status</div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Status:</span>
          <span className={authenticated ? 'text-green-400' : 'text-gray-500'}>
            {authenticated ? '✅ Logged In' : '❌ Anonymous'}
          </span>
        </div>
      </div>

      {/* User Info */}
      {authenticated && userId && (
        <div className="bg-black/35 border border-white/[0.08] rounded-md p-3">
          <div className="font-semibold mb-2 text-sm">Account Info</div>
          
          {/* Privy User ID */}
          <div className="mb-2 text-xs">
            <div className="text-gray-400 mb-1">User ID:</div>
            <div className="font-mono text-gray-300 break-all">
              {userId.substring(0, 20)}...
            </div>
          </div>

          {/* Wallet Address */}
          {walletAddress && (
            <div className="mb-2 text-xs">
              <div className="text-gray-400 mb-1">Wallet:</div>
              <div className="font-mono text-gray-300">
                {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
              </div>
            </div>
          )}

          {/* Email */}
          {email && (
            <div className="mb-2 text-xs">
              <div className="text-gray-400 mb-1">Email:</div>
              <div className="text-gray-300">{email}</div>
            </div>
          )}

          {/* Farcaster FID */}
          {farcasterFid && (
            <div className="mb-2 text-xs">
              <div className="text-gray-400 mb-1">Farcaster FID:</div>
              <div className="text-gray-300 flex items-center gap-1">
                🎭 {farcasterFid}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Character Name */}
      <div className="bg-black/35 border border-white/[0.08] rounded-md p-3">
        <div className="font-semibold mb-2 text-sm">Character Name</div>
        
        {!isEditingName ? (
          <div className="flex items-center justify-between">
            <span className="text-gray-300">{playerName || 'Unknown'}</span>
            <button
              onClick={() => setIsEditingName(true)}
              className="text-xs bg-blue-500/25 border border-blue-500/50 rounded px-2 py-1 cursor-pointer hover:bg-blue-500/40"
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
              className="w-full text-sm py-1.5 px-2 bg-white/5 border border-white/10 rounded text-white"
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
                className="flex-1 text-xs bg-green-500/25 border border-green-500/50 rounded px-2 py-1.5 cursor-pointer hover:bg-green-500/40"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditingName(false)
                  setTempName(playerName)
                }}
                className="flex-1 text-xs bg-gray-500/25 border border-gray-500/50 rounded px-2 py-1.5 cursor-pointer hover:bg-gray-500/40"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Login Status & Actions */}
      {!authenticated && (
        <div className="bg-black/35 border border-white/[0.08] rounded-md p-3">
          <div className="text-sm text-gray-400 mb-2">
            You're playing as an anonymous user. Your progress won't sync across devices.
          </div>
          <div className="text-xs text-gray-500">
            To enable account features, configure Privy authentication in your .env file.
          </div>
        </div>
      )}

      {/* Logout Button */}
      {authenticated && (
        <button
          onClick={handleLogout}
          className="bg-red-500/25 border border-red-500/50 rounded-md py-2 px-3 cursor-pointer hover:bg-red-500/40 text-sm font-medium"
        >
          Logout
        </button>
      )}

      {/* Account Features */}
      <div className="flex-1 bg-black/35 border border-white/[0.08] rounded-md p-3 overflow-y-auto">
        <div className="font-semibold mb-2 text-sm">Account Features</div>
        <div className="text-xs space-y-2 text-gray-400">
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

