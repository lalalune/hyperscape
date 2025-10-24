/**
 * Login Screen Component
 * Displays authentication UI for users to sign in
 */

import { usePrivy } from '@privy-io/react-auth'
import React from 'react'

interface LoginScreenProps {
  onAuthenticated: () => void
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const { login, ready, authenticated } = usePrivy()

  // Auto-redirect if already authenticated
  React.useEffect(() => {
    if (ready && authenticated) {
      onAuthenticated()
    }
  }, [ready, authenticated, onAuthenticated])

  const handleLogin = async () => {
    try {
      await login()
    } catch (error) {
      console.error('[LoginScreen] Login failed:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          {/* Logo/Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Asset Forge</h1>
            <p className="text-gray-400">AI-Powered 3D Asset Generation</p>
          </div>

          {/* Features */}
          <div className="space-y-3 mb-8">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-300">Generate 3D Models</p>
                <p className="text-xs text-gray-500">Create game-ready assets with AI</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-300">Manage Content</p>
                <p className="text-xs text-gray-500">Organize NPCs, quests, and dialogue</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-300">Voice Synthesis</p>
                <p className="text-xs text-gray-500">Generate character voices</p>
              </div>
            </div>
          </div>

          {/* Login Button */}
          <button
            onClick={handleLogin}
            disabled={!ready}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
          >
            {!ready ? 'Initializing...' : 'Sign In to Continue'}
          </button>

          {/* Footer */}
          <p className="text-center text-xs text-gray-500 mt-6">
            Secure authentication powered by{' '}
            <a 
              href="https://privy.io" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-400 hover:text-blue-300"
            >
              Privy
            </a>
          </p>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            New to Asset Forge?{' '}
            <button className="text-blue-400 hover:text-blue-300 font-medium">
              Learn More
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

