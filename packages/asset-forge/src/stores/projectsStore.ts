/**
 * Projects Store
 * Zustand store for project management and filtering
 */

import { create } from 'zustand'

import { ProjectService } from '@/services/api/ProjectService'

export interface Project {
  id: string
  name: string
  description?: string
  type: 'game' | 'animation' | 'vr' | 'other'
  gameStyle?: 'rpg' | 'fps' | 'moba' | 'strategy' | 'platformer' | 'other'
  gameType?: 'multiplayer' | 'singleplayer' | 'coop' | 'pvp'
  artDirection?: 'realistic' | 'cartoon' | 'low-poly' | 'stylized' | 'pixel-art'
  teamSize?: number
  tags?: string[]
  ownerId: string
  teamMembers?: string[]
  isPublic: boolean
  shareId?: string
  assetCount?: number
  createdAt: string
  updatedAt: string
}

export interface ProjectFilters {
  page: number
  limit: number
  type?: string
  gameStyle?: string
  gameType?: string
  teamProjects?: boolean
}

export interface ProjectsState {
  // State
  projects: Project[]
  selectedProject: Project | null
  filters: ProjectFilters
  loading: boolean
  error: string | null

  // Actions
  fetchProjects: (filters?: Partial<ProjectFilters>) => Promise<void>
  createProject: (data: {
    name: string
    description?: string
    type: Project['type']
    gameStyle?: Project['gameStyle']
    gameType?: Project['gameType']
    artDirection?: Project['artDirection']
    teamSize?: number
    tags?: string[]
    isPublic?: boolean
  }) => Promise<Project>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  shareProject: (id: string) => Promise<{ shareId: string; shareUrl: string }>
  selectProject: (project: Project | null) => void
  setFilters: (filters: Partial<ProjectFilters>) => void
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  // Initial state
  projects: [],
  selectedProject: null,
  filters: {
    page: 1,
    limit: 20
  },
  loading: false,
  error: null,

  // Fetch projects with filters
  fetchProjects: async (filters) => {
    set({ loading: true, error: null })
    const currentFilters = { ...get().filters, ...filters }
    set({ filters: currentFilters })

    try {
      const projects = await ProjectService.getProjects(currentFilters)
      set({ projects, loading: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch projects'
      set({ error: errorMessage, loading: false })
      throw error
    }
  },

  // Create new project
  createProject: async (data) => {
    set({ loading: true, error: null })
    try {
      const project = await ProjectService.createProject(data)
      set((state) => ({
        projects: [project, ...state.projects],
        selectedProject: project,
        loading: false
      }))
      return project
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create project'
      set({ error: errorMessage, loading: false })
      throw error
    }
  },

  // Update existing project
  updateProject: async (id, updates) => {
    set({ loading: true, error: null })
    try {
      const updatedProject = await ProjectService.updateProject(id, updates)
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? updatedProject : p)),
        selectedProject: state.selectedProject?.id === id ? updatedProject : state.selectedProject,
        loading: false
      }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update project'
      set({ error: errorMessage, loading: false })
      throw error
    }
  },

  // Delete project
  deleteProject: async (id) => {
    set({ loading: true, error: null })
    try {
      await ProjectService.deleteProject(id)
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        selectedProject: state.selectedProject?.id === id ? null : state.selectedProject,
        loading: false
      }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete project'
      set({ error: errorMessage, loading: false })
      throw error
    }
  },

  // Share project
  shareProject: async (id) => {
    set({ loading: true, error: null })
    try {
      const result = await ProjectService.shareProject(id)
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, shareId: result.shareId, isPublic: true } : p
        ),
        selectedProject:
          state.selectedProject?.id === id
            ? { ...state.selectedProject, shareId: result.shareId, isPublic: true }
            : state.selectedProject,
        loading: false
      }))
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to share project'
      set({ error: errorMessage, loading: false })
      throw error
    }
  },

  // Select a project
  selectProject: (project) => {
    set({ selectedProject: project })
  },

  // Update filters
  setFilters: (filters) => {
    set((state) => ({
      filters: { ...state.filters, ...filters }
    }))
  }
}))
