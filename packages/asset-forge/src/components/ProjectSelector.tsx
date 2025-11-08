/**
 * ProjectSelector Component
 * Dropdown for selecting and filtering by project
 */

import React, { useState, useEffect } from 'react'
import { ChevronDown, Plus, FolderOpen } from 'lucide-react'

interface Project {
  id: string
  name: string
  description?: string
}

interface ProjectSelectorProps {
  selectedProjectId: string | null
  onProjectChange: (projectId: string | null) => void
  onCreateNew?: () => void
}

export function ProjectSelector({
  selectedProjectId,
  onProjectChange,
  onCreateNew
}: ProjectSelectorProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)

  const fetchProjects = async () => {
    try {
      const token = (window as any).privyAuthManager?.getToken()
      if (!token) {
        setProjects([])
        setLoading(false)
        return
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3004'
      const response = await fetch(`${apiUrl}/api/projects`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setProjects(data)
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  const selectedProject = projects.find(p => p.id === selectedProjectId)
  const displayText = selectedProject?.name || 'All Assets'

  const handleSelect = (projectId: string | null) => {
    onProjectChange(projectId)
    setIsOpen(false)
  }

  const handleCreateNew = () => {
    setIsOpen(false)
    onCreateNew?.()
  }

  if (loading) {
    return (
      <div className="px-3 py-2 text-sm text-text-tertiary">
        Loading projects...
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-bg-secondary border border-border-primary rounded-md text-sm text-text-primary hover:bg-bg-tertiary transition-colors"
      >
        <FolderOpen size={16} />
        <span>{displayText}</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown menu */}
          <div className="absolute top-full mt-1 left-0 min-w-[200px] bg-bg-secondary border border-border-primary rounded-lg shadow-theme-lg z-50">
            <div className="py-1">
              {/* All Assets option */}
              <button
                onClick={() => handleSelect(null)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  !selectedProjectId
                    ? 'bg-primary bg-opacity-10 text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                }`}
              >
                <FolderOpen size={16} />
                <span>All Assets</span>
              </button>

              {/* Project list */}
              {projects.map(project => (
                <button
                  key={project.id}
                  onClick={() => handleSelect(project.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    selectedProjectId === project.id
                      ? 'bg-primary bg-opacity-10 text-primary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                  }`}
                >
                  <FolderOpen size={16} />
                  <span className="truncate">{project.name}</span>
                </button>
              ))}

              {/* Create new project */}
              {onCreateNew && (
                <>
                  <div className="my-1 border-t border-border-primary" />
                  <button
                    onClick={handleCreateNew}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-bg-tertiary transition-colors"
                  >
                    <Plus size={16} />
                    <span>Create New Project</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Expose fetchProjects for external refresh
export const refreshProjects = (selector: any) => {
  if (selector && typeof selector.fetchProjects === 'function') {
    selector.fetchProjects()
  }
}
