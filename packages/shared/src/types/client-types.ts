/**
 * Client-side type definitions
 * 
 * Shared types for client-side functionality
 */

import type { World } from './index';

// Client component props
export interface ClientProps {
  wsUrl: string | (() => string | Promise<string>);
  onSetup: (world: World, config: Record<string, unknown>) => void;
}

// Loading file interface for field components
export interface LoadingFile {
  type: string;
  name: string;
  url: string;
}