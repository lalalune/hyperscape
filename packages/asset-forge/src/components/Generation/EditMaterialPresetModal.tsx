import React from 'react'

import { MaterialPreset } from '../../types'
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Input, Textarea } from '../common'

interface EditMaterialPresetModalProps {
  editingPreset: MaterialPreset | null
  onClose: () => void
  onSave: (preset: MaterialPreset) => void
}

export const EditMaterialPresetModal: React.FC<EditMaterialPresetModalProps> = ({
  editingPreset,
  onClose,
  onSave
}) => {
  const [preset, setPreset] = React.useState<MaterialPreset | null>(editingPreset)

  React.useEffect(() => {
    setPreset(editingPreset)
  }, [editingPreset])

  if (!preset) return null

  const handleSave = () => {
    if (preset) {
      onSave(preset)
    }
  }

  return (
    <Modal open={!!editingPreset} onClose={onClose}>
      <ModalHeader title="Edit Material Preset" onClose={onClose} />
      <ModalBody>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-text-secondary">ID (cannot be changed)</label>
            <Input
              value={preset.id}
              disabled
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-text-secondary">Display Name</label>
            <Input
              value={preset.displayName}
              onChange={(e) => setPreset({
                ...preset,
                displayName: e.target.value
              })}
              placeholder="Display Name"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-text-secondary">Material Texture Prompt</label>
            <Textarea
              value={preset.stylePrompt}
              onChange={(e) => setPreset({
                ...preset,
                stylePrompt: e.target.value
              })}
              placeholder="Material texture prompt"
              rows={3}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-text-secondary">Color</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                value={preset.color}
                onChange={(e) => setPreset({
                  ...preset,
                  color: e.target.value
                })}
                className="w-16 h-10 border border-border-primary rounded cursor-pointer"
              />
              <Input
                value={preset.color}
                onChange={(e) => setPreset({
                  ...preset,
                  color: e.target.value
                })}
                placeholder="#000000"
                className="flex-1"
              />
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Save Changes
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default EditMaterialPresetModal 