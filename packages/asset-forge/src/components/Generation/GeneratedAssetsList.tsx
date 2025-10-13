import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '../common'
import { CheckCircle, ChevronRight, Package, Clock, Sparkles } from 'lucide-react'
import { cn } from '../../styles'
import { GeneratedAsset } from '../../types'

interface GeneratedAssetsListProps {
  generatedAssets: GeneratedAsset[]
  selectedAsset: GeneratedAsset | null
  onAssetSelect: (asset: GeneratedAsset) => void
  onBack: () => void
}

export const GeneratedAssetsList: React.FC<GeneratedAssetsListProps> = ({
  generatedAssets,
  selectedAsset,
  onAssetSelect,
  onBack
}) => {
  const formatAssetName = (name: string) => {
    return name
      .replace('-base', '')
      .split('-')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const formatDate = (date: string | undefined) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleTimeString()
  }

  return (
    <Card className="lg:col-span-1 h-fit lg:sticky lg:top-20 overflow-hidden bg-gradient-to-br from-bg-primary via-bg-primary to-secondary/5 border-border-primary shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-secondary/10 rounded-xl">
              <Package className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Generated Assets</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {generatedAssets.length} {generatedAssets.length === 1 ? 'asset' : 'assets'} created
              </CardDescription>
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
      <CardContent className="p-4">
        <div className="space-y-3 max-h-[calc(100vh-16rem)] overflow-y-auto custom-scrollbar">
          {generatedAssets.map((asset) => (
            <button
              key={asset.id}
              onClick={() => onAssetSelect(asset)}
              className={cn(
                "w-full p-4 rounded-xl text-left transition-all duration-200 relative group",
                selectedAsset?.id === asset.id
                  ? "bg-gradient-to-r from-primary/10 to-secondary/10 border-2 border-primary shadow-sm"
                  : "bg-bg-secondary hover:bg-bg-secondary/80 border border-border-primary hover:border-secondary/50"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
                    <p className="font-medium text-text-primary truncate">
                      {formatAssetName(asset.name)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Clock className="w-3 h-3 text-text-tertiary" />
                    <p className="text-xs text-text-tertiary">
                      {formatDate(asset.createdAt)}
                    </p>
                  </div>
                </div>
                <div className={cn(
                  "p-2 rounded-lg transition-colors",
                  selectedAsset?.id === asset.id ? "bg-primary/10" : "bg-success/10"
                )}>
                  <CheckCircle className={cn(
                    "w-4 h-4",
                    selectedAsset?.id === asset.id ? "text-primary" : "text-success"
                  )} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default GeneratedAssetsList 