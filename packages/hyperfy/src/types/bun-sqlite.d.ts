declare module 'bun:sqlite' {
  export class Database {
    constructor(filename: string)
    query(sql: string): {
      all(): any[]
      get(): any
      run(): void
    }
    run(sql: string): void
    close(): void
  }
}
