/**
 * Error reporting type definitions
 * 
 * Shared types for error handling and reporting
 */

import type { ReactNode } from 'react';

// Frontend error report structure
export interface ErrorReport {
  message: string;
  stack: string;
  url: string;
  userAgent: string;
  timestamp: string;
  context: unknown;
  componentStack: string;
  userId: string;
  sessionId: string;
}

// React Error Boundary types
export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}