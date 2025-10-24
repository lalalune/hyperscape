/**
 * GitHub Integration Service - OPTIMIZED
 * 
 * Manages GitHub repository creation and project synchronization
 * 
 * Features:
 * - Automatic repository creation
 * - Project asset syncing
 * - Detailed sync logging
 * - Error recovery
 * - Rate limit handling
 */

import { Octokit } from '@octokit/rest'
import { db, schema } from '../db/index.mjs'
import { eq, and } from 'drizzle-orm'
import { credentialService } from './CredentialService-optimized.mjs'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs/promises'

export class GitHubService {
  /**
   * Create a GitHub repository for a project
   * 
   * @param {string} userId - User ID
   * @param {string} projectId - Project ID
   * @param {Object} options - Repository options
   * @returns {Promise<Object>} Repository information
   */
  async createRepository(userId, projectId, options = {}) {
    const {
      repoName,
      description,
      isPrivate = true,
      autoInit = true,
      license,
      gitignore = 'Node',
    } = options
    
    // Get GitHub credentials
    const credentials = await credentialService.getCredentials(userId, 'github')
    
    if (!credentials) {
      throw new Error('GitHub credentials not found. Please add your GitHub PAT token in Settings.')
    }
    
    if (!credentials.isVerified) {
      // Try to validate
      const validation = await credentialService.validateCredential(credentials.id)
      if (!validation.isValid) {
        throw new Error(`GitHub token is invalid: ${validation.errorMessage}`)
      }
    }
    
    // Get project details
    const project = await db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    })
    
    if (!project) {
      throw new Error('Project not found')
    }
    
    if (project.userId !== userId) {
      throw new Error('Unauthorized: Project does not belong to user')
    }
    
    // Initialize Octokit
    const octokit = new Octokit({
      auth: credentials.key,
      userAgent: 'Asset-Forge v1.0',
      request: {
        timeout: 10000, // 10 second timeout
      },
    })
    
    // Get GitHub user info
    const { data: githubUser } = await octokit.rest.users.getAuthenticated()
    const owner = githubUser.login
    
    // Generate repository name if not provided
    const finalRepoName = repoName || 
      this.generateRepoName(project.name, credentials.metadata?.githubRepoPrefix)
    
    // Check if repository already exists
    try {
      await octokit.rest.repos.get({
        owner,
        repo: finalRepoName,
      })
      throw new Error(`Repository '${finalRepoName}' already exists`)
    } catch (error) {
      // 404 is expected - repository doesn't exist yet
      if (error.status !== 404) {
        throw error
      }
    }
    
    // Create repository
    const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
      name: finalRepoName,
      description: description || project.description || `Generated assets for ${project.name}`,
      private: isPrivate,
      auto_init: autoInit,
      license_template: license,
      gitignore_template: gitignore,
    })
    
    // Store repository info in database
    const repoId = `repo_${crypto.randomBytes(16).toString('hex')}`
    const repoData = {
      id: repoId,
      userId,
      projectId,
      credentialId: credentials.id,
      owner: repo.owner.login,
      repoName: repo.name,
      repoFullName: repo.full_name,
      repoUrl: repo.html_url,
      cloneUrl: repo.clone_url,
      description: repo.description,
      isPrivate: repo.private,
      defaultBranch: repo.default_branch,
      githubId: repo.id,
      autoSync: true,
      syncStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    
    await db.insert(schema.githubRepositories).values(repoData)
    
    // Perform initial sync
    try {
      await this.syncProjectToRepository(userId, projectId, repoId)
    } catch (error) {
      console.warn('[GitHub] Initial sync failed:', error.message)
      // Don't throw - repository is created, sync can be retried
    }
    
    return {
      id: repoId,
      name: repo.name,
      fullName: repo.full_name,
      url: repo.html_url,
      cloneUrl: repo.clone_url,
      private: repo.private,
      defaultBranch: repo.default_branch,
    }
  }
  
  /**
   * Sync project assets to GitHub repository
   * 
   * @param {string} userId - User ID
   * @param {string} projectId - Project ID
   * @param {string} repositoryId - Repository ID
   * @returns {Promise<Object>} Sync result
   */
  async syncProjectToRepository(userId, projectId, repositoryId) {
    const startTime = Date.now()
    const syncLogId = `sync_${crypto.randomBytes(12).toString('hex')}`
    
    let syncLog = {
      id: syncLogId,
      repositoryId,
      status: 'success',
      filesAdded: 0,
      filesModified: 0,
      filesDeleted: 0,
      totalBytes: 0,
      startedAt: new Date(startTime),
      completedAt: null,
      duration: null,
      errorMessage: null,
    }
    
    try {
      // Update repository sync status
      await db.update(schema.githubRepositories)
        .set({ 
          syncStatus: 'syncing',
          updatedAt: new Date(),
        })
        .where(eq(schema.githubRepositories.id, repositoryId))
      
      // Get repository and credentials
      const repository = await db.query.githubRepositories.findFirst({
        where: eq(schema.githubRepositories.id, repositoryId),
      })
      
      if (!repository) {
        throw new Error('Repository not found')
      }
      
      const credentials = await credentialService.getCredentials(userId, 'github')
      if (!credentials) {
        throw new Error('GitHub credentials not found')
      }
      
      const octokit = new Octokit({
        auth: credentials.key,
        userAgent: 'Asset-Forge v1.0',
      })
      
      // Get project and assets
      const project = await db.query.projects.findFirst({
        where: eq(schema.projects.id, projectId),
      })
      
      const assets = await db.query.assets.findMany({
        where: eq(schema.assets.projectId, projectId),
      })
      
      // Prepare files to sync
      const filesToSync = []
      
      // 1. Create README.md
      const readmeContent = this.generateProjectReadme(project, assets)
      filesToSync.push({
        path: 'README.md',
        content: readmeContent,
        message: 'Update project README',
      })
      syncLog.totalBytes += Buffer.byteLength(readmeContent, 'utf8')
      
      // 2. Create project.json metadata
      const projectMetadata = this.generateProjectMetadata(project, assets)
      filesToSync.push({
        path: 'project.json',
        content: JSON.stringify(projectMetadata, null, 2),
        message: 'Update project metadata',
      })
      syncLog.totalBytes += Buffer.byteLength(JSON.stringify(projectMetadata), 'utf8')
      
      // 3. Create assets manifest
      const assetsManifest = this.generateAssetsManifest(assets)
      filesToSync.push({
        path: 'assets/manifest.json',
        content: JSON.stringify(assetsManifest, null, 2),
        message: 'Update assets manifest',
      })
      syncLog.totalBytes += Buffer.byteLength(JSON.stringify(assetsManifest), 'utf8')
      
      // 4. Create individual asset README files
      for (const asset of assets) {
        if (asset.status === 'completed') {
          const assetReadme = this.generateAssetReadme(asset)
          filesToSync.push({
            path: `assets/${this.sanitizeFilename(asset.name)}/README.md`,
            content: assetReadme,
            message: `Add documentation for ${asset.name}`,
          })
          syncLog.totalBytes += Buffer.byteLength(assetReadme, 'utf8')
        }
      }
      
      // 5. Create .gitattributes for LFS (if needed)
      filesToSync.push({
        path: '.gitattributes',
        content: '*.glb filter=lfs diff=lfs merge=lfs -text\n*.png filter=lfs diff=lfs merge=lfs -text\n',
        message: 'Configure Git LFS for large files',
      })
      
      // Upload files
      for (const file of filesToSync) {
        try {
          // Check if file exists
          let sha
          try {
            const { data: existing } = await octokit.rest.repos.getContent({
              owner: repository.owner,
              repo: repository.repoName,
              path: file.path,
              ref: repository.defaultBranch,
            })
            sha = existing.sha
            syncLog.filesModified++
          } catch (error) {
            if (error.status === 404) {
              // File doesn't exist - will be created
              syncLog.filesAdded++
            } else {
              throw error
            }
          }
          
          // Create or update file
          await octokit.rest.repos.createOrUpdateFileContents({
            owner: repository.owner,
            repo: repository.repoName,
            path: file.path,
            message: file.message || `Update ${file.path}`,
            content: Buffer.from(file.content).toString('base64'),
            sha,
            branch: repository.defaultBranch,
          })
          
          // Rate limit protection
          await this.sleep(100)
          
        } catch (error) {
          console.error(`[GitHub] Failed to sync file ${file.path}:`, error.message)
          syncLog.status = 'partial'
          // Continue with other files
        }
      }
      
      // Update repository sync status
      await db.update(schema.githubRepositories)
        .set({
          syncStatus: 'synced',
          lastSyncAt: new Date(),
          syncCount: repository.syncCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(schema.githubRepositories.id, repositoryId))
      
      syncLog.completedAt = new Date()
      syncLog.duration = Date.now() - startTime
      
      // Save sync log
      await db.insert(schema.repositorySyncLog).values(syncLog)
      
      return {
        success: true,
        filesAdded: syncLog.filesAdded,
        filesModified: syncLog.filesModified,
        totalBytes: syncLog.totalBytes,
        duration: syncLog.duration,
      }
      
    } catch (error) {
      // Update error status
      syncLog.status = 'failed'
      syncLog.errorMessage = error.message
      syncLog.errorStack = error.stack
      syncLog.completedAt = new Date()
      syncLog.duration = Date.now() - startTime
      
      await db.insert(schema.repositorySyncLog).values(syncLog)
      
      await db.update(schema.githubRepositories)
        .set({
          syncStatus: 'error',
          lastSyncError: error.message,
          updatedAt: new Date(),
        })
        .where(eq(schema.githubRepositories.id, repositoryId))
      
      throw error
    }
  }
  
  /**
   * List user's GitHub repositories
   */
  async listUserRepositories(userId) {
    return await db.query.githubRepositories.findMany({
      where: eq(schema.githubRepositories.userId, userId),
      orderBy: (repos, { desc }) => [desc(repos.createdAt)],
    })
  }
  
  /**
   * Get repository sync history
   */
  async getSyncHistory(repositoryId, limit = 10) {
    return await db.query.repositorySyncLog.findMany({
      where: eq(schema.repositorySyncLog.repositoryId, repositoryId),
      orderBy: (logs, { desc }) => [desc(logs.startedAt)],
      limit,
    })
  }
  
  /**
   * Delete repository (soft delete from our database, actual GitHub repo is kept)
   */
  async deleteRepository(repositoryId, userId) {
    const repository = await db.query.githubRepositories.findFirst({
      where: and(
        eq(schema.githubRepositories.id, repositoryId),
        eq(schema.githubRepositories.userId, userId)
      ),
    })
    
    if (!repository) {
      throw new Error('Repository not found or unauthorized')
    }
    
    // Soft delete - remove from our database but keep on GitHub
    await db.delete(schema.githubRepositories)
      .where(eq(schema.githubRepositories.id, repositoryId))
  }
  
  /**
   * Generate repository name from project name
   */
  generateRepoName(projectName, prefix = 'asset-forge') {
    const sanitized = projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 80)
    
    return `${prefix}-${sanitized}`
  }
  
  /**
   * Generate project README content
   */
  generateProjectReadme(project, assets) {
    const completedAssets = assets.filter(a => a.status === 'completed')
    const tags = project.tags ? JSON.parse(project.tags) : []
    
    return `# ${project.name}

${project.description || 'AI-generated 3D assets created with Asset Forge'}

![Asset Forge](https://img.shields.io/badge/Generated%20with-Asset%20Forge-blue)
![Assets](https://img.shields.io/badge/Assets-${completedAssets.length}-green)
![Type](https://img.shields.io/badge/Type-${project.type}-orange)

## 📋 Project Details

- **Type**: ${project.type}
- **Total Assets**: ${assets.length}
- **Completed Assets**: ${completedAssets.length}
- **Created**: ${new Date(project.createdAt).toLocaleDateString()}
${tags.length > 0 ? `- **Tags**: ${tags.join(', ')}` : ''}

## 🎨 Assets

${completedAssets.length > 0 ? completedAssets.map(asset => 
`### ${asset.name}
- **Type**: ${asset.type}
- **Category**: ${asset.category || 'N/A'}
- **Status**: ✅ ${asset.status}
${asset.description ? `- **Description**: ${asset.description}` : ''}
${asset.vertexCount ? `- **Vertices**: ${asset.vertexCount.toLocaleString()}` : ''}
${asset.triangleCount ? `- **Triangles**: ${asset.triangleCount.toLocaleString()}` : ''}
`).join('\n') : '_No completed assets yet_'}

## 🔧 Generated with Asset Forge

This project was created using [Asset Forge](https://github.com/yourusername/asset-forge), an AI-powered 3D asset generation platform powered by:

- **OpenAI DALL-E** - Concept art generation
- **Meshy.ai** - 3D model generation
- **ElevenLabs** - Voice synthesis (if applicable)

## 📂 Repository Structure

\`\`\`
.
├── README.md           # This file
├── project.json        # Project metadata
├── assets/             # Generated assets
│   ├── manifest.json   # Assets manifest
│   └── [asset-name]/   # Individual asset folders
│       └── README.md   # Asset documentation
└── .gitattributes      # Git LFS configuration
\`\`\`

## 📝 License

Add your license information here.

## 🤝 Contributing

This repository contains auto-generated content. For contributions to the Asset Forge platform itself, please visit the main repository.

---

Generated on ${new Date().toLocaleDateString()} with ❤️ by Asset Forge
`
  }
  
  /**
   * Generate project metadata JSON
   */
  generateProjectMetadata(project, assets) {
    return {
      version: '1.0',
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        type: project.type,
        tags: project.tags ? JSON.parse(project.tags) : [],
        isPublic: project.isPublic,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      assets: assets.map(asset => ({
        id: asset.id,
        name: asset.name,
        description: asset.description,
        type: asset.type,
        category: asset.category,
        status: asset.status,
        vertexCount: asset.vertexCount,
        triangleCount: asset.triangleCount,
        fileSize: asset.fileSize,
        prompt: asset.prompt,
        tags: asset.tags ? JSON.parse(asset.tags) : [],
        createdAt: asset.createdAt,
      })),
      statistics: {
        totalAssets: assets.length,
        completedAssets: assets.filter(a => a.status === 'completed').length,
        failedAssets: assets.filter(a => a.status === 'failed').length,
        totalVertices: assets.reduce((sum, a) => sum + (a.vertexCount || 0), 0),
        totalTriangles: assets.reduce((sum, a) => sum + (a.triangleCount || 0), 0),
        totalFileSize: assets.reduce((sum, a) => sum + (a.fileSize || 0), 0),
      },
      generatedBy: 'Asset Forge',
      generatedAt: new Date().toISOString(),
    }
  }
  
  /**
   * Generate assets manifest
   */
  generateAssetsManifest(assets) {
    return {
      version: '1.0',
      assets: assets.map(asset => ({
        id: asset.id,
        name: asset.name,
        type: asset.type,
        category: asset.category,
        status: asset.status,
        glbPath: asset.glbPath,
        thumbnailPath: asset.thumbnailPath,
      })),
    }
  }
  
  /**
   * Generate individual asset README
   */
  generateAssetReadme(asset) {
    return `# ${asset.name}

${asset.description || 'AI-generated 3D asset'}

## Asset Information

- **Type**: ${asset.type}
- **Category**: ${asset.category || 'N/A'}
- **Status**: ${asset.status}
${asset.vertexCount ? `- **Vertex Count**: ${asset.vertexCount.toLocaleString()}` : ''}
${asset.triangleCount ? `- **Triangle Count**: ${asset.triangleCount.toLocaleString()}` : ''}
${asset.fileSize ? `- **File Size**: ${(asset.fileSize / 1024).toFixed(2)} KB` : ''}

${asset.prompt ? `## Generation Prompt\n\n\`\`\`\n${asset.prompt}\n\`\`\`` : ''}

## Files

${asset.glbPath ? `- **3D Model**: \`${path.basename(asset.glbPath)}\`` : ''}
${asset.thumbnailPath ? `- **Thumbnail**: \`${path.basename(asset.thumbnailPath)}\`` : ''}
${asset.conceptArtPath ? `- **Concept Art**: \`${path.basename(asset.conceptArtPath)}\`` : ''}

---

Generated with Asset Forge on ${new Date(asset.createdAt).toLocaleDateString()}
`
  }
  
  /**
   * Sanitize filename for use in paths
   */
  sanitizeFilename(filename) {
    return filename
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50)
  }
  
  /**
   * Sleep utility for rate limiting
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export const githubService = new GitHubService()

