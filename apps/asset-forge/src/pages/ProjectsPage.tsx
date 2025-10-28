/**
 * Projects Page
 * Project management and collaboration
 */

import { FolderOpen, Plus, Grid, List, Clock, Star } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge, Modal, ModalHeader, ModalBody, ModalFooter, Input, Textarea } from '@/components/common'
import { useProjectsStore } from '../stores/useProjectsStore'
import { useNavigationStore } from '../stores/useNavigationStore'
import { usePrivy } from '@privy-io/react-auth'

export function ProjectsPage() {
  const { user } = usePrivy()
  const { projects, isLoading, fetchProjects, createProject } = useProjectsStore()
  const navigateTo = useNavigationStore(state => state.navigateTo)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '' })
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) return

    setIsCreating(true)
    setCreateError(null)
    try {
      await createProject({
        name: newProject.name,
        description: newProject.description,
        status: 'active',
        userId: user?.id || ''
      })
      setShowCreateModal(false)
      setNewProject({ name: '', description: '' })
      setCreateError(null)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create project')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="bg-bg-secondary border-b border-border-primary backdrop-blur-md">
        <div className="max-w-[1920px] mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20 backdrop-blur-sm">
                <FolderOpen className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-text-primary">Projects</h1>
                <p className="text-text-secondary mt-1">Organize and manage your asset collections</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-bg-tertiary rounded-lg p-1 border border-border-primary">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              <Button
                variant="primary"
                className="gap-2"
                onClick={() => setShowCreateModal(true)}
                disabled={isLoading}
              >
                <Plus className="w-4 h-4" />
                New Project
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1920px] mx-auto px-6 py-6">
        {isLoading && projects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-secondary">Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen className="w-16 h-16 text-text-tertiary mx-auto mb-4" />
            <p className="text-text-secondary mb-4">No projects yet. Create your first project to organize your assets!</p>
            <Button
              variant="primary"
              className="gap-2"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-4 h-4" />
              Create Project
            </Button>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
            {projects.map(project => (
            <Card key={project.id} className="bg-bg-secondary border-border-primary backdrop-blur-md hover:border-primary/50 transition-all">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-5 h-5 text-primary" />
                    <CardTitle>{project.name}</CardTitle>
                  </div>
                  <Star className="w-4 h-4 text-text-tertiary hover:text-warning cursor-pointer" />
                </div>
                <CardDescription>{project.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-text-secondary">
                    <Grid className="w-4 h-4" />
                    <span>{project.assetCount} assets</span>
                  </div>
                  <div className="flex items-center gap-1 text-text-secondary">
                    <Clock className="w-4 h-4" />
                    <span>{project.lastModified}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between">
                <Badge variant={project.status === 'active' ? 'success' : 'secondary'}>
                  {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateTo('/assets')}
                >
                  Open
                </Button>
              </CardFooter>
            </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} size="md">
        <ModalHeader title="Create New Project" onClose={() => setShowCreateModal(false)} />
        <ModalBody>
          <div className="space-y-4">
            {createError && (
              <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg">
                <p className="text-red-400 text-sm">{createError}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Project Name
              </label>
              <Input
                type="text"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                placeholder="Enter project name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newProject.name.trim()) {
                    handleCreateProject()
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Description
              </label>
              <Textarea
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                placeholder="Enter project description (optional)"
                rows={4}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setShowCreateModal(false)
              setNewProject({ name: '', description: '' })
              setCreateError(null)
            }}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateProject}
            disabled={isCreating || !newProject.name.trim()}
          >
            {isCreating ? 'Creating...' : 'Create Project'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
