import { useCallback } from 'react'
import { MaterialPreset } from '../types'
import { useGenerationStore } from '../store'
import { notify } from '../utils/notify'

export function useMaterialPresets() {
  const {
    materialPresets,
    customMaterials,
    selectedMaterials,
    setMaterialPresets,
    setCustomMaterials,
    setSelectedMaterials,
    setEditingPreset,
    setShowDeleteConfirm
  } = useGenerationStore()

  const handleSaveCustomMaterials = useCallback(async () => {
    // Convert custom materials to the MaterialPreset format
    const newMaterials = customMaterials
      .filter(m => m.name && m.prompt)
      .map(mat => ({
        id: mat.name.toLowerCase().replace(/\s+/g, '-'),
        name: mat.name.toLowerCase().replace(/\s+/g, '-'),
        displayName: mat.displayName || mat.name,
        category: 'custom',
        tier: materialPresets.length + 1,
        color: mat.color || '#888888',
        stylePrompt: mat.prompt,
        description: 'Custom material'
      }))
    
    // Merge with existing presets
    const updatedPresets = [...materialPresets, ...newMaterials]
    
    // Save to JSON file
    const response = await fetch('/api/material-presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedPresets)
    })
    
    if (!response.ok) {
      throw new Error('Failed to save materials')
    }
    
    setMaterialPresets(updatedPresets)
    setCustomMaterials([])
    notify.success('Custom materials saved successfully!')
  }, [customMaterials, materialPresets, setMaterialPresets, setCustomMaterials])

  const handleUpdatePreset = useCallback(async (updatedPreset: MaterialPreset) => {
    const updatedPresets = materialPresets.map(preset => 
      preset.id === updatedPreset.id ? updatedPreset : preset
    )
    
    const response = await fetch('/api/material-presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedPresets)
    })
    
    if (!response.ok) {
      throw new Error('Failed to update preset')
    }
    
    setMaterialPresets(updatedPresets)
    setEditingPreset(null)
    notify.success('Material preset updated successfully!')
  }, [materialPresets, setMaterialPresets, setEditingPreset])

  const handleDeletePreset = useCallback(async (presetId: string) => {
    const updatedPresets = materialPresets.filter(preset => preset.id !== presetId)
    
    const response = await fetch('/api/material-presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedPresets)
    })
    
    if (!response.ok) {
      throw new Error('Failed to delete preset')
    }
    
    setMaterialPresets(updatedPresets)
    setSelectedMaterials(selectedMaterials.filter(id => id !== presetId))
    setShowDeleteConfirm(null)
    notify.success('Material preset deleted successfully!')
  }, [materialPresets, selectedMaterials, setMaterialPresets, setSelectedMaterials, setShowDeleteConfirm])

  return {
    handleSaveCustomMaterials,
    handleUpdatePreset,
    handleDeletePreset
  }
} 