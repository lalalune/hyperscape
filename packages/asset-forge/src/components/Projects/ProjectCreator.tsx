/**
 * Project Creator Component
 * Modal for creating and editing projects
 */

import { X, Save, Loader2, Globe, Lock } from 'lucide-react'
import { useState } from 'react'

import { GameStyleSelector } from './GameStyleSelector'

import { apiFetch } from '@/utils/api'

interface Project {
  id: string
  name: string
  description: string | null
  type: string
  gameStyle: string | null
  gameType: string | null
  artDirection: string | null
  thumbnail: string | null
  isPublic: boolean
}

interface ProjectCreatorProps {
  project: Project | null
  onClose: () => void
  onSave: () => void
}

const PROJECT_TYPES = [
  { value: 'character', label: 'Character', emoji: '👤' },
  { value: 'weapon', label: 'Weapon', emoji: '⚔️' },
  { value: 'armor', label: 'Armor', emoji: '🛡️' },
  { value: 'item', label: 'Item', emoji: '💎' },
  { value: 'environment', label: 'Environment', emoji: '🏔️' },
  { value: 'mixed', label: 'Mixed', emoji: '📦' },
]

const GAME_TYPES = [
  { value: 'rpg', label: 'RPG', emoji: '🗡️' },
  { value: 'fps', label: 'FPS', emoji: '🎯' },
  { value: 'strategy', label: 'Strategy', emoji: '♟️' },
  { value: 'platformer', label: 'Platformer', emoji: '🏃' },
  { value: 'mmo', label: 'MMO', emoji: '🌍' },
  { value: 'battle-royale', label: 'Battle Royale', emoji: '💥' },
  { value: 'moba', label: 'MOBA', emoji: '⚡' },
  { value: 'racing', label: 'Racing', emoji: '🏎️' },
  { value: 'survival', label: 'Survival', emoji: '🔥' },
]

export function ProjectCreator({ project, onClose, onSave }: ProjectCreatorProps) {
  const isEditing = !!project

  // Form state
  const [name, setName] = useState(project?.name || '')
  const [description, setDescription] = useState(project?.description || '')
  const [type, setType] = useState(project?.type || 'mixed')
  const [gameStyle, setGameStyle] = useState<string | null>(project?.gameStyle || null)
  const [gameType, setGameType] = useState(project?.gameType || '')
  const [artDirection, setArtDirection] = useState(project?.artDirection || '')
  const [isPublic, setIsPublic] = useState(project?.isPublic || false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || name.trim().length < 3) {
      setError('Project name must be at least 3 characters long')
      return
    }

    if (!type) {
      setError('Please select a project type')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        type,
        gameStyle: gameStyle || null,
        gameType: gameType || null,
        artDirection: artDirection.trim() || null,
        isPublic,
      }

      const url = isEditing ? `/api/projects/${project.id}` : '/api/projects'
      const method = isEditing ? 'PUT' : 'POST'

      const response = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to save project')
      }

      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-bg-secondary rounded-lg max-w-3xl w-full shadow-xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-primary">
          <h2 className="text-xl font-bold text-text-primary">
            {isEditing ? 'Edit Project' : 'Create New Project'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-text-secondary hover:text-white hover:bg-bg-tertiary rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Project Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Game Assets"
              className="w-full px-4 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your project..."
              rows={3}
              className="w-full px-4 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Project Type <span className="text-red-400">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-4 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {PROJECT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.emoji} {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Game Style */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-3">
              Game Style (Optional)
            </label>
            <GameStyleSelector value={gameStyle} onChange={setGameStyle} />
          </div>

          {/* Game Type */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Game Type (Optional)
            </label>
            <select
              value={gameType}
              onChange={(e) => setGameType(e.target.value)}
              className="w-full px-4 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a game type...</option>
              {GAME_TYPES.map((gt) => (
                <option key={gt.value} value={gt.value}>
                  {gt.emoji} {gt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Art Direction */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Art Direction (Optional)
            </label>
            <textarea
              value={artDirection}
              onChange={(e) => setArtDirection(e.target.value)}
              placeholder="e.g., Dark fantasy with medieval themes, vibrant colors..."
              rows={3}
              className="w-full px-4 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="text-xs text-text-secondary mt-1">
              Provide context for AI generation to maintain consistent style
            </p>
          </div>

          {/* Public/Private Toggle */}
          <div className="flex items-center justify-between p-4 bg-bg-tertiary/50 rounded-lg">
            <div className="flex items-center gap-3">
              {isPublic ? (
                <Globe className="w-5 h-5 text-green-400" />
              ) : (
                <Lock className="w-5 h-5 text-text-secondary" />
              )}
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {isPublic ? 'Public Project' : 'Private Project'}
                </p>
                <p className="text-xs text-text-secondary">
                  {isPublic
                    ? 'Visible to everyone'
                    : 'Only visible to you and your team'}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-bg-tertiary hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim() || !type}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isEditing ? 'Update Project' : 'Create Project'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
