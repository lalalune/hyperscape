/**
 * AuthModal Component
 * Displays a modal prompting users to sign in/sign up
 * Uses Privy's built-in authentication UI
 */

import React from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from './common/Modal'
import { Button } from './common/Button'
import { useAuth } from '../hooks/useAuth'

interface AuthModalProps {
  open: boolean
  onClose: () => void
  title?: string
  message?: string
  showSignUpPrompt?: boolean
}

/**
 * AuthModal - Prompt users to authenticate
 *
 * @example
 * ```tsx
 * const [showAuth, setShowAuth] = useState(false)
 *
 * <AuthModal
 *   open={showAuth}
 *   onClose={() => setShowAuth(false)}
 *   title="Sign In Required"
 *   message="Please sign in to save your assets"
 * />
 * ```
 */
export function AuthModal({
  open,
  onClose,
  title = 'Authentication Required',
  message = 'Please sign in to continue',
  showSignUpPrompt = true,
}: AuthModalProps) {
  const { login } = useAuth()

  const handleLogin = async () => {
    // Privy's login() will show its own modal with login options
    login()
    // Close our modal after triggering Privy
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <ModalHeader title={title} onClose={onClose} />

      <ModalBody>
        <div className="space-y-4">
          <p className="text-text-secondary">{message}</p>

          {showSignUpPrompt && (
            <div className="p-4 bg-surface-secondary rounded-lg border border-border-primary">
              <h3 className="text-sm font-semibold text-text-primary mb-2">
                New to Asset Forge?
              </h3>
              <p className="text-xs text-text-secondary">
                Create an account to save your generated assets, track your projects,
                and access premium features.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-text-primary">
              Sign in with:
            </h4>
            <ul className="text-xs text-text-secondary space-y-1">
              <li>• Email address</li>
              <li>• Google account</li>
              <li>• Web3 wallet (MetaMask, Phantom, etc.)</li>
              <li>• Farcaster</li>
            </ul>
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleLogin}>
          Sign In
        </Button>
      </ModalFooter>
    </Modal>
  )
}
