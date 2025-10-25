import { Box, CheckCircle } from 'lucide-react'
import React from 'react'

import { TIER_DISPLAY_COLORS } from '../../constants'
import { Asset } from '../../services/api/AssetService'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common'

// Define the possible variant types based on GeneratedAsset
type Variant = Asset | { name: string; modelUrl: string; id?: string; success?: boolean } | string

interface MaterialVariantsDisplayProps {
  variants?: Variant[]
}

export const MaterialVariantsDisplay: React.FC<MaterialVariantsDisplayProps> = ({
  variants = []
}) => {

  const getMaterialName = (variant: Variant, index: number): string => {
    // Handle string variants (like "chainbody-dragon")
    if (typeof variant === 'string') {
      return variant.split('-').pop() || `Variant ${index + 1}`
    }
    
    // Handle object variants
    if (typeof variant === 'object' && variant !== null) {
      if ('id' in variant && variant.id) {
        return variant.id.split('-').pop() || `Variant ${index + 1}`
      }
      if ('name' in variant && variant.name) {
        return variant.name
      }
    }
    
    return `Variant ${index + 1}`
  }

  return (
    <Card className="overflow-hidden shadow-xl hover:shadow-2xl transition-shadow">
      <CardHeader>
        <CardTitle>Material Variants</CardTitle>
        <CardDescription>
          {variants.length} variants generated
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {variants.map((variant, i) => {
            const materialName = getMaterialName(variant, i)
            const color = TIER_DISPLAY_COLORS[materialName.toLowerCase()] || '#888888'
            const isSuccess = typeof variant === 'object' && variant !== null && 'success' in variant && variant.success
            
            return (
              <div key={i} className="group cursor-pointer">
                <div className="aspect-square bg-gradient-to-br from-bg-secondary to-bg-tertiary rounded-xl p-6 relative overflow-hidden transition-all hover:shadow-xl hover:scale-105">
                  <div 
                    className="absolute inset-0 opacity-30"
                    style={{ backgroundColor: color }}
                  />
                  <Box className="w-full h-full text-text-tertiary relative z-10" />
                  {isSuccess && (
                    <CheckCircle className="absolute top-3 right-3 w-5 h-5 text-success" />
                  )}
                </div>
                <p className="text-sm font-medium text-center mt-3 capitalize">
                  {materialName}
                </p>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export default MaterialVariantsDisplay 