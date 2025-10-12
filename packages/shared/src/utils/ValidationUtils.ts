/**
 * Type validation and assertion utilities
 * Consolidated validation functions for the codebase
 */

import type { Position3D } from '../types/index';

// Basic type guards
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

// Specific validators
export function isValidColor(value: unknown): value is string {
  return isString(value) && (
    value.startsWith('#') || 
    value.startsWith('rgb') || 
    value.startsWith('hsl') ||
    /^[a-z]+$/i.test(value)
  );
}

export function isValidUrl(value: unknown): value is string {
  if (!isString(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return value.startsWith('/') || value.startsWith('./') || value.startsWith('../');
  }
}

// Position validation
export function validatePosition(pos: unknown): pos is Position3D {
  if (!pos || typeof pos !== 'object') return false;
  const p = pos as Record<string, unknown>;
  return isNumber(p.x) && isNumber(p.y) && isNumber(p.z);
}

// Distance calculation
export function calculateDistance(pos1: Position3D, pos2: Position3D): number {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function calculateDistance2D(pos1: Position3D, pos2: Position3D): number {
  const dx = pos2.x - pos1.x;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dz * dz);
}