/**
 * Manifest Validation Utilities
 *
 * Validates string manifests and other data manifests for completeness.
 * Provides build-time and runtime validation for data-driven content.
 *
 * @packageDocumentation
 */

import { UI_STRINGS } from "@/constants/strings";

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * String manifest entry
 */
interface StringEntry {
  key: string;
  value: string;
  path: string;
}

/**
 * Recursively extracts all strings from the manifest
 */
function extractStrings(
  obj: Record<string, unknown>,
  path: string = "",
): StringEntry[] {
  const entries: StringEntry[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;

    if (typeof value === "string") {
      entries.push({ key, value, path: currentPath });
    } else if (typeof value === "object" && value !== null) {
      entries.push(
        ...extractStrings(value as Record<string, unknown>, currentPath),
      );
    }
  }

  return entries;
}

/**
 * Validates the string manifest for completeness and issues
 */
export function validateStringManifest(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const entries = extractStrings(UI_STRINGS as Record<string, unknown>);

  for (const entry of entries) {
    // Check for empty strings
    if (entry.value.trim() === "") {
      errors.push(`Empty string at path: ${entry.path}`);
    }

    // Check for placeholder-only strings
    if (/^\{[^}]+\}$/.test(entry.value)) {
      warnings.push(
        `String is just a placeholder at path: ${entry.path} -> "${entry.value}"`,
      );
    }

    // Check for unbalanced placeholders
    const openBraces = (entry.value.match(/\{/g) || []).length;
    const closeBraces = (entry.value.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push(
        `Unbalanced placeholders at path: ${entry.path} -> "${entry.value}"`,
      );
    }

    // Check for very long strings (might indicate missing truncation)
    if (entry.value.length > 200) {
      warnings.push(
        `Very long string (${entry.value.length} chars) at path: ${entry.path}`,
      );
    }
  }

  // Check for expected top-level categories
  const expectedCategories = [
    "core",
    "death",
    "kicked",
    "auth",
    "settings",
    "panels",
    "inventory",
    "combat",
    "skills",
    "toast",
    "errors",
    "actions",
    "time",
  ];

  for (const category of expectedCategories) {
    if (!(category in UI_STRINGS)) {
      warnings.push(`Missing expected category: ${category}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates that all required string keys are present for a component
 */
export function validateComponentStrings(
  componentName: string,
  requiredKeys: string[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const allStrings = extractStrings(UI_STRINGS as Record<string, unknown>);
  const allPaths = new Set(allStrings.map((s) => s.path));

  for (const key of requiredKeys) {
    if (!allPaths.has(key)) {
      errors.push(`Missing required string for ${componentName}: ${key}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Gets all placeholder names used in a string
 */
export function getPlaceholders(str: string): string[] {
  const matches = str.match(/\{([^}]+)\}/g) || [];
  return matches.map((m) => m.slice(1, -1));
}

/**
 * Validates that all placeholders in a string are provided
 */
export function validatePlaceholders(
  key: string,
  params: Record<string, unknown>,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Get the string value
  const parts = key.split(".");
  let value: unknown = UI_STRINGS;
  for (const part of parts) {
    if (typeof value === "object" && value !== null && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      errors.push(`String not found: ${key}`);
      return { valid: false, errors, warnings };
    }
  }

  if (typeof value !== "string") {
    errors.push(`Value at ${key} is not a string`);
    return { valid: false, errors, warnings };
  }

  // Check placeholders
  const placeholders = getPlaceholders(value);
  const providedKeys = new Set(Object.keys(params));

  for (const placeholder of placeholders) {
    if (!providedKeys.has(placeholder)) {
      errors.push(`Missing placeholder value for {${placeholder}} in ${key}`);
    }
  }

  // Warn about unused params
  for (const paramKey of Object.keys(params)) {
    if (!placeholders.includes(paramKey)) {
      warnings.push(`Unused parameter: ${paramKey} for string ${key}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Development-only manifest validation
 *
 * Runs validation in development mode and logs issues to console.
 */
export function devValidateManifest(): void {
  if (import.meta.env.PROD) {
    return;
  }

  const result = validateStringManifest();

  if (result.errors.length > 0) {
    console.error("[Manifest Validation] Errors found:");
    result.errors.forEach((e) => console.error(`  - ${e}`));
  }

  if (result.warnings.length > 0) {
    console.warn("[Manifest Validation] Warnings:");
    result.warnings.forEach((w) => console.warn(`  - ${w}`));
  }

  if (result.valid && result.warnings.length === 0) {
    console.log("[Manifest Validation] All strings valid");
  }
}

/**
 * Checks if a string key exists in the manifest
 */
export function hasString(key: string): boolean {
  const parts = key.split(".");
  let current: unknown = UI_STRINGS;

  for (const part of parts) {
    if (typeof current !== "object" || current === null || !(part in current)) {
      return false;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === "string";
}

/**
 * Gets the total count of strings in the manifest
 */
export function getStringCount(): number {
  return extractStrings(UI_STRINGS as Record<string, unknown>).length;
}

/**
 * Gets statistics about the string manifest
 */
export function getManifestStats(): {
  totalStrings: number;
  categories: number;
  avgLength: number;
  withPlaceholders: number;
} {
  const entries = extractStrings(UI_STRINGS as Record<string, unknown>);
  const categories = Object.keys(UI_STRINGS).length;
  const totalLength = entries.reduce((sum, e) => sum + e.value.length, 0);
  const withPlaceholders = entries.filter((e) => e.value.includes("{")).length;

  return {
    totalStrings: entries.length,
    categories,
    avgLength: Math.round(totalLength / entries.length),
    withPlaceholders,
  };
}
