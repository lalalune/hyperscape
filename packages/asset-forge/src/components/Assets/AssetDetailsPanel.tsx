import React, { useState } from 'react'
import { Asset } from '../../types'
import { 
  X, Package, Hash, Tag, Calendar, Layers, Palette, Box, 
  FileCode, ChevronRight, Copy, Check,
  Sparkles, AlertCircle, Download, Share2, Code
} from 'lucide-react'
import { getTierColor } from '../../constants'

interface AssetDetailsPanelProps {
  asset: Asset
  isOpen: boolean
  onClose: () => void
  modelInfo?: { vertices: number, faces: number, materials: number, fileSize?: number } | null
}

// Format unknown metadata values for display
// Note: This is acceptable runtime checking at the UI boundary for rendering arbitrary metadata
const formatMetadataValue = (value: unknown): string => {
  if (value === null || value === undefined) return 'N/A'
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return String(value)
}

const AssetDetailsPanel: React.FC<AssetDetailsPanelProps> = ({ asset, isOpen, onClose, modelInfo }) => {
  const [copiedId, setCopiedId] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'metadata' | 'actions'>('info')
  

  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }
  
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown'
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  return (
    <div className={`absolute top-0 right-0 h-full w-80 bg-bg-primary bg-opacity-95 backdrop-blur-md shadow-2xl transform transition-all duration-300 ease-out z-20 ${
      isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
    }`}>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="relative p-5 pb-4 border-b border-border-primary bg-gradient-to-r from-bg-secondary to-bg-tertiary">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-bg-hover transition-colors"
            aria-label="Close details panel"
          >
            <X size={18} className="text-text-secondary" />
          </button>
          
          {/* Asset info */}
          <div className="pr-8">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                asset.hasModel ? 'bg-primary bg-opacity-20 text-primary' : 'bg-bg-primary text-text-secondary'
              }`}>
                <Package size={20} />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-text-primary leading-tight">{asset.name}</h2>
                <p className="text-xs text-text-secondary capitalize">{asset.type}</p>
              </div>
            </div>
            
            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {asset.metadata.tier && (
                <div 
                  className="px-2 py-1 rounded-full text-[0.625rem] font-medium flex items-center gap-1"
                  style={{ 
                    backgroundColor: `${getTierColor(asset.metadata.tier)}20`,
                    color: getTierColor(asset.metadata.tier),
                    border: `1px solid ${getTierColor(asset.metadata.tier)}40`
                  }}
                >
                  <Layers size={10} />
                  {asset.metadata.tier}
                </div>
              )}
              {asset.metadata.isPlaceholder && (
                <div className="px-2 py-1 bg-warning bg-opacity-20 text-warning rounded-full text-[0.625rem] font-medium border border-warning border-opacity-40 flex items-center gap-1">
                  <AlertCircle size={10} />
                  Placeholder
                </div>
              )}
              {asset.hasModel && (
                <div className="px-2 py-1 bg-success bg-opacity-20 text-success rounded-full text-[0.625rem] font-medium border border-success border-opacity-40 flex items-center gap-1">
                  <Sparkles size={10} />
                  3D Model
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-border-primary">
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors relative ${
              activeTab === 'info' 
                ? 'text-primary' 
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            Information
            {activeTab === 'info' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('metadata')}
            className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors relative ${
              activeTab === 'metadata' 
                ? 'text-primary' 
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            Metadata
            {activeTab === 'metadata' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors relative ${
              activeTab === 'actions' 
                ? 'text-primary' 
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            Actions
            {activeTab === 'actions' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Information Tab */}
          {activeTab === 'info' && (
            <div className="p-5 space-y-4">
              {/* Basic Info */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 group">
                  <Hash className="text-text-muted mt-0.5" size={14} />
                  <div className="flex-1">
                    <p className="text-[0.625rem] text-text-tertiary uppercase tracking-wider">Asset ID</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-text-secondary font-mono">{asset.id}</p>
                      <button
                        onClick={() => copyToClipboard(asset.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {copiedId ? (
                          <Check size={12} className="text-success" />
                        ) : (
                          <Copy size={12} className="text-text-muted hover:text-text-primary" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Package className="text-text-muted mt-0.5" size={14} />
                  <div className="flex-1">
                    <p className="text-[0.625rem] text-text-tertiary uppercase tracking-wider">Type</p>
                    <p className="text-xs text-text-secondary capitalize">{asset.type}</p>
                  </div>
                </div>
                
                {asset.metadata.subtype && (
                  <div className="flex items-start gap-3">
                    <Tag className="text-text-muted mt-0.5" size={14} />
                    <div className="flex-1">
                      <p className="text-[0.625rem] text-text-tertiary uppercase tracking-wider">Subtype</p>
                      <p className="text-xs text-text-secondary capitalize">{asset.metadata.subtype}</p>
                    </div>
                  </div>
                )}
                
                {asset.metadata.generatedAt && (
                  <div className="flex items-start gap-3">
                    <Calendar className="text-text-muted mt-0.5" size={14} />
                    <div className="flex-1">
                      <p className="text-[0.625rem] text-text-tertiary uppercase tracking-wider">Created</p>
                      <p className="text-xs text-text-secondary">
                        {new Date(asset.metadata.generatedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Model Info */}
              {asset.hasModel && (
                <div className="pt-3 border-t border-border-primary">
                  <h3 className="text-xs font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <Box size={14} className="text-primary" />
                    Model Information
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-text-tertiary text-[0.625rem]">Polygons</p>
                      <p className="text-text-secondary font-medium">
                        {modelInfo?.faces ? modelInfo.faces.toLocaleString() : 'Loading...'}
                      </p>
                    </div>
                    <div>
                      <p className="text-text-tertiary text-[0.625rem]">File Size</p>
                      <p className="text-text-secondary font-medium">
                        {modelInfo?.fileSize ? formatFileSize(modelInfo.fileSize) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-text-tertiary text-[0.625rem]">Format</p>
                      <p className="text-text-secondary font-medium uppercase">
                        {asset.metadata.format || 'GLB'}
                      </p>
                    </div>
                    <div>
                      <p className="text-text-tertiary text-[0.625rem]">Vertices</p>
                      <p className="text-text-secondary font-medium">
                        {modelInfo?.vertices ? modelInfo.vertices.toLocaleString() : 'Loading...'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Metadata Tab */}
          {activeTab === 'metadata' && (
            <div className="p-5">
              {Object.keys(asset.metadata).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(asset.metadata)
                    .filter(([key]) => !['tier', 'subtype', 'isPlaceholder', 'generatedAt', 'polygon_count', 'file_size', 'format', 'lod_count'].includes(key))
                    .map(([key, value]) => (
                      <div key={key} className="py-2 border-b border-border-primary last:border-0">
                        <p className="text-[0.625rem] text-text-tertiary uppercase tracking-wider mb-1">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </p>
                        <p className="text-xs text-text-secondary font-medium">
                          {formatMetadataValue(value)}
                        </p>
                      </div>
                    ))
                  }
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileCode size={32} className="text-text-muted mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-text-tertiary">No additional metadata</p>
                </div>
              )}
            </div>
          )}
          
          {/* Actions Tab */}
          {activeTab === 'actions' && (
            <div className="p-5 space-y-3">
              <button className="w-full px-3 py-2 bg-primary bg-opacity-10 hover:bg-opacity-20 text-primary rounded-lg transition-colors flex items-center justify-between group text-xs font-medium">
                <div className="flex items-center gap-2">
                  <Palette size={14} />
                  <span>Create Variants</span>
                </div>
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
              
              <button className="w-full px-3 py-2 bg-bg-secondary hover:bg-bg-tertiary text-text-primary rounded-lg transition-colors flex items-center justify-between group text-xs font-medium border border-border-primary">
                <div className="flex items-center gap-2">
                  <Download size={14} />
                  <span>Download Model</span>
                </div>
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
              
              <button className="w-full px-3 py-2 bg-bg-secondary hover:bg-bg-tertiary text-text-primary rounded-lg transition-colors flex items-center justify-between group text-xs font-medium border border-border-primary">
                <div className="flex items-center gap-2">
                  <Code size={14} />
                  <span>View in Editor</span>
                </div>
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
              
              <button className="w-full px-3 py-2 bg-bg-secondary hover:bg-bg-tertiary text-text-primary rounded-lg transition-colors flex items-center justify-between group text-xs font-medium border border-border-primary">
                <div className="flex items-center gap-2">
                  <Share2 size={14} />
                  <span>Share Asset</span>
                </div>
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AssetDetailsPanel