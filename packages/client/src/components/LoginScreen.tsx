/**
 * Login Screen Component
 * Shown before world loads to authenticate users
 */

import React, { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useLoginToMiniApp } from '@privy-io/react-auth/farcaster'
import miniappSdk from '@farcaster/miniapp-sdk'

interface LoginScreenProps {
  onAuthenticated: () => void
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const { ready, authenticated, login } = usePrivy()
  const { initLoginToMiniApp, loginToMiniApp } = useLoginToMiniApp()
  const [isFarcasterContext, setIsFarcasterContext] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if we're in a Farcaster mini-app context
  useEffect(() => {
    const checkFarcasterContext = async () => {
      try {
        // Try to access Farcaster SDK
        const context = await miniappSdk.context
        if (context) {
          setIsFarcasterContext(true)
          console.log('[LoginScreen] Detected Farcaster mini-app context')
          // Signal ready to Farcaster
          miniappSdk.actions.ready()
        }
      } catch (_err) {
        // Not in Farcaster context, that's fine
        setIsFarcasterContext(false)
      }
    }

    checkFarcasterContext()
  }, [])

  // Auto-login for Farcaster mini-app
  useEffect(() => {
    if (ready && !authenticated && isFarcasterContext && !isLoggingIn) {
      const autoLogin = async () => {
        setIsLoggingIn(true)
        try {
          console.log('[LoginScreen] Attempting Farcaster auto-login...')
          // Initialize a new login attempt to get a nonce
          const { nonce } = await initLoginToMiniApp()
          // Request a signature from Farcaster
          const result = await miniappSdk.actions.signIn({ nonce })
          // Send the signature to Privy for authentication
          await loginToMiniApp({
            message: result.message,
            signature: result.signature,
          })
          console.log('[LoginScreen] Farcaster auto-login successful')
        } catch (err) {
          console.error('[LoginScreen] Farcaster auto-login failed:', err)
          setError('Failed to authenticate with Farcaster. Please try manual login.')
          setIsLoggingIn(false)
        }
      }

      autoLogin()
    }
  }, [ready, authenticated, isFarcasterContext, isLoggingIn, initLoginToMiniApp, loginToMiniApp])

  // Once authenticated, notify parent
  useEffect(() => {
    if (ready && authenticated) {
      console.log('[LoginScreen] User authenticated, loading world...')
      onAuthenticated()
    }
  }, [ready, authenticated, onAuthenticated])

  // Show loading state while Privy initializes
  if (!ready) {
    return (
      <div className="login-screen">
        <style>{`
          .login-screen {
            position: fixed;
            inset: 0;
            background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-family: system-ui, -apple-system, sans-serif;
          }
          .login-content {
            text-align: center;
            max-width: 400px;
            padding: 2rem;
          }
          .login-title {
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 1rem;
            background: linear-gradient(135deg, #4a90e2 0%, #67b5f7 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          .login-subtitle {
            font-size: 1.1rem;
            color: rgba(255, 255, 255, 0.7);
            margin-bottom: 2rem;
          }
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255, 255, 255, 0.1);
            border-top-color: #4a90e2;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <div className="login-content">
          <div className="login-title">Hyperscape</div>
          <div className="login-subtitle">Initializing...</div>
          <div className="loading-spinner"></div>
        </div>
      </div>
    )
  }

  // Show login UI if not authenticated and not auto-logging in
  if (!authenticated && !isLoggingIn) {
    return (
      <div className="login-screen">
        <style>{`
          .login-screen {
            position: fixed;
            inset: 0;
            background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-family: system-ui, -apple-system, sans-serif;
          }
          .login-content {
            text-align: center;
            max-width: 400px;
            padding: 2rem;
          }
          .login-title {
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 1rem;
            background: linear-gradient(135deg, #4a90e2 0%, #67b5f7 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          .login-subtitle {
            font-size: 1.1rem;
            color: rgba(255, 255, 255, 0.7);
            margin-bottom: 2rem;
          }
          .login-button {
            background: linear-gradient(135deg, #4a90e2 0%, #67b5f7 100%);
            border: none;
            color: white;
            padding: 1rem 2rem;
            font-size: 1.1rem;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 20px rgba(74, 144, 226, 0.3);
          }
          .login-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 25px rgba(74, 144, 226, 0.4);
          }
          .login-button:active {
            transform: translateY(0);
          }
          .error-message {
            color: #ff6b6b;
            margin-top: 1rem;
            font-size: 0.9rem;
          }
          .farcaster-badge {
            display: inline-block;
            background: rgba(138, 99, 210, 0.2);
            border: 1px solid rgba(138, 99, 210, 0.4);
            padding: 0.5rem 1rem;
            border-radius: 6px;
            margin-bottom: 1rem;
            font-size: 0.9rem;
          }
        `}</style>
        <div className="login-content">
          <div className="login-title">Hyperscape</div>
          <div className="login-subtitle">
            {isFarcasterContext ? (
              <>
                <div className="farcaster-badge">🎭 Farcaster Frame</div>
                <div>Welcome! Please sign in to continue.</div>
              </>
            ) : (
              'A 3D multiplayer RPG adventure'
            )}
          </div>
          <button className="login-button" onClick={() => login()}>
            {isFarcasterContext ? 'Sign in with Farcaster' : 'Login to Play'}
          </button>
          {error && <div className="error-message">{error}</div>}
        </div>
      </div>
    )
  }

  // Show loading during authentication
  return (
    <div className="login-screen">
      <style>{`
        .login-screen {
          position: fixed;
          inset: 0;
          background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .login-content {
          text-align: center;
          max-width: 400px;
          padding: 2rem;
        }
        .login-title {
          font-size: 2.5rem;
          font-weight: bold;
          margin-bottom: 1rem;
          background: linear-gradient(135deg, #4a90e2 0%, #67b5f7 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .login-subtitle {
          font-size: 1.1rem;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 2rem;
        }
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(255, 255, 255, 0.1);
          border-top-color: #4a90e2;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div className="login-content">
        <div className="login-title">Hyperscape</div>
        <div className="login-subtitle">
          {isFarcasterContext ? 'Authenticating with Farcaster...' : 'Entering the world...'}
        </div>
        <div className="loading-spinner"></div>
      </div>
    </div>
  )
}


