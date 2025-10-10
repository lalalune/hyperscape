import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, Textarea } from '../common'
import { Palette, Edit2, Trash2, Plus, Download, Loader2, ChevronRight, Sparkles, Package2, Info, Check, X } from 'lucide-react'
import { cn } from '../../styles'
import { MaterialPreset } from '../../types'

interface CustomMaterial {
  name: string
  displayName?: string
  prompt: string
  color?: string
}

interface MaterialVariantsCardProps {
  gameStyle: 'runescape' | 'custom'
  isLoadingMaterials: boolean
  materialPresets: MaterialPreset[]
  selectedMaterials: string[]
  customMaterials: CustomMaterial[]
  materialPromptOverrides: Record<string, string>
  editMaterialPrompts: boolean
  onToggleMaterialSelection: (materialId: string) => void
  onEditMaterialPromptsToggle: () => void
  onMaterialPromptOverride: (materialId: string, prompt: string) => void
  onAddCustomMaterial: (material: CustomMaterial) => void
  onUpdateCustomMaterial: (index: number, material: CustomMaterial) => void
  onRemoveCustomMaterial: (index: number) => void
  onSaveCustomMaterials: () => void
  onEditPreset: (preset: MaterialPreset) => void
  onDeletePreset: (presetId: string) => void
}

