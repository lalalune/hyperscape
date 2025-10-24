import React, { useEffect, useMemo, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useLoginToMiniApp } from '@privy-io/react-auth/farcaster'
import miniappSdk from '@farcaster/miniapp-sdk'

export interface LoginScreenFeature {
  icon: React.ReactNode
  title: string
  description?: string
}

export interface LoginScreenBranding {
  logo?: string
  title?: string
  tagline?: string
  features?: LoginScreenFeature[]
}

export interface LoginScreenTheme {
  backgroundImage?: string
  overlayGradient?: string
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  fontFamily?: string
}

export interface LoginScreenCopy {
  loading?: string
  description?: string
  ctaLabel?: string
  farcasterCtaLabel?: string
}

export interface LoginScreenProps {
  onAuthenticated: () => void
  branding?: LoginScreenBranding
  theme?: LoginScreenTheme
  copy?: LoginScreenCopy
  className?: string
  /**
   * Control Farcaster-specific behaviour.
   */
  farcaster?: {
    autoLogin?: boolean
  }
  /**
   * Optional custom content appended beneath the default CTA.
   */
  children?: React.ReactNode
  /**
   * Disable the default inline styles if you plan to style via CSS modules/Tailwind.
   */
  disableDefaultStyles?: boolean
  /**
   * Invoked when a login attempt fails.
   */
  onLoginError?: (error: unknown) => void
}

const DEFAULT_BRANDING: Required<LoginScreenBranding> = {
  logo: '/assets/images/logo.png',
  title: 'Hyperscape',
  tagline: 'A 3D multiplayer RPG adventure',
  features: [],
}

const DEFAULT_THEME: Required<LoginScreenTheme> = {
  backgroundImage: '/assets/images/login_background.png',
  overlayGradient: 'linear-gradient(rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.45))',
  primaryColor: '#d4af37',
  secondaryColor: '#0f172a',
  accentColor: '#3b82f6',
  fontFamily: "'Cinzel', serif, system-ui, -apple-system, sans-serif",
}

const DEFAULT_COPY: Required<LoginScreenCopy> = {
  loading: 'Loading...',
  description: 'Link your wallet or email to begin your journey.',
  ctaLabel: 'Log In',
  farcasterCtaLabel: 'Continue with Farcaster',
}

function buildStyleBlock(theme: Required<LoginScreenTheme>): string {
  const background = `${theme.overlayGradient}, url('${theme.backgroundImage}') center/cover no-repeat`

  return `
    .login-screen {
      position: fixed;
      inset: 0;
      background: ${background};
      background-color: ${theme.secondaryColor};
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-family: ${theme.fontFamily};
      text-rendering: optimizeLegibility;
    }

    .login-content {
      text-align: center;
      max-width: 640px;
      padding: 2.5rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 2rem;
      backdrop-filter: blur(6px);
      background-color: rgba(15, 23, 42, 0.35);
      border: 1px solid rgba(226, 232, 240, 0.08);
      border-radius: 24px;
      box-shadow:
        0 30px 60px rgba(8, 15, 26, 0.45),
        0 0 60px rgba(59, 130, 246, 0.25);
    }

    .login-logo {
      width: clamp(220px, 40vw, 360px);
      height: auto;
      margin: 0 auto;
      filter:
        drop-shadow(0 0 35px rgba(59, 130, 246, 0.25))
        drop-shadow(0 0 70px rgba(59, 130, 246, 0.15));
    }

    .login-tagline {
      font-size: 1rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: rgba(226, 232, 240, 0.8);
    }

    .login-subtitle {
      font-size: 1.125rem;
      color: rgba(248, 250, 252, 0.85);
      letter-spacing: 0.05em;
    }

    .login-features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 1.25rem;
      color: rgba(226, 232, 240, 0.8);
      text-align: left;
    }

    .login-feature {
      background: rgba(15, 23, 42, 0.55);
      padding: 1rem;
      border-radius: 16px;
      border: 1px solid rgba(148, 163, 184, 0.25);
    }

    .login-feature h4 {
      font-size: 1rem;
      margin-bottom: 0.5rem;
      color: ${theme.primaryColor};
      letter-spacing: 0.04em;
    }

    .login-feature p {
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.4;
    }

    .login-bottom {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      align-items: center;
    }

    .login-button {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.9rem 2.5rem;
      font-size: 1rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      background: linear-gradient(
        135deg,
        ${theme.primaryColor} 0%,
        ${theme.accentColor} 45%,
        ${theme.primaryColor} 100%
      );
      color: #0b1120;
      border: none;
      border-radius: 999px;
      cursor: pointer;
      box-shadow:
        0 18px 30px rgba(59, 130, 246, 0.25),
        0 0 55px rgba(59, 130, 246, 0.25);
      transition: transform 160ms ease, box-shadow 160ms ease;
    }

    .login-button:hover {
      transform: translateY(-1px);
      box-shadow:
        0 24px 42px rgba(59, 130, 246, 0.32),
        0 0 70px rgba(59, 130, 246, 0.32);
    }

    .login-button:disabled {
      cursor: not-allowed;
      filter: grayscale(0.3);
      opacity: 0.75;
      transform: none;
      box-shadow: none;
    }

    .login-spinner {
      width: 42px;
      height: 42px;
      border: 4px solid rgba(148, 163, 184, 0.2);
      border-top-color: ${theme.primaryColor};
      border-radius: 50%;
      animation: login-spinner-spin 1s linear infinite;
      margin: 0 auto;
    }

    @keyframes login-spinner-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `
}

