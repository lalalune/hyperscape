import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Input } from '../common'
import { cn } from '../../styles'
import { User, Search, ChevronRight, Box, Loader2, AlertCircle, Check } from 'lucide-react'
import { useAssets } from '../../hooks/useAssets'
import { useHandRiggingStore } from '../../store'
import type { Asset } from '../../types'
import { hasAnimations } from '../../types/AssetMetadata'

export function HandAvatarSelector() {
  const { assets, loading } = useAssets()
  const [searchTerm, setSearchTerm] = useState('')
  
  const {
    selectedAvatar,
    setSelectedAvatar,
    setModelUrl,
    setError
  } = useHandRiggingStore()
  
  // Filter only character/avatar assets
  const avatarAssets = assets.filter(a => a.type === 'character')
  const filteredAvatars = avatarAssets.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  const handleSelectAvatar = (avatar: Asset) => {
    setSelectedAvatar(avatar)
    
    // Check if avatar has t-pose animation file
    const animations = hasAnimations(avatar) ? avatar.metadata.animations?.basic : undefined
    let modelUrl = `/api/assets/${avatar.id}/model`  // Default to base model
    
    if (animations?.tpose) {
      // Use t-pose model if available (preferred for hand rigging)
      modelUrl = `/api/assets/${avatar.id}/${animations.tpose}`
      console.log(`Using t-pose model for ${avatar.name}: ${animations.tpose}`)
    } else {
      console.log(`No t-pose model found for ${avatar.name}, using base model`)
    }
    
    setModelUrl(modelUrl)
    setError(null)
  }
  
  return (
    <Card className={cn("overflow-hidden", "animate-slide-in-left")}>
      <CardHeader className="bg-gradient-to-r from-bg-secondary to-bg-tertiary">
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          Select Avatar
        </CardTitle>
        <CardDescription>
          Choose a character model to add hand bones
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-4">
        {/* Search Input */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
            <Input
              type="text"
              placeholder="Search avatars..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5"
            />
          </div>
        </div>
        
        {/* Avatar List */}
        <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-32 gap-3">
              <Loader2 className="animate-spin text-primary" size={28} />
              <p className="text-sm text-text-tertiary">Loading avatars...</p>
            </div>
          ) : filteredAvatars.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-bg-secondary/50 rounded-2xl mb-4">
                <User size={24} className="text-text-tertiary" />
              </div>
              <p className="text-text-tertiary text-sm">No avatars found</p>
              {searchTerm && (
                <p className="text-text-tertiary/60 text-xs mt-1">Try a different search term</p>
              )}
            </div>
          ) : (
            filteredAvatars.map((avatar) => (
              <button
                key={avatar.id}
                onClick={() => handleSelectAvatar(avatar)}
                className={cn(
                  "w-full p-4 rounded-xl border transition-all duration-200 text-left group",
                  selectedAvatar?.id === avatar.id
                    ? "bg-primary/20 border-primary shadow-md shadow-primary/20"
                    : "bg-bg-tertiary/20 border-white/10 hover:border-white/20 hover:bg-bg-tertiary/30"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text-primary">{avatar.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" size="sm" className="capitalize bg-bg-tertiary/50 text-text-secondary border border-white/10">
                        {avatar.type}
                      </Badge>
                      {avatar.hasModel && (
                        <Badge variant="primary" size="sm" className="bg-primary/20 text-primary border border-primary/30">
                          <Box size={10} className="mr-1" />
                          3D
                        </Badge>
                      )}
                      {hasAnimations(avatar) && avatar.metadata.animations?.basic && (
                        <Badge variant="secondary" size="sm" className="bg-purple-500/20 text-purple-400 border border-purple-500/30">
                          Animated
                        </Badge>
                      )}
                      {hasAnimations(avatar) && avatar.metadata.animations?.basic?.tpose && (
                        <Badge variant="success" size="sm" className="bg-green-500/20 text-green-400 border border-green-500/30">
                          T-Pose
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedAvatar?.id === avatar.id && (
                      <Check size={18} className="text-primary" />
                    )}
                    <ChevronRight size={18} className={cn(
                      "text-text-tertiary transition-transform duration-200",
                      selectedAvatar?.id === avatar.id
                        ? "translate-x-1 text-primary"
                        : "group-hover:translate-x-1"
                    )} />
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
        
        {/* Selected Avatar Info */}
        {selectedAvatar && (
          <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-text-primary">
                Selected: <strong>{selectedAvatar.name}</strong>
                {hasAnimations(selectedAvatar) && selectedAvatar.metadata.animations?.basic?.tpose && (
                  <Badge variant="success" size="sm" className="ml-2 text-white">
                    T-Pose Available
                  </Badge>
                )}
              </span>
            </div>
            {(!hasAnimations(selectedAvatar) || !selectedAvatar.metadata.animations?.basic?.tpose) && (
              <p className="text-xs text-text-secondary mt-2 ml-6">
                No T-pose model found, using base model (results may vary)
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
} 