import React from 'react'

import { ModalErrorFallback } from '../errors'

import { ErrorBoundary } from './ErrorBoundary'
import { Modal, ModalProps } from './Modal'

/**
 * SafeModal - Modal wrapped with error boundary
 * Use this instead of Modal directly to prevent modal content errors from crashing the app
 */
export const SafeModal: React.FC<ModalProps> = ({ children, onClose, ...props }) => {
  return (
    <Modal {...props} onClose={onClose}>
      <ErrorBoundary
        fallback={<ModalErrorFallback onClose={onClose} />}
        resetKeys={[props.open]}
      >
        {children}
      </ErrorBoundary>
    </Modal>
  )
}

export default SafeModal
