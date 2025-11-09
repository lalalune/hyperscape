/**
 * Global Error Handler Middleware
 * Catches and formats all errors with appropriate status codes
 */

import { Elysia } from "elysia";

/**
 * Global error handling middleware
 */
export const errorHandler = new Elysia({ name: "error-handler" }).onError(
  ({ code, error, set }) => {
    console.error(`[Error ${code}]`, error);

    // Handle validation errors
    if (code === "VALIDATION") {
      set.status = 400;
      return {
        error: "Validation failed",
        details:
          error && typeof error === "object" && "message" in error
            ? (error as Error).message
            : "Unknown error",
      };
    }

    // Handle not found errors
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Endpoint not found" };
    }

    // Handle parse errors
    if (code === "PARSE") {
      set.status = 400;
      return { error: "Invalid request body format" };
    }

    // Handle internal server errors
    set.status = 500;
    return {
      error: "Internal server error",
      message:
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : error && typeof error === "object" && "message" in error
            ? (error as Error).message
            : "Unknown error",
    };
  },
);
