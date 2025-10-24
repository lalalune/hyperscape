/**
 * Project Service
 * API calls for project CRUD operations
 */

import type { Project, ProjectFilters } from '@/stores/projectsStore'
import { BaseAPIService } from './BaseAPIService'

interface CreateProjectData {
  name: string
  description?: string
  type: 'game' | 'animation' | 'vr' | 'other'
  gameStyle?: 'rpg' | 'fps' | 'moba' | 'strategy' | 'platformer' | 'other'
  gameType?: 'multiplayer' | 'singleplayer' | 'coop' | 'pvp'
  artDirection?: 'realistic' | 'cartoon' | 'low-poly' | 'stylized' | 'pixel-art'
  teamSize?: number
  tags?: string[]
  isPublic?: boolean
}

class ProjectServiceClass extends BaseAPIService {
  constructor() {
    super('/api/projects')
  }

  /**
   * Create a new project
   */
  async createProject(data: CreateProjectData): Promise<Project> {
    return this.create<Project>(data)
  }

  /**
   * Get all projects with optional filters
   */
  async getProjects(filters?: Partial<ProjectFilters>): Promise<Project[]> {
    return this.list<Project>(filters, { timeout: 15000 })
  }

  /**
   * Get a single project by ID
   */
  async getProject(id: string): Promise<Project> {
    return this.getById<Project>(id)
  }

  /**
   * Update an existing project
   */
  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    return this.update<Project>(id, updates)
  }

  /**
   * Delete a project
   */
  async deleteProject(id: string): Promise<void> {
    return this.deleteById(id)
  }

  /**
   * Share a project (generates public share link)
   */
  async shareProject(id: string): Promise<{ shareId: string; shareUrl: string }> {
    return this.post<{ shareId: string; shareUrl: string }>(`${id}/share`)
  }
}

export const ProjectService = new ProjectServiceClass()
