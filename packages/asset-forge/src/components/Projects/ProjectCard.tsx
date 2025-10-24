/**
 * Project Card Component
 * Displays a project with thumbnail, info, and action buttons
 */

import { Edit2, Trash2, Users, Lock, Globe, Package } from 'lucide-react'

interface ProjectCardProps {
  project: {
    id: string
    name: string
    description: string | null
    type: string
    gameStyle: string | null
    gameType: string | null
    thumbnail: string | null
    assetCount: number
    isPublic: boolean
    teamId: string | null
  }
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

const TYPE_COLORS: Record<string, string> = {
  character: 'bg-purple-900/30 text-purple-400 border-purple-700/50',
  weapon: 'bg-red-900/30 text-red-400 border-red-700/50',
  armor: 'bg-blue-900/30 text-blue-400 border-blue-700/50',
  item: 'bg-green-900/30 text-green-400 border-green-700/50',
  environment: 'bg-teal-900/30 text-teal-400 border-teal-700/50',
  mixed: 'bg-orange-900/30 text-orange-400 border-orange-700/50',
}

const STYLE_LABELS: Record<string, string> = {
  'pixel-art': 'Pixel Art',
  'low-poly': 'Low Poly',
  'realistic': 'Realistic',
  'stylized': 'Stylized',
  'cartoon': 'Cartoon',
  'anime': 'Anime',
  'voxel': 'Voxel',
  'hand-painted': 'Hand-Painted',
}

const GAME_TYPE_LABELS: Record<string, string> = {
  'rpg': 'RPG',
  'fps': 'FPS',
  'strategy': 'Strategy',
  'platformer': 'Platformer',
  'mmo': 'MMO',
  'battle-royale': 'Battle Royale',
  'moba': 'MOBA',
  'racing': 'Racing',
  'survival': 'Survival',
}

export function ProjectCard({ project, onEdit, onDelete }: ProjectCardProps) {
  return (
    <div className="group bg-bg-secondary rounded-lg overflow-hidden border border-border-primary hover:border-border-primary transition-all hover:shadow-lg">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-bg-primary">
        {project.thumbnail ? (
          <img
            src={project.thumbnail}
            alt={project.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-gray-700" />
          </div>
        )}

        {/* Hover Actions */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={() => onEdit(project.id)}
            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            title="Edit project"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(project.id)}
            className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            title="Delete project"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Badges */}
        <div className="absolute top-2 right-2 flex gap-2">
          {project.teamId && (
            <div
              className="p-1.5 bg-purple-900/80 backdrop-blur-sm rounded"
              title="Team project"
            >
              <Users className="w-3 h-3 text-purple-300" />
            </div>
          )}
          {project.isPublic ? (
            <div
              className="p-1.5 bg-green-900/80 backdrop-blur-sm rounded"
              title="Public project"
            >
              <Globe className="w-3 h-3 text-green-300" />
            </div>
          ) : (
            <div
              className="p-1.5 bg-bg-primary/80 backdrop-blur-sm rounded"
              title="Private project"
            >
              <Lock className="w-3 h-3 text-text-secondary" />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3 className="text-lg font-semibold text-white mb-2 line-clamp-1">
          {project.name}
        </h3>

        {/* Description */}
        {project.description && (
          <p className="text-sm text-text-secondary mb-3 line-clamp-2">
            {project.description}
          </p>
        )}

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          {/* Type Badge */}
          <span
            className={`px-2 py-1 rounded text-xs font-medium border ${
              TYPE_COLORS[project.type] || 'bg-bg-tertiary text-text-primary border-border-primary'
            }`}
          >
            {project.type}
          </span>

          {/* Game Style Badge */}
          {project.gameStyle && (
            <span className="px-2 py-1 bg-bg-tertiary text-text-primary rounded text-xs border border-border-primary">
              {STYLE_LABELS[project.gameStyle] || project.gameStyle}
            </span>
          )}

          {/* Game Type Badge */}
          {project.gameType && (
            <span className="px-2 py-1 bg-bg-tertiary text-text-primary rounded text-xs border border-border-primary">
              {GAME_TYPE_LABELS[project.gameType] || project.gameType}
            </span>
          )}
        </div>

        {/* Asset Count */}
        <div className="flex items-center gap-2 text-sm">
          <Package className="w-4 h-4 text-text-tertiary" />
          <span className="text-text-secondary">
            <span className="text-white font-medium">{project.assetCount}</span>{' '}
            {project.assetCount === 1 ? 'asset' : 'assets'}
          </span>
        </div>
      </div>
    </div>
  )
}
