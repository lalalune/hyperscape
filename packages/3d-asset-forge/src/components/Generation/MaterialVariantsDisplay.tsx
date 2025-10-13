import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common'
import { Box, CheckCircle } from 'lucide-react'
import { Asset } from '../../services/api/AssetService'
import { TIER_DISPLAY_COLORS } from '../../constants'

// Properly typed variant with discriminated union
type AssetVariant = Asset & { variantType: 'asset' }
type GeneratedVariant = { 
  variantType: 'generated'
  name: string
  modelUrl: string
  id: string
  success: boolean
}
type NameOnlyVariant = {
  variantType: 'name'
  name: string
}

type Variant = AssetVariant | GeneratedVariant | NameOnlyVariant

interface MaterialVariantsDisplayProps {
  variants?: Variant[]
}

export const MaterialVariantsDisplay: React.FC<MaterialVariantsDisplayProps> = ({
  variants = []
}) => {

  const getMaterialName = (variant: Variant, index: number): string => {
    switch (variant.variantType) {
      case 'asset':
        return variant.id.split('-').pop() || `Variant ${index + 1}`
      case 'generated':
        return variant.id.split('-').pop() || variant.name
      case 'name':
        return variant.name
    }
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
            const isSuccess = variant.variantType === 'generated' && variant.success
            
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