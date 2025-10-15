export class TypedEventEmitter<Events extends Record<PropertyKey, any>> {
  private listeners: { [K in keyof Events]?: Set<(data: Events[K]) => void> } = {}

  on<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): this {
    ;(this.listeners[event] ||= new Set()).add(listener)
    return this
  }

  addListener<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): this {
    return this.on(event, listener)
  }

  off<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): this {
    const set = this.listeners[event]
    if (set) set.delete(listener as any)
    return this
  }

  removeListener<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): this {
    return this.off(event, listener)
  }

  once<K extends keyof Events>(event: K, listener: (data: Events[K]) => void): this {
    const wrapper = (data: Events[K]) => {
      this.off(event, wrapper as any)
      listener(data)
    }
    this.on(event, wrapper as any)
    return this
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): boolean {
    const set = this.listeners[event]
    if (!set || set.size === 0) return false
    for (const fn of Array.from(set)) {
      try {
        ;(fn as (arg: Events[K]) => void)(data)
      } catch (e) {
        console.error(e)
      }
    }
    return true
  }
} 