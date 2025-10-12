import fs from 'fs-extra'
import { throttle } from 'lodash-es'

export class Storage<T = unknown> {
  private file: string
  private data: Record<string, T>
  private save: () => void

  constructor(file: string) {
    this.file = file
    try {
      this.data = fs.readJsonSync(this.file)
    } catch (_err) {
      this.data = {}
    }
    this.save = throttle(() => this.persist(), 1000, { leading: true, trailing: true })
  }

  get(key: string): T | undefined {
    return this.data[key]
  }

  set(key: string, value: T): void {
    // Type enforcement happens at compile time through TypeScript generics
    if (value !== undefined) {
      this.data[key] = value
      this.save()
    }
  }

  async persist(): Promise<void> {
    // console.time('[storage] persist')
    try {
      await fs.writeJson(this.file, this.data)
    } catch (_err) {
      console.error('failed to persist storage', _err)
    }
    // console.timeEnd('[storage] persist')
  }
}
