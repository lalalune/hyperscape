/**
 * Docker Container Manager
 *
 * This module automates Docker container lifecycle management for local development.
 * It handles starting, stopping, and health-checking PostgreSQL containers so developers
 * don't need to manually manage database infrastructure.
 *
 * **Key Features**:
 * - Automatic PostgreSQL container creation and startup
 * - Health checks before returning control to caller
 * - Idempotent operations (safe to call multiple times)
 * - Graceful shutdown tracking (only stops containers we started)
 * - Persistent data volumes to survive container restarts
 *
 * **Container Lifecycle**:
 * 1. `checkDockerRunning()`: Verify Docker daemon is accessible
 * 2. `checkPostgresRunning()`: Check if container exists and is running
 * 3. `startPostgres()`: Create container if needed, start it, wait for ready
 * 4. `waitForPostgres()`: Poll pg_isready until accepting connections
 * 5. `stopPostgres()`: Stop container on shutdown (only if we started it)
 *
 * **Data Persistence**:
 * Creates a named Docker volume (e.g., "hyperscape-postgres-data") that persists
 * database data across container restarts. This means player data survives server
 * restarts in development.
 *
 * **Configuration**:
 * All settings come from environment variables:
 * - `POSTGRES_CONTAINER`: Container name (default: hyperscape-postgres)
 * - `POSTGRES_USER`: Database user (default: hyperscape)
 * - `POSTGRES_PASSWORD`: Database password (default: hyperscape_dev)
 * - `POSTGRES_DB`: Database name (default: hyperscape)
 * - `POSTGRES_PORT`: Host port mapping (default: 5432)
 * - `POSTGRES_IMAGE`: Docker image (default: postgres:16-alpine)
 *
 * **Hot Reload Support**:
 * Tracks whether we started the container (`containerStartedByUs`). If the container
 * was already running (from a previous session or manual start), we leave it running
 * during hot reload to avoid connection interruption.
 *
 * **Error Handling**:
 * - Throws if Docker daemon is not running
 * - Throws if PostgreSQL fails to become ready within timeout
 * - Safe to call even if container already exists
 *
 * **Referenced by**: index.ts (server startup and shutdown)
 */

