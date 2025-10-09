import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Checkbox } from '../common'
import { Zap, Brain, User, Palette, Grid3x3, Settings2, Info } from 'lucide-react'
import { cn } from '../../styles'

interface PipelineOption {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  icon: React.ComponentType<{ className?: string }>
}

interface PipelineOptionsCardProps {
  generationType: 'item' | 'avatar' | undefined
  useGPT4Enhancement: boolean
  enableRetexturing: boolean
  enableSprites: boolean
  enableRigging: boolean
  onUseGPT4EnhancementChange: (checked: boolean) => void
  onEnableRetexturingChange: (checked: boolean) => void
  onEnableSpritesChange: (checked: boolean) => void
  onEnableRiggingChange: (checked: boolean) => void
}

export const PipelineOptionsCard: React.FC<PipelineOptionsCardProps> = ({
  generationType,
  useGPT4Enhancement,
  enableRetexturing,
  enableSprites,
  enableRigging,
  onUseGPT4EnhancementChange,
  onEnableRetexturingChange,
  onEnableSpritesChange,
  onEnableRiggingChange
}) => {
  const options: PipelineOption[] = [
    {
      id: 'gpt4',
      label: 'GPT-4 Enhancement',
      description: 'Improve prompts with AI',
      checked: useGPT4Enhancement,
      onChange: onUseGPT4EnhancementChange,
      icon: Brain
    },
    ...(generationType === 'avatar' ? [{
      id: 'rigging',
      label: 'Auto-Rigging',
      description: 'Add skeleton & animations',
      checked: enableRigging,
      onChange: onEnableRiggingChange,
      icon: User
    }] : []),
    ...(generationType === 'item' ? [
      {
        id: 'retexture',
        label: 'Material Variants',
        description: 'Generate multiple textures',
        checked: enableRetexturing,
        onChange: onEnableRetexturingChange,
        icon: Palette
      },
      {
        id: 'sprites',
        label: '2D Sprites',
        description: 'Generate 8-directional sprites',
        checked: enableSprites,
        onChange: onEnableSpritesChange,
        icon: Grid3x3
      }
    ] : [])
  ]

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-bg-primary via-bg-primary to-primary/5 border-border-primary shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Settings2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold">Pipeline Options</CardTitle>
            <CardDescription className="text-xs mt-0.5">Configure generation features</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-3">
        {options.map((option) => {
          const Icon = option.icon
          return (
            <div 
              key={option.id}
              className={cn(
                "p-4 rounded-xl border transition-all duration-200",
                option.checked 
                  ? "border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10" 
                  : "border-border-primary hover:border-border-secondary bg-bg-secondary/50"
              )}
            >
              <Checkbox
                checked={option.checked}
                onChange={(e) => option.onChange(e.target.checked)}
                label={
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg transition-colors",
                      option.checked ? "bg-primary/10" : "bg-bg-tertiary"
                    )}>
                      <Icon className={cn(
                        "w-4 h-4 transition-colors",
                        option.checked ? "text-primary" : "text-text-secondary"
                      )} />
                    </div>
                    <div className="flex-1">
                      <span className="font-medium text-text-primary block">
                        {option.label}
                      </span>
                      <span className="text-xs text-text-secondary">
                        {option.description}
                      </span>
                    </div>
                  </div>
                }
              />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

export default PipelineOptionsCard 