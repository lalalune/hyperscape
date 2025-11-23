/**
 * Type declarations for @cloudflare/containers
 *
 * Since this package is not published yet, we provide type declarations
 * for the Cloudflare Container Runtime APIs.
 */

declare module "@cloudflare/containers" {
  /**
   * Durable Object stub for container communication
   */
  interface DurableObjectStub {
    fetch(request: Request): Promise<Response>;
  }

  /**
   * Durable Object namespace for container management
   */
  interface DurableObjectNamespace {
    // Methods for namespace management
  }

  /**
   * Base class for Cloudflare container instances
   */
  export class Container {
    defaultPort?: number;
    sleepAfter?: string;
  }

  /**
   * Get a random container instance from the namespace
   * @param namespace - Durable Object namespace
   * @param maxInstances - Maximum number of container instances
   * @returns Container stub for communication
   */
  export function getRandom(
    namespace: DurableObjectNamespace,
    maxInstances: number,
  ): Promise<DurableObjectStub>;
}
