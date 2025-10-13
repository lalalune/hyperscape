import { spawn, exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface DockerManagerConfig {
  containerName: string
  postgresUser: string
  postgresPassword: string
  postgresDb: string
  postgresPort: number
  imageName: string
}

export class DockerManager {
  private config: DockerManagerConfig
  private containerStartedByUs = false

  constructor(config: DockerManagerConfig) {
    this.config = config
  }

  async checkDockerRunning(): Promise<void> {
    await execAsync('docker info')
    console.log('[Docker] Docker daemon is running')
  }

  async checkPostgresRunning(): Promise<boolean> {
    const { stdout: existsOut } = await execAsync(
      `docker ps -a --filter "name=^/${this.config.containerName}$" --format "{{.Names}}"`
    )
    const exists = existsOut.trim() === this.config.containerName
    if (!exists) {
      return false
    }
    
    const { stdout } = await execAsync(
      `docker inspect -f '{{.State.Running}}' ${this.config.containerName}`
    )
    const isRunning = stdout.trim() === 'true'
    if (isRunning) {
      console.log(`[Docker] PostgreSQL container '${this.config.containerName}' is already running`)
    }
    return isRunning
  }

  async startPostgres(): Promise<void> {
    console.log(`[Docker] Starting PostgreSQL container '${this.config.containerName}'...`)
    
    const { stdout } = await execAsync(
      `docker ps -a --filter "name=^/${this.config.containerName}$" --format "{{.Names}}"`
    )
    if (stdout.trim() === this.config.containerName) {
      // Container exists, just start it
      console.log('[Docker] Found existing container, starting it...')
      await execAsync(`docker start ${this.config.containerName}`)
      this.containerStartedByUs = true
    } else {
      // Create new container
      console.log('[Docker] Creating new PostgreSQL container...')
      await this.createPostgresContainer()
      this.containerStartedByUs = true
    }

    // Wait for PostgreSQL to be ready
    await this.waitForPostgres()
    console.log('[Docker] PostgreSQL is ready')
  }

  private async createPostgresContainer(): Promise<void> {
    const dockerArgs = [
      'run',
      '-d',
      '--name', this.config.containerName,
      '-e', `POSTGRES_USER=${this.config.postgresUser}`,
      '-e', `POSTGRES_PASSWORD=${this.config.postgresPassword}`,
      '-e', `POSTGRES_DB=${this.config.postgresDb}`,
      '-p', `${this.config.postgresPort}:5432`,
      '-v', `${this.config.containerName}-data:/var/lib/postgresql/data`,
      this.config.imageName
    ]

    return new Promise((resolve, reject) => {
      const process = spawn('docker', dockerArgs, { stdio: 'inherit' })
      
      process.on('exit', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`Docker container creation failed with code ${code}`))
        }
      })
      
      process.on('error', reject)
    })
  }

  private async waitForPostgres(maxAttempts: number = 30): Promise<void> {
    console.log('[Docker] Waiting for PostgreSQL to be ready...')
    
    for (let i = 0; i < maxAttempts; i++) {
      const { stdout } = await execAsync(
        `docker exec ${this.config.containerName} pg_isready -U ${this.config.postgresUser}`
      )
      
      if (stdout.includes('accepting connections')) {
        return
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    throw new Error('PostgreSQL failed to become ready within timeout period')
  }

  async stopPostgres(): Promise<void> {
    if (!this.containerStartedByUs) {
      console.log('[Docker] Container was not started by us, leaving it running')
      return
    }

    console.log(`[Docker] Stopping PostgreSQL container '${this.config.containerName}'...`)
    await execAsync(`docker stop ${this.config.containerName}`)
    console.log('[Docker] PostgreSQL container stopped')
  }

  async getConnectionString(): Promise<string> {
    return `postgresql://${this.config.postgresUser}:${this.config.postgresPassword}@localhost:${this.config.postgresPort}/${this.config.postgresDb}`
  }
}

// Default configuration
export function createDefaultDockerManager(): DockerManager {
  const config: DockerManagerConfig = {
    containerName: process.env.POSTGRES_CONTAINER || 'hyperscape-postgres',
    postgresUser: process.env.POSTGRES_USER || 'hyperscape',
    postgresPassword: process.env.POSTGRES_PASSWORD || 'hyperscape_dev',
    postgresDb: process.env.POSTGRES_DB || 'hyperscape',
    postgresPort: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    imageName: process.env.POSTGRES_IMAGE || 'postgres:16-alpine',
  }
  
  return new DockerManager(config)
}