export const MaterialVariantsCard: React.FC<MaterialVariantsCardProps> = ({
  gameStyle,
  isLoadingMaterials,
  materialPresets,
  selectedMaterials,
  customMaterials,
  materialPromptOverrides,
  editMaterialPrompts,
  onToggleMaterialSelection,
  onEditMaterialPromptsToggle,
  onMaterialPromptOverride,
  onAddCustomMaterial,
  onUpdateCustomMaterial,
  onRemoveCustomMaterial,
  onSaveCustomMaterials,
  onEditPreset,
  onDeletePreset
}) => {
  return (
    <Card className="overflow-hidden bg-gradient-to-br from-bg-primary via-bg-primary to-secondary/5 border-border-primary shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-secondary/10 rounded-xl">
            <Package2 className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold">Material Variants</CardTitle>
            <CardDescription className="text-xs mt-0.5">Select materials for your asset</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-visible">
        <div className="p-6 space-y-6 overflow-visible">
          {gameStyle === 'runescape' && (
            <div className="space-y-4 relative">
              {/* Preset Materials Section */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-medium text-text-primary">Preset Materials</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onEditMaterialPromptsToggle}
                  className="gap-2"
                >
                  <Edit2 className="w-3 h-3" />
                  {editMaterialPrompts ? 'Hide' : 'Edit'} Prompts
                </Button>
              </div>
              
              <div className="grid grid-cols-3 gap-2 relative">
              {isLoadingMaterials ? (
                <div className="col-span-3 flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
                  <span className="ml-2 text-sm text-text-secondary">Loading materials...</span>
                </div>
              ) : materialPresets.length === 0 ? (
                <div className="col-span-3 text-center py-8 text-sm text-text-secondary">
                  No material presets available
                </div>
              ) : (
                materialPresets.map(preset => (
                  <MaterialPresetItem
                    key={preset.id}
                    preset={preset}
                    isSelected={selectedMaterials.includes(preset.id)}
                    onToggle={() => onToggleMaterialSelection(preset.id)}
                    onEdit={() => onEditPreset(preset)}
                    onDelete={() => onDeletePreset(preset.id)}
                    showEditDelete={preset.category === 'custom'}
                  />
                ))
              )}
            </div>
            
                {editMaterialPrompts && selectedMaterials.length > 0 && (
                  <MaterialPromptOverrides
                    selectedMaterials={selectedMaterials}
                    materialPresets={materialPresets}
                    materialPromptOverrides={materialPromptOverrides}
                    onPromptOverride={onMaterialPromptOverride}
                  />
                )}
              </div>
            )}
            
            {/* Custom Materials */}
            <CustomMaterialsSection
              gameStyle={gameStyle}
              customMaterials={customMaterials}
              onAddCustomMaterial={onAddCustomMaterial}
              onUpdateCustomMaterial={onUpdateCustomMaterial}
              onRemoveCustomMaterial={onRemoveCustomMaterial}
              onSaveCustomMaterials={onSaveCustomMaterials}
            />
          </div>
        </CardContent>
    </Card>
  )
}

// Sub-component for material preset item
const MaterialPresetItem: React.FC<{
  preset: MaterialPreset
  isSelected: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  showEditDelete: boolean
}> = ({ preset, isSelected, onToggle, onEdit, onDelete, showEditDelete }) => {
  return (
    <div
      className={cn(
        "relative group rounded-xl border transition-all duration-200 cursor-pointer",
        isSelected
          ? "border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-sm"
          : "border-border-primary hover:border-secondary/50 bg-bg-secondary hover:bg-bg-secondary/80"
      )}
    >
      <button
        onClick={onToggle}
        className="w-full p-2.5 text-left relative"
        title={`${preset.displayName} - ${preset.description || preset.stylePrompt}`}
      >
        <div className="flex items-center gap-2">
          <div 
            className="w-5 h-5 rounded-md flex-shrink-0 shadow-sm border border-white/20"
            style={{ backgroundColor: preset.color }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-text-primary truncate leading-tight">
              {preset.displayName}
            </p>
            <p className="text-[10px] text-text-secondary truncate">
              {preset.category} • T{preset.tier}
            </p>
          </div>
          {isSelected && (
            <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          )}
        </div>
        
        {/* Enhanced Tooltip on Hover */}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50">
          <div className="bg-bg-primary/95 backdrop-blur-sm border border-border-primary rounded-lg shadow-xl p-3 min-w-[200px] max-w-[300px]">
            <p className="text-sm font-medium text-text-primary">{preset.displayName}</p>
            <p className="text-xs text-text-secondary mt-1 break-words">{preset.description || preset.stylePrompt}</p>
            {/* Tooltip Arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
              <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-border-primary"></div>
            </div>
          </div>
        </div>
      </button>
      
      {/* Edit and Delete buttons */}
      {showEditDelete && (
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="p-1.5 hover:bg-bg-primary rounded-lg transition-colors"
            title="Edit preset"
          >
            <Edit2 className="w-3 h-3 text-text-secondary hover:text-primary" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1.5 hover:bg-error/20 rounded-lg transition-colors"
            title="Delete preset"
          >
            <Trash2 className="w-3 h-3 text-text-secondary hover:text-error" />
          </button>
        </div>
      )}
    </div>
  )
}

// Sub-component for material prompt overrides
const MaterialPromptOverrides: React.FC<{
  selectedMaterials: string[]
  materialPresets: MaterialPreset[]
  materialPromptOverrides: Record<string, string>
  onPromptOverride: (materialId: string, prompt: string) => void
}> = ({ selectedMaterials, materialPresets, materialPromptOverrides, onPromptOverride }) => {
  return (
    <div className="space-y-3 p-4 bg-bg-tertiary rounded-lg animate-fade-in">
      {selectedMaterials.map(matId => {
        const preset = materialPresets.find(p => p.id === matId)
        return (
          <div key={matId} className="space-y-1">
            <label className="text-xs font-medium text-text-tertiary">
              {preset?.displayName || matId.replace(/-/g, ' ')}
            </label>
            <Textarea
              value={materialPromptOverrides[matId] || preset?.stylePrompt || ''}
              onChange={(e) => onPromptOverride(matId, e.target.value)}
              placeholder="Enter custom prompt..."
              rows={2}
              className="text-xs font-mono"
            />
          </div>
        )
      })}
    </div>
  )
}

// Sub-component for custom materials section
const CustomMaterialsSection: React.FC<{
  gameStyle: 'runescape' | 'custom'
  customMaterials: CustomMaterial[]
  onAddCustomMaterial: (material: CustomMaterial) => void
  onUpdateCustomMaterial: (index: number, material: CustomMaterial) => void
  onRemoveCustomMaterial: (index: number) => void
  onSaveCustomMaterials: () => void
}> = ({ 
  gameStyle, 
  customMaterials, 
  onAddCustomMaterial, 
  onUpdateCustomMaterial, 
  onRemoveCustomMaterial,
  onSaveCustomMaterials 
}) => {
  return (
    <div className="space-y-4 border-t border-border-primary pt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-secondary" />
          <h3 className="text-sm font-medium text-text-primary">
            {gameStyle === 'runescape' ? 'Additional' : 'Custom'} Materials
          </h3>
        </div>
      </div>
      <div className="space-y-3">
        {customMaterials.map((mat, index) => (
          <Card key={index} className="bg-gradient-to-br from-bg-secondary to-bg-tertiary border-border-primary">
            <CardContent className="p-4 space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Material ID"
                  value={mat.name}
                  onChange={(e) => {
                    onUpdateCustomMaterial(index, { ...mat, name: e.target.value })
                  }}
                  className="w-32 text-sm bg-bg-primary"
                />
                <Input
                  placeholder="Display Name"
                  value={mat.displayName || ''}
                  onChange={(e) => {
                    onUpdateCustomMaterial(index, { ...mat, displayName: e.target.value })
                  }}
                  className="flex-1 text-sm bg-bg-primary"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={mat.color || '#888888'}
                    onChange={(e) => {
                      onUpdateCustomMaterial(index, { ...mat, color: e.target.value })
                    }}
                    className="w-10 h-10 border border-border-primary rounded-lg cursor-pointer"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveCustomMaterial(index)}
                    className="hover:bg-error/10 hover:text-error"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <Textarea
                placeholder="Material texture prompt"
                value={mat.prompt}
                onChange={(e) => {
                  onUpdateCustomMaterial(index, { ...mat, prompt: e.target.value })
                }}
                rows={2}
                className="w-full text-sm resize-none bg-bg-primary"
              />
            </CardContent>
          </Card>
        ))}
        <div className="flex gap-2 pt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onAddCustomMaterial({ name: '', prompt: '', color: '#888888' })
            }}
            className="flex-1 gap-2 border-2 border-dashed hover:border-secondary"
          >
            <Plus className="w-4 h-4" />
            Add Material
          </Button>
          {customMaterials.filter(m => m.name && m.prompt).length > 0 && (
            <Button
              variant="primary"
              size="sm"
              onClick={onSaveCustomMaterials}
              className="flex-1 gap-2"
            >
              <Check className="w-4 h-4" />
              Save to Presets
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default MaterialVariantsCard 