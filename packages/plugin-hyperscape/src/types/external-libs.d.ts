/**
 * CLAUDE.md Exception: External library type definitions
 *
 * These `any` types are acceptable as they represent external library shims
 * for @hyperscape/shared module which may not have complete TypeScript definitions.
 *
 * Rationale: External libraries without proper type definitions require `any`
 * to maintain type safety in the rest of the codebase while allowing flexibility
 * for runtime behavior.
 */
declare module "@hyperscape/shared" {
  export interface World {
    [key: string]: any;
  }

  export type Entity = any;
}
