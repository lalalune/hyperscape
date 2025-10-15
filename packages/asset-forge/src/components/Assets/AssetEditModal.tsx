import { useState, useEffect } from 'react'
import { X, Save, Trash2, AlertTriangle } from 'lucide-react'
import { Modal, Button, Input } from '../common'
import type { Asset, AssetMetadata } from '../../types'

interface AssetEditModalProps {
  asset: Asset | null
  isOpen: boolean
  onClose: () => void
  onSave: (updatedAsset: Partial<Asset>) => Promise<Asset>
  onDelete?: (asset: Asset, includeVariants?: boolean) => void
  hasVariants?: boolean
}

export function AssetEditModal({
  asset,
  isOpen,
  onClose,
  onSave,
  onDelete,
  hasVariants = false
}: AssetEditModalProps) {
  interface EditedAssetData {
    name: string
    type: string
    metadata: {
      tier: string
      subtype: string
    }
  }
  
  const [editedData, setEditedData] = useState<EditedAssetData>({
    name: '',
    type: '',
    metadata: {
      tier: '',
      subtype: ''
    }
  })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [nameError, setNameError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (asset) {
      const metadataWithTier = asset.metadata as AssetMetadata & { tier?: string }
      setEditedData({
        name: asset.name,
        type: asset.type,
        metadata: {
          tier: metadataWithTier.tier || '',
          subtype: asset.metadata.subtype || ''
        }
      })
      setIsDirty(false)
      setShowDeleteConfirm(false)
      setNameError('')
    }
  }, [asset])

  const validateName = (name: string) => {
    if (!name.trim()) {
      return 'Name is required'
    }
    if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
      return 'Only letters, numbers, hyphens, and underscores allowed'
    }
    return ''
  }

  const handleChange = (field: string, value: string) => {
    setEditedData(prev => {
      if (field.includes('.')) {
        const [parent, child] = field.split('.')
        return {
          ...prev,
          [parent]: {
            ...(prev[parent as keyof typeof prev] as Record<string, string>),
            [child]: value
          }
        }
      }
      return { ...prev, [field]: value }
    })
    setIsDirty(true)
    
    if (field === 'name') {
      setNameError(validateName(value))
    }
  }

  const handleSave = async () => {
    const error = validateName(editedData.name)
    if (error) {
      setNameError(error)
      return
    }
    
    const currentAsset = asset!
    
    setIsSaving(true)
    await onSave({
      id: currentAsset.id,
      name: editedData.name.trim(),
      type: editedData.type,
      metadata: {
        ...currentAsset.metadata,
        ...editedData.metadata
      }
    })
    // Don't close here - let the parent handle it after successful save
    setIsSaving(false)
  }

  const handleDelete = () => {
    if (asset && onDelete) {
      onDelete(asset, hasVariants)
      // Don't close here - let the parent handle it
    }
  }

  if (!asset) return null

  return (
    <Modal open={isOpen} onClose={onClose} className="max-w-md">
      <div className="flex items-center justify-between mb-6 px-6 pt-6">
        <h2 className="text-lg font-semibold text-text-primary">Edit Asset</h2>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-bg-tertiary rounded-lg transition-colors"
        >
          <X size={18} className="text-text-secondary" />
        </button>
      </div>

      <div className="space-y-4 px-6">
        {/* Asset Name */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            Asset Name
          </label>
          <Input
            value={editedData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g., sword-iron-basic"
            className={`w-full ${nameError ? 'border-error' : ''}`}
          />
          {nameError && (
            <p className="text-xs text-error mt-1">{nameError}</p>
          )}
        </div>

        {/* Asset Type */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            Type
          </label>
          <select
            value={editedData.type}
            onChange={(e) => handleChange('type', e.target.value)}
            className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="armor">Armor</option>
            <option value="weapon">Weapon</option>
            <option value="resource">Resource</option>
            <option value="ammunition">Ammunition</option>
            <option value="tool">Tool</option>
          </select>
        </div>

        {/* Tier (if applicable) */}
        {editedData.metadata.tier && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Tier
            </label>
            <select
              value={editedData.metadata.tier}
              onChange={(e) => handleChange('metadata.tier', e.target.value)}
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="base">Base</option>
              <option value="bronze">Bronze</option>
              <option value="iron">Iron</option>
              <option value="steel">Steel</option>
              <option value="mithril">Mithril</option>
            </select>
          </div>
        )}

        {/* Subtype (if applicable) */}
        {editedData.metadata.subtype && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Subtype
            </label>
            <Input
              value={editedData.metadata.subtype}
              onChange={(e) => handleChange('metadata.subtype', e.target.value)}
              placeholder="e.g., body, helmet, legs"
              className="w-full"
            />
          </div>
        )}

        {/* Status Info */}
        <div className="flex flex-wrap gap-2 pt-2">
          {asset.hasModel && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500 bg-opacity-20 text-green-300">
              Has Model
            </span>
          )}
          {hasVariants && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500 bg-opacity-20 text-blue-300">
              Has Variants
            </span>
          )}
          {asset.metadata.isBaseModel && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-bg-tertiary text-text-secondary">
              Base Model
            </span>
          )}
          {asset.metadata.isPlaceholder && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-500 bg-opacity-20 text-yellow-300">
              Placeholder
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center mt-6 px-6 pb-6">
        {/* Delete Button */}
        {onDelete && (
          <div>
            {!showDeleteConfirm ? (
              <Button
                variant="secondary"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-error hover:text-error"
              >
                <Trash2 size={16} className="mr-1.5" />
                Delete
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-error" />
                <span className="text-sm text-text-primary mr-2">Delete?</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  No
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleDelete}
                  className="bg-error hover:bg-error hover:opacity-90"
                >
                  Yes
                </Button>
              </div>
            )}
          </div>
        )}
        
        {/* If no delete option, add empty div to maintain layout */}
        {!onDelete && <div />}
        
        {/* Save/Cancel Buttons */}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!isDirty || !!nameError || isSaving}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} className="mr-1.5" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
} 