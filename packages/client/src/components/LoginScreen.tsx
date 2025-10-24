import React from 'react'
import { Sparkles, Users, Wand2, Zap } from 'lucide-react'

import { LoginScreen as SharedLoginScreen } from '../auth'

interface LoginScreenProps {
  onAuthenticated: () => void
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  return (
    <SharedLoginScreen
      onAuthenticated={onAuthenticated}
      branding={{
        logo: '/assets/images/logo.png',
        title: 'Enter the Hyperscape',
        tagline: 'A 3D multiplayer RPG adventure',
        features: [
          {
            icon: <Sparkles size={20} />,
            title: 'Immersive World',
            description: 'Explore vast landscapes and uncover hidden secrets.',
          },
          {
            icon: <Wand2 size={20} />,
            title: 'Magic & Combat',
            description: 'Master powerful abilities and dynamic combat styles.',
          },
          {
            icon: <Zap size={20} />,
            title: 'Fast-Paced Action',
            description: 'Experience responsive combat and agile movement.',
          },
          {
            icon: <Users size={20} />,
            title: 'Play Together',
            description: 'Drop in with friends and forge new alliances.',
          },
        ],
      }}
      theme={{
        backgroundImage: '/assets/images/login_background.png',
        primaryColor: '#d4af37',
        secondaryColor: '#0a0a0f',
        accentColor: '#3b82f6',
      }}
      copy={{
        loading: 'Loading...',
        description: 'Link your wallet or email to continue your adventure.',
        ctaLabel: 'Log In',
        farcasterCtaLabel: 'Continue with Farcaster',
      }}
      farcaster={{ autoLogin: true }}
    >
      <p className="text-xs uppercase tracking-[0.35em] text-white/70">
        Alpha Access · Build {new Date().getFullYear()}
      </p>
    </SharedLoginScreen>
  )
}

