class Logger {
  private context: string

  constructor(context: string) {
    this.context = context
  }

  debug(message: string, data?: unknown) {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.debug(`[${this.context}]`, message, data)
    }
  }

  info(message: string, data?: unknown) {
    console.info(`[${this.context}]`, message, data)
  }

  warn(message: string, data?: unknown) {
    console.warn(`[${this.context}]`, message, data)
  }

  error(message: string, error?: Error | unknown) {
    console.error(`[${this.context}]`, message, error)
  }
}

export const createLogger = (context: string) => new Logger(context)
