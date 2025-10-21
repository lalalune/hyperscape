/**
 * Manifest Selector
 * Tab-style selector for switching between different manifest types
 */

import {
  Database,
  Ghost,
  Users,
  TreePine,
  Map as MapIcon,
  Mountain,
  MapPin,
  Building2,
  Store
} from 'lucide-react'
import React from 'react'

import type { ManifestType } from '../../types/manifests'

interface ManifestSelectorProps {
  selectedType: ManifestType | null
  onSelect: (type: ManifestType) => void
  stats: Record<ManifestType, number>
}

const MANIFEST_TYPES: Array<{
  type: ManifestType
  label: string
  icon: React.ReactNode
}> = [
  { type: 'items', label: 'Items', icon: <Database size={18} /> },
  { type: 'mobs', label: 'Mobs', icon: <Ghost size={18} /> },
  { type: 'npcs', label: 'NPCs', icon: <Users size={18} /> },
  { type: 'resources', label: 'Resources', icon: <TreePine size={18} /> },
  { type: 'world-areas', label: 'World Areas', icon: <MapIcon size={18} /> },
  { type: 'biomes', label: 'Biomes', icon: <Mountain size={18} /> },
  { type: 'zones', label: 'Zones', icon: <MapPin size={18} /> },
  { type: 'banks', label: 'Banks', icon: <Building2 size={18} /> },
  { type: 'stores', label: 'Stores', icon: <Store size={18} /> },
]

export const ManifestSelector: React.FC<ManifestSelectorProps> = ({
  selectedType,
  onSelect,
  stats
}) => {
  return (
    <div className="bg-bg-secondary border border-border-primary rounded-xl p-3 shadow-theme-sm">
      <div className="flex flex-wrap gap-2">
        {MANIFEST_TYPES.map(({ type, label, icon }) => (
          <button
            key={type}
            onClick={() => onSelect(type)}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
              transition-all duration-base
              ${
                selectedType === type
                  ? 'bg-primary bg-opacity-10 text-primary border-2 border-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border-2 border-transparent'
              }
            `}
          >
            {icon}
            <span>{label}</span>
            <span className={`
              ml-1 px-2 py-0.5 rounded-full text-xs font-semibold
              ${
                selectedType === type
                  ? 'bg-primary bg-opacity-20 text-primary'
                  : 'bg-bg-tertiary text-text-tertiary'
              }
            `}>
              {stats[type] || 0}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

