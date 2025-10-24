/**
 * Route Utilities
 *
 * Helper functions for route matching, breadcrumb generation, and navigation logic.
 */

import { Home } from 'lucide-react'

import { getNavItemForRoute } from '../config/navigation-config'
import type { RoutePath, RouteMetadata } from '../constants/routes'
import { ROUTES, ROUTE_METADATA } from '../constants/routes'
import type { BreadcrumbItem } from '../types/navigation'

/**
 * Match a route pattern with dynamic segments
 * Example: matchRoute('/assets/:id', '/assets/123') => { id: '123' }
 */
export function matchRoute(
  pattern: string,
  path: string
): Record<string, string> | null {
  // Strip query string from path before matching
  const pathWithoutQuery = path.split('?')[0]
  const patternParts = pattern.split('/')
  const pathParts = pathWithoutQuery.split('/')

  if (patternParts.length !== pathParts.length) {
    return null
  }

  const params: Record<string, string> = {}

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i]
    const pathPart = pathParts[i]

    if (patternPart.startsWith(':')) {
      // Dynamic segment
      const paramName = patternPart.slice(1)
      params[paramName] = pathPart
    } else if (patternPart !== pathPart) {
      // Literal segment doesn't match
      return null
    }
  }

  return params
}

/**
 * Check if a path matches a route pattern
 */
export function pathMatchesRoute(pattern: string, path: string): boolean {
  return matchRoute(pattern, path) !== null
}

/**
 * Get route params from a path
 */
export function getRouteParams(
  pattern: string,
  path: string
): Record<string, string> {
  return matchRoute(pattern, path) || {}
}

// Cache for breadcrumbs
const breadcrumbCache = new Map<string, BreadcrumbItem[]>()

/**
 * Build breadcrumbs for a given route path
 * Cached for performance
 */
export function buildBreadcrumbs(path: string): BreadcrumbItem[] {
  // Check cache first
  const cached = breadcrumbCache.get(path)
  if (cached) return cached

  const breadcrumbs: BreadcrumbItem[] = []

  // Always start with home
  breadcrumbs.push({
    label: 'Home',
    path: ROUTES.HOME,
    icon: Home,
  })

  // Find metadata for current path
  let metadata = ROUTE_METADATA[path as RoutePath]

  // If no exact match, try to find parent path
  if (!metadata) {
    // Find the longest matching parent path
    const matchingPaths = Object.keys(ROUTE_METADATA)
      .filter(routePath => path.startsWith(routePath) && routePath !== ROUTES.HOME)
      .sort((a, b) => b.length - a.length)

    if (matchingPaths.length > 0) {
      metadata = ROUTE_METADATA[matchingPaths[0] as RoutePath]
    }
  }

  if (!metadata) {
    // No metadata found, return just home
    breadcrumbCache.set(path, breadcrumbs)
    return breadcrumbs
  }

  // Build parent chain
  const parents: RouteMetadata[] = []
  let current = metadata

  while (current.parent) {
    const parentMetadata = ROUTE_METADATA[current.parent]
    if (!parentMetadata) break

    parents.unshift(parentMetadata)
    current = parentMetadata
  }

  // Add parents to breadcrumbs
  for (const parent of parents) {
    const navItem = getNavItemForRoute(parent.path)
    breadcrumbs.push({
      label: parent.breadcrumb || parent.title,
      path: parent.path,
      icon: navItem?.icon,
    })
  }

  // Add current page (no path - it's the active page)
  const currentNavItem = getNavItemForRoute(metadata.path)
  breadcrumbs.push({
    label: metadata.breadcrumb ?? metadata.title,
    icon: currentNavItem?.icon,
  })

  // Cache the result
  breadcrumbCache.set(path, breadcrumbs)
  return breadcrumbs
}

/**
 * Get page title for a route
 */
export function getPageTitle(path: string): string {
  const metadata = ROUTE_METADATA[path as RoutePath]
  return metadata?.title || 'Asset Forge'
}

/**
 * Check if a route is a child of another route
 */
export function isChildRoute(childPath: string, parentPath: string): boolean {
  if (childPath === parentPath) return false

  // Normalize paths
  const normalizedChild = childPath.replace(/\/$/, '')
  const normalizedParent = parentPath.replace(/\/$/, '')

  return normalizedChild.startsWith(normalizedParent + '/')
}

/**
 * Get parent route for a given path
 */
export function getParentRoute(path: string): RoutePath | null {
  const metadata = ROUTE_METADATA[path as RoutePath]
  return metadata?.parent || null
}

/**
 * Navigate with query parameters
 */
export function buildPathWithQuery(
  path: RoutePath,
  params: Record<string, string>
): string {
  const queryString = new URLSearchParams(params).toString()
  return queryString ? `${path}?${queryString}` : path
}

/**
 * Parse query parameters from current path
 */
export function parseQueryParams(search: string): Record<string, string> {
  const params = new URLSearchParams(search)
  const result: Record<string, string> = {}

  params.forEach((value, key) => {
    result[key] = value
  })

  return result
}

/**
 * Validate if a path is a valid route
 */
export function isValidRoute(path: string): boolean {
  return Object.values(ROUTES).includes(path as RoutePath)
}

/**
 * Get the closest valid parent route for an invalid path
 */
export function getClosestValidRoute(path: string): RoutePath {
  // If path is valid, return it
  if (isValidRoute(path)) {
    return path as RoutePath
  }

  // Try to find parent path
  const parts = path.split('/').filter(Boolean)

  while (parts.length > 0) {
    const testPath = '/' + parts.join('/')
    if (isValidRoute(testPath)) {
      return testPath as RoutePath
    }
    parts.pop()
  }

  // Default to home
  return ROUTES.HOME
}
