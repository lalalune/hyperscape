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

  // Check if we're in a Farcaster mini-app context
  useEffect(() => {
    const checkFarcasterContext = async () => {
      // Try to access Farcaster SDK
      const context = await miniappSdk.context
      if (context) {
        setIsFarcasterContext(true)
        // Signal ready to Farcaster
        miniappSdk.actions.ready()
      }
    }

    checkFarcasterContext()
  }, [])

  // Auto-login for Farcaster mini-app
  useEffect(() => {
    if (ready && !authenticated && isFarcasterContext && !isLoggingIn) {
      const autoLogin = async () => {
        setIsLoggingIn(true)
        // Initialize a new login attempt to get a nonce
        const { nonce } = await initLoginToMiniApp()
        // Request a signature from Farcaster
        const result = await miniappSdk.actions.signIn({ nonce })
        // Send the signature to Privy for authentication
        await loginToMiniApp({
          message: result.message,
          signature: result.signature,
        })
      }

      autoLogin()
    }
  }, [ready, authenticated, isFarcasterContext, isLoggingIn, initLoginToMiniApp, loginToMiniApp])

  // Once authenticated, notify parent
  useEffect(() => {
    if (ready && authenticated) {
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
            background: linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.4)),
                        url('/assets/images/login_background.png') center/cover no-repeat;
            background-color: #0a0a0f;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-family: 'Cinzel', serif, system-ui, -apple-system, sans-serif;
          }
          .login-content {
            text-align: center;
            max-width: 600px;
            padding: 2rem;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 80vh;
          }
          .login-logo {
            width: 350px;
            height: auto;
            margin: 2rem auto 0;
            filter: drop-shadow(0 0 30px rgba(212, 175, 55, 0.6))
                    drop-shadow(0 0 60px rgba(212, 175, 55, 0.4));
          }
          .login-bottom {
            margin-bottom: 4rem;
          }
          .login-subtitle {
            font-size: 1.1rem;
            color: rgba(255, 255, 255, 0.8);
            margin-bottom: 2rem;
            letter-spacing: 0.05em;
          }
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(212, 175, 55, 0.2);
            border-top-color: #d4af37;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <div className="login-content">
          <img src="/assets/images/logo.png" alt="Hyperscape" className="login-logo" />
          <div className="login-bottom">
            <div className="login-subtitle">Loading...</div>
            <div className="loading-spinner"></div>
          </div>
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
            background: linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.4)),
                        url('/assets/images/login_background.png') center/cover no-repeat;
            background-color: #0a0a0f;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-family: 'Cinzel', serif, system-ui, -apple-system, sans-serif;
          }
          .login-content {
            text-align: center;
            max-width: 600px;
            padding: 2rem;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 80vh;
          }
          .login-logo {
            width: 400px;
            height: auto;
            margin: 2rem auto 1.5rem;
            filter: drop-shadow(0 0 35px rgba(212, 175, 55, 0.7))
                    drop-shadow(0 0 70px rgba(212, 175, 55, 0.5));
          }
          .login-tagline {
            font-size: 1.2rem;
            color: rgba(242, 208, 138, 0.9);
            letter-spacing: 0.15em;
            font-weight: 300;
            text-transform: uppercase;
            text-shadow: 0 0 10px rgba(242, 208, 138, 0.3),
                         0 0 20px rgba(242, 208, 138, 0.2);
            margin-bottom: 0;
          }
          .login-bottom {
            margin-bottom: 4rem;
          }
          .login-subtitle {
            font-size: 1.2rem;
            color: rgba(255, 255, 255, 0.8);
            margin-bottom: 2rem;
            letter-spacing: 0.05em;
          }
          .login-button-wrapper {
            position: relative;
            display: inline-block;
            overflow: hidden;
          }
          .login-button-wrapper::before,
          .login-button-wrapper::after {
            content: '';
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            width: 350px;
            height: 1px;
            background: linear-gradient(90deg,
              transparent 0%,
              rgba(242, 208, 138, 0.1) 5%,
              rgba(242, 208, 138, 0.6) 30%,
              rgba(242, 208, 138, 0.9) 50%,
              rgba(242, 208, 138, 0.6) 70%,
              rgba(242, 208, 138, 0.1) 95%,
              transparent 100%);
            box-shadow: 0 0 8px rgba(242, 208, 138, 0.4),
                        0 0 15px rgba(242, 208, 138, 0.2);
            transition: all 0.3s ease;
            pointer-events: none;
          }
          .login-button-wrapper::before {
            top: 0;
          }
          .login-button-wrapper::after {
            bottom: 0;
          }
          .login-button-ornament {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 200px;
            height: 50px;
            background: radial-gradient(ellipse at center,
              rgba(0, 0, 0, 0.5) 0%,
              rgba(0, 0, 0, 0.3) 40%,
              rgba(0, 0, 0, 0.1) 70%,
              transparent 100%);
            pointer-events: none;
            z-index: 1;
          }
          .login-button-highlight {
            position: absolute;
            top: 50%;
            left: 0;
            width: 100%;
            height: 80%;
            transform: translateY(-50%) translateX(-100%);
            background: linear-gradient(90deg,
              transparent 0%,
              rgba(242, 208, 138, 0) 30%,
              rgba(242, 208, 138, 0.15) 50%,
              rgba(242, 208, 138, 0) 70%,
              transparent 100%);
            opacity: 0;
            transition: all 0.6s ease;
            pointer-events: none;
            z-index: 2;
          }
          .login-button {
            background: transparent;
            border: none;
            color: #f2d08a;
            padding: 0.75rem 2rem;
            font-size: 1.4rem;
            font-weight: 400;
            letter-spacing: 0.2em;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: capitalize;
            position: relative;
            font-family: 'Cinzel', serif, system-ui, -apple-system, sans-serif;
            text-shadow: 0 0 12px rgba(242, 208, 138, 0.5),
                         0 0 25px rgba(242, 208, 138, 0.3);
            z-index: 3;
            filter: drop-shadow(0 8px 20px rgba(0, 0, 0, 0.8))
                    drop-shadow(0 4px 10px rgba(0, 0, 0, 0.6));
            min-width: 350px;
          }
          .login-button:hover {
            color: #f5dca8;
            text-shadow: 0 0 18px rgba(242, 208, 138, 0.7),
                         0 0 35px rgba(242, 208, 138, 0.5);
            transform: scale(1.03);
          }
          .login-button:active {
            transform: scale(0.98);
            color: #ffeac3;
            text-shadow: 0 0 25px rgba(242, 208, 138, 0.9),
                         0 0 50px rgba(242, 208, 138, 0.6);
          }
          .login-button-wrapper:hover::before,
          .login-button-wrapper:hover::after {
            background: linear-gradient(90deg,
              transparent 0%,
              rgba(242, 208, 138, 0.15) 5%,
              rgba(242, 208, 138, 0.7) 30%,
              rgba(242, 208, 138, 1) 50%,
              rgba(242, 208, 138, 0.7) 70%,
              rgba(242, 208, 138, 0.15) 95%,
              transparent 100%);
            box-shadow: 0 0 12px rgba(242, 208, 138, 0.5),
                        0 0 20px rgba(242, 208, 138, 0.3);
          }
          .login-button-wrapper:hover .login-button-highlight {
            opacity: 1;
            transform: translateY(-50%) translateX(100%);
          }
          .login-button-wrapper:active .login-button-highlight {
            opacity: 1;
            transform: translateY(-50%) translateX(0);
            background: radial-gradient(ellipse at center,
              rgba(242, 208, 138, 0.3) 0%,
              rgba(242, 208, 138, 0.15) 50%,
              transparent 100%);
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
          <div>
            <img src="/assets/images/logo.png" alt="Hyperscape" className="login-logo" />
            {!isFarcasterContext && (
              <div className="login-tagline">A 3D multiplayer RPG adventure</div>
            )}
          </div>
          <div className="login-bottom">
            {isFarcasterContext && (
              <div className="login-subtitle">
                <div className="farcaster-badge">🎭 Farcaster Frame</div>
                <div>Welcome! Please sign in to continue.</div>
              </div>
            )}
            <div className="login-button-wrapper">
              <div className="login-button-ornament"></div>
              <div className="login-button-highlight"></div>
              <button className="login-button" onClick={() => login()}>
                {isFarcasterContext ? 'Sign in with Farcaster' : 'Enter'}
              </button>
            </div>
          </div>
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
          background: linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)),
                      url('/assets/images/login-background.jpg') center/cover no-repeat;
          background-color: #0a0a0f;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-family: 'Cinzel', serif, system-ui, -apple-system, sans-serif;
        }
        .login-content {
          text-align: center;
          max-width: 600px;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 80vh;
        }
        .login-logo {
          width: 350px;
          height: auto;
          margin: 2rem auto 0;
          filter: drop-shadow(0 0 30px rgba(212, 175, 55, 0.6))
                  drop-shadow(0 0 60px rgba(212, 175, 55, 0.4));
        }
        .login-bottom {
          margin-bottom: 4rem;
        }
        .login-subtitle {
          font-size: 1.1rem;
          color: rgba(255, 255, 255, 0.8);
          margin-bottom: 2rem;
          letter-spacing: 0.05em;
        }
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(212, 175, 55, 0.2);
          border-top-color: #d4af37;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div className="login-content">
        <img src="/assets/images/logo.png" alt="Hyperscape" className="login-logo" />
        <div className="login-bottom">
          <div className="login-subtitle">
            {isFarcasterContext ? 'Authenticating with Farcaster...' : 'Entering the world...'}
          </div>
          <div className="loading-spinner"></div>
        </div>
      </div>
    </div>
  )
}