import { spawn, exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Docker container configuration
 */
export interface DockerManagerConfig {
  containerName: string;
  postgresUser: string;
  postgresPassword: string;
  postgresDb: string;
  postgresPort: number;
  imageName: string;
}

/**
 * Manages Docker containers for local development
 * Handles PostgreSQL container lifecycle automatically
 */
export class DockerManager {
  private config: DockerManagerConfig;
  private containerStartedByUs = false;

  /**
   * Constructs a new DockerManager
   *
   * @param config - Docker container configuration
   *
   * @public
   */
  constructor(config: DockerManagerConfig) {
    this.config = config;
  }

  /**
   * Checks if the Docker daemon is running
   *
   * Executes `docker info` to verify Docker is accessible.
   *
   * @throws Error if Docker is not running or not installed
   *
   * @public
   */
  async checkDockerRunning(): Promise<void> {
    await execAsync("docker info");
  }

  /**
   * Checks if the PostgreSQL container is running
   *
   * Inspects the container state to determine if it exists and is running.
   *
   * @returns true if container exists and is running, false otherwise
   *
   * @public
   */
  async checkPostgresRunning(): Promise<boolean> {
    const { stdout: existsOut } = await execAsync(
      `docker ps -a --filter "name=^/${this.config.containerName}$" --format "{{.Names}}"`,
    );
    const exists = existsOut.trim() === this.config.containerName;
    if (!exists) {
      return false;
    }

    const { stdout } = await execAsync(
      `docker inspect -f '{{.State.Running}}' ${this.config.containerName}`,
    );
    const isRunning = stdout.trim() === "true";
    if (isRunning) {
    }
    return isRunning;
  }

  /**
   * Starts the PostgreSQL container
   *
   * Creates a new container if it doesn't exist, or starts an existing stopped container.
   * Waits for PostgreSQL to be ready before returning (polls pg_isready).
   *
   * @throws Error if container fails to start or become ready
   *
   * @public
   */
  async startPostgres(): Promise<void> {
    const { stdout } = await execAsync(
      `docker ps -a --filter "name=^/${this.config.containerName}$" --format "{{.Names}}"`,
    );
    if (stdout.trim() === this.config.containerName) {
      // Container exists, just start it
      await execAsync(`docker start ${this.config.containerName}`);
      this.containerStartedByUs = true;
    } else {
      // Create new container
      await this.createPostgresContainer();
      this.containerStartedByUs = true;
    }

    // Wait for PostgreSQL to be ready
    await this.waitForPostgres();
  }

  private async createPostgresContainer(): Promise<void> {
    const dockerArgs = [
      "run",
      "-d",
      "--name",
      this.config.containerName,
      "-e",
      `POSTGRES_USER=${this.config.postgresUser}`,
      "-e",
      `POSTGRES_PASSWORD=${this.config.postgresPassword}`,
      "-e",
      `POSTGRES_DB=${this.config.postgresDb}`,
      "-p",
      `${this.config.postgresPort}:5432`,
      "-v",
      `${this.config.containerName}-data:/var/lib/postgresql/data`,
      this.config.imageName,
    ];

    return new Promise((resolve, reject) => {
      const process = spawn("docker", dockerArgs, { stdio: "inherit" });

      process.on("exit", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(`Docker container creation failed with code ${code}`),
          );
        }
      });

      process.on("error", reject);
    });
  }

  private async waitForPostgres(maxAttempts: number = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const { stdout } = await execAsync(
          `docker exec ${this.config.containerName} pg_isready -U ${this.config.postgresUser}`,
        );

        if (stdout.includes("accepting connections")) {
          return;
        }
      } catch {
        // pg_isready returns non-zero when not ready - this is expected, retry
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error("PostgreSQL failed to become ready within timeout period");
  }

  /**
   * Stops the PostgreSQL container
   *
   * Only stops the container if this DockerManager instance started it.
   * If the container was already running when we connected, it's left running.
   *
   * @public
   */
  async stopPostgres(): Promise<void> {
    if (!this.containerStartedByUs) {
      return;
    }

    await execAsync(`docker stop ${this.config.containerName}`);
  }

  /**
   * Gets the PostgreSQL connection string
   *
   * Constructs the connection URL from the configuration.
   *
   * @returns PostgreSQL connection string (postgresql://user:pass@host:port/database)
   *
   * @public
   */
  async getConnectionString(): Promise<string> {
    return `postgresql://${this.config.postgresUser}:${this.config.postgresPassword}@localhost:${this.config.postgresPort}/${this.config.postgresDb}`;
  }
}

/**
 * Creates a DockerManager with default configuration from environment variables
 *
 * Reads configuration from environment variables with sensible defaults:
 * - POSTGRES_CONTAINER: Container name (default: hyperscape-postgres)
 * - POSTGRES_USER: Database user (default: hyperscape)
 * - POSTGRES_PASSWORD: Database password (default: hyperscape_dev)
 * - POSTGRES_DB: Database name (default: hyperscape)
 * - POSTGRES_PORT: Host port (default: 5432)
 * - POSTGRES_IMAGE: Docker image (default: postgres:16-alpine)
 *
 * @returns Configured DockerManager instance
 *
 * @public
 */
export function createDefaultDockerManager(): DockerManager {
  const config: DockerManagerConfig = {
    containerName: process.env.POSTGRES_CONTAINER || "hyperscape-postgres",
    postgresUser: process.env.POSTGRES_USER || "hyperscape",
    postgresPassword: process.env.POSTGRES_PASSWORD || "hyperscape_dev",
    postgresDb: process.env.POSTGRES_DB || "hyperscape",
    postgresPort: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    imageName: process.env.POSTGRES_IMAGE || "postgres:16-alpine",
  };

  return new DockerManager(config);
}
