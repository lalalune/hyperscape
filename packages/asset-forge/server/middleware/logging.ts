/**
 * Request/Response Logging Middleware
 * Logs all incoming requests and outgoing responses with timing information
 */

import { Elysia } from "elysia";

/**
 * Logging middleware for request/response tracking
 */
export const loggingMiddleware = new Elysia({ name: "logging" })
  // Log incoming requests
  .onRequest(({ request }) => {
    const timestamp = new Date().toISOString();
    const url = new URL(request.url);
    console.log(`[${timestamp}] ${request.method} ${url.pathname}`);
  })

  // Log responses with timing information
  .onAfterResponse(({ request, set }) => {
    const url = new URL(request.url);
    const timing = set.headers["server-timing"];
    if (timing) {
      console.log(`[Response] ${request.method} ${url.pathname} - ${timing}`);
    }
  });
