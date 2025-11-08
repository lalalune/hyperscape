/**
 * ProjectModal Component
 * Modal for creating and editing projects
 */

import React, { useState, useEffect } from 'react'

import { Modal, ModalHeader, ModalBody, ModalFooter } from './common/Modal'
import { Button } from './common/Button'
import { Input } from './common/Input'

interface Project {
  id: string
  name: string
  description?: string
  status: string
  createdAt: string
  updatedAt: string
}

interface ProjectModalProps {
  open: boolean
  onClose: () => void
  onSave: () => void
  project?: Project | null
}

export function ProjectModal({ open, onClose, onSave, project }: ProjectModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditMode = !!project

  // Initialize form with project data if editing
  useEffect(() => {
    if (project) {
      setName(project.name)
      setDescription(project.description || '')
    } else {
      setName('')
      setDescription('')
    }
    setError(null)
  }, [project, open])

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Project name is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const token = (window as any).privyAuthManager?.getToken()
      if (!token) {
        throw new Error('Authentication required')
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3004'
      const url = isEditMode
        ? `${apiUrl}/api/projects/${project.id}`
        : `${apiUrl}/api/projects`

      const response = await fetch(url, {
        method: isEditMode ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to save project')
      }

      // Success - close modal and refresh
      onSave()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <ModalHeader
        title={isEditMode ? 'Edit Project' : 'Create New Project'}
        onClose={onClose}
      />

      <ModalBody>
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-500 bg-opacity-10 border border-red-500 rounded-md text-red-500 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Project Name <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Game Assets"
              maxLength={255}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of this project"
              className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-md text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              rows={3}
              disabled={loading}
            />
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Project'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
