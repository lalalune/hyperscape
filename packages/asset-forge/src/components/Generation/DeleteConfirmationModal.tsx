import { AlertCircle } from 'lucide-react'
import React from 'react'

import { MaterialPreset } from '../../types'
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from '../common'

interface DeleteConfirmationModalProps {
  showDeleteConfirm: string | null
  materialPresets: MaterialPreset[]
  onClose: () => void
  onConfirm: (presetId: string) => void
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  showDeleteConfirm,
  materialPresets,
  onClose,
  onConfirm
}) => {
  if (!showDeleteConfirm) return null

  const preset = materialPresets.find(p => p.id === showDeleteConfirm)

  return (
    <Modal open={!!showDeleteConfirm} onClose={onClose}>
      <ModalHeader title="Delete Material Preset" onClose={onClose} />
      <ModalBody>
        <div className="space-y-4">
          <p className="text-text-secondary">
            Are you sure you want to delete this material preset? This action cannot be undone.
          </p>
          <div className="flex items-center gap-3 p-4 bg-error bg-opacity-10 rounded-lg">
            <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
            <p className="text-sm">
              Material preset <strong>{preset?.displayName}</strong> will be permanently deleted.
            </p>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          className="bg-error hover:bg-error-dark"
          onClick={() => onConfirm(showDeleteConfirm)}
        >
          Delete Preset
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default DeleteConfirmationModal 