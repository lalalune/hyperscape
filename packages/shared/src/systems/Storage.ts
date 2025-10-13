import { throttle } from 'lodash-es'

type SystemDatabase = {
  (table: string): {
    where: (key: string, value: unknown) => {
      first: () => Promise<{ key: string; value: string } | undefined>
      update: (data: Record<string, unknown>) => Promise<number>
      delete: () => Promise<number>
    }
    insert: (data: Record<string, unknown> | Record<string, unknown>[]) => Promise<void>
  }
}

export class Storage<T = unknown> {
  private db: SystemDatabase | null = null
  private data: Record<string, T> = {}
  private save: () => void
  private initialized = false

  constructor(db: SystemDatabase) {
    this.db = db
    this.save = throttle(() => this.persist(), 1000, { leading: true, trailing: true })
  }

  private async initialize(): Promise<void> {
    if (this.initialized || !this.db) return
    
    // Load all storage data from database
    const rows = await this.db('storage') as unknown as Array<{ key: string; value: string }>
    for (const row of rows) {
      try {
        this.data[row.key] = JSON.parse(row.value) as T
      } catch (err) {
        console.error(`[Storage] Failed to parse value for key ${row.key}:`, err)
      }
    }
    
    this.initialized = true
  }

  async get(key: string): Promise<T | undefined> {
    await this.initialize()
    return this.data[key]
  }

  async set(key: string, value: T): Promise<void> {
    await this.initialize()
    // Type enforcement happens at compile time through TypeScript generics
    if (value !== undefined) {
      this.data[key] = value
      this.save()
    }
  }

  async persist(): Promise<void> {
    if (!this.db) return
    
    // Persist all data to database using upsert pattern
    for (const [key, value] of Object.entries(this.data)) {
      const valueStr = JSON.stringify(value)
      const existing = await this.db('storage').where('key', key).first()
      
      if (existing) {
        await this.db('storage').where('key', key).update({
          value: valueStr,
          updatedAt: Date.now()
        })
      } else {
        await this.db('storage').insert({
          key,
          value: valueStr,
          updatedAt: Date.now()
        })
      }
    }
  }
}
