import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, Textarea } from '../common'
import { FileText, Layers, Package, User, ChevronRight, Gamepad2 } from 'lucide-react'
import { cn } from '../../styles'
import { CustomAssetType } from '../../types/generation'
import { GameStylePrompt } from '../../services/api/PromptService'

interface AssetDetailsCardProps {
  generationType: 'item' | 'avatar' | undefined
  assetName: string
  assetType: string
  description: string
  gameStyle: string
  customStyle: string
  customAssetTypes: CustomAssetType[]
  customGameStyles?: Record<string, GameStylePrompt>
  onAssetNameChange: (value: string) => void
  onAssetTypeChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onGameStyleChange: (style: 'runescape' | 'custom') => void
  onCustomStyleChange: (value: string) => void
  onBack: () => void
  onSaveCustomGameStyle?: (styleId: string, style: GameStylePrompt) => Promise<boolean>
}

export const AssetDetailsCard: React.FC<AssetDetailsCardProps> = ({
  generationType,
  assetName,
  assetType,
  description,
  gameStyle,
  customStyle,
  customAssetTypes,
  customGameStyles = {},
  onAssetNameChange,
  onAssetTypeChange,
  onDescriptionChange,
  onGameStyleChange,
  onCustomStyleChange,
  onBack,
  onSaveCustomGameStyle
}) => {
  return (
    <Card className="overflow-hidden bg-gradient-to-br from-bg-primary via-bg-primary to-primary/5 border-border-primary shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              {generationType === 'avatar' ? (
                <User className="w-5 h-5 text-primary" />
              ) : (
                <Package className="w-5 h-5 text-primary" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">
                {generationType === 'avatar' ? 'Avatar Details' : 'Asset Details'}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">Define what you want to create</CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-text-secondary hover:text-text-primary"
            title="Back to generation type selection"
          >
            <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
            Back
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <FileText className="w-3.5 h-3.5 text-primary" />
              </div>
              {generationType === 'avatar' ? 'Avatar Name' : 'Asset Name'}
            </label>
            <Input
              value={assetName}
              onChange={(e) => onAssetNameChange(e.target.value)}
              placeholder={generationType === 'avatar' ? "e.g., Goblin Warrior" : "e.g., Dragon Sword"}
              className="w-full bg-bg-secondary/70 border-border-primary/50 focus:border-primary"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <Layers className="w-3.5 h-3.5 text-primary" />
              </div>
              Asset Type
            </label>
            <select
              value={assetType}
              onChange={(e) => onAssetTypeChange(e.target.value)}
              className="w-full px-4 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-20 transition-all appearance-none cursor-pointer [&>option]:bg-bg-primary [&>option]:text-text-primary"
            >
              {generationType === 'avatar' ? (
                <>
                  <option value="character">👤 Character</option>
                  <option value="humanoid">🧍 Humanoid</option>
                  <option value="npc">🤝 NPC</option>
                  <option value="creature">🐲 Creature</option>
                </>
              ) : (
                <>
                  <option value="weapon">⚔️ Weapon</option>
                  <option value="armor">🛡️ Armor</option>
                  <option value="tool">🔨 Tool</option>
                  <option value="building">🏰 Building</option>
                  <option value="consumable">🧪 Consumable</option>
                  <option value="resource">💎 Resource</option>
                </>
              )}
              {customAssetTypes.filter(t => t.name).map(type => (
                <option key={type.name} value={type.name.toLowerCase()}>
                  ✨ {type.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <FileText className="w-3.5 h-3.5 text-primary" />
            </div>
            Description
          </label>
          <Textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Describe your asset in detail..."
            rows={4}
            className="w-full resize-none bg-bg-secondary/70 border-border-primary/50 focus:border-primary"
          />
        </div>
        
        {/* Game Style Selection */}
        <GameStyleSelector
          gameStyle={gameStyle}
          customStyle={customStyle}
          customGameStyles={customGameStyles}
          onGameStyleChange={onGameStyleChange}
          onCustomStyleChange={onCustomStyleChange}
          onSaveCustomGameStyle={onSaveCustomGameStyle}
        />
      </CardContent>
    </Card>
  )
}

// Sub-component for game style selection
const GameStyleSelector: React.FC<{
  gameStyle: string
  customStyle: string
  customGameStyles?: Record<string, GameStylePrompt>
  onGameStyleChange: (style: 'runescape' | 'custom') => void
  onCustomStyleChange: (value: string) => void
  onSaveCustomGameStyle?: (styleId: string, style: GameStylePrompt) => Promise<boolean>
}> = ({ gameStyle, customStyle, customGameStyles = {}, onGameStyleChange, onCustomStyleChange, onSaveCustomGameStyle }) => {
  // Determine the current selected value for the dropdown
  const currentValue = gameStyle === 'runescape' ? 'runescape' : 
                      gameStyle === 'custom' && customStyle ? `custom:${customStyle}` : 
                      'runescape'

  const handleChange = (value: string) => {
    if (value === 'runescape') {
      onGameStyleChange('runescape')
    } else if (value.startsWith('custom:')) {
      const styleId = value.replace('custom:', '')
      onGameStyleChange('custom')
      onCustomStyleChange(styleId)
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-text-primary flex items-center gap-2">
        <div className="p-1.5 bg-primary/10 rounded-lg">
          <Gamepad2 className="w-3.5 h-3.5 text-primary" />
        </div>
        Game Style
      </label>
      <select
        value={currentValue}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full px-4 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all appearance-none cursor-pointer [&>option]:bg-bg-primary [&>option]:text-text-primary"
      >
        <option value="runescape">RuneScape 2007</option>
        {Object.entries(customGameStyles).map(([styleId, style]) => (
          <option key={styleId} value={`custom:${styleId}`}>
            {style.name}
          </option>
        ))}
      </select>
      {/* Show style details below the dropdown */}
      {gameStyle === 'runescape' && (
        <div className="px-3 py-2 bg-primary/5 border border-primary/10 rounded-lg">
          <p className="text-xs text-text-secondary">Classic low-poly style</p>
        </div>
      )}
      {gameStyle === 'custom' && customStyle && customGameStyles[customStyle] && (
        <div className="px-3 py-2 bg-primary/5 border border-primary/10 rounded-lg">
          <p className="text-xs text-text-secondary">{customGameStyles[customStyle].base}</p>
        </div>
      )}
    </div>
  )
}

export default AssetDetailsCard