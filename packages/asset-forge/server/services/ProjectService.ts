/**
 * Project Service
 * Handles project CRUD operations with ownership verification
 */

import { db } from '../db/db'
import { projects, type Project, type NewProject } from '../db/schema'
import { eq, and } from 'drizzle-orm'

export class ProjectService {
  /**
   * Create new project
   */
  async createProject(name: string, ownerId: string, description?: string): Promise<Project> {
    const [project] = await db.insert(projects).values({
      name,
      description,
      ownerId,
      status: 'active'
    }).returning()

    console.log(`[ProjectService] Created project: ${project.id}`)
    return project
  }

  /**
   * Get all active/archived projects for a user
   */
  async getProjectsByOwner(ownerId: string): Promise<Project[]> {
    const userProjects = await db.select().from(projects)
      .where(
        and(
          eq(projects.ownerId, ownerId),
          // Exclude deleted projects
          eq(projects.status, 'active')
        )
      )
      .orderBy(projects.createdAt)

    return userProjects
  }

  /**
   * Get single project with ownership verification
   */
  async getProject(projectId: string, userId: string): Promise<Project | null> {
    const [project] = await db.select().from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.ownerId, userId)
        )
      )
      .limit(1)

    return project || null
  }

  /**
   * Update project
   */
  async updateProject(projectId: string, userId: string, updates: Partial<NewProject>): Promise<Project | null> {
    // Verify ownership
    const existing = await this.getProject(projectId, userId)
    if (!existing) {
      return null
    }

    const [updated] = await db.update(projects)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(projects.id, projectId))
      .returning()

    console.log(`[ProjectService] Updated project: ${projectId}`)
    return updated
  }

  /**
   * Delete project (soft delete - sets status to 'deleted')
   */
  async deleteProject(projectId: string, userId: string): Promise<void> {
    // Verify ownership
    const existing = await this.getProject(projectId, userId)
    if (!existing) {
      throw new Error('Project not found or access denied')
    }

    await db.update(projects)
      .set({
        status: 'deleted',
        updatedAt: new Date()
      })
      .where(eq(projects.id, projectId))

    console.log(`[ProjectService] Deleted project: ${projectId}`)
  }

  /**
   * Archive project
   */
  async archiveProject(projectId: string, userId: string): Promise<Project> {
    const existing = await this.getProject(projectId, userId)
    if (!existing) {
      throw new Error('Project not found or access denied')
    }

    const [archived] = await db.update(projects)
      .set({
        status: 'archived',
        archivedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(projects.id, projectId))
      .returning()

    return archived
  }
}

// Export singleton instance
export const projectService = new ProjectService()
