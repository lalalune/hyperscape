declare module 'express' {
  export interface Request {
    headers: Record<string, string | string[] | undefined>
    query?: Record<string, unknown>
    cookies?: Record<string, string>
    [key: string]: unknown
  }

  export interface Response {
    status: (code: number) => Response
    json: (body: unknown) => Response
  }

  export type NextFunction = (err?: unknown) => void
}