async function detectFarcasterContext(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    const context = await miniappSdk.context
    if (context) {
      miniappSdk.actions.ready()
      return true
    }
  } catch {
    // If Farcaster context detection fails we silently continue.
  }

  return false
}

export function LoginScreen({
  onAuthenticated,
  branding,
  theme,
  copy,
  className,
  farcaster,
  children,
  disableDefaultStyles,
  onLoginError,
}: LoginScreenProps) {
  const { ready, authenticated, login } = usePrivy()
  const { initLoginToMiniApp, loginToMiniApp } = useLoginToMiniApp()

  const [isFarcasterContext, setIsFarcasterContext] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const mergedBranding = useMemo(
    () => ({
      ...DEFAULT_BRANDING,
      ...branding,
      features: branding?.features ?? DEFAULT_BRANDING.features,
    }),
    [branding],
  )

  const mergedTheme = useMemo(
    () => ({
      ...DEFAULT_THEME,
      ...theme,
    }),
    [theme],
  )

  const mergedCopy = useMemo(
    () => ({
      ...DEFAULT_COPY,
      ...copy,
    }),
    [copy],
  )

  useEffect(() => {
    let cancelled = false

    void detectFarcasterContext().then((detected) => {
      if (!cancelled && detected) {
        setIsFarcasterContext(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [farcaster?.autoLogin])

  useEffect(() => {
    if (ready && authenticated) {
      onAuthenticated()
    }
  }, [ready, authenticated, onAuthenticated])

  useEffect(() => {
    if (
      !ready ||
      authenticated ||
      !farcaster?.autoLogin ||
      !isFarcasterContext ||
      isLoggingIn
    ) {
      return
    }

    let cancelled = false

    const autoLogin = async () => {
      try {
        setIsLoggingIn(true)
        const { nonce } = await initLoginToMiniApp()
        const result = await miniappSdk.actions.signIn({ nonce })

        if (cancelled) {
          return
        }

        await loginToMiniApp({
          message: result.message,
          signature: result.signature,
        })
      } catch (error) {
        if (!cancelled) {
          console.error('[SharedLoginScreen] Farcaster auto-login failed', error)
          onLoginError?.(error)
          setIsLoggingIn(false)
        }
      }
    }

    void autoLogin()

    return () => {
      cancelled = true
    }
  }, [
    ready,
    authenticated,
    farcaster?.autoLogin,
    isFarcasterContext,
    isLoggingIn,
    initLoginToMiniApp,
    loginToMiniApp,
    onLoginError,
  ])

  const handleLoginClick = async () => {
    setIsLoggingIn(true)

    try {
      await login()
    } catch (error) {
      console.error('[SharedLoginScreen] Login failed', error)
      onLoginError?.(error)
      setIsLoggingIn(false)
    }
  }

  const containerClass = `login-screen${className ? ` ${className}` : ''}`

  if (!ready) {
    return (
      <div className={containerClass}>
        {!disableDefaultStyles && <style>{buildStyleBlock(mergedTheme)}</style>}
        <div className="login-content">
          {mergedBranding.logo ? (
            <img src={mergedBranding.logo} alt={mergedBranding.title} className="login-logo" />
          ) : null}
          <div className="login-bottom">
            <div className="login-subtitle">{mergedCopy.loading}</div>
            <div className="login-spinner" aria-label="Loading" />
          </div>
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className={containerClass}>
        {!disableDefaultStyles && <style>{buildStyleBlock(mergedTheme)}</style>}
        <div className="login-content">
          {mergedBranding.logo ? (
            <img src={mergedBranding.logo} alt={mergedBranding.title} className="login-logo" />
          ) : null}
          <div>
            {mergedBranding.tagline ? (
              <p className="login-tagline">{mergedBranding.tagline}</p>
            ) : null}
            <h2 className="login-subtitle">{mergedBranding.title}</h2>
            {mergedCopy.description ? <p>{mergedCopy.description}</p> : null}
          </div>

          {mergedBranding.features.length > 0 ? (
            <div className="login-features">
              {mergedBranding.features.map((feature, index) => (
                <div key={index} className="login-feature">
                  {feature.icon}
                  <h4>{feature.title}</h4>
                  {feature.description ? <p>{feature.description}</p> : null}
                </div>
              ))}
            </div>
          ) : null}

          <div className="login-bottom">
            <button
              className="login-button"
              type="button"
              onClick={handleLoginClick}
              disabled={isLoggingIn}
            >
              {isFarcasterContext ? mergedCopy.farcasterCtaLabel : mergedCopy.ctaLabel}
            </button>
            {children}
          </div>
        </div>
      </div>
    )
  }

  return null
}
