/**
 * Server-specific storage implementation
 *
 * This module handles Node.js file-based storage.
 * It should only be imported on the server side.
 */

export class NodeStorage {
  file: string = "";
  data: Record<string, unknown> = {};
  private fs: typeof import("node:fs/promises") | null = null;
  private path: {
    join: (...paths: string[]) => string;
    dirname: (path: string) => string;
  } | null = null;
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    void this.ensureInitialized();
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!this.initializationPromise) {
      this.initializationPromise = this.initialize().catch((error) => {
        this.initializationPromise = null;
        throw error;
      });
    }

    await this.initializationPromise;
  }

  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const fsModuleId = "node:fs";
    const pathModuleId = "node:path";
    const { promises: fs } = (await import(
      /* @vite-ignore */ fsModuleId
    )) as typeof import("node:fs");
    const path = (await import(
      /* @vite-ignore */ pathModuleId
    )) as typeof import("node:path");
    this.fs = fs;
    this.path = path;

    // Use environment variable or current working directory
    const dataDir = process.env.HYPERIA_DATA_DIR || process.cwd();
    this.file = this.path!.join(dataDir, ".hyperia-storage.json");

    // Load existing data
    const exists = await this.fs!.access(this.file)
      .then(() => true)
      .catch(() => false);
    if (exists) {
      const content = await this.fs!.readFile(this.file, { encoding: "utf8" });
      this.data = JSON.parse(content);
    } else {
      // Create empty file
      this.data = {};
      const dir = this.path!.dirname(this.file);
      await this.fs!.mkdir(dir, { recursive: true });
      await this.fs!.writeFile(this.file, JSON.stringify(this.data, null, 2));
    }

    this.initialized = true;
    this.initializationPromise = null;
  }

  async save(): Promise<void> {
    await this.ensureInitialized();
    const dir = this.path!.dirname(this.file);
    await this.fs!.mkdir(dir, { recursive: true });
    await this.fs!.writeFile(this.file, JSON.stringify(this.data, null, 2));
  }

  async get(key: string): Promise<unknown> {
    await this.ensureInitialized();
    const value = this.data[key];
    if (value === undefined) return null;
    return value;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.ensureInitialized();
    this.data[key] = value;
    await this.save();
  }

  async remove(key: string): Promise<void> {
    await this.ensureInitialized();
    delete this.data[key];
    await this.save();
  }
}
